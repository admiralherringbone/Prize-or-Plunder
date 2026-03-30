/**
 * Represents a Shoal obstacle in the game.
 * Extends the base Obstacle class to add a transparent overlay effect.
 */
class Shoal extends Obstacle {
    constructor(irregularPoints, baseRadiusX, baseRadiusY) {
        // Call the parent Obstacle's constructor with shoal-specific values.
        // The base color is ISLAND_COLOR, but it will be overlaid with transparent blue.
        super(irregularPoints, ISLAND_COLOR, baseRadiusX, baseRadiusY, 'shoal');

        // --- NEW: Generate a "Shallow" interior layer ---
        const sizeRef = Math.min(baseRadiusX, baseRadiusY);
        const shallowOffset = sizeRef * 0.2; // 20% inset = 80% of original size
        
        this.shallowVisualPoints = this._generateOffsetPolygon(this.originalIrregularPoints, -shallowOffset);
        
        if (this.shallowVisualPoints.length > 2) {
            const flatPoints = new Float32Array(this.shallowVisualPoints.length * 2);
            this.shallowVisualPoints.forEach((p, i) => { 
                flatPoints[i*2] = p.x; 
                flatPoints[i*2+1] = p.y; 
            });
            // Triangulate for WebGL solid rendering
            this.shallowIndices = earcut(flatPoints);
        }

        this.cacheVisuals();
    }

    renderStaticVisuals(ctx) {
        // --- MODIFIED: Rendering moved to WebGL pass in ShorelineGLRenderer ---
        // We no longer draw the static hazard in 2D. This prevents the 2D layer
        // from occluding the WebGL waves and foam.
    }
}