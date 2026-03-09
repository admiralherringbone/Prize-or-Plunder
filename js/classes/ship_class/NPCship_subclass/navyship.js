/**
 * Represents a "Navy" NPC ship, which is aggressive and will pursue the player.
 * It will flee only when its health is critically low.
 */
class NavyShip extends NpcShip {
    static nextId = 1; // Static counter for unique IDs

    /**
     * @param {number} x - The initial X position in the world.
     * @param {number} y - The initial Y position in the world.
     * @param {object} [blueprint=null] - The ship blueprint.
     * @param {object} [options={}] - Optional parameters (archetypeName, etc.).
     */
    constructor(x, y, blueprint = null, options = {}) {
        const defaultOptions = {
            primaryHullColor: 'hsl(4, 59%, 48%)', // Navy Red
            pennantColor: '#000080',
            reloadTime: NAVY_CANNON_RELOAD_TIME_MS
        };
        const finalOptions = { ...defaultOptions, ...options };

        super(x, y, blueprint, finalOptions);

        this.shipId = `NavyShip ${NavyShip.nextId++}`;
        
        // --- Fix: Use dynamic reload time based on ship size/guns ---
        if (this.blueprint && this.blueprint.stats && this.blueprint.stats.reloadTime) {
            this.reloadTime = this.blueprint.stats.reloadTime;
        } else {
            // Fallback for default ships or missing stats.
            this.reloadTime = NAVY_CANNON_RELOAD_TIME_MS; // Fallback
        }

        // --- New: Dynamic Naming (e.g., "24 gun Frigate") ---
        if (this.blueprint) {
            let totalGuns = 0;
            // Count deck guns
            if (this.blueprint.layout && this.blueprint.layout.cannonLayouts) {
                Object.values(this.blueprint.layout.cannonLayouts).forEach(layout => totalGuns += layout.length);
            }
            // Count superstructure guns
            if (this.blueprint.geometry) {
                const parts = ['forecastle', 'midcastle', 'aftercastle', 'sterncastle', 'spardeck', 'spardeckSterncastle'];
                parts.forEach(part => {
                    if (this.blueprint.geometry[part] && this.blueprint.geometry[part].cannons) {
                        totalGuns += this.blueprint.geometry[part].cannons.length;
                    }
                });
            }

            let rigName = this.blueprint.layout.rigType || 'Unknown';
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
            if (rigMap[rigName]) rigName = rigMap[rigName];

            this.archetypeName = `Navy: ${totalGuns} gun ${rigName}`;
            this.shipType = this.archetypeName;
        }

        // --- New: Set Crew to Fighting Strength ---
        const crewReqs = this._calculateCrewRequirements();
        this.maxCrew = crewReqs.fighting;
        // If crew was not restored from options (i.e. new spawn), set to max.
        // If it was restored, NpcShip constructor handled it, but we clamp it to the new max just in case.
        if (!options.crew) this.crew = this.maxCrew;

        // This ship class uses the specialized Navy combat behavior.
        this.combatPilot = new NavyCombatPilot(this);

        // Timer for proximity-based activation.
        this.proximityActivationTimer = 0;
        this.distressCheckTimer = 0; // --- OPTIMIZATION: Timer for distress calls ---

        // --- Pirate Hunter State ---
        this.isPirateHunter = options.isPirateHunter || false;
        this.isSquadronHunter = options.isSquadronHunter || false;
        this.isFleetHunter = options.isFleetHunter || false;
        this.huntTimer = 0;
        this.formationLeader = options.formationLeader || null;
        this.formationIndex = options.formationIndex || 0;
    }

    /**
     * Overrides the base sensor update to filter out formation members for followers.
     * This prevents followers from trying to avoid the very ships they are following.
     */
    _updateSensors(pathfinder, npcs, player, spatialGrid) {
        // Call the parent method to get all whisker hits
        super._updateSensors(pathfinder, npcs, player, spatialGrid);

        // If we are in formation, filter out hits from our own squadron/fleet
        const isFollower = (this.isSquadronHunter || this.isFleetHunter) && this.formationLeader;
        if (isFollower) {
            const getFlagship = (s) => {
                if (!s || !s.formationLeader) return s;
                let leader = s;
                // Max 10 iterations to prevent infinite loops
                for (let i = 0; i < 10 && leader.formationLeader; i++) {
                    leader = leader.formationLeader;
                }
                return leader;
            };
            const myFlagship = getFlagship(this);

            for (const whiskerName in this.whiskerHits) {
                const hit = this.whiskerHits[whiskerName];
                // Check if the hit is a ship and part of a pirate hunter formation
                if (hit && hit.type === 'ship' && hit.ship && (hit.ship.isSquadronHunter || hit.ship.isFleetHunter)) {
                    const otherFlagship = getFlagship(hit.ship);
                    if (myFlagship === otherFlagship) {
                        // This is a hit from a formation member. Ignore it.
                        delete this.whiskerHits[whiskerName];
                    }
                }
            }
        }
    }

    /**
     * Defines the specific state transition logic for a Navy ship.
     * It becomes hostile if the player gets too close, in addition to being attacked.
     * @param {PlayerShip} player - The player ship instance.
     * @param {number} distToPlayer - The current distance to the player.
     */
    updateAIState(player, distToPlayer, deltaTime, cannonballs, pathfinder, windDirection, npcs, spatialGrid) {
        // Navy ships have a more aggressive activation trigger.
        
        // If hunting, check if we are close enough to engage
        if (this.isPirateHunter && this.aiState === 'hunting' && distToPlayer < this.shipLength * NPC_COMBAT_RANGE_MULTIPLIER) {
            // Transition handled in _runPilotBehaviors, but we can enforce it here too or let proximity trigger it.
        }

        // It will call the base class logic first, then add its own.
        super.updateAIState(player, distToPlayer, deltaTime, cannonballs, pathfinder, windDirection, npcs, spatialGrid);

        // --- Proximity Activation Logic ---
        // A Navy ship becomes hostile if the player gets too close, even without being attacked.
        // Only applies if the player is a Suspected Pirate (Rank 1) or higher.
        let hasProximityTriggered = false;

        if (player.rankIndex >= 1) {
            let activationRadius = this.shipLength * NAVY_ACTIVATION_PROXIMITY_MULTIPLIER;
            
            // Rank 2 (Petty Pirate) and above: Increased detection range
            if (player.rankIndex >= 2) {
                activationRadius = this.shipLength * NPC_COMBAT_RANGE_MULTIPLIER;
            }

            const isPlayerTooClose = distToPlayer < activationRadius;

            if (isPlayerTooClose) {
                this.proximityActivationTimer += deltaTime;
            } else {
                this.proximityActivationTimer = 0; // Reset timer if player moves away
            }
            // The proximity trigger is now time-based.
            hasProximityTriggered = this.proximityActivationTimer >= 3000; // 3 seconds
        } else {
            this.proximityActivationTimer = 0; // Reset timer if player moves away
        }

        // --- New: Respond to Allied Distress Call ---
        // --- OPTIMIZATION: Throttle and use Spatial Grid ---
        let allyInDistress = null;
        this.distressCheckTimer -= deltaTime;

        if (this.distressCheckTimer <= 0) {
            this.distressCheckTimer = 1000 + Math.random() * 500; // Check every ~1-1.5 seconds
            
            const range = this.shipLength * NPC_COMBAT_RANGE_MULTIPLIER;
            
            if (spatialGrid) {
                const queryAABB = {
                    minX: this.x - range, minY: this.y - range,
                    maxX: this.x + range, maxY: this.y + range
                };
                const neighbors = spatialGrid.query(queryAABB);
                
                for (const otherNpc of neighbors) {
                    if (otherNpc === this || !(otherNpc instanceof NpcShip)) continue;
                    
                    // Check for other Merchants OR other Navy ships in combat with the player.
                    const isAlly = otherNpc instanceof MerchantShip || otherNpc instanceof NavyShip;
                    // Check if ally is in combat OR if ally has been attacked (for followers who don't enter combat state)
                    if (isAlly && ((otherNpc.aiState === 'combat' || otherNpc.aiState === 'fleeing') && otherNpc.targetShip === player || otherNpc.hasBeenAttackedByPlayer)) {
                        // We found an ally in trouble within the grid sector.
                        // Precise distance check is implicit by grid query being close enough, 
                        // but we can be strict if needed.
                        allyInDistress = otherNpc;
                        break;
                    }
                }
            } else if (npcs) {
                // Fallback if grid is missing (should not happen)
                for (const otherNpc of npcs) {
                    const isAlly = otherNpc instanceof MerchantShip || otherNpc instanceof NavyShip;
                    if (isAlly && otherNpc !== this && ((otherNpc.aiState === 'combat' || otherNpc.aiState === 'fleeing') && otherNpc.targetShip === player || otherNpc.hasBeenAttackedByPlayer)) {
                        if (distance(this, otherNpc) < range) {
                            allyInDistress = otherNpc;
                            break;
                        }
                    }
                }
            }
        }

        // The base class's updateAIState handles provocation from being attacked.
        // We combine that with our proximity check.
        const isProvoked = this.hasBeenAttackedByPlayer || hasProximityTriggered || !!allyInDistress;

        // If provoked (by attack OR proximity) and not already in combat, switch to combat state.
        if (isProvoked && this.aiState !== 'combat' && this.aiState !== 'fleeing' && this.aiState !== 'surrendered' && this.aiState !== 'boarded') {
            // --- REFINED COMBAT BEHAVIOR ---
            // If this is a follower in a squadron/fleet, do NOT switch to independent combat.
            // Remain in formation. The leader will handle the pursuit.
            const isFollower = (this.isSquadronHunter || this.isFleetHunter) && this.formationLeader && !this.formationLeader.isSunk && this.formationLeader.hp > 0;

            if (!isFollower) {
                this.aiState = 'combat';
                this.targetShip = player;
                this.pausedPathfindingDestination = this.destinationIsland;
                this.destinationIsland = null;
                this._clearPath('Entering combat due to provocation'); // Explicitly clear the navigation path
                this.predictiveTurnTimer = Math.random() * 200;
            }
        }
    }

    /**
     * Overrides the pilot behavior to handle the specific 'hunting' state.
     */
    _runPilotBehaviors(deltaTime, islands, windDirection, player, cannonballs, volleys, npcs, pathfinder, spatialGrid) {
        // --- FIX: Ensure sensors update in all states (including formation/hunting) ---
        this.sensorUpdateTimer -= deltaTime;
        if (this.sensorUpdateTimer <= 0) {
            if (spatialGrid) this._scanSurroundings(spatialGrid);
            this._updateSensors(pathfinder, npcs, player, spatialGrid);
            this.sensorUpdateTimer = 100 + Math.random() * 50;
        }

        if (this.aiState === 'hunting') {
            this.debugStatus = 'Hunting Player';
            
            // 1. Periodically update path to the moving player
            this.huntTimer -= deltaTime;
            if (this.huntTimer <= 0) {
                this.huntTimer = 5000; // Update path every 5 seconds
                // Create a target object for the pathfinder
                const targetDest = { x: player.x, y: player.y, proximityRadius: 0, type: 'target' };
                this.setNewDestination(targetDest, pathfinder, windDirection);
            }

            // 2. Check for Combat Transition
            const dist = distance(this, player);
            const combatRange = this.shipLength * NPC_COMBAT_RANGE_MULTIPLIER;
            
            if (dist < combatRange) {
                this.aiState = 'combat';
                this.targetShip = player;
                this._clearPath('Engaging player from hunt');
                return;
            }

            // 3. Execute Navigation
            this._updatePathProgress(pathfinder, windDirection);
            this._applyVectorSteering(pathfinder, windDirection, 'Hunting');
            return;
        }

        if (this.aiState === 'formation') {
            this.debugStatus = 'In Formation';
            
            // Check if leader is valid (Alive and not sunk)
            if (!this.formationLeader || this.formationLeader.isSunk || this.formationLeader.hp <= 0) {
                // Attempt to repair the chain or promote self
                const grandLeader = this.formationLeader ? this.formationLeader.formationLeader : null;
                
                // Check if the grandparent is a valid target to follow
                if (grandLeader && !grandLeader.isSunk && grandLeader.hp > 0) {
                    // Repair the chain: Follow the grandparent (e.g., S2 follows F if S1 dies)
                    console.log(`[${this.shipId}] Leader lost. Reforming behind ${grandLeader.shipId}.`);
                    this.formationLeader = grandLeader;
                    // formationIndex remains 1 (daisy chain spacing)
                } else {
                    // No valid grandparent. I am the new head of this chain.
                    // Promote to Flagship/Hunter.
                    this.aiState = 'hunting';
                    this.formationLeader = null;
                    
                    // Update Display Name to reflect promotion
                    if (this.displayName.includes("Squadron Ship")) {
                        this.displayName = this.displayName.replace("Squadron Ship", "Squadron Flagship");
                        console.log(`[${this.shipId}] Promoted to Squadron Flagship.`);
                    } else if (this.displayName.includes("Fleet Ship")) {
                        this.displayName = this.displayName.replace("Fleet Ship", "Fleet Flagship");
                        console.log(`[${this.shipId}] Promoted to Fleet Flagship.`);
                    }
                }
                return;
            }

            // Calculate Formation Target (Line Astern)
            // Position is directly behind the leader based on index
            const spacing = this.shipLength * 2; // 2 ship lengths gap
            const distBehind = spacing; // formationIndex is now always 1, so this is just the spacing.
            
            // Project backwards from leader's current position and angle
            const leaderAngle = this.formationLeader.angle;
            const targetX = this.formationLeader.x - Math.cos(leaderAngle) * distBehind;
            const targetY = this.formationLeader.y - Math.sin(leaderAngle) * distBehind;

            // Create a temporary path to the formation slot
            // --- OPTIMIZATION: Reuse existing array/object to reduce GC ---
            if (this.pathWaypoints.length === 1) {
                this.pathWaypoints[0].x = targetX;
                this.pathWaypoints[0].y = targetY;
            } else {
                this.pathWaypoints = [{x: targetX, y: targetY}];
            }
            this.currentWaypointIndex = 0;

            // Throttle logic for station keeping
            // Use proportional control to match speed smoothly
            const dist = Math.sqrt((this.x - targetX)**2 + (this.y - targetY)**2);
            // If within 0.5L, slow drastically. If within 2L, scale speed.
            if (dist < this.shipLength * 0.5) {
                this.throttle = 0.1; // Almost stop to maintain station
            } else if (dist < this.shipLength * 2) {
                this.throttle = dist / (this.shipLength * 2); // Ramp up 0.25 -> 1.0
            } else {
                this.throttle = 1.0; // Catch up
            }

            this._applyVectorSteering(pathfinder, windDirection, 'Formation');

            // --- NEW: Opportunistic Firing for Formation Ships ---
            // If the player is within range, attempt to fire broadsides while maintaining formation.
            if (player && !player.isSunk) {
                const dist = distance(this, player);
                if (dist < this.shipLength * NPC_COMBAT_RANGE_MULTIPLIER) {
                    const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
                    let angleDiff = normalizeAngle(angleToPlayer - this.angle);
                    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI; // --- FIX: Normalize to -PI..PI for correct side check ---
                    
                    // Check firing arcs (+/- 30 degrees from beam)
                    // Starboard Beam: PI/2 (1.57)
                    if (Math.abs(angleDiff - Math.PI/2) < Math.PI/6) {
                        this.fire('starboard', cannonballs, volleys);
                    }
                    // Port Beam: -PI/2 (-1.57)
                    else if (Math.abs(angleDiff + Math.PI/2) < Math.PI/6) {
                        this.fire('port', cannonballs, volleys);
                    }
                }
            }
            return;
        }

        super._runPilotBehaviors(deltaTime, islands, windDirection, player, cannonballs, volleys, npcs, pathfinder, spatialGrid);
    }

    /**
     * Overrides combat deactivation to return to formation or hunting state.
     */
    _deactivateCombat(pathfinder, windDirection) {
        super._deactivateCombat(pathfinder, windDirection);

        // If this is a squadron follower
        const isFormationMember = this.isSquadronHunter || this.isFleetHunter;
        
        if (isFormationMember) {
            // 1. Check if immediate leader is valid
            if (this.formationLeader && !this.formationLeader.isSunk && this.formationLeader.hp > 0) {
                this.aiState = 'formation';
                this.targetShip = null;
                this._clearPath('Returning to formation');
                return;
            }
            
            // 2. Immediate leader is dead/gone. Try to repair chain (Find Grandparent).
            const grandLeader = this.formationLeader ? this.formationLeader.formationLeader : null;
            if (grandLeader && !grandLeader.isSunk && grandLeader.hp > 0) {
                console.log(`[${this.shipId}] Leader lost in combat. Reforming behind ${grandLeader.shipId}.`);
                this.formationLeader = grandLeader;
                this.aiState = 'formation';
                this.targetShip = null;
                this._clearPath('Reforming with grandparent');
                return;
            }
        }

        // 3. No valid leader found (or was leader). Promote to Independent Hunter.
        if (this.isPirateHunter) {
            this.aiState = 'hunting';
            this.targetShip = null;
            this.formationLeader = null; // Clear dead leader ref
            
            // Update Display Name if promoted
            if (this.displayName.includes("Squadron Ship")) {
                this.displayName = this.displayName.replace("Squadron Ship", "Squadron Flagship");
                console.log(`[${this.shipId}] Promoted to Squadron Flagship (Post-Combat).`);
            } else if (this.displayName.includes("Fleet Ship")) {
                this.displayName = this.displayName.replace("Fleet Ship", "Fleet Flagship");
                console.log(`[${this.shipId}] Promoted to Fleet Flagship (Post-Combat).`);
            }
            
            this._clearPath('Resuming hunt as leader');
        }
    }

    /**
     * Overrides the base debug overlay to add Navy-specific visualizations.
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} worldToScreenScale 
     */
    drawDebugOverlay(ctx, worldToScreenScale) {
        super.drawDebugOverlay(ctx, worldToScreenScale);

        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && (this.aiState === 'combat' || this.aiState === 'fleeing')) {
            // Draw the Dogfight/Chase Transition Ring (6 Ship Lengths)
            ctx.save();
            ctx.translate(this.x, this.y);
            
            const transitionDist = this.shipLength * 6;
            
            ctx.beginPath();
            ctx.arc(0, 0, transitionDist, 0, Math.PI * 2);
            // Orange dashed line to represent the phase transition boundary
            ctx.strokeStyle = 'rgba(255, 165, 0, 0.6)'; 
            ctx.lineWidth = 2 / worldToScreenScale;
            ctx.setLineDash([15 / worldToScreenScale, 15 / worldToScreenScale]);
            ctx.stroke();
            
            // Label
            ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
            ctx.font = `${10 / worldToScreenScale}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText("PHASE BOUNDARY (6L)", 0, -transitionDist - (5 / worldToScreenScale));

            ctx.restore();
        }
    }
}
