/**
 * Manages the game world by dividing it into sectors, handling object activation/deactivation,
 * and running a simplified simulation for dormant objects to maintain a persistent world
 * without the performance cost of simulating everything at once.
 */
class WorldManager {
    /**
     * @param {number} worldWidth - The total width of the game world.
     * @param {number} worldHeight - The total height of the game world.
     * @param {number} sectorSize - The size of each square sector.
     */
    constructor(worldWidth, worldHeight, sectorSize) {
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.sectorSize = sectorSize;
        this.sectors = new Map(); // Key: "x,y", Value: { static: [], dynamic: [], abstract: [] }
        this.activeSectors = new Set();
        this.scratchActiveSectors = new Set(); // --- OPTIMIZATION: Reusable Set to reduce GC ---

        // The number of sectors to activate around the player (e.g., a 3x3 grid where radius is 1)
        this.activationRadius = 1;

        // --- NEW: Dormant Sector Update Budgeting ---
        this.dormantSectorKeys = [];
        this.dormantUpdateIndex = 0;
        // The number of dormant sectors to update per frame. A smaller number spreads the load more,
        // but means dormant ships update less frequently. This value can be tuned for performance.
        this.DORMANT_UPDATE_BUDGET = 10;

        this._initializeSectors();

        // --- NEW: Object Pooling ---
        // Initialize reusable arrays to prevent garbage collection pressure
        this.cachedActiveStatics = [];
        this.cachedActiveDynamics = [];
        this.cachedActiveIslands = [];
        this.cachedActiveRocks = [];
        this.cachedActiveShoals = [];
        this.cachedActiveCoralReefs = [];
        
        // Reusable return object
        this.cachedActiveObjects = { statics: this.cachedActiveStatics, dynamics: this.cachedActiveDynamics, islands: this.cachedActiveIslands, rocks: this.cachedActiveRocks, shoals: this.cachedActiveShoals, coralReefs: this.cachedActiveCoralReefs };

        // --- NEW: Reusable array for rebinning ---
        this.cachedObjectsToMove = [];
        this.moveRequestPool = []; // --- OPTIMIZATION: Pool for move request objects ---

        // --- NEW: Sector Update Optimization ---
        this.lastPlayerSectorX = -1;
        this.lastPlayerSectorY = -1;
        this.lastActivationRadius = -1; // --- NEW: Track radius changes to prevent "Activation Storms" ---
        this.retrievalFrameId = 0; // --- NEW: For deduplication of multi-sector objects ---

        // --- NEW: Map Data Caching ---
        this.cachedNpcMapData = [];
        this.mapDataUpdateTimer = 0;
        this.mapDataPool = []; // --- OPTIMIZATION: Object pool for map data to reduce GC ---
        this.allStaticObjectsCache = null; // --- OPTIMIZATION: Cache for static object list ---
        this.MAP_DATA_UPDATE_INTERVAL = 250; // Update map data 4 times per second
    }

    /**
     * Creates the initial grid of sectors.
     * @private
     */
    _initializeSectors() {
        this.numSectorsX = Math.ceil(this.worldWidth / this.sectorSize);
        this.numSectorsY = Math.ceil(this.worldHeight / this.sectorSize);
        this.sectorKeys = []; // --- OPTIMIZATION: Cache keys ---
        for (let x = 0; x < this.numSectorsX; x++) {
            this.sectorKeys[x] = [];
            for (let y = 0; y < this.numSectorsY; y++) {
                const key = `${x},${y}`;
                this.sectorKeys[x][y] = key;
                this.sectors.set(key, {
                    x: x, // Store coordinates to avoid parsing keys later
                    y: y,
                    static: [], // Islands, rocks, etc.
                    dynamic: [], // Full NpcShip objects (when active)
                    abstract: [] // Lightweight data for dormant NPCs
                });
                // --- NEW: Initially, all sectors are dormant ---
                this.dormantSectorKeys.push(key);
            }
        }
    }

    /**
     * Gets the sector key for a given world position.
     * @param {{x: number, y: number}} position - The world position.
     * @returns {string} The sector key "x,y".
     */
    _getSectorKey(position) {
        const sectorX = Math.floor(position.x / this.sectorSize);
        const sectorY = Math.floor(position.y / this.sectorSize);
        return `${sectorX},${sectorY}`;
    }

    /**
     * Adds a static object (like an island) to the correct sector.
     * @param {Obstacle} object - The static object to add.
     */
    addStaticObject(object) {
        // --- FIX: Multi-Sector Registration ---
        // Register large objects in every sector they overlap.
        // This allows us to reduce the activation radius significantly in game.js.
        const startX = Math.max(0, Math.floor((object.minX ?? object.x) / this.sectorSize));
        const endX = Math.min(this.numSectorsX - 1, Math.floor((object.maxX ?? object.x) / this.sectorSize));
        const startY = Math.max(0, Math.floor((object.minY ?? object.y) / this.sectorSize));
        const endY = Math.min(this.numSectorsY - 1, Math.floor((object.maxY ?? object.y) / this.sectorSize));

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                const key = this.sectorKeys[x][y];
                this.sectors.get(key)?.static.push(object);
            }
        }
        this.staticCacheDirty = true; // --- OPTIMIZATION: Flag for batch invalidation ---
    }

    /**
     * Adds an abstract representation of a dynamic object (NPC) to the correct sector.
     * @param {object|NpcShip} data - The data object or NpcShip instance.
     */
    addAbstractNpc(data) {
        let ship = data;
        
        // --- OPTIMIZATION: Hydrate immediately ---
        // If we receive a POJO (from initial spawn), convert it to a full instance now.
        // This ensures 'abstract' lists always contain full instances, preventing
        // the need to instantiate them during gameplay sector transitions.
        if (!(data instanceof CustomShip)) { 
            let ShipClass;
            if (data.shipClass === 'AlliedShip') {
                ShipClass = AlliedShip;
            } else if (data.shipClass === 'NavyShip') {
                ShipClass = NavyShip;
            } else {
                ShipClass = MerchantShip;
            }
            
            // Pass the data object as options, as it contains all necessary state
            ship = new ShipClass(data.position.x, data.position.y, data.blueprint, data);
            ship.inventory = data.inventory;
            if (data.fleetIndex !== undefined) ship.fleetIndex = data.fleetIndex;
            
            // Ensure angle is restored if present
            if (data.angle !== undefined) ship.angle = data.angle;
        }

        const key = this._getSectorKey(ship);
        this.sectors.get(key)?.abstract.push(ship);
        return ship; // Return the instance (hydrated or original)
    }

    /**
     * Removes a dynamic object (e.g., a defeated NPC) from its sector.
     * @param {object} object - The dynamic object to remove.
     * @returns {boolean} True if the object was found and removed, false otherwise.
     */
    removeDynamicObject(object) {
        const sectorKey = this._getSectorKey(object);
        const sector = this.sectors.get(sectorKey);
        if (sector && sector.dynamic) {
            const index = sector.dynamic.indexOf(object);
            if (index > -1) {
                sector.dynamic.splice(index, 1);
                return true;
            }
        }
        return false;
    }

    /**
     * Adds a dynamic object (e.g., a newly spawned or converted ship) to the correct sector.
     * @param {Ship} object - The dynamic object to add.
     */
    addDynamicObject(object) {
        const sectorKey = this._getSectorKey(object);
        const sector = this.sectors.get(sectorKey);
        
        if (sector) {
            // If the sector is currently active, add it to the dynamic list.
            if (this.activeSectors.has(sectorKey)) {
                sector.dynamic.push(object);
            } else {
                // If the sector is dormant, store the instance directly.
                sector.abstract.push(object);
            }
        } else {
            console.warn(`[WorldManager] Attempted to add dynamic object to invalid sector: ${sectorKey}`);
        }
    }

    /**
     * The main update loop for the WorldManager. Determines which sectors should be active
     * and orchestrates the activation/deactivation and dormant simulation.
     * @param {PlayerShip} player - The player ship instance.
     * @param {number} deltaTime - The time since the last frame.
     */
    update(player, deltaTime, windDirection, pathfinder) {
        const playerSectorX = Math.floor(player.x / this.sectorSize);
        const playerSectorY = Math.floor(player.y / this.sectorSize);

        // --- FIX: Trigger refresh if player moved OR if the activation radius changed (due to zoom) ---
        if (playerSectorX !== this.lastPlayerSectorX || playerSectorY !== this.lastPlayerSectorY || this.activationRadius !== this.lastActivationRadius) {
            this.lastActivationRadius = this.activationRadius;
            this.lastPlayerSectorX = playerSectorX;
            this.lastPlayerSectorY = playerSectorY;

            // --- OPTIMIZATION: Reuse the scratch set instead of allocating a new one ---
            const newActiveSectors = this.scratchActiveSectors;
            newActiveSectors.clear();

            for (let x = playerSectorX - this.activationRadius; x <= playerSectorX + this.activationRadius; x++) {
                for (let y = playerSectorY - this.activationRadius; y <= playerSectorY + this.activationRadius; y++) {
                    if (x >= 0 && x < this.numSectorsX && y >= 0 && y < this.numSectorsY) {
                        newActiveSectors.add(this.sectorKeys[x][y]);
                    }
                }
            }

            // Deactivate sectors that are no longer in range
            for (const sectorKey of this.activeSectors) {
                if (!newActiveSectors.has(sectorKey)) {
                    this._deactivateSector(sectorKey);
                    // --- NEW: Add back to dormant list ---
                    if (!this.dormantSectorKeys.includes(sectorKey)) {
                        this.dormantSectorKeys.push(sectorKey);
                    }
                }
            }

            // Activate new sectors that have come into range
            for (const sectorKey of newActiveSectors) {
                if (!this.activeSectors.has(sectorKey)) {
                    this._activateSector(sectorKey);
                    // --- NEW: Remove from dormant list ---
                    const index = this.dormantSectorKeys.indexOf(sectorKey);
                    if (index > -1) {
                        this.dormantSectorKeys.splice(index, 1);
                    }
                }
            }

            // --- OPTIMIZATION: Swap sets to avoid allocation ---
            // The old active set becomes the scratch set for the next frame.
            const temp = this.activeSectors;
            this.activeSectors = newActiveSectors;
            this.scratchActiveSectors = temp;
        }

        // Run the simplified simulation for all dormant sectors
        this._updateDormantSectors(deltaTime, windDirection, pathfinder);

        // --- NEW: Update Map Data Cache Periodically ---
        this.mapDataUpdateTimer += deltaTime;
        if (this.mapDataUpdateTimer > this.MAP_DATA_UPDATE_INTERVAL) {
            this._updateNpcMapDataCache();
            this.mapDataUpdateTimer = 0;
        }
    }

    /**
     * New: Checks all active dynamic objects and moves them to the correct sector if they have crossed a boundary.
     * This is crucial for preventing objects from being incorrectly deactivated.
     * This should be called AFTER the main game loop has updated entity positions.
     */
    rebinActiveObjects() {
        if (!this.activeSectors || this.activeSectors.size === 0) return;

        const objectsToMove = this.cachedObjectsToMove;
        objectsToMove.length = 0; // Clear cached array

        for (const sectorKey of this.activeSectors) {
            const sector = this.sectors.get(sectorKey);
            if (!sector || !sector.dynamic) continue;

            // --- OPTIMIZATION: Parse sector coordinates once per sector ---
            const sX = sector.x;
            const sY = sector.y;

            // Optimization: Use in-place compaction instead of splice to remove moved objects.
            // This avoids O(N) shifts for every removal, making the loop O(N) total.
            let writeIndex = 0;
            for (let i = 0; i < sector.dynamic.length; i++) {
                const npc = sector.dynamic[i];
                
                // --- OPTIMIZATION: Calculate indices directly to avoid string creation ---
                const npcSectorX = Math.floor(npc.x / this.sectorSize);
                const npcSectorY = Math.floor(npc.y / this.sectorSize);

                if (npcSectorX !== sX || npcSectorY !== sY) {
                    const correctSectorKey = `${npcSectorX},${npcSectorY}`; // Only create string if moving
                    
                    // --- OPTIMIZATION: Use pooled object ---
                    let req = this.moveRequestPool.pop();
                    if (!req) req = {};
                    req.object = npc;
                    req.fromSectorKey = sectorKey;
                    req.toSectorKey = correctSectorKey;
                    
                    objectsToMove.push(req);
                } else {
                    if (writeIndex !== i) {
                        sector.dynamic[writeIndex] = npc;
                    }
                    writeIndex++;
                }
            }
            // Truncate the array to the new size
            sector.dynamic.length = writeIndex;
        }

        for (let i = 0; i < objectsToMove.length; i++) {
            const move = objectsToMove[i];
            const toSector = this.sectors.get(move.toSectorKey);
            if (toSector) {
                if (this.activeSectors.has(move.toSectorKey)) {
                    toSector.dynamic.push(move.object);
                } else {
                    toSector.abstract.push(move.object);
                }
            } else {
                console.warn(`[WorldManager] Active object moved to a non-existent sector key: ${move.toSectorKey}. Object lost.`);
            }
            
            // --- OPTIMIZATION: Return request object to pool ---
            move.object = null; // Clear reference
            move.fromSectorKey = null;
            move.toSectorKey = null;
            this.moveRequestPool.push(move);
        }
        
        objectsToMove.length = 0; // Clear after use
    }

    /**
     * Returns all currently active objects for the main game loop to process.
     * @returns {{statics: Array, dynamics: Array}}
     */
    getActiveObjects() {
        this.retrievalFrameId++; // --- NEW: Increment ID for this frame ---

        // Clear cached arrays without allocating new ones
        this.cachedActiveStatics.length = 0;
        this.cachedActiveDynamics.length = 0;
        this.cachedActiveIslands.length = 0;
        this.cachedActiveRocks.length = 0;
        this.cachedActiveShoals.length = 0;
        this.cachedActiveCoralReefs.length = 0;

        for (const sectorKey of this.activeSectors) {
            const sector = this.sectors.get(sectorKey);
            if (sector) {
                for (let i = 0; i < sector.static.length; i++) {
                    const obj = sector.static[i];
                    // --- FIX: Deduplication ---
                    // Since objects now exist in multiple sectors, ensure we only add them once per frame.
                    if (obj.lastRetrievalId !== this.retrievalFrameId) {
                        obj.lastRetrievalId = this.retrievalFrameId;
                        this.cachedActiveStatics.push(obj);
                        if (obj.type === 'island') this.cachedActiveIslands.push(obj);
                        else if (obj.type === 'rock') this.cachedActiveRocks.push(obj);
                        else if (obj.type === 'shoal') this.cachedActiveShoals.push(obj);
                        else if (obj.type === 'coralReef') this.cachedActiveCoralReefs.push(obj);
                    }
                }
                for (let i = 0; i < sector.dynamic.length; i++) {
                    this.cachedActiveDynamics.push(sector.dynamic[i]);
                }
            }
        }
        return this.cachedActiveObjects;
    }

    /**
     * Returns all static objects from all sectors. Used for initial pathfinder setup.
     * @returns {Array<Obstacle>}
     */
    getAllStaticObjects() {
        // --- OPTIMIZATION: Only rebuild if dirty ---
        if (this.allStaticObjectsCache && !this.staticCacheDirty) return this.allStaticObjectsCache;

        // --- OPTIMIZATION: Rebuild cache with deduplication ---
        this.retrievalFrameId++;
        this.staticCacheDirty = false;
        this.allStaticObjectsCache = [];
        for (const sector of this.sectors.values()) {
            for (const obj of sector.static) {
                if (obj.lastRetrievalId !== this.retrievalFrameId) {
                    obj.lastRetrievalId = this.retrievalFrameId;
                    this.allStaticObjectsCache.push(obj);
                }
            }
        }
        return this.allStaticObjectsCache;
    }

    /**
     * Returns all abstract NPC data objects from all sectors.
     * @returns {Array<object>}
     */
    getAllAbstractNpcs() {
        const allAbstracts = [];
        for (const sector of this.sectors.values()) {
            allAbstracts.push(...sector.abstract);
        }
        return allAbstracts;
    }

    /**
     * Gathers position and color data for ALL NPCs, both active and dormant.
     * This is optimized for drawing on the minimap without activating dormant sectors.
     * @returns {Array<{x: number, y: number, pennantColor: string}>}
     */
    getAllNpcMapData() {
        // Return the cached array instead of building it every frame.
        // It is updated in the update() loop.
        return this.cachedNpcMapData;
    }

    /**
     * Rebuilds the cached list of NPC data for the minimap.
     * @private
     */
    _updateNpcMapDataCache() {
        // --- OPTIMIZATION: Return used objects to pool instead of GC ---
        while (this.cachedNpcMapData.length > 0) {
            this.mapDataPool.push(this.cachedNpcMapData.pop());
        }

        // --- OPTIMIZATION: Use manual for-of or for-loop over known sectors ---
        for (const sectorKey of this.sectors.keys()) {
            const sector = this.sectors.get(sectorKey);
            // Get data from fully simulated active ships
            for (const npc of sector.dynamic) {
                const data = this.mapDataPool.pop() || {};
                data.x = npc.x; data.y = npc.y;
                data.pennantColor = npc.pennantColor;
                data.pathWaypoints = npc.pathWaypoints;
                data.currentWaypointIndex = npc.currentWaypointIndex;
                data.isPirateHunter = npc.isPirateHunter;
                this.cachedNpcMapData.push(data);
            }
            // Get data from lightweight abstract objects
            for (const abstractNpc of sector.abstract) {
                const data = this.mapDataPool.pop() || {};
                data.x = abstractNpc.x; data.y = abstractNpc.y;
                data.pennantColor = abstractNpc.pennantColor || PENNANT_COLOR;
                data.pathWaypoints = abstractNpc.pathWaypoints || [];
                data.currentWaypointIndex = abstractNpc.currentWaypointIndex || 0;
                data.isPirateHunter = abstractNpc.isPirateHunter;
                this.cachedNpcMapData.push(data);
            }
        }
    }

    /**
     * Activates a sector: creates full NpcShip objects from abstract data.
     * @param {string} sectorKey - The key of the sector to activate.
     * @private
     */
    _activateSector(sectorKey) {
        const sector = this.sectors.get(sectorKey);
        if (!sector) return;

        if (sector.abstract.length === 0) return;
        
        // --- OPTIMIZATION: Just move instances ---
        // The 'abstract' list now holds full NpcShip instances, so we just move them.
        sector.abstract.forEach(ship => {
            if (ship instanceof AlliedShip && window.PlunderGame.fleetManager) {
                // Re-establish reference if needed (though instance persistence usually handles this)
                ship.fleetManager = window.PlunderGame.fleetManager;
            }
            sector.dynamic.push(ship);
        });
        
        sector.abstract = []; // Clear the abstract list
    }

    /**
     * Deactivates a sector: converts full NpcShip objects into lightweight abstract data.
     * @param {string} sectorKey - The key of the sector to deactivate.
     * @private
     */
    _deactivateSector(sectorKey) {
        const sector = this.sectors.get(sectorKey);
        if (!sector) return; // Safety check

        // --- NEW: Release canvases for deactivating dynamic objects ---
        if (sector.dynamic.length > 0) {
            console.log(`[WorldManager] Deactivating sector ${sectorKey}, releasing ${sector.dynamic.length} dynamic canvases.`);
            sector.dynamic.forEach(ship => {
                // Custom ships have a hullCacheCanvas
                if (ship.hullCacheCanvas) {
                    window.CanvasManager.releaseCanvas(ship.hullCacheCanvas);
                    ship.hullCacheCanvas = null; // Set to null to trigger re-caching on activation
                }
                // Base ships have a shipCacheCanvas
                if (ship.shipCacheCanvas) {
                    window.CanvasManager.releaseCanvas(ship.shipCacheCanvas);
                    ship.shipCacheCanvas = null;
                }
            });
        }
        
        // --- OPTIMIZATION: Just move instances ---
        // The ship instances are moved to the 'abstract' list, preserving their state.
        // Their canvas properties are now null, so they will be re-cached when activated.
        sector.abstract.push(...sector.dynamic);
        sector.dynamic = []; // Clear the dynamic list

        // --- NEW: Release canvases for deactivating static objects ---
        // Use the object's own cleanup method to handle simple or chunked caches
        sector.static.forEach(obstacle => {
            if (obstacle.releaseCache) obstacle.releaseCache();
        });
    }

    /**
     * Runs a simplified simulation for all dormant sectors.
     * @param {number} deltaTime - The time since the last frame.
     * @private
     */
    _updateDormantSectors(deltaTime, windDirection, pathfinder) {
        // --- NEW: Time-Slicing Logic ---
        // If there are no dormant sectors, do nothing.
        if (this.dormantSectorKeys.length === 0) {
            return;
        }

        // 1. Calculate how many frames this update slice needs to compensate for.
        // This ensures that dormant ships move at the correct average speed over time.
        const updateCycleLength = Math.max(1, Math.ceil(this.dormantSectorKeys.length / this.DORMANT_UPDATE_BUDGET));

        // 2. Determine the slice of sectors to update this frame.
        const endIndex = this.dormantUpdateIndex + this.DORMANT_UPDATE_BUDGET;

        // 3. Process the slice.
        for (let i = this.dormantUpdateIndex; i < endIndex; i++) {
            // Wrap around the index if it goes past the end of the array.
            const sectorIndex = i % this.dormantSectorKeys.length;
            const sectorKey = this.dormantSectorKeys[sectorIndex];
            
            const sector = this.sectors.get(sectorKey);
            if (!sector || sector.abstract.length === 0) {
                continue;
            }
            
            // --- OPTIMIZATION: Cache current sector coordinates ---
            const currentSectorX = sector.x;
            const currentSectorY = sector.y;

            for (let j = sector.abstract.length - 1; j >= 0; j--) {
                const npc = sector.abstract[j];

                let hasMoved = false;

                // --- NEW: Handle Dormant Formation ---
                // If following a leader, just snap to relative position.
                if (npc.aiState === 'formation' && npc.formationLeader) {
                    const leader = npc.formationLeader;
                    // If leader is dead/gone, switch to hunting (will pick up next frame)
                    if (leader.hp <= 0 || leader.isSunk) {
                        npc.aiState = 'hunting';
                        npc.formationLeader = null;
                    } else {
                        const spacing = 100; // Approx 2 ship lengths (50 * 2)
                        const distBehind = spacing; // formationIndex is now always 1
                        npc.x = leader.x - Math.cos(leader.angle) * distBehind;
                        npc.y = leader.y - Math.sin(leader.angle) * distBehind;
                        npc.angle = leader.angle; // Match heading
                        hasMoved = true;
                    }
                }

                // --- FIX: Allow 'hunting' ships to move in dormant sectors ---
                const isMovingState = npc.aiState === 'navigating' || npc.aiState === 'hunting';

                // Only process path movement if NOT in formation (formation movement is handled above)
                if (isMovingState && npc.aiState !== 'formation') {
                    if (npc.pathWaypoints && npc.currentWaypointIndex >= npc.pathWaypoints.length) {
                        this._findNextDormantPath(npc, pathfinder, windDirection);
                        // Don't continue here; we might still need to check sector bounds if _findNextDormantPath moved it (unlikely but safe)
                    } else if (npc.pathWaypoints && npc.pathWaypoints.length > 0) {
                        const targetWaypoint = npc.pathWaypoints[npc.currentWaypointIndex];
                        const angleToWaypoint = Math.atan2(targetWaypoint.y - npc.y, targetWaypoint.x - npc.x);
                        
                        let windMultiplier = 0;
                        // --- FIX: Use the ship's own wind performance method if available ---
                        if (typeof npc.getWindSpeedMultiplier === 'function') {
                            windMultiplier = npc.getWindSpeedMultiplier(angleToWaypoint, windDirection);
                        } else {
                            windMultiplier = getWindSpeedMultiplier(angleToWaypoint, windDirection); // Fallback
                        }
                        
                        // --- FIX: Calculate total distance to move based on how many frames were skipped. ---
                        // Include sailingSkill to match active sector movement speeds.
                        const sailingSkill = npc.sailingSkill || 1.0;
                        const distancePerFrame = npc.baseSpeed * windMultiplier * sailingSkill;
                        const distanceToMove = distancePerFrame * updateCycleLength;

                        npc.x += Math.cos(angleToWaypoint) * distanceToMove;
                        npc.y += Math.sin(angleToWaypoint) * distanceToMove;
                        // --- FIX: Update angle to match movement direction ---
                        npc.angle = angleToWaypoint;
                        hasMoved = true;

                        if (distance(npc, targetWaypoint) < npc.shipLength * 2) {
                            npc.currentWaypointIndex++;
                        }
                    }
                }

                // If the ship didn't move, we don't need to check sector boundaries.
                if (!hasMoved) continue;

                // --- OPTIMIZATION: Check indices before generating string key ---
                const newSectorX = Math.floor(npc.x / this.sectorSize);
                const newSectorY = Math.floor(npc.y / this.sectorSize);

                if (newSectorX !== currentSectorX || newSectorY !== currentSectorY) {
                    const newSectorKey = `${newSectorX},${newSectorY}`;
                    const movedNpc = sector.abstract.splice(j, 1)[0];
                    const newSector = this.sectors.get(newSectorKey);

                    if (newSector) {
                        if (this.activeSectors.has(newSectorKey)) {
                            console.log(`[WorldManager] Dormant ship entering active sector ${newSectorKey}. Activating.`);
                            newSector.dynamic.push(movedNpc);
                        } else {
                            newSector.abstract.push(movedNpc);
                        }
                    }
                }
            }
        }

        // 4. Advance the index for the next frame, wrapping around if necessary.
        this.dormantUpdateIndex = endIndex % this.dormantSectorKeys.length;
    }

    /**
     * New: Finds a new wander destination and path for a dormant NPC.
     * Uses the ship's own logic since we now persist the instance.
     * @param {NpcShip} npc - The NPC ship instance.
     * @param {Pathfinder} pathfinder - The global pathfinder instance.
     * @param {number} windDirection - The current wind direction.
     * @private
     */
    _findNextDormantPath(npc, pathfinder, windDirection) {
        const allIslands = this.getAllStaticObjects().filter(o => o.type === 'island');
        if (allIslands.length > 0) {
            // Use the ship's existing method to find a new destination
            npc._findNewWanderDestination(allIslands, pathfinder, windDirection);
        }
    }
}