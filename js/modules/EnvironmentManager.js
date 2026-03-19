/**
 * @file Manages the game's environment, including the day/night cycle and associated lighting effects.
 */
class EnvironmentManager {
    constructor() {
        // --- Day/Night Cycle State ---
        this.dayNightTimer = 0; // 0 to DAY_NIGHT_CYCLE_DURATION
        this.previousDayNightTimer = 0; // To detect day wrap
        this.ambientLightLevel = 1.0; // 1.0 = Day, 0.0 = Night (clamped later)

        // --- Lighting & Overlay State ---
        this.lightData = [];
        this.lightDataPool = [];
        this.pointPool = [];
        this.cachedLightSprite = null;
        this.cachedColoredLightSprite = null;
        this.cachedCannonFlashSprite = null;
        this.cachedColoredCannonFlashSprite = null;
        this.sharedDarknessCanvas = null;

        console.log("EnvironmentManager initialized.");
    }

    /**
     * Resets the environment state to default (morning).
     */
    reset() {
        this.dayNightTimer = 0;
        this.previousDayNightTimer = 0;
        this.ambientLightLevel = 1.0;
        console.log("EnvironmentManager reset to morning.");
    }

    /**
     * Updates the day/night cycle timer and calculates the current ambient light level.
     * @param {number} deltaTime - The time elapsed since the last frame in milliseconds.
     * @param {function} onNewDay - A callback function to execute when a new day starts.
     */
    update(deltaTime, onNewDay) {
        this.previousDayNightTimer = this.dayNightTimer;
        this.dayNightTimer = (this.dayNightTimer + deltaTime) % DAY_NIGHT_CYCLE_DURATION;

        // Check for day wrap (New Day)
        if (this.dayNightTimer < this.previousDayNightTimer) {
            if (onNewDay) onNewDay();
        }

        const cycleProgress = this.dayNightTimer / DAY_NIGHT_CYCLE_DURATION;

        // 0.0 - 0.45: Day (1.0)
        // 0.45 - 0.55: Sunset (1.0 -> 0.2)
        // 0.55 - 0.95: Night (0.2)
        // 0.95 - 1.00: Sunrise (0.2 -> 1.0)
        if (cycleProgress < 0.45) {
            this.ambientLightLevel = 1.0;
        } else if (cycleProgress < 0.55) {
            const t = (cycleProgress - 0.45) / 0.10;
            this.ambientLightLevel = 1.0 - (t * 0.8);
        } else if (cycleProgress < 0.95) {
            this.ambientLightLevel = 0.2;
        } else {
            const t = (cycleProgress - 0.95) / 0.05;
            this.ambientLightLevel = 0.2 + (t * 0.8);
        }
    }

    /**
     * Draws the night overlay and dynamic lighting effects.
     * @param {CanvasRenderingContext2D} ctx - The main canvas rendering context.
     * @param {object} camera - The camera object with x and y properties.
     * @param {number} effectiveScale - The current world-to-screen scale.
     * @param {Array<Ship>} allShips - A list of all active ships to draw lights for.
     * @param {EffectManager} effectManager - The manager for visual effects (explosions, etc.).
     */
    draw(ctx, camera, effectiveScale, allShips, effectManager) {
        // Optimization: Skip if fully bright
        if (this.ambientLightLevel >= 0.99) return;

        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const maskCanvas = this._getDarknessMaskCanvas(width, height);
        const maskCtx = maskCanvas.getContext('2d');

        this._releaseLightDataObjects();

        for (const ship of allShips) {
            if (!ship || ship.isSunk || ship.lightsOn === false) continue;

            if (ship.isSinking) {
                const sinkProgress = ship.sinkHp / ship.maxSinkHp;
                if (sinkProgress > 0.25) continue;
                const chance = 1.0 - (sinkProgress / 0.25);
                if (Math.random() >= chance) continue;
            }

            const flicker = 0.95 + Math.random() * 0.1;
            const radius = (ship.shipLength) * flicker;
            const screenRadius = radius * effectiveScale;

            const lightObj = this._getLightDataObject();
            lightObj.radius = screenRadius;
            lightObj.type = 'ship';

            const addPoint = (wx, wy) => {
                const sx = (wx - camera.x) * effectiveScale;
                const sy = (wy - camera.y) * effectiveScale;
                if (sx >= -screenRadius && sx <= width + screenRadius && sy >= -screenRadius && sy <= height + screenRadius) {
                    lightObj.points.push(this._getPointObject(sx, sy));
                }
            };

            addPoint(ship.getBowPointWorldCoords().x, ship.getBowPointWorldCoords().y);
            addPoint(ship.x, ship.y);
            addPoint(ship.getSternPointWorldCoords().x, ship.getSternPointWorldCoords().y);

            if (lightObj.points.length > 0) {
                this.lightData.push(lightObj);
            } else {
                this.lightDataPool.push(lightObj);
            }
        }

        for (const effect of effectManager.cannonEffects) {
            if (effect.type === 'fire') {
                const progress = effect.life / effect.maxLife;
                const scaleFactor = Math.sin(progress * Math.PI); // Symmetrical fade in/out
                const baseRadius = (CANNON_UNIT_SIZE * 4) * (effect.size || 1.0);
                const radius = baseRadius * scaleFactor * effectiveScale;

                if (radius <= 0) continue; // Don't process lights that are invisible

                const sx = (effect.x - camera.x) * effectiveScale;
                const sy = (effect.y - camera.y) * effectiveScale;
                if (sx >= -radius && sx <= width + radius && sy >= -radius && sy <= height + radius) {
                    const lightObj = this._getLightDataObject();
                    lightObj.radius = radius;
                    lightObj.points.push(this._getPointObject(sx, sy));
                    lightObj.type = 'cannon';
                    this.lightData.push(lightObj);
                }
            }
        }

        for (const effect of effectManager.damageEffects) {
            const progress = effect.life / effect.maxLife;
            const intensity = 1.0 - progress;
            if (intensity > 0.05) {
                const radius = (CANNON_UNIT_SIZE * 4) * intensity * effectiveScale;
                const sx = (effect.x - camera.x) * effectiveScale;
                const sy = (effect.y - camera.y) * effectiveScale;
                if (sx >= -radius && sx <= width + radius && sy >= -radius && sy <= height + radius) {
                    const lightObj = this._getLightDataObject();
                    lightObj.radius = radius;
                    lightObj.points.push(this._getPointObject(sx, sy));
                    lightObj.type = 'explosion';
                    this.lightData.push(lightObj);
                }
            }
        }

        maskCtx.save();
        maskCtx.globalCompositeOperation = 'copy';
        const opacity = 1.0 - this.ambientLightLevel;
        maskCtx.fillStyle = NIGHT_AMBIENT_COLOR;
        maskCtx.globalAlpha = opacity;
        maskCtx.fillRect(0, 0, width, height);
        maskCtx.restore();

        maskCtx.save();
        maskCtx.globalCompositeOperation = 'destination-out';
        maskCtx.globalAlpha = 1.0;
        const lightSprite = this._getLightSprite();
        const cannonFlashSprite = this._getCannonFlashSprite();
        for (const item of this.lightData) {
            const size = item.radius * 2;
            const spriteToUse = (item.type === 'cannon' || item.type === 'explosion') ? cannonFlashSprite : lightSprite;
            for (const p of item.points) {
                maskCtx.drawImage(spriteToUse, p.x - item.radius, p.y - item.radius, size, size);
            }
        }
        maskCtx.restore();

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(maskCanvas, 0, 0);

        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = opacity * 0.2;
        const coloredSprite = this._getColoredLightSprite();
        const coloredCannonFlashSprite = this._getColoredCannonFlashSprite();
        for (const item of this.lightData) {
            const size = item.radius * 2;
            const spriteToUse = (item.type === 'cannon' || item.type === 'explosion') ? coloredCannonFlashSprite : coloredSprite;
            for (const p of item.points) {
                ctx.drawImage(spriteToUse, p.x - item.radius, p.y - item.radius, size, size);
            }
        }
        ctx.restore();
    }

    // --- Private Helper Methods ---

    _getPointObject(x, y) {
        if (this.pointPool.length > 0) {
            const p = this.pointPool.pop(); p.x = x; p.y = y; return p;
        }
        return { x, y };
    }

    _getLightSprite() {
        if (!this.cachedLightSprite) {
            const size = 128;
            const c = document.createElement('canvas');
            c.width = size; c.height = size;
            const ctx = c.getContext('2d');
            const cx = size / 2, cy = size / 2, r = size / 2;
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, 'rgba(255, 255, 255, 1)');
            g.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
            g.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, size, size);
            this.cachedLightSprite = c;
        }
        return this.cachedLightSprite;
    }

    _getColoredLightSprite() {
        if (!this.cachedColoredLightSprite) {
            const size = 128;
            const c = document.createElement('canvas');
            c.width = size; c.height = size;
            const ctx = c.getContext('2d');
            const cx = size / 2, cy = size / 2, r = size / 2;
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, 'rgba(255, 170, 0, 1)');
            g.addColorStop(0.5, 'rgba(255, 170, 0, 0.5)');
            g.addColorStop(1, 'rgba(255, 170, 0, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, size, size);
            this.cachedColoredLightSprite = c;
        }
        return this.cachedColoredLightSprite;
    }

    _getCannonFlashSprite() {
        if (!this.cachedCannonFlashSprite) {
            const size = 128;
            const c = document.createElement('canvas');
            c.width = size; c.height = size;
            const ctx = c.getContext('2d');
            const cx = size / 2, cy = size / 2;

            // Draw the jagged star shape, similar to EffectManager's explosion
            ctx.beginPath();
            const numPoints = 16;
            for (let i = 0; i < numPoints; i++) {
                const angle = (Math.PI * 2 * i) / numPoints;
                // Alternate between a large and small radius to create the star points
                const r = (i % 2 === 0) ? size * 0.5 : size * 0.2;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();

            // --- NEW: Apply a shadow to create a blurred edge ---
            ctx.shadowColor = 'white';
            ctx.shadowBlur = CANNON_UNIT_SIZE * 2;

            // Fill with a radial gradient to make it look like a light flash
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
            g.addColorStop(0, 'rgba(255, 255, 255, 1)');
            g.addColorStop(0.5, 'rgba(255, 255, 255, 0.75)');
            g.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = g;
            ctx.fill();

            this.cachedCannonFlashSprite = c;
        }
        return this.cachedCannonFlashSprite;
    }

    _getColoredCannonFlashSprite() {
        if (!this.cachedColoredCannonFlashSprite) {
            const size = 128;
            const c = document.createElement('canvas');
            c.width = size; c.height = size;
            const ctx = c.getContext('2d');
            const cx = size / 2, cy = size / 2;

            // Draw the jagged star shape
            ctx.beginPath();
            const numPoints = 16;
            for (let i = 0; i < numPoints; i++) {
                const angle = (Math.PI * 2 * i) / numPoints;
                const r = (i % 2 === 0) ? size * 0.5 : size / 2 * 0.2;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();

            // --- NEW: Apply a shadow to create a blurred edge ---
            ctx.shadowColor = 'rgba(255, 100, 0, 1)';
            ctx.shadowBlur = CANNON_UNIT_SIZE * 2;

            // Fill with a colored radial gradient
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
            g.addColorStop(0, 'rgba(255, 100, 0, 1)');
            g.addColorStop(0.5, 'rgba(255, 100, 0, 0.75)');
            g.addColorStop(1, 'rgba(255, 100, 0, 0)');
            ctx.fillStyle = g;
            ctx.fill();

            this.cachedColoredCannonFlashSprite = c;
        }
        return this.cachedColoredCannonFlashSprite;
    }

    _getDarknessMaskCanvas(w, h) {
        if (!this.sharedDarknessCanvas) {
            this.sharedDarknessCanvas = document.createElement('canvas');
        }
        if (this.sharedDarknessCanvas.width !== w || this.sharedDarknessCanvas.height !== h) {
            this.sharedDarknessCanvas.width = w;
            this.sharedDarknessCanvas.height = h;
        }
        return this.sharedDarknessCanvas;
    }

    _getLightDataObject() {
        if (this.lightDataPool.length > 0) {
            const obj = this.lightDataPool.pop();
            return obj;
        }
        return { radius: 0, points: [], type: 'ship' };
    }

    _releaseLightDataObjects() {
        while (this.lightData.length > 0) {
            const obj = this.lightData.pop();
            while (obj.points.length > 0) {
                this.pointPool.push(obj.points.pop());
            }
            obj.type = 'ship';
            this.lightDataPool.push(obj);
        }
    }
}