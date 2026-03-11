// main.js - Entry point, responsible for setup and starting the game loop

/**
 * Fetches an SVG file and extracts the path data from its first <path> element.
 * This is a robust way to load external vector assets.
 * @param {string} url - The URL of the SVG file.
 * @returns {Promise<string>} A promise that resolves with the 'd' attribute string.
 */
async function fetchSvgPathData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for url: ${url}`);
        }
        const svgText = await response.text();
        // Use the browser's built-in DOMParser to safely parse the SVG text
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, "image/svg+xml");
        const pathElement = doc.querySelector("path");
        if (!pathElement) {
            throw new Error(`No <path> element found in ${url}`);
        }
        return pathElement.getAttribute('d');
    } catch (error) {
        console.error(`Failed to fetch or parse SVG from ${url}:`, error);
        // Propagate the error to be caught by the main loader
        throw error;
    }
}

/**
 * Main initialization function that runs when the page loads.
 * It orchestrates asset loading before starting the game.
 */
window.onload = async function() {
    // --- PERFORMANCE OPTIMIZATION: Memoize SVG Path Parsing ---
    // The parseAndFlattenSvgPath function is called many times per frame with the same
    // arguments to draw sails. This creates a cache to store the results of this
    // expensive operation, dramatically reducing CPU load during drawing.
    if (typeof parseAndFlattenSvgPath !== 'undefined') {
        const original_parseAndFlattenSvgPath = parseAndFlattenSvgPath;
        const geometryCache = new Map();

        parseAndFlattenSvgPath = function(svgData, width, height, numPoints, maintainAspectRatio, isCentered) {
            // Use a simple key. Rounding dimensions prevents minor floating point differences
            // from creating new cache entries unnecessarily.
            const key = `${svgData.substring(0, 20)}_${width.toFixed(1)}_${height.toFixed(1)}_${numPoints}`;
            
            if (geometryCache.has(key)) {
                return geometryCache.get(key);
            }

            const result = original_parseAndFlattenSvgPath(svgData, width, height, numPoints, maintainAspectRatio, isCentered);
            
            if (geometryCache.size > 500) { geometryCache.delete(geometryCache.keys().next().value); }
            geometryCache.set(key, result);
            return result;
        };
    }

    // --- UI Element References ---
    const startScreen = document.getElementById('start-screen');
    const playerNameInput = document.getElementById('player-name-input');
    const startGameBtn = document.getElementById('start-game-btn');
    const customizeBtn = document.getElementById('customize-btn');
    const shipyardScreen = document.getElementById('shipyard-screen');
    const backToMainMenuBtn = document.getElementById('back-to-main-menu-btn');
    const sailColorSwatch = document.getElementById('sail-color-swatch');
    const shipNameInput = document.getElementById('ship-name-input');
    const statsBtn = document.getElementById('stats-btn');
    const optionsMenuWrapper = document.getElementById('options-menu-wrapper');
    const zoomBtn = document.getElementById('zoom-btn'); // New: Zoom button
    const shipStatsDisplay = document.getElementById('ship-stats-display');

    // --- FIX: Programmatically update title text ---
    // Since index.html is static, we force the update here to ensure "Prize or Plunder" appears.
    const titleContainer = document.querySelector('.title-container');
    if (titleContainer) {
        titleContainer.innerHTML = `
            <div class="title-word">Prize</div>
            <div class="title-conjunction">or</div>
            <div class="title-word">Plunder</div>
        `;
    }

    const pennantColorSwatch = document.getElementById('pennant-color-swatch');
    const hullColorTypeSelect = document.getElementById('hull-color-type-select');
    const customHullColorsWrapper = document.getElementById('custom-hull-colors-wrapper');
    const primaryHullColorSwatch = document.getElementById('primary-hull-color-swatch');
    const secondaryHullColorSwatch = document.getElementById('secondary-hull-color-swatch');
    const bulwarkRailColorSwatch = document.getElementById('bulwark-rail-color-swatch');
    const sparColorTypeSelect = document.getElementById('spar-color-type-select');
    const customSparColorWrapper = document.getElementById('custom-spar-color-wrapper');
    const customSparColorSwatch = document.getElementById('custom-spar-color-swatch');
    const hsvPopup = document.getElementById('hsv-popup');
    const deckColorTypeSelect = document.getElementById('deck-color-type-select');
    const customDeckColorWrapper = document.getElementById('custom-deck-color-wrapper');
    const customDeckColorSwatch = document.getElementById('custom-deck-color-swatch');
    const colorBox = document.getElementById('color-box');
    const colorBoxIndicator = document.getElementById('color-box-indicator');
    const hueSlider = document.getElementById('hue-slider');
    const hueSliderIndicator = document.getElementById('hue-slider-indicator');
    const shipPreviewWindow = document.querySelector('.ship-preview-window');
    const shipPreviewCanvas = document.getElementById('ship-preview-canvas');
    const shipPreviewCtx = shipPreviewCanvas.getContext('2d');
    const shipyardFocusSelect = document.getElementById('shipyard-focus-select');
    const shipBuildTypeSelect = document.getElementById('ship-build-type-select');
    const gunCountWrapper = document.getElementById('gun-count-wrapper');
    const gunCountSelect = document.getElementById('gun-count-select');
    const cargoCapacityWrapper = document.getElementById('cargo-capacity-wrapper');
    const cargoCapacitySelect = document.getElementById('cargo-capacity-select');
    const cargoGunCountWrapper = document.getElementById('cargo-gun-count-wrapper');
    const cargoGunCountSelect = document.getElementById('cargo-gun-count-select');
    const deckCountWrapper = document.getElementById('deck-count-wrapper');
    const deckCountSelect = document.getElementById('deck-count-select');
    const deckType1Wrapper = document.getElementById('deck-type-1-wrapper');
    const deckType1Select = document.getElementById('deck-type-1-select');
    const deckType2Wrapper = document.getElementById('deck-type-2-wrapper');
    const deckType2Select = document.getElementById('deck-type-2-select');
    const beamRatioWrapper = document.getElementById('beam-ratio-wrapper');
    const beamRatioSlider = document.getElementById('beam-ratio-slider');
    const beamRatioValueDisplay = document.getElementById('beam-ratio-value');
    const draughtWrapper = document.getElementById('draught-wrapper');
    const draughtSlider = document.getElementById('draught-slider');
    const draughtValueDisplay = document.getElementById('draught-value');
    const rigTypeSelect = document.getElementById('rig-type-select');
    const mast1RigWrapper = document.getElementById('mast-1-rig-wrapper');
    const mast1RigSelect = document.getElementById('mast-1-rig-select');
    const mast2RigWrapper = document.getElementById('mast-2-rig-wrapper');
    const mast2RigSelect = document.getElementById('mast-2-rig-select');
    const mast3RigWrapper = document.getElementById('mast-3-rig-wrapper');
    const mast3RigSelect = document.getElementById('mast-3-rig-select');
    const superstructureTypeSelect = document.getElementById('superstructure-type-select');
    const castlesOptionsWrapper = document.getElementById('castles-options-wrapper');
    const deckhousesOptionsWrapper = document.getElementById('deckhouses-options-wrapper');
    const aftercastleSelect = document.getElementById('aftercastle-select');
    const midcastleSelect = document.getElementById('midcastle-select');
    const forecastleSelect = document.getElementById('forecastle-select');
    const sterncastleSelect = document.getElementById('sterncastle-select');
    const sparDeckSelect = document.getElementById('spar-deck-select');
    const sterncastleOnSparDeckWrapper = document.getElementById('sterncastle-on-spardeck-wrapper');
    const midDeckhouseSelect = document.getElementById('mid-deckhouse-select');
    const foreDeckhouseSelect = document.getElementById('fore-deckhouse-select'); // New: Fore Deckhouse select
    const shipyardTooltip = document.getElementById('shipyard-tooltip');
    const aftDeckhouseSelect = document.getElementById('aft-deckhouse-select'); // New: Aft Deckhouse select
    const sternCabinSelect = document.getElementById('stern-cabin-select'); // New: Stern Cabin select
    const sterncastleOnSparDeckSelect = document.getElementById('sterncastle-on-spardeck-select');
    const decksOptionsWrapper = document.getElementById('decks-options-wrapper');
    const deckLayoutSelect = document.getElementById('deck-layout-select');

    // --- New: Shipyard Generator Instance ---
    const shipGenerator = new ShipGenerator();
    let customPreviewShip = null; // Persistent instance for reuse

    // --- NEW: Track user interaction with Beam Slider ---
    let hasUserModifiedBeam = false;

    // --- Event Listener for Starting the Game ---
    startGameBtn.addEventListener('click', () => {
        // Hide the start screen UI.
        startScreen.style.display = 'none';

        // Get the player's name, providing a default if empty.
        const playerName = playerNameInput.value.trim() || 'Captain';
        const playerOptions = { name: playerName };
        let playerBlueprint = null;

        // Check the ship plan selection to determine if a blueprint should be generated.
        // This correctly handles starting the game from either the main menu or the shipyard.
        // --- MODIFIED: Always use custom ship generation ---
        if (true) {
            playerBlueprint = shipGenerator.generateBlueprint();

            // --- NEW: Capture Ship Name ---
            playerOptions.shipName = shipNameInput.value.trim() || 'Unnamed';

            // --- NEW: Construct Ship Type String ---
            let rigName = playerBlueprint.layout.rigType;
            if (rigName === 'full-rigged') rigName = 'full-rigged ship';

            if (shipGenerator.buildType === 'guns') {
                let totalGuns = 0;
                for (const tier in playerBlueprint.layout.cannonLayouts) {
                    totalGuns += playerBlueprint.layout.cannonLayouts[tier].length;
                }
                if (playerBlueprint.geometry.aftercastle?.cannons) totalGuns += playerBlueprint.geometry.aftercastle.cannons.length;
                if (playerBlueprint.geometry.forecastle?.cannons) totalGuns += playerBlueprint.geometry.forecastle.cannons.length;
                if (playerBlueprint.geometry.midcastle?.cannons) totalGuns += playerBlueprint.geometry.midcastle.cannons.length;
                if (playerBlueprint.geometry.sterncastle?.cannons) totalGuns += playerBlueprint.geometry.sterncastle.cannons.length;
                if (playerBlueprint.geometry.spardeck) totalGuns += playerBlueprint.geometry.spardeck.cannons.length;
                if (playerBlueprint.geometry.spardeckSterncastle) totalGuns += playerBlueprint.geometry.spardeckSterncastle.cannons.length;
                
                playerOptions.shipType = `${totalGuns} gun ${rigName}`;
            } else {
                const midSectionUnits = playerBlueprint.dimensions.midSectionLength / CARGO_UNIT_SIZE;
                const beamUnits = playerBlueprint.dimensions.width / CARGO_UNIT_SIZE;
                const totalCapacity = Math.round(midSectionUnits * beamUnits);
                playerOptions.shipType = `${totalCapacity} unit ${rigName}`;
            }

            // --- FIX: Set base reload time to optimal (2s) ---
            // The actual reload time will be calculated dynamically by the ship instance based on crew.
            playerBlueprint.stats.reloadTime = PLAYER_CANNON_RELOAD_TIME_MS;
        }
        // Always pass the latest color selections. If the user hasn't customized them, they will be the defaults.
        Object.assign(playerOptions, { sailColor: selectedSailColor, pennantColor: selectedPennantColor, primaryHullColor: selectedPrimaryHullColor, secondaryHullColor: selectedSecondaryHullColor, bulwarkRailColor: selectedBulwarkRailColor, sparDarkerColor: selectedSparDarkerColor, deckColor: selectedDeckColor });

        // Call the new startGame function to spawn the player and begin the full game loop.
        PlunderGame.startGame(playerOptions, playerBlueprint);
    });

    // --- New: Function to synchronize shipyard element widths ---
    function syncShipyardWidths() {
        // Ensure the shipyard screen is visible to get correct dimensions
        if (shipyardScreen.style.display !== 'none') {
            const previewWidth = shipPreviewWindow.offsetWidth;
            // --- Corrected: Use querySelectorAll to target all scrollable menus ---
            // This ensures both the options menu and the stats panel are resized.
            const scrollMenus = document.querySelectorAll('.options-scroll-menu');
            scrollMenus.forEach(menu => {
                menu.style.width = `${previewWidth}px`;
            });
            // --- New: Position the stats button to align with the preview window ---
            if (statsBtn) {
                // The button's parent is now the full-width start-menu-container.
                // We can calculate the 'left' offset relative to this container.
                const menuContainerRect = document.querySelector('#shipyard-screen .start-menu-container').getBoundingClientRect();
                const previewRect = shipPreviewWindow.getBoundingClientRect();
                const buttonLeftOffset = previewRect.left - menuContainerRect.left;
                statsBtn.style.position = 'absolute'; // Ensure the button is positioned absolutely
                statsBtn.style.left = `${buttonLeftOffset}px`;
            }
            // --- New: Position the zoom button to align with the preview window ---
            if (zoomBtn) {
                const menuContainerRect = document.querySelector('#shipyard-screen .start-menu-container').getBoundingClientRect();
                const previewRect = shipPreviewWindow.getBoundingClientRect();
                const buttonRightOffset = previewRect.right - menuContainerRect.left - zoomBtn.offsetWidth;
                zoomBtn.style.position = 'absolute'; // Ensure the button is positioned absolutely
                zoomBtn.style.left = `${buttonRightOffset}px`;
            }

        }
    }

    /**
     * New: Calculates and updates the ship stats display panel.
     */
    function updateStatsDisplay() {
        const blueprint = shipGenerator.generateBlueprint();
        // --- New: Create a temporary ship instance to access its calculation methods ---
        // This is a clean way to get calculated stats without needing a full game object.
        const tempShip = new CustomShip(0, 0, blueprint, {
            sailColor: selectedSailColor,
            pennantColor: selectedPennantColor
        });

        const { dimensions } = blueprint;

        // Ship Name
        const shipName = shipNameInput.value.trim() || 'Unnamed';
        document.getElementById('stats-ship-name').textContent = shipName;

        // Ship Type
        let shipType = '';
        let rigName = blueprint.layout.rigType;

        // --- New: Use the full display name for "full-rigged" type ---
        if (rigName === 'full-rigged') {
            rigName = 'full-rigged ship';
        }

        if (shipGenerator.buildType === 'guns') {
            // Sum guns from all cannon layouts
            let totalGuns = 0;
            for (const tier in blueprint.layout.cannonLayouts) {
                totalGuns += blueprint.layout.cannonLayouts[tier].length;
            }
            // Add guns from superstructures
            if (blueprint.geometry.aftercastle?.cannons) totalGuns += blueprint.geometry.aftercastle.cannons.length;
            if (blueprint.geometry.forecastle?.cannons) totalGuns += blueprint.geometry.forecastle.cannons.length;
            if (blueprint.geometry.midcastle?.cannons) totalGuns += blueprint.geometry.midcastle.cannons.length;
            if (blueprint.geometry.sterncastle?.cannons) totalGuns += blueprint.geometry.sterncastle.cannons.length;
            if (blueprint.geometry.spardeck) totalGuns += blueprint.geometry.spardeck.cannons.length;
            if (blueprint.geometry.spardeckSterncastle) totalGuns += blueprint.geometry.spardeckSterncastle.cannons.length;

            shipType = `${totalGuns} gun ${rigName}`;
        } else { // buildType === 'cargo'
            const midSectionUnits = dimensions.midSectionLength / CARGO_UNIT_SIZE;
            const beamUnits = dimensions.width / CARGO_UNIT_SIZE;
            const totalCapacity = Math.round(midSectionUnits * beamUnits);
            shipType = `${totalCapacity} unit ${rigName}`;
        }
        document.getElementById('stats-ship-type').textContent = shipType;

        // Length (Hull)
        const lengthInUnits = (dimensions.length / CARGO_UNIT_SIZE).toFixed(1);
        document.getElementById('stats-ship-length').textContent = `${lengthInUnits} units`;

        // Beam (Hull)
        const beamInUnits = (dimensions.width / CARGO_UNIT_SIZE).toFixed(1);
        document.getElementById('stats-ship-beam').textContent = `${beamInUnits} units`;

        // Draught
        const draughtInPixels = blueprint.draughtFactor * dimensions.width;
        const draughtInUnits = (draughtInPixels / CARGO_UNIT_SIZE).toFixed(2);
        document.getElementById('stats-ship-draught').textContent = `${draughtInUnits} units`;

        // --- NEW: Hull Durability (maxHP) Calculation ---
        // Use the value already calculated by the tempShip instance to ensure consistency.
        const hullDurability = tempShip.maxHp;
        document.getElementById('stats-hull-durability').textContent = `${hullDurability} HP`;

        // --- NEW: Rig Durability Calculation ---
        const rigDurability = tempShip.getRigDurability();
        document.getElementById('stats-rig-durability').textContent = `${rigDurability} HP`;


        // --- New: Burthen Calculation ---
        // --- New: "Half-Elliptical Cylinder Method" for Burthen Hold ---
        // This calculates the underwater volume of the hull.
        // Volume of a half-ellipse prism: (PI * radiusA * radiusB * length) / 2
        const burthenHold = tempShip.calculateBurthen();
        document.getElementById('stats-ship-burthen-hold').textContent = `${burthenHold} units`;

        const hullBurthen = burthenHold; // Use the new volumetric calculation as the base for total burthen.

        // --- New: "Area Summation" for Superstructure Burthen ---
        let superstructureBurthen = 0;
        const CARGO_UNIT_AREA = CARGO_UNIT_SIZE * CARGO_UNIT_SIZE;

        // Helper function to calculate burthen from a superstructure's geometry.
        const calculateStructureBurthen = (structure) => {
            if (!structure) return 0;
            let area = 0;
            // For hull-conforming structures (castles, spar-deck, stern cabin) which have a 'deck' polygon.
            if (structure.deck && Array.isArray(structure.deck)) {
                area = Math.abs(getPolygonArea(structure.deck)); // Use shoelace formula for area.
            }
            // For rectangular deckhouses which have 'outer' dimensions.
            else if (structure.outer && structure.outer.length && structure.outer.width) {
                area = structure.outer.length * structure.outer.width;
            }
            return area / CARGO_UNIT_AREA; // Convert raw area to burthen units.
        };

        // Add burthen from each potential superstructure.
        superstructureBurthen += calculateStructureBurthen(blueprint.geometry.forecastle);
        superstructureBurthen += calculateStructureBurthen(blueprint.geometry.aftercastle);
        superstructureBurthen += calculateStructureBurthen(blueprint.geometry.midcastle);
        superstructureBurthen += calculateStructureBurthen(blueprint.geometry.sterncastle);
        superstructureBurthen += calculateStructureBurthen(blueprint.geometry.spardeck);
        superstructureBurthen += calculateStructureBurthen(blueprint.geometry.spardeckSterncastle);
        superstructureBurthen += calculateStructureBurthen(blueprint.geometry.foreDeckhouse);
        superstructureBurthen += calculateStructureBurthen(blueprint.geometry.midDeckhouse);
        superstructureBurthen += calculateStructureBurthen(blueprint.geometry.aftDeckhouse);
        superstructureBurthen += calculateStructureBurthen(blueprint.geometry.sternCabin);

        // Multiply burthen by the number of decks for a more representative value.
        const finalBurthen = Math.round(hullBurthen + superstructureBurthen);
        document.getElementById('stats-ship-burthen').textContent = `${finalBurthen} units`;

        // --- New: Broadside Calculation ---
        // The calculation is now handled by the CustomShip class itself.
        const broadsideGuns = tempShip.getBroadsideCount();
        document.getElementById('stats-ship-broadside').textContent = `${broadsideGuns} guns`;

        // --- NEW: Min. Sailing Crew Calculation ---
        // Use the value already calculated by the tempShip instance to ensure consistency.
        const minSailingCrew = tempShip.minSailingCrew;
        document.getElementById('stats-min-crew').textContent = minSailingCrew;

        // --- New: Min. Fighting Crew Calculation ---
        const minFightingCrew = minSailingCrew + (broadsideGuns * 5);
        document.getElementById('stats-min-fighting-crew').textContent = minFightingCrew;

        // --- NEW: Reload Time Display ---
        // Display the optimal reload time (2s) since stats assume a fully crewed ship.
        // We use the tempShip to get the calculation, assuming full crew.
        // Note: tempShip.crew is initialized to maxCrew, which includes fighting crew.
        const optimalReloadTime = tempShip.getReloadTime() / 1000;
        document.getElementById('stats-reload-time').textContent = `${optimalReloadTime.toFixed(1)} sec (Optimal)`;


        // --- New: Cruising Speed Calculation ---
        const cruisingSpeed = tempShip.getCrusingSpeed();
        document.getElementById('stats-cruising-speed').textContent = `${cruisingSpeed} units/sec`;

        // --- New: Acceleration Calculation ---
        const acceleration = tempShip.getAcceleration();
        document.getElementById('stats-acceleration').textContent = `${acceleration.toFixed(2)} units/sec²`;

        // --- New: Turning Radius Calculation ---
        const turningRadius = tempShip.getTurningRadius();
        document.getElementById('stats-turning-radius').textContent = `${turningRadius} ship lengths`;

        // --- New: Turning Rate Calculation ---
        const turningRate = tempShip.getTurningSpeed();
        document.getElementById('stats-turning-rate').textContent = `${turningRate} deg/sec`;

        // --- New: Best Point of Sail ---
        const bestPointOfSail = tempShip.getBestPointOfSail();
        document.getElementById('stats-best-point-of-sail').textContent = bestPointOfSail;
    }

    // --- Event Listener for the new Stats button ---
    statsBtn.addEventListener('click', () => {
        const isStatsVisible = shipStatsDisplay.style.display !== 'none';
        if (isStatsVisible) {
            // Hide stats, show options
            shipStatsDisplay.style.display = 'none';
            optionsMenuWrapper.style.display = 'block';
            statsBtn.textContent = 'Stats'; // Change text back to "Stats"
        } else {
            // Show stats, hide options
            updateStatsDisplay(); // Calculate latest stats before showing
            shipStatsDisplay.style.display = 'block';
            optionsMenuWrapper.style.display = 'none';
            statsBtn.textContent = 'Options'; // Change text to "Options"

            // --- FIX: Explicitly hide the tooltip when switching to stats view ---
            // This prevents it from getting "stuck" if the mouse was over an option.
            shipyardTooltip.classList.remove('visible');
            shipyardTooltip.style.display = 'none';
        }
    });

    let customShipZoomFocus = 'overall'; // New: State for custom ship zoom ('overall' or 'hull')

    // --- New: Event Listener for the new Zoom button ---
    if (zoomBtn) {
        zoomBtn.addEventListener('click', () => {
            // Toggle the zoom state
            customShipZoomFocus = (customShipZoomFocus === 'overall') ? 'hull' : 'overall';

            // --- New: Update the button's text to reflect the new zoom state ---
            if (customShipZoomFocus === 'hull') {
                zoomBtn.textContent = 'Hull';
            } else {
                zoomBtn.textContent = 'Overall';
            }
            // Redraw the preview to apply the new zoom level
            drawShipPreview();
        });
    }

    // --- Event Listeners for Shipyard ---
    customizeBtn.addEventListener('click', () => {
        startScreen.style.display = 'none';
        shipyardScreen.style.display = 'flex';
        // Use requestAnimationFrame to ensure the layout is calculated before syncing widths
        requestAnimationFrame(() => {
            syncShipyardWidths(); // First, sync the widths of the UI elements.
            drawShipPreview(); // Then, draw the preview now that the canvas has its final size.
        });
    });
    
    backToMainMenuBtn.addEventListener('click', () => {
        shipyardScreen.style.display = 'none';
        startScreen.style.display = 'flex';
        // Reset to show options menu by default when re-entering shipyard
        shipStatsDisplay.style.display = 'none';
        optionsMenuWrapper.style.display = 'block';

        // --- FIX: Explicitly hide the tooltip when leaving the shipyard ---
        // This prevents it from getting "stuck" if the mouse was over an option.
        shipyardTooltip.classList.remove('visible');
        shipyardTooltip.style.display = 'none';

        statsBtn.textContent = 'Stats'; // Reset button text
    });

    // --- New: Shipyard Preview Rendering ---
    let shipyardFocus = 'customized-ship'; // Default to custom ship

    // --- New: Debounced version for high-frequency inputs ---
    const debouncedDrawShipPreview = debounce(() => drawShipPreview(), 50);

    function drawShipPreview() {
        if (shipPreviewCanvas.offsetParent === null) return;

        // --- High-Resolution Canvas Scaling ---
        // Use devicePixelRatio to render the canvas at the screen's native resolution,
        // resulting in a much sharper image, similar to SVG.
        const dpr = window.devicePixelRatio || 1;
        const rect = shipPreviewCanvas.getBoundingClientRect();
        shipPreviewCanvas.width = rect.width * dpr;
        shipPreviewCanvas.height = rect.height * dpr;

        // Set background color
        shipPreviewCtx.fillStyle = OCEAN_BLUE;
        shipPreviewCtx.fillRect(0, 0, shipPreviewCanvas.width, shipPreviewCanvas.height);

        // --- FIX: Apply DPR scaling to the context for sharp rendering ---
        shipPreviewCtx.scale(dpr, dpr);

        // --- New: Focus-based drawing ---
        if (shipyardFocus === 'customized-ship' || shipyardFocus === 'whole-ship') {
            const blueprint = shipGenerator.generateBlueprint();
            const colorOptions = {
                sailColor: selectedSailColor,
                pennantColor: selectedPennantColor,
                primaryHullColor: selectedPrimaryHullColor,
                secondaryHullColor: selectedSecondaryHullColor,
                bulwarkRailColor: selectedBulwarkRailColor,
                sparDarkerColor: selectedSparDarkerColor,
                deckColor: selectedDeckColor,
            };

            // --- OPTIMIZATION: Reuse existing instance ---
            if (!customPreviewShip) {
                customPreviewShip = new CustomShip(0, 0, blueprint, colorOptions);
            } else {
                customPreviewShip.updateColors(colorOptions);
                customPreviewShip.applyBlueprint(blueprint);
            }
            
            customPreviewShip.angle = 0; // Side-on view

            let previewWorldToScreenScale;

            if (customShipZoomFocus === 'hull') {
                const scaleForWidth = rect.width / customPreviewShip.shipLength;
                const scaleForHeight = rect.height / customPreviewShip.shipWidth;
                previewWorldToScreenScale = Math.min(scaleForWidth, scaleForHeight) * 0.9;
            } else { // 'overall' focus
                const overallBounds = customPreviewShip.getOverallBounds();
                const scaleForLength = rect.width / overallBounds.length;
                const scaleForHeight = rect.height / customPreviewShip.sailHeight;

                const rigType = blueprint.layout.rigType;
                let margin = 0.9; // Default to 90%
                if (['sloop', 'fore-and-aft-sloop', 'schooner', 'brigantine', 'barquentine', 'three-mast-schooner'].includes(rigType)) {
                    margin = 0.8; // Use 80% for these rigs
                }
                if (['brig', 'barque', 'full-rigged'].includes(rigType)) {
                    margin = 0.8;
                }

                let baseScale = Math.min(scaleForLength, scaleForHeight) * margin;

                const beamRatio = shipGenerator.beamRatio;
                const baselineBeamRatio = 2.5; // A mid-range ratio where no adjustment is applied.
                const beamRatioDifference = beamRatio - baselineBeamRatio;
                const scaleAdjustmentFactor = 1.0 - (beamRatioDifference * 0.1); // Each 0.1 diff = 1% zoom out
                previewWorldToScreenScale = baseScale * scaleAdjustmentFactor;
            }

            // --- FIX: Use the correct center point based on the zoom focus ---
            let shipVisualCenterX;
            if (customShipZoomFocus === 'hull') {
                // When focusing on the hull, use the hull's geometric center.
                shipVisualCenterX = 0; // The hull is generated around the origin (0,0).
            } else {
                // When focusing on the overall ship, use the center of the rig's full bounds.
                shipVisualCenterX = (customPreviewShip.getOverallBounds().minX + customPreviewShip.getOverallBounds().maxX) / 2;
            }

            shipPreviewCtx.save();
            shipPreviewCtx.translate(rect.width / 2, rect.height / 2);
            shipPreviewCtx.scale(previewWorldToScreenScale, previewWorldToScreenScale);

            // --- GRID DRAWING ---
            const gridSize = GRID_SIZE;
            shipPreviewCtx.strokeStyle = GRID_COLOR;
            shipPreviewCtx.lineWidth = 1 / previewWorldToScreenScale;
            const viewWidth = (rect.width * dpr) / previewWorldToScreenScale;
            const viewHeight = (rect.height * dpr) / previewWorldToScreenScale;
            const startX = Math.floor(-viewWidth / 2 / gridSize) * gridSize;
            const endX = Math.ceil(viewWidth / 2 / gridSize) * gridSize;
            const startY = Math.floor(-viewHeight / 2 / gridSize) * gridSize;
            const endY = Math.ceil(viewHeight / 2 / gridSize) * gridSize;
            for (let x = startX; x <= endX; x += gridSize) {
                shipPreviewCtx.beginPath();
                shipPreviewCtx.moveTo(x, startY);
                shipPreviewCtx.lineTo(x, endY);
                shipPreviewCtx.stroke();
            }
            for (let y = startY; y <= endY; y += gridSize) {
                shipPreviewCtx.beginPath();
                shipPreviewCtx.moveTo(startX, y);
                shipPreviewCtx.lineTo(endX, y);
                shipPreviewCtx.stroke();
            }

            // --- SHIP DRAWING ---
            shipPreviewCtx.translate(-shipVisualCenterX, 0);
            customPreviewShip.drawWorldSpace(shipPreviewCtx, previewWorldToScreenScale, 0);
            shipPreviewCtx.restore();
        } else if (shipyardFocus === 'cannon') {
            Ship.drawCannonPreview(shipPreviewCtx, rect.width, rect.height);
        }
    }

    // --- Handle Shipyard HSV Color Picker ---
    let selectedSaturation = 1;
    let selectedHue = 0;
    let selectedValue = 1;

    // Store colors for each option
    let selectedPennantColor = 'hsl(0, 100%, 50%)'; // Default red
    let selectedSailColor = 'hsl(0, 0%, 95%)'; // Default off-white
    // New: Hull color state variables
    let selectedPrimaryHullColor = HULL_COLOR; // Default from config
    let selectedSecondaryHullColor = HULL_DARKER_COLOR; // Default from config
    let selectedBulwarkRailColor = BULWARK_RAIL_COLOR; // Default from config
    // New: Spar color state variable
    let selectedSparDarkerColor = SPAR_DARKER_COLOR; // Default from config
    // New: Deck color state variable
    let selectedDeckColor = DECK_COLOR; // Default from config


    // Keep track of which swatch is being edited
    let activeSwatch = null;

    function updateColor() {
        // HSL is more intuitive for CSS than HSV, so we convert.
        // Lightness in HSL is different from Value in HSV.
        const lightness = selectedValue * (1 - selectedSaturation / 2);
        const saturationHSL = lightness === 0 || lightness === 1 ? 0 : (selectedValue - lightness) / Math.min(lightness, 1 - lightness);
        const newColor = `hsl(${selectedHue}, ${saturationHSL * 100}%, ${lightness * 100}%)`;

        if (activeSwatch === pennantColorSwatch) {
            selectedPennantColor = newColor;
        } else if (activeSwatch === sailColorSwatch) {
            selectedSailColor = newColor;
        } else if (activeSwatch === primaryHullColorSwatch) {
            selectedPrimaryHullColor = newColor;
            // The secondary color is not affected.
        } else if (activeSwatch === secondaryHullColorSwatch) {
            selectedSecondaryHullColor = newColor;
            // The primary color is not affected.
        } else if (activeSwatch === bulwarkRailColorSwatch) {
            selectedBulwarkRailColor = newColor;
        } else if (activeSwatch === customSparColorSwatch) {
            selectedSparDarkerColor = newColor;
        } else if (activeSwatch === customDeckColorSwatch) {
            selectedDeckColor = newColor;
        }

        if (activeSwatch) {
            activeSwatch.style.backgroundColor = newColor;
            debouncedDrawShipPreview(); // Use debounced draw for color dragging
        }

        colorBox.style.backgroundColor = `hsl(${selectedHue}, 100%, 50%)`;
        // In the future, we can update the ship preview in real-time here.
    }

    function handleDrag(element, callback) {
        let isDragging = false;
        element.addEventListener('mousedown', e => {
            isDragging = true;
            callback(e);
        });
        window.addEventListener('mousemove', e => {
            if (isDragging) callback(e);
        });
        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    handleDrag(hueSlider, event => {
        const rect = hueSlider.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        selectedHue = Math.floor(percentage * 360);
        hueSliderIndicator.style.top = `${percentage * 100}%`;
        updateColor();
    });

    handleDrag(colorBox, event => {
        const rect = colorBox.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));

        selectedSaturation = x / rect.width;
        selectedValue = 1 - (y / rect.height);

        // --- New: Constrain the brightness for the deck color ---
        // This ensures that the selected color is never so dark that the
        // 20% darker plank lines become invisible.
        if (activeSwatch === customDeckColorSwatch) {
            const MIN_DECK_BRIGHTNESS = 0.20; // 20%
            selectedValue = Math.max(selectedValue, MIN_DECK_BRIGHTNESS);
        }

        colorBoxIndicator.style.left = `${selectedSaturation * 100}%`;
        colorBoxIndicator.style.top = `${(1 - selectedValue) * 100}%`;
        updateColor();
    });

    // --- Pop-up Logic ---
    function openColorPicker(event, swatch) {
        event.stopPropagation();
        const optionItem = swatch.closest('.option-item');
        const currentlyExpanded = document.querySelector('.option-item.expanded');

        // If there's an expanded item and it's not the one we just clicked, collapse it.
        if (currentlyExpanded && currentlyExpanded !== optionItem) {
            currentlyExpanded.classList.remove('expanded');
        }

        // Toggle the clicked item
        if (optionItem.classList.contains('expanded')) {
            // It's already open, so collapse it
            optionItem.classList.remove('expanded');
            hsvPopup.style.display = 'none';
            activeSwatch = null;
        } else {
            // It's closed, so expand it
            optionItem.classList.add('expanded');
            optionItem.appendChild(hsvPopup); // Move the picker into this item
            hsvPopup.style.display = 'flex';
            activeSwatch = swatch;
        }
    }

    pennantColorSwatch.addEventListener('click', (event) => openColorPicker(event, pennantColorSwatch));
    sailColorSwatch.addEventListener('click', (event) => openColorPicker(event, sailColorSwatch));
    // New: Connect new hull color swatches to the color picker
    primaryHullColorSwatch.addEventListener('click', (event) => openColorPicker(event, primaryHullColorSwatch));
    secondaryHullColorSwatch.addEventListener('click', (event) => openColorPicker(event, secondaryHullColorSwatch));
    bulwarkRailColorSwatch.addEventListener('click', (event) => openColorPicker(event, bulwarkRailColorSwatch));
    customSparColorSwatch.addEventListener('click', (event) => openColorPicker(event, customSparColorSwatch));
    customDeckColorSwatch.addEventListener('click', (event) => openColorPicker(event, customDeckColorSwatch));

    // --- New: Event Listener for Hull Color Type Dropdown ---
    hullColorTypeSelect.addEventListener('change', (e) => {
        const isCustom = e.target.value === 'custom';
        customHullColorsWrapper.style.display = isCustom ? 'block' : 'none';

        // If switching back to default, reset the colors to the config defaults
        if (!isCustom) {
            selectedPrimaryHullColor = HULL_COLOR;
            selectedSecondaryHullColor = HULL_DARKER_COLOR;
            selectedBulwarkRailColor = BULWARK_RAIL_COLOR;
        }
        drawShipPreview();
    });

    // --- New: Event Listener for Spar Color Type Dropdown ---
    sparColorTypeSelect.addEventListener('change', (e) => {
        const isCustom = e.target.value === 'custom';
        customSparColorWrapper.style.display = isCustom ? 'block' : 'none';

        // If switching back to default, reset the color to the config default
        if (!isCustom) {
            selectedSparDarkerColor = SPAR_DARKER_COLOR;
        }
        drawShipPreview();
    });

    // --- New: Event Listener for Deck Color Type Dropdown ---
    deckColorTypeSelect.addEventListener('change', (e) => {
        const isCustom = e.target.value === 'custom';
        customDeckColorWrapper.style.display = isCustom ? 'block' : 'none';

        // If switching back to default, reset the color to the config default
        if (!isCustom) {
            selectedDeckColor = DECK_COLOR;
        }
        // Redraw to apply the change
        drawShipPreview();
    });

    // --- New: Event Listener for Shipyard Focus Dropdown ---
    shipyardFocusSelect.addEventListener('change', (e) => {
        shipyardFocus = e.target.value;
        drawShipPreview(); // Redraw the preview with the new focus
    });

    // --- New: Shipyard Structure Selection Logic ---
    // Populate the dropdowns with options when the script loads.
    for (let i = 1; i <= 20; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        gunCountSelect.appendChild(option);
    }
    for (let i = 1; i <= 60; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        cargoCapacitySelect.appendChild(option);
    }
    // Populate the new rig type sub-selections.
    const rigSubSelects = [mast1RigSelect, mast2RigSelect, mast3RigSelect];
    // Mast 1 gets both Square and Sloop options
    const squareRigOption = document.createElement('option');
    squareRigOption.value = 'square';
    squareRigOption.textContent = 'Square Rig';
    mast1RigSelect.appendChild(squareRigOption);

    const sloopRigOption = document.createElement('option');
    sloopRigOption.value = 'sloop';
    sloopRigOption.textContent = 'Sloop Rig';
    mast1RigSelect.appendChild(sloopRigOption);

    const foreAndAftSloopRigOption = document.createElement('option');
    foreAndAftSloopRigOption.value = 'fore-and-aft-sloop';
    foreAndAftSloopRigOption.textContent = 'Fore-and-Aft Sloop';
    mast1RigSelect.appendChild(foreAndAftSloopRigOption);

    const brigRigOption = document.createElement('option');
    brigRigOption.value = 'brig';
    brigRigOption.textContent = 'Brig Rig';

    const schoonerRigOption = document.createElement('option');
    schoonerRigOption.value = 'schooner';
    schoonerRigOption.textContent = 'Schooner Rig';

    const brigantineRigOption = document.createElement('option');
    brigantineRigOption.value = 'brigantine';
    brigantineRigOption.textContent = 'Brigantine Rig';

    mast2RigSelect.appendChild(squareRigOption.cloneNode(true));
    mast2RigSelect.appendChild(brigRigOption.cloneNode(true));
    mast2RigSelect.appendChild(schoonerRigOption.cloneNode(true));
    mast2RigSelect.appendChild(brigantineRigOption.cloneNode(true));

    // New: Populate the 3-mast rig dropdown
    mast3RigSelect.appendChild(squareRigOption.cloneNode(true));

    const fullRiggedOption = document.createElement('option');
    fullRiggedOption.value = 'full-rigged';
    fullRiggedOption.textContent = 'Full-Rigged Ship';
    mast3RigSelect.appendChild(fullRiggedOption);

    const threeMastSchoonerOption = document.createElement('option');
    threeMastSchoonerOption.value = 'three-mast-schooner';
    threeMastSchoonerOption.textContent = '3-Mast Schooner';
    mast3RigSelect.appendChild(threeMastSchoonerOption);

    const barqueRigOption = document.createElement('option');
    barqueRigOption.value = 'barque';
    barqueRigOption.textContent = 'Barque Rig';
    mast3RigSelect.appendChild(barqueRigOption);

    const barquentineRigOption = document.createElement('option');
    barquentineRigOption.value = 'barquentine';
    barquentineRigOption.textContent = 'Barquentine Rig';
    mast3RigSelect.appendChild(barquentineRigOption);

    // --- New: Function to show the correct rig sub-selection ---
    function updateRigSubSelection() {
        mast1RigWrapper.style.display = rigTypeSelect.value === '1' ? 'flex' : 'none';
        mast2RigWrapper.style.display = rigTypeSelect.value === '2' ? 'flex' : 'none';
        mast3RigWrapper.style.display = rigTypeSelect.value === '3' ? 'flex' : 'none';
    }

    /**
     * Dynamically updates the available beam ratio slider range based on the ship build type and size.
     * @param {object} options - The options for updating the beam ratios.
     * @param {string} options.buildType - The current build type ('guns' or 'cargo').
     * @param {number} [options.gunCount=0] - The number of guns, if buildType is 'guns'.
     */
    function updateBeamSliderRange({ buildType, gunCount = 0, cargoCapacity = 0 }) {
        let sizeBasedMaxBeamRatio = 4.0; // Default max

        if (buildType === 'guns') {
            if (gunCount === 1) sizeBasedMaxBeamRatio = 2.0;
            else if (gunCount === 2) sizeBasedMaxBeamRatio = 2.3;
            else if (gunCount >= 3 && gunCount <= 4) sizeBasedMaxBeamRatio = 2.5;
            else if (gunCount >= 5 && gunCount <= 7) sizeBasedMaxBeamRatio = 3.5;
            else if (gunCount >= 8) sizeBasedMaxBeamRatio = 4.0;
        } else if (buildType === 'cargo') {
            if (cargoCapacity >= 1 && cargoCapacity <= 3) sizeBasedMaxBeamRatio = 2.0;
            else if (cargoCapacity >= 4 && cargoCapacity <= 6) sizeBasedMaxBeamRatio = 2.3;
            else if (cargoCapacity >= 7 && cargoCapacity <= 20) sizeBasedMaxBeamRatio = 2.5;
            else if (cargoCapacity >= 21 && cargoCapacity <= 40) sizeBasedMaxBeamRatio = 3.5;
            else if (cargoCapacity >= 41) sizeBasedMaxBeamRatio = 4.0;
        }

        // New: Get deck-based restriction
        const numDecks = parseInt(deckCountSelect.value);
        let deckBasedMaxBeamRatio = 4.0;
        if (numDecks === 2) {
            deckBasedMaxBeamRatio = 3.75;
        } else if (numDecks === 3) {
            deckBasedMaxBeamRatio = 3.5;
        }

        // The final max ratio is the smaller of the two restrictions.
        const maxBeamRatio = Math.min(sizeBasedMaxBeamRatio, deckBasedMaxBeamRatio);
        const minBeamRatio = 2.0;

        // Capture current value before changing bounds
        const currentValue = parseInt(beamRatioSlider.value);

        // Calculate integer bounds for the slider (value * 10)
        const minVal = minBeamRatio * 10;
        const maxVal = maxBeamRatio * 10;

        // Update the slider's max attribute. We multiply by 10 to work with integers.
        beamRatioSlider.max = maxVal;
        beamRatioSlider.min = minVal;

        // Calculate the average of the allowable range.
        const averageBeamRatio = (minBeamRatio + maxBeamRatio) / 2;
        const averageVal = Math.round(averageBeamRatio * 10);

        // --- NEW: Preserve value if valid, otherwise reset to average ---
        // Only preserve if the user has specifically modified the beam.
        if (hasUserModifiedBeam && currentValue >= minVal && currentValue <= maxVal) {
            beamRatioSlider.value = currentValue;
        } else {
            // Reset to average
            beamRatioSlider.value = averageVal;
            // If we reset the value programmatically, it's no longer a "user choice", so we reset the flag.
            // This ensures subsequent range changes will continue to track the average until the user intervenes again.
            hasUserModifiedBeam = false;
        }

        // Manually trigger the input event to update the display and generator state.
        // This is crucial for when the range is reduced automatically.
        beamRatioSlider.dispatchEvent(new Event('input'));
    }

    /**
     * New: Dynamically updates the draught slider's range and value based on beam and deck count.
     */
    function updateDraughtSliderRange() {
        const LB_RATIO_SCALING_FACTOR = 0.1;
        const DECK_STABILITY_PENALTY = 0.15;
        const SHALLOW_MARGIN = 0.10;
        const DEEP_MARGIN = 0.15;
        const ABSOLUTE_MIN_DRAFT_FACTOR = 0.4;

        const currentBeamRatio = shipGenerator.beamRatio;
        const numDecks = shipGenerator.numDecks;

        // Calculate the average allowable L/B ratio
        const minAllowedBeamRatio = 2.0;
        const maxAllowedBeamRatio = parseFloat(beamRatioSlider.max) / 10;
        const avgAllowedBeamRatio = (minAllowedBeamRatio + maxAllowedBeamRatio) / 2;

        // Calculate the three key factors using your formulas
        const baselineDraftFactor = 0.5 + ((currentBeamRatio - avgAllowedBeamRatio) * LB_RATIO_SCALING_FACTOR) + ((numDecks - 1) * DECK_STABILITY_PENALTY);
        const minDraftFactor = Math.max(ABSOLUTE_MIN_DRAFT_FACTOR, baselineDraftFactor - SHALLOW_MARGIN);
        const maxDraftFactor = baselineDraftFactor + DEEP_MARGIN;

        // Capture current value
        const currentValue = parseInt(draughtSlider.value);

        // Update the slider's attributes. Multiply by 100 for integer steps.
        draughtSlider.min = Math.round(minDraftFactor * 100);
        draughtSlider.max = Math.round(maxDraftFactor * 100);

        // --- NEW: Preserve value if valid, otherwise reset to baseline ---
        if (currentValue >= draughtSlider.min && currentValue <= draughtSlider.max) {
            draughtSlider.value = currentValue;
        } else {
            // Set the slider's default value to the baseline. Clamp it just in case.
            const defaultValue = Math.round(baselineDraftFactor * 100);
            draughtSlider.value = Math.max(draughtSlider.min, Math.min(defaultValue, draughtSlider.max));
        }

        // Manually trigger the input event to update the display and generator state.
        draughtSlider.dispatchEvent(new Event('input'));
        draughtWrapper.style.display = 'flex'; // Ensure it's visible
    }

    /**
     * New: Shows or hides the deck type sub-options based on the number of decks.
     */
    function updateDeckTypeSubOptions() {
        const numDecks = parseInt(deckCountSelect.value);

        deckType1Wrapper.style.display = (numDecks >= 2) ? 'flex' : 'none';
        deckType2Wrapper.style.display = (numDecks >= 3) ? 'flex' : 'none';

        // Reset to default 'gun' when hidden to avoid carrying over state
        if (numDecks < 2) deckType1Select.value = 'gun';
        if (numDecks < 3) deckType2Select.value = 'gun';
        shipGenerator.setDeckType(0, deckType1Select.value);
        shipGenerator.setDeckType(1, deckType2Select.value);
    }

    /**
     * New: Dynamically enables or disables deck options based on ship size.
     */
    function updateDeckOptions() {
        const tempBlueprint = shipGenerator.generateBlueprint();
        const midSectionLength = tempBlueprint.dimensions.midSectionLength;
        const equivalentCargoUnits = midSectionLength / CARGO_UNIT_SIZE;

        const deckOptions = deckCountSelect.options;
        const option1Decker = deckOptions[0];
        const option2Decker = deckOptions[1];
        const option3Decker = deckOptions[2];

        // Enable/disable options based on size rules.
        option1Decker.disabled = false; // 1-Decker is always available.
        option2Decker.disabled = equivalentCargoUnits < 30;
        option3Decker.disabled = equivalentCargoUnits < 42;

        // If the currently selected option is now disabled, select the highest valid option.
        if (deckCountSelect.options[deckCountSelect.selectedIndex].disabled) {
            for (let i = deckOptions.length - 1; i >= 0; i--) {
                if (!deckOptions[i].disabled) {
                    deckCountSelect.value = deckOptions[i].value;
                    break;
                }
            }
        }
        shipGenerator.setNumDecks(parseInt(deckCountSelect.value));
        // Also update the sub-options visibility
        updateDeckTypeSubOptions();
    }

    /**
     * New: Dynamically enables or disables superstructure options based on ship size.
     */
    function updateSuperstructureOptions() {
        const buildType = shipGenerator.buildType;
        const gunCount = shipGenerator.gunsPerBattery;
        const cargoCapacity = shipGenerator.cargoCapacity;

        let isDisabled = false;
        if (buildType === 'guns' && gunCount < 3) {
            isDisabled = true;
        } else if (buildType === 'cargo' && cargoCapacity < 9) {
            isDisabled = true;
        }

        superstructureTypeSelect.disabled = isDisabled;

        // If disabled, reset to 'none' and hide all sub-options.
        if (isDisabled) {
            superstructureTypeSelect.value = 'none';
            superstructureTypeSelect.dispatchEvent(new Event('change')); // Trigger change to hide sub-options
        }
    }

    /**
     * New: Dynamically enables or disables rig type (mast count) options based on ship size.
     */
    function updateRigTypeOptions() {
        const tempBlueprint = shipGenerator.generateBlueprint();
        const midSectionLength = tempBlueprint.dimensions.midSectionLength;
        const equivalentCargoUnits = midSectionLength / CARGO_UNIT_SIZE;

        const rigOptions = rigTypeSelect.options;
        const option1Mast = rigOptions[0];
        const option2Mast = rigOptions[1];
        const option3Mast = rigOptions[2];

        // 1. Enable/disable mast count options based on the size rules.
        option1Mast.disabled = equivalentCargoUnits > 20;
        option2Mast.disabled = equivalentCargoUnits < 15 || equivalentCargoUnits > 42;
        option3Mast.disabled = equivalentCargoUnits < 24;

        // --- NEW: Preserve selection if valid ---
        const currentSelection = rigTypeSelect.value;
        const selectedOption = rigTypeSelect.querySelector(`option[value="${currentSelection}"]`);
        
        if (selectedOption && !selectedOption.disabled) {
            // Current selection is valid. Do not reset.
            return;
        }

        // 2. Determine the default mast count for the current size.
        let defaultMastCount;
        if (equivalentCargoUnits <= 20) defaultMastCount = 1;
        else if (equivalentCargoUnits <= 42) defaultMastCount = 2;
        else defaultMastCount = 3;

        // 3. Set the UI and generator state to this new default.
        // This ensures that any change in ship size resets the rig to a valid, predictable state.
        rigTypeSelect.value = defaultMastCount;
        shipGenerator.setMastCount(defaultMastCount);

        // 4. Set the specific rig type to 'square' and update the UI accordingly.
        shipGenerator.setRigType('square');
        mast1RigSelect.value = 'square';
        mast2RigSelect.value = 'square';
        mast3RigSelect.value = 'square';

        // 5. Update which rig selection dropdown is visible.
        updateRigSubSelection();
    }

    /**
     * New: Enables or disables the "Cargo" deck layout option based on deck count and beam ratio.
     */
    function updateDeckLayoutOptions() {
        const numDecks = parseInt(deckCountSelect.value);
        const currentBeamRatio = parseFloat(beamRatioSlider.value) / 10;
        const cargoLayoutOption = deckLayoutSelect.querySelector('option[value="cargo"]');

        let isCargoLayoutDisabled = false;

        if (numDecks >= 2) {
            // New rule for multi-deck ships
            const maxAllowedBeamRatio = parseFloat(beamRatioSlider.max) / 10;
            const minAllowedBeamRatio = 2.0;
            const halfwayPoint = (maxAllowedBeamRatio + minAllowedBeamRatio) / 2;

            // Disable if the current ratio is NOT below the halfway point.
            isCargoLayoutDisabled = currentBeamRatio >= halfwayPoint;
        } else {
            // Original rule for 1-decker ships
            isCargoLayoutDisabled = currentBeamRatio > 3.0;
        }

        cargoLayoutOption.disabled = isCargoLayoutDisabled;

        // If the currently selected option is now disabled, switch back to "Standard".
        if (isCargoLayoutDisabled && deckLayoutSelect.value === 'cargo') {
            deckLayoutSelect.value = 'standard';
            deckLayoutSelect.dispatchEvent(new Event('change'));
        }
    }

    /**
     * New: Resets only the sub-options for all superstructure types.
     * This is called when the main superstructure category is changed.
     */
    function resetAllSuperstructureSubOptions() {
        // Reset all castle selections to default
        forecastleSelect.value = 'none';
        midcastleSelect.value = 'none';
        aftercastleSelect.value = 'none';
        sterncastleSelect.value = 'none';

        // Also reset any disabled states from their mutual exclusion rules
        midcastleSelect.disabled = false;
        aftercastleSelect.disabled = false;
        sterncastleSelect.disabled = false;

        // Update the generator state to match the reset UI
        shipGenerator.setForecastle(false);
        shipGenerator.setMidcastle(false);
        shipGenerator.setAftercastle(false);
        shipGenerator.setSterncastle(false);
    }

    /**
     * New: Resets only the sub-options for the Deckhouses category.
     */
    function resetAllDeckhouseSubOptions() {
        // Reset all deckhouse selections to default
        foreDeckhouseSelect.value = 'none';
        midDeckhouseSelect.value = 'none';
        aftDeckhouseSelect.value = 'none';
        sternCabinSelect.value = 'none';

        shipGenerator.setForeDeckhouse(false);
        shipGenerator.setMidDeckhouse(false);
        shipGenerator.setAftDeckhouse(false);
        shipGenerator.setSternCabin(false);
    }
    /**
     * New: Resets the Spar-deck selection.
     */
    function resetDeckSuperstructureSubOptions() {
        sparDeckSelect.value = 'none';
        sterncastleOnSparDeckSelect.value = 'none';
        sterncastleOnSparDeckWrapper.style.display = 'none';
        shipGenerator.setSparDeck(false);
    }

    /**
     * New: Resets all structure and superstructure selections to their default state.
     * This is called when the fundamental build type of the ship changes.
     */
    function resetStructureAndSuperstructureSelections() {
        // Reset Superstructure Type
        superstructureTypeSelect.value = 'none';
        // Manually trigger the change event to hide all sub-options (castles, deckhouses, etc.)
        // This will also call our new reset function for the sub-options.
        superstructureTypeSelect.dispatchEvent(new Event('change'));
        resetDeckSuperstructureSubOptions(); // Also reset the decks category
    }

    /**
     * New: Restricts the number of superstructures on smaller ships.
     * If a ship is below a certain size, only one superstructure part can be equipped at a time.
     */
    function manageSuperstructureLimits() {
        const buildType = shipGenerator.buildType;
        const gunCount = shipGenerator.gunsPerBattery;
        const cargoCapacity = shipGenerator.cargoCapacity;

        // Define the "small ship" condition
        const isSmallShip = (buildType === 'guns' && gunCount < 5) || (buildType === 'cargo' && cargoCapacity < 15);

        const superstructureSelects = [
            forecastleSelect, midcastleSelect, aftercastleSelect, sterncastleSelect,
            foreDeckhouseSelect, midDeckhouseSelect, aftDeckhouseSelect, sternCabinSelect,
            sparDeckSelect
            // Note: sterncastleOnSparDeckSelect is a sub-option and doesn't need to be in this primary list.
        ];

        // First, reset all to a baseline enabled state.
        // This handles the case where a large ship becomes small or vice-versa.
        superstructureSelects.forEach(select => select.disabled = false);

        // Re-apply existing mutual-exclusivity rules, as they should always be active.
        if (aftercastleSelect.value === 'equipped') midcastleSelect.disabled = true;
        if (midcastleSelect.value === 'equipped') {
            aftercastleSelect.disabled = true;
        }

        // --- New: Stern Cabin and Aft Deckhouse are mutually exclusive ---
        if (sternCabinSelect.value === 'equipped') aftDeckhouseSelect.disabled = true;
        if (aftDeckhouseSelect.value === 'equipped') sternCabinSelect.disabled = true;


        // Now, apply the new "small ship" limit if applicable.
        if (isSmallShip) {
            // Count how many superstructures are currently equipped.
            const equippedCount = superstructureSelects.reduce((count, select) => {
                return count + (select.value === 'equipped' ? 1 : 0);
            }, 0);

            // If one is equipped, disable all others that are not equipped.
            if (equippedCount >= 1) {
                superstructureSelects.forEach(select => {
                    if (select.value === 'none') {
                        select.disabled = true;
                    }
                });
            }
        }
    }

    // Add an event listener to the main build type dropdown.
    shipBuildTypeSelect.addEventListener('change', (e) => {
        const buildType = e.target.value;

        // Show/hide the relevant sub-selection menu.
        if (buildType === 'guns') {
            gunCountWrapper.style.display = 'flex';
            cargoCapacityWrapper.style.display = 'none';
            cargoGunCountWrapper.style.display = 'none'; // Hide cargo guns
        } else if (buildType === 'cargo') {
            gunCountWrapper.style.display = 'none';
            cargoCapacityWrapper.style.display = 'flex';
            cargoGunCountWrapper.style.display = 'none'; // Initially hide cargo guns
        }

        // --- New: Set default deck types based on build type ---
        const defaultDeckType = (buildType === 'guns') ? 'gun' : 'cargo';
        deckType1Select.value = defaultDeckType;
        deckType2Select.value = defaultDeckType;
        // Update the generator's state to match the new default.
        shipGenerator.setDeckType(0, defaultDeckType);
        shipGenerator.setDeckType(1, defaultDeckType);

        // Show the beam ratio dropdown if a build type is selected.
        if (buildType) {
            beamRatioWrapper.style.display = 'flex';
            // Update the beam options based on the new build type.
            updateBeamSliderRange({
                buildType: buildType,
                gunCount: parseInt(gunCountSelect.value)
            });
        } else {
            draughtWrapper.style.display = 'none';
            beamRatioWrapper.style.display = 'none';
        }

        shipGenerator.setBuildType(buildType);
        // Also update the sub-selection value
        if (buildType === 'guns') shipGenerator.setGunsPerBattery(parseInt(gunCountSelect.value));
        if (buildType === 'cargo') shipGenerator.setCargoCapacity(parseInt(cargoCapacitySelect.value));
        // New: Update rig options whenever the build type changes.
        updateRigTypeOptions();
        drawShipPreview();
        // Also update deck options and beam ratios which depend on size.
        updateDeckOptions();
        updateSuperstructureOptions();
        // New: Update deck layout availability
        updateDeckLayoutOptions();
        // --- New: Reset all structure and superstructure options ---
        resetStructureAndSuperstructureSelections();
        // --- New: Apply superstructure limits based on the new size ---
        manageSuperstructureLimits();

        updateBeamSliderRange({ buildType: buildType, gunCount: parseInt(gunCountSelect.value), cargoCapacity: parseInt(cargoCapacitySelect.value) });
        updateDraughtSliderRange();
    });

    // Add an event listener to the gun count dropdown to update beam options.
    gunCountSelect.addEventListener('change', (e) => {
        const gunCount = parseInt(e.target.value);
        
        // 1. Update Generator State First
        shipGenerator.setGunsPerBattery(gunCount);
        
        // 2. Update Deck Options (Size might force deck count change)
        updateDeckOptions();

        // 3. Update Beam Options (Depends on Gun Count AND Deck Count)
        updateBeamSliderRange({
            buildType: 'guns',
            gunCount: gunCount
        });
        
        // 4. Update Draught (Depends on Beam)
        updateDraughtSliderRange();
        
        // 5. Update Rig & Superstructures
        updateRigTypeOptions();
        updateSuperstructureOptions();
        
        // --- New: Apply superstructure limits based on the new size ---
        // New: Update deck layout availability
        updateDeckLayoutOptions();
        manageSuperstructureLimits();
        drawShipPreview();
    });

    // --- New: Connect other shipyard controls to the generator ---
    cargoCapacitySelect.addEventListener('change', (e) => {
        const capacity = parseInt(e.target.value);
        
        // 1. Update Generator State
        shipGenerator.setCargoCapacity(capacity);

        // 2. Update Deck Options
        updateDeckOptions();

        // 3. Update Beam Options
        updateBeamSliderRange({
            buildType: 'cargo',
            cargoCapacity: capacity
        });
        
        // 4. Update Draught
        updateDraughtSliderRange();

        // --- New: Update and show the gun options for the cargo ship ---
        const maxGuns = Math.floor(capacity / 3);
        cargoGunCountWrapper.style.display = 'flex';
        cargoGunCountSelect.innerHTML = ''; // Clear previous options

        for (let i = 0; i <= maxGuns; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            cargoGunCountSelect.appendChild(option);
        }
        // Set the generator's cargo gun count to the default (0)
        shipGenerator.setCargoGuns(0);
        
        // 5. Update Rig & Superstructures
        updateRigTypeOptions();
        updateSuperstructureOptions();
        
        // --- New: Apply superstructure limits based on the new size ---
        manageSuperstructureLimits();
        drawShipPreview();
    });

    cargoGunCountSelect.addEventListener('change', (e) => {
        shipGenerator.setCargoGuns(parseInt(e.target.value));
        drawShipPreview();
    });

    deckCountSelect.addEventListener('change', (e) => {
        const numDecks = parseInt(e.target.value);
        shipGenerator.setNumDecks(numDecks);
        // The number of decks affects the beam, so we must update it.
        updateBeamSliderRange({
            buildType: shipGenerator.buildType,
            gunCount: shipGenerator.gunsPerBattery,
            cargoCapacity: shipGenerator.cargoCapacity
        });
        updateDraughtSliderRange();
        // New: Update the visibility of the deck type sub-options.
        updateSuperstructureOptions();
        // --- New: Apply superstructure limits based on the new size ---
        manageSuperstructureLimits();
        // New: Update deck layout availability
        updateDeckLayoutOptions();
        updateDeckTypeSubOptions();
        drawShipPreview();
    });

    deckType1Select.addEventListener('change', (e) => {
        shipGenerator.setDeckType(0, e.target.value);
        // Future logic for how this affects other stats (like cargo/guns) will go here.
        drawShipPreview();
    });

    deckType2Select.addEventListener('change', (e) => {
        shipGenerator.setDeckType(1, e.target.value);
        // Future logic for how this affects other stats (like cargo/guns) will go here.
        drawShipPreview();
    });

    beamRatioSlider.addEventListener('input', (e) => {
        // --- NEW: Track user interaction ---
        if (e.isTrusted) {
            hasUserModifiedBeam = true;
        }

        const ratio = parseFloat(e.target.value) / 10;
        beamRatioValueDisplay.textContent = `${ratio.toFixed(2)}:1`;
        shipGenerator.setBeamRatio(ratio);
        // Draught depends on beam, so it must be updated.
        updateDraughtSliderRange();
        // New: Update deck layout availability
        updateDeckLayoutOptions();
        // Redraw the preview in real-time as the slider moves
        debouncedDrawShipPreview(); // Use debounced draw for slider dragging
    });

    draughtSlider.addEventListener('input', (e) => {
        const draughtFactor = parseFloat(e.target.value) / 100;
        shipGenerator.setDraughtFactor(draughtFactor);

        // New: Display the draught factor directly as a decimal.
        draughtValueDisplay.textContent = draughtFactor.toFixed(2);
    });

    // Add an event listener to the rig type dropdown.
    rigTypeSelect.addEventListener('change', () => {
        const mastCount = parseInt(rigTypeSelect.value);

        // --- FIX: Always reset the rig type to a safe default when changing mast count ---
        // This prevents carrying over an invalid rig type from a different mast count.
        shipGenerator.setRigType('square');

        // Update the UI to reflect this default selection.
        if (mastCount === 1) mast1RigSelect.value = 'square';
        if (mastCount === 2) mast2RigSelect.value = 'square';
        if (mastCount === 3) mast3RigSelect.value = 'square';

        // Update which rig selection dropdown is visible.
        updateRigSubSelection();
        // Update the generator's mast count.
        shipGenerator.setMastCount(mastCount);
        drawShipPreview();
    });

    mast1RigSelect.addEventListener('change', (e) => {
        shipGenerator.setRigType(e.target.value);
        drawShipPreview();
    });

    mast2RigSelect.addEventListener('change', (e) => {
        shipGenerator.setRigType(e.target.value);
        drawShipPreview();
    });

    mast3RigSelect.addEventListener('change', (e) => {
        shipGenerator.setRigType(e.target.value);
        drawShipPreview();
    });

    // --- New: Event Listener for Superstructure Type Dropdown ---
    superstructureTypeSelect.addEventListener('change', (e) => {
        const showCastlesOptions = e.target.value === 'castles';
        const showDeckhousesOptions = e.target.value === 'deckhouses';
        const showDecksOptions = e.target.value === 'decks';
        castlesOptionsWrapper.style.display = showCastlesOptions ? 'block' : 'none';
        deckhousesOptionsWrapper.style.display = showDeckhousesOptions ? 'block' : 'none';
        decksOptionsWrapper.style.display = showDecksOptions ? 'block' : 'none';

        // --- New: Reset all sub-options when the main type changes ---
        resetAllSuperstructureSubOptions();
        resetAllDeckhouseSubOptions();
        resetDeckSuperstructureSubOptions();
        // --- New: Apply superstructure limits after resetting ---
        manageSuperstructureLimits();
        drawShipPreview();
    });

    // --- New: Event Listener for Aftercastle Selection ---
    aftercastleSelect.addEventListener('change', (e) => {
        const isEquipped = e.target.value === 'equipped';
        shipGenerator.setAftercastle(isEquipped);

        // --- New: Restrict Midcastle if Aftercastle is equipped ---
        midcastleSelect.disabled = isEquipped;

        // --- New: Apply superstructure limits ---
        manageSuperstructureLimits();
        drawShipPreview();
    });

    // --- New: Event Listener for Forecastle Selection ---
    forecastleSelect.addEventListener('change', (e) => {
        shipGenerator.setForecastle(e.target.value === 'equipped');
        // --- New: Apply superstructure limits ---
        manageSuperstructureLimits();
        drawShipPreview();
    });

    // --- New: Event Listener for Midcastle Selection ---
    midcastleSelect.addEventListener('change', (e) => {
        const isEquipped = e.target.value === 'equipped';
        shipGenerator.setMidcastle(isEquipped);

        // --- New: Restrict Aftercastle if Midcastle is equipped ---
        aftercastleSelect.disabled = isEquipped;

        // --- New: Apply superstructure limits ---
        manageSuperstructureLimits();
        drawShipPreview();
    });

    // --- New: Event Listener for Sterncastle Selection ---
    sterncastleSelect.addEventListener('change', (e) => {
        const isEquipped = e.target.value === 'equipped';
        shipGenerator.setSterncastle(isEquipped);

        // --- New: Apply superstructure limits ---
        manageSuperstructureLimits();
        drawShipPreview();
    });

    // --- New: Event Listener for Spar-deck Selection ---
    sparDeckSelect.addEventListener('change', (e) => {
        const isEquipped = e.target.value === 'equipped';
        shipGenerator.setSparDeck(isEquipped);

        // Show/hide the sub-option for stacking a sterncastle
        sterncastleOnSparDeckWrapper.style.display = isEquipped ? 'flex' : 'none';

        // If the spar-deck is unequipped, also unequip the sterncastle on top of it.
        if (!isEquipped) {
            sterncastleOnSparDeckSelect.value = 'none';
            shipGenerator.setSterncastleOnSparDeck(false);
        }

        // --- New: Apply superstructure limits ---
        manageSuperstructureLimits();
        drawShipPreview();
    });

    sterncastleOnSparDeckSelect.addEventListener('change', (e) => {
        shipGenerator.setSterncastleOnSparDeck(e.target.value === 'equipped');
        // This is a sub-option, so the main limit check isn't strictly needed,
        // but it's good practice to call it in case rules change.
        manageSuperstructureLimits();
        drawShipPreview();
    });

    // --- New: Event Listener for Mid Deckhouse Selection ---
    midDeckhouseSelect.addEventListener('change', (e) => {
        shipGenerator.setMidDeckhouse(e.target.value === 'equipped');
        // --- New: Apply superstructure limits ---
        manageSuperstructureLimits();
        drawShipPreview();
    });

    // --- New: Event Listener for Fore Deckhouse Selection ---
    foreDeckhouseSelect.addEventListener('change', (e) => {
        shipGenerator.setForeDeckhouse(e.target.value === 'equipped');
        // --- New: Apply superstructure limits ---
        manageSuperstructureLimits();
        drawShipPreview();
    });

    // --- New: Event Listener for Aft Deckhouse Selection ---
    aftDeckhouseSelect.addEventListener('change', (e) => {
        shipGenerator.setAftDeckhouse(e.target.value === 'equipped');
        // --- New: Apply superstructure limits ---
        manageSuperstructureLimits();
        drawShipPreview();
    });

    // --- New: Event Listener for Stern Cabin Selection ---
    sternCabinSelect.addEventListener('change', (e) => {
        shipGenerator.setSternCabin(e.target.value === 'equipped');
        // --- New: Apply superstructure limits ---
        manageSuperstructureLimits();
        drawShipPreview();
    });

    // --- New: Event Listener for Deck Layout Selection ---
    deckLayoutSelect.addEventListener('change', (e) => {
        // --- FIX: Set the deck layout type on the generator. ---
        shipGenerator.setDeckLayoutType(e.target.value);
        // Redraw the preview to apply the changes.
        drawShipPreview();
    });
    // --- New: Tooltip Logic using Event Delegation ---
    if (shipyardTooltip) {
        optionsMenuWrapper.addEventListener('mouseover', (e) => {
            // Find the closest parent element that has a data-tooltip attribute
            const target = e.target.closest('[data-tooltip]');
    
            if (target) {
                const tooltipText = target.getAttribute('data-tooltip');
                shipyardTooltip.textContent = tooltipText;
    
                // Position the tooltip
                const targetRect = target.getBoundingClientRect();
                const tooltipRect = shipyardTooltip.getBoundingClientRect();
    
                // Position it to the right of the target element, centered vertically
                let top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                let left = targetRect.right + 10; // 10px offset
    
                // Prevent tooltip from going off-screen
                if (left + tooltipRect.width > window.innerWidth) {
                    left = targetRect.left - tooltipRect.width - 10;
                }
                if (top + tooltipRect.height > window.innerHeight) {
                    top = window.innerHeight - tooltipRect.height - 10;
                }
                if (top < 0) {
                    top = 10;
                }
    
                shipyardTooltip.style.top = `${top}px`;
                shipyardTooltip.style.left = `${left}px`;
                shipyardTooltip.style.display = 'block';
                // Use a class for visibility to leverage the CSS transition
                setTimeout(() => shipyardTooltip.classList.add('visible'), 10);
            }
        });
    
        optionsMenuWrapper.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                shipyardTooltip.classList.remove('visible');
                // Hide the element after the transition is complete
                setTimeout(() => {
                    if (!shipyardTooltip.classList.contains('visible')) {
                        shipyardTooltip.style.display = 'none';
                    }
                }, 200); // Match the CSS transition duration
            }
        });
    }

    // Call it once on load to set the initial state.
    updateRigSubSelection();
    
    // --- New: Initialize generator with default UI values on load ---
    function initializeGeneratorState() {
        // --- FIX: Explicitly set UI to defaults BEFORE reading from them ---
        shipBuildTypeSelect.value = 'guns';
        gunCountSelect.value = '1';
        rigTypeSelect.value = '1';
        mast1RigSelect.value = 'square'; // Default to square rig

        // Now, set the generator's state based on these guaranteed default values
        shipGenerator.setBuildType(shipBuildTypeSelect.value);
        shipGenerator.setGunsPerBattery(parseInt(gunCountSelect.value));
        shipGenerator.setCargoCapacity(parseInt(cargoCapacitySelect.value));
        shipGenerator.setMastCount(parseInt(rigTypeSelect.value));
        shipGenerator.setNumDecks(parseInt(deckCountSelect.value));
        shipGenerator.setDeckType(0, deckType1Select.value);
        shipGenerator.setDeckType(1, deckType2Select.value);

        shipGenerator.setRigType(mast1RigSelect.value); // Set initial rig type

        // --- NEW: Enforce Custom Ship Mode ---
        shipyardFocusSelect.value = 'customized-ship';
        shipyardFocus = 'customized-ship';

        // --- NEW: Show debug controls if enabled ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
            shipyardFocusSelect.style.display = 'block';
        }
    }
    initializeGeneratorState();

    // --- New: Function to run asset-dependent UI initializers ---
    function initializeAssetDependentUI() {
        // Also, ensure the correct UI elements are visible on load
        gunCountWrapper.style.display = 'flex';
        cargoCapacityWrapper.style.display = 'none';
        beamRatioWrapper.style.display = 'flex';
        // Now that assets are loaded, run the update functions.
        updateDeckOptions();
        updateSuperstructureOptions();
        updateBeamSliderRange({ buildType: 'guns', gunCount: parseInt(gunCountSelect.value) });
        updateDraughtSliderRange();
        // The initial state is set by the updateBeamSliderRange function call.
    }

    // --- New: Developer Hotkey for Ship Design ---
    // When the shipyard is open, pressing 'r' will redraw the preview.
    window.addEventListener('keydown', (e) => {
        if (e.key === 'r' && shipyardScreen.style.display !== 'none') {
            drawShipPreview();
        }
    });
    pennantColorSwatch.style.backgroundColor = selectedPennantColor;
    sailColorSwatch.style.backgroundColor = selectedSailColor;
    // New: Set initial background colors for new swatches
    primaryHullColorSwatch.style.backgroundColor = selectedPrimaryHullColor;
    secondaryHullColorSwatch.style.backgroundColor = selectedSecondaryHullColor;
    bulwarkRailColorSwatch.style.backgroundColor = selectedBulwarkRailColor;
    customSparColorSwatch.style.backgroundColor = selectedSparDarkerColor;
    customDeckColorSwatch.style.backgroundColor = selectedDeckColor;


    // Also sync widths on window resize to handle responsiveness
    window.addEventListener('resize', syncShipyardWidths);
    colorBox.style.backgroundColor = `hsl(${selectedHue}, 100%, 50%)`;
    colorBoxIndicator.style.left = `${selectedSaturation * 100}%`;
    colorBoxIndicator.style.top = `${(1 - selectedValue) * 100}%`;
    hueSliderIndicator.style.top = '0%';

    // --- Asset Loading and Initialization ---
    console.log("Loading assets...");

    try {
        // Use Promise.all to fetch all SVG assets concurrently for performance.
        const [
            shipHullVisualData,
            shipHullCollisionData,
            sailData,
            gaffSailLowerData,
            gaffSailUpperData,
            jibSailData,
            gaffTopsailLowerData,
            gaffTopsailUpperData,
            anchorIconData,
            navigationIconData,
            navigationIconDiagonalData,
            cannonVisualData,
            skullIconData // New
        ] = await Promise.all([
            fetchSvgPathData(SHIP_HULL_VISUAL_SVG_URL),
            fetchSvgPathData(SHIP_HULL_COLLISION_SVG_URL),
            fetchSvgPathData(SAIL_SVG_URL),
            fetchSvgPathData(GAFF_SAIL_LOWER_SVG_URL),
            fetchSvgPathData(GAFF_SAIL_UPPER_SVG_URL),
            fetchSvgPathData(JIB_SAIL_SVG_URL),
            fetchSvgPathData(GAFF_TOPSAIL_LOWER_SVG_URL),
            fetchSvgPathData(GAFF_TOPSAIL_UPPER_SVG_URL),
            fetchSvgPathData(ANCHOR_ICON_SVG_URL),
            fetchSvgPathData(NAVIGATION_ICON_SVG_URL),
            fetchSvgPathData(NAVIGATION_ICON_DIAGONAL_SVG_URL),
            fetch(CANNON_SVG_URL).then(res => res.text()), // Fetch the full SVG text for the complex parser
            fetch(SKULL_ICON_SVG_URL).then(res => res.text()) // Fetch full SVG text for complex skull
        ]);

        // Initialize the parts of the configuration that depend on the loaded assets.
        initializeAssetDependentConfigs({
            shipHullVisual: shipHullVisualData,
            shipHullCollision: shipHullCollisionData,
            sail: sailData,
            gaffSailLower: gaffSailLowerData,
            gaffSailUpper: gaffSailUpperData,
            jibSail: jibSailData,
            gaffTopsailLower: gaffTopsailLowerData,
            gaffTopsailUpper: gaffTopsailUpperData,
            anchorIcon: anchorIconData,
            navigationIcon: navigationIconData,
            navigationIconDiagonal: navigationIconDiagonalData,
            cannonVisual: cannonVisualData,
            skullIcon: skullIconData // New
        });

        console.log("Assets loaded and config initialized. Initializing world...");

        PlunderGame.initializeWorld();
        // --- FIX: Start the full game loop immediately to animate waves ---
        requestAnimationFrame(PlunderGame.gameLoop);

        // Draw the initial preview
        drawShipPreview();
        
        // New: Run the UI initializers that depend on loaded assets.
        initializeAssetDependentUI();

        // New: Update rig options now that all assets are loaded.
        updateRigTypeOptions();

    } catch (error) {
        console.error("A critical error occurred during asset loading. Game cannot start.", error);
    }

    // --- NEW: Inventory UI Initialization ---
    initializeInventoryUI();
};

/**
 * Initializes the Inventory UI (Ship Contents Menu).
 * Injects HTML/CSS and sets up event listeners.
 */
function initializeInventoryUI() {
    // 1. Inject CSS
    const style = document.createElement('style');
    style.innerHTML = `
        #inventory-screen {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            display: none; /* Hidden by default */
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: 20px;
            z-index: 2000;
        }
        .inventory-panel {
            width: 500px;
            height: 550px;
            /* Parchment Background (Matches Start Screen) */
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 500 500' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 25 Q25 25 25 0 L475 0 Q475 25 500 25 L500 475 Q475 475 475 500 L25 500 Q25 475 0 475 Z' fill='%23ddc09a' fill-opacity='0.75' stroke='%23948064' stroke-width='4'/%3E%3C/svg%3E");
            background-size: 100% 100%;
            padding: 40px; /* Padding to avoid concave corners */
            box-sizing: border-box;
            filter: drop-shadow(0 0 20px rgba(0, 0, 0, 0.5));
            flex-direction: column;
            color: #3d352a; /* Ink Color */
            font-family: 'Inter', sans-serif;
            display: flex;
        }
        /* Upper Portion (2/6) */
        .inventory-header {
            height: 33%;
            display: flex;
            padding-bottom: 2px;
            border-bottom: 2px solid #948064; /* Darker parchment border */
            margin-bottom: 2px;
        }
        .inventory-ship-image-container {
            width: 130px;
            height: 130px;
            background-color: #3498db;
            border: 2px solid #948064;
            border-radius: 0;
            margin-right: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            box-shadow: inset 0 0 10px rgba(0,0,0,0.2);
        }
        .inventory-ship-image {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        .inventory-ship-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-width: 0;
        }
        .inventory-ship-name { font-family: 'IM Fell English', serif; font-size: 20px; font-weight: bold; margin-bottom: 2px; color: #3d352a; display: flex; align-items: center; }
        .inventory-ship-name > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
        .inventory-ship-type { font-size: 12px; color: #5c543d; margin-bottom: 8px; font-style: italic; }
        .inventory-bar-container { margin-bottom: 4px; }
        .inventory-bar-label { font-size: 11px; margin-bottom: 1px; display: flex; justify-content: space-between; font-weight: bold; }
        .inventory-bar-bg { width: 100%; height: 6px; background: rgba(61, 53, 42, 0.2); border: 1px solid #948064; overflow: hidden; }
        .inventory-bar-fill { height: 100%; transition: width 0.3s; }
        
        /* Middle Portion (3/6) */
        .inventory-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 0 0 10px 0;
            overflow: hidden;
        }
        .inventory-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 2px;
            padding-bottom: 2px;
            border-bottom: 1px solid #948064;
        }
        .inventory-tab {
            padding: 4px 10px;
            background: transparent;
            border: none;
            cursor: pointer;
            font-family: 'IM Fell English', serif;
            font-size: 16px;
            color: #3d352a;
            opacity: 0.6;
            transition: opacity 0.2s;
        }
        .inventory-tab:hover { opacity: 1; }
        .inventory-tab.active { opacity: 1; font-weight: bold; text-decoration: underline; text-decoration-thickness: 2px; }
        
        .inventory-details {
            flex: 1;
            overflow-y: auto;
            background: rgba(61, 53, 42, 0.05);
            padding: 10px;
            border: 1px solid #948064;
            font-family: 'IM Fell English', serif;
            font-size: 16px;
        }
        .inventory-detail-item { margin-bottom: 8px; }

        /* Lower Portion (1/6) */
        .inventory-actions {
            height: auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 15px;
            border-top: 2px solid #948064;
            gap: 10px;
        }
        .inventory-btn {
            flex: 1;
            padding: 10px 0;
            border: none;
            background-color: #ddc09a;
            border-top: 2px solid #3d352a;
            border-bottom: 2px solid #3d352a;
            color: #3d352a;
            cursor: pointer;
            font-family: 'IM Fell English', serif;
            font-size: 18px;
            transition: background-color 0.2s, transform 0.2s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .inventory-btn:hover { background-color: #e8d0b1; transform: translateY(-2px); }
        .btn-scuttle { color: #8b0000; border-color: #8b0000; }

        /* Confirmation Dialog */
        #confirmation-dialog {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            height: 250px;
            /* Scaled down version of the inventory panel background with concave corners */
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 25 Q25 25 25 0 L375 0 Q375 25 400 25 L400 225 Q375 225 375 250 L25 250 Q25 225 0 225 Z' fill='%23ddc09a' fill-opacity='0.95' stroke='%23948064' stroke-width='4'/%3E%3C/svg%3E");
            background-size: 100% 100%;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 3000; /* Above inventory */
            filter: drop-shadow(0 0 20px rgba(0, 0, 0, 0.5));
            padding: 30px;
            box-sizing: border-box;
            color: #3d352a;
            font-family: 'IM Fell English', serif;
        }
        #confirmation-message {
            font-size: 24px;
            text-align: center;
            margin-bottom: 30px;
            font-weight: bold;
        }
        .confirmation-actions {
            display: flex;
            gap: 20px;
            width: 100%;
            justify-content: center;
        }
        .confirmation-btn {
            padding: 10px 30px;
            border: none;
            background-color: #ddc09a;
            border-top: 2px solid #3d352a;
            border-bottom: 2px solid #3d352a;
            color: #3d352a;
            cursor: pointer;
            font-family: 'IM Fell English', serif;
            font-size: 20px;
            transition: background-color 0.2s, transform 0.2s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .confirmation-btn:hover { background-color: #e8d0b1; transform: translateY(-2px); }

        .inventory-rename-btn {
            width: 24px;
            height: 24px;
            background-color: transparent;
            border: 2px solid #3d352a;
            color: #3d352a;
            font-size: 16px;
            cursor: pointer;
            margin-left: 10px;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: background-color 0.2s;
            flex-shrink: 0;
        }
        .inventory-rename-btn:hover { background-color: rgba(61, 53, 42, 0.1); }

        /* Rename Dialog */
        #rename-dialog {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            height: 250px;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 25 Q25 25 25 0 L375 0 Q375 25 400 25 L400 225 Q375 225 375 250 L25 250 Q25 225 0 225 Z' fill='%23ddc09a' fill-opacity='0.95' stroke='%23948064' stroke-width='4'/%3E%3C/svg%3E");
            background-size: 100% 100%;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 3001;
            filter: drop-shadow(0 0 20px rgba(0, 0, 0, 0.5));
            padding: 30px;
            box-sizing: border-box;
            color: #3d352a;
            font-family: 'IM Fell English', serif;
        }
        #rename-title { font-size: 24px; font-weight: bold; margin-bottom: 15px; }
        #rename-input { font-family: 'IM Fell English', serif; padding: 5px 10px; width: 80%; box-sizing: border-box; border: none; border-bottom: 2px solid #3d352a; background: transparent; color: #3d352a; font-size: 22px; text-align: center; margin-bottom: 25px; outline: none; }
        #rename-input:focus { border-bottom-color: #000; background: rgba(255, 255, 255, 0.1); }

        /* --- New Cargo Row Styles --- */
        .inventory-cargo-row {
            display: flex;
            align-items: center;
            border: 1px solid #948064;
            background-color: rgba(255, 255, 255, 0.2);
            margin-bottom: 5px;
            padding: 5px;
            font-family: 'IM Fell English', serif;
        }
        @keyframes flash-bg {
            0% { background-color: rgba(255, 215, 0, 0.6); }
            100% { background-color: rgba(255, 255, 255, 0.2); }
        }
        .inventory-cargo-row.flash-update {
            animation: flash-bg 0.5s ease-out;
        }
        .cargo-icon {
            width: 32px;
            height: 32px;
            background-color: transparent;
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            border: 1px solid #948064;
            margin-right: 8px;
            flex-shrink: 0;
        }
        .cargo-cell {
            padding: 0 5px;
            display: flex;
            align-items: center;
        }
        .cargo-qty {
            font-weight: bold;
            min-width: 30px;
            justify-content: flex-end;
        }
        .cargo-weight {
            font-size: 0.8em;
            font-style: italic;
            color: rgba(61, 53, 42, 0.7);
            min-width: 50px;
        }
        .cargo-container {
            min-width: 80px;
            font-size: 0.9em;
        }
        .cargo-name {
            flex-grow: 1;
            font-weight: bold;
        }
        .cargo-action-btn {
            background: #ddc09a;
            border: 1px solid #3d352a;
            color: #3d352a;
            cursor: pointer;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            transition: background 0.2s;
        }
        .cargo-action-btn:hover {
            background: #e8d0b1;
        }
        
        /* --- Search Bar Styles --- */
        .inventory-search-container {
            padding: 4px 10px;
            display: none; /* Hidden by default, shown only on cargo tab */
        }
        .inventory-search-input {
            width: 100%;
            box-sizing: border-box;
            padding: 8px;
            font-family: 'IM Fell English', serif;
            background: rgba(255, 255, 255, 0.3);
            border: 1px solid #948064;
            color: #3d352a;
            font-size: 16px;
            outline: none;
        }
        .inventory-search-input:focus {
            background: rgba(255, 255, 255, 0.5);
            border-color: #3d352a;
        }
        .inventory-search-input::placeholder {
            color: rgba(61, 53, 42, 0.5);
            font-style: italic;
        }
        
        /* --- Cargo Action Dialog --- */
        #cargo-action-dialog {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 450px;
            height: 300px;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 450 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 25 Q25 25 25 0 L425 0 Q425 25 450 25 L450 275 Q425 275 425 300 L25 300 Q25 275 0 275 Z' fill='%23ddc09a' fill-opacity='0.98' stroke='%23948064' stroke-width='4'/%3E%3C/svg%3E");
            background-size: 100% 100%;
            display: none;
            flex-direction: column;
            align-items: center;
            z-index: 3002;
            filter: drop-shadow(0 0 20px rgba(0, 0, 0, 0.5));
            padding: 20px 20px 30px 20px;
            box-sizing: border-box;
            color: #3d352a;
            font-family: 'IM Fell English', serif;
        }
        #cargo-action-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 2px;
            text-align: center;
            width: 100%;
            padding-bottom: 0;
        }
        #cargo-action-subtitle {
            font-size: 14px;
            font-style: italic;
            color: #5c543d;
            margin-top: 0;
            margin-bottom: 10px;
            text-align: center;
            border-bottom: 2px solid #3d352a;
            width: 100%;
            padding-bottom: 5px;
        }
        #cargo-action-ships {
            display: flex;
            width: 100%;
            margin-bottom: 10px;
            padding: 0 5px;
            box-sizing: border-box;
            align-items: flex-start;
        }
        .cargo-ship-block {
            display: flex;
            flex-direction: column;
            color: #5c543d;
        }
        .cargo-ship-name {
            font-size: 18px;
            font-style: italic;
            font-weight: bold;
            line-height: 1.2;
            white-space: nowrap;
        }
        .cargo-ship-type {
            font-size: 12px;
            font-style: normal;
            opacity: 0.8;
            line-height: 1.2;
        }
        .cargo-ship-capacity {
            font-size: 12px;
            color: #3d352a;
            font-weight: bold;
            margin-top: 2px;
        }
        .cargo-action-controls {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            width: 100%;
            margin-bottom: 10px;
        }
        .cargo-qty-box {
            display: flex;
            flex-direction: column;
            align-items: center;
            background: rgba(255, 255, 255, 0.3);
            border: 1px solid #948064;
            padding: 10px;
            min-width: 80px;
        }
        .cargo-qty-label { font-size: 12px; font-style: italic; margin-bottom: 5px; }
        .cargo-qty-val { font-size: 24px; font-weight: bold; }
        .cargo-qty-size { font-size: 14px; font-style: italic; color: rgba(61, 53, 42, 0.7); margin-top: 2px; }
        
        .cargo-center-column {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
        }
        .cargo-step-dropdown {
            font-family: 'IM Fell English', serif;
            font-size: 14px;
            background: rgba(255, 255, 255, 0.3);
            border: 1px solid #948064;
            color: #3d352a;
            padding: 2px;
            cursor: pointer;
            outline: none;
            text-align: center;
            width: 50px;
            height: 22px;
        }
        .cargo-action-adjuster {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .adjuster-btn {
            width: 30px; height: 30px; font-size: 20px; font-weight: bold;
            background: #ddc09a; border: 1px solid #3d352a; cursor: pointer;
        }
        .mode-toggle-btn {
            width: 100px; padding: 5px; font-family: 'IM Fell English', serif; font-size: 16px;
            background: #ddc09a; border: 2px solid #3d352a; cursor: pointer;
        }
        .mode-toggle-btn.disabled { opacity: 0.7; cursor: default; border-style: dashed; }
        
        .cargo-action-footer {
            display: flex;
            gap: 15px;
            width: 100%;
            justify-content: center;
        }
        .cargo-action-footer .confirmation-btn {
            padding: 5px 15px;
            font-size: 16px;
        }

    `;
    document.head.appendChild(style);

    // 2. Inject HTML
    // Template for a single panel's content
    const panelTemplate = `
        <div class="inventory-header">
            <div class="inventory-ship-image-container"><img class="inventory-ship-image" src="" /></div>
            <div class="inventory-ship-info">
                <div class="inventory-ship-name">Ship Name</div>
                <div class="inventory-ship-type">Ship Type</div>
                <div class="inventory-bar-container">
                    <div class="inventory-bar-label"><span>Crew</span><span class="inventory-crew-val">0/0</span></div>
                    <div class="inventory-bar-bg"><div class="inventory-crew-bar inventory-bar-fill" style="background:#e74c3c; width:0%"></div></div>
                </div>
                <div class="inventory-bar-container">
                    <div class="inventory-bar-label"><span>Rig</span><span class="inventory-rig-val">0/0</span></div>
                    <div class="inventory-bar-bg"><div class="inventory-rig-bar inventory-bar-fill" style="background:#f1c40f; width:0%"></div></div>
                </div>
                <div class="inventory-bar-container">
                    <div class="inventory-bar-label"><span>Hull</span><span class="inventory-hull-val">0/0</span></div>
                    <div class="inventory-bar-bg"><div class="inventory-hull-bar inventory-bar-fill" style="background:#2ecc71; width:0%"></div></div>
                </div>
            </div>
        </div>
        <div class="inventory-content">
            <div class="inventory-tabs">
                <div class="inventory-tab active" data-tab="stats">Stats</div>
                <div class="inventory-tab" data-tab="cargo">Cargo Hold</div>
                <div class="inventory-tab" data-tab="crew">Crew</div>
            </div>
            <div class="inventory-search-container">
                <input type="text" class="inventory-search-input" placeholder="Search cargo...">
            </div>
            <div class="inventory-details">
                <!-- Content injected via JS -->
            </div>
        </div>
        <div class="inventory-actions">
            <!-- Buttons injected via JS -->
        </div>
    `;

    const inventoryHTML = `
        <div id="inventory-screen">
            <div id="inventory-panel-left" class="inventory-panel">
                ${panelTemplate}
            </div>
            <div id="inventory-panel-right" class="inventory-panel" style="display:none;">
                ${panelTemplate}
            </div>
        </div>
        <div id="confirmation-dialog">
            <div id="confirmation-message">Are you sure?</div>
            <div class="confirmation-actions">
                <button id="btn-confirm-yes" class="confirmation-btn">Yes</button>
                <button id="btn-confirm-no" class="confirmation-btn">No</button>
            </div>
        </div>
        <div id="rename-dialog">
            <div id="rename-title">Rename Ship</div>
            <input type="text" id="rename-input" maxlength="20" placeholder="Enter name...">
            <div class="confirmation-actions">
                <button id="btn-rename-confirm" class="confirmation-btn">Rename</button>
                <button id="btn-rename-cancel" class="confirmation-btn">Cancel</button>
            </div>
        </div>
        <div id="cargo-action-dialog">
            <div id="cargo-action-title">Item Name</div>
            <div id="cargo-action-subtitle"></div>
            <div id="cargo-action-ships"></div>
            <div class="cargo-action-controls">
                <div class="cargo-qty-box">
                    <span class="cargo-qty-label">Current</span>
                    <span id="cargo-action-current-qty" class="cargo-qty-val">0</span>
                    <span id="cargo-action-current-size" class="cargo-qty-size">0u</span>
                </div>
                <div class="cargo-center-column">
                    <select id="cargo-step-select" class="cargo-step-dropdown">
                        <option value="1">1</option>
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="all">All</option>
                    </select>
                    <div class="cargo-action-adjuster">
                        <button id="cargo-action-minus" class="adjuster-btn">-</button>
                        <button id="cargo-action-mode-toggle" class="mode-toggle-btn">Dispose</button>
                        <button id="cargo-action-plus" class="adjuster-btn">+</button>
                    </div>
                </div>
                <div class="cargo-qty-box">
                    <span class="cargo-qty-label">Amount</span>
                    <span id="cargo-action-target-qty" class="cargo-qty-val">1</span>
                    <span id="cargo-action-target-size" class="cargo-qty-size">0u</span>
                </div>
            </div>
            <div class="cargo-action-footer">
                <button id="cargo-action-cancel-btn" class="confirmation-btn">Cancel</button>
                <button id="cargo-action-all-btn" class="confirmation-btn">Dispose All</button>
                <button id="cargo-action-confirm-btn" class="confirmation-btn">Dispose</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', inventoryHTML);

    // 3. Setup Logic
    const screen = document.getElementById('inventory-screen');
    let currentPrimaryShip = null;
    // --- OPTIMIZATION: Decouple inventory refresh from the game's render loop ---
    let inventoryRefreshIntervalId = null;
    const INVENTORY_REFRESH_INTERVAL = 250; // ms, refresh 4 times per second

    let currentSecondaryShip = null; // New: Track secondary ship for transfers

    // Helper to update panel bars
    const updatePanelBars = (panel, ship) => {
        if (!panel || !ship) return;
        const updateBar = (cls, val, max) => {
            const pct = Math.max(0, Math.min(100, (val / max) * 100));
            panel.querySelector(`.${cls}-val`).textContent = `${Math.round(val)}/${max}`;
            panel.querySelector(`.${cls}-bar`).style.width = `${pct}%`;
        };
        updateBar('inventory-crew', ship.crew, ship.maxCrew);
        updateBar('inventory-rig', ship.rigHp, ship.maxRigHp);
        updateBar('inventory-hull', ship.hp, ship.maxHp);
    };

    // Confirmation Dialog Logic
    window.showConfirmationDialog = (message, onConfirm) => {
        const dialog = document.getElementById('confirmation-dialog');
        const msgEl = document.getElementById('confirmation-message');
        const yesBtn = document.getElementById('btn-confirm-yes');
        const noBtn = document.getElementById('btn-confirm-no');

        msgEl.textContent = message;
        dialog.style.display = 'flex';

        // Clone buttons to remove old listeners
        const newYes = yesBtn.cloneNode(true);
        const newNo = noBtn.cloneNode(true);
        yesBtn.parentNode.replaceChild(newYes, yesBtn);
        noBtn.parentNode.replaceChild(newNo, noBtn);

        newYes.addEventListener('click', () => {
            dialog.style.display = 'none';
            if (onConfirm) onConfirm();
        });

        newNo.addEventListener('click', () => {
            dialog.style.display = 'none';
        });
    };

    // --- Cargo Action Dialog Logic ---
    const cargoDialog = document.getElementById('cargo-action-dialog');
    // Reuse canvas for text measurement to adjust font size dynamically
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');

    let cargoActionState = {
        ship: null,
        entry: null,
        targetShip: null,
        mode: 'dispose', // 'dispose' or 'transfer'
        amount: 1
    };

    function updateCargoDialogUI() {
        const { entry, mode, amount } = cargoActionState;
        const shipsContainer = document.getElementById('cargo-action-ships');
        
        const unitSize = entry.unitWeight || 0; // This pre-calculated value has the correct container/item logic.

        if (entry.isCrew) {
            document.getElementById('cargo-action-title').textContent = "Crew";
            document.getElementById('cargo-action-subtitle').textContent = "All Crew";
        } else {
            const itemName = entry.item.name;
            const containerName = entry.container ? entry.container.name : null;
            document.getElementById('cargo-action-title').textContent = containerName ? `${containerName} of ${itemName}` : itemName;
            
            // New: Update Subtitle
            const subtitleEl = document.getElementById('cargo-action-subtitle');
            const tradeRating = entry.item.tradeRating || 'N/A';
            subtitleEl.textContent = `(${unitSize.toFixed(2)}u | ${tradeRating})`;
        }
        
        // Update Ship Names
        shipsContainer.innerHTML = '';

        const totalSizeChange = amount * unitSize;

        const createShipBlock = (ship, align, capacityChange = 0, maxWidth = 190) => {
            const block = document.createElement('div');
            block.className = 'cargo-ship-block';
            block.style.alignItems = align;
            
            const name = document.createElement('div');
            name.className = 'cargo-ship-name';
            const nameText = ship.displayName || ship.name;
            name.textContent = nameText;

            // Dynamic Font Sizing
            measureCtx.font = "italic bold 18px 'IM Fell English', serif"; // Matches CSS
            const textWidth = measureCtx.measureText(nameText).width;
            if (textWidth > maxWidth) {
                const newSize = Math.floor(18 * (maxWidth / textWidth));
                name.style.fontSize = `${Math.max(10, newSize)}px`;
            }
            
            const type = document.createElement('div');
            type.className = 'cargo-ship-type';
            type.textContent = ship.shipType || 'Unknown Type';
            
            const capacity = document.createElement('div');
            capacity.className = 'cargo-ship-capacity';
            
            const currentUsed = ship.inventory ? ship.inventory.usedCapacity : 0;
            const total = ship.inventory ? ship.inventory.capacity : 0;
            const projectedUsed = Math.max(0, currentUsed + capacityChange);
            
            capacity.textContent = `Capacity: ${projectedUsed.toFixed(1)} / ${total}`;
            
            block.appendChild(name);
            block.appendChild(type);
            block.appendChild(capacity);
            return block;
        };

        if (cargoActionState.targetShip) {
            shipsContainer.style.justifyContent = 'space-between';
            // Source always loses capacity (item removed)
            shipsContainer.appendChild(createShipBlock(cargoActionState.ship, 'flex-start', -totalSizeChange, 190));
            
            // Target gains capacity only if transferring
            const targetChange = (mode === 'transfer') ? totalSizeChange : 0;
            shipsContainer.appendChild(createShipBlock(cargoActionState.targetShip, 'flex-end', targetChange, 190));
        } else {
            shipsContainer.style.justifyContent = 'center';
            shipsContainer.appendChild(createShipBlock(cargoActionState.ship, 'center', -totalSizeChange, 380));
        }
        
        // Format quantities for display (handle floating point errors from partial consumption)
        const currentQtyVal = entry.quantity - amount;
        
        // --- FIX: Display containers as integers (Ceiling) ---
        let currentQtyDisplay;
        if (entry.container) {
            currentQtyDisplay = Math.ceil(currentQtyVal);
        } else {
            currentQtyDisplay = Number.isInteger(currentQtyVal) ? currentQtyVal : parseFloat(currentQtyVal.toFixed(2));
        }
        
        const targetQtyDisplay = Number.isInteger(amount) ? amount : parseFloat(amount.toFixed(2));

        document.getElementById('cargo-action-current-qty').textContent = currentQtyDisplay;
        document.getElementById('cargo-action-current-size').textContent = `${((entry.quantity - amount) * unitSize).toFixed(1)}u`;
        
        document.getElementById('cargo-action-target-qty').textContent = targetQtyDisplay;
        document.getElementById('cargo-action-target-size').textContent = `${(amount * unitSize).toFixed(1)}u`;
        
        const toggleBtn = document.getElementById('cargo-action-mode-toggle');
        toggleBtn.textContent = mode === 'transfer' ? 'Transfer' : 'Dispose';
        
        const confirmBtn = document.getElementById('cargo-action-confirm-btn');
        confirmBtn.textContent = mode === 'transfer' ? 'Transfer' : 'Dispose';
        
        const allBtn = document.getElementById('cargo-action-all-btn');
        allBtn.textContent = mode === 'transfer' ? 'Transfer All' : 'Dispose All';
    }

    function openCargoActionDialog(ship, entry, targetShip) {
        cargoActionState = {
            ship: ship,
            entry: entry,
            targetShip: targetShip,
            mode: targetShip ? 'transfer' : 'dispose', // Default to transfer if possible
            amount: 1
        };

        const toggleBtn = document.getElementById('cargo-action-mode-toggle');
        if (!targetShip) {
            toggleBtn.classList.add('disabled');
            cargoActionState.mode = 'dispose';
        } else {
            toggleBtn.classList.remove('disabled');
        }
        document.getElementById('cargo-step-select').value = '1'; // Reset step to 1

        updateCargoDialogUI();
        cargoDialog.style.display = 'flex';
    }

    // Dialog Event Listeners
    document.getElementById('cargo-action-minus').addEventListener('click', () => {
        const stepVal = document.getElementById('cargo-step-select').value;
        if (stepVal === 'all') {
            cargoActionState.amount = 1;
        } else {
            const step = parseInt(stepVal);
            cargoActionState.amount = Math.max(1, cargoActionState.amount - step);
        }
        updateCargoDialogUI();
    });
    document.getElementById('cargo-action-plus').addEventListener('click', () => {
        const max = cargoActionState.entry.quantity;
        const stepVal = document.getElementById('cargo-step-select').value;
        if (stepVal === 'all') {
            cargoActionState.amount = max;
        } else {
            const step = parseInt(stepVal);
            cargoActionState.amount = Math.min(max, cargoActionState.amount + step);
        }
        updateCargoDialogUI();
    });
    document.getElementById('cargo-action-mode-toggle').addEventListener('click', () => {
        if (cargoActionState.targetShip) {
            cargoActionState.mode = cargoActionState.mode === 'dispose' ? 'transfer' : 'dispose';
            updateCargoDialogUI();
        }
    });
    document.getElementById('cargo-action-cancel-btn').addEventListener('click', () => {
        cargoDialog.style.display = 'none';
    });

    const executeCargoAction = (amount) => {
        const { ship, entry, targetShip, mode } = cargoActionState;
        
        if (entry.isCrew) {
            if (mode === 'dispose') {
                ship.crew = Math.max(0, ship.crew - amount);
            } else if (mode === 'transfer' && targetShip) {
                ship.crew = Math.max(0, ship.crew - amount);
                targetShip.crew += amount;
                
                if (targetShip.crew > targetShip.maxCrew) {
                    targetShip.maxCrew = targetShip.crew;
                }
            }
        } else {
            if (mode === 'dispose') {
                ship.inventory.removeEntry(entry, amount);
            } else if (mode === 'transfer' && targetShip) {
                const success = ship.inventory.transferEntry(targetShip.inventory, entry, amount);
                if (!success) {
                    alert("Not enough space in target cargo hold!");
                    return; // Don't close dialog if failed
                }
            }
        }

        // Refresh UI
        const leftPanel = document.getElementById('inventory-panel-left');
        const rightPanel = document.getElementById('inventory-panel-right');
        
        // Update header bars
        updatePanelBars(leftPanel, currentPrimaryShip);
        if (currentSecondaryShip) updatePanelBars(rightPanel, currentSecondaryShip);
        
        const leftTab = leftPanel.querySelector('.inventory-tab.active').dataset.tab;
        updateDetails(leftPanel, currentPrimaryShip, leftTab);
        
        if (currentSecondaryShip) {
             const rightTab = rightPanel.querySelector('.inventory-tab.active').dataset.tab;
             updateDetails(rightPanel, currentSecondaryShip, rightTab);
        }
        
        cargoDialog.style.display = 'none';
    };

    document.getElementById('cargo-action-confirm-btn').addEventListener('click', () => {
        executeCargoAction(cargoActionState.amount);
    });
    document.getElementById('cargo-action-all-btn').addEventListener('click', () => {
        executeCargoAction(cargoActionState.entry.quantity);
    });


    // Helper to update details content
    function updateDetails(panel, ship, tabName) {
        const details = panel.querySelector('.inventory-details');
        const searchContainer = panel.querySelector('.inventory-search-container');
        const searchInput = panel.querySelector('.inventory-search-input');
        if (!ship) return;
        let content = '';
        if (tabName === 'stats') {
            // --- Reordered to match Shipyard ---

            // 1. Dimensions & Durability
            let len = 'N/A', beam = 'N/A', draught = 'N/A', burthenHold = 'N/A';
            
            // Hide search on stats tab
            searchContainer.style.display = 'none';
            
            if (ship.blueprint && ship.blueprint.dimensions) {
                const dims = ship.blueprint.dimensions;
                len = (dims.length / CARGO_UNIT_SIZE).toFixed(1);
                beam = (dims.width / CARGO_UNIT_SIZE).toFixed(1);
                const draughtPx = ship.blueprint.draughtFactor * dims.width;
                draught = (draughtPx / CARGO_UNIT_SIZE).toFixed(2);
                
                // Calculate Hold Burthen using the unified method
                if (typeof ship.calculateBurthen === 'function') {
                    burthenHold = ship.calculateBurthen();
                }
            } else {
                len = (ship.shipLength / CARGO_UNIT_SIZE).toFixed(1);
                beam = (ship.shipWidth / CARGO_UNIT_SIZE).toFixed(1);
            }

            content += `<div class="inventory-detail-item"><strong>Length:</strong> ${len} units</div>`;
            content += `<div class="inventory-detail-item"><strong>Beam:</strong> ${beam} units</div>`;
            content += `<div class="inventory-detail-item"><strong>Draught:</strong> ${draught} units</div>`;
            content += `<div class="inventory-detail-item"><strong>Hull Durability:</strong> ${ship.maxHp} HP</div>`;
            content += `<div class="inventory-detail-item"><strong>Rig Durability:</strong> ${ship.maxRigHp} HP</div>`;
            if (burthenHold !== 'N/A') {
                content += `<div class="inventory-detail-item"><strong>Burthen (Hold):</strong> ${burthenHold} units</div>`;
            }

            // 2. Combat & Crew
            const broadside = (typeof ship.getBroadsideCount === 'function') ? ship.getBroadsideCount() : 0;
            content += `<div class="inventory-detail-item"><strong>Broadside:</strong> ${broadside} guns</div>`;

            if (ship.minSailingCrew !== undefined) {
                const minFighting = ship.minSailingCrew + (broadside * 5);
                content += `<div class="inventory-detail-item"><strong>Min. Sailing Crew:</strong> ${ship.minSailingCrew}</div>`;
                content += `<div class="inventory-detail-item"><strong>Min. Fighting Crew:</strong> ${minFighting}</div>`;
            }

            // Use current reload time (which accounts for crew)
            const reloadTime = (typeof ship.getReloadTime === 'function') ? (ship.getReloadTime() / 1000).toFixed(1) : (ship.reloadTime / 1000).toFixed(1);
            content += `<div class="inventory-detail-item"><strong>Reload Time:</strong> ${reloadTime}s</div>`;

            // 3. Performance
            const cruisingSpeed = (typeof ship.getCrusingSpeed === 'function') ? ship.getCrusingSpeed() : (ship.baseSpeed * 25).toFixed(0); // Approx fallback
            const acceleration = (typeof ship.getAcceleration === 'function') ? ship.getAcceleration().toFixed(2) : 'N/A';
            const turningRadius = (typeof ship.getTurningRadius === 'function') ? ship.getTurningRadius() : 'N/A';
            const turningRate = (typeof ship.getTurningSpeed === 'function') ? ship.getTurningSpeed() : 'N/A';
            const bestPoint = (typeof ship.getBestPointOfSail === 'function') ? ship.getBestPointOfSail() : 'N/A';

            content += `<div class="inventory-detail-item"><strong>Cruising Speed:</strong> ${cruisingSpeed} units/sec</div>`;
            content += `<div class="inventory-detail-item"><strong>Acceleration:</strong> ${acceleration} units/sec²</div>`;
            content += `<div class="inventory-detail-item"><strong>Turning Radius:</strong> ${turningRadius} ship lengths</div>`;
            content += `<div class="inventory-detail-item"><strong>Turning Rate:</strong> ${turningRate} deg/sec</div>`;
            content += `<div class="inventory-detail-item"><strong>Best Point of Sail:</strong> ${bestPoint}</div>`;

        } else if (tabName === 'cargo') {
            // Show search on cargo tab
            searchContainer.style.display = 'block';

            // --- NEW: Calculate Edibles and Potables Totals ---
            let totalEdibles = 0;
            let totalPotables = 0;
            if (ship.inventory && ship.inventory.cargo) {
                ship.inventory.cargo.forEach(entry => {
                    if (entry.item.subcategory === 'Edibles') {
                        totalEdibles += entry.quantity;
                    } else if (entry.item.subcategory === 'Potables') {
                        totalPotables += entry.quantity;
                    }
                });
            }

            // --- NEW: Inject Summary Header ---
            content += `
            <div style="display: flex; justify-content: space-around; padding: 10px; background: rgba(61, 53, 42, 0.1); border-bottom: 1px solid #948064; margin-bottom: 10px;">
                <div style="text-align: center;">
                    <div style="font-size: 12px; font-style: italic;">Edibles</div>
                    <div style="font-size: 18px; font-weight: bold;">${Math.floor(totalEdibles)}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; font-style: italic;">Potables</div>
                    <div style="font-size: 18px; font-weight: bold;">${Math.floor(totalPotables)}</div>
                </div>
            </div>`;

            // Placeholder for Cargo
            const crewItem = window.ITEM_DATABASE['crew'];
            let capacity = ship.inventory ? ship.inventory.capacity : 0;
            let usedVal = ship.inventory ? ship.inventory.usedCapacity : 0;
            
            // Add crew weight to used capacity
            if (crewItem) usedVal += (ship.crew * crewItem.weight);
            
            // Fallback calculation if inventory isn't initialized (e.g. PlayerShip currently)
            if (capacity === 0 && ship.blueprint && ship.blueprint.dimensions) {
                 if (typeof ship.calculateBurthen === 'function') {
                     capacity = ship.calculateBurthen();
                 }
            }

            content = `<div class="inventory-detail-item"><strong>Capacity:</strong> ${usedVal.toFixed(1)} / ${capacity}</div>`;
            
            // Combine actual cargo with virtual crew item
            let sortedCargo = [];
            if (ship.inventory && ship.inventory.cargo) {
                sortedCargo = [...ship.inventory.cargo];
            }
            
            // Add Crew as virtual item
            if (ship.crew > 0 && crewItem) {
                sortedCargo.push({
                    item: crewItem,
                    quantity: ship.crew,
                    container: null,
                    unitWeight: crewItem.weight,
                    isCrew: true,
                    lastUpdated: 0
                });
            }

            if (sortedCargo.length > 0) {
                // Sort by name for cleaner display
                
                // Apply Search Sort if term exists
                const searchTerm = searchInput.value.toLowerCase().trim();
                if (searchTerm) {
                    sortedCargo.sort((a, b) => {
                        const nameA = a.item.name.toLowerCase();
                        const containerA = a.container ? a.container.name.toLowerCase() : '';
                        const matchA = nameA.includes(searchTerm) || containerA.includes(searchTerm);

                        const nameB = b.item.name.toLowerCase();
                        const containerB = b.container ? b.container.name.toLowerCase() : '';
                        const matchB = nameB.includes(searchTerm) || containerB.includes(searchTerm);

                        if (matchA && !matchB) return -1; // A comes first
                        if (!matchA && matchB) return 1;  // B comes first
                        return a.item.name.localeCompare(b.item.name); // Alphabetical fallback
                    });
                } else {
                    sortedCargo.sort((a, b) => a.item.name.localeCompare(b.item.name));
                }
                
                content += `<div style="margin-top:10px; padding-top:5px;">`;
                sortedCargo.forEach(entry => {
                    const itemName = entry.item.name;
                    const qty = entry.quantity;

                    // Format quantity for display
                    // --- FIX: Display containers as integers (Ceiling) ---
                    let qtyDisplay;
                    if (entry.container) {
                        qtyDisplay = Math.ceil(qty);
                    } else {
                        qtyDisplay = Number.isInteger(qty) ? qty : parseFloat(qty.toFixed(2));
                    }
                    
                    // Calculate total weight of this stack
                    // Note: ShipInventory logic uses container weight as displacement if present
                    const unitSize = (entry.container && entry.container.weight > 0) ? entry.container.weight : ((typeof entry.item.fixedSize === 'number') ? entry.item.fixedSize : entry.item.weight);
                    const totalWeight = unitSize * qty;

                    // Determine individual item size for display (prefer fixedSize if available, else weight)
                    const itemUnitSize = (typeof entry.item.fixedSize === 'number') ? entry.item.fixedSize : entry.item.weight;

                    let containerDisplay = '';
                    if (entry.container) {
                        let cName = entry.container.name;
                        // Abbreviate sizes
                        cName = cName.replace('Small ', 'S. ').replace('Medium ', 'M. ').replace('Large ', 'L. ');
                        // Pluralize if needed
                        if (qty > 1 && !cName.endsWith('s')) cName += 's';
                        containerDisplay = cName;
                    }
                    
                    // Get cached icon URL
                    let iconUrl = window.CargoIconSystem.getIconUrl(entry);
                    let iconStyle = `background-image: url('${iconUrl}');`;

                    if (entry.isCrew) {
                        iconUrl = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%233d352a%22%3E%3Cpath d=%22M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z%22/%3E%3C/svg%3E";
                        iconStyle = `background-image: url('${iconUrl}'); background-size: 60%; opacity: 0.8;`;
                    }
                    
                    // Check for recent updates (flash effect)
                    const now = performance.now();
                    const isFlashing = entry.lastUpdated && (now - entry.lastUpdated < 500); // 500ms flash window
                    const rowClass = isFlashing ? 'inventory-cargo-row flash-update' : 'inventory-cargo-row';

                    content += `
                    <div class="${rowClass}" title="${itemName}">
                        <div class="cargo-icon" style="${iconStyle}"></div>
                        <div class="cargo-cell cargo-qty">${qtyDisplay}</div>
                        <div class="cargo-cell cargo-weight">${totalWeight.toFixed(2)}u.</div>
                        <div class="cargo-cell cargo-container">${containerDisplay}</div>
                        <div class="cargo-cell cargo-name" style="flex-direction: column; align-items: flex-start; justify-content: center;">
                            <div>${itemName}</div>
                            <div style="font-size: 0.75em; color: rgba(61, 53, 42, 0.6); font-weight: normal; font-style: italic; line-height: 1;">${itemUnitSize}u.</div>
                        </div>
                        <div class="cargo-cell cargo-action">
                            <button class="cargo-action-btn" title="Options">⋮</button>
                        </div>
                    </div>`;
                });
                content += `</div>`;
                
                content += `<div class="inventory-detail-item" style="margin-top:10px; font-style:italic; border-top: 1px solid #948064; padding-top:5px; text-align: center; opacity: 0.7;">Bilges: Bottom of the Cargo Hold</div>`;
            } else {
                content += `<div class="inventory-detail-item" style="color:#7f8c8d; margin-top:10px;">Hold is empty.</div>`;
            }
        } else if (tabName === 'crew') {
            // Hide search on crew tab
            searchContainer.style.display = 'none';

            // --- NEW: Calculate Provisions in Days ---
            let totalFoodCrewDays = 0;
            let totalDrinkCrewDays = 0;
 
            if (ship.inventory && ship.inventory.cargo) {
                const FOOD_REQUIREMENT = 0.005;
                const DRINK_REQUIREMENT = 0.005;
 
                ship.inventory.cargo.forEach(entry => {
                    // Look up item definition to ensure we have the dailyConsumption rate
                    const itemDef = window.ITEM_DATABASE[entry.item.id];
                    if (itemDef && itemDef.dailyConsumption > 0 && itemDef.weight > 0) {
                        // 1. Get total mass of the item in this stack
                        const totalMass = entry.quantity * entry.unitWeight;
                        // 2. Convert mass to number of individual items
                        const numItems = totalMass / itemDef.weight;
                        
                        // 3. Calculate how many "crew-days" this provides
                        let crewDays = 0;
                        if (itemDef.subcategory === 'Edibles') {
                            crewDays = numItems * (itemDef.dailyConsumption / FOOD_REQUIREMENT);
                            totalFoodCrewDays += crewDays;
                        } else if (itemDef.subcategory === 'Potables') {
                            crewDays = numItems * (itemDef.dailyConsumption / DRINK_REQUIREMENT);
                            totalDrinkCrewDays += crewDays;
                        }
                    }
                });
            }

            const currentCrew = Math.max(1, ship.crew); // Prevent division by zero
            const foodDays = totalFoodCrewDays / currentCrew;
            const drinkDays = totalDrinkCrewDays / currentCrew;

            content = `
            <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #948064;">
                <div class="inventory-detail-item" style="border: 1px solid #948064; padding: 8px; margin-bottom: 8px; border-radius: 4px;">
                    <div class="inventory-bar-label" style="align-items: center; font-size: 1.2em;">
                        <span style="font-weight: normal;">Food Provisions</span>
                        <strong>${foodDays.toFixed(1)} days</strong>
                    </div>
                </div>
                <div class="inventory-detail-item" style="border: 1px solid #948064; padding: 8px; border-radius: 4px;">
                    <div class="inventory-bar-label" style="align-items: center; font-size: 1.2em;">
                        <span style="font-weight: normal;">Water & Drink</span>
                        <strong>${drinkDays.toFixed(1)} days</strong>
                    </div>
                </div>
            </div>`;

            content += `<div class="inventory-detail-item"><strong>Manning:</strong> ${Math.round(ship.crew)} / ${ship.maxCrew}</div>`;
            
            content += `<div style="margin-top:10px; padding-top:5px;">`;
            
            // Simple SVG icon for crew
            const crewIconUrl = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%233d352a%22%3E%3Cpath d=%22M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z%22/%3E%3C/svg%3E";
            
            content += `
            <div class="inventory-cargo-row">
                <div class="cargo-icon" style="background-image: url('${crewIconUrl}'); background-size: 60%; opacity: 0.8;"></div>
                <div class="cargo-cell cargo-qty">${Math.round(ship.crew)}</div>
                <div class="cargo-cell cargo-name" style="padding-left: 10px;">All Crew</div>
                <div class="cargo-cell cargo-action">
                    <button class="cargo-action-btn crew-action-btn" title="Options">⋮</button>
                </div>
            </div>`;
            
            content += `</div>`;
        }
        details.innerHTML = content;

        // Attach listeners to new buttons
        if (tabName === 'cargo') {
            const actionBtns = details.querySelectorAll('.cargo-action-btn');
            // We need to map buttons back to sorted entries. 
            // Re-sort logic must match display logic exactly.
            // For simplicity, we can assume the order in DOM matches sortedCargo array.
            // (Since we just generated it).
            let sortedCargo = [...ship.inventory.cargo];
            // ... (Sort logic duplicated from above or refactored) ...
            // For now, simple index matching:
            const searchTerm = searchInput.value.toLowerCase().trim();
            if (searchTerm) {
                 sortedCargo.sort((a, b) => { /* ... same sort logic ... */ 
                    const nameA = a.item.name.toLowerCase();
                    const containerA = a.container ? a.container.name.toLowerCase() : '';
                    const matchA = nameA.includes(searchTerm) || containerA.includes(searchTerm);
                    const nameB = b.item.name.toLowerCase();
                    const containerB = b.container ? b.container.name.toLowerCase() : '';
                    const matchB = nameB.includes(searchTerm) || containerB.includes(searchTerm);
                    if (matchA && !matchB) return -1;
                    if (!matchA && matchB) return 1;
                    return a.item.name.localeCompare(b.item.name);
                 });
            } else {
                sortedCargo.sort((a, b) => a.item.name.localeCompare(b.item.name));
            }

            actionBtns.forEach((btn, index) => {
                btn.addEventListener('click', () => {
                    const entry = sortedCargo[index];
                    // Determine target ship (the "other" one)
                    const targetShip = (ship === currentPrimaryShip) ? currentSecondaryShip : currentPrimaryShip;
                    openCargoActionDialog(ship, entry, targetShip);
                });
            });
        } else if (tabName === 'crew') {
             const btn = details.querySelector('.crew-action-btn');
             if (btn) {
                 btn.addEventListener('click', () => {
                     const crewItem = window.ITEM_DATABASE['crew'];
                     const entry = {
                         isCrew: true,
                         item: { name: "Crew" },
                         quantity: Math.round(ship.crew),
                         unitWeight: crewItem ? crewItem.weight : 0,
                         container: null
                     };
                     // Determine target ship (the "other" one)
                     const targetShip = (ship === currentPrimaryShip) ? currentSecondaryShip : currentPrimaryShip;
                     openCargoActionDialog(ship, entry, targetShip);
                 });
             }
        }
    }

    // Helper to populate a panel
    function populatePanel(panel, ship, isPrimary) {
        // 1. Ship Info
        const nameContainer = panel.querySelector('.inventory-ship-name');
        nameContainer.innerHTML = '';
        const nameText = document.createElement('span');
        nameText.textContent = ship.displayName || ship.archetypeName;
        nameContainer.appendChild(nameText);

        // --- Helper to create Rename Button ---
        const createRenameButton = () => {
            const renameBtn = document.createElement('button');
            renameBtn.className = 'inventory-rename-btn';
            renameBtn.innerHTML = '&#x270E;'; // Pencil icon
            renameBtn.title = "Rename Ship";
            renameBtn.onclick = () => {
                const dialog = document.getElementById('rename-dialog');
                const input = document.getElementById('rename-input');
                const confirmBtn = document.getElementById('btn-rename-confirm');
                const cancelBtn = document.getElementById('btn-rename-cancel');

                input.value = ship.displayName;
                dialog.style.display = 'flex';
                input.focus();
                input.select();

                // Clone buttons to remove old listeners
                const newConfirm = confirmBtn.cloneNode(true);
                const newCancel = cancelBtn.cloneNode(true);
                confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
                cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

                const closeDialog = () => { dialog.style.display = 'none'; };
                const confirmRename = () => {
                    const newName = input.value.trim();
                    if (newName) {
                        ship.displayName = newName;
                        nameText.textContent = ship.displayName;
                        const statsNameInput = document.getElementById('ship-name-input');
                        if (statsNameInput) statsNameInput.value = ship.displayName;
                    }
                    closeDialog();
                };

                newConfirm.addEventListener('click', confirmRename);
                newCancel.addEventListener('click', closeDialog);
                input.onkeydown = (e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') closeDialog(); };
            };
            nameContainer.appendChild(renameBtn);
        };

        if (ship.constructor.name === 'PlayerShip' || ship.isAllied) {
            createRenameButton();
        }

        panel.querySelector('.inventory-ship-type').textContent = ship.shipType;

        // 2. Bars
        updatePanelBars(panel, ship);

        // 3. Image
        // --- OPTIMIZATION: Use CanvasManager to pool temporary canvases ---
        const tempCanvas = window.CanvasManager.getCanvas(200, 200);

        const tempCtx = tempCanvas.getContext('2d');
        const origX = ship.x; const origY = ship.y; const origAngle = ship.angle;
        ship.x = 0; ship.y = 0; ship.angle = 0;
        let scale = 1.0;
        let visualCenterX = 0;
        let visualCenterY = 0;
        if (typeof ship.getOverallBounds === 'function') {
            const bounds = ship.getOverallBounds();
            const length = bounds.maxX - bounds.minX;
            const width = bounds.maxY - bounds.minY;
            const maxDimension = Math.max(length, width);
            scale = 160 / maxDimension;
            visualCenterX = (bounds.minX + bounds.maxX) / 2;
            visualCenterY = (bounds.minY + bounds.maxY) / 2;
        } else {
            scale = 140 / ship.shipLength;
        }
        tempCtx.translate(100, 100);
        tempCtx.scale(scale, scale);
        tempCtx.rotate(-Math.PI / 2);
        tempCtx.translate(-visualCenterX, -visualCenterY);
        CustomShip.prototype.drawWorldSpace.call(ship, tempCtx, scale, Math.PI);
        ship.x = origX; ship.y = origY; ship.angle = origAngle;
        panel.querySelector('.inventory-ship-image').src = tempCanvas.toDataURL();
        window.CanvasManager.releaseCanvas(tempCanvas); // Release canvas back to the pool

        // 4. Tabs Logic
        const tabs = panel.querySelectorAll('.inventory-tab');
        // Remove old listeners to prevent duplicates (simple clone replacement)
        const newTabsContainer = panel.querySelector('.inventory-tabs');
        const clonedTabsContainer = newTabsContainer.cloneNode(true);
        newTabsContainer.parentNode.replaceChild(clonedTabsContainer, newTabsContainer);
        
        // Reset active state to 'stats' to match the default content view
        clonedTabsContainer.querySelectorAll('.inventory-tab').forEach(t => {
            if (t.dataset.tab === 'stats') t.classList.add('active');
            else t.classList.remove('active');
        });

        clonedTabsContainer.querySelectorAll('.inventory-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                clonedTabsContainer.querySelectorAll('.inventory-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                updateDetails(panel, ship, tab.dataset.tab);
            });
        });

        // 5. Search Input Logic
        const searchInput = panel.querySelector('.inventory-search-input');
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        
        newSearchInput.value = ''; // Reset search when opening panel
        newSearchInput.addEventListener('input', () => {
            const activeTab = panel.querySelector('.inventory-tab.active');
            if (activeTab && activeTab.dataset.tab === 'cargo') {
                updateDetails(panel, ship, 'cargo');
            }
        });

        // Trigger default tab
        updateDetails(panel, ship, 'stats');

        // 6. Actions (Only for Primary Panel)
        const actionsContainer = panel.querySelector('.inventory-actions');
        actionsContainer.innerHTML = ''; // Clear previous buttons

        if (isPrimary) {
            if (ship.constructor.name === 'PlayerShip') {
                // Player viewing own inventory
                actionsContainer.innerHTML = `
                    <button class="inventory-btn btn-close">Close</button>
                    <button class="inventory-btn btn-abandon">Abandon</button>
                    <button class="inventory-btn btn-scuttle">Scuttle</button>
                `;
                actionsContainer.querySelector('.btn-close').addEventListener('click', () => {
                    if (window.PlunderGame && window.PlunderGame.closeInventory) {
                        window.PlunderGame.closeInventory();
                    }
                });
                actionsContainer.querySelector('.btn-abandon').addEventListener('click', () => {
                    window.showConfirmationDialog("Abandon Ship?", () => {
                        ship.hp = 0; // Trigger game over
                        screen.style.display = 'none';
                    });
                });
                actionsContainer.querySelector('.btn-scuttle').addEventListener('click', () => {
                    window.showConfirmationDialog("Scuttle Ship?", () => {
                        ship.hp = 0; // Trigger game over
                        screen.style.display = 'none';
                    });
                });
            } else if (ship.isAllied) {
                // Allied Ship
                actionsContainer.innerHTML = `
                    <button class="inventory-btn btn-make-flagship">Make Flagship</button>
                    <button class="inventory-btn btn-abandon">Abandon</button>
                    <button class="inventory-btn btn-scuttle">Scuttle</button>
                `;
                actionsContainer.querySelector('.btn-make-flagship').addEventListener('click', () => {
                    window.showConfirmationDialog("Make this ship your Flagship?", () => {
                        if (window.PlunderGame && window.PlunderGame.swapFlagship) {
                            window.PlunderGame.swapFlagship(ship);
                            screen.style.display = 'none'; // Close menu after swap
                        }
                    });
                });
                actionsContainer.querySelector('.btn-abandon').addEventListener('click', () => {
                    if (window.inventoryActions) { window.inventoryActions.abandon(ship.shipId); screen.style.display = 'none'; }
                });
                actionsContainer.querySelector('.btn-scuttle').addEventListener('click', () => {
                    if (window.inventoryActions) { window.inventoryActions.scuttle(ship.shipId); screen.style.display = 'none'; }
                });
            } else {
                // Player viewing surrendered ship
                actionsContainer.innerHTML = `
                    <button class="inventory-btn btn-seize">Seize</button>
                    <button class="inventory-btn btn-abandon">Abandon</button>
                    <button class="inventory-btn btn-scuttle">Scuttle</button>
                `;
                actionsContainer.querySelector('.btn-seize').addEventListener('click', () => {
                    if (window.fleetUI && currentSecondaryShip) {
                        window.fleetUI.openSeizeDialog(ship, currentSecondaryShip);
                    }
                });
                actionsContainer.querySelector('.btn-abandon').addEventListener('click', () => {
                    if (window.inventoryActions) { window.inventoryActions.abandon(ship.shipId); screen.style.display = 'none'; }
                });
                actionsContainer.querySelector('.btn-scuttle').addEventListener('click', () => {
                    if (window.inventoryActions) { window.inventoryActions.scuttle(ship.shipId); screen.style.display = 'none'; }
                });
            }
        }
    }

    // Exposed Function to Open Menu
    window.openInventoryMenu = (primaryShip, secondaryShip = null) => {
        currentPrimaryShip = primaryShip;
        currentSecondaryShip = secondaryShip; // Store secondary

        // --- OPTIMIZATION: Start a dedicated interval for UI refresh ---
        // This decouples the DOM updates from the high-frequency canvas render loop.
        if (inventoryRefreshIntervalId) clearInterval(inventoryRefreshIntervalId);
        inventoryRefreshIntervalId = setInterval(window.refreshInventoryUI, INVENTORY_REFRESH_INTERVAL);
        window.inventoryRefreshIntervalId = inventoryRefreshIntervalId; // Expose to game.js for clearing

        screen.style.display = 'flex';
        
        const leftPanel = document.getElementById('inventory-panel-left');
        const rightPanel = document.getElementById('inventory-panel-right');

        // Populate Left Panel (Primary)
        populatePanel(leftPanel, primaryShip, true);

        // Populate Right Panel (Secondary - Player) if exists
        if (secondaryShip) {
            rightPanel.style.display = 'flex';
            populatePanel(rightPanel, secondaryShip, false);
        } else {
            rightPanel.style.display = 'none';
        }
    };

    // --- NEW: Exposed Function to Refresh Menu ---
    window.refreshInventoryUI = () => {
        // Check if the screen is actually visible
        if (screen.style.display !== 'flex') return;

        const leftPanel = document.getElementById('inventory-panel-left');
        const rightPanel = document.getElementById('inventory-panel-right');

        // Refresh Left Panel (Primary)
        if (currentPrimaryShip) {
            const activeTabEl = leftPanel.querySelector('.inventory-tab.active');
            if (activeTabEl) {
                updateDetails(leftPanel, currentPrimaryShip, activeTabEl.dataset.tab);
            }
        }

        // Refresh Right Panel (Secondary) if visible
        if (currentSecondaryShip && rightPanel.style.display === 'flex') {
            const activeTabEl = rightPanel.querySelector('.inventory-tab.active');
            if (activeTabEl) {
                updateDetails(rightPanel, currentSecondaryShip, activeTabEl.dataset.tab);
            }
        }
    };
}