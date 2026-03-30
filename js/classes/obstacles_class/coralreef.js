/**
 * Represents a Coral Reef obstacle in the game.
 * This is a composite object, containing a rock base and multiple colorful coral shapes.
 */
class CoralReef {
    constructor(rockBasePoints, coralShapesConfig, baseRadiusX, baseRadiusY) {
        // The rock base is an Obstacle, which handles its AABB, convex parts, etc.
        this.rockBase = new Obstacle(rockBasePoints, ROCK_COLOR, baseRadiusX, baseRadiusY, 'coralReefBase');
        this.coralMetadata = []; // New: Stores {x, y, radius, color, type}
        this.type = 'coralReef'; // Overall type of this composite object

        // --- NEW: Add reference to perimeter for consistency with Obstacle class ---
        // This allows the renderer and collision system to treat the reef like any other hazard.
        this.outerPerimeterPoints = this.rockBase.outerPerimeterPoints;

        // Calculate an approximate center for the reef (from its rock base)
        this.x = this.rockBase.x;
        this.y = this.rockBase.y;
        this.maxDistanceToPerimeter = this.rockBase.maxDistanceToPerimeter;
        this.proximityRadius = this.rockBase.proximityRadius; // For broad-phase query

        // Generate coral shapes
        // --- NEW: Area-Based Quantity Scaling for 50% Coverage ---
        // The previous radius-ratio method was calibrated for much smaller corals.
        // We now calculate the actual area of the rock base to determine the count.
        let baseArea = 0;
        this.rockBase.convexParts.forEach(tri => {
            baseArea += 0.5 * Math.abs(tri[0].x * (tri[1].y - tri[2].y) + tri[1].x * (tri[2].y - tri[0].y) + tri[2].x * (tri[0].y - tri[1].y));
        });

        const avgRadius = (CORAL_SHAPE_MIN_DIAMETER + CORAL_SHAPE_MAX_DIAMETER) / 4;
        const avgCoralArea = Math.PI * Math.pow(avgRadius, 2);
        
        // Coverage target: 200% (2.0). 
        const idealNumCoral = (baseArea * 2.0) / avgCoralArea;
        const numCoral = Math.floor(getRandomArbitrary(Math.max(8, idealNumCoral * 0.8), Math.max(12, idealNumCoral * 1.2)));

        const rockBaseAABB = this.rockBase.getAABB();

        // Convert ocean blue hex to RGBA components for overlay
        const oceanR = parseInt(OCEAN_BLUE.substring(1, 3), 16);
        const oceanG = parseInt(OCEAN_BLUE.substring(3, 5), 16);
        const oceanB = parseInt(OCEAN_BLUE.substring(5, 7), 16);
        this.oceanOverlayFillStyle = `rgba(${oceanR}, ${oceanG}, ${oceanB}, ${SHOAL_COLOR_OVERLAY_ALPHA})`;

        let coralsPlaced = 0;
        let spawnAttempts = 0;
        const maxSpawnAttempts = numCoral * 10;

        while (coralsPlaced < numCoral && spawnAttempts < maxSpawnAttempts) {
            spawnAttempts++;
            const coralOuterRadius = getRandomArbitrary(CORAL_SHAPE_MIN_DIAMETER / 2, CORAL_SHAPE_MAX_DIAMETER / 2);
            const coralCenterX = getRandomArbitrary(rockBaseAABB.minX, rockBaseAABB.maxX);
            const coralCenterY = getRandomArbitrary(rockBaseAABB.minY, rockBaseAABB.maxY);
            
            // --- FIX: Ensure coral is centered on the rock base ---
            if (!isPointInPolygon({x: coralCenterX, y: coralCenterY}, this.outerPerimeterPoints)) continue;
            
            const randomHue = Math.floor(Math.random() * 360);
            const coralColor = `hsl(${randomHue}, 80%, 55%)`;
            
            // Variety Type IDs: 0: Star, 1: Serpentine, 2: Straight, 3: Sharp, 4: Bulbous, 5: Disks
            const typeID = Math.floor(Math.random() * 6);
            this.coralMetadata.push({ 
                x: coralCenterX, 
                y: coralCenterY, 
                radius: coralOuterRadius, 
                color: coralColor,
                type: typeID,
                layers: Math.floor(getRandomArbitrary(2, 7)), // 2 to 6 levels
                seed: Math.random() // Unique seed for layer rotations
            });
            coralsPlaced++;
        }

        this.visualCache = null;
        this.visualCacheOffset = { x: 0, y: 0 };
        this.cacheVisuals();
    }

    // AABB and convex parts for the CoralReef are based *only* on its rock base for collision detection.
    getAABB() { return this.rockBase.getAABB(); }
    get convexParts() { return this.rockBase.convexParts; }

    /**
     * --- NEW: Renderer Compatibility Proxies ---
     * These allow the CoralReef to behave like a standard Obstacle 
     * during the WebGL baking and rendering process.
     */
    generateRibbonData() {
        // Delegate the complex perimeter math to the internal rock base
        this.rockBase.generateRibbonData();
    }

    get ribbonData() {
        // Expose the rock base's ribbon data (normals, dists, indices) to the renderer
        return this.rockBase.ribbonData;
    }

    /**
     * Releases all cached visual resources.
     */
    releaseCache() {
        if (this.visualCache) {
            window.CanvasManager.releaseCanvas(this.visualCache);
            this.visualCache = null;
        }
        // Also release the internal rockBase cache since we render it manually and don't use its canvas
        if (this.rockBase && this.rockBase.releaseCache) {
            this.rockBase.releaseCache();
        }
    }

    cacheVisuals() {
        this.releaseCache(); // Safety: Release existing cache before recreating
        const aabb = this.rockBase.getAABB();
        const padding = 4;
        const width = (aabb.maxX - aabb.minX) + padding * 2;
        const height = (aabb.maxY - aabb.minY) + padding * 2;

        if (width <= 0 || height <= 0) return;

        this.visualCache = window.CanvasManager.getCanvas(width, height);
        this.visualCache.width = width;
        this.visualCache.height = height;
        const ctx = this.visualCache.getContext('2d');

        // Defensive check: If context creation fails, return early to prevent TypeError.
        // This can happen if canvas dimensions are invalid or excessively large.
        if (!ctx) {
            console.warn(`Failed to get 2D context for coral reef cache. Width: ${width}, Height: ${height}.`, this);
            return;
        }

        this.visualCacheOffset = { x: aabb.minX - padding, y: aabb.minY - padding };
        ctx.translate(-this.visualCacheOffset.x, -this.visualCacheOffset.y);
        
        this.renderStaticVisuals(ctx);
    }

    renderStaticVisuals(ctx) {
        // --- MODIFIED: Entire Coral Reef moved to WebGL pass in ShorelineGLRenderer ---
        // We no longer draw the static landmass in 2D. This prevents the 2D layer
        // from occluding the WebGL waves and significantly improves CPU performance.
    }

    drawWorldSpace(ctx, worldToScreenScale, windDirection) {
        // --- FIX: Re-cache visuals if they were released by the WorldManager ---
        if (!this.visualCache) {
            this.cacheVisuals();
        }
        if (this.visualCache) {
            ctx.drawImage(this.visualCache, this.visualCacheOffset.x, this.visualCacheOffset.y);
        }
    }
}
