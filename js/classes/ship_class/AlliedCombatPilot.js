/**
 * A specialized combat pilot for player-allied ships.
 * Extends NavyCombatPilot to use its maneuvering logic, but overrides
 * high-level decisions like when to flee or disengage.
 */
class AlliedCombatPilot extends NavyCombatPilot {
    constructor(ship) {
        super(ship);
        this.cachedSeparationVector = { x: 0, y: 0 };
        this.cachedBroadsideVector = { x: 0, y: 0 };
    }

    /**
     * Overrides the Navy logic for combat modes.
     * Allies should be braver and only flee if critically damaged.
     */
    _updateCombatMode(targetShip) {
        const ownHpPercentage = this.ship.hp / this.ship.maxHp;

        // 1. Desperation Mode (Immobilized)
        if (this.ship.getDamageSpeedMultiplier() < 0.1) {
            this.combatMode = 'desperation';
            return;
        }

        // 2. Critical Health Fleeing (< 10%)
        if (ownHpPercentage < 0.10) {
            this.combatMode = 'fleeing';
            return;
        }

        // 3. Default to Pursuing
        this.combatMode = 'pursuing';
    }

    /**
     * Executes "Wingman" combat maneuvers.
     * Prioritizes flanking the target and avoiding the player's line of fire.
     */
    executeCombatManeuver(predictionInfo, windDirection, pathfinder, npcs, cannonballs, volleys, spatialGrid, deltaTime) {
        const ship = this.ship;
        const target = ship.targetShip;
        const player = ship.fleetManager ? ship.fleetManager.flagship : null;

        if (!target || !player) return super.executeCombatManeuver(predictionInfo, windDirection, pathfinder, npcs, cannonballs, volleys, spatialGrid, deltaTime);

        const distToTarget = Math.sqrt((ship.x - target.x)**2 + (ship.y - target.y)**2);

        // --- 1. Calculate Steering Vectors ---

        // A. Terrain Avoidance (High Priority)
        const terrainAvoidanceVector = ship._getAvoidanceVector(windDirection, pathfinder);

        // B. Separation (Avoid crowding player and other allies)
        let sepX = 0, sepY = 0;
        const separationRadius = ship.shipLength * 4; // Generous spacing
        
        if (ship.nearbyContext) {
            for (const other of ship.nearbyContext.ships) {
                if (other === target) continue; // Don't separate from target (we want to chase)
                const dSq = (ship.x - other.x)**2 + (ship.y - other.y)**2;
                if (dSq < separationRadius**2 && dSq > 0) {
                    const d = Math.sqrt(dSq);
                    const pushX = ship.x - other.x;
                    const pushY = ship.y - other.y;
                    // Extra repulsion from Player to avoid blocking them
                    const weight = (other === player) ? 2.0 : 1.0;
                    sepX += (pushX / d) * weight;
                    sepY += (pushY / d) * weight;
                }
            }
        }
        const sepMag = Math.sqrt(sepX*sepX + sepY*sepY);
        if (sepMag > 0) { this.cachedSeparationVector.x = sepX/sepMag; this.cachedSeparationVector.y = sepY/sepMag; } else { this.cachedSeparationVector.x = 0; this.cachedSeparationVector.y = 0; }

        // C. Flanking Vector (The "Wingman" Logic)
        // Calculate angle from Target to Player
        const angleTargetToPlayer = Math.atan2(player.y - target.y, player.x - target.x);
        
        // We want to be at an angle offset from the player (e.g., +90 or -90 degrees)
        // Determine which side is closer to us currently
        const angleTargetToSelf = Math.atan2(ship.y - target.y, ship.x - target.x);
        let angleDiff = angleTargetToSelf - angleTargetToPlayer;
        // Normalize to -PI to PI
        while (angleDiff <= -Math.PI) angleDiff += Math.PI*2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI*2;

        // If we are to the right of the player, flank right (+90). If left, flank left (-90).
        const flankOffset = (angleDiff > 0) ? Math.PI / 2 : -Math.PI / 2;
        const idealAngle = angleTargetToPlayer + flankOffset;

        // Ideal position is at optimal combat range along that angle
        const optimalRange = ship.shipLength * 5;
        const flankX = target.x + Math.cos(idealAngle) * optimalRange;
        const flankY = target.y + Math.sin(idealAngle) * optimalRange;

        // Seek the flank point
        const seekVector = ship._getSeekVector({x: flankX, y: flankY});

        // D. Broadside Alignment (If in position)
        let broadsideVector = this.cachedBroadsideVector; broadsideVector.x = 0; broadsideVector.y = 0;
        if (distToTarget < ship.shipLength * 8) {
             const angleToTarget = Math.atan2(target.y - ship.y, target.x - ship.x); // Simple aim
             let angleDiff = angleToTarget - ship.angle;
             while (angleDiff <= -Math.PI) angleDiff += Math.PI*2;
             while (angleDiff > Math.PI) angleDiff -= Math.PI*2;
             
             const sideDir = Math.sign(angleDiff) || 1;
             const broadsideAngle = angleToTarget - (sideDir * Math.PI / 2);
             broadsideVector.x = Math.cos(broadsideAngle); broadsideVector.y = Math.sin(broadsideAngle);
        }

        // --- 2. Weights ---
        let wTerrain = (terrainAvoidanceVector.steeringWeight !== undefined ? terrainAvoidanceVector.steeringWeight : terrainAvoidanceVector.magnitude) * 30.0;
        let wSeparation = 3.0; // High priority to avoid collisions
        let wFlank = 1.0;
        let wBroadside = 0.0;

        // If we are close to the flank position, prioritize broadside alignment
        const distToFlank = Math.sqrt((ship.x - flankX)**2 + (ship.y - flankY)**2);
        if (distToFlank < ship.shipLength * 3) {
            wBroadside = 2.0;
            wFlank = 0.5;
        }

        // --- 3. Blend ---
        const finalX = (terrainAvoidanceVector.x * wTerrain) + (this.cachedSeparationVector.x * wSeparation) + (seekVector.x * wFlank) + (broadsideVector.x * wBroadside);
        const finalY = (terrainAvoidanceVector.y * wTerrain) + (this.cachedSeparationVector.y * wSeparation) + (seekVector.y * wFlank) + (broadsideVector.y * wBroadside);

        // --- 4. Execute ---
        const finalAngle = Math.atan2(finalY, finalX);
        
        // --- NEW: "Hard Clamp" Logic (Matches NavyCombatPilot) ---
        // If we are prioritizing broadside (wBroadside > wFlank), use clamping to hold the turn at the obstacle edge.
        if (wBroadside > wFlank) {
            let clampedAngle = finalAngle;

            if (terrainAvoidanceVector.obstacles && terrainAvoidanceVector.obstacles.length > 0) {
                const tangentAngle = ship._findTangentAvoidanceAngle(finalAngle, terrainAvoidanceVector.obstacles);
                if (tangentAngle !== null) {
                    const turnToDesired = normalizeAngle(finalAngle - ship.angle);
                    const turnToSafe = normalizeAngle(tangentAngle - ship.angle);

                    // If desired turn goes "past" the safe angle, clamp it.
                    if (Math.sign(turnToDesired) === Math.sign(turnToSafe) && Math.abs(turnToDesired) > Math.abs(turnToSafe)) {
                        clampedAngle = tangentAngle;
                        ship.debugStatus += ' | CLAMPED';
                    }
                }
            }
            ship.targetAngle = ship._findBestSailingAngle(clampedAngle, windDirection);
        } else {
            // Standard Navigation / Lookout Fallback
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

        // Throttle Control
        ship.isSailOpen = true;
        ship.throttle = 1.0;
        if (terrainAvoidanceVector.magnitude > 0) {
             const brakeForce = (terrainAvoidanceVector.brakingWeight !== undefined) ? terrainAvoidanceVector.brakingWeight : terrainAvoidanceVector.magnitude;
             ship.throttle = Math.max(0, 1.0 - brakeForce);
        }

        return true;
    }
}