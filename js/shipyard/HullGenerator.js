/**
 * Responsible for procedurally generating the geometric shapes of a ship's hull and deck.
 */
class HullGenerator {
    /**
     * Generates the hull, deck, and bulwark polygons for a ship of given dimensions.
     * @param {object} options - The dimensions for the hull.
     * @param {number} options.length - The total length of the ship.
     * @param {number} options.width - The total width (beam) of the ship.
     * @returns {object} An object containing the generated polygon points for {hull, deck, bulwark, bulwarkCutout}.
     */
    static generate({ length, width, numDecks }) {
        const geometry = {};

        // --- Tier 1 (Base Hull) ---
        geometry.hull = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, length, width, 20, true, true).points;
        geometry.deck = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, length, width * 0.9, 20, true, true).points;
        geometry.bulwark = geometry.deck; // The bulwark base is the same as the deck.
        const tier1_innerBulwarkLength = length - (width * 0.1);
        const tier1_innerBulwarkWidth = width * 0.8;
        geometry.bulwarkCutout = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier1_innerBulwarkLength, tier1_innerBulwarkWidth, 20, true, true).points;
        geometry.bulwarkRailOuter = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, length, tier1_innerBulwarkWidth, 20, true, true).points;
        const tier1_railInnerLength = tier1_innerBulwarkLength;
        const tier1_railInnerWidth = width * 0.7;
        geometry.bulwarkRailInner = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier1_railInnerLength, tier1_railInnerWidth, 20, true, true).points;

        // --- Tier 2 (if applicable) ---
        if (numDecks >= 2) {
            // Per user clarification, the length of the outer edges does not change.
            const tier2_length = length;

            // Generate geometry for Tier 2 using its own base dimensions.
            // Per user clarification, widths are fixed percentages of the *original* hull width.
            geometry.tier2_hull = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier2_length, width * 0.80, 20, true, true).points;
            geometry.tier2_deck = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier2_length, width * 0.75, 20, true, true).points;
            geometry.tier2_bulwark = geometry.tier2_deck;
            const tier2_innerBulwarkLength = tier2_length - (width * 0.1); // Length reduction is based on original hull width
            const tier2_innerBulwarkWidth = width * 0.65;
            geometry.tier2_bulwarkCutout = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier2_innerBulwarkLength, tier2_innerBulwarkWidth, 20, true, true).points;
            geometry.tier2_bulwarkRailOuter = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier2_length, width * 0.70, 20, true, true).points;
            const tier2_railInnerLength = tier2_innerBulwarkLength;
            const tier2_railInnerWidth = width * 0.60;
            geometry.tier2_bulwarkRailInner = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier2_railInnerLength, tier2_railInnerWidth, 20, true, true).points;
        }

        // --- Tier 3 (if applicable) ---
        if (numDecks >= 3) {
            // Per user clarification, the length of the outer edges does not change.
            const tier3_length = length;

            // Generate geometry for Tier 3. It has no bulwark rail of its own.
            // Per user clarification, widths are fixed percentages of the *original* hull width.
            geometry.tier3_hull = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier3_length, width * 0.70, 20, true, true).points; // No change
            geometry.tier3_deck = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier3_length, width * 0.675, 20, true, true).points;
            geometry.tier3_bulwark = geometry.tier3_deck;
            const tier3_innerBulwarkLength = tier3_length - (width * 0.1); // Length reduction is based on original hull width
            const tier3_innerBulwarkWidth = width * 0.575;
            geometry.tier3_bulwarkCutout = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier3_innerBulwarkLength, tier3_innerBulwarkWidth, 20, true, true).points;
            geometry.tier3_bulwarkRailOuter = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier3_length, width * 0.65, 20, true, true).points;
            const tier3_railInnerLength = tier3_innerBulwarkLength;
            const tier3_railInnerWidth = width * 0.55;
            geometry.tier3_bulwarkRailInner = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier3_railInnerLength, tier3_railInnerWidth, 20, true, true).points;
        }

        // --- Tier 4 (if applicable, for superstructures on 3-deckers) ---
        if (numDecks >= 4) { // This won't be hit by base hulls, but good for consistency
            const tier4_length = length;
            geometry.tier4_hull = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier4_length, width * 0.65, 20, true, true).points;
            geometry.tier4_deck = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier4_length, width * 0.625, 20, true, true).points;
            geometry.tier4_bulwark = geometry.tier4_deck;
            const tier4_innerBulwarkLength = tier4_length - (width * 0.1);
            const tier4_innerBulwarkWidth = width * 0.525;
            geometry.tier4_bulwarkCutout = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier4_innerBulwarkLength, tier4_innerBulwarkWidth, 20, true, true).points;
            geometry.tier4_bulwarkRailOuter = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier4_length, width * 0.60, 20, true, true).points;
            const tier4_railInnerWidth = width * 0.50;
            geometry.tier4_bulwarkRailInner = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier4_innerBulwarkLength, tier4_railInnerWidth, 20, true, true).points;
        }

        // --- Tier 5 (if applicable, for Sterncastle on Aftercastle on 3-decker) ---
        if (numDecks >= 5) {
            const tier5_length = length;
            geometry.tier5_hull = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier5_length, width * 0.60, 20, true, true).points;
            geometry.tier5_deck = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier5_length, width * 0.575, 20, true, true).points;
            geometry.tier5_bulwark = geometry.tier5_deck;
            const tier5_innerBulwarkLength = tier5_length - (width * 0.1);
            const tier5_innerBulwarkWidth = width * 0.475;
            geometry.tier5_bulwarkCutout = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier5_innerBulwarkLength, tier5_innerBulwarkWidth, 20, true, true).points;
            geometry.tier5_bulwarkRailOuter = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier5_length, width * 0.55, 20, true, true).points;
            geometry.tier5_bulwarkRailInner = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, tier5_innerBulwarkLength, width * 0.45, 20, true, true).points;
        }

        return geometry;
    }

    /**
     * Generates the geometry for a partial deck tier, like an aftercastle.
     * @param {object} options - The dimensions and boundaries for the partial tier.
     * @returns {object} An object containing the sliced polygon points for the partial tier.
     */
    static generatePartialTier({ length, width, tierStyle, startX, endX, structureType, cutout = null }) {
        const partialGeometry = {};

        // Determine the width scaling based on the tier style.
        let hullWidthScale, deckWidthScale, innerBulwarkWidthScale, railOuterWidthScale, railInnerWidthScale;
        if (tierStyle === 'tier2') {
            hullWidthScale = 0.80; deckWidthScale = 0.75; innerBulwarkWidthScale = 0.65; railOuterWidthScale = 0.70; railInnerWidthScale = 0.60;
        } else if (tierStyle === 'tier3') {
            hullWidthScale = 0.70; deckWidthScale = 0.675; innerBulwarkWidthScale = 0.575; railOuterWidthScale = 0.65; railInnerWidthScale = 0.55;
        } else if (tierStyle === 'tier4') {
            hullWidthScale = 0.65; deckWidthScale = 0.625; innerBulwarkWidthScale = 0.525; railOuterWidthScale = 0.60; railInnerWidthScale = 0.50;
        } else { // Failsafe to Tier 5, the narrowest style
            hullWidthScale = 0.60; deckWidthScale = 0.575; innerBulwarkWidthScale = 0.475; railOuterWidthScale = 0.55; railInnerWidthScale = 0.45;
        }

        // Generate full-length polygons to serve as a base for slicing.
        const fullHull = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, length, width * hullWidthScale, 20, true, true).points;
        const fullDeck = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, length, width * deckWidthScale, 20, true, true).points;
        const innerBulwarkLength = length - (width * 0.1);
        const fullBulwarkCutout = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, innerBulwarkLength, width * innerBulwarkWidthScale, 20, true, true).points;
        const fullRailOuter = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, length, width * railOuterWidthScale, 20, true, true).points;
        const fullRailInner = parseAndFlattenSvgPath(SHIP_HULL_VISUAL_SVG_DATA_CACHE, innerBulwarkLength, width * railInnerWidthScale, 20, true, true).points;

        // --- Slicing Logic ---
        // This helper function will "slice" a polygon using ClipperLib, keeping only the parts between sliceStart and sliceEnd.
        const slicePolygon = (points, sliceStart, sliceEnd) => {
            // --- New: Use ClipperLib for robust polygon intersection ---
            const SCALE_FACTOR = 10000; // Scale up coordinates to integers for ClipperLib to avoid floating-point issues.

            // Convert input points to ClipperLib's required format (array of {X, Y} integer points).
            const scaledSubjectPath = points.map(p => ({ X: Math.round(p.x * SCALE_FACTOR), Y: Math.round(p.y * SCALE_FACTOR) }));

            // Define the cutting rectangle. It must be large enough to cover the entire Y-range of the ship.
            const minY = Math.min(...points.map(p => p.y)) - 100; // Add a buffer
            const maxY = Math.max(...points.map(p => p.y)) + 100; // Add a buffer
            const cutterPath = [
                { X: Math.round(sliceStart * SCALE_FACTOR), Y: Math.round(minY * SCALE_FACTOR) },
                { X: Math.round(sliceEnd * SCALE_FACTOR),   Y: Math.round(minY * SCALE_FACTOR) },
                { X: Math.round(sliceEnd * SCALE_FACTOR),   Y: Math.round(maxY * SCALE_FACTOR) },
                { X: Math.round(sliceStart * SCALE_FACTOR), Y: Math.round(maxY * SCALE_FACTOR) },
            ];

            // Initialize Clipper and add the paths.
            const clipper = new ClipperLib.Clipper();
            clipper.AddPath(scaledSubjectPath, ClipperLib.PolyType.ptSubject, true); // The polygon to be clipped.
            clipper.AddPath(cutterPath, ClipperLib.PolyType.ptClip, true);          // The cutting polygon.

            const solutionPaths = new ClipperLib.Paths(); // This will hold the result.
            // Execute the intersection operation.
            clipper.Execute(
                ClipperLib.ClipType.ctIntersection,
                solutionPaths,
                ClipperLib.PolyFillType.pftEvenOdd,
                ClipperLib.PolyFillType.pftEvenOdd
            );

            // Convert the solution back to our game's coordinate format.
            if (solutionPaths.length > 0) {
                // For a simple slice, we expect one resulting polygon.
                const result = solutionPaths[0].map(p => ({ x: p.X / SCALE_FACTOR, y: p.Y / SCALE_FACTOR }));

                // Ensure the resulting polygon has a consistent winding order for drawing.
                ensureClockwiseWinding(result);
                return result;
            }

            return []; // Return an empty array if no intersection was found.
        };

        partialGeometry.hull = slicePolygon(fullHull, startX, endX);
        partialGeometry.deck = slicePolygon(fullDeck, startX, endX);
        partialGeometry.bulwark = partialGeometry.deck; // The base shape is the same.
        partialGeometry.bulwarkCutout = slicePolygon(fullBulwarkCutout, startX, endX);
        partialGeometry.bulwarkRailOuter = slicePolygon(fullRailOuter, startX, endX);
        partialGeometry.bulwarkRailInner = slicePolygon(fullRailInner, startX, endX);

        // --- New: Spar-deck Gangway Cutout Logic ---
        if (structureType === 'spardeck' && cutout && partialGeometry.deck.length > 0) {
            const SCALE_FACTOR = 10000;

            // 1. Define the cutout rectangle for the deck.
            // FIX: The width must be calculated from the full-width deck polygon before it is sliced.
            const deckWidthAtMidpoint = this._getIntersectionPoints(fullDeck, (cutout.startX + cutout.endX) / 2).reduce((acc, p) => Math.max(acc, Math.abs(p.y)), 0) * 2;
            const cutoutWidth = deckWidthAtMidpoint * cutout.widthRatio;
            const gangwayDeckCutter = [
                { X: Math.round(cutout.startX * SCALE_FACTOR), Y: Math.round(-cutoutWidth / 2 * SCALE_FACTOR) },
                { X: Math.round(cutout.endX * SCALE_FACTOR),   Y: Math.round(-cutoutWidth / 2 * SCALE_FACTOR) },
                { X: Math.round(cutout.endX * SCALE_FACTOR),   Y: Math.round(cutoutWidth / 2 * SCALE_FACTOR) },
                { X: Math.round(cutout.startX * SCALE_FACTOR), Y: Math.round(cutoutWidth / 2 * SCALE_FACTOR) },
            ];

            // 2. Store the simple rectangular cutout path. The drawing logic will handle the cutting.
            partialGeometry.gangwayCutout = gangwayDeckCutter.map(p => ({ x: p.X / SCALE_FACTOR, y: p.Y / SCALE_FACTOR }));

            // 3. Generate the rails around the gangway.
            const railThickness = width * 0.05; // Use a consistent thickness.
            const outerRailRect = [
                { X: Math.round((cutout.startX - railThickness) * SCALE_FACTOR), Y: Math.round((-cutoutWidth / 2 - railThickness) * SCALE_FACTOR) },
                { X: Math.round((cutout.endX + railThickness) * SCALE_FACTOR),   Y: Math.round((-cutoutWidth / 2 - railThickness) * SCALE_FACTOR) },
                { X: Math.round((cutout.endX + railThickness) * SCALE_FACTOR),   Y: Math.round((cutoutWidth / 2 + railThickness) * SCALE_FACTOR) },
                { X: Math.round((cutout.startX - railThickness) * SCALE_FACTOR), Y: Math.round((cutoutWidth / 2 + railThickness) * SCALE_FACTOR) },
            ];
            const innerRailRect = gangwayDeckCutter; // The inner edge is the deck cutout.

            const railClipper = new ClipperLib.Clipper();
            railClipper.AddPath(outerRailRect, ClipperLib.PolyType.ptSubject, true);
            railClipper.AddPath(innerRailRect, ClipperLib.PolyType.ptClip, true);
            const railSolution = new ClipperLib.Paths();
            railClipper.Execute(ClipperLib.ClipType.ctDifference, railSolution, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

            if (railSolution.length > 0) {
                // --- FIX: Structure the rail data to separate outer and inner paths ---
                partialGeometry.gangwayRails = {
                    outer: railSolution[0].map(p => ({ x: p.X / SCALE_FACTOR, y: p.Y / SCALE_FACTOR })),
                    inner: (railSolution[1] || []).map(p => ({ x: p.X / SCALE_FACTOR, y: p.Y / SCALE_FACTOR }))
                };
            }
        }

        // --- FIX: Only attempt to generate rail caps if the base rail slicing was successful. ---
        // If the rail polygons are empty, it means the slice was outside the ship's bounds,
        // and we should not proceed.
        if (partialGeometry.bulwarkRailOuter.length > 0 && partialGeometry.bulwarkRailInner.length > 0) {
            // --- New: Generate the Forward Rail (a lateral bar at the forward edge of the slice) ---
            // This rail's front edge is at endX and it extends backward.
            // --- FIX: Calculate the actual thickness at the rail's position ---
            const forwardRailThickness = this._calculateRailThickness(fullRailOuter, fullRailInner, endX);

            if (forwardRailThickness > 0) {
                // Expose the *actual* calculated thickness for other modules (like ShipGenerator's mast avoidance).
                partialGeometry.forwardRailThickness = forwardRailThickness;

                const forwardOuterPoints = this._getIntersectionPoints(fullRailOuter, endX);
                if (forwardOuterPoints.length >= 2) {
                    // Sort by Y to get top and bottom points
                    forwardOuterPoints.sort((a, b) => a.y - b.y);
                    const p1_front = forwardOuterPoints[0]; // Bottom-front point
                    const p2_front = forwardOuterPoints[1]; // Top-front point

                    // --- FIX: Calculate the back edge points independently ---
                    const backEdgeX = endX - forwardRailThickness;
                    const backInnerPoints = this._getIntersectionPoints(fullRailInner, backEdgeX);

                    if (backInnerPoints.length >= 2) {
                        backInnerPoints.sort((a, b) => a.y - b.y);
                        const p3_back = backInnerPoints[0]; // Bottom-back point
                        const p4_back = backInnerPoints[1]; // Top-back point

                        // Create a trapezoid connecting the front and back points.
                        partialGeometry.forwardRail = [p1_front, p2_front, p4_back, p3_back];
                    }
                }
            }

            // --- New: Generate the Aft Rail (a lateral bar at the aft edge of the slice) ---
            // This rail's back edge is at startX and it extends forward.
            const aftRailThickness = this._calculateRailThickness(fullRailOuter, fullRailInner, startX);

            if (aftRailThickness > 0) {
                partialGeometry.aftRailThickness = aftRailThickness; // Expose for consistency
                const aftOuterPoints = this._getIntersectionPoints(fullRailOuter, startX);
                if (aftOuterPoints.length >= 2) {
                    // Sort by Y to get top and bottom points
                    aftOuterPoints.sort((a, b) => a.y - b.y);
                    const p1_back = aftOuterPoints[0]; // Bottom-back point
                    const p2_back = aftOuterPoints[1]; // Top-back point

                    // --- FIX: Calculate the front edge points independently ---
                    const frontEdgeX = startX + aftRailThickness;
                    const frontInnerPoints = this._getIntersectionPoints(fullRailInner, frontEdgeX);

                    if (frontInnerPoints.length >= 2) {
                        frontInnerPoints.sort((a, b) => a.y - b.y);
                        const p3_front = frontInnerPoints[0]; // Bottom-front point
                        const p4_front = frontInnerPoints[1]; // Top-front point

                        // Create a trapezoid connecting the back and front points.
                        partialGeometry.aftRail = [p1_back, p2_back, p4_front, p3_front];
                    }
                }
            }
        }

        return partialGeometry;
    }

    /**
     * Helper to find intersection points of a polygon with a vertical line at a given X.
     * @private
     */
    static _getIntersectionPoints(polygon, x) {
        const intersections = [];
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];
            if ((p1.x <= x && p2.x > x) || (p2.x <= x && p1.x > x)) {
                const t = (x - p1.x) / (p2.x - p1.x);
                const y = p1.y + t * (p2.y - p1.y);
                intersections.push({ x, y });
            }
        }
        return intersections;
    }

    /**
     * Helper to calculate the thickness of the bulwark rail at a specific X-coordinate.
     * @private
     */
    static _calculateRailThickness(outerRail, innerRail, x) {
        const outerY = this._getIntersectionPoints(outerRail, x).map(p => Math.abs(p.y));
        const innerY = this._getIntersectionPoints(innerRail, x).map(p => Math.abs(p.y));

        if (outerY.length > 0 && innerY.length > 0) {
            // Use the maximum Y value which corresponds to the widest part of the rail at that X.
            const maxOuterY = Math.max(...outerY);
            const maxInnerY = Math.max(...innerY);
            return maxOuterY - maxInnerY;
        }
        return 0;
    }
}