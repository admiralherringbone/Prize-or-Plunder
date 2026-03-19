/**
 * @file Manages the spawning of all NPCs, including regular traffic and special encounters like Pirate Hunters.
 * This class acts as a "Game Director" for creating new entities in the world.
 */
class SpawnManager {
    /**
     * @param {WorldManager} worldManager - The world manager instance for adding new ships.
     * @param {Pathfinder} pathfinder - The pathfinder instance for initial path calculation.
     * @param {function} getPlayer - A function that returns the current player instance.
     * @param {SpatialGrid} spatialGrid - The main spatial grid for collision checks during spawning.
     */
    constructor(worldManager, pathfinder, getPlayer, spatialGrid) {
        this.worldManager = worldManager;
        this.pathfinder = pathfinder;
        this.getPlayer = getPlayer;
        this.spatialGrid = spatialGrid;

        // --- Pirate Hunter State ---
        this.pirateHunter = null;
        this.pirateHunterRespawnTimer = 0;

        // --- Pirate Hunter Squadron State (Rank 4+) ---
        this.activeSquadronCount = 0;
        this.squadronRespawnTimer = 0;

        // --- Pirate Hunter Fleet State (Rank 5+) ---
        this.activeFleetCount = 0;
        this.fleetRespawnTimer = 0;

        console.log("SpawnManager initialized.");
    }

    /**
     * Resets all hunter timers and counts.
     */
    reset() {
        this.pirateHunter = null;
        this.pirateHunterRespawnTimer = 0;
        this.activeSquadronCount = 0;
        this.squadronRespawnTimer = 0;
        this.activeFleetCount = 0;
        this.fleetRespawnTimer = 0;
        console.log("SpawnManager reset.");
    }

    /**
     * Notifies the manager that an NPC has been sunk.
     * This is used to update hunter counts and trigger respawns.
     * @param {NpcShip} npc - The NPC ship that was sunk.
     */
    onNpcSunk(npc) {
        // --- Hunter Respawn Logic ---
        if (npc.isFleetHunter) {
            this.activeFleetCount--;
            if (this.activeFleetCount <= 0) {
                console.log(`[Pirate Hunter] Fleet defeated! A new fleet will be dispatched.`);
                this.fleetRespawnTimer = 300000; // 5 minute respawn for fleet
            }
        } else if (npc.isSquadronHunter) {
            this.activeSquadronCount--;
            if (this.activeSquadronCount <= 0) {
                console.log(`[Pirate Hunter] Squadron defeated! New squadron arriving shortly.`);
                this.squadronRespawnTimer = 120000; // 2 minutes respawn for full squadron
            }
        } else if (npc.isPirateHunter) { // Catches only the single hunter now
            console.log(`[Pirate Hunter] Hunter defeated! Another will be sent shortly.`);
            this.pirateHunter = null;
            this.pirateHunterRespawnTimer = 60000; // 1 minute respawn
        }

        // --- General Population Respawn ---
        if (npc instanceof NavyShip) { this._spawnSingleNpc(NavyShip); }
        else if (npc instanceof MerchantShip) { this._spawnSingleNpc(MerchantShip); }
    }

    /**
     * The main update loop for the SpawnManager.
     * Handles timers and triggers special spawns like Pirate Hunters.
     * @param {number} deltaTime - The time elapsed since the last frame in milliseconds.
     */
    update(deltaTime) {
        const player = this.getPlayer();
        if (!player) return;

        // --- Rank-based Pirate Hunter Spawning Logic ---
        if (player.rankIndex >= 5) { // Rank 5: Enemy of All Mankind
            if (this.activeFleetCount <= 0) {
                if (this.fleetRespawnTimer <= 0) {
                    this._spawnPirateHunterFleet();
                } else {
                    this.fleetRespawnTimer -= deltaTime;
                }
            }
        } else if (player.rankIndex >= 4) { // Rank 4: Notorious Pirate
            if (this.activeSquadronCount <= 0) {
                if (this.squadronRespawnTimer <= 0) {
                    this._spawnPirateHunterSquadron();
                } else {
                    this.squadronRespawnTimer -= deltaTime;
                }
            }
        } else if (player.rankIndex >= 3) { // Rank 3: Known Pirate
            if (!this.pirateHunter) {
                if (this.pirateHunterRespawnTimer <= 0) {
                    this._spawnPirateHunter();
                } else {
                    this.pirateHunterRespawnTimer -= deltaTime;
                }
            }
        }
    }

    /**
     * Spawns the initial set of NPC ships in the world.
     */
    spawnInitialNpcs() {
        const worldAreaFactor = (WORLD_WIDTH * WORLD_HEIGHT) / (10000 * 10000);
        const numNavyShips = Math.round(NAVY_SHIP_DENSITY * worldAreaFactor);
        const numMerchantShips = Math.round(MERCHANT_SHIP_DENSITY * worldAreaFactor);

        // Spawn the specified number of each ship type.
        for (let i = 0; i < numNavyShips; i++) { this._spawnSingleNpc(NavyShip); }
        for (let i = 0; i < numMerchantShips; i++) { this._spawnSingleNpc(MerchantShip); }
    }

    /**
     * Helper function to find a valid spawn location for a single NPC and add it to the world.
     * @param {class} ShipClass - The class of the ship to spawn (e.g., NavyShip, MerchantShip).
     * @param {Island} [spawnOriginIsland=null] - Optional island to spawn near (overrides random selection).
     * @param {string|Array<string>} [allowedArchetypes=null] - Optional filter for specific ship types.
     * @private
     */
    _spawnSingleNpc(ShipClass, spawnOriginIsland = null, allowedArchetypes = null) {
        const allIslands = this.worldManager.getAllStaticObjects().filter(o => o.type === 'island');
        if (allIslands.length === 0 || !NPC_ARCHETYPES) return null;

        const weightedRandom = (options) => {
            if (!options || options.length === 0) return null;
            const totalWeight = options.reduce((sum, opt) => sum + (opt.weight || 1), 0);
            let random = Math.random() * totalWeight;
            for (const opt of options) {
                if (random < (opt.weight || 1)) return opt;
                random -= (opt.weight || 1);
            }
            return options[0];
        };

        const biasedRandom = (min, max, bias) => {
            let r;
            switch (bias) {
                case 'low': case 'wide': r = Math.random() * Math.random(); break;
                case 'high': case 'narrow': r = 1 - (Math.random() * Math.random()); break;
                case 'strong_average': r = (Math.random() + Math.random() + Math.random()) / 3; break;
                case 'average': default: r = (Math.random() + Math.random()) / 2; break;
            }
            return min + r * (max - min);
        };

        const getBeamSliderRange = (buildType, size, numDecks) => {
            let sizeBasedMaxBeamRatio = 4.0;
            if (buildType === 'guns') {
                if (size === 1) sizeBasedMaxBeamRatio = 2.0;
                else if (size === 2) sizeBasedMaxBeamRatio = 2.3;
                else if (size >= 3 && size <= 4) sizeBasedMaxBeamRatio = 2.5;
                else if (size >= 5 && size <= 7) sizeBasedMaxBeamRatio = 3.5;
                else if (size >= 8) sizeBasedMaxBeamRatio = 4.0;
            } else {
                if (size >= 1 && size <= 3) sizeBasedMaxBeamRatio = 2.0;
                else if (size >= 4 && size <= 6) sizeBasedMaxBeamRatio = 2.3;
                else if (size >= 7 && size <= 20) sizeBasedMaxBeamRatio = 2.5;
                else if (size >= 21 && size <= 40) sizeBasedMaxBeamRatio = 3.5;
                else if (size >= 41) sizeBasedMaxBeamRatio = 4.0;
            }
            let deckBasedMaxBeamRatio = 4.0;
            if (numDecks === 2) deckBasedMaxBeamRatio = 3.75;
            else if (numDecks === 3) deckBasedMaxBeamRatio = 3.5;
            const maxBeamRatio = Math.min(sizeBasedMaxBeamRatio, deckBasedMaxBeamRatio);
            return { min: 2.0, max: maxBeamRatio };
        };

        const getDraughtSliderRange = (beamRatio, numDecks, maxBeamRatio) => {
            const baselineDraftFactor = 0.5 + ((beamRatio - ((2.0 + maxBeamRatio) / 2)) * 0.1) + ((numDecks - 1) * 0.15);
            const minDraftFactor = Math.max(0.4, baselineDraftFactor - 0.10);
            const maxDraftFactor = baselineDraftFactor + 0.15;
            return { min: minDraftFactor, max: maxDraftFactor };
        };

        const shipType = (ShipClass === NavyShip) ? 'navy' : 'merchant';
        let archetype, roleKey;

        if (shipType === 'merchant') {
            const roles = window.NPC_ROLES.merchant;
            const roleOptions = Object.keys(roles).map(key => ({ key: key, weight: roles[key].spawnWeight || 10 }));
            const selectedRoleOption = weightedRandom(roleOptions);
            roleKey = selectedRoleOption.key;
            const compatibleNames = roles[roleKey].compatibleArchetypes;
            const possibleArchetypes = NPC_ARCHETYPES.merchant.filter(a => compatibleNames.includes(a.name));
            archetype = weightedRandom(possibleArchetypes.length > 0 ? possibleArchetypes : NPC_ARCHETYPES.merchant);
        } else {
            roleKey = 'warship';
            let pool = NPC_ARCHETYPES.navy;
            if (allowedArchetypes) {
                if (Array.isArray(allowedArchetypes)) pool = pool.filter(a => allowedArchetypes.includes(a.name));
                else pool = pool.filter(a => a.name === allowedArchetypes);
            }
            archetype = weightedRandom(pool);
        }
        if (!archetype) return null;

        const generator = new ShipGenerator();
        generator.setBuildType(archetype.buildType);
        const size = Math.floor(getRandomArbitrary(archetype.sizeRange.min, archetype.sizeRange.max));
        if (archetype.buildType === 'guns') {
            generator.setGunsPerBattery(size);
        } else {
            generator.setCargoCapacity(size);
            const maxGuns = Math.floor(size / 3);
            const gunCount = Math.round(biasedRandom(0, maxGuns, archetype.gunBias || 'average'));
            generator.setCargoGuns(gunCount);
        }

        const deckChoice = weightedRandom(archetype.deckOptions);
        generator.setNumDecks(deckChoice.count);
        if (deckChoice.deckTypes) {
            for (const tier in deckChoice.deckTypes) generator.setDeckType(parseInt(tier), deckChoice.deckTypes[tier]);
        }

        const beamRange = getBeamSliderRange(archetype.buildType, size, deckChoice.count);
        const beamRatio = biasedRandom(beamRange.min, beamRange.max, archetype.beamBias || 'average');
        generator.setBeamRatio(beamRatio);

        const draughtRange = getDraughtSliderRange(beamRatio, deckChoice.count, beamRange.max);
        const draughtFactor = biasedRandom(draughtRange.min, draughtRange.max, archetype.draughtBias || 'average');
        generator.setDraughtFactor(draughtFactor);

        const rigChoice = weightedRandom(archetype.rigOptions);
        generator.setRigType(rigChoice.type);
        const rigMastMapping = { 'sloop': 1, 'fore-and-aft-sloop': 1, 'square': 1, 'brig': 2, 'brigantine': 2, 'schooner': 2, 'full-rigged': 3, 'barque': 3, 'barquentine': 3, 'three-mast-schooner': 3 };
        generator.setMastCount(rigMastMapping[rigChoice.type] || 1);

        const deckLayoutChoice = weightedRandom(archetype.deckLayoutOptions);
        generator.setDeckLayoutType(deckLayoutChoice.type);

        if (archetype.superstructureLayers) {
            archetype.superstructureLayers.forEach(layer => {
                const choice = weightedRandom(layer);
                if (choice && choice.parts) {
                    choice.parts.forEach(part => {
                        if (part === 'forecastle') generator.setForecastle(true);
                        if (part === 'aftercastle') generator.setAftercastle(true);
                        if (part === 'midcastle') generator.setMidcastle(true);
                        if (part === 'sterncastle') generator.setSterncastle(true);
                        if (part === 'spardeck') generator.setSparDeck(true);
                    });
                }
            });
        }

        const blueprint = generator.generateBlueprint();
        const randomName = this._generateNpcName(shipType, archetype.name);
        const options = { archetypeName: archetype.name, shipName: randomName };

        const tempNpc = new ShipClass(0, 0, blueprint, { ...options, skipCache: true });
        let validPosition = false;
        let totalAttempts = 0;
        let npcX, npcY, startIsland;
        const player = this.getPlayer();

        while (!validPosition && totalAttempts < 500) {
            startIsland = spawnOriginIsland || allIslands[Math.floor(Math.random() * allIslands.length)];
            let islandAttempts = 0;
            while (!validPosition && islandAttempts < 100) {
                totalAttempts++;
                islandAttempts++;
                const islandRadius = Math.max(startIsland.baseRadiusX || 0, startIsland.baseRadiusY || 0);
                const spawnRingInnerRadius = islandRadius + (SHIP_TARGET_LENGTH * 2) + tempNpc.shipLength;
                const spawnRingOuterRadius = spawnRingInnerRadius + (SHIP_TARGET_LENGTH * 4);
                const spawnAngle = getRandomArbitrary(0, Math.PI * 2);
                const spawnDist = getRandomArbitrary(spawnRingInnerRadius, spawnRingOuterRadius);
                npcX = startIsland.x + Math.cos(spawnAngle) * spawnDist;
                npcY = startIsland.y + Math.sin(spawnAngle) * spawnDist;
                tempNpc.x = npcX;
                tempNpc.y = npcY;
                tempNpc.angle = spawnAngle;
                validPosition = true;
                if (player && distance(tempNpc, player) < NPC_DETECTION_RADIUS * NPC_SPAWN_PLAYER_MIN_DISTANCE_MULTIPLIER) {
                    validPosition = false;
                }
                if (validPosition) {
                    const npcPoints = tempNpc.getTransformedPoints();
                    const potentialColliders = this.spatialGrid.query(tempNpc);
                    for (const obstacle of potentialColliders) {
                        if (obstacle.type === 'island' || obstacle.type === 'rock' || obstacle.type === 'coralReef') {
                            const geometrySource = (obstacle.type === 'coralReef' && obstacle.rockBase) ? obstacle.rockBase : obstacle;
                            if (geometrySource.outerPerimeterPoints) {
                                const distSq = distanceToPolygonSquared({ x: npcX, y: npcY }, geometrySource.outerPerimeterPoints);
                                if (distSq < (tempNpc.shipLength * 2) ** 2) {
                                    validPosition = false;
                                    break;
                                }
                            }
                            for (const part of obstacle.convexParts) {
                                if (checkPolygonCollision(npcPoints, part)) {
                                    validPosition = false;
                                    break;
                                }
                            }
                        }
                        if (!validPosition) break;
                    }
                }
                if (validPosition && this.pathfinder) {
                    const node = this.pathfinder._worldToGridNode({ x: npcX, y: npcY });
                    if (!node || !node.walkable) {
                        validPosition = false;
                    }
                }
            }
        }

        if (validPosition) {
            let capacity = 50;
            if (tempNpc.calculateBurthen) capacity = tempNpc.calculateBurthen();
            tempNpc.inventory = new ShipInventory(capacity);
            if (typeof tempNpc.getTotalGunCount === 'function') {
                const totalGuns = tempNpc.getTotalGunCount();
                if (totalGuns > 0) tempNpc.inventory.addItem('cannon', totalGuns);
            }
            tempNpc.inventory.generateForRole(roleKey, shipType, tempNpc);
            const pathingNpc = new ShipClass(npcX, npcY, blueprint, { ...options, previousDestinationIsland: startIsland, skipCache: true });
            pathingNpc.angle = tempNpc.angle;
            if (allIslands.length > 0) {
                pathingNpc._findNewWanderDestination(allIslands, this.pathfinder, window.windDirection);
            }
            const abstractNpc = {
                position: { x: npcX, y: npcY },
                angle: tempNpc.angle,
                blueprint: blueprint,
                shipClass: ShipClass.name,
                baseSpeed: pathingNpc.baseSpeed,
                hp: pathingNpc.hp,
                aiState: pathingNpc.aiState,
                destinationIsland: pathingNpc.destinationIsland,
                previousDestinationIsland: startIsland,
                pathWaypoints: pathingNpc.pathWaypoints,
                currentWaypointIndex: pathingNpc.currentWaypointIndex,
                archetypeName: pathingNpc.archetypeName,
                displayName: pathingNpc.displayName,
                pennantColor: pathingNpc.pennantColor,
                rigType: pathingNpc.blueprint.layout.rigType,
                inventory: tempNpc.inventory
            };
            return this.worldManager.addAbstractNpc(abstractNpc);
        }
        return null;
    }

    _spawnPirateHunter() {
        const allowed = ['Naval Cutter', 'Corvette', 'Frigate'];
        const abstractNpc = this._spawnSingleNpc(NavyShip, null, allowed);
        if (abstractNpc) {
            console.log(`[Pirate Hunter] A new Pirate Hunter has been dispatched!`);
            abstractNpc.isPirateHunter = true;
            abstractNpc.aiState = 'hunting';
            abstractNpc.pennantColor = '#000000';
            abstractNpc.displayName = "Hunter " + abstractNpc.displayName;
            const player = this.getPlayer();
            if (player && this.pathfinder) {
                const targetDest = { x: player.x, y: player.y, proximityRadius: 0, type: 'target' };
                abstractNpc.setNewDestination(targetDest, this.pathfinder, window.windDirection);
                abstractNpc.currentWaypointIndex = 0;
            }
            this.pirateHunter = abstractNpc;
        }
    }

    _spawnPirateHunterSquadron() {
        const allIslands = this.worldManager.getAllStaticObjects().filter(o => o.type === 'island');
        if (allIslands.length === 0) return;
        const player = this.getPlayer();
        let validIslands = allIslands;
        if (player) {
            validIslands = allIslands.filter(island => distance(island, player) > 5000);
        }
        if (validIslands.length === 0) validIslands = allIslands;
        const targetIsland = validIslands[Math.floor(Math.random() * validIslands.length)];
        const squadSize = Math.floor(Math.random() * 3) + 2;
        const selectedArchetypeName = Math.random() < 0.8 ? '2-Decker Ship of the Line' : 'Frigate';
        console.log(`[Pirate Hunter] Spawning Squadron of ${squadSize} ${selectedArchetypeName}s at Island ${targetIsland.id}`);
        let previousShip = null;
        for (let i = 0; i < squadSize; i++) {
            const abstractNpc = this._spawnSingleNpc(NavyShip, targetIsland, selectedArchetypeName);
            if (abstractNpc) {
                abstractNpc.isPirateHunter = true;
                abstractNpc.isSquadronHunter = true;
                abstractNpc.pennantColor = '#000000';
                if (i === 0) {
                    abstractNpc.aiState = 'hunting';
                    abstractNpc.displayName = "Squadron Flagship " + abstractNpc.displayName;
                    if (player && this.pathfinder) {
                        const targetDest = { x: player.x, y: player.y, proximityRadius: 0, type: 'target' };
                        abstractNpc.setNewDestination(targetDest, this.pathfinder, window.windDirection);
                    }
                } else {
                    abstractNpc.aiState = 'formation';
                    abstractNpc.formationLeader = previousShip;
                    abstractNpc.formationIndex = 1;
                    abstractNpc.displayName = "Squadron Ship " + abstractNpc.displayName;
                    abstractNpc.pathWaypoints = [];
                }
                previousShip = abstractNpc;
                this.activeSquadronCount++;
            }
        }
    }

    _spawnPirateHunterFleet() {
        const allIslands = this.worldManager.getAllStaticObjects().filter(o => o.type === 'island');
        if (allIslands.length === 0) return;
        const player = this.getPlayer();
        let validIslands = allIslands;
        if (player) {
            validIslands = allIslands.filter(island => distance(island, player) > 7500);
        }
        if (validIslands.length === 0) validIslands = allIslands;
        const targetIsland = validIslands[Math.floor(Math.random() * validIslands.length)];
        const fleetSize = Math.floor(Math.random() * 6) + 5;
        const selectedArchetypeName = Math.random() < 0.8 ? '3-Decker Ship of the Line' : '2-Decker Ship of the Line';
        console.log(`[Pirate Hunter] Spawning Fleet of ${fleetSize} ${selectedArchetypeName}s at Island ${targetIsland.id}`);
        let previousShip = null;
        for (let i = 0; i < fleetSize; i++) {
            const abstractNpc = this._spawnSingleNpc(NavyShip, targetIsland, selectedArchetypeName);
            if (abstractNpc) {
                abstractNpc.isPirateHunter = true;
                abstractNpc.isFleetHunter = true;
                abstractNpc.pennantColor = '#000000';
                if (i === 0) {
                    abstractNpc.aiState = 'hunting';
                    abstractNpc.displayName = "Fleet Flagship " + abstractNpc.displayName;
                    if (player && this.pathfinder) {
                        const targetDest = { x: player.x, y: player.y, proximityRadius: 0, type: 'target' };
                        abstractNpc.setNewDestination(targetDest, this.pathfinder, window.windDirection);
                    }
                } else {
                    abstractNpc.aiState = 'formation';
                    abstractNpc.formationLeader = previousShip;
                    abstractNpc.formationIndex = 1;
                    abstractNpc.displayName = "Fleet Ship " + abstractNpc.displayName;
                    abstractNpc.pathWaypoints = [];
                }
                previousShip = abstractNpc;
                this.activeFleetCount++;
            }
        }
    }

    _generateNpcName(type, archetypeName = '') {
        const categories = Object.keys(NPC_NAME_CATEGORIES);
        let allowedCategories = [...categories];
        if (type === 'navy' && Math.random() < 0.5) {
            allowedCategories = ['martial'];
        } else if (type === 'merchant' && Math.random() < 0.5) {
            allowedCategories = categories.filter(c => c !== 'martial');
        }
        const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const cat1 = pickRandom(allowedCategories);
        const word1 = pickRandom(NPC_NAME_CATEGORIES[cat1]);
        let twoWordChance = 0.5;
        if (type === 'navy') {
            if (archetypeName === '3-Decker Ship of the Line') twoWordChance = 0.75;
            else if (archetypeName === '2-Decker Ship of the Line') twoWordChance = 2 / 3;
        }
        let finalName = word1;
        if (Math.random() < twoWordChance) {
            let cat2;
            if (Math.random() < 0.6) {
                const diffCats = categories.filter(c => c !== cat1);
                cat2 = pickRandom(diffCats);
            } else {
                cat2 = cat1;
            }
            let word2 = pickRandom(NPC_NAME_CATEGORIES[cat2]);
            let attempts = 0;
            while (word2 === word1 && attempts < 10) {
                word2 = pickRandom(NPC_NAME_CATEGORIES[cat2]);
                attempts++;
            }
            finalName = `${word1} ${word2}`;
        }
        if (type === 'navy') {
            return `IMS ${finalName}`;
        } else {
            return finalName;
        }
    }
}