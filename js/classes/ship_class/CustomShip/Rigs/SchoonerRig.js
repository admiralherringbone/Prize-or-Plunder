/**
 * Represents a complete Schooner Rig assembly.
 * A schooner has two masts, both fore-and-aft rigged with full gaff sail assemblies.
 */
class SchoonerRig {
    /**
     * @param {Ship} ship - The ship this rig is attached to.
     * @param {Array<object>} mastConfigs - An array of all mast configurations from the blueprint.
     */
    constructor(ship, mastConfigs) {
        this.ship = ship;
        this.foreMastConfig = mastConfigs.find(m => m.type === 'fore');
        this.mainMastConfig = mastConfigs.find(m => m.type === 'main');

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

        // Main mast gaff sail and topsail
        const mainSailLength = this.ship.shipLength / 2;
        totalDimension += mainSailLength;
        totalDimension += mainSailLength * (3 / 5);

        // Fore mast gaff sail and topsail
        const distanceBetweenMasts = Math.abs((this.foreMastConfig.x - this.ship.mastBaseRadius) - (this.mainMastConfig.x + this.ship.mastBaseRadius));
        const foreSailLength = distanceBetweenMasts * 0.9;
        totalDimension += foreSailLength;
        totalDimension += foreSailLength * (3 / 5);

        // Jibs
        totalDimension += (this.bowspritDeckStart + this.bowspritLength - this.foreMastConfig.x) / 2; // Jib
        totalDimension += (this.bowspritDeckStart + this.bowspritLength - this.foreMastConfig.x) / 2; // Staysail

        return totalDimension;
    }

    /**
     * New: Gets the aft-most coordinate of the rig for centering calculations.
     * The schooner's mainmast gaff sail extends the furthest aft.
     * @returns {number} The world-space X coordinate of the rig's aft-most point.
     */
    getAftBound() {
        const boomLength = this.ship.shipLength / 2;
        // The boom starts at the mainmast's edge and extends backward.
        const boomEnd = this.mainMastConfig.x - this.ship.mastBaseRadius - boomLength;
        return boomEnd;
    }

    /**
     * Draws the bowsprit for the rig.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
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

        // --- Rotate and draw each mast's gaff assembly ---
        [this.foreMastConfig, this.mainMastConfig].forEach(mastConfig => {
            if (!mastConfig) return;

            ctx.save();
            // The rotation is now applied inside _drawMastBaseAndSails
            // to allow for mirroring.

            this._drawMastBaseAndSails(ctx, zoomLevel, mastConfig, windDirection);
            ctx.restore();
        });

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
        this._drawAllStays(ctx, zoomLevel);
    }

    /**
     * Draws the base and full gaff sail assembly for a given mast.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {object} mastConfig - The configuration for the mast to draw.
     * @private
     */
    _drawMastBaseAndSails(ctx, zoomLevel, mastConfig, windDirection) {
        ctx.save();
        // Translate to the mast's position first
        ctx.translate(mastConfig.x, mastConfig.y);

        // Rotate the entire assembly
        ctx.rotate(this.currentGaffAngle);

        // Both masts have a full gaff sail assembly.
        this._drawFullGaffSailAssembly(ctx, zoomLevel, mastConfig, windDirection);

        ctx.restore(); // Restore from rotation

        // Draw Mast Base
        ctx.save();
        ctx.translate(mastConfig.x, mastConfig.y);
        ctx.fillStyle = this.ship.sparDarkerColor;
        ctx.beginPath();
        ctx.arc(0, 0, this.ship.mastBaseRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /**
     * Draws a complete full gaff sail assembly (gaff sail + gaff-topsail) for a specific mast.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @param {object} mastConfig - The configuration of the mast this sail belongs to.
     * @private
     */
    _drawFullGaffSailAssembly(ctx, zoomLevel, mastConfig, windDirection) {
        let sailLength;

        if (mastConfig.type === 'main') {
            // Main mast sail length is the same as the Brig's gaff sail.
            sailLength = this.ship.shipLength / 2;
        } else { // Foremast
            // Foremast sail length is 90% of the distance between the masts.
            const distanceBetweenMasts = Math.abs((this.foreMastConfig.x - this.ship.mastBaseRadius) - (this.mainMastConfig.x + this.ship.mastBaseRadius));
            sailLength = distanceBetweenMasts * 0.9;
        }

        const gaffSparLength = sailLength * (3 / 5);

        // --- Draw mirrored sails ---
        ctx.save();
        if (this.currentGaffAngle < 0) { // Swung to port
            ctx.scale(1, -1); // Flip sails vertically
        }
        // Gaff Sail
        this._drawGaffSailLower(ctx, zoomLevel, sailLength, windDirection);
        this._drawGaffSailUpper(ctx, zoomLevel, sailLength, windDirection);
        // Gaff Topsail
        this._drawGaffTopsailLower(ctx, zoomLevel, gaffSparLength, windDirection);
        this._drawGaffTopsailUpper(ctx, zoomLevel, gaffSparLength, windDirection);
        ctx.restore();

        // Draw static spars last so they appear on top of the sails
        this._drawBoom(ctx, zoomLevel, sailLength);
        this._drawGaffSpar(ctx, zoomLevel, gaffSparLength);
    }

    /**
     * Draws all stays for the schooner rig.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {number} zoomLevel - The current camera zoom level.
     * @private
     */
    _drawAllStays(ctx, zoomLevel) {
        ctx.save();
        ctx.translate(this.foreMastConfig.x, this.foreMastConfig.y);

        // Draw the forestay connecting this mast to the bowsprit.
        this._drawForestay(ctx, zoomLevel);

        // Draw the mainstay connecting the mainmast TO this (the fore) mast.
        const endPointX = this.mainMastConfig.x - this.foreMastConfig.x;
        ctx.strokeStyle = STANDING_RIGGING_COLOR;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(endPointX, 0);
        ctx.stroke();

        ctx.restore();
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

    // --- Copied Drawing Methods from BrigRig & ForeAndAftSloopRig ---
    // These methods are copied to keep the SchoonerRig class self-contained for now.

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
        const lashingLineWidth = (this.bowspritWidth / 20) * zoomLevel; // Proportional thickness
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

    _drawStaysail(ctx, zoomLevel, windDirection) {
        const lashingLineWidthWorld = 1;
        const linesPerGroup = 5;
        const totalGroupWidthWorld = linesPerGroup * lashingLineWidthWorld;
        const forwardGroupCenter = this.bowspritLength * 0.9;
        const forwardGroupFrontEdge = forwardGroupCenter + (totalGroupWidthWorld / 2);
        const mainJibEndPointX = this.bowspritDeckStart + forwardGroupFrontEdge;
        const jibSailLength = (mainJibEndPointX - this.foreMastConfig.x) / 2;

        const middleGroupCenter = this.bowspritLength * 0.5;
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

    _drawForestay(ctx, zoomLevel) {
        const endPointX = this.bowspritDeckStart + this.bowspritLength;

        ctx.strokeStyle = STANDING_RIGGING_COLOR;
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(0, 0); // Start at the mast's translated origin
        ctx.lineTo(endPointX - this.foreMastConfig.x, 0);
        ctx.stroke();
    }

    _drawBoom(ctx, zoomLevel, boomLength) {
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

    _drawGaffSailLower(ctx, zoomLevel, sailLength, windDirection) {
        // --- New: Dynamic Sail Billow Calculation ---
        const minBillow = sailLength * 0.10;
        const maxBillow = sailLength * 0.15;
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
        ctx.translate(boomStartX - sailLength / 2, 0);
        ctx.scale(-1, 1);
        ctx.scale(sailLength, currentBillow);
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

    _drawGaffSailUpper(ctx, zoomLevel, sailLength, windDirection) {
        // --- New: Dynamic Sail Billow Calculation ---
        const minBillow = sailLength * 0.10;
        const maxBillow = sailLength * 0.15;
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

        const upperSailPoints = parseAndFlattenSvgPath(GAFF_SAIL_UPPER_SVG_DATA_CACHE, sailLength, currentBillow, 20, false, false).points;

        ctx.save();
        const boomStartX = -this.ship.mastBaseRadius;
        ctx.translate(boomStartX - sailLength / 2, -currentBillow / 2);

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

    _drawGaffSpar(ctx, zoomLevel, gaffLength) {
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

    _drawGaffTopsailLower(ctx, zoomLevel, gaffLength, windDirection) {
        const finalSailWidth = gaffLength;

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

        const topsailPoints = parseAndFlattenSvgPath(GAFF_TOPSAIL_LOWER_SVG_DATA_CACHE, finalSailWidth, currentBillow, 20, false, true).points;

        ctx.save();
        const sparBaseX = -this.ship.mastBaseRadius;
        ctx.translate(sparBaseX - finalSailWidth / 2, -currentBillow / 2);

        ctx.fillStyle = darkenColor(this.ship.sailColor, 20);
        ctx.beginPath();
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        topsailPoints.forEach((p, i) => {
            const px = -p.x, py = p.y;
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

    _drawGaffTopsailUpper(ctx, zoomLevel, gaffLength, windDirection) {
        const finalSailWidth = gaffLength;

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

        const topsailPoints = parseAndFlattenSvgPath(GAFF_TOPSAIL_UPPER_SVG_DATA_CACHE, finalSailWidth, currentBillow, 20, true, false).points;

        ctx.save();
        const sparBaseX = -this.ship.mastBaseRadius;
        ctx.translate(sparBaseX - finalSailWidth / 2, -currentBillow / 2);

        ctx.fillStyle = this.ship.sailColor;
        ctx.beginPath();
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        topsailPoints.forEach((p, i) => {
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
}