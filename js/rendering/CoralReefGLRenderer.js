/**
 * CoralReefGLRenderer.js
 * 
 * Specialized renderer for composite coral reef obstacles.
 */
class CoralReefGLRenderer {
    constructor(webglManager, bufferManager) {
        this.gl = webglManager.getGL();
        this.bufferManager = bufferManager;
        this.program = null;
        this.hullProgram = null; // We keep a simple program for the base
        this.uniforms = {};

        this._initShaders();
    }

    _initShaders() {
        const gl = this.gl;
        const source = window.CoralReefShader;
        
        const vs = this._createShader(gl.VERTEX_SHADER, source.vertex);
        const fs = this._createShader(gl.FRAGMENT_SHADER, source.fragment);
        
        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);

        this.uniforms.u_matrix = gl.getUniformLocation(this.program, 'u_matrix');
        this.uniforms.u_time = gl.getUniformLocation(this.program, 'u_time');
        this.uniforms.u_zoom = gl.getUniformLocation(this.program, 'u_zoom');

        // Simple hull program (polygons)
        const hvs = this._createShader(gl.VERTEX_SHADER, window.IslandShader.vertex);
        const hfs = this._createShader(gl.FRAGMENT_SHADER, window.IslandShader.fragment);
        this.hullProgram = gl.createProgram();
        gl.attachShader(this.hullProgram, hvs);
        gl.attachShader(this.hullProgram, hfs);
        gl.linkProgram(this.hullProgram);
        this.uniforms.u_hullMatrix = gl.getUniformLocation(this.hullProgram, 'u_matrix');
        this.uniforms.u_hullColor = gl.getUniformLocation(this.hullProgram, 'u_color');
    }

    _createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        return shader;
    }

    /**
     * Renders the rock bases and colorful coral shapes.
     * @param {Float32Array} m - The transformation matrix.
     * @param {Array<CoralReef>} activeReefs - The list of reefs to draw.
     */
    render(m, activeReefs, time, zoom) {
        const gl = this.gl;

        // Reefs are underwater hazards, requiring blending for the submerged look
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        activeReefs.forEach(obj => {
            const id = obj.id ?? `obs_${Math.floor(obj.x)}_${Math.floor(obj.y)}`;
            const layers = this.bufferManager.islandLayers.get(id);
            if (!layers) return;

            // 1. Draw Rock Base (Hull)
            gl.useProgram(this.hullProgram);
            gl.uniformMatrix3fv(this.uniforms.u_hullMatrix, false, m);

            const baseLayer = layers.get('hull');
            if (baseLayer) {
                const baseRockColor = this._hexToVec4(ROCK_COLOR);
                const oceanBlueVec4 = this._hexToVec4(OCEAN_BLUE);
                const overlayAlpha = (typeof SHOAL_COLOR_OVERLAY_ALPHA !== 'undefined') ? SHOAL_COLOR_OVERLAY_ALPHA : 0.8;

                const blendedR = baseRockColor[0] * (1.0 - overlayAlpha) + oceanBlueVec4[0] * overlayAlpha;
                const blendedG = baseRockColor[1] * (1.0 - overlayAlpha) + oceanBlueVec4[1] * overlayAlpha;
                const blendedB = baseRockColor[2] * (1.0 - overlayAlpha) + oceanBlueVec4[2] * overlayAlpha;
                
                gl.uniform4fv(this.uniforms.u_hullColor, [blendedR, blendedG, blendedB, 1.0]);
                gl.bindBuffer(gl.ARRAY_BUFFER, baseLayer.vbo);
                gl.enableVertexAttribArray(0);
                gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, baseLayer.ibo);
                gl.drawElements(gl.TRIANGLES, baseLayer.indexCount, gl.UNSIGNED_SHORT, 0);
            }

            // 2. Draw Procedural Coral Components (Points)
            const coralPoints = layers.get('coral_points');
            if (coralPoints) {
                gl.useProgram(this.program);
                gl.uniformMatrix3fv(this.uniforms.u_matrix, false, m);
                gl.uniform1f(this.uniforms.u_time, time);
                gl.uniform1f(this.uniforms.u_zoom, zoom);

                gl.bindBuffer(gl.ARRAY_BUFFER, coralPoints.vbo);
                gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 40, 0);  // Position
                gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 40, 8);  // Size
                gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 12); // Color
                gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 40, 28); // Type
                gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 40, 32); // Layers
                gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 40, 36); // Seed

                gl.drawArrays(gl.POINTS, 0, coralPoints.count);
                
                gl.disableVertexAttribArray(1);
                gl.disableVertexAttribArray(2);
                gl.disableVertexAttribArray(3);
                gl.disableVertexAttribArray(4);
                gl.disableVertexAttribArray(5);
            }
        });
    }

    _drawLayer(layerData, colorInput) {
        const gl = this.gl;
        
        let color;
        if (Array.isArray(colorInput)) {
            color = colorInput;
        } else {
            color = colorInput.startsWith('hsl') ? this._hslToVec4(colorInput) : this._hexToVec4(colorInput);
        }
        
        gl.uniform4fv(this.uniforms.u_color, color);
        gl.bindBuffer(gl.ARRAY_BUFFER, layerData.vbo);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, layerData.ibo);
        gl.drawElements(gl.TRIANGLES, layerData.indexCount, gl.UNSIGNED_SHORT, 0);
    }

    _hexToVec4(hex) {
        if (!hex || hex.charAt(0) !== '#') return [0.5, 0.5, 0.5, 1.0];
        const r = parseInt(hex.slice(1, 3), 16) / 255 || 0;
        const g = parseInt(hex.slice(3, 5), 16) / 255 || 0;
        const b = parseInt(hex.slice(5, 7), 16) / 255 || 0;
        return [r, g, b, 1.0];
    }

    _hslToVec4(hsl) {
        // Simple parser for hsl(h, s%, l%)
        const m = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (!m) return [1, 0, 1, 1];
        const h = parseInt(m[1]) / 360, s = parseInt(m[2]) / 100, l = parseInt(m[3]) / 100;
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hue2rgb = (p, q, t) => { if(t < 0) t += 1; if(t > 1) t -= 1; if(t < 1/6) return p + (q - p) * 6 * t; if(t < 1/2) return q; if(t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; };
        return [hue2rgb(p, q, h + 1/3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1/3), 1.0];
    }
}

window.CoralReefGLRenderer = CoralReefGLRenderer;