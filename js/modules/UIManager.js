/**
 * @file Manages the rendering of all Heads-Up Display (HUD) and UI elements.
 * This class encapsulates all UI drawing logic, keeping the main game loop clean.
 */
class UIManager {
    constructor() {
        // Store bounds of UI elements for click detection
        this.debugRankButtonBounds = null;
        this.spyglassJoystickBounds = null; // --- NEW ---
        this.spyglassCloseButtonBounds = null; // --- NEW ---
        this.spyglassOverlayCache = null;
        this.lastCanvasWidth = 0;
        this.lastCanvasHeight = 0;
    }

    /**
     * The main drawing method for all UI components.
     * @param {CanvasRenderingContext2D} ctx - The main canvas rendering context.
     * @param {object} gameState - An object containing all necessary state for drawing the UI.
     */
    draw(ctx, gameState) {
        const {
            canvas, player, gameOverState, windDirection, worldManager,
            activeNpcs, minimapCacheCanvas, boardingManager, environmentManager, hudMode,
            screenMouseX, screenMouseY, hudButtonClickTimes, 
            isSpyglassActive, spyglassInputVector, spyglassOffsetX, spyglassOffsetY, // --- NEW ---
            fleetManager, mapAnimationProgress, spyglassProgress // --- NEW ---
        } = gameState;

        // Only draw HUD elements if the player exists AND Game Over is not active
        if (player && !gameOverState.active) {
            ctx.save();

            this._drawWindDial(ctx, canvas, windDirection);

            const allNpcMapData = worldManager ? worldManager.getAllNpcMapData() : [];
            const allStaticObjects = worldManager ? worldManager.getAllStaticObjects() : [];

            this._drawMiniMap(ctx, { 
                canvas, 
                player, 
                allNpcs: allNpcMapData, 
                activeNpcs: activeNpcs, 
                windDirection, 
                minimapCache: minimapCacheCanvas, 
                worldManager 
            });

            this._drawHud(ctx, canvas, player, windDirection, activeNpcs, boardingManager, hudMode, screenMouseX, screenMouseY);
            
            this._drawHudControls(ctx, canvas, player, hudMode, hudButtonClickTimes, screenMouseX, screenMouseY);

            if (environmentManager) {
                this._drawDayNightDial(ctx, canvas, environmentManager.dayNightTimer);
                if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
                    this._drawDayNightDebugButton(ctx, canvas);
                }
            }
            
            if (window.fleetUI && fleetManager) {
                window.fleetUI.drawFleetStatus(ctx, fleetManager);
            }

            if (mapAnimationProgress > 0) {
                this._drawExpandedMap(ctx, { 
                    canvas, 
                    player, 
                    allStaticObstacles: allStaticObjects, 
                    npcs: allNpcMapData, 
                    windDirection, 
                    worldManager, 
                    minimapCache: minimapCacheCanvas 
                }, mapAnimationProgress);
            }

            // --- NEW: Draw Spyglass Overlay ---
            // This is drawn after all world content but before other UI elements.
            if (spyglassProgress > 0) {
                if (spyglassProgress >= 1) {
                    // Stable state: Use cached overlay for performance
                    if (!this.spyglassOverlayCache || canvas.width !== this.lastCanvasWidth || canvas.height !== this.lastCanvasHeight) {
                        this._createSpyglassOverlayCache(canvas);
                        this.lastCanvasWidth = canvas.width;
                        this.lastCanvasHeight = canvas.height;
                    }
                    ctx.drawImage(this.spyglassOverlayCache, 0, 0);
                } else {
                    // Transition state: Draw dynamic overlay for Iris Wipe effect
                    this._drawDynamicSpyglassOverlay(ctx, canvas.width, canvas.height, spyglassProgress);
                }

                // Fade in controls with the view
                ctx.save();
                ctx.globalAlpha = spyglassProgress;
                
                // Only enable interaction if fully open, but draw them fading in
                this._drawSpyglassJoystick(ctx, canvas, spyglassInputVector);
                this._drawSpyglassRangeIndicator(ctx, player, spyglassOffsetX, spyglassOffsetY, worldManager);
                this._drawSpyglassCloseButton(ctx, canvas);
                
                ctx.restore();
            }

            ctx.restore();
        }
    }

    /**
     * --- NEW: Draws the spyglass overlay dynamically for the Iris Wipe animation. ---
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} w - Canvas width
     * @param {number} h - Canvas height
     * @param {number} progress - Animation progress (0.0 to 1.0)
     * @private
     */
    _drawDynamicSpyglassOverlay(ctx, w, h, progress) {
        const centerX = w / 2;
        const centerY = h / 2;
        const maxRadius = Math.min(w, h) * 0.175;
        const currentRadius = maxRadius * progress; // Animate radius

        // 1. Black Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.fillRect(0, 0, w, h);

        // 2. Cut the Hole
        ctx.globalCompositeOperation = 'destination-out';
        
        if (currentRadius > 0) {
            const feather = 40 * progress;
            const holeGradient = ctx.createRadialGradient(centerX, centerY, Math.max(0, currentRadius - feather/2), centerX, centerY, currentRadius + feather/2);
            holeGradient.addColorStop(0, 'rgba(0, 0, 0, 1)'); 
            holeGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = holeGradient;
            ctx.beginPath();
            ctx.arc(centerX, centerY, currentRadius + feather, 0, Math.PI * 2);
            ctx.fill();
        }

        // 3. Cut Bottom View (Fade in)
        // We scale the alpha of the cut by progress to reveal the bottom view
        ctx.globalAlpha = progress;
        const splitLineY = h * 0.75;
        const fadeHeight = h * 0.15;
        const bottomGradient = ctx.createLinearGradient(0, splitLineY, 0, splitLineY + fadeHeight);
        bottomGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        bottomGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
        
        ctx.fillStyle = bottomGradient;
        ctx.fillRect(0, splitLineY, w, fadeHeight);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.fillRect(0, splitLineY + fadeHeight, w, h - (splitLineY + fadeHeight));

        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';

        // 4. Draw Brass Ring (Scaled)
        if (currentRadius > 0) {
            const ringWidth = 15;
            // Simplified ring color for animation performance (Average of antique brass gradient)
            ctx.strokeStyle = '#887559'; 
            ctx.lineWidth = ringWidth;
            ctx.beginPath();
            ctx.arc(centerX, centerY, currentRadius + ringWidth / 2, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    /**
     * --- NEW: Creates a cached canvas for the spyglass overlay for performance. ---
     * @param {HTMLCanvasElement} canvas - The main game canvas to get dimensions from.
     * @private
     */
    _createSpyglassOverlayCache(canvas) {
        if (this.spyglassOverlayCache) window.CanvasManager.releaseCanvas(this.spyglassOverlayCache);
        this.spyglassOverlayCache = window.CanvasManager.getCanvas(canvas.width, canvas.height);
        const cacheCtx = this.spyglassOverlayCache.getContext('2d');

        const w = canvas.width;
        const h = canvas.height;
        const centerX = w / 2;
        const centerY = h / 2;
        const radius = Math.min(w, h) * 0.175;

        cacheCtx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        cacheCtx.fillRect(0, 0, w, h);

        cacheCtx.globalCompositeOperation = 'destination-out';
        
        // --- 1. Soft Hole (Blur Effect) ---
        // Use a gradient to cut the hole, creating a vignette effect.
        const feather = 40;
        const holeGradient = cacheCtx.createRadialGradient(centerX, centerY, radius - feather/2, centerX, centerY, radius + feather/2);
        holeGradient.addColorStop(0, 'rgba(0, 0, 0, 1)'); // Fully Transparent center
        holeGradient.addColorStop(1, 'rgba(0, 0, 0, 0)'); // Fade to Opaque background
        
        cacheCtx.fillStyle = holeGradient;
        cacheCtx.beginPath();
        cacheCtx.arc(centerX, centerY, radius + feather, 0, Math.PI * 2);
        cacheCtx.fill();

        // --- 2. Bottom Gradient (Fade to Player View) ---
        // The split line is at 0.75h. We want the overlay to be solid down to this line,
        // then fade out below it to reveal the player view.
        const splitLineY = h * 0.75;
        const fadeHeight = h * 0.15; // Fade over 15% of screen height
        
        const bottomGradient = cacheCtx.createLinearGradient(0, splitLineY, 0, splitLineY + fadeHeight);
        bottomGradient.addColorStop(0, 'rgba(0, 0, 0, 0)'); // Keep overlay (Alpha 0 in destination-out = No erase)
        bottomGradient.addColorStop(1, 'rgba(0, 0, 0, 1)'); // Remove overlay (Alpha 1 in destination-out = Full erase)
        
        cacheCtx.fillStyle = bottomGradient;
        cacheCtx.fillRect(0, splitLineY, w, fadeHeight);
        
        // Clear the bottom area completely
        cacheCtx.fillStyle = 'rgba(0, 0, 0, 1)';
        cacheCtx.fillRect(0, splitLineY + fadeHeight, w, h - (splitLineY + fadeHeight));

        cacheCtx.globalCompositeOperation = 'source-over';

        // --- 3. Brass Ring ---
        const ringWidth = 15;
        const brassGradient = cacheCtx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
        // Antique/Tarnished Brass Palette
        brassGradient.addColorStop(0, '#2a1f15');    // Very dark patina
        brassGradient.addColorStop(0.2, '#6b5437');  // Dull brass
        brassGradient.addColorStop(0.45, '#a6967b'); // Matte highlight
        brassGradient.addColorStop(0.5, '#c4b69c');  // Peak highlight
        brassGradient.addColorStop(0.55, '#a6967b'); // Matte highlight
        brassGradient.addColorStop(0.8, '#473625');  // Shadow
        brassGradient.addColorStop(1, '#2a1f15');    // Very dark patina

        cacheCtx.strokeStyle = brassGradient;
        cacheCtx.lineWidth = ringWidth;
        cacheCtx.beginPath();
        // Shift center outwards by half the width so the inner edge sits at 'radius'
        cacheCtx.arc(centerX, centerY, radius + ringWidth / 2, 0, Math.PI * 2);
        cacheCtx.stroke();
        
        // Inner/Outer Ring Definition
        cacheCtx.strokeStyle = 'rgba(0,0,0,0.5)';
        cacheCtx.lineWidth = 2;
        cacheCtx.beginPath(); cacheCtx.arc(centerX, centerY, radius, 0, Math.PI * 2); cacheCtx.stroke();
        cacheCtx.beginPath(); cacheCtx.arc(centerX, centerY, radius + ringWidth, 0, Math.PI * 2); cacheCtx.stroke();
    }

    /**
     * --- NEW: Draws the joystick control for the spyglass. ---
     * @param {CanvasRenderingContext2D} ctx 
     * @param {HTMLCanvasElement} canvas 
     * @param {object} inputVector - {x, y} normalized input vector (-1 to 1)
     */
    _drawSpyglassJoystick(ctx, canvas, inputVector) {
        const w = canvas.width;
        const h = canvas.height;
        
        // Calculate sizes based on the spyglass hole size logic
        const spyglassRadius = Math.min(w, h) * 0.175;
        const joystickRadius = spyglassRadius * 0.5; // 1/2 size of hole radius
        
        // Position equidistant between the spyglass hole edge and the screen edge
        const holeRightEdge = (w / 2) + spyglassRadius;
        const screenRightEdge = w;
        const centerX = (holeRightEdge + screenRightEdge) / 2;
        // Vertically center it with the spyglass hole
        const centerY = h / 2;

        // Store bounds for hit testing in game.js
        this.spyglassJoystickBounds = { x: centerX, y: centerY, radius: joystickRadius };

        // 1. Draw Outer Ring (Border)
        ctx.beginPath();
        ctx.arc(centerX, centerY, joystickRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // Semi-transparent white border
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Dark background
        ctx.fill();

        // 2. Draw Inner Stick (Dot)
        const stickRadius = joystickRadius * 0.4;
        // Calculate stick position based on input vector
        const stickX = centerX + (inputVector.x * (joystickRadius - stickRadius));
        const stickY = centerY + (inputVector.y * (joystickRadius - stickRadius));

        ctx.beginPath();
        ctx.arc(stickX, stickY, stickRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'white'; // Solid white handle
        ctx.fill();
        // Optional: Add a visual indicator for "neutral" center
        if (inputVector.x === 0 && inputVector.y === 0) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fill();
        }
    }

    /**
     * --- NEW: Draws an "X" button to close the spyglass. ---
     * @param {CanvasRenderingContext2D} ctx 
     * @param {HTMLCanvasElement} canvas 
     * @private
     */
    _drawSpyglassCloseButton(ctx, canvas) {
        const margin = 30;
        const radius = 20;
        const x = canvas.width - margin - radius;
        const y = margin + radius;

        this.spyglassCloseButtonBounds = { x, y, radius };

        this._drawHudButtonBackground(ctx, x, y, radius);

        ctx.save();
        ctx.translate(x, y);
        const size = radius * 0.4;
        ctx.beginPath();
        ctx.moveTo(-size, -size); ctx.lineTo(size, size);
        ctx.moveTo(size, -size); ctx.lineTo(-size, size);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
    }

    /**
     * --- NEW: Draws the distance visualization radar for the spyglass. ---
     * @param {CanvasRenderingContext2D} ctx 
     * @param {object} player 
     * @param {number} offsetX 
     * @param {number} offsetY 
     * @param {WorldManager} worldManager 
     */
    _drawSpyglassRangeIndicator(ctx, player, offsetX, offsetY, worldManager) {
        // Upper left corner placement
        const centerX = 60;
        const centerY = 60;
        const radius = 40;

        // 1. Background
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 2. Player Dot (Center)
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
        ctx.fillStyle = player.pennantColor || '#ffffff';
        ctx.fill();

        // 3. Spyglass Position Dot
        // Calculate max range based on world manager active area
        // Default fallback if worldManager is missing is 2000 units
        const maxDist = worldManager ? (worldManager.sectorSize * worldManager.activationRadius) : 2000;
        
        const dist = Math.sqrt(offsetX*offsetX + offsetY*offsetY);
        // Clamp visualization to the circle's edge
        const scale = Math.min(1, dist / maxDist);
        const angle = Math.atan2(offsetY, offsetX);
        const visualDist = scale * radius;
        
        const dotX = centerX + Math.cos(angle) * visualDist;
        const dotY = centerY + Math.sin(angle) * visualDist;

        // Draw Target Dot
        ctx.beginPath();
        ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.stroke(); // Use previous strokeStyle (white border)
    }

    // --- Private Methods (Moved from ui.js) ---

    /**
     * Draws the wind dial UI element.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {HTMLCanvasElement} canvas - The main game canvas.
     * @param {number} windDirection - The current direction of the wind in radians.
     */
    _drawWindDial(ctx, canvas, windDirection) {
        const dialSize = 60;
        const margin = 20;
        const dialX = canvas.width - dialSize - margin;
        const dialY = canvas.height - dialSize - margin;
        const dialRadius = dialSize / 2;
        const dialCenterX = dialX + dialRadius;
        const dialCenterY = dialY + dialRadius;

        ctx.save();
        ctx.translate(dialCenterX, dialCenterY);

        ctx.beginPath();
        ctx.arc(0, 0, dialRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(52, 73, 94, 0.8)';
        ctx.fill();
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = '#ecf0f1';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', 0, -dialRadius + 8);
        ctx.fillText('E', dialRadius - 8, 0);
        ctx.fillText('S', 0, dialRadius - 8);
        ctx.fillText('W', -dialRadius + 8, 0);

        ctx.rotate(windDirection + Math.PI);
        ctx.beginPath();
        const arrowTipX = dialRadius * 0.8;
        const arrowBaseWidth = dialRadius * 0.3;
        const arrowBaseOffset = dialRadius * 0.2;
        ctx.moveTo(arrowTipX, 0);
        ctx.lineTo(arrowBaseOffset, arrowBaseWidth / 2);
        ctx.lineTo(arrowBaseOffset, -arrowBaseWidth / 2);
        ctx.closePath();
        ctx.fillStyle = '#ecf0f1';
        ctx.fill();
        ctx.strokeStyle = '#bdc3c7';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, dialRadius * 0.08, 0, Math.PI * 2);
        ctx.fillStyle = '#bdc3c7';
        ctx.fill();

        ctx.restore();

        ctx.save();
        ctx.fillStyle = '#ecf0f1';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('WIND', dialCenterX, dialY - 5);
        ctx.restore();

    }

    /**
     * Draws the minimap UI element.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {object} gameState - An object containing the current game state arrays (islands, rocks, etc.).
     */
    _drawMiniMap(ctx, { canvas, player, allNpcs, activeNpcs, windDirection, minimapCache, worldManager }) {
        const miniMapSize = 112.5;
        const margin = 20;
        const miniMapX = margin;
        const miniMapY = canvas.height - miniMapSize - margin;

        ctx.save();

        // --- NEW: Clip to Mini-map Box ---
        ctx.beginPath();
        ctx.rect(miniMapX, miniMapY, miniMapSize, miniMapSize);
        ctx.clip();

        ctx.translate(miniMapX, miniMapY);

        // --- NEW: Local View Logic ---
        // Define how much of the world is visible in the mini-map.
        // 5000 units is 1/10th of the world, providing a good "local" zoom.
        const MINIMAP_VIEW_EXTENT = 5000;
        const scale = miniMapSize / MINIMAP_VIEW_EXTENT;

        // Draw Background (Parchment color) to fill gaps at world edges
        ctx.fillStyle = 'rgba(233, 182, 65, 0.75)'; // Increased opacity since cache is now transparent
        ctx.fillRect(0, 0, miniMapSize, miniMapSize);

        // --- NEW: Draw the pre-rendered static map (Cropped) ---
        if (minimapCache) {
            // Calculate the source rectangle from the cache
            const cacheScale = minimapCache.width / WORLD_WIDTH; // 2000 / 50000 = 0.04
            const sx = (player.x - MINIMAP_VIEW_EXTENT / 2) * cacheScale;
            const sy = (player.y - MINIMAP_VIEW_EXTENT / 2) * cacheScale;
            const sSize = MINIMAP_VIEW_EXTENT * cacheScale;

            ctx.drawImage(minimapCache, sx, sy, sSize, sSize, 0, 0, miniMapSize, miniMapSize);
        }

        // --- NEW: Draw 1000-unit Grid ---
        ctx.save();
        ctx.lineWidth = 1;

        const GRID_SPACING = 1000;
        const worldLeft = player.x - MINIMAP_VIEW_EXTENT / 2;
        const worldTop = player.y - MINIMAP_VIEW_EXTENT / 2;
        const worldRight = player.x + MINIMAP_VIEW_EXTENT / 2;
        const worldBottom = player.y + MINIMAP_VIEW_EXTENT / 2;

        // Vertical Lines
        const startGridX = Math.floor(worldLeft / GRID_SPACING) * GRID_SPACING;
        for (let wx = startGridX; wx <= worldRight; wx += GRID_SPACING) {
            const sx = (wx - player.x) * scale + miniMapSize / 2;
            ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, miniMapSize);
            ctx.strokeStyle = (wx % 10000 === 0) ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.15)';
            ctx.stroke();
        }

        // Horizontal Lines
        const startGridY = Math.floor(worldTop / GRID_SPACING) * GRID_SPACING;
        for (let wy = startGridY; wy <= worldBottom; wy += GRID_SPACING) {
            const sy = (wy - player.y) * scale + miniMapSize / 2;
            ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(miniMapSize, sy);
            ctx.strokeStyle = (wy % 10000 === 0) ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.15)';
            ctx.stroke();
        }
        ctx.restore();

        // --- NEW: Draw Active Sector Boundary ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && player && worldManager) {
            const sectorSize = worldManager.sectorSize;
            const radius = worldManager.activationRadius;

            const sectorX = Math.floor(player.x / sectorSize);
            const sectorY = Math.floor(player.y / sectorSize);

            // Calculate the bounding box relative to the player (center of minimap)
            const worldRectX = (sectorX - radius) * sectorSize;
            const worldRectY = (sectorY - radius) * sectorSize;

            const rectX = (worldRectX - player.x) * scale + miniMapSize / 2;
            const rectY = (worldRectY - player.y) * scale + miniMapSize / 2;
            const rectW = (radius * 2 + 1) * sectorSize * scale;
            const rectH = (radius * 2 + 1) * sectorSize * scale;

            ctx.save();
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 2]);
            ctx.strokeRect(rectX, rectY, rectW, rectH);
            ctx.restore();
        }

        // Draw NPCs, colored by their pennant for easy identification.
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && allNpcs) {
            allNpcs.forEach(npc => {
                // Calculate position relative to player
                const relX = npc.x - player.x;
                const relY = npc.y - player.y;

                const npcMiniMapX = (relX * scale) + miniMapSize / 2;
                const npcMiniMapY = (relY * scale) + miniMapSize / 2;

                // Skip if out of bounds (optional optimization)
                if (npcMiniMapX < 0 || npcMiniMapX > miniMapSize || npcMiniMapY < 0 || npcMiniMapY > miniMapSize) return;

                ctx.beginPath();
                if (npc.isPirateHunter) {
                    // Draw Pirate Hunters larger and distinct
                    ctx.fillStyle = '#FF0000'; // Red
                    ctx.arc(npcMiniMapX, npcMiniMapY, 3.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = '#000000';
                    ctx.stroke();
                } else {
                    // Standard NPC
                    ctx.fillStyle = npc.pennantColor;
                    ctx.arc(npcMiniMapX, npcMiniMapY, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        }

        // Draw NPC destination lines for debugging
        if (DEBUG.ENABLED && DEBUG.DRAW_NPC_DESTINATIONS && allNpcs) {
            ctx.save();
            ctx.lineWidth = 0.5; // Thin line
            ctx.setLineDash([2, 3]); // Dashed line pattern (2px line, 3px gap)

            const standardPath = new Path2D();
            const hunterPath = new Path2D();
            let hasStandard = false;
            let hasHunter = false;

            allNpcs.forEach(npc => {
                if (npc.pathWaypoints.length > 0) {
                    const targetPath = npc.isPirateHunter ? hunterPath : standardPath;
                    if (npc.isPirateHunter) hasHunter = true;
                    else hasStandard = true;

                    // Start the line from the NPC's current position
                    const startX = (npc.x - player.x) * scale + miniMapSize / 2;
                    const startY = (npc.y - player.y) * scale + miniMapSize / 2;
                    targetPath.moveTo(startX, startY);

                    // Draw a line to each waypoint in the calculated path, starting from the current one
                    for (let i = npc.currentWaypointIndex; i < npc.pathWaypoints.length; i++) {
                        const waypoint = npc.pathWaypoints[i];
                        const wpX = (waypoint.x - player.x) * scale + miniMapSize / 2;
                        const wpY = (waypoint.y - player.y) * scale + miniMapSize / 2;
                        targetPath.lineTo(wpX, wpY);
                    }
                }
            });

            if (hasStandard) {
                ctx.strokeStyle = '#FFFFFF';
                ctx.stroke(standardPath);
            }
            if (hasHunter) {
                ctx.strokeStyle = '#FF0000';
                ctx.stroke(hunterPath);
            }

            ctx.restore(); // Restore line dash and style to default
        }

        if (player) {
            ctx.fillStyle = player.pennantColor;
            // Player is always at the center of the local map
            const playerMiniMapX = miniMapSize / 2;
            const playerMiniMapY = miniMapSize / 2;
            ctx.beginPath();
            ctx.arc(playerMiniMapX, playerMiniMapY, 3, 0, Math.PI * 2);
            ctx.fill();

            // Draw Border around the map
            ctx.strokeStyle = '#B98816';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, miniMapSize, miniMapSize);
        }

        ctx.restore();
    }

    /**
     * Draws the large, centered version of the map when expanded.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {object} gameState - An object containing the current game state arrays.
     * @param {number} progress - The unroll animation progress (0.0 to 1.0).
     */
    _drawExpandedMap(ctx, { canvas, player, allStaticObstacles, npcs, windDirection, worldManager, minimapCache }, progress = 1.0) {
        const mapSize = canvas.height * 0.75;
        const mapX = (canvas.width - mapSize) / 2;
        const mapY = (canvas.height - mapSize) / 2;
        const mapScaleX = mapSize / WORLD_WIDTH;
        const mapScaleY = mapSize / WORLD_HEIGHT;

        // Calculate visible width based on unroll progress (Center-Out)
        const currentWidth = mapSize * progress;
        const centerX = mapX + mapSize / 2;
        const visibleLeft = centerX - currentWidth / 2;
        const visibleRight = centerX + currentWidth / 2;

        ctx.save();

        // --- NEW: Clip to unrolled area (Center-Out) ---
        ctx.beginPath();
        ctx.rect(visibleLeft, mapY, currentWidth, mapSize);
        ctx.clip();

        ctx.translate(mapX, mapY); // Translate AFTER defining clip rect in screen space

        // Use a more opaque background for the expanded map to improve focus
        ctx.fillStyle = 'rgba(233, 182, 65, 0.85)';
        ctx.fillRect(0, 0, mapSize, mapSize);

        ctx.strokeStyle = '#B98816';
        ctx.lineWidth = 4; // Thicker border for emphasis
        ctx.strokeRect(0, 0, mapSize, mapSize);

        // --- Draw Pathfinder No-Go Zones on Expanded Map ---
        // This is drawn first so that the semi-transparent stroke appears *behind* the
        // actual terrain, creating a clean outline effect.
        if (DEBUG.ENABLED && DEBUG.DRAW_ANCHOR_ZONES) { // Repurposing this flag
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)'; // A slightly more opaque stroke for visibility
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            const allObstacles = allStaticObstacles || [];
            allObstacles.forEach(obstacle => {
                // --- NEW: Use precise anchor contour if available ---
                if (obstacle.anchorZonePolygon && obstacle.anchorZonePolygon.length > 0) {
                    ctx.lineWidth = 2; // Fixed thin line for precise contour
                    ctx.beginPath();
                    obstacle.anchorZonePolygon.forEach((point, index) => {
                        const scaledX = point.x * mapScaleX;
                        const scaledY = point.y * mapScaleY;
                        if (index === 0) ctx.moveTo(scaledX, scaledY);
                        else ctx.lineTo(scaledX, scaledY);
                    });
                    ctx.closePath();
                    ctx.stroke();
                } else {
                    // Fallback to approximate radial expansion
                    const geometrySource = (obstacle.type === 'coralReef' && obstacle.rockBase) ? obstacle.rockBase : obstacle;
                    const polygonPoints = geometrySource.outerPerimeterPoints;
                    if (!polygonPoints) return;
    
                    const buffer = obstacle.maxDistanceToPerimeter * 0.5;
                    ctx.lineWidth = buffer * 2 * mapScaleX;
    
                    ctx.beginPath();
                    polygonPoints.forEach((point, index) => {
                        const scaledX = point.x * mapScaleX;
                        const scaledY = point.y * mapScaleY;
                        if (index === 0) ctx.moveTo(scaledX, scaledY);
                        else ctx.lineTo(scaledX, scaledY);
                    });
                    ctx.closePath();
                    ctx.stroke();
                }
            });
            ctx.restore();
        }

        // --- Draw all the map content (obstacles) ---
        // --- OPTIMIZATION: Use pre-rendered cache instead of drawing thousands of polygons per frame ---
        if (minimapCache) {
            ctx.drawImage(minimapCache, 0, 0, mapSize, mapSize);
        } else {
            // Fallback if cache is missing (safety)
            (allStaticObstacles || []).forEach(obstacle => {
                ctx.fillStyle = '#e4c490'; // Map Land Color
                ctx.strokeStyle = '#3d352a'; // Map Ink Color
                ctx.lineWidth = 2;
                ctx.beginPath();
                const points = obstacle.outerPerimeterPoints || obstacle.rockBase?.outerPerimeterPoints;
                if (!points) return;
                points.forEach((point, index) => {
                    const scaledX = point.x * mapScaleX;
                    const scaledY = point.y * mapScaleY;
                    if (index === 0) ctx.moveTo(scaledX, scaledY);
                    else ctx.lineTo(scaledX, scaledY);
                });
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            });
        }

        // --- NEW: Draw 1000-unit Grid ---
        // Drawn after terrain cache to ensure lines appear on top.
        ctx.save();
        ctx.lineWidth = 1;
        const GRID_SPACING = 1000;

        // Vertical Lines
        for (let wx = 0; wx <= WORLD_WIDTH; wx += GRID_SPACING) {
            const sx = wx * mapScaleX;
            ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, mapSize);
            ctx.strokeStyle = (wx % 10000 === 0) ? 'rgba(61, 53, 42, 0.4)' : 'rgba(61, 53, 42, 0.15)';
            ctx.stroke();
        }

        // Horizontal Lines
        for (let wy = 0; wy <= WORLD_HEIGHT; wy += GRID_SPACING) {
            const sy = wy * mapScaleY;
            ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(mapSize, sy);
            ctx.strokeStyle = (wy % 10000 === 0) ? 'rgba(61, 53, 42, 0.4)' : 'rgba(61, 53, 42, 0.15)';
            ctx.stroke();
        }
        ctx.restore();

        // --- NEW: Draw Active Sector Boundary ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && player && worldManager) {
            const sectorSize = worldManager.sectorSize;
            const radius = worldManager.activationRadius;

            const sectorX = Math.floor(player.x / sectorSize);
            const sectorY = Math.floor(player.y / sectorSize);

            // Calculate the bounding box of the active sectors
            const rectX = (sectorX - radius) * sectorSize * mapScaleX;
            const rectY = (sectorY - radius) * sectorSize * mapScaleY;
            const rectW = (radius * 2 + 1) * sectorSize * mapScaleX;
            const rectH = (radius * 2 + 1) * sectorSize * mapScaleY;

            ctx.save();
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(rectX, rectY, rectW, rectH);
            ctx.restore();
        }

        // --- NEW: Debug Labels for Complex Islands ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && allStaticObstacles) {
            ctx.save();
            ctx.fillStyle = 'white';
            ctx.font = `bold ${24 * mapScaleX}px Arial`; // Scale font slightly, but keep it readable
            // Clamp font size
            if (24 * mapScaleX < 12) ctx.font = '12px Arial';
            
            ctx.textAlign = 'center';
            allStaticObstacles.forEach(obs => {
                if (obs.isComplex) {
                    ctx.fillText("Complex", obs.x * mapScaleX, obs.y * mapScaleY);
                }
                if (obs.type === 'coralReef') {
                    ctx.fillText("Reef", obs.x * mapScaleX, obs.y * mapScaleY);
                }
            });
            ctx.restore();
        }

        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && npcs) {
            npcs.forEach(npc => {
                ctx.fillStyle = npc.pennantColor;
                const npcMapX = npc.x * mapScaleX;
                const npcMapY = npc.y * mapScaleY;
                ctx.beginPath();
                ctx.arc(npcMapX, npcMapY, 4, 0, Math.PI * 2); // Larger icon
                ctx.fill();
            });
        }

        // Draw NPC destination lines for debugging
        if (DEBUG.ENABLED && DEBUG.DRAW_NPC_DESTINATIONS && npcs) {
            ctx.save();
            ctx.lineWidth = 1; // Slightly thicker for the larger map
            ctx.setLineDash([5, 5]); // Larger dashes for clarity

            const standardPath = new Path2D();
            const hunterPath = new Path2D();
            let hasStandard = false;
            let hasHunter = false;

            npcs.forEach(npc => {
                if (npc.pathWaypoints.length > 0) {
                    const targetPath = npc.isPirateHunter ? hunterPath : standardPath;
                    if (npc.isPirateHunter) hasHunter = true;
                    else hasStandard = true;

                    // Start the line from the NPC's current position
                    targetPath.moveTo(npc.x * mapScaleX, npc.y * mapScaleY);

                    // Draw a line to each waypoint in the calculated path, starting from the current one
                    for (let i = npc.currentWaypointIndex; i < npc.pathWaypoints.length; i++) {
                        const waypoint = npc.pathWaypoints[i];
                        targetPath.lineTo(waypoint.x * mapScaleX, waypoint.y * mapScaleY);
                    }
                }
            });

            if (hasStandard) {
                ctx.strokeStyle = '#FFFFFF';
                ctx.stroke(standardPath);
            }
            if (hasHunter) {
                ctx.strokeStyle = '#FF0000';
                ctx.stroke(hunterPath);
            }

            ctx.restore(); // Restore line dash and style to default
        }

        if (player) {
            const playerMapX = player.x * mapScaleX;
            const playerMapY = player.y * mapScaleY;
            ctx.fillStyle = player.pennantColor;
            ctx.beginPath();
            ctx.arc(playerMapX, playerMapY, 5, 0, Math.PI * 2); // Larger icon
            ctx.fill();

            // Draw player direction indicator
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(playerMapX, playerMapY);
            ctx.lineTo(playerMapX + Math.cos(player.angle) * 15, playerMapY + Math.sin(player.angle) * 15);
            ctx.stroke();
        }

        ctx.restore();

        // --- NEW: Draw "Scroll Rolls" at the side edges ---
        if (progress > 0) {
            const rollWidth = 24;
            const rollExtension = 15; // Vertical extension

            const drawScroll = (x) => {
                const rollY = mapY - rollExtension;
                const rollH = mapSize + (rollExtension * 2);

                ctx.save();
                // Vertical Gradient for cylinder effect
                const gradient = ctx.createLinearGradient(x, rollY, x + rollWidth, rollY);
                gradient.addColorStop(0, '#5d4037'); // Darkest (Left Edge)
                gradient.addColorStop(0.4, '#e8d0b1'); // Lighter (Highlight)
                gradient.addColorStop(1, '#3e2723'); // Darker (Right Shadow)

                ctx.fillStyle = gradient;
                ctx.fillRect(x, rollY, rollWidth, rollH);

                // Knobs (Top and Bottom)
                ctx.fillStyle = '#3e2723';
                ctx.fillRect(x + 4, rollY - 5, rollWidth - 8, 5); // Top
                ctx.fillRect(x + 4, rollY + rollH, rollWidth - 8, 5); // Bottom

                ctx.restore();
            };

            drawScroll(visibleLeft - (rollWidth / 2));
            drawScroll(visibleRight - (rollWidth / 2));
        }
    }

    _drawAnchorIndicator(ctx, canvas, player) {
        if (!player || (!player.isAnchored && !player.isInAnchorRange)) return;

        const barHeight = 25;
        const barWidth = canvas.width / 4;
        const barX = (canvas.width - barWidth) / 2;
        const barY = canvas.height - barHeight - 20;
        const diameter = barHeight;
        const indicatorX = barX - diameter - 10;

        ctx.save();
        ctx.translate(indicatorX, barY);

        const radius = diameter / 2;
        const centerX = radius;
        const centerY = radius;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        if (player.isAnchored) {
            const ringRadius = radius + 5;
            const ringLineWidth = 5;
            const maxLineLength = player.shipLength * MAX_ANCHOR_LINE_LENGTH_MULTIPLIER;
            const currentLineLength = player.anchorLineMaxDistance;
            let fillRatio = maxLineLength > 0 ? Math.min(1, currentLineLength / maxLineLength) : 0;
            const r = Math.round(fillRatio * 255);
            const g = Math.round((1 - fillRatio) * 255);
            ctx.strokeStyle = `rgb(${r},${g},0)`;
            ctx.lineWidth = ringLineWidth;
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + (Math.PI * 2 * fillRatio);
            ctx.beginPath();
            ctx.arc(centerX, centerY, ringRadius, startAngle, endAngle);
            ctx.stroke();
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        const iconWidth = ANCHOR_ICON_DATA.originalWidth;
        const iconHeight = ANCHOR_ICON_DATA.originalHeight;
        const targetSide = diameter * 0.8;
        const scale = targetSide / Math.max(iconWidth, iconHeight);
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ANCHOR_ICON_DATA.points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    _drawCannonReloadIndicator(ctx, x, y, diameter, currentReloadTime, maxReloadTime, cannonCount) {
        ctx.save();
        ctx.translate(x, y);
        const radius = diameter / 2;
        const centerX = radius;
        const centerY = radius;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();
        ctx.strokeStyle = CANNON_COUNT_BORDER_COLOR;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = CANNON_COUNT_TEXT_COLOR;
        ctx.font = `bold ${diameter * 0.6}px Inter`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cannonCount.toString(), centerX, centerY);
        if (currentReloadTime > 0) {
            const ringRadius = radius + 4;
            const ringLineWidth = 4;
            const fillRatio = 1 - (currentReloadTime / maxReloadTime);
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + (Math.PI * 2 * fillRatio);
            ctx.strokeStyle = CANNON_RING_COLOR;
            ctx.lineWidth = ringLineWidth;
            ctx.beginPath();
            ctx.arc(centerX, centerY, ringRadius, startAngle, endAngle);
            ctx.stroke();
        }
        ctx.restore();
    }

    /**
     * Draws the main player HUD, including HP bar, indicators, and cannon reloads.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {HTMLCanvasElement} canvas - The main game canvas.
     * @param {PlayerShip} player - The player ship object.
     * @param {number} windDirection - The current wind direction.
     * @param {Array} npcs - Active NPCs.
     * @param {object} boardingState - The current boarding state.
     */
    _drawHud(ctx, canvas, player, windDirection, npcs = [], boardingState = null, hudMode = 'main', mouseX = 0, mouseY = 0) {
        if (!player) return;

        // --- Player Profile Panel (Top Left) ---
        const profileRadius = 30;
        const profileMargin = 20;
        const profileX = profileMargin + profileRadius;
        const profileY = profileMargin + profileRadius;

        ctx.save();

        // 1. Profile Circle Container
        ctx.beginPath();
        ctx.arc(profileX, profileY, profileRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 2. Player Name
        const nameX = profileX + profileRadius + 15; // Gap
        const nameY = profileY - 10; // Shift up slightly

        ctx.fillStyle = '#ecf0f1';
        ctx.font = "24px 'IM Fell English', serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";

        // Add shadow for readability against the game world
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;

        // --- NEW: Measure Name Width ---
        const nameWidth = ctx.measureText(player.name).width;
        ctx.fillText(player.name, nameX, nameY);

        // Fortune Calculation
        let totalBaseValue = 0;
        if (player.inventory && player.inventory.cargo) {
            for (const entry of player.inventory.cargo) {
                if (entry.item && typeof entry.item.baseValue === 'number') {
                    totalBaseValue += entry.item.baseValue * entry.quantity;
                }
            }
        }
        const fortuneGold = Math.floor(totalBaseValue / 20);
        const fortuneText = `Fortune: ${fortuneGold} G`;

        ctx.fillStyle = '#FFD700'; // Gold
        ctx.font = "18px 'IM Fell English', serif";

        // --- NEW: Measure Fortune Width ---
        const fortuneWidth = ctx.measureText(fortuneText).width;
        ctx.fillText(fortuneText, nameX, nameY + 24);

        // --- NEW: Ranking Section ---
        // Position to the right side of the HUD (Top Right)
        const rankRadius = 25; // Slightly smaller than profile (30)
        const rankMargin = 20;
        const rankX = canvas.width - rankMargin - rankRadius;
        const rankY = profileY; // Align centers vertically with profile circle

        // Disable shadow for the container so it matches the profile circle's transparency
        ctx.shadowBlur = 0;

        // Rank Circle Container
        ctx.beginPath();
        ctx.arc(rankX, rankY, rankRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 2;
        ctx.stroke();

        // --- NEW: Draw Rank Icon ---
        const rankData = player.rankData;
        if (rankData && rankData.iconPath) {
            ctx.save();
            ctx.translate(rankX, rankY);
            // Scale icon to fit (Icon is 100x100, target is ~30x30 inside the 50px circle)
            const iconScale = 0.3;
            ctx.scale(iconScale, iconScale);
            ctx.translate(-50, -50); // Center the 100x100 icon

            ctx.fillStyle = rankData.color;

            // Optimization: Cache the darkened stroke color to avoid regex parsing every frame
            if (!rankData.cachedStrokeColor) {
                rankData.cachedStrokeColor = (typeof darkenColor === 'function') ? darkenColor(rankData.color, 40) : 'black';
            }
            ctx.strokeStyle = rankData.cachedStrokeColor;
            ctx.lineWidth = 4;

            // Optimization: Cache Path2D objects to avoid parsing SVG strings every frame
            if (!rankData.cachedPaths) {
                rankData.cachedPaths = [];
                const paths = Array.isArray(rankData.iconPath) ? rankData.iconPath : [rankData.iconPath];
                paths.forEach(p => rankData.cachedPaths.push(new Path2D(p)));
            }

            // Draw the cached path(s)
            rankData.cachedPaths.forEach(path => {
                ctx.fill(path);
                ctx.stroke(path);
            });

            ctx.restore();
        }

        // Rank Text
        const rankTextX = rankX - rankRadius - 10;

        // Re-enable shadow for text readability
        ctx.shadowBlur = 4;

        ctx.fillStyle = rankData ? rankData.color : '#ecf0f1';
        ctx.font = "24px 'IM Fell English', serif";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(rankData ? rankData.name : "Neutral", rankTextX, rankY);

        // --- DEBUG: Rank Switch Button ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
            const rankName = rankData ? rankData.name : "Neutral";
            const rankTextWidth = ctx.measureText(rankName).width;
            const debugBtnX = rankTextX - rankTextWidth - 20;
            const debugBtnY = rankY;
            const debugBtnRadius = 10;

            // Store bounds for click handler in game.js
            this.debugRankButtonBounds = { x: debugBtnX, y: debugBtnY, radius: debugBtnRadius };

            ctx.beginPath();
            ctx.arc(debugBtnX, debugBtnY, debugBtnRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+', debugBtnX, debugBtnY);
        } else {
            // Clear bounds if debug is disabled
            this.debugRankButtonBounds = null;
        }

        ctx.restore();

        // --- Ship Info Panel (Below Profile) ---
        const shipRadius = profileRadius * 0.5; // 15px
        const shipMarginTop = 10;
        const shipX = profileX; // Align centers vertically with profile circle
        const shipY = profileY + profileRadius + shipMarginTop + shipRadius;

        ctx.save();

        // 1. Ship Circle Container
        ctx.beginPath();
        ctx.arc(shipX, shipY, shipRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // 2. Ship Image (Clipped)
        ctx.save();
        ctx.beginPath();
        ctx.arc(shipX, shipY, shipRadius, 0, Math.PI * 2);
        ctx.clip(); // Clip drawing to the circle

        // Use the pre-rendered cache canvas if available (supports both Custom and Base ships)
        const cache = player.hullCacheCanvas || player.shipCacheCanvas;
        if (cache) {
            const scale = (shipRadius * 1.6) / Math.max(cache.width, cache.height);
            ctx.translate(shipX, shipY);
            ctx.rotate(-Math.PI / 2); // Rotate to point up
            ctx.scale(scale, scale);
            ctx.drawImage(cache, -cache.width / 2, -cache.height / 2);
        }
        ctx.restore();

        // 3. Ship Name and Type
        const shipTextX = shipX + shipRadius + 10;

        ctx.fillStyle = '#ecf0f1';
        ctx.textAlign = "left";
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.font = "16px 'IM Fell English', serif";
        ctx.fillText(player.displayName || "Unnamed Ship", shipTextX, shipY - 2);
        ctx.fillStyle = '#bdc3c7';
        ctx.font = "italic 12px 'IM Fell English', serif";
        ctx.fillText(player.shipType || "Unknown Class", shipTextX, shipY + 12);

        ctx.restore();

        // --- NEW: Draw NPC ID Card during Boarding ---
        if (boardingState && boardingState.isActive && boardingState.target) {
            this._drawNpcIdCard(ctx, canvas, boardingState.target);
        } else {
            // --- Draw General Combat Deactivation Timer Bar (Debug) ---
            // Only draw if NOT boarding to keep the top center clear.

            // Find the closest NPC that is currently disengaging (timer > 0)
            let relevantNpc = null;
            let minDistance = Infinity;

            for (const npc of npcs) {
                // Check if this NPC is in combat and has a running disengage timer
                if (npc.aiState === 'combat' && npc.combatPilot && npc.combatPilot.disengageTimer > 0) {
                    const dist = distance(player, npc);
                    if (dist < minDistance) {
                        minDistance = dist;
                        relevantNpc = npc;
                    }
                }
            }

            if (relevantNpc) {
                const barWidth = canvas.width / 4;
                const barHeight = 15;
                const barX = (canvas.width - barWidth) / 2;
                const barY = 20;
                const borderRadius = 5;

                let timerRatio = 0;
                let label = '';

                // Display the general out-of-range deactivation timer.
                timerRatio = relevantNpc.combatPilot.disengageTimer / NPC_COMBAT_DEACTIVATION_TIME;
                const remainingTime = (NPC_COMBAT_DEACTIVATION_TIME - relevantNpc.combatPilot.disengageTimer) / 1000;
                label = `Disengaging: ${remainingTime.toFixed(1)}s`;

                ctx.save();
                // Background
                ctx.beginPath();
                ctx.roundRect(barX, barY, barWidth, barHeight, borderRadius);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fill();

                // Fill
                if (timerRatio > 0) {
                    ctx.beginPath();
                    ctx.roundRect(barX, barY, barWidth * timerRatio, barHeight, borderRadius);
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fill();
                }

                // Border
                ctx.beginPath();
                ctx.roundRect(barX, barY, barWidth, barHeight, borderRadius);
                ctx.strokeStyle = '#ecf0f1';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Text
                ctx.fillStyle = '#2c3e50';
                ctx.font = '12px Inter';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label, barX + barWidth / 2, barY + barHeight / 2);
                ctx.restore();
            }
        }

        // Draw ship's relative degree direction from the wind
        const angleDiff = normalizeAngle(player.angle - windDirection);
        const absAngleOffWindDegrees = Math.round(Math.abs(angleDiff > Math.PI ? angleDiff - 2 * Math.PI : angleDiff) * 180 / Math.PI);
        const dialSize = 60;
        const margin = 20;
        const dialX = canvas.width - dialSize - margin;
        const dialY = canvas.height - dialSize - margin;
        ctx.save();
        ctx.fillStyle = '#ecf0f1';
        ctx.font = '14px Inter';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${absAngleOffWindDegrees}°`, dialX - 10, dialY + dialSize / 2);
        ctx.restore();

        // Draw HP bar
        const barWidth = canvas.width / 4;
        const barHeight = 10;
        const hpBarMargin = 20;
        const barX = (canvas.width - barWidth) / 2;
        const barY = canvas.height - barHeight - hpBarMargin;
        const borderRadius = 8;
        const hpRatio = Math.max(0, player.hp / player.maxHp);

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth, barHeight, borderRadius / 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();

        let hpColor = (hpRatio >= 0.5) ? '#FFFFFF' : `rgb(${Math.round(220 + (255 - 220) * (hpRatio / 0.5))}, ${Math.round(20 + (255 - 20) * (hpRatio / 0.5))}, ${Math.round(60 + (255 - 60) * (hpRatio / 0.5))})`;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth * hpRatio, barHeight, borderRadius / 2);
        ctx.fillStyle = hpColor;
        ctx.fill();

        ctx.beginPath();
        ctx.roundRect(barX, barY, barWidth, barHeight, borderRadius / 2);
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#2c3e50';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(player.hp)} / ${player.maxHp} HP`, barX + barWidth / 2, barY + barHeight / 2);
        ctx.restore();

        // --- New: Draw Rigging HP Bar ---
        const rigBarHeight = 10; // Fixed height
        const rigBarY = barY - rigBarHeight - 5; // Positioned directly above the hull HP bar
        const rigHpRatio = Math.max(0, player.rigHp / player.maxRigHp);

        ctx.save();
        // Background
        ctx.beginPath();
        ctx.roundRect(barX, rigBarY, barWidth, rigBarHeight, borderRadius / 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();

        // --- FIX: Use the same color logic as the hull HP bar for consistency. ---
        // This makes the bar white when healthy, and transition from yellow to red when damaged.
        const rigHpColor = (rigHpRatio >= 0.5) ? '#FFFFFF' : `rgb(${Math.round(220 + (255 - 220) * (rigHpRatio / 0.5))}, ${Math.round(20 + (255 - 20) * (rigHpRatio / 0.5))}, ${Math.round(60 + (255 - 60) * (rigHpRatio / 0.5))})`;
        ctx.beginPath();
        ctx.roundRect(barX, rigBarY, barWidth * rigHpRatio, rigBarHeight, borderRadius / 2);
        ctx.fillStyle = rigHpColor;
        ctx.fill();

        // Border
        ctx.beginPath();
        ctx.roundRect(barX, rigBarY, barWidth, rigBarHeight, borderRadius / 2);
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 1; // Thinner border for the smaller bar
        ctx.stroke();

        // Text
        ctx.fillStyle = '#2c3e50';
        ctx.font = '10px Inter'; // Smaller font for the smaller bar
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(player.rigHp)} / ${player.maxRigHp} Rig HP`, barX + barWidth / 2, rigBarY + rigBarHeight / 2);
        ctx.restore();

        // --- New: Draw Crew Num Bar ---
        const crewBarHeight = 10;
        const crewBarY = rigBarY - crewBarHeight - 5; // Positioned directly above the rig HP bar
        const crewRatio = Math.max(0, player.crew / player.maxCrew);

        ctx.save();
        // Background
        ctx.beginPath();
        ctx.roundRect(barX, crewBarY, barWidth, crewBarHeight, borderRadius / 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fill();

        // Fill - Use same color logic as HP for consistency (White -> Yellow -> Red)
        const crewColor = (crewRatio >= 0.5) ? '#FFFFFF' : `rgb(${Math.round(220 + (255 - 220) * (crewRatio / 0.5))}, ${Math.round(20 + (255 - 20) * (crewRatio / 0.5))}, ${Math.round(60 + (255 - 60) * (crewRatio / 0.5))})`;
        ctx.beginPath();
        ctx.roundRect(barX, crewBarY, barWidth * crewRatio, crewBarHeight, borderRadius / 2);
        ctx.fillStyle = crewColor;
        ctx.fill();

        // Border
        ctx.beginPath();
        ctx.roundRect(barX, crewBarY, barWidth, crewBarHeight, borderRadius / 2);
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Text
        ctx.fillStyle = '#2c3e50';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(player.crew)} / ${player.maxCrew} Crew`, barX + barWidth / 2, crewBarY + crewBarHeight / 2);
        ctx.restore();

        // --- FIX: Adjust position of elements above the HP bars ---
        const regenerationBarHeight = 5; // Fixed small height
        const regenerationBarY = crewBarY - regenerationBarHeight - 5; // Position above the new crew bar
        const timeSinceLastActivity = performance.now() - player.lastDamageTime;

        // Draw Regeneration Cooldown Bar (if needed)
        if (player.hp < player.maxHp && timeSinceLastActivity < REGENERATION_COOLDOWN_TIME) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(barX, regenerationBarY, barWidth, regenerationBarHeight, borderRadius);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fill();

            const regenFillRatio = Math.min(1, timeSinceLastActivity / REGENERATION_COOLDOWN_TIME);
            ctx.beginPath();
            ctx.roundRect(barX, regenerationBarY, barWidth * regenFillRatio, regenerationBarHeight, borderRadius);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();

            ctx.beginPath();
            ctx.roundRect(barX, regenerationBarY, barWidth, regenerationBarHeight, borderRadius);
            ctx.strokeStyle = '#ecf0f1';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        }

        // --- New: Draw Reefed Indicator ---
        // This is drawn after the regen bar logic to correctly position it above.
        // --- FIX: Position above the highest HUD element based on mode ---
        if (player.isReefed) {
            const reloadBarDiameter = CANNON_RING_BUFFER_BAR_SIZE;
            const reloadBarY = crewBarY - CANNON_RING_BUFFER_BAR_MARGIN_Y - reloadBarDiameter;
            const buttonRadius = reloadBarDiameter / 2;
            const buttonY = reloadBarY + buttonRadius;

            let highestY = reloadBarY; // Default: Top of Main HUD buttons/indicators

            if (hudMode === 'navigation') {
                const combatBackY = buttonY + 5;
                const rowY = combatBackY - 25;
                highestY = rowY - buttonRadius; // Top of sailing buttons
            } else if (hudMode === 'combat') {
                const combatBackY = buttonY + 5;
                const rowY = combatBackY - 25;
                const carouselY = rowY - 60;
                const centerRadius = 22;
                highestY = carouselY - centerRadius; // Top of shot carousel
            }

            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
            ctx.font = 'bold 12px Inter';
            ctx.textAlign = 'center';
            ctx.fillText("REEFED", canvas.width / 2, highestY - 15);
            ctx.restore();
        }

        // Draw shoal/coral reef indicators
        // --- FIX: Position indicators below the ship info panel to avoid overlap with profile ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
            let indicatorY = shipY + shipRadius + 20;
            const indicatorX = shipX;

            if (player.isOverShoal) {
                ctx.save();
                ctx.fillStyle = SHOAL_DETECT_INDICATOR_COLOR;
                ctx.beginPath();
                ctx.arc(indicatorX, indicatorY, SHOAL_DETECT_INDICATOR_SIZE / 2, 0, Math.PI * 2);
                ctx.fill();

                // Label
                ctx.fillStyle = '#ecf0f1';
                ctx.font = 'bold 10px Inter';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 2;
                ctx.fillText("SHOAL", indicatorX + 15, indicatorY);

                ctx.restore();
                indicatorY += 25;
            }
            if (player.isOverCoralReef) {
                ctx.save();
                ctx.fillStyle = CORAL_REEF_DETECT_INDICATOR_COLOR;
                ctx.beginPath();
                ctx.arc(indicatorX, indicatorY, CORAL_REEF_DETECT_INDICATOR_SIZE / 2, 0, Math.PI * 2);
                ctx.fill();

                // Label
                ctx.fillStyle = '#ecf0f1';
                ctx.font = 'bold 10px Inter';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 2;
                ctx.fillText("REEF", indicatorX + 15, indicatorY);

                ctx.restore();
            }
        }

        // Draw Anchor Indicator
        this._drawAnchorIndicator(ctx, canvas, player);

        // Draw Cannon Reload Bars
        const reloadBarDiameter = CANNON_RING_BUFFER_BAR_SIZE;
        const reloadBarY = crewBarY - CANNON_RING_BUFFER_BAR_MARGIN_Y - reloadBarDiameter; // Position relative to the new crew bar

        // --- FIX: Get the actual broadside count for each side ---
        let portCount = 0;
        let starboardCount = 0;

        if (player.blueprint && typeof player.getBroadsideCount === 'function') {
            portCount = player.getBroadsideCount('port');
            starboardCount = player.getBroadsideCount('starboard');
        } else {
            // Fallback for base ship
            const baseCount = Ship.prototype.getBroadsideCount.call(player);
            portCount = baseCount;
            starboardCount = baseCount;
        }

        const portReloadBarX = barX - CANNON_RING_BUFFER_BAR_MARGIN_X - reloadBarDiameter;
        this._drawCannonReloadIndicator(ctx, portReloadBarX, reloadBarY, reloadBarDiameter, player.portCannonReloadTime, player.reloadTime, portCount);
        const starboardReloadBarX = barX + barWidth + CANNON_RING_BUFFER_BAR_MARGIN_X;
        this._drawCannonReloadIndicator(ctx, starboardReloadBarX, reloadBarY, reloadBarDiameter, player.starboardCannonReloadTime, player.reloadTime, starboardCount);

        // --- NEW: Hover Labels for Broadside Indicators ---
        const radius = reloadBarDiameter / 2;
        const drawLabel = (text, x, y) => {
            ctx.save();
            ctx.fillStyle = '#ecf0f1';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 4;
            ctx.font = 'bold 12px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(text, x, y);
            ctx.restore();
        };

        const portCx = portReloadBarX + radius;
        const portCy = reloadBarY + radius;
        if (Math.hypot(mouseX - portCx, mouseY - portCy) <= radius) {
            drawLabel("Port Broadside", portCx, portCy + radius + 2);
        }

        const stbdCx = starboardReloadBarX + radius;
        const stbdCy = reloadBarY + radius;
        if (Math.hypot(mouseX - stbdCx, mouseY - stbdCy) <= radius) {
            drawLabel("Starboard Broadside", stbdCx, stbdCy + radius + 2);
        }
    }

    /**
     * Draws the NPC Ship ID Card at the top center of the HUD during boarding.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {HTMLCanvasElement} canvas - The main game canvas.
     * @param {NpcShip} npc - The NPC ship being boarded.
     */
    _drawNpcIdCard(ctx, canvas, npc) {
        const barWidth = canvas.width / 4;
        const barHeight = 10;
        const borderRadius = 8;
        const cardX = (canvas.width - barWidth) / 2;
        let currentY = 20; // Start from top margin

        // 1. Name Tag
        ctx.save();
        ctx.fillStyle = '#ecf0f1';
        ctx.font = 'bold 16px "IM Fell English"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        // --- OPTIMIZATION: Use hard shadow instead of expensive blur ---
        ctx.fillStyle = 'black';
        ctx.fillText(npc.displayName, canvas.width / 2 + 1, currentY + 1);
        ctx.fillStyle = '#ecf0f1';
        ctx.fillText(npc.displayName, canvas.width / 2, currentY);
        ctx.restore();

        currentY += 25; // Space for name

        // Helper to draw a bar
        const drawBar = (current, max, label, isHull = false) => {
            const ratio = Math.max(0, current / max);

            ctx.save();
            // Background
            ctx.beginPath();
            ctx.roundRect(cardX, currentY, barWidth, barHeight, borderRadius / 2);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fill();

            // Fill & Border
            ctx.beginPath();
            ctx.roundRect(cardX, currentY, barWidth * ratio, barHeight, borderRadius / 2);
            ctx.fillStyle = (ratio >= 0.5) ? '#FFFFFF' : `rgb(${Math.round(220 + (255 - 220) * (ratio / 0.5))}, ${Math.round(20 + (255 - 20) * (ratio / 0.5))}, ${Math.round(60 + (255 - 60) * (ratio / 0.5))})`;
            ctx.fill();

            ctx.beginPath();
            ctx.roundRect(cardX, currentY, barWidth, barHeight, borderRadius / 2);
            ctx.strokeStyle = '#ecf0f1';
            ctx.lineWidth = isHull ? 2 : 1;
            ctx.stroke();

            // Text
            ctx.fillStyle = '#2c3e50';
            ctx.font = '10px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.round(current)} / ${max} ${label}`, cardX + barWidth / 2, currentY + barHeight / 2);
            ctx.restore();

            currentY += barHeight + 5;
        };

        // Draw bars in order: Crew, Rig, Hull (matching player visual stack top-to-bottom)
        drawBar(npc.crew, npc.maxCrew, "Crew");
        drawBar(npc.rigHp, npc.maxRigHp, "Rig HP");
        drawBar(npc.hp, npc.maxHp, "HP", true);
    }

    /**
     * Draws the new HUD control buttons (Navigation, etc.).
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {HTMLCanvasElement} canvas - The canvas element.
     * @param {PlayerShip} player - The player ship object.
     * @param {string} hudMode - The current HUD mode ('main' or 'combat').
     * @param {Array} clickTimes - Array of timestamps for button clicks.
     * @param {number} mouseX - The current screen-space mouse X.
     * @param {number} mouseY - The current screen-space mouse Y.
     */
    _drawHudControls(ctx, canvas, player, hudMode = 'main', clickTimes = [], mouseX = 0, mouseY = 0) {
        // Ensure the icon data exists before attempting to draw
        if (typeof NAVIGATION_ICON_DATA === 'undefined') return;

        if (!player) return;

        // --- Reconstruct HUD layout to align with broadside indicators ---
        const hpBarHeight = 10;
        const hpBarMargin = 20;
        const hullBarY = canvas.height - hpBarHeight - hpBarMargin;
        
        const rigBarHeight = 10;
        const rigBarY = hullBarY - rigBarHeight - 5;
        
        const crewBarHeight = 10;
        const crewBarY = rigBarY - crewBarHeight - 5;
        
        const reloadBarDiameter = CANNON_RING_BUFFER_BAR_SIZE;
        // reloadBarY is the top-left Y of the reload indicator box
        const reloadBarY = crewBarY - CANNON_RING_BUFFER_BAR_MARGIN_Y - reloadBarDiameter;

        // Calculate position for the buttons
        const buttonDiameter = reloadBarDiameter; 
        const buttonRadius = buttonDiameter / 2;
        const buttonY = reloadBarY + buttonRadius;
        
        const gap = 15; // Spacing between buttons
        const centerX = canvas.width / 2;
        
        // Navigation Button (Left)
        const navButtonX = centerX - buttonDiameter - gap;
        
        // Combat Button (Center)
        const combatButtonX = centerX;

        // Inventory Button (Right)
        const inventoryButtonX = centerX + buttonDiameter + gap;

        if (hudMode === 'main') {
            // 1. Draw Navigation Button
            this._drawHudButtonBackground(ctx, navButtonX, buttonY, buttonRadius);
            
            ctx.save();
            ctx.translate(navButtonX, buttonY);

            // Use the Main Star's dimensions to determine the scale for both components.
            const width = NAVIGATION_ICON_DATA.originalWidth || 100;
            const height = NAVIGATION_ICON_DATA.originalHeight || 100;

            if (width > 0 && height > 0) {
                const targetSize = buttonDiameter * 0.6; // 60% of button size
                const maxDim = Math.max(width, height);
                const scale = targetSize / maxDim;

                ctx.save();
                ctx.scale(scale, scale);
                
                // 1. Draw Diagonal Star (Background)
                if (typeof NAVIGATION_ICON_DIAGONAL_DATA !== 'undefined') {
                    this._drawSvgPath(ctx, NAVIGATION_ICON_DIAGONAL_DATA, 'white');

                    // 2. Draw Ring
                    ctx.beginPath();
                    ctx.arc(0, 0, UI_COMPASS_RING_RADIUS, 0, Math.PI * 2);
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 1 / scale;
                    ctx.stroke();
                }
                
                // 3. Draw Main Star (Foreground)
                this._drawSvgPath(ctx, NAVIGATION_ICON_DATA, 'white');
                
                ctx.restore();
            }
            ctx.restore();

            if (Math.hypot(mouseX - navButtonX, mouseY - buttonY) <= buttonRadius) {
                this._drawHoverLabel(ctx, "Navigation", navButtonX, buttonY + buttonRadius + 2);
            }

            // 2. Draw Combat Button
            this._drawHudButtonBackground(ctx, combatButtonX, buttonY, buttonRadius);

            ctx.save();
            ctx.translate(combatButtonX, buttonY);
            
            // Draw Combat Icon (Crossed Cannons)
            ctx.save();
            ctx.rotate(-Math.PI / 4); // Pointing Top-Right
            this._drawHudCannonBarrel(ctx, buttonRadius);
            ctx.restore();

            ctx.save();
            ctx.rotate(-Math.PI * 0.75); // Pointing Top-Left
            this._drawHudCannonBarrel(ctx, buttonRadius);
            ctx.restore();
            
            // Draw Pyramidal Circles (Cannonballs) in the top space
            ctx.save();
            ctx.translate(0, -buttonRadius * 0.5); 
            const pyramidScale = 0.5;
            ctx.scale(pyramidScale, pyramidScale);

            const iconRadius = buttonRadius * 0.6; 
            const circleRadius = iconRadius * 0.35;
            const offsetY = circleRadius * 0.8;
            const offsetX = circleRadius * 1.1;

            ctx.fillStyle = 'white';
            ctx.beginPath(); ctx.arc(0, -offsetY, circleRadius, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-offsetX, offsetY, circleRadius, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(offsetX, offsetY, circleRadius, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            
            ctx.restore();

            if (Math.hypot(mouseX - combatButtonX, mouseY - buttonY) <= buttonRadius) {
                this._drawHoverLabel(ctx, "Combat", combatButtonX, buttonY + buttonRadius + 2);
            }

            // 3. Draw Inventory Button
            this._drawHudButtonBackground(ctx, inventoryButtonX, buttonY, buttonRadius);

            ctx.save();
            ctx.translate(inventoryButtonX, buttonY);
            
            // Draw Inventory Icon (Square Lattice)
            const iconSize = buttonRadius * 0.55; 
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1; 
            ctx.strokeRect(-iconSize, -iconSize, iconSize * 2, iconSize * 2);
            ctx.beginPath();
            const numBars = 5;
            const totalWidth = iconSize * 2;
            const step = totalWidth / (numBars + 1);
            for (let i = 1; i <= numBars; i++) {
                const offset = -iconSize + i * step;
                ctx.moveTo(offset, -iconSize); ctx.lineTo(offset, iconSize);
                ctx.moveTo(-iconSize, offset); ctx.lineTo(iconSize, offset);
            }
            ctx.stroke();
            ctx.restore();

            if (Math.hypot(mouseX - inventoryButtonX, mouseY - buttonY) <= buttonRadius) {
                this._drawHoverLabel(ctx, "Inventory", inventoryButtonX, buttonY + buttonRadius + 2);
            }

        } else if (hudMode === 'combat') {
            const combatBackY = buttonY + 5;
            const rowY = combatBackY - 25;
            const spacing = buttonDiameter + gap;
            const xOffsets = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map(factor => factor * spacing);

            xOffsets.forEach((xOffset, index) => {
                const isPressed = clickTimes[index] && (performance.now() - clickTimes[index] < 150);
                this._drawHudButtonBackground(ctx, centerX + xOffset, rowY, buttonRadius, isPressed);
                
                if (index === 0) { // Button 1: Fire All Cannons
                    ctx.save();
                    ctx.translate(centerX + xOffset, rowY);
                    const scale = 0.4;
                    ctx.scale(scale, scale);
                    const L = buttonRadius * 1.4;
                    const ringRadius = L * 0.6;
                    const angles = [0, Math.PI, Math.PI / 3, (2 * Math.PI) / 3, -Math.PI / 3, -(2 * Math.PI) / 3];
                    angles.forEach(angle => {
                        ctx.save();
                        ctx.rotate(angle);
                        ctx.translate(ringRadius, 0);
                        this._drawHudCannonBarrel(ctx, buttonRadius);
                        ctx.restore();
                    });
                    ctx.restore();
                    if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                        this._drawHoverLabel(ctx, "Fire All", centerX + xOffset, rowY + buttonRadius + 2);
                    }
                }
                else if (index === 1) { // Button 2: Fire Port Broadside
                    ctx.save();
                    ctx.translate(centerX + xOffset, rowY);
                    const scale = 0.55;
                    ctx.scale(scale, scale);
                    const L = buttonRadius * 1.4;
                    const W = L * 0.25;
                    const spacing = W * 1.2;
                    const xShift = 0;
                    for (let i = -1; i <= 1; i++) {
                        ctx.save();
                        ctx.translate(xShift, i * spacing);
                        ctx.rotate(-Math.PI * 0.75); // 135 degrees up-left
                        this._drawHudCannonBarrel(ctx, buttonRadius);
                        ctx.restore();
                    }
                    ctx.restore();
                    if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                        this._drawHoverLabel(ctx, "Port Fire", centerX + xOffset, rowY + buttonRadius + 2);
                    }
                }
                else if (index === 2) { // Button 3: Fire Starboard Broadside
                    ctx.save();
                    ctx.translate(centerX + xOffset, rowY);
                    const scale = 0.55;
                    ctx.scale(scale, scale);
                    const L = buttonRadius * 1.4;
                    const W = L * 0.25;
                    const spacing = W * 1.2;
                    const xShift = 0;
                    for (let i = -1; i <= 1; i++) {
                        ctx.save();
                        ctx.translate(xShift, i * spacing);
                        ctx.rotate(-Math.PI / 4); // 45 degrees up-right
                        this._drawHudCannonBarrel(ctx, buttonRadius);
                        ctx.restore();
                    }
                    ctx.restore();
                    if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                        this._drawHoverLabel(ctx, "Starboard Fire", centerX + xOffset, rowY + buttonRadius + 2);
                    }
                }
                else if (index === 3) { // Button 4: Fire Bow Chasers
                    ctx.save();
                    ctx.translate(centerX + xOffset, rowY);
                    const scale = 0.55;
                    ctx.scale(scale, scale);
                    const L = buttonRadius * 1.4;
                    const W = L * 0.25;
                    const spacing = W * 1.2;
                    this._drawArrow(ctx, 0, -L * 0.8, 10, 0);
                    ctx.rotate(-Math.PI / 2);
                    [-0.5, 0.5].forEach(offset => { ctx.save(); ctx.translate(0, offset * spacing); this._drawHudCannonBarrel(ctx, buttonRadius); ctx.restore(); });
                    ctx.restore();
                    if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                        this._drawHoverLabel(ctx, "Bow Fire", centerX + xOffset, rowY + buttonRadius + 2);
                    }
                }
                else if (index === 4) { // Button 5: Fire Stern Chasers
                    ctx.save();
                    ctx.translate(centerX + xOffset, rowY);
                    const scale = 0.55;
                    ctx.scale(scale, scale);
                    const L = buttonRadius * 1.4;
                    const W = L * 0.25;
                    const spacing = W * 1.2;
                    this._drawArrow(ctx, 0, L * 0.8, 10, Math.PI);
                    ctx.rotate(Math.PI / 2);
                    [-0.5, 0.5].forEach(offset => { ctx.save(); ctx.translate(0, offset * spacing); this._drawHudCannonBarrel(ctx, buttonRadius); ctx.restore(); });
                    ctx.restore();
                    if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) {
                        this._drawHoverLabel(ctx, "Stern Fire", centerX + xOffset, rowY + buttonRadius + 2);
                    }
                }
            });

            // Draw Back Button
            ctx.save();
            ctx.translate(centerX, combatBackY);
            ctx.beginPath();
            const triW = 12; const triH = 6;
            ctx.moveTo(-triW/2, -triH/2); ctx.lineTo(triW/2, -triH/2); ctx.lineTo(0, triH/2); ctx.closePath();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fill();
            ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
            ctx.restore();

            if (Math.hypot(mouseX - centerX, mouseY - combatBackY) <= buttonRadius) {
                this._drawHoverLabel(ctx, "Back", centerX, combatBackY + buttonRadius + 2);
            }

        } else if (hudMode === 'navigation') {
            const combatBackY = buttonY + 5;
            const rowY = combatBackY - 25;
            // --- NEW: Adjust for 7 buttons ---
            const spacing = buttonDiameter + gap;
            const xOffsets = [-3, -2, -1, 0, 1, 2, 3].map(factor => factor * spacing);

            xOffsets.forEach((xOffset, index) => {
                const isPressed = clickTimes[index] && (performance.now() - clickTimes[index] < 150);
                this._drawHudButtonBackground(ctx, centerX + xOffset, rowY, buttonRadius, isPressed);
                
                // --- Icons logic ---
                if (index === 0) { // Open Sails
                    ctx.save();
                    ctx.translate(centerX + xOffset, rowY);
                    ctx.fillStyle = 'white'; ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    ctx.save(); ctx.scale(0.5, 0.5);
                    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(-14, -10); ctx.lineTo(14, -10); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(-13, -10); ctx.quadraticCurveTo(-15, 0, -13, 10); ctx.quadraticCurveTo(0, 15, 13, 10); ctx.quadraticCurveTo(15, 0, 13, -10); ctx.closePath(); ctx.fill();
                    ctx.restore();
                    if (player.isSailOpen && !player.isReefed) {
                        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, buttonRadius - 3, 0, Math.PI * 2); ctx.stroke();
                    }
                    ctx.restore();
                    if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) this._drawHoverLabel(ctx, "Open Sails", centerX + xOffset, rowY + buttonRadius + 2);
                } 
                else if (index === 1) { // Close Sails
                    ctx.save();
                    ctx.translate(centerX + xOffset, rowY);
                    ctx.fillStyle = 'white'; ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    ctx.save(); ctx.scale(0.5, 0.5);
                    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(-14, -10); ctx.lineTo(14, -10); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(-13, -10); ctx.bezierCurveTo(-7, -4, 7, -4, 13, -10); ctx.fill();
                    ctx.restore();
                    if (!player.isSailOpen) {
                        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, buttonRadius - 3, 0, Math.PI * 2); ctx.stroke();
                    }
                    ctx.restore();
                    if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) this._drawHoverLabel(ctx, "Close Sails", centerX + xOffset, rowY + buttonRadius + 2);
                }
                else if (index === 2) { // Reef Sails
                    ctx.save();
                    ctx.translate(centerX + xOffset, rowY);
                    ctx.fillStyle = 'white'; ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    ctx.save(); ctx.scale(0.5, 0.5);
                    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(-14, -10); ctx.lineTo(14, -10); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(-13, -10); ctx.lineTo(-12, 2); ctx.quadraticCurveTo(0, 6, 12, 2); ctx.lineTo(13, -10); ctx.closePath(); ctx.fill();
                    ctx.restore();
                    if (player.isSailOpen && player.isReefed) {
                        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, buttonRadius - 3, 0, Math.PI * 2); ctx.stroke();
                    }
                    ctx.restore();
                    if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) this._drawHoverLabel(ctx, "Reef Sails", centerX + xOffset, rowY + buttonRadius + 2);
                }
                else if (index === 3) { // Crow's Nest
                    ctx.save();
                    ctx.translate(centerX + xOffset, rowY);
                    ctx.fillStyle = 'white'; ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    ctx.save(); ctx.scale(0.5, 0.5);
                    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 14); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(-9, -12); ctx.lineTo(9, -12); ctx.lineTo(6, 0); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
                    ctx.restore();
                    ctx.restore();
                    if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) this._drawHoverLabel(ctx, "Crow's Nest", centerX + xOffset, rowY + buttonRadius + 2);
                }
                else if (index === 4) { // Anchor
                    ctx.save();
                    ctx.translate(centerX + xOffset, rowY);
                    ctx.fillStyle = 'white'; ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    if (typeof ANCHOR_ICON_DATA !== 'undefined') {
                        ctx.save();
                        const scale = (buttonRadius * 1.2) / Math.max(ANCHOR_ICON_DATA.originalWidth, ANCHOR_ICON_DATA.originalHeight);
                        ctx.scale(scale, scale);
                        ctx.beginPath();
                        ANCHOR_ICON_DATA.points.forEach((p, i) => { i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
                        ctx.closePath(); ctx.fill(); ctx.restore();
                    }
                    if (player.isAnchored) {
                        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, buttonRadius - 3, 0, Math.PI * 2); ctx.stroke();
                    }
                    ctx.restore();
                    if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) this._drawHoverLabel(ctx, "Anchor", centerX + xOffset, rowY + buttonRadius + 2);
                }
                else if (index === 5) { // Lights
                    ctx.save();
                    ctx.translate(centerX + xOffset, rowY);
                    ctx.fillStyle = 'white'; ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
                    
                    ctx.save();
                    ctx.scale(0.5, 0.5); // Scale down for icon drawing

                    // Base
                    ctx.fillRect(-8, 9, 16, 3);

                    // Body (Frame)
                    ctx.beginPath();
                    ctx.moveTo(-7, 9); ctx.lineTo(-5, -7); ctx.lineTo(5, -7); ctx.lineTo(7, 9);
                    ctx.stroke();

                    // Top
                    ctx.fillRect(-7, -10, 14, 3);

                    // Handle
                    ctx.beginPath();
                    ctx.arc(0, -10, 6, Math.PI, 2 * Math.PI);
                    ctx.stroke();

                    ctx.restore(); // Restore from scale

                    if (player.lightsOn) {
                        ctx.fillStyle = '#FFD700'; // Gold/Yellow flame
                        ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(-3, 0, 0, -4); ctx.quadraticCurveTo(3, 0, 0, 4); ctx.closePath(); ctx.fill();
                        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, buttonRadius - 3, 0, Math.PI * 2); ctx.stroke();
                    }

                    ctx.restore();
                    if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) this._drawHoverLabel(ctx, "Toggle Lights", centerX + xOffset, rowY + buttonRadius + 2);
                }
                else if (index === 6) { // --- NEW: Spyglass ---
                    ctx.save();
                    ctx.translate(centerX + xOffset, rowY);
                    
                    // Rotate to point diagonal up-right
                    ctx.rotate(-Math.PI / 4);
                    
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'; // Dark lines to separate segments
                    ctx.lineWidth = 1.5;
                    ctx.fillStyle = 'white'; // White body

                    const totalLen = buttonRadius * 1.3;
                    const segLen = totalLen / 3;
                    // Start from left (Eyepiece)
                    const startX = -totalLen / 2;
                    
                    // 1. Eyepiece (Smallest)
                    const w1 = buttonRadius * 0.3;
                    ctx.beginPath();
                    ctx.rect(startX, -w1/2, segLen, w1);
                    ctx.fill();
                    ctx.stroke();
                    
                    // 2. Middle
                    const w2 = buttonRadius * 0.45;
                    ctx.beginPath();
                    ctx.rect(startX + segLen, -w2/2, segLen, w2);
                    ctx.fill();
                    ctx.stroke();
                    
                    // 3. Objective (Largest)
                    const w3 = buttonRadius * 0.6;
                    ctx.beginPath();
                    ctx.rect(startX + segLen * 2, -w3/2, segLen, w3);
                    ctx.fill();
                    ctx.stroke();
                    
                    // Lens Detail (Curve)
                    ctx.beginPath();
                    ctx.moveTo(startX + segLen * 3, -w3/2);
                    ctx.quadraticCurveTo(startX + segLen * 3 + (segLen * 0.3), 0, startX + segLen * 3, w3/2);
                    ctx.stroke();
                    
                    ctx.restore();
                    if (Math.hypot(mouseX - (centerX + xOffset), mouseY - rowY) <= buttonRadius) this._drawHoverLabel(ctx, "Spyglass", centerX + xOffset, rowY + buttonRadius + 2);
                }
            });

            // Draw Back Button (Same as combat)
            ctx.save();
            ctx.translate(centerX, combatBackY);
            ctx.beginPath();
            const triW = 12; const triH = 6;
            ctx.moveTo(-triW/2, -triH/2); ctx.lineTo(triW/2, -triH/2); ctx.lineTo(0, triH/2); ctx.closePath();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fill();
            ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.stroke();
            ctx.restore();

            if (Math.hypot(mouseX - centerX, mouseY - combatBackY) <= buttonRadius) {
                this._drawHoverLabel(ctx, "Back", centerX, combatBackY + buttonRadius + 2);
            }
        }
    }

    // --- Helpers for Hud Controls ---

    _drawArrow(ctx, x, y, size, angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, -size / 2);
        ctx.lineTo(size / 2, size / 2);
        ctx.lineTo(-size / 2, size / 2);
        ctx.closePath();
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.restore();
    }

    _drawHudButtonBackground(ctx, x, y, radius, isPressed = false) {
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = isPressed ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.5)';
        ctx.fill();
        ctx.strokeStyle = isPressed ? '#bbbbbb' : 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    _drawHudCannonBarrel(ctx, buttonRadius) {
        const L = buttonRadius * 1.4;
        const W = L * 0.25;
        const knobR = W * 0.25;
        const neckL = knobR;
        const breechL = L * 0.25;
        const chaseL = L * 0.55;
        const swellL = L * 0.08;
        const faceL = L * 0.02;
        
        const totalLen = knobR + neckL + breechL + chaseL + swellL + faceL;
        const startX = -totalLen / 2;
        
        ctx.fillStyle = 'white';
        const knobX = startX + knobR;
        ctx.beginPath(); ctx.arc(knobX, 0, knobR, 0, Math.PI * 2); ctx.fill();
        const neckX = knobX;
        ctx.beginPath(); ctx.rect(neckX, -knobR, neckL, knobR * 2); ctx.fill();
        const breechX = neckX + neckL;
        ctx.beginPath(); ctx.moveTo(breechX, -W/2); ctx.lineTo(breechX + breechL, -W/2); ctx.lineTo(breechX + breechL, W/2); ctx.lineTo(breechX, W/2); ctx.quadraticCurveTo(breechX - breechL * 0.2, 0, breechX, -W/2); ctx.fill();
        const chaseX = breechX + breechL;
        const chaseEndW = W * 0.7;
        ctx.beginPath(); ctx.moveTo(chaseX, -W/2); ctx.lineTo(chaseX + chaseL, -chaseEndW/2); ctx.lineTo(chaseX + chaseL, chaseEndW/2); ctx.lineTo(chaseX, W/2); ctx.fill();
        ctx.beginPath(); ctx.arc(chaseX + chaseL * 0.1, 0, W * 0.15, 0, Math.PI * 2); ctx.fill();
        const swellX = chaseX + chaseL;
        const swellW = W * 0.9;
        ctx.beginPath(); ctx.moveTo(swellX, -chaseEndW/2); ctx.lineTo(swellX + swellL, -swellW/2); ctx.lineTo(swellX + swellL, swellW/2); ctx.lineTo(swellX, chaseEndW/2); ctx.fill();
        const faceX = swellX + swellL;
        const faceW = W * 0.8;
        ctx.beginPath(); ctx.rect(faceX, -faceW/2, faceL, faceW); ctx.fill();
    }

    _drawHoverLabel(ctx, text, x, y) {
        ctx.save();
        ctx.fillStyle = '#ecf0f1';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    _drawSvgPath(ctx, pathData, fillStyle, strokeStyle, lineWidth) {
        if (!pathData) return;
        const items = Array.isArray(pathData) ? pathData : (pathData.commands || pathData.points || []);
        if (!Array.isArray(items) || items.length === 0) return;

        ctx.beginPath();
        if (items[0].x !== undefined) {
            ctx.moveTo(items[0].x, items[0].y);
            for (let i = 1; i < items.length; i++) {
                ctx.lineTo(items[i].x, items[i].y);
            }
            ctx.closePath();
        } else {
            for (const cmd of items) {
                switch (cmd.type) {
                    case 'M': ctx.moveTo(cmd.values[0], cmd.values[1]); break;
                    case 'L': ctx.lineTo(cmd.values[0], cmd.values[1]); break;
                    case 'C': ctx.bezierCurveTo(cmd.values[0], cmd.values[1], cmd.values[2], cmd.values[3], cmd.values[4], cmd.values[5]); break;
                    case 'Q': ctx.quadraticCurveTo(cmd.values[0], cmd.values[1], cmd.values[2], cmd.values[3]); break;
                    case 'Z': ctx.closePath(); break;
                }
            }
        }
        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.fill('evenodd');
        }
        if (strokeStyle) {
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = lineWidth || 1;
            ctx.stroke();
        }
    }

    _drawDayNightDial(ctx, canvas, dayNightTimer) {
        const dialSize = 60;
        const margin = 20;
        const windDialY = canvas.height - dialSize - margin;
        const dialY = windDialY - dialSize - 25;
        const dialX = canvas.width - dialSize - margin;
        const dialRadius = dialSize / 2;
        const dialCenterX = dialX + dialRadius;
        const dialCenterY = dialY + dialRadius;

        ctx.save();
        ctx.translate(dialCenterX, dialCenterY);

        ctx.beginPath();
        ctx.arc(0, 0, dialRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(52, 73, 94, 0.8)';
        ctx.fill();
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 3;
        ctx.stroke();

        const iconYOffset = dialRadius * 0.55;
        const sunRadius = dialRadius * 0.2; // Reduced size (80%)
        
        ctx.save();
        ctx.translate(0, -iconYOffset);

        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(0, 0, sunRadius, 0, Math.PI * 2);
        ctx.fill();

        // --- NEW: Draw Tapered S-Curve Rays ---
        // Instead of stroking a line, we fill a shape defined by two offset curves.
        ctx.beginPath();
        
        const numRays = 8;
        const startR = sunRadius * 1.3;
        const endR = sunRadius * 2.1; // Slightly extended for S-curve visual length
        const rayLen = endR - startR;
        const curveAmp = rayLen * 0.5; // Amount of curvature for the 'S'
        const halfBaseW = sunRadius * 0.25; // Half-width at the base of the ray

        for (let i = 0; i < numRays; i++) {
            const angle = (i / numRays) * Math.PI * 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            
            // Tangent vector (perpendicular to radius)
            const tCos = -sin;
            const tSin = cos;

            // Base Center & Tip
            const sx = cos * startR;
            const sy = sin * startR;
            const ex = cos * endR;
            const ey = sin * endR;

            // Base Corners (Start Width)
            const bx1 = sx + tCos * halfBaseW;
            const by1 = sy + tSin * halfBaseW;
            const bx2 = sx - tCos * halfBaseW;
            const by2 = sy - tSin * halfBaseW;

            // Control Point Distances
            const d1 = startR + rayLen * 0.33;
            const d2 = startR + rayLen * 0.66;

            // Taper widths at control points (Linear taper approximation)
            const w1 = halfBaseW * 0.66;
            const w2 = halfBaseW * 0.33;

            // CP1 (Shifted +curveAmp)
            // Left edge: shift = curveAmp + w1
            const cp1xL = (cos * d1) + (tCos * (curveAmp + w1));
            const cp1yL = (sin * d1) + (tSin * (curveAmp + w1));
            // Right edge: shift = curveAmp - w1
            const cp1xR = (cos * d1) + (tCos * (curveAmp - w1));
            const cp1yR = (sin * d1) + (tSin * (curveAmp - w1));

            // CP2 (Shifted -curveAmp)
            // Left edge: shift = -curveAmp + w2
            const cp2xL = (cos * d2) + (tCos * (-curveAmp + w2));
            const cp2yL = (sin * d2) + (tSin * (-curveAmp + w2));
            // Right edge: shift = -curveAmp - w2
            const cp2xR = (cos * d2) + (tCos * (-curveAmp - w2));
            const cp2yR = (sin * d2) + (tSin * (-curveAmp - w2));

            // Draw Closed Shape
            ctx.moveTo(bx1, by1); // Start at Base Left
            ctx.bezierCurveTo(cp1xL, cp1yL, cp2xL, cp2yL, ex, ey); // Curve to Tip
            ctx.bezierCurveTo(cp2xR, cp2yR, cp1xR, cp1yR, bx2, by2); // Curve back to Base Right
            ctx.closePath();
        }
        ctx.fill();
        ctx.restore();

        const moonRadius = dialRadius * 0.24; // Reduced size (80%)
        ctx.fillStyle = '#ecf0f1';
        ctx.save();
        ctx.beginPath();
        ctx.rect(-dialRadius, 0, dialRadius * 2, dialRadius);
        ctx.clip();
        ctx.beginPath();
        ctx.arc(0, iconYOffset, moonRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(moonRadius * 0.5, iconYOffset - moonRadius * 0.1, moonRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const cycleProgress = dayNightTimer / DAY_NIGHT_CYCLE_DURATION;
        const arrowAngle = cycleProgress * Math.PI * 2 + Math.PI;
        ctx.rotate(arrowAngle);

        ctx.beginPath();
        const arrowTipX = dialRadius * 0.85;
        const arrowBaseWidth = dialRadius * 0.25;
        const arrowBaseOffset = dialRadius * 0.3;
        ctx.moveTo(arrowTipX, 0);
        ctx.lineTo(arrowBaseOffset, arrowBaseWidth / 2);
        ctx.lineTo(arrowBaseOffset, -arrowBaseWidth / 2);
        ctx.closePath();
        ctx.fillStyle = '#e74c3c';
        ctx.fill();
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, dialRadius * 0.08, 0, Math.PI * 2);
        ctx.fillStyle = '#c0392b';
        ctx.fill();

        ctx.restore();
    }

    _drawDayNightDebugButton(ctx, canvas) {
        const dialSize = 60;
        const margin = 20;
        const windDialY = canvas.height - dialSize - margin;
        const dialY = windDialY - dialSize - 25;
        const dialX = canvas.width - dialSize - margin;
        const btnW = 40;
        const btnH = 15;
        const btnX = dialX + (dialSize - btnW) / 2;
        const btnY = dialY - btnH - 5;

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.strokeStyle = '#ecf0f1';
        ctx.lineWidth = 1;
        ctx.strokeRect(btnX, btnY, btnW, btnH);
        ctx.fillStyle = '#ecf0f1';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TIME', btnX + btnW / 2, btnY + btnH / 2);
        ctx.restore();
    }
}