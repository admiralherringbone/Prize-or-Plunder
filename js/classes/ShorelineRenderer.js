/**
 * Handles the rendering of the dynamic shore break waves and foam effects around islands.
 */
class ShorelineRenderer {
    constructor() {
        this.waveGridPattern = null;
        // --- OPTIMIZATION: Shared Geometry Buffers ---
        // Pre-allocate buffers to store the calculated wave edge points.
        // 4096 points is enough for a very large island perimeter.
        this.maxPoints = 4096;
        this.xBuffer = new Float32Array(this.maxPoints);
        this.yBuffer = new Float32Array(this.maxPoints);
        this.distBuffer = new Float32Array(this.maxPoints); // Stores distance for foam noise
        this.pointCount = 0;
    }

    /**
     * Renders the shore break effects for a single island.
     * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
     * @param {Island} island - The island to render waves for.
     * @param {number} time - The current game time in milliseconds.
     * @param {object} [viewport] - Optional {x, y, width, height} of the visible world area for culling.
     * @param {number} [scale=1.0] - Current view scale for LOD.
     */
    renderIsland(ctx, island, time, viewport = null, scale = 1.0) {
        ctx.save();

        // --- OPTIMIZATION: Buffer Resize Check ---
        // If we somehow exceeded our buffer in a previous frame, grow it.
        if (this.pointCount >= this.maxPoints) {
            this.maxPoints *= 2;
            this.xBuffer = new Float32Array(this.maxPoints);
            this.yBuffer = new Float32Array(this.maxPoints);
            this.distBuffer = new Float32Array(this.maxPoints);
            // console.log(`[ShorelineRenderer] Resized buffers to ${this.maxPoints}`);
        }

        // --- Initialize Wave Grid Pattern (Lazy Load) ---
        if (!this.waveGridPattern) {
            const pCanvas = document.createElement('canvas');
            pCanvas.width = GRID_SIZE;
            pCanvas.height = GRID_SIZE;
            const pCtx = pCanvas.getContext('2d');

            // Defensive check: If context creation fails, return early to prevent TypeError.
            // This can happen if the browser has exhausted its resources for canvases.
            if (!pCtx) {
                console.warn(`Failed to get 2D context for wave grid pattern. Wave effects will be disabled.`);
                ctx.restore(); // Ensure we don't leave the main context in a weird state.
                return;
            }
            pCtx.fillStyle = OCEAN_BLUE;
            pCtx.fillRect(0, 0, GRID_SIZE, GRID_SIZE);
            pCtx.strokeStyle = GRID_COLOR;
            pCtx.lineWidth = 1;
            pCtx.strokeRect(0, 0, GRID_SIZE, GRID_SIZE);
            this.waveGridPattern = ctx.createPattern(pCanvas, 'repeat');
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.lineJoin = 'round';

        if (island.outerPerimeterPoints) {
                // --- OPTIMIZATION: Viewport Culling ---
                // Skip processing if the island is completely off-screen.
                if (viewport && island.boundingRadius) {
                    const margin = island.boundingRadius * 0.3; // Add buffer for wave extension (1.2x + buffer)
                    if (island.x + island.boundingRadius + margin < viewport.x ||
                        island.x - island.boundingRadius - margin > viewport.x + viewport.width ||
                        island.y + island.boundingRadius + margin < viewport.y ||
                        island.y - island.boundingRadius - margin > viewport.y + viewport.height) {
                        ctx.restore();
                        return;
                    }
                }

                const perimeter = island.outerPerimeterPoints;
                const ribbonLen = perimeter.length;

                // Calculate Visual Center for Scaling
                let cx = island.x;
                let cy = island.y;
                if (island.boundingRect) {
                    cx = (island.boundingRect.minX + island.boundingRect.maxX) / 2;
                    cy = (island.boundingRect.minY + island.boundingRect.maxY) / 2;
                }

                // --- OPTIMIZATION: Ensure Cache Exists ---
                if (!island.ribbonCache) {
                    const normals = new Float32Array(ribbonLen * 2);
                    const edgeNormals = new Float32Array(ribbonLen * 2); // Temp storage
                    const phases = new Float32Array(ribbonLen * 2);
                    const localCoords = new Float32Array(ribbonLen * 2);
                    const dists = new Float32Array(ribbonLen);

                    let totalDist = 0;
                    for (let i = 0; i < ribbonLen; i++) {
                        const p1 = perimeter[i];
                        const prev = perimeter[(i - 1 + ribbonLen) % ribbonLen];
                        const next = perimeter[(i + 1) % ribbonLen];

                        // Tangent & Normal
                        const dx = next.x - prev.x;
                        const dy = next.y - prev.y;
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        const nx = -dy / dist;
                        const ny = dx / dist;

                        edgeNormals[i * 2] = nx;
                        edgeNormals[i * 2 + 1] = ny;

                        // Phases for noise
                        const angle = (i / ribbonLen) * Math.PI * 2;
                        phases[i * 2] = angle * 6;
                        phases[i * 2 + 1] = angle * 14;

                        // Local Coords
                        localCoords[i * 2] = p1.x - cx;
                        localCoords[i * 2 + 1] = p1.y - cy;

                        // Distances
                        dists[i] = totalDist;
                        const dNextX = next.x - p1.x;
                        const dNextY = next.y - p1.y;
                        totalDist += Math.sqrt(dNextX * dNextX + dNextY * dNextY);
                    }

                    // Compute Vertex Normals (Average of adjacent edges) for smooth corners
                    for (let i = 0; i < ribbonLen; i++) {
                        const prevI = (i - 1 + ribbonLen) % ribbonLen;
                        let nx = edgeNormals[prevI * 2] + edgeNormals[i * 2];
                        let ny = edgeNormals[prevI * 2 + 1] + edgeNormals[i * 2 + 1];
                        const len = Math.sqrt(nx * nx + ny * ny) || 1;
                        normals[i * 2] = nx / len;
                        normals[i * 2 + 1] = ny / len;
                    }
                    island.ribbonCache = { normals, phases, localCoords, dists, totalPerimeter: totalDist };
                }

                const { normals, phases, localCoords, dists, totalPerimeter } = island.ribbonCache;
                
                const isRock = island.type === 'rock';
                const isSimpleWave = isRock || island.isSmall; // Treat small islands like rocks for wave count
                
                // --- NEW: Multi-Wave Loop ---
                // Draw two overlapping waves to eliminate downtime.
                
                // --- NEW: Randomize duration per island for irregularity ---
                if (!island.waveCycleDuration || (!isSimpleWave && !island.thirdWaveOffsetRatio)) {
                    // Random duration between 2800ms and 4800ms
                    island.waveCycleDuration = 2800 + Math.random() * 2000;
                    // Random phase for speed variance so islands don't pulse in sync
                    island.waveVariancePhase = Math.random() * Math.PI * 2;
                    // Randomize the gap between waves to distribute them (approx 1/3 and 2/3)
                    island.secondWaveOffsetRatio = 0.3 + Math.random() * 0.1;
                    island.thirdWaveOffsetRatio = 0.6 + Math.random() * 0.1;
                }
                const cycleDuration = island.waveCycleDuration;
                
                // --- NEW: Time Warping for "Surge & Linger" Rhythm ---
                // Warps time to create a consistent surge (fast start) and linger (slow end) for EACH wave.
                // Frequency: 2*PI / cycleDuration (Matches wave frequency)
                const warpFreq = (Math.PI * 2) / cycleDuration;
                // Amplitude reduced to ensure time always moves forward (monotonic)
                const warpAmp = cycleDuration * 0.12; 
                const timeWarp = Math.sin(time * warpFreq + (island.waveVariancePhase || 0)) * warpAmp;
                const effectiveTime = time + timeWarp;

                // --- NEW: "Sets" Logic (Amplitude Modulation) ---
                // Modulates the wave size over a longer period (e.g., every 5 waves) to simulate sets.
                const setFreq = (Math.PI * 2) / (cycleDuration * 5);
                const setIntensity = 0.85 + 0.15 * Math.sin(time * setFreq + (island.waveVariancePhase || 0));

                // Rocks and Small Islands get 2 waves: 1.1x (Outer), 1.0x (Inner)
                // Islands get 3 waves: 1.2x (Outer), 1.1x (Mid), 1.0x (Inner)
                // We define them in Back-to-Front order for correct layering (Painter's Algorithm)
                const waveOffsets = isSimpleWave 
                    ? [0, cycleDuration * island.secondWaveOffsetRatio] 
                    : [0, cycleDuration * island.secondWaveOffsetRatio, cycleDuration * island.thirdWaveOffsetRatio];
                const waveScales = isSimpleWave 
                    ? [1.1, 1.0] 
                    : [1.2, 1.1, 1.0];

                waveOffsets.forEach((offset, index) => {
                    const layerTime = effectiveTime + offset;
                    // Use linear time for texture animation to avoid "bullet time" stutter during the linger phase
                    const linearLayerTime = time + offset;
                    const timeSec = linearLayerTime / 1000;

                    // Wave Cycle Calculation
                    const rawPhase = (layerTime % cycleDuration) / cycleDuration;
                    const waveCycle = (Math.sin((rawPhase * Math.PI) - (Math.PI / 2)) + 1) / 2;

                    // Opacity Logic
                    let fadeFactor = 0;
                    if (waveCycle < 0.2) {
                        fadeFactor = waveCycle / 0.2;
                    } else if (waveCycle < 0.75) {
                        fadeFactor = 1.0;
                    } else {
                        fadeFactor = Math.max(0, 1.0 - ((waveCycle - 0.75) / 0.25));
                    }

                    // Optimization: Skip invisible waves
                    if (fadeFactor <= 0.01) return;

                    const waveAlpha = 0.9 * fadeFactor * setIntensity;
                    const foamAlpha = 1.0 * fadeFactor * setIntensity;
                    const waveStrokeFactor = 0.5 + (waveCycle * 2.0 * setIntensity);
                
                // --- Ripple Closure Correction ---
                const getBaseRipple = (d) => {
                    return Math.sin(d * 0.05 + timeSec * 2.0) * 1.5 +
                        Math.sin(d * 0.15 + timeSec * 5.0) * 1.2 +
                        Math.sin(d * 0.40 + timeSec * 12.0) * 1.0;
                };
                const startVal = getBaseRipple(0);
                const endVal = getBaseRipple(totalPerimeter);
                const closureCorrection = (endVal - startVal) / totalPerimeter;

                const getRipple = (d, amp) => {
                    const raw = getBaseRipple(d);
                    return (raw - (closureCorrection * d)) * amp;
                };

                // --- NEW: Macro Wave (Large scale organic distortion) ---
                // Breaks up the uniform outline with large, slow-moving bulges.
                const getBaseMacro = (d) => {
                    // --- NEW: Scale amplitude with wave set intensity ---
                    const amp1 = 10 * setIntensity;
                    const amp2 = 7.5 * setIntensity;
                    return Math.sin(d * 0.002 + timeSec * 0.5) * amp1 + 
                           Math.sin(d * 0.005 - timeSec * 0.2) * amp2;
                };
                const startMacro = getBaseMacro(0);
                const endMacro = getBaseMacro(totalPerimeter);
                const macroCorrection = (endMacro - startMacro) / totalPerimeter;

                const getMacroWave = (d) => {
                    if (isRock) return 0; // Disable macro bulge for rocks
                    const raw = getBaseMacro(d);
                    return raw - (macroCorrection * d);
                };

                const radius = island.boundingRadius || 100;
                
                const outerScale = waveScales[index];

                const targetInnerScale = 0.90;
                
                // --- NEW: Proportional Scaling Logic ---
                // Calculate the current scale factor based on the wave cycle.
                // This replaces the fixed 'baseWidth' to ensure waves scale with the island's aspect ratio.
                const expansionRatio = waveStrokeFactor / 2.5; // Normalize factor (0.0 to 1.0)
                const currentScale = outerScale - (outerScale - targetInnerScale) * expansionRatio;

                // --- 1. Draw Main Wave (Filled Ring with Cutout) ---
                ctx.save();
                ctx.translate(cx, cy);
                ctx.globalAlpha = waveAlpha; // Apply alpha per wave
                ctx.fillStyle = this.waveGridPattern;

                // --- STEP 1: Compute Inner Edge Geometry (The expensive part) ---
                // We calculate the points for the inner edge (where foam and ripples are) ONCE.
                this.pointCount = 0;
                const computeInnerEdge = (scale) => {
                    for (let i = 0; i < ribbonLen; i++) {
                        const nextI = (i + 1) % ribbonLen;
                        const x1 = localCoords[i * 2];
                        const y1 = localCoords[i * 2 + 1];
                        const x2 = localCoords[nextI * 2];
                        const y2 = localCoords[nextI * 2 + 1];

                        let d1 = dists[i];
                        let d2 = dists[nextI];
                        if (nextI < i) d2 += totalPerimeter;

                        const segLen = d2 - d1;
                        // --- OPTIMIZATION: Dynamic Level of Detail ---
                        // Reduce subdivision steps when the island is small on screen (low scale).
                        // The divisor increases as scale decreases, reducing 'steps'.
                        const baseDivisor = 15;
                        const lodDivisor = baseDivisor / Math.max(0.1, Math.sqrt(scale));
                        const steps = Math.ceil(segLen / lodDivisor);

                        const dx = x2 - x1;
                        const dy = y2 - y1;

                        const n1x = normals[i * 2];
                        const n1y = normals[i * 2 + 1];
                        const n2x = normals[nextI * 2];
                        const n2y = normals[nextI * 2 + 1];

                        // Note: We start from s=0 to include the start point of each segment.
                        // For the very first segment (i=0), this includes the start of the loop.
                        // For subsequent segments, s=0 is the same as s=steps of the previous segment,
                        // but calculating it ensures we don't have gaps if floating point math drifts slightly.
                        // Optimization: We could skip s=0 for i>0, but the overlap is harmless for drawing.
                        for (let s = 0; s <= steps; s++) {
                            const t = s / steps;
                            const px = x1 + dx * t;
                            const py = y1 + dy * t;

                            let nx = n1x + (n2x - n1x) * t;
                            let ny = n1y + (n2y - n1y) * t;
                            const len = Math.sqrt(nx * nx + ny * ny) || 1;
                            nx /= len; ny /= len;

                            const currentDist = d1 + segLen * t;
                            const r = getRipple(currentDist, 1.5);
                            const m = getMacroWave(currentDist);
                            
                            // --- NEW: Proportional Position Calculation ---
                            // 1. Scale the point towards the center (handles aspect ratio correctly).
                            // 2. Add physical noise (ripples/macro) along the normal vector.
                            // Note: 'nx' points inward. 'r' and 'm' are displacements.
                            // We add 'm' to push the wave further inward (bulge) or subtract to pull back.
                            const fx = px * scale + nx * (r + m * waveStrokeFactor);
                            const fy = py * scale + ny * (r + m * waveStrokeFactor);

                            // Store in buffer
                            if (this.pointCount < this.maxPoints) {
                                this.xBuffer[this.pointCount] = fx;
                                this.yBuffer[this.pointCount] = fy;
                                this.distBuffer[this.pointCount] = currentDist;
                                this.pointCount++;
                            }
                        }
                    }
                };

                // Execute computation
                computeInnerEdge(currentScale);

                // --- STEP 2: Draw Main Wave Shape ---
                ctx.beginPath();
                
                // 2a. Outer Edge (Fixed at outerScale - Simple Polygon)
                // We can just trace the ribbon points directly since there's no ripple/subdivision needed for the outer edge.
                for (let i = 0; i < ribbonLen; i++) {
                    const x = localCoords[i * 2] * outerScale;
                    const y = localCoords[i * 2 + 1] * outerScale;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.closePath();

                // 2b. Inner Edge (From Buffer)
                // We draw this in the same path to create the "hole" for the evenodd fill.
                if (this.pointCount > 0) {
                    ctx.moveTo(this.xBuffer[0], this.yBuffer[0]);
                    for (let i = 1; i < this.pointCount; i++) {
                        ctx.lineTo(this.xBuffer[i], this.yBuffer[i]);
                    }
                    ctx.closePath();
                }
                
                ctx.fill('evenodd');
                ctx.restore();

                // --- STEP 3: Draw Foam Strokes (Using Buffer) ---
                ctx.save();
                ctx.globalAlpha = foamAlpha;
                ctx.translate(cx, cy);
                    
                // --- OPTIMIZATION: Direct Draw (No Path2D Allocations) ---
                // We iterate the buffer for each layer to avoid creating garbage.
                // The cost of iteration is negligible compared to GC overhead.
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';

                // 1. Large Foam Pass
                // --- LOD: Only draw large foam when reasonably zoomed in ---
                if (!isRock && scale > 0.3) {
                    ctx.beginPath();
                    for (let i = 0; i < this.pointCount; i++) {
                        const currentDist = this.distBuffer[i];
                        const valL = Math.sin(currentDist * 0.015 - timeSec * 0.2) +
                                     Math.sin(currentDist * 0.02 + timeSec * 0.1) * 0.5;
                        if (valL > 0.8) {
                            const fx = this.xBuffer[i];
                            const fy = this.yBuffer[i];
                            const r = 12 + (valL - 0.8) * 8;
                            ctx.moveTo(fx + r, fy);
                            ctx.arc(fx, fy, r, 0, Math.PI * 2);
                        }
                    }
                    ctx.fill();
                }

                // 2. Medium Foam Pass
                // --- LOD: Only draw medium foam when reasonably zoomed in ---
                if (!isRock && scale > 0.2) {
                    ctx.beginPath();
                    for (let i = 0; i < this.pointCount; i++) {
                        const currentDist = this.distBuffer[i];
                        const valM = Math.sin(currentDist * 0.06 - timeSec * 0.4) +
                                     Math.sin(currentDist * 0.08 + timeSec * 0.2) * 0.5;
                        if (valM > 0.5) {
                            const fx = this.xBuffer[i];
                            const fy = this.yBuffer[i];
                            const r = 6 + (valM - 0.5) * 6; // Radius 6 to ~12
                            ctx.moveTo(fx + r, fy);
                            ctx.arc(fx, fy, r, 0, Math.PI * 2);
                        }
                    }
                    ctx.fill();
                }

                // 3. Small Foam Pass
                ctx.beginPath();
                for (let i = 0; i < this.pointCount; i++) {
                    const currentDist = this.distBuffer[i];
                    const valS = Math.sin(currentDist * 0.3 - timeSec * 0.6) +
                                 Math.sin(currentDist * 0.4 + timeSec * 0.3) * 0.5;
                    if (valS > 0.2) {
                        const fx = this.xBuffer[i];
                        const fy = this.yBuffer[i];
                        const r = 3 + (valS - 0.2) * 3; // Radius 3 to ~6
                        ctx.moveTo(fx + r, fy);
                        ctx.arc(fx, fy, r, 0, Math.PI * 2);
                    }
                }
                ctx.fill();

                ctx.restore();
                }); // End waveOffsets loop
        }
        ctx.restore();
    }
}
