import { Light3D } from '../../packages/ecs/src';

describe('Light3D', () => {
  it('should provide directional light defaults', () => {
    const light = new Light3D();

    expect(light.type).toBe('directional');
    expect(light.color).toEqual([1, 1, 1]);
    expect(light.intensity).toBe(1);
    expect(light.direction).toEqual([-0.5, -0.7, -0.5]);
  });

  it('should support ambient, point, and spot lights', () => {
    expect(new Light3D({ type: 'ambient' }).type).toBe('ambient');
    expect(new Light3D({ type: 'point', position: [1, 2, 3] }).position).toEqual(
      [1, 2, 3],
    );
    expect(
      new Light3D({
        type: 'spot',
        direction: [0, -1, 0],
        innerConeAngle: 0.2,
        outerConeAngle: 0.5,
      }).outerConeAngle,
    ).toBe(0.5);
  });
});
