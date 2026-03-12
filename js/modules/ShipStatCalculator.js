/**
 * @file A static module for calculating ship statistics from a blueprint.
 * This decouples stat calculation from the CustomShip class, improving performance
 * by avoiding the need to create temporary ship instances.
 */
const ShipStatCalculator = (function() {

    // --- MODIFIED: Moved constant lookups to module scope ---
    // This prevents them from being recreated on every call to getAllStats.
    const RIG_EFFICIENCIES = { 'full-rigged': 0.90, 'brig': 0.88, 'sloop': 0.85, 'fore-and-aft-sloop': 0.83, 'barque': 0.80, 'brigantine': 0.78, 'barquentine': 0.75, 'schooner': 0.75, 'three-mast-schooner': 0.75, 'square': 0.70 };
    const RIG_TURN_CORRECTIONS = { 'full-rigged': 0.10, 'brig': 0.05, 'sloop': 0.00, 'fore-and-aft-sloop': -0.10, 'barque': 0.08, 'brigantine': 0.00, 'barquentine': 0.00, 'schooner': -0.05, 'three-mast-schooner': -0.05, 'square': 0.00 };
    const POINTS_OF_SAIL = { 
        'full-rigged': 'Running (Downwind)', 
        'brig': 'Running (Downwind)', 
        'sloop': 'Broad Reaching / Running', 
        'fore-and-aft-sloop': 'Close-Hauled / Beam Reaching', 
        'barque': 'Broad Reaching', 
        'brigantine': 'Broad Reaching', 
        'barquentine': 'Beam Reaching', 
        'schooner': 'Close-Hauled / Beam Reaching', 
        'three-mast-schooner': 'Close-Hauled / Beam Reaching', 
        'square': 'Running (Downwind)' 
    };

    /**
     * Private helper to get the form resistance multiplier based on L:B ratio deviation.
     * @param {object} blueprint - The ship's blueprint.
     * @returns {number} The form resistance multiplier.
     */
    function _getFormResistanceMultiplier(blueprint) {
        const { buildType, beamRatio, gunsPerBattery, cargoCapacity } = blueprint.dimensions;
        const { numDecks } = blueprint.layout;

        // --- REFACTOR: Use centralized design rules from config.js ---
        let sizeBasedMaxBeamRatio = SHIP_DESIGN_RULES.BEAM_RATIO_MIN;
        if (buildType === 'guns') {
            for (const rule of SHIP_DESIGN_RULES.GUN_BASED_MAX_BEAM_RATIO) {
                if (gunsPerBattery <= rule.guns) {
                    sizeBasedMaxBeamRatio = rule.max;
                    break;
                }
            }
        } else if (buildType === 'cargo') {
            for (const rule of SHIP_DESIGN_RULES.CARGO_BASED_MAX_BEAM_RATIO) {
                if (cargoCapacity <= rule.capacity) {
                    sizeBasedMaxBeamRatio = rule.max;
                    break;
                }
            }
        }

        const deckBasedMaxBeamRatio = SHIP_DESIGN_RULES.DECK_BASED_MAX_BEAM_RATIO[numDecks] || SHIP_DESIGN_RULES.BEAM_RATIO_MIN;

        const maxAllowedBeamRatio = Math.min(sizeBasedMaxBeamRatio, deckBasedMaxBeamRatio);
        const averageLBRatio = (SHIP_DESIGN_RULES.BEAM_RATIO_MIN + maxAllowedBeamRatio) / 2;
        return 1.0 - ((averageLBRatio - beamRatio) * 0.05);
    }

    /**
     * Calculates all relevant stats for a ship based on its blueprint.
     * @param {object} blueprint - The ship's blueprint object.
     * @returns {object} An object containing all calculated stats.
     */
    function getAllStats(blueprint) {
        if (!blueprint || !blueprint.dimensions || !blueprint.layout) return {};

        const stats = {};
        const { dimensions, layout } = blueprint;

        // --- Hull & Rig Durability ---
        let maxHp = 10;
        const numDecks = layout.numDecks || 1;
        const lengthU = dimensions.length / CARGO_UNIT_SIZE;
        const beamU = dimensions.width / CARGO_UNIT_SIZE;
        const draughtU = (blueprint.draughtFactor * dimensions.width) / CARGO_UNIT_SIZE;
        let calculatedHp = (lengthU + beamU + draughtU) * numDecks;
        if (blueprint.geometry) {
            const geo = blueprint.geometry;
            const structures = ['forecastle', 'aftercastle', 'midcastle', 'sterncastle', 'spardeck', 'spardeckSterncastle'];
            structures.forEach(type => {
                if (geo[type]) {
                    const points = geo[type].hull || geo[type].deck;
                    if (points && points.length > 0) {
                        const xs = points.map(p => p.x);
                        const ys = points.map(p => p.y);
                        const sLength = (Math.max(...xs) - Math.min(...xs)) / CARGO_UNIT_SIZE;
                        const sWidth = (Math.max(...ys) - Math.min(...ys)) / CARGO_UNIT_SIZE;
                        calculatedHp += (sLength + sWidth);
                    }
                }
            });
        }
        stats.maxHp = Math.round(calculatedHp);

        // --- Crew & Rig Calculation (Replicated from CustomShip) ---
        let squareSailCrewValue = 0;
        let foreAndAftCrewValue = 0;
        let totalSailDim = 0;
        const addCrewAndDimForSail = (estimatedLongestDim, type) => {
            totalSailDim += estimatedLongestDim;
            const dimInUnits = estimatedLongestDim / CARGO_UNIT_SIZE;
            if (type === 'square') squareSailCrewValue += dimInUnits / 5;
            else foreAndAftCrewValue += dimInUnits / 10;
        };
        switch (layout.rigType) {
            case 'sloop': case 'fore-and-aft-sloop':
                addCrewAndDimForSail(dimensions.length * 0.6, 'fore-and-aft'); addCrewAndDimForSail(dimensions.length * 0.5, 'fore-and-aft'); break;
            case 'schooner':
                addCrewAndDimForSail(dimensions.length * 0.5, 'fore-and-aft'); addCrewAndDimForSail(dimensions.length * 0.45, 'fore-and-aft'); addCrewAndDimForSail(dimensions.length * 0.4, 'fore-and-aft'); break;
            case 'square':
                addCrewAndDimForSail(dimensions.width * 1.8, 'square'); addCrewAndDimForSail(dimensions.width * 1.4, 'square'); break;
            case 'brig': case 'brigantine':
                addCrewAndDimForSail(dimensions.width * 1.8, 'square'); addCrewAndDimForSail(dimensions.width * 1.5, 'square'); addCrewAndDimForSail(dimensions.width * 1.6, 'square'); addCrewAndDimForSail(dimensions.width * 1.3, 'square'); addCrewAndDimForSail(dimensions.length * 0.3, 'fore-and-aft'); break;
            case 'full-rigged': case 'barque': case 'barquentine': case 'three-mast-schooner':
                addCrewAndDimForSail(dimensions.width * 1.8, 'square'); addCrewAndDimForSail(dimensions.width * 1.5, 'square'); addCrewAndDimForSail(dimensions.width * 1.6, 'square'); addCrewAndDimForSail(dimensions.width * 1.3, 'square'); addCrewAndDimForSail(dimensions.width * 1.4, 'square'); addCrewAndDimForSail(dimensions.length * 0.3, 'fore-and-aft'); addCrewAndDimForSail(dimensions.length * 0.3, 'fore-and-aft'); break;
        }
        stats.maxRigHp = Math.round((totalSailDim / CARGO_UNIT_SIZE) / 2);
        stats.minSailingCrew = Math.max(1, Math.floor(squareSailCrewValue + foreAndAftCrewValue));

        // --- Burthen & Capacity ---
        const draughtPx = blueprint.draughtFactor * dimensions.width;
        const midsectionVolume = (Math.PI * (dimensions.width / 2) * draughtPx * dimensions.midSectionLength) / 2;
        const taperedSectionsVolume = (Math.PI * (dimensions.width / 2) * draughtPx * (dimensions.foreSectionLength + dimensions.aftSectionLength)) / 4;
        stats.burthenHold = Math.round((midsectionVolume + taperedSectionsVolume) / (CARGO_UNIT_SIZE ** 3));

        let superstructureBurthen = 0;
        const calculateStructureBurthen = (structure) => {
            if (!structure) return 0;
            let area = 0;
            if (structure.deck && Array.isArray(structure.deck)) area = Math.abs(getPolygonArea(structure.deck));
            else if (structure.outer && structure.outer.length && structure.outer.width) area = structure.outer.length * structure.outer.width;
            return area / (CARGO_UNIT_SIZE * CARGO_UNIT_SIZE);
        };
        const geo = blueprint.geometry;
        if (geo) {
            ['forecastle', 'aftercastle', 'midcastle', 'sterncastle', 'spardeck', 'spardeckSterncastle', 'foreDeckhouse', 'midDeckhouse', 'aftDeckhouse', 'sternCabin'].forEach(part => {
                superstructureBurthen += calculateStructureBurthen(geo[part]);
            });
        }
        stats.totalBurthen = Math.round(stats.burthenHold + superstructureBurthen);

        // --- Combat ---
        let broadsideGuns = 0;
        const countSideGuns = (cannonLayout) => cannonLayout ? cannonLayout.filter(c => c.side === 'starboard' && !c.destroyed).length : 0;
        if (layout.cannonLayouts) Object.values(layout.cannonLayouts).forEach(l => broadsideGuns += countSideGuns(l));
        if (geo) ['aftercastle', 'forecastle', 'midcastle', 'sterncastle', 'spardeck', 'spardeckSterncastle'].forEach(p => broadsideGuns += countSideGuns(geo[p]?.cannons));
        stats.broadside = broadsideGuns;
        stats.minFightingCrew = stats.minSailingCrew + (stats.broadside * 5);

        // --- NEW: Dynamic Reload Time Calculation (restored from ShipGenerator) ---
        if (stats.broadside <= 0) {
            stats.reloadTime = 0;
        } else if (stats.broadside === 1) {
            stats.reloadTime = 2000; // Base time for one cannon is 2 seconds.
        } else {
            // For n > 1, the formula is 4 - 2^-(n-2) seconds.
            const totalSeconds = 4 - Math.pow(2, -(stats.broadside - 2));
            stats.reloadTime = totalSeconds * 1000;
        }

        // --- Performance ---
        const hullSpeedLimit = 0.767 * Math.sqrt(dimensions.length);
        const rigEfficiencyFactor = RIG_EFFICIENCIES[layout.rigType] || 0.70;
        const stabilityMultiplier = 1.0 - Math.max(0, (0.5 - blueprint.draughtFactor) * 1.5);
        const formResistanceMultiplier = _getFormResistanceMultiplier(blueprint);
        const cruisingSpeedInKnots = hullSpeedLimit * rigEfficiencyFactor * stabilityMultiplier * formResistanceMultiplier;
        stats.cruisingSpeed = Math.ceil(cruisingSpeedInKnots * (KNOTS_TO_GAME_UNITS_PER_SECOND / CRUISING_SPEED_BALANCE_FACTOR) * CRUISING_SPEED_MULTIPLIER);

        const momentumMultiplier = 1.0 + (blueprint.draughtFactor * 0.2);
        const timeConstant = ACCELERATION_BASE_TIME_SECONDS * momentumMultiplier;
        stats.acceleration = stats.cruisingSpeed / timeConstant;

        const baselineTRM = 1.5 + (dimensions.beamRatio * 0.5);
        const draftCorrection = (blueprint.draughtFactor - 0.4) * 1.0;
        const rigCorrection = RIG_TURN_CORRECTIONS[layout.rigType] || 0.00;
        stats.turningRadius = baselineTRM + draftCorrection + rigCorrection;

        const turningRadiusInUnits = stats.turningRadius * dimensions.length;
        stats.turningRate = turningRadiusInUnits > 0 ? (stats.cruisingSpeed * 57.2958) / turningRadiusInUnits : 0;

        stats.bestPointOfSail = POINTS_OF_SAIL[layout.rigType] || 'Unknown';

        return stats;
    }

    return {
        getAllStats: getAllStats
    };
})();

window.ShipStatCalculator = ShipStatCalculator;