/**
 * IslandGLRenderer.js
 * 
 * Specialized renderer for static island landmasses.
 */
class IslandGLRenderer {
    constructor(webglManager, bufferManager) {
        this.gl = webglManager.getGL();
        this.bufferManager = bufferManager;
        this.program = null;
        this.uniforms = {};

        this._initShaders();
    }

    _initShaders() {
        const gl = this.gl;
        const source = window.IslandShader;
        
        const vs = this._createShader(gl.VERTEX_SHADER, source.vertex);
        const fs = this._createShader(gl.FRAGMENT_SHADER, source.fragment);
        
        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);

        this.uniforms.u_matrix = gl.getUniformLocation(this.program, 'u_matrix');
        this.uniforms.u_color = gl.getUniformLocation(this.program, 'u_color');
    }

    _createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        return shader;
    }

    /**
     * Renders the solid layers of the islands.
     * @param {Float32Array} m - The transformation matrix.
     * @param {Array<Island>} activeIslands - The list of islands to draw.
     */
    render(m, activeIslands) {
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.uniformMatrix3fv(this.uniforms.u_matrix, false, m);

        // Ensure opaque rendering
        gl.disable(gl.BLEND);

        // 1. Draw ALL Base Hulls (Sand base)
        activeIslands.forEach(obj => {
            const layers = this.bufferManager.islandLayers.get(obj.id);
            if (layers?.has('hull')) this._drawLayer(layers.get('hull'), ISLAND_COLOR);
        });

        // 2. Draw ALL Sand Layers
        activeIslands.forEach(obj => {
            const layers = this.bufferManager.islandLayers.get(obj.id);
            if (layers?.has('sand')) this._drawLayer(layers.get('sand'), '#F1E5AC');
        });

        // 3. Draw ALL Grass Layers
        activeIslands.forEach(obj => {
            const layers = this.bufferManager.islandLayers.get(obj.id);
            if (layers?.has('grass')) this._drawLayer(layers.get('grass'), ISLAND_GRASS_COLOR);
        });
    }

    _drawLayer(layerData, hexColor) {
        const gl = this.gl;
        const color = this._hexToVec4(hexColor);
        
        gl.uniform4fv(this.uniforms.u_color, color);
        gl.bindBuffer(gl.ARRAY_BUFFER, layerData.vbo);
        
        gl.enableVertexAttribArray(0);
        // Stride is 20 (5 floats: x, y, nx, ny, dist)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, layerData.ibo);
        gl.drawElements(gl.TRIANGLES, layerData.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    _hexToVec4(hex) {
        const r = parseInt(hex.slice(1, 3), 16) / 255 || 0;
        const g = parseInt(hex.slice(3, 5), 16) / 255 || 0;
        const b = parseInt(hex.slice(5, 7), 16) / 255 || 0;
        return [r, g, b, 1.0];
    }
}

window.IslandGLRenderer = IslandGLRenderer;