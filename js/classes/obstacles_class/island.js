/**
 * Represents an Island obstacle in the game.
 * Extends the base Obstacle class to add island-specific visuals like a grass layer.
 */
class Island extends Obstacle {
    constructor(id, irregularPoints, baseRadiusX, baseRadiusY, isSmall) {
        // Call the parent Obstacle's constructor with island-specific values
        super(irregularPoints, ISLAND_COLOR, baseRadiusX, baseRadiusY, 'island', isSmall);
        this.id = id;

        // Island-specific properties for the grass layer
        this.grassVisualColor = ISLAND_GRASS_COLOR;
        
        // --- NEW: Generate layers using Contour Insetting instead of Scaling ---
        // Calculate dynamic offsets based on island size. 
        // We use the min radius as a baseline to prevent over-shrinking on thin islands.
        const sizeReference = Math.min(baseRadiusX, baseRadiusY);
        const drySandOffset = sizeReference * 0.05; // 5% inward
        const grassOffset = sizeReference * 0.1;    // 10% inward

        // Note: Clipper uses positive for expansion, negative for shrinking.
        this.drySandVisualPoints = this._generateOffsetPolygon(this.originalIrregularPoints, -drySandOffset);
        this.grassVisualPoints = this._generateOffsetPolygon(this.originalIrregularPoints, -grassOffset);

        // --- NEW: Triangulate inner layers for WebGL ---
        const flatten = (pts) => {
            const f = new Float32Array(pts.length * 2);
            pts.forEach((p, i) => { f[i*2] = p.x; f[i*2+1] = p.y; });
            return f;
        };
        if (this.drySandVisualPoints.length > 2) this.drySandIndices = earcut(flatten(this.drySandVisualPoints));
        if (this.grassVisualPoints.length > 2) this.grassIndices = earcut(flatten(this.grassVisualPoints));

        // --- NEW: Cache the visuals immediately ---
        this.cacheVisuals();
    }

    /**
     * Renders the static layers (Sand, Grass) to the cache context.
     */
    renderStaticVisuals(ctx) {
        // --- MODIFIED: Entire Island moved to WebGL pass in ShorelineGLRenderer ---
        // We no longer draw the static landmass in 2D. This prevents the 2D layer
        // from occluding the WebGL waves and significantly improves CPU performance.
    }

    drawWorldSpace(ctx, worldToScreenScale, windDirection, viewport = null) {
        // Pass viewport to parent for chunk culling
        super.drawWorldSpace(ctx, worldToScreenScale, windDirection, viewport);
    }
}