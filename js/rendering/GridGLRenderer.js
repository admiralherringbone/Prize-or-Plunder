/**
 * GridGLRenderer.js
 * 
 * Handles WebGL rendering of the procedural world grid.
 */
class GridGLRenderer {
    constructor(webglManager) {
        this.glManager = webglManager;
        this.gl = webglManager.getGL();
        
        this.program = null;
        this.uniforms = {};
        this.quadBuffer = null;
        this.visible = true; // Toggle state

        this._initShaders();
        this._initBuffers();
    }

    _initShaders() {
        const gl = this.gl;
        const source = window.GridShader;
        
        const vs = this._createShader(gl.VERTEX_SHADER, source.vertex);
        const fs = this._createShader(gl.FRAGMENT_SHADER, source.fragment);
        
        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);

        this.uniforms.u_matrix = gl.getUniformLocation(this.program, 'u_matrix');
        this.uniforms.u_gridColor = gl.getUniformLocation(this.program, 'u_gridColor');
        this.uniforms.u_gridSize = gl.getUniformLocation(this.program, 'u_gridSize');
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
        const positions = new Float32Array([
            0, 0, WORLD_WIDTH, 0, 0, WORLD_HEIGHT,
            0, WORLD_HEIGHT, WORLD_WIDTH, 0, WORLD_WIDTH, WORLD_HEIGHT
        ]);

        this.quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    }

    render(m) {
        if (!this.visible) return;
        const gl = this.gl;

        gl.useProgram(this.program);
        gl.uniformMatrix3fv(this.uniforms.u_matrix, false, m);
        gl.uniform1f(this.uniforms.u_gridSize, typeof GRID_SIZE !== 'undefined' ? GRID_SIZE : 250.0);
        
        const color = this._parseColor(typeof GRID_COLOR !== 'undefined' ? GRID_COLOR : '#2980b9');
        gl.uniform4fv(this.uniforms.u_gridColor, color);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.disable(gl.BLEND);
    }

    _parseColor(color) {
        if (color.startsWith('#')) return this._hexToVec4(color);
        if (color.startsWith('rgba')) {
            const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (m) return [m[1]/255, m[2]/255, m[3]/255, m[4] !== undefined ? parseFloat(m[4]) : 0.15];
        }
        return [1, 1, 1, 0.1];
    }

    _hexToVec4(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255 || 0;
        const g = parseInt(hex.slice(3, 5), 16) / 255 || 0;
        const b = parseInt(hex.slice(5, 7), 16) / 255 || 0;
        return [r, g, b, 0.15];
    }
}

window.GridGLRenderer = GridGLRenderer;