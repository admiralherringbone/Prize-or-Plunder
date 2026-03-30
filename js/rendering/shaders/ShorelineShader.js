/**
 * ShorelineShader.js
 * 
 * Contains the GLSL source code for the WebGL shoreline and water effects.
 * The Vertex Shader handles world-to-screen transformations.
 * The Fragment Shader handles the procedural water color and ripple shimmer.
 */

window.ShorelineShader = {
    // --- 1. OCEAN SHADER (Full-World Shimmer) ---
    // Converts game world coordinates into WebGL clip space.
    oceanVertex: `#version 300 es
        layout(location = 0) in vec2 a_position;

        // Matrix to convert World pixels -> View space -> Clip space (-1 to 1)
        uniform mat3 u_matrix;

        out vec2 v_worldPos;

        void main() {
            // Pass the world position to the fragment shader for procedural math
            v_worldPos = a_position;

            // Multiply position by our transformation matrix
            vec3 pos = u_matrix * vec3(a_position, 1.0);
            gl_Position = vec4(pos.xy, 0.0, 1.0);
        }
    `,

    oceanFragment: `#version 300 es
        precision highp float;

        in vec2 v_worldPos;
        
        uniform float u_time;
        uniform vec4 u_baseColor; // The OCEAN_BLUE color
        uniform float u_enableShimmer; // 1.0 = On, 0.0 = Off

        out vec4 outColor;

        void main() {
            // --- OPTIMIZATION: Early Exit if Shimmer is Disabled ---
            if (u_enableShimmer < 0.5) {
                outColor = u_baseColor;
                return;
            }

            // --- PROCEDURAL WATER SHIMMER ---
            // We combine multiple sine waves at different frequencies and directions
            // to create an organic, non-repeating water surface pattern.
            
            float time = u_time * 0.001; // Convert ms to seconds
            
            // --- NEW: Domain Warping ---
            // We use a large-scale, slow distortion to "bend" the coordinate system.
            // This prevents the waves from forming perfectly straight lines.
            float distortion = sin(v_worldPos.x * 0.001 + v_worldPos.y * 0.0012 + time * 0.1) * 40.0;
            vec2 warpedPos = v_worldPos + distortion;
            
            // Wave 1: Large slow swell (Now using warped coordinates)
            // We use prime-ish numbers for frequencies to avoid clean overlaps.
            float w1 = sin(warpedPos.x * 0.0031 + warpedPos.y * 0.0017 + time * 0.3) * 0.5 + 0.5;
            
            // Wave 2: Medium diagonal chop
            // Unbalancing the X and Y multipliers (0.007 vs 0.011) breaks the 45-degree pattern.
            float w2 = sin((warpedPos.x * 0.0073 + warpedPos.y * 0.0113) - time * 1.2) * 0.5 + 0.5;
            
            // Wave 3: Small fast highlights
            float w3 = sin((warpedPos.x * 0.0191 - warpedPos.y * 0.0233) + time * 2.5) * 0.5 + 0.5;

            // Blend the waves
            float shimmer = (w1 * 0.4) + (w2 * 0.4) + (w3 * 0.2);
            
            // Create highlights (white caps) by checking where waves peak
            float highlight = pow(shimmer, 10.0) * 0.35; // Sharper highlights

            // Apply color
            vec3 finalColor = u_baseColor.rgb;
            
            // Add subtle depth variation
            finalColor += (shimmer - 0.5) * 0.05;
            
            // Add highlights
            finalColor += highlight;

            outColor = vec4(finalColor, u_baseColor.a);
        }
    `
    ,

    // --- 3. DYNAMIC WAVE SHADER ---
    dynamicWaveVertex: `#version 300 es
        layout(location = 0) in vec2 a_position;
        layout(location = 1) in vec2 a_normal;
        layout(location = 2) in float a_dist;
        layout(location = 3) in float a_extrude; // 0.0 = Shore, 1.0 = Wave Edge

        uniform mat3 u_matrix;
        uniform float u_time;
        uniform float u_offsetDist;
        uniform float u_inwardOffset; // New: For the inner edge of the wave strip
        uniform float u_waveStrokeFactor;
        uniform float u_macroAmp1;
        uniform float u_macroAmp2;
        uniform float u_closureCorrection;
        uniform float u_macroCorrection;
        uniform float u_fadeFactor;
        uniform float u_maxInwardDist; // New: Reference for on-shore surge limit
        uniform float u_isOnShore; // New: Flag to enable noise tapering

        out float v_dist;
        out float v_edgeDist; // Pass extrusion factor to fragment (0=shore, 1=edge)
        out float v_alpha;

        void main() {
            float t = u_time * 0.001; // linear time in seconds
            float dist = a_dist;

            // --- NEW: Noise Tapering (Matches CPU logic) ---
            float noiseTaper = 1.0;
            if (u_isOnShore > 0.5 && u_maxInwardDist > 0.0) {
                // u_offsetDist is negative for inward movement (starts at 0, moves toward -u_maxInwardDist)
                float surgeProgress = clamp(-u_offsetDist / u_maxInwardDist, 0.0, 1.0);
                noiseTaper = 1.0 - surgeProgress;
            }

            // --- Procedural Ripple Math (Matches CPU logic) ---
            float ripple = sin(dist * 0.01 + t * 2.0) * 5.0;
            float r = (ripple - (u_closureCorrection * dist)) * 1.5;

            // Macro Organic Variation
            float macroVal = sin(dist * 0.003 + t * 0.3) * (u_macroAmp1 + u_macroAmp2 * 0.5);
            float m = (macroVal - (u_macroCorrection * dist));

            // Expand/Contract vertex along the baked normal
            // --- FIX: Use negative sign to flip inward normal into an OUTWARD expansion ---
            // --- MODIFIED: Apply noiseTaper to keep surf within the 5% margin ---
            float totalNoise = (r + m * u_waveStrokeFactor) * noiseTaper;
            float currentDisplacement = mix(u_inwardOffset, -(u_offsetDist + totalNoise), a_extrude);
            vec2 displacedPos = a_position + a_normal * currentDisplacement;

            v_dist = dist;
            v_edgeDist = a_extrude;
            v_alpha = u_fadeFactor;

            vec3 pos = u_matrix * vec3(displacedPos, 1.0);
            gl_Position = vec4(pos.xy, 0.0, 1.0);
        }
    `,

    dynamicWaveFragment: `#version 300 es
        precision highp float;

        in float v_dist;
        in float v_edgeDist;
        in float v_alpha;

        uniform float u_time;
        uniform vec4 u_baseColor; // Usually Surge color or grid pattern color

        out vec4 outColor;

        void main() {
            vec4 finalColor = u_baseColor;
            finalColor.a *= v_alpha;
            outColor = finalColor;
        }
    `,

    // --- 4. FOAM POINT SHADER (Instanced Bubbles) ---
    foamPointVertex: `#version 300 es
        layout(location = 0) in vec2 a_position;
        layout(location = 1) in vec2 a_normal;
        layout(location = 2) in float a_dist;
        layout(location = 3) in vec2 a_noise; // x: jitter, y: size_mult

        uniform mat3 u_matrix;
        uniform float u_time;
        uniform float u_zoom;
        uniform float u_offsetDist;
        uniform float u_waveStrokeFactor;
        uniform float u_macroAmp1;
        uniform float u_macroAmp2;
        uniform float u_closureCorrection;
        uniform float u_macroCorrection;
        uniform float u_fadeFactor;
        uniform float u_maxInwardDist;
        uniform float u_isOnShore;

        out float v_dist;
        out float v_alpha;
        out float v_isRock; // New: Pass rock status to fragment

        void main() {
            float t = u_time * 0.001;
            float noiseTaper = 1.0;
            if (u_isOnShore > 0.5 && u_maxInwardDist > 0.0) {
                float surgeProgress = clamp(-u_offsetDist / u_maxInwardDist, 0.0, 1.0);
                noiseTaper = 1.0 - surgeProgress;
            }

            float r = (sin(a_dist * 0.01 + t * 2.0) * 5.0 - (u_closureCorrection * a_dist)) * 1.5;
            float m = (sin(a_dist * 0.003 + t * 0.3) * (u_macroAmp1 + u_macroAmp2 * 0.5) - (u_macroCorrection * a_dist));

            float totalNoise = (r + m * u_waveStrokeFactor) * noiseTaper;
            // Foam points are anchored to the leading edge (offsetDist + noise) plus baked-in jitter
            float displacement = -(u_offsetDist + totalNoise) + a_noise.x;
            vec2 displacedPos = a_position + a_normal * displacement;

            v_dist = a_dist;
            v_alpha = u_fadeFactor;
            v_isRock = (u_macroAmp1 < 0.1) ? 1.0 : 0.0;

            vec3 pos = u_matrix * vec3(displacedPos, 1.0);
            gl_Position = vec4(pos.xy, 0.0, 1.0);
            // Ensure bubbles remain at least 1 pixel large so they don't flicker when zoomed out
            gl_PointSize = max(1.0, (6.0 + a_noise.y * 10.0) * u_zoom);
        }
    `,

    foamPointFragment: `#version 300 es
        precision highp float;
        in float v_dist;
        in float v_alpha;
        in float v_isRock;
        uniform float u_time;
        out vec4 outColor;
        void main() {
            // Render a circular bubble
            float d = distance(gl_PointCoord, vec2(0.5));
            if (d > 0.5) discard;

            // Cluster clumping logic
            // --- NEW: Dynamic Clumping Frequency ---
            // Rocks use a higher frequency (0.15) to create smaller, tighter bubble clusters
            // matching the 2D visual style, while Islands keep coarse patches (0.02).
            float freq = (v_isRock > 0.5) ? 0.15 : 0.02;
            float cluster = sin(v_dist * freq) * sin(v_dist * freq * 0.75 + 2.0);
            
            // Use smoothstep instead of a hard discard to prevent popping
            float clumpingAlpha = smoothstep(-0.2, 0.2, cluster);

            outColor = vec4(1.0, 1.0, 1.0, smoothstep(0.5, 0.4, d) * clumpingAlpha * v_alpha);
        }
    `,

    // --- LEGACY COMPATIBILITY ---
    // Maintain these for ShorelineGLRenderer.js until we update it to use the dual-program model.
    get vertex() { return this.oceanVertex; },
    get fragment() { return this.oceanFragment; }
};