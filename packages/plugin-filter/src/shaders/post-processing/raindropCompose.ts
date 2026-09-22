/**
 * Final rain compose (ported from raindrop-fx compose.glsl).
 * Samples scene color + raindrop compose map (+ optional empty droplet/mist).
 */
export const frag = /* wgsl */ `
uniform sampler2D u_Texture;
uniform sampler2D u_RaindropTex;
uniform sampler2D u_DropletTex;
uniform sampler2D u_MistTex;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_RC0;
  vec4 u_RC1;
  vec4 u_RC2;
  vec4 u_RC3;
};

out vec4 outputColor;

void main() {
  vec2 smoothRaindrop = u_RC0.xy;
  vec2 refractParams = u_RC0.zw;
  vec4 lightPos = u_RC1;
  vec3 diffuseLight = u_RC2.xyz;
  float shadowOffset = u_RC2.w;
  vec3 specularLight = u_RC3.xyz;
  float specularShininess = u_RC3.w;

  vec4 raindrop = texture(SAMPLER_2D(u_RaindropTex), v_Uv).rgba;
  vec4 droplet = texture(SAMPLER_2D(u_DropletTex), v_Uv).rgba;
  float mist = texture(SAMPLER_2D(u_MistTex), v_Uv).r;

  vec4 compose = vec4(
    raindrop.rgb + droplet.rgb - vec3(2.0) * raindrop.rgb * droplet.rgb,
    max(droplet.a, raindrop.a)
  );

  float mask = smoothstep(smoothRaindrop.x, smoothRaindrop.y, compose.a);

  vec2 uv = v_Uv.xy + -(compose.xy - vec2(0.5)) * vec2(compose.b * refractParams.y + refractParams.x);
  vec3 normal = normalize(vec3((compose.xy - vec2(0.5)) * vec2(2.0), 1.0));

  vec3 lightDir = lightPos.xyz - lightPos.w * vec3(v_Uv.xy, 0.0);
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfDir = normalize(lightDir + viewDir);
  float lambertian = clamp(dot(normalize(lightDir), normal), 0.0, 1.0);
  float blinnPhong = pow(max(dot(normal, halfDir), 0.0), specularShininess);

  vec4 color = texture(SAMPLER_2D(u_Texture), uv.xy).rgba;
  color.rgb += vec3((lambertian - shadowOffset) * diffuseLight);
  color.rgb += vec3(blinnPhong) * specularLight;

  outputColor = vec4(color.rgb, mask);
}
`;
