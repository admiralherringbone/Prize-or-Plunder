/**
 * @file Manages the lifecycle of all transient visual effects like splashes, smoke, and explosions.
 * This class centralizes effect creation, updating, drawing, and object pooling.
 */
class EffectManager {
    constructor() {
        // --- Splash Effects ---
        this.splashes = [];
        this.splashPool = []; // Kept for splashes

        // --- Damage Effects ---
        this.damageEffects = [];
        this.damageEffectPool = [];
        this.cachedExplosionSprite = null;

        // --- Cannon Effects ---
        this.cannonEffects = [];
        this.cannonFireParticlePool = [];
        this.cannonSmokeParticlePool = [];

        // --- Wavelet Effects ---
        this.wavelets = [];
        this.waveletPool = [];
        // --- OPTIMIZATION: Shared arrays for wavelet rendering to avoid GC ---
        this.WAVELET_MAX_POINTS = 256;
        this.waveletTopX = new Float32Array(this.WAVELET_MAX_POINTS);
        this.waveletTopY = new Float32Array(this.WAVELET_MAX_POINTS);
        this.waveletBottomX = new Float32Array(this.WAVELET_MAX_POINTS);
        this.waveletBottomY = new Float32Array(this.WAVELET_MAX_POINTS);

        console.log("EffectManager initialized.");
    }

    /**
     * Resets all managed effects and returns them to their pools.
     */
    reset() {
        // Return all active splashes to the pool
        this.splashPool.push(...this.splashes);
        this.splashes = [];

        // Damage Effects
        this.damageEffectPool.push(...this.damageEffects);
        this.damageEffects = [];

        // Cannon Effects
        this.cannonEffects.forEach(p => {
            if (p.type === 'fire') this.cannonFireParticlePool.push(p);
            else if (p.type === 'smoke') this.cannonSmokeParticlePool.push(p);
        });
        this.cannonEffects = [];

        // Wavelet Effects
        this.waveletPool.push(...this.wavelets);
        this.wavelets = [];

        console.log("EffectManager reset.");
    }

    /**
     * Creates a visual damage effect (explosion) at the given coordinates.
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {number} [scale=1.0] - Scale factor for the effect size.
     */
    createDamageEffect(x, y, scale = 1.0) {
        if (this.damageEffects.length > 20) {
            const old = this.damageEffects.shift();
            this.damageEffectPool.push(old);
        }
        
        let effect;
        const numPoints = 7;

        if (this.damageEffectPool.length > 0) {
            effect = this.damageEffectPool.pop();
            effect.x = x; effect.y = y;
            effect.life = 0; effect.maxLife = 300;
            effect.maxRadius = 40 * scale;
            effect.rotation = Math.random() * Math.PI * 2;
            effect.rotSpeed = (Math.random() - 0.5) * 0.2;
        } else {
            effect = {
                x: x, y: y,
                life: 0, maxLife: 300,
                maxRadius: 40 * scale,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.2,
                points: []
            };
            for (let i = 0; i < numPoints * 2; i++) effect.points.push({x:0, y:0});
        }

        for (let i = 0; i < numPoints * 2; i++) {
            const angle = (Math.PI * 2 * i) / (numPoints * 2);
            const isOuter = i % 2 === 0;
            const r = isOuter ? (0.8 + Math.random() * 0.4) : (0.3 + Math.random() * 0.2);
            effect.points[i].x = Math.cos(angle) * r;
            effect.points[i].y = Math.sin(angle) * r;
        }
        this.damageEffects.push(effect);
    }

    /**
     * Creates a visual splash effect at the given coordinates.
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     */
    createSplash(x, y) {
        if (this.splashes.length > 50) {
            const old = this.splashes.shift();
            this.splashPool.push(old);
        }
        
        let splash = this.splashPool.length > 0 ? this.splashPool.pop() : {};
        splash.x = x;
        splash.y = y;
        splash.life = 0;
        splash.maxLife = 600;
        splash.maxRadius = 15;
        this.splashes.push(splash);
    }

    /**
     * Creates the visual effect for a cannon firing.
     * @param {number} x - World X position of the muzzle.
     * @param {number} y - World Y position of the muzzle.
     * @param {number} angle - The angle of the cannon fire in radians.
     * @param {number} windDirection - The current wind direction.
     */
    createCannonEffect(x, y, angle, windDirection) {
        const fire = this.cannonFireParticlePool.length > 0 ? this.cannonFireParticlePool.pop() : {};
        fire.type = 'fire';
        fire.x = x;
        fire.y = y;
        fire.angle = angle;
        fire.life = 0;
        fire.maxLife = 100;
        fire.size = 1.0 + Math.random() * 0.2;
        this.cannonEffects.push(fire);

        const smoke = this.cannonSmokeParticlePool.length > 0 ? this.cannonSmokeParticlePool.pop() : {};
        smoke.type = 'smoke';
        smoke.x = x;
        smoke.y = y;
        smoke.life = 0;
        smoke.maxLife = 4000 + Math.random() * 2000;
        smoke.size = 0.2;
        smoke.maxSize = 1.0 + Math.random() * 0.5;
        smoke.rotation = Math.random() * Math.PI * 2;
        smoke.rotSpeed = (Math.random() - 0.5) * 0.01;
        smoke.vx = (Math.cos(angle) * (2 + Math.random())) + (Math.cos(windDirection) * (0.5 + Math.random() * 0.5));
        smoke.vy = (Math.sin(angle) * (2 + Math.random())) + (Math.sin(windDirection) * (0.5 + Math.random() * 0.5));
        this.cannonEffects.push(smoke);
    }

    createWavelet(x, y) {
        let w = this.waveletPool.length > 0 ? this.waveletPool.pop() : {};
        const r = Math.random();
        w.x = x; w.y = y; w.life = 0;
        if (r < 0.70) {
            w.type = 'texture'; w.width = 5 + Math.random() * 10; w.maxLife = 1000 + Math.random() * 1000; w.speed = 0; w.amplitude = w.width * 0.8; w.maxOpacity = 0.2 + Math.random() * 0.2;
        } else if (r < 0.95) {
            w.type = 'chop'; w.width = 30 + Math.random() * 50; w.maxLife = 2000 + Math.random() * 2000; w.speed = 10 + Math.random() * 10; w.amplitude = w.width * 0.6; w.maxOpacity = 0.3 + Math.random() * 0.3;
        } else {
            w.type = 'swell'; w.width = 150 + Math.random() * 150; w.maxLife = 5000 + Math.random() * 5000; w.speed = 5 + Math.random() * 5; w.amplitude = w.width * 0.4; w.maxOpacity = 0.1 + Math.random() * 0.1;
        }
        w.angleOffset = (Math.random() - 0.5) * 0.3;
        w.skew = (Math.random() - 0.5) * (w.width * 0.25);
        return w;
    }

    /**
     * The main update method for all managed effects.
     * @param {number} deltaTime - The time elapsed since the last frame in milliseconds.
     */
    update(deltaTime, cameraX, cameraY, canvasWidth, canvasHeight, effectiveScale, windDirection) {
        // Update splashes
        for (let i = this.splashes.length - 1; i >= 0; i--) {
            const splash = this.splashes[i];
            splash.life += deltaTime;
            if (splash.life >= splash.maxLife) {
                this.splashPool.push(splash);
                this.splashes.splice(i, 1);
            }
        }

        // Update damage effects
        for (let i = this.damageEffects.length - 1; i >= 0; i--) {
            const effect = this.damageEffects[i];
            effect.life += deltaTime;
            if (effect.life >= effect.maxLife) {
                this.damageEffectPool.push(effect);
                this.damageEffects.splice(i, 1);
            }
        }

        // Update cannon effects
        for (let i = this.cannonEffects.length - 1; i >= 0; i--) {
            const p = this.cannonEffects[i];
            p.life += deltaTime;
            if (p.type === 'smoke') {
                p.x += p.vx * (deltaTime / 16);
                p.y += p.vy * (deltaTime / 16);
                p.rotation += p.rotSpeed * (deltaTime / 16);
                if (p.size < p.maxSize) p.size += (p.maxSize - p.size) * 0.05 * (deltaTime / 16);
            }
            if (p.life >= p.maxLife) {
                if (p.type === 'fire') this.cannonFireParticlePool.push(p);
                else if (p.type === 'smoke') this.cannonSmokeParticlePool.push(p);
                this.cannonEffects.splice(i, 1);
            }
        }

        // Update wavelets
        if (this.wavelets && effectiveScale && windDirection !== undefined) { // Failsafe for initialization
            const viewWidth = canvasWidth / effectiveScale;
            const viewHeight = canvasHeight / effectiveScale;
            const targetCount = 150; // Max wavelets

            // Spawn new wavelets if needed
            if (this.wavelets.length < targetCount) {
                const clusterSize = Math.floor(Math.random() * 3) + 1;
                let cx, cy;
                const buffer = 300;

                if (Math.random() < 0.5) {
                    const upwindAngle = windDirection + Math.PI;
                    const dist = Math.max(viewWidth, viewHeight) / 2 + buffer;
                    cx = cameraX + viewWidth / 2 + Math.cos(upwindAngle) * dist;
                    cy = cameraY + viewHeight / 2 + Math.sin(upwindAngle) * dist;
                    const perpAngle = upwindAngle + Math.PI / 2;
                    const spread = (Math.random() - 0.5) * Math.max(viewWidth, viewHeight) * 1.5;
                    cx += Math.cos(perpAngle) * spread;
                    cy += Math.sin(perpAngle) * spread;
                } else {
                    cx = cameraX - buffer + Math.random() * (viewWidth + 2 * buffer);
                    cy = cameraY - buffer + Math.random() * (viewHeight + 2 * buffer);
                }
                for (let i = 0; i < clusterSize; i++) {
                    const ox = (Math.random() - 0.5) * 100;
                    const oy = (Math.random() - 0.5) * 100;
                    this.wavelets.push(this.createWavelet(cx + ox, cy + oy));
                }
            }

            for (let i = this.wavelets.length - 1; i >= 0; i--) {
                const w = this.wavelets[i];
                w.life += deltaTime;
                if (w.speed > 0) {
                    w.x += Math.cos(windDirection) * w.speed * (deltaTime / 1000);
                    w.y += Math.sin(windDirection) * w.speed * (deltaTime / 1000);
                }
                const buffer = 300;
                if (w.life >= w.maxLife || w.x < cameraX - buffer || w.x > cameraX + viewWidth + buffer || w.y < cameraY - buffer || w.y > cameraY + viewHeight + buffer) {
                    this.waveletPool.push(w);
                    this.wavelets[i] = this.wavelets[this.wavelets.length - 1];
                    this.wavelets.pop();
                }
            }
        }
    }

    /**
     * Draws the water surface effects (wavelets) which should be rendered below entities.
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} effectiveScale 
     * @param {number} windDirection 
     * @param {Array} activeIslands 
     */
    drawWaterSurface(ctx, effectiveScale, windDirection, activeIslands) {
        this._drawWavelets(ctx, effectiveScale, windDirection, activeIslands);
    }

    /**
     * The main drawing method for all managed effects.
     * @param {CanvasRenderingContext2D} ctx - The main canvas rendering context.
     * @param {number} effectiveScale - The current world-to-screen scale.
     */
    draw(ctx, effectiveScale) {
        this._drawSplashes(ctx, effectiveScale);
        this._drawDamageEffects(ctx, effectiveScale);
        this._drawCannonEffects(ctx, effectiveScale);
    }

    _getExplosionSprite() {
        if (!this.cachedExplosionSprite) {
            const size = 64;
            const c = document.createElement('canvas');
            c.width = size; c.height = size;
            const ctx = c.getContext('2d');
            const cx = size / 2, cy = size / 2;
            ctx.beginPath();
            for (let i = 0; i < 16; i++) {
                const angle = (Math.PI * 2 * i) / 16;
                const r = (i % 2 === 0) ? size * 0.5 : size * 0.2;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fillStyle = '#ff8c00';
            ctx.fill();
            this.cachedExplosionSprite = c;
        }
        return this.cachedExplosionSprite;
    }

    _drawDamageEffects(ctx, scale) {
        if (this.damageEffects.length === 0) return;
        const sprite = this._getExplosionSprite();
        this.damageEffects.forEach(effect => {
            const progress = effect.life / effect.maxLife;
            const expansion = 0.3 + 0.7 * Math.sin(progress * Math.PI / 2);
            const alpha = 1 - progress;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(effect.x, effect.y);
            ctx.rotate(effect.rotation + (effect.rotSpeed * effect.life));
            ctx.scale(expansion, expansion);
            const drawSize = effect.maxRadius * 2;
            ctx.drawImage(sprite, -drawSize/2, -drawSize/2, drawSize, drawSize);
            ctx.globalCompositeOperation = 'lighter';
            ctx.scale(0.7, 0.7);
            ctx.drawImage(sprite, -drawSize/2, -drawSize/2, drawSize, drawSize);
            ctx.restore();
        });
    }

    _drawCannonEffects(ctx, scale) {
        if (this.cannonEffects.length === 0) return;
        const fireSprite = Ship.getCannonFireSprite();
        const smokeSprite = Ship.getCannonSmokeSprite();
        ctx.save();
        
        // --- PASS 1: Draw ALL Fire Effects (Batching) ---
        for (const p of this.cannonEffects) {
            if (p.type === 'fire') {
                const progress = p.life / p.maxLife;
                const alpha = 1.0 - progress;
                const size = p.size * (1.0 - progress);
                ctx.globalAlpha = alpha;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                const height = CANNON_UNIT_SIZE;
                const length = CANNON_UNIT_SIZE * 5;
                ctx.drawImage(fireSprite, 0, -height / 2, length * size, height * size);
                ctx.rotate(-p.angle);
                ctx.translate(-p.x, -p.y);
            }
        }

        // --- PASS 2: Draw ALL Smoke Effects (Batching) ---
        for (const p of this.cannonEffects) {
            if (p.type === 'smoke') {
                const progress = p.life / p.maxLife;
                let alpha;
                if (progress < 0.1) alpha = progress / 0.1;
                else alpha = 1.0 - ((progress - 0.1) / 0.9);
                alpha *= 0.6;
                ctx.globalAlpha = alpha;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                const size = (CANNON_UNIT_SIZE / 4) * 48 * p.size;
                ctx.drawImage(smokeSprite, -size / 2, -size / 2, size, size);
                ctx.rotate(-p.rotation);
                ctx.translate(-p.x, -p.y);
            }
        }
        ctx.globalAlpha = 1.0;
        ctx.restore();
    }

    _drawWavelets(ctx, scale, windDirection, activeIslands) {
        if (!this.wavelets || this.wavelets.length === 0) return;
        ctx.save();
        ctx.lineCap = 'round';
        const time = performance.now() / 1000;
        for (const w of this.wavelets) {
            const progress = w.life / w.maxLife;
            let alpha = w.maxOpacity;
            let sizeScale = 1.0;
            if (progress < 0.2) {
                alpha *= (progress / 0.2);
                sizeScale = 0.5 + (0.5 * (progress / 0.2));
            } else if (progress > 0.8) {
                alpha *= ((1 - progress) / 0.2);
                sizeScale = 1.0 - (0.2 * ((progress - 0.8) / 0.2));
            }
            const swellProgress = Math.sin(progress * Math.PI);
            const currentAmplitude = w.amplitude * (0.3 + 0.7 * swellProgress);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';

            // --- NEW: Shore Break Effect (Adapted from old game.js) ---
            let finalAngle;
            const windAngle = (windDirection - Math.PI / 2) + w.angleOffset;
            let closestIsland = null;
            let closestDist = Infinity;
            let closestShorePoint = null;
            const maxInfluenceDistance = 500;

            if (activeIslands) {
                for (const obs of activeIslands) {
                    if (obs.type === 'island') {
                        const hull = obs.convexHull || obs.points;
                        if (hull) {
                            const shorePt = getClosestPointOnPolygon({x: w.x, y: w.y}, hull);
                            const dist = Math.sqrt((w.x - shorePt.x)**2 + (w.y - shorePt.y)**2);
                            if (dist < closestDist) {
                                closestDist = dist;
                                closestIsland = obs;
                                closestShorePoint = shorePt;
                            }
                        }
                    }
                }
            }
            if (closestIsland && closestDist < maxInfluenceDistance) {
                const proximityFactor = 1.0 - (closestDist / maxInfluenceDistance);
                const angleToShore = Math.atan2(closestShorePoint.y - w.y, closestShorePoint.x - w.x);
                const shoreAngle = angleToShore - Math.PI / 2;
                finalAngle = lerpAngle(windAngle, shoreAngle, proximityFactor);
            } else {
                finalAngle = windAngle;
            }

            ctx.save();
            ctx.translate(w.x, w.y);
            ctx.rotate(finalAngle);
            ctx.scale(sizeScale, 1.0);
            ctx.beginPath();
            const rawNumPoints = Math.max(6, Math.ceil(w.width / 4));
            const numPoints = Math.min(rawNumPoints, this.WAVELET_MAX_POINTS - 1);
            const p0x = -w.width / 2, p0y = 0;
            const p1x = w.skew, p1y = -currentAmplitude;
            const p2x = w.width / 2, p2y = 0;
            const noiseAmp = Math.min(4, w.width * 0.10, currentAmplitude * 0.5);
            const centerThickness = (w.type === 'swell' ? 24.0 : 12.0);
            for (let i = 0; i <= numPoints; i++) {
                const t = i / numPoints;
                const invT = 1 - t;
                const bx = (invT * invT * p0x) + (2 * invT * t * p1x) + (t * t * p2x);
                const by = (invT * invT * p0y) + (2 * invT * t * p1y) + (t * t * p2y);
                const y1 = Math.sin(bx * 0.025 + time * 2.0) * (noiseAmp * 1.5);
                const y2 = Math.sin(bx * 0.075 + time * 5.0) * (noiseAmp * 1.2);
                const y3 = Math.sin(bx * 0.20 + time * 12.0) * (noiseAmp * 1.0);
                const wy = y1 + y2 + y3;
                const thickness = centerThickness * (4 * t * (1 - t));
                this.waveletTopX[i] = bx; this.waveletTopY[i] = by + wy - thickness / 2;
                this.waveletBottomX[i] = bx; this.waveletBottomY[i] = by + wy + thickness / 2;
            }
            ctx.moveTo(this.waveletTopX[0], this.waveletTopY[0]);
            for (let i = 1; i <= numPoints; i++) ctx.lineTo(this.waveletTopX[i], this.waveletTopY[i]);
            for (let i = numPoints; i >= 0; i--) ctx.lineTo(this.waveletBottomX[i], this.waveletBottomY[i]);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    _drawSplashes(ctx, scale) {
        if (this.splashes.length === 0) return;

        ctx.save();
        this.splashes.forEach(splash => {
            const progress = splash.life / splash.maxLife;
            const radius = splash.maxRadius * Math.sin(progress * Math.PI / 2);
            const alpha = 1 - progress;

            ctx.beginPath();
            ctx.arc(splash.x, splash.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(230, 245, 255, ${alpha * 0.6})`;
            ctx.fill();
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
            ctx.lineWidth = 1.5 / scale;
            ctx.stroke();
        });
        ctx.restore();
    }
}