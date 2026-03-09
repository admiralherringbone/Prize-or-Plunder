/**
 * The main orchestrator for creating custom ship blueprints.
 * It takes user choices from the shipyard UI and uses various generator
 * modules to assemble a complete ship design.
 */
class ShipGenerator {
    constructor() {
        // Default parameters for a new ship design.
        // These will be updated by the UI.
        this.buildType = 'guns';
        this.deckLayoutType = 'standard'; // New: 'standard' or 'cargo'
        this.gunsPerBattery = 1;
        this.cargoCapacity = 1;
        this.cargoGuns = 0; // New property for guns on a cargo ship
        this.draughtFactor = 0.5; // New property for draught
        this.beamRatio = 2.0;
        this.mastCount = 1;
        this.rigType = 'square'; // Default rig type
        this.numDecks = 1; // New property for number of decks
        this.deckTypes = ['gun', 'gun']; // New: Stores type for 1st and 2nd tier decks

        this.aftercastleEquipped = false; // New: For superstructure
        this.forecastleEquipped = false; // New: For superstructure
        this.midcastleEquipped = false; // New: For Midcastle
        this.sterncastleEquipped = false; // New: For Sterncastle
        this.foreDeckhouseEquipped = false; // New: For Fore Deckhouse
        this.aftDeckhouseEquipped = false; // New: For Aft Deckhouse
        this.midDeckhouseEquipped = false; // New: For Mid Deckhouse
        this.sternCabinEquipped = false; // New: For Stern Cabin
        this.sparDeckEquipped = false; // New: For Spar-deck
        this.sterncastleOnSparDeckEquipped = false; // New: For Sterncastle on Spar-deck
        // --- Internal Generation Constants ---
        this.artilleryPositionMultiplier = 3;
        this.foreSectionRatio = 1 / 8;
        this.aftSectionRatio = 1 / 8;
        this.minimumSectionLength = 30; // A reasonable minimum length for fore/aft sections
        this.smallShipBonusDivisor = 100;
    }

    // --- Setter Methods ---
    setBuildType(type) { this.buildType = type; }
    setDeckLayoutType(type) { this.deckLayoutType = type; } // New setter
    setGunsPerBattery(count) { this.gunsPerBattery = count; }
    setCargoCapacity(count) { this.cargoCapacity = count; }
    setCargoGuns(count) { this.cargoGuns = count; }
    setDraughtFactor(factor) { this.draughtFactor = factor; }
    setBeamRatio(ratio) { this.beamRatio = ratio; }    
    setRigType(type) { this.rigType = type; }
    setMastCount(count) { this.mastCount = count; }
    /**
     * Sets the number of decks for the ship.
     * @param {number} count - The number of decks (1, 2, or 3).
     */
    setNumDecks(count) { this.numDecks = count; }
    /**
     * Sets the type for a specific lower deck tier.
     * @param {number} tierIndex - The index of the deck (0 for 1st tier, 1 for 2nd tier).
     * @param {string} type - The type of the deck ('gun' or 'cargo').
     */
    setDeckType(tierIndex, type) {
        this.deckTypes[tierIndex] = type;
    }
    /**
     * Sets whether the aftercastle is equipped.
     * @param {boolean} equipped - True if the aftercastle should be added.
     */
    setAftercastle(equipped) {
        this.aftercastleEquipped = equipped;
    }
    /**
     * Sets whether the forecastle is equipped.
     * @param {boolean} equipped - True if the forecastle should be added.
     */
    setForecastle(equipped) {
        this.forecastleEquipped = equipped;
    }
    /**
     * Sets whether the midcastle is equipped.
     * @param {boolean} equipped - True if the midcastle should be added.
     */
    setMidcastle(equipped) {
        this.midcastleEquipped = equipped;
    }
    /**
     * Sets whether the sterncastle is equipped.
     * @param {boolean} equipped - True if the sterncastle should be added.
     */
    setSterncastle(equipped) {
        this.sterncastleEquipped = equipped;
    }
    /**
     * Sets whether the spar-deck is equipped.
     * @param {boolean} equipped - True if the spar-deck should be added.
     */
    setSparDeck(equipped) {
        this.sparDeckEquipped = equipped;
    }
    /**
     * Sets whether the sterncastle is equipped on top of the spar-deck.
     * @param {boolean} equipped - True if the sterncastle should be added.
     */
    setSterncastleOnSparDeck(equipped) {
        this.sterncastleOnSparDeckEquipped = equipped;
    }
    /**
     * Sets whether the mid deckhouse is equipped.
     * @param {boolean} equipped - True if the mid deckhouse should be added.
     */
    setMidDeckhouse(equipped) {
        this.midDeckhouseEquipped = equipped;
    }
    /**
     * Sets whether the fore deckhouse is equipped.
     * @param {boolean} equipped - True if the fore deckhouse should be added.
     */
    setForeDeckhouse(equipped) {
        this.foreDeckhouseEquipped = equipped;
    }
    /**
     * Sets whether the aft deckhouse is equipped.
     * @param {boolean} equipped - True if the aft deckhouse should be added.
     */
    setAftDeckhouse(equipped) {
        this.aftDeckhouseEquipped = equipped;
    }

    /**
     * Sets whether the stern cabin is equipped.
     * @param {boolean} equipped - True if the stern cabin should be added.
     */
    setSternCabin(equipped) {
        this.sternCabinEquipped = equipped;
    }

    /**
     * Helper to find the width of a deck polygon at a specific X-coordinate.
     * @param {Array<object>} deckPoints - The points of the deck polygon.
     * @param {number} x - The X-coordinate to measure at.
     * @returns {{topY: number, bottomY: number, width: number}|null}
     * @private
     */
    _getDeckWidthAtX(deckPoints, x) {
        // --- Corrected Logic ---
        // This function now robustly handles vertical lines at the measurement coordinate.
        const epsilon = 1e-9; 
        const intersections = [];
        for (let i = 0; i < deckPoints.length; i++) {
            const p1 = deckPoints[i];
            const p2 = deckPoints[(i + 1) % deckPoints.length];

            // Case 1: The segment is a perfectly vertical line at our measurement point.
            if (Math.abs(p1.x - x) < epsilon && Math.abs(p2.x - x) < epsilon) {
                intersections.push(p1.y, p2.y);
            } 
            // Case 2: The segment crosses our measurement point.
            else if ((p1.x <= x + epsilon && p2.x > x - epsilon) || (p2.x <= x + epsilon && p1.x > x - epsilon)) {
                const t = (x - p1.x) / (p2.x - p1.x);
                const y = p1.y + t * (p2.y - p1.y);
                intersections.push(y);
            }
        }

        if (intersections.length < 2) return null;

        const bottomY = Math.min(...intersections);
        const topY = Math.max(...intersections);
        return { topY, bottomY, width: topY - bottomY };
    }
    /**
     * New: Generates standard deck objects like the cargo hatch.
     * @param {object} geometry - The ship's generated geometry.
     * @param {Array<object>} mastLayout - The layout of the ship's masts.
     * @param {number} totalLength - The total length of the ship.
     * @param {number} shipBeam - The beam (width) of the ship.
     * @param {number} foreSectionLength - The length of the ship's fore section.
     * @param {number|null} bowspritDeckStart - The rearmost X-coordinate of the bowsprit on the deck.
     * @returns {object} An object containing geometries for deck objects.
     * @private
     */
    _generateDeckObjects(geometry, mastLayout, totalLength, shipBeam, foreSectionLength, bowspritDeckStart, rigType) {
        const deckObjects = {};
 
        // --- Cargo Hatch Generation ---
        const cargoHatches = this._generateCargoHatch(geometry, mastLayout, totalLength, shipBeam, foreSectionLength, bowspritDeckStart, rigType);
        if (cargoHatches && cargoHatches.length > 0) {
            // The cargo hatch generator now always returns an array.
            console.log("Generated Cargo Hatches:", cargoHatches);
            deckObjects.cargoHatches = cargoHatches;
        }
        return deckObjects;
    }

    /**
     * New: Calculates the geometry and position for the cargo hatch.
     * @private
     */
    _generateCargoHatch(geometry, mastLayout, totalLength, shipBeam, foreSectionLength, bowspritDeckStart, rigType) {
        const obstacles = []; // --- FIX: Declare obstacles array at the top.

        // --- 1. DEFINE CONSTANTS AND LAYOUT SETTINGS ---
        const BAR_THICKNESS = CARGO_UNIT_SIZE / 10;
        const SPACING = CARGO_UNIT_SIZE / 10;
        const GRID_UNIT = BAR_THICKNESS + SPACING;

        let isCargoLayout;
        if (this.deckLayoutType === 'cargo') {
            if (this.numDecks >= 2) {
                // New rule for multi-deck ships
                let sizeBasedMaxBeamRatio = 4.0;
                if (this.buildType === 'guns') {
                    if (this.gunsPerBattery === 1) sizeBasedMaxBeamRatio = 2.0;
                    else if (this.gunsPerBattery === 2) sizeBasedMaxBeamRatio = 2.3;
                    else if (this.gunsPerBattery >= 3 && this.gunsPerBattery <= 4) sizeBasedMaxBeamRatio = 2.5;
                    else if (this.gunsPerBattery >= 5 && this.gunsPerBattery <= 7) sizeBasedMaxBeamRatio = 3.5;
                    else if (this.gunsPerBattery >= 8) sizeBasedMaxBeamRatio = 4.0;
                } else if (this.buildType === 'cargo') {
                    if (this.cargoCapacity >= 1 && this.cargoCapacity <= 3) sizeBasedMaxBeamRatio = 2.0;
                    else if (this.cargoCapacity >= 4 && this.cargoCapacity <= 6) sizeBasedMaxBeamRatio = 2.3;
                    else if (this.cargoCapacity >= 7 && this.cargoCapacity <= 20) sizeBasedMaxBeamRatio = 2.5;
                    else if (this.cargoCapacity >= 21 && this.cargoCapacity <= 40) sizeBasedMaxBeamRatio = 3.5;
                    else if (this.cargoCapacity >= 41) sizeBasedMaxBeamRatio = 4.0;
                }
                let deckBasedMaxBeamRatio = (this.numDecks === 2) ? 3.75 : 3.5;
                const maxAllowedBeamRatio = Math.min(sizeBasedMaxBeamRatio, deckBasedMaxBeamRatio);
                const halfwayPoint = (maxAllowedBeamRatio + 2.0) / 2;
                isCargoLayout = this.beamRatio < halfwayPoint;
            } else {
                // Original rule for 1-decker ships
                isCargoLayout = this.beamRatio <= 3.0;
            }
        } else {
            isCargoLayout = false;
        }

        // --- 2. IDENTIFY OBSTACLES ---
        // Define rigs that typically have a bowsprit that might require an extended deck obstruction.
        // This list can be refined based on specific rig geometries.
        const rigsWithExtendedBowspritObstruction = [
            'sloop', 'fore-and-aft-sloop', 'brig', 'schooner',
            'three-mast-schooner', 'brigantine', 'barque', 'barquentine', 'full-rigged'
        ];

        // --- Refined Bowsprit Obstacle Logic ---
        if (bowspritDeckStart !== null && bowspritDeckStart < (totalLength / 2)) {
            let effectiveBowspritObstructionStart = bowspritDeckStart;
            let bowspritAftExtension = 0; // Default no extension

            if (rigsWithExtendedBowspritObstruction.includes(rigType)) {
                // For sloops and fore-and-aft sloops, the bowsprit base often takes up more deck space.
                // This is a heuristic value and might need tuning based on visual inspection.
                if (rigType === 'sloop' || rigType === 'fore-and-aft-sloop') {
                    bowspritAftExtension = CARGO_UNIT_SIZE * 1.0; // Extend by one full cargo unit length
                } else {
                    // For other multi-masted rigs with bowsprits, a smaller extension might be sufficient.
                    bowspritAftExtension = CARGO_UNIT_SIZE * 0.5;
                }
            }
            effectiveBowspritObstructionStart -= bowspritAftExtension;
            obstacles.push({ start: effectiveBowspritObstructionStart, end: totalLength / 2, type: 'bowsprit' });
            console.log(`Added bowsprit obstacle (rig: ${rigType}) from ${effectiveBowspritObstructionStart} to ${totalLength / 2}`);
        }

        // --- FIX: Use the mast's actual baseRadius for accurate obstacle detection. ---
        // The previous logic used a generic radius based on ship beam, which was inaccurate.
        mastLayout.forEach(mast => {
            // --- DEBUG: Double the mast obstacle size to ensure it's being respected. ---
            // This is a temporary measure to create a larger buffer.
            const mastRadius = (mast.baseRadius || (shipBeam / 32)) * 2; // Use actual radius (or fallback) and double it.
            obstacles.push({ start: mast.x - mastRadius, end: mast.x + mastRadius, type: 'mast' });
        });

        // Add superstructures as obstacles
        const addStructure = (geom, type) => {
            if (!geom) return;
            const startX = geom.hull.reduce((min, p) => Math.min(min, p.x), Infinity);
            const endX = geom.hull.reduce((max, p) => Math.max(max, p.x), -Infinity);
            if (isFinite(startX) && isFinite(endX)) {
                obstacles.push({ start: startX, end: endX, type });
            }
        };
        const addDeckhouse = (geom, type) => {
            if (geom) {
                obstacles.push({ start: geom.outer.startX, end: geom.outer.endX, type });
            }
        };

        // IMPORTANT: Per user request, the spar deck is not a single obstacle.
        // Instead, its solid parts are treated as an aftercastle and forecastle.
        if (this.sparDeckEquipped && geometry.spardeck) {
            const gangwayStart = geometry.spardeck.gangwayCutout.reduce((max, p) => Math.max(max, p.x), -Infinity);
            const gangwayEnd = geometry.spardeck.gangwayCutout.reduce((min, p) => Math.min(min, p.x), Infinity);
            // Aft part of spar deck
            obstacles.push({ start: -totalLength / 2, end: gangwayEnd, type: 'spardeck_aft' });
            // Forward part of spar deck
            obstacles.push({ start: gangwayStart, end: totalLength / 2, type: 'spardeck_fore' });
        } else {
            // If no spar deck, add the normal castles.
            addStructure(geometry.aftercastle, 'aftercastle');
            addStructure(geometry.forecastle, 'forecastle');
        }

        addStructure(geometry.midcastle, 'midcastle');
        addDeckhouse(geometry.midDeckhouse, 'midDeckhouse');
        addDeckhouse(geometry.foreDeckhouse, 'foreDeckhouse');
        addDeckhouse(geometry.aftDeckhouse, 'aftDeckhouse');
        addStructure(geometry.sternCabin, 'sternCabin');

        // --- 3. DEFINE SEARCH AREA (MID-SECTION) AND FIND GAPS ---
        const midSectionStart = -totalLength / 2 + this.aftSectionRatio * totalLength;
        const midSectionEnd = totalLength / 2 - this.foreSectionRatio * totalLength;

        // Create a sorted list of all unique start and end points of obstacles.
        const boundaries = obstacles.map(o => o.start).concat(obstacles.map(o => o.end));
        boundaries.push(midSectionStart, midSectionEnd); // Bound the search to the mid-section
        const sortedBoundaries = [...new Set(boundaries)].sort((a, b) => a - b);

        let gaps = [];
        for (let i = 0; i < sortedBoundaries.length - 1; i++) {
            const gapStart = sortedBoundaries[i];
            const gapEnd = sortedBoundaries[i + 1];
            const gapLength = gapEnd - gapStart;
            const midPoint = gapStart + (gapEnd - gapStart) / 2;

            // --- FIX: A valid gap must have a minimum length and not be inside an obstacle. ---
            // This prevents tiny, incorrect gaps from being created between adjacent obstacles
            // like the bowsprit and foremast, which was causing hatch overlaps.
            const MIN_GAP_LENGTH = 1.0; // A small threshold to filter out sliver gaps.
 
            // A valid gap must not be inside an obstacle.
            const isInsideObstacle = obstacles.some(o => midPoint >= o.start && midPoint <= o.end);
 
            // The gap must also be within the designated mid-section of the ship.
            const isWithinMidsection = midPoint >= midSectionStart && midPoint <= midSectionEnd;
 
            if (!isInsideObstacle && isWithinMidsection && gapLength > MIN_GAP_LENGTH) {
                gaps.push({ start: gapStart, end: gapEnd, length: gapEnd - gapStart, center: midPoint });
            }
        }

        if (gaps.length === 0) {
            return []; // Return empty array
        }
        // --- 4. NEW: GENERATE HATCHES FOR EVERY GAP ---
        const allHatches = [];

        gaps.forEach(gap => {
            // --- 5. CALCULATE HATCH DIMENSIONS FOR THIS GAP ---
            // Determine if the hatch is between two superstructures (100% length) or not (50%/75%)
            const leftObstacle = obstacles.find(o => o.end === gap.start);
            const rightObstacle = obstacles.find(o => o.start === gap.end);
            const isBetweenSuperstructures = leftObstacle && leftObstacle.type !== 'mast' &&
                                           rightObstacle && rightObstacle.type !== 'mast';

            const lengthMultiplier = isBetweenSuperstructures ? 1.0 : (isCargoLayout ? 0.75 : 0.5);
            const targetLength = gap.length * lengthMultiplier;

            if (targetLength <= 0) return; // Skip this gap if there's no space

            // Calculate final grid-snapped dimensions
            const targetWidth = shipBeam / 4;
            const clampedWidth = Math.max(CARGO_UNIT_SIZE, Math.min(targetWidth, CARGO_UNIT_SIZE * 2));
            const numBarsY = Math.round((clampedWidth + SPACING) / GRID_UNIT);
            const finalWidth = (numBarsY * GRID_UNIT) - SPACING;

            // Snap the target length to the nearest valid grid size.
            const numBarsX = Math.round((targetLength + SPACING) / GRID_UNIT);
            const finalLength = (numBarsX * GRID_UNIT) - SPACING;

            // --- New: Do not generate hatches smaller than a minimum size. ---
            const MIN_HATCH_LENGTH = CARGO_UNIT_SIZE / 2;
            if (finalLength < MIN_HATCH_LENGTH) return; // Skip if the final hatch is too small.

            // Center the hatch within its defined space.
            const hatchCenterX = gap.center;

            // --- Generate one or two hatches based on layout type ---
            if (isCargoLayout) {
                // Account for the hatch's frame to prevent overlap.
                const frameThickness = (BAR_THICKNESS * 2);
                const yOffset = (finalWidth / 2) + (frameThickness / 2);
                allHatches.push(
                    this._createHatchObject(hatchCenterX, -yOffset, finalWidth, finalLength, numBarsX, numBarsY),
                    this._createHatchObject(hatchCenterX, yOffset, finalWidth, finalLength, numBarsX, numBarsY)
                );
            } else {
                allHatches.push(
                    this._createHatchObject(hatchCenterX, 0, finalWidth, finalLength, numBarsX, numBarsY)
                );
            }
        });

        return allHatches;
    }

    /**
     * Helper function to create a single hatch data object.
     * @private
     */
    _createHatchObject(x, y, width, length, numBarsX, numBarsY) {
        const BAR_THICKNESS = CARGO_UNIT_SIZE / 10;
        const SPACING = CARGO_UNIT_SIZE / 10;
        return {
            x: x,
            y: y,
            width: width,
            length: length,
            barThickness: BAR_THICKNESS,
            spacing: SPACING,
            numBarsX: numBarsX,
            numBarsY: numBarsY
        };
    }


    /**
     * Calculates the final dimensions of the ship based on current parameters.
     * @returns {{totalLength: number, shipBeam: number}}
     */
    _calculateDimensions() { // This method is now internal and returns more detail
        let midSectionLength = 0;

        if (this.buildType === 'guns') {
            const artilleryPositionSize = CANNON_UNIT_SIZE * this.artilleryPositionMultiplier;
            midSectionLength = artilleryPositionSize * this.gunsPerBattery;

            // Apply the small ship mid-section buffer for 1-3 guns
            if (this.gunsPerBattery >= 1 && this.gunsPerBattery <= 3) {
                const buffer = artilleryPositionSize / this.gunsPerBattery;
                midSectionLength += buffer;
            }
        } else if (this.buildType === 'cargo') {
            // For cargo ships, the mid-section is determined by the cargo capacity.
            // We'll use the CARGO_UNIT_SIZE as the base length per unit of capacity.
            midSectionLength = CARGO_UNIT_SIZE * this.cargoCapacity;
        }

        // Calculate fore and aft sections based on the mid-section
        let foreSectionLength = midSectionLength * this.foreSectionRatio;
        let aftSectionLength = midSectionLength * this.aftSectionRatio;

        // Apply the "small ship bonus" for fore/aft sections
        if (foreSectionLength <= this.minimumSectionLength) {
            foreSectionLength = this.minimumSectionLength + (midSectionLength / this.smallShipBonusDivisor);
        }
        if (aftSectionLength <= this.minimumSectionLength) {
            aftSectionLength = this.minimumSectionLength + (midSectionLength / this.smallShipBonusDivisor);
        }

        const totalLength = foreSectionLength + midSectionLength + aftSectionLength;
        const shipBeam = totalLength / this.beamRatio;

        return { totalLength, shipBeam, midSectionLength, foreSectionLength, aftSectionLength };
    }

    /**
     * Generates a complete ship blueprint based on the current parameters.
     * This method will eventually call out to other generator modules.
     * @returns {object} A blueprint object.
     */
    generateBlueprint() {
        const { totalLength, shipBeam, midSectionLength, foreSectionLength, aftSectionLength } = this._calculateDimensions();

        // Call the HullGenerator to get the procedural geometry.
        const geometry = HullGenerator.generate({ length: totalLength, width: shipBeam, numDecks: this.numDecks });

        // Calculate the size of a single artillery position for the ruler.
        const artilleryPositionSize = (this.buildType === 'guns')
            ? (CANNON_UNIT_SIZE * this.artilleryPositionMultiplier)
            : 0;

        // --- FIX: Generate mast layout BEFORE it's needed by other generators. ---
        const mastLayout = RiggingGenerator.generate({
            mastCount: this.mastCount,
            totalLength: totalLength
        });

        // --- New: Generate cannon layouts for each applicable deck tier ---
        const cannonLayouts = {};
        for (let tier = 1; tier <= this.numDecks; tier++) {
            let isGunDeck = false;
            if (tier === this.numDecks) {
                // The top deck is always a gun deck.
                isGunDeck = true;
            } else {
                // For lower decks, check the corresponding deck type setting.
                // The UI's "Deck Type 1st Tier" corresponds to the lowest deck on the ship.
                const deckTypeIndex = tier - 1;
                isGunDeck = this.deckTypes[deckTypeIndex] === 'gun';
            }

            if (isGunDeck) {
                let cannonBulwarkPoints;
                if (tier === 1) cannonBulwarkPoints = geometry.bulwarkCutout;
                else if (tier === 2) cannonBulwarkPoints = geometry.tier2_bulwarkCutout;
                else if (tier === 3) cannonBulwarkPoints = geometry.tier3_bulwarkCutout;

                if (cannonBulwarkPoints) {
                    // --- New Quincunx Pattern Logic ---
                    // Determine the number of guns for the current tier based on the total number of decks.
                    const baseGunCount = (this.buildType === 'guns') ? this.gunsPerBattery : this.cargoGuns;
                    let gunCountForTier = 0;

                    if (this.numDecks === 1) {
                        // 1-Decker: Standard gun count.
                        gunCountForTier = baseGunCount;
                    } else if (this.numDecks === 2) {
                        // 2-Decker: Top deck has base count, lower deck has one less.
                        gunCountForTier = (tier === 2) ? baseGunCount : baseGunCount - 1;
                    } else if (this.numDecks === 3) {
                        // 3-Decker: Top and bottom have base count, middle has one less.
                        gunCountForTier = (tier === 2) ? baseGunCount - 1 : baseGunCount;
                    }

                    // Ensure gun count doesn't go below zero.
                    gunCountForTier = Math.max(0, gunCountForTier);

                    cannonLayouts[tier] = DeckGenerator.generate({
                        buildType: this.buildType,
                        gunsPerBattery: gunCountForTier,
                        baseGunCount: baseGunCount, // Pass the base count for spacing calculations
                        bulwarkCutoutPoints: cannonBulwarkPoints,
                        midSectionLength,
                        foreSectionLength,
                        totalLength
                    });
                }
            }
        }

        // --- New: Aftercastle Geometry Generation ---
        if (this.aftercastleEquipped && this.numDecks <= 3) { // FIX: Allow superstructures on 3-deckers.
            const aftercastleTier = this.numDecks + 1;
            const mainMast = mastLayout.find(m => m.type === 'main');

            if (mainMast) {
                // Find the cannon position just aft of the main mast.
                // We use the top deck's cannon layout as the reference.
                const topDeckCannons = cannonLayouts[this.numDecks] || [];
                const cannonsBehindMainMast = topDeckCannons
                    .filter(c => c.x < mainMast.x && c.side === 'starboard') // Use one side for simplicity
                    .sort((a, b) => b.x - a.x); // Sort descending to get the one closest to the mast

                let aftercastleEndX;

                if (cannonsBehindMainMast.length > 0) {
                    // --- New, More Precise Boundary Logic ---
                    const simulatedArtilleryPositionSize = CANNON_UNIT_SIZE * this.artilleryPositionMultiplier;
                    const mastBaseRadius = shipBeam / 16;
                    const mastAftEdge = mainMast.x - mastBaseRadius;

                    // 1. Find the forward edge of the cannon slot closest to the mast.
                    const referenceCannonX = cannonsBehindMainMast[0].x;
                    let potentialBoundaryX = referenceCannonX + (simulatedArtilleryPositionSize / 2);

                    // 2. Check if this boundary overlaps the mast.
                    if (potentialBoundaryX > mastAftEdge && cannonsBehindMainMast.length > 1) {
                        // It overlaps. Move the boundary back to the forward edge of the *next* cannon slot.
                        const nextCannonX = cannonsBehindMainMast[1].x;
                        potentialBoundaryX = nextCannonX + (simulatedArtilleryPositionSize / 2);
                    }
                    aftercastleEndX = potentialBoundaryX;
                } else {
                    // Failsafe: If no cannon is behind the mast, end the aftercastle at the mast's aft edge.
                    // FIX: Use physical dimensions for the buffer, not the dimensionless beamRatio.
                    const mastRadius = shipBeam / 16;
                    aftercastleEndX = mainMast.x - mastRadius - (CANNON_UNIT_SIZE / 2);
                }

                // --- FIX: Generate the partial tier geometry for the aftercastle, which now includes rail caps. ---
                geometry.aftercastle = HullGenerator.generatePartialTier({
                    length: totalLength,
                    width: shipBeam,
                    tierStyle: `tier${aftercastleTier}`, // e.g., 'tier2' or 'tier3'
                    // The aftercastle starts at the stern and goes to the calculated end point.
                    startX: -totalLength / 2,
                    endX: aftercastleEndX,
                    structureType: 'aftercastle' // Add type for clarity
                });

                // --- FIX: Generate Cannons for the Aftercastle ---
                const referenceCannons = cannonLayouts[this.numDecks] || [];
                const starboardReferenceCannons = referenceCannons.filter(c => c.side === 'starboard').sort((a, b) => a.x - b.x);
                const aftercastleCannonLayout = [];

                if (starboardReferenceCannons.length > 1) {
                    for (let i = 0; i < starboardReferenceCannons.length - 1; i++) {
                        const p1 = starboardReferenceCannons[i];
                        const p2 = starboardReferenceCannons[i + 1];
                        const midpointX = (p1.x + p2.x) / 2;

                        // Check if the cannon's center fits within the aftercastle's length, with a buffer for the cannon's size.
                        if (midpointX < (aftercastleEndX - CANNON_UNIT_SIZE) && midpointX > (-totalLength / 2 + CANNON_UNIT_SIZE)) {
                            const portCannon = DeckGenerator._findBulwarkPlacement(midpointX, geometry.aftercastle.bulwarkCutout.filter(p => p.y < 0).sort((a,b) => a.x - b.x), 'port');
                            const starboardCannon = DeckGenerator._findBulwarkPlacement(midpointX, geometry.aftercastle.bulwarkCutout.filter(p => p.y > 0).sort((a,b) => a.x - b.x), 'starboard');
                            if (portCannon) aftercastleCannonLayout.push(portCannon);
                            if (starboardCannon) aftercastleCannonLayout.push(starboardCannon);
                        }
                    }
                }
                // Store aftercastle cannons in their own dedicated layout.
                geometry.aftercastle.cannons = aftercastleCannonLayout;

                // --- New: Add Stern Chaser Cannons ---
                // --- FIX: Add a safety check to ensure the geometry exists before processing. ---
                if (geometry.aftercastle.bulwarkCutout && geometry.aftercastle.bulwarkCutout.length > 0) {
                    const sternEdgeX = Math.min(...geometry.aftercastle.bulwarkCutout.map(p => p.x));
                    const sternPoints = geometry.aftercastle.bulwarkCutout.filter(p => Math.abs(p.x - sternEdgeX) < 0.1);

                    if (sternPoints.length >= 2) {
                        const sternTopY = Math.max(...sternPoints.map(p => p.y));
                        const sternBottomY = Math.min(...sternPoints.map(p => p.y));
                        const sternWidth = sternTopY - sternBottomY;

                        // Place two cannons evenly spaced along the stern edge.
                        const cannon1Y = sternBottomY + sternWidth / 3;
                        const cannon2Y = sternBottomY + (2 * sternWidth) / 3;

                        geometry.aftercastle.cannons.push({
                            x: sternEdgeX, y: cannon1Y, side: 'stern', angle: Math.PI
                        });
                        geometry.aftercastle.cannons.push({
                            x: sternEdgeX, y: cannon2Y, side: 'stern', angle: Math.PI
                        });
                    }
                }
            }
        }

        // --- New: Forecastle Geometry Generation ---
        if (this.forecastleEquipped && this.numDecks <= 3) { // FIX: Allow superstructures on 3-deckers.
            const forecastleTier = this.numDecks + 1;

            // --- Boundary Calculation ---
            // Per user request: The forward edge of the forecastle is the midpoint of the ship's fore section.
            // The fore section itself starts at the end of the midsection and goes to the bow.
            const midSectionEndX = (totalLength / 2) - foreSectionLength;
            const forecastleEndX = midSectionEndX + (foreSectionLength / 2);

            // Per user request: The aft edge of the forecastle is 25% of the ship's length from the bow,
            // rounded to the nearest artillery position EDGE.
            const quarterLengthMarkX = (totalLength / 2) - (totalLength / 4);
            const simulatedArtilleryPositionSize = CANNON_UNIT_SIZE * this.artilleryPositionMultiplier;
            const topDeckCannons = cannonLayouts[this.numDecks] || [];

            let forecastleStartX = quarterLengthMarkX; // Failsafe
            let minDistance = Infinity;

            if (topDeckCannons.length > 0) {
                topDeckCannons.filter(c => c.side === 'starboard').forEach(cannon => {
                    const forwardEdge = cannon.x + (simulatedArtilleryPositionSize / 2);
                    const aftEdge = cannon.x - (simulatedArtilleryPositionSize / 2);

                    const distToForwardEdge = Math.abs(quarterLengthMarkX - forwardEdge);
                    const distToAftEdge = Math.abs(quarterLengthMarkX - aftEdge);

                    if (distToForwardEdge < minDistance) {
                        minDistance = distToForwardEdge;
                        forecastleStartX = forwardEdge;
                    }
                    if (distToAftEdge < minDistance) {
                        minDistance = distToAftEdge;
                        forecastleStartX = aftEdge;
                    }
                });
            }

            // --- FIX: Generate the partial tier geometry for the forecastle, which now includes rail caps. ---
            geometry.forecastle = HullGenerator.generatePartialTier({
                length: totalLength,
                width: shipBeam,
                tierStyle: `tier${forecastleTier}`,
                startX: forecastleStartX,
                endX: forecastleEndX,
                structureType: 'forecastle' // Add type for clarity
            });

            // --- New: Generate Cannons for the Forecastle ---
            const referenceCannons = cannonLayouts[this.numDecks] || [];
            const starboardReferenceCannons = referenceCannons.filter(c => c.side === 'starboard').sort((a, b) => a.x - b.x);
            const forecastleCannonLayout = [];
            
            if (starboardReferenceCannons.length > 1) {
                for (let i = 0; i < starboardReferenceCannons.length - 1; i++) {
                    const p1 = starboardReferenceCannons[i];
                    const p2 = starboardReferenceCannons[i + 1];
                    const midpointX = (p1.x + p2.x) / 2;
            
                    if (midpointX > (forecastleStartX + CANNON_UNIT_SIZE) && midpointX < (forecastleEndX - CANNON_UNIT_SIZE)) {
                        const portCannon = DeckGenerator._findBulwarkPlacement(midpointX, geometry.forecastle.bulwarkCutout.filter(p => p.y < 0).sort((a,b) => a.x - b.x), 'port');
                        const starboardCannon = DeckGenerator._findBulwarkPlacement(midpointX, geometry.forecastle.bulwarkCutout.filter(p => p.y > 0).sort((a,b) => a.x - b.x), 'starboard');
                        if (portCannon) forecastleCannonLayout.push(portCannon);
                        if (starboardCannon) forecastleCannonLayout.push(starboardCannon);
                    }
                }
            }
            // Store forecastle cannons in their own dedicated layout.
            geometry.forecastle.cannons = forecastleCannonLayout;

            // --- New: Add Bow Chaser Cannons ---
            // --- FIX: Add a safety check to ensure the geometry exists before processing. ---
            if (geometry.forecastle.deck && geometry.forecastle.deck.length > 0) {
                // --- FIX: Position cannons at the AFT edge of the forward rail ---
                const forwardRailThickness = geometry.forecastle.forwardRailThickness || 0;
                const cannonX = forecastleEndX - forwardRailThickness;

                // --- FIX: Use interpolation to reliably find the deck width at the cannon's position ---
                const deckDimensions = this._getDeckWidthAtX(geometry.forecastle.deck, cannonX);

                if (deckDimensions) {
                    const { bottomY, width } = deckDimensions;
                    const cannon1Y = bottomY + width / 3;
                    const cannon2Y = bottomY + (2 * width) / 3;

                    geometry.forecastle.cannons.push({ x: cannonX, y: cannon1Y, side: 'bow', angle: 0 });
                    geometry.forecastle.cannons.push({ x: cannonX, y: cannon2Y, side: 'bow', angle: 0 });
                }
            }
        }

        // --- New: Midcastle Geometry Generation ---
        if (this.midcastleEquipped && this.numDecks <= 3) {
            const midcastleTier = this.numDecks + 1;
            const topDeckCannons = cannonLayouts[this.numDecks] || [];
            const simulatedArtilleryPositionSize = CANNON_UNIT_SIZE * this.artilleryPositionMultiplier;

            // Helper function to find the nearest artillery edge to a given X coordinate
            const findNearestArtilleryEdge = (targetX) => {
                let closestEdgeX = targetX;
                let minDistance = Infinity;
                if (topDeckCannons.length > 0) {
                    topDeckCannons.filter(c => c.side === 'starboard').forEach(cannon => {
                        const forwardEdge = cannon.x + (simulatedArtilleryPositionSize / 2);
                        const aftEdge = cannon.x - (simulatedArtilleryPositionSize / 2);
                        [forwardEdge, aftEdge].forEach(edge => {
                            const dist = Math.abs(targetX - edge);
                            if (dist < minDistance) {
                                minDistance = dist;
                                closestEdgeX = edge;
                            }
                        });
                    });
                }
                return closestEdgeX;
            };

            // Step 1 & 2: Define ideal boundaries and snap them to the nearest artillery edges.
            let midcastleStartX = findNearestArtilleryEdge(-totalLength / 8);
            let midcastleEndX = findNearestArtilleryEdge(totalLength / 8);

            // Step 3 & 4: Mast Collision Check and Edge Correction
            const foreMast = mastLayout.find(m => m.type === 'fore');
            const mizzenMast = mastLayout.find(m => m.type === 'mizzen');
            const mastBuffer = this.shipWidth / 16; // A small buffer around the mast's center point

            if (foreMast && midcastleEndX > (foreMast.x - mastBuffer)) {
                // The forward edge overlaps the foremast. Push it backward.
                // Find the next available artillery edge that is clear of the mast.
                const clearTargetX = foreMast.x - mastBuffer - (simulatedArtilleryPositionSize / 2);
                midcastleEndX = findNearestArtilleryEdge(clearTargetX);
            }

            if (mizzenMast && midcastleStartX < (mizzenMast.x + mastBuffer)) {
                // The aft edge overlaps the mizzenmast. Push it forward.
                const clearTargetX = mizzenMast.x + mastBuffer + (simulatedArtilleryPositionSize / 2);
                midcastleStartX = findNearestArtilleryEdge(clearTargetX);
            }

            // Step 5: Final Generation
            // Only generate if the final boundaries result in a positive length.
            if (midcastleEndX > midcastleStartX) {
                geometry.midcastle = HullGenerator.generatePartialTier({
                    length: totalLength,
                    width: shipBeam,
                    tierStyle: `tier${midcastleTier}`,
                    startX: midcastleStartX,
                    endX: midcastleEndX,
                    structureType: 'midcastle'
                });

                // --- Generate Cannons for the Midcastle (Quincunx pattern, no chasers) ---
                const referenceCannons = cannonLayouts[this.numDecks] || [];
                const starboardReferenceCannons = referenceCannons.filter(c => c.side === 'starboard').sort((a, b) => a.x - b.x);
                const midcastleCannonLayout = [];

                if (starboardReferenceCannons.length > 1) {
                    for (let i = 0; i < starboardReferenceCannons.length - 1; i++) {
                        const p1 = starboardReferenceCannons[i];
                        const p2 = starboardReferenceCannons[i + 1];
                        const midpointX = (p1.x + p2.x) / 2;

                        // Check if the cannon's center fits within the midcastle's final boundaries.
                        if (midpointX > (midcastleStartX + CANNON_UNIT_SIZE) && midpointX < (midcastleEndX - CANNON_UNIT_SIZE)) {
                            const portCannon = DeckGenerator._findBulwarkPlacement(midpointX, geometry.midcastle.bulwarkCutout.filter(p => p.y < 0).sort((a, b) => a.x - b.x), 'port');
                            const starboardCannon = DeckGenerator._findBulwarkPlacement(midpointX, geometry.midcastle.bulwarkCutout.filter(p => p.y > 0).sort((a, b) => a.x - b.x), 'starboard');
                            if (portCannon) midcastleCannonLayout.push(portCannon);
                            if (starboardCannon) midcastleCannonLayout.push(starboardCannon);
                        }
                    }
                }
                geometry.midcastle.cannons = midcastleCannonLayout;
            }
        }

        // --- New: Spar-deck Geometry Generation ---
        if (this.sparDeckEquipped && this.numDecks <= 3) {
            const sparDeckTier = this.numDecks + 1;
            const topDeckCannons = cannonLayouts[this.numDecks] || [];
            const simulatedArtilleryPositionSize = CANNON_UNIT_SIZE * this.artilleryPositionMultiplier;

            // 1. Define Boundaries
            const sparDeckStartX = -totalLength / 2; // Starts at the stern
            const midSectionEndX = (totalLength / 2) - foreSectionLength;
            const sparDeckEndX = midSectionEndX + (foreSectionLength / 2); // Ends at mid-fore-section

            // 2. Define Gangway Cutout Boundaries
            const mainMast = mastLayout.find(m => m.type === 'main');

            // --- FIX: Add a guard clause to prevent generation if the main mast is missing. ---
            if (!mainMast) {
                console.warn("Spar-deck generation skipped: Mainmast not found for this rig type. Skipping Spar-deck generation.");
                // Do not return; just skip the rest of this 'if' block so the rest of the ship can be generated.
            } else {
                // All the original spar-deck generation logic now goes inside this 'else' block.
                const mastRadius = shipBeam / 16;
                const cutoutAftEdge = mainMast.x + (mastRadius * 2);

                // The forward edge of the cutout is the same as the Forecastle's aft edge.
                const quarterLengthMarkX = (totalLength / 2) - (totalLength / 4);
                let cutoutForwardEdge = quarterLengthMarkX;
                if (topDeckCannons.length > 0) {
                    // This helper function is defined further up in the Sterncastle logic.
                    // We need to ensure it's accessible or redefined if it's not.
                    // For now, assuming it's in scope.
                    const findNearestArtilleryEdge = (targetX, cannons) => {
                        let closestEdgeX = targetX;
                        let minDistance = Infinity;
                        if (cannons.length > 0) {
                            cannons.forEach(cannon => {
                                const forwardEdge = cannon.x + (simulatedArtilleryPositionSize / 2);
                                const aftEdge = cannon.x - (simulatedArtilleryPositionSize / 2);
                                [forwardEdge, aftEdge].forEach(edge => {
                                    const dist = Math.abs(targetX - edge);
                                    if (dist < minDistance) {
                                        minDistance = dist;
                                        closestEdgeX = edge;
                                    }
                                });
                            });
                        }
                        return closestEdgeX;
                    };
                    cutoutForwardEdge = findNearestArtilleryEdge(quarterLengthMarkX, topDeckCannons);
                }

                // --- FIX: Declare foreMast variable BEFORE it is used in the diagnostic log. ---
                const foreMast = mastLayout.find(m => m.type === 'fore');

                // --- New: Foremast Overlap Check for Gangway ---
                // This rule is applied *after* the initial forward edge is calculated.
                // If the gangway cutout overlaps the Foremast, its forward edge is moved aft of the mast.
                if (foreMast) {
                    // --- New: Use a robust polygon intersection check for overlap detection ---
                    const mastBuffer = mastRadius * 2;
                    const mastPolygon = [
                        { x: foreMast.x - mastBuffer, y: -mastBuffer },
                        { x: foreMast.x + mastBuffer, y: -mastBuffer },
                        { x: foreMast.x + mastBuffer, y: mastBuffer },
                        { x: foreMast.x - mastBuffer, y: mastBuffer },
                    ];

                    // The gangway cutout is a rectangle. Its width is half the ship's beam at that point.
                    const gangwayWidth = shipBeam * 0.5;
                    const gangwayPolygon = [
                        { x: cutoutAftEdge, y: -gangwayWidth / 2 },
                        { x: cutoutForwardEdge, y: -gangwayWidth / 2 },
                        { x: cutoutForwardEdge, y: gangwayWidth / 2 },
                        { x: cutoutAftEdge, y: gangwayWidth / 2 },
                    ];

                    // Now, check for a real collision between the two polygons.
                    if (checkPolygonCollision(mastPolygon, gangwayPolygon)) {
                        // Overlap detected! Adjust the gangway's forward edge to be behind the mast's buffered aft edge.
                        cutoutForwardEdge = foreMast.x - mastBuffer; // The forward edge is now the mast's forward edge.
                        console.log("Spar-deck gangway length adjusted to avoid Foremast overlap.");
                    }
                }

                // 3. Generate the Spar-deck with the cutout
                geometry.spardeck = HullGenerator.generatePartialTier({
                    length: totalLength,
                    width: shipBeam,
                    tierStyle: `tier${sparDeckTier}`,
                    startX: sparDeckStartX,
                    endX: sparDeckEndX,
                    structureType: 'spardeck',
                    // Pass cutout info to the generator
                    cutout: {
                        startX: cutoutAftEdge,
                        endX: cutoutForwardEdge,
                        widthRatio: 0.5 // 50% of the deck's width
                    }
                });

                // 4. Generate Cannons, avoiding the cutout area
                const sparDeckCannonLayout = [];
                // --- FIX: Generate a new, independent cannon layout for the spar-deck ---
                // This ensures it has cannons even if the deck below is a cargo deck.
                const sparDeckReferenceLayout = DeckGenerator.generate({
                    buildType: this.buildType,
                    gunsPerBattery: (this.buildType === 'guns') ? this.gunsPerBattery : this.cargoGuns,
                    baseGunCount: (this.buildType === 'guns') ? this.gunsPerBattery : this.cargoGuns,
                    bulwarkCutoutPoints: geometry.spardeck.bulwarkCutout, // Use its own bulwark
                    midSectionLength, foreSectionLength, totalLength
                });
                const starboardReferenceCannons = sparDeckReferenceLayout.filter(c => c.side === 'starboard').sort((a, b) => a.x - b.x);

                if (starboardReferenceCannons.length > 1) {
                    for (let i = 0; i < starboardReferenceCannons.length - 1; i++) {
                        const p1 = starboardReferenceCannons[i];
                        const p2 = starboardReferenceCannons[i + 1];
                        const midpointX = (p1.x + p2.x) / 2;

                        // Check if the cannon position is OUTSIDE the gangway cutout area
                        const isOutsideCutout = midpointX < cutoutAftEdge || midpointX > cutoutForwardEdge;

                        if (isOutsideCutout && midpointX > (sparDeckStartX + CANNON_UNIT_SIZE) && midpointX < (sparDeckEndX - CANNON_UNIT_SIZE)) {
                            const portCannon = DeckGenerator._findBulwarkPlacement(midpointX, geometry.spardeck.bulwarkCutout.filter(p => p.y < 0).sort((a, b) => a.x - b.x), 'port');
                            const starboardCannon = DeckGenerator._findBulwarkPlacement(midpointX, geometry.spardeck.bulwarkCutout.filter(p => p.y > 0).sort((a, b) => a.x - b.x), 'starboard');
                            if (portCannon) sparDeckCannonLayout.push(portCannon);
                            if (starboardCannon) sparDeckCannonLayout.push(starboardCannon);
                        }
                    }
                }
                geometry.spardeck.cannons = sparDeckCannonLayout;

                // 5. Add Bow Chasers (like Forecastle)
                if (geometry.spardeck.deck && geometry.spardeck.deck.length > 0) {
                    const forwardRailThickness = geometry.spardeck.forwardRailThickness || 0;
                    const cannonX = sparDeckEndX - forwardRailThickness;
                    const deckDimensions = this._getDeckWidthAtX(geometry.spardeck.deck, cannonX);
                    if (deckDimensions) {
                        const { bottomY, width } = deckDimensions;
                        geometry.spardeck.cannons.push({ x: cannonX, y: bottomY + width / 3, side: 'bow', angle: 0 });
                        geometry.spardeck.cannons.push({ x: cannonX, y: bottomY + (2 * width) / 3, side: 'bow', angle: 0 });
                    }
                }

                // 6. Add Stern Chasers (like Aftercastle)
                if (geometry.spardeck.bulwarkCutout && geometry.spardeck.bulwarkCutout.length > 0) {
                    const sternEdgeX = Math.min(...geometry.spardeck.bulwarkCutout.map(p => p.x));
                    const sternPoints = geometry.spardeck.bulwarkCutout.filter(p => Math.abs(p.x - sternEdgeX) < 0.1);
                    if (sternPoints.length >= 2) {
                        const sternTopY = Math.max(...sternPoints.map(p => p.y));
                        const sternBottomY = Math.min(...sternPoints.map(p => p.y));
                        const sternWidth = sternTopY - sternBottomY;
                        geometry.spardeck.cannons.push({
                            x: sternEdgeX, y: sternBottomY + sternWidth / 3, side: 'stern', angle: Math.PI
                        });
                        geometry.spardeck.cannons.push({
                            x: sternEdgeX, y: sternBottomY + (2 * sternWidth) / 3, side: 'stern', angle: Math.PI
                        });
                    }
                }
            }
        }

        // --- New: Unified Sterncastle Generation Logic ---
        const generateSterncastle = (isSparDeckVersion) => {
            let sterncastleTier, referenceCannons, targetGeometryProperty;
        
            // 1. Determine the context: Is this for the spar-deck or the main hull/aftercastle?
            if (isSparDeckVersion) {
                if (!this.sparDeckEquipped || !geometry.spardeck) return; // Prerequisite not met
                sterncastleTier = (this.numDecks + 1) + 1; // Tier on top of the spar-deck
                referenceCannons = geometry.spardeck.cannons || []; // Failsafe to empty array
                targetGeometryProperty = 'spardeckSterncastle';
            } else {
                if (this.aftercastleEquipped && geometry.aftercastle) {
                    sterncastleTier = this.numDecks + 2; // Tier on top of the aftercastle
                    referenceCannons = geometry.aftercastle.cannons || []; // Failsafe to empty array
                } else {
                    sterncastleTier = this.numDecks + 1;
                    referenceCannons = cannonLayouts[this.numDecks] || [];
                }
                targetGeometryProperty = 'sterncastle';
            }
        
            const simulatedArtilleryPositionSize = CANNON_UNIT_SIZE * this.artilleryPositionMultiplier;
        
            // Helper to find the nearest artillery edge.
            const findNearestArtilleryEdge = (targetX, cannons) => {
                let closestEdgeX = targetX;
                let minDistance = Infinity;
                if (cannons && cannons.length > 0) {
                    cannons.forEach(cannon => {
                        const forwardEdge = cannon.x + (simulatedArtilleryPositionSize / 2);
                        const aftEdge = cannon.x - (simulatedArtilleryPositionSize / 2);
                        [forwardEdge, aftEdge].forEach(edge => {
                            const dist = Math.abs(targetX - edge);
                            if (dist < minDistance) { minDistance = dist; closestEdgeX = edge; }
                        });
                    });
                }
                return closestEdgeX;
            };
        
            // Helper to find the next forward artillery edge.
            const findNextForwardArtilleryEdge = (currentX, cannons) => {
                let nextEdgeX = Infinity;
                if (cannons && cannons.length > 0) {
                    const allEdges = new Set();
                    cannons.forEach(cannon => {
                        allEdges.add(cannon.x + (simulatedArtilleryPositionSize / 2));
                        allEdges.add(cannon.x - (simulatedArtilleryPositionSize / 2));
                    });
                    const candidateEdges = Array.from(allEdges).filter(edge => edge > currentX);
                    if (candidateEdges.length > 0) { nextEdgeX = Math.min(...candidateEdges); }
                }
                return nextEdgeX === Infinity ? currentX : nextEdgeX;
            };
        
            // Boundary Calculation
            const sterncastleStartX = -totalLength / 2;
            let idealForwardEdge;

            // --- New Rule: The ideal forward edge is the smaller of two potential positions ---
            const positionA = -totalLength / 2 + (totalLength / 4); // Default: 25% of ship length from the stern.

            if (this.aftercastleEquipped && geometry.aftercastle) {
                const aftercastleLength = geometry.aftercastle.hull.reduce((max, p) => Math.max(max, p.x), -Infinity) - geometry.aftercastle.hull.reduce((min, p) => Math.min(min, p.x), Infinity);
                const positionB = -totalLength / 2 + (aftercastleLength / 2); // Alternative: 50% of the aftercastle's length.
                idealForwardEdge = Math.min(positionA, positionB); // Choose the shorter of the two to prevent excessive length.
            } else {
                idealForwardEdge = positionA; // Default to position A if no aftercastle is present.
            }

            // --- FIX: Only snap to broadside cannons, ignoring stern chasers ---
            // This prevents the sterncastle from collapsing to the stern if only chasers are present.
            const broadsideCannons = referenceCannons.filter(c => c.side === 'port' || c.side === 'starboard');
            let sterncastleEndX = findNearestArtilleryEdge(idealForwardEdge, broadsideCannons); // Snap the chosen ideal position
        
            // Mast Avoidance Check
            const mizzenMast = mastLayout.find(m => m.type === 'mizzen');
            if (mizzenMast) {
                const tempSterncastle = HullGenerator.generatePartialTier({
                    length: totalLength, width: shipBeam, tierStyle: `tier${sterncastleTier}`, 
                    startX: sterncastleStartX, endX: sterncastleEndX, structureType: 'sterncastle' 
                });
        
                if (tempSterncastle && tempSterncastle.forwardRail && tempSterncastle.forwardRail.length > 0) {
                    const mastRadius = shipBeam / 16;
                    const mastBasePolygon = [
                        { x: mizzenMast.x - mastRadius, y: -mastRadius }, { x: mizzenMast.x + mastRadius, y: -mastRadius },
                        { x: mizzenMast.x + mastRadius, y:  mastRadius }, { x: mizzenMast.x - mastRadius, y:  mastRadius },
                    ];
                    // If the rail collides with the mast, push the sterncastle's end forward to the next available cannon edge.
                    if (checkPolygonCollision(tempSterncastle.forwardRail, mastBasePolygon)) { 
                        sterncastleEndX = findNextForwardArtilleryEdge(sterncastleEndX, broadsideCannons); 
                    }
                }
            }
        
            // Final Generation
            if (sterncastleEndX > sterncastleStartX) {
                const sterncastleGeom = HullGenerator.generatePartialTier({
                    length: totalLength, width: shipBeam, tierStyle: `tier${sterncastleTier}`, 
                    startX: sterncastleStartX, endX: sterncastleEndX, structureType: 'sterncastle' 
                });
        
                // Generate Cannons
                const sterncastleCannonLayout = [];
                const starboardReferenceCannons = referenceCannons.filter(c => c.side === 'starboard').sort((a, b) => a.x - b.x);
        
                if (starboardReferenceCannons.length > 1) {
                    for (let i = 0; i < starboardReferenceCannons.length - 1; i++) {
                        const p1 = starboardReferenceCannons[i];
                        const p2 = starboardReferenceCannons[i + 1];
                        const midpointX = (p1.x + p2.x) / 2;
        
                        if (midpointX > (sterncastleStartX + CANNON_UNIT_SIZE) && midpointX < (sterncastleEndX - CANNON_UNIT_SIZE)) {
                            const portCannon = DeckGenerator._findBulwarkPlacement(midpointX, sterncastleGeom.bulwarkCutout.filter(p => p.y < 0).sort((a, b) => a.x - b.x), 'port');
                            const starboardCannon = DeckGenerator._findBulwarkPlacement(midpointX, sterncastleGeom.bulwarkCutout.filter(p => p.y > 0).sort((a, b) => a.x - b.x), 'starboard');
                            if (portCannon) sterncastleCannonLayout.push(portCannon);
                            if (starboardCannon) sterncastleCannonLayout.push(starboardCannon);
                        }
                    }
                }
                sterncastleGeom.cannons = sterncastleCannonLayout;
        
                // Add Stern Chasers
                if (sterncastleGeom.bulwarkCutout && sterncastleGeom.bulwarkCutout.length > 0) {
                    const sternEdgeX = Math.min(...sterncastleGeom.bulwarkCutout.map(p => p.x));
                    const sternPoints = sterncastleGeom.bulwarkCutout.filter(p => Math.abs(p.x - sternEdgeX) < 0.1);
        
                    if (sternPoints.length >= 2) {
                        const sternTopY = Math.max(...sternPoints.map(p => p.y));
                        const sternBottomY = Math.min(...sternPoints.map(p => p.y));
                        const sternWidth = sternTopY - sternBottomY;
        
                        const cannon1Y = sternBottomY + sternWidth / 3;
                        const cannon2Y = sternBottomY + (2 * sternWidth) / 3;
        
                        sterncastleGeom.cannons.push({ x: sternEdgeX, y: cannon1Y, side: 'stern', angle: Math.PI });
                        sterncastleGeom.cannons.push({ x: sternEdgeX, y: cannon2Y, side: 'stern', angle: Math.PI });
                    }
                }
        
                // Assign the final geometry to the correct property on the main geometry object.
                geometry[targetGeometryProperty] = sterncastleGeom;
            }
        };

        // --- Call the unified function based on UI selections ---
        if (this.sterncastleEquipped && this.numDecks <= 3) {
            generateSterncastle(false); // Generate the standard sterncastle
        }
        if (this.sterncastleOnSparDeckEquipped) {
            generateSterncastle(true); // Generate the spar-deck version
        }

        // --- New: Mid Deckhouse Generation ---
        if (this.midDeckhouseEquipped) {
            const highestDeckTier = Math.min(3, this.numDecks); // Highest full deck tier
            let deckWidth;

            // Determine the deck width based on the highest deck tier.
            if (highestDeckTier === 1) deckWidth = shipBeam * 0.9;
            else if (highestDeckTier === 2) deckWidth = shipBeam * 0.75;
            else deckWidth = shipBeam * 0.675;

            // Calculate dimensions for the deckhouse.
            const deckhouseLength = totalLength / 4;
            const deckhouseWidth = deckWidth / 2;

            // --- FIX: Calculate and store startX and endX for the Mid Deckhouse. ---
            const deckhouseStartX = -deckhouseLength / 2;
            const deckhouseEndX = deckhouseLength / 2;

            // Store in a new, dedicated property to avoid conflicts.
            geometry.midDeckhouse = {
                outer: { length: deckhouseLength, width: deckhouseWidth, startX: deckhouseStartX, endX: deckhouseEndX },
                inner: { length: deckhouseLength * 0.9, width: deckhouseWidth * 0.9, startX: deckhouseStartX, endX: deckhouseEndX },
                beam: { length: deckhouseLength, width: deckhouseWidth / 10, startX: deckhouseStartX, endX: deckhouseEndX }
            };

            // The outer rectangle is simply defined by its length and width.
            // The inner rectangle is 90% of the outer rectangle's dimensions.
            // The plank lines will be drawn directly in CustomShip.js.
        }

        // --- New: Fore Deckhouse Generation ---
        if (this.foreDeckhouseEquipped) {
            const highestDeckTier = Math.min(3, this.numDecks); // Highest full deck tier
            let deckWidth;

            // Determine the deck width based on the highest deck tier.
            if (highestDeckTier === 1) deckWidth = shipBeam * 0.9;
            else if (highestDeckTier === 2) deckWidth = shipBeam * 0.75;
            else deckWidth = shipBeam * 0.675;

            // Calculate dimensions for the deckhouse.
            const deckhouseLength = totalLength / 5; // 1/5 of total length
            const deckhouseWidth = deckWidth * (2 / 5);

            // Position: Starts from the forward edge of the Mid Section, going aft.
            const midSectionStartX = -totalLength / 2 + foreSectionLength;
            const midSectionEndX = midSectionStartX + midSectionLength;

            const foreDeckhouseEndX = midSectionEndX; // Forward edge of mid-section
            const foreDeckhouseStartX = foreDeckhouseEndX - deckhouseLength; // Extends aft

            // Store in a new, dedicated property.
            geometry.foreDeckhouse = {
                outer: { length: deckhouseLength, width: deckhouseWidth, startX: foreDeckhouseStartX, endX: foreDeckhouseEndX },
                inner: { length: deckhouseLength * 0.9, width: deckhouseWidth * 0.9, startX: foreDeckhouseStartX, endX: foreDeckhouseEndX },
                beam: { length: deckhouseLength, width: deckhouseWidth / 10, startX: foreDeckhouseStartX, endX: foreDeckhouseEndX }
            };
            // Note: The actual X-coordinates for drawing will be derived from startX/endX in CustomShip.js
        }

        // --- New: Aft Deckhouse Generation ---
        if (this.aftDeckhouseEquipped) {
            const highestDeckTier = Math.min(3, this.numDecks); // Highest full deck tier
            let deckWidth;

            // Determine the deck width based on the highest deck tier.
            if (highestDeckTier === 1) deckWidth = shipBeam * 0.9;
            else if (highestDeckTier === 2) deckWidth = shipBeam * 0.75;
            else deckWidth = shipBeam * 0.675;

            // Calculate dimensions for the deckhouse.
            const deckhouseLength = totalLength / 5; // 1/5 of total length
            const deckhouseWidth = deckWidth * (2 / 5);

            // Position: Starts from the aft edge of the Mid Section, going forward.
            const midSectionStartX = -totalLength / 2 + foreSectionLength;

            const aftDeckhouseStartX = midSectionStartX; // Aft edge of mid-section
            const aftDeckhouseEndX = aftDeckhouseStartX + deckhouseLength; // Extends forward

            // Store in a new, dedicated property.
            geometry.aftDeckhouse = {
                outer: { length: deckhouseLength, width: deckhouseWidth, startX: aftDeckhouseStartX, endX: aftDeckhouseEndX },
                inner: { length: deckhouseLength * 0.9, width: deckhouseWidth * 0.9, startX: aftDeckhouseStartX, endX: aftDeckhouseEndX },
                beam: { length: deckhouseLength, width: deckhouseWidth / 10, startX: aftDeckhouseStartX, endX: aftDeckhouseEndX }
            };
        }

        // --- New: Stern Cabin Generation ---
        if (this.sternCabinEquipped) {
            const sternCabinTier = this.numDecks + 1;
            const aftSectionStartX = -totalLength / 2;
            const aftSectionEndX = -totalLength / 2 + aftSectionLength; // Corrected: Use the calculated aftSectionLength

            // Generate the hull-conforming shape using the same method as castles.
            geometry.sternCabin = HullGenerator.generatePartialTier({
                length: totalLength,
                width: shipBeam,
                tierStyle: `tier${sternCabinTier}`,
                startX: aftSectionStartX,
                endX: aftSectionEndX,
                structureType: 'sternCabin' // Use a unique type
            });

            // Generate the central beam for the cabin top.
            if (geometry.sternCabin.deck) {
                const cabinWidth = this._getDeckWidthAtX(geometry.sternCabin.deck, (aftSectionStartX + aftSectionEndX) / 2)?.width || 0;
                geometry.sternCabin.beam = {
                    length: aftSectionEndX - aftSectionStartX,
                    width: cabinWidth / 10, // Same ratio as other deckhouse beams
                    startX: aftSectionStartX,
                    endX: aftSectionEndX
                };
            }
        }
        
        // --- New: Generate the Stern Cabin Forward Boundary ---
        if (this.sternCabinEquipped && geometry.sternCabin && geometry.sternCabin.bulwarkCutout && geometry.sternCabin.bulwarkCutout.length > 0) {
            const forwardBoundaryThickness = shipBeam * 0.05;
            const aftSectionEndX = -totalLength / 2 + aftSectionLength; // Corrected: Use the calculated aftSectionLength
            const forwardBoundaryFrontX = aftSectionEndX;
            const forwardBoundaryBackX = forwardBoundaryFrontX - forwardBoundaryThickness;
        
            // Find the width of the inner bulwark at the forward edge.
            const innerBulwarkWidthAtEdge = this._getDeckWidthAtX(geometry.sternCabin.bulwarkCutout, forwardBoundaryFrontX);
        
            if (innerBulwarkWidthAtEdge) {
                // Define the rectangular polygon for the boundary.
                geometry.sternCabin.forwardBoundary = [
                    { x: forwardBoundaryBackX, y: innerBulwarkWidthAtEdge.bottomY },
                    { x: forwardBoundaryFrontX, y: innerBulwarkWidthAtEdge.bottomY },
                    { x: forwardBoundaryFrontX, y: innerBulwarkWidthAtEdge.topY },
                    { x: forwardBoundaryBackX, y: innerBulwarkWidthAtEdge.topY }
                ];
            }
        }

        // --- FIX: Two-Stage Deck Object Generation ---
        // We must generate a complete, temporary rig first to get the *final* mast geometry,
        // including the correct baseRadius for each mast.
        const preliminaryBlueprint = {
            dimensions: { length: totalLength, width: shipBeam },
            layout: { masts: mastLayout, rigType: this.rigType }
        };

        // 1. Generate the temporary rig.
        const tempRig = ShipGenerator.generateSails(preliminaryBlueprint);

        // 2. Extract the final, detailed mast layout and bowsprit position from the temporary rig.
        // The `tempRig.masts` array contains the complete mast objects with correct baseRadius.
        const detailedMastLayout = tempRig.masts || mastLayout; // Failsafe to the original layout.
        const bowspritDeckStart = tempRig.bowspritDeckStart;

        // 3. Now, generate deck objects using the complete and accurate obstacle information.
        geometry.deckObjects = this._generateDeckObjects(geometry, detailedMastLayout, totalLength, shipBeam, foreSectionLength, bowspritDeckStart, this.rigType);



        const blueprint = {
            dimensions: {
                length: totalLength,
                buildType: this.buildType, // Add build type for calculations
                width: shipBeam,
                beamRatio: this.beamRatio, // Pass the ratio for reference
                // --- FIX: Pass all calculated dimensions into the blueprint ---
                midSectionLength: midSectionLength, 
                foreSectionLength: foreSectionLength, 
                aftSectionLength: aftSectionLength,
                // The "gunsPerBattery" in the blueprint should reflect what's actually on the ship.
                gunsPerBattery: (this.buildType === 'guns') ? this.gunsPerBattery : this.cargoGuns,
                artilleryPositionSize: artilleryPositionSize,
                cargoCapacity: this.cargoCapacity, // Add cargo capacity for future use
            },
            draughtFactor: this.draughtFactor,
            geometry: geometry,
            layout: {
                cannonLayouts: cannonLayouts, // Use the new per-tier structure
                masts: mastLayout,
                deckLayoutType: this.deckLayoutType, // Pass the layout type
                rigType: this.rigType, // Add the selected rig type to the blueprint
                numDecks: this.numDecks, // Add the number of decks to the blueprint
                deckTypes: this.deckTypes.slice(0, this.numDecks - 1), // Pass the relevant deck types
            },
        };

        // --- NEW: Add calculated stats to the blueprint ---
        const tempShip = new CustomShip(0, 0, blueprint, {});
        blueprint.stats = {
            cruisingSpeed: tempShip.getCrusingSpeed(),
            acceleration: parseFloat(tempShip.getAcceleration()), // Ensure it's stored as a float
            turningRadius: tempShip.getTurningRadius(),
            turningRate: tempShip.getTurningSpeed(),
            maxHp: tempShip.maxHp, // --- FIX: Use the calculated HP from the ship instance ---
            rigHp: tempShip.getRigDurability(), // Add rig durability to the blueprint
            // --- New: Exponentially Diminishing Reload Time Calculation ---
            reloadTime: (() => {
                const broadsideCount = tempShip.getBroadsideCount();
                if (broadsideCount <= 0) {
                    return 0; // No cannons, no reload time.
                }
                if (broadsideCount === 1) {
                    return 2000; // Base time for one cannon is 2 seconds.
                }
                // For n > 1, the formula is 4 - 2^-(n-2) seconds.
                // This is equivalent to 2 + 1 + 0.5 + 0.25 + ...
                const totalSeconds = 4 - Math.pow(2, -(broadsideCount - 2));

                // Convert to milliseconds for the game engine.
                return totalSeconds * 1000;
            })()
        };

        console.log("Generated Blueprint:", blueprint);

        return blueprint;
    }

    /**
     * New static method to generate final sail geometry from a blueprint.
     * This encapsulates the logic previously hidden in the CustomShip constructor,
     * allowing us to calculate stats without creating a full ship instance.
     * @param {object} blueprint - The ship blueprint containing layout info.
     * @returns {object} A rig object with a complete `sails` array.
     */
    static generateSails(blueprint) {
        // Create a lightweight, mock ship object that has the properties required by the rig constructors.
        // This avoids needing a full CustomShip instance just for stat calculation.
        const mockShip = {
            blueprint: blueprint,
            shipLength: blueprint.dimensions.length,
            shipWidth: blueprint.dimensions.width,
            // Add any other properties the rig constructors might need in the future.
        };

        const { masts, rigType } = blueprint.layout;
        let rig;

        // This logic mirrors the rig selection from the CustomShip constructor.
        if (rigType === 'square') rig = new SquareRig(mockShip, masts[0]); // Assuming square rig takes one mast config at a time
        else if (rigType === 'sloop') rig = new SloopRig(mockShip, masts.find(m => m.type === 'main'));
        else if (rigType === 'brig') rig = new BrigRig(masts, mockShip.shipLength, mockShip.shipWidth, mockShip);
        else if (rigType === 'fore-and-aft-sloop') rig = new ForeAndAftSloopRig(mockShip, masts.find(m => m.type === 'main'));
        else if (rigType === 'full-rigged') rig = new FullRiggedShipRig(mockShip, masts);
        else if (rigType === 'schooner') rig = new SchoonerRig(mockShip, masts);
        else if (rigType === 'three-mast-schooner') rig = new ThreeMastSchoonerRig(mockShip, masts);
        else if (rigType === 'brigantine') rig = new BrigantineRig(mockShip, masts);
        else if (rigType === 'barque') rig = new BarqueRig(mockShip, masts);
        else if (rigType === 'barquentine') rig = new BarquentineRig(mockShip, masts);
        else {
            // Default to a square rig if the type is unknown.
            rig = new SquareRig(mockShip, masts[0]);
        }

        // The rig constructor automatically generates the sails.
        return rig;
    }
}