/**
 * Represents a Coral Reef obstacle in the game.
 * This is a composite object, containing a rock base and multiple colorful coral shapes.
 */
class CoralReef {
    constructor(rockBasePoints, coralShapesConfig, baseRadiusX, baseRadiusY) {
        // The rock base is an Obstacle, which handles its AABB, convex parts, etc.
        this.rockBase = new Obstacle(rockBasePoints, ROCK_COLOR, baseRadiusX, baseRadiusY, 'coralReefBase');
        this.coralShapes = []; // Array to hold individual coral shape polygons
        this.type = 'coralReef'; // Overall type of this composite object

        // Calculate an approximate center for the reef (from its rock base)
        this.x = this.rockBase.x;
        this.y = this.rockBase.y;
        this.maxDistanceToPerimeter = this.rockBase.maxDistanceToPerimeter;
        this.proximityRadius = this.rockBase.proximityRadius; // For broad-phase query

        // Generate coral shapes
        const numCoral = getRandomArbitrary(coralShapesConfig.min, coralShapesConfig.max);
        const rockBaseAABB = this.rockBase.getAABB();

        // Convert ocean blue hex to RGBA components for overlay
        const oceanR = parseInt(OCEAN_BLUE.substring(1, 3), 16);
        const oceanG = parseInt(OCEAN_BLUE.substring(3, 5), 16);
        const oceanB = parseInt(OCEAN_BLUE.substring(5, 7), 16);
        this.oceanOverlayFillStyle = `rgba(${oceanR}, ${oceanG}, ${oceanB}, ${SHOAL_COLOR_OVERLAY_ALPHA})`;

        for (let i = 0; i < numCoral; i++) {
            const coralOuterRadius = getRandomArbitrary(CORAL_SHAPE_MIN_DIAMETER / 2, CORAL_SHAPE_MAX_DIAMETER / 2);
            const coralCenterX = getRandomArbitrary(rockBaseAABB.minX + coralOuterRadius, rockBaseAABB.maxX - coralOuterRadius);
            const coralCenterY = getRandomArbitrary(rockBaseAABB.minY + coralOuterRadius, rockBaseAABB.maxY - coralOuterRadius);
            const numStarPoints = Math.floor(getRandomArbitrary(4, 33));
            const innerRadiusFactor = getRandomArbitrary(0.3, 0.7);
            let coralPoints = [];
            for (let j = 0; j < numStarPoints * 2; j++) {
                const angle = (j * Math.PI) / numStarPoints;
                const currentRadius = (j % 2 === 0) ? coralOuterRadius : coralOuterRadius * innerRadiusFactor;
                coralPoints.push({
                    x: coralCenterX + currentRadius * Math.cos(angle),
                    y: coralCenterY + currentRadius * Math.sin(angle)
                });
            }
            ensureClockwiseWinding(coralPoints);
            const randomHue = Math.floor(Math.random() * 360);
            const coralColor = `hsl(${randomHue}, 80%, 55%)`;
            this.coralShapes.push({ points: coralPoints, color: coralColor });
        }

        this.visualCache = null;
        this.visualCacheOffset = { x: 0, y: 0 };
        this.cacheVisuals();
    }

    // AABB and convex parts for the CoralReef are based *only* on its rock base for collision detection.
    getAABB() { return this.rockBase.getAABB(); }
    get convexParts() { return this.rockBase.convexParts; }

    cacheVisuals() {
        const aabb = this.rockBase.getAABB();
        const padding = 4;
        const width = (aabb.maxX - aabb.minX) + padding * 2;
        const height = (aabb.maxY - aabb.minY) + padding * 2;

        if (width <= 0 || height <= 0) return;

        this.visualCache = document.createElement('canvas');
        this.visualCache.width = width;
        this.visualCache.height = height;
        const ctx = this.visualCache.getContext('2d');

        this.visualCacheOffset = { x: aabb.minX - padding, y: aabb.minY - padding };
        ctx.translate(-this.visualCacheOffset.x, -this.visualCacheOffset.y);
        
        this.renderStaticVisuals(ctx);
    }

    renderStaticVisuals(ctx) {
        ctx.save();
        // Draw Rock Base
        this.rockBase.renderStaticVisuals(ctx);

        // Draw Coral Shapes
        this.coralShapes.forEach(coral => {
            ctx.beginPath();
            coral.points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.closePath();
            ctx.fillStyle = coral.color;
            ctx.fill();
            ctx.fillStyle = this.oceanOverlayFillStyle;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // Draw Overlay
        ctx.beginPath();
        this.rockBase.outerPerimeterPoints.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.fillStyle = this.oceanOverlayFillStyle;
        ctx.fill();
        ctx.restore();
    }

    drawWorldSpace(ctx, worldToScreenScale, windDirection) {
        if (this.visualCache) {
            ctx.drawImage(this.visualCache, this.visualCacheOffset.x, this.visualCacheOffset.y);
        }
    }
}
