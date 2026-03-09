/**
 * The CombatPilot class is responsible for all tactical combat decisions of an NpcShip.
 * It manages combat state, target prediction, maneuver selection, and firing solutions.
 */
class CombatPilot {
    /**
     * @param {NpcShip} ship - The ship this pilot controls.
     */
    constructor(ship) {
        this.ship = ship; // The NpcShip instance this pilot is attached to

        // --- Combat State ---
        this.combatMode = 'pursuing'; // 'pursuing' or 'fleeing'
        this.chasePathRecalculationTimer = 0;
        this.strafingSide = 'port'; // The preferred side for the next strafing run.
        this.disengageTimer = 0; // Timer for deactivating pursuit.
        this.disengageTimeout = 0; // The random duration for the current disengage attempt.
        this.lastPredictionInfo = null; // For debug drawing
        this.debugFireZone = null; // New: For drawing the broadside fire zone polygon.
        this.debugBroadsideBoxes = []; // New: For drawing the geometric overlap boxes.
        this.debugTargetBox = null; // New: For drawing the target's detection box.
        this.debugAimVectors = []; // New: For drawing the aiming lines (Red/Green/Grey).

        // --- Maneuver State ---
        this.pivotShotCooldown = {
            isActive: false,
            initialDistance: 0,
            initialSailingAngle: 0,
            initialTargetAngle: 0,
        };

        // --- Aiming State ---
        this.lastAngleToPredicted = null; // FIX: Initialize to null to prevent first-frame jump
        this.fireCheckTimer = Math.random() * 500; // --- OPTIMIZATION: Timer to throttle expensive firing checks ---
        this.hasBeenFiredUpon = false; // New flag for medium-range combat logic

        // --- New Integrated Combat Avoidance State ---
        this.isAwareOfTerrain = false;    // Is the ship currently aware of a specific terrain obstacle?
        this.terrainAwarenessObstacle = null; // The obstacle it is aware of.
        this.terrainAwarenessDistance = Infinity; // The current distance to that obstacle.

        // --- NEW: Tacking State (Zig-Zag Logic) ---
        this.tackTimer = 0;
        this.currentTackDirection = 1; // 1 for Starboard tack, -1 for Port tack

        // --- Aiming Skill Properties (to be set by subclasses via the ship) ---
        this.aimInaccuracyBase = 0;
        this.aimInaccuracyRangeFactor = 0;
        this.aimInaccuracyTurnRateFactor = 0;
        this.predictionResult = { x: 0, y: 0, time: 0 }; // --- OPTIMIZATION: Reusable object to reduce GC ---
        this.maneuverTimer = 0; // --- NEW: Initialize maneuver throttle timer ---
        this._cachedFirePoint = { x: 0, y: 0 }; // --- OPTIMIZATION: Reusable object for fire point ---
        this._cachedAimingPoint = { x: 0, y: 0, time: 0 }; // --- OPTIMIZATION: Reusable object for aiming ---
        this._cachedTargetPoint = { x: 0, y: 0 }; // --- OPTIMIZATION: Reusable object for target ---
    }

    /**
     * Manages combat state transitions, like disengagement. To be implemented by subclasses.
     */
    manageCombatState(player, distToPlayer, deltaTime, pathfinder, windDirection) {
        // --- General Deactivation Logic (Out of Range) ---
        const target = this.ship.targetShip || player;
        const distToTarget = (target === player) ? distToPlayer : distance(this.ship, target);
        const maxRange = this.ship.shipLength * NPC_COMBAT_RANGE_MULTIPLIER;
        
        // --- NEW: Immediate Disengage if Target Sunk ---
        if (target && target.isSunk) {
            console.log(`[${this.ship.shipId}] Target sunk. Disengaging.`);
            this.ship._deactivateCombat(pathfinder, windDirection);
            this.disengageTimer = 0;
            return;
        }

        if (distToTarget > maxRange) {
            // If the target is out of range, start or continue the disengage timer.
            this.disengageTimer += deltaTime;
            if (this.disengageTimer > NPC_COMBAT_DEACTIVATION_TIME) {
                console.log(`[${this.ship.shipId}] Target out of range. Disengaging.`);
                this.ship._deactivateCombat(pathfinder, windDirection);
                this.disengageTimer = 0; // Reset for the next encounter.
            }
        } else {
            // If the target comes back into range, reset the timer.
            this.disengageTimer = 0;
        }
        // Subclasses can call super.manageCombatState() and then add their own
        // specific logic, like the Navy's low-health disengagement.
    }

    /**
     * Updates the pilot's `combatMode` property ('pursuing' or 'fleeing') based on the ship's state.
     * This is a high-level decision based on the ship's role and state.
     * @param {Ship} targetShip - The ship being targeted.
     */
    _updateCombatMode(targetShip) {
        // This method will be implemented by subclasses (e.g., NavyCombatPilot).
    }

    /**
     * The main entry point for the combat pilot's logic for a single frame.
     * It decides what actions to take based on the combat situation.
     * @param {number} deltaTime - The time elapsed since the last frame.
     * @param {number} windDirection - The current wind direction.
     * @param {Pathfinder} pathfinder - The global pathfinder instance.
     * @param {Array<Cannonball>} cannonballs - The array to add new cannonballs to.
     * @param {Array<Volley>} volleys - The array to add new volleys to.
     * @param {SpatialGrid} spatialGrid - The global spatial grid.
     */
    runCombatAI(deltaTime, windDirection, pathfinder, cannonballs, volleys, npcs, spatialGrid) {
        if (!this.ship.targetShip) {
            // Failsafe: If target is lost, the ship's brain should handle it.
            this.ship.aiState = 'navigating';
            this.ship.destinationIsland = this.ship.pausedPathfindingDestination;
            return;
        }

        // Let the pilot's specific subclass logic decide if it should be pursuing or fleeing.
        this._updateCombatMode(this.ship.targetShip);

        const distToTarget = distance(this.ship, this.ship.targetShip); // This is needed by the firing logic
        
        // --- FIX: Run prediction every frame to prevent jitter ---
        // Throttling this caused the aim point to "step" when the target was turning.
        const predictionInfo = this.predictInterceptPoint(this.ship.targetShip);
        this.lastPredictionInfo = predictionInfo;

        // --- Simplified Combat Orchestration ---
        // The base pilot now fully delegates maneuvering and firing to its subclasses.
        // It sets the debug status and then calls the appropriate methods.
        this.ship.debugStatus = `Maneuvering (${this.combatMode})`;
        this.executeCombatManeuver(predictionInfo, windDirection, pathfinder, npcs, cannonballs, volleys, spatialGrid, deltaTime); // Pass cannonballs, volleys and grid
        this._handleFiring(predictionInfo, pathfinder, cannonballs, volleys, npcs, distToTarget, spatialGrid, deltaTime);
    }

    /**
     * Calculates a pursuit path towards a strategic position relative to the target.
     * @private
     */
    calculatePursuitPath(windDirection, pathfinder) {
        if (!this.ship.targetShip) return;

        let pathTarget = this.ship.targetShip;
        // If fleeing, the target is a point far away.
        if (this.combatMode === 'fleeing') {
            const angleAway = Math.atan2(this.ship.y - this.ship.targetShip.y, this.ship.x - this.ship.targetShip.x);
            const fleeDistance = WORLD_WIDTH; // A very large number to ensure it's off-map
            pathTarget = { x: this.ship.x + Math.cos(angleAway) * fleeDistance, y: this.ship.y + Math.sin(angleAway) * fleeDistance };
        }

        // The ship itself holds the pathing data. The pilot just requests the path.
        this.ship.pathWaypoints = pathfinder.findPath({ x: this.ship.x, y: this.ship.y }, pathTarget, windDirection, this.ship);
        this.ship.currentWaypointIndex = 0;
        this.chasePathRecalculationTimer = NPC_CHASE_PATH_RECALCULATION_INTERVAL;
        this.ship.resetFailsafeState();
    }

    /**
     * Predicts the future position of a target ship for aiming.
     * @param {Ship} target - The target ship.
     * @returns {{x: number, y: number, time: number}} The predicted position and time to intercept.
     */
    predictInterceptPoint(target) {
        const shooter = this.ship;
        const dist = distance(shooter, target);

        const projectileSpeed = CANNONBALL_SPEED; // pixels per frame

        // --- NEW: Iterative "Future-Sight" Prediction ---
        // Instead of assuming linear velocity, we simulate the target's movement
        // accounting for their current turn rate.

        // 1. Calculate Angular Velocity (Turn Rate)
        // Use the target's cached turn rate from their update loop.
        const angularVel = target.currentTurnRate || 0;

        // 2. Simulation State
        let simX = target.x;
        let simY = target.y;
        let simVx = target.vx;
        let simVy = target.vy;

        // 3. Iterative Loop
        // We check positions in the future. To save CPU, we skip frames (step size).
        const maxFrames = 300; // Look ahead up to 5 seconds (60fps * 5)
        const step = 4; // Check every 4th frame (approx 66ms)
        
        let predictedX = target.x;
        let predictedY = target.y;
        let timeToHit = 0;

        for (let t = 0; t < maxFrames; t += step) {
            // Distance projectile can travel in 't' frames
            const projectileDist = projectileSpeed * t;
            
            // Distance from shooter to simulated target position
            const dx = simX - shooter.x;
            const dy = simY - shooter.y;
            const targetDistSq = dx*dx + dy*dy;

            // Check Intercept: Has the projectile caught up?
            if (targetDistSq <= projectileDist * projectileDist) {
                predictedX = simX;
                predictedY = simY;
                timeToHit = t;
                break; // Found solution
            }

            // Advance Simulation
            // Rotate the velocity vector by the turn rate
            if (Math.abs(angularVel) > 0.0001) {
                const rotation = angularVel * step;
                const cos = Math.cos(rotation);
                const sin = Math.sin(rotation);
                const newVx = simVx * cos - simVy * sin;
                const newVy = simVx * sin + simVy * cos;
                simVx = newVx;
                simVy = newVy;
            }

            // Move position
            simX += simVx * step;
            simY += simVy * step;
        }

        // If loop finishes without break, we use the last simulated position (max range fallback)
        if (timeToHit === 0 && maxFrames > 0) {
             predictedX = simX;
             predictedY = simY;
             timeToHit = maxFrames;
        }

        // --- NEW: Smooth Blending for Close-Range Prediction ---
        const blendStartDist = shooter.shipLength * 4;
        const blendEndDist = shooter.shipLength * 2;
        let finalX = predictedX;
        let finalY = predictedY;
        if (dist < blendStartDist) {
            const blendFactor = Math.max(0, Math.min(1, (blendStartDist - dist) / (blendStartDist - blendEndDist)));
            finalX = predictedX + (target.x - predictedX) * blendFactor;
            finalY = predictedY + (target.y - predictedY) * blendFactor;
        }

        this.predictionResult.x = finalX;
        this.predictionResult.y = finalY;
        this.predictionResult.time = timeToHit; // Keep original time for other logic if needed
 
        return this.predictionResult;
    }

    /**
     * Executes a specific combat maneuver, like strafing or a pivot shot.
     * This is a placeholder to be implemented by subclasses.
     * @param {{x: number, y: number, time: number}} predictionInfo - The predicted position of the target.
     * @param {number} windDirection - The current wind direction.
     * @param {Pathfinder} pathfinder - The global pathfinder instance.
     * @param {number} deltaTime - The time elapsed since the last frame.
     * @param {Array<NpcShip>} npcs - The list of all NPCs for coordination.
     * @param {Array<Cannonball>} cannonballs - The list of active cannonballs.
     * @param {Array<Volley>} volleys - The list of active volleys.
     * @param {SpatialGrid} spatialGrid - The global spatial grid.
     */
    executeCombatManeuver(predictionInfo, windDirection, pathfinder, npcs, cannonballs, volleys, spatialGrid) {
        // This method will be implemented by subclasses (e.g., NavyShip's combat pilot)
        // to define specific combat maneuvers like strafing or pivot shots.
        // It should return true if a pivot shot was executed, false otherwise.
        // The base implementation does nothing and returns false. 
        return false;
    }

    /**
     * New: Creates a polygon representing the area a broadside will cover.
     * @param {number} fireSide - -1 for port, 1 for starboard.
     * @param {object} predictionInfo - The predicted target position.
     * @param {number} distToTarget - The distance to the target.
     * @returns {Array<object>|null} An array of points for the polygon, or null.
     * @private
     */
    _createFireZonePolygon(fireSide, predictionInfo, distToTarget) {
        if (!this.ship.blueprint) return null;

        // --- OPTIMIZATION: Use low-poly collision points instead of high-poly visual points ---
        const hullPoints = this.ship.collisionPoints;
        // --- FIX: Use a small epsilon to include centerline points for both sides ---
        const epsilon = 0.1;
        const sidePoints = hullPoints.filter(p => (fireSide === 1 ? p.y >= -epsilon : p.y <= epsilon));

        if (sidePoints.length <= 1) return null;

        const aftPoint = sidePoints.reduce((min, p) => p.x < min.x ? p : min, sidePoints[0]);
        const forePoint = sidePoints.reduce((max, p) => p.x > max.x ? p : max, sidePoints[0]);

        const worldAftPoint = rotatePoint(aftPoint, { x: 0, y: 0 }, this.ship.angle);
        worldAftPoint.x += this.ship.x;
        worldAftPoint.y += this.ship.y;

        const worldForePoint = rotatePoint(forePoint, { x: 0, y: 0 }, this.ship.angle);
        worldForePoint.x += this.ship.x;
        worldForePoint.y += this.ship.y;

        const angleToTarget = Math.atan2(predictionInfo.y - this.ship.y, predictionInfo.x - this.ship.x);
        const range = distToTarget * 1.1;

        const targetAftPoint = { x: worldAftPoint.x + Math.cos(angleToTarget) * range, y: worldAftPoint.y + Math.sin(angleToTarget) * range };
        const targetForePoint = { x: worldForePoint.x + Math.cos(angleToTarget) * range, y: worldForePoint.y + Math.sin(angleToTarget) * range };

        return [worldAftPoint, worldForePoint, targetForePoint, targetAftPoint];
    }

    /**
     * Helper to calculate the firing angle compensated for the shooter's velocity.
     * This ensures the cannonball's net vector (Muzzle + Ship) points to the target.
     * @param {{x: number, y: number, time: number}} predictionInfo
     * @returns {number} The compensated angle in radians.
     * @protected
     */
    _getCompensatedAngle(predictionInfo) {
        const t = predictionInfo.time;
        if (t > 0) {
            const dx = predictionInfo.x - this.ship.x;
            const dy = predictionInfo.y - this.ship.y;
            
            // The total velocity vector required to hit the target at time t
            const vxTotal = dx / t;
            const vyTotal = dy / t;
            
            // Subtract shooter's velocity to get the required muzzle velocity vector
            const vxAim = vxTotal - this.ship.vx;
            const vyAim = vyTotal - this.ship.vy;
            
            return Math.atan2(vyAim, vxAim);
        }
        // Fallback if time is invalid
        return Math.atan2(predictionInfo.y - this.ship.y, predictionInfo.x - this.ship.x);
    }

    /**
     * Handles the final aiming and firing logic, independent of the maneuver.
     * @private
     */
    _handleFiring(predictionInfo, pathfinder, cannonballs, volleys, npcs, distToTarget, spatialGrid, deltaTime) {
        const ship = this.ship; // --- FIX: Define ship for use in inner functions ---

        // --- NEW: Blended Aiming (Linear Interpolation) ---
        // Blend between Current Position (0.0) and Predicted Position (1.0) based on distance.
        // Close range: Trust visual alignment (Current). Long range: Trust math (Predicted).
        const minBlendDist = ship.shipLength * 2;
        const maxBlendDist = ship.shipLength * 8;
        
        let predictionWeight = (distToTarget - minBlendDist) / (maxBlendDist - minBlendDist);
        predictionWeight = Math.max(0, Math.min(1, predictionWeight)); // Clamp to [0, 1]

        const currentX = ship.targetShip.x;
        const currentY = ship.targetShip.y;
        
        const blendedX = currentX + (predictionInfo.x - currentX) * predictionWeight;
        const blendedY = currentY + (predictionInfo.y - currentY) * predictionWeight;
        const timeToCurrent = distToTarget / CANNONBALL_SPEED;
        const blendedTime = timeToCurrent + (predictionInfo.time - timeToCurrent) * predictionWeight;

        const aimingPoint = this._cachedAimingPoint;
        aimingPoint.x = blendedX;
        aimingPoint.y = blendedY;
        aimingPoint.time = blendedTime;

        // Calculate Aiming Angle using the blended point
        const angleToAim = this._getCompensatedAngle(aimingPoint);
        let angleDiff = normalizeAngle(angleToAim - this.ship.angle);
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;

        // --- FIX: Do NOT return early. Check angles every frame for responsiveness. ---
        // We only throttle the expensive raycasts inside tryFireSide.

        this.debugFireZone = null; // Clear the debug zone before running a fresh check.
        this.debugBroadsideBoxes = []; // Clear previous boxes
        this.debugTargetBox = null; // Clear previous box
        this.debugAimVectors = []; // Clear previous aim vectors

        const broadsideAngle = Math.PI / 2; // 90 degrees
        // --- NEW: Target Size Compensation ---
        // Widen the arc based on the target's angular width so we fire if the hull is in sights, not just the center.
        const targetHalfAngularWidth = Math.atan2(this.ship.targetShip.shipLength / 2, distToTarget);
        const firingArc = (Math.PI / 36) + (targetHalfAngularWidth * 0.5); // 5 degrees + 50% of target width
        
        // --- FIX: Use a wider arc (45 deg) for the initial check so we can visualize aiming debug lines ---
        const roughAimArc = Math.PI / 4; 
        let isRoughlyAimedAtPort = Math.abs(angleDiff - (-broadsideAngle)) < roughAimArc;
        let isRoughlyAimedAtStarboard = Math.abs(angleDiff - broadsideAngle) < roughAimArc;
        let isRoughlyAimedAtBow = Math.abs(angleDiff) < roughAimArc;
        let isRoughlyAimedAtStern = Math.abs(angleDiff - Math.PI) < roughAimArc || Math.abs(angleDiff + Math.PI) < roughAimArc;

        // 3. Optimal Range: Only fire within a more precise optimal range.
        const maxOptimalRange = this.ship.shipLength * NPC_COMBAT_RANGE_MULTIPLIER;
            if (distToTarget > maxOptimalRange * 1.2) { // --- FIX: Increased buffer to 1.2 to prevent flickering ---
                this.ship.debugStatus += ` | Out of Range (${distToTarget.toFixed(0)} > ${(maxOptimalRange * 1.2).toFixed(0)})`;
            return; // Don't fire if outside optimal range
        }

        const distToTargetSq = distToTarget * distToTarget; // --- OPTIMIZATION: Pre-calc squared distance ---

            // --- NEW: Check if the ship is actually facing the target side ---
            // This is a more robust check than just the firing arc.

        // --- Helper function to check and fire a specific side ---
        const tryFireSide = (side, sideName) => {
            // --- NEW: Check Capability ---
            // Don't waste time raycasting if we don't have guns on this side.
            if (ship.hasCannonsOnSide && !ship.hasCannonsOnSide(sideName)) return false;

            // --- NEW: Check Loaded Status for Debug Colors ---
            const now = performance.now();
            const reloadTime = (typeof ship.getReloadTime === 'function') ? ship.getReloadTime() : (ship.reloadTime || 2000);
            let lastFireTime = 0;
            if (sideName === 'port') lastFireTime = ship.lastPortFireTime;
            else if (sideName === 'starboard') lastFireTime = ship.lastStarboardFireTime;
            else if (sideName === 'bow') lastFireTime = ship.lastBowFireTime;
            else if (sideName === 'stern') lastFireTime = ship.lastSternFireTime;
            const isLoaded = (now - lastFireTime) >= reloadTime;

            // 1. Build the fire zone for this side
            // --- OPTIMIZATION: Only build polygon for debug drawing, not for logic ---
            if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
                // Use the blended aiming point for the debug visualization
                const poly = this._createFireZonePolygon(side, aimingPoint, distToTarget);
                const zoneColor = isLoaded ? 'rgba(255, 255, 0, 0.25)' : 'rgba(128, 128, 128, 0.25)'; // Yellow if loaded, Grey if reloading
                this.debugFireZone = { polygon: poly, color: zoneColor };
            }

                // Check if the ship's current angle allows for firing this side.
                // The ship's angle should be roughly perpendicular to the target line.
                // Use the calculated firing angle (angleToAim) which accounts for the blend
                let angleToBroadside = normalizeAngle(angleToAim - ship.angle);

                // --- FIX: Normalize to (-PI, PI] to handle wrap-around correctly for Port side ---
                if (angleToBroadside > Math.PI) angleToBroadside -= 2 * Math.PI;

                // --- FIX: Robust Angle Difference Calculation for Stern (Wrap-around) ---
                const targetSideAngle = side * (Math.PI / 2);
                let angleDiffFromSide = angleToBroadside - targetSideAngle;
                
                // Normalize difference to (-PI, PI] to handle the PI/-PI boundary
                while (angleDiffFromSide > Math.PI) angleDiffFromSide -= 2 * Math.PI;
                while (angleDiffFromSide < -Math.PI) angleDiffFromSide += 2 * Math.PI;

                const broadsideTolerance = Math.PI / 4; // +/- 45 degrees (Matches roughAimArc)
                if (Math.abs(angleDiffFromSide) > broadsideTolerance) {
                    this.ship.debugStatus += ` | Not Facing ${sideName}`;
                    return false;
                }

            // --- OPTIMIZATION: Throttle Expensive Checks ---
            // Only run raycasts if we are actually aligned enough to fire.
            if (this.fireCheckTimer > 0) {
                return false; // Waiting for check timer
            }

            // Calculate firing geometry once for both checks
            const firePoint = this.ship.getMuzzlePosition(sideName, this._cachedFirePoint);
            const targetPoint = this._cachedTargetPoint;
            targetPoint.x = aimingPoint.x;
            targetPoint.y = aimingPoint.y;

            // 2. Check for ally collision
            // --- FIX: Check the actual line of fire (Muzzle -> Target) instead of the generic broadside cone. ---
            let isPathBlockedByAlly = false;
            if (this.ship.nearbyContext) {
                const fireDx = targetPoint.x - firePoint.x;
                const fireDy = targetPoint.y - firePoint.y;
                const fireDistSq = fireDx*fireDx + fireDy*fireDy;
                const fireDist = Math.sqrt(fireDistSq);
                const fireDirX = fireDx / fireDist;
                const fireDirY = fireDy / fireDist;

                for (const other of this.ship.nearbyContext.ships) {
                    if (other === this.ship.targetShip) continue;

                    const toAllyX = other.x - firePoint.x;
                    const toAllyY = other.y - firePoint.y;
                    const distToAllySq = toAllyX*toAllyX + toAllyY*toAllyY;

                    // Only check allies that are closer than the target
                    if (distToAllySq < fireDistSq) {
                        // Project ally position onto the line of fire
                        const dot = toAllyX * fireDirX + toAllyY * fireDirY;
                        
                        // Ally must be in front of the muzzle (dot > 0)
                        if (dot > 0) {
                            // Calculate squared perpendicular distance to the line: distPerpSq = distToAllySq - proj^2
                            const distPerpSq = distToAllySq - (dot * dot);
                            // Check if the ally's collision circle overlaps the line of fire.
                            const safeRadius = other.shipLength * 0.5 + 15; // Half length + safety buffer
                            if (distPerpSq < safeRadius * safeRadius) {
                                isPathBlockedByAlly = true;
                                break;
                            }
                        }
                    }
                }
            }

            // 3. Check for terrain collision
            // --- FIX: Use a dedicated check that ignores safety buffers. We can fire over shallow water. ---
            let isPathClearOfTerrain = this._isLineOfFireClear(firePoint, targetPoint, pathfinder, this.ship.nearbyContext.obstacles);

            // --- NEW: Multi-Point Visibility Check (Optimization: Only if center is blocked) ---
            // If the center is blocked, check the extremities of the target to see if we can clip them.
            // This prevents the ship from holding fire just because the exact center is behind a rock.
            // We only do this if the target is within a reasonable range to save performance.
            if (!isPathClearOfTerrain && distToTarget < this.ship.shipLength * 8) {
                const dx = targetPoint.x - firePoint.x;
                const dy = targetPoint.y - firePoint.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist > 0) {
                    // --- FIX: Use the target's actual orientation to find Bow and Stern ---
                    const tAngle = this.ship.targetShip.angle;
                    const tCos = Math.cos(tAngle);
                    const tSin = Math.sin(tAngle);
                    const tOffset = this.ship.targetShip.shipLength * 0.45; // Check near the ends (45% of length)
                    
                    const p1 = { x: targetPoint.x + tCos * tOffset, y: targetPoint.y + tSin * tOffset }; // Bow (approx)
                    const p2 = { x: targetPoint.x - tCos * tOffset, y: targetPoint.y - tSin * tOffset }; // Stern (approx)
                    
                    if (this._isLineOfFireClear(firePoint, p1, pathfinder, this.ship.nearbyContext.obstacles)) {
                        isPathClearOfTerrain = true;
                    } else if (this._isLineOfFireClear(firePoint, p2, pathfinder, this.ship.nearbyContext.obstacles)) {
                        isPathClearOfTerrain = true;
                    }
                }
            }

            // --- DEBUG VISUALIZATION ---
            if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
                const dx = targetPoint.x - firePoint.x;
                const dy = targetPoint.y - firePoint.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const dir = dist > 0 ? { x: dx/dist, y: dy/dist } : { x: Math.cos(this.ship.angle), y: Math.sin(this.ship.angle) };
                const range = this.ship.shipLength * 10; // 10 ship lengths
                const endPoint = { x: firePoint.x + dir.x * range, y: firePoint.y + dir.y * range };
                
                let color = isLoaded ? 'rgba(255, 255, 0, 0.8)' : 'rgba(200, 200, 200, 0.5)'; // Yellow if loaded, Grey if reloading
                
                if (!isPathClearOfTerrain || isPathBlockedByAlly) {
                    color = 'rgba(255, 0, 0, 0.8)'; // Red (Blocked)
                    // Update Zone Color
                    if (this.debugFireZone) this.debugFireZone.color = 'rgba(255, 0, 0, 0.25)';
                }
                
                this.debugAimVectors.push({ start: firePoint, end: endPoint, color: color, dashed: true });
            }

            // --- NEW: Strict Aim Check (Inside function now) ---
            // We drew the line, now check if we are actually precise enough to fire.
            // We re-use the angleDiffFromSide calculated above.
            if (Math.abs(angleDiffFromSide) > firingArc) {
                this.ship.debugStatus += ` | Refining Aim`;
                return false; // Aim is not yet settled enough to fire
            }

            // 4. Fire if clear
            if (isPathClearOfTerrain && !isPathBlockedByAlly) {
                this.ship.debugStatus += ` | Firing ${sideName}`;
                const fired = this.ship.fire(sideName, cannonballs, volleys);
                
                // Update debug color to Green if actually fired
                if (fired && typeof DEBUG !== 'undefined' && DEBUG.ENABLED && this.debugAimVectors.length > 0) {
                    this.debugAimVectors[this.debugAimVectors.length - 1].color = 'rgba(0, 255, 0, 0.8)';
                    if (this.debugFireZone) this.debugFireZone.color = 'rgba(0, 255, 0, 0.25)'; // Green Zone
                }
                return true; // Fired successfully
            } else {
                // We performed a check but failed (blocked). Reset timer to avoid spamming raycasts.
                this.fireCheckTimer = 200; 
                // Detailed logging for "Holding Fire"
                console.log(`[${this.ship.shipId}] Holding Fire on ${sideName}. Terrain Clear: ${isPathClearOfTerrain}, Ally Blocked: ${isPathBlockedByAlly}`);
            }
            
            if (isPathBlockedByAlly) {
                this.ship.debugStatus += ` | Holding Fire (Ally in ${sideName} way)`;
            } else if (!isPathClearOfTerrain) {
                this.ship.debugStatus += ` | Holding Fire (Terrain in ${sideName} way)`;
            }

            return false; // Did not fire
        };

        // --- Main Firing Logic ---
        // Check each side independently. If one fires, we stop.
        if (isRoughlyAimedAtPort) {
            if (tryFireSide(-1, 'port')) {
                return; // Fired port, so we are done.
            }
        }
        
        if (isRoughlyAimedAtStarboard) {
            if (tryFireSide(1, 'starboard')) {
                return; // Fired starboard.
            }
        }

        if (isRoughlyAimedAtBow) {
            if (tryFireSide(0, 'bow')) return;
        }

        if (isRoughlyAimedAtStern) {
            if (tryFireSide(2, 'stern')) return;
        }
    }

    /**
     * New: Checks if the line of fire is clear of hard terrain.
     * Unlike navigation checks, this ignores safety buffers/shallow water.
     * @param {{x:number, y:number}} start - Muzzle position.
     * @param {{x:number, y:number}} end - Target position.
     * @param {Pathfinder} pathfinder - The global pathfinder.
     * @param {Array} [cachedObstacles] - Optional list of obstacles to check against.
     * @returns {boolean} True if the line is clear of land.
     * @private
     */
    _isLineOfFireClear(start, end, pathfinder, cachedObstacles = null) {
        // Use geometric check to allow filtering specific types (Shoals/Reefs).
        // We want to ignore shoals and reefs for firing lines, as cannonballs fly over them.
        return pathfinder.isLineOfSightClear(start, end, ['shoal', 'coralReef', 'coralReefBase'], false, cachedObstacles);
    }

    /**
     * Updates timers related to combat, like the aim settling timer.
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    updateTimers(deltaTime) {
        // --- OPTIMIZATION: Update firing throttle timer ---
        this.fireCheckTimer = Math.max(0, this.fireCheckTimer - deltaTime);

        // --- NEW: Update Tack Timer ---
        if (this.tackTimer > 0) this.tackTimer -= deltaTime;
    }

    /**
     * Calculates a chase vector that zig-zags (tacks) if the target is upwind.
     * Includes logic to break the tack early if the target crosses the wind line.
     * @param {object} targetPos - The world position to chase.
     * @param {number} windDirection - The current wind direction.
     * @returns {object} Normalized vector {x, y}.
     * @protected
     */
    _getUpwindChaseVector(targetPos, windDirection) {
        const dx = targetPos.x - this.ship.x;
        const dy = targetPos.y - this.ship.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist === 0) return { x: Math.cos(this.ship.angle), y: Math.sin(this.ship.angle) };

        const angleToTarget = Math.atan2(dy, dx);
        let angleDiffFromUpwind = normalizeAngle(angleToTarget - windDirection);
        if (angleDiffFromUpwind > Math.PI) angleDiffFromUpwind -= 2 * Math.PI;
        if (angleDiffFromUpwind < -Math.PI) angleDiffFromUpwind += 2 * Math.PI;

        // Check if target is in the "No-Sail Zone" (Upwind)
        const closeHauled = this.ship.getCloseHauledAngle ? this.ship.getCloseHauledAngle() : Math.PI/3;
        const upwindThreshold = closeHauled + 0.1; 

        if (Math.abs(angleDiffFromUpwind) < upwindThreshold) {
            // Target is upwind.
            
            // --- NEW: Smart Commitment Break ---
            // If we are on a tack but the target has crossed significantly to the other side, switch immediately.
            const BREAK_THRESHOLD = closeHauled; // Use ship's close-hauled angle to prevent jitter
            if ((this.currentTackDirection === 1 && angleDiffFromUpwind < -BREAK_THRESHOLD) ||
                (this.currentTackDirection === -1 && angleDiffFromUpwind > BREAK_THRESHOLD)) {
                this.tackTimer = 0; // Force timer expiry
            }

            if (this.tackTimer <= 0) {
                // Switch tacks based on which side the target is currently favoring
                if (angleDiffFromUpwind > 0.05) this.currentTackDirection = 1; // Target Right -> Starboard Tack
                else if (angleDiffFromUpwind < -0.05) this.currentTackDirection = -1; // Target Left -> Port Tack
                else this.currentTackDirection *= -1; // Dead center -> Flip

                this.tackTimer = 5000 + Math.random() * 3000; // 5-8 seconds (Short commitment)
            }

            const tackAngle = normalizeAngle(windDirection + (this.currentTackDirection * closeHauled));
            return { x: Math.cos(tackAngle), y: Math.sin(tackAngle) };
        }

        // Target is reachable directly
        return { x: dx / dist, y: dy / dist };
    }
}
