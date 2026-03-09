/**
 * Represents a single, complete Square Rig assembly on a mast.
 * This class encapsulates all the logic for drawing the mast, yards, sails, and pennant.
 */
class SquareRig {
    /**
     * @param {Ship} ship - The ship this rig is attached to.
     * @param {object} mastConfig - The configuration for this specific mast from the blueprint.
     */
    constructor(ship, mastConfig) {
        this.ship = ship;
        this.mastConfig = mastConfig;
    }

    /**
     * New: Calculates the contribution of this rig to the ship's total rig durability.
     * @returns {number} The sum of the largest dimensions of all sails in this rig.
     */
    getDurabilityContribution() {
        let totalDimension = 0;
        // A simple square rig has one sail with a scale of 1.0.
        const sailScale = 1.0;
        totalDimension += (this.ship.shipWidth * 2) * sailScale;
        return totalDimension;
    }

    /**
     * Draws the main rigging (masts, sails) for the rig.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {number} windDirection - The current wind direction in radians.
     */
    drawRigging(ctx, zoomLevel, windDirection) {
        // This rig has no bowsprit, so the drawBowsprit method is simply omitted.

        ctx.save();
        // Translate to this specific mast's position before drawing.
        ctx.translate(this.mastConfig.x, this.mastConfig.y);

        // Draw Mast Base
        ctx.fillStyle = this.ship.sparDarkerColor;
        ctx.beginPath();
        ctx.arc(0, 0, this.ship.mastBaseRadius, 0, Math.PI * 2);
        ctx.fill();

        // The default square rig only has one sail.
        this._drawSquareSail(ctx, zoomLevel, windDirection, 1.0, 0); // Course Sail (100% size, at base)

        ctx.restore(); // Restore from the mast's local translation.
    }

    /**
     * Draws a complete square sail assembly (sail, yard, and lashings).
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {number} windDirection - The current wind direction in radians.
     * @param {number} verticalOffset - The vertical offset from the mast's base.
     * @private
     */
    _drawSquareSail(ctx, zoomLevel, windDirection, sailScale, verticalOffset) {
        // --- 1. Calculate Dimensions based on Scale ---
        const sailLength = (this.ship.shipWidth * 2) * sailScale;
        const sailGameWidthX = sailLength / 10;
        const squareYardLength = sailLength * 0.9;
        const sparThickness = this.ship.mastBaseRadius * sailScale;

        // --- 2. Generate Geometry On-the-Fly ---
        const sailResult = parseAndFlattenSvgPath(SAIL_SVG_DATA_CACHE, sailGameWidthX, sailLength, 20, true, true);
        const sailVisualPoints = sailResult.points;
        const squareYardOffsetX = this.ship.mastBaseRadius + (sparThickness / 2);
        const squareYardOffsetY = verticalOffset;
        const squareYardPoints = [
            { x: -sparThickness / 4, y: -squareYardLength / 2 }, { x:  sparThickness / 4, y: -squareYardLength / 2 },
            { x:  sparThickness / 2, y: 0 }, { x:  sparThickness / 4, y:  squareYardLength / 2 },
            { x: -sparThickness / 4, y:  squareYardLength / 2 }, { x: -sparThickness / 2, y: 0 },
            { x:  sparThickness / 2, y: -squareYardLength / 4 }, { x:  sparThickness / 2, y:  squareYardLength / 4 },
            { x: -sparThickness / 2, y:  squareYardLength / 4 }, { x: -sparThickness / 2, y: -squareYardLength / 4 }
        ];

        // --- 3. Draw the Assembly ---
        ctx.save();
        // DO NOT translate the context here. The vertical offset is applied directly
        // to the points of the sail and yard below. This prevents double-transformations.
        // We only need to rotate the assembly around the mast's origin.
        ctx.rotate(this.ship.sailCurrentRelativeAngle);

        // Draw the Sail
        let currentSailWidthScale = 1.0;
        if (this.ship.isSailOpen) {
            // Use the global utility function as defined in this class
            const effectiveSpeedMultiplier = getWindSpeedMultiplier(this.ship.angle, windDirection);
            // If reefed, cap the expansion at 50% of the potential billow.
            if (this.ship.isReefed) {
                currentSailWidthScale = 1 + (effectiveSpeedMultiplier * REEFING_SPEED_PENALTY);
            } else {
                currentSailWidthScale = 1 + effectiveSpeedMultiplier;
            }
        }
        const sailOffsetX = squareYardOffsetX - sailResult.straightEdgeGameX;
        ctx.fillStyle = this.ship.sailColor;
        ctx.beginPath();
        
        // Calculate bounds for damage mapping
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        sailVisualPoints.forEach((point, index) => {
            const xRelativeToStraightEdge = point.x - sailResult.straightEdgeGameX;
            const scaledXRelativeToStraightEdge = xRelativeToStraightEdge * currentSailWidthScale;
            const displayX = sailResult.straightEdgeGameX + scaledXRelativeToStraightEdge + sailOffsetX;
            const displayY = point.y + squareYardOffsetY;
            
            if (displayX < minX) minX = displayX; if (displayX > maxX) maxX = displayX;
            if (displayY < minY) minY = displayY; if (displayY > maxY) maxY = displayY;

            if (index === 0) { ctx.moveTo(displayX, displayY); }
            else { ctx.lineTo(displayX, displayY); }
        });
        ctx.closePath();
        
        // --- NEW: Draw Damage Holes ---
        if (this.ship.drawDamageHoles) {
            this.ship.drawDamageHoles(ctx, {minX, maxX, minY, maxY});
        }
        ctx.fill('evenodd'); // Use evenodd to punch holes

        ctx.save();
        ctx.clip();
        ctx.strokeStyle = this.ship.sailStrokeColor; // The color is a darker shade of the sail.
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Draw the Square-Yard
        ctx.fillStyle = this.ship.sparColor;
        ctx.beginPath();
        const p = squareYardPoints.map(pt => ({ x: pt.x + squareYardOffsetX, y: pt.y + squareYardOffsetY }));
        ctx.moveTo(p[0].x, p[0].y);
        ctx.lineTo(p[1].x, p[1].y);
        ctx.quadraticCurveTo(p[6].x, p[6].y, p[2].x, p[2].y);
        ctx.quadraticCurveTo(p[7].x, p[7].y, p[3].x, p[3].y);
        ctx.lineTo(p[4].x, p[4].y);
        ctx.quadraticCurveTo(p[8].x, p[8].y, p[5].x, p[5].y);
        ctx.quadraticCurveTo(p[9].x, p[9].y, p[0].x, p[0].y);
        ctx.closePath();
        ctx.fill();

        // Draw Square-Yard Lashings
        ctx.strokeStyle = STANDING_RIGGING_COLOR;
        ctx.lineWidth = (squareYardLength / 100);
        ctx.lineCap = 'round';
        const numLashings = 6;
        const spacing = squareYardLength / (numLashings + 1);
        for (let i = 1; i <= numLashings; i++) {
            const y = -squareYardLength / 2 + i * spacing;
            let minX = Infinity;
            let maxX = -Infinity;
            for (let j = 0; j < 6; j++) {
                const p1 = squareYardPoints[j];
                const p2 = squareYardPoints[(j + 1) % 6];
                if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
                    const intersectX = (y - p1.y) * (p2.x - p1.x) / (p2.y - p1.y) + p1.x;
                    minX = Math.min(minX, intersectX);
                    maxX = Math.max(maxX, intersectX);
                }
            }
            if (isFinite(minX) && isFinite(maxX)) {
                ctx.beginPath();
                ctx.moveTo(minX + squareYardOffsetX, y + squareYardOffsetY);
                ctx.lineTo(maxX + squareYardOffsetX, y + squareYardOffsetY);
                ctx.stroke();
            }
        }
        ctx.lineCap = 'butt';
        ctx.restore();
    }

    /**
     * Draws just the pennant and mast-top.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawPennantAndMastTop(ctx, zoomLevel) {
        ctx.save();
        ctx.rotate(this.ship.pennantCurrentRelativeAngle);

        const pennantBaseWidth = this.ship.pennantWidth;
        const pennantActualLength = this.ship.pennantLength;
        const numWavePoints = 10;
        const waveAmplitude = this.ship.pennantWaveAmplitude;
        const waveFrequency = this.ship.pennantWaveFrequency;
        const waveOffset = this.ship.pennantWaveOffset;
        
        const topEdgePoints = [{ x: 0, y: -pennantBaseWidth / 2 }];
        const bottomEdgePoints = [{ x: 0, y: pennantBaseWidth / 2 }];

        for (let i = 1; i <= numWavePoints; i++) {
            const ratio = i / numWavePoints;
            const currentX = -pennantActualLength * ratio;
            const currentSegmentWidth = pennantBaseWidth * (1 - ratio);
            const waveY = Math.sin((currentX / pennantActualLength * waveFrequency * Math.PI * 2) + waveOffset) * waveAmplitude * (1 - ratio * 0.5);
            topEdgePoints.push({ x: currentX, y: -currentSegmentWidth / 2 + waveY });
            bottomEdgePoints.push({ x: currentX, y: currentSegmentWidth / 2 + waveY });
        }

        topEdgePoints.push({ x: -pennantActualLength, y: 0 });
        bottomEdgePoints.push({ x: -pennantActualLength, y: 0 });

        ctx.fillStyle = this.ship.pennantColor;
        ctx.beginPath();
        ctx.moveTo(topEdgePoints[0].x, topEdgePoints[0].y);
        for (let i = 1; i < topEdgePoints.length; i++) { ctx.lineTo(topEdgePoints[i].x, topEdgePoints[i].y); }
        for (let i = bottomEdgePoints.length - 1; i >= 0; i--) { ctx.lineTo(bottomEdgePoints[i].x, bottomEdgePoints[i].y); }
        ctx.closePath();
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = this.ship.pennantStrokeColor;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        ctx.restore();

        // Draw Mast Top (over the pennant)
        ctx.fillStyle = this.ship.mastTopColor;
        ctx.beginPath();
        ctx.arc(0, 0, this.ship.mastBaseRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}