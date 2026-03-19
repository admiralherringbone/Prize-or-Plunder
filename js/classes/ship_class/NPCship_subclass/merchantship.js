/**
 * Represents a "Merchant" NPC ship, which is cautious and will flee if attacked.
 */
class MerchantShip extends NpcShip {
    static nextId = 1; // Static counter for unique IDs

    /**
     * @param {number} x - The initial X position in the world.
     * @param {number} y - The initial Y position in the world.
     * @param {object} [blueprint=null] - The ship blueprint.
     * @param {object} [options={}] - Optional parameters (archetypeName, etc.).
     */
    constructor(x, y, blueprint = null, options = {}) {
        const defaultOptions = {
            primaryHullColor: '#123524', // Merchant Green
            pennantColor: '#05472A',
            reloadTime: MERCHANT_CANNON_RELOAD_TIME_MS
        };
        const finalOptions = { ...defaultOptions, ...options };

        super(x, y, blueprint, finalOptions);

        this.shipId = `MerchantShip ${MerchantShip.nextId++}`;
        
        // --- Fix: Use dynamic reload time based on ship size/guns ---
        if (this.blueprint && this.blueprint.stats && this.blueprint.stats.reloadTime) {
            this.reloadTime = this.blueprint.stats.reloadTime;
        } else {
            // Fallback for default ships or missing stats.
            this.reloadTime = MERCHANT_CANNON_RELOAD_TIME_MS; // Fallback
        }

        // --- New: Dynamic Naming (e.g., "Merchantman Full-Rigged Ship") ---
        if (this.blueprint && this.blueprint.layout && this.blueprint.layout.rigType) {
            const rigType = this.blueprint.layout.rigType;
            let formattedRig = rigType;
            
            // Map internal rig types to display names
            const rigMap = {
                'sloop': 'Sloop',
                'fore-and-aft-sloop': 'Fore-and-Aft Sloop',
                'brig': 'Brig',
                'brigantine': 'Brigantine',
                'schooner': 'Schooner',
                'full-rigged': 'Full-Rigged Ship',
                'barque': 'Barque',
                'barquentine': 'Barquentine',
                'three-mast-schooner': '3-Mast Schooner',
                'square': 'Square Rig'
            };
            if (rigMap[rigType]) formattedRig = rigMap[rigType];
            
            // Calculate Cargo Capacity
            let capacity = 0;
            if (this.blueprint.dimensions) {
                const midSectionUnits = this.blueprint.dimensions.midSectionLength / CARGO_UNIT_SIZE;
                const beamUnits = this.blueprint.dimensions.width / CARGO_UNIT_SIZE;
                capacity = Math.round(midSectionUnits * beamUnits);
            }

            this.archetypeName = `Merchant: ${capacity} unit ${formattedRig}`;
            this.shipType = this.archetypeName;
        }

        // --- New: Set Crew to Sailing Strength (Skeleton Crew) ---
        const crewReqs = this._calculateCrewRequirements();
        this.maxCrew = crewReqs.sailing;
        // Merchant ships are intentionally undercrewed for combat, prioritizing sailing efficiency.
        // This results in significantly longer reload times for their cannons.
        // If crew was not restored from options (i.e. new spawn), set to max.
        if (!options.crew) this.crew = this.maxCrew;

        // Assign the specialized combat pilot
        this.combatPilot = new MerchantCombatPilot(this);

        // --- Rank Behavior State ---
        this.hasCheckedFleeChance = false;
        this.forceFlee = false;
        this.hasCheckedSurrenderChance = false;
    }

    /**
     * Overrides AI state update to handle rank-based fleeing behavior.
     */
    updateAIState(player, distToPlayer, deltaTime, cannonballs, pathfinder, windDirection, npcs, spatialGrid) {
        const wasInCombat = this.aiState === 'combat';
        super.updateAIState(player, distToPlayer, deltaTime, cannonballs, pathfinder, windDirection, npcs, spatialGrid);

        // Known Pirate (Rank 3+) Behavior: 10% chance to surrender immediately upon engagement
        if (player.rankIndex >= 3 && !wasInCombat && this.aiState === 'combat' && !this.hasCheckedSurrenderChance) {
            this.hasCheckedSurrenderChance = true;
            
            let surrenderChance = 0;
            if (player.rankIndex >= 5) {
                surrenderChance = 0.50; // 50% for Rank 5
            } else if (player.rankIndex >= 4) {
                surrenderChance = 0.25; // 25% for Rank 4
            } else if (player.rankIndex >= 3) {
                surrenderChance = 0.10; // 10% for Rank 3
            }

            if (Math.random() < surrenderChance) {
                console.log(`[Surrender] ${this.shipId} surrendering immediately to Pirate Rank ${player.rankIndex}!`);
                this.aiState = 'surrendered';
                this.isSailOpen = false;
                this.targetShip = null;
                this._clearPath('Surrendered to pirate');
                return;
            }
        }

        // Petty Pirate (Rank 2+) Behavior: 20% chance to flee on sight
        if (player.rankIndex >= 2 && this.aiState !== 'combat' && this.aiState !== 'fleeing' && this.aiState !== 'surrendered' && this.aiState !== 'boarded') {
            const detectionRange = this.shipLength * NPC_COMBAT_RANGE_MULTIPLIER;
            
            if (distToPlayer < detectionRange) {
                if (!this.hasCheckedFleeChance) {
                    this.hasCheckedFleeChance = true;
                    
                    let fleeChance = 0;
                    if (player.rankIndex >= 5) {
                        fleeChance = 0.90; // 90% for Rank 5
                    } else if (player.rankIndex >= 4) {
                        fleeChance = 0.75; // 75% for Rank 4
                    } else if (player.rankIndex === 3) {
                        fleeChance = 0.50; // 50% for Rank 3
                    } else if (player.rankIndex === 2) {
                        fleeChance = 0.20; // 20% for Rank 2
                    }

                    if (Math.random() < fleeChance) {
                        this.forceFlee = true;
                        this.aiState = 'fleeing';
                        this.targetShip = player;
                        this._clearPath('Fleeing from pirate');
                    }
                }
            } else {
                // Reset check if player leaves range
                this.hasCheckedFleeChance = false;
            }
        }
    }

    /**
     * Overrides combat deactivation to reset rank behavior flags.
     */
    _deactivateCombat(pathfinder, windDirection) {
        super._deactivateCombat(pathfinder, windDirection);
        this.forceFlee = false;
        this.hasCheckedSurrenderChance = false;
    }
}