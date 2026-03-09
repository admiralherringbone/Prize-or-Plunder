/**
 * Defines the specific combat behavior for a Merchant ship.
 * This class extends the base CombatPilot to implement cautious
 * tactics, primarily focusing on fleeing but fighting back if cornered
 * or at a significant advantage.
 */
class MerchantCombatPilot extends CombatPilot {
    constructor(ship) {
        super(ship);

        // --- Optimization ---
        this.cachedSeparationVector = { x: 0, y: 0 };
        this.fleeDestination = null; // New: Persistent destination for fleeing
    }

    /**
     * Merchant-specific combat mode logic. Flees by default unless it has a
     * significant health advantage.
     * @param {Ship} targetShip - The ship being targeted.
     */
    _updateCombatMode(targetShip) {
        // --- New, More Robust Fleeing Logic ---
        // A merchant compares its power level to the target's.
        const ownPower = this.ship.getPowerLevel();
        const targetPower = targetShip.getPowerLevel();

        // A merchant is a coward. It will only consider fighting if its power level
        // is at least 50% greater than the target's. Otherwise, it flees.
        if (ownPower > targetPower * 1.5) {
            this.combatMode = 'pursuing';
        } else {
            this.combatMode = 'fleeing';
        }
    }

    /**
     * Executes Merchant-specific combat maneuvers using Vector Blending.
     * Replaces the old state-based logic with a unified steering approach.
     */
    executeCombatManeuver(predictionInfo, windDirection, pathfinder, npcs, cannonballs, volleys, spatialGrid, deltaTime) {
        const ship = this.ship;
        const target = ship.targetShip;
        const distToTarget = distance(ship, target);

        // --- NEW: Pivot Locking ---
        // If we are committed to a pivot, finish it before accepting new input.
        if (ship.isPerformingAvoidancePivot) {
            // --- FIX: Check if threat is still present ---
            const currentAvoid = ship._getAvoidanceVector(windDirection, pathfinder);

            if (currentAvoid.magnitude === 0) {
                ship.isPerformingAvoidancePivot = false;
            } else {
                let angleDiff = normalizeAngle(ship.targetAngle - ship.angle);
                if (Math.abs(angleDiff) > 0.2) {
                    ship.isSailOpen = false;
                    ship.debugStatus = 'Merchant (Locked Pivot)';
                    return true;
                }
                ship.isPerformingAvoidancePivot = false; // Unlock
            }
        }

        // --- OPTIMIZATION: Throttle Maneuver Logic ---
        this.maneuverTimer -= deltaTime;
        if (this.maneuverTimer > 0) return true; // Skip if throttled

        this.maneuverTimer = 100 + Math.random() * 50;

        // --- 1. Calculate Steering Vectors ---
        
        // A. Terrain/Collision Avoidance (High Priority)
        // Uses the unified avoidance vector from the base NpcShip class.
        const terrainAvoidanceVector = ship._getAvoidanceVector(windDirection, pathfinder);

        // B. Separation (Avoid crowding)
        let sepX = 0, sepY = 0;
        const separationRadius = ship.shipLength * 3;
        
        if (ship.nearbyContext) {
            for (const other of ship.nearbyContext.ships) {
                if (other === target) continue;
                    const dSq = (ship.x - other.x)**2 + (ship.y - other.y)**2;
                    if (dSq < separationRadius**2 && dSq > 0) {
                        const d = Math.sqrt(dSq);
                        const pushX = ship.x - other.x;
                        const pushY = ship.y - other.y;
                        sepX += (pushX / d);
                        sepY += (pushY / d);
                }
            }
        } else if (npcs) {
            // Fallback
            for (const other of npcs) {
                if (other === ship || other === target) continue;
                if (other instanceof NpcShip) {
                    const dSq = (ship.x - other.x)**2 + (ship.y - other.y)**2;
                    if (dSq < separationRadius**2 && dSq > 0) {
                        const d = Math.sqrt(dSq);
                        const pushX = ship.x - other.x;
                        const pushY = ship.y - other.y;
                        sepX += (pushX / d);
                        sepY += (pushY / d);
                    }
                }
            }
        }
        const sepMag = Math.sqrt(sepX*sepX + sepY*sepY);
        this.cachedSeparationVector = (sepMag > 0) ? { x: sepX/sepMag, y: sepY/sepMag } : { x: 0, y: 0 };
        const separationVector = this.cachedSeparationVector;

        // C. Combat Vector (Flee or Pursue)
        let combatVector = { x: 0, y: 0 };
        
        if (this.combatMode === 'fleeing') {
            // --- NEW: Pathfinding-aware Fleeing ---
            // 1. Determine a stable flee destination if we don't have one or are too close to it.
            if (!this.fleeDestination || distance(ship, this.fleeDestination) < ship.shipLength * 10) {
                const angleAway = Math.atan2(ship.y - target.y, ship.x - target.x);
                const dist = 5000; // Flee 5000 units away
                this.fleeDestination = {
                    x: Math.max(0, Math.min(WORLD_WIDTH, ship.x + Math.cos(angleAway) * dist)),
                    y: Math.max(0, Math.min(WORLD_HEIGHT, ship.y + Math.sin(angleAway) * dist))
                };
                // Force path recalculation
                this.chasePathRecalculationTimer = 0;
            }

            // Clear path if not using it
            if (ship.pathWaypoints.length > 0) {
                ship.pathWaypoints = [];
                ship.currentWaypointIndex = 0;
            }
            // Direct flee
            combatVector = ship._getWaypointFollowingVector(this.fleeDestination, windDirection, null);
        } else {
            // Pursuing (Merchant style: cautious approach)
            // Aim for target center
            // --- FIX: Use the universal method ---
            combatVector = ship._getWaypointFollowingVector(target, windDirection, null);
        }

        // D. Broadside Vector (if pursuing and in range)
        let broadsideVector = { x: 0, y: 0 };
        if (this.combatMode === 'pursuing') {
             const angleToTarget = this._getCompensatedAngle(predictionInfo);
             let angleDiff = normalizeAngle(angleToTarget - ship.angle);
             if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
             const sideDir = Math.sign(angleDiff) || 1;
             const broadsideAngle = angleToTarget - (sideDir * Math.PI / 2);
             broadsideVector = { x: Math.cos(broadsideAngle), y: Math.sin(broadsideAngle) };
        }

        // --- 2. Weights ---
        // Scale terrain weight by steeringWeight (short range urgency) to allow smoother transitions.
        // Long range avoidance is handled by the Lookout (via targetAngle), not this vector blend.
        let wTerrain = (terrainAvoidanceVector.steeringWeight !== undefined ? terrainAvoidanceVector.steeringWeight : terrainAvoidanceVector.magnitude) * 30.0;
        let wSeparation = 2.0;
        let wCombat = 1.0;
        let wBroadside = 0.0;

        if (this.combatMode === 'pursuing') {
            // If close enough, try to broadside
            if (distToTarget < ship.shipLength * 5) {
                wBroadside = 2.0;
                wCombat = 0.5;
            }
        } else {
            // Fleeing
            wCombat = 3.0; // High priority on running away
        }

        // --- NEW: Chase Priority if Target Out of Range ---
        // If pursuing and target is getting away, prioritize chase.
        if (this.disengageTimer > 0 && this.combatMode === 'pursuing') {
            wCombat = 8.0; // High priority
            wBroadside = 0.0;
            wSeparation = 0.5;
            ship.debugStatus = 'Merchant Closing Range';
        }

        // --- 3. Blend ---
        const finalX = (terrainAvoidanceVector.x * wTerrain) + (separationVector.x * wSeparation) + (combatVector.x * wCombat) + (broadsideVector.x * wBroadside);
        const finalY = (terrainAvoidanceVector.y * wTerrain) + (separationVector.y * wSeparation) + (combatVector.y * wCombat) + (broadsideVector.y * wBroadside);

        // --- 4. Execute ---
        const finalAngle = Math.atan2(finalY, finalX);
        // --- FIX: Pass avoidance fallback ---
        
        // --- NEW: Tangent Navigation Integration ---
        let tangentAngle = null;
        if (terrainAvoidanceVector.obstacles && terrainAvoidanceVector.obstacles.length > 0) {
            tangentAngle = ship._findTangentAvoidanceAngle(finalAngle, terrainAvoidanceVector.obstacles);
        }

        if (tangentAngle !== null) {
            ship.targetAngle = ship._findBestSailingAngle(tangentAngle, windDirection);
        } else {
            let fallback = (terrainAvoidanceVector.magnitude > 0) ? Math.atan2(terrainAvoidanceVector.y, terrainAvoidanceVector.x) : null;
            ship.targetAngle = ship._findClearSailableAngle(finalAngle, pathfinder, windDirection, false, fallback);
        }
        
        // Sail Management (Proportional Control)
        ship.isSailOpen = true;
        ship.throttle = 1.0;
        ship.throttleReason = null;

        if (terrainAvoidanceVector.magnitude > 0 && (terrainAvoidanceVector.type === 'terrain' || terrainAvoidanceVector.type === 'boundary')) {
            const brakeForce = (terrainAvoidanceVector.brakingWeight !== undefined) ? terrainAvoidanceVector.brakingWeight : terrainAvoidanceVector.magnitude;
            ship.throttle = Math.max(0, 1.0 - brakeForce);
            ship.throttleReason = 'Avoidance';

            // Pivot Logic: Only stop if throttle is critically low AND the braking force is high.
            // This ensures we only pivot if the obstacle is actually within the 0.5L braking range.
            if (ship.throttle < 0.042 && brakeForce > 0.9) {
                ship.isSailOpen = false;
                ship.throttle = 0;
                ship.throttleReason = 'Panic Pivot';
                if (Math.abs(normalizeAngle(ship.targetAngle - ship.angle)) > 0.2) {
                    ship.isPerformingAvoidancePivot = true;
                }
            } else {
                ship.isPerformingAvoidancePivot = false;
            }
        }

        ship.debugStatus = `Merchant Blend (${this.combatMode})`;
        return true;
    }
}