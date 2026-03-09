/**
 * Defines the specific combat behavior for a Navy ship.
 * This class extends the base CombatPilot to implement aggressive
 * tactics like strafing, pivot shots, and calculated disengagement.
 */
class NavyCombatPilot extends CombatPilot {
    constructor(ship) {
        super(ship);

        // --- New State for Simplified Combat ---
        this.isPivotFiring = false; // Is the ship currently in the "turn-to-fire" state?
        this.distanceAtLastPivotCheck = 0; // To track the 5% closer requirement.

        this.combatPhase = 'closing'; // --- NEW: Initialize combat phase ('closing' or 'dogfighting') ---
        // --- Optimization: Cached Vectors ---
        this.cachedSeparationVector = { x: 0, y: 0 };
        this.cachedProjectileVector = { x: 0, y: 0 };
        this.cachedBroadsideVector = { x: 0, y: 0 };
        this.debugChaseTarget = null; // New: For visualizing the chase point
        this.projectileAvoidanceTimer = 0; // --- NEW: Timer for throttling projectile avoidance ---
    }

    /**
     * Navy-specific combat mode logic. Pursues by default, flees when health is critical
     * relative to the target's health.
     * @param {Ship} targetShip - The ship being targeted.
     */
    _updateCombatMode(targetShip) {
        const ownHpPercentage = this.ship.hp / this.ship.maxHp;
        const targetHpPercentage = targetShip.hp / targetShip.maxHp;

        // The threshold is half of the target's current health percentage.
        const fleeThresholdPercentage = targetHpPercentage * 0.5;

        // --- New: Desperation Mode Check (Highest Priority) ---
        // If the ship is critically damaged, it enters a "last stand" mode.
        if (this.ship.getDamageSpeedMultiplier() < 0.1) {
            this.combatMode = 'desperation';
        } else if (ownHpPercentage < fleeThresholdPercentage) {
            this.combatMode = 'fleeing';
        } else {
            this.combatMode = 'pursuing';
        }
    }

    /**
     * Overrides the base method to implement Navy-specific disengagement logic.
     * A Navy ship will only disengage if it is heavily damaged.
     */
    manageCombatState(player, distToPlayer, deltaTime, pathfinder, windDirection) {
        // --- Pirate Hunter Logic ---
        if (this.ship.isPirateHunter) {
            // --- NEW: Victory Check ---
            if (player.isSunk) {
                console.log(`[${this.ship.shipId}] Target destroyed. Mission accomplished.`);
                this.ship._deactivateCombat(pathfinder, windDirection);
                return;
            }

            // Hunters are relentless. They do not use the standard disengage timer.
            // They only stop if the player is sunk or if they lose track completely (very far).
            const maxChaseRange = this.ship.shipLength * NPC_COMBAT_RANGE_MULTIPLIER * 3; // 3x Combat Range
            
            if (distToPlayer > maxChaseRange) {
                // Lost target, resume hunting (pathfinding)
                console.log(`[${this.ship.shipId}] Hunter lost target. Resuming hunt.`);
                this.ship.aiState = 'hunting';
                this.ship._clearPath('Target lost, resuming hunt');
            }
            return;
        }

        // The Navy ship now relies entirely on the general deactivation logic
        // from the base CombatPilot (i.e., target out of range for 30 seconds).
        // Its tactical retreat is handled by switching to 'fleeing' mode in _updateCombatMode.
        super.manageCombatState(player, distToPlayer, deltaTime, pathfinder, windDirection);
    }

    /**
     * Executes the simplified Navy combat maneuvers for medium and close range.
     * This has been completely rewritten to remove strafing.
     */
    executeCombatManeuver(predictionInfo, windDirection, pathfinder, npcs, cannonballs, volleys, spatialGrid, deltaTime) {
        const ship = this.ship;
        const target = ship.targetShip;
        const distToTarget = distance(ship, target);

        // --- NEW: Pivot Locking ---
        // If we are committed to a pivot, finish it before accepting new input.
        if (ship.isPerformingAvoidancePivot) {
            // --- FIX: Check if threat is still present ---
            // If the obstacle is gone (or we drifted clear), break the lock immediately.
            const currentAvoid = ship._getAvoidanceVector(windDirection, pathfinder);
            
            if (currentAvoid.magnitude === 0) {
                ship.isPerformingAvoidancePivot = false;
            } else {
                let angleDiff = normalizeAngle(ship.targetAngle - ship.angle);
                if (Math.abs(angleDiff) > 0.2) {
                    ship.isSailOpen = false;
                    ship.debugStatus = 'Combat (Locked Pivot)';
                    return true;
                }
                ship.isPerformingAvoidancePivot = false; // Unlock
            }
        }

        // --- NEW: Update Projectile Avoidance Timer ---
        this.projectileAvoidanceTimer -= deltaTime;

        // --- OPTIMIZATION: Throttle Maneuver Logic ---
        // We only recalculate vectors and pathfinding every ~100ms to save CPU.
        this.maneuverTimer -= deltaTime;
        if (this.maneuverTimer > 0) return true; // Skip if throttled, maintain previous state

        this.maneuverTimer = 100 + Math.random() * 20; // ~10Hz
        this._getSeparationVector(npcs, spatialGrid, this.cachedSeparationVector);
        
        // --- NEW: Throttled Projectile Avoidance (100-200ms) ---
        if (this.projectileAvoidanceTimer <= 0) {
            this._getProjectileAvoidanceVector(spatialGrid, volleys, target, distToTarget, this.cachedProjectileVector);
            this.projectileAvoidanceTimer = 100 + Math.random() * 100;
        }

        // --- 1. Calculate Steering Vectors ---
        const chaseVector = this._getChaseVector(target, distToTarget, windDirection);
        const broadsideVector = this._getBroadsideVector(target, predictionInfo, this.cachedBroadsideVector);
        const separationVector = this.cachedSeparationVector;
        const projectileAvoidanceVector = this.cachedProjectileVector;
        // Use the base ship's unified avoidance vector for terrain/collision
        const terrainAvoidanceVector = ship._getAvoidanceVector(windDirection, pathfinder);

        // --- 2. Determine Weights ---
        let wChase = 1.0;
        let wBroadside = 0.0;
        let wSeparation = 1.5;
        let wProjectile = 3.0;
        // Scale terrain weight by steeringWeight (short range urgency) to allow smoother transitions.
        // Long range avoidance is handled by the Lookout (via targetAngle), not this vector blend.
        let wTerrain = (terrainAvoidanceVector.steeringWeight !== undefined ? terrainAvoidanceVector.steeringWeight : terrainAvoidanceVector.magnitude) * 30.0;

        // Dynamic Combat Weights
        const now = performance.now();
        const portCooldown = now - ship.lastPortFireTime;
        const starboardCooldown = now - ship.lastStarboardFireTime;
        const reloadTime = ship.reloadTime;
        const portReloadPct = Math.min(1.0, portCooldown / reloadTime);
        const starboardReloadPct = Math.min(1.0, starboardCooldown / reloadTime);

        // Determine which side we are presenting
        const angleToTarget = this._getCompensatedAngle(predictionInfo);
        let angleDiff = normalizeAngle(angleToTarget - ship.angle);
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        const sideDir = Math.sign(angleDiff) || 1; 
        const relevantReloadPct = (sideDir === 1) ? starboardReloadPct : portReloadPct;
        const canFire = relevantReloadPct >= 1.0;

        // --- NEW: Hysteresis Logic (State Latching) ---
        // Prevents "mushy" vector blending by forcing the ship to commit to either
        // closing the distance or fighting at close range.
        const DOGFIGHT_ENTER_DIST = ship.shipLength * 4;
        // --- FIX: Align exit distance with weight crossover (6L) to prevent "dead zone" behavior ---
        const DOGFIGHT_EXIT_DIST = ship.shipLength * 6;

        if (this.combatPhase === 'closing') {
            if (distToTarget < DOGFIGHT_ENTER_DIST) this.combatPhase = 'dogfighting';
        } else {
            if (distToTarget > DOGFIGHT_EXIT_DIST) this.combatPhase = 'closing';
        }

        // Chase vs Broadside Weighting
        const optimalDistance = ship.shipLength * 3;
        
        // --- FIX: Prioritize Combat Phase over Reload Status ---
        // If we are in the dogfighting phase, maintain broadside orientation even while reloading.
        // This prevents the ship from turning bow-on immediately after firing (the "wiggle").
        if (this.combatPhase === 'dogfighting') {
            // Dogfighting Phase: Firepower is king.
            const proximityRatio = 1.0 - Math.min(1.0, distToTarget / DOGFIGHT_EXIT_DIST);
            wBroadside = 4.0 + (proximityRatio * 4.0); // Scales 4.0 -> 8.0
            wChase = 1.0;

            // If reloading, relax the broadside constraint slightly to allow minor course correction,
            // but do NOT abandon the firing solution.
            if (!canFire) {
                wBroadside *= 0.75; 
                wChase = 1.5;
            }
        } else if (canFire) {
            // Closing Phase (Opportunistic Fire):
            // If we have a shot while closing, take it, but prioritize closing distance.
            const distInLengths = distToTarget / ship.shipLength;
            const distanceBonus = Math.max(0, distInLengths - 4.0);
            wChase = Math.min(9.0, 3.0 + distanceBonus);
            wBroadside = 1.0;
        } else {
            // Reloading Mode: Prioritize positioning
            wBroadside = 0.2; 
            wChase = 2.0; // Constant chase weight while reloading

            if (distToTarget < optimalDistance) {
                wChase = (distToTarget / optimalDistance) * 0.5; // Fade out chase when close
            }
        }

        // Stability Bonus
        const targetTurnRate = Math.abs(normalizeAngle(target.angle - target.lastAngle));
        if (targetTurnRate < 0.01 && canFire) {
            wBroadside *= 1.5;
        }

        // Desperation Overrides
        if (this.combatMode === 'desperation') {
            const anySideReady = portReloadPct >= 1.0 || starboardReloadPct >= 1.0;
            if (anySideReady) {
                this.ship.debugStatus = 'Desperation: Last Stand!';
                wBroadside = 10.0; // Force turn to fire
            } else {
                this.ship.debugStatus = 'Desperation: Fleeing while reloading';
                wChase = 10.0; // Force move (Chase vector handles fleeing logic if target is set correctly, but here we might need a specific flee vector)
                // For simplicity in this refactor, we rely on the fact that 'desperation' usually implies
                // aggressive firing or running. If running, we'd need a flee vector.
                // Let's assume 'Chase' logic handles positioning.
            }
        }

        // --- NEW: Chase Priority if Target Out of Range ---
        // If the target is out of range (disengage timer is running), prioritize closing the distance
        // above everything except terrain avoidance.
        if (this.disengageTimer > 0) {
            wChase = 9.0; // High priority, matches max closing weight, just below terrain (10.0)
            wBroadside = 0.0; // Don't try to turn for shots
            wSeparation = 0.5; // Reduce separation priority to focus on chase
            wProjectile = 0.0; // Ignore projectiles (likely none if out of range)
            ship.debugStatus = 'Closing Range (Disengaging)';
        }

        // --- NEW: Emergency Avoidance Override ---
        // If we are within the reactive avoidance threshold (Cyan Line visible), prioritize survival.
        // This prevents the "Turn to Fire" logic from fighting the "Turn to Avoid" logic.
        if (terrainAvoidanceVector.magnitude > 0 && (terrainAvoidanceVector.type === 'terrain' || terrainAvoidanceVector.type === 'boundary')) {
            wChase = 0;
            wBroadside = 0;
            wSeparation = 0;
            wProjectile = 0;
            wTerrain = 100.0; // Force dominance
            ship.debugStatus = 'Emergency Avoidance';
        }

        // --- 3. Blend Vectors ---
        const finalX = (chaseVector.x * wChase) + (broadsideVector.x * wBroadside) + 
                       (separationVector.x * wSeparation) + (projectileAvoidanceVector.x * wProjectile) + 
                       (terrainAvoidanceVector.x * wTerrain);
        
        const finalY = (chaseVector.y * wChase) + (broadsideVector.y * wBroadside) + 
                       (separationVector.y * wSeparation) + (projectileAvoidanceVector.y * wProjectile) + 
                       (terrainAvoidanceVector.y * wTerrain);
        // --- 4. Execute ---
        const finalAngle = Math.atan2(finalY, finalX);

        // --- NEW: "Hard Clamp" Logic (Recommendation #3) ---
        if (wBroadside > wChase) {
            // Dogfighting Phase: We want to turn to fire, but must respect obstacles.
            let clampedAngle = finalAngle; // Start with the blended desire.

            if (terrainAvoidanceVector.obstacles && terrainAvoidanceVector.obstacles.length > 0) {
                // Check if our desired broadside turn intersects the obstacle.
                const tangentAngle = ship._findTangentAvoidanceAngle(finalAngle, terrainAvoidanceVector.obstacles);
                if (tangentAngle !== null) {
                    // We have a safe tangent angle. Now, clamp the desired angle.
                    const turnToDesired = normalizeAngle(finalAngle - ship.angle);
                    const turnToSafe = normalizeAngle(tangentAngle - ship.angle);

                    // If both turns are in the same direction, but the desired turn is larger (goes "past" the safe angle), clamp it.
                    if (Math.sign(turnToDesired) === Math.sign(turnToSafe) && Math.abs(turnToDesired) > Math.abs(turnToSafe)) {
                        clampedAngle = tangentAngle; // Clamp to the safe tangent angle.
                        ship.debugStatus += ' | CLAMPED';
                    }
                }
            }
            ship.targetAngle = ship._findBestSailingAngle(clampedAngle, windDirection);
        } else {
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
        }

        // --- 5. Sail Management ---
        // Default to open sails for movement
        ship.isSailOpen = true;
        ship.throttle = 1.0;
        ship.throttleReason = null;

        // A. Terrain Avoidance (Proportional Control) - Highest Priority for Speed Limiting
        // Use the urgency magnitude to throttle speed, preventing premature pivots at long range.
        if (terrainAvoidanceVector.magnitude > 0 && (terrainAvoidanceVector.type === 'terrain' || terrainAvoidanceVector.type === 'boundary')) {
            const brakeForce = (terrainAvoidanceVector.brakingWeight !== undefined) ? terrainAvoidanceVector.brakingWeight : terrainAvoidanceVector.magnitude;
            const safeThrottle = Math.max(0, 1.0 - brakeForce);
            ship.throttle = Math.min(ship.throttle, safeThrottle);
            ship.throttleReason = 'Avoidance';

            // Pivot Logic: Only stop if throttle is critically low AND the braking force is high.
            // This ensures we only pivot if the obstacle is actually within the 0.5L braking range.
            if (ship.throttle < 0.042 && brakeForce > 0.9) {
                ship.isSailOpen = false;
                ship.throttle = 0;
                ship.throttleReason = 'Emergency Stop';
                if (Math.abs(normalizeAngle(ship.targetAngle - ship.angle)) > 0.2) {
                    ship.isPerformingAvoidancePivot = true;
                }
            } else {
                ship.isPerformingAvoidancePivot = false;
            }
        } else {
            ship.isPerformingAvoidancePivot = false;
        }

        // C. Firing Alignment (Throttle Down)
        // If we are ready to fire but need to turn significantly, manage speed to tighten turn.
        // Only apply this throttle if we are within effective combat range (6L).
        if (canFire && ship.isSailOpen && distToTarget <= ship.shipLength * 6) {
             let angleDiff = normalizeAngle(ship.targetAngle - ship.angle);
             if (Math.abs(angleDiff) > Math.PI / 6) { // > 30 degrees off target
                 const severity = Math.min(1.0, (Math.abs(angleDiff) - (Math.PI/6)) / (Math.PI/2));
                 const aimThrottle = 0.5 - (severity * 0.4);
                 if (aimThrottle < ship.throttle) {
                     ship.throttle = aimThrottle;
                     ship.throttleReason = 'Aiming';
                 }
             }
        }

        ship.debugStatus = `Navy ${this.combatPhase} (C:${wChase.toFixed(1)} B:${wBroadside.toFixed(1)})`;

        // Reset the "fired upon" flag after it has been checked for this frame's logic.
        this.hasBeenFiredUpon = false;
        return true; // A maneuver was executed.
    }

    /**
     * Calculates the vector to close distance or maintain position relative to the target.
     * @private
     */
    _getChaseVector(target, distToTarget, windDirection) {
        const ship = this.ship;
        // Tactical Chase: Instead of aiming at the center, aim for a "Sweet Spot"
        // behind the target (blind spot) to naturally curve into a tailing position.
        const blindSpotDist = ship.shipLength * 1; // Reduced to 1L for tighter pursuit
        const blindSpotX = target.x - Math.cos(target.angle) * blindSpotDist;
        const blindSpotY = target.y - Math.sin(target.angle) * blindSpotDist;
        
        // Use predicted position for the blind spot to lead the target
        const leadTime = distToTarget / (ship.baseSpeed || 6); // Default speed if 0
        const futureBlindSpotX = blindSpotX + target.vx * leadTime;
        const futureBlindSpotY = blindSpotY + target.vy * leadTime;

        // Store for debug drawing
        this.debugChaseTarget = { x: futureBlindSpotX, y: futureBlindSpotY };

        // --- Use Universal Waypoint Following Logic (Handles Tacking) ---
        // Pass the calculated blind spot as the target for the chase vector
        // Note: We pass null for pathfinder to disable the obstacle-aware tacking check inside _getWaypointFollowingVector,
        // relying on local avoidance vectors instead for combat fluidity.
        return ship._getWaypointFollowingVector({ x: futureBlindSpotX, y: futureBlindSpotY }, windDirection, null);
    }

    /**
     * Calculates the vector to bring the broadside to bear on the target.
     * @private
     */
    _getBroadsideVector(target, predictionInfo, out = {x: 0, y: 0}) {
        const ship = this.ship;
        const angleToTarget = this._getCompensatedAngle(predictionInfo);
        
        // Determine which side is closer to the target
        let angleDiff = normalizeAngle(angleToTarget - ship.angle);
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        const sideDir = Math.sign(angleDiff) || 1; // 1 for Right (Starboard), -1 for Left (Port)

        // The broadside vector is perpendicular to the target line.
        const broadsideAngle = angleToTarget - (sideDir * Math.PI / 2);
        out.x = Math.cos(broadsideAngle);
        out.y = Math.sin(broadsideAngle);
        return out;
    }

    /**
     * Calculates the vector to maintain separation from allied ships.
     * @private
     */
    _getSeparationVector(npcs, spatialGrid, out = {x: 0, y: 0}) {
        const ship = this.ship;
        const target = ship.targetShip;
        let sepX = 0, sepY = 0;
        let separationCount = 0;
        const separationRadius = ship.shipLength * 4; // Look for neighbors within 4 lengths
        const separationRadiusSq = separationRadius * separationRadius; // --- OPTIMIZATION: Pre-calculate squared radius ---

        // --- OPTIMIZATION: Use Spatial Grid for Separation ---
        if (ship.nearbyContext) {
            for (const other of ship.nearbyContext.ships) {
                if (other === target) continue;
                
                // --- NEW: Ignore all ships in the same formation ---
                if ((ship.isSquadronHunter || ship.isFleetHunter) && (other.isSquadronHunter || other.isFleetHunter)) {
                    const getFlagship = (s) => {
                        if (!s || !s.formationLeader) return s;
                        let leader = s;
                        // Max 10 iterations to prevent infinite loops in case of circular reference
                        for (let i = 0; i < 10 && leader.formationLeader; i++) {
                            leader = leader.formationLeader;
                        }
                        return leader;
                    };
                    if (getFlagship(ship) === getFlagship(other)) {
                        continue; // It's in my formation, ignore for separation.
                    }
                }
                // Implicitly NpcShip/PlayerShip from context
                    const dSq = (ship.x - other.x)**2 + (ship.y - other.y)**2;
                    if (dSq < separationRadiusSq && dSq > 0) {
                        const d = Math.sqrt(dSq);
                        const pushX = ship.x - other.x;
                        const pushY = ship.y - other.y;
                        const weight = (separationRadius - d) / separationRadius;
                        sepX += (pushX / d) * weight;
                        sepY += (pushY / d) * weight;
                        separationCount++;
                }
            }
        } else if (npcs) {
            // Fallback to linear iteration if grid is missing (should not happen)
            for (const other of npcs) {
                if (other === ship || other === target) continue;

                // --- NEW: Ignore all ships in the same formation ---
                if ((ship.isSquadronHunter || ship.isFleetHunter) && (other.isSquadronHunter || other.isFleetHunter)) {
                    const getFlagship = (s) => {
                        if (!s || !s.formationLeader) return s;
                        let leader = s;
                        for (let i = 0; i < 10 && leader.formationLeader; i++) {
                            leader = leader.formationLeader;
                        }
                        return leader;
                    };
                    if (getFlagship(ship) === getFlagship(other)) {
                        continue;
                    }
                }
                // Avoid other Navy/Merchant ships to prevent clumping
                if (other instanceof NpcShip) { 
                    const dSq = (ship.x - other.x)**2 + (ship.y - other.y)**2; // --- OPTIMIZATION: Use squared distance ---
                    if (dSq < separationRadiusSq && dSq > 0) {
                        const d = Math.sqrt(dSq); // Only calc sqrt if within range
                        // Vector pointing away from neighbor
                        const pushX = ship.x - other.x;
                        const pushY = ship.y - other.y;
                        // Weight by inverse distance (closer = stronger push)
                        const weight = (separationRadius - d) / separationRadius; 
                        sepX += (pushX / d) * weight;
                        sepY += (pushY / d) * weight;
                        separationCount++;
                    }
                }
            }
        }
        if (separationCount > 0) {
            const sepMag = Math.sqrt(sepX * sepX + sepY * sepY);
            if (sepMag > 0) { 
                out.x = sepX / sepMag;
                out.y = sepY / sepMag;
                return out;
            }
        }
        out.x = 0; out.y = 0; return out;
    }

    /**
     * Calculates the vector to dodge incoming projectiles.
     * @private
     */
    _getProjectileAvoidanceVector(spatialGrid, volleys, target, distToTarget, out = {x: 0, y: 0}) {
        const ship = this.ship;

        // --- OPTIMIZATION: Distance-Based Gating ---
        // Only attempt to dodge if the target is in the "middle distance".
        // Too close (< 3 lengths): Dodging causes jitter and is physically unrealistic.
        // Too far (> 8 lengths): Dodging is unnecessary/low priority.
        if (distToTarget < ship.shipLength * 3 || distToTarget > ship.shipLength * 8) {
            out.x = 0; out.y = 0; return out;
        }

        let dodgeX = 0, dodgeY = 0;
        let threatCount = 0;
        const dodgeRadius = ship.shipLength * 3; // React to balls within 3 lengths
        const dodgeRadiusSq = dodgeRadius * dodgeRadius; // --- OPTIMIZATION: Pre-calculate squared radius ---

        // --- OPTIMIZATION: Use Spatial Grid for Volleys (Broadside Representations) ---
        // Instead of iterating all cannonballs, query the grid for nearby Volley objects.
        if (ship.nearbyContext) {
            for (const ball of ship.nearbyContext.volleys) {
                
                // --- OPTIMIZATION: Target-Specific Avoidance ---
                // Only dodge projectiles from the specific target we are fighting.
                if (ball.owner !== target) continue;

                const dSq = (ship.x - ball.x)**2 + (ship.y - ball.y)**2; // --- OPTIMIZATION: Use squared distance ---
                
                if (dSq < dodgeRadiusSq) {
                    // 1. Dodge Vector: Repulsion
                    // Check if ball is moving towards the ship (dot product > 0)
                    const dx = ship.x - ball.x;
                    const dy = ship.y - ball.y;
                    const relVx = ball.vx - ship.vx;
                    const relVy = ball.vy - ship.vy;
                    const isApproaching = (dx * relVx + dy * relVy) > 0;

                    if (isApproaching) {
                        const d = Math.sqrt(dSq); // --- OPTIMIZATION: Defer sqrt until needed ---
                        // Repulsion vector away from the ball
                        const weight = (dodgeRadius - d) / dodgeRadius; // Stronger when closer
                        dodgeX += (dx / d) * weight;
                        dodgeY += (dy / d) * weight;
                        threatCount++;
                    }
                }
            }
        } else if (volleys) {
            // Fallback if grid not provided (shouldn't happen in normal gameplay)
            for (const ball of volleys) {
                // --- OPTIMIZATION: Target-Specific Avoidance ---
                if (ball.owner !== target) continue;

                const dSq = (ship.x - ball.x)**2 + (ship.y - ball.y)**2;
                
                if (dSq < dodgeRadiusSq) {
                    const dx = ship.x - ball.x;
                    const dy = ship.y - ball.y;
                    const relVx = ball.vx - ship.vx;
                    const relVy = ball.vy - ship.vy;
                    const isApproaching = (dx * relVx + dy * relVy) > 0;

                    if (isApproaching) {
                        const d = Math.sqrt(dSq); // --- OPTIMIZATION: Defer sqrt until needed ---
                        const weight = (dodgeRadius - d) / dodgeRadius;
                        dodgeX += (dx / d) * weight;
                        dodgeY += (dy / d) * weight;
                        threatCount++;
                    }
                }
            }
        }
        if (threatCount > 0) {
            const dodgeMag = Math.sqrt(dodgeX * dodgeX + dodgeY * dodgeY);
            if (dodgeMag > 0) {
                out.x = dodgeX / dodgeMag;
                out.y = dodgeY / dodgeMag;
                return out;
            }
        }
        out.x = 0; out.y = 0; return out;
    }
}