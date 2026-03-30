/**
 * ShoalShader.js
 * 
 * Standalone shader for the shallow sandbars (shoals).
 * Supports alpha blending to allow the ocean to show through.
 */
window.ShoalShader = {
    vertex: `#version 300 es
        layout(location = 0) in vec2 a_position;

        uniform mat3 u_matrix;

        void main() {
            vec3 pos = u_matrix * vec3(a_position, 1.0);
            gl_Position = vec4(pos.xy, 0.0, 1.0);
        }
    `,

    fragment: `#version 300 es
        precision highp float;

        uniform vec4 u_color;

        out vec4 outColor;

        void main() {
            outColor = u_color;
        }
    `
};