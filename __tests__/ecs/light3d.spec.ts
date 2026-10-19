import { Light3D } from '../../packages/ecs/src';

describe('Light3D', () => {
  it('should provide directional light defaults', () => {
    const light = new Light3D();

    expect(light.type).toBe('directional');
    expect(light.color).toEqual([1, 1, 1]);
    expect(light.intensity).toBe(1);
    expect(light.direction).toEqual([-0.5, -0.7, -0.5]);
    expect(light.castShadow).toBe(false);
    expect(light.shadowStrength).toBe(1);
    expect(light.shadowSoftness).toBe(1);
    expect(light.shadowBiasScale).toBe(1);
    expect(light.shadowNormalBias).toBe(0);
    expect(light.attenuation).toBe('range');
    expect(light.referenceDistance).toBe(100);
  });

  it('should support ambient, point, and spot lights', () => {
    expect(new Light3D({ type: 'ambient' }).type).toBe('ambient');
    expect(
      new Light3D({ type: 'point', position: [1, 2, 3] }).position,
    ).toEqual([1, 2, 3]);
    const spot = new Light3D({
      type: 'spot',
      direction: [0, -1, 0],
      innerConeAngle: 0.2,
      outerConeAngle: 0.5,
      attenuation: 'inverse-square',
      referenceDistance: 80,
      shadowStrength: 0.4,
      shadowSoftness: 2,
      shadowBiasScale: 0.5,
      shadowNormalBias: 2,
    });
    expect(spot.outerConeAngle).toBe(0.5);
    expect(spot.attenuation).toBe('inverse-square');
    expect(spot.referenceDistance).toBe(80);
    expect(spot.shadowStrength).toBeCloseTo(0.4);
    expect(spot.shadowSoftness).toBe(2);
    expect(spot.shadowBiasScale).toBeCloseTo(0.5);
    expect(spot.shadowNormalBias).toBe(2);
  });
});
