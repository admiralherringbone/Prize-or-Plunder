/**
 * Represents a Rock obstacle in the game.
 * Extends the base Obstacle class with specific properties for rocks.
 */
class Rock extends Obstacle {
    constructor(irregularPoints, baseRadiusX, baseRadiusY) {
        // Call the parent Obstacle's constructor with rock-specific values.
        // The color is always ROCK_COLOR and the type is always 'rock'.
        // The 'isSmall' parameter is not relevant for rocks, so we can omit it or pass a default.
        super(irregularPoints, ROCK_COLOR, baseRadiusX, baseRadiusY, 'rock');
        this.cacheVisuals();
    }

    drawWorldSpace(ctx, worldToScreenScale, windDirection, shorelineRenderer = null, time = 0, viewport = null) {
        super.drawWorldSpace(ctx, worldToScreenScale, windDirection);

        // Draw simplified wave break for rocks
        if (shorelineRenderer) {
            shorelineRenderer.renderIsland(ctx, this, time, viewport, worldToScreenScale);
        }
    }
}
