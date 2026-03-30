/**
 * GridShader.js
 * 
 * Standalone shader for the navigational grid.
 */
window.GridShader = {
    vertex: `#version 300 es
        layout(location = 0) in vec2 a_position;

        uniform mat3 u_matrix;
        out vec2 v_worldPos;

        void main() {
            v_worldPos = a_position;
            vec3 pos = u_matrix * vec3(a_position, 1.0);
            gl_Position = vec4(pos.xy, 0.0, 1.0);
        }
    `,

    fragment: `#version 300 es
        precision highp float;

        in vec2 v_worldPos;
        
        uniform vec4 u_gridColor;
        uniform float u_gridSize;

        out vec4 outColor;

        void main() {
            // Procedural grid math
            vec2 gridUV = v_worldPos / u_gridSize;
            vec2 gridDeriv = fwidth(gridUV);
            vec2 gridLines = abs(fract(gridUV - 0.5) - 0.5) / gridDeriv;
            float lineFactor = min(gridLines.x, gridLines.y);
            float gridMask = 1.0 - smoothstep(0.0, 1.5, lineFactor);
            
            if (gridMask < 0.01) discard; // Optimization: Don't draw transparent pixels
            outColor = vec4(u_gridColor.rgb, gridMask * u_gridColor.a);
        }
    `
};