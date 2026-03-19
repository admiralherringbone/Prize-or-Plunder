const PlunderGame = (function() {
    // --- Canvas & Context ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d'); // Get the 2D rendering context

    // --- Game State Variables ---
    let player;
    let worldManager;
    let fleetManager; // --- NEW: Fleet Manager ---
    let collisionManager; // --- NEW: Collision Manager ---
    let activeNpcs = [];
    let activeIslands = [];
    let activeRocks = [];
    let activeShoals = []; // --- NEW: Environment Manager ---
    let activeCoralReefs = [];
    let allShips = []; // --- OPTIMIZATION: Unified array to reduce GC pressure ---
    let inputManager; // --- NEW: Input Manager ---
    let boardingManager, uiManager, effectManager;
    let cannonballs = [], volleys = [];
    let cameraX = 0, cameraY = 0;
    let spawnManager; // --- NEW: Spawn Manager ---

    let shorelineRenderer = null; // --- NEW: Shoreline Renderer ---

    let screenMouseX = 0; // New: Track screen-space mouse X for UI hover
    let screenMouseY = 0; // New: Track screen-space mouse Y for UI hover
    let previousKeys = {}; // --- NEW: For key edge detection ---
    let wasMouseDown = false; // --- NEW: For mouse button edge detection ---
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
    let renderUI = true; // --- NEW: Toggle for UI rendering ---
    let crowsNestActive = false; // New: Track if Crow's Nest button is held
    let isSpyglassActive = false; // --- NEW: Spyglass state ---
    let spyglassOffsetX = 0;      // --- NEW: Spyglass X offset from player ---
    let spyglassOffsetY = 0;      // --- NEW: Spyglass Y offset from player ---
    let spyglassProgress = 0;     // --- NEW: Animation progress (0.0 to 1.0) ---
    let spyglassInputVector = { x: 0, y: 0 }; // --- NEW: Joystick input vector ---
    let isDraggingSpyglassJoystick = false; // --- NEW: Joystick drag state ---


    // --- NEW: Off-screen canvas for pre-rendering the static minimap ---
    let minimapCacheCanvas = null;
    let gameLoopId = null; // --- NEW: Track the game loop ID to prevent stacking ---

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
    let environmentManager;

    // --- Performance Profiling ---
    let ENABLE_PERFORMANCE_LOGGING = false; // Changed to let to allow runtime toggling
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
        if (boardingManager.isInventoryOpen) {
            closeInventory();
            return;
        }

        // Check if we are currently engaged with a target (surrendered and close enough)
        let targetToOpen = boardingManager.inventoryTarget;
        
        // Fallback: If no inventoryTarget is tracked, but we are boarding a surrendered ship
        if (!targetToOpen && boardingManager.isActive && boardingManager.target && boardingManager.target.aiState === 'surrendered') {
            targetToOpen = boardingManager.target;
        }

        if (targetToOpen && targetToOpen.aiState === 'surrendered') {
             // Open dual view: Target (Left) + Player (Right)
             if (window.openInventoryMenu) {
                window.openInventoryMenu(targetToOpen, player);
                boardingManager.inventoryTarget = targetToOpen; // Ensure tracking
                boardingManager.isInventoryOpen = true;
             }
        } else {
             // Open single view: Player
             if (window.openInventoryMenu) {
                window.openInventoryMenu(player);
                boardingManager.isInventoryOpen = true;
             }
        }
    }

    /**
     * Centralized input processing function.
     * Pulls state from InputManager, handles edges (toggles), and dispatches actions.
     */
    function processInput(deltaTime) {
        if (!isGameActive || !inputManager) return;
        
        // --- OPTIMIZATION: Use cached rect from InputManager to avoid reflow ---
        const canvasRect = inputManager.getRect();

        // --- 1. Keyboard Handling (Edge Detection for Toggles) ---
        const currentKeys = inputManager.keys;
        
        // Helper to check if a key was just pressed this frame
        const isJustPressed = (key) => currentKeys[key] && !previousKeys[key];

        if (player) {
            if (isJustPressed('ArrowUp')) {
                // Toggle auto-sail logic
                if (player.isReefed) player.unReef();
                if (player.isMovingBackward) {
                    player.isMovingBackward = false;
                    player.sailingForwardToggleOn = false;
                } else {
                    player.sailingForwardToggleOn = !player.sailingForwardToggleOn;
                }
            } else if (isJustPressed('ArrowDown')) {
                player.sailingForwardToggleOn = false;
                // Check Shift modifier directly from current keys state for the combo
                if (currentKeys['Shift']) {
                    player.toggleReef();
                }
            }

            if (isJustPressed('q') || isJustPressed('Q')) toggleAnchor();
            if (isJustPressed('m') || isJustPressed('M')) toggleExpandedMap();
            if (isJustPressed('e') || isJustPressed('E')) toggleInventory();

            // --- NEW: Screenshot Controls ---
            if (isJustPressed('h') || isJustPressed('H')) {
                renderUI = !renderUI; // Toggle HUD visibility
            }
            if (isJustPressed('p') || isJustPressed('P')) {
                // Capture Screenshot
                const link = document.createElement('a');
                const now = new Date();
                const timestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
                link.download = `Plunder_Screenshot_${timestamp}.png`;
                link.href = canvas.toDataURL();
                link.click();
            }
        }

        // Update previous keys state
        // OPTIMIZATION: We only care about specific keys, but copying the whole object is safer and still fast.
        Object.assign(previousKeys, currentKeys);

        // --- 2. Mouse Move Logic ---
        const effectiveScale = worldToScreenScale * currentZoomMultiplier;
        
        // Update tracked screen coords for UI
        screenMouseX = inputManager.mouse.screenX;
        screenMouseY = inputManager.mouse.screenY;

        // --- NEW: Spyglass Panning ---
        if (isSpyglassActive) {
            const isDown = inputManager.mouse.isDown;
            
            // Check for joystick interaction
            if (isDown && !wasMouseDown && uiManager && uiManager.spyglassJoystickBounds) {
                const bounds = uiManager.spyglassJoystickBounds;
                // Check if click is within the joystick outer radius
                if (distance({x: screenMouseX, y: screenMouseY}, bounds) <= bounds.radius) {
                    isDraggingSpyglassJoystick = true;
                }
            }

            if (!isDown) {
                isDraggingSpyglassJoystick = false;
                spyglassInputVector = { x: 0, y: 0 }; // Reset vector when released
            }

            if (isDraggingSpyglassJoystick && uiManager && uiManager.spyglassJoystickBounds) {
                const bounds = uiManager.spyglassJoystickBounds;
                const dx = screenMouseX - bounds.x;
                const dy = screenMouseY - bounds.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                // Normalize input vector (clamp to 1.0 length)
                const scale = Math.min(dist, bounds.radius) / bounds.radius;
                const angle = Math.atan2(dy, dx);
                spyglassInputVector = { x: Math.cos(angle) * scale, y: Math.sin(angle) * scale };

                // Apply panning
                const panSpeed = 1.5 * deltaTime; // Adjust speed as needed
                spyglassOffsetX += spyglassInputVector.x * panSpeed;
                spyglassOffsetY += spyglassInputVector.y * panSpeed;

                // --- NEW: Limit spyglass movement to the activation radius ---
                const maxSpyglassRange = worldManager ? (worldManager.sectorSize * worldManager.activationRadius) : 2000;
                const currentDistSq = spyglassOffsetX * spyglassOffsetX + spyglassOffsetY * spyglassOffsetY;
                if (currentDistSq > maxSpyglassRange * maxSpyglassRange) {
                    const scale = maxSpyglassRange / Math.sqrt(currentDistSq);
                    spyglassOffsetX *= scale;
                    spyglassOffsetY *= scale;
                }
            }
        }
        
        // Delegate Mouse Move logic
        // Update NPC hover states
        activeNpcs.forEach(npc => {
            const mouseXWorld = screenMouseX / effectiveScale + cameraX;
            const mouseYWorld = screenMouseY / effectiveScale + cameraY;
            const dist = distance({x: mouseXWorld, y: mouseYWorld}, npc);
            const isOver = dist < npc.shipLength / 2;
            
            if (npc.isHovered && !isOver) {
                npc.displayTimer = 5000;
            }
            npc.isHovered = isOver;
        });

        if (boardingManager) {
            // Mock event object for BoardingManager
            const mockEvent = { clientX: screenMouseX + canvasRect.left, clientY: screenMouseY + canvasRect.top };
            boardingManager.handleMouseMove(mockEvent, { x: cameraX, y: cameraY }, effectiveScale, canvasRect);
        }

        // --- 3. Mouse Button Logic (Edge Detection) ---
        const isDown = inputManager.mouse.isDown;

        if (isDown && !wasMouseDown) {
            // === Handle Mouse Down ===
            // Crow's Nest Hold Check
            if (hudMode === 'navigation' && player) {
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
                const buttonDiameter = reloadBarDiameter; 
                const spacing = buttonDiameter + gap;
                const crowsNestX = centerX; // Index 3 is now centered (offset 0)

                if (distance({x: screenMouseX, y: screenMouseY}, {x: crowsNestX, y: rowY}) <= buttonRadius) {
                    crowsNestActive = true;
                }
            }
            
            if (boardingManager) {
                const mockEvent = { clientX: screenMouseX + canvasRect.left, clientY: screenMouseY + canvasRect.top };
                boardingManager.handleMouseDown(mockEvent, { x: cameraX, y: cameraY }, effectiveScale, canvasRect);
            }
        } else if (!isDown && wasMouseDown) {
            // === Handle Mouse Up ===
            crowsNestActive = false;
            if (boardingManager) {
                const mockEvent = { clientX: screenMouseX + canvasRect.left, clientY: screenMouseY + canvasRect.top };
                boardingManager.handleMouseUp(mockEvent);
            }
        }
        wasMouseDown = isDown;

        // --- 4. Click Processing ---
        const clicks = inputManager.getAndClearClicks();
        clicks.forEach(clickEvent => {
            processSingleClick(clickEvent.x, clickEvent.y);
        });
    }

    /**
     * Processes a single click event (extracted from the old handleCanvasClick).
     */
    function processSingleClick(mouseX, mouseY) {
        if (!player) return;

        // --- Map Toggling Logic (High Priority) ---
        const miniMapSize = 112.5;
        const margin = 20;
        const miniMapX = margin;
        const miniMapY = canvas.height - miniMapSize - margin;
        if (mouseX >= miniMapX && mouseX <= miniMapX + miniMapSize &&
            mouseY >= miniMapY && mouseY <= miniMapY + miniMapSize) {
            toggleExpandedMap();
            return; 
        }

        if (isMapExpanded) {
            const largeMapSize = canvas.height * 0.75;
            const largeMapX = (canvas.width - largeMapSize) / 2;
            const largeMapY = (canvas.height - largeMapSize) / 2;
            if (mouseX >= largeMapX && mouseX <= largeMapX + largeMapSize &&
                mouseY >= largeMapY && mouseY <= largeMapY + largeMapSize) {
                toggleExpandedMap();
                return; 
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
        // The bounds are now calculated and stored by the UIManager during the draw phase.
        // We just check against the stored bounds here.
        if (uiManager && uiManager.debugRankButtonBounds) {
            const bounds = uiManager.debugRankButtonBounds;
            if (distance({x: mouseX, y: mouseY}, {x: bounds.x, y: bounds.y}) <= bounds.radius) {
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
                
                if (environmentManager) {
                    const progress = environmentManager.dayNightTimer / DAY_NIGHT_CYCLE_DURATION;
                    if (progress < 0.5) {
                        environmentManager.dayNightTimer = DAY_NIGHT_CYCLE_DURATION * 0.75; // Set to Midnight
                    } else {
                        environmentManager.dayNightTimer = DAY_NIGHT_CYCLE_DURATION * 0.25; // Set to Noon
                    }
                }
                return;
            }
        }

        // --- HUD Control Buttons (Delegated to UIManager in concept, but currently processed here) ---
        // This mimics the logic from the old handleCanvasClick
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
            // Back Button
            if (distance({x: mouseX, y: mouseY}, {x: centerX, y: buttonY + 5}) <= buttonRadius) {
                hudMode = 'main';
                return;
            }

            const rowY = buttonY - 20;
            const carouselY = rowY - 60;
            const arrowOffset = 85;
            const arrowRadius = 20; 
            const sideOffset = 50;
            const sideRadius = 20; 

            const shotTypes = ['round-shot', 'chain-shot', 'grape-shot', 'canister-shot'];
            const currentIndex = shotTypes.indexOf(player.selectedShotType);

            // Left Arrow
            if (distance({x: mouseX, y: mouseY}, {x: centerX - arrowOffset, y: carouselY}) <= arrowRadius) {
                const newIndex = (currentIndex - 1 + shotTypes.length) % shotTypes.length;
                player.selectedShotType = shotTypes[newIndex];
                player.lastShotTypeSelectionTime = performance.now();
                return;
            }
            // Right Arrow
            if (distance({x: mouseX, y: mouseY}, {x: centerX + arrowOffset, y: carouselY}) <= arrowRadius) {
                const newIndex = (currentIndex + 1) % shotTypes.length;
                player.selectedShotType = shotTypes[newIndex];
                player.lastShotTypeSelectionTime = performance.now();
                return;
            }
            // Side items (Left/Right) - same logic
            if (distance({x: mouseX, y: mouseY}, {x: centerX - sideOffset, y: carouselY}) <= sideRadius) {
                const newIndex = (currentIndex - 1 + shotTypes.length) % shotTypes.length;
                player.selectedShotType = shotTypes[newIndex];
                player.lastShotTypeSelectionTime = performance.now();
                return;
            }
            if (distance({x: mouseX, y: mouseY}, {x: centerX + sideOffset, y: carouselY}) <= sideRadius) {
                const newIndex = (currentIndex + 1) % shotTypes.length;
                player.selectedShotType = shotTypes[newIndex];
                player.lastShotTypeSelectionTime = performance.now();
                return;
            }

            // 6 Combat Buttons
            const spacing = buttonDiameter + gap;
            const xOffsets = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map(factor => factor * spacing);

            for (let i = 0; i < 6; i++) {
                if (distance({x: mouseX, y: mouseY}, {x: centerX + xOffsets[i], y: rowY}) <= buttonRadius) {
                    hudButtonClickTimes[i] = performance.now();
                    if (i === 0) {
                        player.fire('port', cannonballs, volleys);
                        player.fire('starboard', cannonballs, volleys);
                        player.fire('bow', cannonballs, volleys);
                        player.fire('stern', cannonballs, volleys);
                    } else if (i === 1) { player.fire('port', cannonballs, volleys); }
                    else if (i === 2) { player.fire('starboard', cannonballs, volleys); }
                    else if (i === 3) { player.fire('bow', cannonballs, volleys); }
                    else if (i === 4) { player.fire('stern', cannonballs, volleys); }
                    return;
                }
            }
        } else if (hudMode === 'navigation') {
            if (distance({x: mouseX, y: mouseY}, {x: centerX, y: buttonY + 5}) <= buttonRadius) {
                hudMode = 'main';
                return;
            }

            const rowY = buttonY - 20;
            // --- NEW: Adjust for 7 buttons ---
            const spacing = buttonDiameter + gap;
            const xOffsets = [-3, -2, -1, 0, 1, 2, 3].map(factor => factor * spacing);
            for (let i = 0; i < 7; i++) { // --- NEW: Loop to 7 ---
                if (distance({x: mouseX, y: mouseY}, {x: centerX + xOffsets[i], y: rowY}) <= buttonRadius) {
                    hudButtonClickTimes[i] = performance.now();
                    if (i === 0) { // Open
                        if (player.isReefed) player.unReef();
                        player.isSailOpen = true;
                        player.isMovingBackward = false;
                        player.sailingForwardToggleOn = true;
                    } else if (i === 1) { // Close
                        player.isSailOpen = false;
                        player.sailingForwardToggleOn = false;
                    } else if (i === 2) { // Reef
                        player.toggleReef();
                    } else if (i === 3) { 
                        // Crow's Nest logic is handled in MouseDown/Up
                    } else if (i === 4) { // Anchor
                        toggleAnchor();
                    } else if (i === 5) { // Lights
                        if (player) player.lightsOn = !player.lightsOn;
                    } else if (i === 6) { // --- NEW: Spyglass ---
                        isSpyglassActive = !isSpyglassActive;
                        // Reset offset when toggling off
                        if (!isSpyglassActive) {
                            spyglassOffsetX = 0;
                            spyglassOffsetY = 0;
                            spyglassInputVector = { x: 0, y: 0 };
                            isDraggingSpyglassJoystick = false;
                        }
                    }
                    return;
                }
            }
        }
    }

    /**
     * Generates the game world with islands, rocks, and NPCs.
     * @param {function} [progressCallback] - Optional function to report loading progress.
     */
    function generateWorld(progressCallback) {
        // Reset game entities
        // --- NEW: Instantiate the WorldManager ---
        // The sector size should be larger than the player's view distance.
        const sectorSize = (Math.max(canvas.width, canvas.height) / worldToScreenScale) * 1.5;
        worldManager = new WorldManager(WORLD_WIDTH, WORLD_HEIGHT, sectorSize);

        cannonballs = [];
        volleys = [];
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
                worldManager.addStaticObject(newIsland);
                spatialGrid.insert(newIsland);
            }
        }
        if (progressCallback) progressCallback(50);

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
                worldManager.addStaticObject(newRock);
                spatialGrid.insert(newRock);
            }
        }
        if (progressCallback) progressCallback(60);

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
                worldManager.addStaticObject(newCoralReef);
                spatialGrid.insert(newCoralReef);
            }
        }
        if (progressCallback) progressCallback(70);

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
    function initializeWorld(progressCallback) {
        // This function is designed to be called once on page load.
        // It sets up everything needed to render the world *without* the player.
        // The gameLoop will be started separately by startGame().

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // --- NEW: Initialize Input Manager ---
        inputManager = new InputManager(canvas);

        _initGameOverUI(); // --- NEW: Initialize UI ---
        lastWindChangeTime = performance.now();
        // --- FIX: Expose windDirection globally for legacy rig scripts ---
        window.windDirection = windDirection;
        generateWorld(progressCallback);

        // --- NEW: Initialize Shoreline Renderer ---
        shorelineRenderer = new ShorelineRenderer();

        // --- NEW: Pathfinder uses all obstacles from the WorldManager ---
        const staticObstacles = worldManager.getAllStaticObjects();
        pathfinder = new Pathfinder(staticObstacles, WORLD_WIDTH, WORLD_HEIGHT, PATHFINDING_CELL_SIZE);

        // --- NEW: Initialize Boarding Manager ---
        boardingManager = new BoardingManager({
            getPlayer: () => player,
            // --- FIX: Pass the correct closeInventory function ---
            // The inventory UI is now managed by the game, not the window.
            openInventoryMenu: window.openInventoryMenu,
            closeInventoryMenu: () => {
                const inventoryScreen = document.getElementById('inventory-screen');
                if (inventoryScreen) inventoryScreen.style.display = 'none';
                const cargoDialog = document.getElementById('cargo-action-dialog');
                if (cargoDialog) cargoDialog.style.display = 'none';
            },
            triggerGameOver: triggerGameOver
        });

        // --- NEW: Initialize UI Manager ---
        uiManager = new UIManager();

        // --- NEW: Initialize Environment Manager ---
        environmentManager = new EnvironmentManager();

        // --- NEW: Initialize Effect Manager ---
        effectManager = new EffectManager();

        // --- NEW: Initialize Collision Manager ---
        collisionManager = new CollisionManager({
            getPlayer: () => player,
            getEffectManager: () => effectManager,
            getBoardingManager: () => boardingManager,
            getAllShips: () => allShips,
            getCannonballs: () => cannonballs,
            getSpatialGrid: () => spatialGrid
        });
        // Spawn NPCs now that the pathfinder is ready
        // --- NEW: Initialize Spawn Manager ---
        spawnManager = new SpawnManager(worldManager, pathfinder, () => player, spatialGrid);

        // Spawn NPCs now that the pathfinder is ready
        spawnManager.spawnInitialNpcs();
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

        // --- FIX: Flush stale inputs from the menu phase ---
        // This prevents clicks made in the menu from triggering in-game actions immediately.
        if (inputManager) {
            inputManager.getAndClearClicks(); 
            // Sync previousKeys to current state so holding a key in the menu doesn't 
            // trigger a "Just Pressed" toggle event on the first frame of the game.
            Object.assign(previousKeys, inputManager.keys); 
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
        if (gameOverOverlay) gameOverOverlay.style.display = 'none';
        if (effectManager) effectManager.reset();
        if (boardingManager) boardingManager.reset();
        currentZoomMultiplier = 1.0;
        
        if (environmentManager) environmentManager.reset();
        if (spawnManager) spawnManager.reset();

        // Clear dynamic entities lists
        volleys = []; 
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
        if (boardingManager) boardingManager.inventoryTarget = null;

        // Regenerate World (for background ambiance)
        generateWorld();
        const staticObstacles = worldManager.getAllStaticObjects();
        pathfinder = new Pathfinder(staticObstacles, WORLD_WIDTH, WORLD_HEIGHT, PATHFINDING_CELL_SIZE);
        
        // Spawn NPCs for background activity
        if (spawnManager) spawnManager.spawnInitialNpcs();
        
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

    /**
     * --- NEW: Draws the main game world from a specific camera perspective. ---
     * This is a refactored helper to avoid duplicating drawing code for the spyglass view.
     * @param {number} cameraX - The world X coordinate for the top-left of the view.
     * @param {number} cameraY - The world Y coordinate for the top-left of the view.
     * @param {number} effectiveScale - The current world-to-screen scale.
     */
    function _drawWorldContent(cameraX, cameraY, effectiveScale) {
        // Clamp camera to world boundaries to prevent showing empty space
        const effectiveCanvasWidth = canvas.width / effectiveScale;
        const effectiveCanvasHeight = canvas.height / effectiveScale;
        cameraX = Math.max(0, Math.min(cameraX, WORLD_WIDTH - effectiveCanvasWidth));
        cameraY = Math.max(0, Math.min(cameraY, WORLD_HEIGHT - effectiveCanvasHeight));

        ctx.save();
        ctx.scale(effectiveScale, effectiveScale);
        ctx.translate(-cameraX, -cameraY);

        // --- The entire world drawing logic from the original draw() function goes here ---
        let tStart = performance.now();

        if (effectManager) {
            effectManager.drawWaterSurface(ctx, effectiveScale, windDirection, activeIslands);
        }

        if (DEBUG.ENABLED && DEBUG.DRAW_ANCHOR_ZONES) {
            let tIslandsStart = performance.now();
            ctx.save();
            ctx.strokeStyle = '#00FFFF'; ctx.fillStyle = '#00FFFF'; ctx.lineWidth = 4 / effectiveScale;
            ctx.setLineDash([0, 15 / effectiveScale]); ctx.lineCap = 'round';
            ctx.font = `${12 / effectiveScale}px monospace`; ctx.textAlign = "center";
            const labelsToDraw = [];
            worldManager.getActiveObjects().statics.forEach(obstacle => {
                if (!obstacle.debugAnchorZonePath) {
                    const geometrySource = (obstacle.type === 'coralReef' && obstacle.rockBase) ? obstacle.rockBase : obstacle;
                    const points = geometrySource.outerPerimeterPoints;
                    if (points && obstacle.proximityRadius > 0) {
                        obstacle.debugAnchorZonePath = new Path2D();
                        const cx = obstacle.x; const cy = obstacle.y; const r = obstacle.proximityRadius;
                        let minY = Infinity;
                        points.forEach((p, i) => {
                            const dx = p.x - cx; const dy = p.y - cy;
                            const dist = Math.sqrt(dx*dx + dy*dy);
                            if (dist > 0.001) {
                                const scale = (dist + r) / dist;
                                const ex = cx + dx * scale; const ey = cy + dy * scale;
                                if (ey < minY) minY = ey;
                                if (i === 0) obstacle.debugAnchorZonePath.moveTo(ex, ey);
                                else obstacle.debugAnchorZonePath.lineTo(ex, ey);
                            }
                        });
                        obstacle.debugAnchorZonePath.closePath();
                        obstacle.debugAnchorLabelY = minY;
                    } else {
                        obstacle.debugAnchorZonePath = new Path2D(); 
                    }
                }
                if (obstacle.debugAnchorZonePath) {
                    ctx.stroke(obstacle.debugAnchorZonePath);
                    if (obstacle.debugAnchorLabelY !== undefined) {
                        labelsToDraw.push({text: "Anchor Zone", x: obstacle.x, y: obstacle.debugAnchorLabelY - (10 / effectiveScale)});
                    }
                }
            });
            ctx.setLineDash([]);
            labelsToDraw.forEach(l => ctx.fillText(l.text, l.x, l.y));
            ctx.restore();
            if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Draw: Islands'] = (perfMetrics['Draw: Islands'] || 0) + (performance.now() - tIslandsStart);
        }

        activeShoals.forEach(shoal => shoal.drawWorldSpace(ctx, effectiveScale, windDirection));
        activeCoralReefs.forEach(reef => reef.drawWorldSpace(ctx, effectiveScale, windDirection));

        const viewBuffer = 200;
        const viewBounds = { minX: cameraX - viewBuffer, maxX: cameraX + effectiveCanvasWidth + viewBuffer, minY: cameraY - viewBuffer, maxY: cameraY + effectiveCanvasHeight + viewBuffer };

        let tShipsStart = performance.now();
        const allActiveShips = [player, ...activeNpcs].filter(s => s);
        allActiveShips.forEach(ship => {
            if (ship.x < viewBounds.minX || ship.x > viewBounds.maxX || ship.y < viewBounds.minY || ship.y > viewBounds.maxY) return;
            if (ship.isSinking && (ship.sinkHp / ship.maxSinkHp) > 0.5) {
                ship.drawWorldSpace(ctx, effectiveScale, windDirection, 'sinking-hull');
            }
        });
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Draw: Ships'] = (perfMetrics['Draw: Ships'] || 0) + (performance.now() - tShipsStart);

        drawGrid(cameraX, cameraY, effectiveCanvasWidth, effectiveCanvasHeight);
        drawNpcPaths(ctx, effectiveScale, activeNpcs);

        if (player && player.isAnchored && player.anchorPoint) {
            // ... (anchor line drawing logic is complex and remains here)
        }

        let tIslandsStart2 = performance.now();
        ctx.save();
        worldManager.getActiveObjects().statics.forEach(obstacle => {
            if (!obstacle.shoreGlowCache) _createShoreGlowCacheForObstacle(obstacle);
            if (obstacle.shoreGlowCache) ctx.drawImage(obstacle.shoreGlowCache, obstacle.shoreGlowOffset.x, obstacle.shoreGlowOffset.y);
        });
        ctx.restore();

        const viewport = { x: cameraX, y: cameraY, width: effectiveCanvasWidth, height: effectiveCanvasHeight };
        activeIslands.forEach(island => island.drawWorldSpace(ctx, effectiveScale, windDirection, shorelineRenderer, performance.now(), viewport));
        activeRocks.forEach(rock => rock.drawWorldSpace(ctx, effectiveScale, windDirection, shorelineRenderer, performance.now(), viewport));

        if (DEBUG.ENABLED && DEBUG.DRAW_CONVEX_HULLS && worldManager) {
            // ... (convex hull drawing logic) ...
        }
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Draw: Islands'] = (perfMetrics['Draw: Islands'] || 0) + (performance.now() - tIslandsStart2);

        activeNpcs.forEach(npc => npc.drawAimingLine(ctx, effectiveScale));

        // --- NEW: Draw Boarding Availability Indicator ---
        if (boardingManager && player && spatialGrid) {
            boardingManager.drawAvailabilityIndicators(ctx, effectiveScale, player, spatialGrid);
        }

        let tShipsStart2 = performance.now();
        allActiveShips.forEach(ship => {
            if (ship.x < viewBounds.minX || ship.x > viewBounds.maxX || ship.y < viewBounds.minY || ship.y > viewBounds.maxY) return;
            if (ship.isSinking) {
                if ((ship.sinkHp / ship.maxSinkHp) <= 0.5) ship.drawWorldSpace(ctx, effectiveScale, windDirection, 'full');
                else ship.drawWorldSpace(ctx, effectiveScale, windDirection, 'sinking-effects');
            }
        });
        allActiveShips.forEach(ship => {
            if (ship.x < viewBounds.minX || ship.x > viewBounds.maxX || ship.y < viewBounds.minY || ship.y > viewBounds.maxY) return;
            if (!ship.isSinking) ship.drawWorldSpace(ctx, effectiveScale, windDirection, 'full');
        });
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Draw: Ships'] = (perfMetrics['Draw: Ships'] || 0) + (performance.now() - tShipsStart2);

        // --- FIX: Draw Effects ON TOP of Ships ---
        let tEffectsStart = performance.now();
        cannonballs.forEach(ball => ball.drawWorldSpace(ctx, effectiveScale, windDirection));
        if (effectManager) effectManager.draw(ctx, effectiveScale);
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Draw: Effects'] = (perfMetrics['Draw: Effects'] || 0) + (performance.now() - tEffectsStart);

        if (!gameOverState.active && boardingManager) boardingManager.draw(ctx, effectiveScale);

        // --- NEW: Draw Night Overlay & Lights ---
        if (environmentManager) {
            // Use the function arguments (local camera), not the globals.
            environmentManager.draw(ctx, { x: cameraX, y: cameraY }, effectiveScale, allShips, effectManager);
        }

        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
            activeNpcs.forEach(npc => {
                if (typeof npc.drawDebugOverlay === 'function') npc.drawDebugOverlay(ctx, effectiveScale);
            });
        }

        ctx.restore();
    }

    /**
     * --- NEW: Draws the bottom part of the screen showing the player's ship. ---
     */
    function _drawPlayerViewport(effectiveScale) {
        const effectiveCanvasHeight = canvas.height / effectiveScale;
        const effectiveCanvasWidth = canvas.width / effectiveScale;

        // Position camera to show player ship in the bottom 1/4 of the screen
        const cameraX = player.x - effectiveCanvasWidth / 2;
        const cameraY = player.y - (effectiveCanvasHeight * 0.85); // 85% of the view is above the player

        ctx.save();
        // Clip to the bottom 25% of the screen
        ctx.beginPath();
        ctx.rect(0, canvas.height * 0.75, canvas.width, canvas.height * 0.25);
        ctx.clip();
        _drawWorldContent(cameraX, cameraY, effectiveScale);
        ctx.restore();
    }

    /**
     * The main drawing function. It handles camera transformations and renders all
     * game objects and UI elements.
     */
    function draw() {
        let tStart = performance.now();

        // Fill the background with the ocean color first.
        if (!ctx) return;

        // This replaces the need for ctx.clearRect().
        ctx.fillStyle = OCEAN_BLUE;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // --- NEW: Calculate Effective Scale ---
        const effectiveScale = worldToScreenScale * currentZoomMultiplier;

        // --- FIX: Check progress so we render during closing animation ---
        if ((isSpyglassActive || spyglassProgress > 0) && player) {
            // --- PASS 1: Player Ship View (Bottom of Screen) ---
            _drawPlayerViewport(effectiveScale);
    
            // --- PASS 2: Spyglass View (Center of Screen) ---
            const effectiveCanvasWidth = canvas.width / effectiveScale;
            const effectiveCanvasHeight = canvas.height / effectiveScale;
    
            // --- FIX: Center the camera on the target point ---
            let spyglassCamX = (player.x + spyglassOffsetX) - (effectiveCanvasWidth / 2);
            let spyglassCamY = (player.y + spyglassOffsetY) - (effectiveCanvasHeight / 2);
    
            // Clamp to active sector boundaries
            const playerSectorX = Math.floor(player.x / worldManager.sectorSize);
            const playerSectorY = Math.floor(player.y / worldManager.sectorSize);
            const radius = worldManager.activationRadius;
            const minWorldX = (playerSectorX - radius) * worldManager.sectorSize;
            const maxWorldX = ((playerSectorX + radius + 1) * worldManager.sectorSize) - effectiveCanvasWidth;
            const minWorldY = (playerSectorY - radius) * worldManager.sectorSize;
            const maxWorldY = ((playerSectorY + radius + 1) * worldManager.sectorSize) - effectiveCanvasHeight;
    
            spyglassCamX = Math.max(minWorldX, Math.min(spyglassCamX, maxWorldX));
            spyglassCamY = Math.max(minWorldY, Math.min(spyglassCamY, maxWorldY));
    
            // --- FIX: Clip Spyglass View to Top 75% to prevent bleeding into Player View ---
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, canvas.width, canvas.height * 0.75);
            ctx.clip();
            _drawWorldContent(spyglassCamX, spyglassCamY, effectiveScale);
            ctx.restore();
    
        } else {
            // --- Original Single-Viewport Rendering ---
            const effectiveCanvasWidth = canvas.width / effectiveScale;
            const effectiveCanvasHeight = canvas.height / effectiveScale;
            let camX = cameraX, camY = cameraY;
            if (player) {
                camX = player.x - effectiveCanvasWidth / 2;
                camY = player.y - effectiveCanvasHeight / 2;
            }
            _drawWorldContent(camX, camY, effectiveScale);
        }

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
        // --- REFACTOR: Delegate all UI drawing to the UIManager ---
        if (uiManager && renderUI) {
            // Construct a gameState object to pass all necessary data to the UI manager.
            // This keeps the function signature clean and decouples the UI from the main game's scope.
            const uiGameState = {
                canvas,
                player,
                gameOverState,
                windDirection,
                worldManager,
                activeNpcs,
                minimapCacheCanvas,
                boardingManager,
                environmentManager, // Pass the environment manager for UI elements
                hudMode,
                screenMouseX,
                screenMouseY,
                hudButtonClickTimes,
                fleetManager,
                mapAnimationProgress,
                isSpyglassActive,
                spyglassInputVector,
                spyglassOffsetX, // --- NEW: Pass offsets for UI visualization ---
                spyglassOffsetY,
                spyglassProgress // --- NEW: Pass animation progress ---
            };
            uiManager.draw(ctx, uiGameState);
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
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Draw: UI'] = (perfMetrics['Draw: UI'] || 0) + (performance.now() - tStart);
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
            ship.update(deltaTime, inputManager.keys, player, windDirection, cannonballs, volleys, activeIslands, activeNpcs, pathfinder, spatialGrid);
        });

        // --- FIX: Update cannonballs AFTER ships have updated. ---
        // This ensures that any cannonballs created during a ship's update (e.g., from a rolling broadside)
        // have their position updated in the same frame, preventing immediate self-collision.
        cannonballs.forEach(ball => {
            ball.update();
            if (ball.distanceTraveled > ball.maxDistance) {
                ball.markedForRemoval = true;
                // Trigger splash effect when cannonball hits the water (max distance)
                if (effectManager) effectManager.createSplash(ball.x, ball.y);
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
        if (effectManager) effectManager.createCannonEffect(x, y, angle, windDirection);
    }

    // --- NEW: Inventory Actions (Exposed to window for UI to call) ---
    window.inventoryActions = {
        abandon: (shipId) => {
            let ship = activeNpcs.find(s => s.shipId === shipId);
            // Fallback: if not found in active list (rare), check the tracked target
            if (!ship && boardingManager.inventoryTarget && boardingManager.inventoryTarget.shipId === shipId) {
                ship = boardingManager.inventoryTarget;
            }

            if (ship) {
                console.log(`[Inventory] Abandoning ${ship.shipId}.`);
                // Just close the menu; the ship remains surrendered and the timer will tick down naturally.
                boardingManager.endBoarding(); // Break the connection and close UI

            }
        },
        scuttle: (shipId) => {
            let ship = activeNpcs.find(s => s.shipId === shipId);
            let inActiveList = true;

            // Fallback: if not found in active list, check the tracked target
            if (!ship && boardingManager.inventoryTarget && boardingManager.inventoryTarget.shipId === shipId) {
                ship = boardingManager.inventoryTarget;
                inActiveList = false;
            }

            if (ship) {
                console.log(`[Inventory] Scuttling ${ship.shipId}.`);
                ship.hp = 0; // Destroy the ship
                
                // If not in active list, cleanupEntities won't see it, so handle removal manually.
                if (!inActiveList) {
                    if (spawnManager) spawnManager.onNpcSunk(ship);
                    
                    // --- NEW: Remove from Fleet Manager if Allied ---
                    if (ship.isAllied && fleetManager) {
                        fleetManager.removeMember(ship);
                    }

                    worldManager.removeDynamicObject(ship);
                }
                boardingManager.endBoarding(); // Break the connection and close UI

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
                // --- NEW: End boarding if the target dies --- // --- FIX: Call manager method ---
                if (boardingManager.isActive && boardingManager.target === npc) {
                    boardingManager.endBoarding();
                }

                // --- NEW: Close Inventory UI if the target dies ---
                // This prevents unnecessary distance checks for a ship that no longer exists.
                if (boardingManager.inventoryTarget === npc) {
                    const inventoryScreen = document.getElementById('inventory-screen');
                    if (inventoryScreen) {
                        inventoryScreen.style.display = 'none';
                    }
                    const cargoDialog = document.getElementById('cargo-action-dialog');
                    if (cargoDialog) {
                        cargoDialog.style.display = 'none';
                    }
                    if (boardingManager) boardingManager.inventoryTarget = null;
                }

                // --- FIX: Release Cached Canvases to CanvasManager ---
                // When a ship is fully removed, we must release its visual resources back to the pool.
                if (npc.hullCacheCanvas) {
                    window.CanvasManager.releaseCanvas(npc.hullCacheCanvas);
                    npc.hullCacheCanvas = null;
                }
                if (npc.shipCacheCanvas) { // Check for base ship cache as well
                    window.CanvasManager.releaseCanvas(npc.shipCacheCanvas);
                    npc.shipCacheCanvas = null;
                }

                // --- NEW: Remove from Fleet Manager if Allied ---
                if (npc.isAllied && fleetManager) {
                    fleetManager.removeMember(npc);
                }
                
                if (npc.hasBeenAttackedByPlayer && player) {
                    player.stats.shipsSunk++;
                    player.updateRank();
                }

                if (spawnManager) spawnManager.onNpcSunk(npc);
                worldManager.removeDynamicObject(npc);
                activeNpcs.splice(i, 1);
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
        // --- NEW: Process Input ---
        processInput(deltaTime);

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

        // --- FIX: Update global camera position for EffectManager ---
        // The EffectManager uses the global cameraX/Y to spawn and cull wavelets.
        // We must update these globals to match the player's view (or spyglass view).
        if (player) {
            const effectiveScale = worldToScreenScale * currentZoomMultiplier;
            const effectiveCanvasWidth = canvas.width / effectiveScale;
            const effectiveCanvasHeight = canvas.height / effectiveScale;
            
            let targetX, targetY;
            
            // If Spyglass is active, center effects on the spyglass view
            if (isSpyglassActive) {
                targetX = (player.x + spyglassOffsetX) - (effectiveCanvasWidth / 2);
                targetY = (player.y + spyglassOffsetY) - (effectiveCanvasHeight / 2);
            } else {
                // Otherwise center on player
                targetX = player.x - effectiveCanvasWidth / 2;
                targetY = player.y - effectiveCanvasHeight / 2;
            }

            // Clamp to world boundaries to match rendering logic
            cameraX = Math.max(0, Math.min(targetX, WORLD_WIDTH - effectiveCanvasWidth));
            cameraY = Math.max(0, Math.min(targetY, WORLD_HEIGHT - effectiveCanvasHeight));
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

        // --- NEW: Spyglass Animation Logic ---
        const SPYGLASS_ANIMATION_SPEED = 0.004; // ~250ms duration
        if (isSpyglassActive) {
            spyglassProgress = Math.min(1, spyglassProgress + deltaTime * SPYGLASS_ANIMATION_SPEED);
        } else {
            spyglassProgress = Math.max(0, spyglassProgress - deltaTime * SPYGLASS_ANIMATION_SPEED);
        }

        // 1. Update environmental factors like wind
        updateWind();
        // --- FIX: Expose windDirection globally for scripts that rely on it (e.g., Rigs) ---
        window.windDirection = windDirection;
        
        // --- NEW: Update Environment Manager ---
        if (environmentManager) {
            environmentManager.update(deltaTime, () => {
                allShips.forEach(ship => processDailyConsumption(ship));
            });
        }

        // --- NEW: Update Zoom Level ---
        let targetZoom = boardingManager.isActive ? 1.5 : 1.0;
        if (crowsNestActive) targetZoom = 0.666; // Zoom out (1.5x view area approx)
        // Smoothly interpolate current zoom towards target
        currentZoomMultiplier += (targetZoom - currentZoomMultiplier) * ZOOM_EASE_FACTOR;

        // NEW: Run the periodic NPC path failsafe check.
        checkNpcPathsFailsafe();

        // --- NEW: Update Spawn Manager ---
        if (spawnManager) {
            spawnManager.update(deltaTime);
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
        if (boardingManager.inventoryTarget && boardingManager.isInventoryOpen && boardingManager.inventoryTarget instanceof NpcShip) {
            boardingManager.inventoryTarget.isBeingInteractedWith = true;
        }

        updateEntities(deltaTime);

        let tEntities = performance.now();
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Update: Entities'] = (perfMetrics['Update: Entities'] || 0) + (tEntities - tGrid);

        // --- NEW: Update Boarding Physics & Logic ---
        if (boardingManager) {
            boardingManager.update(deltaTime);
        }

        // 4. Handle all collisions and their effects
        if (player && collisionManager) collisionManager.processCollisions(deltaTime);

        let tCollisions = performance.now();
        if (ENABLE_PERFORMANCE_LOGGING) perfMetrics['Update: Collisions'] = (perfMetrics['Update: Collisions'] || 0) + (tCollisions - tEntities);

        // --- NEW: Re-bin active objects that have moved sectors ---
        // FIX: Re-bin BEFORE cleanup. This ensures that if a ship died this frame,
        // it is in the correct sector list for removeDynamicObject to find it.
        if (worldManager) {
            worldManager.rebinActiveObjects();
        }

            // --- NEW: Update Effect Manager ---
            if (effectManager) {
                const effectiveScale = worldToScreenScale * currentZoomMultiplier;
                effectManager.update(deltaTime, cameraX, cameraY, canvas.width, canvas.height, effectiveScale, windDirection);
            }

        // 5. Remove destroyed or expired entities
        cleanupEntities();

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
        // keys = {}; // InputManager manages keys now
        
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
            // --- NEW: Trigger CSS transition for closing ---
            inventoryScreen.classList.remove('visible');
            
            // Hide the element from the layout *after* the transition finishes.
            inventoryScreen.addEventListener('transitionend', () => {
                if (!inventoryScreen.classList.contains('visible')) {
                    inventoryScreen.style.display = 'none';
                }
            }, { once: true });
        }
        boardingManager.isInventoryOpen = false;
        boardingManager.inventoryTarget = null;

        // If we are currently boarding a surrendered or allied ship, closing the menu
        // implies we are done with the interaction, so we disconnect.
        if (boardingManager.isActive && boardingManager.target && (boardingManager.target.aiState === 'surrendered' || boardingManager.target.isAllied)) {
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
                console.groupCollapsed(`📊 Performance (${perfFrameCount} frames @ ${(perfFrameCount / ((timestamp - perfLastLogTime) / 1000)).toFixed(1)} FPS)`);
                
                const sorted = Object.entries(perfMetrics)
                    .map(([k, v]) => [k, v / perfFrameCount])
                    .sort((a, b) => b[1] - a[1]);
                
                for (const [name, avg] of sorted) {
                    if (avg > 0.05) console.log(`${name}: ${avg.toFixed(3)}ms`);
                }
                console.groupEnd();
                
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
        draw, // Expose for main.js
        closeInventory, // Expose for main.js
        createCannonEffect, // --- NEW: Expose for ships to call ---
        handleShipSeizure, // Expose for FleetUI
        swapFlagship, // Expose for Inventory UI
        get fleetManager() { return fleetManager; }, // Expose for WorldManager reconnection
        setPerformanceLogging: (enabled) => { ENABLE_PERFORMANCE_LOGGING = enabled; console.log(`Performance logging set to: ${enabled}`); }
    };
})();

 window.PlunderGame = PlunderGame;