/**
 * Final rain compose (raindrop-fx compose.glsl).
 * Drawn over blurry background (+ optional mist bg pass on target).
 */
export const frag = /* glsl */ `
uniform sampler2D u_Background;
uniform sampler2D u_RaindropTex;
uniform sampler2D u_DropletTex;
uniform sampler2D u_MistTex;
layout(std140) uniform RainFxComposeUniforms {
  vec4 u_BackgroundSize;
  vec2 u_SmoothRaindrop;
  vec2 u_RefractParams;
  vec4 u_LightPos;
  vec4 u_DiffuseColor;
  vec4 u_SpecularParams;
  float u_Bump;
};
in vec2 v_UV;
out vec4 outputColor;

void main() {
  vec4 raindrop = texture(SAMPLER_2D(u_RaindropTex), v_UV).rgba;
  vec4 droplet = texture(SAMPLER_2D(u_DropletTex), v_UV).rgba;
  float mist = texture(SAMPLER_2D(u_MistTex), v_UV).r;

  vec4 compose = vec4(
    raindrop.rgb + droplet.rgb - vec3(2.0) * raindrop.rgb * droplet.rgb,
    max(droplet.a, raindrop.a)
  );

  float mask = smoothstep(u_SmoothRaindrop.x, u_SmoothRaindrop.y, compose.a);

  vec2 uv = v_UV + -(compose.xy - vec2(0.5)) * vec2(compose.b * u_RefractParams.y + u_RefractParams.x);
  vec3 normal = normalize(vec3((compose.xy - vec2(0.5)) * vec2(2.0), 1.0));

  vec3 lightDir = u_LightPos.xyz - u_LightPos.w * vec3(v_UV, 0.0);
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfDir = normalize(lightDir + viewDir);
  float lambertian = clamp(dot(normalize(lightDir), normal), 0.0, 1.0);
  float blinnPhong = pow(max(dot(normal, halfDir), 0.0), u_SpecularParams.a);

  vec4 color = texture(SAMPLER_2D(u_Background), uv).rgba;
  color.rgb += vec3((lambertian - u_DiffuseColor.a) * u_DiffuseColor.rgb);
  color.rgb += vec3(blinnPhong) * u_SpecularParams.rgb;

  outputColor = vec4(color.rgb, mask);
}
`;

export const fragCopy = /* glsl */ `
uniform sampler2D u_Texture;
in vec2 v_UV;
out vec4 outputColor;

void main() {
  outputColor = texture(SAMPLER_2D(u_Texture), v_UV);
}
`;
