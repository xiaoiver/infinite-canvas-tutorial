import { random } from '../chunks/random';

export const frag = /* wgsl */ `

uniform sampler2D u_Texture;
in vec2 v_Uv;

const float PI = 3.14159265;
const float TAU = 2.0 * PI;

const int rayCount = 8;
const int maxSteps = 128;
const bool showNoise = true;
const bool accumRadiance = true;
const vec2 size = vec2(570.0, 252.0);

${random}

vec4 raymarch() {
  vec4 light = texture(SAMPLER_2D(u_Texture), v_Uv);

  // red light
  if (light.r == 1.0) {
    return light;
  }
  
  float oneOverRayCount = 1.0 / float(rayCount);
  float tauOverRayCount = TAU * oneOverRayCount;
  
  // Different noise every pixel
  float noise = showNoise ? random(v_Uv) : 0.1;
  
  vec4 radiance = vec4(0.0);
  
  // Shoot rays in "rayCount" directions, equally spaced, with some randomness.
  for(int i = 0; i < rayCount; i++) {
      float angle = tauOverRayCount * (float(i) + noise);
      vec2 rayDirectionUv = vec2(cos(angle), -sin(angle)) / size;
      vec2 traveled = vec2(0.0);
      
      int initialStep = accumRadiance ? 0 : max(0, maxSteps - 1);
      for (int step = initialStep; step < maxSteps; step++) {
          // Go the direction we're traveling (with noise)
          vec2 sampleUv = v_Uv + rayDirectionUv * float(step);
      
          if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) {
            break;
          }
          
          vec4 sampleLight = texture(SAMPLER_2D(u_Texture), sampleUv);
          if (sampleLight.a > 0.5) {
            radiance += sampleLight;
            break;
          }
      }      
  }
  
  // Average radiance
  return radiance * oneOverRayCount;
}

out vec4 outputColor;

void main() {
  // outputColor = texture(SAMPLER_2D(u_Texture), v_Uv);

  outputColor = vec4(raymarch().rgb, 1.0);
}
`;
