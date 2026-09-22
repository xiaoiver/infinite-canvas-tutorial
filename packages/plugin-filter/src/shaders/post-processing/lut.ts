/**
 * 3D LUT：片元与 three.js `LUTPass` 一致（`lutSize` / 边像素内缩 / `mix(val, lutVal, intensity)`）。
 * 输入纹理 `u_Texture`（对应 `tDiffuse`），LUT `u_Lut3D`（对应 `lut`），`v_Uv`（对应 `vUv`）。
 * `lutSize`、`intensity` 由 `PostProcessingUniforms` UBO 提供（std140 下 `float,float,vec2`）。
 *
 * @see https://github.com/mrdoob/three.js/blob/master/examples/jsm/postprocessing/LUTPass.js
 */
export const frag = /* wgsl */ `

uniform highp sampler2D u_Texture;
uniform highp sampler3D u_Lut3D;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  float lutSize;
  float intensity;
  vec2 _lutPad;
};

out vec4 outputColor;

void main() {

  vec4 val = texture(SAMPLER_2D(u_Texture), v_Uv);
  vec4 lutVal;

  // pull the sample in by half a pixel so the sample begins
  // at the center of the edge pixels.
  float pixelWidth = 1.0 / lutSize;
  float halfPixelWidth = 0.5 / lutSize;
  vec3 uvw = vec3( halfPixelWidth ) + val.rgb * ( 1.0 - pixelWidth );


  lutVal = vec4( texture(SAMPLER_3D(u_Lut3D), uvw ).rgb, val.a );

  outputColor = vec4( mix( val, lutVal, intensity ) );

}
`;
