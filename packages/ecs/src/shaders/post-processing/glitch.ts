/**
 * UV jitter ({@link https://github.com/pmndrs/postprocessing/blob/main/src/effects/glsl/glitch.frag pmndrs glitch.frag})
 * + horizontal RGB split ({@link https://github.com/staffantan/unityglitch/blob/master/GlitchShader.shader Unity GlitchShader})
 * + DIGITAL: low-freq gnoise masks (few large irregular regions) + sparse threshold + coarse shift cells (coherent samples).
 *
 * Uniforms: `u_Glitch0` = (jitter 0–1, rgbSplit scale, time seconds, blocks 0–1), `u_Glitch1` = (texture width, height, 0, 0).
 */
export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_Glitch0;
  vec4 u_Glitch1;
};

out vec4 outputColor;

vec2 h22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

vec3 hash33(vec3 p) {
  vec3 p3 = fract(p * vec3(.1031, .1030, .0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx) * 2.0 - 1.0;
}

float gnoise(vec3 x) {
  vec3 p = floor(x);
  vec3 w = fract(x);
  vec3 u = w * w * w * (w * (w * 6.0 - 15.0) + 10.0);

  vec3 ga = hash33(p + vec3(0., 0., 0.));
  vec3 gb = hash33(p + vec3(1., 0., 0.));
  vec3 gc = hash33(p + vec3(0., 1., 0.));
  vec3 gd = hash33(p + vec3(1., 1., 0.));
  vec3 ge = hash33(p + vec3(0., 0., 1.));
  vec3 gf = hash33(p + vec3(1., 0., 1.));
  vec3 gg = hash33(p + vec3(0., 1., 1.));
  vec3 gh = hash33(p + vec3(1., 1., 1.));

  float va = dot(ga, w - vec3(0., 0., 0.));
  float vb = dot(gb, w - vec3(1., 0., 0.));
  float vc = dot(gc, w - vec3(0., 1., 0.));
  float vd = dot(gd, w - vec3(1., 1., 0.));
  float ve = dot(ge, w - vec3(0., 0., 1.));
  float vf = dot(gf, w - vec3(1., 0., 1.));
  float vg = dot(gg, w - vec3(0., 1., 1.));
  float vh = dot(gh, w - vec3(1., 1., 1.));

  float gNoise = va + u.x * (vb - va) +
    u.y * (vc - va) +
    u.z * (ve - va) +
    u.x * u.y * (va - vb - vc + vd) +
    u.y * u.z * (va - vc - ve + vg) +
    u.z * u.x * (va - vb - ve + vf) +
    u.x * u.y * u.z * (-va + vb + vc - vd + ve - vf - vg + vh);

  return 2.0 * gNoise;
}

float gnoise01(vec3 x) {
  return 0.5 + 0.5 * gnoise(x);
}

void main(void) {
  vec2 uv = v_Uv;
  vec2 res = max(u_Glitch1.xy, vec2(1.0));
  float jitterAmt = clamp(u_Glitch0.x, 0.0, 1.0);
  float rgbSplit = max(u_Glitch0.y, 0.0);
  float t = u_Glitch0.z;
  float blocksAmt = clamp(u_Glitch0.w, 0.0, 1.0);

  vec2 jitter = (h22(uv * 100.0 + t * 17.0) - vec2(0.5)) * jitterAmt * 0.012;
  uv += jitter;
  uv = clamp(uv, vec2(0.001), vec2(0.999));

  vec2 eps = vec2((2.0 + rgbSplit * 400.0) / res.x, 0.0) * jitterAmt;
  vec2 epsBlock = vec2((2.0 + rgbSplit * 400.0) / res.x, 0.0) * blocksAmt;

  vec4 cr = texture(SAMPLER_2D(u_Texture), uv + eps);
  vec4 cg = texture(SAMPLER_2D(u_Texture), uv);
  vec4 cb = texture(SAMPLER_2D(u_Texture), uv - eps);

  vec3 col = vec3(cr.r, cg.g, cb.b);
  float alpha = cg.a;

  // --- DIGITAL: Shadertoy-style masks, but lower spatial frequency → fewer, larger irregular blocks; sparse step threshold.
  float bt = floor(t * 30.0) * 300.0 + 10.0;
  // step(gnoise01, T): ~T fraction of axis bands on; keep T moderate so combined mask stays sparse.
  float blockGlitch = 0.11 + 0.42 * blocksAmt;
  vec2 buv = uv;
  // ~1/3 of reference frequencies → blobby regions; two X/Y scales keep non-uniform block aspect.
  float blockNoiseX = step(gnoise01(vec3(0., buv.x * 1.0, bt)), blockGlitch);
  float blockNoiseX2 = step(gnoise01(vec3(0., buv.x * 0.5, bt * 1.2)), blockGlitch);
  float blockNoiseY = step(gnoise01(vec3(0., buv.y * 1.35, bt)), blockGlitch);
  float blockNoiseY2 = step(gnoise01(vec3(0., buv.y * 0.8, bt * 1.2)), blockGlitch);
  float b1 = blockNoiseX2 * blockNoiseY2;
  float b2 = blockNoiseX * blockNoiseY;
  float block = max(b1, b2);
  // Few coarse shift tiles (~6×6): avoids a uniform fine grid; same shift per tile → clean translated chunks.
  vec2 shiftCell = floor(buv * vec2(6.0, 6.0 * res.y / max(res.x, 1.0)));
  float shiftJ = (h22(shiftCell * vec2(3.1, 4.7) + vec2(bt * 0.15, bt * 0.09)).x - 0.5) * 2.0;
  vec2 st = vec2(buv.x + sin(bt) * shiftJ * 0.12, buv.y);
  col *= 1.0 - block * blocksAmt;
  block *= 1.15 * blocksAmt;
  col.r += texture(SAMPLER_2D(u_Texture), st + epsBlock).r * block;
  col.g += texture(SAMPLER_2D(u_Texture), st).g * block;
  col.b += texture(SAMPLER_2D(u_Texture), st - epsBlock).b * block;

  outputColor = vec4(col, alpha);
}
`;
