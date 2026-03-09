/**
 * Represents a Shoal obstacle in the game.
 * Extends the base Obstacle class to add a transparent overlay effect.
 */
class Shoal extends Obstacle {
    constructor(irregularPoints, baseRadiusX, baseRadiusY) {
        // Call the parent Obstacle's constructor with shoal-specific values.
        // The base color is ISLAND_COLOR, but it will be overlaid with transparent blue.
        super(irregularPoints, ISLAND_COLOR, baseRadiusX, baseRadiusY, 'shoal');
        this.cacheVisuals();
    }

    renderStaticVisuals(ctx) {
        // First, draw the base sandy bottom
        super.renderStaticVisuals(ctx);

        // Then, draw the transparent water effect over it
        ctx.save();
        ctx.beginPath();
        this.outerPerimeterPoints.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        const r = parseInt(OCEAN_BLUE.substring(1, 3), 16);
        const g = parseInt(OCEAN_BLUE.substring(3, 5), 16);
        const b = parseInt(OCEAN_BLUE.substring(5, 7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${SHOAL_COLOR_OVERLAY_ALPHA})`;
        ctx.fill();
        ctx.restore();
    }
}