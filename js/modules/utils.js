/**
 * Polyfill for the CanvasRenderingContext2D.roundRect() method.
 * This ensures that the method for drawing rectangles with rounded corners is available
 * in all browsers, as it is a relatively new addition to the web standard.
 */
if (typeof CanvasRenderingContext2D.prototype.roundRect === 'undefined') {
    console.log("Polyfill for CanvasRenderingContext2D.roundRect() is being applied.");
    /**
     * @param {number} x The x-axis coordinate of the rectangle's starting point.
     * @param {number} y The y-axis coordinate of the rectangle's starting point.
     * @param {number} w The rectangle's width.
     * @param {number} h The rectangle's height.
     * @param {number} r The radius of the corners.
     */
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
    };
}

/**
 * Generates a random number within a specified range.
 * @param {number} min - The minimum value (inclusive).
 * @param {number} max - The maximum value (exclusive).
 * @returns {number} A random number.
 */
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Calculates the Euclidean distance between two points.
 * @param {object} p1 - First point {x, y}.
 * @param {object} p2 - Second point {x, y}.
 * @returns {number} The distance.
 */
function distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Rotates a point around a center point by a given angle.
 * @param {object} point - The point to rotate {x, y}.
 * @param {object} center - The center of rotation {x, y}.
 * @param {number} angle - The rotation angle in radians.
 * @param {object} [out] - Optional object to write the result into.
 * @returns {object} The new rotated point {x, y}.
 */
function rotatePoint(point, center, angle, out = {x: 0, y: 0}) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = point.x - center.x;
    const y = point.y - center.y;
    out.x = x * cos - y * sin + center.x;
    out.y = x * sin + y * cos + center.y;
    return out;
}

/**
 * Normalizes an angle to be within 0 and 2*PI.
 * @param {number} angle - The angle in radians.
 * @returns {number} The normalized angle.
 */
function normalizeAngle(angle) {
    return angle - Math.PI * 2 * Math.floor(angle / (Math.PI * 2));
}

/**
 * Generates points for a regular polygon.
 * @param {number} x - Center X.
 * @param {number} y - Center Y.
 * @param {number} radius - Radius of the polygon.
 * @param {number} sides - Number of sides.
 * @param {number} startAngle - Starting angle for the first vertex.
 * @returns {Array<object>} An array of point objects {x, y}.
 */
function generateRegularPolygonPoints(x, y, radius, sides, startAngle = 0) {
    const points = [];
    for (let i = 0; i < sides; i++) {
        const angle = startAngle + (i * 2 * Math.PI) / sides;
        points.push({
            x: x + radius * Math.cos(angle),
            y: y + radius * Math.sin(angle)
        });
    }
    return points;
}

/**
 * Generates points for an irregular polygon (irregular ellipse) suitable for islands or jagged shapes.
 * @param {number} centerX - Center X.
 * @param {number} centerY - Center Y.
 * @param {number} baseRadiusX - Base radius along the X-axis.
 * @param {number} baseRadiusY - Base radius along the Y-axis.
 * @param {number} sides - Number of sides (vertices) for the base shape.
 * @param {number} irregularityFactor - How much to vary the radius of each point.
 * @returns {Array<object>} An array of point objects {x, y}.
 */
function generateIrregularPolygon(centerX, centerY, baseRadiusX, baseRadiusY, sides, irregularityFactor = 0.5) {
    const points = [];
    const angleStep = (2 * Math.PI) / sides;

    for (let i = 0; i < sides; i++) {
        const angle = i * angleStep;
        const cosSq = Math.cos(angle) ** 2;
        const sinSq = Math.sin(angle) ** 2;
        const baseEllipticalRadius = (baseRadiusX * baseRadiusY) / Math.sqrt((baseRadiusX ** 2) * sinSq + (baseRadiusY ** 2) * cosSq);
        const variedRadius = baseEllipticalRadius + (Math.random() * irregularityFactor * baseEllipticalRadius * 2 - irregularityFactor * baseEllipticalRadius);
        points.push({
            x: centerX + variedRadius * Math.cos(angle),
            y: centerY + variedRadius * Math.sin(angle)
        });
    }
    return points;
}

/**
 * Calculates the signed area of a polygon to determine its winding order.
 * @param {Array<object>} points - Array of points {x, y}.
 * @returns {number} The signed area. Positive for CCW, negative for CW in a Y-down system.
 */
function getPolygonArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        area += (p1.x * p2.y - p2.x * p1.y);
    }
    return area / 2;
}

/**
 * Ensures a polygon's points are ordered in a clockwise (CW) direction.
 * Modifies the array in place if needed.
 * @param {Array<object>} points - Array of points {x, y}.
 */
function ensureClockwiseWinding(points) {
    if (getPolygonArea(points) > 0) { // If area is positive, it's CCW in Y-down
        points.reverse(); // Reverse to make it CW
    }
}

/**
 * Checks if a point is inside a polygon using the ray-casting algorithm.
 * @param {{x: number, y: number}} point - The point to check.
 * @param {Array<{x: number, y: number}>} polygon - The vertices of the polygon.
 * @returns {boolean} True if the point is inside, false otherwise.
 */
function isPointInPolygon(point, polygon) {
    let isInside = false;
    // --- FIX: Add a failsafe check for an undefined polygon ---
    if (!polygon || !Array.isArray(polygon)) {
        console.warn("isPointInPolygon was called with an invalid polygon argument:", polygon);
        return false;
    }
    const x = point.x, y = point.y;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) isInside = !isInside;
    }
    return isInside;
}

/**
 * Calculates the Convex Hull of a set of points using the Monotone Chain algorithm.
 * @param {Array<{x: number, y: number}>} points - An array of points.
 * @returns {Array<{x: number, y: number}>} The points of the convex hull in clockwise order.
 */
function getConvexHull(points) {
    if (points.length < 3) return points;

    // Sort points by X, then Y
    const sorted = points.slice().sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);
    
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

    const lower = [];
    for (const p of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }

    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
        const p = sorted[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }

    upper.pop();
    lower.pop();
    return lower.concat(upper);
}

/**
 * Calculates the squared distance from a point to a line segment.
 * Using squared distance is more efficient as it avoids a square root operation.
 * @param {{x: number, y: number}} p - The point.
 * @param {{x: number, y: number}} v - The start of the line segment.
 * @param {{x: number, y: number}} w - The end of the line segment.
 * @returns {number} The squared distance.
 */
function distanceToSegmentSquared(p, v, w) {
    const l2 = distance(v, w) ** 2;
    if (l2 === 0) return distance(p, v) ** 2;
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection = {
        x: v.x + t * (w.x - v.x),
        y: v.y + t * (w.y - v.y)
    };
    return distance(p, projection) ** 2;
}

/**
 * Calculates the minimum squared distance from a point to a polygon's boundary.
 * If the point is inside the polygon, the distance is 0.
 * @param {{x: number, y: number}} point - The point to check.
 * @param {Array<{x: number, y: number}>} polygon - The vertices of the polygon.
 * @returns {number} The minimum squared distance.
 */
function distanceToPolygonSquared(point, polygon) {
    // --- FIX: Add a failsafe check for an undefined polygon ---
    if (!polygon || !Array.isArray(polygon)) {
        console.warn("distanceToPolygonSquared was called with an invalid polygon argument:", polygon);
        return Infinity;
    }
    if (isPointInPolygon(point, polygon)) {
        return 0;
    }
    let minDistanceSq = Infinity;
    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % polygon.length];
        const distSq = distanceToSegmentSquared(point, p1, p2);
        if (distSq < minDistanceSq) {
            minDistanceSq = distSq;
        }
    }
    return minDistanceSq;
}

/**
 * Helper function to triangulate a polygon using the earcut library.
 * @param {Array<object>} polygonPoints - Array of {x,y} points.
 * @returns {Array<Array<object>>} An array of triangle polygons.
 */
function triangulatePolygon(polygonPoints) {
    const data = [];
    for (const p of polygonPoints) {
        data.push(p.x, p.y);
    }
    const trianglesIndices = earcut(data);
    const triangles = [];
    for (let i = 0; i < trianglesIndices.length; i += 3) {
        const t = [];
        t.push(polygonPoints[trianglesIndices[i]]);
        t.push(polygonPoints[trianglesIndices[i + 1]]);
        t.push(polygonPoints[trianglesIndices[i + 2]]);
        triangles.push(t);
    }
    return triangles;
}

/**
 * Returns the outer perimeter of a simple polygon.
 * @param {Array<object>} points - The ordered points of the polygon.
 * @returns {Array<object>} The same array of points.
 */
function getOuterPerimeter(points) {
    return points;
}

/**
 * Calculates the Axis-Aligned Bounding Box (AABB) for a polygon.
 * @param {Array<{x: number, y: number}>} points - The vertices of the polygon.
 * @param {object} [out] - Optional object to write results into.
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}}
 */
function getPolygonAABB(points, out = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }) {
    out.minX = Infinity; out.minY = Infinity; out.maxX = -Infinity; out.maxY = -Infinity;
    for (const p of points) {
        if (p.x < out.minX) out.minX = p.x;
        if (p.y < out.minY) out.minY = p.y;
        if (p.x > out.maxX) out.maxX = p.x;
        if (p.y > out.maxY) out.maxY = p.y;
    }
    return out;
}

/**
 * Checks if two AABBs overlap.
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} a - First AABB.
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} b - Second AABB.
 * @returns {boolean} True if they overlap.
 */
function checkAABBOverlap(a, b) {
    return (a.minX <= b.maxX && a.maxX >= b.minX) &&
           (a.minY <= b.maxY && a.maxY >= b.minY);
}

// --- OPTIMIZATION: Shared result object to avoid GC ---
const _SAT_RESULT = { colliding: false, overlap: 0, axis: { x: 0, y: 0 } };

// --- Collision Detection (Separating Axis Theorem - SAT) ---
/**
 * Checks for collision between two polygons using SAT.
 * Optimized to reduce object allocation (Garbage Collection pressure).
 * @param {Array<object>} poly1 - First polygon's points.
 * @param {Array<object>} poly2 - Second polygon's points.
 * @returns {object|null} An object {colliding, overlap, axis} or null if no collision.
 */
function checkPolygonCollision(poly1, poly2) {
    let minOverlap = Infinity;
    // Reuse internal variables instead of allocating an object
    let colAxisX = 0;
    let colAxisY = 0;
    let axisX = 0;
    let axisY = 0;

    // Helper to process axes of a polygon without allocating arrays
    const checkAxes = (polygon) => {
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];
            
            // Get normal (axis) - Inlined
            let edgeX = p2.x - p1.x;
            let edgeY = p2.y - p1.y;
            // Normal is (-edgeY, edgeX)
            axisX = -edgeY;
            axisY = edgeX;
            
            // Normalize
            const len = Math.sqrt(axisX * axisX + axisY * axisY);
            if (len === 0) continue;
            axisX /= len;
            axisY /= len;

            // Project poly1 - Inlined
            let min1 = Infinity;
            let max1 = -Infinity;
            for (let j = 0; j < poly1.length; j++) {
                const dot = poly1[j].x * axisX + poly1[j].y * axisY;
                if (dot < min1) min1 = dot;
                if (dot > max1) max1 = dot;
            }

            // Project poly2 - Inlined
            let min2 = Infinity;
            let max2 = -Infinity;
            for (let j = 0; j < poly2.length; j++) {
                const dot = poly2[j].x * axisX + poly2[j].y * axisY;
                if (dot < min2) min2 = dot;
                if (dot > max2) max2 = dot;
            }

            const overlap = Math.min(max1, max2) - Math.max(min1, min2);

            if (overlap < 0.01) { // Gap found
                return true; 
            }

            if (overlap < minOverlap) {
                minOverlap = overlap;
                colAxisX = axisX;
                colAxisY = axisY;
            }
        }
        return false;
    };

    if (checkAxes(poly1)) return null;
    if (checkAxes(poly2)) return null;

    // Calculate centers manually to avoid reduce/object creation
    let c1x = 0, c1y = 0;
    for(let i=0; i<poly1.length; i++) { c1x += poly1[i].x; c1y += poly1[i].y; }
    c1x /= poly1.length; c1y /= poly1.length;

    let c2x = 0, c2y = 0;
    for(let i=0; i<poly2.length; i++) { c2x += poly2[i].x; c2y += poly2[i].y; }
    c2x /= poly2.length; c2y /= poly2.length;

    const dx = c1x - c2x;
    const dy = c1y - c2y;

    if ((dx * colAxisX + dy * colAxisY) < 0) {
        colAxisX = -colAxisX;
        colAxisY = -colAxisY;
    }

    // Populate shared result object
    _SAT_RESULT.colliding = true;
    _SAT_RESULT.overlap = minOverlap;
    _SAT_RESULT.axis.x = colAxisX;
    _SAT_RESULT.axis.y = colAxisY;
    
    return _SAT_RESULT;
}

// --- SVG Parsing ---

/**
 * Parses an SVG path 'd' attribute and flattens Bézier curves into line segments.
 * @param {string} pathData - The SVG path 'd' attribute string.
 * @param {number} targetGameXDim - The desired extent of the shape along the game's X-axis.
 * @param {number} targetGameYDim - The desired extent of the shape along the game's Y-axis.
 * @param {number} segmentsPerCurve - Number of straight segments to approximate each Bézier curve.
 * @param {boolean} rotate90Clockwise - If true, applies a 90-degree clockwise rotation.
 * @param {boolean} flipHorizontal - If true, applies a horizontal flip.
 * @returns {object} An object containing points and straightEdgeGameX.
 */
function parseAndFlattenSvgPath(pathData, targetGameXDim, targetGameYDim, segmentsPerCurve = 10, rotate90Clockwise = false, flipHorizontal = false) {
    const points = [];
    const commands = pathData.match(/[MCLZ][^MCLZ]*/g);
    let currentX = 0, currentY = 0, subpathStartX = 0, subpathStartY = 0;
    let minX_raw = Infinity, minY_raw = Infinity, maxX_raw = -Infinity, maxY_raw = -Infinity;

    function cubicBezier(t, p0, p1, p2, p3) {
        const mt = 1 - t;
        return mt ** 3 * p0 + 3 * mt ** 2 * t * p1 + 3 * mt * t ** 2 * p2 + t ** 3 * p3;
    }

    commands.forEach(cmd => {
        const type = cmd[0];
        const values = cmd.substring(1).trim().split(/[\s,]+/).map(Number).filter(v => !isNaN(v));
        switch (type) {
            case 'M': [currentX, currentY] = values; subpathStartX = currentX; subpathStartY = currentY; points.push({ x: currentX, y: currentY }); break;
            case 'L': [currentX, currentY] = values; points.push({ x: currentX, y: currentY }); break;
            case 'C':
                for (let i = 1; i <= segmentsPerCurve; i++) {
                    const t = i / segmentsPerCurve;
                    points.push({ x: cubicBezier(t, currentX, values[0], values[2], values[4]), y: cubicBezier(t, currentY, values[1], values[3], values[5]) });
                }
                [currentX, currentY] = [values[4], values[5]];
                break;
            case 'Z': if (currentX !== subpathStartX || currentY !== subpathStartY) { points.push({ x: subpathStartX, y: subpathStartY }); } [currentX, currentY] = [subpathStartX, subpathStartY]; break;
        }
    });

    points.forEach(p => { minX_raw = Math.min(minX_raw, p.x); minY_raw = Math.min(minY_raw, p.y); maxX_raw = Math.max(maxX_raw, p.x); maxY_raw = Math.max(maxY_raw, p.y); });
    const originalWidth_svg = maxX_raw - minX_raw;
    const originalHeight_svg = maxY_raw - minY_raw;
    const rawCenterX_svg = minX_raw + originalWidth_svg / 2;
    const rawCenterY_svg = minY_raw + originalHeight_svg / 2;

    const transformedPoints = points.map(p => {
        const normalizedX = p.x - rawCenterX_svg;
        const normalizedY = p.y - rawCenterY_svg;
        let transformedX, transformedY;
        if (rotate90Clockwise) {
            const scaleXFactor = targetGameXDim / originalHeight_svg;
            const scaleYFactor = targetGameYDim / originalWidth_svg;
            transformedX = normalizedY * scaleXFactor;
            transformedY = -normalizedX * scaleYFactor;
        } else {
            const scaleXFactor = targetGameXDim / originalWidth_svg;
            const scaleYFactor = targetGameYDim / originalHeight_svg;
            transformedX = normalizedX * scaleXFactor;
            transformedY = normalizedY * scaleYFactor;
        }
        if (flipHorizontal) {
            transformedX = -transformedX;
        }
        return { x: transformedX, y: transformedY };
    });

    // --- New: Calculate the straight edge X position for the sail ---
    const straightSideRawY_sail = 12673.4; // The Y coordinate of the straight edge in the raw SVG for the sail.
    const normalizedY_straight = straightSideRawY_sail - rawCenterY_svg;
    const scaleXFactor_sail = targetGameXDim / originalHeight_svg; // Because of 90-degree rotation
    const straightEdgeGameX = -1 * normalizedY_straight * scaleXFactor_sail; // The -1 is for the horizontal flip.

    return {
        points: transformedPoints,
        rawCenterY: rawCenterY_svg,
        originalHeight_svg: originalHeight_svg,
        straightEdgeGameX: straightEdgeGameX, // Return the calculated value
    };
}

/**
 * Parses a complex, multi-part SVG and converts each part into a Path2D object.
 * This is designed for SVGs with nested groups and transformations.
 * @param {string} svgText - The full text content of the SVG file.
 * @returns {Array<{path2D: Path2D, fill: string}>} An array of objects, each with a drawable Path2D and its original fill color.
 */
function parseMultiPartSvg(svgText) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgElement = doc.documentElement;

    // Get overall transform and viewBox
    const viewBox = svgElement.viewBox.baseVal;
    const originalWidth = viewBox.width;
    const originalHeight = viewBox.height;

    // --- FIX: Account for top-level group transforms from design software ---
    const mainGroup = doc.getElementById('Cannon');
    const mainGroupTransform = mainGroup ? mainGroup.getCTM() : new DOMMatrix();

    const parts = [];
    const elements = doc.querySelectorAll('path, rect, circle');

    elements.forEach(el => {
        // 1. Get the element's transformation matrix relative to the SVG canvas.
        const ctm = el.getCTM();
        if (!ctm) return;

        // 2. Create a final transformation matrix that includes our game scaling and centering.
        // This chain now only centers the SVG content at (0,0) and applies its internal transforms.
        // The final scaling for display is now handled by the drawing function.
        // The order is critical and reads from bottom to top.
        const finalTransform = new DOMMatrix()
            // No longer translating to game dimensions here.
            // No longer scaling to game dimensions here.
            // No longer need to rotate, as the SVG is now oriented correctly.
            .translate(-viewBox.x - originalWidth / 2, -viewBox.y - originalHeight / 2) // 2. Center SVG content at origin.
            .multiply(ctm); // 1. Apply the element's cumulative transform matrix. getCTM() already includes parent transforms.

        // 3. Get the raw path data for the element.
        const pathData = (el.tagName === 'path') ? el.getAttribute('d') : getPathDataFromShape(el);
        if (!pathData) return;

        // 4. Create a new Path2D object by applying the final transformation matrix
        // to the path data. This is the correct way to transform a Path2D.
        const transformedPath = new Path2D(pathData);
        const finalPath2D = new Path2D();
        finalPath2D.addPath(transformedPath, finalTransform);

        parts.push({
            path2D: finalPath2D,
            fill: el.style.fill || el.getAttribute('fill') || '#000000'
        });
    });

    // --- Diagnostic Logging ---
    console.log(`[SVG Parser] 'parseMultiPartSvg' finished.`);
    console.log(`[SVG Parser] Found ${elements.length} drawable elements (<path>, <rect>, <circle>).`);
    console.log(`[SVG Parser] Successfully created ${parts.length} Path2D objects.`);
    if (parts.length > 0) {
        console.log("[SVG Parser] First parsed part:", parts[0]);
    }

    return parts;
}

/**
 * Parses an SVG path 'd' attribute and returns points centered around (0,0).
 * @param {string} pathData - The SVG path 'd' attribute string.
 * @returns {object} An object containing points, originalWidth, and originalHeight.
 */
function parseSvgPathToLocalCoordinates(pathData) {
    const points = [];
    const parsedCommands = [];
    const commands = pathData.match(/[MCLZ][^MCLZ]*/g);
    let currentX = 0, currentY = 0, subpathStartX = 0, subpathStartY = 0;
    let minX_raw = Infinity, minY_raw = Infinity, maxX_raw = -Infinity, maxY_raw = -Infinity;

    commands.forEach(cmd => {
        const type = cmd[0];
        const values = cmd.substring(1).trim().split(/[\s,]+/).map(Number).filter(v => !isNaN(v));
        
        // Store the raw command for later normalization
        parsedCommands.push({ type, values });

        // Track points for bounding box calculation
        switch (type) {
            case 'M': [currentX, currentY] = values; subpathStartX = currentX; subpathStartY = currentY; points.push({ x: currentX, y: currentY }); break;
            case 'L': [currentX, currentY] = values; points.push({ x: currentX, y: currentY }); break;
            case 'C': 
                // For bounds, we track start, control points, and end point
                points.push({ x: values[0], y: values[1] }); // Control 1
                points.push({ x: values[2], y: values[3] }); // Control 2
                [currentX, currentY] = [values[4], values[5]]; 
                points.push({ x: currentX, y: currentY }); // End
                break;
            case 'Z': [currentX, currentY] = [subpathStartX, subpathStartY]; points.push({ x: currentX, y: currentY }); break;
        }
    });

    points.forEach(p => { minX_raw = Math.min(minX_raw, p.x); minY_raw = Math.min(minY_raw, p.y); maxX_raw = Math.max(maxX_raw, p.x); maxY_raw = Math.max(maxY_raw, p.y); });
    const originalWidth = maxX_raw - minX_raw;
    const originalHeight = maxY_raw - minY_raw;
    const rawCenterX = minX_raw + originalWidth / 2;
    const rawCenterY = minY_raw + originalHeight / 2;

    // Normalize points (Legacy support for simple shapes like Anchor)
    const normalizedPoints = points.map(p => ({ x: p.x - rawCenterX, y: p.y - rawCenterY }));

    // Normalize commands (New support for complex shapes like Compass Rose)
    const normalizedCommands = parsedCommands.map(cmd => {
        const newValues = cmd.values.map((v, i) => {
            return (i % 2 === 0) ? v - rawCenterX : v - rawCenterY; // Even indices are X, Odd are Y
        });
        return { type: cmd.type, values: newValues };
    });

    return { points: normalizedPoints, commands: normalizedCommands, originalWidth, originalHeight };
}

/**
 * Converts basic SVG shapes (<rect>, <circle>) into an equivalent SVG path 'd' string.
 * @param {SVGElement} el - The SVG shape element.
 * @returns {string|null} The path data string or null if the shape is not supported.
 */
function getPathDataFromShape(el) {
    if (el.tagName === 'rect') {
        const x = parseFloat(el.getAttribute('x'));
        const y = parseFloat(el.getAttribute('y'));
        const width = parseFloat(el.getAttribute('width'));
        const height = parseFloat(el.getAttribute('height'));
        return `M ${x} ${y} h ${width} v ${height} h ${-width} Z`;
    }
    if (el.tagName === 'circle') {
        const cx = parseFloat(el.getAttribute('cx'));
        const cy = parseFloat(el.getAttribute('cy'));
        const r = parseFloat(el.getAttribute('r'));
        return `M ${cx - r} ${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
    }
    return null;
}

const POINTS_OF_SAIL = [
    { angle: 10, speed: 0.0 },  // In Irons
    { angle: 50, speed: 0.5 },  // Close-hauled
    { angle: 70, speed: 0.5 },  // Close reach (flat part)
    { angle: 90, speed: 0.7 },  // Beam reach
    { angle: 120, speed: 1.0 }, // Broad reach
    { angle: 160, speed: 1.0 }, // Running (flat part)
    { angle: 180, speed: 0.85 } // Running by the lee
];

/**
 * Calculates the speed multiplier based on the angle off the wind.
 * @param {number} shipAngle - The ship's current angle in radians.
 * @param {number} windDirection - The current wind direction in radians.
 * @returns {number} A multiplier for speed.
 */
function getWindSpeedMultiplier(shipAngle, windDirection) {
    let angleDiff = normalizeAngle(shipAngle - windDirection);
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;

    const absAngleOffWindDegrees = Math.abs(angleDiff * 180 / Math.PI);

    if (absAngleOffWindDegrees <= POINTS_OF_SAIL[0].angle) {
        return POINTS_OF_SAIL[0].speed;
    }

    for (let i = 0; i < POINTS_OF_SAIL.length - 1; i++) {
        const p1 = POINTS_OF_SAIL[i];
        const p2 = POINTS_OF_SAIL[i + 1];

        if (absAngleOffWindDegrees <= p2.angle) {
            const angleRange = p2.angle - p1.angle;
            const speedRange = p2.speed - p1.speed;
            const progressInRange = (absAngleOffWindDegrees - p1.angle) / angleRange;
            return p1.speed + (progressInRange * speedRange);
        }
    }

    return POINTS_OF_SAIL[POINTS_OF_SAIL.length - 1].speed; // Fallback for 180 degrees
}

/**
 * Darkens a color string (HSL or Hex) by a given percentage.
 * @param {string} colorStr - The color string (e.g., 'hsl(120, 50%, 75%)' or '#RRGGBB').
 * @param {number} percent - The percentage to darken (e.g., 10 for 10%).
 * @returns {string} The new, darkened color string in the original format.
 */
function darkenColor(colorStr, percent) {
    // Check if it's an HSL string
    const hslMatch = colorStr.match(/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
    if (hslMatch) {
        let [, h, s, l] = hslMatch.map(Number);
        l = Math.max(0, l - percent); // Reduce lightness
        return `hsl(${h}, ${s}%, ${l}%)`;
    }

    // --- FIX: Add support for RGB strings ---
    const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
        let [, r, g, b] = rgbMatch.map(Number);
        const factor = 1 - (percent / 100);
        return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
    }

    // Check if it's a Hex string
    const hexMatch = colorStr.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (hexMatch) {
        let r = parseInt(hexMatch[1], 16);
        let g = parseInt(hexMatch[2], 16);
        let b = parseInt(hexMatch[3], 16);

        // Convert to HSL to darken
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        // Darken the lightness value
        l = Math.max(0, l - (percent / 100));

        // Convert back to RGB and then to Hex
        const toHex = c => ('0' + Math.round(c * 255).toString(16)).slice(-2);
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hue2rgb = (p, q, t) => { if(t < 0) t += 1; if(t > 1) t -= 1; if(t < 1/6) return p + (q - p) * 6 * t; if(t < 1/2) return q; if(t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; };
        return `#${toHex(hue2rgb(p, q, h + 1/3))}${toHex(hue2rgb(p, q, h))}${toHex(hue2rgb(p, q, h - 1/3))}`;
    }

    return colorStr; // Return original if format is unknown
}

/**
 * Lightens a color string (HSL or Hex) by a given percentage.
 * @param {string} colorStr - The color string (e.g., 'hsl(120, 50%, 75%)' or '#RRGGBB').
 * @param {number} percent - The percentage to lighten (e.g., 10 for 10%).
 * @returns {string} The new, lightened color string in the original format.
 */
function lightenColor(colorStr, percent) {
    // Check if it's an HSL string
    const hslMatch = colorStr.match(/hsl\((\d+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
    if (hslMatch) {
        let [, h, s, l] = hslMatch.map(Number);
        l = Math.min(100, l + percent); // Increase lightness
        return `hsl(${h}, ${s}%, ${l}%)`;
    }

    // For other formats, we can simply call darkenColor with a negative percentage.
    // This avoids duplicating the complex Hex conversion logic.
    return darkenColor(colorStr, -percent);
}


/**
 * Finds the best angle to tack at by maximizing Velocity Made Good (VMG) towards a target.
 * @param {number} tackDirection - The side to tack on (1 for starboard, -1 for port).
 * @param {number} upwindAngle - The direction the wind is coming from.
 * @param {{x: number, y: number}} targetPos - The position of the target waypoint.
 * @param {{x: number, y: number}} currentPos - The current position of the ship.
 * @param {Ship} ship - The ship instance, for its speed properties.
 * @param {number} windDirection - The current global wind direction.
 * @returns {number} The optimal sailing angle in radians.
 */
function findBestTackAngleForVMG(tackDirection, upwindAngle, targetPos, currentPos, ship, windDirection, pathfinder) {
    // --- FIX: Use ship-specific close-hauled angle ---
    const startAngle = (typeof ship.getCloseHauledAngle === 'function') ? ship.getCloseHauledAngle() : NPC_TACK_ANGLE_SEARCH_START;
    
    // --- Optimization: Dynamic Search Range & Precision ---
    const searchRange = 50 * (Math.PI / 180); // Search 50 degrees beyond close-hauled
    const maxSearchAngle = 110 * (Math.PI / 180); // Cap search at 110 degrees (broad reach)
    const endAngle = Math.min(startAngle + searchRange, maxSearchAngle);
    const increment = 3 * (Math.PI / 180); // Finer 3-degree increment

    let bestAngle = normalizeAngle(upwindAngle + (tackDirection * startAngle));
    let maxVmg = -Infinity;
    const angleToWaypoint = Math.atan2(targetPos.y - currentPos.y, targetPos.x - currentPos.x);

    // Reset debug data if the array exists
    if (ship.debugVMGData) {
        ship.debugVMGData.length = 0;
    }

    // Iterate through a range of possible tacking angles to find the most effective one.
    for (let angle = startAngle; angle <= endAngle; angle += increment) {
        const sailingAngle = normalizeAngle(upwindAngle + (tackDirection * angle));

        // --- NEW: Proactive Safety Check ---
        // Before calculating VMG, check if this angle is safe to maneuver into.
        if (pathfinder && typeof ship._isManeuverSafe === 'function' && !ship._isManeuverSafe(sailingAngle, pathfinder)) {
            continue; // This angle is blocked, skip to the next one.
        }
        
        // Calculate the ship's speed at this potential sailing angle.
        const speedMultiplier = (typeof ship.getWindSpeedMultiplier === 'function') ? ship.getWindSpeedMultiplier(sailingAngle, windDirection) : getWindSpeedMultiplier(sailingAngle, windDirection);
        const speedAtAngle = ship.baseSpeed * speedMultiplier * ship.sailingSkill;

        // Calculate the angle between our sailing direction and the direct line to the waypoint.
        let closingAngle = normalizeAngle(sailingAngle - angleToWaypoint);
        if (closingAngle > Math.PI) closingAngle -= 2 * Math.PI;

        // VMG is the component of our velocity that is pointed directly at the waypoint.
        const vmg = speedAtAngle * Math.cos(closingAngle);

        if (vmg > maxVmg) {
            maxVmg = vmg;
            bestAngle = sailingAngle;
        }

        // Collect debug data if enabled
        if (ship.debugVMGData && typeof DEBUG !== 'undefined' && DEBUG.ENABLED && DEBUG.DRAW_VMG_DATA) {
            ship.debugVMGData.push({
                angle: sailingAngle,
                vmg: vmg,
                isBest: false
            });
        }
    }

    // Mark the best angle in debug data
    if (ship.debugVMGData && ship.debugVMGData.length > 0) {
        const bestEntry = ship.debugVMGData.reduce((prev, curr) => 
            Math.abs(curr.vmg - maxVmg) < Math.abs(prev.vmg - maxVmg) ? curr : prev
        );
        if (bestEntry) bestEntry.isBest = true;
    }
    return bestAngle;
}

/**
 * Creates a debounced function that delays invoking `func` until after `wait` milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The number of milliseconds to delay.
 * @returns {Function} The debounced function.
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Linearly interpolates between two angles, finding the shortest path.
 * @param {number} startAngle - The starting angle in radians.
 * @param {number} endAngle - The ending angle in radians.
 * @param {number} t - The interpolation factor (0.0 to 1.0).
 * @returns {number} The interpolated angle in radians.
 */
function lerpAngle(startAngle, endAngle, t) {
    let diff = endAngle - startAngle;
    // Find the shortest path by checking if the difference is more than half a circle
    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;
    // The final angle is the start angle plus the scaled shortest difference
    return startAngle + diff * t;
}

/**
 * Finds the closest point on a polygon's boundary to a given point.
 * @param {{x: number, y: number}} point - The point to check.
 * @param {Array<{x: number, y: number}>} polygon - The vertices of the polygon.
 * @returns {{x: number, y: number}} The closest point on the boundary.
 */
function getClosestPointOnPolygon(point, polygon) {
    if (!polygon || polygon.length === 0) return point;

    let minDistSq = Infinity;
    let closestPoint = polygon[0];

    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % polygon.length];
        
        // Project point onto line segment p1-p2
        const l2 = (p2.x - p1.x)**2 + (p2.y - p1.y)**2;
        if (l2 === 0) {
            const dSq = (point.x - p1.x)**2 + (point.y - p1.y)**2;
            if (dSq < minDistSq) {
                minDistSq = dSq;
                closestPoint = p1;
            }
            continue;
        }

        let t = ((point.x - p1.x) * (p2.x - p1.x) + (point.y - p1.y) * (p2.y - p1.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        
        const projX = p1.x + t * (p2.x - p1.x);
        const projY = p1.y + t * (p2.y - p1.y);
        
        const dSq = (point.x - projX)**2 + (point.y - projY)**2;
        
        if (dSq < minDistSq) {
            minDistSq = dSq;
            closestPoint = { x: projX, y: projY };
        }
    }
    return closestPoint;
}

/**
 * Finds the closest point on a polygon's boundary to a given point.
 * @param {{x: number, y: number}} point - The point to check.
 * @param {Array<{x: number, y: number}>} polygon - The vertices of the polygon.
 * @returns {{x: number, y: number}} The closest point on the boundary.
 */
function getClosestPointOnPolygon(point, polygon) {
    if (!polygon || polygon.length === 0) return point;

    let minDistSq = Infinity;
    let closestPoint = polygon[0];

    for (let i = 0; i < polygon.length; i++) {
        const p1 = polygon[i];
        const p2 = polygon[(i + 1) % polygon.length];
        
        // Project point onto line segment p1-p2
        const l2 = (p2.x - p1.x)**2 + (p2.y - p1.y)**2;
        if (l2 === 0) {
            const dSq = (point.x - p1.x)**2 + (point.y - p1.y)**2;
            if (dSq < minDistSq) {
                minDistSq = dSq;
                closestPoint = p1;
            }
            continue;
        }

        let t = ((point.x - p1.x) * (p2.x - p1.x) + (point.y - p1.y) * (p2.y - p1.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        
        const projX = p1.x + t * (p2.x - p1.x);
        const projY = p1.y + t * (p2.y - p1.y);
        
        const dSq = (point.x - projX)**2 + (point.y - projY)**2;
        
        if (dSq < minDistSq) {
            minDistSq = dSq;
            closestPoint = { x: projX, y: projY };
        }
    }
    return closestPoint;
}
