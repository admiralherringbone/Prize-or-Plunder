/**
 * Represents a generic Non-Player Character (NPC) ship.
 * Extends the base Ship class and adds basic AI for wandering behavior.
 * This class is designed to be a template for more specific NPC types.
 */
class NpcShip extends CustomShip {
    /**
     * @param {number} x - The initial X position in the world.
     * @param {number} y - The initial Y position in the world.
     * @param {object} blueprint - The configuration object for the custom ship.
     * @param {object} [options={}] - Optional parameters (colors, etc.).
     */
    constructor(x, y, blueprint, options = {}) {
        // Call the parent Ship's constructor with NPC-specific values
        super(x, y, blueprint, options);

        // --- FIX: Enforce sail stroke color consistency ---
        // Ensure NPCs have the same 40% darker border as the player.
        this.sailStrokeColor = darkenColor(this.sailColor, 40);

        // --- NEW: Calculate Max Crew based on Blueprint ---
        // Ensure NPCs have enough crew to man their guns and sails (Fighting Crew).
        // This ensures they have a buffer before hitting the minSailingCrew penalty threshold.
        if (this.blueprint) {
            const broadside = this.getBroadsideCount();
            const fightingCrew = broadside * 5; 
            this.maxCrew = Math.max(20, this.minSailingCrew + fightingCrew);
        }

        this.archetypeName = options.archetypeName || 'Unknown'; // New property
        this.displayName = options.shipName || options.displayName || this.archetypeName; // Use specific name if available, else archetype
        this.shipType = options.shipType || this.archetypeName; // For consistent UI property access
        this.inventory = options.inventory || null; // Restore inventory if provided
        // --- AI Components ---
        this.combatPilot = new CombatPilot(this); // All combat logic is delegated here.

        this.shipId = 'NPC'; // Generic ID, will be overwritten by subclasses
        // --- AI State ---
        this.destinationIsland = null; // The Island object the ship is navigating towards
        this.sailingSkill = getRandomArbitrary(0.7, 1.0); // How effectively the NPC uses the wind
        this.aiState = 'navigating'; // 'navigating', 'arriving', 'docked', 'departing', 'combat', 'fleeing'
        this.wasHitThisFrame = false; // A flag to indicate if the ship was hit by the player this frame.
        this.hasBeenAttackedByPlayer = false; // Flag for AI state changes (e.g., for Merchants).
        this.hasBeenBoardedByPlayer = false; // New: Flag for player ranking stats
        this.debugLogTimer = 0; // Timer for throttled logging.
        this.surrenderCheckTimer = 0; // New: Timer for surrender checks.
        this.surrenderTimer = SURRENDER_TIMEOUT_MS; // New: Countdown for surrendered state.
        this.isBeingInteractedWith = false; // New: Flag set by game loop when inventory is open.
        this.debugStatus = ''; // For logging the AI's current action
        this.dockedTimer = 0; // Timer for how long to stay "docked" at an island.
        this.targetShip = null; // The ship this NPC is currently targeting.
        this.pausedPathfindingDestination = null; // To remember where we were going before combat.
        this.turningMomentum = 0; // New: Represents speed memory for turning, mirrors PlayerShip.
        this.isMovingBackward = false; // New: State for reversing.
        this.reverseTimer = 0; // New: Timer for how long to reverse.


        // --- AI Failsafe State ---
        this.lastDistanceToWaypoint = Infinity;
        this.stuckTimer = 0;
        this.pathProgressTimer = 0; // New: Tracks time spent trying to reach the current waypoint.
        this.pathingFailureCooldown = 0; // Cooldown after failing to find any path.
        this.repathFromEvasionCooldown = 0; // Cooldown after evasion clears a path.
        this.pathDeviationTimer = 0; // New: Timer for checking cross-track error.
        this.currentSegmentStart = null; // New: Tracks the start of the current path segment.
        this.consecutivePathingFailures = 0; // New: Track repeated pathfinding failures.

        // --- Pathfinding State ---
        this.targetAngle = this.angle; // The angle the ship is trying to reach
        this.tackDirection = 0; // 0 = not tacking, 1 = starboard tack, -1 = port tack
        this.pathWaypoints = []; // A list of {x, y} points to follow
        this.currentWaypointIndex = 0;
        this.nextPathWaypoints = []; // Pre-calculated path for the next journey.
        this.whiskerHits = {}; // To store results from the new multi-whisker array
        this.debugWhiskerLines = []; // New: For drawing whiskers
        this.debugLookoutLines = []; // New: For drawing the Lookout's predictive scan
        this.debugTangentTarget = null; // New: For visualizing the Tangent Navigation target
        this.debugSafetyBubble = null; // New: For visualizing ship avoidance bubble
        this.stagingPoint = null; // A point just outside an island's anchor zone.
        this.avoidanceStuckTimer = 0; // New: Timer to detect if avoidance is taking too long.
        this.isPerformingAvoidancePivot = false; // New: Flag to lock the ship into a pivot maneuver.
        this.avoidanceTargetAngle = 0; // New: The angle we are committed to pivoting towards.
        this.avoidanceDirectionLock = null; // --- NEW: 'port' or 'starboard' to commit to a turn direction ---
        this.lockedAvoidanceTarget = null; // --- NEW: Persistent reference to the ship we are avoiding ---
        
        // --- NEW: Avoidance Persistence ---
        this.avoidancePersistenceTimer = 0; // Timer to keep avoiding even if whiskers clear momentarily.
        this.lastAvoidanceAngle = 0; // Store the calculated avoidance angle.
        this.lastAvoidanceType = null; // Store the type of the last obstacle avoided.
        this.avoidanceCumulativeTimer = 0; // New: Accumulator for avoidance time to trigger repathing.
        this.debugVMGData = []; // New: For visualizing VMG calculations
        this.predictiveTurnTimer = Math.random() * 200; // New: Timer to throttle predictive turn safety checks.
        this.turnSafetyFactor = 1.0; // New: Cached result of the turn safety check.
        this.throttle = 1.0; // New: Speed control (0.0 to 1.0) for smoother avoidance.
        this.throttleReason = null; // New: Debug string to explain throttle reduction.
        this.sailableAngleCache = { lastCheck: 0, lastBaseAngle: 0, lastResult: 0, checkWalkable: false }; // New: Cache for expensive path checks
        this.cachedClearanceCells = 0; // New: Cache for whisker collision checks
        this.nearbyContext = { ships: [], volleys: [], obstacles: [] }; // New: Cached surroundings

        // --- NEW: Display State ---
        this.isHovered = false;
        this.displayTimer = 0; // Timer for showing stats after interaction
        this.fadeTimer = 0; // Timer for fading out the display
        this.sensorUpdateTimer = 0; // New: Timer to throttle expensive sensor updates

        // --- NEW: Restore state from options if provided by WorldManager ---
        this.hp = options.hp ?? this.maxHp;
        if (options.angle !== undefined) this.angle = options.angle; // Restore orientation
        this.crew = options.crew ?? this.maxCrew; // Restore crew if provided
        this.aiState = options.aiState || 'navigating';
        this.destinationIsland = options.destinationIsland || null;
        this.pathWaypoints = options.pathWaypoints || [];
        this.currentWaypointIndex = options.currentWaypointIndex || 0;
        this.previousDestinationIsland = options.previousDestinationIsland || null;

        // Calculate beam whisker length multiplier (ratio of width to length)
        const beamMult = (this.shipLength > 0) ? (this.shipWidth / this.shipLength) : 0.5;
        const frontMult = 6.0;
        // Interpolate lengths for intermediate angles (0 to 90 degrees)
        const mult15 = frontMult + (beamMult - frontMult) * (1/6);
        const mult30 = frontMult + (beamMult - frontMult) * (2/6);
        const mult45 = frontMult + (beamMult - frontMult) * (3/6);
        const mult60 = frontMult + (beamMult - frontMult) * (4/6);

        // --- OPTIMIZATION: Pre-allocate sensor arrays ---
        this.terrainWhiskers = [
            { name: 'front', angle: 0, rangeMult: frontMult },
            { name: 'port-15', angle: -Math.PI / 12, rangeMult: mult15 },
            { name: 'starboard-15', angle: Math.PI / 12, rangeMult: mult15 },
            { name: 'port-30', angle: -Math.PI / 6, rangeMult: mult30 },
            { name: 'starboard-30', angle: Math.PI / 6, rangeMult: mult30 },
            { name: 'port-45', angle: -Math.PI / 4, rangeMult: mult45 },
            { name: 'starboard-45', angle: Math.PI / 4, rangeMult: mult45 },
            { name: 'port-60', angle: -Math.PI / 3, rangeMult: mult60 },
            { name: 'starboard-60', angle: Math.PI / 3, rangeMult: mult60 },
            // --- NEW: Beam Whiskers (90 degrees) ---
            { name: 'port-90', angle: -Math.PI / 2, rangeMult: beamMult },
            { name: 'starboard-90', angle: Math.PI / 2, rangeMult: beamMult }
        ];

        // --- OPTIMIZATION: Cache objects for avoidance to reduce GC ---
        // Pre-allocate boundary obstacle structures (one for X axis, one for Y axis)
        this._cachedBoundaryObstacleX = {
            type: 'boundary',
            convexHull: [{x:0,y:0}, {x:0,y:0}, {x:0,y:0}, {x:0,y:0}]
        };
        this._cachedBoundaryObstacleY = {
            type: 'boundary',
            convexHull: [{x:0,y:0}, {x:0,y:0}, {x:0,y:0}, {x:0,y:0}]
        };
        this._cachedBoundaryList = []; // Reusable array for boundary obstacles
        this._cachedAvoidanceResult = { x: 0, y: 0, magnitude: 0, type: null, brakingWeight: 0, steeringWeight: 0, obstacles: [] };
        this._cachedObstaclesArray = []; // --- OPTIMIZATION: Reusable array for obstacle deduplication ---
        this._cachedSeekVector = { x: 0, y: 0 }; // --- OPTIMIZATION: Reusable vector for seeking ---
        this._cachedWaypointVector = { x: 0, y: 0 }; // --- OPTIMIZATION: Reusable vector for waypoint following ---
        
        // Pre-allocate whisker points
        this._cachedWhiskerStart = { x: 0, y: 0 };
        this._cachedWhiskerEnd = { x: 0, y: 0 };

        // --- OPTIMIZATION: Sensor Hit Pooling ---
        this._hitPool = []; 
        this._activeHits = [];
        this._cachedTangentPoint = { x: 0, y: 0 }; // Reusable point for tangent calcs
        this._cachedBestTangentPoint = { x: 0, y: 0 }; // Reusable point for best tangent
    }

    /**
     * Returns the close-hauled angle (minimum angle to wind) for this ship.
     * This ensures the pathfinder generates valid paths for the specific rig.
     * @returns {number} Angle in radians.
     */
    getCloseHauledAngle() {
        if (!this.blueprint || !this.blueprint.layout || !this.blueprint.layout.rigType) {
            return Math.PI / 3; // Default 60 degrees
        }

        const rigType = this.blueprint.layout.rigType;
        switch (rigType) {
            case 'sloop':
            case 'fore-and-aft-sloop':
            case 'schooner':
            case 'three-mast-schooner':
                return Math.PI / 4; // 45 degrees
            case 'brig':
            case 'brigantine':
            case 'barquentine':
                return 50 * (Math.PI / 180); // 50 degrees
            default:
                return Math.PI / 3; // 60 degrees (Square riggers)
        }
    }

    /**
     * Calculates the minimum sailing crew and fighting crew based on the ship's blueprint.
     * Restored for compatibility with subclasses like NavyShip.
     * @returns {{sailing: number, fighting: number}}
     * @protected
     */
    _calculateCrewRequirements() {
        if (!this.blueprint) return { sailing: 20, fighting: 20 };

        // Use the new method in CustomShip for sailing crew
        const minSailingCrew = this._calculateMinSailingCrew();
        
        // Calculate fighting crew based on broadside
        const broadsideGuns = this.getBroadsideCount();
        const minFightingCrew = minSailingCrew + (broadsideGuns * 5);

        return { sailing: minSailingCrew, fighting: minFightingCrew };
    }

    /**
     * New: Performs a single spatial query to gather all relevant neighbors.
     * This reduces the overhead of multiple systems querying the grid independently.
     * @private
     */
    _scanSurroundings(spatialGrid) {
        // --- OPTIMIZATION: Increase scan range to cover the longest whisker (Front: 6x) ---
        const scanRange = this.shipLength * 6.5; 
        const queryAABB = {
            minX: this.x - scanRange, minY: this.y - scanRange,
            maxX: this.x + scanRange, maxY: this.y + scanRange
        };
        const neighbors = spatialGrid.query(queryAABB);
        
        this.nearbyContext.ships.length = 0;
        this.nearbyContext.volleys.length = 0;
        this.nearbyContext.obstacles.length = 0;

        for (const obj of neighbors) {
            if (obj === this) continue;
            if (obj.type === 'ship') this.nearbyContext.ships.push(obj);
            else if (obj.type === 'volley') this.nearbyContext.volleys.push(obj);
            else if (obj.type === 'island' || obj.type === 'rock' || obj.type === 'shoal' || obj.type === 'coralReef') this.nearbyContext.obstacles.push(obj);
        }
    }

    /**
     * Overrides the base update method to add AI logic.
     * @param {number} deltaTime - Time elapsed since the last frame in milliseconds.
     * @param {object} [keys={}] - The state of keyboard keys (unused by NPC).
     * @param {PlayerShip} player - The player ship instance, used for AI targeting.
     * @param {number} windDirection - The current wind direction in radians.
     * @param {Array<Cannonball>} cannonballs - The array to add new cannonballs to.
     * @param {Array<Volley>} volleys - The array to add new volleys to.
     * @param {Array<Island>} islands - The array of all islands for navigation.
     * @param {Array<NpcShip>} npcs - The array of all NPC ships for context.
     * @param {Pathfinder} pathfinder - The global pathfinder instance.
     * @param {SpatialGrid} spatialGrid - The global spatial grid for efficient queries.
     */
    update(deltaTime, keys = {}, player, windDirection, cannonballs, volleys, islands, npcs, pathfinder, spatialGrid) {
        // --- NEW: Sinking State ---
        // If sinking, skip all AI logic. Just drift and sink.
        if (this.isSinking) {
            this.debugStatus = `Sinking... ${(this.sinkHp / this.maxSinkHp * 100).toFixed(0)}%`;
            super.update(deltaTime, keys, player, windDirection, cannonballs, volleys, islands, npcs, pathfinder, spatialGrid);
            return;
        }

        // --- NEW: Force Surrendered State Compliance ---
        // If surrendered, the ship drifts. No AI logic runs.
        if (this.aiState === 'surrendered') {
            this.isSailOpen = false;
            this.isMovingBackward = false;
            this.targetAngle = this.angle;
            this.debugStatus = 'Surrendered';

            // --- NEW: Surrender Timer Logic ---
            if (this.isBeingInteractedWith) {
                // Reset and pause timer while being boarded/looted
                this.surrenderTimer = SURRENDER_TIMEOUT_MS;
            } else {
                this.surrenderTimer -= deltaTime;
                if (this.surrenderTimer <= 0) {
                    if (this.crew > 0) {
                        console.log(`[${this.shipId}] Surrender timer elapsed. Crew recovering ship.`);
                        this.aiState = 'navigating';
                        this.targetShip = null;
                        this.pausedPathfindingDestination = null;
                        this.destinationIsland = null;
                        this.pathWaypoints = [];
                        this.resetFailsafeState();
                    } else {
                        // --- NEW: Slow Decay instead of immediate scuttle ---
                        // Lose 1% of Max HP per second.
                        const decayRate = 0.01; 
                        const hullDamage = (this.maxHp * decayRate) * (deltaTime / 1000);
                        const rigDamage = (this.maxRigHp * decayRate) * (deltaTime / 1000);
                        
                        this.takeDamage(hullDamage);
                        this.takeRigDamage(rigDamage);
                        
                        this.debugStatus = 'Surrendered (Decaying)';
                    }
                }
            }

            // --- FIX: Clear debug visuals so they don't persist and drift ---
            this.debugWhiskerLines = [];
            if (this.combatPilot) {
                this.combatPilot.debugFireZone = null;
                this.combatPilot.debugBroadsideBoxes = [];
                this.combatPilot.debugTargetBox = null;
            }

            // We still call super.update to apply physics (drifting), but we skip AI.
            // We also call _calculateMovement to ensure deceleration happens.
            this._calculateMovement(deltaTime, windDirection, pathfinder, npcs, player);
            super.update(deltaTime, keys, player, windDirection, cannonballs, volleys, islands, npcs, pathfinder);
            return;
        } else {
            // Reset timer if not surrendered, so it starts fresh next time
            this.surrenderTimer = SURRENDER_TIMEOUT_MS;
        }

        // --- NEW: Update Display Timer ---
        if (this.isHovered || this.displayTimer > 0) {
            if (this.displayTimer > 0) this.displayTimer -= deltaTime;
            this.fadeTimer = 1000; // Keep fade timer reset to 1s while active
        } else if (this.fadeTimer > 0) {
            this.fadeTimer -= deltaTime;
        }

        this.debugStatus = 'Idle';    // Reset debug status.

        // --- Tier 2: The Pilot (Tactical Navigation) ---
        // The Pilot is responsible for all tactical decisions, including path following
        // and local obstacle avoidance. There is no longer a separate "Lookout" layer.
        this._runPilotBehaviors(deltaTime, islands, windDirection, player, cannonballs, volleys, npcs, pathfinder, spatialGrid);



        // --- Throttled Logging for specific NPC types ---
        if (this.constructor.name === 'NavyShip' || this.constructor.name === 'MerchantShip') {
            this._runThrottledLogging(deltaTime);
        }

        // 2. Calculate and apply movement based on AI intentions
        this._calculateMovement(deltaTime, windDirection, pathfinder, npcs, player);

        // --- FIX: Call super.update() LAST. ---
        // This ensures that base physics (friction, hazard slowdown) are applied *after*
        // the AI's intentions have been processed for the frame, allowing the slowdown
        // effect to work correctly.
        super.update(deltaTime, keys, player, windDirection, cannonballs, volleys, islands, npcs, pathfinder, spatialGrid);
        this.wasHitThisFrame = false; // Reset per-frame flags at the END of the frame.
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
        // Surrendered ships cannot fire.
        if (this.aiState === 'surrendered') {
            return false;
        }

        // Check if this ship has the broadside method (from CustomShip).
        if (this.blueprint && typeof this.fireBroadside === 'function') {
            return this.fireBroadside(side, cannonballs, volleys);
        }
        
        // Otherwise, fall back to the basic method from the parent Ship class.
        return this.fireCannonball(side, cannonballs, volleys);
    }

    /**
     * New: The "Sense" phase of the AI. Updates the ship's "sensors" by casting whiskers
     * to detect nearby obstacles. This is called once at the beginning of every AI tick
     * to ensure all subsequent logic for the frame operates on up-to-date information.
     * @private
     */
    _updateSensors(pathfinder, npcs, player, spatialGrid) {
        if (!pathfinder) {
            return; 
        }

        // Failsafe: Ensure terrainWhiskers exists
        if (!this.terrainWhiskers || this.terrainWhiskers.length === 0) {
            this._initWhiskers();
        }

        // Clear previous frame's data using pooling
        this._releaseHits();
        // Failsafe: Ensure debug array exists
        if (!this.debugWhiskerLines) this.debugWhiskerLines = [];
        this.debugWhiskerLines.length = 0;

        // --- 1. Terrain Detection (Long Range Rays) ---
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);

        const start = this._cachedWhiskerStart;
        const end = this._cachedWhiskerEnd;

        // Failsafe: Ensure nearbyContext exists
        if (!this.nearbyContext) {
            this.nearbyContext = { ships: [], volleys: [], obstacles: [] };
        }

        for (const w of this.terrainWhiskers) {
            const range = (this.shipLength || SHIP_TARGET_LENGTH) * w.rangeMult;
            const wa = this.angle + w.angle;
            const wx = Math.cos(wa) * range;
            const wy = Math.sin(wa) * range;
            
            start.x = this.x; start.y = this.y;
            if (w.name === 'front') {
                const noseOffset = this.shipLength * 0.4;
                start.x += noseOffset * cos;
                start.y += noseOffset * sin;
            }
            end.x = start.x + wx; end.y = start.y + wy;
            
            const tempHit = this._getHitFromPool();
            const hit = this._castTerrainRay(start, end, pathfinder, this.nearbyContext.obstacles || [], tempHit);
            
            if (hit) {
                if (!this.whiskerHits[w.name] || hit.distSq < this.whiskerHits[w.name].distSq) {
                    this.whiskerHits[w.name] = hit;
                    this._activeHits.push(hit);
                } else {
                    this._hitPool.push(hit); // Recycle if not used
                }
            } else {
                this._hitPool.push(tempHit); // Recycle if no hit found
            }
            if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
                this.debugWhiskerLines.push({ start: {x: start.x, y: start.y}, end: {x: end.x, y: end.y}, hit: !!hit });
            }
        }

        // --- 2. Ship Detection (Projecting onto Whiskers) ---
        for (const otherShip of (this.nearbyContext.ships || [])) {
            if (otherShip === this) continue;

            const dx = otherShip.x - this.x;
            const dy = otherShip.y - this.y;
            const distSq = dx*dx + dy*dy;

            // Broad phase check: Max whisker range + target radius (to detect edge)
            const maxWhiskerRange = (this.shipLength * 6.5) + (otherShip.shipLength * 0.5);
            if (distSq > maxWhiskerRange * maxWhiskerRange) continue;

            // Project ship's position into our local space
            const localX = dx * cos + dy * sin;
            const localY = -dx * sin + dy * cos;

            // If behind us (and not overlapping our center), ignore
            if (localX < -otherShip.shipLength * 0.5) continue;

            // Find the angle to the other ship in our local space
            const angleToOther = Math.atan2(localY, localX);

            // Find the whisker that is closest to this angle
            let closestWhisker = null;
            let minAngleDiff = Infinity;

            for (const w of this.terrainWhiskers) {
                // We only care about forward-facing whiskers for ship avoidance
                if (Math.abs(w.angle) > Math.PI / 2 + 0.1) continue;

                const angleDiff = Math.abs(w.angle - angleToOther);
                if (angleDiff < minAngleDiff) {
                    minAngleDiff = angleDiff;
                    closestWhisker = w;
                }
            }

            if (!closestWhisker) continue;

            // If the ship is within the range of the closest whisker...
            // Add target radius to range so we detect the hull, not just the center
            const whiskerRange = (this.shipLength * closestWhisker.rangeMult) + (otherShip.shipLength * 0.5);
            
            if (distSq < whiskerRange * whiskerRange) {
                // ...and it's not moving away from us...
                const relVx = otherShip.vx - this.vx;
                const relVy = otherShip.vy - this.vy;
                if (relVx * dx + relVy * dy > 0) continue;

                // ...then register a hit on that whisker.
                const hit = this._getHitFromPool();
                hit.type = 'ship';
                hit.x = otherShip.x;
                hit.y = otherShip.y;
                hit.distSq = distSq;
                hit.ship = otherShip;

                if (!this.whiskerHits[closestWhisker.name] || distSq < this.whiskerHits[closestWhisker.name].distSq) {
                    this.whiskerHits[closestWhisker.name] = hit;
                    this._activeHits.push(hit);
                } else {
                    this._hitPool.push(hit);
                }

                // --- NEW: Visual Debug for Ship Detection ---
                if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
                    this.debugWhiskerLines.push({ 
                        start: {x: this.x, y: this.y}, 
                        end: {x: otherShip.x, y: otherShip.y}, 
                        hit: true, isShip: true 
                    });
                }
            }
        }

    }

    _getHitFromPool() {
        if (this._hitPool.length > 0) return this._hitPool.pop();
        return { type: '', x: 0, y: 0, distSq: 0, ship: null, normal: {x:0, y:0}, obstacle: null };
    }

    _releaseHits() {
        // Return all active hits to the pool
        while (this._activeHits.length > 0) {
            const hit = this._activeHits.pop();
            hit.ship = null; hit.obstacle = null; // Clear references
            this._hitPool.push(hit);
        }
        // Clear the map keys without creating a new object
        for (const key in this.whiskerHits) delete this.whiskerHits[key];
    }

    /**
     * Helper to initialize the whisker configuration.
     * @private
     */
    _initWhiskers() {
        const beamMult = (this.shipLength > 0) ? (this.shipWidth / this.shipLength) : 0.5;
        const frontMult = 6.0;
        const mult15 = frontMult + (beamMult - frontMult) * (1/6);
        const mult30 = frontMult + (beamMult - frontMult) * (2/6);
        const mult45 = frontMult + (beamMult - frontMult) * (3/6);
        const mult60 = frontMult + (beamMult - frontMult) * (4/6);

        this.terrainWhiskers = [
            { name: 'front', angle: 0, rangeMult: frontMult },
            { name: 'port-15', angle: -Math.PI / 12, rangeMult: mult15 },
            { name: 'starboard-15', angle: Math.PI / 12, rangeMult: mult15 },
            { name: 'port-30', angle: -Math.PI / 6, rangeMult: mult30 },
            { name: 'starboard-30', angle: Math.PI / 6, rangeMult: mult30 },
            { name: 'port-45', angle: -Math.PI / 4, rangeMult: mult45 },
            { name: 'starboard-45', angle: Math.PI / 4, rangeMult: mult45 },
            { name: 'port-60', angle: -Math.PI / 3, rangeMult: mult60 },
            { name: 'starboard-60', angle: Math.PI / 3, rangeMult: mult60 },
            { name: 'port-90', angle: -Math.PI / 2, rangeMult: beamMult },
            { name: 'starboard-90', angle: Math.PI / 2, rangeMult: beamMult }
        ];
    }

    /**
     * Draws debug lines from the cannons to show the ship's line of fire.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} worldToScreenScale - The current camera zoom level.
     */
    drawAimingLine(ctx, worldToScreenScale) {
        if (this.aiState !== 'combat' && this.aiState !== 'fleeing') {
            return; // Only draw when in combat or fleeing
        }

        if (this.combatPilot && this.combatPilot.debugAimVectors) {
            ctx.save();
            ctx.lineWidth = 2 / worldToScreenScale;
            
            this.combatPilot.debugAimVectors.forEach(vec => {
                ctx.strokeStyle = vec.color;
                if (vec.dashed) {
                    ctx.setLineDash([10 / worldToScreenScale, 10 / worldToScreenScale]);
                } else {
                    ctx.setLineDash([]);
                }
                ctx.beginPath();
                ctx.moveTo(vec.start.x, vec.start.y);
                ctx.lineTo(vec.end.x, vec.end.y);
                ctx.stroke();
            });
            
            ctx.restore();
        }
    }

    /**
     * A universal recovery mechanism for when a ship with a path finds itself on an unwalkable node.
     * @param {Pathfinder} pathfinder - The global pathfinder instance.
     * @param {number} windDirection - The current wind direction.
     * @private
     */
    _recoverFromStuckPosition(pathfinder, windDirection) {
        // --- NEW: Reverse Maneuver ---
        // Instead of trying to turn (which might be blocked), reverse away from the obstacle.
        this.debugStatus = 'Stuck: Reversing';
        this.isSailOpen = false;
        this.isMovingBackward = true;
        this.reverseTimer = 2000; // Reverse for 2 seconds.
    }

    /**
     * Handles the throttled logging for debugging purposes.
     * @param {number} deltaTime - The time elapsed since the last frame.
     * @private
     */
    _runThrottledLogging(deltaTime) {
        this.debugLogTimer += deltaTime;
        if (this.debugLogTimer >= DEBUG.LOG_THROTTLE_MS) {
            if (this.aiState === 'combat' || this.aiState === 'fleeing') {
                console.log(`[${this.shipId} AI Tick] State: ${this.aiState} | Status: ${this.debugStatus} | Target Angle: ${this.targetAngle.toFixed(2)} | Current Angle: ${this.angle.toFixed(2)}`);
            }
            this.debugLogTimer = 0; // Reset timer
        }
    }

    /**
     * Calculates and applies ship rotation and acceleration based on AI state.
     * @param {number} windDirection - The current wind direction in radians.
     * @private
     */
    _calculateMovement(deltaTime, windDirection, pathfinder, npcs, player) {
        // --- New: Update Turning Momentum (Mirrors PlayerShip) ---
        this.turningMomentum *= this.turningMomentumDamping;
        this.turningMomentum = Math.max(this.turningMomentum, Math.sqrt(this.vx * this.vx + this.vy * this.vy));

        // --- Turning Logic ---
        let angleDiff = this.targetAngle - this.angle;
        if (angleDiff > Math.PI) { angleDiff -= 2 * Math.PI; }
        if (angleDiff < -Math.PI) { angleDiff += 2 * Math.PI; }

        if (this.isSailOpen || Math.abs(angleDiff) > 0.01) {
            this.performAction();
        }

        // --- New: Unified Turn Rate Calculation (Mirrors PlayerShip) ---
        const currentLinearSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        let turnRate;

        const baseTurnRate = BASE_ROTATION_SCALING_FACTOR / Math.pow(this.shipLength, this.shipLengthTurningPower);
        const pivotThreshold = Math.max(MIN_TURNING_SPEED_FOR_RADIUS, this.baseSpeed * 0.05);

        if (!this.isSailOpen && currentLinearSpeed <= pivotThreshold) {
            // Stationary pivot turn. Maneuverability stat does not apply.
            turnRate = baseTurnRate;
        } else {
            // Dynamic turning at speed. Maneuverability stat applies.
            const dynamicTurnRate = (this.turningMomentum / Math.pow(this.shipLength, this.shipLengthTurningPower)) / this.dynamicTurningFactor;
            // Apply Rig Turning Multiplier here (affects turning while moving)
            turnRate = Math.max(baseTurnRate, dynamicTurnRate) * this.maneuverability * this.getRigTurningMultiplier();
        }

        // --- NEW: Apply Crew Turning Penalty ---
        turnRate *= this.getCrewTurningMultiplier();

        // --- New: Predictive Turn Safety Check ---
        // Before committing to a turn, look ahead along the turning arc to see if it's safe.
        // This is especially important in combat to prevent collisions with other ships. This now runs
        // --- OPTIMIZATION: Throttle this expensive check ---
        const isEngagedInCombat = (this.aiState === 'combat' || this.aiState === 'fleeing' || this.aiState === 'desperation');
        
        this.predictiveTurnTimer -= deltaTime;
        if (isEngagedInCombat && this.predictiveTurnTimer <= 0) {
            this.predictiveTurnTimer = 200 + Math.random() * 50; // Run approx 5 times/sec
            this.turnSafetyFactor = 1.0; // Reset to full speed

            if (Math.abs(angleDiff) > 0.01) {
                const turnDirection = Math.sign(angleDiff);
                const simulationTime = 1.0; // seconds
                const steps = 3; // Reduced steps from 5 to 3 for performance
                let lastPoint = { x: this.x, y: this.y };
                
                for (let i = 1; i <= steps; i++) {
                    const t = (i / steps) * simulationTime;
                    const futureAngle = normalizeAngle(this.angle + turnDirection * turnRate * (t * 60)); 
                    const futureSpeed = currentLinearSpeed; 
                    const futureX = lastPoint.x + Math.cos(futureAngle) * futureSpeed * (simulationTime / steps);
                    const futureY = lastPoint.y + Math.sin(futureAngle) * futureSpeed * (simulationTime / steps);
                    const nextPoint = { x: futureX, y: futureY };
                    // OPTIMIZATION: Use simplified convex hull check for predictive turning.
                    // This is faster than full geometry and safer than grid checks for irregular shapes.
                    if (!pathfinder.isLineOfSightClear(lastPoint, nextPoint, [], true, this.nearbyContext.obstacles)) { 
                        this.turnSafetyFactor = 0.5; // Slow down turn
                        break;
                    }
                    lastPoint = nextPoint;
                }
            }
        }

        // Apply cached safety factor
        if (this.turnSafetyFactor < 1.0) {
            turnRate *= this.turnSafetyFactor;
            this.debugStatus += ' | Widening Turn';
        }

        // --- FIX: Apply turn rate without the extra maneuverability multiplier ---
        if (Math.abs(angleDiff) > turnRate) {
            this.angle += Math.sign(angleDiff) * turnRate;
        } else {
            this.angle = this.targetAngle;
        }
        this.angle = normalizeAngle(this.angle);

        // --- REVISED ACCELERATION & DAMPING LOGIC (Mirrors PlayerShip) ---
        let desiredSpeedMagnitude = 0;
        if (this.isSailOpen) {
            // --- FIX: Use the ship's own wind model, not the global utility. ---
            const windMultiplier = (typeof this.getWindSpeedMultiplier === 'function')
                ? this.getWindSpeedMultiplier(this.angle, windDirection)
                : getWindSpeedMultiplier(this.angle, windDirection);
            desiredSpeedMagnitude = this.baseSpeed * windMultiplier * this.sailingSkill * this.throttle;
        } else if (this.isMovingBackward) {
            // Apply a slow reverse speed. Matches PlayerShip.
            desiredSpeedMagnitude = this.baseSpeed * 0.05;
        }

        // Apply speed penalty based on current damage.
        desiredSpeedMagnitude *= this.getDamageSpeedMultiplier();

        // --- FIX: Use the correct, blueprint-derived acceleration stat. ---
        let currentAccelerationFactor;
        if (this.blueprint && this.accelerationStat !== undefined && this.baseSpeed > 0) {
            currentAccelerationFactor = this.accelerationStat / this.baseSpeed;
        } else {
            currentAccelerationFactor = SHIP_ACCELERATION_FACTOR;
        }

        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        const forwardSpeed = this.vx * cos + this.vy * sin;

        // Power Curve Acceleration
        let finalAccelerationFactor = currentAccelerationFactor;
        if (desiredSpeedMagnitude > 0.1) {
            const speedRatio = Math.min(1.0, forwardSpeed / desiredSpeedMagnitude);
            const efficiency = Math.pow(1 - speedRatio, ACCELERATION_POWER_CURVE_EXPONENT);
            finalAccelerationFactor *= efficiency;
        }

        // Decompose, apply forces, and recombine
        const lateralSpeed = this.vx * (-sin) + this.vy * cos;

        let newForwardSpeed = forwardSpeed;
        if (this.isSailOpen) {
            newForwardSpeed += (desiredSpeedMagnitude - forwardSpeed) * finalAccelerationFactor;
        } else if (this.isMovingBackward) {
            // Apply reverse thrust. Reverse is stronger to help unstuck quickly.
            newForwardSpeed -= desiredSpeedMagnitude * finalAccelerationFactor * 5;
        } else {
            // Decelerate naturally
            newForwardSpeed += (0 - forwardSpeed) * finalAccelerationFactor;
        }

        const newLateralSpeed = lateralSpeed * (1 - this.lateralDampingFactor);

        this.vx = newForwardSpeed * cos + newLateralSpeed * (-sin);
        this.vy = newForwardSpeed * sin + newLateralSpeed * cos;
    }

    /**
     * Sets a new destination for the NPC and calculates the path to it.
     * This is the primary interface between the NPC and the "Navigator" (Pathfinder).
     * @param {Island} destination - The new destination island.
     * @param {Pathfinder} pathfinder - The global pathfinder instance.
     * @param {number} windDirection - The current wind direction.
     */
    setNewDestination(destination, pathfinder, windDirection) {
        this.destinationIsland = destination;
        if (!this.destinationIsland || !pathfinder) {
            this.pathWaypoints = [];
            this.currentWaypointIndex = 0;
            return;
        }

        // --- New Staging Point Logic ---
        // The long-range path now targets a "staging point" just outside the island's anchor zone.
        const stagingAngle = getRandomArbitrary(0, Math.PI * 2);
        const stagingDist = this.destinationIsland.proximityRadius + this.shipLength * 2; // A safe distance outside the zone
        this.stagingPoint = {
            x: this.destinationIsland.x + Math.cos(stagingAngle) * stagingDist,
            y: this.destinationIsland.y + Math.sin(stagingAngle) * stagingDist
        };

        const newPath = pathfinder.findPath({ x: this.x, y: this.y }, this.stagingPoint, windDirection, this);

        // The Pathfinder is now solely responsible for generating safe paths.
        // The ship trusts the path it receives.
        if (newPath.length > 0) {
            this.pathWaypoints = newPath;
            this.currentWaypointIndex = 0;
            this.currentSegmentStart = { x: this.x, y: this.y }; // Start of the first segment
            this.resetFailsafeState();
            if (this.shipId !== 'NPC') {
                console.log(`[${this.shipId} Path] Set new destination path to ${destination.type} at (${destination.x.toFixed(0)}, ${destination.y.toFixed(0)}). Path has ${newPath.length} waypoints.`);
            }
        } else {
            // If pathfinder returns an empty path, it failed.
            console.warn(`[Pathing Failsafe] Ship ${this.shipId} could not find a path to its destination. Triggering repositioning.`);
            this.destinationIsland = null;
            this.pathingFailureCooldown = 2000; // Set a 2-second cooldown before trying again.
            this.targetAngle = this._findClearSailableAngle(this.angle, pathfinder, windDirection);
            this.isSailOpen = true;
            this.debugStatus = 'Pathing Failed: Repositioning'; // Explicitly set status
        }
    }

    /**
     * Recalculates the path to the current destination. Called when wind changes.
     * This is another interface to the "Navigator" (Pathfinder).
     * @param {Pathfinder} pathfinder - The global pathfinder instance.
     * @param {number} windDirection - The new wind direction.
     */
    recalculatePath(pathfinder, windDirection) {
        // Only recalculate the long-range path if the ship is actually navigating.
        // This prevents a wind change from interrupting combat or other special states.
        const isNavigating = ['navigating', 'arriving', 'departing'].includes(this.aiState);

        if (this.destinationIsland && isNavigating) {
            this.setNewDestination(this.destinationIsland, pathfinder, windDirection);
        }
    }

    /**
     * Abstract method for AI state transitions. Subclasses must implement this.
     * This method is responsible for setting this.aiState based on game conditions.
     * @param {PlayerShip} player - The player ship instance.
     * @param {number} distToPlayer - The current distance to the player ship.
     * @param {number} deltaTime - The time since the last frame.
     * @param {Array<Cannonball>} cannonballs - The global cannonball array.
     */
    updateAIState(player, distToPlayer, deltaTime, cannonballs, pathfinder, windDirection, npcs, spatialGrid) {
        this.surrenderCheckTimer -= deltaTime;

        // --- NEW: Detailed Surrender Logic ---
        // Determine threshold ratio based on ship type
        let surrenderThresholdRatio = 0;
        if (this.constructor.name === 'NavyShip') {
            surrenderThresholdRatio = NAVY_SURRENDER_HP_THRESHOLD_RATIO;
        } else if (this.constructor.name === 'MerchantShip') {
            surrenderThresholdRatio = MERCHANT_SURRENDER_HP_THRESHOLD_RATIO;
        }

        if (surrenderThresholdRatio > 0 && (this.aiState === 'combat' || this.aiState === 'fleeing')) {
            
            // 1. Periodic Check: Crew Number (every 1 second)
            if (this.surrenderCheckTimer <= 0) {
                this.surrenderCheckTimer = SURRENDER_CHECK_INTERVAL; // Reset timer
                
                const ownCrewPercentage = this.crew / this.maxCrew;
                const targetCrewPercentage = player.crew / player.maxCrew;
                
                if (targetCrewPercentage > 0.01) {
                    const crewThreshold = targetCrewPercentage * surrenderThresholdRatio;
                    if (ownCrewPercentage < crewThreshold) {
                        const chance = 1.0 - (ownCrewPercentage / crewThreshold);
                        if (Math.random() < chance) {
                            console.log(`[Surrender] ${this.shipId} surrendering due to low Crew! Ratio: ${ownCrewPercentage.toFixed(2)} < ${crewThreshold.toFixed(2)}`);
                            this.aiState = 'surrendered';
                            this.isSailOpen = false;
                            return;
                        }
                    }
                }
            }

            // 2. On-Hit Check: Hull HP and Rig HP
            if (this.wasHitThisFrame) {
                // Check Hull
                const ownHpPercentage = this.hp / this.maxHp;
                const targetHpPercentage = player.hp / player.maxHp;
                if (targetHpPercentage > 0.01) {
                    const hpThreshold = targetHpPercentage * surrenderThresholdRatio;
                    if (ownHpPercentage < hpThreshold) {
                        const chance = 1.0 - (ownHpPercentage / hpThreshold);
                        if (Math.random() < chance) {
                            console.log(`[Surrender] ${this.shipId} surrendering due to low Hull HP! Ratio: ${ownHpPercentage.toFixed(2)} < ${hpThreshold.toFixed(2)}`);
                            this.aiState = 'surrendered';
                            this.isSailOpen = false;
                            return;
                        }
                    }
                }

                // Check Rig
                const ownRigPercentage = this.rigHp / this.maxRigHp;
                const targetRigPercentage = player.rigHp / player.maxRigHp;
                if (targetRigPercentage > 0.01) {
                    const rigThreshold = targetRigPercentage * surrenderThresholdRatio;
                    if (ownRigPercentage < rigThreshold) {
                        const chance = 1.0 - (ownRigPercentage / rigThreshold);
                        if (Math.random() < chance) {
                            console.log(`[Surrender] ${this.shipId} surrendering due to low Rig HP! Ratio: ${ownRigPercentage.toFixed(2)} < ${rigThreshold.toFixed(2)}`);
                            this.aiState = 'surrendered';
                            this.isSailOpen = false;
                            return;
                        }
                    }
                }
            }
        }

        // --- General Near-Miss Detection ---
        let isNearMiss = false;
        const nearMissRadius = this.shipLength * NPC_NEAR_MISS_RADIUS_MULTIPLIER;
        for (const ball of cannonballs) {
            // Check if a player's cannonball is close, and it's not one we've already processed.
            if (ball.owner instanceof PlayerShip && distance(this, ball) < nearMissRadius) {
                isNearMiss = true;
                break;
            }
        }

        if (this.wasHitThisFrame || isNearMiss) this.combatPilot.hasBeenFiredUpon = true;

        // Default behavior for all NPCs: become hostile if attacked.
        // Subclasses can override for more specific triggers (like Navy proximity activation).
        const isProvoked = this.hasBeenAttackedByPlayer || isNearMiss;
        const canBeProvoked = this.aiState !== 'combat' && this.aiState !== 'fleeing' && this.aiState !== 'desperation' && this.aiState !== 'surrendered' && this.aiState !== 'boarded';

        if (isProvoked && canBeProvoked) {
            this.aiState = 'combat';
            this.targetShip = player;
            this.pausedPathfindingDestination = this.destinationIsland;
            this.destinationIsland = null;
            this._clearPath('Entering combat'); // Explicitly clear the navigation path

            // --- FIX: Stagger predictive turn check to prevent frame drop ---
            this.predictiveTurnTimer = Math.random() * 200;
        }

        // If in combat, let the pilot manage the state (like disengagement).
        if (this.aiState === 'combat') {
            this.combatPilot.manageCombatState(player, distToPlayer, deltaTime, pathfinder, windDirection);
        }
    }

     /**
     * Resets the ship's state after combat ends.
     * @private
     * @param {Pathfinder} pathfinder - The global pathfinder instance.
     * @param {number} windDirection - The current wind direction.
     */
    _deactivateCombat(pathfinder, windDirection) {
        // --- New, More Robust Deactivation Logic ---
        // Revert to the navigating state and resume the original path.
        this.aiState = 'navigating';
        this.destinationIsland = this.pausedPathfindingDestination;
        this.pausedPathfindingDestination = null;
        this.hasBeenAttackedByPlayer = false; // Forgive the player to prevent instant re-engagement.
        this._clearPath('Disengaged from combat');
        
        // --- NEW: Clear combat debug visuals ---
        if (this.combatPilot) {
            this.combatPilot.debugFireZone = null;
            this.combatPilot.debugBroadsideBoxes = [];
            this.combatPilot.debugTargetBox = null;
            this.combatPilot.debugChaseTarget = null;
        }

        // Immediately recalculate the path to the original destination.
        if (this.destinationIsland && pathfinder) {
            this.recalculatePath(pathfinder, windDirection);
        }
    }

    /**
     * Handles the logic for the 'navigating' AI state.
     * @private
     */
    _runNavigatingAI(islands, windDirection, pathfinder, deltaTime) {
        // The *only* job of the 'navigating' state is to ensure the ship has a destination.
        // If it does, it will be followed. If not, it will find one.
        if (!this.destinationIsland) {
            this.debugStatus = 'Navigating: Finding new destination';
            if (this.pathingFailureCooldown <= 0) {
                this._findNewWanderDestination(islands, pathfinder, windDirection);
            }
        } else if (this.pathWaypoints.length === 0 && this.repathFromEvasionCooldown <= 0) {
            // If we have a destination but no path (e.g., cleared by evasion), repath.
            this.debugStatus = 'Navigating: Repathing to destination';
            this.recalculatePath(pathfinder, windDirection); 
        } else {
            // If we have a destination and a path, we are actively navigating.
            
            // 1. Update Path State (Check arrival, increment index)
            this._updatePathProgress(pathfinder, windDirection);
            
            // 2. Check for significant deviation (Cross-Track Error)
            this._checkPathDeviation(deltaTime, pathfinder, windDirection);

            this._applyVectorSteering(pathfinder, windDirection, 'Navigating');
        }
    }

    /**
     * Handles the logic for the 'arriving' state. The ship will attempt to move
     * from its staging point into the island's anchoring zone.
     * @private
     */
    _runArrivingAI(pathfinder, windDirection) {
        this.debugStatus = 'Arriving at island';
        this.isSailOpen = false; // Approach slowly and carefully.

        // If we don't have an arrival path yet, create one.
        if (this.pathWaypoints.length === 0) {
            const islandToApproach = this.destinationIsland;
            if (!islandToApproach) {
                this.aiState = 'navigating'; // Failsafe
                return;
            }

            // --- New, More Robust Arrival Logic ---
            // Find a random, *walkable* point inside the anchoring zone to "dock" at.
            let destinationPoint = null;
            let attempts = 0;
            while (!destinationPoint && attempts < 50) {
                const innerRadius = Math.max(islandToApproach.baseRadiusX, islandToApproach.baseRadiusY);
                const outerRadius = islandToApproach.proximityRadius;
                const targetDist = getRandomArbitrary(innerRadius + this.shipLength, outerRadius - this.shipLength);
                const targetAngle = getRandomArbitrary(0, Math.PI * 2);
                const potentialPoint = {
                    x: islandToApproach.x + Math.cos(targetAngle) * targetDist,
                    y: islandToApproach.y + Math.sin(targetAngle) * targetDist
                };

                // Check if the potential point is on a walkable grid node.
                const node = pathfinder._worldToGridNode(potentialPoint);
                if (node && node.walkable) {
                    destinationPoint = potentialPoint;
                }
                attempts++;
            }

            if (!destinationPoint) { // Failsafe if no point was found
                this.aiState = 'docked';
                this.dockedTimer = 1000;
                return;
            }

            const newPath = pathfinder.findPath({ x: this.x, y: this.y }, destinationPoint, windDirection, this);

            if (newPath && newPath.length > 0) {
                this.pathWaypoints = newPath;
                this.currentWaypointIndex = 0;
                this.resetFailsafeState();
            } else {
                // If the path into the harbor is unsafe, just consider ourselves "docked" and move on.
                this.aiState = 'docked';
                this.dockedTimer = 1000; // Short dock time since we didn't really arrive.
            }
        } else {
            // Follow the arrival path
            this._updatePathProgress(pathfinder, windDirection);
            this._applyVectorSteering(pathfinder, windDirection, 'Arriving');
        }
    }

    /**
     * Handles the logic for the 'docked' state. The ship waits for a period
     * and pre-calculates its next journey.
     * @private
     */
    _runDockedAI(deltaTime, islands, pathfinder, windDirection) {
        this.debugStatus = `Docked, departing in ${(this.dockedTimer / 1000).toFixed(1)}s`;
        this.isSailOpen = false; // Sails are down.
        this.vx *= 0.95; // Drift to a stop.
        this.vy *= 0.95;
        // While docked, the current destination is the island we are at.
        this.previousDestinationIsland = this.destinationIsland;
 
        // --- FIX: Correctly handle repair state before finding next path ---
        // If the ship is waiting for repairs (timer is Infinity)...
        if (this.dockedTimer === Infinity) {
            // ...check if it's fully repaired now.
            if (this.hp >= this.maxHp) {
                // Repairs are complete. Set a short timer to simulate "preparing to depart".
                this.dockedTimer = getRandomArbitrary(1000, 2000); // 1-2 seconds
                this.debugStatus = 'Repairs complete, preparing to depart.';
            }
        } else {
            // If not waiting for repairs, figure out the next destination and path.
            if (this.nextPathWaypoints.length === 0) {
                this._findNextWanderPath(islands, pathfinder, windDirection);
            }
        }

        this.dockedTimer -= deltaTime;
        if (this.dockedTimer <= 0 && this.nextPathWaypoints.length > 0) {
            // If we have a valid next path and the timer is up, depart.
            this.aiState = 'departing';
        }
    }

    /**
     * Handles the logic for the 'departing' AI state. The ship will attempt to move
     * a safe distance away from its previous destination before seeking a new one.
     * @private
     */
    _runDepartingAI(pathfinder, windDirection) {
        this.debugStatus = 'Departing from previous location';

        // If we don't have a departure path yet, create one.
        if (this.pathWaypoints.length === 0) {
            if (this.nextPathWaypoints.length === 0) {
                // Failsafe: if we don't have a next path, we can't depart. Go back to navigating.
                this.aiState = 'navigating';
                this.destinationIsland = null;
                return;
            }

            // The destination is the first waypoint of our next journey.
            const departurePoint = this.nextPathWaypoints[0];

            const newPath = pathfinder.findPath({ x: this.x, y: this.y }, departurePoint, windDirection, this);
            if (newPath && newPath.length > 0) {
                this.pathWaypoints = newPath;
                this.currentWaypointIndex = 0;
                this.resetFailsafeState();
                console.log(`[${this.shipId} Path] Generated new departure path. Path has ${newPath.length} waypoints.`);
            } else {
                // If the path out is unsafe, try to reposition and try again later.
                this.targetAngle = this._findClearSailableAngle(this.angle, pathfinder, windDirection, true);
                this.isSailOpen = true;
                this.repathFromEvasionCooldown = 2000;
                console.warn(`[Pathing Failsafe] Ship ${this.shipId} could not find a safe departure path. Repositioning.`);
            }
        } else {
            // Follow the departure path
            this._updatePathProgress(pathfinder, windDirection);
            this._applyVectorSteering(pathfinder, windDirection, 'Departing');
        }
    }

    /**
     * NEW: Unified steering logic. Blends Seek and Avoid vectors to determine heading.
     * @param {Pathfinder} pathfinder 
     * @param {number} windDirection 
     * @param {string} stateName - For debug logging.
     */
    _applyVectorSteering(pathfinder, windDirection, stateName) {
        // --- FIX: Calculate Avoidance First ---
        // We must calculate this every frame to know if the threat has cleared,
        // even if we are currently locked in a pivot.
        const avoidVector = this._getAvoidanceVector(windDirection, pathfinder);

        // --- NEW: Pivot Locking ---
        // If we are committed to a pivot, finish it before accepting new input.
        if (this.isPerformingAvoidancePivot) {
            // Escape Clause: If the threat is gone (and persistence expired), unlock immediately.
            if (avoidVector.magnitude === 0) {
                this.isPerformingAvoidancePivot = false;
            } else {
                let angleDiff = normalizeAngle(this.targetAngle - this.angle);
                if (Math.abs(angleDiff) > 0.2) { // Wait until aligned within ~11 degrees
                    this.isSailOpen = false;
                    this.debugStatus = `${stateName} (Locked Pivot)`;
                    return; 
                }
                this.isPerformingAvoidancePivot = false; // Unlock
            }
        }

        if (this.pathWaypoints.length > 0 && this.currentWaypointIndex < this.pathWaypoints.length) {
            // 1. Get Steering Vectors
            const seekVector = this._getWaypointFollowingVector(this.pathWaypoints[this.currentWaypointIndex], windDirection, pathfinder);
            // avoidVector is already calculated above.

            // 2. Apply Weights
            const wSeek = 1.0;
            // Use steeringWeight (short range) instead of magnitude (long range) for reactive force
            const wAvoid = (avoidVector.steeringWeight !== undefined ? avoidVector.steeringWeight : avoidVector.magnitude) * 30.0;

            // 3. Blend
            const finalX = (seekVector.x * wSeek) + (avoidVector.x * wAvoid);
            const finalY = (seekVector.y * wSeek) + (avoidVector.y * wAvoid);

            // 4. Convert to Angle
            const desiredAngle = Math.atan2(finalY, finalX);

            // 5. Hybrid Steering (Pilot + Lookout)
            // Default: The Pilot's blended vector, optimized for wind.
            let finalAngle = this._findBestSailingAngle(desiredAngle, windDirection);

            // Clear Lookout debug data (it will be repopulated if Lookout runs)
            this.debugLookoutLines = [];

            // Lookout Trigger: Activate only when in the emergency zone (braking is active) or if stuck.
            // --- FIX: Activate if obstacles are present (Tangent Nav) OR if braking/stuck (Emergency) ---
            if ((avoidVector.obstacles && avoidVector.obstacles.length > 0) || (avoidVector.brakingWeight > 0 && (avoidVector.type === 'terrain' || avoidVector.type === 'boundary')) || this.stuckTimer > 0) {
                // --- NEW: Tangent Navigation (Analytical Solver) ---
                // If we have a specific obstacle, try to find a clean tangent path around it.
                let tangentAngle = null;
                if (avoidVector.obstacles && avoidVector.obstacles.length > 0) {
                    tangentAngle = this._findTangentAvoidanceAngle(desiredAngle, avoidVector.obstacles);
                }

                if (tangentAngle !== null) {
                    finalAngle = this._findBestSailingAngle(tangentAngle, windDirection);
                } else {
                    // Fallback to Lookout (Raycast Sweep) if Tangent fails or for boundaries
                    let fallback = (avoidVector.magnitude > 0) ? Math.atan2(avoidVector.y, avoidVector.x) : null;
                    finalAngle = this._findClearSailableAngle(desiredAngle, pathfinder, windDirection, false, fallback);
                }
            }
            this.targetAngle = finalAngle;

            // 6. Sail Management (Proportional Control)
            if (avoidVector.magnitude > 0 && (avoidVector.type === 'terrain' || avoidVector.type === 'boundary')) {
                // --- NEW: Map Urgency to Throttle ---
                // Urgency 0.0 -> Throttle 1.0 (Full Speed)
                // Urgency 0.5 -> Throttle 0.5 (Half Speed)
                // Urgency 1.0 -> Throttle 0.0 (Stop & Pivot)
                const brakeForce = (avoidVector.brakingWeight !== undefined) ? avoidVector.brakingWeight : avoidVector.magnitude;
                this.throttle = Math.max(0, 1.0 - brakeForce);
                this.throttleReason = 'Avoidance';

                // If throttle is very low, close sails to allow pivoting.
                // Threshold adjusted to trigger at ~0.25 ship lengths (0.25 / 6.0 ≈ 0.042)
                if (this.throttle < 0.042) {
                    this.isSailOpen = false;
                    this.throttle = 0;
                    this.throttleReason = 'Emergency Stop';
                    // If we are stopped and still need to turn, lock the pivot.
                    if (Math.abs(normalizeAngle(this.targetAngle - this.angle)) > 0.2) {
                        this.isPerformingAvoidancePivot = true;
                    }
                } else {
                    this.isSailOpen = true;
                    this.isPerformingAvoidancePivot = false;
                }
            } else {
                this.isSailOpen = true;
                this.isPerformingAvoidancePivot = false;
                this.throttle = 1.0;
                this.throttleReason = null;
            }

            this.debugStatus = `${stateName} (Blend: S=${wSeek} A=${wAvoid})`;
        }
    }

    /**
     * NEW: Universal waypoint following logic that includes upwind tacking.
     * This is the core of the fix, moved from npcshipcombat.js.
     * @param {object} targetPos - The world position to chase.
     * @param {number} windDirection - The current wind direction.
     * @param {Pathfinder} [pathfinder] - Optional pathfinder for obstacle checks.
     * @returns {object} Normalized vector {x, y}.
     * @private
     */
    _getWaypointFollowingVector(targetPos, windDirection, pathfinder) {
        const result = this._cachedWaypointVector;
        const dx = targetPos.x - this.x;
        const dy = targetPos.y - this.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist === 0) {
            result.x = Math.cos(this.angle);
            result.y = Math.sin(this.angle);
            return result;
        }

        const angleToTarget = Math.atan2(dy, dx);
        // This is the angle FROM the wind's source TO the target direction
        let angleDiffFromUpwind = normalizeAngle(angleToTarget - windDirection);
        if (angleDiffFromUpwind > Math.PI) angleDiffFromUpwind -= 2 * Math.PI;
        if (angleDiffFromUpwind < -Math.PI) angleDiffFromUpwind += 2 * Math.PI;

        // Check if target is in the "No-Sail Zone" (Upwind)
        const closeHauled = this.getCloseHauledAngle ? this.getCloseHauledAngle() : Math.PI/3;
        
        // --- FIX: Add Hysteresis to Upwind Detection ---
        // If we are already tacking, use a wider threshold to prevent exiting mode too early.
        // If we are not tacking, use the strict threshold to enter mode.
        const isAlreadyTacking = this.tackDirection !== 0;
        const upwindThreshold = isAlreadyTacking ? (closeHauled + 0.35) : (closeHauled + 0.05);

        if (Math.abs(angleDiffFromUpwind) < upwindThreshold) {
            // Target is upwind.
            
            // Initialize tack direction if not set
            if (this.tackDirection === 0) {
                // Default to the side the target is currently on
                this.tackDirection = (angleDiffFromUpwind >= 0) ? 1 : -1;
            }

            // --- Hysteresis Logic (Streamlined Tacking) ---
            // Only switch tacks if the target crosses the "opposite" close-hauled threshold.
            // This prevents rapid switching and ensures we hold the tack until it's efficient to switch.
            // If on Starboard Tack (1), wait until target is < -closeHauled (Port side).
            // If on Port Tack (-1), wait until target is > closeHauled (Starboard side).
            if (this.tackDirection === 1 && angleDiffFromUpwind < -closeHauled) {
                this.tackDirection = -1; // Switch to Port Tack
            } else if (this.tackDirection === -1 && angleDiffFromUpwind > closeHauled) {
                this.tackDirection = 1; // Switch to Starboard Tack
            }

            // --- NEW: Obstacle-Aware Tacking ---
            // If we have a pathfinder, check if our current/planned tack is safe.
            if (pathfinder) {
                const currentTackAngle = normalizeAngle(windDirection + (this.tackDirection * closeHauled));
                // Check 4 ship lengths ahead (matching whisker range)
                const isCurrentSafe = this._isManeuverSafe(currentTackAngle, pathfinder, this.shipLength * 4, false, true);

                if (!isCurrentSafe) {
                    // Current tack is blocked. Check the other tack.
                    const otherTackDir = (this.tackDirection === 0) ? 1 : -this.tackDirection;
                    const otherTackAngle = normalizeAngle(windDirection + (otherTackDir * closeHauled));
                    if (this._isManeuverSafe(otherTackAngle, pathfinder, this.shipLength * 4, false, true)) {
                        this.tackDirection = otherTackDir; // Force switch to the safe tack
                    }
                }
            }

            // --- DEBUG DATA ---
            this.debugTackState = {
                dir: this.tackDirection,
                timer: 0,
                windDiff: angleDiffFromUpwind
            };

            const tackAngle = normalizeAngle(windDirection + (this.tackDirection * closeHauled));
            result.x = Math.cos(tackAngle);
            result.y = Math.sin(tackAngle);
            return result;
        }

        // Target is reachable directly, clear tacking state
        if (this.tackDirection !== 0) {
            this.tackDirection = 0;
            this.debugTackState = null;
        }
        result.x = dx / dist;
        result.y = dy / dist;
        return result;
    }

    /**
     * The "Pilot" layer. Contains the main AI state machine for the ship, handling
     * tactical decisions and executing the current plan.
     * @param {Array<Island>} islands - The array of all islands for navigation.
     * @param {number} windDirection - The current wind direction in radians.
     * @param {PlayerShip} player - The player ship instance to target.
     * @param {Array<Cannonball>} cannonballs - The array to add new cannonballs to.
     * @param {Array<Volley>} volleys - The array to add new volleys to.
     * @param {Pathfinder} pathfinder - The global pathfinder instance.
     * @param {Array<NpcShip>} npcs - The array of all NPC ships for context.
     * @param {SpatialGrid} spatialGrid - The global spatial grid.
     */
    _runPilotBehaviors(deltaTime, islands, windDirection, player, cannonballs, volleys, npcs, pathfinder, spatialGrid) {
        if (!player) return;

        // --- NEW: Throttled Sense Phase ---
        // Only update sensors periodically to save performance (approx 10 times/sec).
        this.sensorUpdateTimer -= deltaTime;
        if (this.sensorUpdateTimer <= 0) {
            if (spatialGrid) this._scanSurroundings(spatialGrid); // Scan first, check grid exists
            this._updateSensors(pathfinder, npcs, player, spatialGrid);
            this.sensorUpdateTimer = 100 + Math.random() * 50; // 100-150ms interval with jitter
        }

        const previousState = this.aiState;
        const distToPlayer = distance(this, player);
        this.combatPilot.chasePathRecalculationTimer -= deltaTime;
        this.pathingFailureCooldown -= deltaTime; // Decrement cooldown
        this.repathFromEvasionCooldown -= deltaTime; // Decrement cooldown
        this.combatPilot.updateTimers(deltaTime); // Update combat-specific timers
        this.avoidanceCumulativeTimer = Math.max(0, this.avoidanceCumulativeTimer - deltaTime); // Decay avoidance accumulator
        this.avoidancePersistenceTimer = Math.max(0, this.avoidancePersistenceTimer - deltaTime); // --- FIX: Decrement persistence timer ---


        // --- NEW: Handle Reversing State ---
        if (this.isMovingBackward) {
            this.reverseTimer -= deltaTime;
            if (this.reverseTimer <= 0) {
                this.isMovingBackward = false;
                // After reversing, try to find a clear angle to sail away.
                this.targetAngle = this._findClearSailableAngle(this.angle + Math.PI, pathfinder, windDirection, true);
                
                // --- NEW: Repath after getting stuck ---
                // If we had to reverse, our current path is likely blocked or invalid.
                // Request a new path from our current position.
                if (['navigating', 'arriving', 'departing'].includes(this.aiState)) {
                    this.recalculatePath(pathfinder, windDirection);
                }
            } else {
                return; // Skip other pilot logic while reversing to maintain control.
            }
        }

        // --- High-level State Transitions (Combat/Fleeing) --- // Pass npcs array
        this.updateAIState(player, distToPlayer, deltaTime, cannonballs, pathfinder, windDirection, npcs, spatialGrid);

        // --- New: "Repair at Sea" Behavior (High Priority) ---
        // If the ship is damaged, not in combat, and in a safe location, it should stop to repair.
        const isDamaged = this.hp < this.maxHp * 0.5;
        const isNotInCombat = this.aiState !== 'combat' && this.aiState !== 'fleeing' && this.aiState !== 'desperation';
        const isInSafeWater = !this.isOverShoal && !this.isOverCoralReef;

        if (isDamaged && isNotInCombat && isInSafeWater) {
            // Override all other logic to focus on repairing.
            this.debugStatus = 'Repairing at sea';
            this.isSailOpen = false; // Furl sails to drift.
            this._clearPath('Stopping to repair at sea');
            // The ship will naturally regenerate HP. Once it's above 50%, this block will no longer run,
            // and the ship will resume its normal navigation logic.
            return; // Skip all other pilot behaviors for this frame.
        }

        // --- New: Universal Stuck Detection & Recovery ---
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (currentSpeed < 0.1) { // If practically stationary
            this.stuckTimer += deltaTime;
        } else {
            this.stuckTimer = 0; // Reset if moving
        }

        // If stuck for too long, override all other logic and try to recover.
        if (this.stuckTimer > NPC_STUCK_TIME_LIMIT) {
            this._recoverFromStuckPosition(pathfinder, windDirection);
            this.stuckTimer = 0; // Reset timer after attempting recovery.
            return; // Skip all other behaviors for this frame.
        }

        // --- Path Completion & State Transition Logic ---
        // This runs before the action logic to handle state changes when a path is finished.
        const isPathComplete = this.pathWaypoints.length > 0 && this.currentWaypointIndex >= this.pathWaypoints.length;
        if (isPathComplete) {
            if (this.aiState === 'navigating') {
                this.aiState = 'arriving';
                this._clearPath('Staging Point Reached, arriving at island');
            } else if (this.aiState === 'departing') {
                this.aiState = 'navigating';
                this._clearPath('Departure Complete, starting new journey');
                // The new path and destination have already been calculated in the 'docked' state.
                this.pathWaypoints = this.nextPathWaypoints;
                this.nextPathWaypoints = [];
                this.currentWaypointIndex = 0;
                this.resetFailsafeState();
            } else if (this.aiState === 'arriving') {
                this.aiState = 'docked';
                this._clearPath('Arrival Complete, now docked');
                // --- New Docking Timer Logic ---
                // If the ship is damaged, it will wait to repair. Otherwise, it waits a random time.
                if (this.hp < this.maxHp) {
                    this.dockedTimer = Infinity; // Wait indefinitely until fully repaired.
                    this.debugStatus = 'Docked for repairs';
                } else {
                    this.dockedTimer = getRandomArbitrary(5000, 10000); // Dock for 5-10 seconds.
                }
            }
        }

        // --- State-Based Action Logic ---
        // This runs *after* the state transition, so the ship can immediately act on its new state.
        switch (this.aiState) {
            case 'arriving':
                this._runArrivingAI(pathfinder, windDirection);
                break;
            case 'docked':
                this._runDockedAI(deltaTime, islands, pathfinder, windDirection);
                break;
            case 'combat': // All combat states are handled by the pilot
                this.combatPilot.runCombatAI(deltaTime, windDirection, pathfinder, cannonballs, volleys, npcs, spatialGrid);
                break;
            case 'departing':
                this._runDepartingAI(pathfinder, windDirection);
                break;
            case 'navigating': 
                this._runNavigatingAI(islands, windDirection, pathfinder, deltaTime);
                break;
            case 'recovering':
                // This state's only job is to get a new path and then go back to navigating.
                this.debugStatus = 'Recovering from evasion';
                this.recalculatePath(pathfinder, windDirection);
                this.aiState = 'navigating'; // Immediately switch back.
                break;
        }

    }

    /**
     * Handles the logic for aiming and firing cannons at a target.
     * @param {PlayerShip} target - The ship to fire upon.
     * @param {number} distToTarget - The distance to the target.
     * @param {Pathfinder} pathfinder - The global pathfinder instance.
     * @param {number} windDirection - The current wind direction.
     * @private
     */
    _findNextWanderPath(islands, pathfinder, windDirection) {
        if (!pathfinder) return;
        if (islands.length === 0) return;

        let potentialDestinations = islands.filter(i => !this.previousDestinationIsland || i.id !== this.previousDestinationIsland.id);
        if (potentialDestinations.length === 0) {
            potentialDestinations = islands;
        }

        for (let i = potentialDestinations.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [potentialDestinations[i], potentialDestinations[j]] = [potentialDestinations[j], potentialDestinations[i]];
        }

        for (const newDestination of potentialDestinations) {
            const stagingAngle = getRandomArbitrary(0, Math.PI * 2);
            const stagingDist = newDestination.proximityRadius + this.shipLength * 2;
            const stagingPoint = {
                x: newDestination.x + Math.cos(stagingAngle) * stagingDist,
                y: newDestination.y + Math.sin(stagingAngle) * stagingDist
            };

            // Note: The path starts from the *current* position, even though we are "docked".
            // This gives a realistic path for the journey ahead.
            const newPath = pathfinder.findPath({ x: this.x, y: this.y }, stagingPoint, windDirection, this);

            if (newPath.length > 0) {
                // Success! Store the results for when we depart.
                // This sets the destination for the *next* journey.
                this.destinationIsland = newDestination;
                // The staging point is also for the next journey.
                this.stagingPoint = stagingPoint;
                this.nextPathWaypoints = newPath;
                return;
            }
        }
    }

    /**
     * Finds and sets a new random island destination for the ship to wander to.
     * This gives the responsibility of finding a new destination to the ship itself,
     * rather than having it managed by the main game loop.
     * @param {Array<Island>} islands - The list of all possible destination islands.
     * @param {Pathfinder} pathfinder - The global pathfinder instance.
     * @param {number} windDirection - The current wind direction.
     * @private
     */
    _findNewWanderDestination(islands, pathfinder, windDirection) {
        if (!pathfinder) return;
        if (islands.length > 0) {
            // --- Robust Destination Finding ---
            // Instead of picking one and hoping, we'll try islands until we find one with a valid path.

            let potentialDestinations = islands.filter(i => !this.previousDestinationIsland || i.id !== this.previousDestinationIsland.id);
            if (potentialDestinations.length === 0) {
                potentialDestinations = islands; // Fallback if only one island exists or all have been visited.
            }

            // Shuffle the potential destinations to avoid always trying the same ones first if stuck.
            for (let i = potentialDestinations.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [potentialDestinations[i], potentialDestinations[j]] = [potentialDestinations[j], potentialDestinations[i]];
            }

            // Iterate through the shuffled destinations and pick the first one with a valid path.
            for (const newDestination of potentialDestinations) {
                this.setNewDestination(newDestination, pathfinder, windDirection);
                // If setNewDestination was successful, it will have set a path.
                if (this.pathWaypoints.length > 0) return; // Success!
            }

            // If we get here, no path was found to any potential destination.
            this.consecutivePathingFailures++;
            console.warn(`[Pathing Failsafe] Ship ${this.shipId} could not find a valid path (Fail #${this.consecutivePathingFailures}).`);
            
            this.pathingFailureCooldown = 2000; // Set a 2-second cooldown before trying again.
            this.isSailOpen = true;

            // --- NEW: Emergency Avoidance Override ---
            // If pathfinding fails repeatedly, use the reactive avoidance vector (Cyan Line) to escape.
            if (this.consecutivePathingFailures >= 3) {
                const avoidVec = this._getAvoidanceVector(windDirection, pathfinder);
                if (avoidVec.magnitude > 0) {
                    this.targetAngle = Math.atan2(avoidVec.y, avoidVec.x);
                    this.debugStatus = 'Pathing Failed: Emergency Escape';
                    this.pathingFailureCooldown = 4000; // Give it more time to clear the obstacle
                    return;
                }
            }
            this.targetAngle = this._findClearSailableAngle(this.angle, pathfinder, windDirection);
            this.debugStatus = 'Pathing Failed: Repositioning';
        }
    }

    /**
     * NEW: Calculates a normalized vector pointing towards the target.
     * @param {{x: number, y: number}} target - The target position.
     * @returns {{x: number, y: number}} Normalized vector.
     */
    _getSeekVector(target) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const result = this._cachedSeekVector;
        if (dist === 0) {
            result.x = Math.cos(this.angle);
            result.y = Math.sin(this.angle);
        } else {
            result.x = dx / dist;
            result.y = dy / dist;
        }
        return result;
    }

    /**
     * NEW: Calculates a repulsion vector based on nearby obstacles.
     * Uses the same logic as _handleLocalAvoidance but returns a vector.
     * @param {number} [windDirection] - Optional wind direction to bias avoidance turns.
     * @param {Pathfinder} [pathfinder] - Optional pathfinder for escape vector calculation.
     * @returns {{x: number, y: number, magnitude: number}} The avoidance vector.
     */
    _getAvoidanceVector(windDirection, pathfinder) {
        // 0. World Boundary Check (Highest Priority)
        const margin = this.shipLength * 2;
        let boundaryX = 0;
        let boundaryY = 0;
        
        // --- NEW: Create Virtual Obstacles for Boundaries ---
        // We create a virtual "box" for the wall segment near the ship.
        // Depth is set to shipLength to ensure the Tangent Solver calculates a wide enough safety cone.
        const boundaryObstacles = this._cachedBoundaryList;
        boundaryObstacles.length = 0; // Clear reused array

        const span = this.shipLength * 10; // Length of the virtual wall segment along the border
        const depth = this.shipLength; // Depth of the virtual wall (out of bounds)

        if (this.x < WORLD_BUFFER + margin) {
            boundaryX = 1;
            const obs = this._cachedBoundaryObstacleX;
            obs.convexHull[0].x = WORLD_BUFFER; obs.convexHull[0].y = this.y - span;
            obs.convexHull[1].x = WORLD_BUFFER; obs.convexHull[1].y = this.y + span;
            obs.convexHull[2].x = WORLD_BUFFER - depth; obs.convexHull[2].y = this.y + span;
            obs.convexHull[3].x = WORLD_BUFFER - depth; obs.convexHull[3].y = this.y - span;
            boundaryObstacles.push(obs);
        } else if (this.x > WORLD_WIDTH - WORLD_BUFFER - margin) {
            boundaryX = -1;
            const obs = this._cachedBoundaryObstacleX;
            obs.convexHull[0].x = WORLD_WIDTH - WORLD_BUFFER; obs.convexHull[0].y = this.y - span;
            obs.convexHull[1].x = WORLD_WIDTH - WORLD_BUFFER; obs.convexHull[1].y = this.y + span;
            obs.convexHull[2].x = WORLD_WIDTH - WORLD_BUFFER + depth; obs.convexHull[2].y = this.y + span;
            obs.convexHull[3].x = WORLD_WIDTH - WORLD_BUFFER + depth; obs.convexHull[3].y = this.y - span;
            boundaryObstacles.push(obs);
        }

        if (this.y < WORLD_BUFFER + margin) {
            boundaryY = 1;
            const obs = this._cachedBoundaryObstacleY;
            obs.convexHull[0].x = this.x - span; obs.convexHull[0].y = WORLD_BUFFER;
            obs.convexHull[1].x = this.x + span; obs.convexHull[1].y = WORLD_BUFFER;
            obs.convexHull[2].x = this.x + span; obs.convexHull[2].y = WORLD_BUFFER - depth;
            obs.convexHull[3].x = this.x - span; obs.convexHull[3].y = WORLD_BUFFER - depth;
            boundaryObstacles.push(obs);
        } else if (this.y > WORLD_HEIGHT - WORLD_BUFFER - margin) {
            boundaryY = -1;
            const obs = this._cachedBoundaryObstacleY;
            obs.convexHull[0].x = this.x - span; obs.convexHull[0].y = WORLD_HEIGHT - WORLD_BUFFER;
            obs.convexHull[1].x = this.x + span; obs.convexHull[1].y = WORLD_HEIGHT - WORLD_BUFFER;
            obs.convexHull[2].x = this.x + span; obs.convexHull[2].y = WORLD_HEIGHT - WORLD_BUFFER + depth;
            obs.convexHull[3].x = this.x - span; obs.convexHull[3].y = WORLD_HEIGHT - WORLD_BUFFER + depth;
            boundaryObstacles.push(obs);
        }
        
        if (boundaryX !== 0 || boundaryY !== 0) {
            const result = this._cachedAvoidanceResult;
            result.x = boundaryX;
            result.y = boundaryY;
            result.magnitude = 2.0;
            result.type = 'boundary';
            result.brakingWeight = 2.0;
            result.steeringWeight = 0; // Reset
            result.obstacles = boundaryObstacles;
            return result;
        }

        // 1. Check Whiskers
        // --- NEW: Collect all unique obstacles for Tangent Navigation ---
        // Moved to top to ensure availability even if reactive vector is suppressed.
        // --- OPTIMIZATION: Use cached array and manual deduplication to avoid Set allocation ---
        const obstaclesArray = this._cachedObstaclesArray;
        obstaclesArray.length = 0;
        
        // --- OPTIMIZATION: Iterate config array instead of allocating Object.values() ---
        let hasAnyHit = false;
        for (const w of this.terrainWhiskers) {
            const hit = this.whiskerHits[w.name];
            if (hit) hasAnyHit = true;
            
            if (hit && hit.type === 'terrain' && hit.obstacle) {
                if (!obstaclesArray.includes(hit.obstacle)) {
                    obstaclesArray.push(hit.obstacle);
                }
            }
        }

        // --- NEW: Commitment Logic ---
        // If the front is clear, release the turn direction lock.
        if (!this.whiskerHits['front']) {
            this.avoidanceDirectionLock = null;
        }

        if (!hasAnyHit) {
            // --- FIX: Enforce Persistence ---
            if (this.avoidancePersistenceTimer > 0 && this.lastAvoidanceType) {
                const result = this._cachedAvoidanceResult;
                result.x = Math.cos(this.lastAvoidanceAngle);
                result.y = Math.sin(this.lastAvoidanceAngle);
                result.magnitude = 1.0; // Maintain full urgency
                result.type = this.lastAvoidanceType;
                // Maintain braking to prevent accelerating into the obstacle we just turned away from
                result.brakingWeight = (this.lastAvoidanceType === 'terrain') ? 0.5 : 0;
                result.steeringWeight = 1.0;
                // Note: We don't have the obstacles array here, but Tangent Nav handles the "clear" case gracefully.
                return result;
            }

            this.debugAvoidanceRadius = null;
            this.debugAvoidanceTangent = null;
            this.debugSafetyBubble = null;
            const result = this._cachedAvoidanceResult;
            result.x = 0;
            result.y = 0;
            result.magnitude = 0;
            result.type = null;
            result.brakingWeight = 0;
            result.steeringWeight = 0;
            result.obstacles = []; // Clear
            return result;
        }

        // 2. Identify Obstacle
        // Find the closest RELEVANT threat across all whiskers
        let obstacleToAvoid = null;
        let minDistSq = Infinity;
        let hitWhiskerName = null;

        const outerWhiskers = [
            'port-30', 'starboard-30', 'port-45', 'starboard-45', 
            'port-60', 'starboard-60', 'port-90', 'starboard-90',
            'port', 'starboard' // Ship sectors are also "outer"
        ];

        for (const w of this.terrainWhiskers) {
            const hit = this.whiskerHits[w.name];
            if (!hit) continue;

            // --- FIX: Check relevance BEFORE selecting as closest ---
            // If an outer whisker hits, it is only relevant if we are turning towards it.
            let isRelevant = true;
            if (outerWhiskers.includes(w.name)) {
                const angleDiff = normalizeAngle(this.targetAngle - this.angle);
                const turnDirection = Math.sign(angleDiff); // -1 for left, 1 for right
                const isPortHit = w.name.includes('port');
                const isStarboardHit = w.name.includes('starboard');
                
                // Relevant only if turning INTO the hit
                if (!((isPortHit && turnDirection < 0) || (isStarboardHit && turnDirection > 0))) {
                    isRelevant = false;
                }
            }

            if (isRelevant && hit.distSq < minDistSq) {
                obstacleToAvoid = hit;
                minDistSq = hit.distSq;
                hitWhiskerName = w.name;
            }
        }

        // --- NEW: Avoidance Locking (Anti-Flicker) ---
        // If we are already avoiding a ship, stick with it until it is clearly safe.
        if (this.lockedAvoidanceTarget) {
            const t = this.lockedAvoidanceTarget;
            let shouldUnlock = false;

            // 1. Check Validity (Alive/Exists)
            if (t.hp !== undefined && (t.hp <= 0 || t.isSunk)) shouldUnlock = true;

            if (!shouldUnlock) {
                const distSq = (this.x - t.x)**2 + (this.y - t.y)**2;
                // Hysteresis: Keep lock up to 8 ship lengths (longer than activation)
                const maxLockRange = (this.shipLength * 8) ** 2;
                
                // Check relative angle (Is it behind us?)
                const angleToT = Math.atan2(t.y - this.y, t.x - this.x);
                let angleDiff = normalizeAngle(angleToT - this.angle);
                if (angleDiff > Math.PI) angleDiff -= 2*Math.PI;
                if (angleDiff < -Math.PI) angleDiff += 2*Math.PI;

                // Unlock if too far OR if we have passed it (angle > 120 degrees)
                if (distSq > maxLockRange || Math.abs(angleDiff) > Math.PI * (2/3)) {
                    shouldUnlock = true;
                } else {
                    // If whiskers missed it, or if it's closer than the whisker hit, enforce it.
                    if (!obstacleToAvoid || distSq < minDistSq) {
                        obstacleToAvoid = {
                            type: 'ship',
                            ship: t,
                            x: t.x,
                            y: t.y,
                            distSq: distSq
                        };
                        minDistSq = distSq;
                        // Infer whisker sector for threshold logic
                        hitWhiskerName = (Math.abs(angleDiff) < Math.PI / 6) ? 'front' : 'side';
                    }
                }
            }
            
            if (shouldUnlock) this.lockedAvoidanceTarget = null;
        }

        // Update lock if we have a ship target
        if (obstacleToAvoid && obstacleToAvoid.type === 'ship') {
            this.lockedAvoidanceTarget = obstacleToAvoid.ship;
        }

        // If no relevant obstacle found, return early (but keep Tangent Nav obstacles)
        if (!obstacleToAvoid) {
            this.debugAvoidanceRadius = null;
            this.debugAvoidanceTangent = null;
            const result = this._cachedAvoidanceResult;
            result.x = 0;
            result.y = 0;
            result.magnitude = 0;
            result.type = null;
            result.brakingWeight = 0;
            result.steeringWeight = 0;
            result.obstacles = obstaclesArray;
            return result;
        }

        // --- MOVED UP: Determine type for threshold logic ---
        const type = (obstacleToAvoid.type === 'terrain') ? 'terrain' : 'ship';

        // --- NEW: Activation Thresholds ---
        // Only activate reactive avoidance (and the Cyan Line) if within specific ranges.
        // Increased thresholds to ensure ships react to each other sooner.
        let activationThreshold = this.shipLength * 0.5; 
        if (hitWhiskerName === 'front') {
            // Frontal threats need earlier reaction
            activationThreshold = (type === 'ship') ? this.shipLength * 4.0 : this.shipLength * 2.0;
        } else {
            // Side threats
            if (type === 'ship') {
                activationThreshold = this.shipLength * 1.5;
            }
        }

        if (minDistSq > activationThreshold * activationThreshold) {
            this.debugAvoidanceRadius = null;
            this.debugAvoidanceTangent = null;
            this.debugSafetyBubble = null;
            const result = this._cachedAvoidanceResult;
            result.x = 0;
            result.y = 0;
            result.magnitude = 0;
            result.type = null;
            result.brakingWeight = 0;
            result.steeringWeight = 0;
            result.obstacles = obstaclesArray;
            return result;
        }

        // 3. Determine Direction (Orbit)
        let orbitDirection = 1; // Default Starboard
        // If the closest threat is on a side, turn away from it.
        
        // Identify if the closest hit is on the port side
        const isPortHit = [
            this.whiskerHits['port-15'], this.whiskerHits['port-30'], 
            this.whiskerHits['port-45'], this.whiskerHits['port-60'], 
            this.whiskerHits['port-90'], this.whiskerHits['port']
        ].includes(obstacleToAvoid);

        if (isPortHit) {
            orbitDirection = 1; // Turn Right (Away from Port)
        } 
        else if (obstacleToAvoid !== this.whiskerHits['front']) { // If not front and not port, assume starboard
            orbitDirection = -1; // Turn Left (Away from Starboard)
        }
        else { // Front Hit - This is where the commitment logic applies
            if (this.avoidanceDirectionLock) {
                // We have a committed direction, use it.
                orbitDirection = this.avoidanceDirectionLock === 'starboard' ? 1 : -1;
            } else {
                // No commitment, make a tactical choice.
                let target = this.targetShip;
                // If not in combat, use the next waypoint as the tactical target.
                if (!target && this.pathWaypoints.length > 0 && this.currentWaypointIndex < this.pathWaypoints.length) {
                    target = this.pathWaypoints[this.currentWaypointIndex];
                }

                if (target) {
                    // Determine if the target is to the left or right of the obstacle.
                    const dx = target.x - obstacleToAvoid.x;
                    const dy = target.y - obstacleToAvoid.y;
                    const cross = Math.cos(this.angle) * dy - Math.sin(this.angle) * dx;
                    orbitDirection = cross > 0 ? -1 : 1; // If target is left, turn left.
                } else {
                    // Failsafe: No target, just default to starboard (COLREGs).
                    orbitDirection = 1;
                }

                // Lock the decision.
                this.avoidanceDirectionLock = orbitDirection === 1 ? 'starboard' : 'port';
            }
        }

        // --- The logic below was part of the old front-hit handling and is now replaced by the commitment logic above. ---
        /* else { // Front Hit
             if (type === 'ship') {
                 orbitDirection = 1; // Always turn Starboard to pass Port-to-Port
             } else if (this.pathWaypoints.length > 0 && this.currentWaypointIndex < this.pathWaypoints.length) {
                let preferTack = false;
                if (windDirection !== undefined) {
                    const angleFromWind = normalizeAngle(this.angle - windDirection);
                    // If within 90 degrees of the wind (upwind/reaching)
                    if (Math.abs(angleFromWind) < Math.PI / 2) {
                        preferTack = true;
                        // If angleFromWind is negative (wind on starboard), turn Right (+1) to tack.
                        // If angleFromWind is positive (wind on port), turn Left (-1) to tack.
                        orbitDirection = (angleFromWind < 0) ? 1 : -1;
                    }
                }
                if (!preferTack) {
                    const waypoint = this.pathWaypoints[this.currentWaypointIndex];
                    const dx = waypoint.x - this.x;
                    const dy = waypoint.y - this.y;
                    const cross = Math.cos(this.angle) * dy - Math.sin(this.angle) * dx;
                    orbitDirection = cross > 0 ? -1 : 1;
                }
            }
        } */

        // 4. Calculate Vector (Normal/Tangent Blend)
        let closestPoint = { x: obstacleToAvoid.x, y: obstacleToAvoid.y };
        if (obstacleToAvoid.type !== 'terrain') {
             // ... (Geometry finding logic from _performAvoidanceManeuver) ...
             // For brevity, using center, but ideally use closest vertex logic here too.
        }

        const angleFromObstacle = Math.atan2(this.y - closestPoint.y, this.x - closestPoint.x);
        const distToObstacle = distance(this, closestPoint);
        
        // --- FIX: Handle "Inside Buffer" Case ---
        // If we are extremely close to a terrain hit (likely inside the grid cell), use the gradient to escape.
        if (type === 'terrain' && distToObstacle < this.shipLength * 0.5 && pathfinder) {
            const escapeVec = pathfinder.getEscapeVector({x: this.x, y: this.y});
            const result = this._cachedAvoidanceResult;
            result.x = escapeVec.x;
            result.y = escapeVec.y;
            result.magnitude = 2.0;
            result.type = 'terrain';
            result.brakingWeight = 2.0;
            result.steeringWeight = 2.0;
            return result;
        }

        // Tangent (Orbit)
        const tangentAngle = normalizeAngle(angleFromObstacle - (orbitDirection * (Math.PI / 2)));
        
        let finalAngle = tangentAngle;

        this.debugSafetyBubble = null; // Reset before check

        // --- NEW: Tangent Navigation Target for Ships ---
        // Instead of a hard 90-degree turn, aim for the edge of a safety bubble around the target.
        if (type === 'ship' && obstacleToAvoid.ship) {
            const otherShip = obstacleToAvoid.ship;
            // Define safety bubble: 1.5x the length of the larger ship
            const safetyRadius = Math.max(this.shipLength, otherShip.shipLength) * 1.5;

            if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
                this.debugSafetyBubble = {
                    x: otherShip.x,
                    y: otherShip.y,
                    radius: safetyRadius
                };
            }

            const dist = Math.sqrt(minDistSq);

            // Only apply this logic if we are outside the safety bubble.
            // If inside, we stick to the hard tangent (spiral out) logic calculated above.
            if (dist > safetyRadius) {
                // Calculate the angle offset needed to aim at the tangent of the safety circle
                const alpha = Math.asin(safetyRadius / dist);
                
                // Angle TO the obstacle
                const angleToObs = Math.atan2(closestPoint.y - this.y, closestPoint.x - this.x);
                
                // Apply offset based on orbit direction.
                // In screen coords (Y-down), angles increase Clockwise.
                // orbitDirection 1 (Right) means we add the angle.
                finalAngle = normalizeAngle(angleToObs + (orbitDirection * alpha));

                // Visualization
                if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
                    // Override the tangent debug line to show this new target
                    this.debugAvoidanceTangent = {
                        start: { x: this.x, y: this.y },
                        end: { 
                            x: this.x + Math.cos(finalAngle) * dist,
                            y: this.y + Math.sin(finalAngle) * dist
                        }
                    };
                }
            }
        }
        
        // --- DEBUG VISUALIZATION DATA ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
            this.debugAvoidanceRadius = {
                start: { x: this.x, y: this.y },
                end: { x: closestPoint.x, y: closestPoint.y }
            };
            // Only set default tangent debug if we didn't set a specific one above
            if (!this.debugAvoidanceTangent) {
                this.debugAvoidanceTangent = {
                    start: { x: this.x, y: this.y },
                    end: { 
                        x: this.x + Math.cos(tangentAngle) * (this.shipLength * 3),
                        y: this.y + Math.sin(tangentAngle) * (this.shipLength * 3)
                    }
                };
            }
        }

        this.lastAvoidanceAngle = finalAngle;
        this.lastAvoidanceType = type;
        this.avoidancePersistenceTimer = 1000; // Reset persistence

        // --- NEW: Dynamic Magnitude Calculation ---
        // Calculate urgency as a smooth gradient from 0.0 (at max range) to 1.0 (at 0 distance).
        const maxRange = this.shipLength * 6;
        let urgency = Math.max(0, Math.min(1.0, 1.0 - (distToObstacle / maxRange)));

        // --- NEW: Diagonal Dampening ---
        // If the forward path is clear, ignore weak side terrain hits.
        if (type === 'terrain' && !this.whiskerHits['front'] && urgency < 0.5) {
            const result = this._cachedAvoidanceResult;
            result.x = 0;
            result.y = 0;
            result.magnitude = 0;
            result.type = null;
            result.brakingWeight = 0;
            result.steeringWeight = 0;
            result.obstacles = obstaclesArray;
            return result;
        }

        // --- NEW: Sector-Based Braking (Recommendation #2) ---
        const innerWhiskers = ['front', 'port-15', 'starboard-15'];
        let brakingUrgency = 0;
        if (innerWhiskers.includes(hitWhiskerName)) {
            const brakingRange = this.shipLength * 0.5;
            if (distToObstacle < brakingRange) brakingUrgency = 1.0;
        }

        // --- NEW: Distance-Based Steering Threshold ---
        // Reactive steering removed per request. Whiskers only trigger Lookout.
        let steeringUrgency = 0;

        // --- FIX: Re-enable reactive steering for ships ---
        // Since ships don't use the Tangent Navigation solver (Lookout), they rely on the
        // blended avoidance vector calculated above.
        if (type === 'ship') {
            steeringUrgency = urgency;
        }

        const result = this._cachedAvoidanceResult;
        result.x = Math.cos(finalAngle);
        result.y = Math.sin(finalAngle);
        result.magnitude = urgency;
        result.type = type;
        result.brakingWeight = brakingUrgency;
        result.steeringWeight = steeringUrgency;
        result.obstacles = obstaclesArray;
        return result;
    }

    /**
     * NEW: Updates path progress (index incrementing) without applying steering.
     * Extracted from followPath.
     */
    _updatePathProgress(pathfinder, windDirection) {
        if (this.currentWaypointIndex >= this.pathWaypoints.length) return;
        const targetWaypoint = this.pathWaypoints[this.currentWaypointIndex];
        if (distance(this, targetWaypoint) < this.shipLength * 2) {
            // We reached the waypoint. This waypoint now becomes the start of the next segment.
            this.currentSegmentStart = targetWaypoint;
            this.currentWaypointIndex++;
            this.resetFailsafeState();
        }
    }

    /**
     * Checks if the ship has drifted too far from its intended path segment (Cross-Track Error).
     * If so, it triggers a path recalculation to find a new optimal route from the current position.
     * @private
     */
    _checkPathDeviation(deltaTime, pathfinder, windDirection) {
        this.pathDeviationTimer -= deltaTime;
        if (this.pathDeviationTimer > 0) return;
        this.pathDeviationTimer = 1000; // Check once per second

        if (!this.currentSegmentStart || this.pathWaypoints.length === 0 || this.currentWaypointIndex >= this.pathWaypoints.length) return;

        const targetWaypoint = this.pathWaypoints[this.currentWaypointIndex];
        
        // Calculate squared distance from the ship to the line segment (Start -> Target)
        // distanceToSegmentSquared is provided by utils.js
        const distSq = distanceToSegmentSquared(this, this.currentSegmentStart, targetWaypoint);
        const threshold = this.shipLength * 10; // Allow deviation up to 10 ship lengths

        if (distSq > threshold * threshold) {
            // console.log(`[${this.shipId}] Significant path deviation detected. Recalculating.`);
            this.recalculatePath(pathfinder, windDirection);
            this.pathDeviationTimer = 5000; // Add a cooldown to prevent spamming if recalculation fails
        }
    }

    /**
     * Resets the local AI state variables, typically after getting a new path.
     */
    resetFailsafeState() {
        this.tackDirection = 0;
        this.stuckTimer = 0;
        this.pathProgressTimer = 0;
        this.lastDistanceToWaypoint = Infinity;
        this.isPerformingAvoidancePivot = false;
        this.avoidanceTargetAngle = 0;
        this.avoidancePersistenceTimer = 0;
        this.avoidanceStuckTimer = 0;
        this.consecutivePathingFailures = 0; // Reset failure count on success
    }

    /**
     * Overrides the base draw method to add the NPC's HP bar and debug whiskers.
     * @param {number} worldToScreenScale - The current camera zoom level.
     * @param {number} windDirection - The current wind direction in radians.
     */
    drawWorldSpace(ctx, worldToScreenScale, windDirection) {
        // Call the parent method to draw the ship itself
        super.drawWorldSpace(ctx, worldToScreenScale, windDirection);

        // --- NEW: Draw Debug Sectors ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            
            const radiusX = this.shipLength * 3; // Forward range (Matches _updateSensors)
            const radiusY = this.shipLength * 1.2; // Side range (Matches _updateSensors)
            
            // Helper to convert geometric angle to eccentric angle for ellipse drawing
            const getEccentricAngle = (angle) => {
                return Math.atan2(radiusX * Math.sin(angle), radiusY * Math.cos(angle));
            };

            // Define sectors matching _updateSensors logic
            const sectors = [
                { name: 'front', start: -Math.PI/4, end: Math.PI/4 },
                { name: 'starboard', start: Math.PI/4, end: 3*Math.PI/4 },
                { name: 'port', start: -3*Math.PI/4, end: -Math.PI/4 }
            ];

            sectors.forEach(s => {
                const startEcc = getEccentricAngle(s.start);
                const endEcc = getEccentricAngle(s.end);

                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.ellipse(0, 0, radiusX, radiusY, 0, startEcc, endEcc);
                ctx.closePath();
                
                // Check if this sector has a hit
                // --- FIX: Check all whiskers in the sector, not just the exact name ---
                let hasHit = false;
                if (s.name === 'front') hasHit = !!this.whiskerHits['front'];
                else if (s.name === 'port') hasHit = Object.keys(this.whiskerHits).some(k => k.startsWith('port'));
                else if (s.name === 'starboard') hasHit = Object.keys(this.whiskerHits).some(k => k.startsWith('starboard'));

                if (hasHit) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.25)'; // Red for hit
                    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
                } else {
                    ctx.fillStyle = 'rgba(0, 255, 255, 0.05)'; // Faint cyan for clear
                    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)'; 
                }
                
                ctx.fill();
                ctx.lineWidth = 1 / worldToScreenScale;
                ctx.stroke();
            });

            // Draw Ellipse Boundary (Visualizes the range limit)
            ctx.beginPath();
            ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)'; // Faint Yellow
            ctx.lineWidth = 1 / worldToScreenScale;
            ctx.stroke();

            ctx.restore();
        }

        // --- NEW: Draw debug whiskers ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && this.debugWhiskerLines && this.debugWhiskerLines.length > 0) {
            ctx.save();
            // Whiskers are in world coordinates, so we don't need to translate/rotate.
            // The main draw loop has already applied the camera transform.
            ctx.lineWidth = 2 / worldToScreenScale;

            this.debugWhiskerLines.forEach(whisker => {
                // New: Change color if whisker has a hit
                if (whisker.isShip) {
                    ctx.strokeStyle = 'rgba(255, 0, 255, 0.8)'; // Magenta for ship detection
                } else {
                    ctx.strokeStyle = whisker.hit ? 'rgba(255, 255, 0, 1)' : 'rgba(255, 0, 0, 1)'; // Yellow/Red for terrain
                }
                
                ctx.beginPath();
                ctx.moveTo(whisker.start.x, whisker.start.y);
                ctx.lineTo(whisker.end.x, whisker.end.y);
                ctx.stroke();

                // --- NEW: Draw 0.5L Braking Threshold Marker ---
                const dx = whisker.end.x - whisker.start.x;
                const dy = whisker.end.y - whisker.start.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const thresholdDist = this.shipLength * 0.5;

                if (len >= thresholdDist) {
                    const dirX = dx / len;
                    const dirY = dy / len;
                    
                    // Point on line
                    const mx = whisker.start.x + dirX * thresholdDist;
                    const my = whisker.start.y + dirY * thresholdDist;

                    // Perpendicular vector
                    const perpX = -dirY;
                    const perpY = dirX;
                    const markerSize = 5 / worldToScreenScale; // Visual size

                    ctx.beginPath();
                    ctx.moveTo(mx - perpX * markerSize, my - perpY * markerSize);
                    ctx.lineTo(mx + perpX * markerSize, my + perpY * markerSize);
                    
                    ctx.save();
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 3 / worldToScreenScale;
                    ctx.stroke();
                    ctx.restore();
                }
            });

            ctx.restore();
        }

        // --- NEW: Draw Lookout Lines ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && this.debugLookoutLines && this.debugLookoutLines.length > 0) {
            ctx.save();
            ctx.lineWidth = 1 / worldToScreenScale;
            
            this.debugLookoutLines.forEach(line => {
                ctx.strokeStyle = line.color;
                ctx.beginPath();
                ctx.moveTo(line.start.x, line.start.y);
                ctx.lineTo(line.end.x, line.end.y);
                ctx.stroke();
            });
            ctx.restore();
        }

        // --- NEW: Draw VMG Debug Data ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && DEBUG.DRAW_VMG_DATA && this.debugVMGData && this.debugVMGData.length > 0) {
            ctx.save();
            ctx.translate(this.x, this.y);
            
            this.debugVMGData.forEach(data => {
                const len = 40 + (data.vmg * 10); // Scale length by VMG
                const angle = data.angle;
                
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
                
                if (data.isBest) {
                    ctx.strokeStyle = '#00FF00'; // Green for best choice
                    ctx.lineWidth = 3 / worldToScreenScale;
                } else {
                    // Yellow for positive VMG, Red for negative
                    ctx.strokeStyle = data.vmg > 0 ? 'rgba(255, 255, 0, 0.5)' : 'rgba(255, 0, 0, 0.3)';
                    ctx.lineWidth = 1 / worldToScreenScale;
                }
                ctx.stroke();
            });
            ctx.restore();
        }

        // --- NEW: Draw Safety Bubble ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && this.debugSafetyBubble) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 0, 255, 0.5)'; // Magenta
            ctx.lineWidth = 2 / worldToScreenScale;
            ctx.setLineDash([5 / worldToScreenScale, 5 / worldToScreenScale]);
            ctx.beginPath();
            ctx.arc(this.debugSafetyBubble.x, this.debugSafetyBubble.y, this.debugSafetyBubble.radius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Now, draw the HP bar on top
        this._drawHpBar(ctx, worldToScreenScale);
    }

    /**
     * New: Draws debug overlays that should appear on top of all ships (e.g. target boxes).
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} worldToScreenScale 
     */
    drawDebugOverlay(ctx, worldToScreenScale) {
        // --- NEW: Draw debug fire zone ---
        // This is drawn after whiskers but before the HP bar for correct layering.
        if (this.combatPilot && this.combatPilot.debugFireZone) {
            ctx.save();
            // The fire zone polygon is already in world coordinates, so we don't need
            // to apply the ship's local transform. The main draw loop has already
            // applied the camera transform.
            const zone = this.combatPilot.debugFireZone;
            const points = Array.isArray(zone) ? zone : zone.polygon; // Handle legacy/new structure
            ctx.fillStyle = zone.color || 'rgba(128, 128, 128, 0.25)';

            ctx.beginPath();
            points.forEach((point, index) => {
                if (index === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            });
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // --- NEW: Draw Debug Broadside Boxes (Geometric Overlap) ---
        if (this.combatPilot && this.combatPilot.debugBroadsideBoxes && this.combatPilot.debugBroadsideBoxes.length > 0) {
            ctx.save();
            ctx.lineWidth = 2 / worldToScreenScale;
            
            this.combatPilot.debugBroadsideBoxes.forEach(entry => {
                const box = entry.polygon;
                const isLocked = entry.isLocked;
                ctx.strokeStyle = isLocked ? 'rgba(255, 255, 0, 0.8)' : 'rgba(255, 0, 255, 0.8)'; // Yellow if locked, Magenta if not

                ctx.beginPath();
                box.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.closePath();
                ctx.stroke();
            });
            ctx.restore();
        }

        // --- NEW: Draw Debug Target Box ---
        if (this.combatPilot && this.combatPilot.debugTargetBox) {
            ctx.save();
            ctx.strokeStyle = 'rgba(200, 200, 200, 0.8)'; // Light gray
            ctx.lineWidth = 2 / worldToScreenScale;
            ctx.setLineDash([5 / worldToScreenScale, 5 / worldToScreenScale]); // Dashed line
            
            const box = this.combatPilot.debugTargetBox;
            ctx.beginPath();
            box.forEach((p, i) => {
                if (i === 0) ctx.moveTo(p.x, p.y);
                else ctx.lineTo(p.x, p.y);
            });
            ctx.closePath();
            ctx.stroke();
            ctx.restore();
        }

        // --- NEW: Draw Debug Chase Target (Blind Spot) ---
        if (this.combatPilot && this.combatPilot.debugChaseTarget) {
            ctx.save();
            const t = this.combatPilot.debugChaseTarget;
            const s = 8 / worldToScreenScale;
            
            // --- NEW: Draw Lead Line ---
            // Connects the ship to its chase target for visual clarity.
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(t.x, t.y);
            ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)'; // Transparent Green
            ctx.setLineDash([5 / worldToScreenScale, 5 / worldToScreenScale]);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = 2 / worldToScreenScale;
            
            // Circle
            ctx.beginPath();
            ctx.arc(t.x, t.y, s, 0, Math.PI * 2);
            ctx.stroke();
            
            // Crosshair
            ctx.beginPath();
            ctx.moveTo(t.x - s * 1.5, t.y); ctx.lineTo(t.x + s * 1.5, t.y);
            ctx.moveTo(t.x, t.y - s * 1.5); ctx.lineTo(t.x, t.y + s * 1.5);
            ctx.stroke();
            
            ctx.restore();
        }

        // --- NEW: Draw Target Angle Vector ---
        // Visualizes the exact heading the AI is trying to achieve.
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
            ctx.save();
            const len = this.shipLength * 2.5;
            const tx = this.x + Math.cos(this.targetAngle) * len;
            const ty = this.y + Math.sin(this.targetAngle) * len;

            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(tx, ty);
            ctx.strokeStyle = '#FF00FF'; // Magenta
            ctx.lineWidth = 2 / worldToScreenScale;
            ctx.setLineDash([10 / worldToScreenScale, 5 / worldToScreenScale]);
            ctx.stroke();
            ctx.restore();
        }

        // --- NEW: Draw Tangent Navigation Target ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && this.debugTangentTarget) {
            ctx.save();
            const t = this.debugTangentTarget;
            
            // Draw Line to Target
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(t.x, t.y);
            ctx.strokeStyle = '#00FF00'; // Bright Green
            ctx.lineWidth = 3 / worldToScreenScale;
            ctx.setLineDash([15 / worldToScreenScale, 5 / worldToScreenScale]);
            ctx.stroke();

            // Draw Target Dot
            ctx.beginPath();
            ctx.arc(t.x, t.y, 6 / worldToScreenScale, 0, Math.PI * 2);
            ctx.fillStyle = '#00FF00';
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // --- NEW: Draw Tangent-to-Radius Visualization ---
        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
            if (this.debugAvoidanceRadius) {
                ctx.save();
                ctx.strokeStyle = 'orange'; // Radius Line (Distance to Threat)
                ctx.lineWidth = 2 / worldToScreenScale;
                ctx.setLineDash([5 / worldToScreenScale, 5 / worldToScreenScale]);
                ctx.beginPath();
                ctx.moveTo(this.debugAvoidanceRadius.start.x, this.debugAvoidanceRadius.start.y);
                ctx.lineTo(this.debugAvoidanceRadius.end.x, this.debugAvoidanceRadius.end.y);
                ctx.stroke();
                
                // Draw a dot at the hit point
                ctx.fillStyle = 'orange';
                ctx.beginPath();
                ctx.arc(this.debugAvoidanceRadius.end.x, this.debugAvoidanceRadius.end.y, 4 / worldToScreenScale, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            if (this.debugAvoidanceTangent) {
                ctx.save();
                ctx.strokeStyle = 'cyan'; // Tangent (Steering) Vector
                ctx.lineWidth = 3 / worldToScreenScale;
                ctx.beginPath();
                ctx.moveTo(this.debugAvoidanceTangent.start.x, this.debugAvoidanceTangent.start.y);
                ctx.lineTo(this.debugAvoidanceTangent.end.x, this.debugAvoidanceTangent.end.y);
                ctx.stroke();
                
                // Draw arrow head
                const angle = Math.atan2(this.debugAvoidanceTangent.end.y - this.debugAvoidanceTangent.start.y, this.debugAvoidanceTangent.end.x - this.debugAvoidanceTangent.start.x);
                const headLen = 10 / worldToScreenScale;
                ctx.beginPath();
                ctx.moveTo(this.debugAvoidanceTangent.end.x, this.debugAvoidanceTangent.end.y);
                ctx.lineTo(this.debugAvoidanceTangent.end.x - headLen * Math.cos(angle - Math.PI / 6), this.debugAvoidanceTangent.end.y - headLen * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(this.debugAvoidanceTangent.end.x - headLen * Math.cos(angle + Math.PI / 6), this.debugAvoidanceTangent.end.y - headLen * Math.sin(angle + Math.PI / 6));
                ctx.lineTo(this.debugAvoidanceTangent.end.x, this.debugAvoidanceTangent.end.y);
                ctx.fillStyle = 'cyan';
                ctx.fill();
                ctx.restore();
            }
        }

        // --- NEW: Debug Info Tag (Below Ship) ---
        ctx.save();
        ctx.translate(this.x, this.y);
        
        // Scale font size to remain readable regardless of zoom
        const fontSize = 12 / worldToScreenScale;
        const lineHeight = fontSize * 1.2;
        
        // Position below the ship. Use a safe offset based on ship size.
        const yOffset = (this.shipLength / 2) + (15 / worldToScreenScale);

        ctx.font = `${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#00FF00'; // Bright green for debug
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 2;

        // Line 1: ID
        ctx.fillText(`[${this.shipId}]`, 0, yOffset);

        // --- NEW: Draw [LOG] Button ---
        // Draw a small button to the right of the ID to trigger console logging.
        const logBtnWidth = 24 / worldToScreenScale;
        const logBtnHeight = 10 / worldToScreenScale;
        const logBtnX = 50 / worldToScreenScale; // Offset to right of center
        const logBtnY = yOffset;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(logBtnX, logBtnY, logBtnWidth, logBtnHeight);
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 1 / worldToScreenScale;
        ctx.strokeRect(logBtnX, logBtnY, logBtnWidth, logBtnHeight);
        
        ctx.fillStyle = '#00FF00';
        ctx.font = `${8 / worldToScreenScale}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText("LOG", logBtnX + logBtnWidth/2, logBtnY + logBtnHeight/2);
        
        // Reset text alignment for subsequent lines
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Store bounds for click handler (Local coords relative to ship center)
        this.debugLogButtonBounds = { x: logBtnX, y: logBtnY, w: logBtnWidth, h: logBtnHeight };


        // Line 2: State & Objective
        let objectiveText = '';
        if (this.destinationIsland) {
            objectiveText = `Dest: Island ${this.destinationIsland.id}`;
        } else if (this.targetShip) {
            const targetName = this.targetShip.shipId || (this.targetShip.name || 'Target');
            objectiveText = `Target: ${targetName}`;
        } else {
            objectiveText = 'No Target';
        }
        
        if (this.pathWaypoints && this.pathWaypoints.length > 0) {
             objectiveText += ` (WP ${this.currentWaypointIndex}/${this.pathWaypoints.length})`;
        }

        // --- NEW: Include Combat Phase in Status ---
        let stateText = this.aiState.toUpperCase();
        if (this.aiState === 'combat' && this.combatPilot && this.combatPilot.combatPhase) {
            stateText += ` (${this.combatPilot.combatPhase.toUpperCase()})`;
        }
        ctx.fillText(`${stateText} | ${objectiveText}`, 0, yOffset + lineHeight);

        // Line 3: Immediate Status (Action)
        ctx.fillText(this.debugStatus || 'Idle', 0, yOffset + (lineHeight * 2));

        // Line 4: Tacking Info (If active)
        let currentLine = 3;
        if (this.debugTackState) {
            const dirStr = this.debugTackState.dir === 1 ? 'STBD' : 'PORT';
            ctx.fillText(`Tack: ${dirStr}`, 0, yOffset + (lineHeight * currentLine));
            currentLine++;
        }

        // Line 5: Whisker Status
        const whiskerCount = this.terrainWhiskers ? this.terrainWhiskers.length : 0;
        const debugLineCount = this.debugWhiskerLines ? this.debugWhiskerLines.length : 0;
        ctx.fillText(`Whiskers: ${whiskerCount} (Active: ${debugLineCount})`, 0, yOffset + (lineHeight * currentLine));
        currentLine++;

        // Line 6: Throttle
        let throttleText = `Throttle: ${this.throttle.toFixed(2)}`;
        if (this.throttleReason) throttleText += ` [${this.throttleReason}]`;
        ctx.fillText(throttleText, 0, yOffset + (lineHeight * currentLine));

        ctx.restore();
    }

    /**
     * Logs detailed debug information about this ship to the console.
     * Called when the debug ID tag is clicked.
     */
    logDebugInfo() {
        console.group(`Debug Info for ${this.shipId}`);
        console.log("Ship Instance:", this);
        console.log("AI State:", this.aiState);
        console.log("Position:", {x: this.x, y: this.y, angle: this.angle});
        console.log("Velocity:", {vx: this.vx, vy: this.vy, speed: Math.sqrt(this.vx**2 + this.vy**2)});
        console.log("Target:", this.targetShip);
        console.log("Destination:", this.destinationIsland);
        console.log("Path:", this.pathWaypoints);
        console.log("Current Waypoint Index:", this.currentWaypointIndex);
        
        console.group("Sensors");
        console.log("Terrain Whiskers Config:", this.terrainWhiskers);
        console.log("Debug Whisker Lines (Active):", this.debugWhiskerLines);
        console.log("Whisker Hits:", this.whiskerHits);
        console.log("Nearby Context:", this.nearbyContext);
        console.log("Sensor Update Timer:", this.sensorUpdateTimer);
        console.groupEnd();
        
        console.groupEnd();
    }

    /**
     * New: Encapsulates the HP bar drawing logic.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} worldToScreenScale - The current camera zoom level.
     * @private
     */
    _drawHpBar(ctx, worldToScreenScale) {
        // --- NEW: Visibility Logic ---
        const isCombat = this.aiState === 'combat' || this.aiState === 'fleeing';
        const isInteractionActive = this.isHovered || this.displayTimer > 0;
        const isFading = this.fadeTimer > 0;

        let opacity = 1.0;
        if (isCombat || isInteractionActive) {
            opacity = 1.0;
        } else if (isFading) {
            opacity = this.fadeTimer / 1000;
        } else {
            return; // Invisible
        }

        ctx.save();
        ctx.globalAlpha = opacity; // Apply fade
        ctx.translate(this.x, this.y); // Translate to the ship's center

        const barWidth = 30 / worldToScreenScale;
        const barHeight = 4 / worldToScreenScale; // Slightly thinner to fit 3 bars
        const spacing = 1 / worldToScreenScale;
        
        // Calculate total height of the stack (3 bars + 2 spaces)
        const totalStackHeight = (barHeight * 3) + (spacing * 2);
        
        // Position the stack above the ship.
        // We start drawing from the top bar down.
        let currentY = -this.shipLength / 2 - (10 / worldToScreenScale) - totalStackHeight;
        let nameOffset = currentY - (4 / worldToScreenScale);

        // --- NEW: Draw Ship Type if Interacted ---
        // Show type if actively interacting, in combat, or fading out
        if (isInteractionActive || isCombat || isFading) {
            // Push name up to make room for type
            const typeOffset = nameOffset;
            nameOffset -= (12 / worldToScreenScale);

            // OPTIMIZATION: Round font size to integer to allow browser caching
            const typeFontSize = Math.round(8 / worldToScreenScale);
            ctx.font = `${typeFontSize}px "IM Fell English"`;
            ctx.textAlign = 'center';
            ctx.fillStyle = '#cccccc'; // Light grey
            // OPTIMIZATION: Remove strokeText, use shadow for contrast instead
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 2;
            ctx.fillText(this.shipType, 0, typeOffset);
        }

        // Helper for color interpolation (Base Color -> Red)
        const getBarColor = (ratio, baseR, baseG, baseB) => {
            const t = 1 - ratio; // 0 at full health, 1 at empty
            const r = Math.round(baseR + (255 - baseR) * t);
            const g = Math.round(baseG + (0 - baseG) * t);
            const b = Math.round(baseB + (0 - baseB) * t);
            return `rgb(${r}, ${g}, ${b})`;
        };

        // Define bars (Top to Bottom: Crew, Rig, Hull)
        const bars = [
            { current: this.crew, max: this.maxCrew, baseColor: { r: 46, g: 204, b: 113 } }, // Green (#2ecc71)
            { current: this.rigHp, max: this.maxRigHp, baseColor: { r: 255, g: 255, b: 255 } }, // White
            { current: this.hp, max: this.maxHp, baseColor: { r: 92, g: 84, b: 61 } } // Brown (#5C543D)
        ];

        // Draw Archetype Name above the stack
        // OPTIMIZATION: Round font size
        const nameFontSize = Math.round(10 / worldToScreenScale);
        ctx.font = `${nameFontSize}px "IM Fell English"`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';
        // Shadow settings persist from above (or default)
        ctx.fillText(this.displayName, 0, nameOffset);

        // Draw Bars
        bars.forEach(bar => {
            const max = bar.max > 0 ? bar.max : 1;
            const ratio = Math.max(0, Math.min(1, bar.current / max));
            
            // Reset shadow for bars
            ctx.shadowBlur = 0;

            // Background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(-barWidth / 2, currentY, barWidth, barHeight);

            // Fill
            ctx.fillStyle = getBarColor(ratio, bar.baseColor.r, bar.baseColor.g, bar.baseColor.b);
            ctx.fillRect(-barWidth / 2, currentY, barWidth * ratio, barHeight);

            // Border
            ctx.strokeStyle = '#ecf0f1';
            ctx.lineWidth = 0.5 / worldToScreenScale;
            ctx.strokeRect(-barWidth / 2, currentY, barWidth, barHeight);

            currentY += barHeight + spacing;
        });

        ctx.restore();
    }

    /**
     * Finds the best wind-aware angle to sail towards a target angle.
     * This is a core piece of sailing logic used by multiple AI states.
     * @param {number} targetAngle - The direct angle to the target.
     * @param {number} windDirection - The current wind direction.
     * @returns {number} The best sailing angle.
     * @private
     */
    _findBestSailingAngle(targetAngle, windDirection) {
        let angleDiffFromUpwind = normalizeAngle(targetAngle - windDirection);
        if (angleDiffFromUpwind > Math.PI) { angleDiffFromUpwind -= 2 * Math.PI; }
        if (angleDiffFromUpwind < -Math.PI) { angleDiffFromUpwind += 2 * Math.PI; }

        // --- FIX: Use ship-specific close-hauled angle ---
        const closeHauledAngle = this.getCloseHauledAngle();

        if (Math.abs(angleDiffFromUpwind) < closeHauledAngle) { // Target is in the "no-sail" zone
            // Target is upwind, choose the better tack.
            const starboardTackAngle = normalizeAngle(windDirection + closeHauledAngle);
            const portTackAngle = normalizeAngle(windDirection - closeHauledAngle);
            // --- FIX: Choose the tack that is closer to the original target angle ---
            const starboardDiff = Math.abs(normalizeAngle(starboardTackAngle - targetAngle));
            const portDiff = Math.abs(normalizeAngle(portTackAngle - targetAngle));
            return (starboardDiff < portDiff) ? starboardTackAngle : portTackAngle;
        } else {
            // Target is not upwind, so sail directly towards it.
            return targetAngle;
        }
    }

    /**
     * Finds a clear angle to reposition the ship, starting from a base angle.
     * This is a universal failsafe for all NPCs.
     * @param {number} baseAngle - The initial angle to test.
     * @param {Pathfinder} pathfinder - The global pathfinder instance.
     * @param {number} windDirection - The current wind direction.
     * @returns {number} A safe and sailable angle in radians.
     * @private
     */
    _findClearSailableAngle(baseAngle, pathfinder, windDirection, checkWalkable = false, fallbackAngle = null) {
        if (!pathfinder) return baseAngle;
        this.debugLookoutLines = []; // Clear debug lines

        // --- The Lookout ---
        // Scans ahead to find an escape route when the Pilot is stressed.
        
        const lookAheadDist = this.shipLength * 4; // Moderate lookahead (matches diagonal whiskers)
        const angleIncrement = Math.PI / 18; // 10 degrees
        const maxSearchAngle = Math.PI * 0.6; // Check +/- 108 degrees (wide scan)

        const checkAngle = (angle) => {
            // 1. Wind Check: Don't pick an angle we can't sail
            const speedMult = this.getWindSpeedMultiplier(angle, windDirection);
            if (speedMult < 0.1) return false;

            // 2. Physical Collision Check
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);
            const end = { x: this.x + cosA * lookAheadDist, y: this.y + sinA * lookAheadDist };

            // --- FIX: Explicit World Boundary Check ---
            if (end.x < 0 || end.x > WORLD_WIDTH || end.y < 0 || end.y > WORLD_HEIGHT) {
                return false;
            }

            // Use simplified hull check for performance. 
            const isClear = pathfinder.isLineOfSightClear({x: this.x, y: this.y}, end, [], true, this.nearbyContext.obstacles);

            // Debug Visuals
            if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED) {
                this.debugLookoutLines.push({
                    start: {x: this.x, y: this.y}, 
                    end: end,
                    color: isClear ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)'
                });
            }

            return isClear;
        };

        // 1. Check Base Angle First (The Pilot's suggestion)
        if (checkAngle(baseAngle)) return baseAngle;

        // 2. Sweep Left/Right
        for (let i = 1; i * angleIncrement <= maxSearchAngle; i++) {
            const right = normalizeAngle(baseAngle + i * angleIncrement);
            if (checkAngle(right)) return right;

            const left = normalizeAngle(baseAngle - i * angleIncrement);
            if (checkAngle(left)) return left;
        }

        // 3. Fallback: If trapped, default to Pilot's choice (will likely trigger pivot/reverse)
        // --- FIX: Use the provided fallback (avoidance angle) if available, otherwise default to base desire. ---
        const angleToUse = (fallbackAngle !== null) ? fallbackAngle : baseAngle;
        return this._findBestSailingAngle(angleToUse, windDirection);
    }

    /**
     * NEW: Multi-Obstacle Tangent Navigation Solver.
     * Calculates tangent targets for all detected obstacles and averages them.
     * @param {number} desiredAngle - The angle the ship WANTS to go.
     * @param {Array<Obstacle>} obstacles - The list of obstacles to avoid.
     * @returns {number|null} The angle to the averaged tangent point, or null.
     * @private
     */
    _findTangentAvoidanceAngle(desiredAngle, obstacles) {
        if (!obstacles || obstacles.length === 0) return null;

        this.debugTangentTarget = null;
        let bestTangentAngle = null;
        let maxDeviation = -1;
        let bestTargetPoint = null;

        for (const obstacle of obstacles) {
            const targetPoint = this._calculateTangentTarget(desiredAngle, obstacle, this._cachedTangentPoint);
            if (targetPoint) {
                const angle = Math.atan2(targetPoint.y - this.y, targetPoint.x - this.x);
                
                // Calculate deviation magnitude (absolute difference)
                let diff = Math.abs(normalizeAngle(angle - desiredAngle));
                
                // Keep the angle that requires the largest turn (Max Deviation)
                // This ensures we clear the "most difficult" obstacle in the stack.
                if (diff > maxDeviation) {
                    maxDeviation = diff;
                    bestTangentAngle = angle;
                    // Copy to best point to avoid reference issues with the shared cached point
                    this._cachedBestTangentPoint.x = targetPoint.x;
                    this._cachedBestTangentPoint.y = targetPoint.y;
                    bestTargetPoint = this._cachedBestTangentPoint; // Update reference for debug
                }
            }
        }

        this.debugTangentTarget = bestTargetPoint; // Store for visualization
        return bestTangentAngle;
    }

    /**
     * Helper to calculate the tangent target point for a single obstacle.
     * @param {object} [out] - Optional object to write result to.
     * @private
     */
    _calculateTangentTarget(desiredAngle, obstacle, out = null) {
        if (!obstacle || !obstacle.convexHull || obstacle.convexHull.length < 3) return null;

        // 1. Calculate Centroid (approximate)
        let cx = 0, cy = 0;
        for (const p of obstacle.convexHull) { cx += p.x; cy += p.y; }
        cx /= obstacle.convexHull.length;
        cy /= obstacle.convexHull.length;

        // 2. Calculate Angle to Centroid
        const angleToCentroid = Math.atan2(cy - this.y, cx - this.x);

        // 3. Find Left-most and Right-most Tangent Vertices
        // We project all vertices into angular space relative to the centroid vector.
        // In Canvas Y-Down: Positive = Clockwise (Right), Negative = Counter-Clockwise (Left)
        let maxCwDiff = -Infinity; // Max Positive (Right-most)
        let maxCcwDiff = Infinity; // Min Negative (Left-most)
        let cwVertex = null;
        let ccwVertex = null;

        for (const p of obstacle.convexHull) {
            const angleToP = Math.atan2(p.y - this.y, p.x - this.x);
            let diff = normalizeAngle(angleToP - angleToCentroid);
            
            // Normalize to -PI to PI
            if (diff > Math.PI) diff -= 2 * Math.PI;
            if (diff < -Math.PI) diff += 2 * Math.PI;

            if (diff > maxCwDiff) {
                maxCwDiff = diff;
                cwVertex = p;
            }
            if (diff < maxCcwDiff) {
                maxCcwDiff = diff;
                ccwVertex = p;
            }
        }

        // 6. Apply Safety Buffer (Moved up for use in blocking check)
        // Project outwards from the centroid through the vertex.
        // Buffer distance: 1x Ship Length (increased from 2x Beam for safer turns)
        const bufferDist = this.shipLength;

        // 4. Determine if our desired path is blocked
        let diffDesired = normalizeAngle(desiredAngle - angleToCentroid);
        if (diffDesired > Math.PI) diffDesired -= 2 * Math.PI;
        if (diffDesired < -Math.PI) diffDesired += 2 * Math.PI;

        // --- FIX: Include Buffer in Blocking Check ---
        // Calculate angular width of the buffer at the obstacle's distance.
        const distToCentroid = Math.sqrt((cx - this.x)**2 + (cy - this.y)**2);
        const angularBuffer = Math.atan2(bufferDist, distToCentroid);

        // If desired angle is outside the cone of the obstacle, we don't need to deviate.
        // We widen the "blocked" cone by the angular buffer to ensure we don't sail into the safety zone.
        if (diffDesired > maxCwDiff + angularBuffer || diffDesired < maxCcwDiff - angularBuffer) {
            return null; 
        }

        // 5. Pick the Best Side (closest to desired)
        const targetVertex = (Math.abs(diffDesired - maxCwDiff) < Math.abs(diffDesired - maxCcwDiff)) ? cwVertex : ccwVertex;

        const vx = targetVertex.x - cx;
        const vy = targetVertex.y - cy;
        const len = Math.sqrt(vx*vx + vy*vy);

        const result = out || { x: 0, y: 0 };
        result.x = targetVertex.x + (vx / len) * bufferDist;
        result.y = targetVertex.y + (vy / len) * bufferDist;
        
        return result;
    }

    /**
     * Helper to update the cache for _findClearSailableAngle.
     * @private
     */
    _updateSailableAngleCache(now, baseAngle, result, checkWalkable) {
        this.sailableAngleCache = {
            lastCheck: now,
            lastBaseAngle: baseAngle,
            lastResult: result,
            checkWalkable: checkWalkable
        };
    }

    /**
     * Clears the current path and logs the reason for debugging.
     * This provides a clear trace of why a ship might abandon its route.
     * @param {string} reason - The reason the path is being cleared.
     * @private
     */
    _clearPath(reason) {
        if (this.pathWaypoints.length > 0) { // Only log if there was a path to clear.
            // This console log is now too noisy with the new non-destructive evasion, so it's commented out.
            // console.log(`[${this.shipId} Path Cleared] Reason: ${reason} | Pos: (${this.x.toFixed(0)}, ${this.y.toFixed(0)})`);
            this.pathWaypoints = [];
            this.currentWaypointIndex = 0;
            this.repathFromEvasionCooldown = 500; // Short cooldown before repathing is allowed.
        } else {
            // If there's no path, just ensure it's empty.
            this.pathWaypoints = [];
            this.currentWaypointIndex = 0;
            this.repathFromEvasionCooldown = 500;
        }
    }

    /**
     * Checks if a maneuver in a given direction is safe using the Pathfinder's robust safety check.
     * @param {number} angle - The direction to check.
     * @param {Pathfinder} pathfinder - The global pathfinder.
     * @param {number} lookAheadDist - How far to check.
     * @param {boolean} checkWalkable - Whether to also check if the destination node is walkable.
     * @param {boolean} ignoreBuffer - Whether to ignore the safety buffer (for emergency escapes).
     * @returns {boolean} True if safe.
     */
    _isManeuverSafe(angle, pathfinder, lookAheadDist = NPC_TACK_AVOIDANCE_RANGE, checkWalkable = false, ignoreBuffer = false) {
        const lookAheadPoint = { x: this.x + Math.cos(angle) * lookAheadDist, y: this.y + Math.sin(angle) * lookAheadDist };

        // Check 1: World Boundaries. Ensure the maneuver doesn't lead out of the world.
        if (lookAheadPoint.x < 0 || lookAheadPoint.x > WORLD_WIDTH || lookAheadPoint.y < 0 || lookAheadPoint.y > WORLD_HEIGHT) {
            return false;
        }

        // --- NEW: Use Pathfinder's isSafeLine for robust buffer checking ---
        // This ensures the ship respects the same safety buffer used by A*, preventing it from
        // steering into areas where it would get stuck.
        if (!pathfinder.isSafeLine({x: this.x, y: this.y}, lookAheadPoint, this, ignoreBuffer)) {
            return false;
        }

        // If required, also check if the destination of the maneuver is on a walkable grid node.
        // This is crucial for the "I'm stuck" recovery logic.
        if (checkWalkable) {
            const destinationNode = pathfinder._worldToGridNode(lookAheadPoint);
            if (!destinationNode || !destinationNode.walkable) {
                return false; // The destination is not walkable.
            }
        }
        return true;
    }

    /**
     * New: Optimized raycast that only checks the pathfinding grid for terrain.
     * Skips the expensive spatial grid query entirely.
     * @private
     * @param {Array} [cachedObstacles] - Optional list of obstacles to check against, skipping grid query.
     * @param {object} [outHit] - Optional object to populate with hit data.
     */
    _castTerrainRay(start, end, pathfinder, cachedObstacles = null, outHit = null) {
        // --- NEW: Polygon Raycast (Physical Reality) ---
        // Instead of checking the abstract grid (which has buffers), check the actual
        // geometry of the obstacles. This allows the ship to sail in the "buffer zone"
        // without panicking, as long as it isn't about to hit the rock itself.

        let potentialObstacles;
        
        if (cachedObstacles) {
            potentialObstacles = cachedObstacles;
        } else {
            const spatialGrid = pathfinder.spatialGrid;
            const queryAABB = {
                minX: Math.min(start.x, end.x),
                maxX: Math.max(start.x, end.x),
                minY: Math.min(start.y, end.y),
                maxY: Math.max(start.y, end.y)
            };
            potentialObstacles = spatialGrid.query(queryAABB);
        }

        let closestHit = null;
        let minDistSq = Infinity; 

        for (const obstacle of potentialObstacles) {
            // Filter for terrain types
            if (!['island', 'rock', 'coralReef', 'shoal', 'coralReefBase'].includes(obstacle.type)) continue;

            // --- FIX: Use ONLY the simplified Convex Hull for AI avoidance. ---
            // This prevents the AI from "seeing" and reacting to complex concave shapes (bays, etc.),
            // which can cause it to get stuck. The physics engine still uses the detailed polygons for actual collisions.
            if (!obstacle.convexHull) {
                continue; // If an obstacle has no simplified hull, the AI should ignore it for avoidance.
            }

            // --- OPTIMIZATION: Ray-AABB Check ---
            // Skip expensive edge checks if the ray doesn't even overlap the obstacle's bounding box.
            if (obstacle.boundingRect) {
                const minX = Math.min(start.x, end.x), maxX = Math.max(start.x, end.x);
                const minY = Math.min(start.y, end.y), maxY = Math.max(start.y, end.y);
                if (maxX < obstacle.boundingRect.minX || minX > obstacle.boundingRect.maxX ||
                    maxY < obstacle.boundingRect.minY || minY > obstacle.boundingRect.maxY) {
                    continue;
                }
            }
            
            const poly = obstacle.convexHull;
            
            // Check each edge of the polygon
            for (let i = 0; i < poly.length; i++) {
                const p1 = poly[i];
                const p2 = poly[(i + 1) % poly.length];
                
                // Line-Line Intersection (Ray vs Edge)
                const den = (start.x - end.x) * (p1.y - p2.y) - (start.y - end.y) * (p1.x - p2.x);
                if (den === 0) continue; // Parallel

                const t = ((start.x - p1.x) * (p1.y - p2.y) - (start.y - p1.y) * (p1.x - p2.x)) / den;
                const u = -((start.x - end.x) * (start.y - p1.y) - (start.y - end.y) * (start.x - p1.x)) / den;

                if (t > 0 && t < 1 && u > 0 && u < 1) {
                    const hitX = start.x + t * (end.x - start.x);
                    const hitY = start.y + t * (end.y - start.y);
                    const distSq = (start.x - hitX)**2 + (start.y - hitY)**2;

                    if (distSq < minDistSq) {
                        minDistSq = distSq;
                        
                        // --- NEW: Calculate Surface Normal ---
                        // Calculate the normal vector of the edge (p1 -> p2).
                        // Assuming clockwise winding, the outward normal is (dy, -dx).
                        const edgeDx = p2.x - p1.x;
                        const edgeDy = p2.y - p1.y;
                        const len = Math.sqrt(edgeDx*edgeDx + edgeDy*edgeDy);
                        const normal = { x: edgeDy / len, y: -edgeDx / len };

                        if (outHit) {
                            outHit.type = 'terrain';
                            outHit.x = hitX;
                            outHit.y = hitY;
                            outHit.distSq = distSq;
                            if (!outHit.normal) outHit.normal = {x:0, y:0};
                            outHit.normal.x = normal.x;
                            outHit.normal.y = normal.y;
                            outHit.obstacle = obstacle;
                            closestHit = outHit;
                        } else {
                            closestHit = { type: 'terrain', x: hitX, y: hitY, distSq: distSq, normal: normal, obstacle: obstacle };
                        }
                    }
                }
            }
        }

        return closestHit;
    }

    _getWhiskerCollision(start, end, pathfinder, shipsToAvoid, isShipCheckOnly = false, spatialGrid = null) {
        // --- Optimized Terrain Check using Distance Field (Fast Path) ---
        if (!isShipCheckOnly) {
            const startNode = pathfinder._worldToGridNode(start);
            const endNode = pathfinder._worldToGridNode(end);
            let x0 = startNode.gridX, y0 = startNode.gridY;
            const x1 = endNode.gridX, y1 = endNode.gridY;
            const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
            const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
            let err = dx + dy;

            // The required clearance is half the ship's width, converted to grid cells.
            // FIX: Use ceil instead of floor. This ensures the whiskers are at least as sensitive
            // as the pathfinder's safety checks, preventing the ship from sailing into a zone
            // it considers "safe" but the pathfinder considers "blocked".
            if (this.cachedClearanceCells === 0) {
                this.cachedClearanceCells = Math.ceil((this.shipWidth / 2) / pathfinder.cellSize);
            }
            const requiredClearanceInCells = this.cachedClearanceCells;

            while (true) {
                const currentNode = pathfinder.grid[x0][y0];
                // FIX: Change <= to < to align with Pathfinder and _isGridLineClear logic.
                // If distance == required, it means we have exactly the buffer we need, so it's safe.
                // Using <= caused the whiskers to flag "safe" paths as collisions, causing stuttering.
                if (currentNode.distanceToObstacle < requiredClearanceInCells) {
                    // We hit terrain. Return a generic object with the location of the hit grid cell.
                    return { type: 'terrain', x: currentNode.worldPos.x, y: currentNode.worldPos.y };
                }
                if (x0 === x1 && y0 === y1) break;
                const e2 = 2 * err;
                if (e2 >= dy) { err += dy; x0 += sx; }
                if (e2 <= dx) { err += dx; y0 += sy; }
            }
        }

        // --- Dynamic Ship-on-Ship Check (Slower Path) ---
        // This part only runs if no terrain was detected by the fast check.
        const queryAABB = {
            minX: Math.min(start.x, end.x),
            minY: Math.min(start.y, end.y),
            maxX: Math.max(start.x, end.x),
            maxY: Math.max(start.y, end.y)
        };
        
        const gridToUse = spatialGrid || pathfinder.spatialGrid;
        const potentialColliders = gridToUse.query(queryAABB);

        let closestShipHit = null;
        let closestShipDistSq = Infinity;

        // Pre-calculate whisker vector properties for circle intersection
        const wx = end.x - start.x;
        const wy = end.y - start.y;
        const a = wx * wx + wy * wy;

        for (const collider of potentialColliders) {
            // Direct type check is faster than creating intermediate arrays
            if (!(collider instanceof Ship)) continue;
            
            // Check if this ship is in our avoidance list (i.e., not us, and not ignored)
            // Note: shipsToAvoid is usually just 'npcs' excluding 'this'.
            // We can optimize by just checking 'collider !== this' if shipsToAvoid contains everything else.
            if (collider === this || !shipsToAvoid.includes(collider)) continue;

            // --- OPTIMIZATION: Fast AABB Check ---
            const colliderAABB = collider.getAABB();
            if (queryAABB.maxX < colliderAABB.minX || queryAABB.minX > colliderAABB.maxX ||
                queryAABB.maxY < colliderAABB.minY || queryAABB.minY > colliderAABB.maxY) {
                continue;
            }

            // --- OPTIMIZATION: Circle Intersection Check ---
            // Use a bounding radius slightly larger than half the ship length (0.6x) for a safety buffer.
            const radius = collider.shipLength * 0.6;
            const fx = start.x - collider.x;
            const fy = start.y - collider.y;
            
            const b = 2 * (fx * wx + fy * wy);
            const c = (fx * fx + fy * fy) - (radius * radius);

            const discriminant = b * b - 4 * a * c;

            if (discriminant >= 0) {
                const sqrtDisc = Math.sqrt(discriminant);
                const t1 = (-b - sqrtDisc) / (2 * a);
                const t2 = (-b + sqrtDisc) / (2 * a);

                if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1)) {
                    // If we find a ship, we don't return immediately. We want the *closest* one.
                    const distSq = (this.x - collider.x)**2 + (this.y - collider.y)**2;
                    if (distSq < closestShipDistSq) {
                        closestShipDistSq = distSq;
                        closestShipHit = collider;
                    }
                }
            }
        }

        return closestShipHit;
    }

}
