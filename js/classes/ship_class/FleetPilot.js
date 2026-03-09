/**
 * The AI driver for AlliedShip instances.
 * Responsible for steering the ship to maintain formation with the flagship
 * and handling basic state transitions.
 */
class FleetPilot {
    constructor(ship) {
        this.ship = ship;
        this.state = 'formation'; // 'formation', 'combat'
        this.target = null;
        this.scanTimer = 0; // --- OPTIMIZATION: Throttle target scanning ---
    }

    /**
     * Updates the high-level state of the pilot.
     * @param {PlayerShip} player 
     * @param {number} distToPlayer 
     * @param {number} deltaTime 
     * @param {Array} cannonballs 
     * @param {Array} npcs 
     * @param {SpatialGrid} spatialGrid 
     */
    updateState(player, distToPlayer, deltaTime, cannonballs, npcs, spatialGrid) {
        // 1. Check for threats (Combat Trigger)
        // Logic: Only engage if the player is engaged (attacking or being attacked).
        
        let bestTarget = null;
        let closestDistSq = Infinity;

        // Hysteresis: Keep target longer if already engaged
        const exitCombatRange = this.ship.shipLength * 30; 
        const exitCombatRangeSq = exitCombatRange * exitCombatRange;

        // Check if current target is still valid
        if (this.target) {
            if (this.target.isSunk || this.target.hp <= 0) {
                this.target = null;
            } else {
                // Check if still relevant (fighting player)
                const isFightingPlayer = (this.target.targetShip === player) || (this.target.hasBeenAttackedByPlayer);
                const distSq = (this.target.x - this.ship.x)**2 + (this.target.y - this.ship.y)**2;
                
                if (isFightingPlayer && distSq < exitCombatRangeSq) {
                    bestTarget = this.target;
                    closestDistSq = distSq;
                }
            }
        }

        // --- OPTIMIZATION: Throttle Scanning ---
        this.scanTimer -= deltaTime;
        
        // If no valid target yet, scan for new ones (throttled)
        if (!bestTarget && this.scanTimer <= 0) {
            this.scanTimer = 500 + Math.random() * 200; // Scan approx every 0.5s

            // --- OPTIMIZATION: Use Spatial Grid if available ---
            let potentialTargets = npcs;
            if (spatialGrid) {
                const scanRange = this.ship.shipLength * 30;
                const aabb = {
                    minX: this.ship.x - scanRange, minY: this.ship.y - scanRange,
                    maxX: this.ship.x + scanRange, maxY: this.ship.y + scanRange
                };
                potentialTargets = spatialGrid.query(aabb);
            }

            for (const npc of potentialTargets) {
                // Ignore self, player, and other allies
                if (!(npc instanceof Ship)) continue; // Filter out islands/rocks from grid query
                if (npc === this.ship || npc === player || npc.isAllied) continue;
                if (npc.isSunk || npc.hp <= 0) continue;
                
                // Condition: Player is in combat with this ship
                // 1. NPC is targeting Player
                // 2. Player has attacked NPC
                const isFightingPlayer = (npc.targetShip === player) || (npc.hasBeenAttackedByPlayer);
                
                if (isFightingPlayer) {
                    const distSq = (npc.x - this.ship.x)**2 + (npc.y - this.ship.y)**2;
                    if (distSq < closestDistSq) {
                        closestDistSq = distSq;
                        bestTarget = npc;
                    }
                }
            }
        }

        if (bestTarget) {
            this.state = 'combat';
            this.target = bestTarget;
            // Point the ship's main combat AI to this target so it knows what to shoot at
            this.ship.targetShip = bestTarget; 
        } else {
            this.state = 'formation';
            this.target = null;
            this.ship.targetShip = null;
        }
    }

    /**
     * Calculates steering and throttle to maintain formation.
     * @param {number} deltaTime 
     * @param {number} windDirection 
     * @param {Pathfinder} pathfinder 
     * @param {Array} npcs 
     * @param {Array} cannonballs 
     * @param {Array} volleys 
     * @param {SpatialGrid} spatialGrid 
     */
    update(deltaTime, windDirection, pathfinder, npcs, cannonballs, volleys, spatialGrid) {
        // --- NEW: Respect Stuck Recovery ---
        // If the ship is reversing to get unstuck, do not override its controls.
        if (this.ship.isMovingBackward) return;

        // --- COMBAT BEHAVIOR ---
        // Combat should work even if not part of a fleet structure (robustness)
        if (this.state === 'combat' && this.target) {
            // In combat, we delegate to the ship's built-in CombatPilot (inherited from NpcShip).
            // This allows the ally to use the same smart strafing/broadside logic as enemies.
            
            // We temporarily override the combat pilot's mode to ensure it doesn't try to flee
            // unless critically damaged.
            this.ship.combatPilot.combatMode = 'pursuing'; 
            
            // Run the standard combat AI
            this.ship.combatPilot.runCombatAI(deltaTime, windDirection, pathfinder, cannonballs, volleys, npcs, spatialGrid);
            
            // Update debug status
            this.ship.debugStatus = `Engaging ${this.target.shipId}`;
            return;
        }

        // --- FORMATION BEHAVIOR ---
        // Requires a fleet manager to know where to go
        if (!this.ship.fleetManager) return;

        // 1. Get Target Position from FleetManager
        const targetPos = this.ship.fleetManager.getFormationPosition(this.ship.fleetIndex);
        
        if (targetPos) {
            // 2. Calculate Vector to Target
            const dx = targetPos.x - this.ship.x;
            const dy = targetPos.y - this.ship.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const angleToTarget = Math.atan2(dy, dx);

            // 3. Throttle Logic (Station Keeping)
            // "maintaining a distance of at least 1 ship length"
            // "when within one ship length... close its sails"
            
            const stopThreshold = this.ship.shipLength * 1.0;
            const slowThreshold = this.ship.shipLength * 3.0;

            if (dist < stopThreshold) {
                // We are in position. Stop.
                this.ship.throttle = 0;
                this.ship.isSailOpen = false;
            } else {
                this.ship.isSailOpen = true;
                if (dist < slowThreshold) {
                    // Slow down as we approach (Linear interpolation)
                    this.ship.throttle = (dist - stopThreshold) / (slowThreshold - stopThreshold);
                    // Ensure minimum throttle to actually move if sails are open
                    this.ship.throttle = Math.max(0.2, this.ship.throttle);
                } else {
                    this.ship.throttle = 1.0;
                }
            }

            // 4. Steering Logic
            // Use NpcShip's avoidance logic to blend formation seeking with obstacle avoidance.
            
            // Base steering is towards the formation slot
            let steerAngle = angleToTarget;

            // Apply wind constraints (Tacking)
            if (this.ship._findBestSailingAngle) {
                steerAngle = this.ship._findBestSailingAngle(steerAngle, windDirection);
            }

            // Apply Obstacle Avoidance
            // We use the NpcShip's existing _getAvoidanceVector method which handles whiskers/sensors.
            if (this.ship._getAvoidanceVector) {
                const avoidVec = this.ship._getAvoidanceVector(windDirection, pathfinder);
                
                if (avoidVec.magnitude > 0) {
                    // If avoiding, override throttle to ensure maneuverability
                    if (this.ship.throttle < 0.5) this.ship.throttle = 0.5;
                    this.ship.isSailOpen = true;

                    // Blend vectors
                    // Seek weight is 1.0
                    // Avoid weight scales with magnitude (urgency)
                    const avoidWeight = avoidVec.magnitude * 5.0; 
                    
                    const seekX = Math.cos(steerAngle);
                    const seekY = Math.sin(steerAngle);
                    
                    const finalX = seekX + avoidVec.x * avoidWeight;
                    const finalY = seekY + avoidVec.y * avoidWeight;
                    
                    steerAngle = Math.atan2(finalY, finalX);
                    
                    // Re-apply wind check on the blended angle to ensure we don't steer into irons
                    if (this.ship._findBestSailingAngle) {
                        steerAngle = this.ship._findBestSailingAngle(steerAngle, windDirection);
                    }
                }
            }

            this.ship.targetAngle = steerAngle;
            this.ship.debugStatus = `Formation: ${dist.toFixed(0)}m`;
        }
    }
}