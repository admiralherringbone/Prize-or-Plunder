const PlunderGame = (function() {
    // --- Canvas & Context ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d'); // Get the 2D rendering context

    // --- Game State Variables ---
    let player;
    // --- NEW: WorldManager now handles all world objects ---
    let worldManager;
    let fleetManager; // --- NEW: Fleet Manager ---
    // These arrays will now be populated each frame with only ACTIVE objects.
    let activeNpcs = [];
    let activeIslands = [];
    let activeRocks = [];
    let activeShoals = [];
    let activeCoralReefs = [];
    let allShips = []; // --- OPTIMIZATION: Unified array to reduce GC pressure ---

    let cannonballs = [];
    let volleys = []; // New: Array to track active Volley threat objects
    let splashes = []; // New: Array to track active water splashes
    // --- NEW: Cannon Effects ---
    let cannonEffects = [];
    const cannonFireParticlePool = [];
    const cannonSmokeParticlePool = [];
    const splashPool = []; // --- OPTIMIZATION: Pool for splash objects ---
    const damageEffectPool = []; // --- OPTIMIZATION: Pool for damage effect objects ---

    let damageEffects = []; // New: Array to track active damage explosions
    let wavelets = []; // New: Array to track active ocean wavelets
    const waveletPool = []; // --- OPTIMIZATION: Pool for wavelet objects ---
    let cameraX = 0;
    let cameraY = 0;

    let shorelineRenderer = null; // --- NEW: Shoreline Renderer ---
    // --- OPTIMIZATION: Shared arrays for wavelet rendering to avoid GC ---
    const WAVELET_MAX_POINTS = 256; // Sufficient for max width 300 / 2 = 150 points
    const waveletTopX = new Float32Array(WAVELET_MAX_POINTS);
    const waveletTopY = new Float32Array(WAVELET_MAX_POINTS);
    const waveletBottomX = new Float32Array(WAVELET_MAX_POINTS);
    const waveletBottomY = new Float32Array(WAVELET_MAX_POINTS);

    let screenMouseX = 0; // New: Track screen-space mouse X for UI hover
    let screenMouseY = 0; // New: Track screen-space mouse Y for UI hover
    let keys = {};
    let spatialGrid, pathfinder;
    let worldToScreenScale = 1.0; // Renamed from zoomLevel for clarity
    let windDirection = 0;
    let lastWindChangeTime = 0;
    let currentZoomMultiplier = 1.0; // New: Dynamic zoom multiplier for events like boarding
    let lastNpcPathCheckTime = 0; // Timer for the new failsafe check.
    let isMapExpanded = false;
    let mapAnimationProgress = 0; // 0.0 (Closed) to 1.0 (Open)
    let isGameActive = false; // New flag to control input before game starts.
    let cachedShallowWaterColor = null; // Optimization: Cache the shallow water color
    let hudMode = 'main'; // 'main', 'combat', or 'navigation'
    let hudButtonClickTimes = new Array(10).fill(0); // Generic click times for visual feedback
    let crowsNestActive = false; // New: Track if Crow's Nest button is held

    // --- NEW: Pirate Hunter State ---
    let pirateHunter = null;
    let pirateHunterRespawnTimer = 0;

    // --- OPTIMIZATION: Object Pooling for Night Overlay ---
    // These pools prevent creating hundreds of small objects every frame during nighttime rendering,
    // which reduces garbage collector pressure and leads to smoother performance.
    let lightData = [];
    const lightDataPool = [];
    const pointPool = [];

    function getPointObject(x, y) {
        if (pointPool.length > 0) {
            const p = pointPool.pop(); p.x = x; p.y = y; return p;
        }
        return { x, y };
    }

    // --- NEW: Pirate Hunter Squadron State (Rank 4+) ---
    let activeSquadronCount = 0;
    let squadronRespawnTimer = 0;

    // --- NEW: Pirate Hunter Fleet State (Rank 5+) ---
    let activeFleetCount = 0;
    let fleetRespawnTimer = 0;

    // --- NEW: Off-screen canvas for pre-rendering the static minimap ---
    let minimapCacheCanvas = null;
    let gameLoopId = null; // --- NEW: Track the game loop ID to prevent stacking ---

    // --- NEW: Boarding State ---
    let boardingState = {
        isActive: false,
        isInventoryOpen: false, // New: Flag for when the inventory menu is open
        target: null,
        jointPoint: null, // The world point where ships are locked
        tension: 0,
        crewProjectiles: [], // { x, y, vx, vy, owner, target }
        // Slingshot Input State
        isAiming: false,
        aimStart: null, // {x, y} relative to screen or world? World is better.
        aimStartLocal: null, // New: {x, y} relative to the player ship's center and rotation.
        aimCurrent: null,
        // --- NEW: NPC Boarding AI State ---
        npcState: 'IDLE', // 'IDLE', 'CHARGING', 'COOLDOWN'
        npcTimer: 0,
        npcChargeStartLocal: null // {x, y} relative to NPC ship center
    };
    let inventoryTarget = null; // New: Track the ship whose inventory is open

    let maxObstacleProximityRadius = 0; // Cached value for the largest anchor zone buffer

    // --- NEW: Game Over State ---
    let gameOverState = {
        active: false,
        reason: '', // 'Sunk' or 'Captured'
        timer: 0,
        duration: 3000, // 3 seconds to fade to B&W
        canRestart: false,
        lastFilterString: '', // --- OPTIMIZATION: Cache to avoid DOM thrashing ---
        lastOpacity: -1       // --- OPTIMIZATION: Cache to avoid DOM thrashing ---
    };

    // --- NEW: Day/Night Cycle State ---
    let dayNightTimer = 0; // 0 to DAY_NIGHT_CYCLE_DURATION
    let previousDayNightTimer = 0; // To detect day wrap
    let ambientLightLevel = 1.0; // 1.0 = Day, 0.0 = Night (clamped later)
    let cachedLightSprite = null;
    let cachedColoredLightSprite = null;
    let sharedDarknessCanvas = null;

    let gameOverOverlay = null; // --- NEW: Reference to HTML Overlay ---

    // --- Performance Profiling ---
    const ENABLE_PERFORMANCE_LOGGING = true; // Set to true to see live logs
    const perfMetrics = {};
    let perfFrameCount = 0;
    let perfLastLogTime = 0;

    // --- Game Logic & Initialization Functions ---

    /**
     * --- NEW: Initializes the Game Over HTML Overlay ---
     * Creates the DOM elements once so we can toggle them later.
     */
    function _initGameOverUI() {
        if (document.getElementById('game-over-overlay')) return;

        // --- NEW: Inject CSS for Pulse Animation ---
        const style = document.createElement('style');
        style.innerHTML = `
            @keyframes gameOverPulse {
                0% { opacity: 0.3; }
                30% { opacity: 1; }
                70% { opacity: 1; }
                100% { opacity: 0.3; }
            }
            .game-over-pulse {
                animation: gameOverPulse 2s infinite ease-in-out;
                will-change: opacity;
            }
        `;
        document.head.appendChild(style);

        const div = document.createElement('div');
        div.id = 'game-over-overlay';
        Object.assign(div.style, {
            position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
            display: 'none', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: '3000', pointerEvents: 'auto', cursor: 'pointer',
            transition: 'opacity 0.1s' // Smooth fade
        });

        div.innerHTML = `
            <img id="game-over-skull" src="${SKULL_ICON_SVG_URL}" style="width: 160px; height: 155px; margin-bottom: 20px; filter: invert(1) drop-shadow(0 0 10px black);">
            <div id="game-over-title" style="font-family: 'IM Fell English', serif; font-size: 80px; font-weight: bold; color: white; text-shadow: 0 0 10px black;">GAME OVER</div>
            <div id="game-over-subtitle" style="font-family: 'IM Fell English', serif; font-size: 30px; font-style: italic; color: white; text-shadow: 0 0 10px black;">Your voyage has ended.</div>
            <div id="game-over-prompt" style="font-family: 'IM Fell English', serif; font-size: 24px; color: white; margin-top: 60px; opacity: 0;">- Click to Return to Menu -</div>
        `;

        document.body.appendChild(div);
        gameOverOverlay = div;

        // Handle Restart Click
        div.addEventListener('click', () => {
            if (gameOverState.canRestart) {
                resetGame();
            }
        });
    }

    /**
     * Resizes the canvas to fit the window, with some constraints.
     */
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const shorterDimension = Math.min(canvas.width, canvas.height);
        
        if (player) {
            // In-game: Scale based on player ship size relative to viewport
            const desiredShipPixelSize = shorterDimension / SHIP_VIEWPORT_SCALE_FACTOR;
            worldToScreenScale = desiredShipPixelSize / player.shipLength;
        } else {
            // Start Menu: Set a fixed view extent in game units.
            // This decouples the start menu zoom from the ship size constants.
            // Higher value = Zoomed Out (more world visible).
            // For reference: A standard ship is 50 units long. 1500 shows ~30 ship lengths.
            const START_MENU_VIEW_EXTENT = 1500; 
            worldToScreenScale = shorterDimension / START_MENU_VIEW_EXTENT;
        }
    }

    // --- NEW: Cannon Effect Particle Pooling ---
    function getCannonFireParticle() {
        if (cannonFireParticlePool.length > 0) return cannonFireParticlePool.pop();
        return {};
    }
    function releaseCannonFireParticle(p) {
        cannonFireParticlePool.push(p);
    }
    function getCannonSmokeParticle() {
        if (cannonSmokeParticlePool.length > 0) return cannonSmokeParticlePool.pop();
        return {};
    }
    function releaseCannonSmokeParticle(p) {
        cannonSmokeParticlePool.push(p);
    }

    // --- NEW: Lighting Helpers ---
    function getLightSprite() {
        if (!cachedLightSprite) {
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
            cachedLightSprite = c;
        }
        return cachedLightSprite;
    }

    function getColoredLightSprite() {
        if (!cachedColoredLightSprite) {
            const size = 128;
            const c = document.createElement('canvas');
            c.width = size; c.height = size;
            const ctx = c.getContext('2d');
            const cx = size / 2, cy = size / 2, r = size / 2;
            const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            // LIGHT_COLOR is #ffaa00. RGB: 255, 170, 0
            g.addColorStop(0, 'rgba(255, 170, 0, 1)');
            g.addColorStop(0.5, 'rgba(255, 170, 0, 0.5)');
            g.addColorStop(1, 'rgba(255, 170, 0, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, size, size);
            cachedColoredLightSprite = c;
        }
        return cachedColoredLightSprite;
    }

    function getDarknessMaskCanvas(w, h) {
        if (!sharedDarknessCanvas) {
            sharedDarknessCanvas = document.createElement('canvas');
        }
        if (sharedDarknessCanvas.width !== w || sharedDarknessCanvas.height !== h) {
            sharedDarknessCanvas.width = w;
            sharedDarknessCanvas.height = h;
        }
        return sharedDarknessCanvas;
    }

    function getLightDataObject() {
        if (lightDataPool.length > 0) {
            const obj = lightDataPool.pop();
            // The points array is already cleared by releaseLightDataObjects
            return obj;
        }
        return { radius: 0, points: [] };
    }

    function releaseLightDataObjects() {
        while (lightData.length > 0) {
            const obj = lightData.pop();
            // Release the inner point objects back to their pool
            while (obj.points.length > 0) {
                pointPool.push(obj.points.pop());
            }
            lightDataPool.push(obj);
        }
    }

    function drawNightOverlay(ctx, effectiveScale) {
        // Optimization: Skip if fully bright
        if (ambientLightLevel >= 0.99) return;

        const width = canvas.width;
        const height = canvas.height;
        const maskCanvas = getDarknessMaskCanvas(width, height);
        const maskCtx = maskCanvas.getContext('2d');

        // --- OPTIMIZATION: Release pooled light data from previous frame ---
        // This clears the lightData array and returns all its objects to the pool.
        releaseLightDataObjects();
        
        // Use allShips to avoid allocating a new array via spread/filter
        for (const ship of allShips) {
            if (!ship || ship.isSunk) continue;

            // --- NEW: Check if lights are toggled on for this ship ---
            // NPCs (and default) have lights on. Player can toggle them.
            if (ship.lightsOn === false) { // Explicitly check for false
                continue;
            }

            // Sinking light flicker logic
            if (ship.isSinking) {
                const sinkProgress = ship.sinkHp / ship.maxSinkHp;
                if (sinkProgress > 0.25) continue; 
                const chance = 1.0 - (sinkProgress / 0.25);
                if (Math.random() >= chance) continue;
            }

            const flicker = 0.95 + Math.random() * 0.1;
            const radius = (ship.shipLength) * flicker;
            const screenRadius = radius * effectiveScale;

            // --- OPTIMIZATION: Get a pooled light data object ---
            const lightObj = getLightDataObject();
            lightObj.radius = screenRadius;

            const bow = ship.getBowPointWorldCoords();
            const stern = ship.getSternPointWorldCoords();
            const midX = ship.x;
            const midY = ship.y;
            
            // Helper to transform and cull
            const addPoint = (wx, wy) => {
                const sx = (wx - cameraX) * effectiveScale;
                const sy = (wy - cameraY) * effectiveScale;
                // Viewport culling
                if (sx >= -screenRadius && sx <= width + screenRadius &&
                    sy >= -screenRadius && sy <= height + screenRadius) {
                    // --- OPTIMIZATION: Use pooled point objects ---
                    lightObj.points.push(getPointObject(sx, sy));
                }
            };

            addPoint(bow.x, bow.y);
            addPoint(midX, midY);
            addPoint(stern.x, stern.y);

            if (lightObj.points.length > 0) {
                lightData.push(lightObj);
            } else {
                // If no points were added (ship was culled), release the object immediately
                // so it doesn't take up space in the lightData array.
                lightDataPool.push(lightObj);
            }
        }

        // --- NEW: Add Cannon Flashes to Light Data ---
        // Iterate through active cannon effects to add muzzle flashes
        for (const effect of cannonEffects) {
            if (effect.type === 'fire') {
                const progress = effect.life / effect.maxLife;
                const intensity = 1.0 - progress;
                
                if (intensity > 0.05) {
                    // Flash radius: Large enough to light up the deck/water (120 units base)
                    const baseRadius = 120 * (effect.size || 1.0); 
                    const radius = baseRadius * intensity * effectiveScale;
                    
                    const sx = (effect.x - cameraX) * effectiveScale;
                    const sy = (effect.y - cameraY) * effectiveScale;

                    // Viewport culling
                    if (sx >= -radius && sx <= width + radius && 
                        sy >= -radius && sy <= height + radius) {
                        const lightObj = getLightDataObject();
                        lightObj.radius = radius;
                        lightObj.points.push(getPointObject(sx, sy));
                        lightData.push(lightObj);
                    }
                }
            }
        }

        // --- NEW: Add Explosion Flashes ---
        for (const effect of damageEffects) {
            const progress = effect.life / effect.maxLife;
            const intensity = 1.0 - progress;
            if (intensity > 0.05) {
                const radius = (effect.maxRadius * 3.0) * intensity * effectiveScale;
                const sx = (effect.x - cameraX) * effectiveScale;
                const sy = (effect.y - cameraY) * effectiveScale;
                if (sx >= -radius && sx <= width + radius &&
                    sy >= -radius && sy <= height + radius) {
                    const lightObj = getLightDataObject();
                    lightObj.radius = radius;
                    lightObj.points.push(getPointObject(sx, sy));
                    lightData.push(lightObj);
                }
            }
        }

        // 1. Clear and Fill Darkness
        // Optimization: Use 'copy' to clear and fill in one operation, avoiding clearRect
        maskCtx.save();
        maskCtx.globalCompositeOperation = 'copy'; 
        const opacity = 1.0 - ambientLightLevel;
        maskCtx.fillStyle = NIGHT_AMBIENT_COLOR;
        maskCtx.globalAlpha = opacity;
        maskCtx.fillRect(0, 0, width, height);
        maskCtx.restore();

        // 2. Cut out lights (Destination-Out)
        maskCtx.save();
        maskCtx.globalCompositeOperation = 'destination-out';
        maskCtx.globalAlpha = 1.0;

        const lightSprite = getLightSprite();
        
        for (const item of lightData) {
            const size = item.radius * 2;
            for (const p of item.points) {
                maskCtx.drawImage(lightSprite, p.x - item.radius, p.y - item.radius, size, size);
            }
        }
        maskCtx.restore();

        // 3. Draw Mask to Main Context
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to screen space
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(maskCanvas, 0, 0);

        // 4. Draw Colored Glow (Additive)
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = opacity * 0.2; // Fade glow with daylight
        const coloredSprite = getColoredLightSprite();
        
        for (const item of lightData) {
            const size = item.radius * 2;
            for (const p of item.points) {
                ctx.drawImage(coloredSprite, p.x - item.radius, p.y - item.radius, size, size);
            }
        }

        ctx.restore();
    }

    // --- NEW: Cannon Effect Creation ---
    // This will be exposed on the public interface.
    /**
     * Toggles the anchor state of the player ship.
     */
    function toggleAnchor() {
        if (!player) return;

        // The `player.isInAnchorRange` flag is now updated every frame in the main `update` loop.
        // We can simply use that flag here instead of re-calculating.
        if (player.isInAnchorRange && !player.isAnchored) {
            player.isAnchored = true;
            player.anchorPoint = player.getBowPointWorldCoords();
            player.lastDamageTime = performance.now();
        } else if (player.isAnchored) {
            player.isAnchored = false;
            player.anchorPoint = null;
            player.lastDamageTime = performance.now();
        }
    }

    /**
     * Toggles the expanded map view.
     */
    function toggleExpandedMap() {
        isMapExpanded = !isMapExpanded;
    }

    /**
     * Toggles the ship inventory menu.
     */
    function toggleInventory() {
        if (boardingState.isInventoryOpen) {
            closeInventory();
            return;
        }

        // Check if we are currently engaged with a target (surrendered and close enough)
        let targetToOpen = inventoryTarget;
        
        // Fallback: If no inventoryTarget is tracked, but we are boarding a surrendered ship
        if (!targetToOpen && boardingState.isActive && boardingState.target && boardingState.target.aiState === 'surrendered') {
            targetToOpen = boardingState.target;
        }

        if (targetToOpen && targetToOpen.aiState === 'surrendered') {
             // Open dual view: Target (Left) + Player (Right)
             if (window.openInventoryMenu) {
                 window.openInventoryMenu(targetToOpen, player);
                 inventoryTarget = targetToOpen; // Ensure tracking
                 boardingState.isInventoryOpen = true;
             }
        } else {
             // Open single view: Player
             if (window.openInventoryMenu) {
                 window.openInventoryMenu(player);
                 boardingState.isInventoryOpen = true;
             }
        }
    }

    /**
     * Handles clicks on the canvas, specifically for the anchor UI.
     * @param {MouseEvent} event
     */
    function handleCanvasClick(event) {
        // Ignore all canvas clicks if the game hasn't started yet.
        if (!isGameActive) {
            return;
        }

        // --- NEW: Ignore clicks if rename dialog is open ---
        const renameDialog = document.getElementById('rename-dialog');
        if (renameDialog && renameDialog.style.display === 'flex') return;

        if (!player) return;

        const canvasRect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - canvasRect.left;
        const mouseY = event.clientY - canvasRect.top;

        // --- Map Toggling Logic (High Priority) ---
        // Check small map click
        const miniMapSize = 112.5;
        const margin = 20;
        const miniMapX = margin;
        const miniMapY = canvas.height - miniMapSize - margin;
        if (mouseX >= miniMapX && mouseX <= miniMapX + miniMapSize &&
            mouseY >= miniMapY && mouseY <= miniMapY + miniMapSize) {
            toggleExpandedMap();
            return; // Click was on the map, do nothing else.
        }

        // If map is expanded, check large map click
        if (isMapExpanded) {
            const largeMapSize = canvas.height * 0.75;
            const largeMapX = (canvas.width - largeMapSize) / 2;
            const largeMapY = (canvas.height - largeMapSize) / 2;
            if (mouseX >= largeMapX && mouseX <= largeMapX + largeMapSize &&
                mouseY >= largeMapY && mouseY <= largeMapY + largeMapSize) {
                toggleExpandedMap();
                return; // Click was on the map, do nothing else.
            }
        }

        // --- Anchor Toggle (Conditional) ---
        if (player.isAnchored || player.isInAnchorRange) {
            const barHeight = 25;
            const barWidth = canvas.width / 4;
            const barX = (canvas.width - barWidth) / 2;
            const barY = canvas.height - barHeight - 20;
            const indicatorDiameter = barHeight;
            const indicatorRadius = indicatorDiameter / 2;
            const indicatorX = barX - indicatorDiameter - 10;
            const indicatorCenterX = indicatorX + indicatorRadius;
            const indicatorCenterY = barY + indicatorRadius;

            if (distance({ x: mouseX, y: mouseY }, { x: indicatorCenterX, y: indicatorCenterY }) <= indicatorRadius + 5) {
                toggleAnchor();
            }
        }

        // --- DEBUG: Rank Switch Button Click ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && player) {
            // Replicate UI positioning logic to detect click
            const profileRadius = 30;
            const profileMargin = 20;
            const profileX = profileMargin + profileRadius;
            const profileY = profileMargin + profileRadius;
            const nameX = profileX + profileRadius + 15;

            ctx.save();
            ctx.font = "24px 'IM Fell English', serif";
            const nameWidth = ctx.measureText(player.name).width;

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
            ctx.font = "18px 'IM Fell English', serif";
            const fortuneWidth = ctx.measureText(fortuneText).width;

            // Replicate UI positioning logic to detect click (Updated for Right Alignment)
            const rankRadius = 25;
            const rankMargin = 20;
            const rankX = canvas.width - rankMargin - rankRadius;
            const rankY = profileY;
            const rankTextX = rankX - rankRadius - 10;

            const rankData = player.rankData;
            const rankName = rankData ? rankData.name : "Neutral";
            ctx.font = "24px 'IM Fell English', serif";
            const rankTextWidth = ctx.measureText(rankName).width;

            const debugBtnX = rankTextX - rankTextWidth - 20;
            const debugBtnY = rankY;
            const debugBtnRadius = 10;
            ctx.restore();

            if (distance({x: mouseX, y: mouseY}, {x: debugBtnX, y: debugBtnY}) <= debugBtnRadius) {
                if (window.RANKS) {
                    player.rankIndex = (player.rankIndex + 1) % window.RANKS.length;
                    console.log(`[Debug] Switched rank to: ${player.rankData.name}`);
                }
                return;
            }
        }

        // --- DEBUG: Day/Night Toggle ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
            const dialSize = 60;
            const margin = 20;
            const windDialY = canvas.height - dialSize - margin;
            const dialY = windDialY - dialSize - 10;
            const dialX = canvas.width - dialSize - margin;

            const btnW = 40;
            const btnH = 15;
            const btnX = dialX + (dialSize - btnW) / 2;
            const btnY = dialY - btnH - 5;

            if (mouseX >= btnX && mouseX <= btnX + btnW &&
                mouseY >= btnY && mouseY <= btnY + btnH) {
                
                const progress = dayNightTimer / DAY_NIGHT_CYCLE_DURATION;
                if (progress < 0.5) {
                    dayNightTimer = DAY_NIGHT_CYCLE_DURATION * 0.75; // Set to Midnight
                } else {
                    dayNightTimer = DAY_NIGHT_CYCLE_DURATION * 0.25; // Set to Noon
                }
                return;
            }
        }

        // --- NEW: Check for clicks on NPCs (Display Stats) ---
        const effectiveScale = worldToScreenScale * currentZoomMultiplier;
        const mouseXWorld = (event.clientX - canvasRect.left) / effectiveScale + cameraX;
        const mouseYWorld = (event.clientY - canvasRect.top) / effectiveScale + cameraY;

        activeNpcs.forEach(npc => {
            if (distance({x: mouseXWorld, y: mouseYWorld}, npc) < npc.shipLength / 2) {
                npc.displayTimer = 5000; // Show for 5 seconds
            }

            // --- NEW: Check for Debug Log Button Click ---
            if (DEBUG.ENABLED && npc.debugLogButtonBounds) {
                const btn = npc.debugLogButtonBounds;
                // Bounds are stored relative to ship center (local coords)
                const worldBtnX = npc.x + btn.x;
                const worldBtnY = npc.y + btn.y;
                
                if (mouseXWorld >= worldBtnX && mouseXWorld <= worldBtnX + btn.w &&
                    mouseYWorld >= worldBtnY && mouseYWorld <= worldBtnY + btn.h) {
                    npc.logDebugInfo();
                }
            }
        });

        // --- HUD Control Buttons ---
        const hpBarHeight = 10;
        const hpBarMargin = 20;
        const hullBarY = canvas.height - hpBarHeight - hpBarMargin;
        const rigBarHeight = 10;
        const rigBarY = hullBarY - rigBarHeight - 5;
        const crewBarHeight = 10;
        const crewBarY = rigBarY - crewBarHeight - 5;
        const reloadBarDiameter = CANNON_RING_BUFFER_BAR_SIZE;
        const reloadBarY = crewBarY - CANNON_RING_BUFFER_BAR_MARGIN_Y - reloadBarDiameter;
        
        const buttonDiameter = reloadBarDiameter;
        const buttonRadius = buttonDiameter / 2;
        const buttonY = reloadBarY + buttonRadius;
        const centerX = canvas.width / 2;
        const gap = 15;

        if (hudMode === 'main') {
            // Navigation Button (Left)
            const navButtonX = centerX - buttonDiameter - gap;
            if (distance({x: mouseX, y: mouseY}, {x: navButtonX, y: buttonY}) <= buttonRadius) {
                hudMode = 'navigation';
                return;
            }

            // Combat Button (Center)
            const combatButtonX = centerX;
            if (distance({x: mouseX, y: mouseY}, {x: combatButtonX, y: buttonY}) <= buttonRadius) {
                hudMode = 'combat';
                return;
            }

            // Inventory Button (Right)
            const inventoryButtonX = centerX + buttonDiameter + gap;
            if (distance({x: mouseX, y: mouseY}, {x: inventoryButtonX, y: buttonY}) <= buttonRadius) {
                toggleInventory();
                return;
            }
        } else if (hudMode === 'combat') {
            // Back Button (Center, at buttonY + 5 to match visual offset in ui.js)
            // Using a circular hit area for simplicity
            if (distance({x: mouseX, y: mouseY}, {x: centerX, y: buttonY + 5}) <= buttonRadius) {
                hudMode = 'main';
                return;
            }

            // Define rowY based on ui.js logic (combatBackY = buttonY + 5; rowY = combatBackY - 25)
            const rowY = buttonY - 20;

            // --- NEW: Shot Type Carousel Click Detection (Rotational) ---
            const carouselY = rowY - 60;
            const arrowOffset = 85;
            const arrowRadius = 20; // Hitbox
            const sideOffset = 50;
            const sideRadius = 20; // Hitbox

            const shotTypes = ['round-shot', 'chain-shot', 'grape-shot', 'canister-shot'];
            const currentIndex = shotTypes.indexOf(player.selectedShotType);

            // Left Arrow (Previous)
            if (distance({x: mouseX, y: mouseY}, {x: centerX - arrowOffset, y: carouselY}) <= arrowRadius) {
                const newIndex = (currentIndex - 1 + shotTypes.length) % shotTypes.length;
                player.selectedShotType = shotTypes[newIndex];
                player.lastShotTypeSelectionTime = performance.now();
                return;
            }
            // Right Arrow (Next)
            if (distance({x: mouseX, y: mouseY}, {x: centerX + arrowOffset, y: carouselY}) <= arrowRadius) {
                const newIndex = (currentIndex + 1) % shotTypes.length;
                player.selectedShotType = shotTypes[newIndex];
                player.lastShotTypeSelectionTime = performance.now();
                return;
            }
            // Left Item (Previous)
            if (distance({x: mouseX, y: mouseY}, {x: centerX - sideOffset, y: carouselY}) <= sideRadius) {
                const newIndex = (currentIndex - 1 + shotTypes.length) % shotTypes.length;
                player.selectedShotType = shotTypes[newIndex];
                player.lastShotTypeSelectionTime = performance.now();
                return;
            }
            // Right Item (Next)
            if (distance({x: mouseX, y: mouseY}, {x: centerX + sideOffset, y: carouselY}) <= sideRadius) {
                const newIndex = (currentIndex + 1) % shotTypes.length;
                player.selectedShotType = shotTypes[newIndex];
                player.lastShotTypeSelectionTime = performance.now();
                return;
            }

            // 6 Combat Buttons
            // Layout: 1 row of 6, centered above back button
            const spacing = buttonDiameter + gap;
            const xOffsets = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map(factor => factor * spacing);

            for (let i = 0; i < 6; i++) {
                if (distance({x: mouseX, y: mouseY}, {x: centerX + xOffsets[i], y: rowY}) <= buttonRadius) {
                    hudButtonClickTimes[i] = performance.now(); // Record click time
                    // --- NEW: Implement Combat Button Actions ---
                    if (i === 0) { // Fire All (Broadsides + Chasers)
                        player.fire('port', cannonballs, volleys);
                        player.fire('starboard', cannonballs, volleys);
                        player.fire('bow', cannonballs, volleys);
                        player.fire('stern', cannonballs, volleys);
                    } else if (i === 1) { // Fire Port
                        player.fire('port', cannonballs, volleys);
                    } else if (i === 2) { // Fire Starboard
                        player.fire('starboard', cannonballs, volleys);
                    } else if (i === 3) { // Fire Bow
                        player.fire('bow', cannonballs, volleys);
                    } else if (i === 4) { // Fire Stern
                        player.fire('stern', cannonballs, volleys);
                    }
                    return;
                }
            }
        } else if (hudMode === 'navigation') {
            // Back Button (Center, at buttonY + 5)
            if (distance({x: mouseX, y: mouseY}, {x: centerX, y: buttonY + 5}) <= buttonRadius) {
                hudMode = 'main';
                return;
            }

            const rowY = buttonY - 20;
            const spacing = buttonDiameter + gap;
            
            // 6 Buttons: Open, Close, Reef, Crow's Nest, Anchor, Lights
            const xOffsets = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map(factor => factor * spacing);

            for (let i = 0; i < 6; i++) {
                if (distance({x: mouseX, y: mouseY}, {x: centerX + xOffsets[i], y: rowY}) <= buttonRadius) {
                    hudButtonClickTimes[i] = performance.now();
                    
                    if (i === 0) { // Open Sails
                        if (player.isReefed) player.unReef();
                        player.isSailOpen = true;
                        player.isMovingBackward = false;
                        player.sailingForwardToggleOn = true;
                    } else if (i === 1) { // Close Sails
                        player.isSailOpen = false;
                        player.sailingForwardToggleOn = false;
                    } else if (i === 2) { // Reef Sails
                        player.toggleReef();
                    } else if (i === 3) { // Crow's Nest
                        // Action handled by MouseDown/Up for hold, but we record click for visual feedback
                    } else if (i === 4) { // Anchor
                        toggleAnchor();
                    } else if (i === 5) { // Lights Toggle
                        if (player) {
                            player.lightsOn = !player.lightsOn;
                        }
                    }
                    return;
                }
            }
        }
    }

    // --- NEW: Slingshot Input Handlers ---
    function handleMouseDown(e) {
        // --- NEW: Check for Crow's Nest Hold (Navigation Mode) ---
        if (hudMode === 'navigation' && player) {
             const canvasRect = canvas.getBoundingClientRect();
             const mouseX = e.clientX - canvasRect.left;
             const mouseY = e.clientY - canvasRect.top;
             
             // Re-calculate button position (must match handleCanvasClick logic)
             const hpBarHeight = 10;
             const hpBarMargin = 20;
             const hullBarY = canvas.height - hpBarHeight - hpBarMargin;
             const rigBarHeight = 10;
             const rigBarY = hullBarY - rigBarHeight - 5;
             const crewBarHeight = 10;
             const crewBarY = rigBarY - crewBarHeight - 5;
             const reloadBarDiameter = CANNON_RING_BUFFER_BAR_SIZE;
             const reloadBarY = crewBarY - CANNON_RING_BUFFER_BAR_MARGIN_Y - reloadBarDiameter;
             const buttonRadius = reloadBarDiameter / 2;
             const buttonY = reloadBarY + buttonRadius;
             const centerX = canvas.width / 2;
             const gap = 15;
             const rowY = buttonY - 20;
             const buttonDiameter = reloadBarDiameter; // Define buttonDiameter
             const spacing = buttonDiameter + gap;
             
             const crowsNestX = centerX + (1.2 * spacing);
             if (distance({x: mouseX, y: mouseY}, {x: crowsNestX, y: rowY}) <= buttonRadius) {
                 crowsNestActive = true;
             }
        }

        if (!boardingState.isActive || !player || boardingState.isInventoryOpen) return; // Disable crew launch during inventory access
        
        // Transform mouse to world coordinates
        const effectiveScale = worldToScreenScale * currentZoomMultiplier;
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / effectiveScale + cameraX;
        const mouseY = (e.clientY - rect.top) / effectiveScale + cameraY;

        // Check if click is on player ship
        const distToPlayer = distance({x: mouseX, y: mouseY}, player);
        if (distToPlayer < player.shipLength / 2) {
            boardingState.isAiming = true;
            boardingState.aimStart = { x: mouseX, y: mouseY };
            
            // --- NEW: Calculate and store local offset relative to ship ---
            const dx = mouseX - player.x;
            const dy = mouseY - player.y;
            // Rotate backwards by ship angle to get local coordinates
            boardingState.aimStartLocal = rotatePoint({x: dx, y: dy}, {x: 0, y: 0}, -player.angle);
            boardingState.aimCurrent = { x: mouseX, y: mouseY };
        }
    }

    function handleMouseMove(e) {
        // --- NEW: Always calculate mouse position for Hover Logic ---
        const effectiveScale = worldToScreenScale * currentZoomMultiplier;
        const rect = canvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / effectiveScale + cameraX;
        const mouseY = (e.clientY - rect.top) / effectiveScale + cameraY;

        // --- NEW: Update screen-space mouse coordinates for UI ---
        screenMouseX = e.clientX - rect.left;
        screenMouseY = e.clientY - rect.top;

        // Update NPC hover states
        activeNpcs.forEach(npc => {
            const dist = distance({x: mouseX, y: mouseY}, npc);
            const isOver = dist < npc.shipLength / 2;
            
            if (npc.isHovered && !isOver) {
                // Mouse just left the ship, start persistence timer
                npc.displayTimer = 5000;
            }
            npc.isHovered = isOver;
        });

        if (!boardingState.isActive || !boardingState.isAiming) return;
        
        boardingState.aimCurrent = { x: mouseX, y: mouseY };
    }

    function handleMouseUp(e) {
        crowsNestActive = false; // Reset zoom on release

        if (!boardingState.isActive || !boardingState.isAiming) return;
        
        // Launch Crew!
        launchCrewAttack();
        
        boardingState.isAiming = false;
        boardingState.aimStart = null;
        boardingState.aimStartLocal = null;
    }

    /**
     * Handles keydown events for player input.
     * @param {KeyboardEvent} e
     */
    function handleKeyDown(e) {
        // Only allow game-related key presses after the game has officially started.
        if (!isGameActive) return;

        // --- NEW: Disable controls if rename dialog is open or input is focused ---
        const renameDialog = document.getElementById('rename-dialog');
        if (renameDialog && renameDialog.style.display === 'flex') return;
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;

        keys[e.key] = true;

        // Handle passive forward sailing toggle for ArrowUp
        if (e.key === 'ArrowUp' && player) {
            // --- New: Un-reef sails if ArrowUp is pressed ---
            if (player.isReefed) {
                player.unReef();
            }

            if (player.isMovingBackward) { // If currently moving backward, ArrowUp stops it
                player.isMovingBackward = false;
                player.sailingForwardToggleOn = false; // Ensure toggle is off
            } else { // Otherwise, toggle passive forward sailing
                player.sailingForwardToggleOn = !player.sailingForwardToggleOn;
            }
        } else if (e.key === 'ArrowDown' && player) { // If ArrowDown is pressed, it takes precedence
            player.sailingForwardToggleOn = false; // Turn off passive forward sailing
            // --- New: Reefing Logic on Shift + ArrowDown ---
            if (e.shiftKey) {
                player.toggleReef();
            }
        }

        if (['q', 'Q'].includes(e.key)) {
            toggleAnchor();
        }

        if (e.key === 'm' || e.key === 'M') {
            toggleExpandedMap();
        }

        if (['e', 'E'].includes(e.key) && !e.repeat) {
            toggleInventory();
        }
    }

    /**
     * Handles keyup events for player input.
     * @param {KeyboardEvent} e
     */
    function handleKeyUp(e) {
        keys[e.key] = false;
    }

    /**
     * Generates the game world with islands, rocks, and NPCs.
     */
    function generateWorld() {
        // Reset game entities
        // --- NEW: Instantiate the WorldManager ---
        // The sector size should be larger than the player's view distance.
        const sectorSize = (Math.max(canvas.width, canvas.height) / worldToScreenScale) * 1.5;
        worldManager = new WorldManager(WORLD_WIDTH, WORLD_HEIGHT, sectorSize);

        cannonballs = [];
        volleys = []; // Reset volleys
        splashes = []; // Reset splashes
        damageEffects = []; // Reset damage effects
        player = null;

        // Initialize spatial grid
        spatialGrid = new SpatialGrid(GRID_SIZE, WORLD_WIDTH, WORLD_HEIGHT);

        // --- NEW: Calculate entity counts based on world area and density ---
        const worldAreaFactor = (WORLD_WIDTH * WORLD_HEIGHT) / (10000 * 10000);
        const numIslands = Math.round(ISLAND_DENSITY * worldAreaFactor);

        // --- NEW: Helper to calculate and attach Mid-Phase Bounding Volumes ---
        function attachBoundingVolume(obstacle) {
            const geometrySource = (obstacle.type === 'coralReef' && obstacle.rockBase) ? obstacle.rockBase : obstacle;
            const points = geometrySource.outerPerimeterPoints || geometrySource.points;
            
            if (!points) return;

            let maxDistSq = 0;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

            for (const p of points) {
                const dx = p.x - obstacle.x;
                const dy = p.y - obstacle.y;
                const dSq = dx*dx + dy*dy;
                if (dSq > maxDistSq) maxDistSq = dSq;

                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            }
            obstacle.boundingRadius = Math.sqrt(maxDistSq);
            obstacle.boundingRect = { minX, minY, maxX, maxY };

            // --- NEW: Generate Simplified Convex Hull ---
            // We calculate this once and store it for cheap collision checks later.
            obstacle.convexHull = getConvexHull(points);
        }

        // Generate Islands
        for (let i = 0; i < numIslands; i++) {
            let newIsland;
            let validPosition = false;
            let attempts = 0;
            const isSmallIsland = Math.random() < ISLAND_SMALL_CHANCE;
            const baseRadiusX = getRandomArbitrary(isSmallIsland ? ISLAND_SMALL_MIN_RADIUS : ISLAND_LARGE_MIN_RADIUS, isSmallIsland ? ISLAND_SMALL_MAX_RADIUS : ISLAND_LARGE_MAX_RADIUS);
            const baseRadiusY = getRandomArbitrary(isSmallIsland ? ISLAND_SMALL_MIN_RADIUS : ISLAND_LARGE_MIN_RADIUS, isSmallIsland ? ISLAND_SMALL_MAX_RADIUS : ISLAND_LARGE_MAX_RADIUS);
            const islandSides = Math.floor(getRandomArbitrary(20, isSmallIsland ? 41 : 161));
            const irregularityFactor = isSmallIsland ? 0.05 : 0.02;

            while (!validPosition && attempts < 100) {
                const safeMargin = Math.max(baseRadiusX, baseRadiusY);
                // --- FIX: Spawn only within the playable area (inside the buffer) ---
                const centerX = getRandomArbitrary(WORLD_BUFFER + safeMargin, WORLD_WIDTH - WORLD_BUFFER - safeMargin);
                const centerY = getRandomArbitrary(WORLD_BUFFER + safeMargin, WORLD_HEIGHT - WORLD_BUFFER - safeMargin);
                
                const islandPoints = generateIrregularPolygon(centerX, centerY, baseRadiusX, baseRadiusY, islandSides, irregularityFactor);
                ensureClockwiseWinding(islandPoints);
                newIsland = new Island(i, islandPoints, baseRadiusX, baseRadiusY, isSmallIsland);
                newIsland.color = ISLAND_COLOR;
                newIsland.strokeColor = darkenColor(ISLAND_COLOR, 10);

                // --- Define the anchoring zone for this island ---
                // This property is crucial for NPC destination calculations and player anchoring.
                // It's a buffer from the polygon's edge, making the total zone 1.5x the obstacle size.
                // The buffer distance is half the island's max radius.
                newIsland.proximityRadius = newIsland.maxDistanceToPerimeter * 0.5;

                validPosition = true;

                // --- FIX: Expand the query area to include the anchor zone ---
                // The default AABB is based on the physical island. We need to query a larger
                // area to find islands whose anchor zones might overlap, even if their
                // physical bodies do not.
                const totalAnchorRadius = newIsland.maxDistanceToPerimeter + newIsland.proximityRadius;
                const queryAABB = {
                    minX: newIsland.x - totalAnchorRadius,
                    minY: newIsland.y - totalAnchorRadius,
                    maxX: newIsland.x + totalAnchorRadius,
                    maxY: newIsland.y + totalAnchorRadius,
                };
                const potentialColliders = spatialGrid.query(queryAABB);

                for (const existingObstacle of potentialColliders) {
                    if (existingObstacle.type === 'island') {
                        // For island-on-island checks, use a simple and generous circular check
                        // based on their anchor zones to ensure ample space between them.
                        const newIslandAnchorRadius = newIsland.maxDistanceToPerimeter + newIsland.proximityRadius;
                        const existingIslandAnchorRadius = existingObstacle.maxDistanceToPerimeter + existingObstacle.proximityRadius;
                        const minSafeDistance = newIslandAnchorRadius + existingIslandAnchorRadius;
                        const distanceBetweenCenters = distance(newIsland, existingObstacle);

                        if (distanceBetweenCenters < minSafeDistance) {
                            validPosition = false;
                            break; // Overlaps an existing island's anchor zone, invalid position.
                        }
                    } else if (existingObstacle.type === 'rock') {
                        // For rocks, maintain the more precise physical collision check
                        // to allow them to spawn closer to islands without overlapping.
                        for (const newPart of newIsland.convexParts) {
                            // A rock is a single convex part.
                            if (checkPolygonCollision(newPart, existingObstacle.convexParts[0])) {
                                validPosition = false;
                                break;
                            }
                        }
                        if (!validPosition) break;
                    }
                }
                attempts++;
            }
            if (validPosition) {
                attachBoundingVolume(newIsland);
                _createShoreGlowCacheForObstacle(newIsland);
                worldManager.addStaticObject(newIsland);
                spatialGrid.insert(newIsland);
            }
        }

        // Generate Rocks
        const numRocks = Math.round(ROCK_DENSITY * worldAreaFactor);

        for (let i = 0; i < numRocks; i++) {
            let newRock;
            let validPosition = false;
            let attempts = 0;
            const baseRockRadius = getRandomArbitrary(ROCK_MIN_RADIUS, ROCK_MAX_RADIUS);

            while (!validPosition && attempts < 100) {
                const centerX = getRandomArbitrary(WORLD_BUFFER + baseRockRadius, WORLD_WIDTH - WORLD_BUFFER - baseRockRadius);
                const centerY = getRandomArbitrary(WORLD_BUFFER + baseRockRadius, WORLD_HEIGHT - WORLD_BUFFER - baseRockRadius);
                const rockIrregularPoints = generateIrregularPolygon(centerX, centerY, baseRockRadius * 0.8, baseRockRadius * 1.2, 6, 0.8);
                ensureClockwiseWinding(rockIrregularPoints);
                newRock = new Rock(rockIrregularPoints, baseRockRadius * 0.8, baseRockRadius * 1.2);
                newRock.color = ROCK_COLOR;
                newRock.strokeColor = darkenColor(ROCK_COLOR, 10);
                // It's a buffer from the polygon's edge, making the total zone 1.5x the obstacle size.
                // The buffer distance is half the rock's max radius.
                newRock.proximityRadius = newRock.maxDistanceToPerimeter * 0.5;

                validPosition = true;
                const potentialColliders = spatialGrid.query(newRock);
                for (const existingObstacle of potentialColliders) {
                    if (existingObstacle.type === 'island' || existingObstacle.type === 'rock') {
                        // Simplified check for brevity
                        if (checkPolygonCollision(newRock.convexParts[0], existingObstacle.convexParts[0])) {
                            validPosition = false;
                            break;
                        }
                    }
                }
                attempts++;
            }
            if (validPosition) {
                attachBoundingVolume(newRock);
                _createShoreGlowCacheForObstacle(newRock);
                worldManager.addStaticObject(newRock);
                spatialGrid.insert(newRock);
            }
        }

        // Generate Shoals
        const numShoals = Math.round(SHOAL_DENSITY * worldAreaFactor);

        for (let i = 0; i < numShoals; i++) {
            const baseRadiusX = getRandomArbitrary(SHOAL_REEF_MIN_RADIUS, SHOAL_REEF_MAX_RADIUS);
            const baseRadiusY = getRandomArbitrary(SHOAL_REEF_MIN_RADIUS, SHOAL_REEF_MAX_RADIUS);
            const safeMargin = Math.max(baseRadiusX, baseRadiusY);
            const centerX = getRandomArbitrary(WORLD_BUFFER + safeMargin, WORLD_WIDTH - WORLD_BUFFER - safeMargin);
            const centerY = getRandomArbitrary(WORLD_BUFFER + safeMargin, WORLD_HEIGHT - WORLD_BUFFER - safeMargin);
            const shoalIrregularPoints = generateIrregularPolygon(centerX, centerY, baseRadiusX, baseRadiusY, 20, 0.1);
            ensureClockwiseWinding(shoalIrregularPoints);
            const newShoal = new Shoal(shoalIrregularPoints, baseRadiusX, baseRadiusY);
            // It's a buffer from the polygon's edge, making the total zone 1.5x the obstacle size.
            // The buffer distance is half the shoal's max radius.
            newShoal.proximityRadius = newShoal.maxDistanceToPerimeter * 0.5;
            attachBoundingVolume(newShoal);
            worldManager.addStaticObject(newShoal);
            spatialGrid.insert(newShoal);
        }

        // Generate Coral Reefs
        const numCoralReefs = Math.round(CORAL_REEF_DENSITY * worldAreaFactor);

        for (let i = 0; i < numCoralReefs; i++) {
            let validPosition = false;
            let attempts = 0;
            let newCoralReef;
            const baseRadiusX = getRandomArbitrary(SHOAL_REEF_MIN_RADIUS, SHOAL_REEF_MAX_RADIUS);
            const baseRadiusY = getRandomArbitrary(SHOAL_REEF_MIN_RADIUS, SHOAL_REEF_MAX_RADIUS);

            while (!validPosition && attempts < 100) {
                const safeMargin = Math.max(baseRadiusX, baseRadiusY);
                const centerX = getRandomArbitrary(WORLD_BUFFER + safeMargin, WORLD_WIDTH - WORLD_BUFFER - safeMargin);
                const centerY = getRandomArbitrary(WORLD_BUFFER + safeMargin, WORLD_HEIGHT - WORLD_BUFFER - safeMargin);
                const reefRockBasePoints = generateIrregularPolygon(centerX, centerY, baseRadiusX, baseRadiusY, 12, 0.6);
                ensureClockwiseWinding(reefRockBasePoints);
                const tempRockBaseObstacle = new Obstacle(reefRockBasePoints, ROCK_COLOR, baseRadiusX, baseRadiusY, 'coralReefBase');

                validPosition = true;
                const potentialColliders = spatialGrid.query(tempRockBaseObstacle);
                for (const existingObstacle of potentialColliders) {
                    // Coral reefs should not overlap with any other solid object.
                    if (existingObstacle.type === 'island' || existingObstacle.type === 'rock' || existingObstacle.type === 'coralReef') {
                        // A reef's rock base is a single convex part. Check it against all parts of the existing obstacle.
                        for (const existingPart of existingObstacle.convexParts) {
                            if (checkPolygonCollision(tempRockBaseObstacle.convexParts[0], existingPart)) {
                                validPosition = false;
                                break;
                            }
                        }
                        if (!validPosition) {
                            break;
                        }
                    }
                }
                if (validPosition) {
                    newCoralReef = new CoralReef(reefRockBasePoints, { min: 30, max: 40 }, baseRadiusX, baseRadiusY);
                    newCoralReef.color = ROCK_COLOR;
                    newCoralReef.strokeColor = darkenColor(ROCK_COLOR, 10);
                    // It's a buffer from the polygon's edge, making the total zone 1.5x the obstacle size.
                    // The buffer distance is half the reef's max radius.
                    newCoralReef.proximityRadius = newCoralReef.maxDistanceToPerimeter * 0.5;
                }
                attempts++;
            }
            if (validPosition) {
                attachBoundingVolume(newCoralReef);
                _createShoreGlowCacheForObstacle(newCoralReef);
                worldManager.addStaticObject(newCoralReef);
                spatialGrid.insert(newCoralReef);
            }
        }

        // After all obstacles are created, find the largest proximity radius for query optimization.
        const allObstacles = worldManager.getAllStaticObjects();
        // --- NEW: Create the minimap cache after all static objects are generated ---
        _createMinimapCache(allObstacles);

        // Note: Static objects are now inserted incrementally during generation.

        maxObstacleProximityRadius = allObstacles.reduce((max, obs) => Math.max(max, obs.proximityRadius), 0);
    }

    /**
     * Initializes the game world, static elements, and NPCs, but does NOT spawn the player.
     * This is called on page load to prepare the background for the start screen.
     */
    function initializeWorld() {
        // This function is designed to be called once on page load.
        // It sets up everything needed to render the world *without* the player.
        // The gameLoop will be started separately by startGame().

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        canvas.addEventListener('click', handleCanvasClick);
        canvas.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        _initGameOverUI(); // --- NEW: Initialize UI ---
        lastWindChangeTime = performance.now();
        // --- FIX: Expose windDirection globally for legacy rig scripts ---
        window.windDirection = windDirection;
        generateWorld();

        // --- NEW: Initialize Shoreline Renderer ---
        shorelineRenderer = new ShorelineRenderer();

        // --- NEW: Pathfinder uses all obstacles from the WorldManager ---
        const staticObstacles = worldManager.getAllStaticObjects();
        pathfinder = new Pathfinder(staticObstacles, WORLD_WIDTH, WORLD_HEIGHT, PATHFINDING_CELL_SIZE);

        // Spawn NPCs now that the pathfinder is ready
        spawnNpcs();

        // Ensure canvas filter is clean
        canvas.style.filter = 'none';

        // --- NEW: Center Camera initially ---
        // This ensures the initial view matches the 'resetGame' view.
        const effectiveScale = worldToScreenScale;
        const viewW = canvas.width / effectiveScale;
        const viewH = canvas.height / effectiveScale;
        cameraX = (WORLD_WIDTH - viewW) / 2;
        cameraY = (WORLD_HEIGHT - viewH) / 2;
    }

    /**
     * Spawns the player with given options and starts the main game loop.
     * This is called when the player clicks "Start Game" on the start screen.
     * @param {object} [playerOptions={}] - Customization options for the player ship.
     * @param {object|null} [blueprint=null] - The ship blueprint, if starting from the shipyard.
     */
    function startGame(playerOptions = {}, blueprint = null) {
        // --- NEW: Prevent loop stacking ---
        if (gameLoopId) {
            cancelAnimationFrame(gameLoopId);
        }

        isGameActive = true; // Set the flag to true, enabling all inputs.
        spawnPlayer(playerOptions, blueprint);

        // --- FIX: Recalculate zoom after player ship is created ---
        // This ensures the worldToScreenScale is correct for the custom ship's size.
        resizeCanvas();

    // --- NEW: Re-initialize WorldManager with the correct sector size ---
    // This ensures the active area scales with the player's ship size and zoom level.
    if (worldManager) {
        const allStaticObjects = worldManager.getAllStaticObjects();
        const allAbstractNpcs = worldManager.getAllAbstractNpcs();

        const sectorSize = (Math.max(canvas.width, canvas.height) / worldToScreenScale) * 1.5;
        worldManager = new WorldManager(WORLD_WIDTH, WORLD_HEIGHT, sectorSize);

        allStaticObjects.forEach(obj => worldManager.addStaticObject(obj));
        allAbstractNpcs.forEach(npc => worldManager.addAbstractNpc(npc));

        // The pathfinder was also created with the old world state. Re-create it
        // so it has access to the correctly binned static objects if needed.
        pathfinder = new Pathfinder(worldManager.getAllStaticObjects(), WORLD_WIDTH, WORLD_HEIGHT, PATHFINDING_CELL_SIZE);
    }
    // --- NEW: Re-create the minimap cache with the new world state ---
    _createMinimapCache(worldManager.getAllStaticObjects());


        // --- FIX: Start the loop via requestAnimationFrame to ensure a valid timestamp ---
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    /**
     * Finds a valid spawn location for the player and adds the player to the world.
     * This is called after the pathfinder is initialized to ensure valid spawn points.
     * @param {object} playerOptions - The options for the player ship.
     * @param {object|null} blueprint - The ship blueprint.
     */
    function spawnPlayer(playerOptions = {}, blueprint = null) {
        // --- NEW: Enforce Blueprint ---
        // If no blueprint is provided (legacy call), generate a default one to prevent
        // the PlayerShip constructor from falling back to the deleted base ship logic.
        if (!blueprint && typeof ShipGenerator !== 'undefined') {
            const generator = new ShipGenerator();
            blueprint = generator.generateBlueprint();
        }

        let validPosition = false;
        let attempts = 0;
        let playerX, playerY;
        const spawnAreaRadius = WORLD_WIDTH / 10; // Spawn within 10% of the center

        while (!validPosition && attempts < 100) {
            playerX = getRandomArbitrary(WORLD_WIDTH / 2 - spawnAreaRadius, WORLD_WIDTH / 2 + spawnAreaRadius);
            playerY = getRandomArbitrary(WORLD_HEIGHT / 2 - spawnAreaRadius, WORLD_HEIGHT / 2 + spawnAreaRadius);
            // Use the blueprint if provided to get correct dimensions for collision check
            const tempPlayer = new PlayerShip(playerX, playerY, playerOptions, blueprint);
            const playerPoints = tempPlayer.getTransformedPoints();

            validPosition = true;
            // Check 1: Physical collision with terrain
            const potentialColliders = spatialGrid.query(tempPlayer);
            for (const obstacle of potentialColliders) {
                for (const part of obstacle.convexParts) {
                    if (checkPolygonCollision(playerPoints, part)) {
                        validPosition = false;
                        break;
                    }
                }
                if (!validPosition) break;
            }

            // Check 2: Pathfinding grid walkability
            if (validPosition && pathfinder) {
                const node = pathfinder._worldToGridNode({ x: playerX, y: playerY });
                if (!node || !node.walkable) {
                    validPosition = false;
                }
            }
            attempts++;
        }

        if (!validPosition) {
            console.warn("Could not find a clear spawn point for the player after 100 attempts. Spawning at world center.");
            playerX = WORLD_WIDTH / 2;
            playerY = WORLD_HEIGHT / 2;
        }

        player = new PlayerShip(playerX, playerY, playerOptions, blueprint);
        player.angle = -Math.PI / 2;

        // --- NEW: Generate Player Inventory ---
        // Calculate capacity based on the ship's physical dimensions.
        let capacity = 20; // Default fallback for basic ship
        if (blueprint && blueprint.dimensions) {
             // Use the unified volumetric calculation if available
             if (player.calculateBurthen) {
                 capacity = player.calculateBurthen();
             }
        }
        player.inventory = new ShipInventory(capacity);
        
        player.inventory.generateForRole('debug-loadout', 'default', player);

        // --- NEW: Add Installed Cannons to Inventory ---
        if (typeof player.getTotalGunCount === 'function') {
            const totalGuns = player.getTotalGunCount();
            if (totalGuns > 0) {
                player.inventory.addItem('cannon', totalGuns);
            }
        }

        // --- NEW: Initialize Fleet Manager ---
        fleetManager = new FleetManager(player);
    }

    /**
     * New: Pre-renders all static obstacles onto an off-screen canvas for the minimap.
     * This is a major performance optimization.
     * @param {Array<Obstacle>} allStaticObstacles - A list of all islands, rocks, etc. in the world.
     * @private
     */
    function _createMinimapCache(allStaticObstacles) {
        const CACHE_SIZE = 2000; // Increased resolution for zoomed-in viewing
        const mapScaleX = CACHE_SIZE / WORLD_WIDTH;
        const mapScaleY = CACHE_SIZE / WORLD_HEIGHT;

        minimapCacheCanvas = document.createElement('canvas');
        minimapCacheCanvas.width = CACHE_SIZE;
        minimapCacheCanvas.height = CACHE_SIZE;
        const cacheCtx = minimapCacheCanvas.getContext('2d');

        // Defensive check: If context creation fails, return early to prevent TypeError.
        // This can happen if canvas dimensions are excessively large or due to browser issues.
        if (!cacheCtx) {
            console.warn(`Failed to get 2D context for minimap cache. Width: ${CACHE_SIZE}, Height: ${CACHE_SIZE}.`);
            minimapCacheCanvas = null; // Ensure we don't try to use a failed canvas
            return;
        }

        // Draw all static obstacles
        allStaticObstacles.forEach(obstacle => {
            const points = obstacle.outerPerimeterPoints || obstacle.rockBase?.outerPerimeterPoints;
            if (!points) return;

            cacheCtx.fillStyle = '#e4c490'; // Map Land Color (Parchment shade)
            cacheCtx.strokeStyle = '#3d352a'; // Map Ink Color
            cacheCtx.lineWidth = 4; // Thicker stroke for visibility when scaled down
            cacheCtx.beginPath();
            points.forEach((point, index) => {
                const scaledX = point.x * mapScaleX;
                const scaledY = point.y * mapScaleY;
                if (index === 0) cacheCtx.moveTo(scaledX, scaledY);
                else cacheCtx.lineTo(scaledX, scaledY);
            });
            cacheCtx.closePath();
            cacheCtx.fill();
            cacheCtx.stroke();
        });
        console.log("[Minimap] Static map cache created.");
    }

    /**
     * Spawns NPC ships in valid locations and assigns them their first path.
     */
    function spawnNpcs() {
        const worldAreaFactor = (WORLD_WIDTH * WORLD_HEIGHT) / (10000 * 10000);
        const numNavyShips = Math.round(NAVY_SHIP_DENSITY * worldAreaFactor);
        const numMerchantShips = Math.round(MERCHANT_SHIP_DENSITY * worldAreaFactor);

        // Spawn the specified number of each ship type.
        for (let i = 0; i < numNavyShips; i++) { _spawnSingleNpc(NavyShip); }
        for (let i = 0; i < numMerchantShips; i++) { _spawnSingleNpc(MerchantShip); }
    }

        /**
     * Generates a random name for an NPC ship based on its type using word lists.
     * @param {string} type - 'navy' or 'merchant'.
     * @param {string} [archetypeName=''] - The specific archetype name (e.g., 'Frigate').
     * @returns {string} The generated name.
     * @private
     */
    function _generateNpcName(type, archetypeName = '') {
        const categories = Object.keys(NPC_NAME_CATEGORIES);
        let allowedCategories = [...categories];

        // 1. Apply Favoring Rules for First Word
        if (type === 'navy') {
            // 50% chance to strictly favor 'martial'
            if (Math.random() < 0.5) {
                allowedCategories = ['martial'];
            }
        } else if (type === 'merchant') {
            // 50% chance to strictly avoid 'martial'
            if (Math.random() < 0.5) {
                allowedCategories = categories.filter(c => c !== 'martial');
            }
        }

        // Helper to pick random item from array
        const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

        // 2. Pick First Word
        const cat1 = pickRandom(allowedCategories);
        const word1 = pickRandom(NPC_NAME_CATEGORIES[cat1]);

        // 3. Decide Name Length (1 or 2 words)
        let twoWordChance = 0.5; // Default (Merchant and small Navy)

        if (type === 'navy') {
            if (archetypeName === '3-Decker Ship of the Line') {
                twoWordChance = 0.75; // 3/4 chance
            } else if (archetypeName === '2-Decker Ship of the Line') {
                twoWordChance = 2 / 3; // 2/3 chance
            }
        }

        const isTwoWords = Math.random() < twoWordChance;
        let finalName = word1;

        if (isTwoWords) {
            // 4. Pick Second Word
            let cat2;
            // 60% chance to pick from a differing category
            if (Math.random() < 0.6) {
                const diffCats = categories.filter(c => c !== cat1);
                cat2 = pickRandom(diffCats);
            } else {
                cat2 = cat1;
            }

            let word2 = pickRandom(NPC_NAME_CATEGORIES[cat2]);
            
            // Restriction: Do not repeat the same word
            let attempts = 0;
            while (word2 === word1 && attempts < 10) {
                word2 = pickRandom(NPC_NAME_CATEGORIES[cat2]);
                attempts++;
            }
            
            finalName = `${word1} ${word2}`;
        }

        // 5. Add Prefix based on type
        if (type === 'navy') {
            return `IMS ${finalName}`;
        } else {
            return finalName;
        }
    }

    /**
     * Spawns a dedicated Pirate Hunter Navy ship to hunt the player.
     */
    function spawnPirateHunter() {
        if (!player || !worldManager) return;

        // 1. Find a spawn location (an island far enough away to be a "hunt")
        const allIslands = worldManager.getAllStaticObjects().filter(o => o.type === 'island');
        if (allIslands.length === 0) return;

        let bestIsland = null;
        let bestDistSq = 0;

        // Pick the furthest island to give the player time, or a random one at least X distance away
        for (const island of allIslands) {
            const dSq = (island.x - player.x)**2 + (island.y - player.y)**2;
            // Ensure it's not TOO close (min 5000 units)
            if (dSq > 5000**2) {
                // Pick random valid one, or furthest? Let's pick random valid.
                if (!bestIsland || Math.random() < 0.3) {
                    bestIsland = island;
                    bestDistSq = dSq;
                }
            }
        }
        // Fallback if map is small
        if (!bestIsland) bestIsland = allIslands[Math.floor(Math.random() * allIslands.length)];

        // 2. Spawn the ship using the internal helper logic (adapted)
        // We force NavyShip class.
        // We need to temporarily override the random spawn logic in _spawnSingleNpc or just call it 
        // and then modify the result. However, _spawnSingleNpc doesn't return the ship.
        // It's cleaner to manually spawn one here using the same helpers.
        
        // For simplicity, we will call _spawnSingleNpc but we need to intercept the creation.
        // Since _spawnSingleNpc is private and complex, let's just use it to spawn a Navy ship
        // and then "promote" the last added abstract NPC to be the hunter.
        
        _spawnSingleNpc(NavyShip);
        
        // The new ship is now in worldManager's abstract list (dormant).
        // We need to find it and tag it.
        // Since we don't have a direct reference, this approach is flaky.
        // BETTER APPROACH: Refactor _spawnSingleNpc to return the abstract object, or copy its logic.
        // Given the constraints, I will copy the core logic for a specific spawn.
        
        // ... (Implementation inside _spawnPirateHunter helper below) ...
    }

    /**
     * Helper function to find a valid spawn location for a single NPC and add it to the world.
     * This avoids duplicating the complex position-finding logic.
     * @param {class} ShipClass - The class of the ship to spawn (e.g., NavyShip, MerchantShip).
     * @param {Island} [spawnOriginIsland=null] - Optional island to spawn near (overrides random selection).
     * @param {string|Array<string>} [allowedArchetypes=null] - Optional filter for specific ship types.
     * @private
     */
    function _spawnSingleNpc(ShipClass, spawnOriginIsland = null, allowedArchetypes = null) {
        const allIslands = worldManager.getAllStaticObjects().filter(o => o.type === 'island');
        if (allIslands.length === 0 || !NPC_ARCHETYPES) return;

        // --- New Archetype-based Generation ---

        // Helper for weighted random choice
        const weightedRandom = (options) => {
            if (!options || options.length === 0) return null;
            const totalWeight = options.reduce((sum, opt) => sum + (opt.weight || 1), 0);
            let random = Math.random() * totalWeight;
            for (const opt of options) {
                if (random < (opt.weight || 1)) return opt;
                random -= (opt.weight || 1);
            }
            return options[0]; // Fallback
        };

        // Helper for biased random number generation
        const biasedRandom = (min, max, bias) => {
            let r;
            switch (bias) {
                case 'low':
                case 'wide': // For beam ratio, 'wide' means a lower number
                    r = Math.random() * Math.random(); // Skews towards 0
                    break;
                case 'high':
                case 'narrow': // For beam ratio, 'narrow' means a higher number
                    r = 1 - (Math.random() * Math.random()); // Skews towards 1
                    break;
                case 'strong_average':
                    r = (Math.random() + Math.random() + Math.random()) / 3; // Skews strongly to middle
                    break;
                case 'average':
                default:
                    r = (Math.random() + Math.random()) / 2; // Skews to middle
                    break;
            }
            return min + r * (max - min);
        };

        // Helper to get valid beam range, adapted from main.js
        const getBeamSliderRange = (buildType, size, numDecks) => {
            let sizeBasedMaxBeamRatio = 4.0;
            if (buildType === 'guns') {
                if (size === 1) sizeBasedMaxBeamRatio = 2.0;
                else if (size === 2) sizeBasedMaxBeamRatio = 2.3;
                else if (size >= 3 && size <= 4) sizeBasedMaxBeamRatio = 2.5;
                else if (size >= 5 && size <= 7) sizeBasedMaxBeamRatio = 3.5;
                else if (size >= 8) sizeBasedMaxBeamRatio = 4.0;
            } else { // cargo
                if (size >= 1 && size <= 3) sizeBasedMaxBeamRatio = 2.0;
                else if (size >= 4 && size <= 6) sizeBasedMaxBeamRatio = 2.3;
                else if (size >= 7 && size <= 20) sizeBasedMaxBeamRatio = 2.5;
                else if (size >= 21 && size <= 40) sizeBasedMaxBeamRatio = 3.5;
                else if (size >= 41) sizeBasedMaxBeamRatio = 4.0;
            }
            let deckBasedMaxBeamRatio = 4.0;
            if (numDecks === 2) deckBasedMaxBeamRatio = 3.75;
            else if (numDecks === 3) deckBasedMaxBeamRatio = 3.5;
            const maxBeamRatio = Math.min(sizeBasedMaxBeamRatio, deckBasedMaxBeamRatio);
            return { min: 2.0, max: maxBeamRatio };
        };

        // Helper to get valid draught range, adapted from main.js
        const getDraughtSliderRange = (beamRatio, numDecks, maxBeamRatio) => {
            const baselineDraftFactor = 0.5 + ((beamRatio - ((2.0 + maxBeamRatio) / 2)) * 0.1) + ((numDecks - 1) * 0.15);
            const minDraftFactor = Math.max(0.4, baselineDraftFactor - 0.10);
            const maxDraftFactor = baselineDraftFactor + 0.15;
            return { min: minDraftFactor, max: maxDraftFactor };
        };

        // 1. Select Role and Archetype
        const shipType = (ShipClass === NavyShip) ? 'navy' : 'merchant';
        let archetype;
        let roleKey;

        if (shipType === 'merchant') {
            // Pick Role based on spawnWeight
            const roles = window.NPC_ROLES.merchant;
            const roleOptions = Object.keys(roles).map(key => ({ key: key, weight: roles[key].spawnWeight || 10 }));
            const selectedRoleOption = weightedRandom(roleOptions);
            roleKey = selectedRoleOption.key;

            // Filter Archetypes based on the selected role
            const compatibleNames = roles[roleKey].compatibleArchetypes;
            const possibleArchetypes = NPC_ARCHETYPES.merchant.filter(a => compatibleNames.includes(a.name));
            
            // Pick Archetype from the filtered list (fallback to all if something goes wrong)
            archetype = weightedRandom(possibleArchetypes.length > 0 ? possibleArchetypes : NPC_ARCHETYPES.merchant);
        } else {
            // Navy (Default behavior: pick archetype directly, assume 'warship' role)
            roleKey = 'warship';
            let pool = NPC_ARCHETYPES.navy;

            if (allowedArchetypes) {
                if (Array.isArray(allowedArchetypes)) {
                    pool = pool.filter(a => allowedArchetypes.includes(a.name));
                } else {
                    pool = pool.filter(a => a.name === allowedArchetypes);
                }
            }

            archetype = weightedRandom(pool);
        }
        if (!archetype) return null; // Safety check if filter excludes all options

        const generator = new ShipGenerator();

        // 2. Set Build Type & Size
        generator.setBuildType(archetype.buildType);
        const size = Math.floor(getRandomArbitrary(archetype.sizeRange.min, archetype.sizeRange.max));
        if (archetype.buildType === 'guns') {
            generator.setGunsPerBattery(size);
        } else { // 'cargo'
            generator.setCargoCapacity(size);
            const maxGuns = Math.floor(size / 3);
            const gunCount = Math.round(biasedRandom(0, maxGuns, archetype.gunBias || 'average'));
            generator.setCargoGuns(gunCount);
        }

        // 3. Set Decks
        const deckChoice = weightedRandom(archetype.deckOptions);
        generator.setNumDecks(deckChoice.count);
        if (deckChoice.deckTypes) {
            for (const tier in deckChoice.deckTypes) {
                generator.setDeckType(parseInt(tier), deckChoice.deckTypes[tier]);
            }
        }

        // 4. Set Beam Ratio
        const beamRange = getBeamSliderRange(archetype.buildType, size, deckChoice.count);
        const beamRatio = biasedRandom(beamRange.min, beamRange.max, archetype.beamBias);
        generator.setBeamRatio(beamRatio);

        // 5. Set Draught
        const draughtRange = getDraughtSliderRange(beamRatio, deckChoice.count, beamRange.max);
        const draughtFactor = biasedRandom(draughtRange.min, draughtRange.max, archetype.draughtBias);
        generator.setDraughtFactor(draughtFactor);

        // 6. Set Rig
        const rigMastMapping = {
            'sloop': 1, 'fore-and-aft-sloop': 1, 'square': 1,
            'brig': 2, 'brigantine': 2, 'schooner': 2,
            'full-rigged': 3, 'barque': 3, 'barquentine': 3, 'three-mast-schooner': 3
        };
        const rigChoice = weightedRandom(archetype.rigOptions);
        generator.setRigType(rigChoice.type);
        generator.setMastCount(rigMastMapping[rigChoice.type] || 1);

        // 7. Set Deck Layout
        const deckLayoutChoice = weightedRandom(archetype.deckLayoutOptions);
        generator.setDeckLayoutType(deckLayoutChoice.type);

        // 8. Set Superstructures
        if (archetype.superstructureLayers) {
            archetype.superstructureLayers.forEach(layer => {
                const choice = weightedRandom(layer);
                if (choice && choice.parts) {
                    choice.parts.forEach(part => {
                        if (part === 'forecastle') generator.setForecastle(true);
                        if (part === 'aftercastle') generator.setAftercastle(true);
                        if (part === 'midcastle') generator.setMidcastle(true);
                        if (part === 'sterncastle') generator.setSterncastle(true);
                        if (part === 'spardeck') generator.setSparDeck(true);
                    });
                }
            });
        }

        // 9. Generate Blueprint
        const blueprint = generator.generateBlueprint();
        
        // --- NEW: Generate Random Name ---
        const randomName = _generateNpcName(shipType, archetype.name);

        // Add archetype name and specific ship name to options
        const options = { archetypeName: archetype.name, shipName: randomName };

        // 10. Find spawn location and create ship
        const tempNpc = new ShipClass(0, 0, blueprint, { ...options, skipCache: true });
        let validPosition = false;
        let totalAttempts = 0;
        let npcX, npcY, startIsland;

        while (!validPosition && totalAttempts < 500) { // Add a max total attempts failsafe
            // 1. Select a starting island (use override if provided).
            startIsland = spawnOriginIsland || allIslands[Math.floor(Math.random() * allIslands.length)];
            let islandAttempts = 0;

            // Try to find a spot around the chosen island.
            while (!validPosition && islandAttempts < 100) {
                totalAttempts++;
                islandAttempts++;

                // 2. Find a spawn point in a "ring" around the island.
                // --- FIX: Account for island radius to prevent spawning inside land ---
                const islandRadius = Math.max(startIsland.baseRadiusX || 0, startIsland.baseRadiusY || 0);
                const spawnRingInnerRadius = islandRadius + (SHIP_TARGET_LENGTH * 2) + tempNpc.shipLength;
                const spawnRingOuterRadius = spawnRingInnerRadius + (SHIP_TARGET_LENGTH * 4);
                const spawnAngle = getRandomArbitrary(0, Math.PI * 2);
                const spawnDist = getRandomArbitrary(spawnRingInnerRadius, spawnRingOuterRadius);

                npcX = startIsland.x + Math.cos(spawnAngle) * spawnDist;
                npcY = startIsland.y + Math.sin(spawnAngle) * spawnDist;
                tempNpc.x = npcX;
                tempNpc.y = npcY;
                
                // --- NEW: Set orientation facing away from the island ---
                tempNpc.angle = spawnAngle;

                validPosition = true; // Assume true until a check fails.

                if (player && distance(tempNpc, player) < NPC_DETECTION_RADIUS * NPC_SPAWN_PLAYER_MIN_DISTANCE_MULTIPLIER) {
                    validPosition = false;
                }

                if (validPosition) {
                    const npcPoints = tempNpc.getTransformedPoints();
                    const potentialColliders = spatialGrid.query(tempNpc);
                    for (const obstacle of potentialColliders) {
                        if (obstacle.type === 'island' || obstacle.type === 'rock' || obstacle.type === 'coralReef') {
                            // --- NEW: Spawn Buffer Check ---
                            // Ensure the ship spawns at least 2 ship lengths away from any terrain.
                            const geometrySource = (obstacle.type === 'coralReef' && obstacle.rockBase) ? obstacle.rockBase : obstacle;
                            if (geometrySource.outerPerimeterPoints) {
                                const distSq = distanceToPolygonSquared({ x: npcX, y: npcY }, geometrySource.outerPerimeterPoints);
                                if (distSq < (tempNpc.shipLength * 2) ** 2) {
                                    validPosition = false;
                                    break;
                                }
                            }
                            for (const part of obstacle.convexParts) {
                                if (checkPolygonCollision(npcPoints, part)) {
                                    validPosition = false;
                                    break;
                                }
                            }
                        }
                        if (!validPosition) break;
                    }
                }

                if (validPosition && pathfinder) {
                    const node = pathfinder._worldToGridNode({ x: npcX, y: npcY });
                    if (!node || !node.walkable) {
                        validPosition = false;
                    }
                }
            }
        }
        if (validPosition) {
            // --- NEW: Generate Inventory (Moved out of loop) ---
            // Calculate capacity based on ship size (approximate)
            let capacity = 50;
            if (tempNpc.calculateBurthen) {
                capacity = tempNpc.calculateBurthen();
            }

            tempNpc.inventory = new ShipInventory(capacity);
            
            // --- NEW: Add Installed Cannons ---
            if (typeof tempNpc.getTotalGunCount === 'function') {
                const totalGuns = tempNpc.getTotalGunCount();
                if (totalGuns > 0) {
                    tempNpc.inventory.addItem('cannon', totalGuns);
                }
            }

            tempNpc.inventory.generateForRole(roleKey, shipType, tempNpc);

            // --- NEW: Pre-calculate initial path for dormant simulation ---
            // 1. Create a temporary, full NPC instance to access its methods.
            const pathingNpc = new ShipClass(npcX, npcY, blueprint, { ...options, previousDestinationIsland: startIsland, skipCache: true });
            pathingNpc.angle = tempNpc.angle; // Sync angle

            // 2. Use its methods to find its first destination and path.
            if (allIslands.length > 0) {
                pathingNpc._findNewWanderDestination(allIslands, pathfinder, windDirection);
            }

            // 3. Create the abstract data object, now including the pathing information.
            const abstractNpc = {
                position: { x: npcX, y: npcY },
                angle: tempNpc.angle, // --- NEW: Save initial orientation ---
                blueprint: blueprint,
                shipClass: ShipClass.name, // 'NavyShip' or 'MerchantShip'
                baseSpeed: pathingNpc.baseSpeed,
                hp: pathingNpc.hp,
                aiState: pathingNpc.aiState,
                destinationIsland: pathingNpc.destinationIsland,
                previousDestinationIsland: startIsland,
                pathWaypoints: pathingNpc.pathWaypoints,
                currentWaypointIndex: pathingNpc.currentWaypointIndex,
                archetypeName: pathingNpc.archetypeName,
                displayName: pathingNpc.displayName, // Save the generated name
                pennantColor: pathingNpc.pennantColor,
                rigType: pathingNpc.blueprint.layout.rigType,
                inventory: tempNpc.inventory // <--- CAPTURE INVENTORY FROM OUTER SCOPE
            };
            return worldManager.addAbstractNpc(abstractNpc); // Return the actual ship instance
        }
        return null;
    }

    function _spawnPirateHunter() {
        // Spawn a single hunter (Rank 3 logic)
        // Allowed: Cutter, Corvette, Frigate. Excluded: 2-Decker, 3-Decker.
        const allowed = ['Naval Cutter', 'Corvette', 'Frigate'];
        const abstractNpc = _spawnSingleNpc(NavyShip, null, allowed);
        
        if (abstractNpc) {
            console.log(`[Pirate Hunter] A new Pirate Hunter has been dispatched!`);
            // Modify properties to make it a Hunter
            abstractNpc.isPirateHunter = true;
            abstractNpc.aiState = 'hunting';
            abstractNpc.pennantColor = '#000000'; // Black pennant for hunters? Or keep Navy blue.
            abstractNpc.displayName = "Hunter " + abstractNpc.displayName;
            
            // --- NEW: Generate initial path to player ---
            // This ensures the hunter starts moving towards the player immediately,
            // even while in a dormant sector.
            if (player && pathfinder) {                
                // Set destination to player
                const targetDest = { x: player.x, y: player.y, proximityRadius: 0, type: 'target' };
                // abstractNpc is the actual instance, so we can call methods directly
                abstractNpc.setNewDestination(targetDest, pathfinder, windDirection);
                abstractNpc.currentWaypointIndex = 0;
            }

            // We don't have the instance yet (it's abstract), so we set properties on the data object.
            // The WorldManager will hydrate these into the NavyShip instance when activated.
            // We need to ensure NavyShip constructor/hydration reads these.
            // (WorldManager.addAbstractNpc handles hydration using the data object as options).
            
            // We can't set 'pirateHunter' variable to the instance yet because it doesn't exist.
            // We need a way to track this abstract object.
            pirateHunter = abstractNpc; 
        }
    }

    /**
     * Spawns a squadron of Pirate Hunters (Rank 4+).
     */
    function _spawnPirateHunterSquadron() {
        const allIslands = worldManager.getAllStaticObjects().filter(o => o.type === 'island');
        if (allIslands.length === 0) return;

        // Pick a random island far from the player to spawn the squadron
        let validIslands = allIslands;
        if (player) {
            validIslands = allIslands.filter(island => {
                const dSq = (island.x - player.x)**2 + (island.y - player.y)**2;
                return dSq > 5000**2; // Min 5000 units away
            });
        }
        // Fallback to all islands if none are far enough
        if (validIslands.length === 0) validIslands = allIslands;

        const targetIsland = validIslands[Math.floor(Math.random() * validIslands.length)];
        const squadSize = Math.floor(Math.random() * 3) + 2; // 2 to 4 ships

        // --- Rank 4 Squadron Logic ---
        // Uniform archetype: Frigate or 2-Decker. Excluded: Cutter, Corvette, 3-Decker.
        // Flagship has 80% chance of being a 2-Decker.
        const selectedArchetypeName = Math.random() < 0.8 ? '2-Decker Ship of the Line' : 'Frigate';

        console.log(`[Pirate Hunter] Spawning Squadron of ${squadSize} ${selectedArchetypeName}s at Island ${targetIsland.id}`);
        let leader = null;
        let previousShip = null;

        for (let i = 0; i < squadSize; i++) {
            const abstractNpc = _spawnSingleNpc(NavyShip, targetIsland, selectedArchetypeName);
            
            if (abstractNpc) {
                abstractNpc.isPirateHunter = true;
                abstractNpc.isSquadronHunter = true; // Mark as part of the squadron
                abstractNpc.pennantColor = '#000000';
                
                if (i === 0) {
                    // --- LEADER ---
                    leader = abstractNpc;
                    abstractNpc.aiState = 'hunting';
                    abstractNpc.displayName = "Squadron Flagship " + abstractNpc.displayName;
                    console.log(`[Pirate Hunter] Leader spawned at (${abstractNpc.x.toFixed(0)}, ${abstractNpc.y.toFixed(0)})`);

                    // Generate initial path to player for the leader
                    if (player && pathfinder) {
                        const targetDest = { x: player.x, y: player.y, proximityRadius: 0, type: 'target' };
                        abstractNpc.setNewDestination(targetDest, pathfinder, windDirection);
                        abstractNpc.currentWaypointIndex = 0;
                    }
                } else {
                    // --- FOLLOWER ---
                    abstractNpc.aiState = 'formation';
                    abstractNpc.formationLeader = previousShip; // Follow the ship directly in front
                    abstractNpc.formationIndex = 1; // All followers are 1 position behind their leader
                    abstractNpc.displayName = "Squadron Ship " + abstractNpc.displayName;
                    // Clear the random wander path assigned by _spawnSingleNpc
                    abstractNpc.pathWaypoints = [];
                    console.log(`[Pirate Hunter] Wingman ${i} spawned.`);
                }

                previousShip = abstractNpc; // The current ship becomes the previous ship for the next iteration
                activeSquadronCount++;
            }
        }
    }

    /**
     * Spawns a fleet of Pirate Hunters (Rank 5+).
     */
    function _spawnPirateHunterFleet() {
        const allIslands = worldManager.getAllStaticObjects().filter(o => o.type === 'island');
        if (allIslands.length === 0) return;

        // Pick a random island far from the player to spawn the fleet
        let validIslands = allIslands;
        if (player) {
            validIslands = allIslands.filter(island => {
                const dSq = (island.x - player.x)**2 + (island.y - player.y)**2;
                return dSq > 7500**2; // Min 7500 units away for a fleet
            });
        }
        if (validIslands.length === 0) validIslands = allIslands;

        const targetIsland = validIslands[Math.floor(Math.random() * validIslands.length)];
        const fleetSize = Math.floor(Math.random() * 6) + 5; // 5 to 10 ships

        // --- Rank 5 Fleet Logic ---
        // Flagship has 80% chance of being a 3-Decker.
        const selectedArchetypeName = Math.random() < 0.8 ? '3-Decker Ship of the Line' : '2-Decker Ship of the Line';

        console.log(`[Pirate Hunter] Spawning Fleet of ${fleetSize} ${selectedArchetypeName}s at Island ${targetIsland.id}`);
        let leader = null;
        let previousShip = null;

        for (let i = 0; i < fleetSize; i++) {
            const abstractNpc = _spawnSingleNpc(NavyShip, targetIsland, selectedArchetypeName);
            
            if (abstractNpc) {
                abstractNpc.isPirateHunter = true;
                abstractNpc.isFleetHunter = true; // Mark as part of the fleet
                abstractNpc.pennantColor = '#000000';
                
                if (i === 0) {
                    leader = abstractNpc;
                    abstractNpc.aiState = 'hunting';
                    abstractNpc.displayName = "Fleet Flagship " + abstractNpc.displayName;
                    if (player && pathfinder) {
                        const targetDest = { x: player.x, y: player.y, proximityRadius: 0, type: 'target' };
                        abstractNpc.setNewDestination(targetDest, pathfinder, windDirection);
                    }
                } else {
                    abstractNpc.aiState = 'formation';
                    abstractNpc.formationLeader = previousShip; // Follow the ship directly in front
                    abstractNpc.formationIndex = 1; // All followers are 1 position behind their leader
                    abstractNpc.displayName = "Fleet Ship " + abstractNpc.displayName;
                    abstractNpc.pathWaypoints = [];
                }
                previousShip = abstractNpc; // The current ship becomes the previous ship for the next iteration
                activeFleetCount++;
            }
        }
    }

    /**
     * Creates a pre-rendered, blurred "glow" effect for an obstacle's shoreline.
     * This is cached on the obstacle object for performance.
     * @param {Obstacle} obstacle - The island or rock to create the glow for.
     * @private
     */
    function _createShoreGlowCacheForObstacle(obstacle) {
        // --- FIX: Correctly get geometry for composite CoralReef objects ---
        const geometrySource = (obstacle.type === 'coralReef' && obstacle.rockBase) ? obstacle.rockBase : obstacle;
        const points = geometrySource.outerPerimeterPoints || geometrySource.points;
        if (!points || points.length === 0) return;

        const aabb = getPolygonAABB(points);
        if (!isFinite(aabb.minX) || !isFinite(aabb.minY) || !isFinite(aabb.maxX) || !isFinite(aabb.maxY)) {
            console.warn("Invalid AABB calculated for obstacle, skipping shore glow cache.", obstacle);
            return;
        }
        
        // --- NEW: Dynamic Sizing based on Obstacle Size ---
        const size = obstacle.boundingRadius || Math.max(aabb.maxX - aabb.minX, aabb.maxY - aabb.minY) / 2;
        // Scale blur radius: Min 40, Max 120, or 40% of radius
        const blurRadius = Math.max(40, Math.min(120, size * 0.4));
        
        const margin = blurRadius * 2; // Margin to prevent blur from being clipped

        // --- FIX: Round dimensions to integers to prevent errors creating the canvas ---
        const width = Math.round((aabb.maxX - aabb.minX) + margin * 2);
        const height = Math.round((aabb.maxY - aabb.minY) + margin * 2);

        const MAX_CANVAS_DIMENSION = 16384; // Common browser limit for canvas dimensions

        if (width <= 0 || height <= 0 || !isFinite(width) || !isFinite(height) || width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION) {
            console.warn(`Skipping shore glow cache creation due to invalid or excessive dimensions. Width: ${width}, Height: ${height}. Obstacle:`, obstacle);
            return;
        }

        const cacheCanvas = window.CanvasManager.getCanvas(width, height);
        cacheCanvas.width = width;
        cacheCanvas.height = height;
        const cacheCtx = cacheCanvas.getContext('2d');
        // Defensive check: If context creation fails, return early to prevent TypeError.
        // This can happen if canvas dimensions are excessively large or due to browser issues.
        if (!cacheCtx) {
            console.warn(`Failed to get 2D context for shore glow cache. Width: ${width}, Height: ${height}. Obstacle:`, obstacle);
            return;
        }

        cacheCtx.translate(margin - aabb.minX, margin - aabb.minY);

        // 1. Draw the Water Glow (Shadow)

        obstacle.shoreGlowCache = cacheCanvas;
        obstacle.shoreGlowOffset = { x: aabb.minX - margin, y: aabb.minY - margin };
    }

    /**
     * Resets the game state and regenerates the world.
     */
    function resetGame() {
        console.log("Game Over! Returning to main menu...");

        // --- NEW: Reset Game Over State ---
        gameOverState.active = false;
        gameOverState.reason = '';
        gameOverState.timer = 0;
        gameOverState.canRestart = false;
        gameOverState.lastFilterString = ''; // Reset cache
        gameOverState.lastOpacity = -1;      // Reset cache

        canvas.style.filter = 'none'; // --- NEW: Reset CSS Filter ---
        if (gameOverOverlay) gameOverOverlay.style.display = 'none'; // --- NEW: Hide Overlay ---

        // --- NEW: Reset Boarding State and Zoom ---
        boardingState.isActive = false;
        boardingState.isInventoryOpen = false;
        boardingState.target = null;
        boardingState.jointPoint = null;
        boardingState.tension = 0;
        boardingState.crewProjectiles = [];
        boardingState.isAiming = false;
        boardingState.aimStart = null;
        boardingState.aimStartLocal = null;
        boardingState.aimCurrent = null;
        currentZoomMultiplier = 1.0;
        boardingState.npcState = 'IDLE';
        boardingState.npcTimer = 0;
        boardingState.npcChargeStartLocal = null;
        
        pirateHunter = null;
        pirateHunterRespawnTimer = 0;
        activeSquadronCount = 0;
        squadronRespawnTimer = 0;
        activeFleetCount = 0;
        fleetRespawnTimer = 0;

        dayNightTimer = 0; // Reset to morning
        previousDayNightTimer = 0;
        ambientLightLevel = 1.0;

        // --- OPTIMIZATION: Recycle entities to pools ---
        for (const s of splashes) splashPool.push(s);
        for (const d of damageEffects) damageEffectPool.push(d);
        
        // Clear dynamic entities lists
        volleys = []; 
        splashes = []; // Clear splashes
        damageEffects = []; // Clear damage effects
        
        // --- OPTIMIZATION: Recycle wavelets to pool ---
        // Instead of dumping them to GC, return them to the pool for reuse.
        for (const w of wavelets) {
            waveletPool.push(w);
        }
        wavelets.length = 0; // Clear array without reallocating
        cannonballs = [];
        
        // --- FIX: Clear active lists to remove old entities ---
        activeNpcs = [];
        activeIslands = [];
        activeRocks = [];
        activeShoals = [];
        activeCoralReefs = [];
        allShips = [];

        // --- NEW: Close Inventory UI if open ---
        const inventoryScreen = document.getElementById('inventory-screen');
        if (inventoryScreen) {
            inventoryScreen.style.display = 'none';
        }
        const cargoDialog = document.getElementById('cargo-action-dialog');
        if (cargoDialog) {
            cargoDialog.style.display = 'none';
        }
        inventoryTarget = null; // Clear target

        // Regenerate World (for background ambiance)
        generateWorld();
        const staticObstacles = worldManager.getAllStaticObjects();
        pathfinder = new Pathfinder(staticObstacles, WORLD_WIDTH, WORLD_HEIGHT, PATHFINDING_CELL_SIZE);
        
        // Spawn NPCs for background activity
        spawnNpcs();
        
        // Clear Player & Fleet
        player = null;
        fleetManager = null;

        // --- FIX: Recalculate zoom immediately so camera centering uses the correct scale ---
        resizeCanvas();
        
        lastWindChangeTime = performance.now();
        
        // Reset Camera to center of world for background view
        const effectiveScale = worldToScreenScale;
        const viewW = canvas.width / effectiveScale;
        const viewH = canvas.height / effectiveScale;
        cameraX = (WORLD_WIDTH - viewW) / 2;
        cameraY = (WORLD_HEIGHT - viewH) / 2;

        // --- FIX: Removed incorrect reset to 0,0 which overrode the centering logic above ---
        
        keys = {};

        // Show Start Screen
        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.style.display = 'flex';

        // Disable game input
        isGameActive = false;
    }

    /**
     * Updates the global wind direction periodically and checks for anchor breaks.
     */
    function updateWind() {
        const now = performance.now();
        if (now - lastWindChangeTime > WIND_CHANGE_INTERVAL) {
            if (player && player.isAnchored && player.anchorPoint) {
                const currentDistance = distance(player.anchorPoint, player.getBowPointWorldCoords());
                const maxPossibleDistance = player.shipLength * MAX_ANCHOR_LINE_LENGTH_MULTIPLIER;

                if (maxPossibleDistance > 0) {
                    const normalizedDistance = Math.min(1, currentDistance / maxPossibleDistance);
                    // --- FIX: Adjust anchor break chance formula ---
                    // The formula is breakChance = A * e^(-k * normalizedDistance)
                    // A is the max chance at 0 distance, now set to 0.25 (25%).
                    // k is calculated to make the chance 1% at max distance (normalizedDistance = 1).
                    // k = ln(A / 0.01) = ln(0.25 / 0.01) = ln(25).
                    const k = Math.log(25);
                    const breakChance = 0.25 * Math.exp(-k * normalizedDistance);

                    if (Math.random() < breakChance) {
                        toggleAnchor(); // Anchor breaks
                    }
                }
            }

            windDirection = getRandomArbitrary(0, Math.PI * 2);
            // Instruct all NPCs to recalculate their path with the new wind direction
            if (pathfinder) {
                activeNpcs.forEach(npc => npc.recalculatePath(pathfinder, windDirection));
            }

            lastWindChangeTime = now;
        }
    }

    /**
     * A periodic, global failsafe to ensure no NPC ship is permanently without a path.
     * This is a last resort for edge cases where a ship might lose its way.
     */
    function checkNpcPathsFailsafe() {
        const now = performance.now();
        if (now - lastNpcPathCheckTime > NPC_PATH_FAILSAFE_INTERVAL) {
            activeNpcs.forEach(npc => {
                // This check targets ships that are in a simple navigating state but have
                // neither a destination nor a path. This indicates they are lost.
                // It avoids interfering with ships in special states like combat, docking, or arriving.
                if (npc.aiState === 'navigating' && !npc.destinationIsland && npc.pathWaypoints.length === 0) {
                    console.warn(`[Path Failsafe] Ship ${npc.shipId} was found without a path. Assigning a new destination.`);
                    npc._findNewWanderDestination(activeIslands, pathfinder, windDirection);
                }
            });

            lastNpcPathCheckTime = now;
        }
    }

    /**
     * Helper function to draw a single dashed debug circle.
     * This encapsulates the drawing logic and improves performance by reducing state changes.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} x - The center X coordinate.
     * @param {number} y - The center Y coordinate.
     * @param {number} radius - The radius of the circle.
     * @param {string} color - The stroke color of the circle.
     * @param {Array<number>} dashPattern - The dash pattern array (e.g., [5, 5]).
     * @param {number} zoomLevel - The current camera zoom level.
     */
    function _drawDebugCircle(ctx, x, y, radius, color, dashPattern, zoomLevel) {
        ctx.strokeStyle = color;
        ctx.setLineDash(dashPattern.map(d => d / zoomLevel));
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    /**
     * Draws the spatial grid lines for debugging purposes.
     * @param {number} cameraX - The camera's current X position.
     * @param {number} cameraY - The camera's current Y position.
     * @param {number} viewWidth - The effective width of the camera's view.
     * @param {number} viewHeight - The effective height of the camera's view.
     */
    function drawGrid(cameraX, cameraY, viewWidth, viewHeight) { // Changed zoomLevel to worldToScreenScale
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1;

        const startCol = Math.floor(cameraX / GRID_SIZE);
        const endCol = Math.ceil((cameraX + viewWidth) / GRID_SIZE);
        const startRow = Math.floor(cameraY / GRID_SIZE);
        const endRow = Math.ceil((cameraY + viewHeight) / GRID_SIZE);

        ctx.beginPath();
        for (let i = startCol; i <= endCol; i++) {
            const x = i * GRID_SIZE;
            ctx.moveTo(x, startRow * GRID_SIZE);
            ctx.lineTo(x, endRow * GRID_SIZE);
        }

        for (let i = startRow; i <= endRow; i++) {
            const y = i * GRID_SIZE;
            ctx.moveTo(startCol * GRID_SIZE, y);
            ctx.lineTo(endCol * GRID_SIZE, y);
        }
        ctx.stroke();
    }

    // --- OPTIMIZATION: Cached Explosion Sprite ---
    let cachedExplosionSprite = null;
    function getExplosionSprite() {
        if (!cachedExplosionSprite) {
            const size = 64;
            const c = document.createElement('canvas');
            c.width = size; c.height = size;
            const ctx = c.getContext('2d');
            const cx = size / 2, cy = size / 2;
            
            // Draw a generic jagged explosion shape
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
            ctx.fillStyle = '#ff8c00'; // Base orange color
            ctx.fill();
            cachedExplosionSprite = c;
        }
        return cachedExplosionSprite;
    }

    /**
     * The main drawing function. It handles camera transformations and renders all
     * game objects and UI elements.
     */
    function draw() {
        let tStart = performance.now();

        // Fill the background with the ocean color first.
        // This replaces the need for ctx.clearRect().
        ctx.fillStyle = OCEAN_BLUE;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // --- NEW: Calculate Effective Scale ---
        const effectiveScale = worldToScreenScale * currentZoomMultiplier;

        // --- Calculate Camera View & Apply Transformations ---
        const effectiveCanvasWidth = canvas.width / effectiveScale;
        const effectiveCanvasHeight = canvas.height / effectiveScale;

        if (player) {
            // Center the camera on the player
            cameraX = player.x - effectiveCanvasWidth / 2; // Changed zoomLevel to worldToScreenScale
            cameraY = player.y - effectiveCanvasHeight / 2; // Changed zoomLevel to worldToScreenScale
        }

        // Clamp camera to world boundaries to prevent showing empty space
        cameraX = Math.max(0, Math.min(cameraX, WORLD_WIDTH - effectiveCanvasWidth));
        cameraY = Math.max(0, Math.min(cameraY, WORLD_HEIGHT - effectiveCanvasHeight));

        ctx.save();
        ctx.scale(effectiveScale, effectiveScale); // Apply effectiveScale
        ctx.translate(-cameraX, -cameraY); // Apply camera offset

        // --- NEW: Draw Wavelets (Background Layer) ---
        drawWavelets(ctx, effectiveScale);

        let tWaves = performance.now();
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Draw: Wavelets'] = (perfMetrics['Draw: Wavelets'] || 0) + (tWaves - tStart);

        // --- Draw Debug Anchor Zones ---
        // This is drawn first so that the semi-transparent stroke appears *behind* the
        // actual terrain, creating a clean outline effect.
        if (DEBUG.ENABLED && DEBUG.DRAW_ANCHOR_ZONES) {
            // --- PERF: Start measuring Islands/Terrain ---
            let tIslandsStart = performance.now();
            ctx.save();
            
            // --- NEW: Dashed Dot Style ---
            ctx.strokeStyle = '#00FFFF'; // Cyan for high visibility
            ctx.fillStyle = '#00FFFF';
            ctx.lineWidth = 4 / effectiveScale; // Fixed screen width dots
            ctx.setLineDash([0, 15 / effectiveScale]); // Dots with spacing
            ctx.lineCap = 'round';
            ctx.font = `${12 / effectiveScale}px monospace`;
            ctx.textAlign = "center";

            // --- OPTIMIZATION: Batch geometry drawing ---
            ctx.beginPath();
            const labelsToDraw = [];

            // --- NEW: Use active statics from WorldManager ---
            worldManager.getActiveObjects().statics.forEach(obstacle => {
                const geometrySource = (obstacle.type === 'coralReef' && obstacle.rockBase) ? obstacle.rockBase : obstacle;
                const points = geometrySource.outerPerimeterPoints;
                
                if (points && obstacle.proximityRadius > 0) {
                    const cx = obstacle.x;
                    const cy = obstacle.y;
                    const r = obstacle.proximityRadius;
                    let minY = Infinity;

                    points.forEach((p, i) => {
                        const dx = p.x - cx;
                        const dy = p.y - cy;
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        if (dist > 0.001) {
                            const scale = (dist + r) / dist;
                            const ex = cx + dx * scale;
                            const ey = cy + dy * scale;
                            if (ey < minY) minY = ey; // Track top-most point
                            
                            if (i === 0) ctx.moveTo(ex, ey);
                            else ctx.lineTo(ex, ey);
                        }
                    });
                    ctx.closePath();

                    // Store Label for later
                    labelsToDraw.push({text: "Anchor Zone", x: cx, y: minY - (10 / effectiveScale)});
                }
            });
            ctx.stroke(); // Draw all zones in one call

            ctx.setLineDash([]); // Solid text
            labelsToDraw.forEach(l => ctx.fillText(l.text, l.x, l.y));
            ctx.restore();
            if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Draw: Islands'] = (perfMetrics['Draw: Islands'] || 0) + (performance.now() - tIslandsStart);
        }

        // --- Draw World-Space Elements (in rendering order) ---
        activeShoals.forEach(shoal => shoal.drawWorldSpace(ctx, effectiveScale, windDirection));
        activeCoralReefs.forEach(reef => reef.drawWorldSpace(ctx, effectiveScale, windDirection));

        // --- NEW: Draw Sinking Ships (Under-Grid Layer) ---
        // --- OPTIMIZATION: Viewport Culling ---
        const viewBuffer = 200; // Extra margin to prevent pop-in
        const viewBounds = {
            minX: cameraX - viewBuffer, maxX: cameraX + effectiveCanvasWidth + viewBuffer,
            minY: cameraY - viewBuffer, maxY: cameraY + effectiveCanvasHeight + viewBuffer
        };

        let tShipsStart = performance.now();
        // Draw the hull of ships that are mostly submerged (>50%) BEFORE the grid.
        const allActiveShips = [player, ...activeNpcs].filter(s => s);
        allActiveShips.forEach(ship => {
            if (ship.x < viewBounds.minX || ship.x > viewBounds.maxX || ship.y < viewBounds.minY || ship.y > viewBounds.maxY) return;
            if (ship.isSinking && (ship.sinkHp / ship.maxSinkHp) > 0.5) {
                ship.drawWorldSpace(ctx, effectiveScale, windDirection, 'sinking-hull');
            }
        });
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Draw: Ships'] = (perfMetrics['Draw: Ships'] || 0) + (performance.now() - tShipsStart);

        drawGrid(cameraX, cameraY, effectiveCanvasWidth, effectiveCanvasHeight);

        // Draw NPC paths in the world for debugging, if enabled
        drawNpcPaths(ctx, effectiveScale, activeNpcs);

        // Draw anchor line if applicable
        if (player && player.isAnchored && player.anchorPoint) {
            const anchorPointRadius = player.shipLength / 20;
            // --- FIX: Use the visual bow point for the anchor line start ---
            // This ensures the line connects to the visible tip of the ship,
            // matching the logic in applyAnchorPhysics.
            const playerBowPoint = player.getBowPointWorldCoords();

            ctx.fillStyle = ANCHOR_POINT_COLOR;
            ctx.beginPath();
            ctx.arc(player.anchorPoint.x, player.anchorPoint.y, anchorPointRadius * player.anchorPulseScale, 0, Math.PI * 2);
            ctx.fill();

            // Draw the solid and dashed parts of the anchor line
            ctx.strokeStyle = ANCHOR_LINE_COLOR;
            ctx.lineWidth = anchorPointRadius * 0.5;
            ctx.beginPath();
            ctx.moveTo(player.anchorPoint.x, player.anchorPoint.y);
            ctx.lineTo(playerBowPoint.x, playerBowPoint.y);
            ctx.stroke();

            ctx.strokeStyle = ANCHOR_LINE_DASH_COLOR;
            ctx.lineWidth = (anchorPointRadius * 0.75) * 0.5;
            ctx.setLineDash([5 / effectiveScale, 5 / effectiveScale]);
            ctx.beginPath();
            ctx.moveTo(player.anchorPoint.x, player.anchorPoint.y);
            ctx.lineTo(playerBowPoint.x, playerBowPoint.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // --- Draw Debug Visuals ---
        // Draw the combat range circles for any engaged NPC ship.
        activeNpcs.forEach(npc => {
            // Since all NPCs now use the same combat logic, we just need to check the AI state.
            // The 'pursuing' state is now part of the 'combat' state.
            if (npc.aiState === 'combat' || npc.aiState === 'fleeing') {
                ctx.save();
                ctx.lineWidth = 2 / effectiveScale;

                // 1. Max Engagement Range (Aggression = 0) - Yellow
                const maxRange = npc.shipLength * NPC_COMBAT_RANGE_MULTIPLIER;
                _drawDebugCircle(ctx, npc.x, npc.y, maxRange, 'rgba(255, 255, 0, 0.5)', [20, 10], effectiveScale);

                // 2. Close Edge (Max Aggression) - Red
                const closeEdge = npc.shipLength * 2; // 2 ship lengths
                _drawDebugCircle(ctx, npc.x, npc.y, closeEdge, 'rgba(255, 0, 0, 0.8)', [5, 5], effectiveScale);

                ctx.restore();
            }
        });

        // --- NEW: Fleet Debug ---
        if (DEBUG.ENABLED && fleetManager) {
            fleetManager.drawDebug(ctx);
        }

        // --- Draw Splashes ---
        drawSplashes(ctx, effectiveScale);
        
        const time = performance.now();

        let tIslandsStart2 = performance.now();
        // --- LAYER 1: Wet Sand & Deep Glow (Under Island) ---
        // This layer is now static (or very subtly pulsing) to represent the wet sand base.
        ctx.save();
        worldManager.getActiveObjects().statics.forEach(obstacle => {
            if (obstacle.shoreGlowCache) {
                ctx.drawImage(obstacle.shoreGlowCache, obstacle.shoreGlowOffset.x, obstacle.shoreGlowOffset.y);
            }
        });
        ctx.restore();

        // --- LAYER 2: Islands & Rocks (Landmass) ---
        // --- LAYER 3: Wave Break / Foam (Now part of Island draw) ---
        const viewport = { x: cameraX, y: cameraY, width: effectiveCanvasWidth, height: effectiveCanvasHeight };
        
        activeIslands.forEach(island => island.drawWorldSpace(ctx, effectiveScale, windDirection, shorelineRenderer, time, viewport));
        activeRocks.forEach(rock => rock.drawWorldSpace(ctx, effectiveScale, windDirection, shorelineRenderer, time, viewport));

        // --- NEW: Draw Debug Convex Hulls ---
        if (DEBUG.ENABLED && DEBUG.DRAW_CONVEX_HULLS && worldManager) {
            ctx.save();
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2 / effectiveScale;
            ctx.setLineDash([10 / effectiveScale, 10 / effectiveScale]);

            ctx.beginPath(); // --- OPTIMIZATION: Batch start ---
            worldManager.getActiveObjects().statics.forEach(obstacle => {
                if (obstacle.convexHull && obstacle.convexHull.length > 0) {
                    obstacle.convexHull.forEach((p, i) => {
                        if (i === 0) ctx.moveTo(p.x, p.y);
                        else ctx.lineTo(p.x, p.y);
                    });
                    ctx.closePath();
                }
            });
            ctx.stroke(); // --- OPTIMIZATION: Batch end ---
            ctx.restore();
        }
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Draw: Islands'] = (perfMetrics['Draw: Islands'] || 0) + (performance.now() - tIslandsStart2);

        // --- Draw Debug Aiming Lines ---
        // This is drawn after terrain but before cannonballs and ships for correct layering.
        activeNpcs.forEach(npc => {
            npc.drawAimingLine(ctx, effectiveScale);
        });

        // --- NEW: Draw Boarding Availability Indicator ---
        // If boarding conditions are met, "light up" both ships to signal that
        // a collision will now trigger the boarding action.
        if (player && !boardingState.isActive) {
            // --- OPTIMIZATION: Use spatial grid to only check nearby ships ---
            // Instead of iterating all active NPCs, query the grid for ships near the player.
            const searchRange = player.shipLength * 2;
            const queryAABB = {
                minX: player.x - searchRange,
                minY: player.y - searchRange,
                maxX: player.x + searchRange,
                maxY: player.y + searchRange
            };
            const potentialTargets = spatialGrid.query(queryAABB);

            for (const npc of potentialTargets) {
                if (npc instanceof NpcShip && player.canInitiateBoarding(npc)) {
                    ctx.save();
                    // Pulsing Gold glow effect
                    const pulse = (Math.sin(performance.now() / 200) + 1) / 2; // 0 to 1
                    const alpha = 0.5 + (pulse * 0.5); // 0.5 to 1.0
                    
                    // --- OPTIMIZATION: Use layered strokes instead of expensive shadowBlur ---
                    // 1. Draw "Glow" (Wider, transparent stroke)
                    ctx.strokeStyle = `rgba(255, 215, 0, ${alpha * 0.4})`; // Gold, lower alpha
                    ctx.lineWidth = 12 / effectiveScale;
                    ctx.beginPath();
                    ctx.arc(npc.x, npc.y, npc.shipLength * 0.75, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(player.x, player.y, player.shipLength * 0.75, 0, Math.PI * 2);
                    ctx.stroke();

                    // 2. Draw Core Line
                    ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`; // Gold
                    ctx.lineWidth = 3 / effectiveScale;
                    
                    // Draw circle around target
                    ctx.beginPath();
                    ctx.arc(npc.x, npc.y, npc.shipLength * 0.75, 0, Math.PI * 2);
                    ctx.stroke();

                    // Draw circle around player
                    ctx.beginPath();
                    ctx.arc(player.x, player.y, player.shipLength * 0.75, 0, Math.PI * 2);
                    ctx.stroke();
                    
                    ctx.restore();
                }
            }
        }

        let tEffectsStart = performance.now();
        cannonballs.forEach(ball => ball.drawWorldSpace(ctx, effectiveScale, windDirection));
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Draw: Effects'] = (perfMetrics['Draw: Effects'] || 0) + (performance.now() - tEffectsStart);
        
        // --- NEW: Draw Active Ships & Sinking Effects (Over-Grid Layer) ---
        // Split into two passes to ensure non-sinking ships are always drawn ON TOP of sinking ships.
        
        let tShipsStart2 = performance.now();
        // Pass 1: Sinking Ships
        allActiveShips.forEach(ship => {
            if (ship.x < viewBounds.minX || ship.x > viewBounds.maxX || ship.y < viewBounds.minY || ship.y > viewBounds.maxY) return;
            if (ship.isSinking) {
                if ((ship.sinkHp / ship.maxSinkHp) <= 0.5) {
                    ship.drawWorldSpace(ctx, effectiveScale, windDirection, 'full');
                } else {
                    ship.drawWorldSpace(ctx, effectiveScale, windDirection, 'sinking-effects');
                }
            }
        });

        // Pass 2: Non-Sinking Ships
        allActiveShips.forEach(ship => {
            if (ship.x < viewBounds.minX || ship.x > viewBounds.maxX || ship.y < viewBounds.minY || ship.y > viewBounds.maxY) return;
            if (!ship.isSinking) {
                ship.drawWorldSpace(ctx, effectiveScale, windDirection, 'full');
            }
        });
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Draw: Ships'] = (perfMetrics['Draw: Ships'] || 0) + (performance.now() - tShipsStart2);

        if (boardingState.isActive && !gameOverState.active) { // --- FIX: Hide boarding UI on Game Over ---
            drawBoardingUI(ctx, effectiveScale);
        }

        // --- NEW: Draw NPC Debug Overlays (Target Boxes, etc.) ---
        if (DEBUG.ENABLED) {
            activeNpcs.forEach(npc => npc.drawDebugOverlay(ctx, effectiveScale));
        }

        // --- Draw Damage Effects ---
        let tEffectsStart2 = performance.now();
        drawDamageEffects(ctx, effectiveScale);

        let tWorld = performance.now();
        // if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Draw: World Objects'] = (perfMetrics['Draw: World Objects'] || 0) + (tWorld - tWaves);

        // --- NEW: Draw Cannon Effects ---
        drawCannonEffects(ctx, effectiveScale);
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Draw: Effects'] = (perfMetrics['Draw: Effects'] || 0) + (performance.now() - tEffectsStart2);

        ctx.restore(); // Restore from camera transformations before drawing UI

        // --- NEW: Draw Night Overlay ---
        // Must be drawn in screen space (after restore) but before UI
        drawNightOverlay(ctx, effectiveScale);

        // --- NEW: World Buffer Warning Overlay ---
        if (player && !gameOverState.active && player.bufferPenetration > 0) {
            const penetration = player.bufferPenetration;

            if (penetration > 0) {
                const maxPenetration = WORLD_BUFFER / 2;
                const opacity = Math.min(1, penetration / maxPenetration);
                
                ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                if (opacity > 0.2) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
                    ctx.font = "30px 'IM Fell English', serif";
                    ctx.textAlign = "center";
                    ctx.fillText("Turn back!", canvas.width / 2, canvas.height / 4);
                }
            }
        }

        // --- Draw UI Elements (fixed to canvas) ---
        // --- NEW: Pass correct NPC lists to UI functions ---
        // The minimap gets ALL npc data for dots, but only ACTIVE npcs for paths.
        // The HUD only needs ACTIVE npcs for its logic.
        
        // --- FIX: Only draw HUD elements if the player exists AND Game Over is not active ---
        if (player && !gameOverState.active) {
            ctx.save();
            drawWindDial(ctx, canvas, windDirection);
            const allNpcMapData = worldManager ? worldManager.getAllNpcMapData() : [];
            const allStaticObjects = worldManager ? worldManager.getAllStaticObjects() : [];

            drawMiniMap(ctx, { canvas, player, allNpcs: allNpcMapData, activeNpcs: activeNpcs, windDirection, minimapCache: minimapCacheCanvas, worldManager });
            drawHud(ctx, canvas, player, windDirection, activeNpcs, boardingState, hudMode, screenMouseX, screenMouseY, dayNightTimer);
            drawHudControls(ctx, canvas, player, hudMode, hudButtonClickTimes, screenMouseX, screenMouseY);
            
            if (window.fleetUI && fleetManager) window.fleetUI.drawFleetStatus(ctx, fleetManager);

            if (mapAnimationProgress > 0) {
                drawExpandedMap(ctx, { canvas, player, allStaticObstacles: allStaticObjects, npcs: allNpcMapData, windDirection, worldManager, minimapCache: minimapCacheCanvas }, mapAnimationProgress);
            }
            ctx.restore();
        }

        // --- NEW: Apply CSS Filters for Game Over ---
        if (gameOverState.active) {
            const progress = Math.min(1, gameOverState.timer / gameOverState.duration);
            
            // --- NEW: Erratic Pulse Calculation ---
            // Create a slow, irregular pulse using two sine waves with prime periods.
            const t = performance.now();
            const wave1 = Math.sin(t / 700); // Faster: ~4.4s period
            const wave2 = Math.sin(t / 1100 + 2); // Faster: ~6.9s period
            // Combine and normalize to 0..1 range.
            // Scale intensity so it clears up by at most 60% (0.6) for a more noticeable effect.
            const pulseIntensity = 0.6; 
            const pulseFactor = ((wave1 + wave2 + 2) / 4) * pulseIntensity * progress;

            // Calculate CSS values
            const blurPx = (progress * GAME_OVER_BLUR_RADIUS) * (1 - pulseFactor);
            const grayPct = (progress * 100) * (1 - pulseFactor);
            
            // Brightness: Base is 25% (at max progress). Pulse moves it towards 100%.
            const baseBright = 100 - (progress * 75);
            const brightPct = baseBright + (pulseFactor * (100 - baseBright));

            // Apply to canvas element
            const filterString = `blur(${blurPx.toFixed(2)}px) grayscale(${grayPct.toFixed(1)}%) brightness(${brightPct.toFixed(1)}%)`;
            if (filterString !== gameOverState.lastFilterString) {
                canvas.style.filter = filterString;
                gameOverState.lastFilterString = filterString;
            }

            // Fade in HTML Overlay
            if (gameOverOverlay) {
                // Optimization: Avoid DOM updates once fully opaque
                if (progress !== gameOverState.lastOpacity) {
                    gameOverOverlay.style.opacity = progress;
                    gameOverState.lastOpacity = progress;
                }
                const prompt = document.getElementById('game-over-prompt');
                if (prompt) {
                    if (gameOverState.canRestart) {
                        if (!prompt.classList.contains('game-over-pulse')) {
                            prompt.style.opacity = '1';
                            prompt.classList.add('game-over-pulse');
                        }
                    } else {
                        prompt.style.opacity = '0';
                        prompt.classList.remove('game-over-pulse');
                    }
                }
            }
        } else {
            // Ensure filter is clear during normal gameplay
            if (canvas.style.filter !== 'none') canvas.style.filter = 'none';
        }

        let tUI = performance.now();
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Draw: UI'] = (perfMetrics['Draw: UI'] || 0) + (tUI - tWorld);
    }

    /**
     * Draws the calculated paths for NPC ships in the main world view for debugging.
     * The path is rendered as a series of arrows pointing towards the destination.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} worldToScreenScale - The current world to screen scale factor.
     * @param {Array<NpcShip>} npcsToDraw - The list of NPCs whose paths should be drawn.
     */
    function drawNpcPaths(ctx, worldToScreenScale, npcsToDraw) {
        if (!DEBUG.ENABLED || !DEBUG.DRAW_NPC_DESTINATIONS) return;

        ctx.save();
        // --- OPTIMIZATION: Use dashed lines instead of hundreds of arrows ---
        ctx.lineWidth = 2 / worldToScreenScale;
        ctx.setLineDash([10 / worldToScreenScale, 10 / worldToScreenScale]);

        // --- OPTIMIZATION: Batch paths into Path2D objects to reduce draw calls ---
        const standardPath = new Path2D();
        const hunterPath = new Path2D();
        const standardDots = new Path2D();
        const hunterDots = new Path2D();
        
        let hasStandard = false;
        let hasHunter = false;
        const dotRadius = 3 / worldToScreenScale;

        npcsToDraw.forEach(npc => {
            if (npc.pathWaypoints.length > 0) {
                const targetPath = npc.isPirateHunter ? hunterPath : standardPath;
                const targetDots = npc.isPirateHunter ? hunterDots : standardDots;
                
                if (npc.isPirateHunter) hasHunter = true;
                else hasStandard = true;

                // Start the line from the NPC's current position
                targetPath.moveTo(npc.x, npc.y);
                
                // Add start dot
                targetDots.moveTo(npc.x + dotRadius, npc.y);
                targetDots.arc(npc.x, npc.y, dotRadius, 0, Math.PI * 2);

                // Draw a line to each waypoint in the calculated path
                for (let i = npc.currentWaypointIndex; i < npc.pathWaypoints.length; i++) {
                    const p = npc.pathWaypoints[i];
                    targetPath.lineTo(p.x, p.y);
                    
                    // Add waypoint dot (MoveTo ensures no connecting line)
                    targetDots.moveTo(p.x + dotRadius, p.y);
                    targetDots.arc(p.x, p.y, dotRadius, 0, Math.PI * 2);
                }
            }
        });

        if (hasStandard) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.stroke(standardPath);
            ctx.fill(standardDots);
        }

        if (hasHunter) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.stroke(hunterPath);
            ctx.fill(hunterDots);
        }

        ctx.restore();
    }

    /**
     * Creates a single wavelet object at a specific location.
     */
    function createWavelet(x, y) {
        let w;
        if (waveletPool.length > 0) {
            w = waveletPool.pop();
        } else {
            w = {};
        }

        const r = Math.random();
        // Assign properties directly to w
        w.x = x; w.y = y; w.life = 0;

        // Power Law Distribution
        if (r < 0.70) {
            w.type = 'texture';
            w.width = 5 + Math.random() * 10;
            w.maxLife = 1000 + Math.random() * 1000;
            w.speed = 0;
            w.amplitude = w.width * 0.8;
            w.maxOpacity = 0.2 + Math.random() * 0.2;
        } else if (r < 0.95) {
            w.type = 'chop';
            w.width = 30 + Math.random() * 50;
            w.maxLife = 2000 + Math.random() * 2000;
            w.speed = 10 + Math.random() * 10;
            w.amplitude = w.width * 0.6;
            w.maxOpacity = 0.3 + Math.random() * 0.3;
        } else {
            w.type = 'swell';
            w.width = 150 + Math.random() * 150;
            w.maxLife = 5000 + Math.random() * 5000;
            w.speed = 5 + Math.random() * 5;
            w.amplitude = w.width * 0.4;
            w.maxOpacity = 0.1 + Math.random() * 0.1;
        }

        w.angleOffset = (Math.random() - 0.5) * 0.3;
        w.skew = (Math.random() - 0.5) * (w.width * 0.25);

        return w;
    }

    /**
     * Updates the state of all wavelets.
     */
    function updateWavelets(deltaTime) {
        const effectiveScale = worldToScreenScale * currentZoomMultiplier;
        const viewWidth = canvas.width / effectiveScale;
        const viewHeight = canvas.height / effectiveScale;
        const targetCount = 150; // Max wavelets

        // Spawn new wavelets if needed
        if (wavelets.length < targetCount) {
            // --- NEW: Wave Sets & Edge Loading ---
            // Spawn a cluster (1-3 waves) at a time
            const clusterSize = Math.floor(Math.random() * 3) + 1;
            
            let cx, cy;
            const buffer = 300;

            // 50% chance to spawn upwind (Edge Loading), 50% random fill
            if (Math.random() < 0.5) {
                const upwindAngle = windDirection + Math.PI;
                // Pick a point on a circle surrounding the view, biased upwind
                const dist = Math.max(viewWidth, viewHeight) / 2 + buffer;
                cx = cameraX + viewWidth/2 + Math.cos(upwindAngle) * dist;
                cy = cameraY + viewHeight/2 + Math.sin(upwindAngle) * dist;
                
                // Spread perpendicular to wind to cover the "horizon"
                const perpAngle = upwindAngle + Math.PI/2;
                const spread = (Math.random() - 0.5) * Math.max(viewWidth, viewHeight) * 1.5;
                cx += Math.cos(perpAngle) * spread;
                cy += Math.sin(perpAngle) * spread;
            } else {
                cx = cameraX - buffer + Math.random() * (viewWidth + 2 * buffer);
                cy = cameraY - buffer + Math.random() * (viewHeight + 2 * buffer);
            }

            for (let i = 0; i < clusterSize; i++) {
                // Scatter slightly within the cluster
                const ox = (Math.random() - 0.5) * 100;
                const oy = (Math.random() - 0.5) * 100;
                wavelets.push(createWavelet(cx + ox, cy + oy));
            }
        }

        for (let i = wavelets.length - 1; i >= 0; i--) {
            const w = wavelets[i];
            w.life += deltaTime;

            // Move with wind
            if (w.speed > 0) {
                w.x += Math.cos(windDirection) * w.speed * (deltaTime / 1000);
                w.y += Math.sin(windDirection) * w.speed * (deltaTime / 1000);
            }

            // Remove if expired or far out of view
            const buffer = 300;
            if (w.life >= w.maxLife || 
                w.x < cameraX - buffer || w.x > cameraX + viewWidth + buffer ||
                w.y < cameraY - buffer || w.y > cameraY + viewHeight + buffer) {
                // Return to pool
                waveletPool.push(w);
                
                // --- OPTIMIZATION: Swap-and-Pop (O(1)) instead of Splice (O(N)) ---
                // Order doesn't matter for wavelets.
                wavelets[i] = wavelets[wavelets.length - 1];
                wavelets.pop();
            }
        }
    }

    /**
     * Draws all active wavelets.
     */
    function drawWavelets(ctx, scale) {
        if (!spatialGrid) return; // Failsafe if grid isn't ready

        ctx.save();
        ctx.lineCap = 'round';
        const time = performance.now() / 1000; // Time in seconds for animation

        // --- NEW: Shore Break Effect Constants ---
        const maxInfluenceDistance = 500; // How far from an island a wave is affected

        for (const w of wavelets) {
            const progress = w.life / w.maxLife;
            let alpha = w.maxOpacity;
            let sizeScale = 1.0;

            // --- NEW: Lifecycle Scaling ---
            if (progress < 0.2) {
                alpha *= (progress / 0.2);
                sizeScale = 0.5 + (0.5 * (progress / 0.2)); // Grow 50% -> 100%
            } else if (progress > 0.8) {
                alpha *= ((1 - progress) / 0.2);
                sizeScale = 1.0 - (0.2 * ((progress - 0.8) / 0.2)); // Shrink 100% -> 80%
            }

            // --- NEW: Dynamic Amplitude (Swell Effect) ---
            // Waves rise and fall over their lifespan (0 -> 1 -> 0)
            const swellProgress = Math.sin(progress * Math.PI);
            const currentAmplitude = w.amplitude * (0.3 + 0.7 * swellProgress);

            ctx.globalAlpha = alpha;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; // Use fill instead of stroke

            // --- NEW: Calculate Wave Angle ---
            let finalAngle;
            const windAngle = (windDirection - Math.PI / 2) + w.angleOffset;
            
            let closestIsland = null;
            let closestDist = Infinity;
            let closestShorePoint = null;

            // 1. Find nearest island efficiently
            // --- OPTIMIZATION: Iterate activeIslands instead of allocating for spatial query ---
            // activeIslands is already culled to the viewport by WorldManager
            for (const obs of activeIslands) {
                if (obs.type === 'island') {
                    // Fast rejection using bounding box/radius
                    if (obs.boundingRadius) {
                        const dx = w.x - obs.x;
                        const dy = w.y - obs.y;
                        const distToCenter = Math.sqrt(dx*dx + dy*dy);
                        if (distToCenter > obs.boundingRadius + maxInfluenceDistance) continue;
                    }

                    // Use convex hull for accurate shore distance
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

            // 2. Blend angle if island is found
            if (closestIsland && closestDist < maxInfluenceDistance) {
                const proximityFactor = 1.0 - (closestDist / maxInfluenceDistance);
                // Angle from wave to closest shore point
                const angleToShore = Math.atan2(closestShorePoint.y - w.y, closestShorePoint.x - w.x);
                // The wave crest should be perpendicular to this line
                const shoreAngle = angleToShore - Math.PI / 2;
                
                // Use the new utility function to blend angles correctly
                finalAngle = lerpAngle(windAngle, shoreAngle, proximityFactor);
            } else {
                finalAngle = windAngle;
            }

            ctx.save();
            ctx.translate(w.x, w.y);
            ctx.rotate(finalAngle); // Use the calculated final angle
            ctx.scale(sizeScale, 1.0); // Apply lifecycle scaling
            
            // --- Multi-Sine Wave Effect (Matches Sinking Overlay) ---
            ctx.beginPath();
            // OPTIMIZATION: Reduce resolution. Divide width by 4 instead of 2.
            const rawNumPoints = Math.max(6, Math.ceil(w.width / 4));
            const numPoints = Math.min(rawNumPoints, WAVELET_MAX_POINTS - 1); // Clamp to buffer size

            // Optimization: Use scalars instead of objects
            const p0x = -w.width / 2;
            const p0y = 0;
            const p1x = w.skew;
            const p1y = -currentAmplitude; // Control point
            const p2x = w.width / 2;
            const p2y = 0;

            // Base amplitude for the texture noise
            // Clamp noise to 50% of current height so the base curve shape remains dominant
            const noiseAmp = Math.min(4, w.width * 0.10, currentAmplitude * 0.5);

            // Determine max thickness for the marquise shape (tapered oval)
            // Use fixed world units so thickness scales naturally with the ship/zoom.
            const centerThickness = (w.type === 'swell' ? 24.0 : 12.0);

            for (let i = 0; i <= numPoints; i++) {
                const t = i / numPoints;
                const invT = 1 - t;
                
                // Quadratic Bezier Point (Base Shape)
                const bx = (invT * invT * p0x) + (2 * invT * t * p1x) + (t * t * p2x);
                const by = (invT * invT * p0y) + (2 * invT * t * p1y) + (t * t * p2y);

                // Multi-Sine Offset (Texture) - Matches baseship.js frequencies
                const y1 = Math.sin(bx * 0.025 + time * 2.0) * (noiseAmp * 1.5); // Long swell
                const y2 = Math.sin(bx * 0.075 + time * 5.0) * (noiseAmp * 1.2); // Main wave
                const y3 = Math.sin(bx * 0.20 + time * 12.0) * (noiseAmp * 1.0); // Fast chop
                
                const wy = y1 + y2 + y3;

                // --- OPTIMIZATION: Use a parabolic approximation instead of Math.sin() ---
                // The curve 4*t*(1-t) is a fast, visually similar alternative to sin(t*PI) for a 0->1->0 arc.
                const thickness = centerThickness * (4 * t * (1 - t));

                // Store in shared arrays
                waveletTopX[i] = bx;
                waveletTopY[i] = by + wy - thickness / 2;
                waveletBottomX[i] = bx;
                waveletBottomY[i] = by + wy + thickness / 2;
            }

            // Draw Top Edge (Left to Right)
            ctx.moveTo(waveletTopX[0], waveletTopY[0]);
            for (let i = 1; i <= numPoints; i++) {
                ctx.lineTo(waveletTopX[i], waveletTopY[i]);
            }
            
            // Draw Bottom Edge (Right to Left) to close the shape
            for (let i = numPoints; i >= 0; i--) {
                ctx.lineTo(waveletBottomX[i], waveletBottomY[i]);
            }

            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    /**
     * Creates a visual splash effect at the given coordinates.
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     */
    function createSplash(x, y) {
        // Performance: Limit max splashes to prevent overload
        if (splashes.length > 50) {
            const old = splashes.shift();
            splashPool.push(old); // Recycle
        }
        
        let splash;
        if (splashPool.length > 0) {
            splash = splashPool.pop();
            splash.x = x; splash.y = y;
            splash.life = 0;
            splash.maxLife = 600; splash.maxRadius = 15;
        } else {
            splash = {
                x: x, y: y,
                life: 0,
                maxLife: 600, // 600ms duration
                maxRadius: 15 // Max radius in world units
            };
        }
        splashes.push(splash);
    }

    /**
     * Draws all active splashes.
     */
    function drawSplashes(ctx, scale) {
        if (splashes.length === 0) return;

        ctx.save();
        splashes.forEach(splash => {
            const progress = splash.life / splash.maxLife;
            const radius = splash.maxRadius * Math.sin(progress * Math.PI / 2); // Ease out
            const alpha = 1 - progress;

            // Fill (Foam)
            ctx.beginPath();
            ctx.arc(splash.x, splash.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(230, 245, 255, ${alpha * 0.6})`;
            ctx.fill();
            
            // Stroke (Ripple)
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
            ctx.lineWidth = 1.5 / scale;
            ctx.stroke();
        });
        ctx.restore();
    }

    /**
     * Creates a visual damage effect (explosion) at the given coordinates.
     * @param {number} x - World X position.
     * @param {number} y - World Y position.
     * @param {number} [scale=1.0] - Scale factor for the effect size.
     */
    function createDamageEffect(x, y, scale = 1.0) {
        // Performance: Limit max effects to prevent overload
        if (damageEffects.length > 20) {
            const old = damageEffects.shift();
            damageEffectPool.push(old); // Recycle
        }
        
        let effect;
        const numPoints = 7; // Odd number looks more jagged/natural

        if (damageEffectPool.length > 0) {
            effect = damageEffectPool.pop();
            effect.x = x; effect.y = y;
            effect.life = 0; effect.maxLife = 300;
            effect.maxRadius = 40 * scale;
            effect.rotation = Math.random() * Math.PI * 2;
            effect.rotSpeed = (Math.random() - 0.5) * 0.2;
            // Reuse existing points array
        } else {
            effect = {
                x: x, y: y,
                life: 0, maxLife: 300,
                maxRadius: 40 * scale,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.2,
                points: []
            };
            // Pre-fill points array
            for (let i = 0; i < numPoints * 2; i++) effect.points.push({x:0, y:0});
        }

        // Update points geometry
        for (let i = 0; i < numPoints * 2; i++) {
            const angle = (Math.PI * 2 * i) / (numPoints * 2);
            const isOuter = i % 2 === 0;
            // Randomize radii for "explosive" look
            const r = isOuter ? (0.8 + Math.random() * 0.4) : (0.3 + Math.random() * 0.2);
            effect.points[i].x = Math.cos(angle) * r;
            effect.points[i].y = Math.sin(angle) * r;
        }

        damageEffects.push(effect);
    }

    /**
     * Draws all active damage effects.
     */
    function drawDamageEffects(ctx, scale) {
        if (damageEffects.length === 0) return;

        const sprite = getExplosionSprite();
        damageEffects.forEach(effect => {
            const progress = effect.life / effect.maxLife;
            // Expand quickly, then slow down
            const expansion = 0.3 + 0.7 * Math.sin(progress * Math.PI / 2);
            const alpha = 1 - progress;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(effect.x, effect.y);
            ctx.rotate(effect.rotation + (effect.rotSpeed * effect.life));
            ctx.scale(expansion, expansion);
            
            // Draw cached sprite centered
            // Sprite is 64x64. Scale it to match effect.maxRadius (approx 40)
            const drawSize = effect.maxRadius * 2;
            ctx.drawImage(sprite, -drawSize/2, -drawSize/2, drawSize, drawSize);
            
            // Optional: Add a smaller, brighter inner layer using the same sprite
            ctx.globalCompositeOperation = 'lighter';
            ctx.scale(0.7, 0.7);
            ctx.drawImage(sprite, -drawSize/2, -drawSize/2, drawSize, drawSize);
            
            ctx.restore();
        });
    }

    /**
     * NEW: Draws all active cannon fire and smoke effects.
     */
    function drawCannonEffects(ctx, scale) {
        if (cannonEffects.length === 0) return;

        // --- OPTIMIZATION: Get sprites once per frame ---
        const fireSprite = Ship.getCannonFireSprite();
        const smokeSprite = Ship.getCannonSmokeSprite();

        ctx.save();
        for (const p of cannonEffects) {
            if (p.type === 'fire') {
                const progress = p.life / p.maxLife;
                const alpha = 1.0 - progress;
                const size = p.size * (1.0 - progress); // Shrinks to nothing

                ctx.globalAlpha = alpha;
                // OPTIMIZATION: Manual transform instead of save/restore
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                
                // Sprite is 256x64. We draw it scaled.
                // Base height is 1.5x cannonball radius.
                const height = CANNON_UNIT_SIZE;
                // Base length is 4x cannonball radius.
                const length = CANNON_UNIT_SIZE * 5;
                
                ctx.drawImage(fireSprite, 0, -height / 2, length * size, height * size);
                
                ctx.rotate(-p.angle);
                ctx.translate(-p.x, -p.y);

            } else if (p.type === 'smoke') {
                const progress = p.life / p.maxLife;
                // Fade in quickly, then fade out slowly
                let alpha;
                if (progress < 0.1) {
                    alpha = progress / 0.1;
                } else {
                    alpha = 1.0 - ((progress - 0.1) / 0.9);
                }
                alpha *= 0.6; // Max opacity

                ctx.globalAlpha = alpha;
                // OPTIMIZATION: Manual transform instead of save/restore
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                
                // Sprite is 64x64. Base size is 2x cannonball radius.
                // --- FIX: Increase smoke size multiplier from 24 to 48 (Double size) ---
                const size = (CANNON_UNIT_SIZE / 4) * 48 * p.size;
                ctx.drawImage(smokeSprite, -size / 2, -size / 2, size, size);
                
                ctx.rotate(-p.rotation);
                ctx.translate(-p.x, -p.y);
            }
        }
        // Restore global alpha and other states
        ctx.globalAlpha = 1.0;
        ctx.restore();
    }
    /**
     * Updates the state of all dynamic entities (ships, cannonballs).
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    function updateEntities(deltaTime) {
        // Update all ships (player and NPCs)
        allShips.forEach(ship => {
            // This now correctly calls the specialized update methods
            // on the PlayerShip and NpcShip classes.
            // on the PlayerShip and NpcShip classes, passing the keys object for the player,
            // the player object for the NPCs to target, the wind direction for physics, the cannonballs
            // array for firing, and the islands array for NPC navigation.
            ship.update(deltaTime, keys, player, windDirection, cannonballs, volleys, activeIslands, activeNpcs, pathfinder, spatialGrid);
        });

        // --- NEW: Update Cannon Effects ---
        for (let i = cannonEffects.length - 1; i >= 0; i--) {
            const p = cannonEffects[i];
            p.life += deltaTime;

            if (p.type === 'smoke') {
                p.x += p.vx * (deltaTime / 16);
                p.y += p.vy * (deltaTime / 16);
                p.rotation += p.rotSpeed * (deltaTime / 16);
                // Grow quickly then slow down
                if (p.size < p.maxSize) {
                    p.size += (p.maxSize - p.size) * 0.05 * (deltaTime / 16);
                }
            }

            if (p.life >= p.maxLife) {
                if (p.type === 'fire') {
                    releaseCannonFireParticle(p);
                } else if (p.type === 'smoke') {
                    releaseCannonSmokeParticle(p);
                }
                cannonEffects.splice(i, 1);
            }
        }

        // Update splashes
        for (let i = splashes.length - 1; i >= 0; i--) {
            const splash = splashes[i];
            splash.life += deltaTime;
            if (splash.life >= splash.maxLife) {
                splashPool.push(splash); // Return to pool
                splashes.splice(i, 1);
            }
        }

        // Update damage effects
        for (let i = damageEffects.length - 1; i >= 0; i--) {
            const effect = damageEffects[i];
            effect.life += deltaTime;
            if (effect.life >= effect.maxLife) {
                damageEffectPool.push(effect); // Return to pool
                damageEffects.splice(i, 1);
            }
        }

        // --- FIX: Update cannonballs AFTER ships have updated. ---
        // This ensures that any cannonballs created during a ship's update (e.g., from a rolling broadside)
        // have their position updated in the same frame, preventing immediate self-collision.
        cannonballs.forEach(ball => {
            ball.update();
            if (ball.distanceTraveled > ball.maxDistance) {
                ball.markedForRemoval = true;
                // Trigger splash effect when cannonball hits the water (max distance)
                createSplash(ball.x, ball.y);
            }
        });

        // --- NEW: Update Volleys ---
        volleys.forEach(volley => {
            volley.update();
            if (volley.distanceTraveled > CANNONBALL_MAX_TRAVEL_DISTANCE) {
                volley.markedForRemoval = true;
            }
        });

        // Note: Final velocity-based movement for ships is now handled inside handleAllCollisions
        // to support Continuous Collision Detection (CCD).
    }

    /**
     * NEW: Creates the visual effect for a cannon firing.
     * @param {number} x - World X position of the muzzle.
     * @param {number} y - World Y position of the muzzle.
     * @param {number} angle - The angle of the cannon fire in radians.
     * @param {number} windDirection - The current wind direction.
     */
    function createCannonEffect(x, y, angle, windDirection) {
        // 1. Create Fire Flash
        const fire = getCannonFireParticle();
        fire.type = 'fire';
        fire.x = x;
        fire.y = y;
        fire.angle = angle;
        fire.life = 0;
        fire.maxLife = 500; // Doubled flash duration
        fire.size = 1.0 + Math.random() * 0.2; // Initial size multiplier
        cannonEffects.push(fire);

        // 2. Create Smoke Puff
        const smoke = getCannonSmokeParticle();
        smoke.type = 'smoke';
        smoke.x = x;
        smoke.y = y;
        smoke.life = 0;
        smoke.maxLife = 4000 + Math.random() * 2000; // 4-6 seconds
        smoke.size = 0.2; // Starts small
        smoke.maxSize = 1.0 + Math.random() * 0.5;
        smoke.rotation = Math.random() * Math.PI * 2;
        smoke.rotSpeed = (Math.random() - 0.5) * 0.01;
        smoke.vx = (Math.cos(angle) * (2 + Math.random())) + (Math.cos(windDirection) * (0.5 + Math.random() * 0.5));
        smoke.vy = (Math.sin(angle) * (2 + Math.random())) + (Math.sin(windDirection) * (0.5 + Math.random() * 0.5));
        cannonEffects.push(smoke);
    }
    // --- NEW: Boarding Logic ---
    function startBoarding(target, contactPoint) {
        if (boardingState.isActive) return;
        
        console.log(`[Boarding] Initiated with ${target.shipId}`);
        boardingState.isActive = true;
        boardingState.target = target;
        boardingState.jointPoint = contactPoint; // The pivot point in world space
        boardingState.tension = 0;
        boardingState.crewProjectiles = [];
        
        // --- NEW: Check for immediate surrender condition (No Crew, Already Surrendered, or Allied) ---
        if (target.crew <= 0 || target.aiState === 'surrendered' || target.isAllied) {
            boardingState.isInventoryOpen = true;
            // Only set to surrendered if it's an enemy. Allies keep their state (e.g. 'formation').
            if (!target.isAllied) {
                target.aiState = 'surrendered';
            }
            target.isSailOpen = false;
            player.isSailOpen = false;

            // Open Inventory UI immediately
            if (window.openInventoryMenu) {
                window.openInventoryMenu(target, player);
                // --- NEW: Rank Update for Boarding ---
                if (target instanceof NpcShip && !target.hasBeenBoardedByPlayer) {
                    target.hasBeenBoardedByPlayer = true;
                    player.stats.shipsBoarded++;
                    player.updateRank();
                }
                inventoryTarget = target;
            }
        } else {
            boardingState.isInventoryOpen = false;
            target.aiState = 'boarded'; // Lock AI state to prevent sailing away
            target.isSailOpen = false; // Stop sailing
            player.isSailOpen = false; // Stop player sailing (initial shock)
        }

        // --- NEW: Clear abandon timer so it doesn't wake up while we are boarding ---
        target.abandonedTime = null;
    }

    function endBoarding() {
        if (!boardingState.isActive) return;
        console.log(`[Boarding] Ended.`);
        
        if (boardingState.target) {
            // --- FIX: Only resume combat if the ship hasn't surrendered AND isn't allied ---
            if (boardingState.target.aiState !== 'surrendered' && !boardingState.target.isAllied) {
                boardingState.target.aiState = 'combat'; // Resume combat
                boardingState.target.resetFailsafeState();
            } else {
                // Explicitly ensure sails are closed if surrendered
                boardingState.target.isSailOpen = false;
            }
        }
        
        boardingState.isActive = false;
        boardingState.isInventoryOpen = false;
        boardingState.target = null;
        boardingState.jointPoint = null;
        boardingState.crewProjectiles = []; // Clear projectiles to release references

        // --- NEW: Close Inventory UI if boarding ends ---
        // This ensures that if the lines snap (e.g. player pulls away), the menu closes.
        const inventoryScreen = document.getElementById('inventory-screen');
        if (inventoryScreen) {
            // --- NEW: Clear timers when closing ---
            inventoryScreen.style.display = 'none';
        }
        const cargoDialog = document.getElementById('cargo-action-dialog');
        if (cargoDialog) {
            cargoDialog.style.display = 'none';
        }
        inventoryTarget = null;
    }

    /**
     * New: Centralized function to close the inventory and update state.
     * If boarding a surrendered ship, this also ends the boarding action.
     */
    function closeInventory() {
        // --- OPTIMIZATION: Clear the UI refresh interval when closing the menu ---
        if (window.inventoryRefreshIntervalId) {
            clearInterval(window.inventoryRefreshIntervalId);
            window.inventoryRefreshIntervalId = null;
        }

        const inventoryScreen = document.getElementById('inventory-screen');
        if (inventoryScreen) {
            inventoryScreen.style.display = 'none';
        }
        const cargoDialog = document.getElementById('cargo-action-dialog');
        if (cargoDialog) {
            cargoDialog.style.display = 'none';
        }
        boardingState.isInventoryOpen = false;
        inventoryTarget = null;

        // If we are currently boarding a surrendered or allied ship, closing the menu
        // implies we are done with the interaction, so we disconnect.
        if (boardingState.isActive && boardingState.target && (boardingState.target.aiState === 'surrendered' || boardingState.target.isAllied)) {
            endBoarding();
        }
    }

    function updateBoardingLogic(deltaTime) {
        if (!player || !boardingState.target) {
            endBoarding();
            return;
        }

        // --- NEW: NPC Boarding AI ---
        if (boardingState.target instanceof NpcShip && !boardingState.isInventoryOpen) {
            updateNpcBoardingAI(deltaTime);
        }

        // --- NEW: Check for surrender state change from NPC AI ---
        // If the target ship's AI decides to surrender (e.g., due to low HP),
        // this transitions the boarding action into a plundering action.
        if (boardingState.target.aiState === 'surrendered' && !boardingState.isInventoryOpen) {
            console.log(`[Boarding] Target ${boardingState.target.shipId} surrendered due to low power!`);
            boardingState.isInventoryOpen = true;
            
            // Open the Inventory UI
            if (window.openInventoryMenu) {
                window.openInventoryMenu(boardingState.target);
                // --- NEW: Rank Update for Boarding ---
                if (boardingState.target instanceof NpcShip && !boardingState.target.hasBeenBoardedByPlayer) {
                    boardingState.target.hasBeenBoardedByPlayer = true;
                    player.stats.shipsBoarded++;
                    player.updateRank();
                }
                inventoryTarget = boardingState.target;
            }
        }
        const target = boardingState.target;

        // 1. Joint Physics (Soft Lock)
        // Keep ships together but allow rotation around the joint.
        // We apply a spring force to pull them towards the joint point relative to their current angle.
        // For simplicity in this iteration, we will dampen their relative velocities heavily.
        
        // Average velocity dampening (friction between hulls)
        const avgVx = (player.vx + target.vx) / 2;
        const avgVy = (player.vy + target.vy) / 2;
        
        player.vx = player.vx * 0.9 + avgVx * 0.1;
        player.vy = player.vy * 0.9 + avgVy * 0.1;
        target.vx = target.vx * 0.9 + avgVx * 0.1;
        target.vy = target.vy * 0.9 + avgVy * 0.1;

        // 2. Tension Meter Logic
        // Calculate vector from target to player
        const dx = player.x - target.x;
        const dy = player.y - target.y;
        const angleToPlayer = Math.atan2(dy, dx);
        
        // Check if player is steering AWAY from the target
        // Player heading vs Angle to Player. If they align, player is pulling away.
        let angleDiff = normalizeAngle(player.angle - angleToPlayer);
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        
        const isPullingAway = Math.abs(angleDiff) < Math.PI / 2; // Within 90 degrees of "away"
        const pullForce = Math.sqrt(player.vx**2 + player.vy**2); // Use speed as force proxy

        if (isPullingAway && pullForce > 0.5) {
            boardingState.tension += BOARDING_TENSION_BUILD_RATE * (deltaTime / 16);
        } else {
            boardingState.tension = Math.max(0, boardingState.tension - BOARDING_TENSION_DECAY_RATE * (deltaTime / 16));
        }

        if (boardingState.tension >= BOARDING_TENSION_BREAK_THRESHOLD) {
            console.log("[Boarding] Lines snapped! Breaking free.");
            endBoarding();
            return;
        }

        // --- NEW: Inventory State Logic ---
        // If the inventory is open, we maintain the connection (physics above) but skip crew combat.
        if (boardingState.isInventoryOpen) {
            return;
        }

        // --- NEW: Projectile Interception (Crew vs Crew) ---
        // Check for collisions between opposing crew projectiles.
        for (let i = 0; i < boardingState.crewProjectiles.length; i++) {
            for (let j = i + 1; j < boardingState.crewProjectiles.length; j++) {
                const p1 = boardingState.crewProjectiles[i];
                const p2 = boardingState.crewProjectiles[j];
                
                // If projectiles are from different owners and collide, they cancel out.
                if (p1.owner !== p2.owner && !p1.markedForRemoval && !p2.markedForRemoval) {
                    // --- OPTIMIZATION: Use squared distance to avoid sqrt ---
                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    if (dx * dx + dy * dy < 100) { // 10^2 = 100
                        p1.markedForRemoval = true;
                        p2.markedForRemoval = true;
                    }
                }
            }
        }

        // 3. Update Crew Projectiles
        for (let i = boardingState.crewProjectiles.length - 1; i >= 0; i--) {
            const p = boardingState.crewProjectiles[i];
            p.x += p.vx;
            p.y += p.vy;
            
            // Check hit on target
            const dist = distance(p, p.target);
            
            if (p.markedForRemoval) {
                boardingState.crewProjectiles.splice(i, 1);
                continue;
            }

            if (dist < p.target.shipLength / 3) { // Hit deck area
                // Apply Crew Damage
                p.target.crew = Math.max(0, p.target.crew - 1);
                boardingState.crewProjectiles.splice(i, 1);
                
                // --- NEW: Recover Crew ---
                // Successful hit! Add to recovering pool.
                if (p.owner.recoveringCrew !== undefined) p.owner.recoveringCrew++;

                // Check Win Condition
                if (p.target.crew <= 0) {
                    // --- NEW: Player Defeat Condition ---
                    if (p.target === player) {
                        console.log("[Boarding] Player crew eliminated! Game Over.");
                        triggerGameOver('Captured');
                        return;
                    }

                    // --- FIX: Prevent multiple triggers in the same frame ---
                    if (boardingState.isActive && !boardingState.isInventoryOpen) {
                        console.log(`[Boarding] ${p.target.shipId} surrendered!`);
                        // --- NEW: Trigger Surrender instead of sinking ---
                        p.target.aiState = 'surrendered';
                        p.target.isSailOpen = false;
                        
                        // --- NEW: Enter Boarded Inventory State ---
                        // We do NOT call endBoarding(). We stay attached but stop crew combat.
                        boardingState.isInventoryOpen = true;
                        
                        // Open the Inventory UI (defined in main.js)
                        if (window.openInventoryMenu) {
                            window.openInventoryMenu(p.target, player);
                            // --- NEW: Rank Update for Boarding ---
                            if (p.target instanceof NpcShip && !p.target.hasBeenBoardedByPlayer) {
                                p.target.hasBeenBoardedByPlayer = true;
                                player.stats.shipsBoarded++;
                                player.updateRank();
                            }
                            inventoryTarget = p.target; // Track the target for distance checks
                        }
                        return; // Stop processing projectiles for this frame
                    }
                }
            } else if (distance(p, p.owner) > 1000) { // Missed/Gone too far
                boardingState.crewProjectiles.splice(i, 1);
            }
        }
    }

    /**
     * New: Manages the NPC's decision making during boarding.
     * Implements the Offense/Defense logic based on crew ratios.
     */
    function updateNpcBoardingAI(deltaTime) {
        const npc = boardingState.target;
        if (npc.crew <= 0) return;

        boardingState.npcTimer -= deltaTime;

        // --- NEW: Dynamic Difficulty based on Ship Type ---
        const isNavy = (npc instanceof NavyShip);
        // Navy ships are trained professionals: faster aim (charge) and faster reload (cooldown).
        const chargeDuration = isNavy ? 750 : 1000; // 0.75s vs 1.0s
        const cooldownMin = isNavy ? 50 : 1500;    // 0.05s vs 1.5s (Navy attacks every 1-2s total cycle)
        const cooldownVariance = isNavy ? 1000 : 1500; // Less variance for Navy

        if (boardingState.npcState === 'IDLE') {
            if (boardingState.npcTimer <= 0) {
                // Start Charging an attack
                boardingState.npcState = 'CHARGING';
                boardingState.npcTimer = chargeDuration; 
                
                // Determine which side is closer to the player to launch from the correct rail
                const unrotatedPlayer = rotatePoint({x: player.x, y: player.y}, {x: npc.x, y: npc.y}, -npc.angle);
                const localY = unrotatedPlayer.y - npc.y;
                
                // Pick a random point along the length and on the facing beam
                const lengthOffset = (Math.random() - 0.5) * npc.shipLength * 0.8;
                const sideOffset = (localY > 0 ? 1 : -1) * (npc.shipWidth / 2 * 0.8);
                
                boardingState.npcChargeStartLocal = { x: lengthOffset, y: sideOffset };
            }
        } else if (boardingState.npcState === 'CHARGING') {
            if (boardingState.npcTimer <= 0) {
                // Telegraph over, execute fire!
                fireNpcCrew(npc);
                boardingState.npcState = 'COOLDOWN';
                boardingState.npcTimer = cooldownMin + Math.random() * cooldownVariance;
                boardingState.npcChargeStartLocal = null;
            }
        } else if (boardingState.npcState === 'COOLDOWN') {
            if (boardingState.npcTimer <= 0) {
                boardingState.npcState = 'IDLE';
                boardingState.npcTimer = 200; // Short pause before thinking again
            }
        }
    }

    /**
     * New: Executes the NPC crew launch with strategic aiming.
     */
    function fireNpcCrew(npc) {
        if (npc.crew <= 0) return;

        const ratio = npc.crew / player.crew;
        let mode = 'offense';

        // Strategy Logic:
        // High Crew (> 1.2x): Value Offense
        // Equal Crew (0.8x - 1.2x): Value Mixed
        // Low Crew (< 0.8x): Value Defense
        if (ratio < 0.8) mode = 'defense';
        else if (ratio <= 1.2) mode = Math.random() < 0.5 ? 'offense' : 'defense';
        
        let targetPoint = { x: player.x, y: player.y }; // Default to player center
        let crewToSend = 1; // Default to 1 crew (standard for defense)

        if (mode === 'defense') {
            // Defense: Aim at the closest incoming projectile to intercept it
            // FIX: Only target projectiles moving TOWARDS the NPC to avoid shooting at missed shots flying away.
            let closestDistSq = Infinity;
            let bestTarget = null;

            boardingState.crewProjectiles.forEach(p => {
                if (p.owner === player && !p.markedForRemoval) {
                    // Check if moving towards NPC (Dot Product > 0)
                    const dx = npc.x - p.x;
                    const dy = npc.y - p.y;
                    if ((dx * p.vx + dy * p.vy) > 0) {
                        const dSq = dx * dx + dy * dy;
                        if (dSq < closestDistSq) {
                            closestDistSq = dSq;
                            bestTarget = p;
                        }
                    }
                }
            });

            if (bestTarget) {
                targetPoint = { x: bestTarget.x, y: bestTarget.y };
            } else {
                // If no incoming projectiles, switch to offense
                mode = 'offense';
            }
        }

        if (mode === 'offense') {
            // Offense: Send a volley based on available crew.
            // Send up to 25% of current crew (min 1).
            // The NPC prefers to send the maximum percentage it can for each volley.
            const maxVolley = Math.max(1, Math.floor(npc.crew * 0.25));
            crewToSend = maxVolley;
        }

        // Calculate launch from the telegraph point
        const startLocal = boardingState.npcChargeStartLocal || { x: 0, y: 0 };
        const startRotated = rotatePoint(startLocal, {x: 0, y: 0}, npc.angle);
        const startWorld = { x: npc.x + startRotated.x, y: npc.y + startRotated.y };

        const angle = Math.atan2(targetPoint.y - startWorld.y, targetPoint.x - startWorld.x);
        const speed = CREW_ATTACK_SPEED;

        // NPC spends crew
        crewToSend = Math.min(crewToSend, npc.crew); // Safety check
        npc.crew -= crewToSend;

        for (let i = 0; i < crewToSend; i++) {
            const spread = (crewToSend > 1) ? (Math.random() - 0.5) * 0.3 : 0; // Add spread for volleys
            boardingState.crewProjectiles.push({
                x: startWorld.x, y: startWorld.y,
                vx: Math.cos(angle + spread) * speed, vy: Math.sin(angle + spread) * speed,
                owner: npc, target: player, color: npc.pennantColor, markedForRemoval: false
            });
        }
    }

    // --- NEW: Helper to get the dynamic world position of the aim start ---
    function getCurrentAimStart() {
        if (!boardingState.aimStartLocal || !player) return boardingState.aimStart;
        // Rotate local point by current ship angle and add to current ship position
        const rotated = rotatePoint(boardingState.aimStartLocal, {x: 0, y: 0}, player.angle);
        return { x: player.x + rotated.x, y: player.y + rotated.y };
    }

    function launchCrewAttack() {
        // Check for local start point instead of just aimStart
        if (boardingState.isInventoryOpen) return; // No crew attacks while inventory is open
        if (!boardingState.aimStartLocal || !boardingState.aimCurrent) return;
        
        const currentStart = getCurrentAimStart();
        
        const dx = boardingState.aimCurrent.x - currentStart.x;
        const dy = boardingState.aimCurrent.y - currentStart.y;
        const dragDist = Math.sqrt(dx*dx + dy*dy);
        
        // Calculate Crew Count based on drag distance
        // e.g., 10 pixels = 1 crew member
        let crewToSend = Math.floor(dragDist / 10);
        crewToSend = Math.min(crewToSend, player.crew); // Can't send more than you have
        if (crewToSend <= 0) return;

        player.crew -= crewToSend;

        // Launch angle matches drag direction (aiming style)
        const angle = Math.atan2(dy, dx); 
        
        // Create projectiles
        for(let i=0; i<crewToSend; i++) {
            // Add slight spread
            const spread = (Math.random() - 0.5) * 0.5; 
            const speed = CREW_ATTACK_SPEED + (Math.random() * 2);
            
            boardingState.crewProjectiles.push({
                x: currentStart.x,
                y: currentStart.y,
                vx: Math.cos(angle + spread) * speed,
                vy: Math.sin(angle + spread) * speed,
                owner: player,
                target: boardingState.target,
                color: player.pennantColor,
                markedForRemoval: false
            });
        }
    }

    function drawBoardingUI(ctx, scale) {
        // --- NEW: Draw Grappling Lines ---
        if (player && boardingState.target) {
            const target = boardingState.target;
            
            // Helper to get the beam point (side of ship) closest to the other ship
            const getClosestBeamPoint = (ship, otherShip) => {
                const halfWidth = ship.shipWidth / 2;
                // Calculate world positions for port and starboard beam points
                // Local points are (0, -halfWidth) and (0, halfWidth) relative to center
                
                // Point 1
                const p1Rotated = rotatePoint({x: 0, y: -halfWidth}, {x: 0, y: 0}, ship.angle);
                const p1 = { x: ship.x + p1Rotated.x, y: ship.y + p1Rotated.y };
                
                // Point 2
                const p2Rotated = rotatePoint({x: 0, y: halfWidth}, {x: 0, y: 0}, ship.angle);
                const p2 = { x: ship.x + p2Rotated.x, y: ship.y + p2Rotated.y };
                
                // Compare squared distances to other ship center
                const d1 = (p1.x - otherShip.x)**2 + (p1.y - otherShip.y)**2;
                const d2 = (p2.x - otherShip.x)**2 + (p2.y - otherShip.y)**2;
                
                return d1 < d2 ? p1 : p2;
            };

            // Calculate connection points
            const pBow = player.getBowPointWorldCoords();
            const pStern = player.getSternPointWorldCoords();
            const pMid = getClosestBeamPoint(player, target);
            
            const tBow = target.getBowPointWorldCoords();
            const tStern = target.getSternPointWorldCoords();
            const tMid = getClosestBeamPoint(target, player);

            // Calculate tension ratio (0.0 to 1.0)
            const tensionRatio = Math.min(1, boardingState.tension / BOARDING_TENSION_BREAK_THRESHOLD);
            
            // Interpolate color: Rope (#C8AD7F) to Strained Red (#FF4444)
            // Rope RGB: 200, 173, 127
            const r = 200 + (255 - 200) * tensionRatio;
            const g = 173 + (68 - 173) * tensionRatio;
            const b = 127 + (68 - 127) * tensionRatio;

            // Calculate a darker version for the dash pattern (approx 80% brightness)
            const rDash = r * 0.8;
            const gDash = g * 0.8;
            const bDash = b * 0.8;
            
            ctx.save();
            // Lines get thinner as tension increases to simulate stretching
            const baseLineWidth = (2 - tensionRatio * 1) / scale;
            ctx.lineWidth = baseLineWidth; 
            ctx.lineCap = 'round';
            
            // --- OPTIMIZATION: Use hard shadow instead of expensive blur ---
            // Draw shadow first (offset black line)
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            const shadowOffset = 2 / scale;
            
            ctx.beginPath();
            ctx.moveTo(pBow.x + shadowOffset, pBow.y + shadowOffset);
            ctx.lineTo(tBow.x + shadowOffset, tBow.y + shadowOffset);
            
            ctx.moveTo(pMid.x + shadowOffset, pMid.y + shadowOffset);
            ctx.lineTo(tMid.x + shadowOffset, tMid.y + shadowOffset);
            
            ctx.moveTo(pStern.x + shadowOffset, pStern.y + shadowOffset);
            ctx.lineTo(tStern.x + shadowOffset, tStern.y + shadowOffset);
            ctx.stroke();

            // 1. Draw Solid Base Line
            ctx.strokeStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
            ctx.beginPath();
            ctx.moveTo(pBow.x, pBow.y);
            ctx.lineTo(tBow.x, tBow.y);
            ctx.moveTo(pMid.x, pMid.y);
            ctx.lineTo(tMid.x, tMid.y);
            ctx.moveTo(pStern.x, pStern.y);
            ctx.lineTo(tStern.x, tStern.y);
            ctx.stroke();

            // 2. Draw Dashed Overlay Line (Texture)
            ctx.strokeStyle = `rgb(${Math.round(rDash)}, ${Math.round(gDash)}, ${Math.round(bDash)})`;
            ctx.lineWidth = baseLineWidth * 0.75; // Slightly thinner than base
            ctx.setLineDash([5 / scale, 5 / scale]); // Scale the dash pattern
            ctx.beginPath();
            ctx.moveTo(pBow.x, pBow.y);
            ctx.lineTo(tBow.x, tBow.y);
            ctx.moveTo(pMid.x, pMid.y);
            ctx.lineTo(tMid.x, tMid.y);
            ctx.moveTo(pStern.x, pStern.y);
            ctx.lineTo(tStern.x, tStern.y);
            ctx.stroke();

            ctx.restore();
        }

        // Draw Tension Meter
        // Always draw the meter background so the player knows it exists
        const barW = 100;
        const barH = 10;
        const x = player.x - barW / 2;
        const y = player.y - player.shipLength * 1.5; // Move up slightly to clear ship

        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x, y, barW, barH);

        if (boardingState.tension > 0) {
            const ratio = Math.min(1, boardingState.tension / BOARDING_TENSION_BREAK_THRESHOLD);
            ctx.fillStyle = ratio > 0.8 ? 'red' : 'orange';
            ctx.fillRect(x, y, barW * ratio, barH);
        }

        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2 / scale;
        ctx.strokeRect(x, y, barW, barH);

        ctx.fillStyle = 'white';
        ctx.font = `bold ${12 / scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText("BREAK FREE", x + barW / 2, y - (5 / scale));
        ctx.restore();

        // Draw Slingshot Aim
        if (!boardingState.isInventoryOpen && boardingState.isAiming && boardingState.aimStartLocal && boardingState.aimCurrent) {
            const currentStart = getCurrentAimStart();

            ctx.beginPath();
            ctx.moveTo(currentStart.x, currentStart.y);
            ctx.lineTo(boardingState.aimCurrent.x, boardingState.aimCurrent.y);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 2 / scale;
            ctx.stroke();
            
            // Draw "puck" at start
            ctx.beginPath();
            ctx.arc(currentStart.x, currentStart.y, 5/scale, 0, Math.PI*2);
            ctx.fillStyle = 'white';
            ctx.fill();

            // Draw Crew Count Indicator (recalculated with dynamic start)
            const dx = boardingState.aimCurrent.x - currentStart.x;
            const dy = boardingState.aimCurrent.y - currentStart.y;
            const dragDist = Math.sqrt(dx*dx + dy*dy);
            let crewToSend = Math.floor(dragDist / 10);
            crewToSend = Math.min(crewToSend, player.crew);

            ctx.save();
            ctx.font = `bold ${16 / scale}px Arial`;
            ctx.textAlign = 'center';
            
            // --- OPTIMIZATION: Hard shadow for text ---
            ctx.fillStyle = 'black';
            ctx.fillText(crewToSend, boardingState.aimCurrent.x + (1/scale), boardingState.aimCurrent.y - (15 / scale) + (1/scale));
            
            ctx.fillStyle = 'white';
            ctx.fillText(crewToSend, boardingState.aimCurrent.x, boardingState.aimCurrent.y - (15 / scale));
            ctx.restore();
        }

        // --- NEW: Draw NPC Charge Indicator ---
        if (boardingState.npcState === 'CHARGING' && boardingState.npcChargeStartLocal && boardingState.target) {
            const npc = boardingState.target;
            const startRotated = rotatePoint(boardingState.npcChargeStartLocal, {x: 0, y: 0}, npc.angle);
            const chargeX = npc.x + startRotated.x;
            const chargeY = npc.y + startRotated.y;

            // Pulsing Red Circle
            const pulse = (Math.sin(performance.now() / 100) + 1) / 2; // Fast pulse
            const radius = (5 + pulse * 5) / scale;

            ctx.save();
            ctx.beginPath();
            ctx.arc(chargeX, chargeY, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 50, 50, 0.7)';
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1 / scale;
            ctx.stroke();
            ctx.restore();
        }

        // Draw Crew Projectiles
        boardingState.crewProjectiles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3/scale, 0, Math.PI*2);
            ctx.fillStyle = p.color;
            ctx.fill();
        });
    }

    // --- NEW: Inventory Actions (Exposed to window for UI to call) ---
    window.inventoryActions = {
        abandon: (shipId) => {
            let ship = activeNpcs.find(s => s.shipId === shipId);
            // Fallback: if not found in active list (rare), check the tracked target
            if (!ship && inventoryTarget && inventoryTarget.shipId === shipId) {
                ship = inventoryTarget;
            }

            if (ship) {
                console.log(`[Inventory] Abandoning ${ship.shipId}.`);
                // Just close the menu; the ship remains surrendered and the timer will tick down naturally.
                endBoarding(); // Break the connection and close UI
            }
        },
        scuttle: (shipId) => {
            let ship = activeNpcs.find(s => s.shipId === shipId);
            let inActiveList = true;

            // Fallback: if not found in active list, check the tracked target
            if (!ship && inventoryTarget && inventoryTarget.shipId === shipId) {
                ship = inventoryTarget;
                inActiveList = false;
            }

            if (ship) {
                console.log(`[Inventory] Scuttling ${ship.shipId}.`);
                ship.hp = 0; // Destroy the ship
                
                // If not in active list, cleanupEntities won't see it, so handle removal manually.
                if (!inActiveList) {
                    if (ship instanceof NavyShip) { _spawnSingleNpc(NavyShip); }
                    else if (ship instanceof MerchantShip) { _spawnSingleNpc(MerchantShip); }
                    
                    // --- NEW: Remove from Fleet Manager if Allied ---
                    if (ship.isAllied && fleetManager) {
                        fleetManager.removeMember(ship);
                    }

                    worldManager.removeDynamicObject(ship);
                }
                endBoarding(); // Break the connection and close UI
            }
        }
    };

    // --- NEW: Ship Seizure Logic ---
    function handleShipSeizure(targetShip, crewTransferAmount, makeFlagship) {
        if (!player || !targetShip) return;

        // 1. Transfer Crew Logic
        player.crew = Math.max(0, player.crew - crewTransferAmount);

        // 2. Prepare Common Options for New Ship (Ally or Player)
        const commonOptions = {
            hp: targetShip.hp,
            crew: crewTransferAmount,
            shipName: targetShip.displayName || targetShip.archetypeName,
            archetypeName: targetShip.archetypeName,
            shipType: targetShip.shipType,
            pennantColor: player.pennantColor,
            sailColor: targetShip.sailColor,
            primaryHullColor: targetShip.primaryHullColor,
            secondaryHullColor: targetShip.secondaryHullColor,
            bulwarkRailColor: targetShip.bulwarkRailColor
        };

        // 3. Remove Old Target from World
        worldManager.removeDynamicObject(targetShip);
        const idx = activeNpcs.indexOf(targetShip);
        if (idx > -1) activeNpcs.splice(idx, 1);

        if (makeFlagship) {
            // CASE A: Swap Flagship (Player takes control of target)
            
            // A1. Convert OLD Player to AlliedShip
            const oldPlayerOptions = {
                hp: player.hp,
                crew: player.crew,
                shipName: player.displayName,
                pennantColor: player.pennantColor,
                sailColor: player.sailColor,
                primaryHullColor: player.primaryHullColor,
                secondaryHullColor: player.secondaryHullColor,
                bulwarkRailColor: player.bulwarkRailColor
            };
            // AlliedShip(x, y, blueprint, options)
            const oldPlayerAsAlly = new AlliedShip(player.x, player.y, player.blueprint, oldPlayerOptions);
            oldPlayerAsAlly.angle = player.angle;
            oldPlayerAsAlly.inventory = player.inventory;
            
            // A2. Create NEW Player from Target
            // PlayerShip(x, y, options, blueprint)
            const newPlayerOptions = {
                ...commonOptions,
                name: player.name // Keep captain name
            };
            const newPlayer = new PlayerShip(targetShip.x, targetShip.y, newPlayerOptions, targetShip.blueprint);
            newPlayer.angle = targetShip.angle;
            newPlayer.inventory = targetShip.inventory;
            
            // A3. Update Fleet Manager
            fleetManager.flagship = newPlayer;
            fleetManager.addMember(oldPlayerAsAlly);
            
            // A4. Update World & Game State
            worldManager.addDynamicObject(oldPlayerAsAlly);

            // --- NEW: Transfer Aggro ---
            // Ensure enemies switch focus to the new flagship immediately.
            activeNpcs.forEach(npc => {
                if (npc.targetShip === player) {
                    npc.targetShip = newPlayer;
                }
            });

            player = newPlayer;
            
        } else {
            // CASE B: Add Target as Ally
            // AlliedShip(x, y, blueprint, options)
            const newAlly = new AlliedShip(targetShip.x, targetShip.y, targetShip.blueprint, commonOptions);
            newAlly.angle = targetShip.angle;
            newAlly.inventory = targetShip.inventory;
            
            worldManager.addDynamicObject(newAlly);
            fleetManager.addMember(newAlly);
        }
    }

    // --- NEW: Swap Flagship Logic (for Allied Ships) ---
    function swapFlagship(targetShip) {
        if (!player || !targetShip) return;

        // 1. Capture Data
        const oldPlayer = player;
        const oldAlly = targetShip;

        // 2. Remove Old Ally from World/Fleet
        worldManager.removeDynamicObject(oldAlly);
        fleetManager.removeMember(oldAlly);
        const idx = activeNpcs.indexOf(oldAlly);
        if (idx > -1) activeNpcs.splice(idx, 1);

        // 3. Create New Ally (from Old Player)
        const newAllyOptions = {
            hp: oldPlayer.hp,
            crew: oldPlayer.crew,
            shipName: oldPlayer.displayName,
            shipType: oldPlayer.shipType,
            archetypeName: oldPlayer.shipType, // Use shipType as archetype for player ships
            pennantColor: oldPlayer.pennantColor,
            sailColor: oldPlayer.sailColor,
            primaryHullColor: oldPlayer.primaryHullColor,
            secondaryHullColor: oldPlayer.secondaryHullColor,
            bulwarkRailColor: oldPlayer.bulwarkRailColor
        };
        const newAlly = new AlliedShip(oldPlayer.x, oldPlayer.y, oldPlayer.blueprint, newAllyOptions);
        newAlly.angle = oldPlayer.angle;
        newAlly.inventory = oldPlayer.inventory;

        // 4. Create New Player (from Old Ally)
        const newPlayerOptions = {
            hp: oldAlly.hp,
            crew: oldAlly.crew,
            shipName: oldAlly.displayName,
            shipType: oldAlly.shipType,
            pennantColor: oldAlly.pennantColor,
            sailColor: oldAlly.sailColor,
            primaryHullColor: oldAlly.primaryHullColor,
            secondaryHullColor: oldAlly.secondaryHullColor,
            bulwarkRailColor: oldAlly.bulwarkRailColor,
            name: oldPlayer.name // Keep captain name
        };
        const newPlayer = new PlayerShip(oldAlly.x, oldAlly.y, newPlayerOptions, oldAlly.blueprint);
        newPlayer.angle = oldAlly.angle;
        newPlayer.inventory = oldAlly.inventory;

        // 5. Update Fleet & World
        fleetManager.flagship = newPlayer;
        fleetManager.addMember(newAlly);
        worldManager.addDynamicObject(newAlly);
        
        // 6. Transfer Aggro
        activeNpcs.forEach(npc => {
            if (npc.targetShip === oldPlayer) npc.targetShip = newPlayer;
        });

        player = newPlayer;
    }

    /**
     * Handles the application of damage to a ship from an obstacle, including
     * initial impact and sustained contact damage. Damage is now scaled by impact speed.
     * @param {Ship} ship - The ship taking damage.
     * @param {Obstacle} obstacle - The obstacle causing damage.
     * @param {number} baseDamageFactorInitial - Base damage factor for the initial hit.
     * @param {number} baseDamageFactorSustained - Base damage factor for sustained contact.
     */
    function handleCollisionDamage(ship, obstacle, baseDamageFactorInitial, baseDamageFactorSustained) {
        const now = performance.now();
        const speed = Math.sqrt(ship.vx ** 2 + ship.vy ** 2);

        // Only apply damage if the ship is moving faster than the threshold
        if (speed < MIN_SPEED_FOR_COLLISION_DAMAGE) {
            return;
        }

        let contactInfo = ship.obstacleContactTimers.get(obstacle);

        if (!contactInfo) {
            // First contact: Apply speed-based damage
            const damage = speed * COLLISION_DAMAGE_SPEED_MULTIPLIER * baseDamageFactorInitial;
            ship.takeDamage(damage);
            ship.obstacleContactTimers.set(obstacle, { firstContactTime: now, lastDamageTickTime: now });
            if (ship instanceof PlayerShip) {
                ship.collidingFlashTimer = PLAYER_COLLISION_FLASH_DURATION;
            }
        } else {
            // Sustained contact: Apply speed-based damage every second
            if (now - contactInfo.lastDamageTickTime >= 1000) {
                const damage = speed * COLLISION_DAMAGE_SPEED_MULTIPLIER * baseDamageFactorSustained;
                ship.takeDamage(damage);
                contactInfo.lastDamageTickTime = now;
                if (ship instanceof PlayerShip) {
                    ship.collidingFlashTimer = PLAYER_COLLISION_FLASH_DURATION;
                }
            }
        }
    }

    /**
     * Handles the application of damage to two ships that have collided.
     * Damage is scaled by the relative impact speed.
     * @param {Ship} ship1 - The first ship in the collision.
     * @param {Ship} ship2 - The second ship in the collision.
     * @param {object} collisionResult - The result from the collision check, containing the collision axis.
     */
    function handleShipCollisionDamage(ship1, ship2, collisionResult) {
        const axis = collisionResult.axis;

        // Calculate the relative velocity between the two ships.
        const relativeVelocityX = ship1.vx - ship2.vx;
        const relativeVelocityY = ship1.vy - ship2.vy;

        // Project the relative velocity onto the collision axis to find the impact speed.
        const impactSpeed = Math.abs(relativeVelocityX * axis.x + relativeVelocityY * axis.y);

        if (impactSpeed > MIN_SPEED_FOR_COLLISION_DAMAGE) {
            // Calculate damage based on impact speed.
            const damage = impactSpeed * COLLISION_DAMAGE_SPEED_MULTIPLIER;
            ship1.takeDamage(damage);
            ship2.takeDamage(damage);
        }
    }

    /**
     * Handles all collision detection and resolution for the frame.
     */
    function handleAllCollisions(deltaTime) {
        // --- FIX: Reset hazard flags here, at the START of collision detection. ---
        // This ensures the flags from the previous frame's collision check are available
        // for the current frame's physics calculations in `applyPhysicsAndBoundaries`. // --- NEW: Use active NPCs ---
        const allShipsForReset = [player, ...activeNpcs].filter(s => s);
        allShipsForReset.forEach(ship => {
            ship.isOverShoal = false;
            ship.isOverCoralReef = false;
            ship.islandCollisionNormal = null; // New: Reset the collision normal.
            ship.isAgainstIsland = false; // New: Reset the island collision flag each frame.
        });
        // Helper function to resolve positional collisions by moving objects apart
        function resolveCollision(obj1, obj2, collisionResult) {
            const overlap = collisionResult.overlap;
            const axis = collisionResult.axis;

            if (obj1 instanceof Ship && obj2 instanceof Ship) {
                // --- Ship-Ship Collision (with physics response) ---
                // Positional Correction
                const correction = overlap * 0.5;
                obj1.x += axis.x * correction;
                obj1.y += axis.y * correction;
                obj2.x -= axis.x * correction;
                obj2.y -= axis.y * correction;

                // Velocity Correction (Impulse Resolution)
                const relativeVelocity = { x: obj1.vx - obj2.vx, y: obj1.vy - obj2.vy };
                const velocityAlongNormal = relativeVelocity.x * axis.x + relativeVelocity.y * axis.y;
                if (velocityAlongNormal > 0) return; // Already separating
                const impulse = -(1 + SHIP_COLLISION_RESTITUTION) * velocityAlongNormal;
                obj1.vx += impulse * axis.x;
                obj1.vy += impulse * axis.y;
                obj2.vx -= impulse * axis.x;
                obj2.vy -= impulse * axis.y;
            } else if (obj1 instanceof Ship && obj2 === null) { // obj2 is null for ship-obstacle
                // --- Ship-Obstacle Collision (with physics response) ---
                obj1.x += axis.x * overlap; // Positional Correction
                const dot = obj1.vx * axis.x + obj1.vy * axis.y; // Project velocity onto the collision axis
                obj1.vx -= 2 * dot * axis.x; // Reflect velocity along the normal
                obj1.vy -= 2 * dot * axis.y; // Reflect velocity along the normal
                obj1.vx *= 0.3; // Apply friction/dampening to prevent infinite bouncing
                obj1.vy *= 0.3;
            }
        }

        // --- Continuous Collision Detection (CCD) for Ships ---
        // Instead of updating position and then checking for collision, we project the
        // movement and check for collisions along the path. This prevents tunneling.
        allShips.forEach(ship => {
            // Apply movement for this frame
            ship.x += ship.vx;
            ship.y += ship.vy;
        });

        // The spatial grid is now populated at the start of the main update() loop.
        // We can proceed directly to checking collisions for all dynamic objects.
        // --- OPTIMIZATION: Helper function to process collision checks for a list ---
        const checkCollisionsForList = (list) => {
            for (const obj of list) {
            // --- NEW: Skip physics for submerged ships ---
            // Once the ship is covered by the water overlay (>50%), it passes through everything.
            if (obj instanceof Ship && obj.isSinking && (obj.sinkHp / obj.maxSinkHp > 0.5)) continue;

            // Retrieve geometry directly (cached internally by the object)
            const objPoints = (obj instanceof Ship) ? obj.getTransformedPoints() : null;
            const objAABB = obj.getAABB();

            const potentialColliders = spatialGrid.query(obj);

            for (const other of potentialColliders) {
                // --- NEW: Ignore submerged ships as collision targets ---
                if (other instanceof Ship && other.isSinking && (other.sinkHp / other.maxSinkHp > 0.5)) continue;

                // Ship-on-Obstacle
        // The check is changed from `instanceof Obstacle` to a direct type check.
                // This is more robust and fixes the issue where islands might no longer be a subclass of Obstacle.
                if (obj instanceof Ship && (other.type === 'island' || other.type === 'rock')) {
                    // --- OPTIMIZATION: Convex Hull Mid-Phase Check ---
                    // If the ship does not intersect the simplified hull, it cannot intersect any detailed part.
                    if (other.convexHull && !checkPolygonCollision(objPoints, other.convexHull)) {
                        continue;
                    }

                    for (const part of other.convexParts) {
                        // --- OPTIMIZATION: Part-Level AABB Check ---
                        // Lazy initialization: Calculate AABB for this static part if it doesn't exist yet.
                        if (!part.aabb) { part.aabb = getPolygonAABB(part); }
                        // Fast Rejection: If boxes don't overlap, skip the expensive polygon check.
                        if (!checkAABBOverlap(objAABB, part.aabb)) continue;

                        const collision = checkPolygonCollision(objPoints, part);
                        if (collision) {
                            if (other.type === 'island') {
                                // New: For islands, just correct position and set the flag for physics slowdown.
                                obj.x += collision.axis.x * collision.overlap;
                                obj.y += collision.axis.y * collision.overlap;
                                obj.isAgainstIsland = true;
                                obj.islandCollisionNormal = collision.axis; // New: Store the collision normal.
                            } else { // For rocks, use the original bouncing collision.
                                resolveCollision(obj, null, collision);
                            }
                            handleCollisionDamage(obj, other, other.type === 'rock' ? ROCK_COLLISION_DAMAGE_FACTOR : ISLAND_COLLISION_DAMAGE_FACTOR, other.type === 'rock' ? ROCK_COLLISION_DAMAGE_FACTOR_SUSTAINED : ISLAND_COLLISION_DAMAGE_FACTOR_SUSTAINED);
                            break; // Resolve only against the first colliding part
                        }
                    }
                }

                // Ship-on-CoralReef (damage over time effect)
                if (obj instanceof Ship && other.type === 'coralReef') {
                    for (const part of other.convexParts) {
                        // --- OPTIMIZATION: Part-Level AABB Check ---
                        if (!part.aabb) { part.aabb = getPolygonAABB(part); }
                        if (!checkAABBOverlap(objAABB, part.aabb)) continue;

                        if (checkPolygonCollision(objPoints, part)) {
                            obj.isOverCoralReef = true;

                            const speed = Math.sqrt(obj.vx ** 2 + obj.vy ** 2);
                            if (speed > CORAL_REEF_DAMAGE_THRESHOLD_SPEED) {
                                // Apply damage directly for a true damage-over-time effect,
                                // rather than using the impact-based handleCollisionDamage function.
                                const damageThisFrame = CORAL_REEF_DAMAGE_PER_SECOND * (deltaTime / 1000);
                                obj.takeDamage(damageThisFrame);
                                if (obj instanceof PlayerShip) { obj.collidingFlashTimer = PLAYER_COLLISION_FLASH_DURATION; }
                            }

                        }
                    }
                }

                // Ship-on-Shoal (slowdown effect)
                if (obj instanceof Ship && other.type === 'shoal') {
                    for (const part of other.convexParts) {
                        // --- OPTIMIZATION: Part-Level AABB Check ---
                        if (!part.aabb) { part.aabb = getPolygonAABB(part); }
                        if (!checkAABBOverlap(objAABB, part.aabb)) continue;

                        if (checkPolygonCollision(objPoints, part)) {
                            obj.isOverShoal = true;

                            // --- NEW: Tiered Damage for High-Speed Grounding ---
                            const speed = Math.sqrt(obj.vx ** 2 + obj.vy ** 2);
                            if (speed >= SHOAL_FULL_SPEED_DAMAGE_THRESHOLD) {
                                handleCollisionDamage(obj, other, SHOAL_DAMAGE_FACTOR_FULL_SPEED, 0);
                            } else if (speed >= SHOAL_HIGH_SPEED_DAMAGE_THRESHOLD) {
                                handleCollisionDamage(obj, other, SHOAL_DAMAGE_FACTOR_HIGH_SPEED, 0);
                            }
                            // No 'else' is needed; if speed is below the thresholds, only the slowdown effect applies.
                        }
                    }
                }

                // Ship-on-Ship (avoiding self-collision and double-checks)
                if (obj instanceof Ship && other instanceof Ship && allShips.indexOf(obj) < allShips.indexOf(other)) {
                    // Retrieve cached geometry for the other ship
                    const otherPoints = other.getTransformedPoints();
                    const otherAABB = other.getAABB();

                    if (!checkAABBOverlap(objAABB, otherAABB)) continue;

                    const collision = checkPolygonCollision(objPoints, otherPoints);
                    if (collision) {
                        resolveCollision(obj, other, collision);
                        handleShipCollisionDamage(obj, other, collision);
                        
                        // --- NEW: Boarding Trigger ---
                        if (obj instanceof PlayerShip && other instanceof NpcShip && obj.canInitiateBoarding(other)) {
                            startBoarding(other, {x: obj.x, y: obj.y}); // Use player pos as rough contact point
                        }

                        // --- Player-NPC Interaction Logic ---
                        if (obj instanceof PlayerShip && other instanceof NpcShip) {
                            other.hasBeenAttackedByPlayer = true;
                        } else if (obj instanceof NpcShip && other instanceof PlayerShip) {
                            obj.hasBeenAttackedByPlayer = true;
                        }
                    }
                }

                // Cannonball-on-Obstacle/Ship
                if (obj instanceof Cannonball) {
                    if (other instanceof Obstacle && (other.type === 'island' || other.type === 'rock')) {
                        for (const part of other.convexParts) { // Check against all parts of the obstacle
                            // --- OPTIMIZATION: Part-Level AABB Check & Distance Check ---
                            if (!part.aabb) { part.aabb = getPolygonAABB(part); }
                            if (!checkAABBOverlap(objAABB, part.aabb)) continue;

                            if (distanceToPolygonSquared({x: obj.x, y: obj.y}, part) < obj.radius * obj.radius) {
                                console.log('[Collision] Cannonball hit an obstacle and was marked for removal.'); // --- DEBUG LOGGING ---
                                obj.markedForRemoval = true;
                                break;
                            }
                        }
                    } else if (other instanceof Ship) {
                        // A cannonball cannot hit its owner.
                        if (other === obj.owner) {
                            continue;
                        }

                        // Check for collision with any other ship.
                        // Retrieve cached geometry for the target ship
                        const otherPoints = other.getTransformedPoints();
                        const otherAABB = other.getAABB();

                        if (!checkAABBOverlap(obj.getAABB(), otherAABB)) continue;

                        // --- OPTIMIZATION: Bounding Circle Check ---
                        // Fast rejection before expensive polygon check.
                        // Use a safe radius (half length) to approximate the ship.
                        const distSq = (obj.x - other.x)**2 + (obj.y - other.y)**2;
                        const safeRadius = other.shipLength * 0.6; // 0.6 covers the corners
                        if (distSq > safeRadius * safeRadius) continue;

                        if (distanceToPolygonSquared({x: obj.x, y: obj.y}, otherPoints) < obj.radius * obj.radius) {
                            // --- Player-NPC Interaction Logic ---
                            console.log(`[Collision] Cannonball from ${obj.owner.name} hit ship ${other.name || other.shipId}.`); // --- DEBUG LOGGING ---
                            if (obj.owner instanceof PlayerShip && other instanceof NpcShip) {
                                other.hasBeenAttackedByPlayer = true;
                                // --- NEW: Rank Update for Combat Engagement ---
                                if (player.stats.combatEngagements === 0) {
                                    player.stats.combatEngagements = 1;
                                    player.updateRank();
                                }
                            other.wasHitThisFrame = true;
                            }
                            
                            let visualScale = 1.0; // Default scale

                            // --- NEW: Calculate Impact Angle & Critical Multiplier for All Shots ---
                            // We calculate this upfront so specialized shots can use it if needed.
                            const cannonballAngle = Math.atan2(obj.vy, obj.vx);
                            const shipAngle = other.angle;
                            const impactAngle = normalizeAngle(cannonballAngle - shipAngle);
                            // The interpolation factor is 0 for a 90-degree hit (broadside) and 1 for a 0 or 180-degree hit (bow/stern).
                            const interpolationFactor = Math.abs(Math.cos(impactAngle));
                            // The damage multiplier scales from 1x (base) to the max critical multiplier.
                            const criticalMultiplier = 1.0 + ((CRITICAL_HIT_MAX_MULTIPLIER - 1.0) * interpolationFactor);

                            // --- NEW: Chain Shot Collision Logic ---
                            if (obj instanceof ChainShot) {
                                // Chain Shot Damage Profile
                                if (Math.random() < CHAIN_SHOT_RIG_DAMAGE_CHANCE) {
                                    // Rig Hit (High Chance)
                                    const dmg = getRandomArbitrary(CHAIN_SHOT_RIG_DAMAGE_MIN, CHAIN_SHOT_RIG_DAMAGE_MAX);
                                    other.takeRigDamage(dmg);
                                } else {
                                    // Hull Hit (Low Chance, Low Damage)
                                    other.takeDamage(CHAIN_SHOT_HULL_DAMAGE);
                                }
                                
                                // Crew Damage (50% Chance)
                                if (Math.random() < CHAIN_SHOT_CREW_DAMAGE_CHANCE) {
                                    const crewDmg = Math.floor(getRandomArbitrary(CHAIN_SHOT_CREW_DAMAGE_MIN, CHAIN_SHOT_CREW_DAMAGE_MAX + 0.99));
                                    other.crew = Math.max(0, other.crew - crewDmg);
                                }
                                visualScale = 1.5; // Larger effect for chain shot impact
                            } else if (obj instanceof GrapeShot) {
                                // --- NEW: Grape Shot Collision Logic ---

                                // 2. Structure Damage (50/50 Split)
                                if (Math.random() < 0.5) {
                                    // Hull Damage
                                    other.takeDamage(GRAPE_SHOT_HULL_DAMAGE);

                                    // Crew Damage (Always hits crew if Hull Damage)
                                    // Apply Raking Bonus
                                    const minCrew = GRAPE_SHOT_CREW_DAMAGE_MIN * criticalMultiplier;
                                    const maxCrew = GRAPE_SHOT_CREW_DAMAGE_MAX * criticalMultiplier;
                                    
                                    const crewLoss = Math.floor(getRandomArbitrary(minCrew, maxCrew + 0.99));
                                    other.crew = Math.max(0, other.crew - crewLoss);
                                } else {
                                    // Rigging Damage
                                    const rigDmg = getRandomArbitrary(GRAPE_SHOT_RIG_DAMAGE_MIN, GRAPE_SHOT_RIG_DAMAGE_MAX);
                                    other.takeRigDamage(rigDmg);
                                }
                                
                                visualScale = 0.8; // Slightly smaller visual impact for the cluster
                            } else if (obj instanceof CanisterShot) {
                                // --- NEW: Canister Shot Collision Logic ---
                                
                                // 1. Crew Damage (0-5, 50% chance)
                                if (Math.random() < 0.5) {
                                    const crewLoss = Math.floor(getRandomArbitrary(CANISTER_SHOT_CREW_DAMAGE_MIN, CANISTER_SHOT_CREW_DAMAGE_MAX + 0.99));
                                    other.crew = Math.max(0, other.crew - crewLoss);
                                }

                                // 2. Structure Damage (50/50 Split, Low Damage)
                                if (Math.random() < 0.5) {
                                    other.takeDamage(CANISTER_SHOT_HULL_DAMAGE);
                                } else {
                                    other.takeRigDamage(CANISTER_SHOT_RIG_DAMAGE);
                                }
                                
                                visualScale = 0.6; // Small visual impact
                            } else {
                                // --- Standard Round Shot Logic ---
                                if (Math.random() < CANNONBALL_RIG_HIT_CHANCE) {
                                    // It's a rig hit.
                                    other.takeRigDamage(CANNONBALL_RIG_DAMAGE);
                                } else {
                                    // --- NEW: Critical Hit Damage Calculation (Hull) ---
                                    const finalDamage = CANNONBALL_HULL_DAMAGE * criticalMultiplier;

                                    other.takeDamage(finalDamage);
                                    
                                    // Scale visual effect: 1.0 (base) -> 2.0 (max crit)
                                    visualScale = 1.0 + interpolationFactor;

                                    // Check for secondary crew damage.
                                    if (Math.random() < CANNONBALL_CREW_DAMAGE_CHANCE) { // 50% chance
                                        const crewLoss = Math.floor(getRandomArbitrary(0, 1 + 0.99)); // 0 or 1 crew lost
                                        other.crew = Math.max(0, other.crew - crewLoss);
                                    }

                                    // --- NEW: Cannon Destruction Chance ---
                                    if (Math.random() < CANNON_DESTRUCTION_CHANCE) {
                                        if (typeof other.destroyRandomCannon === 'function') {
                                            if (other.destroyRandomCannon()) {
                                                console.log(`[Collision] Cannon destroyed on ${other.shipId || 'Ship'}!`);
                                            }
                                        }
                                    }
                                }
                            }

                            // --- NEW: Trigger visual damage effect ---
                            createDamageEffect(obj.x, obj.y, visualScale);

                            console.log('[Collision] Cannonball marked for removal after hitting ship.'); // --- DEBUG LOGGING ---
                            obj.markedForRemoval = true;
                        }
                    }
                }
            }
            }
        }
        
        checkCollisionsForList(allShips);
        checkCollisionsForList(cannonballs);
    }

    /**
     * Removes entities that are marked for removal (e.g., destroyed cannonballs, sunken ships).
     */
    function cleanupEntities() {
        // --- OPTIMIZATION: Use pooling for cannonballs ---
        // Instead of filtering (which creates a new array and garbage), we iterate backwards
        // and release used cannonballs back to their respective pools.
        for (let i = cannonballs.length - 1; i >= 0; i--) {
            const ball = cannonballs[i];
            if (ball.markedForRemoval) {
                // The ball's constructor (e.g., Cannonball, ChainShot) has a static 'release' method.
                if (ball.constructor.release) {
                    ball.constructor.release(ball);
                }
                // Remove the ball from the active array in-place.
                cannonballs.splice(i, 1);
            }
        }
        for (let i = volleys.length - 1; i >= 0; i--) {
            const volley = volleys[i];
            if (volley.markedForRemoval) {
                Volley.release(volley);
                volleys.splice(i, 1);
            }
        }

        // --- New Respawn Logic ---
        // Iterate backwards to safely remove items while looping.
        for (let i = activeNpcs.length - 1; i >= 0; i--) {
            const npc = activeNpcs[i];
            // --- FIX: Only remove if fully sunk, allowing for sinking animation ---
            if (npc.isSunk) {
                // --- NEW: End boarding if the target dies ---
                if (boardingState.isActive && boardingState.target === npc) {
                    endBoarding();
                }

                // --- NEW: Close Inventory UI if the target dies ---
                // This prevents unnecessary distance checks for a ship that no longer exists.
                if (inventoryTarget === npc) {
                    const inventoryScreen = document.getElementById('inventory-screen');
                    if (inventoryScreen) {
                        inventoryScreen.style.display = 'none';
                    }
                    const cargoDialog = document.getElementById('cargo-action-dialog');
                    if (cargoDialog) {
                        cargoDialog.style.display = 'none';
                    }
                    inventoryTarget = null;
                }

                // --- NEW: Remove from Fleet Manager if Allied ---
                if (npc.isAllied && fleetManager) {
                    fleetManager.removeMember(npc);
                }

                // --- REVISED: Mutually Exclusive Hunter Death Logic ---
                if (npc.isFleetHunter) {
                    activeFleetCount--;
                    if (activeFleetCount <= 0) {
                        console.log(`[Pirate Hunter] Fleet defeated! A new fleet will be dispatched.`);
                        fleetRespawnTimer = 300000; // 5 minute respawn for fleet
                    }
                } else if (npc.isSquadronHunter) {
                    activeSquadronCount--;
                    if (activeSquadronCount <= 0) {
                        console.log(`[Pirate Hunter] Squadron defeated! New squadron arriving shortly.`);
                        squadronRespawnTimer = 120000; // 2 minutes respawn for full squadron
                    }
                } else if (npc.isPirateHunter) { // Catches only the single hunter now
                    console.log(`[Pirate Hunter] Hunter defeated! Another will be sent shortly.`);
                    pirateHunter = null;
                    pirateHunterRespawnTimer = 60000; // 1 minute respawn
                }
                
                // --- NEW: Rank Update for Sinking ---
                if (npc.hasBeenAttackedByPlayer) {
                    player.stats.shipsSunk++;
                    player.updateRank();
                }

                // A ship has been defeated. Determine its type and spawn a replacement.
                console.log(`[Respawn] ${npc.shipId} has been defeated. Spawning replacement.`);
                if (npc instanceof NavyShip) { _spawnSingleNpc(NavyShip); }
                else if (npc instanceof MerchantShip) { _spawnSingleNpc(MerchantShip); }
                worldManager.removeDynamicObject(npc); // Remove from the authoritative source list.
                activeNpcs.splice(i, 1); // Remove from the local active list for this frame.
            }
        }

        // --- Final Boundary Check ---
        // This is now done after all collision resolution and movement.
        allShips.forEach(ship => {
            if (ship.x < 0) { ship.x = 0; ship.vx *= -0.5; }
            if (ship.x > WORLD_WIDTH) { ship.x = WORLD_WIDTH; ship.vx *= -0.5; }
            if (ship.y < 0) { ship.y = 0; ship.vy *= -0.5; }
            if (ship.y > WORLD_HEIGHT) { ship.y = WORLD_HEIGHT; ship.vy *= -0.5; }
        });
    }

    /**
     * Processes daily food and drink consumption for a ship.
     * @param {Ship} ship 
     */
    function processDailyConsumption(ship) {
        if (!ship || ship.crew <= 0 || ship.isSunk) return;
    
        const FOOD_REQUIREMENT = 0.005;
        const DRINK_REQUIREMENT = 0.005;
    
        // Consumption Priorities (Heaviest/Least Efficient first to clear space)
        const priorities = {
            drink: ['water', 'beer', 'rum', 'wine'],
            food: ['dried-beef', 'dried-peas', 'oatmeal', 'biscuit', 'cheese']
        };
    
        let fedStatus = { food: false, drink: false };
    
        // Helper to consume category
        const consumeCategory = (category, requirement) => {
            let crewToFeed = ship.crew;
            
            for (const itemId of priorities[category]) {
                if (crewToFeed <= 0.1) break; // Stop if requirement is met
    
                const itemDef = window.ITEM_DATABASE[itemId];
                if (!itemDef || !itemDef.dailyConsumption || !itemDef.weight) continue;
    
                // How many items of this type one crew member needs per day
                const itemsPerCrew = requirement / itemDef.dailyConsumption;
                
                // Total items needed for all remaining crew
                const totalItemsNeeded = crewToFeed * itemsPerCrew;
                
                // How many items do we actually have?
                const availableMass = ship.getItemMass(itemId);
                const availableItems = availableMass / itemDef.weight;
    
                const itemsToConsume = Math.min(totalItemsNeeded, availableItems);
    
                if (itemsToConsume > 0) {
                    ship.consumeItem(itemId, itemsToConsume);
                    const crewFed = itemsToConsume / itemsPerCrew;
                    crewToFeed -= crewFed;
                }
            }
            return crewToFeed <= 0.1; // Consider fed if remaining is negligible
        };
    
        fedStatus.drink = consumeCategory('drink', DRINK_REQUIREMENT);
        fedStatus.food = consumeCategory('food', FOOD_REQUIREMENT);
    
        if (fedStatus.drink && fedStatus.food) {
            ship.daysStarving = 0;
        } else {
            ship.daysStarving++;
            // Crew Loss: 5% of current crew * days starving (compounding effect)
            const loss = Math.ceil(ship.crew * 0.05 * ship.daysStarving);
            ship.crew = Math.max(0, ship.crew - loss);
            if (ship === player && loss > 0) {
                console.log(`[Daily Update] Crew starving! Lost ${loss} crew.`);
            }
        }
    }

        /**
     * The main update function, called every frame by the game loop.
     * It orchestrates the entire game state progression for a single frame.
     * @param {number} deltaTime - The time elapsed since the last frame in milliseconds.
     */
    function update(deltaTime) {
        let tStart = performance.now();

        // --- NEW: Update Game Over State ---
        if (gameOverState.active) {
            gameOverState.timer += deltaTime;
            if (gameOverState.timer >= gameOverState.duration) {
                gameOverState.canRestart = true;
            }
            
            if (gameOverState.reason === 'Captured') {
                // Freeze physics for capture
                // Skip the rest of update logic except drawing
                return; 
            }
            // If 'Sunk', we let the sinking animation play out, so we continue.
        }

        // --- NEW: Update the WorldManager first ---
        if (player && worldManager) {
            worldManager.update(player, deltaTime, windDirection, pathfinder);
            const activeObjects = worldManager.getActiveObjects();
            activeNpcs = activeObjects.dynamics;
            activeIslands = activeObjects.islands;
            activeRocks = activeObjects.rocks;
            activeShoals = activeObjects.shoals;
            activeCoralReefs = activeObjects.coralReefs;
        } else if (!player && worldManager) {
            // --- NEW: Background Mode ---
            // If on the start menu, update the world manager centered on the camera
            // so that islands and terrain are visible in the background.
            const centerX = cameraX + (canvas.width / worldToScreenScale) / 2;
            const centerY = cameraY + (canvas.height / worldToScreenScale) / 2;
            // --- FIX: Pass null for pathfinder to disable NPC AI/Pathfinding in background ---
            worldManager.update({x: centerX, y: centerY}, deltaTime, windDirection, null);
            const activeObjects = worldManager.getActiveObjects();
            // Only show statics (Islands/Rocks) to keep the background clean and performant
            activeIslands = activeObjects.islands;
            activeRocks = activeObjects.rocks;
            activeShoals = activeObjects.shoals;
            activeCoralReefs = activeObjects.coralReefs;
            activeNpcs = []; // Keep NPCs hidden/inactive
        }

        // --- OPTIMIZATION: Create unified ship list once per frame ---
        allShips.length = 0;
        if (player) allShips.push(player);
        for (let i = 0; i < activeNpcs.length; i++) {
            if (activeNpcs[i]) allShips.push(activeNpcs[i]);
        }

        let tWorld = performance.now();
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Update: WorldManager'] = (perfMetrics['Update: WorldManager'] || 0) + (tWorld - tStart);

        // 0. Re-populate the spatial grid for this frame with only ACTIVE objects.
        // --- OPTIMIZATION: Skip grid update if no player (Start Menu) ---
        if (player) {
            spatialGrid.clear();
            allShips.forEach(ship => spatialGrid.insert(ship));
            volleys.forEach(volley => spatialGrid.insert(volley)); // Insert volleys for AI query

            // --- FIX: Re-insert active static obstacles into the spatial grid ---
            activeIslands.forEach(obj => spatialGrid.insert(obj));
            activeRocks.forEach(obj => spatialGrid.insert(obj));
            activeShoals.forEach(obj => spatialGrid.insert(obj));
            activeCoralReefs.forEach(obj => spatialGrid.insert(obj));
        }

        let tGrid = performance.now();
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Update: SpatialGrid'] = (perfMetrics['Update: SpatialGrid'] || 0) + (tGrid - tWorld);
        
        // --- NEW: Map Animation Logic ---
        const MAP_ANIMATION_SPEED = 0.004; // Speed factor (1 / ms). ~250ms duration
        if (isMapExpanded) {
            mapAnimationProgress = Math.min(1, mapAnimationProgress + deltaTime * MAP_ANIMATION_SPEED);
        } else {
            mapAnimationProgress = Math.max(0, mapAnimationProgress - deltaTime * MAP_ANIMATION_SPEED);
        }

        // 1. Update environmental factors like wind
        updateWind();
        // --- FIX: Expose windDirection globally for scripts that rely on it (e.g., Rigs) ---
        window.windDirection = windDirection;

        // --- NEW: Update Day/Night Cycle ---
        previousDayNightTimer = dayNightTimer;
        dayNightTimer = (dayNightTimer + deltaTime) % DAY_NIGHT_CYCLE_DURATION;
        
        // Check for day wrap (New Day)
        if (dayNightTimer < previousDayNightTimer) {
            // A new day has dawned. Process consumption.
            allShips.forEach(ship => processDailyConsumption(ship));
        }

        const cycleProgress = dayNightTimer / DAY_NIGHT_CYCLE_DURATION;
        
        // 0.0 - 0.45: Day (1.0)
        // 0.45 - 0.55: Sunset (1.0 -> 0.2)
        // 0.55 - 0.95: Night (0.2)
        // 0.95 - 1.00: Sunrise (0.2 -> 1.0)
        if (cycleProgress < 0.45) {
            ambientLightLevel = 1.0;
        } else if (cycleProgress < 0.55) {
            const t = (cycleProgress - 0.45) / 0.10;
            ambientLightLevel = 1.0 - (t * 0.8);
        } else if (cycleProgress < 0.95) {
            ambientLightLevel = 0.2;
        } else {
            const t = (cycleProgress - 0.95) / 0.05;
            ambientLightLevel = 0.2 + (t * 0.8);
        }

        // --- NEW: Update Zoom Level ---
        let targetZoom = boardingState.isActive ? 1.5 : 1.0;
        if (crowsNestActive) targetZoom = 0.666; // Zoom out (1.5x view area approx)
        // Smoothly interpolate current zoom towards target
        currentZoomMultiplier += (targetZoom - currentZoomMultiplier) * ZOOM_EASE_FACTOR;

        // NEW: Run the periodic NPC path failsafe check.
        checkNpcPathsFailsafe();

        // --- REVISED: Rank-based Pirate Hunter Spawning Logic ---
        if (player) {
            if (player.rankIndex >= 5) { // Rank 5: Enemy of All Mankind
                if (activeFleetCount <= 0) {
                    if (fleetRespawnTimer <= 0) {
                        _spawnPirateHunterFleet();
                    } else {
                        fleetRespawnTimer -= deltaTime;
                    }
                }
            } else if (player.rankIndex >= 4) { // Rank 4: Notorious Pirate
                if (activeSquadronCount <= 0) {
                    if (squadronRespawnTimer <= 0) {
                        _spawnPirateHunterSquadron();
                    } else {
                        squadronRespawnTimer -= deltaTime;
                    }
                }
            } else if (player.rankIndex >= 3) { // Rank 3: Known Pirate
                if (!pirateHunter) {
                    if (pirateHunterRespawnTimer <= 0) {
                        _spawnPirateHunter();
                    } else {
                        pirateHunterRespawnTimer -= deltaTime;
                    }
                }
            }
        }

        // 2. Update player-specific UI flags
        if (player && spatialGrid) {
            player.isInAnchorRange = false;
            // --- Optimized Anchor Zone Check ---
            // Instead of checking every obstacle in the world, we query the spatial grid
            // for obstacles that are potentially close enough to be in anchor range.
            const queryAABB = {
                minX: player.x - maxObstacleProximityRadius - player.shipWidth,
                minY: player.y - maxObstacleProximityRadius - player.shipWidth,
                maxX: player.x + maxObstacleProximityRadius + player.shipWidth,
                maxY: player.y + maxObstacleProximityRadius + player.shipWidth
            };
            // The query returns a Set, which must be converted to an Array to use .filter()
            const potentialObstacles = Array.from(spatialGrid.query(queryAABB))
                .filter(o => o instanceof Obstacle || o.type === 'coralReef');

            for (const obstacle of potentialObstacles) {
                // Use the rockBase for coral reefs, as it holds the physical geometry
                const geometrySource = (obstacle.type === 'coralReef' && obstacle.rockBase) ? obstacle.rockBase : obstacle;
                const polygonPoints = geometrySource.outerPerimeterPoints;
                if (!polygonPoints) continue;

                const distSq = distanceToPolygonSquared({ x: player.x, y: player.y }, polygonPoints);
                if (distSq <= obstacle.proximityRadius ** 2) {
                    player.isInAnchorRange = true;
                    break;
                }
            }
        }
        // 3. Update all entity positions and states
        
        // --- NEW: Update Interaction Flags ---
        // Reset flags for all NPCs, then set true for the specific target if inventory is open.
        activeNpcs.forEach(npc => npc.isBeingInteractedWith = false);
        if (inventoryTarget && boardingState.isInventoryOpen && inventoryTarget instanceof NpcShip) {
            inventoryTarget.isBeingInteractedWith = true;
        }

        updateEntities(deltaTime);

        let tEntities = performance.now();
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Update: Entities'] = (perfMetrics['Update: Entities'] || 0) + (tEntities - tGrid);

        // --- NEW: Update Wavelets ---
        updateWavelets(deltaTime);

        let tWaves = performance.now();
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Update: Wavelets'] = (perfMetrics['Update: Wavelets'] || 0) + (tWaves - tEntities);

        // --- NEW: Update Boarding Physics & Logic ---
        if (boardingState.isActive) {
            updateBoardingLogic(deltaTime);
        }

        // 4. Handle all collisions and their effects
        if (player) handleAllCollisions(deltaTime);

        let tCollisions = performance.now();
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Update: Collisions'] = (perfMetrics['Update: Collisions'] || 0) + (tCollisions - tWaves);

        // --- NEW: Re-bin active objects that have moved sectors ---
        // FIX: Re-bin BEFORE cleanup. This ensures that if a ship died this frame,
        // it is in the correct sector list for removeDynamicObject to find it.
        if (worldManager) {
            worldManager.rebinActiveObjects();
        }

        // 5. Remove destroyed or expired entities
        cleanupEntities();

        // --- NEW: Close Inventory UI if too far ---
        if (inventoryTarget && player) {
            const dist = distance(player, inventoryTarget);
            // If we drift more than 3 ship lengths away, close the menu.
            if (dist > player.shipLength * INVENTORY_MAX_DISTANCE_MULTIPLIER) {
                closeInventory();
            }
        }

        // 6. Check for game-over condition
        // --- FIX: Wait for player to sink before resetting ---
        if (player && player.isSunk && !gameOverState.active) {
             triggerGameOver('Sunk');
        } else if (player && !gameOverState.active) {
             // --- NEW: Calculate Buffer Penetration Once ---
             let penetration = 0;
             if (player.x < WORLD_BUFFER) penetration = Math.max(penetration, WORLD_BUFFER - player.x);
             if (player.x > WORLD_WIDTH - WORLD_BUFFER) penetration = Math.max(penetration, player.x - (WORLD_WIDTH - WORLD_BUFFER));
             if (player.y < WORLD_BUFFER) penetration = Math.max(penetration, WORLD_BUFFER - player.y);
             if (player.y > WORLD_HEIGHT - WORLD_BUFFER) penetration = Math.max(penetration, player.y - (WORLD_HEIGHT - WORLD_BUFFER));
             
             player.bufferPenetration = penetration; // Store for draw()

             // --- NEW: Check "Lost at Sea" Condition ---
             if (penetration > WORLD_BUFFER / 2) {
                 player.isSailOpen = false;
                 player.sailingForwardToggleOn = false; // --- FIX: Disable auto-sail ---
                 triggerGameOver('Lost at Sea');
             }
        }

        let tEnd = performance.now();
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Update: Cleanup'] = (perfMetrics['Update: Cleanup'] || 0) + (tEnd - tCollisions);
    }

    /**
     * New: Triggers the game over sequence.
     * @param {string} reason - 'Sunk' or 'Captured'.
     */
    function triggerGameOver(reason) {
        if (gameOverState.active) return;
        console.log(`Game Over Triggered: ${reason}`);
        gameOverState.active = true;
        gameOverState.reason = reason;
        gameOverState.timer = 0;
        gameOverState.canRestart = false;
        
        // --- NEW: Show HTML Overlay ---
        if (gameOverOverlay) {
            document.getElementById('game-over-title').textContent = reason.toUpperCase();
            gameOverOverlay.style.display = 'flex';
            gameOverOverlay.style.opacity = '0';
        }

        canvas.style.willChange = 'filter'; // --- NEW: Optimize filter performance ---

        // Disable game input immediately
        isGameActive = false;
        keys = {}; // --- FIX: Clear keys to prevent stuck inputs ---
        
        // Close any open UI
        closeInventory();
        isMapExpanded = false; // --- FIX: Ensure map is closed on Game Over ---
    }

    /**
     * New: Centralized function to close the inventory and update state.
     * If boarding a surrendered ship, this also ends the boarding action.
     */
    function closeInventory() {
        // --- OPTIMIZATION: Clear the UI refresh interval when closing the menu ---
        if (window.inventoryRefreshIntervalId) {
            clearInterval(window.inventoryRefreshIntervalId);
            window.inventoryRefreshIntervalId = null;
        }

        const inventoryScreen = document.getElementById('inventory-screen');
        if (inventoryScreen) {
            inventoryScreen.style.display = 'none';
        }
        boardingState.isInventoryOpen = false;
        inventoryTarget = null;

        // If we are currently boarding a surrendered or allied ship, closing the menu
        // implies we are done with the interaction, so we disconnect.
        if (boardingState.isActive && boardingState.target && (boardingState.target.aiState === 'surrendered' || boardingState.target.isAllied)) {
            endBoarding();
        }
    }

        /**
     * The main game loop function. It calculates the time delta between frames
     * and orchestrates the update and draw calls.
     */
    let lastFrameTime = 0;
    function gameLoop(timestamp) {
        // Calculate time since the last frame in milliseconds
        const deltaTime = timestamp - (lastFrameTime || timestamp); // Handle first frame
        lastFrameTime = timestamp;
        
        const startFrame = performance.now();

        // Update the state of all game objects
        update(deltaTime);

        const afterUpdate = performance.now();
        
        // Render the new state to the canvas
        draw();

        const endFrame = performance.now();

        // --- PERFORMANCE LOGGING ---
        if (ENABLE_PERFORMANCE_LOGGING) {
            perfMetrics['Total Frame'] = (perfMetrics['Total Frame'] || 0) + (endFrame - startFrame);
            perfMetrics['Update Total'] = (perfMetrics['Update Total'] || 0) + (afterUpdate - startFrame);
            perfMetrics['Draw Total'] = (perfMetrics['Draw Total'] || 0) + (endFrame - afterUpdate);
            perfFrameCount++;

            if (timestamp - perfLastLogTime > 2000) { // Log every 2 seconds
                // console.clear(); // Uncomment to keep console clean
                console.log(`--- Performance Report (${perfFrameCount} frames over ${(timestamp - perfLastLogTime).toFixed(0)}ms) ---`);
                const sorted = Object.entries(perfMetrics)
                    .map(([k, v]) => [k, v / perfFrameCount])
                    .sort((a, b) => b[1] - a[1]);
                
                for (const [name, avg] of sorted) {
                    if (avg > 0.05) console.log(`${name}: ${avg.toFixed(3)}ms`);
                }
                console.log(`FPS: ${(perfFrameCount / ((timestamp - perfLastLogTime) / 1000)).toFixed(1)}`);
                
                // Reset
                for (const key in perfMetrics) perfMetrics[key] = 0;
                perfFrameCount = 0;
                perfLastLogTime = timestamp;
            }
        }

        // Request the browser to call gameLoop again on the next animation frame
        gameLoopId = requestAnimationFrame(gameLoop);
    }


    // --- Module Public Interface ---
    return {
        initializeWorld,
        startGame,
        gameLoop,
        draw,
        closeInventory, // Expose for main.js
        createCannonEffect, // --- NEW: Expose for ships to call ---
        handleShipSeizure, // Expose for FleetUI
        swapFlagship, // Expose for Inventory UI
        get fleetManager() { return fleetManager; } // Expose for WorldManager reconnection
    };
})();

window.PlunderGame = PlunderGame;