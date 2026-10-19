import {
  ENVIRONMENT_BRDF_SIZE,
  environmentBrdfPixels,
  integrateEnvironmentBrdf,
} from '../../packages/ecs/src/utils/environment-brdf';

it('integrates GGX visibility and Schlick Fresnel across view angle and roughness', () => {
  const smoothNormal = integrateEnvironmentBrdf(1, 0.04, 1024);
  const roughNormal = integrateEnvironmentBrdf(1, 1, 1024);
  const smoothGrazing = integrateEnvironmentBrdf(0.02, 0.04, 1024);
  expect(smoothNormal[0]).toBeGreaterThan(0.95);
  expect(roughNormal[0]).toBeLessThan(smoothNormal[0] - 0.3);
  expect(smoothGrazing[1]).toBeGreaterThan(smoothNormal[1] + 0.5);
  for (const [a, b] of [smoothNormal, roughNormal, smoothGrazing]) {
    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(a + b).toBeLessThanOrEqual(1.01);
  }
});

it('caches a quantized RGBA8 lookup with roughness varying by row', () => {
  const pixels = environmentBrdfPixels();
  expect(environmentBrdfPixels()).toBe(pixels);
  expect(pixels).toHaveLength(ENVIRONMENT_BRDF_SIZE ** 2 * 4);
  const x = Math.floor(ENVIRONMENT_BRDF_SIZE * 0.75);
  const low = x * 4;
  const high = ((ENVIRONMENT_BRDF_SIZE - 1) * ENVIRONMENT_BRDF_SIZE + x) * 4;
  expect(pixels[low]).toBeGreaterThan(pixels[high]);
  expect(pixels[low + 3]).toBe(255);
  expect(pixels[high + 3]).toBe(255);
});
