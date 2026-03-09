/**
 * Represents a node in the pathfinding grid.
 */
class PriorityQueue {
    constructor() {
        this.elements = [];
        this.priorities = [];
    }

    enqueue(element, priority) {
        this.elements.push(element);
        this.priorities.push(priority);
        this._bubbleUp(this.elements.length - 1);
    }

    dequeue() {
        if (this.elements.length === 0) return null;
        const min = this.elements[0];
        
        const lastElement = this.elements.pop();
        const lastPriority = this.priorities.pop();

        if (this.elements.length > 0) {
            this.elements[0] = lastElement;
            this.priorities[0] = lastPriority;
            this._sinkDown(0);
        }
        return min;
    }

    isEmpty() {
        return this.elements.length === 0;
    }

    _bubbleUp(index) {
        while (index > 0) {
            const parentIndex = Math.floor((index - 1) / 2);
            if (this.priorities[index] >= this.priorities[parentIndex]) break;
            
            this._swap(index, parentIndex);
            index = parentIndex;
        }
    }

    _sinkDown(index) {
        const length = this.elements.length;
        const elementPriority = this.priorities[index];

        while (true) {
            let leftChildIndex = 2 * index + 1;
            let rightChildIndex = 2 * index + 2;
            let swap = null;
            let leftPriority;

            if (leftChildIndex < length) {
                leftPriority = this.priorities[leftChildIndex];
                if (leftPriority < elementPriority) swap = leftChildIndex;
            }
            if (rightChildIndex < length) {
                const rightPriority = this.priorities[rightChildIndex];
                if ((swap === null && rightPriority < elementPriority) || 
                    (swap !== null && rightPriority < leftPriority)) {
                    swap = rightChildIndex;
                }
            }
            if (swap === null) break;
            
            this._swap(index, swap);
            index = swap;
        }
    }

    _swap(i, j) {
        const tempElem = this.elements[i];
        this.elements[i] = this.elements[j];
        this.elements[j] = tempElem;

        const tempPrio = this.priorities[i];
        this.priorities[i] = this.priorities[j];
        this.priorities[j] = tempPrio;
    }
}
class PathNode {
    constructor(gridX, gridY, worldX, worldY, walkable) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.worldPos = { x: worldX, y: worldY };
        this.walkable = walkable;
        this.distanceToObstacle = Infinity; // How many grid cells away the nearest unwalkable node is.
        this.gCost = 0;
        this.hCost = 0;
        this.parent = null;
        // --- NEW: Search ID for optimization ---
        this.lastVisitedRunId = 0;
        this.closedRunId = 0;
    }

    get fCost() {
        return this.gCost + this.hCost;
    }
}
/**
 * Checks if two line segments intersect.
 * This is a standard geometric formula.
 * @param {{x: number, y: number}} p1 - Start of line 1.
 * @param {{x: number, y: number}} p2 - End of line 1.
 * @param {{x: number, y: number}} p3 - Start of line 2.
 * @param {{x: number, y: number}} p4 - End of line 2.
 * @returns {boolean} True if they intersect, false otherwise.
 */
function lineIntersectsLine(p1, p2, p3, p4) {
    // Denominator for the equations for t and u
    const den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);

    // If the denominator is 0, the lines are parallel or collinear.
    if (den === 0) {
        return false;
    }

    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / den;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / den;

    // If t and u are between 0 and 1 (exclusive), the segments intersect.
    return t > 0 && t < 1 && u > 0 && u < 1;
}

/**
 * Checks if a line segment intersects with a polygon's boundary.
 * @param {{x: number, y: number}} p1 - The start point of the line segment.
 * @param {{x: number, y: number}} p2 - The end point of the line segment.
 * @param {Array<{x: number, y: number}>} polygon - An array of vertices defining the polygon.
 * @returns {boolean} True if the line intersects any edge of the polygon.
 */
function lineIntersectsPolygon(p1, p2, polygon) {
    for (let i = 0; i < polygon.length; i++) {
        const p3 = polygon[i];
        const p4 = polygon[(i + 1) % polygon.length]; // Get the next vertex, wrapping around
        if (lineIntersectsLine(p1, p2, p3, p4)) {
            return true;
        }
    }
    return false;
}

/**
 * Calculates the Axis-Aligned Bounding Box (AABB) for a polygon.
 * @param {Array<{x: number, y: number}>} polygon - The polygon vertices.
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}}
 */
function getPolygonAABB(polygon) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of polygon) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
}

/**
 * Provides pathfinding capabilities using an A* search algorithm on a grid.
 * It can find paths for ships considering wind direction and obstacles.
 * It also provides utility for line-of-sight checks.
 */
class Pathfinder {
    /**
     * @param {Array<Obstacle>} obstacles - A list of all static obstacles in the world.
     * @param {number} worldWidth - The total width of the game world.
     * @param {number} worldHeight - The total height of the game world.
     * @param {number} cellSize - The size of each cell in the pathfinding grid.
     */
    constructor(obstacles, worldWidth, worldHeight, cellSize) {
        this.obstacles = obstacles; // Keep a reference for line-of-sight checks
        this.worldWidth = worldWidth;
        this.worldHeight = worldHeight;
        this.cellSize = cellSize;
        this.spatialGrid = new SpatialGrid(cellSize * 2, worldWidth, worldHeight); // Internal grid for obstacle checks
        this.grid = this._createGrid();
        this.searchRunId = 0; // --- NEW: Initialize search run ID ---
        this.neighborsBuffer = []; // --- OPTIMIZATION: Shared buffer for neighbors ---
        this._markObstacleCells(obstacles);
        this._calculateDistanceField();
    }

    /**
     * Creates the pathfinding grid.
     * @private
     */
    _createGrid() {
        const grid = [];
        this.gridWidth = Math.ceil(this.worldWidth / this.cellSize);
        this.gridHeight = Math.ceil(this.worldHeight / this.cellSize);

        // Create a buffer zone around the world's edge by calculating how many cells it corresponds to.
        // We use the same buffer distance as for obstacles for consistency.
        // --- FIX: Use the global WORLD_BUFFER to match the game logic ---
        const worldEdgeBuffer = (typeof WORLD_BUFFER !== 'undefined') ? WORLD_BUFFER : (SHIP_TARGET_LENGTH * 4);
        const bufferInCells = Math.ceil(worldEdgeBuffer / this.cellSize);

        for (let x = 0; x < this.gridWidth; x++) {
            grid[x] = [];
            for (let y = 0; y < this.gridHeight; y++) {
                const worldX = x * this.cellSize + this.cellSize / 2;
                const worldY = y * this.cellSize + this.cellSize / 2;
                // Mark cells within the buffer zone as unwalkable.
                const isWalkable = x >= bufferInCells && x < this.gridWidth - bufferInCells &&
                                   y >= bufferInCells && y < this.gridHeight - bufferInCells;
                grid[x][y] = new PathNode(x, y, worldX, worldY, isWalkable);
            }
        }
        console.log(`Pathfinder grid created (${this.gridWidth}x${this.gridHeight}) with a ${bufferInCells}-cell border.`);
        return grid;
    }

    /**
     * Marks cells in the grid that are occupied by obstacles.
     * @private
     */
    _markObstacleCells(obstacles) {
        obstacles.forEach(obs => this.spatialGrid.insert(obs)); // Populate the spatial grid
        const unwalkableTypes = ['island', 'rock', 'coralReef', 'shoal'];

        for (const obstacle of obstacles) {
            if (!unwalkableTypes.includes(obstacle.type)) {
                continue;
            }

            // --- Get the correct geometry for the obstacle, handling CoralReef's structure ---
            const geometrySource = (obstacle.type === 'coralReef' && obstacle.rockBase) ? obstacle.rockBase : obstacle;
            const polygonPoints = geometrySource.outerPerimeterPoints;

            if (!polygonPoints) {
                console.warn(`Pathfinder: Could not find perimeter points for obstacle type ${obstacle.type}. Skipping.`);
                continue;
            }

            // --- New Standardized Buffer Zone ---
            // The buffer is now a fixed distance based on ship length, ensuring consistent
            // and safe spacing around all obstacles. The real buffer is handled dynamically in A*.
            const buffer = this.cellSize / 2;
            const bufferSq = buffer * buffer;

            // Determine the grid cell range to check based on the geometry's AABB + buffer
            const aabb = geometrySource.getAABB();
            const startX = Math.max(0, Math.floor((aabb.minX - buffer) / this.cellSize));
            const endX = Math.min(this.gridWidth - 1, Math.ceil((aabb.maxX + buffer) / this.cellSize));
            const startY = Math.max(0, Math.floor((aabb.minY - buffer) / this.cellSize));
            const endY = Math.min(this.gridHeight - 1, Math.ceil((aabb.maxY + buffer) / this.cellSize));

            for (let x = startX; x <= endX; x++) {
                for (let y = startY; y <= endY; y++) {
                    const node = this.grid[x][y];
                    if (!node.walkable) continue; // Already marked, skip.

                    // Check the distance from the center of the grid cell to the *actual* polygon boundary.
                    const distSq = distanceToPolygonSquared(node.worldPos, polygonPoints);
                    if (distSq < bufferSq) {
                        node.walkable = false;
                    }
                }
            }
        }
        console.log("Pathfinder obstacles marked with form-fitting buffer zones.");
    }

    /**
     * Calculates the distance from each walkable node to the nearest unwalkable node.
     * This uses a multi-source Breadth-First Search (BFS) for efficiency.
     * The resulting distance field is used to penalize paths that get too close to obstacles.
     * @private
     */
    _calculateDistanceField() {
        const queue = [];
        // Initialize queue with all unwalkable nodes (the "sources" of the distance field).
        for (let x = 0; x < this.gridWidth; x++) {
            for (let y = 0; y < this.gridHeight; y++) {
                if (!this.grid[x][y].walkable) {
                    this.grid[x][y].distanceToObstacle = 0;
                    queue.push(this.grid[x][y]);
                }
            }
        }

        let head = 0;
        while (head < queue.length) {
            const currentNode = queue[head++];
            for (const neighbor of this._getNeighbors(currentNode)) {
                if (neighbor.distanceToObstacle === Infinity) { // If unvisited
                    neighbor.distanceToObstacle = currentNode.distanceToObstacle + 1;
                    queue.push(neighbor);
                }
            }
        }
        console.log("Pathfinder distance field calculated.");
    }

    /**
     * Calculates a vector pointing towards open water (higher distanceToObstacle) from a given position.
     * Used when a ship is stuck inside a buffer zone.
     * @param {{x: number, y: number}} worldPos
     * @returns {{x: number, y: number}} Normalized vector.
     */
    getEscapeVector(worldPos) {
        const node = this._worldToGridNode(worldPos);
        if (!node) return { x: 0, y: 0 };

        let maxDist = -1;
        let bestNeighbor = null;

        // Check 3x3 neighborhood to find the cell furthest from obstacles
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                if (x === 0 && y === 0) continue;
                const nx = node.gridX + x;
                const ny = node.gridY + y;
                if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight) {
                    const neighbor = this.grid[nx][ny];
                    // Prefer walkable nodes, then distance
                    const score = (neighbor.walkable ? 10000 : 0) + neighbor.distanceToObstacle;
                    
                    if (score > maxDist) {
                        maxDist = score;
                        bestNeighbor = neighbor;
                    }
                }
            }
        }

        if (bestNeighbor) {
            const dx = bestNeighbor.worldPos.x - worldPos.x;
            const dy = bestNeighbor.worldPos.y - worldPos.y;
            const len = Math.sqrt(dx*dx + dy*dy);
            if (len > 0) return { x: dx/len, y: dy/len };
        }
        
        // Fallback: If no better neighbor, point TOWARDS world center (Safe direction)
        const cx = this.worldWidth / 2;
        const cy = this.worldHeight / 2;
        const dx = cx - worldPos.x; // Points towards center
        const dy = cy - worldPos.y; // Points towards center
        const len = Math.sqrt(dx*dx + dy*dy);
        return (len > 0) ? { x: dx/len, y: dy/len } : { x: 1, y: 0 };
    }

    /**
     * Finds a path from a start point to an end point using A*.
     * @param {{x: number, y: number}} start - The starting coordinates.
     * @param {{x: number, y: number}} end - The ending coordinates.
     * @param {number} windDirection - The current wind direction.
     * @param {Ship} ship - The ship instance for which the path is being calculated.
     * @returns {Array<{x: number, y: number}>} An array of waypoints.
     */
    findPath(start, end, windDirection, ship) {
        let startNode = this._worldToGridNode(start);
        let endNode = this._worldToGridNode(end);

        // --- FIX: The start/end node check must use the ship's dynamic buffer size. ---
        const requiredBufferInCells = Math.ceil((ship.shipLength * 2) / this.cellSize);

        if (!startNode || !startNode.walkable || startNode.distanceToObstacle < requiredBufferInCells) {
            console.log(`Pathfinder: Start point is inside dynamic buffer. Finding nearest valid node.`);
            startNode = this._findNearestWalkableNode(startNode, ship);
            if (!startNode) {
                console.error("Could not find any walkable start node. Aborting pathfinding.");
                return []; // Cannot find path from invalid start
            }
        }

        // If the end node is not walkable, find the nearest walkable one.
        if (!endNode.walkable || endNode.distanceToObstacle < requiredBufferInCells) {
            console.log(`Pathfinder: End point is inside dynamic buffer. Finding nearest valid node.`);
            endNode = this._findNearestWalkableNode(endNode, ship);
            if (!endNode) {
                console.warn("Could not find a walkable node near the destination.");
                return []; // Cannot find path to invalid end
            }
        }

        const nodePath = this._aStarSearch(startNode, endNode, windDirection, ship);
        if (nodePath.length === 0) {
            return []; // No path found
        }

        const worldPath = nodePath.map(node => node.worldPos);

        // --- FIX: Optimize Start Position ---
        // If the start node wasn't moved due to safety checks, start the path exactly
        // at the ship's position instead of the grid cell center.
        // This prevents a tiny initial segment that can confuse the tacking logic.
        if (this._worldToGridNode(start) === startNode) {
            worldPath[0] = start;
        }

        const smoothedPath = this._smoothPath(worldPath, windDirection, ship);

        // NEW: Post-process the smoothed path to add detailed tacking patterns.
        const finalPath = this._postProcessPathForTacking(smoothedPath, windDirection, ship);

        this._validatePath(finalPath); // Use the final path for validation

        return finalPath;
    }

    /**
     * [DEBUG] Checks if a given path intersects with any physical terrain obstacles.
     * Logs a warning if an intersection is found.
     * @param {Array<{x: number, y: number}>} path - The path to validate.
     * @private
     */
    _validatePath(path) {
        if (path.length < 2) return;

        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i + 1];
            const intersectingObstacle = this._getIntersectingObstacle(p1, p2);

            if (intersectingObstacle) {
                console.warn(
                    `[Pathfinder Validation] Path segment intersects with terrain!`,
                    {
                        segmentStart: p1,
                        segmentEnd: p2,
                        obstacleType: intersectingObstacle.type,
                        obstacleCenter: { x: intersectingObstacle.x, y: intersectingObstacle.y }
                    }
                );
            }
        }
    }

    /**
     * [DEBUG HELPER] Finds the first physical obstacle that a line segment intersects.
     * @param {{x: number, y: number}} start - The starting point of the line.
     * @param {{x: number, y: number}} end - The ending point of the line.
     * @param {Array<string>} [typesToIgnore=[]] - An array of obstacle types to ignore for this check.
     * @returns {Obstacle|null} The obstacle that was intersected, or null.
     * @private
     */
    _getIntersectingObstacle(start, end, typesToIgnore = []) {
        const queryAABB = {
            minX: Math.min(start.x, end.x),
            maxX: Math.max(start.x, end.x),
            minY: Math.min(start.y, end.y),
            maxY: Math.max(start.y, end.y)
        };
        const potentialObstacles = this.spatialGrid.query(queryAABB);

        for (const obstacle of potentialObstacles) {
            if (typesToIgnore.includes(obstacle.type)) continue;

            // --- OPTIMIZATION: Convex Hull Check ---
            // If the line doesn't hit the hull, it can't hit the parts.
            if (obstacle.convexHull && !lineIntersectsPolygon(start, end, obstacle.convexHull)) {
                continue;
            }

            for (const part of obstacle.convexParts) {
                if (lineIntersectsPolygon(start, end, part)) return obstacle;
            }
        }
        return null;
    }

    /**
     * Takes a smoothed path and inserts detailed tacking waypoints for any upwind segments.
     * @param {Array<{x: number, y: number}>} path - The smoothed path.
     * @param {number} windDirection - The current wind direction.
     * @param {Ship} ship - The ship instance.
     * @returns {Array<{x: number, y: number}>} A new, more detailed path.
     * @private
     */
    _postProcessPathForTacking(path, windDirection, ship) {
        if (path.length < 1) return path;

        const detailedPath = [];
        let currentPoint = { x: ship.x, y: ship.y }; // Start from the ship's actual position

        // --- NEW: Check if start point is safe ---
        // If the ship is currently in a buffer zone, we cannot generate safe tacks starting from here.
        // We must sail straight to the first waypoint (which is presumably safe) to escape.
        const startNode = this._worldToGridNode(currentPoint);
        const requiredBufferInCells = Math.ceil((ship.shipLength * 2) / this.cellSize);
        const isStartSafe = startNode && startNode.walkable && startNode.distanceToObstacle >= requiredBufferInCells;

        for (let i = 0; i < path.length; i++) {
            const waypoint = path[i];
            
            // If start is unsafe, and this is the first segment, skip tacking logic to escape.
            if (i === 0 && !isStartSafe) {
                detailedPath.push(waypoint);
                currentPoint = waypoint;
                continue;
            }

            const travelAngle = Math.atan2(waypoint.y - currentPoint.y, waypoint.x - currentPoint.x);
            let angleToUpwind = normalizeAngle(travelAngle - windDirection);
            if (angleToUpwind > Math.PI) angleToUpwind -= 2 * Math.PI;

            // --- FIX: Use ship-specific close-hauled angle with a small safety buffer ---
            const shipCloseHauled = (typeof ship.getCloseHauledAngle === 'function') ? ship.getCloseHauledAngle() : PATHFINDER_TACKING_ANGLE_THRESHOLD;
            const tackingThreshold = shipCloseHauled + 0.1; // Add ~5.7 degrees buffer for pathfinding safety

            // If this segment is upwind, generate detailed tacks.
            if (Math.abs(angleToUpwind) < tackingThreshold) {
                const tackWaypoints = this._generateUpwindTacks(currentPoint, waypoint, windDirection, ship);
                // FIX: Add all generated tack waypoints, including the destination of this segment.
                // Removing the last point (.slice(0, -1)) caused the ship to skip the actual waypoint.
                detailedPath.push(...tackWaypoints);
            } else {
                detailedPath.push(waypoint);
            }
            // The new "start" for the next segment is the last point we added to our detailed path.
            currentPoint = detailedPath.length > 0 ? detailedPath[detailedPath.length - 1] : currentPoint;
        }
        return detailedPath;
    }

    /**
     * Helper to determine the best angle to sail relative to the wind to maximize VMG.
     * @private
     */
    _getOptimalTackAngle(tackDirection, windDirection, ship) {
        // Use the ship's specific close-hauled angle.
        const closeHauled = (typeof ship.getCloseHauledAngle === 'function') ? ship.getCloseHauledAngle() : (Math.PI / 3);
        // Add a small buffer to ensure we are sailing effectively, not just pinching.
        const optimalAngle = closeHauled + 0.05; 
        return normalizeAngle(windDirection + (tackDirection * optimalAngle));
    }

    /**
     * Generates a series of explicit tacking waypoints to navigate an upwind segment.
     * @param {{x: number, y: number}} start - The start of the segment.
     * @param {{x: number, y: number}} end - The end of the segment.
     * @param {number} windDirection - The current wind direction.
     * @param {Ship} ship - The ship instance.
     * @returns {Array<{x: number, y: number}>} A list of waypoints forming a zig-zag tacking path.
     * @private
     */
    _generateUpwindTacks(start, end, windDirection, ship) {
        const waypoints = [];
        let currentPoint = start;

        // Determine the initial tack direction based on which side of the wind the target is on.
        // FIX: Corrected typo in atan2 calculation (was end.x - start.y)
        const angleToTarget = Math.atan2(end.y - start.y, end.x - start.x);
        let angleDiff = normalizeAngle(angleToTarget - windDirection);
        if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        let tackDirection = Math.sign(angleDiff) || 1; // Default to starboard tack if dead upwind.

        const MAX_TACKS = 20; // Failsafe
        for (let i = 0; i < MAX_TACKS; i++) {
            // If we are close enough, just go straight to the end.
            if (distance(currentPoint, end) < ship.shipLength * 2) {
                break;
            }

            // 1. Determine the ideal tacking angle for this leg (maximizes VMG).
            const tackAngle = this._getOptimalTackAngle(tackDirection, windDirection, ship);

            // 2. Define two lines:
            //    - The line we are currently sailing on (our tack).
            //    - The line for the *opposite* tack, starting from the final destination.
            // The intersection of these two lines is the "ideal" place to turn in open water.
            const oppositeTackAngle = this._getOptimalTackAngle(-tackDirection, windDirection, ship);
 
            const openWaterTurnPoint = this._getLineIntersection(
                currentPoint, { x: currentPoint.x + Math.cos(tackAngle), y: currentPoint.y + Math.sin(tackAngle) },
                end, { x: end.x + Math.cos(oppositeTackAngle), y: end.y + Math.sin(oppositeTackAngle) }
            );
 
            // 3. Find the furthest point we can safely sail to along our current tack.
            //    This involves finding the *closest* intersection point among several constraints:
            //    a) The ideal turning point in open water.
            //    b) The world boundaries.
            //    c) Any terrain obstacles.
 
            let potentialTurnPoints = [];
 
            // a) Add the ideal open-water turn point if it exists.
            if (openWaterTurnPoint) {
                potentialTurnPoints.push(openWaterTurnPoint);
            }
 
            // b) Calculate intersections with world boundaries.
            const tackEndPoint = { x: currentPoint.x + Math.cos(tackAngle) * (WORLD_WIDTH + WORLD_HEIGHT), y: currentPoint.y + Math.sin(tackAngle) * (WORLD_WIDTH + WORLD_HEIGHT) };
            const worldBoundaries = [
                { p1: { x: 0, y: 0 }, p2: { x: this.worldWidth, y: 0 } }, // Top
                { p1: { x: this.worldWidth, y: 0 }, p2: { x: this.worldWidth, y: this.worldHeight } }, // Right
                { p1: { x: this.worldWidth, y: this.worldHeight }, p2: { x: 0, y: this.worldHeight } }, // Bottom
                { p1: { x: 0, y: this.worldHeight }, p2: { x: 0, y: 0 } }  // Left
            ];
            for (const boundary of worldBoundaries) {
                const boundaryIntersection = this._getLineIntersection(currentPoint, tackEndPoint, boundary.p1, boundary.p2);
                if (boundaryIntersection) {
                    potentialTurnPoints.push(boundaryIntersection);
                }
            }
 
            // c) Check for intersections with terrain obstacles.
            const obstacleIntersection = this._getIntersectingObstacle(currentPoint, tackEndPoint);
            if (obstacleIntersection) {
                // We need to find the actual point of intersection on the obstacle's boundary.
                // This is a complex problem, so we'll use a simpler, robust approximation:
                // Find the point on the tack line that is just outside the obstacle's buffer.
                const buffer = obstacleIntersection.maxDistanceToPerimeter * 0.5;
                const obstaclePoint = { x: obstacleIntersection.x, y: obstacleIntersection.y };
                const closestPointOnTack = this._getClosestPointOnLine(currentPoint, tackEndPoint, obstaclePoint);
                const distToObstacleCenter = distance(closestPointOnTack, obstaclePoint);
                const distToBacktrack = Math.sqrt(Math.max(0, buffer * buffer - distToObstacleCenter * distToObstacleCenter));
                const pointBeforeObstacle = {
                    x: closestPointOnTack.x - Math.cos(tackAngle) * (distToBacktrack + ship.shipWidth), // Backtrack plus a safety margin
                    y: closestPointOnTack.y - Math.sin(tackAngle) * (distToBacktrack + ship.shipWidth),
                }
                potentialTurnPoints.push(pointBeforeObstacle);
            }
 
            // Find the closest valid intersection point to the current position.
            let nextWaypoint = end; // Default to the final destination.
            // FIX: Initialize with Infinity. We must prefer a valid tack point over the direct destination
            // if the destination is upwind, even if the tack point is further away (which happens with wide tack angles).
            let minDistanceSq = Infinity;
 
            for (const p of potentialTurnPoints) {
                const dSq = distance(currentPoint, p) ** 2;
                // The point must be "in front" of the ship along the tack.
                const dot = (p.x - currentPoint.x) * Math.cos(tackAngle) + (p.y - currentPoint.y) * Math.sin(tackAngle);
                if (dot > 0 && dSq < minDistanceSq) {
                    minDistanceSq = dSq;
                    nextWaypoint = p;
                }
            }
 
            // 4. If we can't move a significant distance, we might be stuck. Break the loop.
            // FIX: Enforce a minimum tack length equal to the ship's length to prevent micro-tacks.
            // User requested minimum 1 ship length.
            if (distance(currentPoint, nextWaypoint) < Math.max(10, ship.shipLength * 1)) {
                console.warn(`[Pathfinder] Tacking generation could not find a clear path from (${currentPoint.x.toFixed(0)}, ${currentPoint.y.toFixed(0)}).`);
                break;
            }

            // 5. Add the new waypoint and prepare for the next leg.
            waypoints.push(nextWaypoint);
            currentPoint = nextWaypoint;
            tackDirection *= -1; // Switch tacks for the next leg.
        }

        // Always add the final destination to ensure the path completes.
        waypoints.push(end);
        return waypoints;
    }

    /**
     * Calculates the intersection point of two lines defined by two points each.
     * @returns {{x: number, y: number}|null} The intersection point or null if parallel.
     * @private
     */
    _getLineIntersection(p1, p2, p3, p4) {
        const den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
        if (den === 0) return null; // Lines are parallel
        const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / den;
        return {
            x: p1.x + t * (p2.x - p1.x),
            y: p1.y + t * (p2.y - p1.y),
        };
    }

    _worldToGridNode(worldPos) {
        const percentX = worldPos.x / this.worldWidth;
        const percentY = worldPos.y / this.worldHeight;
        const gridX = Math.floor(percentX * this.gridWidth);
        const gridY = Math.floor(percentY * this.gridHeight);
        // Clamp to grid bounds
        const clampedX = Math.max(0, Math.min(gridX, this.gridWidth - 1));
        const clampedY = Math.max(0, Math.min(gridY, this.gridHeight - 1));

        // Robustness check for NaN or out-of-bounds, which can happen if worldPos is invalid.
        if (isNaN(clampedX) || isNaN(clampedY) || !this.grid || !this.grid[clampedX]) {
            console.error("Pathfinder: Invalid coordinates provided to _worldToGridNode, or grid not initialized.", { worldPos, clampedX, clampedY });
            return this.grid[0][0]; // Fallback to a known valid node to prevent crash
        }
        return this.grid[clampedX][clampedY];
    }

    /**
     * Optimized lookup using raw coordinates to avoid object allocation.
     * @param {number} worldX 
     * @param {number} worldY 
     * @returns {PathNode}
     */
    _worldXYToGridNode(worldX, worldY) {
        const percentX = worldX / this.worldWidth;
        const percentY = worldY / this.worldHeight;
        const gridX = Math.floor(percentX * this.gridWidth);
        const gridY = Math.floor(percentY * this.gridHeight);
        
        const clampedX = Math.max(0, Math.min(gridX, this.gridWidth - 1));
        const clampedY = Math.max(0, Math.min(gridY, this.gridHeight - 1));

        if (isNaN(clampedX) || isNaN(clampedY) || !this.grid || !this.grid[clampedX]) {
            return this.grid[0][0];
        }
        return this.grid[clampedX][clampedY];
    }

    _findNearestWalkableNode(originNode, ship) {
        const requiredBufferInCells = Math.ceil((ship.shipLength * 2) / this.cellSize);
        let searchRadius = 1;
        while (searchRadius < Math.max(this.gridWidth, this.gridHeight)) {
            for (let i = -searchRadius; i <= searchRadius; i++) {
                for (let j = -searchRadius; j <= searchRadius; j++) {
                    if (Math.abs(i) !== searchRadius && Math.abs(j) !== searchRadius) continue;
                    const checkX = originNode.gridX + i;
                    const checkY = originNode.gridY + j;
                    if (checkX >= 0 && checkX < this.gridWidth && checkY >= 0 && checkY < this.gridHeight) {
                        const node = this.grid[checkX][checkY];
                        if (node.walkable && node.distanceToObstacle >= requiredBufferInCells) {
                            return node;
                        }
                    }
                }
            }
            searchRadius++;
        }
        return null;
    }

    /**
     * Helper to find the closest point on an infinite line to a given point.
     * @param {{x: number, y: number}} p1 - Start of the line.
     * @param {{x: number, y: number}} p2 - End of the line.
     * @param {{x: number, y: number}} p - The point to project.
     * @returns {{x: number, y: number}} The projected point on the line.
     * @private
     */
    _getClosestPointOnLine(p1, p2, p) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        if (dx === 0 && dy === 0) return p1;
        const t = ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / (dx * dx + dy * dy);
        return { x: p1.x + t * dx, y: p1.y + t * dy };
    }

    _getNeighbors(node) {
        this.neighborsBuffer.length = 0;
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                if (x === 0 && y === 0) continue;
                const checkX = node.gridX + x;
                const checkY = node.gridY + y;
                if (checkX >= 0 && checkX < this.gridWidth && checkY >= 0 && checkY < this.gridHeight) {
                    this.neighborsBuffer.push(this.grid[checkX][checkY]);
                }
            }
        }
        return this.neighborsBuffer;
    }

    _reconstructPath(startNode, endNode) {
        const path = [];
        let currentNode = endNode;
        while (currentNode !== startNode) {
            path.push(currentNode);
            currentNode = currentNode.parent;
        }
        path.reverse();
        return path;
    }

    /**
     * Checks the clearance of a straight line between two world points by checking the
     * `distanceToObstacle` property of every grid cell along the line.
     * @param {{x: number, y: number}} startWorldPos - The starting world position.
     * @param {{x: number, y: number}} endWorldPos - The ending world position.
     * @returns {number} The minimum clearance (in grid cells) found along the path. Returns 0 if blocked.
     * @private
     */
    _getPathSegmentClearance(startWorldPos, endWorldPos) {
        const startNode = this._worldToGridNode(startWorldPos);
        const endNode = this._worldToGridNode(endWorldPos);

        let x0 = startNode.gridX;
        let y0 = startNode.gridY;
        const x1 = endNode.gridX;
        const y1 = endNode.gridY;

        const dx = Math.abs(x1 - x0);
        const dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        let minClearance = Infinity;

        while (true) {
            const currentNode = this.grid[x0][y0];
            if (!currentNode.walkable) return 0; // Blocked
            minClearance = Math.min(minClearance, currentNode.distanceToObstacle);

            if (x0 === x1 && y0 === y1) break;

            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
        return minClearance;
    }

    /**
     * Smooths a path by removing redundant waypoints, but only if the new shortcut
     * maintains a safe distance from all obstacles.
     * @param {Array<{x: number, y: number}>} path - The raw path from the A* search.
     * @returns {Array<{x: number, y: number}>} The smoothed path.
     * @private
     */
    _smoothPath(path, windDirection, ship) {
        if (path.length < 2) return path;

        const smoothedPath = [path[0]];
        let currentPointIndex = 0;
        // To prevent overly long segments that are hard to manage, we limit the max length.
        // The max length is dynamically set to twice the length of the navigating ship.
        // FIX: Ensure the max length is at least large enough to span a diagonal grid cell.
        // If the limit is smaller than the grid diagonal, no smoothing can occur.
        const MAX_SEGMENT_LENGTH = Math.max(ship.shipLength * 2, this.cellSize * 1.5);
        // --- Rig-Specific Smoothing Buffer ---
        // A less maneuverable ship requires a larger buffer.
        const baseBufferMultiplier = 3.0; // The buffer for a ship with 0 maneuverability.
        const maneuverabilityEffect = 1.5; // How much maneuverability affects the buffer.
        const bufferMultiplier = Math.max(1.5, baseBufferMultiplier - (ship.maneuverability * maneuverabilityEffect));
        const requiredBufferInCells = Math.ceil((ship.shipLength * bufferMultiplier) / this.cellSize);

        while (currentPointIndex < path.length - 1) {
            let nextVisiblePointIndex = currentPointIndex + 1;
            for (let i = currentPointIndex + 2; i < path.length; i++) {
                // Check 1: Segment Length. Don't create overly long segments.
                if (distance(path[currentPointIndex], path[i]) > MAX_SEGMENT_LENGTH) {
                    break; // Segment is too long, don't smooth further.
                }

                // --- FIX: Re-introduce the geometric line-of-sight check. ---
                // Use the simplified hull (true) for performance and to keep paths out of concave traps.
                if (!this.isLineOfSightClear(path[currentPointIndex], path[i], [], true)) {
                    break; // The direct line is blocked by an obstacle's geometry.
                }

                // Check 2: Dynamic Clearance Check using the distance field.
                // We trace the line on the grid and ensure every cell has enough clearance.
                const startNode = this._worldToGridNode(path[currentPointIndex]);
                const endNode = this._worldToGridNode(path[i]);
                let isSegmentClear = true;
                let x0 = startNode.gridX, y0 = startNode.gridY;
                const x1 = endNode.gridX, y1 = endNode.gridY;
                const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
                const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
                let err = dx + dy;

                while (true) {
                    if (this.grid[x0][y0].distanceToObstacle < requiredBufferInCells) {
                        isSegmentClear = false;
                        break;
                    }
                    if (x0 === x1 && y0 === y1) break;
                    const e2 = 2 * err;
                    if (e2 >= dy) { err += dy; x0 += sx; }
                    if (e2 <= dx) { err += dx; y0 += sy; }
                }

                // --- FIX: Removed Wind Angle Check ---
                // We allow smoothing to create long upwind segments because _postProcessPathForTacking
                // will handle breaking them down into proper tacks later.
                if (!isSegmentClear) {
                    break; // Path is not clear enough, stop smoothing here.
                }

                // If all checks pass, this is a valid longer shortcut
                nextVisiblePointIndex = i;
            }
            smoothedPath.push(path[nextVisiblePointIndex]);
            currentPointIndex = nextVisiblePointIndex;
        }
        return smoothedPath;
    }

    _aStarSearch(startNode, endNode, windDirection, ship) {
        this.searchRunId++; // --- NEW: Increment run ID for this search ---
        const openSet = new PriorityQueue();
        // const closedSet = new Set(); // Removed in favor of closedRunId check

        // Initialize start node
        // We don't need to reset the whole grid. We just set the start node's values
        // and update its run ID to match the current search.
        startNode.gCost = 0;
        startNode.hCost = distance(startNode.worldPos, endNode.worldPos);
        openSet.enqueue(startNode, startNode.fCost);

        while (!openSet.isEmpty()) {
            const currentNode = openSet.dequeue();

            if (currentNode === endNode) return this._reconstructPath(startNode, endNode);

            // If we've already processed this node (can happen with simple PQs), skip it.
            // --- FIX: Use integer comparison instead of Set lookup ---
            if (currentNode.closedRunId === this.searchRunId) continue;

            currentNode.closedRunId = this.searchRunId;

            for (const neighbor of this._getNeighbors(currentNode)) {
                // --- New Dynamic Buffer Check ---
                // A node is only valid if it's far enough from any obstacle for this specific ship.
                const requiredBufferInCells = Math.ceil((ship.shipLength * 2) / this.cellSize);
                
                // --- NEW: Lazy Reset ---
                // If this neighbor hasn't been visited in this run yet, treat it as fresh.
                if (neighbor.lastVisitedRunId !== this.searchRunId) {
                    neighbor.gCost = Infinity;
                    neighbor.parent = null;
                    neighbor.lastVisitedRunId = this.searchRunId;
                }

                if (neighbor.distanceToObstacle < requiredBufferInCells || neighbor.closedRunId === this.searchRunId) {
                    continue;
                }

                const travelAngle = Math.atan2(neighbor.worldPos.y - currentNode.worldPos.y, neighbor.worldPos.x - currentNode.worldPos.x);

                // --- Rig-Specific Wind Cost ---
                // Use the ship's specific performance curve if it exists, otherwise use the global default.
                const speedMultiplier = (typeof ship.getWindSpeedMultiplier === 'function')
                    ? ship.getWindSpeedMultiplier(travelAngle, windDirection)
                    : getWindSpeedMultiplier(travelAngle, windDirection);
                let windCostMultiplier = (speedMultiplier > 0.1) ? 1 / speedMultiplier : 50;

                // --- FIX: Use ship-specific close-hauled angle with buffer ---
                const shipCloseHauled = (typeof ship.getCloseHauledAngle === 'function') ? ship.getCloseHauledAngle() : PATHFINDER_TACKING_ANGLE_THRESHOLD;
                const tackingThreshold = shipCloseHauled + 0.1;

                // Add a graduated penalty for sailing upwind to encourage tacking paths.
                let angleToUpwind = normalizeAngle(travelAngle - windDirection);
                if (angleToUpwind > Math.PI) { angleToUpwind -= 2 * Math.PI; }
                const absAngleToUpwind = Math.abs(angleToUpwind);

                if (absAngleToUpwind < tackingThreshold) {
                    const penaltyFactor = (tackingThreshold - absAngleToUpwind) / tackingThreshold;
                    windCostMultiplier += penaltyFactor * 40.0; // Add a heavy, graduated penalty.
                }

                const distanceCost = distance(currentNode.worldPos, neighbor.worldPos);

                const hCost = distance(neighbor.worldPos, endNode.worldPos);

                // --- Rig-Specific Channel-Centering Penalty ---
                // Add a penalty for being close to obstacles. This encourages paths to stay in the middle of wide channels.
                const maxRelevantDistance = 8; // Consider distances up to 8 grid cells away.
                const normalizedCloseness = Math.max(0, (maxRelevantDistance - neighbor.distanceToObstacle) / maxRelevantDistance);
                // A less maneuverable ship (lower maneuverability) gets a higher penalty, forcing it to take wider berths.
                const baseObstaclePenaltyFactor = 30.0;
                const maneuverabilityFactor = ship.maneuverability > 0.1 ? ship.maneuverability : 0.1; // Avoid division by zero
                const obstaclePenalty = normalizedCloseness * distanceCost * (baseObstaclePenaltyFactor / maneuverabilityFactor);

                const newGCost = currentNode.gCost + (distanceCost * windCostMultiplier) + obstaclePenalty;

                if (newGCost < neighbor.gCost) {
                    neighbor.gCost = newGCost;
                    neighbor.hCost = hCost; // Use the potentially drift-compensated H-cost
                    neighbor.parent = currentNode;
                    // The priority queue doesn't have an 'update' method for simplicity.
                    // Re-enqueuing is acceptable for this A* implementation.
                    openSet.enqueue(neighbor, neighbor.fCost);
                }
            }
        }
        return []; // No path found
    }

    /**
     * Checks if a straight line between two points is safe for a specific ship,
     * accounting for the ship's size and the grid's distance field.
     * @param {{x: number, y: number}} start - World start position.
     * @param {{x: number, y: number}} end - World end position.
     * @param {Ship} ship - The ship to check for.
     * @param {boolean} [ignoreBuffer=false] - If true, only checks for hard collisions (walkable), ignoring the distance buffer.
     * @returns {boolean} True if the line is safe.
     */
    isSafeLine(start, end, ship, ignoreBuffer = false) {
        const startNode = this._worldToGridNode(start);
        const endNode = this._worldToGridNode(end);
        
        if (!startNode || !endNode) return false;

        // Use the same buffer logic as findPath
        const requiredBufferInCells = Math.ceil((ship.shipLength * 2) / this.cellSize);

        let x0 = startNode.gridX, y0 = startNode.gridY;
        const x1 = endNode.gridX, y1 = endNode.gridY;
        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;

        while (true) {
            const node = this.grid[x0][y0];
            // Check walkability AND distance buffer
            if (!node.walkable || (!ignoreBuffer && node.distanceToObstacle < requiredBufferInCells)) {
                return false;
            }
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
        return true;
    }

    /**
     * Checks if there is a direct, unobstructed line between two points.
     * @param {{x: number, y: number}} start - The starting point.
     * @param {{x: number, y: number}} end - The ending point.
     * @param {Array<string>} [typesToIgnore=[]] - An array of obstacle types to ignore for this check.
     * @param {boolean} [useSimplifiedHull=false] - If true, checks against the convex hull instead of detailed parts.
     * @param {Array<Obstacle>} [cachedObstacles=null] - Optional list of obstacles to check, skipping grid query.
     * @returns {boolean} True if the line of sight is clear, false otherwise.
     */
    isLineOfSightClear(start, end, typesToIgnore = [], useSimplifiedHull = false, cachedObstacles = null) {
        // Define line AABB once
        const lineMinX = Math.min(start.x, end.x);
        const lineMinY = Math.min(start.y, end.y);
        const lineMaxX = Math.max(start.x, end.x);
        const lineMaxY = Math.max(start.y, end.y);

        // Use cached obstacles if provided, otherwise query the spatial grid.
        const obstaclesToCheck = cachedObstacles || this.spatialGrid.query({ minX: lineMinX, minY: lineMinY, maxX: lineMaxX, maxY: lineMaxY });

        for (const obstacle of obstaclesToCheck) {
            // If the obstacle's type is in the ignore list, skip it.
            if (typesToIgnore.includes(obstacle.type)) {
                continue;
            }

            // --- NEW: Mid-Phase 1: Object-Level AABB Check ---
            // Excellent for long/wide islands. If the line's box doesn't overlap the island's box, skip.
            if (obstacle.boundingRect) {
                if (lineMaxX < obstacle.boundingRect.minX || lineMinX > obstacle.boundingRect.maxX ||
                    lineMaxY < obstacle.boundingRect.minY || lineMinY > obstacle.boundingRect.maxY) {
                    continue; 
                }
            }

            // --- NEW: Mid-Phase 2: Bounding Circle Check ---
            // Excellent for diagonal passes. If the line is too far from center, skip.
            if (obstacle.boundingRadius) {
                const distSq = distanceToSegmentSquared(obstacle, start, end);
                if (distSq > obstacle.boundingRadius * obstacle.boundingRadius) {
                    continue; 
                }
            }

            // --- NEW: Mid-Phase 3: Simplified Convex Hull Check ---
            // If the obstacle has a convex hull, check against that first.
            if (obstacle.convexHull) {
                const hitsHull = lineIntersectsPolygon(start, end, obstacle.convexHull);
                if (!hitsHull) {
                    // If the line does NOT intersect the hull boundary, we can skip the detailed check.
                    continue; 
                } else if (useSimplifiedHull) {
                    // If using simplified mode, hitting the hull counts as a collision.
                    return false;
                }
            }

            // Check for intersection with each convex part of the obstacle.
            // For line-of-sight purposes, all terrain is considered an obstacle.
            const geometrySource = (obstacle.type === 'coralReef' && obstacle.rockBase) ? obstacle.rockBase : obstacle;
            // --- FIX: Add 'coralReefBase' to the list of types to check against ---
            // This ensures the physical geometry of a coral reef is used for line-of-sight checks.
            if (['island', 'rock', 'coralReef', 'shoal', 'coralReefBase'].includes(geometrySource.type)) {
                for (const part of geometrySource.convexParts) {
                    // --- OPTIMIZATION: Part-Level AABB Check ---
                    if (!part.aabb) {
                        part.aabb = getPolygonAABB(part);
                    }

                    // Check overlap between line AABB and part AABB
                    if (lineMaxX < part.aabb.minX || lineMinX > part.aabb.maxX ||
                        lineMaxY < part.aabb.minY || lineMinY > part.aabb.maxY) {
                        continue;
                    }

                    if (lineIntersectsPolygon(start, end, part)) {
                        return false; // The line is blocked.
                    }
                }
            }
        }
        return true; // No intersections found.
    }
}