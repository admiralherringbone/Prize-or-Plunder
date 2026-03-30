/**
 * @file Generates complex island shapes using a ribbon/extrusion method along a spline.
 * This allows for 'C', 'S', and other non-elliptical island forms.
 */
class IslandShapeGenerator {

    /**
     * Generates a polygon for a complex island shape.
     * @param {number} centerX - World X center.
     * @param {number} centerY - World Y center.
     * @param {number} scale - Approximate scale/radius of the island.
     * @param {string} [type='random'] - 'c-shape', 's-shape', 'random'.
     * @returns {Array<{x: number, y: number}>} Vertices of the generated polygon.
     */
    static generate(centerX, centerY, scale, type = 'random') {
        let spinePoints = [];

        if (type === 'random') {
            const r = Math.random();
            if (r < 0.25) type = 'universal';
            else if (r < 0.40) type = 'c-shape';
            else if (r < 0.55) type = 's-shape';
            else if (r < 0.70) type = 'crook-shape';
            else if (r < 0.85) type = 'bean-shape';
            else if (r < 0.93) type = 'snake-shape';
            else type = 'universal';
        }

        let widthProfile = null; // Default to null (standard taper)

        if (type === 'c-shape') {
            spinePoints = this._generateCShapeSpine(centerX, centerY, scale);
        } else if (type === 's-shape') {
            spinePoints = this._generateSShapeSpine(centerX, centerY, scale);
            
            // VARIETY: Occasional "Pinched" middle (Dumbbell/Bone shape)
            // 40% chance to have thicker lobes and a thinner connecting isthmus
            if (Math.random() < 0.4) {
                widthProfile = (t) => {
                    // Base sine taper (0 at ends, 1 at middle)
                    const taper = Math.sin(t * Math.PI);
                    // Pinch factor: 1.0 at ends, dips to ~0.6 at middle (t=0.5)
                    const pinch = 1.0 - 0.4 * Math.sin(t * Math.PI);
                    // Combine: Ensure minimum width (0.25) + Scaled Taper
                    return 0.25 + (0.75 * taper * pinch);
                };
            }
        } else if (type === 'crook-shape') {
            spinePoints = this._generateCrookShapeSpine(centerX, centerY, scale);
        } else if (type === 'bean-shape') {
            spinePoints = this._generateBeanShapeSpine(centerX, centerY, scale);
            
            // VARIETY: Randomize width of ends (bulge size)
            const startWidth = 1.3 + Math.random() * 1.0; // 1.3 to 2.3 (Thicker/Stouter)
            const endWidth = 1.3 + Math.random() * 1.0;   // 1.3 to 2.3
            
            widthProfile = (t) => {
                const base = startWidth * (1 - t) + endWidth * t;
                return base - 0.25 * Math.sin(t * Math.PI); // Less pinch relative to width
            };
        } else if (type === 'snake-shape') {
            spinePoints = this._generateSnakeShapeSpine(centerX, centerY, scale);
            
            // VARIETY: Randomized Thickness Profile
            // Base thickness varies, plus a sine wave wobble along the length
            const baseThick = 0.3 + Math.random() * 0.4; // 0.3 to 0.7 base width
            const wobbleFreq = 1 + Math.random() * 3; // How many bulges
            const wobbleAmp = Math.random() * 0.2; // How distinct the bulges are

            widthProfile = (t) => {
                // Sine taper at ends (standard)
                const taper = Math.sin(t * Math.PI); 
                // Body variation
                const body = baseThick + Math.sin(t * Math.PI * wobbleFreq) * wobbleAmp;
                // Combine: Body thickness * taper (sqrt taper for fuller ends)
                return body * Math.pow(taper, 0.4);
            };
        } else if (type === 'universal') {
            // --- NEW: Universal Procedural Island ---
            // Uses a parametric spine walker to generate unique shapes.
            spinePoints = this._generateUniversalSpine(centerX, centerY, scale);
            
            // Randomize Width Profile
            const profileType = Math.random();
            if (profileType < 0.25) {
                // Tapered (Tail)
                widthProfile = (t) => 1.2 - (t * 0.8);
            } else if (profileType < 0.5) {
                // Bulge (Bean-like)
                widthProfile = (t) => 0.6 + 0.6 * Math.sin(t * Math.PI);
            } else if (profileType < 0.75) {
                // Hourglass (Pinched)
                widthProfile = (t) => 1.0 - 0.4 * Math.sin(t * Math.PI);
            } else {
                // Random wobble
                const freq = 1 + Math.random() * 3;
                widthProfile = (t) => 0.8 + 0.3 * Math.sin(t * Math.PI * freq);
            };
        }

        // Interpolate the spine to get a smooth curve
        // --- OPTIMIZATION: Dynamic LOD based on scale ---
        // Small islands don't need many segments. Large ones need more, but we cap it for performance.
        // Reduced density (scale/120) and added a hard cap (40) to prevent sharp saw-tooth edges.
        const segments = Math.max(8, Math.min(40, Math.ceil(scale / 120)));
        const smoothSpine = this._interpolateSpine(spinePoints, segments); 

        // Extrude to create the polygon
        // Width is roughly 30-40% of the scale for a decent landmass
        let polygon = this._extrudePolygon(smoothSpine, scale * 0.4, widthProfile); 

        // --- FIX: Clean extrusion immediately to fix overlapping inner curves ---
        polygon = this._fixSelfIntersections(polygon);

        // Roughen the edges to simulate coastline
        // Increased base jitter (0.005 -> 0.015) to make shoreline rougher while relying on stability map for safety.
        let irregularPolygon = this._roughenPolygon(polygon, scale * 0.015);

        // --- FIX: Resolve self-intersections to prevent visual glitches ---
        irregularPolygon = this._fixSelfIntersections(irregularPolygon);

        // --- NEW: Smooth the result to round off sharp corners from clipping ---
        irregularPolygon = this._smoothPolygon(irregularPolygon, 2);

        // --- FIX: Final validation before returning ---
        // Ensure the generated shape is valid (at least 3 points, no NaNs)
        if (!irregularPolygon || irregularPolygon.length < 3 || irregularPolygon.some(p => isNaN(p.x) || isNaN(p.y))) {
            console.warn("[IslandShapeGenerator] Generated invalid irregular polygon. Returning null.");
            return { shape: null, proxy: null };
        }

        return { shape: irregularPolygon, proxy: polygon }; // Return the valid shape and its proxy
    }

    /**
     * Generates control points for a C-shaped spine (Quadratic Bezier).
     */
    static _generateCShapeSpine(cx, cy, scale) {
        // Random orientation
        const angle = Math.random() * Math.PI * 2;
        const backAngle = angle + Math.PI;
        
        // VARIETY: Choose between "Crescent" (Quadratic) and "Capital C" (Cubic)
        // The Capital C creates a deep bay with ends that nearly touch.
        const isCapitalC = Math.random() < 0.5;

        if (isCapitalC) {
            // --- Capital C (Cubic Bezier) ---
            // Spread: 4.5 to 5.5 radians (Very closed, almost a circle)
            const spread = 4.5 + Math.random() * 1.0; 
            const asymmetry = (Math.random() - 0.5) * 0.5;
            
            const startAngle = angle - (spread / 2) + asymmetry;
            const endAngle = angle + (spread / 2) + asymmetry;

            // Scale: Back is deep, tips are standard
            const tipScale = scale * (0.9 + Math.random() * 0.2);
            const backScale = scale * (1.4 + Math.random() * 0.4); 

            const p0 = {
                x: cx + Math.cos(startAngle) * tipScale,
                y: cy + Math.sin(startAngle) * tipScale
            };
            
            const p3 = {
                x: cx + Math.cos(endAngle) * tipScale,
                y: cy + Math.sin(endAngle) * tipScale
            };

            // Control Points: Spaced along the back arc to create a structured curve
            const p1Angle = startAngle + (spread * 0.35);
            const p2Angle = endAngle - (spread * 0.35);

            const p1 = { x: cx + Math.cos(p1Angle) * backScale, y: cy + Math.sin(p1Angle) * backScale };
            const p2 = { x: cx + Math.cos(p2Angle) * backScale, y: cy + Math.sin(p2Angle) * backScale };

            return [p0, p1, p2, p3];

        } else {
            // --- Crescent (Quadratic Bezier) ---
            // Spread: 2.0 to 4.0 radians (Open to Horseshoe)
            const spread = 2.0 + Math.random() * 2.0; 
            const asymmetry = (Math.random() - 0.5) * 0.8;
            
            const startAngle = angle - (spread / 2) + asymmetry;
            const endAngle = angle + (spread / 2) + asymmetry;
            const depthMult = 1.3 + Math.random() * 0.7;

            // Start Point (One tip of the C)
            const p0 = {
                x: cx + Math.cos(startAngle) * scale,
                y: cy + Math.sin(startAngle) * scale
            };
            
            // Control Point (Back of the C)
            const p1 = {
                x: cx + Math.cos(backAngle) * (scale * depthMult), 
                y: cy + Math.sin(backAngle) * (scale * depthMult)
            };

            // End Point (Other tip)
            const p2 = {
                x: cx + Math.cos(endAngle) * scale,
                y: cy + Math.sin(endAngle) * scale
            };

            return [p0, p1, p2];
        }
    }

    /**
     * Generates control points for an S-shaped spine (Cubic Bezier).
     */
    static _generateSShapeSpine(cx, cy, scale) {
        const angle = Math.random() * Math.PI * 2;
        
        // VARIETY: Axis Bend (Ends aren't perfectly 180 deg apart)
        const bend = (Math.random() - 0.5) * 0.8; // +/- ~23 degrees
        const backAngle = angle + Math.PI + bend;

        // Direction perpendicular to main axis
        const perp = angle + Math.PI / 2;

        // VARIETY: Skew Control Points (Not perfectly perpendicular)
        // This tilts the loops of the S
        const skew1 = (Math.random() - 0.5) * 0.6;
        const skew2 = (Math.random() - 0.5) * 0.6;

        // VARIETY: Uneven ends (one lobe larger/longer than other)
        const scaleStart = scale * (0.8 + Math.random() * 0.4);
        const scaleEnd = scale * (0.8 + Math.random() * 0.4);

        // VARIETY: Independent curve intensities
        // Range: 0.5 (Slight) to 2.2 (Full) to create varied "bends"
        const intensity1 = scale * (0.5 + Math.random() * 1.7);
        const intensity2 = scale * (0.5 + Math.random() * 1.7);

        // Start and End are on opposite sides
        const p0 = {
            x: cx + Math.cos(angle) * scaleStart,
            y: cy + Math.sin(angle) * scaleStart
        };
        
        const p3 = {
            x: cx + Math.cos(backAngle) * scaleEnd,
            y: cy + Math.sin(backAngle) * scaleEnd
        };

        // Control points push in opposite perpendicular directions to create the S wave
        const p1 = {
            x: cx + Math.cos(perp + skew1) * intensity1,
            y: cy + Math.sin(perp + skew1) * intensity1
        };

        const p2 = {
            x: cx + Math.cos(perp + Math.PI + skew2) * intensity2,
            y: cy + Math.sin(perp + Math.PI + skew2) * intensity2
        };

        return [p0, p1, p2, p3];
    }

    /**
     * Generates control points for a Crook-shaped spine (Cubic Bezier).
     * Creates a straight handle that curves into a hook at the end.
     */
    static _generateCrookShapeSpine(cx, cy, scale) {
        const angle = Math.random() * Math.PI * 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        // Randomize hook direction (Left or Right relative to shaft)
        const hookDir = Math.random() < 0.5 ? 1 : -1;
        const perp = angle + (Math.PI / 2 * hookDir);
        const pCos = Math.cos(perp);
        const pSin = Math.sin(perp);

        // P0: Handle Base (Tail) - Positioned behind center
        const p0 = {
            x: cx - cos * scale * 1.0,
            y: cy - sin * scale * 1.0
        };

        // P1: Neck (Start of curve) - Positioned forward along the angle
        // Keeping P0 and P1 aligned creates the straight handle look.
        const p1 = {
            x: cx + cos * scale * 0.4,
            y: cy + sin * scale * 0.4
        };

        // P2: Hook Arch - Pushes out to the side and further forward
        const p2 = {
            x: cx + cos * scale * 0.8 + pCos * scale * 1.0,
            y: cy + sin * scale * 0.8 + pSin * scale * 1.0
        };

        // P3: Hook Tip - Curves back down
        const p3 = {
            x: cx + cos * scale * 0.0 + pCos * scale * 0.7,
            y: cy + sin * scale * 0.0 + pSin * scale * 0.7
        };

        return [p0, p1, p2, p3];
    }

    /**
     * Generates control points for a Bean-shaped spine (Quadratic Bezier).
     * Similar to a C-shape but with parameters tuned for a kidney/peanut look.
     */
    static _generateBeanShapeSpine(cx, cy, scale) {
        const angle = Math.random() * Math.PI * 2;
        const backAngle = angle + Math.PI;
        
        // Moderate spread for a kidney bean shape (not too closed)
        const spread = 2.0 + Math.random() * 1.0; 
        const asymmetry = (Math.random() - 0.5) * 0.5;
        const startAngle = angle - (spread / 2) + asymmetry;
        const endAngle = angle + (spread / 2) + asymmetry;

        // Pull back slightly less than C-shape to avoid looking like a ring
        const depthMult = 0.6 + Math.random() * 0.3; 

        // VARIETY: Uneven lobe lengths (distance from center)
        const startScale = scale * (0.6 + Math.random() * 0.4); // 0.6 to 1.0 (Shorter spine)
        const endScale = scale * (0.6 + Math.random() * 0.4);   // 0.6 to 1.0

        const p0 = { x: cx + Math.cos(startAngle) * startScale, y: cy + Math.sin(startAngle) * startScale };
        const p1 = { x: cx + Math.cos(backAngle) * (scale * depthMult), y: cy + Math.sin(backAngle) * (scale * depthMult) };
        const p2 = { x: cx + Math.cos(endAngle) * endScale, y: cy + Math.sin(endAngle) * endScale };

        return [p0, p1, p2];
    }

    /**
     * Generates a "Snake" or "Ribbon" spine with variable points, wiggle, and jitter.
     * Uses 5-8 control points to define a complex, meandering shape.
     */
    static _generateSnakeShapeSpine(cx, cy, scale) {
        const numPoints = Math.floor(5 + Math.random() * 4); // 5 to 8 points
        const points = [];
        
        // Random primary axis orientation
        const angle = Math.random() * Math.PI * 2;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        
        // Perpendicular vector for wiggle
        const px = -dy;
        const py = dx;

        const totalLength = scale * (1.8 + Math.random() * 0.6); // 1.8x to 2.4x radius length
        const step = totalLength / (numPoints - 1);

        // Start position relative to center
        const startDist = -totalLength / 2;

        // Wiggle parameters
        const wiggleFreq = Math.PI * (1 + Math.random() * 1.5); // 0.5 to 1.25 waves
        const wiggleAmp = scale * (0.2 + Math.random() * 0.3); // Amplitude relative to scale

        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);
            const dist = startDist + i * step;
            
            // Base Position + Wiggle + Random Jitter
            const wiggleOffset = Math.sin(t * wiggleFreq) * wiggleAmp;
            const jitterX = (Math.random() - 0.5) * (scale * 0.25);
            const jitterY = (Math.random() - 0.5) * (scale * 0.25);

            points.push({
                x: cx + dx * dist + px * wiggleOffset + jitterX,
                y: cy + dy * dist + py * wiggleOffset + jitterY
            });
        }
        return points;
    }


    /**
     * --- NEW: Universal Parametric Spine Generator ---
     * Creates a spine using a random walker with controlled curvature.
     * Can mimic C, S, and Snake shapes procedurally.
     */
    static _generateUniversalSpine(cx, cy, scale) {
        const numPoints = Math.floor(4 + Math.random() * 4); // 4 to 7 control points
        const points = [];
        
        // Parameters
        let x = 0;
        let y = 0;
        let angle = Math.random() * Math.PI * 2;
        
        // Length: 1.5x to 2.5x radius
        const totalLen = scale * (1.5 + Math.random()); 
        const stepSize = totalLen / (numPoints - 1);
        
        // Curvature: Defines the overall "bend" of the island
        const curvatureBias = (Math.random() - 0.5) * 1.0; // -0.5 to 0.5 radians per step
        const wobbliness = Math.random() * 0.5; // Random deviation per step

        for (let i = 0; i < numPoints; i++) {
            points.push({x, y});
            
            x += Math.cos(angle) * stepSize;
            y += Math.sin(angle) * stepSize;
            
            angle += curvatureBias + (Math.random() - 0.5) * wobbliness;
        }
        
        // Center the spine
        const avgX = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const avgY = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        
        return points.map(p => ({ x: p.x - avgX + cx, y: p.y - avgY + cy }));
    }

    /**
     * Interpolates control points into a smooth path using Bezier curves.
     */
    static _interpolateSpine(controlPoints, segments) {
        const path = [];
        
        // If we have many points (Snake), use Catmull-Rom Spline
        // This ensures the curve passes THROUGH the control points.
        if (controlPoints.length > 4) {
            const catmullRom = (p0, p1, p2, p3, t) => {
                const v0 = (p2 - p0) * 0.5;
                const v1 = (p3 - p1) * 0.5;
                const t2 = t * t;
                const t3 = t * t2;
                return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
            };

            // Duplicate ends for phantom points to ensure the curve reaches the tips
            const pts = [controlPoints[0], ...controlPoints, controlPoints[controlPoints.length - 1]];
            const numSections = pts.length - 3;
            
            // Points per section
            const stepsPerSection = Math.ceil(segments / numSections);

            for (let i = 0; i < numSections; i++) {
                const p0 = pts[i];
                const p1 = pts[i+1];
                const p2 = pts[i+2];
                const p3 = pts[i+3];

                for (let j = 0; j < stepsPerSection; j++) {
                    // Avoid duplicating points at boundaries
                    if (i > 0 && j === 0) continue;

                    const t = j / stepsPerSection;
                    path.push({
                        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
                        y: catmullRom(p0.y, p1.y, p2.y, p3.y, t)
                    });
                }
            }
            // Add final point
            path.push(controlPoints[controlPoints.length - 1]);

            return path;
        }
        
        // Standard Bezier Logic for simple shapes (3 or 4 points)
        const isCubic = controlPoints.length === 4;
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            let x, y;

            if (isCubic) {
                const mt = 1 - t;
                const p0 = controlPoints[0], p1 = controlPoints[1], p2 = controlPoints[2], p3 = controlPoints[3];
                x = mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x;
                y = mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y;
            } else {
                // Quadratic
                const mt = 1 - t;
                const p0 = controlPoints[0], p1 = controlPoints[1], p2 = controlPoints[2];
                x = mt*mt*p0.x + 2*mt*t*p1.x + t*t*p2.x;
                y = mt*mt*p0.y + 2*mt*t*p1.y + t*t*p2.y;
            }
            path.push({x, y});
        }
        return path;
    }

    /**
     * Extrudes points perpendicular to the path to create a ribbon polygon.
     */
    static _extrudePolygon(path, maxWidth, widthProfile = null) {
        const leftSide = [];
        const rightSide = [];
        
        let startWidth, startNormal;
        let endWidth, endNormal;

        for (let i = 0; i < path.length; i++) {
            // Calculate direction (tangent)
            let dx, dy;
            if (i < path.length - 1) {
                dx = path[i+1].x - path[i].x;
                dy = path[i+1].y - path[i].y;
            } else {
                dx = path[i].x - path[i-1].x;
                dy = path[i].y - path[i-1].y;
            }
            
            const len = Math.sqrt(dx*dx + dy*dy);
            if (len === 0) continue;

            const nx = -dy / len; // Normal
            const ny = dx / len;

            // Width profile: Taper at ends (sine wave)
            // t goes from 0 to 1
            const t = i / (path.length - 1);
            
            // Width Profile:
            // 0.2 base width (so tips aren't infinitely sharp)
            // + 0.8 sine wave (thickest in middle)
            // Add some noise to width so it's not a perfect tube
            let baseWidthFactor;
            if (widthProfile) {
                baseWidthFactor = widthProfile(t);
            } else {
                baseWidthFactor = 0.2 + 0.8 * Math.sin(t * Math.PI);
            }
            const noise = 1.0 + (Math.random() - 0.5) * 0.2; 
            const width = maxWidth * baseWidthFactor * noise;

            // Capture data for caps
            if (i === 0) {
                startWidth = width;
                startNormal = { x: nx, y: ny };
            }
            if (i === path.length - 1) {
                endWidth = width;
                endNormal = { x: nx, y: ny };
            }

            // Extrude
            leftSide.push({
                x: path[i].x + nx * width,
                y: path[i].y + ny * width
            });
            rightSide.push({
                x: path[i].x - nx * width,
                y: path[i].y - ny * width
            });
        }

        // --- NEW: Generate Rounded Caps ---
        const generateCap = (center, normal, radius, fromRightToLeft) => {
            const points = [];
            const steps = 6; // Low poly count for the cap to match the island style
            const angleN = Math.atan2(normal.y, normal.x);
            
            let startAngle, endAngle;
            
            if (fromRightToLeft) {
                // Start Cap: Sweep from Right (-Normal) around Back to Left (Normal)
                // This corresponds to decreasing angle: -PI/2 -> -PI -> -3PI/2 (relative to Tangent)
                // Using normal angle: AngleN + PI -> AngleN
                startAngle = angleN + Math.PI;
                endAngle = angleN; 
            } else {
                // End Cap: Sweep from Left (Normal) around Front to Right (-Normal)
                // Using normal angle: AngleN -> AngleN - PI
                startAngle = angleN;
                endAngle = angleN - Math.PI;
            }

            for (let i = 1; i < steps; i++) {
                const t = i / steps;
                const a = startAngle + (endAngle - startAngle) * t;
                
                // VARIETY: Cap Irregularity
                // Jitter the radius (0.7x to 1.3x) to prevent perfect semi-circles.
                const r = radius * (0.7 + Math.random() * 0.6);
                points.push({ x: center.x + Math.cos(a) * r, y: center.y + Math.sin(a) * r });
            }
            return points;
        };

        const startCap = generateCap(path[0], startNormal, startWidth, true);
        const endCap = generateCap(path[path.length - 1], endNormal, endWidth, false);

        // Combine: Left -> EndCap -> Right(Reversed) -> StartCap
        return leftSide.concat(endCap, rightSide.reverse(), startCap);
    }

    /**
     * Adds irregularity to the polygon edges.
     */
    static _roughenPolygon(polygon, maxMagnitude) {
        const newPoly = [];
        const len = polygon.length;

        // --- NEW: Calculate Jitter Stability Factors ---
        // 1. Determine winding order (Area)
        let area = 0;
        for (let i = 0; i < len; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % len];
            area += (p1.x * p2.y - p2.x * p1.y);
        }
        // In screen coords (Y-down): Area < 0 is CW, Area > 0 is CCW.
        const isCW = area < 0;

        // 2. Calculate concavity factor per vertex
        const stability = new Float32Array(len);
        for (let i = 0; i < len; i++) {
            const prev = polygon[(i - 1 + len) % len];
            const curr = polygon[i];
            const next = polygon[(i + 1) % len];

            const ux = curr.x - prev.x;
            const uy = curr.y - prev.y;
            const vx = next.x - curr.x;
            const vy = next.y - curr.y;

            // Cross product (2D)
            const cp = ux * vy - uy * vx;

            // Screen Coords: Right Turn => CP > 0. Left Turn => CP < 0.
            // If CW: Right turns are Convex. Left turns (CP < 0) are Concave.
            // If CCW: Left turns (CP < 0) are Convex. Right turns (CP > 0) are Concave.
            
            const isConcave = isCW ? (cp < 0) : (cp > 0);

            if (isConcave) {
                // Sharp concave turns get 0 stability (no jitter).
                // We normalize magnitude approx by distance to get a rough 'sin(theta)'
                const dist = Math.hypot(ux, uy) * Math.hypot(vx, vy);
                const sinTheta = Math.abs(cp) / (dist || 1);
                // Heavily penalize concave areas
                stability[i] = Math.max(0, 1.0 - (sinTheta * 4.0));
            } else {
                stability[i] = 1.0;
            }
        }

        // 3. Smooth factors (Box Blur) to create the "slowly introduce" gradient
        const smoothedStability = new Float32Array(len);
        // 3 iterations of smoothing
        for (let iter = 0; iter < 3; iter++) {
            for (let i = 0; i < len; i++) {
                const prev = stability[(i - 1 + len) % len];
                const curr = stability[i];
                const next = stability[(i + 1) % len];
                smoothedStability[i] = (prev + 2 * curr + next) / 4;
            }
            stability.set(smoothedStability);
        }

        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];
            const nextI = (i + 1) % len;

            // --- NEW: Proportional Jitter ---
            // Calculate edge length. Limit jitter to a fraction (30%) of this length.
            // This prevents vertices from crossing over each other in tight inner curves.
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            
            // Scale by stability factor of the vertex
            const s1 = stability[i];
            const s2 = stability[nextI];
            const sMid = (s1 + s2) / 2;
            
            const effectiveMagP1 = Math.min(maxMagnitude, dist * 0.3) * s1;
            const effectiveMagMid = Math.min(maxMagnitude, dist * 0.3) * sMid;

            // Add the original point (jittered)
            newPoly.push({
                x: p1.x + (Math.random() - 0.5) * effectiveMagP1,
                y: p1.y + (Math.random() - 0.5) * effectiveMagP1
            });

            // Subdivide: Add a midpoint with jitter
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            newPoly.push({
                x: midX + (Math.random() - 0.5) * effectiveMagMid,
                y: midY + (Math.random() - 0.5) * effectiveMagMid
            });
        }
        return newPoly;
    }

    /**
     * Fixes self-intersections using ClipperLib to ensure clean geometry.
     * This prevents wave rendering glitches where lines cross.
     */
    static _fixSelfIntersections(points) {
        if (typeof ClipperLib === 'undefined') return points;

        const scale = 100;
        const path = points.map(p => ({X: Math.round(p.x * scale), Y: Math.round(p.y * scale)}));
        
        // SimplifyPolygon resolves self-intersections (loops)
        const solution = ClipperLib.Clipper.SimplifyPolygon(path, ClipperLib.PolyFillType.pftNonZero);

        if (!solution || solution.length === 0) return points;

        // If the polygon split into multiple islands, pick the largest one to keep the main body.
        let bestPath = solution[0];
        let maxArea = Math.abs(ClipperLib.Clipper.Area(bestPath));
        
        for (let i = 1; i < solution.length; i++) {
            const area = Math.abs(ClipperLib.Clipper.Area(solution[i]));
            if (area > maxArea) {
                maxArea = area;
                bestPath = solution[i];
            }
        }

        // --- OPTIMIZATION: Clean Polygon ---
        // Remove vertices that are too close to each other or collinear.
        // This reduces the load on the physics triangulation and shoreline renderer.
        // Increased to 2.5 (0.025 world units) for stricter control over micro-segments.
        const cleanedPath = ClipperLib.Clipper.CleanPolygon(bestPath, 2.5);

        return cleanedPath.map(p => ({x: p.X / scale, y: p.Y / scale}));
    }

    /**
     * Smooths the polygon by averaging vertex positions with their neighbors.
     * Rounds off sharp corners left by boolean operations.
     */
    static _smoothPolygon(points, iterations = 1) {
        let currentPoints = points;
        for (let iter = 0; iter < iterations; iter++) {
            const nextPoints = [];
            const len = currentPoints.length;
            for (let i = 0; i < len; i++) {
                const prev = currentPoints[(i - 1 + len) % len];
                const curr = currentPoints[i];
                const next = currentPoints[(i + 1) % len];

                // Simple Laplacian smoothing (moving toward average of neighbors)
                nextPoints.push({
                    x: (prev.x + 2 * curr.x + next.x) / 4,
                    y: (prev.y + 2 * curr.y + next.y) / 4
                });
            }
            currentPoints = nextPoints;
        }
        return currentPoints;
    }
}

// Expose to global scope
window.IslandShapeGenerator = IslandShapeGenerator;
