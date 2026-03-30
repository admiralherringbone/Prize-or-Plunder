/**
 * OceanWavesGLRenderer.js
 * 
 * Handles WebGL rendering of procedural surface wavelets.
 */
class OceanWavesGLRenderer {
    constructor(webglManager) {
        this.glManager = webglManager;
        this.gl = webglManager.getGL();
        this.program = null;
        this.uniforms = {};
        this.quadBuffer = null;
        this.visible = true; // Enabled for individual wavelet rendering

        this._maxWavelets = 0;
        this._dataBuffer = null;

        this._initShaders();
        this._initBuffers();
    }

    _initShaders() {
        const gl = this.gl;
        const source = window.OceanWavesShader;
        const vs = this._createShader(gl.VERTEX_SHADER, source.vertex);
        const fs = this._createShader(gl.FRAGMENT_SHADER, source.fragment);
        
        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);

        this.uniforms.u_matrix = gl.getUniformLocation(this.program, 'u_matrix');
        this.uniforms.u_time = gl.getUniformLocation(this.program, 'u_time');
        this.uniforms.u_zoom = gl.getUniformLocation(this.program, 'u_zoom');
    }

    _createShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }

    _initBuffers() {
        const gl = this.gl;
        this.quadBuffer = gl.createBuffer();
    }

    render(m, time, wavelets = [], zoom = 1.0, windDirection = 0) {
        if (!this.visible || wavelets.length === 0) return;
        const gl = this.gl;

        // --- OPTIMIZATION: Wrap time for float precision in shaders ---
        const wrappedTime = time % 3600000;

        gl.useProgram(this.program);
        gl.uniformMatrix3fv(this.uniforms.u_matrix, false, m);
        gl.uniform1f(this.uniforms.u_time, wrappedTime);
        gl.uniform1f(this.uniforms.u_zoom, zoom);

        // --- FIX: Ensure Alpha Blending is enabled for this pass ---
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        // --- OPTIMIZATION: Re-use buffer to avoid GC pressure ---
        // --- MODIFIED: Increase stride to 6 floats [x, y, size, progress, maxOpacity, windAngle] ---
        if (wavelets.length > this._maxWavelets) {
            this._maxWavelets = wavelets.length + 500;
            this._dataBuffer = new Float32Array(this._maxWavelets * 6);
        }

        const data = this._dataBuffer;
        // Flatten wavelet data: [x, y, size, progress, maxOpacity, windAngle]
        for (let i = 0; i < wavelets.length; i++) {
            const w = wavelets[i];
            const base = i * 6;
            data[base]     = w.x;
            data[base + 1] = w.y;
            data[base + 2] = w.width; // Use width from EffectManager as diameter
            data[base + 3] = w.progress;
            data[base + 4] = w.maxOpacity;
            data[base + 5] = w.windDirection;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, wavelets.length * 6), gl.DYNAMIC_DRAW);

        // Attribute Pointers (Stride: 24 bytes)
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);  // Position
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 24, 8);  // Size
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 12); // Progress
        gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 24, 16); // MaxOpacity
        gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 24, 20); // windAngle

        gl.drawArrays(gl.POINTS, 0, wavelets.length);

        // --- OPTIMIZATION: Disable attributes to prevent state leakage into other renderers ---
        gl.disableVertexAttribArray(1);
        gl.disableVertexAttribArray(2);
        gl.disableVertexAttribArray(3);
        gl.disableVertexAttribArray(4);
    }
}

window.OceanWavesGLRenderer = OceanWavesGLRenderer;