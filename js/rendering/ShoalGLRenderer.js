/**
 * ShoalGLRenderer.js
 * 
 * Specialized renderer for shallow sandbars and shoals.
 */
class ShoalGLRenderer {
    constructor(webglManager, bufferManager) {
        this.gl = webglManager.getGL();
        this.bufferManager = bufferManager;
        this.program = null;
        this.uniforms = {};

        this._initShaders();
    }

    _initShaders() {
        const gl = this.gl;
        const source = window.ShoalShader;
        
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
     * Renders the transparent shoals.
     * @param {Float32Array} m - The transformation matrix.
     * @param {Array<Shoal>} activeShoals - The list of shoals to draw.
     */
    render(m, activeShoals) {
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.uniformMatrix3fv(this.uniforms.u_matrix, false, m);

        // Shoals require blending to look like shallow water
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        activeShoals.forEach(obj => {
            const id = obj.id ?? `obs_${Math.floor(obj.x)}_${Math.floor(obj.y)}`;
            const layers = this.bufferManager.islandLayers.get(id);
            if (!layers) return;

            const layer = layers.get('hull');
            if (layer) {
                // --- OPTIMIZATION: Cache Color Vector on Object ---
                if (!obj._glCachedColor) {
                    const overlayAlpha = (typeof SHOAL_COLOR_OVERLAY_ALPHA !== 'undefined') ? SHOAL_COLOR_OVERLAY_ALPHA : 0.8;
                    const color = this._hexToVec4(obj.color || '#D9CC8C');
                    color[3] = Math.max(0.0, 1.0 - overlayAlpha); 
                    obj._glCachedColor = color;
                }
                const color = obj._glCachedColor;

                this._drawObjectLayer(layer, color);
            }

            // 2. Draw "Shallow" Inner Layer
            const shallowLayer = layers.get('shallow');
            if (shallowLayer) {
                // --- NEW: Calculate 10% lighter color ---
                const baseColor = obj._glCachedColor;
                if (!obj._glCachedShallowColor) {
                    const lighter = [
                        baseColor[0] + (1.0 - baseColor[0]) * 0.1, // 10% lighter R
                        baseColor[1] + (1.0 - baseColor[1]) * 0.1, // 10% lighter G
                        baseColor[2] + (1.0 - baseColor[2]) * 0.1, // 10% lighter B
                        baseColor[3] // Keep same transparency
                    ];
                    obj._glCachedShallowColor = lighter;
                }
                this._drawObjectLayer(shallowLayer, obj._glCachedShallowColor);
            }
        });
    }

    _drawObjectLayer(layer, color) {
        const gl = this.gl;
        gl.uniform4fv(this.uniforms.u_color, color);
        gl.bindBuffer(gl.ARRAY_BUFFER, layer.vbo);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, layer.ibo);
        gl.drawElements(gl.TRIANGLES, layer.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    _hexToVec4(hex) {
        if (!hex || hex.charAt(0) !== '#') return [0.89, 0.77, 0.56, 1.0];
        const r = parseInt(hex.slice(1, 3), 16) / 255 || 0;
        const g = parseInt(hex.slice(3, 5), 16) / 255 || 0;
        const b = parseInt(hex.slice(5, 7), 16) / 255 || 0;
        return [r, g, b, 1.0];
    }
}

window.ShoalGLRenderer = ShoalGLRenderer;