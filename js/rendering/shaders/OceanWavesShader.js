/**
 * OceanWavesShader.js
 * 
 * Procedural shader for small surface wavelets and whitecaps.
 */
window.OceanWavesShader = {
    vertex: `#version 300 es
        layout(location = 0) in vec2 a_position;
        layout(location = 1) in float a_size;
        layout(location = 2) in float a_progress;
        layout(location = 3) in float a_maxOpacity;
        layout(location = 4) in float a_windAngle;

        uniform mat3 u_matrix;
        uniform float u_time;
        uniform float u_zoom;
        out float v_size;
        out float v_alpha;
        out vec2 v_sinCos;

        void main() {
            v_size = a_size;
            
            // Expansion/Contraction factor (0.0 -> 1.0 -> 0.0)
            float pulse = sin(a_progress * 3.14159);
            v_alpha = a_maxOpacity * pulse;
            
            // Pre-calculate rotation for this specific wavelet's birth wind
            float ang = 1.5708 - a_windAngle;
            v_sinCos = vec2(sin(ang), cos(ang));

            vec3 pos = u_matrix * vec3(a_position, 1.0);
            gl_Position = vec4(pos.xy, 0.0, 1.0);
            
            // --- NEW: Dynamic Expansion and Contraction ---
            // Scale the point size by the lifecycle pulse
            gl_PointSize = a_size * u_zoom * pulse;
        }
    `,

    fragment: `#version 300 es
        precision highp float;
        
        uniform float u_time;
        in float v_size;
        in float v_alpha;
        in vec2 v_sinCos;

        out vec4 outColor;

        void main() {
            // --- FIX: Correct UV rotation for Wind Alignment ---
            // We want the local "Up" of our wavelet sprite (negative local Y) to 
            // point exactly in the wind direction.
            vec2 centered = gl_PointCoord - 0.5;
            vec2 uv = vec2(
                centered.x * v_sinCos.y - centered.y * v_sinCos.x,
                centered.x * v_sinCos.x + centered.y * v_sinCos.y
            ) + 0.5;

            float x = (uv.x - 0.5) * 2.0; // Normalize X to -1.0 to 1.0
            float x2 = x * x;
            float invX2 = 1.0 - x2;
            
            // 2. Add organic wobble (Sine interference)
            float t = u_time * 0.005;
            float wobble = sin(uv.x * 10.0 + t) * 0.03 + 
                           sin(uv.x * 25.0 - t * 1.5) * 0.01;
            
            // 1. Create the base curve (the "ripple" arc)
            // --- MODIFIED: Size-Dependent Flattening ---
            // We reduce the vertical height factor as wavelets get larger.
            float flattenFactor = mix(0.20, 0.10, smoothstep(40.0, 200.0, v_size));
            
            // --- FIX: Crest-Up Geometry ---
            // Using a positive multiplier for the pow function makes the cusp (x=0)
            // the minimum Y value (the peak) relative to the ends.
            float curve = pow(abs(x), 0.5) * flattenFactor;
            float rippleLine = 0.5 - flattenFactor + curve + wobble;
            
            // 3. Variable Thickness: Thick in the middle, tapered at the ends
            float thickness = invX2 * 0.04;
            float dist = abs(uv.y - rippleLine);
            float mask = smoothstep(thickness, thickness * 0.5, dist);

            if (mask < 0.1) discard;
            outColor = vec4(1.0, 1.0, 1.0, mask * invX2 * v_alpha);
        }
    `
};