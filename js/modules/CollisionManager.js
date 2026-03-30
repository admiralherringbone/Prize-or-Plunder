/**
 * @file Manages all collision detection and resolution logic.
 * This class centralizes the physics interactions between game objects,
 * keeping the main game loop cleaner.
 */
class CollisionManager {
    /**
     * @param {object} options - An object containing getter functions for dependencies.
     */
    constructor(options) {
        this.getPlayer = options.getPlayer;
        this.getEffectManager = options.getEffectManager;
        this.getBoardingManager = options.getBoardingManager;
        this.getAllShips = options.getAllShips;
        this.getCannonballs = options.getCannonballs;
        this.getSpatialGrid = options.getSpatialGrid;
        console.log("CollisionManager initialized.");
    }

    /**
     * The main entry point for processing all collisions for a frame.
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    processCollisions(deltaTime) {
        const player = this.getPlayer();
        const allShips = this.getAllShips();
        const cannonballs = this.getCannonballs();
        const spatialGrid = this.getSpatialGrid();
        const effectManager = this.getEffectManager();
        const boardingManager = this.getBoardingManager();

        // Reset hazard flags for all ships at the start of the collision check.
        allShips.forEach(ship => {
            ship.isOverShoal = false;
            ship.isOverCoralReef = false;
            ship.islandCollisionNormal = null;
            ship.isAgainstIsland = false;
        });

        // Apply movement for this frame before checking collisions.
        allShips.forEach(ship => {
            ship.x += ship.vx;
            ship.y += ship.vy;
        });

        const checkCollisionsForList = (list) => {
            for (const obj of list) {
                if (obj instanceof Ship && obj.isSinking && (obj.sinkHp / obj.maxSinkHp > 0.5)) continue;

                const objPoints = (obj instanceof Ship) ? obj.getTransformedPoints() : null;
                const objAABB = obj.getAABB();
                const potentialColliders = spatialGrid.query(obj);

                for (const other of potentialColliders) {
                    if (other instanceof Ship && other.isSinking && (other.sinkHp / other.maxSinkHp > 0.5)) continue;

                    // Ship-on-Obstacle
                    if (obj instanceof Ship && (other.type === 'island' || other.type === 'rock')) {
                        if (other.convexHull && !checkPolygonCollision(objPoints, other.convexHull)) continue;
                        
                        // --- OPTIMIZATION: Local Grid Pruning ---
                        const partsToCheck = (other.getRelevantConvexParts) 
                            ? other.getRelevantConvexParts(objAABB) 
                            : other.convexParts;

                        for (const part of partsToCheck) {
                            if (!part.aabb) part.aabb = getPolygonAABB(part);
                            if (!checkAABBOverlap(objAABB, part.aabb)) continue;
                            
                            const collision = checkPolygonCollision(objPoints, part);
                            if (collision) {
                                if (other.type === 'island') {
                                    obj.x += collision.axis.x * collision.overlap;
                                    obj.y += collision.axis.y * collision.overlap;
                                    obj.isAgainstIsland = true;
                                    obj.islandCollisionNormal = collision.axis;
                                } else {
                                    this._resolveCollision(obj, null, collision);
                                }
                                this._handleCollisionDamage(obj, other, other.type === 'rock' ? ROCK_COLLISION_DAMAGE_FACTOR : ISLAND_COLLISION_DAMAGE_FACTOR, other.type === 'rock' ? ROCK_COLLISION_DAMAGE_FACTOR_SUSTAINED : ISLAND_COLLISION_DAMAGE_FACTOR_SUSTAINED);
                                break;
                            }
                        }
                    }

                    // Ship-on-Hazard
                    if (obj instanceof Ship && (other.type === 'coralReef' || other.type === 'shoal')) {
                        for (const part of other.convexParts) {
                            if (!part.aabb) part.aabb = getPolygonAABB(part);
                            if (!checkAABBOverlap(objAABB, part.aabb)) continue;

                            if (checkPolygonCollision(objPoints, part)) {
                                if (other.type === 'coralReef') {
                                    obj.isOverCoralReef = true;
                                    const speed = Math.sqrt(obj.vx ** 2 + obj.vy ** 2);
                                    if (speed > CORAL_REEF_DAMAGE_THRESHOLD_SPEED) {
                                        const damageThisFrame = CORAL_REEF_DAMAGE_PER_SECOND * (deltaTime / 1000);
                                        obj.takeDamage(damageThisFrame);
                                        if (obj instanceof PlayerShip) obj.collidingFlashTimer = PLAYER_COLLISION_FLASH_DURATION;
                                    }
                                } else if (other.type === 'shoal') {
                                    obj.isOverShoal = true;
                                    const speed = Math.sqrt(obj.vx ** 2 + obj.vy ** 2);
                                    if (speed >= SHOAL_FULL_SPEED_DAMAGE_THRESHOLD) {
                                        this._handleCollisionDamage(obj, other, SHOAL_DAMAGE_FACTOR_FULL_SPEED, 0);
                                    } else if (speed >= SHOAL_HIGH_SPEED_DAMAGE_THRESHOLD) {
                                        this._handleCollisionDamage(obj, other, SHOAL_DAMAGE_FACTOR_HIGH_SPEED, 0);
                                    }
                                }
                            }
                        }
                    }

                    // Ship-on-Ship
                    if (obj instanceof Ship && other instanceof Ship && allShips.indexOf(obj) < allShips.indexOf(other)) {
                        const otherPoints = other.getTransformedPoints();
                        const otherAABB = other.getAABB();
                        if (!checkAABBOverlap(objAABB, otherAABB)) continue;
                        
                        const collision = checkPolygonCollision(objPoints, otherPoints);
                        if (collision) {
                            this._resolveCollision(obj, other, collision);
                            this._handleShipCollisionDamage(obj, other, collision);
                            if (obj instanceof PlayerShip && other instanceof NpcShip && obj.canInitiateBoarding(other)) {
                                boardingManager.startBoarding(other, { x: obj.x, y: obj.y });
                            }
                            if (obj instanceof PlayerShip && other instanceof NpcShip) other.hasBeenAttackedByPlayer = true;
                            else if (obj instanceof NpcShip && other instanceof PlayerShip) obj.hasBeenAttackedByPlayer = true;
                        }
                    }

                    // Cannonball-on-Object
                    if (obj instanceof Cannonball) {
                        if (other instanceof Obstacle && (other.type === 'island' || other.type === 'rock')) {
                            for (const part of other.convexParts) {
                                if (!part.aabb) part.aabb = getPolygonAABB(part);
                                if (!checkAABBOverlap(objAABB, part.aabb)) continue;
                                if (distanceToPolygonSquared({ x: obj.x, y: obj.y }, part) < obj.radius * obj.radius) {
                                    obj.markedForRemoval = true;
                                    break;
                                }
                            }
                        } else if (other instanceof Ship) {
                            if (other === obj.owner) continue;
                            
                            const otherPoints = other.getTransformedPoints();
                            const otherAABB = other.getAABB();
                            if (!checkAABBOverlap(obj.getAABB(), otherAABB)) continue;
                            
                            const distSq = (obj.x - other.x) ** 2 + (obj.y - other.y) ** 2;
                            const safeRadius = other.shipLength * 0.6;
                            if (distSq > safeRadius * safeRadius) continue;

                            if (distanceToPolygonSquared({ x: obj.x, y: obj.y }, otherPoints) < obj.radius * obj.radius) {
                                if (obj.owner instanceof PlayerShip && other instanceof NpcShip) {
                                    other.hasBeenAttackedByPlayer = true;
                                    if (player.stats.combatEngagements === 0) {
                                        player.stats.combatEngagements = 1;
                                        player.updateRank();
                                    }
                                    other.wasHitThisFrame = true;
                                }

                                const cannonballAngle = Math.atan2(obj.vy, obj.vx);
                                const shipAngle = other.angle;
                                const impactAngle = normalizeAngle(cannonballAngle - shipAngle);
                                const interpolationFactor = Math.abs(Math.cos(impactAngle));
                                const criticalMultiplier = 1.0 + ((CRITICAL_HIT_MAX_MULTIPLIER - 1.0) * interpolationFactor);
                                let visualScale = 1.0;

                                if (obj instanceof ChainShot) {
                                    if (Math.random() < CHAIN_SHOT_RIG_DAMAGE_CHANCE) other.takeRigDamage(getRandomArbitrary(CHAIN_SHOT_RIG_DAMAGE_MIN, CHAIN_SHOT_RIG_DAMAGE_MAX));
                                    else other.takeDamage(CHAIN_SHOT_HULL_DAMAGE);
                                    if (Math.random() < CHAIN_SHOT_CREW_DAMAGE_CHANCE) other.crew = Math.max(0, other.crew - Math.floor(getRandomArbitrary(CHAIN_SHOT_CREW_DAMAGE_MIN, CHAIN_SHOT_CREW_DAMAGE_MAX + 0.99)));
                                    visualScale = 1.5;
                                } else if (obj instanceof GrapeShot) {
                                    if (Math.random() < 0.5) {
                                        other.takeDamage(GRAPE_SHOT_HULL_DAMAGE);
                                        other.crew = Math.max(0, other.crew - Math.floor(getRandomArbitrary(GRAPE_SHOT_CREW_DAMAGE_MIN * criticalMultiplier, (GRAPE_SHOT_CREW_DAMAGE_MAX * criticalMultiplier) + 0.99)));
                                    } else {
                                        other.takeRigDamage(getRandomArbitrary(GRAPE_SHOT_RIG_DAMAGE_MIN, GRAPE_SHOT_RIG_DAMAGE_MAX));
                                    }
                                    visualScale = 0.8;
                                } else if (obj instanceof CanisterShot) {
                                    if (Math.random() < 0.5) other.crew = Math.max(0, other.crew - Math.floor(getRandomArbitrary(CANISTER_SHOT_CREW_DAMAGE_MIN, CANISTER_SHOT_CREW_DAMAGE_MAX + 0.99)));
                                    if (Math.random() < 0.5) other.takeDamage(CANISTER_SHOT_HULL_DAMAGE);
                                    else other.takeRigDamage(CANISTER_SHOT_RIG_DAMAGE);
                                    visualScale = 0.6;
                                } else { // Standard Cannonball
                                    if (Math.random() < CANNONBALL_RIG_HIT_CHANCE) {
                                        other.takeRigDamage(CANNONBALL_RIG_DAMAGE);
                                    } else {
                                        other.takeDamage(CANNONBALL_HULL_DAMAGE * criticalMultiplier);
                                        visualScale = 1.0 + interpolationFactor;
                                        if (Math.random() < CANNONBALL_CREW_DAMAGE_CHANCE) other.crew = Math.max(0, other.crew - Math.floor(getRandomArbitrary(0, 1.99)));
                                        if (Math.random() < CANNON_DESTRUCTION_CHANCE && typeof other.destroyRandomCannon === 'function') other.destroyRandomCannon();
                                    }
                                }
                                effectManager.createDamageEffect(obj.x, obj.y, visualScale);
                                obj.markedForRemoval = true;
                            }
                        }
                    }
                }
            }
        };

        checkCollisionsForList(allShips);
        checkCollisionsForList(cannonballs);
    }

    _resolveCollision(obj1, obj2, collisionResult) {
        const overlap = collisionResult.overlap;
        const axis = collisionResult.axis;

        if (obj1 instanceof Ship && obj2 instanceof Ship) {
            const correction = overlap * 0.5;
            obj1.x += axis.x * correction;
            obj1.y += axis.y * correction;
            obj2.x -= axis.x * correction;
            obj2.y -= axis.y * correction;

            const relativeVelocity = { x: obj1.vx - obj2.vx, y: obj1.vy - obj2.vy };
            const velocityAlongNormal = relativeVelocity.x * axis.x + relativeVelocity.y * axis.y;
            if (velocityAlongNormal > 0) return;
            const impulse = -(1 + SHIP_COLLISION_RESTITUTION) * velocityAlongNormal;
            obj1.vx += impulse * axis.x;
            obj1.vy += impulse * axis.y;
            obj2.vx -= impulse * axis.x;
            obj2.vy -= impulse * axis.y;
        } else if (obj1 instanceof Ship && obj2 === null) {
            obj1.x += axis.x * overlap;
            const dot = obj1.vx * axis.x + obj1.vy * axis.y;
            obj1.vx -= 2 * dot * axis.x;
            obj1.vy -= 2 * dot * axis.y;
            obj1.vx *= 0.3;
            obj1.vy *= 0.3;
        }
    }

    _handleCollisionDamage(ship, obstacle, baseDamageFactorInitial, baseDamageFactorSustained) {
        const now = performance.now();
        const speed = Math.sqrt(ship.vx ** 2 + ship.vy ** 2);

        if (speed < MIN_SPEED_FOR_COLLISION_DAMAGE) return;

        let contactInfo = ship.obstacleContactTimers.get(obstacle);

        if (!contactInfo) {
            const damage = speed * COLLISION_DAMAGE_SPEED_MULTIPLIER * baseDamageFactorInitial;
            ship.takeDamage(damage);
            ship.obstacleContactTimers.set(obstacle, { firstContactTime: now, lastDamageTickTime: now });
            if (ship instanceof PlayerShip) ship.collidingFlashTimer = PLAYER_COLLISION_FLASH_DURATION;
        } else {
            if (now - contactInfo.lastDamageTickTime >= 1000) {
                const damage = speed * COLLISION_DAMAGE_SPEED_MULTIPLIER * baseDamageFactorSustained;
                ship.takeDamage(damage);
                contactInfo.lastDamageTickTime = now;
                if (ship instanceof PlayerShip) ship.collidingFlashTimer = PLAYER_COLLISION_FLASH_DURATION;
            }
        }
    }

    _handleShipCollisionDamage(ship1, ship2, collisionResult) {
        const axis = collisionResult.axis;
        const relativeVelocityX = ship1.vx - ship2.vx;
        const relativeVelocityY = ship1.vy - ship2.vy;
        const impactSpeed = Math.abs(relativeVelocityX * axis.x + relativeVelocityY * axis.y);

        if (impactSpeed > MIN_SPEED_FOR_COLLISION_DAMAGE) {
            const damage = impactSpeed * COLLISION_DAMAGE_SPEED_MULTIPLIER;
            ship1.takeDamage(damage);
            ship2.takeDamage(damage);
        }
    }
}