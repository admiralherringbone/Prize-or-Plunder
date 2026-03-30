class Obstacle {
    constructor(irregularPoints, color, baseRadiusX, baseRadiusY, type = 'island', isSmall = false) {
        this.originalIrregularPoints = irregularPoints;
        this.color = color;
        this.strokeColor = (typeof darkenColor === 'function') ? darkenColor(color, 10) : color;
        this.type = type;
        this.isSmall = isSmall;
        this.baseRadiusX = baseRadiusX;
        this.baseRadiusY = baseRadiusY;
        this.convexParts = triangulatePolygon(irregularPoints);
        this.outerPerimeterPoints = getOuterPerimeter(irregularPoints);

        this.minX = Infinity;
        this.minY = Infinity;
        this.maxX = -Infinity;
        this.maxY = -Infinity;
        let centerXSum = 0;
        let centerYSum = 0;
        let numPoints = 0;

        for (const part of this.convexParts) {
            for (const p of part) {
                this.minX = Math.min(this.minX, p.x);
                this.minY = Math.min(this.minY, p.y);
                this.maxX = Math.max(this.maxX, p.x);
                this.maxY = Math.max(this.maxY, p.y);
                centerXSum += p.x;
                centerYSum += p.y;
                numPoints++;
            }
        }
        this.x = centerXSum / numPoints;
        this.y = centerYSum / numPoints;

        this.maxDistanceToPerimeter = 0;
        for (const p of this.outerPerimeterPoints) {
            this.maxDistanceToPerimeter = Math.max(this.maxDistanceToPerimeter, distance({ x: this.x, y: this.y }, p));
        }

        this.proximityRadius = 0; // This should be set by the world generation logic based on obstacle type.
        
        this.visualCache = null;
        this.visualCacheOffset = { x: 0, y: 0 };
        this.visualChunks = null; // New: Array of chunk objects {canvas, x, y, width, height}

        this.ribbonData = null; // Pre-calculated normals/distances for GPU/2D waves
        // --- NEW: Local Spatial Partitioning for Physics ---
        this.localGridSize = 250; // Bucket size (~5x ship width)
        this.localCollisionGrid = null;
        this.queryRunId = 0; // For deduplication during queries
        this._cachedRelevantParts = []; // Reusable array
        this.anchorZonePolygon = null;
        this._buildLocalCollisionGrid();
    }

    getAABB() {
        return {
            minX: this.minX,
            minY: this.minY,
            maxX: this.maxX,
            maxY: this.maxY
        };
    }

    /**
     * Generates vertex normals and cumulative distances along the perimeter.
     * This is required for "Baking" geometry into GPU buffers.
     */
    generateRibbonData() {
        const perimeter = this.outerPerimeterPoints;
        if (!perimeter || perimeter.length < 3) return;

        const len = perimeter.length;
        const normals = new Float32Array(len * 2);
        const edgeNormals = new Float32Array(len * 2);
        const dists = new Float32Array(len);

        // 1. Determine Winding (Area check)
        let area = 0;
        for (let i = 0; i < len; i++) {
            const p1 = perimeter[i];
            const p2 = perimeter[(i + 1) % len];
            area += (p1.x * p2.y - p2.x * p1.y);
        }
        const isNegativeArea = area < 0;

        // 2. Calculate Edge Normals and Cumulative Distance
        let totalDist = 0;
        for (let i = 0; i < len; i++) {
            const curr = perimeter[i];
            const next = perimeter[(i + 1) % len];
            const prev = perimeter[(i - 1 + len) % len];

            // Use adjacent points for a smooth tangent at this vertex
            const dx = next.x - prev.x;
            const dy = next.y - prev.y;
            const dLen = Math.sqrt(dx * dx + dy * dy) || 1;

            // Standard inward normal logic
            const nx = isNegativeArea ? dy / dLen : -dy / dLen;
            const ny = isNegativeArea ? -dx / dLen : dx / dLen;

            edgeNormals[i * 2] = nx;
            edgeNormals[i * 2 + 1] = ny;

            // Distances
            dists[i] = totalDist;
            const dNextX = next.x - curr.x;
            const dNextY = next.y - curr.y;
            totalDist += Math.sqrt(dNextX * dNextX + dNextY * dNextY);
        }

        // 3. Smooth vertex normals (Average of adjacent edges)
        for (let i = 0; i < len; i++) {
            const prevI = (i - 1 + len) % len;
            let nx = edgeNormals[prevI * 2] + edgeNormals[i * 2];
            let ny = edgeNormals[prevI * 2 + 1] + edgeNormals[i * 2 + 1];
            const nLen = Math.sqrt(nx * nx + ny * ny) || 1;
            normals[i * 2] = nx / nLen;
            normals[i * 2 + 1] = ny / nLen;
        }

        // --- NEW: Triangulate for WebGL Solid Rendering ---
        // earcut expects a flat array of [x, y, x, y...]
        const flatPoints = new Float32Array(len * 2);
        for (let i = 0; i < len; i++) {
            flatPoints[i * 2] = perimeter[i].x;
            flatPoints[i * 2 + 1] = perimeter[i].y;
        }
        const indices = earcut(flatPoints);

        // --- FIX: Safety Check for Malformed Geometry ---
        if (!indices || indices.length === 0 || totalDist <= 0 || isNaN(totalDist)) return;

        this.ribbonData = {
            normals: normals,
            dists: dists,
            totalPerimeter: totalDist,
            indices: indices
        };
    }

    /**
     * Generates an offset polygon using ClipperLib (Inset or Outset).
     * @param {Array<{x:number, y:number}>} points - The source polygon.
     * @param {number} offsetDistance - The distance to offset. Negative = Shrink (Inset), Positive = Expand (Outset).
     * @param {number} [joinType] - ClipperLib.JoinType (jtMiter, jtRound, jtSquare). Defaults to jtMiter.
     * @protected
     * @returns {Array<object>} An array of point objects {x, y}.
     */
    _generateOffsetPolygon(points, offsetDistance, joinType = ClipperLib.JoinType.jtMiter) {
        if (typeof ClipperLib === 'undefined') {
            console.warn("ClipperLib not found, falling back to simple points.");
            return points;
        }

        const scale = 100; // Clipper works with integers, so we scale up
        const path = points.map(p => ({X: Math.round(p.x * scale), Y: Math.round(p.y * scale)}));
        
        const co = new ClipperLib.ClipperOffset();
        co.AddPath(path, joinType, ClipperLib.EndType.etClosedPolygon);
        
        const solution = new ClipperLib.Paths();
        co.Execute(solution, offsetDistance * scale); 

        if (solution.length > 0) {
            // If the polygon splits, pick the largest one to maintain a single main body.
            let bestPath = solution[0];
            let maxArea = Math.abs(ClipperLib.Clipper.Area(bestPath));
            
            for (let i = 1; i < solution.length; i++) {
                const area = Math.abs(ClipperLib.Clipper.Area(solution[i]));
                if (area > maxArea) {
                    maxArea = area;
                    bestPath = solution[i];
                }
            }
            
            const result = bestPath.map(p => ({x: p.X / scale, y: p.Y / scale}));
            // Ensure correct winding for our engine
            if (typeof ensureClockwiseWinding === 'function') {
                ensureClockwiseWinding(result);
            }
            return result;
        }
        
        return [];
    }

    /**
     * Generates accurately shaped contour polygons for interaction zones (Anchor).
     * @param {number} anchorDistance - The distance from shore to the edge of the anchor zone.
     */
    generateZonePolygons(anchorDistance) {
        this.anchorZonePolygon = this._generateOffsetPolygon(this.originalIrregularPoints, anchorDistance, ClipperLib.JoinType.jtRound);
    }

    /**
     * Pre-renders the static visual elements of the obstacle to an off-screen canvas.
     */
    cacheVisuals() {
        this.releaseCache(); // Safety: Ensure we don't leak existing resources if re-caching
        const padding = 4; // Padding to prevent stroke clipping
        const width = (this.maxX - this.minX) + padding * 2;
        const height = (this.maxY - this.minY) + padding * 2;

        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;

        // --- NEW: Chunked Caching for Massive Objects ---
        // If the object is too large for a single texture, split it into tiles.
        if (width > 2048 || height > 2048) {
            this._cacheVisualsChunked(width, height, padding);
            return;
        }

        this.visualCache = window.CanvasManager.getCanvas(width, height);
        this.visualCache.width = width;
        this.visualCache.height = height;
        const ctx = this.visualCache.getContext('2d');

        // Defensive check: If context creation fails, return early to prevent TypeError.
        // This can happen if canvas dimensions are invalid or excessively large.
        if (!ctx) {
            console.warn(`Failed to get 2D context for obstacle cache. Width: ${width}, Height: ${height}.`, this);
            return;
        }

        this.visualCacheOffset = { x: this.minX - padding, y: this.minY - padding };

        // Translate context so (minX, minY) is at (padding, padding)
        ctx.translate(-this.visualCacheOffset.x, -this.visualCacheOffset.y);
        
        this.renderStaticVisuals(ctx);
    }

    /**
     * Creates a grid of smaller canvases to represent a large object.
     * Includes "Sparse Optimization" to skip empty chunks (e.g., bays).
     * @private
     */
    _cacheVisualsChunked(totalWidth, totalHeight, padding) {
        this.visualChunks = [];
        this.visualCacheOffset = { x: this.minX - padding, y: this.minY - padding }; // Store offset for reference
        const CHUNK_SIZE = 1024; // 1024x1024 tiles
        const cols = Math.ceil(totalWidth / CHUNK_SIZE);
        const rows = Math.ceil(totalHeight / CHUNK_SIZE);
        
        // Origin of the total bounding box in world space
        const originX = this.minX - padding;
        const originY = this.minY - padding;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const chunkX = originX + (c * CHUNK_SIZE);
                const chunkY = originY + (r * CHUNK_SIZE);
                const chunkW = Math.min(CHUNK_SIZE, totalWidth - (c * CHUNK_SIZE));
                const chunkH = Math.min(CHUNK_SIZE, totalHeight - (r * CHUNK_SIZE));
                
                // --- Sparse Optimization: Check if this chunk overlaps any geometry ---
                const chunkAABB = { minX: chunkX, minY: chunkY, maxX: chunkX + chunkW, maxY: chunkY + chunkH };
                let overlaps = false;

                // Check against the physics geometry to see if there is land here.
                // OPTIMIZATION: Use the local grid to only check triangles relevant to this chunk.
                const relevantParts = this.getRelevantConvexParts(chunkAABB);
                for (const part of relevantParts) {
                    if (!part.aabb) part.aabb = getPolygonAABB(part);
                    if (checkAABBOverlap(chunkAABB, part.aabb)) {
                        overlaps = true;
                        break;
                    }
                }
                
                if (!overlaps) continue; // Skip empty chunks (transparent water)

                // Ensure valid integer dimensions
                const safeW = Math.ceil(chunkW);
                const safeH = Math.ceil(chunkH);
                if (safeW <= 0 || safeH <= 0) continue;

                // --- FIX: Lazy Loading ---
                // Instead of creating the canvas NOW, we push a lightweight metadata object.
                // The canvas will be created in drawWorldSpace only when this chunk is visible.
                this.visualChunks.push({ 
                    canvas: null, 
                    x: chunkX, 
                    y: chunkY, 
                    width: safeW, 
                    height: safeH,
                    lastSeen: 0 
                });
            }
        }
    }

    /**
     * --- NEW: Streaming Helper ---
     * Creates the canvas for a specific chunk on demand.
     */
    _loadChunk(chunk) {
        const CHUNK_PADDING = 8; // pixels
        const canvasWidth = chunk.width + CHUNK_PADDING * 2;
        const canvasHeight = chunk.height + CHUNK_PADDING * 2;

        const canvas = window.CanvasManager.getCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) return; // Browser exhausted

        // Translate so the island draws into this specific tile correctly
        ctx.translate(-(chunk.x - CHUNK_PADDING), -(chunk.y - CHUNK_PADDING));
        this.renderStaticVisuals(ctx);
        
        chunk.canvas = canvas;
        // Store padding on the chunk so drawWorldSpace knows how to offset it.
        chunk.padding = CHUNK_PADDING;
    }

    _unloadChunk(chunk) {
        if (chunk.canvas) {
            window.CanvasManager.releaseCanvas(chunk.canvas);
            chunk.canvas = null;
        }
    }

    /**
     * Builds a 2D spatial grid for internal collision parts.
     * This allows O(1) lookup of relevant triangles instead of O(N).
     * @private
     */
    _buildLocalCollisionGrid() {
        if (!this.convexParts || this.convexParts.length === 0) return;

        const width = this.maxX - this.minX;
        const height = this.maxY - this.minY;
        const cols = Math.ceil(width / this.localGridSize);
        const rows = Math.ceil(height / this.localGridSize);

        // Initialize grid
        this.localCollisionGrid = new Array(cols).fill(null).map(() => new Array(rows).fill(null));

        for (const part of this.convexParts) {
            // Calculate AABB for this triangle/polygon part
            if (!part.aabb) part.aabb = getPolygonAABB(part);
            
            // Determine grid range
            const startCol = Math.floor((part.aabb.minX - this.minX) / this.localGridSize);
            const endCol = Math.floor((part.aabb.maxX - this.minX) / this.localGridSize);
            const startRow = Math.floor((part.aabb.minY - this.minY) / this.localGridSize);
            const endRow = Math.floor((part.aabb.maxY - this.minY) / this.localGridSize);

            const c1 = Math.max(0, startCol);
            const c2 = Math.min(cols - 1, endCol);
            const r1 = Math.max(0, startRow);
            const r2 = Math.min(rows - 1, endRow);

            // Add reference to all overlapping cells
            for (let c = c1; c <= c2; c++) {
                for (let r = r1; r <= r2; r++) {
                    if (!this.localCollisionGrid[c][r]) {
                        this.localCollisionGrid[c][r] = [];
                    }
                    this.localCollisionGrid[c][r].push(part);
                }
            }
        }
    }

    /**
     * Retrieves only the collision parts that overlap the given AABB.
     * Uses a run ID to deduplicate parts that span multiple cells without allocating a Set.
     */
    getRelevantConvexParts(aabb) {
        if (!this.localCollisionGrid) return this.convexParts;

        this.queryRunId++;
        const results = this._cachedRelevantParts;
        results.length = 0;

        const startCol = Math.max(0, Math.floor((aabb.minX - this.minX) / this.localGridSize));
        const endCol = Math.min(this.localCollisionGrid.length - 1, Math.floor((aabb.maxX - this.minX) / this.localGridSize));
        const startRow = Math.max(0, Math.floor((aabb.minY - this.minY) / this.localGridSize));
        const endRow = Math.min(this.localCollisionGrid[0].length - 1, Math.floor((aabb.maxY - this.minY) / this.localGridSize));

        for (let c = startCol; c <= endCol; c++) {
            for (let r = startRow; r <= endRow; r++) {
                const cell = this.localCollisionGrid[c][r];
                if (!cell) continue;
                for (let i = 0; i < cell.length; i++) {
                    const part = cell[i];
                    if (part.lastQueryId !== this.queryRunId) {
                        part.lastQueryId = this.queryRunId;
                        results.push(part);
                    }
                }
            }
        }
        return results;
    }

    renderStaticVisuals(ctx) {
        // --- MODIFIED: Rendering moved to WebGL pass in ShorelineGLRenderer ---
    }

    /**
     * Releases all cached visual resources back to the pool.
     */
    releaseCache() {
        if (this.visualCache) {
            window.CanvasManager.releaseCanvas(this.visualCache);
            this.visualCache = null;
        }
        if (this.visualChunks) {
            this.visualChunks.forEach(chunk => window.CanvasManager.releaseCanvas(chunk.canvas));
            this.visualChunks = null;
        }
        // --- FIX: DO NOT release ribbonData. It is required for WebGL correction math 
        // even when the 2D visual cache is released.
    }

    drawWorldSpace(ctx, worldToScreenScale, windDirection, viewport = null) {
        // --- FIX: Cache Throttling to prevent stampede on load ---
        // Initialize static throttling counters if they don't exist
        if (typeof Obstacle.visualCacheBudget === 'undefined') {
            Obstacle.visualCacheBudget = 3; // Max cache creations per frame
            Obstacle.currentFrameCacheCount = 0;
            Obstacle.lastFrameTime = 0;
        }

        // Detect new frame (simple time check, >10ms diff)
        const now = performance.now();
        if (now - Obstacle.lastFrameTime > 10) {
            Obstacle.currentFrameCacheCount = 0;
            Obstacle.lastFrameTime = now;
        }

        // --- FIX: Re-cache visuals if they were released by the WorldManager ---
        // Check budget before caching to avoid hitting browser canvas limits
        if (!this.visualCache && !this.visualChunks) {
            if (Obstacle.currentFrameCacheCount < Obstacle.visualCacheBudget) {
                this.cacheVisuals();
                Obstacle.currentFrameCacheCount++;
            }
            // If budget is exceeded, we fall through to renderStaticVisuals (direct draw)
            // This ensures the object is still visible, just not cached yet.
        }

        let didDraw = false;
        
        if (this.visualChunks) {
            const now = performance.now();
            const UNLOAD_TIMEOUT = 2000; // Unload chunk if off-screen for 2 seconds

            for (const chunk of this.visualChunks) {
                // Check Visibility
                const isVisible = !viewport || !(
                    chunk.x + chunk.width < viewport.x || 
                    chunk.x > viewport.x + viewport.width || 
                    chunk.y + chunk.height < viewport.y || 
                    chunk.y > viewport.y + viewport.height
                );

                if (isVisible) {
                    chunk.lastSeen = now;
                    // --- Streaming: Load on Demand ---
                    if (!chunk.canvas) {
                        if (Obstacle.currentFrameCacheCount < Obstacle.visualCacheBudget) {
                            this._loadChunk(chunk);
                            Obstacle.currentFrameCacheCount++;
                        }
                    }
                    if (chunk.canvas) {
                        if (!didDraw) { ctx.save(); didDraw = true; }
                        const drawX = chunk.x - (chunk.padding || 0);
                        const drawY = chunk.y - (chunk.padding || 0);
                        ctx.drawImage(chunk.canvas, drawX, drawY);
                    }

                    // --- NEW: Debug Chunk Borders ---
                    if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && DEBUG.DRAW_CHUNK_BORDERS) {
                        if (!didDraw) { ctx.save(); didDraw = true; }
                        ctx.strokeStyle = 'rgba(255, 0, 255, 0.8)'; // Magenta
                        ctx.lineWidth = 2 / worldToScreenScale;
                        ctx.strokeRect(chunk.x, chunk.y, chunk.width, chunk.height);
                    }
                } else {
                    // --- Streaming: Unload if Stale ---
                    if (chunk.canvas && (now - chunk.lastSeen > UNLOAD_TIMEOUT)) {
                        this._unloadChunk(chunk);
                    }
                }
            }
        } else if (this.visualCache) {
            if (!didDraw) { ctx.save(); didDraw = true; }
            ctx.drawImage(this.visualCache, this.visualCacheOffset.x, this.visualCacheOffset.y);
        } else {
            if (!didDraw) { ctx.save(); didDraw = true; }
            this.renderStaticVisuals(ctx);
        }

        if (!didDraw) return; // Nothing was drawn, so exit early.

        if (typeof DEBUG !== 'undefined' && DEBUG.ENABLED && DEBUG.DRAW_TRIANGULATION) {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
            ctx.lineWidth = 1;
            this.convexParts.forEach(triangle => {
                ctx.beginPath();
                ctx.moveTo(triangle[0].x, triangle[0].y);
                ctx.lineTo(triangle[1].x, triangle[1].y);
                ctx.lineTo(triangle[2].x, triangle[2].y);
                ctx.closePath();
                ctx.stroke();
            });
        }
        if (didDraw) ctx.restore();
    }
}

/**
 * --- NEW: RockCluster Class ---
 * Represents a group of rocks as a single entity for performance.
 * It manages multiple collision polygons (one for each rock) but counts as one object
 * in the spatial grid and world manager.
 */
class RockCluster extends Obstacle {
    constructor(x, y, count, spreadRadius) {
        // 1. Generate Sub-Rocks
        const subRocks = [];
        const allPoints = [];
        const combinedConvexParts = [];
        
        // Config for rock generation
        const minR = (typeof ROCK_MIN_RADIUS !== 'undefined') ? ROCK_MIN_RADIUS : 20;
        const maxR = (typeof ROCK_MAX_RADIUS !== 'undefined') ? ROCK_MAX_RADIUS : 100;

        for (let k = 0; k < count; k++) {
            const r = Math.sqrt(Math.random()) * spreadRadius;
            const theta = Math.random() * Math.PI * 2;
            const rx = x + Math.cos(theta) * r;
            const ry = y + Math.sin(theta) * r;
            const size = minR + Math.random() * (maxR - minR);

            // Generate rock shape
            // Note: We assume generateIrregularPolygon is globally available (utils.js)
            if (typeof generateIrregularPolygon === 'function') {
                const points = generateIrregularPolygon(rx, ry, size * 0.8, size * 1.2, 6, 0.8);
                // Ensure correct winding
                // (Assumes ensureClockwiseWinding is global)
                if (typeof ensureClockwiseWinding === 'function') ensureClockwiseWinding(points);
                
                subRocks.push({ points: points, x: rx, y: ry, radius: size });
                allPoints.push(...points);

                // Triangulate this rock and add to main physics parts
                // (Assumes triangulatePolygon is global)
                if (typeof triangulatePolygon === 'function') {
                    const parts = triangulatePolygon(points);
                    combinedConvexParts.push(...parts);
                }
            }
        }

        // 2. Calculate Convex Hull for the entire cluster (for ShorelineRenderer/AABB)
        // (Assumes getConvexHull is global)
        let hull = allPoints;
        if (typeof getConvexHull === 'function' && allPoints.length > 0) {
            hull = getConvexHull(allPoints);
        }

        // 3. Initialize Parent Obstacle
        // We pass the hull as the "shape" so the AABB and center are calculated correctly.
        // Rock color is usually defined in config, defaulting to #7f8c8d
        const rockColor = (typeof ROCK_COLOR !== 'undefined') ? ROCK_COLOR : '#7f8c8d';
        super(hull, rockColor, spreadRadius, spreadRadius, 'rock', false);

        // 4. Override Properties
        this.subRocks = subRocks;
        this.convexParts = combinedConvexParts; // Physics will now check against all sub-rocks
        this.isCluster = true;
        
        // Recalculate AABB strictly based on sub-rocks (super constructor does it based on hull, which is fine, but let's be sure)
        // (The super constructor logic is sufficient as it uses the hull points)

        // --- FIX: Rebuild Local Collision Grid ---
        // The parent constructor built the grid based on the 'hull' (convex wrapper).
        // We have replaced 'convexParts' with the detailed sub-rock geometry.
        // We must rebuild the grid so that physics checks and sparse rendering 
        // correctly identify the gaps between rocks.
        this._buildLocalCollisionGrid();
    }

    /**
     * Overrides render to draw each individual rock instead of the bounding hull.
     */
    renderStaticVisuals(ctx) {
        // --- MODIFIED: Rendering moved to WebGL pass in ShorelineGLRenderer ---
        // We no longer draw the static landmass in 2D. This prevents the 2D layer
        // from occluding the WebGL waves and foam.
    }

    drawWorldSpace(ctx, worldToScreenScale, windDirection, viewport = null) {
        super.drawWorldSpace(ctx, worldToScreenScale, windDirection, viewport);
    }
}

// Make globally available
window.RockCluster = RockCluster;