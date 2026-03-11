/**
 * Represents the player-controlled ship.
 * Extends the base Ship class and adds player-specific input handling and state management.
 */
class PlayerShip extends CustomShip {
    /**
     * @param {number} x - The initial X position in the world.
     * @param {number} y - The initial Y position in the world.
     * @param {object} [options={}] - Customization options for the player ship.
     * @param {object|null} [blueprint=null] - A ship blueprint from the ShipGenerator.
     * @param {string} [options.name='Player'] - The name of the player's ship/captain.
     */
    constructor(x, y, options = {}, blueprint = null) {
        // Call the parent CustomShip's constructor, passing the blueprint and options.
        // The CustomShip constructor will handle applying the blueprint if it exists.
        super(x, y, blueprint, options);

        // --- Player-Specific State ---
        this.lightsOn = true; // Player can toggle ship lights at night
        this.selectedShotType = 'round-shot'; // New: Default shot type
        this.lastShotTypeSelectionTime = performance.now(); // New: Track time of last selection for UI display
        this.isSailOpen = false;
        this.isMovingBackward = false;
        this.sailingForwardToggleOn = false;
        this.isInAnchorRange = false;        
        this.lastFrameActiveInput = false;
        this.isAnchoredAndIdleAligning = false;
        this.collidingFlashTimer = 0; // Timer for the red collision flash effect
        this.turningMomentum = 0; // New: Represents speed memory for turning.
        this.name = options.name || 'Player';
        this.rankIndex = 0; // 0 = Neutral, 1-5 = Pirate Tiers
        
        // --- NEW: Player Statistics for Ranking ---
        this.stats = {
            shipsSunk: 0,
            shipsBoarded: 0,
            combatEngagements: 0
        };

        // --- NEW: Set Display Name and Type for UI ---
        this.displayName = options.shipName || 'Unnamed';
        this.shipType = options.shipType || 'Default';

        // --- New: Calculate Crew Stats for Custom Ship ---
        // Estimate crew based on ship size (sailing crew) and armament (fighting crew).
        const broadside = this.getBroadsideCount();
        const sizeFactor = (this.shipLength * this.shipWidth) / (GRID_SIZE * GRID_SIZE); // Normalized area
        const sailingCrew = Math.round(sizeFactor * 15); // Estimation factor
        const fightingCrew = broadside * 5;
        this.maxCrew = Math.max(20, sailingCrew + fightingCrew); // Ensure at least base crew
        this.crew = this.maxCrew;

        // --- New: Tacking Boost State ---
        this.tackingBoostTimer = 0; // Countdown timer for the boost duration.
        this.wasPointingIntoWind = false; // Flag to track if the ship was pointing into the wind on the previous frame.
        this.tackingBoostDirection = null; // 'left' or 'right', the direction of the tacking turn.

        this.boardingTarget = null; // The ship currently available for boarding
    }

    /**
     * Gets the current rank data object from the global RANKS array.
     */
    get rankData() {
        if (!window.RANKS) return { name: "Neutral", color: "#ecf0f1", iconPath: null };
        return window.RANKS[this.rankIndex] || window.RANKS[0];
    }

    /**
     * Checks if the player meets the requirements for the next rank and promotes them if so.
     * Should be called whenever a relevant stat changes.
     */
    updateRank() {
        if (!window.RANKS) return;

        // Check next rank (current + 1)
        const nextRankIndex = this.rankIndex + 1;
        if (nextRankIndex >= window.RANKS.length) return; // Max rank reached

        const nextRank = window.RANKS[nextRankIndex];
        const reqs = nextRank.requirements;

        if (!reqs) return;

        let promoted = false;

        // Check conditions (OR logic based on prompt)
        if (reqs.combat && this.stats.combatEngagements > 0) promoted = true;
        if (reqs.sunk && this.stats.shipsSunk >= reqs.sunk) promoted = true;
        if (reqs.boarded && this.stats.shipsBoarded >= reqs.boarded) promoted = true;

        if (promoted) {
            this.rankIndex = nextRankIndex;
            console.log(`[Rank Up] Promoted to ${nextRank.name}!`);
            // Recursively check in case multiple ranks are skipped (unlikely but possible)
            this.updateRank();
        }
    }

    /**
     * Overrides the base update method to add player-specific logic for input handling.
     * @param {number} deltaTime - Time elapsed since the last frame in milliseconds.
     * @param {object} keys - The current state of keyboard keys.
     * @param {PlayerShip} player - The player ship instance (unused by itself, but passed for consistency).
     * @param {number} windDirection - The current wind direction in radians.
     * @param {Array<Cannonball>} cannonballs - The array to add new cannonballs to.
     * @param {Array<Volley>} volleys - The array to add new volleys to.
     * @param {Array<Island>} islands - The array of islands (unused by player).
     * @param {Array<NpcShip>} npcs - The array of all NPC ships (unused by player).
     * @param {Pathfinder} pathfinder - The global pathfinder instance (unused by player).
     */
    update(deltaTime, keys, player, windDirection, cannonballs, volleys, islands, npcs, pathfinder) {
        // --- NEW: Use the correct wind model ---
        let windMultiplier;
        // If the ship has the advanced wind model from CustomShip, use it. Otherwise, use the global utility function.
        if (typeof this.getWindSpeedMultiplier === 'function') {
            windMultiplier = this.getWindSpeedMultiplier(this.angle, windDirection);
        } else {
            windMultiplier = getWindSpeedMultiplier(this.angle, windDirection);
        }

        // 1. Process input to determine player's intentions
        this._processInput(keys, cannonballs, volleys);

        // 2. Calculate ship's acceleration and rotation based on intentions
        // Pass the correct wind multiplier to the movement calculation.
        this._calculateMovement(deltaTime, keys, windMultiplier, windDirection);

        // --- FIX: Add missing call to apply anchor physics. ---
        // This calculates anchor line length, which is needed for the UI meter.
        this._applyAnchorPhysics(keys, windDirection);
        // --- FIX: Call super.update() LAST. ---
        // This ensures that base physics (friction, hazard slowdown) are applied *after*
        // the player's input has been processed for the frame, allowing the slowdown
        // effect to work correctly.
        super.update(deltaTime, keys, player, windDirection, cannonballs, volleys, islands, npcs, pathfinder);
    }

    /**
     * Overrides the base draw method to add player-specific visuals like the collision flash.
     * @param {number} zoomLevel - The current camera zoom level.
     */
    drawWorldSpace(ctx, worldToScreenScale, windDirection) {        
        // Call the parent method to draw the entire ship.
        // This will correctly call CustomShip.drawWorldSpace, which handles both default and custom drawing.
        super.drawWorldSpace(ctx, worldToScreenScale, windDirection);

        // Now, draw the red flash overlay on top if the timer is active.
        // We must re-apply the ship's transform because the super.drawWorldSpace()
        // call already restored the canvas context.
        if (this.collidingFlashTimer > 0) {
            const opacity = this.collidingFlashTimer / PLAYER_COLLISION_FLASH_DURATION;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.fillStyle = `rgba(255, 0, 0, ${opacity * 0.5})`;
            ctx.beginPath();
            this.hullBaseVisualPoints.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }
    /**
     * Processes keyboard input to set ship state and fire cannons.
     * @param {object} keys - The current state of keyboard keys.
     * @param {Array<Cannonball>} cannonballs - The array to add new cannonballs to.
     * @param {Array<Volley>} volleys - The array to add new volleys to.
     * @private
     */
    _processInput(keys, cannonballs, volleys) {
        // --- NEW: Disable input if sinking past 50% ---
        if (this.isSinking && (this.sinkHp / this.maxSinkHp > 0.5)) return;

        const isMovementKey = keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight'];
        const isCannonKey = keys[' '] || keys['z'] || keys['Z'] || keys['x'] || keys['X'];

        if (isMovementKey || isCannonKey) {
            this.lastDamageTime = performance.now(); // Reset regen cooldown on activity
        }

        // Determine sail state based on toggle/key inputs
        if (this.sailingForwardToggleOn) {
            this.isSailOpen = true;
            this.isMovingBackward = false;
        } else if (keys['ArrowUp']) { // Player is actively sailing forward
            this.isSailOpen = true;
            this.isMovingBackward = false;
            this.unReef(); // Pressing 'up' to sail forward cancels reefing.
        } else if (keys['ArrowDown']) { // Player is pressing the down arrow
            if (keys['Shift']) {
                // This is a reefing action. Ensure the sails are open to be reefed.
                // This prevents the 'idle' state from keeping them closed.
                this.isSailOpen = true;
            } else {
                this.unReef(); // Pressing 'down' to close sails also cancels reefing.
                // Only close sails and reverse if Shift is NOT held down.
                this.isSailOpen = false;
                this.isMovingBackward = true;
            }
        } else if (!this.isReefed) { // Player is idle AND sails are not reefed
            // If the forward toggle is off and not reefed, close the sails.
            this.isSailOpen = false;
            this.isMovingBackward = false;
        }

        // Handle cannon firing
        if (keys[' ']) { this.fire('port', cannonballs, volleys); this.fire('starboard', cannonballs, volleys); }
        if (keys['z'] || keys['Z']) { this.fire('port', cannonballs, volleys); }
        if (keys['x'] || keys['X']) { this.fire('starboard', cannonballs, volleys); }
    }
    /**
     * New: Toggles the reefed state of the sails.
     */
    toggleReef() {
        this.isReefed = !this.isReefed;
        console.log(`Sails ${this.isReefed ? 'Reefed' : 'Unreefed'}`);
    }

    /**
     * New: Explicitly un-reefs the sails.
     */
    unReef() {
        if (this.isReefed) {
            this.isReefed = false;
            console.log(`Sails Unreefed`);
        }
    }

    /**
     * New: A "smart" firing method that chooses the correct firing logic.
     * If the ship has a blueprint, it uses the advanced broadside method.
     * Otherwise, it uses the basic single-cannon method from the base ship.
     * @param {string} side - 'port' or 'starboard'.
     * @param {Array<Cannonball>} cannonballs - The global array to add new cannonballs to.
     * @param {Array<Volley>} volleys - The global array to add new volleys to.
     */
    fire(side, cannonballs, volleys) {
        // --- NEW: Enforce Shot Type Selection ---
        // Only allow firing if Round Shot or Chain Shot is selected.
        if (this.selectedShotType !== 'round-shot' && this.selectedShotType !== 'chain-shot' && this.selectedShotType !== 'grape-shot' && this.selectedShotType !== 'canister-shot') {
            return false;
        }

        // Use the advanced broadside method which fires all guns on a side.
        return this.fireBroadside(side, cannonballs, volleys);
    }

    /**
     * Checks if a target ship meets the prerequisites for a boarding action.
     * @param {Ship} target - The ship to check against.
     * @returns {boolean} True if boarding can be initiated.
     */
    canInitiateBoarding(target) {
        if (!target || target.hp <= 0) return false;

        // 1. Proximity: Within 1 ship length of the larger ship
        const dist = distance(this, target);
        const maxBoardingDist = Math.max(this.shipLength, target.shipLength) * 1.2;
        if (dist > maxBoardingDist) return false;

        // 2. Stability: Check if ships are actively turning away from each other.
        // We compare the turn direction. If signs are opposite, they might be turning away.
        // Simple check: Are angular velocities diverging?
        // For now, we can check if the target is turning rapidly.
        const targetTurnRate = Math.abs(target.angle - target.lastAngle);
        const myTurnRate = Math.abs(this.angle - this.lastAngle);
        const MAX_STABLE_TURN = 0.05; // Radians per frame
        if (targetTurnRate > MAX_STABLE_TURN || myTurnRate > MAX_STABLE_TURN) return false;

        // 3. Relative Velocity / Speed Matching
        // Calculate relative velocity vector
        const relVx = this.vx - target.vx;
        const relVy = this.vy - target.vy;
        const relativeSpeed = Math.sqrt(relVx * relVx + relVy * relVy);

        // Calculate absolute speeds
        const mySpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const targetSpeed = Math.sqrt(target.vx * target.vx + target.vy * target.vy);

        // Condition A: Matched Speeds (Parallel or similar vectors)
        // If relative speed is low, they are moving together.
        if (relativeSpeed < BOARDING_MAX_SPEED_DIFF) return true;

        // Condition B: Low Absolute Speeds (Slow collision)
        // Allows perpendicular boarding if both are moving slowly (e.g. < 30% max speed).
        if (mySpeed < 3.5 && targetSpeed < 3.5) return true;

        return false;
    }

    /**
     * Calculates and applies ship rotation and acceleration based on state.
     * @param {number} deltaTime - The time elapsed since the last frame.
     * @param {object} keys - The current state of keyboard keys.
     * @param {number} windMultiplier - The calculated wind efficiency multiplier.
     * @param {number} windDirection - The current wind direction in radians.
     * @private
     */
    _calculateMovement(deltaTime, keys, windMultiplier, windDirection) {
        // Update timers (Always run to prevent stuck visuals)
        if (this.collidingFlashTimer > 0) {
            this.collidingFlashTimer--;
        }

        // --- NEW: Disable movement control if sinking past 50% ---
        if (this.isSinking && (this.sinkHp / this.maxSinkHp > 0.5)) return;

        // --- NEW: Update Turning Momentum ---
        // It decays slowly (based on a ship-specific damping factor) and is boosted by the ship's actual speed.
        this.turningMomentum *= this.turningMomentumDamping;

        // --- FIX: Calculate current speed at the beginning for conditional checks. ---
        const currentLinearSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);

        // --- REFACTOR: Encapsulate all turning logic into a helper method ---
        const accelerationPenalty = this._calculateAndApplyTurning(deltaTime, keys, windDirection, currentLinearSpeed);
        this.turningMomentum = Math.max(this.turningMomentum, Math.sqrt(this.vx * this.vx + this.vy * this.vy));

        // --- New: Tacking Boost Logic ---
        // 1. Check the ship's current state relative to the wind.
        let angleToWind = normalizeAngle(this.angle - windDirection);
        if (angleToWind > Math.PI) angleToWind -= 2 * Math.PI; // Normalize to (-PI, PI]

        // NEW: Define the threshold for "pointing into wind" (e.g., +/- 5 degrees)
        const POINTING_INTO_WIND_THRESHOLD = Math.PI / 36; // 5 degrees
        const isCurrentlyPointingIntoWind = Math.abs(angleToWind) < POINTING_INTO_WIND_THRESHOLD;

        // 2. Detect the "tacking" event.
        // This happens when the ship was *not* pointing into the wind last frame but *is* this frame.
        // --- FIX: The tacking boost should only activate if the sails are open. ---
        if (this.isSailOpen && isCurrentlyPointingIntoWind && !this.wasPointingIntoWind) {
            // --- Dynamic Tacking Boost Duration ---
            // The boost duration is now inversely proportional to the ship's maneuverability.
            // A more maneuverable ship gets a shorter, sharper boost, while a sluggish
            // ship gets a longer boost to help it complete the tack.
            const BASE_BOOST_DURATION = 3000; // The duration for a ship with baseline (1.0) maneuverability.
            const dynamicBoostDuration = BASE_BOOST_DURATION / this.maneuverability;

            // Clamp the duration to a reasonable range to prevent extremely long or short boosts.
            const MIN_BOOST_DURATION = 1500; // At least 1.5 seconds
            const MAX_BOOST_DURATION = 4500; // At most 4.5 seconds
            this.tackingBoostTimer = Math.max(MIN_BOOST_DURATION, Math.min(dynamicBoostDuration, MAX_BOOST_DURATION));

            // --- New: Record the direction of the tacking turn ---
            if (keys['ArrowLeft']) {
                this.tackingBoostDirection = 'left';
            } else if (keys['ArrowRight']) {
                this.tackingBoostDirection = 'right';
            }
        }
        this.wasPointingIntoWind = isCurrentlyPointingIntoWind; // Update state for the next frame.

        // 3. Decrement the boost timer.
        if (this.tackingBoostTimer > 0) {
            this.tackingBoostTimer -= deltaTime;
            if (this.tackingBoostTimer < 0) {
                this.tackingBoostTimer = 0;
                this.tackingBoostDirection = null; // Reset boost direction when timer expires.
            }
        }

        // --- FIX: Only allow reversing if forward momentum is expended. ---
        if (this.isMovingBackward && currentLinearSpeed > MIN_TURNING_SPEED_FOR_RADIUS) {
            this.isMovingBackward = false; // Cancel reverse if still moving forward.
        }

        let desiredSpeedMagnitude = 0;
        let desiredAngle = this.angle;

        // Calculate desired speed
        if (this.isSailOpen) {
            desiredSpeedMagnitude = this.baseSpeed * windMultiplier;
        } else if (this.isMovingBackward) {
            desiredSpeedMagnitude = this.baseSpeed * 0.05; // Reduced reverse speed
            desiredAngle = this.angle + Math.PI;
        }
        desiredSpeedMagnitude = Math.max(0, desiredSpeedMagnitude);

        // Apply speed penalty based on current damage.
        desiredSpeedMagnitude *= this.getDamageSpeedMultiplier();

        // For CustomShips, the easing factor is derived from its physically-based acceleration stat.
        // The time constant (in frames) is roughly 1 / easing_factor.
        // We know accelerationStat = baseSpeed / (time_constant_frames).
        // Therefore, the easing factor = 1 / time_constant_frames = accelerationStat / baseSpeed.
        let currentAccelerationFactor = (this.baseSpeed > 0) ? (this.accelerationStat / this.baseSpeed) : SHIP_ACCELERATION_FACTOR;

        currentAccelerationFactor *= accelerationPenalty;

        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        const forwardSpeed = this.vx * cos + this.vy * sin;

        // --- NEW: Power Curve Acceleration ---
        // The acceleration factor is now reduced based on how close the ship is to its top speed.
        let finalAccelerationFactor = currentAccelerationFactor;
        if (desiredSpeedMagnitude > 0.1) {
            const speedRatio = Math.min(1.0, forwardSpeed / desiredSpeedMagnitude);
            const efficiency = Math.pow(1 - speedRatio, ACCELERATION_POWER_CURVE_EXPONENT);
            finalAccelerationFactor *= efficiency;
        }

        // 2. Decompose current velocity into forward and lateral components
        const lateralSpeed = this.vx * (-sin) + this.vy * cos;

        // 3. Apply forward acceleration from sails
        let newForwardSpeed = forwardSpeed;
        if (this.isSailOpen) {
            newForwardSpeed += (desiredSpeedMagnitude - forwardSpeed) * finalAccelerationFactor;
        } else if (this.isMovingBackward) {
            // Apply reverse thrust. Reverse is stronger, but still scaled by the ship's acceleration.
            newForwardSpeed -= desiredSpeedMagnitude * finalAccelerationFactor * 5;
        }

        // 4. Apply strong lateral friction (damping) to prevent sliding
        // The LATERAL_DAMPING_FACTOR from config.js determines how much speed is KEPT.
        const newLateralSpeed = lateralSpeed * (1 - this.lateralDampingFactor);

        // 5. Recombine the components to get the new velocity vector
        this.vx = newForwardSpeed * cos + newLateralSpeed * (-sin);
        this.vy = newForwardSpeed * sin + newLateralSpeed * cos;

        // --- NEW: Directional Island Collision Check ---
        // This happens *after* calculating the intended velocity for the frame.
        if (this.isAgainstIsland && this.islandCollisionNormal) {
            // Project the intended velocity onto the collision normal.
            const dotProduct = this.vx * this.islandCollisionNormal.x + this.vy * this.islandCollisionNormal.y;
            if (dotProduct < 0) {
                // If the dot product is negative, the ship is trying to move INTO the island.
                // In this case, we cancel all velocity.
                this.vx = 0;
                this.vy = 0;
            }
        }
    }

    /**
     * New: Calculates and applies all turning physics for the ship.
     * This includes tacking boosts, dynamic turn rates, and acceleration penalties.
     * @param {number} deltaTime - The time elapsed since the last frame.
     * @param {object} keys - The current state of keyboard keys.
     * @param {number} windDirection - The current wind direction in radians.
     * @param {number} currentLinearSpeed - The ship's current overall speed.
     * @returns {number} The calculated acceleration penalty (a multiplier from 0.0 to 1.0).
     * @private
     */
    _calculateAndApplyTurning(deltaTime, keys, windDirection, currentLinearSpeed) {
        // 1. Calculate Turning Rate based on current speed
        let turnRate;

        // Calculate a dynamic base turn rate based on ship length.
        // This makes smaller ships pivot faster than larger ones.
        const baseTurnRate = BASE_ROTATION_SCALING_FACTOR / Math.pow(this.shipLength, this.shipLengthTurningPower);

        // Base rotation speed only applies if sails are closed AND momentum is expended.
        // New condition: speed must be less than or equal to 5% of base speed, but no lower than MIN_TURNING_SPEED_FOR_RADIUS.
        const pivotThreshold = Math.max(MIN_TURNING_SPEED_FOR_RADIUS, this.baseSpeed * 0.05);
        if (!this.isSailOpen && currentLinearSpeed <= pivotThreshold) {
            // Ship is stationary or nearly stationary AND sails are closed.
            // Only base rotation applies (pivot in place).
            turnRate = baseTurnRate;
        } else {
            // Ship has sails open, OR it has momentum (even with sails closed).
            // Dynamic turning rate applies, scaled by maneuverability.
            const dynamicTurnRate = (this.turningMomentum / Math.pow(this.shipLength, this.shipLengthTurningPower)) / this.dynamicTurningFactor;
            // Apply Rig Turning Multiplier here (affects turning while moving)
            turnRate = Math.max(baseTurnRate, dynamicTurnRate) * this.maneuverability * this.getRigTurningMultiplier();
        }

        // --- NEW: Apply Crew Turning Penalty ---
        turnRate *= this.getCrewTurningMultiplier();

        // 2. Apply the turn to the ship's angle
        if (!keys['ArrowDown']) { // No turning while reversing
            let finalTurnRate = turnRate;

            // --- NEW: Capped Tacking Boost Logic ---
            if (this.tackingBoostTimer > 0 && (this.tackingBoostDirection === 'left' && keys['ArrowLeft']) || (this.tackingBoostDirection === 'right' && keys['ArrowRight'])) {
                // 1. Determine the correct boost multiplier.
                const boostedTurnRate = turnRate * 2.0;

                // 2. Calculate the ship's theoretical maximum turn rate at top speed.
                const maxTurningMomentum = this.baseSpeed; // Cruising speed for custom ships.
                const maxDynamicTurnRate = (maxTurningMomentum / Math.pow(this.shipLength, this.shipLengthTurningPower)) / this.dynamicTurningFactor;
                const maxTurnRate = Math.max(baseTurnRate, maxDynamicTurnRate) * this.maneuverability;

                // 3. Define the cap at 150% of that maximum turn rate.
                const turnRateCap = maxTurnRate * TACKING_BOOST_TURN_RATE_CAP_MULTIPLIER;

                // 4. Apply the boosted rate, but clamp it to the cap.
                finalTurnRate = Math.min(boostedTurnRate, turnRateCap);
            }

            if (keys['ArrowLeft']) {
                // Apply boost only if the tacking direction matches the current turn.
                this.angle -= finalTurnRate;
            }
            if (keys['ArrowRight']) {
                // Apply boost only if the tacking direction matches the current turn.
                this.angle += finalTurnRate;
            }
        }
        this.angle = normalizeAngle(this.angle);

        // 3. Calculate and return the acceleration penalty
        let accelerationPenalty = 1.0;
        const isTurning = keys['ArrowLeft'] || keys['ArrowRight'];
        if (isTurning && !this.isAnchored) {
            // The penalty is proportional to the turn rate, capped by the penalty factor.
            // A faster turn results in a greater loss of acceleration.
            // We use `baseTurnRate` as the denominator to create a consistent penalty scale
            // relative to the ship's inherent pivoting ability.
            const turnRatio = Math.min(1.0, turnRate / baseTurnRate);
            accelerationPenalty = 1.0 - (turnRatio * this.accelerationTurningPenalty);
        }

        return accelerationPenalty;
    }


    /**
     * Applies physics constraints when the ship is anchored.
     * @param {object} keys - The current state of keyboard keys.
     * @param {number} windDirection - The current wind direction in radians.
     * @private
     */
    _applyAnchorPhysics(keys, windDirection) {
        if (!this.isAnchored || !this.anchorPoint) {
            this.anchorLineMaxDistance = 0;
            this.effectiveAnchorLineLength = 0;
            return;
        }

        const currentBow = this.getBowPointWorldCoords();
        const distToBowFromAnchor = distance(this.anchorPoint, currentBow);
        this.anchorLineMaxDistance = distToBowFromAnchor;

        // Clamp position if beyond max allowed length
        const maxAllowedBowDistance = this.shipLength * MAX_ANCHOR_LINE_LENGTH_MULTIPLIER;
        if (distToBowFromAnchor > maxAllowedBowDistance) {
            const angleFromAnchorToBow = Math.atan2(currentBow.y - this.anchorPoint.y, currentBow.x - this.anchorPoint.x);
            const clampedBowX = this.anchorPoint.x + Math.cos(angleFromAnchorToBow) * maxAllowedBowDistance;
            const clampedBowY = this.anchorPoint.y + Math.sin(angleFromAnchorToBow) * maxAllowedBowDistance;

            const bowLocalPoint = { x: SHIP_BOW_LOCAL_X_OFFSET, y: 0 };
            const rotatedBowLocal = rotatePoint(bowLocalPoint, { x: 0, y: 0 }, this.angle);

            this.x = clampedBowX - rotatedBowLocal.x;
            this.y = clampedBowY - rotatedBowLocal.y;
            this.vx = 0;
            this.vy = 0;

        } else {
            // If not clamped, apply idle physics
            const currentActiveInput = (keys['ArrowUp'] || keys['ArrowDown'] || keys['ArrowLeft'] || keys['ArrowRight']);
            if (!currentActiveInput) {
                // If just became idle, capture the current distance
                if (this.effectiveAnchorLineLength === 0) {
                    this.effectiveAnchorLineLength = distToBowFromAnchor;
                }

                // Rotational Alignment: Bow points towards the anchor point
                // --- FIX: The ship should swing from its bow, not its center ---
                const currentBowPoint = this.getBowPointWorldCoords();
                const desiredAngleToAnchor = Math.atan2(this.anchorPoint.y - currentBowPoint.y, this.anchorPoint.x - currentBowPoint.x);
                let angleDifference = normalizeAngle(desiredAngleToAnchor - this.angle);
                if (angleDifference > Math.PI) angleDifference -= 2 * Math.PI;

                // Only apply rotation if the ship isn't already aligned, to prevent jittering.
                // A larger threshold is used here because the positional drift will cause small angle changes.
                const ANGLE_ALIGNMENT_THRESHOLD = 0.05; // ~3 degrees
                if (Math.abs(angleDifference) > ANGLE_ALIGNMENT_THRESHOLD) {
                    this.angle += Math.sign(angleDifference) * ANCHORED_DRIFT_ROTATION_SPEED;
                    this.angle = normalizeAngle(this.angle);
                }

                // Positional Drift: Move towards a point downwind from the anchor
                const angleFromAnchorToTarget = normalizeAngle(windDirection + Math.PI);
                const targetBowX = this.anchorPoint.x + Math.cos(angleFromAnchorToTarget) * this.effectiveAnchorLineLength;
                const targetBowY = this.anchorPoint.y + Math.sin(angleFromAnchorToTarget) * this.effectiveAnchorLineLength;

                const bowLocalPoint = { x: SHIP_BOW_LOCAL_X_OFFSET, y: 0 };
                const rotatedBowLocal = rotatePoint(bowLocalPoint, { x: 0, y: 0 }, this.angle);
                const targetShipCenterX = targetBowX - rotatedBowLocal.x;
                const targetShipCenterY = targetBowY - rotatedBowLocal.y;

                this.x += (targetShipCenterX - this.x) * ANCHORED_IDLE_POSITION_EASE_FACTOR;
                this.y += (targetShipCenterY - this.y) * ANCHORED_IDLE_POSITION_EASE_FACTOR;

                // Dampen velocity more aggressively when idle to prevent "overshooting" the drift target
                this.vx *= 0.8;
                this.vy *= 0.8;
            } else {
                // Player is actively moving, so reset the effective length for the next idle state
                this.effectiveAnchorLineLength = 0;
            }
        }
    }
}
