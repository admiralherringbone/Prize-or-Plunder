/**
 * CoralReefShader.js
 * 
 * Shader for the colorful star-shaped coral formations and their rock bases.
 */
window.CoralReefShader = {
    vertex: `#version 300 es
        layout(location = 0) in vec2 a_position;
        layout(location = 1) in float a_size;
        layout(location = 2) in vec4 a_color;
        layout(location = 3) in float a_type;
        layout(location = 4) in float a_layers;
        layout(location = 5) in float a_seed;

        uniform mat3 u_matrix;
        uniform float u_zoom;

        out vec4 v_color;
        out float v_type;
        out float v_layers;
        out float v_seed;

        void main() {
            v_color = a_color;
            v_type = a_type;
            v_layers = a_layers;
            v_seed = a_seed;

            vec3 pos = u_matrix * vec3(a_position, 1.0);
            gl_Position = vec4(pos.xy, 0.0, 1.0);
            gl_PointSize = a_size * u_zoom * 2.0; 
        }
    `,

    fragment: `#version 300 es
        precision highp float;

        in vec4 v_color;
        in float v_type;
        in float v_layers;
        in float v_seed;
        uniform float u_time;

        out vec4 outColor;

        float getShapeMask(vec2 uv, int type, float t) {
            vec2 p = uv - 0.5;
            float r = length(p) * 2.0;
            float angle = atan(p.y, p.x);
            
            if (type == 0) { // Star (Standard)
                float pulse = 0.7 + 0.3 * sin(angle * 8.0);
                return step(r, pulse);
            } 
            else if (type == 1) { // Tubular Serpentine
                float wave = sin(r * 10.0 - t * 2.0 + angle * 3.0) * 0.1;
                float dist = abs(fract(angle * 1.59) - 0.5); // 5 tentacles
                return smoothstep(0.1 + wave, 0.05 + wave, dist) * step(r, 0.9);
            }
            else if (type == 2) { // Straight Tubular
                float dist = abs(fract(angle * 1.27) - 0.5); // 4 thick spokes
                return step(dist, 0.15) * step(r, 0.85);
            }
            else if (type == 3) { // Multiple Thin Sharp Points (Sea Urchin)
                float spikes = pow(abs(sin(angle * 12.0)), 10.0);
                return step(r, 0.4 + spikes * 0.6);
            }
            else if (type == 4) { // Bulbous Sponge Blobs
                float blobs = sin(p.x * 20.0) * cos(p.y * 20.0);
                return step(r, 0.7 + blobs * 0.2);
            }
            else if (type == 5) { // Semi-circular Disks (Shelf Coral)
                float ring = abs(r - 0.6) - 0.1;
                float angleConstraint = step(0.0, angle) * step(angle, 2.0); // 1/3 circle
                return step(ring, 0.0) * angleConstraint;
            }
            return 0.0;
        }

        void main() {
            vec4 finalColor = vec4(0.0);
            vec3 strokeColor = v_color.rgb * 0.9; // 10% darker
            
            // Draw layers from largest (bottom) to smallest (top)
            int totalLayers = int(v_layers + 0.5);
            
            for (int i = 0; i < 6; i++) {
                if (i >= totalLayers) break;
                
                float level = float(i);
                float scale = pow(0.8, level);
                
                // Pseudo-random rotation based on seed and level (15 to 345 degrees)
                float rotSeed = fract(v_seed * 43758.5453 + level * 12.34);
                float angle = radians(mix(15.0, 345.0, rotSeed));
                
                // Transform UVs for this specific layer
                vec2 centered = gl_PointCoord - 0.5;
                vec2 rotatedUV = vec2(
                    centered.x * cos(angle) - centered.y * sin(angle),
                    centered.x * sin(angle) + centered.y * cos(angle)
                ) / scale + 0.5;

                // Shape + Stroke logic
                float shapeMask = getShapeMask(rotatedUV, int(v_type + 0.5), u_time * 0.001);
                float strokeMask = getShapeMask((rotatedUV - 0.5) * 0.9 + 0.5, int(v_type + 0.5), u_time * 0.001);

                vec4 layerColor = vec4(mix(strokeColor, v_color.rgb, shapeMask), strokeMask);
                finalColor = mix(finalColor, layerColor, layerColor.a);
            }

            if (finalColor.a < 0.1) discard;
            outColor = finalColor;
        }
    `
};