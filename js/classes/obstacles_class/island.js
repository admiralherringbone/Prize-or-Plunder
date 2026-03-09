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
        this.grassVisualPoints = this._generateGrassLayer();

        // --- NEW: Cache the visuals immediately ---
        this.cacheVisuals();
    }

    /**
     * Generates the points for the inner grass layer by scaling down the main island shape.
     * @private
     * @returns {Array<object>} An array of point objects {x, y} for the grass layer.
     */
    _generateGrassLayer() {
        const grassPoints = [];
        const scaleFactor = 0.8;

        // We need the center of the island's bounding box to scale towards
        const bboxCenterX = this.minX + (this.maxX - this.minX) / 2;
        const bboxCenterY = this.minY + (this.maxY - this.minY) / 2;

        this.originalIrregularPoints.forEach(p => {
            const translatedX = p.x - bboxCenterX;
            const translatedY = p.y - bboxCenterY;
            const scaledX = translatedX * scaleFactor;
            const scaledY = translatedY * scaleFactor;
            grassPoints.push({
                x: scaledX + bboxCenterX,
                y: scaledY + bboxCenterY
            });
        });

        ensureClockwiseWinding(grassPoints);
        return grassPoints;
    }

    /**
     * Renders the static layers (Sand, Grass) to the cache context.
     */
    renderStaticVisuals(ctx) {
        // Calculate center for scaling (same logic as _generateGrassLayer)
        const bboxCenterX = this.minX + (this.maxX - this.minX) / 2;
        const bboxCenterY = this.minY + (this.maxY - this.minY) / 2;

        // 1. Draw Wet Sand (Base Layer - 1.0x - Collision Boundary)
        ctx.fillStyle = this.strokeColor; // Darker sand color
        ctx.beginPath();
        this.outerPerimeterPoints.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.fill();

        // 2. Draw Dry Sand (Middle Layer - ~0.9x)
        ctx.save();
        ctx.translate(bboxCenterX, bboxCenterY);
        ctx.scale(0.9, 0.9); 
        ctx.translate(-bboxCenterX, -bboxCenterY);
        
        ctx.fillStyle = this.color; // Standard sand color
        ctx.beginPath();
        this.outerPerimeterPoints.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // 3. Draw Grass (Inner Layer - Pre-calculated at 0.8x)
        ctx.save();
        ctx.beginPath();
        this.grassVisualPoints.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.fillStyle = this.grassVisualColor;
        ctx.fill();
        ctx.strokeStyle = (typeof darkenColor === 'function') ? darkenColor(this.grassVisualColor, 10) : this.grassVisualColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    drawWorldSpace(ctx, worldToScreenScale, windDirection, shorelineRenderer = null, time = 0, viewport = null) {
        super.drawWorldSpace(ctx, worldToScreenScale, windDirection);

        // 4. Draw Wave Break (Over Island, Clipped to Wet Sand)
        if (shorelineRenderer) {
            shorelineRenderer.renderIsland(ctx, this, time, viewport, worldToScreenScale);
        }
    }
}