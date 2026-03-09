/**
 * Represents a complete Full-Rigged Ship assembly.
 * A full-rigged ship has three masts, all square-rigged, with a gaff sail on the mizzenmast.
 */
class FullRiggedShipRig {
    /**
     * @param {Ship} ship - The ship this rig is attached to.
     * @param {Array<object>} mastConfigs - An array of all mast configurations from the blueprint.
     */
    constructor(ship, mastConfigs) {
        this.ship = ship;
        // A full-rigged ship has three masts.
        this.foreMastConfig = mastConfigs.find(m => m.type === 'fore');
        this.mainMastConfig = mastConfigs.find(m => m.type === 'main');
        this.mizzenMastConfig = mastConfigs.find(m => m.type === 'mizzen');

        // --- New: Expose bowsprit geometry for the ShipGenerator ---
        // This is crucial for placing the Bowsprit Heel obstacle correctly.
        this.bowspritDeckStart = (this.ship.shipLength / 2) - (this.ship.shipLength / 6);
        this.bowspritWidth = this.ship.mastBaseRadius * 2;
        this.bowspritLength = this.ship.shipLength / 2;

        // --- New: Add a property to track the current gaff angle for smooth easing ---
        this.currentGaffAngle = 0;
    }

    /**
     * New: Calculates the contribution of this rig to the ship's total rig durability.
     * @returns {number} The sum of the largest dimensions of all sails in this rig.
     */
    getDurabilityContribution() {
        let totalDimension = 0;

        // Foremast square sails
        totalDimension += (this.ship.shipWidth * 2) * 1.0;
        totalDimension += (this.ship.shipWidth * 2) * 0.8;
        totalDimension += (this.ship.shipWidth * 2) * 0.64;

        // Mainmast square sails
        totalDimension += (this.ship.shipWidth * 2) * 1.0;
        totalDimension += (this.ship.shipWidth * 2) * 0.8;
        totalDimension += (this.ship.shipWidth * 2) * 0.64;

        // Mizzenmast square sails
        totalDimension += (this.ship.shipWidth * 2) * 1.0;
        totalDimension += (this.ship.shipWidth * 2) * 0.8;
        totalDimension += (this.ship.shipWidth * 2) * 0.64;

        // Mizzenmast gaff sail
        totalDimension += this.ship.shipLength / 3;

        // Jibs and Spritsail
        totalDimension += (this.bowspritDeckStart + this.bowspritLength - this.foreMastConfig.x) / 2; // Jib
        totalDimension += (this.bowspritDeckStart + this.bowspritLength - this.foreMastConfig.x) / 2; // Staysail
        totalDimension += this.ship.shipWidth * (0.75 * 2); // Spritsail

        return totalDimension;
    }

    /**
     * New: Gets the aft-most coordinate of the rig for centering calculations.
     * The full-rigged ship has a gaff sail on the mizzenmast.
     * @returns {number} The world-space X coordinate of the rig's aft-most point.
     */
    getAftBound() {
        const boomLength = this.ship.shipLength / 3;
        // The boom starts at the mast's edge and extends backward.
        const boomEnd = this.mizzenMastConfig.x - this.ship.mastBaseRadius - boomLength;
        return boomEnd;
    }

    /**
     * Draws the static bowsprit spar.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     */
    drawBowspritSpar(ctx, zoomLevel) {
        this._drawBowsprit(ctx, zoomLevel);
    }

    /**
     * Draws the animated sprit sail.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {number} windDirection - The current wind direction in radians.
     */
    drawSpritSail(ctx, zoomLevel, windDirection) {
        this._drawSpritsail(ctx, zoomLevel, windDirection);
    }

    /**
     * Draws the main rigging (masts, sails, jibs) for the rig.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {number} windDirection - The current wind direction in radians.
     */
    drawRigging(ctx, zoomLevel, windDirection) {
        // Layer 1: Mast Bases and Sails
        if (this.foreMastConfig) {
            this._drawMastBaseAndSails(ctx, zoomLevel, windDirection, this.foreMastConfig);
        }
        if (this.mainMastConfig) {
            this._drawMastBaseAndSails(ctx, zoomLevel, windDirection, this.mainMastConfig);
        }
        if (this.mizzenMastConfig) {
            this._drawMastBaseAndSails(ctx, zoomLevel, windDirection, this.mizzenMastConfig);
        }

        // Layer 2: Jibs (drawn after gaff sails, before stays)
        // --- FIX: Mirror jibs and staysails based on wind direction ---
        ctx.save();
        // If the gaff is swung to starboard (wind from port), flip the jibs.
        if (this.currentGaffAngle < 0) {
            ctx.scale(1, -1);
        }
        this._drawStaysail(ctx, zoomLevel, windDirection);
        this._drawJibSail(ctx, zoomLevel, windDirection);
        ctx.restore();

        // Layer 3: Stays
        this._drawAllStays(ctx, zoomLevel);

        // Layer 4: Pennants and Mast-Tops
        if (this.foreMastConfig) this._drawMastTopAssembly(ctx, zoomLevel, this.foreMastConfig);
        if (this.mainMastConfig) this._drawMastTopAssembly(ctx, zoomLevel, this.mainMastConfig);
        if (this.mizzenMastConfig) this._drawMastTopAssembly(ctx, zoomLevel, this.mizzenMastConfig);
    }

    /**
     * Draws the base and sails for a given mast.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {number} windDirection - The current wind direction in radians.
     * @param {object} mastConfig - The configuration for the mast to draw.
     * @private
     */
    _drawMastBaseAndSails(ctx, zoomLevel, windDirection, mastConfig) {
        ctx.save();
        ctx.translate(mastConfig.x, mastConfig.y);

        // If this is the mizzenmast, draw the gaff assembly first so it's layered underneath the square sails.
        if (mastConfig.type === 'mizzen') {
            let targetSailAngle = 0;
            if (this.ship.isSailOpen) {
                const shipAngle = this.ship.angle;
                let angleDiff = normalizeAngle(shipAngle - windDirection);
                if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;

                const absAngleOffWind = Math.abs(angleDiff);
                const swingRatio = absAngleOffWind / Math.PI;
                const maxRotation = Math.PI / 2.4; // 75 degrees
                const swingAmount = maxRotation * swingRatio;
                targetSailAngle = (angleDiff < 0) ? swingAmount : -swingAmount;
            }

            const EASE_FACTOR = 0.05;
            this.currentGaffAngle += (targetSailAngle - this.currentGaffAngle) * EASE_FACTOR;

            ctx.save();
            ctx.rotate(this.currentGaffAngle);
            ctx.save();
            if (this.currentGaffAngle < 0) { // Swung to port
                ctx.scale(1, -1); // Flip the sail vertically
            }
            this._drawGaffSailLower(ctx, zoomLevel, windDirection);
            this._drawGaffSailUpper(ctx, zoomLevel, windDirection);
            ctx.restore();
            // Draw spars last to appear on top
            this._drawBoom(ctx, zoomLevel);
            this._drawGaffSpar(ctx, zoomLevel);
            ctx.restore();
        }

        // Draw Mast Base
        ctx.fillStyle = this.ship.sparDarkerColor;
        ctx.beginPath();
        ctx.arc(0, 0, this.ship.mastBaseRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw the sails for the mast: a course sail, topsail, and topgallant.
        this._drawSquareSail(ctx, zoomLevel, windDirection, 1.0, 0); // Course
        this._drawSquareSail(ctx, zoomLevel, windDirection, 0.8, 0); // Topsail
        this._drawSquareSail(ctx, zoomLevel, windDirection, 0.64, 0); // Topgallant

        ctx.restore();
    }

    /**
     * Draws all stays for the rig. This is done in a single pass for correct layering.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawAllStays(ctx, zoomLevel) {
        ctx.strokeStyle = STANDING_RIGGING_COLOR;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';

        // Forestay (Bowsprit to Foremast)
        if (this.foreMastConfig) {
            const endPointX = this.bowspritDeckStart + this.bowspritLength;
            ctx.beginPath();
            ctx.moveTo(this.foreMastConfig.x, this.foreMastConfig.y);
            ctx.lineTo(endPointX, 0);
            ctx.stroke();
        }

        // Mainstay (Foremast to Mainmast)
        if (this.foreMastConfig && this.mainMastConfig) {
            ctx.beginPath();
            ctx.moveTo(this.mainMastConfig.x, this.mainMastConfig.y);
            ctx.lineTo(this.foreMastConfig.x, this.foreMastConfig.y);
            ctx.stroke();
        }

        // Mizzen-stay (Mainmast to Mizzenmast)
        if (this.mainMastConfig && this.mizzenMastConfig) {
            ctx.beginPath();
            ctx.moveTo(this.mizzenMastConfig.x, this.mizzenMastConfig.y);
            ctx.lineTo(this.mainMastConfig.x, this.mainMastConfig.y);
            ctx.stroke();
        }
    }

    /**
     * Draws the pennant and mast-top for a given mast.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {object} mastConfig - The configuration for the mast to draw.
     * @private
     */
    _drawMastTopAssembly(ctx, zoomLevel, mastConfig) {
        ctx.save();
        ctx.translate(mastConfig.x, mastConfig.y);
        this._drawPennantAndMastTop(ctx, zoomLevel);
        ctx.restore();
    }

    /**
     * New: Draws the spritsail, a square sail mounted under the bowsprit.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {number} windDirection - The current wind direction in radians.
     * @private
     */
    _drawSpritsail(ctx, zoomLevel, windDirection) {
        // The spritsail is centered on the bowsprit.
        const spritsailX = this.bowspritDeckStart + (this.bowspritLength / 2);

        ctx.save();
        ctx.translate(spritsailX, 0);

        // The sail's width should be the ship's beam. The _drawSquareSail method's
        // base width is `shipWidth * 2`, so we use a scale of 0.5 to achieve the target.
        this._drawSpritsailAssembly(ctx, zoomLevel, windDirection, 0.75, 0);

        ctx.restore();
    }

    /**
     * New: Draws a complete square sail assembly specifically for the spritsail.
     * This is a modified version of _drawSquareSail that does not depend on a mast.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {number} windDirection - The current wind direction in radians.
     * @param {number} sailScale - The scale of this sail relative to the base size.
     * @param {number} verticalOffset - The vertical offset from the mast's base.
     * @private
     */
    _drawSpritsailAssembly(ctx, zoomLevel, windDirection, sailScale, verticalOffset) {
        // The sail's width is based on the ship's beam and the provided scale.
        const sailLength = this.ship.shipWidth * (sailScale * 2);
        // The sail's depth (bow-stern) should be 1/10th of its width.
        const sailGameWidthX = sailLength / 10;
        const squareYardLength = sailLength * 0.9;
        const sparThickness = this.ship.mastBaseRadius * sailScale;

        const sailResult = parseAndFlattenSvgPath(SAIL_SVG_DATA_CACHE, sailGameWidthX, sailLength, 20, true, true);
        const sailVisualPoints = sailResult.points;
        // The spritsail is not attached to a mast, so its offset is 0.
        const squareYardOffsetX = 0;
        const squareYardOffsetY = verticalOffset;
        const squareYardPoints = [
            { x: -sparThickness / 4, y: -squareYardLength / 2 }, { x:  sparThickness / 4, y: -squareYardLength / 2 },
            { x:  sparThickness / 2, y: 0 }, { x:  sparThickness / 4, y:  squareYardLength / 2 },
            { x: -sparThickness / 4, y:  squareYardLength / 2 }, { x: -sparThickness / 2, y: 0 },
            { x:  sparThickness / 2, y: -squareYardLength / 4 }, { x:  sparThickness / 2, y:  squareYardLength / 4 },
            { x: -sparThickness / 2, y:  squareYardLength / 4 }, { x: -sparThickness / 2, y: -squareYardLength / 4 }
        ];

        ctx.save();
        ctx.rotate(this.ship.sailCurrentRelativeAngle);

        let currentSailWidthScale = 1.0;
        if (this.ship.isSailOpen) {
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
        sailVisualPoints.forEach((point, index) => {
            const xRelativeToStraightEdge = point.x - sailResult.straightEdgeGameX;
            const scaledXRelativeToStraightEdge = xRelativeToStraightEdge * currentSailWidthScale;
            const displayX = sailResult.straightEdgeGameX + scaledXRelativeToStraightEdge + sailOffsetX;
            const displayY = point.y + squareYardOffsetY;
            if (index === 0) { ctx.moveTo(displayX, displayY); }
            else { ctx.lineTo(displayX, displayY); }
        });
        ctx.closePath();
        ctx.fill();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = this.ship.sailStrokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = this.ship.sparColor;
        ctx.beginPath();
        const p = squareYardPoints.map(pt => ({ x: (pt.x + squareYardOffsetX), y: (pt.y + squareYardOffsetY) }));
        ctx.moveTo(p[0].x, p[0].y);
        ctx.lineTo(p[1].x, p[1].y);
        ctx.quadraticCurveTo(p[6].x, p[6].y, p[2].x, p[2].y);
        ctx.quadraticCurveTo(p[7].x, p[7].y, p[3].x, p[3].y);
        ctx.lineTo(p[4].x, p[4].y);
        ctx.quadraticCurveTo(p[8].x, p[8].y, p[5].x, p[5].y);
        ctx.quadraticCurveTo(p[9].x, p[9].y, p[0].x, p[0].y);
        ctx.closePath();
        ctx.fill();

        // --- New: Draw Spritsail Yard Lashings ---
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
        ctx.restore();
    }

    /**
     * Draws a complete square sail assembly.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {number} windDirection - The current wind direction in radians.
     * @param {number} sailScale - The scale of this sail relative to the base size.
     * @param {number} verticalOffset - The vertical offset from the mast's base.
     * @private
     */
    _drawSquareSail(ctx, zoomLevel, windDirection, sailScale, verticalOffset) {
        const sailLength = (this.ship.shipWidth * 2) * sailScale;
        const sailGameWidthX = sailLength / 10;
        const squareYardLength = sailLength * 0.9;
        const sparThickness = this.ship.mastBaseRadius * sailScale;

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

        ctx.save();
        ctx.rotate(this.ship.sailCurrentRelativeAngle);

        let currentSailWidthScale = 1.0;
        if (this.ship.isSailOpen) {
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
        if (this.ship.drawDamageHoles) this.ship.drawDamageHoles(ctx, {minX, maxX, minY, maxY});
        ctx.fill('evenodd');
        ctx.save();
        ctx.clip();
        ctx.strokeStyle = this.ship.sailStrokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = this.ship.sparColor;
        ctx.beginPath();
        const p = squareYardPoints.map(pt => ({ x: (pt.x + squareYardOffsetX), y: (pt.y + squareYardOffsetY) }));
        ctx.moveTo(p[0].x, p[0].y);
        ctx.lineTo(p[1].x, p[1].y);
        ctx.quadraticCurveTo(p[6].x, p[6].y, p[2].x, p[2].y);
        ctx.quadraticCurveTo(p[7].x, p[7].y, p[3].x, p[3].y);
        ctx.lineTo(p[4].x, p[4].y);
        ctx.quadraticCurveTo(p[8].x, p[8].y, p[5].x, p[5].y);
        ctx.quadraticCurveTo(p[9].x, p[9].y, p[0].x, p[0].y);
        ctx.closePath();
        ctx.fill();

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
     * Draws the pennant and mast-top.
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

        ctx.fillStyle = this.ship.mastTopColor;
        ctx.beginPath();
        ctx.arc(0, 0, this.ship.mastTopRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    /**
     * Draws the bowsprit.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawBowsprit(ctx, zoomLevel) {
        const tipWidth = this.bowspritWidth * 0.5;
        const bowspritPoints = [
            { x: 0, y: -this.bowspritWidth / 2 }, { x: 0, y: this.bowspritWidth / 2 },
            { x: this.bowspritLength, y: tipWidth / 2 }, { x: this.bowspritLength, y: -tipWidth / 2 },
        ];

        ctx.save();
        ctx.translate(this.bowspritDeckStart, 0);

        ctx.fillStyle = this.ship.sparColor;
        ctx.beginPath();
        bowspritPoints.forEach((point, index) => (index === 0) ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = STANDING_RIGGING_COLOR;
        ctx.lineCap = 'round';

        // --- New Proportional Lashing Logic ---
        const lashingLineWidth = (this.bowspritWidth / 20); // Proportional thickness
        ctx.lineWidth = lashingLineWidth;
        // New: Four brace groups. Two at the ends, and two equally spaced in the middle.
        // This divides the space between 0.1 and 0.9 into three equal segments.
        const groupPositions = [this.bowspritLength * 0.1, this.bowspritLength * 0.367, this.bowspritLength * 0.633, this.bowspritLength * 0.9];
        const lineSpacing = lashingLineWidth * 2; // Space between lashings is double their thickness

        groupPositions.forEach(groupCenterX => {
            const taperRatioAtGroup = groupCenterX / this.bowspritLength;
            const bowspritWidthAtGroup = this.bowspritWidth - (taperRatioAtGroup * (this.bowspritWidth - tipWidth));
            const availableWidth = bowspritWidthAtGroup;
            const singleLashingAndSpaceWidth = lashingLineWidth + lineSpacing;
            const numLinesInGroup = Math.max(3, Math.floor(availableWidth / singleLashingAndSpaceWidth));
            const totalGroupWidth = (numLinesInGroup * lashingLineWidth) + ((numLinesInGroup - 1) * lineSpacing);
            const startX = groupCenterX - (totalGroupWidth / 2);

            for (let i = 0; i < numLinesInGroup; i++) {
                const lineX = startX + (i * (lashingLineWidth + lineSpacing));
                const taperRatio = lineX / this.bowspritLength;
                const currentBowspritWidth = this.bowspritWidth - (taperRatio * (this.bowspritWidth - tipWidth));
                
                ctx.beginPath();
                ctx.moveTo(lineX, -currentBowspritWidth / 2);
                ctx.lineTo(lineX, currentBowspritWidth / 2);
                ctx.stroke();
            }
        });

        ctx.restore();
    }

    /**
     * Draws the Jib sail.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawJibSail(ctx, zoomLevel, windDirection) {
        const lashingLineWidthWorld = 1;
        const linesPerGroup = 5;
        const totalGroupWidthWorld = linesPerGroup * lashingLineWidthWorld;
        const forwardGroupCenter = this.bowspritLength * 0.9;
        const forwardGroupFrontEdge = forwardGroupCenter + (totalGroupWidthWorld / 2);
        const sailEndPointX = this.bowspritDeckStart + forwardGroupFrontEdge;
        const jibSailLength = (sailEndPointX - this.foreMastConfig.x) / 2;
        const sailStartPointX = sailEndPointX - jibSailLength;

        const minWidth = jibSailLength * 0.15;
        const maxWidth = jibSailLength * 0.30;
        let currentWidth = minWidth;

        if (this.ship.isSailOpen) {
            const effectiveSpeedMultiplier = this.ship.getWindSpeedMultiplier(this.ship.angle, windDirection);
            // If reefed, cap the expansion.
            if (this.ship.isReefed) {
                currentWidth = minWidth + (maxWidth - minWidth) * (effectiveSpeedMultiplier * REEFING_SPEED_PENALTY);
            } else {
                currentWidth = minWidth + (maxWidth - minWidth) * effectiveSpeedMultiplier;
            }
        }

        const jibSail = parseAndFlattenSvgPath(
            JIB_SAIL_SVG_DATA_CACHE,
            jibSailLength,
            currentWidth,
            20, false, true
        ).points;

        ctx.save();
        const sailCenterPointX = sailStartPointX + (jibSailLength / 2);
        const sailCenterPointY = -(currentWidth / 2);
        ctx.translate(sailCenterPointX, sailCenterPointY);

        ctx.fillStyle = this.ship.sailColor;
        ctx.beginPath();
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        jibSail.forEach((point, index) => {
            if (point.x < minX) minX = point.x; if (point.x > maxX) maxX = point.x;
            if (point.y < minY) minY = point.y; if (point.y > maxY) maxY = point.y;
            (index === 0) ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)
        });
        ctx.closePath();
        if (this.ship.drawDamageHoles) this.ship.drawDamageHoles(ctx, {minX, maxX, minY, maxY});
        ctx.fill('evenodd');

        ctx.save();
        ctx.clip();
        ctx.strokeStyle = this.ship.sailStrokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }

    /**
     * Draws the Staysail.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawStaysail(ctx, zoomLevel, windDirection) {
        const lashingLineWidthWorld = 1;
        const linesPerGroup = 5;
        const totalGroupWidthWorld = linesPerGroup * lashingLineWidthWorld;
        const forwardGroupCenter = this.bowspritLength * 0.9;
        const forwardGroupFrontEdge = forwardGroupCenter + (totalGroupWidthWorld / 2);
        const mainJibEndPointX = this.bowspritDeckStart + forwardGroupFrontEdge;
        const jibSailLength = (mainJibEndPointX - this.foreMastConfig.x) / 2;

        const middleGroupCenter = this.bowspritLength * 0.633;
        const middleGroupFrontEdge = middleGroupCenter + (totalGroupWidthWorld / 2);
        const sailEndPointX = this.bowspritDeckStart + middleGroupFrontEdge;
        const sailStartPointX = sailEndPointX - jibSailLength;

        const minWidth = jibSailLength * 0.15;
        const maxWidth = jibSailLength * 0.30;
        let currentWidth = minWidth;

        if (this.ship.isSailOpen) {
            const effectiveSpeedMultiplier = this.ship.getWindSpeedMultiplier(this.ship.angle, windDirection);
            // If reefed, cap the expansion.
            if (this.ship.isReefed) {
                currentWidth = minWidth + (maxWidth - minWidth) * (effectiveSpeedMultiplier * REEFING_SPEED_PENALTY);
            } else {
                currentWidth = minWidth + (maxWidth - minWidth) * effectiveSpeedMultiplier;
            }
        }

        const jibSail = parseAndFlattenSvgPath(
            JIB_SAIL_SVG_DATA_CACHE,
            jibSailLength,
            currentWidth,
            20, false, true
        ).points;

        ctx.save();
        const sailCenterPointX = sailStartPointX + (jibSailLength / 2);
        const sailCenterPointY = -(currentWidth / 2);
        ctx.translate(sailCenterPointX, sailCenterPointY);

        ctx.fillStyle = this.ship.sailColor;
        ctx.beginPath();
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        jibSail.forEach((point, index) => {
            if (point.x < minX) minX = point.x; if (point.x > maxX) maxX = point.x;
            if (point.y < minY) minY = point.y; if (point.y > maxY) maxY = point.y;
            (index === 0) ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)
        });
        ctx.closePath();
        if (this.ship.drawDamageHoles) this.ship.drawDamageHoles(ctx, {minX, maxX, minY, maxY});
        ctx.fill('evenodd');

        ctx.save();
        ctx.clip();
        ctx.strokeStyle = this.ship.sailStrokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }

    /**
     * Draws the boom.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawBoom(ctx, zoomLevel) {
        const boomLength = this.ship.shipLength / 3; // New 1/3 length
        const boomWidth = this.ship.mastBaseRadius;
        const tipWidth = boomWidth * 0.5;
        const boomPoints = [
            { x: 0, y: -boomWidth / 2 }, { x: 0, y:  boomWidth / 2 },
            { x: -boomLength, y:  tipWidth / 2 }, { x: -boomLength, y: -tipWidth / 2 },
        ];

        ctx.save();
        const boomBaseX = -this.ship.mastBaseRadius;
        ctx.translate(boomBaseX, 0);

        ctx.fillStyle = this.ship.sparColor;
        ctx.beginPath();
        boomPoints.forEach((point, index) => (index === 0) ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = STANDING_RIGGING_COLOR;
        ctx.lineWidth = (boomWidth / 5);
        ctx.lineCap = 'round';

        const numBraces = 6;
        const spacing = boomLength / (numBraces + 1);

        for (let i = 1; i <= numBraces; i++) {
            const braceX = -i * spacing;
            const taperRatio = Math.abs(braceX) / boomLength;
            const currentBoomWidth = boomWidth - (taperRatio * (boomWidth - tipWidth));

            ctx.beginPath();
            ctx.moveTo(braceX, -currentBoomWidth / 2);
            ctx.lineTo(braceX, currentBoomWidth / 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    /**
     * Draws the lower gaff sail.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawGaffSailLower(ctx, zoomLevel, windDirection) {
        const finalSailWidth = this.ship.shipLength / 3; // New 1/3 length

        // --- New: Dynamic Sail Billow Calculation ---
        const minBillow = finalSailWidth * 0.10;
        const maxBillow = finalSailWidth * 0.15;
        let currentBillow = minBillow;

        if (this.ship.isSailOpen) {
            const effectiveSpeedMultiplier = this.ship.getWindSpeedMultiplier(this.ship.angle, windDirection);
            // If reefed, cap the expansion.
            if (this.ship.isReefed) {
                currentBillow = minBillow + (maxBillow - minBillow) * (effectiveSpeedMultiplier * REEFING_SPEED_PENALTY);
            } else {
                currentBillow = minBillow + (maxBillow - minBillow) * effectiveSpeedMultiplier;
            }
        }

        const unitSail = parseAndFlattenSvgPath(GAFF_SAIL_LOWER_SVG_DATA_CACHE, 1, 1, 20, false, false).points;

        ctx.save();
        const boomStartX = -this.ship.mastBaseRadius;
        ctx.translate(boomStartX - finalSailWidth / 2, 0);
        ctx.scale(-1, 1);
        ctx.scale(finalSailWidth, currentBillow);
        ctx.translate(0, -0.5);

        ctx.fillStyle = darkenColor(this.ship.sailColor, 20);
        ctx.beginPath();
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        unitSail.forEach((point, index) => {
            if (point.x < minX) minX = point.x; if (point.x > maxX) maxX = point.x;
            if (point.y < minY) minY = point.y; if (point.y > maxY) maxY = point.y;
            (index === 0) ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)
        });
        ctx.closePath();
        if (this.ship.drawDamageHoles) this.ship.drawDamageHoles(ctx, {minX, maxX, minY, maxY});
        ctx.fill('evenodd');

        ctx.restore();
    }

    /**
     * Draws the upper gaff sail.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawGaffSailUpper(ctx, zoomLevel, windDirection) {
        const finalSailWidth = this.ship.shipLength / 3; // New 1/3 length

        // --- New: Dynamic Sail Billow Calculation ---
        const minBillow = finalSailWidth * 0.10;
        const maxBillow = finalSailWidth * 0.15;
        let currentBillow = minBillow;

        if (this.ship.isSailOpen) {
            const effectiveSpeedMultiplier = this.ship.getWindSpeedMultiplier(this.ship.angle, windDirection);
            // If reefed, cap the expansion.
            if (this.ship.isReefed) {
                currentBillow = minBillow + (maxBillow - minBillow) * (effectiveSpeedMultiplier * REEFING_SPEED_PENALTY);
            } else {
                currentBillow = minBillow + (maxBillow - minBillow) * effectiveSpeedMultiplier;
            }
        }

        const upperSailPoints = parseAndFlattenSvgPath(GAFF_SAIL_UPPER_SVG_DATA_CACHE, finalSailWidth, currentBillow, 20, false, false).points;

        ctx.save();
        const boomStartX = -this.ship.mastBaseRadius;
        ctx.translate(boomStartX - finalSailWidth / 2, -currentBillow / 2);

        ctx.fillStyle = this.ship.sailColor;
        ctx.beginPath();
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        upperSailPoints.forEach((p, i) => {
            const px = -p.x, py = -p.y;
            if (px < minX) minX = px; if (px > maxX) maxX = px;
            if (py < minY) minY = py; if (py > maxY) maxY = py;
            (i === 0) ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
        });
        ctx.closePath();
        if (this.ship.drawDamageHoles) this.ship.drawDamageHoles(ctx, {minX, maxX, minY, maxY});
        ctx.fill('evenodd');

        ctx.save();
        ctx.clip();
        ctx.strokeStyle = this.ship.sailStrokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }

    /**
     * Draws the gaff spar.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawGaffSpar(ctx, zoomLevel) {
        const gaffLength = (this.ship.shipLength / 3) * (3 / 5); // New 1/3 length
        const gaffWidth = this.ship.mastBaseRadius * 0.5;
        const tipWidth = gaffWidth * 0.5;
        const gaffPoints = [
            { x: 0, y: -gaffWidth / 2 }, { x: 0, y:  gaffWidth / 2 },
            { x: -gaffLength, y:  tipWidth / 2 }, { x: -gaffLength, y: -tipWidth / 2 },
        ];

        ctx.save();
        const sparBaseX = -this.ship.mastBaseRadius;
        ctx.translate(sparBaseX, 0);

        ctx.fillStyle = SPAR_COLOR;
        ctx.beginPath();
        gaffPoints.forEach((point, index) => (index === 0) ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = STANDING_RIGGING_COLOR;
        ctx.lineWidth = (gaffWidth / 5);
        ctx.lineCap = 'round';

        const numBraces = 4;
        const spacing = gaffLength / (numBraces + 1);

        for (let i = 1; i <= numBraces; i++) {
            const braceX = -i * spacing;
            const taperRatio = Math.abs(braceX) / gaffLength;
            const currentSparWidth = gaffWidth - (taperRatio * (gaffWidth - tipWidth));

            ctx.beginPath();
            ctx.moveTo(braceX, -currentSparWidth / 2);
            ctx.lineTo(braceX, currentSparWidth / 2);
            ctx.stroke();
        }

        ctx.restore();
    }
}