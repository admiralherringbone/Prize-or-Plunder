/**
 * RockGLRenderer.js
 * 
 * Specialized renderer for static rock obstacles and rock clusters.
 */
class RockGLRenderer {
    constructor(webglManager, bufferManager) {
        this.gl = webglManager.getGL();
        this.bufferManager = bufferManager;
        this.program = null;
        this.uniforms = {};

        this._initShaders();
    }

    _initShaders() {
        const gl = this.gl;
        const source = window.RockShader;
        
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
     * Renders the physical rocks.
     * @param {Float32Array} m - The transformation matrix.
     * @param {Array<Rock|RockCluster>} activeRocks - The list of rocks to draw.
     */
    render(m, activeRocks) {
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.uniformMatrix3fv(this.uniforms.u_matrix, false, m);

        // Ensure opaque rendering
        gl.disable(gl.BLEND);

        activeRocks.forEach(obj => {
            // Use coordinate-based ID for rocks/clusters since they lack persistent numeric IDs
            const id = obj.id ?? `obs_${Math.floor(obj.x)}_${Math.floor(obj.y)}`;
            const layers = this.bufferManager.islandLayers.get(id);
            if (!layers) return;

            // Handle Rock Clusters (multiple sub-rocks baked as unique layers)
            if (obj.isCluster && obj.subRocks) {
                obj.subRocks.forEach((_, idx) => {
                    const layer = layers.get(`hull_${idx}`);
                    if (layer) this._drawLayer(layer, obj.color);
                });
            } else {
                // Single Rock
                const layer = layers.get('hull');
                if (layer) this._drawLayer(layer, obj.color);
            }
        });
    }

    _drawLayer(layerData, hexColor) {
        const gl = this.gl;
        const color = this._hexToVec4(hexColor);
        
        gl.uniform4fv(this.uniforms.u_color, color);
        gl.bindBuffer(gl.ARRAY_BUFFER, layerData.vbo);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);

        if (layerData.ibo) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, layerData.ibo);
            gl.drawElements(gl.TRIANGLES, layerData.indexCount, gl.UNSIGNED_SHORT, 0);
        }
    }

    _hexToVec4(hex) {
        if (!hex || hex.charAt(0) !== '#') return [0.5, 0.5, 0.5, 1.0];
        const r = parseInt(hex.slice(1, 3), 16) / 255 || 0;
        const g = parseInt(hex.slice(3, 5), 16) / 255 || 0;
        const b = parseInt(hex.slice(5, 7), 16) / 255 || 0;
        return [r, g, b, 1.0];
    }
}

window.RockGLRenderer = RockGLRenderer;