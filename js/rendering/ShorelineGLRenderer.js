/**
 * ShorelineGLRenderer.js
 * 
 * Manages the high-performance WebGL rendering of the ocean surface.
 * Compiles the ShorelineShader and handles the draw calls for procedural water.
 */
class ShorelineGLRenderer {
    /**
     * @param {WebGLManager} webglManager - The manager providing the GL context.
     */
    constructor(webglManager) {
        this.glManager = webglManager;
        this.gl = webglManager.getGL();
        
        if (!this.gl) return;

        this.oceanProgram = null;
        this.dynamicWaveProgram = null; // Renamed from waveProgram
        this.foamPointProgram = null;   // New: Point sprite program
        this.shimmerEnabled = DEBUG.ENABLE_OCEAN_SHIMMER; // New: Control shimmer state
        this.oceanUniforms = {};
        this.dynamicWaveUniforms = {};
        this.foamUniforms = {};

        // --- OPTIMIZATION: Reusable arrays to reduce GC pressure ---
        this._breakableObjects = [];
        this._waveOffsets = new Float32Array(3);
        this._bakeQueue = []; // New: Queue for deferred resource creation

        this.quadBuffer = null;
        this.bufferManager = new BufferManager(this.gl);

        // Shared timing logic (matches ShorelineRenderer.js)
        this.waveScaleBrackets = [
            { start: 1.0, end: 0.95 },  // On-Shore (Surf hitting the beach)
            { start: 1.05, end: 1.0 },  // Near Swell
            { start: 1.10, end: 1.05 }  // Far Swell
        ];

        this._initShaders();
        this._initBuffers();
    }

    /**
     * Compiles the vertex and fragment shaders and links them into a program.
     * @private
     */
    _initShaders() {
        const gl = this.gl;
        const shaderSource = window.ShorelineShader;

        if (!shaderSource) {
            console.error('ShorelineShader source not found.');
            return;
        }

        // 1. Initialize Ocean Program
        const ovs = this._createShader(gl.VERTEX_SHADER, shaderSource.oceanVertex);
        const ofs = this._createShader(gl.FRAGMENT_SHADER, shaderSource.oceanFragment);
        this.oceanProgram = this._createProgram(ovs, ofs);
        
        this.oceanUniforms.u_time = gl.getUniformLocation(this.oceanProgram, 'u_time');
        this.oceanUniforms.u_baseColor = gl.getUniformLocation(this.oceanProgram, 'u_baseColor');
        this.oceanUniforms.u_matrix = gl.getUniformLocation(this.oceanProgram, 'u_matrix');
        this.oceanUniforms.u_enableShimmer = gl.getUniformLocation(this.oceanProgram, 'u_enableShimmer');

        // 3. Initialize Dynamic Wave Program
        const dwvs = this._createShader(gl.VERTEX_SHADER, shaderSource.dynamicWaveVertex);
        const dwfs = this._createShader(gl.FRAGMENT_SHADER, shaderSource.dynamicWaveFragment);
        this.dynamicWaveProgram = this._createProgram(dwvs, dwfs);

        this.dynamicWaveUniforms.u_matrix = gl.getUniformLocation(this.dynamicWaveProgram, 'u_matrix');
        this.dynamicWaveUniforms.u_time = gl.getUniformLocation(this.dynamicWaveProgram, 'u_time');
        this.dynamicWaveUniforms.u_offsetDist = gl.getUniformLocation(this.dynamicWaveProgram, 'u_offsetDist');
        this.dynamicWaveUniforms.u_inwardOffset = gl.getUniformLocation(this.dynamicWaveProgram, 'u_inwardOffset'); // New uniform
        this.dynamicWaveUniforms.u_waveStrokeFactor = gl.getUniformLocation(this.dynamicWaveProgram, 'u_waveStrokeFactor');
        this.dynamicWaveUniforms.u_macroAmp1 = gl.getUniformLocation(this.dynamicWaveProgram, 'u_macroAmp1');
        this.dynamicWaveUniforms.u_macroAmp2 = gl.getUniformLocation(this.dynamicWaveProgram, 'u_macroAmp2');
        this.dynamicWaveUniforms.u_closureCorrection = gl.getUniformLocation(this.dynamicWaveProgram, 'u_closureCorrection');
        this.dynamicWaveUniforms.u_macroCorrection = gl.getUniformLocation(this.dynamicWaveProgram, 'u_macroCorrection');
        this.dynamicWaveUniforms.u_fadeFactor = gl.getUniformLocation(this.dynamicWaveProgram, 'u_fadeFactor');
        this.dynamicWaveUniforms.u_baseColor = gl.getUniformLocation(this.dynamicWaveProgram, 'u_baseColor');
        this.dynamicWaveUniforms.u_isOnShore = gl.getUniformLocation(this.dynamicWaveProgram, 'u_isOnShore');
        this.dynamicWaveUniforms.u_maxInwardDist = gl.getUniformLocation(this.dynamicWaveProgram, 'u_maxInwardDist');

        // 4. Initialize Foam Point Program
        const fpvs = this._createShader(gl.VERTEX_SHADER, shaderSource.foamPointVertex);
        const fpfs = this._createShader(gl.FRAGMENT_SHADER, shaderSource.foamPointFragment);
        this.foamPointProgram = this._createProgram(fpvs, fpfs);
        this.foamUniforms.u_matrix = gl.getUniformLocation(this.foamPointProgram, 'u_matrix');
        this.foamUniforms.u_time = gl.getUniformLocation(this.foamPointProgram, 'u_time');
        this.foamUniforms.u_zoom = gl.getUniformLocation(this.foamPointProgram, 'u_zoom');
        this.foamUniforms.u_offsetDist = gl.getUniformLocation(this.foamPointProgram, 'u_offsetDist');
        this.foamUniforms.u_waveStrokeFactor = gl.getUniformLocation(this.foamPointProgram, 'u_waveStrokeFactor');
        this.foamUniforms.u_macroAmp1 = gl.getUniformLocation(this.foamPointProgram, 'u_macroAmp1');
        this.foamUniforms.u_macroAmp2 = gl.getUniformLocation(this.foamPointProgram, 'u_macroAmp2');
        this.foamUniforms.u_closureCorrection = gl.getUniformLocation(this.foamPointProgram, 'u_closureCorrection');
        this.foamUniforms.u_macroCorrection = gl.getUniformLocation(this.foamPointProgram, 'u_macroCorrection');
        this.foamUniforms.u_fadeFactor = gl.getUniformLocation(this.foamPointProgram, 'u_fadeFactor');
        this.foamUniforms.u_maxInwardDist = gl.getUniformLocation(this.foamPointProgram, 'u_maxInwardDist');
        this.foamUniforms.u_isOnShore = gl.getUniformLocation(this.foamPointProgram, 'u_isOnShore');
    }

    _createProgram(vs, fs) {
        const gl = this.gl;
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('WebGL Program Link Error:', gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    /**
     * Creates and compiles a single shader.
     * @private
     */
    _createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(`Shader Compile Error (${type === gl.VERTEX_SHADER ? 'Vertex' : 'Fragment'}):`, gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    /**
     * Prepares the vertex buffer for a full-world quad.
     * @private
     */
    _initBuffers() {
        const gl = this.gl;

        // Define a quad that covers the entire world bounds (defined in config.js).
        const positions = new Float32Array([
            0, 0,
            WORLD_WIDTH, 0,
            0, WORLD_HEIGHT,
            0, WORLD_HEIGHT,
            WORLD_WIDTH, 0,
            WORLD_WIDTH, WORLD_HEIGHT
        ]);

        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    }

    /**
     * Clears all cached GPU buffers and resets the internal layer tracking.
     * This should be called during game reset to prevent memory leaks and
     * conflicts with stale IDs from the previous session.
     */
    reset() {
        const gl = this.gl;
        if (!gl || !this.bufferManager) return;

        // Iterate through all cached layers and delete their WebGL buffers
        this.bufferManager.islandLayers.forEach((layers) => {
            layers.forEach((data, key) => {
                if (key === 'breaker_list') {
                    // data is an array of metadata objects containing buffers
                    data.forEach(breaker => {
                        if (breaker.wave?.vbo) gl.deleteBuffer(breaker.wave.vbo);
                        if (breaker.foam?.vbo) gl.deleteBuffer(breaker.foam.vbo);
                    });
                } else if (data.vbo) {
                    // data is a standard buffer container { vbo, count, ibo? }
                    gl.deleteBuffer(data.vbo);
                    if (data.ibo) gl.deleteBuffer(data.ibo);
                }
            });
        });

        this.bufferManager.islandLayers.clear();
        this._bakeQueue = [];
    }

    /**
     * Sets whether the ocean shimmer effect is enabled.
     * @param {boolean} enabled - True to enable shimmer, false to disable.
     */
    setShimmerEnabled(enabled) {
        this.shimmerEnabled = enabled;
        // The uniform will be updated in the next render call.
    }

    /**
     * Renders the ocean surface.
     * @param {number} time - Current time in ms.
     * @param {number} cameraX - Current viewport X in world space.
     * @param {number} cameraY - Current viewport Y in world space.
     * @param {number} zoom - Current world-to-screen scale factor.
     * @param {object} activeStatics - Object containing arrays of active islands, rocks, shoals, reefs.
     * @param {GridGLRenderer} [gridRenderer] - Optional renderer to draw the grid between water and land.
     * @param {OceanWavesGLRenderer} [wavesRenderer] - Optional renderer for individual wavelets.
     * @param {Array} [wavelets] - Array of wavelet objects from EffectManager.
     * @param {IslandGLRenderer} [islandRenderer] - New standalone renderer for solid landmasses.
     * @param {RockGLRenderer} [rockRenderer] - New standalone renderer for rocks.
     * @param {ShoalGLRenderer} [shoalRenderer] - New standalone renderer for shoals.
     * @param {CoralReefGLRenderer} [coralReefRenderer] - New standalone renderer for coral reefs.
     * @param {number} [windDirection] - Current wind direction for ripples.
     */
    render(time, cameraX, cameraY, zoom, activeStatics = { islands: [], rocks: [], shoals: [], coralReefs: [] }, gridRenderer = null, wavesRenderer = null, wavelets = [], islandRenderer = null, rockRenderer = null, shoalRenderer = null, coralReefRenderer = null, windDirection = 0) {
        const gl = this.gl;
        if (!gl || !this.oceanProgram || !this.dynamicWaveProgram || !this.foamPointProgram) return;

        const viewWidth = this.glManager.canvas.width;
        const viewHeight = this.glManager.canvas.height;

        // --- OPTIMIZATION: Deferred Baking ---
        // Process only 1 item from the queue per frame to prevent CPU spikes
        if (this._bakeQueue.length > 0) {
            this.bakeIsland(this._bakeQueue.shift());
        }

        // --- FIX: Disable Depth Testing ---
        // Since we are using the Painter's Algorithm (drawing bottom-to-top), we don't need 
        // the depth buffer. This prevents Z-fighting where waves disappear into the shore.
        gl.disable(gl.DEPTH_TEST);

        // --- COORDINATE TRANSFORMATION ---
        // Build a projection matrix that mimics the 2D canvas transform:
        // ScreenPos = (WorldPos - CameraPos) * Zoom
        // The matrix is column-major.
        // --- FIX: Wrap time to 1 hour (3600s) to maintain float precision in shaders ---
        const wrappedTime = time % 3600000;

        const m = new Float32Array([
            (2.0 * zoom) / viewWidth,  0, 0,
            0, (-2.0 * zoom) / viewHeight, 0,
            -1.0 - (2.0 * zoom * cameraX) / viewWidth, 1.0 + (2.0 * zoom * cameraY) / viewHeight, 1.0
        ]);

        // --- PASS 1: OCEAN BACKGROUND ---
        gl.useProgram(this.oceanProgram);

        gl.uniformMatrix3fv(this.oceanUniforms.u_matrix, false, m);
        gl.uniform1f(this.oceanUniforms.u_time, wrappedTime);

        // Set the ocean base color (Matching OCEAN_BLUE #3498db -> [52, 152, 219])
        gl.uniform4f(this.oceanUniforms.u_baseColor, 0.204, 0.596, 0.859, 1.0);

        // Pass the shimmer toggle state
        gl.uniform1f(this.oceanUniforms.u_enableShimmer, this.shimmerEnabled ? 1.0 : 0.0);

        // Bind the quad and set up the position attribute (location 0 in shader)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(0); 
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        // Ensure attributes 1 and 2 (from the wave pass) are disabled for the ocean quad
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);
        // --- FIX: Also disable location 3 to prevent state leaks ---
        gl.disableVertexAttribArray(3);

        // Draw the background ocean
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // --- PASS 1.1: UNDERWATER HAZARDS (Shoals & Reefs) ---
        // We draw these before the grid so the navigational lines appear on top of them.
        if (shoalRenderer) {
            shoalRenderer.render(m, activeStatics.shoals);
        }

        if (coralReefRenderer) {
            coralReefRenderer.render(m, activeStatics.coralReefs, wrappedTime, zoom);
        }

        // --- PASS 1.2: SURFACE WAVELETS (Drawn atop reefs for surface foam feel) ---
        if (wavesRenderer) wavesRenderer.render(m, time, wavelets, zoom, windDirection);

        // --- PASS 1.25: GRID ---
        if (gridRenderer) gridRenderer.render(m);

        // --- PASS 1.5: SOLID WORLD OBJECTS (Islands & Rocks) ---
        if (islandRenderer) {
            islandRenderer.render(m, activeStatics.islands);
        }

        if (rockRenderer) {
            rockRenderer.render(m, activeStatics.rocks);
        }

        // --- PASS 2: SHORELINE PERIMETERS ---
        // Re-enable blending for the transparent foam and surge effects
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // Pre-calculate shared timing constants once per frame
        const timeSecBase = wrappedTime / 1000;
        const rippleStartVal = Math.sin(timeSecBase * 2.0) * 5.0;
        const macroStartVal = Math.sin(timeSecBase * 0.3); // Partial val for macro

        // Only draw wave breaks for solid landmasses (Islands and Rocks)
        this._breakableObjects.length = 0;
        for (let i = 0; i < activeStatics.islands.length; i++) this._breakableObjects.push(activeStatics.islands[i]);
        for (let i = 0; i < activeStatics.rocks.length; i++) this._breakableObjects.push(activeStatics.rocks[i]);
        
        // --- PASS 2.1: WAVE RIBBONS (Batched) ---
        gl.useProgram(this.dynamicWaveProgram);
        gl.uniformMatrix3fv(this.dynamicWaveUniforms.u_matrix, false, m);
        gl.uniform4f(this.dynamicWaveUniforms.u_baseColor, 0.204, 0.596, 0.859, 1.0); 
        
        gl.enableVertexAttribArray(0); 
        gl.enableVertexAttribArray(1); 
        gl.enableVertexAttribArray(2); 
        gl.enableVertexAttribArray(3);
        gl.disable(gl.CULL_FACE);

        for (let j = 0; j < this._breakableObjects.length; j++) {
            const obj = this._breakableObjects[j];
            const id = this._getObjectId(obj);
            let layers = this.bufferManager.islandLayers.get(id);
            
            if (!layers) {
                // Instead of baking immediately, queue it and skip drawing this frame
                if (!this._bakeQueue.includes(obj)) {
                    this._bakeQueue.push(obj);
                }
                continue; 
            }

            // Use the pre-compiled list of breakers to avoid string concatenation
            const breakerList = layers.get('breaker_list');
            if (!breakerList) continue;

            // --- REPLICATE 2D RHYTHM LOGIC ---
            const cycleDuration = obj.waveCycleDuration || 3800;
            const warpFreq = (Math.PI * 2) / cycleDuration;
            const warpAmp = cycleDuration * 0.12;
            const timeWarp = Math.sin(wrappedTime * warpFreq + (obj.waveVariancePhase || 0)) * warpAmp;
            const effectiveTime = wrappedTime + timeWarp;

            const setFreq = (Math.PI * 2) / (cycleDuration * 5);
            const setIntensity = 0.85 + 0.15 * Math.sin(wrappedTime * setFreq + (obj.waveVariancePhase || 0));

            this._waveOffsets[0] = 0;
            this._waveOffsets[1] = cycleDuration / 3;
            this._waveOffsets[2] = (cycleDuration * 2) / 3;

            for (let s = 0; s < breakerList.length; s++) {
                const breaker = breakerList[s];
                const bufferData = breaker.wave;
                const foamBuffer = breaker.foam;
                const radius = breaker.radius;
                const sizeRef = breaker.sizeRef;
                const totalPerimeter = breaker.totalPerimeter;

                gl.bindBuffer(gl.ARRAY_BUFFER, bufferData.vbo);
                gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
                gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 8);
                gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 16);
                gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 24, 20);

                for (let i = 0; i < 3; i++) {
                    const offset = this._waveOffsets[i];
                    const layerTime = effectiveTime + offset;
                    const timeSec = timeSecBase + (offset / 1000);
                    const rawPhase = (layerTime % cycleDuration) / cycleDuration;
                    const waveCycle = (Math.sin((rawPhase * Math.PI) - (Math.PI / 2)) + 1) / 2;

                    let fadeFactor = (waveCycle < 0.2) ? (waveCycle / 0.2) : (waveCycle < 0.75 ? 1.0 : Math.max(0, 1.0 - ((waveCycle - 0.75) / 0.25)));
                    if (fadeFactor <= 0.01) continue;

                    const isOnShore = (i === 0);
                    const bracket = this.waveScaleBrackets[i];
                    const currentScale = bracket.start + (bracket.end - bracket.start) * waveCycle;
                    
                    const offsetDist = (currentScale - 1.0) * (isOnShore ? sizeRef : radius);
                    const inwardOffset = isOnShore ? 0.0 : -offsetDist;
                    const maxInwardDist = sizeRef * 0.05;

                    // Optimized correction math
                    const rippleEndVal = Math.sin(totalPerimeter * 0.01 + timeSec * 2.0) * 5.0;
                    const closureCorrection = (rippleEndVal - rippleStartVal) / totalPerimeter;

                    const amp1 = 10 * setIntensity;
                    const amp2 = 7.5 * setIntensity;
                    const mBase = (amp1 + amp2 * 0.5);
                    const macroEndVal = Math.sin(totalPerimeter * 0.003 + timeSec * 0.3) * mBase;
                    const localMacroStart = Math.sin(timeSec * 0.3) * mBase;
                    const macroCorrection = (macroEndVal - localMacroStart) / totalPerimeter;

                    gl.uniform1f(this.dynamicWaveUniforms.u_time, wrappedTime + offset);
                    gl.uniform1f(this.dynamicWaveUniforms.u_offsetDist, offsetDist);
                    gl.uniform1f(this.dynamicWaveUniforms.u_waveStrokeFactor, 0.5 + (waveCycle * 2.0 * setIntensity));
                    gl.uniform1f(this.dynamicWaveUniforms.u_inwardOffset, inwardOffset);
                    gl.uniform1f(this.dynamicWaveUniforms.u_macroAmp1, (obj.type === 'rock') ? 0 : amp1);
                    gl.uniform1f(this.dynamicWaveUniforms.u_macroAmp2, (obj.type === 'rock') ? 0 : amp2);
                    gl.uniform1f(this.dynamicWaveUniforms.u_closureCorrection, closureCorrection);
                    gl.uniform1f(this.dynamicWaveUniforms.u_macroCorrection, macroCorrection);
                    gl.uniform1f(this.dynamicWaveUniforms.u_fadeFactor, fadeFactor * setIntensity);
                    gl.uniform1f(this.dynamicWaveUniforms.u_isOnShore, isOnShore ? 1.0 : 0.0);
                    gl.uniform1f(this.dynamicWaveUniforms.u_maxInwardDist, maxInwardDist);

                    gl.drawArrays(gl.TRIANGLE_STRIP, 0, bufferData.count);
                }
            }
        }

        // --- PASS 2.2: FOAM BUBBLES (Batched) ---
        gl.useProgram(this.foamPointProgram);
        gl.uniformMatrix3fv(this.foamUniforms.u_matrix, false, m);

        for (let j = 0; j < this._breakableObjects.length; j++) {
            const obj = this._breakableObjects[j];
            const id = this._getObjectId(obj);
            const layers = this.bufferManager.islandLayers.get(id);
            const breakerList = layers?.get('breaker_list');
            if (!breakerList) continue;

            // Re-calculate rhythm once per object
            const cycleDuration = obj.waveCycleDuration || 3800;
            const warpFreq = (Math.PI * 2) / cycleDuration;
            const warpAmp = cycleDuration * 0.12;
            const timeWarp = Math.sin(wrappedTime * warpFreq + (obj.waveVariancePhase || 0)) * warpAmp;
            const effectiveTime = wrappedTime + timeWarp;
            const setIntensity = 0.85 + 0.15 * Math.sin(wrappedTime * ((Math.PI * 2) / (cycleDuration * 5)) + (obj.waveVariancePhase || 0));

            for (let s = 0; s < breakerList.length; s++) {
                const breaker = breakerList[s];
                const foamBuffer = breaker.foam;
                if (!foamBuffer) continue;

                gl.bindBuffer(gl.ARRAY_BUFFER, foamBuffer.vbo);
                gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 28, 0);
                gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 28, 8);
                gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 16);
                gl.vertexAttribPointer(3, 2, gl.FLOAT, false, 28, 20);

                for (let i = 0; i < 3; i++) {
                    const offset = (i * cycleDuration) / 3;
                    const waveCycle = (Math.sin(((effectiveTime + offset) % cycleDuration) / cycleDuration * Math.PI - Math.PI / 2) + 1) / 2;
                    let fadeFactor = (waveCycle < 0.2) ? (waveCycle / 0.2) : (waveCycle < 0.75 ? 1.0 : Math.max(0, 1.0 - ((waveCycle - 0.75) / 0.25)));
                    if (fadeFactor <= 0.01) continue;

                    const isOnShore = (i === 0);
                    const offsetDist = (this.waveScaleBrackets[i].start + (this.waveScaleBrackets[i].end - this.waveScaleBrackets[i].start) * waveCycle - 1.0) * (isOnShore ? breaker.sizeRef : breaker.radius);
                    const timeSec = timeSecBase + (offset / 1000);
                    const amp1 = 10 * setIntensity, amp2 = 7.5 * setIntensity, mBase = (amp1 + amp2 * 0.5);

                    gl.uniform1f(this.foamUniforms.u_time, wrappedTime + offset);
                    gl.uniform1f(this.foamUniforms.u_zoom, zoom);
                    gl.uniform1f(this.foamUniforms.u_offsetDist, offsetDist);
                    gl.uniform1f(this.foamUniforms.u_waveStrokeFactor, 0.5 + (waveCycle * 2.0 * setIntensity));
                    gl.uniform1f(this.foamUniforms.u_macroAmp1, (obj.type === 'rock') ? 0 : amp1);
                    gl.uniform1f(this.foamUniforms.u_macroAmp2, (obj.type === 'rock') ? 0 : amp2);
                    gl.uniform1f(this.foamUniforms.u_closureCorrection, (Math.sin(breaker.totalPerimeter * 0.01 + timeSec * 2.0) * 5.0 - rippleStartVal) / breaker.totalPerimeter);
                    gl.uniform1f(this.foamUniforms.u_macroCorrection, (Math.sin(breaker.totalPerimeter * 0.003 + timeSec * 0.3) * mBase - Math.sin(timeSec * 0.3) * mBase) / breaker.totalPerimeter);
                    gl.uniform1f(this.foamUniforms.u_fadeFactor, fadeFactor * setIntensity);
                    gl.uniform1f(this.foamUniforms.u_isOnShore, isOnShore ? 1.0 : 0.0);
                    gl.uniform1f(this.foamUniforms.u_maxInwardDist, breaker.sizeRef * 0.05);
                    gl.drawArrays(gl.POINTS, 0, foamBuffer.count);
                }
            }
        }
        gl.disable(gl.BLEND);

        // --- FIX: Disable extra attributes to prevent state leakage into other renderers ---
        // This prevents "vanishing" artifacts in Pass 1.1 or the next frame's Pass 1.
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);
        gl.disableVertexAttribArray(3);
    }

    /**
     * Helper to get a unique string ID for any obstacle.
     * @private
     */
    _getObjectId(obj) {
        if (obj._glId) return obj._glId;
        obj._glId = obj.id ?? `obs_${Math.floor(obj.x)}_${Math.floor(obj.y)}`;
        return obj._glId;
    }

    /**
     * Helper to parse CSS colors into WebGL vec4.
     * @private
     */
    _parseColor(color) {
        if (color.startsWith('#')) return this._hexToVec4(color);
        if (color.startsWith('rgba')) {
            const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (m) return [m[1]/255, m[2]/255, m[3]/255, m[4] !== undefined ? parseFloat(m[4]) : 1.0];
        }
        return [1, 1, 1, 0.1];
    }

    /**
     * Helper to convert CSS Hex strings to WebGL vec4 arrays.
     * @private
     */
    _hexToVec4(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255 || 0;
        const g = parseInt(hex.slice(3, 5), 16) / 255 || 0;
        const b = parseInt(hex.slice(5, 7), 16) / 255 || 0;
        return [r, g, b, 1.0];
    }

    /**
     * Helper to convert CSS HSL strings to WebGL vec4 arrays.
     * @private
     */
    _hslToVec4(hsl) {
        const m = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (!m) return [1, 0, 1, 1];
        const h = parseInt(m[1]) / 360, s = parseInt(m[2]) / 100, l = parseInt(m[3]) / 100;
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hue2rgb = (p, q, t) => { if(t < 0) t += 1; if(t > 1) t -= 1; if(t < 1/6) return p + (q - p) * 6 * t; if(t < 1/2) return q; if(t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; };
        return [hue2rgb(p, q, h + 1/3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1/3), 1.0];
    }

    /**
     * Uploads an island's perimeter data to the GPU.
     * @param {Obstacle} obstacle - The terrain object to bake.
     */
    bakeIsland(obstacle) {
        const gl = this.gl;

        // Ensure ribbon data is available for non-clusters (Islands/Rocks)
        if (!obstacle.isCluster && !obstacle.ribbonData) {
             obstacle.generateRibbonData();
             if (!obstacle.ribbonData) {
                 console.warn(`[ShorelineGLRenderer] Failed to generate ribbonData for obstacle ${this._getObjectId(obstacle)}. Skipping.`);
                 return;
             }
        }

        const id = this._getObjectId(obstacle);
        
        // 1. Bake the base geometry
        if (obstacle.isCluster && obstacle.subRocks) {
            // Bake individual rocks for clusters
            obstacle.subRocks.forEach((rock, idx) => {
                if (!rock.points) return;
                const flatPoints = new Float32Array(rock.points.length * 2);
                rock.points.forEach((p, i) => { flatPoints[i*2] = p.x; flatPoints[i*2+1] = p.y; });
                const rockIndices = earcut(flatPoints);
                this.bufferManager.bakeLayer(id, `hull_${idx}`, rock.points, null, null, rockIndices);
            });
            // Also bake the total hull for wave effects
            this.bufferManager.bakeLayer(id, 'hull', obstacle.outerPerimeterPoints, null, null, null);
        } else if (obstacle instanceof CoralReef) {
            const { normals, dists, indices } = obstacle.ribbonData;
            // Bake the rock base hull
            this.bufferManager.bakeLayer(id, 'hull', obstacle.rockBase.outerPerimeterPoints, normals, dists, indices);
            
            // --- NEW: Bake Procedural Coral Points ---
            const numCorals = obstacle.coralMetadata.length;
            const data = new Float32Array(numCorals * 10); // [x, y, size, r, g, b, a, type, layers, seed]
            
            obstacle.coralMetadata.forEach((c, i) => {
                const base = i * 10;
                const color = c.color.startsWith('hsl') ? this._hslToVec4(c.color) : this._hexToVec4(c.color);
                const oceanBlueVec4 = this._hexToVec4(OCEAN_BLUE);
                const overlayAlpha = (typeof SHOAL_COLOR_OVERLAY_ALPHA !== 'undefined') ? SHOAL_COLOR_OVERLAY_ALPHA : 0.8;

                data[base]     = c.x;
                data[base + 1] = c.y;
                data[base + 2] = c.radius;
                data[base + 3] = color[0] * (1.0 - overlayAlpha) + oceanBlueVec4[0] * overlayAlpha; // Blended R
                data[base + 4] = color[1] * (1.0 - overlayAlpha) + oceanBlueVec4[1] * overlayAlpha; // Blended G
                data[base + 5] = color[2] * (1.0 - overlayAlpha) + oceanBlueVec4[2] * overlayAlpha; // Blended B
                data[base + 6] = 1.0; // Alpha
                data[base + 7] = c.type;
                data[base + 8] = c.layers;
                data[base + 9] = c.seed;
            });

            const vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
            this.bufferManager.islandLayers.get(id).set('coral_points', { vbo, count: numCorals });
        } else if (obstacle instanceof Shoal) {
            const { normals, dists, indices } = obstacle.ribbonData;
            // Bake the base hull
            this.bufferManager.bakeLayer(id, 'hull', obstacle.outerPerimeterPoints, normals, dists, indices);
            // Bake the shallow interior layer
            if (obstacle.shallowVisualPoints && obstacle.shallowVisualPoints.length > 2) {
                this.bufferManager.bakeLayer(id, 'shallow', obstacle.shallowVisualPoints, null, null, obstacle.shallowIndices);
            }
        } else {
            const { normals, dists, indices } = obstacle.ribbonData;
            this.bufferManager.bakeLayer(id, 'hull', obstacle.outerPerimeterPoints, normals, dists, indices);
        }

        // --- NEW: Optimized Metadata Baking ---
        if (!this.bufferManager.islandLayers.has(id)) this.bufferManager.islandLayers.set(id, new Map());
        const breakerList = [];

        if (obstacle.isCluster && obstacle.subRocks) {
            obstacle.subRocks.forEach((rock, idx) => {
                const ribbon = this._calculateRibbonData(rock.points);
                if (ribbon) {
                    const meta = this._bakeBreakerGeometries(id, `_${idx}`, rock.points, ribbon, 0.2);
                    meta.radius = rock.radius;
                    meta.sizeRef = rock.radius;
                    breakerList.push(meta);
                }
            });
        } else if (obstacle.ribbonData) {
            const density = (obstacle.type === 'rock') ? 0.2 : 0.4;
            const meta = this._bakeBreakerGeometries(id, '', obstacle.outerPerimeterPoints, obstacle.ribbonData, density);
            meta.radius = obstacle.boundingRadius || 100;
            meta.sizeRef = Math.min(obstacle.baseRadiusX || 100, obstacle.baseRadiusY || 100);
            breakerList.push(meta);
        }
        this.bufferManager.islandLayers.get(id).set('breaker_list', breakerList);

        // 2. If it's an Island, bake the decorative layers
        if (obstacle instanceof Island) {
            if (obstacle.drySandVisualPoints && obstacle.drySandVisualPoints.length > 2) {
                this.bufferManager.bakeLayer(id, 'sand', obstacle.drySandVisualPoints, null, null, obstacle.drySandIndices);
            }
            if (obstacle.grassVisualPoints && obstacle.grassVisualPoints.length > 2) {
                this.bufferManager.bakeLayer(id, 'grass', obstacle.grassVisualPoints, null, null, obstacle.grassIndices);
            }
        }
    }

    _bakeBreakerGeometries(id, suffix, perim, ribbon, foamDensity = 0.4) {
        const gl = this.gl;
        const { normals, dists, totalPerimeter } = ribbon;
        const len = perim.length;
        const waveData = new Float32Array((len + 1) * 2 * 6); 
        
        for (let i = 0; i <= len; i++) {
            const idx = i % len;
            const p = perim[idx]; 
            const nx = normals[idx * 2];
            const ny = normals[idx * 2 + 1];
            // --- FIX: Seam Closure (Distance Continuity) ---
            // The last vertex must use the total perimeter distance, not 0.0, to prevent "explosions".
            const d = (i === len) ? ribbon.totalPerimeter : dists[idx];
            
            // Vertex A: The Shore (extrude = 0)
            const baseA = i * 12;
            waveData[baseA] = p.x; waveData[baseA+1] = p.y;
            waveData[baseA+2] = nx; waveData[baseA+3] = ny;
            waveData[baseA+4] = d;  waveData[baseA+5] = 0.0;

            // Vertex B: The Wave Edge (extrude = 1)
            const baseB = baseA + 6;
            waveData[baseB] = p.x; waveData[baseB+1] = p.y;
            waveData[baseB+2] = nx; waveData[baseB+3] = ny;
            waveData[baseB+4] = d;  waveData[baseB+5] = 1.0;
        }

        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, waveData, gl.STATIC_DRAW);
        
        const waveBuffer = { vbo, count: (len + 1) * 2, totalPerimeter };
        this.bufferManager.islandLayers.get(id).set('wave_strip' + suffix, waveBuffer);

        // --- NEW: Bake Foam Points ---
        const numPoints = Math.floor(totalPerimeter * foamDensity);
        const foamData = new Float32Array(numPoints * 7);
        
        for (let i = 0; i < numPoints; i++) {
            const d = (i / numPoints) * totalPerimeter;
            let segIdx = 0;
            while (segIdx < len - 1 && dists[segIdx + 1] < d) segIdx++;
            
            const t = (d - dists[segIdx]) / ((dists[segIdx + 1] || totalPerimeter) - dists[segIdx]);
            const p1 = perim[segIdx], p2 = perim[(segIdx + 1) % len];
            const n1x = normals[segIdx * 2], n1y = normals[segIdx * 2 + 1];
            const n2x = normals[((segIdx + 1) % len) * 2], n2y = normals[((segIdx + 1) % len) * 2 + 1];

            const base = i * 7;
            foamData[base] = p1.x + (p2.x - p1.x) * t;
            foamData[base + 1] = p1.y + (p2.y - p1.y) * t;
            
            let nx = n1x + (n2x - n1x) * t, ny = n1y + (n2y - n1y) * t;
            const nLen = Math.sqrt(nx * nx + ny * ny) || 1;
            foamData[base + 2] = nx / nLen;
            foamData[base + 3] = ny / nLen;
            foamData[base + 4] = d;
            
            // Jitter and Size noise
            foamData[base + 5] = (Math.random() - 0.5) * 15.0; // random displacement offset
            foamData[base + 6] = Math.random(); // size multiplier
        }

        const fvbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, fvbo);
        gl.bufferData(gl.ARRAY_BUFFER, foamData, gl.STATIC_DRAW);
        const foamBuffer = { vbo: fvbo, count: numPoints };
        this.bufferManager.islandLayers.get(id).set('foam_points' + suffix, foamBuffer);

        return { wave: waveBuffer, foam: foamBuffer, totalPerimeter };
    }

    _calculateRibbonData(perimeter) {
        if (!perimeter || perimeter.length < 3) return null;
        const len = perimeter.length;
        const normals = new Float32Array(len * 2);
        const edgeNormals = new Float32Array(len * 2);
        const dists = new Float32Array(len);

        let area = 0;
        for (let i = 0; i < len; i++) {
            const p1 = perimeter[i], p2 = perimeter[(i + 1) % len];
            area += (p1.x * p2.y - p2.x * p1.y);
        }
        const isNegativeArea = area < 0;

        let totalDist = 0;
        for (let i = 0; i < len; i++) {
            const curr = perimeter[i], next = perimeter[(i + 1) % len], prev = perimeter[(i - 1 + len) % len];
            const dx = next.x - prev.x, dy = next.y - prev.y;
            const dLen = Math.sqrt(dx * dx + dy * dy) || 1;
            edgeNormals[i * 2] = isNegativeArea ? dy / dLen : -dy / dLen;
            edgeNormals[i * 2 + 1] = isNegativeArea ? -dx / dLen : dx / dLen;
            dists[i] = totalDist;
            totalDist += Math.sqrt((next.x - curr.x)**2 + (next.y - curr.y)**2);
        }

        for (let i = 0; i < len; i++) {
            const prevI = (i - 1 + len) % len;
            let nx = edgeNormals[prevI * 2] + edgeNormals[i * 2], ny = edgeNormals[prevI * 2 + 1] + edgeNormals[i * 2 + 1];
            const nLen = Math.sqrt(nx * nx + ny * ny) || 1;
            normals[i * 2] = nx / nLen;
            normals[i * 2 + 1] = ny / nLen;
        }
        return { normals, dists, totalPerimeter: totalDist };
    }
}