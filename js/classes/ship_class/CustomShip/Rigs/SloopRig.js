/**
 * Represents a complete Sloop Rig assembly.
 * This class encapsulates all the logic for drawing the bowsprit, jibs,
 * and the main mast with its gaff and square sails.
 */
class SloopRig {
    /**
     * @param {Ship} ship - The ship this rig is attached to.
     * @param {object} mastConfig - The configuration for the main mast from the blueprint.
     */
    constructor(ship, mastConfig) {
        this.ship = ship;
        this.mastConfig = mastConfig; // Sloop rig is always on one mast

        // --- New: Expose bowsprit geometry for the ShipGenerator ---
        // This is crucial for placing the Bowsprit Heel obstacle correctly.
        this.bowspritDeckStart = (this.ship.shipLength / 2) - (this.ship.shipLength / 4);
        this.bowspritWidth = this.ship.mastBaseRadius * 2;
        this.bowspritLength = this.ship.shipLength;

        // --- New: Add a property to track the current gaff angle for smooth easing ---
        this.currentGaffAngle = 0;
    }

    /**
     * New: Calculates the contribution of this rig to the ship's total rig durability.
     * @returns {number} The sum of the largest dimensions of all sails in this rig.
     */
    getDurabilityContribution() {
        let totalDimension = 0;

        // Square sails (Course and Topsail)
        totalDimension += (this.ship.shipWidth * 2) * 1.0; // Course Sail
        totalDimension += (this.ship.shipWidth * 2) * 0.8; // Topsail

        // Gaff sail
        totalDimension += this.ship.shipLength; // Gaff sail length is ship length

        // Jibs
        const lashingLineWidthWorld = 1;
        const linesPerGroup = 5;
        const totalGroupWidthWorld = linesPerGroup * lashingLineWidthWorld;
        const forwardGroupCenter = this.bowspritLength * 0.9;
        const forwardGroupFrontEdge = forwardGroupCenter + (totalGroupWidthWorld / 2);
        const sailEndPointX = this.bowspritDeckStart + forwardGroupFrontEdge;
        totalDimension += (sailEndPointX - this.mastConfig.x) / 2; // Jib
        totalDimension += (sailEndPointX - this.mastConfig.x) / 2; // Staysail

        return totalDimension;
    }

    /**
     * New: Gets the aft-most coordinate of the rig for centering calculations.
     * The sloop has a very long gaff sail boom.
     * @returns {number} The world-space X coordinate of the rig's aft-most point.
     */
    getAftBound() {
        const boomLength = this.ship.shipLength;
        // The boom starts at the mast's edge and extends backward.
        const boomEnd = this.mastConfig.x - this.ship.mastBaseRadius - boomLength;
        return boomEnd;
    }

    /**
     * Draws the bowsprit for the rig.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {function} scalePoints - A helper function to scale points by the zoom level.
     */
    drawBowsprit(ctx, zoomLevel) {
        this._drawBowsprit(ctx, zoomLevel);
    }

    /**
     * Draws the main rigging (masts, sails, jibs) for the rig.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {number} windDirection - The current wind direction in radians.
     */
    drawRigging(ctx, zoomLevel, windDirection) {
        // --- New: Calculate the TARGET angle for the gaff sail ---
        let targetSailAngle = 0; // Default to 0 degrees (neutral position)
        if (this.ship.isSailOpen) {
            const shipAngle = this.ship.angle;
            let angleDiff = normalizeAngle(shipAngle - windDirection);

            // --- FIX: Determine which side the wind is on to direct the swing ---
            // A positive angleDiff (0 to PI) means the wind is on the port side.
            // A negative angleDiff (0 to -PI) means the wind is on the starboard side.
            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI; // Normalize to -PI to PI range
            
            // --- FIX: Interpolate swing angle based on how far off the wind the ship is. ---
            // This creates a more realistic swing, similar to the square sails.
            const absAngleOffWind = Math.abs(angleDiff); // 0 (upwind) to PI (downwind)
            // The swing amount is proportional to how far from upwind we are.
            const swingRatio = absAngleOffWind / Math.PI; // 0.0 to 1.0
            const maxRotation = Math.PI / 2.4; // 75 degrees
            const swingAmount = maxRotation * swingRatio;
            // The direction of swing is determined by which side the wind is on.
            targetSailAngle = (angleDiff < 0) ? swingAmount : -swingAmount;
        }

        // --- New: Ease the current angle towards the target angle for a smooth transition ---
        const EASE_FACTOR = 0.05; // Adjust this value for faster/slower easing
        this.currentGaffAngle += (targetSailAngle - this.currentGaffAngle) * EASE_FACTOR;

        // --- New: Rotate the entire gaff assembly around the mast ---
        ctx.save();
        const scaledMastX = this.mastConfig.x;
        const scaledMastY = this.mastConfig.y;
        ctx.translate(scaledMastX, scaledMastY);
        // Use the new, eased angle for rotation
        ctx.rotate(this.currentGaffAngle);
        ctx.translate(-scaledMastX, -scaledMastY);

        // 1. Draw the gaff sails (mainsail) - now rotated
        this._drawSloopMainMast(ctx, zoomLevel, windDirection);
        ctx.restore(); // Restore from gaff sail rotation

        // --- FIX: Draw square sails and mast base separately to avoid gaff rotation ---
        ctx.save();
        ctx.translate(this.mastConfig.x, this.mastConfig.y);
        // Draw Mast Base
        ctx.fillStyle = this.ship.sparDarkerColor;
        ctx.beginPath();
        ctx.arc(0, 0, this.ship.mastBaseRadius, 0, Math.PI * 2);
        ctx.fill();
        // Draw the Square Sails
        this._drawSquareSail(ctx, zoomLevel, windDirection, 1.0, 0); // Course Sail
        this._drawTopsail(ctx, zoomLevel, windDirection);
        ctx.restore();

        // --- Draw static components (jibs and stays) ---
        // --- FIX: Mirror jibs and staysails based on wind direction ---
        ctx.save();
        // If the gaff is swung to starboard (wind from port), flip the jibs.
        if (this.currentGaffAngle < 0) {
            ctx.scale(1, -1);
        }
        this._drawStaysail(ctx, zoomLevel, windDirection);
        this._drawJibSail(ctx, zoomLevel, windDirection);
        ctx.restore();
        this._drawForestay(ctx, zoomLevel);
    }    

    /**
     * Draws the specific main mast rigging for a Sloop.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {number} windDirection - The current wind direction in radians.
     * @private
     */
    _drawSloopMainMast(ctx, zoomLevel, windDirection) {
        ctx.save();
        ctx.translate(this.mastConfig.x, this.mastConfig.y);

        // --- FIX: Flip the sail based on the swing direction ---
        ctx.save();
        if (this.currentGaffAngle < 0) { // Swung to port
            ctx.scale(1, -1); // Flip the sail vertically
        }
        this._drawGaffSailLower(ctx, zoomLevel, windDirection);
        this._drawGaffSailUpper(ctx, zoomLevel, windDirection);
        ctx.restore();

        // Draw the static spars last so they appear on top of the sail
        this._drawBoom(ctx, zoomLevel);
        this._drawGaffSpar(ctx, zoomLevel);

        ctx.restore(); // Restore from the mast's local translation.
    }

    /**
     * Draws the bowsprit for sloop-rigged ships.
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
        const lashingLineWidth = (this.bowspritWidth / 20);
        ctx.lineWidth = lashingLineWidth;
        const groupPositions = [this.bowspritLength * 0.1, this.bowspritLength * 0.5, this.bowspritLength * 0.9];
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
     * Draws the forestay for sloop-rigged ships.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawForestay(ctx, zoomLevel) {
        const lashingLineWidthWorld = 1;
        const linesPerGroup = 5;
        const totalGroupWidthWorld = linesPerGroup * lashingLineWidthWorld;
        const forwardGroupCenter = this.bowspritLength * 0.9;
        const forwardGroupFrontEdge = forwardGroupCenter + (totalGroupWidthWorld / 2);
        const endPointX = this.bowspritDeckStart + forwardGroupFrontEdge;
        const endPoint = { x: endPointX, y: 0 };
        
        ctx.strokeStyle = STANDING_RIGGING_COLOR;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(0, 0); // Start at the mast's translated origin
        ctx.lineTo(endPoint.x - this.mastConfig.x, endPoint.y - 0); // End point relative to mast
        ctx.stroke();
    }

    /**
     * Draws the Jib sail for sloop-rigged ships.
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
        const jibSailLength = (sailEndPointX - this.mastConfig.x) / 2;
        const sailStartPointX = sailEndPointX - jibSailLength;

        // --- New: Dynamic Sail Width Calculation ---
        const minWidth = jibSailLength * 0.15; // 15% of length when no wind
        const maxWidth = jibSailLength * 0.30; // 30% of length at full wind
        let currentWidth = minWidth;

        if (this.ship.isSailOpen) {
            // Use the square sail's performance curve for expansion.
            const effectiveSpeedMultiplier = this.ship.getWindSpeedMultiplier(this.ship.angle, windDirection);
            // Interpolate the width between min and max based on the wind multiplier.
            currentWidth = minWidth + (maxWidth - minWidth) * effectiveSpeedMultiplier;
        }

        // The SVG is designed to be 100 units long and 100 units wide.
        // We scale it to the desired length and the dynamically calculated width.
        const jibSailPoints = parseAndFlattenSvgPath(
            JIB_SAIL_SVG_DATA_CACHE,
            jibSailLength, // Scale X to match the sail's length
            currentWidth,  // Scale Y to the dynamic billow width
            20, false, true
        ).points;

        ctx.save();
        const sailCenterPointX = sailStartPointX + (jibSailLength / 2);
        const sailCenterPointY = -(currentWidth / 2);
        ctx.translate(sailCenterPointX, sailCenterPointY);

        ctx.fillStyle = this.ship.sailColor;
        ctx.beginPath();
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        jibSailPoints.forEach((point, index) => {
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
     * Draws the second Jib sail (Staysail) for sloop-rigged ships.
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
        const jibSailLength = (mainJibEndPointX - this.mastConfig.x) / 2;

        const middleGroupCenter = this.bowspritLength * 0.5;
        const middleGroupFrontEdge = middleGroupCenter + (totalGroupWidthWorld / 2);
        const sailEndPointX = this.bowspritDeckStart + middleGroupFrontEdge;
        const sailStartPointX = sailEndPointX - jibSailLength;

        // --- New: Dynamic Sail Width Calculation ---
        const minWidth = jibSailLength * 0.15;
        const maxWidth = jibSailLength * 0.30;
        let currentWidth = minWidth;

        if (this.ship.isSailOpen) {
            const effectiveSpeedMultiplier = this.ship.getWindSpeedMultiplier(this.ship.angle, windDirection);
            currentWidth = minWidth + (maxWidth - minWidth) * effectiveSpeedMultiplier;
        }

        const jibSailPoints = parseAndFlattenSvgPath(
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
        jibSailPoints.forEach((point, index) => {
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
     * Draws the boom and its braces for the Sloop Rig.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawBoom(ctx, zoomLevel) {
        const boomLength = this.ship.shipLength;
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
        ctx.lineWidth = (boomWidth / 5); // Proportional thickness
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
     * Draws the main part of the gaff sail for the Sloop Rig.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawGaffSailLower(ctx, zoomLevel, windDirection) {
        const finalSailWidth = this.ship.shipLength;

        // --- New: Dynamic Sail Billow Calculation ---
        const minBillow = finalSailWidth * 0.10;
        const maxBillow = finalSailWidth * 0.15;
        let currentBillow = minBillow;

        if (this.ship.isSailOpen) {
            const effectiveSpeedMultiplier = this.ship.getWindSpeedMultiplier(this.ship.angle, windDirection);
            currentBillow = minBillow + (maxBillow - minBillow) * effectiveSpeedMultiplier;
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
     * Draws the upper visual part on the gaff sail.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawGaffSailUpper(ctx, zoomLevel, windDirection) {
        const finalSailWidth = this.ship.shipLength;

        // --- New: Dynamic Sail Billow Calculation ---
        const minBillow = finalSailWidth * 0.10;
        const maxBillow = finalSailWidth * 0.15;
        let currentBillow = minBillow;

        if (this.ship.isSailOpen) {
            const effectiveSpeedMultiplier = this.ship.getWindSpeedMultiplier(this.ship.angle, windDirection);
            currentBillow = minBillow + (maxBillow - minBillow) * effectiveSpeedMultiplier;
        }

        const upperSailPoints = parseAndFlattenSvgPath(GAFF_SAIL_UPPER_SVG_DATA_CACHE, finalSailWidth, currentBillow, 20, false, false).points;

        ctx.save();
        const boomStartX = -this.ship.mastBaseRadius;
        // Translate to the center of where the sail should be.
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
     * Draws the gaff spar, which sits on top of the gaff sail assembly.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawGaffSpar(ctx, zoomLevel) {
        const gaffLength = this.ship.shipLength * (3 / 5);
        const gaffWidth = this.ship.mastBaseRadius * 0.5;
        const tipWidth = gaffWidth * 0.5;
        const gaffPoints = [
            { x: 0, y: -gaffWidth / 2 }, { x: 0, y:  gaffWidth / 2 },
            { x: -gaffLength, y:  tipWidth / 2 }, { x: -gaffLength, y: -tipWidth / 2 },
        ];

        ctx.save();
        const sparBaseX = -this.ship.mastBaseRadius;
        ctx.translate(sparBaseX, 0);

        ctx.fillStyle = this.ship.sparColor;
        ctx.beginPath();
        gaffPoints.forEach((point, index) => (index === 0) ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y));
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = STANDING_RIGGING_COLOR;
        ctx.lineWidth = (gaffWidth / 5); // Proportional thickness
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

    /**
     * Draws the Topsail assembly for the Sloop Rig.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {number} windDirection - The current wind direction in radians.
     * @private
     */
    _drawTopsail(ctx, zoomLevel, windDirection) {
        const sailScale = 0.8;
        // For a top-down perspective, the topsail is drawn at the same position
        // as the course sail, just smaller. Therefore, the vertical offset is always 0.
        const verticalOffset = 0; 
        this._drawSquareSail(ctx, zoomLevel, windDirection, sailScale, verticalOffset);
    }

    /**
     * Draws a complete square sail assembly (sail, yard, and lashings).
     * This is a direct copy from the SquareRig class, as it's a shared component.
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
        // DO NOT translate the context vertically. The verticalOffset is applied directly
        // to the points of the sail and yard below. This prevents double-transformations
        // and ensures the entire assembly moves as one unit.
        ctx.rotate(this.ship.sailCurrentRelativeAngle);

        let currentSailWidthScale = 1.0;
        if (this.ship.isSailOpen) {
            // Use the ship's instance method as seen elsewhere in this class
            const effectiveSpeedMultiplier = this.ship.getWindSpeedMultiplier(this.ship.angle, windDirection);
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
        ctx.strokeStyle = this.ship.sailStrokeColor; // The color is a darker shade of the sail.
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

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
     * This is a direct copy from the SquareRig class, as it's a shared component.
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
        ctx.arc(0, 0, this.ship.mastBaseRadius, 0, Math.PI * 2);
        ctx.fill();
    }
}