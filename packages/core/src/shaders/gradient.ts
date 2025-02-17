export const frag = /* wgsl */ `
#version 300 es
precision highp float;
in vec2 vTexCoord;
out vec4 fragColor;

// Uniforms

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_noiseTime;
uniform vec3 u_bgColor;
uniform vec3 u_colors[10];
uniform vec2 u_positions[10];
uniform int u_numberPoints;
uniform float u_noiseRatio;
uniform float u_warpRatio;
uniform float u_warpSize;
uniform vec2 u_mouse;
uniform int u_gradientTypeIndex;
uniform int u_warpShapeIndex;


// Random number generator

float rand(vec2 n) {
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}
// float rand(vec2 co) {
//     return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
// }

// Simplex 3D Noise
// by Ian McEwan, Ashima Arts
vec4 permute(vec4 x) {
    return mod(((x*34.0)+1.0)*x, 289.0);
}
vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}
float snoise(vec3 v) {
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner

    vec3 i = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;

    // Other corners

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1. + 3.0 * C.xxx;

    // Permutations

    i = mod(i, 289.0 );
    vec4 p = permute( permute( permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    // Gradients

    float n_ = 1.0/7.0; // N = 7

    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p, N*N)


    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    // mod(j, N)


    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    // Normalise gradients

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3) ) );
}
// New function for smooth interpolation
float smootherstep(float edge0, float edge1, float x) {
    x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}
// New function for calculating influence
float calculateInfluence(vec2 st, vec2 pointPos) {
    float dist = distance(st, pointPos);
    return smootherstep(1.0, 0.0, dist);
}
vec3 calculateOriginalWarpGradient(vec2 st) {
    float pointGradient = 0.0;
    vec3 colorGradient = vec3(0.0);
    float totalLight = 1.0;
    for(int i = 0; i < 10; i++) {
        if(i < u_numberPoints) {
            vec3 color = u_colors[i];
            vec2 pointPos = u_positions[i];
            float dist = 1.0 - distance(st, pointPos) * 1.1;
            float clampedDist = clamp(dist, 0.0, 1.0);
            pointGradient += clampedDist;
            colorGradient += color * clampedDist;
            totalLight *= (1.0 - clampedDist) * (1.0 - clampedDist);
        }

    }
    totalLight = smoothstep(0.0, 1.0, clamp(1.0 - totalLight, 0.0, 1.0));
    colorGradient = (colorGradient / pointGradient) * totalLight;
    vec3 bgGradient = (1.0 - totalLight) * u_bgColor;
    return clamp(colorGradient, 0.0, 1.0) + bgGradient;
}
vec3 calculateBezierGradient(vec2 st) {
    vec3 color = vec3(0.0);
    float totalWeight = 0.0;
    float sigma = 0.2; // Standard deviation for Gaussian distribution

    float twoSigmaSquare = 2.0 * sigma * sigma;
    for (int i = 0; i < 10; i++) {
        if (i >= u_numberPoints) break;
        vec2 pointPos = u_positions[i];
        float dist = distance(st, pointPos);

        // Gaussian weight

        float weight = exp(-dist * dist / twoSigmaSquare);
        color += u_colors[i] * weight;
        totalWeight += weight;
    }
    if (totalWeight > 0.0) {
        color /= totalWeight;
    }
    else {
        color = u_bgColor;
    }
    return color;
}
vec3 calculateMeshGradient(vec2 st) {
    const int GRID_SIZE = 3; // 3x3 grid

    vec2 gridSt = st * float(GRID_SIZE - 1);
    vec2 gridCell = floor(gridSt);
    vec2 gridFract = fract(gridSt);
    vec3 colorBottomLeft = u_bgColor;
    vec3 colorBottomRight = u_bgColor;
    vec3 colorTopLeft = u_bgColor;
    vec3 colorTopRight = u_bgColor;
    int index = int(gridCell.y) * GRID_SIZE + int(gridCell.x);

    // Bottom Left

    if (index == 0 && 0 < u_numberPoints) colorBottomLeft = u_colors[0];
    if (index == 1 && 1 < u_numberPoints) colorBottomLeft = u_colors[1];
    if (index == 2 && 2 < u_numberPoints) colorBottomLeft = u_colors[2];
    if (index == 3 && 3 < u_numberPoints) colorBottomLeft = u_colors[3];
    if (index == 4 && 4 < u_numberPoints) colorBottomLeft = u_colors[4];
    if (index == 5 && 5 < u_numberPoints) colorBottomLeft = u_colors[5];
    if (index == 6 && 6 < u_numberPoints) colorBottomLeft = u_colors[6];
    if (index == 7 && 7 < u_numberPoints) colorBottomLeft = u_colors[7];
    if (index == 8 && 8 < u_numberPoints) colorBottomLeft = u_colors[8];

    // Bottom Right

    if (index + 1 == 0 && 0 < u_numberPoints) colorBottomRight = u_colors[0];
    if (index + 1 == 1 && 1 < u_numberPoints) colorBottomRight = u_colors[1];
    if (index + 1 == 2 && 2 < u_numberPoints) colorBottomRight = u_colors[2];
    if (index + 1 == 3 && 3 < u_numberPoints) colorBottomRight = u_colors[3];
    if (index + 1 == 4 && 4 < u_numberPoints) colorBottomRight = u_colors[4];
    if (index + 1 == 5 && 5 < u_numberPoints) colorBottomRight = u_colors[5];
    if (index + 1 == 6 && 6 < u_numberPoints) colorBottomRight = u_colors[6];
    if (index + 1 == 7 && 7 < u_numberPoints) colorBottomRight = u_colors[7];
    if (index + 1 == 8 && 8 < u_numberPoints) colorBottomRight = u_colors[8];

    // Top Left

    if (index + GRID_SIZE == 0 && 0 < u_numberPoints) colorTopLeft = u_colors[0];
    if (index + GRID_SIZE == 1 && 1 < u_numberPoints) colorTopLeft = u_colors[1];
    if (index + GRID_SIZE == 2 && 2 < u_numberPoints) colorTopLeft = u_colors[2];
    if (index + GRID_SIZE == 3 && 3 < u_numberPoints) colorTopLeft = u_colors[3];
    if (index + GRID_SIZE == 4 && 4 < u_numberPoints) colorTopLeft = u_colors[4];
    if (index + GRID_SIZE == 5 && 5 < u_numberPoints) colorTopLeft = u_colors[5];
    if (index + GRID_SIZE == 6 && 6 < u_numberPoints) colorTopLeft = u_colors[6];
    if (index + GRID_SIZE == 7 && 7 < u_numberPoints) colorTopLeft = u_colors[7];
    if (index + GRID_SIZE == 8 && 8 < u_numberPoints) colorTopLeft = u_colors[8];

    // Top Right

    if (index + GRID_SIZE + 1 == 0 && 0 < u_numberPoints) colorTopRight = u_colors[0];
    if (index + GRID_SIZE + 1 == 1 && 1 < u_numberPoints) colorTopRight = u_colors[1];
    if (index + GRID_SIZE + 1 == 2 && 2 < u_numberPoints) colorTopRight = u_colors[2];
    if (index + GRID_SIZE + 1 == 3 && 3 < u_numberPoints) colorTopRight = u_colors[3];
    if (index + GRID_SIZE + 1 == 4 && 4 < u_numberPoints) colorTopRight = u_colors[4];
    if (index + GRID_SIZE + 1 == 5 && 5 < u_numberPoints) colorTopRight = u_colors[5];
    if (index + GRID_SIZE + 1 == 6 && 6 < u_numberPoints) colorTopRight = u_colors[6];
    if (index + GRID_SIZE + 1 == 7 && 7 < u_numberPoints) colorTopRight = u_colors[7];
    if (index + GRID_SIZE + 1 == 8 && 8 < u_numberPoints) colorTopRight = u_colors[8];

    // Bilinear interpolation

    vec3 colorBottom = mix(colorBottomLeft, colorBottomRight, gridFract.x);
    vec3 colorTop = mix(colorTopLeft, colorTopRight, gridFract.x);
    return mix(colorBottom, colorTop, gridFract.y);
}
vec3 calculateMeshGradient2(vec2 st) {
    const int GRID_SIZE = 3; // 6x6 grid for finer granularity

    vec2 gridSt = st * float(GRID_SIZE - 1);
    ivec2 gridCell = ivec2(floor(gridSt));
    vec2 gridFract = fract(gridSt);

    // Ensure the colors array matches the grid size (36 for a 6x6 grid)

    vec3 colors[9];
    for (int i = 0; i < 9; i++) {
        colors[i] = u_bgColor; // Initialize with background color
    }
    // Assign colors based on user positions
    for (int i = 0; i < u_numberPoints; i++) {
        vec2 pos = u_positions[i] * float(GRID_SIZE - 1);
        ivec2 cell = ivec2(floor(pos));
        if (cell.x >= 0 && cell.x < GRID_SIZE && cell.y >= 0 && cell.y < GRID_SIZE) {
            int index = cell.y * GRID_SIZE + cell.x;
            colors[index] = u_colors[i];
        }

    }
    // Get colors for current cell corners
    int index = gridCell.y * GRID_SIZE + gridCell.x;
    vec3 colorBottomLeft = colors[index];
    vec3 colorBottomRight = (gridCell.x < GRID_SIZE - 1) ? colors[index + 1] : u_bgColor;
    vec3 colorTopLeft = (gridCell.y < GRID_SIZE - 1) ? colors[index + GRID_SIZE] : u_bgColor;
    vec3 colorTopRight = (gridCell.x < GRID_SIZE - 1 && gridCell.y < GRID_SIZE - 1) ? colors[index + GRID_SIZE + 1] : u_bgColor;

    // Bilinear interpolation for smooth color transition

    vec3 colorBottom = mix(colorBottomLeft, colorBottomRight, gridFract.x);
    vec3 colorTop = mix(colorTopLeft, colorTopRight, gridFract.x);
    return mix(colorBottom, colorTop, gridFract.y);
}
vec3 calculateEnhancedBezier(vec2 st) {
    vec3 color = vec3(0.0);
    float totalWeight = 0.0;

    // Adjustable parameters for gradient behavior

    float baseSigma = 0.25;       // Base spread of each color point

    float weightExponent = 1.8;    // Controls how quickly influence drops off

    float smoothingFactor = 1.2;   // Controls color transition smoothness


    // Calculate weighted contribution from each point
    for (int i = 0; i < 10; i++) {
        if (i >= u_numberPoints) break;
        vec2 pointPos = u_positions[i];
        float dist = distance(st, pointPos);

        // Enhanced weight calculation with smoother falloff

        float weight = exp(-dist * dist / (2.0 * baseSigma * baseSigma));
        weight = pow(weight, weightExponent);

        // Apply smoothing to weight

        weight = smoothstep(0.0, smoothingFactor, weight);
        color += u_colors[i] * weight;
        totalWeight += weight;
    }
    // Normalize colors with enhanced blending
    if (totalWeight > 0.0) {
        color = color / totalWeight;

        // Subtle enhancement of color vibrancy

        color = mix(color, pow(color, vec3(0.95)), 0.3);
    }
    else {
        color = u_bgColor;
    }
    return color;
}
// Value Noise with increased contrast
float valueNoise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = rand(i);
    float b = rand(i + vec2(1.0, 0.0));
    float c = rand(i + vec2(0.0, 1.0));
    float d = rand(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    float n = mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    // Increase contrast

    return (n - 0.5) * 2.0;
}
// Worley Noise with inverted and scaled output
float worleyNoise(vec2 st) {
    vec2 i_st = floor(st);
    vec2 f_st = fract(st);
    float m_dist = 1.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = vec2(rand(i_st + neighbor), rand(i_st + neighbor + vec2(12.9898, 78.233)));
            vec2 diff = neighbor + point - f_st;
            float dist = length(diff);
            m_dist = min(m_dist, dist);
        }

    }
    // Invert and scale the output
    return (1.0 - m_dist) * 2.0;
}
float fbm(vec2 st) {
    const int OCTAVES = 6;
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 0.0;
    // Lacunarity: Increase in frequency with each octave

    float lacunarity = 2.0;
    // Gain: Decrease in amplitude with each octave

    float gain = 0.5;
    for (int i = 0; i < OCTAVES; i++) {
        value += amplitude * valueNoise(st);
        st *= lacunarity;
        amplitude *= gain;
    }
    return value;
}
// Voronoi Noise
float voronoiNoise(vec2 st) {
    vec2 i_st = floor(st);
    vec2 f_st = fract(st);
    float m_dist = 1.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = vec2(rand(i_st + neighbor), rand(i_st + neighbor + vec2(1.0)));
            point = 0.5 + 0.5 * sin(u_time + 6.2831 * point);
            vec2 diff = neighbor + point - f_st;
            float dist = length(diff);
            m_dist = min(m_dist, dist);
        }

    }
    return m_dist;
}
// Domain Warping
vec2 domainWarp(vec2 p) {
    float n1 = snoise(vec3(p + u_time * 0.1, 0.0));
    float n2 = snoise(vec3(p + u_time * 0.1 + 5.0, 0.0));
    return vec2(p.x + n1 * 0.2, p.y + n2 * 0.2);
}
// Smooth layered sine waves
float wavesNoise(vec2 st) {
    float noise = 0.0;

    // Layer 1: Primary waves

    vec2 pos1 = st * 3.0;
    noise += sin(pos1.x + u_time * 0.2) * 0.5 + 0.5;
    noise += sin(pos1.y + u_time * 0.2) * 0.5 + 0.5;

    // Layer 2: Secondary waves at different angle

    vec2 pos2 = vec2(
    st.x * cos(0.7854) - st.y * sin(0.7854), st.x * sin(0.7854) + st.y * cos(0.7854)
    ) * 4.0;
    noise += sin(pos2.x) * 0.25 + 0.25;
    noise += sin(pos2.y) * 0.25 + 0.25;
    return noise / 3.0;
}
// Gradient noise with controlled smoothness
float smoothGradient(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Smoother interpolation

    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = rand(i);
    float b = rand(i + vec2(1.0, 0.0));
    float c = rand(i + vec2(0.0, 1.0));
    float d = rand(i + vec2(1.0, 1.0));
    float noise = mix(
    mix(a, b, u.x), mix(c, d, u.x), u.y
    );
    return noise * 0.8 + 0.1; // Adjust contrast
}
// Sphere effect
float sphereNoise(vec2 st) {
    vec2 center = vec2(0.5);
    float dist = distance(st, center);

    // Create smooth sphere falloff

    float sphere = smoothstep(0.5, 0.0, dist);

    // Add subtle movement

    float angle = atan(st.y - 0.5, st.x - 0.5);
    float movement = sin(angle * 2.0 + u_time * 0.2) * 0.02;
    return sphere + movement;
}
// Stepped rows effect
float rowsNoise(vec2 st) {
    // Number of rows
    float rows = 15.0;

    // Create base row pattern

    float y = st.y * rows;
    float row = floor(y);

    // Add horizontal offset based on row number

    float offset = row * 0.1;
    float x = st.x + offset;

    // Add movement

    float movement = sin(u_time * 0.2 + row * 0.5) * 0.02;
    x += movement;

    // Smooth stepping between rows

    float smoothRow = smoothstep(0.0, 0.1, fract(y));
    return mix(x, x + 0.1, smoothRow);
}
float columnsNoise(vec2 st) {
    // Number of columns
    float cols = 15.0;

    // Create base column pattern

    float x = st.x * cols;
    float col = floor(x);

    // Add vertical offset based on column number

    float offset = col * 0.1;
    float y = st.y + offset;

    // Add movement

    float movement = sin(u_time * 0.2 + col * 0.5) * 0.02;
    y += movement;

    // Smooth stepping between columns

    float smoothCol = smoothstep(0.0, 0.1, fract(x));
    return mix(y, y + 0.1, smoothCol);
}
// Flat/Stable pattern - minimal movement
float flatNoise(vec2 st) {
    // Create a very subtle, stable pattern
    float pattern = sin(st.x * 2.0) * 0.02 + cos(st.y * 2.0) * 0.02;
    return pattern;
}
float blackHoleNoise(vec2 st) {
    vec2 center = vec2(0.5);
    float dist = distance(st, center);

    // Calculate angle for spiral effect

    float angle = atan(st.y - center.y, st.x - center.x);

    // Wider, more gradual falloff

    float pull = 1.0 - smoothstep(0.0, 1.5, dist);

    // Gentler spiral effect

    float spiral = angle + u_time * 0.1;

    // Layer multiple subtle distortions

    float distortion = 0.0;
    distortion += sin(spiral * 2.0 + dist * 4.0) * 0.3;
    distortion += cos(spiral * 1.5 - dist * 3.0) * 0.2;

    // Combine with pull for smoother falloff

    distortion *= pull * pull;

    // Add subtle secondary vortex

    float secondaryDist = distance(st, center + vec2(0.2, 0.0));
    float secondaryPull = 1.0 - smoothstep(0.0, 1.2, secondaryDist);
    float secondarySpiral = angle + u_time * 0.08;
    distortion += sin(secondarySpiral * 1.5) * secondaryPull * 0.15;
    return distortion;
}
// Update the applyWarpShape function:
vec2 applyWarpShape(vec2 st, float warpSize, float time) {
    vec2 warp;
    switch(u_warpShapeIndex) {
        case 0: // Original simplex noise
        warp = vec2(snoise(vec3(st*warpSize, time)));
        break;
        case 1: // Circular warp
        warp = vec2(sin(length(st-0.5)*warpSize + time), cos(length(st-0.5)*warpSize + time)) * 0.5;
        break;
        case 2: // Value Noise
        warp = vec2(valueNoise(st*warpSize + time * 0.5)) * 0.5;
        break;
        case 3: // Worley Noise
        warp = vec2(worleyNoise(st*warpSize + time * 0.5)) * 0.5;
        break;
        case 4: // FBM Noise
        warp = vec2(fbm(st*warpSize + time * 0.2)) * 0.4;
        break;
        case 5: // Voronoi Noise
        warp = vec2(voronoiNoise(st*warpSize + time * 0.2)) * 0.5;
        break;
        case 6: // Domain Warping
        warp = vec2(domainWarp(st*warpSize) * 0.5);
        break;
        case 7: // Wave Layers
        warp = vec2(wavesNoise(st*warpSize)) * 0.4;
        break;
        case 8: // Smooth Fields
        warp = vec2(smoothGradient(st*warpSize + time * 0.1)) * 0.5;
        break;
        case 9: // Sphere
        warp = vec2(sphereNoise(st)) * warpSize * 0.8;
        break;
        case 10: // Rows
        warp = vec2(rowsNoise(st)) * warpSize * 0.5;
        break;
        case 11: // Columns
        warp = vec2(columnsNoise(st)) * warpSize * 0.5;
        break;
        case 12: // New: Flat
        warp = vec2(flatNoise(st)) * warpSize;
        break;
        case 13: // Black Hole
        float effect = blackHoleNoise(st);
        vec2 toCenter = st - vec2(0.5);
        float len = length(toCenter);
        if (len > 0.0) {
            vec2 dir = toCenter / len;
            warp = dir * effect * warpSize * 1.5;
        }
        else {
            warp = vec2(0.0);
        }
        break;
        default:
        warp = vec2(0.0);
    }
    return warp;
}
void main() {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    st.y = 1.0 - st.y;

    // Apply warping

    vec2 warp = applyWarpShape(st, u_warpSize, u_time) * u_warpRatio;
    vec2 warpedSt = st + warp;

    // Select gradient type based on u_gradientTypeIndex

    vec3 gradientColor;
    if (u_gradientTypeIndex == 0) {
        gradientColor = calculateOriginalWarpGradient(warpedSt);
    }
    else if (u_gradientTypeIndex == 1) {
        gradientColor = calculateBezierGradient(warpedSt);
    }
    else if (u_gradientTypeIndex == 2) {
        gradientColor = calculateMeshGradient(warpedSt);
    }
    else if (u_gradientTypeIndex == 3) {
        gradientColor = calculateMeshGradient2(warpedSt);
    }
    else if (u_gradientTypeIndex == 4) {
        gradientColor = calculateEnhancedBezier(warpedSt);
    }
    else {
        gradientColor = u_bgColor; // Default fallback
    }
    // Apply noise
    vec3 noise = vec3(rand(vec2(st.x*5.+u_noiseTime, st.y*5.-u_noiseTime)));
    vec3 finalColor = mix(gradientColor, noise, u_noiseRatio);
    fragColor = vec4(finalColor, 1.0);
}
`