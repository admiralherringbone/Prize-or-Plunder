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
        
        this.CHUNK_SIZE = 1000; // Size of spatial chunks for culling
        this.visibleChunks = []; // --- OPTIMIZATION: Reusable Array for Chunk Lists ---
        this.tempCache = {}; // Storage for values passed between render and process
        this.foamAtlas = null; // --- OPTIMIZATION: Sprite Atlas ---
        this.foamUVs = [];     // Stores {x, y, size} for each sprite in the atlas

        // --- OPTIMIZATION: Sine Lookup Table (LUT) ---
        // Pre-calculating sine values avoids expensive FPU calls in tight loops.
        // 4096 gives us ~0.0015 radian precision, plenty for waves.
        this.SINE_TABLE_SIZE = 4096;
        this.SINE_TABLE_MASK = this.SINE_TABLE_SIZE - 1;
        this.RAD_TO_INDEX = this.SINE_TABLE_SIZE / (Math.PI * 2);
        this.sineTable = new Float32Array(this.SINE_TABLE_SIZE);
        
        this._initSineTable();
    }

    /**
     * Resets the renderer state, clearing patterns and resetting counters.
     * Useful when the game context changes or resets.
     */
    reset() {
        this.waveGridPattern = null; // Force regeneration of pattern
        this.pointCount = 0;
        // Do not clear foamAtlas, it can be reused.
        this.visibleChunks.length = 0;
        // We keep the buffers (Float32Arrays) to avoid reallocation overhead
    }

    /**
     * Pre-calculates sine values into a lookup table.
     * @private
     */
    _initSineTable() {
        const step = (Math.PI * 2) / this.SINE_TABLE_SIZE;
        for (let i = 0; i < this.SINE_TABLE_SIZE; i++) {
            this.sineTable[i] = Math.sin(i * step);
        }
    }

    /**
     * Fast sine approximation using the lookup table.
     */
    _fastSin(rad) {
        // Optimization: Use bitwise OR for truncation (faster than Math.floor)
        const idx = ((rad * this.RAD_TO_INDEX) | 0) & this.SINE_TABLE_MASK;
        return this.sineTable[idx];
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
            const oldMax = this.maxPoints;
            this.maxPoints *= 2;
            
            // --- FIX: Copy old data to new buffers instead of wiping it ---
            const newX = new Float32Array(this.maxPoints); newX.set(this.xBuffer); this.xBuffer = newX;
            const newY = new Float32Array(this.maxPoints); newY.set(this.yBuffer); this.yBuffer = newY;
            const newDist = new Float32Array(this.maxPoints); newDist.set(this.distBuffer); this.distBuffer = newDist;
            
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

        // --- NEW: Initialize Foam Atlas (Lazy Load) ---
        if (!this.foamAtlas) {
            this._createFoamAtlas();
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

                // Use the detailed perimeter for the wave break to ensure it matches the coastline exactly
                const perimeter = island.outerPerimeterPoints;
                // --- FIX: Safety Check for Perimeter ---
                if (!perimeter || perimeter.length < 3) {
                    ctx.restore();
                    return;
                }

                const ribbonLen = perimeter.length;

                // Calculate Visual Center for Scaling
                let cx = island.x;
                let cy = island.y;
                if (island.boundingRect) {
                    cx = (island.boundingRect.minX + island.boundingRect.maxX) / 2;
                    cy = (island.boundingRect.minY + island.boundingRect.maxY) / 2;
                }

                // --- FIX: Use Baked Ribbon Data ---
                if (!island.ribbonData) {
                    island.generateRibbonData();
                }

                // --- NEW: Build Local Coords if missing (Not part of GPU buffer) ---
                if (!island.localCoordCache) {
                    const coords = new Float32Array(ribbonLen * 2);
                    for (let i = 0; i < ribbonLen; i++) {
                        coords[i * 2] = perimeter[i].x - cx;
                        coords[i * 2 + 1] = perimeter[i].y - cy;
                    }
                    island.localCoordCache = coords;
                }

                const { normals, dists, totalPerimeter } = island.ribbonData;
                const localCoords = island.localCoordCache;
                
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

                // --- NEW: 3-Wave Sequential System ---
                // We stagger 3 waves so they form a continuous train from deep water to the sand.
                // index 0: On-Shore (Surge over sand)
                // index 1: Off-Shore Mid (Swell to coastline)
                // index 2: Off-Shore Far (Deep swell)
                const waveOffsets = [0, cycleDuration / 3, (cycleDuration * 2) / 3];
                const waveScaleBrackets = [
                    { start: 1.0, end: 0.95 },  // On-Shore: Coast -> Sand
                    { start: 1.05, end: 1.0 },  // Near Swell: 5% off-shore -> Coast
                    { start: 1.1, end: 1.05 }   // Far Swell: 10% off-shore -> Near
                ];

                for (let index = 0; index < waveOffsets.length; index++) {
                    const offset = waveOffsets[index];
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
                    if (fadeFactor <= 0.01) continue;

                    const waveAlpha = 0.9 * fadeFactor * setIntensity;
                    const foamAlpha = 1.0 * fadeFactor * setIntensity;
                    const waveStrokeFactor = 0.5 + (waveCycle * 2.0 * setIntensity);

                const radius = island.boundingRadius || 100; // Used for general culling and off-shore waves
                const sizeRef = Math.min(island.baseRadiusX || 100, island.baseRadiusY || 100); // Used for sand layer alignment
                
                // --- NEW: Proportional Scaling Logic ---
                // Calculate the current scale factor based on the wave cycle.
                const bracket = waveScaleBrackets[index];
                const currentScale = bracket.start + (bracket.end - bracket.start) * waveCycle;
                const isOnShore = (index === 0);
                const isNearSwell = (index === 1); // New flag for Near Swell
                const isFarSwell = (index === 2);

                // For On-Shore, the outer edge is the fixed coastline (Scale 1.0)
                // For Off-Shore, we don't draw an outer edge (it's a stroke)
                const outerOffset = 0; 
                const innerOffset = (isOnShore) ? (currentScale - 1.0) * sizeRef : (currentScale - 1.0) * radius;
                this.tempCache.isFarSwell = isFarSwell;

                // --- 1. Draw Main Wave (Filled Ring with Cutout) ---
                ctx.save();
                ctx.translate(cx, cy);
                ctx.beginPath();
                ctx.globalAlpha = waveAlpha; // Apply alpha per wave

                if (isOnShore) ctx.fillStyle = this.waveGridPattern;

                // --- STEP 1: Generate & Draw Wave Body (Combined) ---
                // We calculate the points for the inner edge (where foam and ripples are) ONCE.
                this.pointCount = 0;

                // Store standard variables in temp cache to pass to the helper method
                // This avoids creating a closure every frame (GC Pressure reduction)
                this.tempCache.localCoords = localCoords;
                this.tempCache.dists = dists;
                this.tempCache.normals = normals;
                this.tempCache.totalPerimeter = totalPerimeter;
                this.tempCache.ribbonLen = ribbonLen;
                this.tempCache.scale = scale;
                this.tempCache.ctx = ctx;
                this.tempCache.outerOffset = outerOffset;
                this.tempCache.waveStrokeFactor = waveStrokeFactor;
                this.tempCache.timeSec = timeSec;
                this.tempCache.isRock = isRock;
                this.tempCache.isOnShore = isOnShore;
                this.tempCache.isNearSwell = isNearSwell; // Pass new flag to tempCache
                this.tempCache.isFarSwell = isFarSwell;
                
                // --- FIX: Match threshold logic with island.js to align with the sand layer ---
                this.tempCache.maxInwardDist = sizeRef * 0.05;
                
                // --- OPTIMIZATION: Pre-calculate corrections once per layer, not per segment ---
                // --- FIX: Ensure correction math matches the simplified per-vertex math ---
                // --- OPTIMIZATION: Further reduced frequency for larger, slower ripples ---
                const rippleFreq = 0.01;
                const rippleEndVal = this._fastSin(totalPerimeter * rippleFreq + timeSec * 2.0) * 5.0;
                const rippleStartVal = this._fastSin(0 * rippleFreq + timeSec * 2.0) * 5.0;
                this.tempCache.closureCorrection = (rippleEndVal - rippleStartVal) / totalPerimeter;
                
                // Calculate Macro Amplitudes (Scaled by set intensity)
                const amp1 = 10 * setIntensity;
                const amp2 = 7.5 * setIntensity;
                this.tempCache.macroAmp1 = amp1;
                this.tempCache.macroAmp2 = amp2;

                // --- FIX: Ensure correction math matches the simplified per-vertex math ---
                const macroEndVal = this._fastSin(totalPerimeter * 0.003 + timeSec * 0.3) * (amp1 + amp2 * 0.5);
                const macroStartVal = this._fastSin(0 * 0.003 + timeSec * 0.3) * (amp1 + amp2 * 0.5);
                this.tempCache.macroCorrection = (macroEndVal - macroStartVal) / totalPerimeter;

                // --- OPTIMIZATION: Segment Culling ---
                // We only process segments that are near the visible viewport.
                // We check both points of the segment to prevent "pop-in" at the view edges.
                const waveExpansionMargin = radius * 0.3; // Margin matches island-level culling
                for (let i = 0; i < ribbonLen; i++) {
                    if (viewport) {
                        const nextI = (i + 1) % ribbonLen;
                        const x1 = localCoords[i * 2] + cx;
                        const y1 = localCoords[i * 2 + 1] + cy;
                        const x2 = localCoords[nextI * 2] + cx;
                        const y2 = localCoords[nextI * 2 + 1] + cy;

                        const minX = Math.min(x1, x2);
                        const maxX = Math.max(x1, x2);
                        const minY = Math.min(y1, y2);
                        const maxY = Math.max(y1, y2);
                        
                        if (maxX < viewport.x - waveExpansionMargin || minX > viewport.x + viewport.width + waveExpansionMargin ||
                            maxY < viewport.y - waveExpansionMargin || minY > viewport.y + viewport.height + waveExpansionMargin) {
                            continue;
                        }
                    }
                    this._processSegment(i, innerOffset);
                }

                // Fill all quads created in the loop
                if (isOnShore) ctx.fill();
                ctx.restore();

                // --- STEP 3: Consolidated Foam Pass ---
                ctx.save();
                ctx.globalAlpha = foamAlpha;
                ctx.translate(cx, cy);
                const isNotRock = !isRock;
                for (let i = 0; i < this.pointCount; i++) {
                    const currentDist = this.distBuffer[i];
                    const fx = this.xBuffer[i];
                    const fy = this.yBuffer[i];
                    const spriteIndex = (currentDist * 0.05) | 0;
                    
                    // --- NEW: Tangent Rotation ---
                    // Calculate the angle of the shoreline at this point so the elongated 
                    // foam clumps follow the direction of the wave.
                    const nextIdx = (i + 1) % this.pointCount;
                    const ang = Math.atan2(this.yBuffer[nextIdx] - fy, this.xBuffer[nextIdx] - fx);

                    const drawRotatedFoam = (uv, r) => {
                        if (!uv) return;
                        ctx.save();
                        ctx.translate(fx, fy);
                        ctx.rotate(ang);
                        // The atlas sprites now have a 2:1 aspect ratio.
                        // We draw them centered at (0,0) relative to the vertex.
                        ctx.drawImage(this.foamAtlas, uv.x, uv.y, uv.w, uv.h, -r * 2, -r, r * 4, r * 2);
                        ctx.restore();
                    };

                    // Only draw Large and Medium foam for On-Shore and Near Swells
                    // --- MODIFIED: Skip Large Foam for Near Swell ---
                    if (!isFarSwell && !isNearSwell) { 
                        // Large Foam
                        if (isNotRock && scale > 0.3) {
                            const valL = this._fastSin(currentDist * 0.018 - timeSec * 0.15) * 1.5;
                            if (valL > 0.8) { // Threshold for visibility
                                drawRotatedFoam(this.foamUVs[spriteIndex % this.foamUVs.length], (valL - 0.8) * 50);
                            }
                        }
                    }
                    // --- MODIFIED: Skip Medium Foam for Far Swell ---
                    if (!isFarSwell) {
                        // Medium Foam
                        if (isNotRock && scale > 0.2) {
                            const valM = this._fastSin(currentDist * 0.07 - timeSec * 0.3) * 1.5;
                            if (valM > 0.5) {
                                drawRotatedFoam(this.foamUVs[(spriteIndex + 3) % this.foamUVs.length], (valM - 0.5) * 30);
                            }
                        }
                    }

                    // Small Foam
                    const valS = this._fastSin(currentDist * 0.35 - timeSec * 0.5) * 1.5;
                    if (valS > 0.2) {
                        drawRotatedFoam(this.foamUVs[(spriteIndex + 6) % this.foamUVs.length], (valS - 0.2) * 16);
                    }
                }
                ctx.restore();
                } // End waveOffsets loop
        }
        ctx.restore();
    }

    /**
     * --- OPTIMIZATION: Foam Atlas Generation ---
     * Creates a single offscreen canvas (Atlas) containing all foam variations.
     * @private
     */
    _createFoamAtlas() {
        this.foamUVs = [];
        const spriteHeights = [64, 96, 128]; 
        const numVariations = 3; // Create a few variations for each size

        // Calculate Atlas Dimensions
        // New Width: Height * 2 (for horizontal elongation)
        const totalWidth = (64 * 2 * 3) + (96 * 2 * 3) + (128 * 2 * 3);
        const maxHeight = 128; 

        this.foamAtlas = document.createElement('canvas');
        this.foamAtlas.width = totalWidth;
        this.foamAtlas.height = maxHeight;
        const ctx = this.foamAtlas.getContext('2d');
        if (!ctx) return;

        let currentX = 0;

        for (const height of spriteHeights) {
            const width = height * 2;
            for (let v = 0; v < numVariations; v++) {
                const centerX = currentX + width / 2;
                const centerY = height / 2;
                // Increased circle count for elongated streaks
                const numCircles = 10 + Math.floor(Math.random() * 6); 
                
                for (let i = 0; i < numCircles; i++) {
                    // 1. Horizontal spread (from center to edges)
                    const lx = (Math.random() - 0.5) * (width * 0.85);
                    const t = Math.abs(lx) / (width / 2); // Distance from center 0..1
                    
                    // 2. Center-weighted scaling
                    // Larger in center, smaller toward the ends
                    const taper = Math.max(0.3, 1.0 - t);
                    const radius = (height * 0.15 + Math.random() * height * 0.15) * taper;
                    
                    // 3. Vertical bunching (tighter on Y to emphasize length)
                    const y = centerY + (Math.random() - 0.5) * (height * 0.35) * taper;
                    const x = centerX + lx;

                    const alpha = (0.2 + Math.random() * 0.5) * taper;
                    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
                
                this.foamUVs.push({ x: currentX, y: 0, w: width, h: height });
                currentX += width;
            }
        }
    }

    /**
     * --- OPTIMIZATION: Extracted Loop Logic ---
     * Moved out of renderIsland to prevent function allocation every frame.
     * Uses this.tempCache to access variables that were previously in closure scope.
     */
    _processSegment(i, offsetDist) {
        const { localCoords, dists, normals, ribbonLen, scale, ctx, outerOffset, waveStrokeFactor, timeSec, isRock, closureCorrection, macroCorrection, macroAmp1, macroAmp2, totalPerimeter, isOnShore, maxInwardDist, isFarSwell, isNearSwell } = this.tempCache;

                        const nextI = (i + 1) % ribbonLen;
                        const x1 = localCoords[i * 2];
                        const y1 = localCoords[i * 2 + 1];
                        const x2 = localCoords[nextI * 2];
                        const y2 = localCoords[nextI * 2 + 1];

                        let d1 = dists[i];
                        let d2 = dists[nextI];
                        if (nextI < i) d2 += totalPerimeter;

                        const segLen = d2 - d1;
                        if (segLen <= 0.001) return;

                        // --- OPTIMIZATION: Dynamic Level of Detail (LOD) ---
                        // --- OPTIMIZATION: Increased divisor for larger ripples ---
                        // The Far Swell is simplified by doubling the divisor (50% less math).
                        // The Near Swell is simplified by 50% less than the Far Swell (45 + (90-45)/2 = 67.5).
                        const baseDivisor = isFarSwell ? 90 : (isNearSwell ? 68 : 45);
                        const lodDivisor = baseDivisor / Math.max(0.1, Math.sqrt(scale));
                        const steps = Math.ceil(segLen / lodDivisor);

                        const dx = x2 - x1;
                        const dy = y2 - y1;

                        const n1x = normals[i * 2];
                        const n1y = normals[i * 2 + 1];
                        const n2x = normals[nextI * 2];
                        const n2y = normals[nextI * 2 + 1];

                        let prevInnerX, prevInnerY, prevOuterX, prevOuterY;

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
                            
                            // --- OPTIMIZATION: Simplified Ripple Math (1 sine call) ---
                            // Reduced from 2 octaves to 1 for high-performance shoreline extrusion.
                            const rawR = this._fastSin(currentDist * 0.01 + timeSec * 2.0) * 5.0;
                            const r = (rawR - (closureCorrection * currentDist)) * 1.5;
                            
                            // --- OPTIMIZATION: Simplified Macro Math (1 sine call) ---
                            const rawM = this._fastSin(currentDist * 0.003 + timeSec * 0.3) * (macroAmp1 + macroAmp2 * 0.5);
                            const m = isRock ? 0 : (rawM - (macroCorrection * currentDist));
                            
                            // --- NEW: Noise Tapering ---
                            // Calculate how far the wave has surged relative to the 10% sand limit.
                            // As the wave approaches the dry sand layer, we taper the noise intensity 
                            // to ensure the surge doesn't extend beyond the intended boundary.
                            const surgeRatio = Math.abs(offsetDist) / (maxInwardDist || 1);
                            const noiseTaper = (isOnShore && offsetDist < 0) ? Math.max(0, 1.0 - surgeRatio) : 1.0;

                            // --- Calc Inner Point ---
                            // --- FIX: Normal Offset Logic ---
                            // Normals (nx, ny) point INWARD for CW polygons.
                            // To expand outward, we subtract the normal * offset.
                            // Noise (r, m) is added to the normal (inward displacement).
                            // Final Pos = Point - (Normal * BaseOffset) + (Normal * Noise)
                            // Multiplied noise by noiseTaper to keep it within the 10% margin.
                            const fx = px - nx * offsetDist + nx * (r + m * waveStrokeFactor) * noiseTaper;
                            const fy = py - ny * offsetDist + ny * (r + m * waveStrokeFactor) * noiseTaper;

                            // --- Draw Logic ---
                            if (isOnShore) {
                                // --- Calc Outer Point (Static) ---
                                const ox = px - nx * outerOffset;
                                const oy = py - ny * outerOffset;

                                // Surge uses filled quad strips
                                if (s > 0) {
                                    ctx.moveTo(prevInnerX, prevInnerY);
                                    ctx.lineTo(fx, fy);
                                    ctx.lineTo(ox, oy);
                                    ctx.lineTo(prevOuterX, prevOuterY);
                                }
                                prevOuterX = ox; prevOuterY = oy;
                            }

                            prevInnerX = fx; prevInnerY = fy;

                            // Store in buffer
                            if (this.pointCount < this.maxPoints) {
                                this.xBuffer[this.pointCount] = fx;
                                this.yBuffer[this.pointCount] = fy;
                                this.distBuffer[this.pointCount] = currentDist;
                                this.pointCount++;
                            } else {
                                // If we hit the limit mid-segment, we can't easily resize here without restarting.
                                // The pre-check at start of frame usually prevents this, but as a failsafe, stop adding.
                                // This prevents buffer overflow errors.
                                break; 
                            }
                    }
    }
}
