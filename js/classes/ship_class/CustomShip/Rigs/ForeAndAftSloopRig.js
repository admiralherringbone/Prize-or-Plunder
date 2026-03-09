/**
 * Represents a complete Fore-and-Aft Sloop Rig assembly.
 * This class encapsulates all the logic for drawing the bowsprit, jibs,
 * and the main mast with its gaff and square sails.
 */
class ForeAndAftSloopRig {
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

        // Gaff sail and topsail
        const sailLength = this.ship.shipLength;
        const gaffSparLength = sailLength * (3 / 5);
        totalDimension += sailLength; // Main gaff sail
        totalDimension += gaffSparLength; // Gaff topsail

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
     * The fore-and-aft sloop has a very long gaff sail boom.
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

            if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI; // Normalize to -PI to PI range

            // --- FIX: Interpolate swing angle based on how far off the wind the ship is. ---
            const absAngleOffWind = Math.abs(angleDiff); // 0 (upwind) to PI (downwind)
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

        // --- Draw non-rotating components ---
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

        // --- FIX: Draw the gaff topsail within the same flipped context ---
        this._drawGaffTopsailLower(ctx, zoomLevel, windDirection);
        this._drawGaffTopsailUpper(ctx, zoomLevel, windDirection);
        ctx.restore();

        // Draw the static spars last so they appear on top of the sails
        this._drawBoom(ctx, zoomLevel);
        this._drawGaffSpar(ctx, zoomLevel);

        // Draw Mast Base
        ctx.fillStyle = this.ship.sparDarkerColor;
        ctx.beginPath();
        ctx.arc(0, 0, this.ship.mastBaseRadius, 0, Math.PI * 2);
        ctx.fill();

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
        const lashingLineWidth = (this.bowspritWidth / 20); // Proportional thickness
        ctx.lineWidth = lashingLineWidth;
        const groupPositions = [this.bowspritLength * 0.1, this.bowspritLength * 0.5, this.bowspritLength * 0.9]; // Proportional thickness
        const lineSpacing = lashingLineWidth * 2;

        groupPositions.forEach(groupCenterX => {
            const taperRatioAtGroup = groupCenterX / this.bowspritLength;
            const bowspritWidthAtGroup = this.bowspritWidth - (taperRatioAtGroup * (this.bowspritWidth - tipWidth));
            const availableWidth = bowspritWidthAtGroup;
            const numLinesInGroup = Math.max(3, Math.floor(availableWidth / (lashingLineWidth + lineSpacing)));
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

        const minWidth = jibSailLength * 0.15;
        const maxWidth = jibSailLength * 0.30;
        let currentWidth = minWidth;

        if (this.ship.isSailOpen) {
            const effectiveSpeedMultiplier = this.ship.getWindSpeedMultiplier(this.ship.angle, windDirection);
            currentWidth = minWidth + (maxWidth - minWidth) * effectiveSpeedMultiplier;
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
        ctx.stroke(); // This was missing
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

        const minWidth = jibSailLength * 0.15;
        const maxWidth = jibSailLength * 0.30;
        let currentWidth = minWidth;

        if (this.ship.isSailOpen) {
            const effectiveSpeedMultiplier = this.ship.getWindSpeedMultiplier(this.ship.angle, windDirection);
            currentWidth = minWidth + (maxWidth - minWidth) * effectiveSpeedMultiplier;
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
        ctx.strokeStyle = this.ship?.sailStrokeColor || darkenColor(SAIL_COLOR, 40);
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
        ctx.strokeStyle = this.ship?.sailStrokeColor || darkenColor(SAIL_COLOR, 40);
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

    /**
     * Draws the lower part of the gaff-topsail.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawGaffTopsailLower(ctx, zoomLevel, windDirection) {
        // The topsail's length should match the gaff spar's length.
        const gaffLength = this.ship.shipLength * (3 / 5);
        const finalSailWidth = gaffLength;

        // --- New: Dynamic Sail Billow Calculation ---
        const minBillow = finalSailWidth * 0.10;
        const maxBillow = finalSailWidth * 0.15;
        let currentBillow = minBillow;

        if (this.ship.isSailOpen) {
            const effectiveSpeedMultiplier = this.ship.getWindSpeedMultiplier(this.ship.angle, windDirection);
            currentBillow = minBillow + (maxBillow - minBillow) * effectiveSpeedMultiplier;
        }

        // Parse and flatten the SVG path data for the gaff-topsail.
        const topsailPoints = parseAndFlattenSvgPath(GAFF_TOPSAIL_LOWER_SVG_DATA_CACHE, finalSailWidth, currentBillow, 20, false, true).points;

        ctx.save();
        // The gaff spar starts at the mast's edge.
        const sparBaseX = -this.ship.mastBaseRadius;
        // We translate to the center of where the sail should be, positioned along the gaff spar.
        // The Y offset places it just above the gaff spar itself.
        ctx.translate(-this.ship.mastBaseRadius - finalSailWidth / 2, -currentBillow / 2);

        ctx.fillStyle = darkenColor(this.ship.sailColor, 20);
        ctx.beginPath();
        // We flip the points horizontally (-p.x) to make it extend aft from the mast.
        topsailPoints.forEach((p, i) => (i === 0) ? ctx.moveTo(-p.x, p.y) : ctx.lineTo(-p.x, p.y));
        ctx.closePath();
        ctx.fill();

        ctx.save();
        ctx.clip();
        ctx.strokeStyle = this.ship?.sailStrokeColor || darkenColor(SAIL_COLOR, 40);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }

    /**
     * Draws the upper part of the gaff-topsail.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawGaffTopsailUpper(ctx, zoomLevel, windDirection) {
        const gaffLength = this.ship.shipLength * (3 / 5);
        const finalSailWidth = gaffLength;

        // --- New: Dynamic Sail Billow Calculation ---
        const minBillow = finalSailWidth * 0.10;
        const maxBillow = finalSailWidth * 0.15;
        let currentBillow = minBillow;

        if (this.ship.isSailOpen) {
            const effectiveSpeedMultiplier = this.ship.getWindSpeedMultiplier(this.ship.angle, windDirection);
            currentBillow = minBillow + (maxBillow - minBillow) * effectiveSpeedMultiplier;
        }

        const topsailPoints = parseAndFlattenSvgPath(GAFF_TOPSAIL_UPPER_SVG_DATA_CACHE, finalSailWidth, currentBillow, 20, true, false).points;

        ctx.save();
        const sparBaseX = -this.ship.mastBaseRadius;
        ctx.translate(-this.ship.mastBaseRadius - finalSailWidth / 2, -currentBillow / 2);

        ctx.fillStyle = this.ship.sailColor;
        ctx.beginPath();
        // We flip the points horizontally (-p.x) and vertically (-p.y) to make it extend aft from the mast and appear correctly.
        topsailPoints.forEach((p, i) => (i === 0) ? ctx.moveTo(-p.x, -p.y) : ctx.lineTo(-p.x, -p.y));
        ctx.closePath();
        ctx.fill();

        ctx.save();
        ctx.clip();
        ctx.strokeStyle = this.ship.sailStrokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }
}