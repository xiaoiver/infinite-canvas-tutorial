import { createComposedFillTexture } from '../../packages/ecs/src/utils/composed-fill-texture';
import type { Texture } from '@infinite-canvas-tutorial/device-api';
import type { FillLayerItem } from '../../packages/ecs/src/utils/fillLayers';

const layers: FillLayerItem[] = [
  { type: 'solid', value: 'red', opacity: 0.5 },
  {
    type: 'gradient',
    value: 'linear-gradient(90deg, blue, white)',
    blendMode: 'multiply',
  },
];
function texture(width = 10, height = 20) {
  return { width, height, destroy: jest.fn() } as unknown as Texture & {
    width: number;
    height: number;
    destroy: jest.Mock;
  };
}

it('composes live unfiltered layers once, using independent maximum dimensions', () => {
  const sources = [texture(100, 20), texture(10, 80)];
  const output = texture(100, 80);
  const rasterize = jest.fn((layer) => sources[layers.indexOf(layer)]);
  const compose = jest.fn((inputs, width, height) => {
    expect(inputs).toEqual(sources);
    expect([width, height]).toEqual([100, 80]);
    sources.forEach((source) => expect(source.destroy).not.toHaveBeenCalled());
    return output;
  });
  const original = structuredClone(layers);
  expect(createComposedFillTexture(layers, rasterize, compose)).toEqual({
    texture: output,
    width: 100,
    height: 80,
  });
  expect(rasterize.mock.calls.map(([layer]) => layer)).toEqual(layers);
  expect(layers).toEqual(original);
  expect(compose).toHaveBeenCalledTimes(1);
  sources.forEach((source) => expect(source.destroy).toHaveBeenCalledTimes(1));
  expect(output.destroy).not.toHaveBeenCalled();
});

it.each([0, 1])('rejects %i layers before allocating resources', (count) => {
  const allocate = jest.fn();
  const compose = jest.fn();
  expect(() =>
    createComposedFillTexture(layers.slice(0, count), allocate, compose),
  ).toThrow('At least two');
  expect(allocate).not.toHaveBeenCalled();
  expect(compose).not.toHaveBeenCalled();
});
it('keeps degenerate textures at least one pixel wide and high', () => {
  const sources = [texture(0, 0), texture(0, 0)];
  const output = texture(1, 1);
  const compose = jest.fn(() => output);
  const result = createComposedFillTexture(
    layers,
    () => sources.shift()!,
    compose,
  );
  expect(result).toEqual({ texture: output, width: 1, height: 1 });
  expect(compose).toHaveBeenCalledWith(expect.any(Array), 1, 1);
});
it.each([0, 1, 2])(
  'releases the allocated prefix when rasterization fails at layer %i',
  (failed) => {
    const paints: FillLayerItem[] = [
      ...layers,
      { type: 'solid', value: 'green' },
    ];
    const sources = paints.map(() => texture());
    const error = new Error('raster failed');
    const compose = jest.fn();
    let index = 0;
    expect(() =>
      createComposedFillTexture(
        paints,
        () => {
          if (index === failed) throw error;
          return sources[index++];
        },
        compose,
      ),
    ).toThrow(error);
    expect(compose).not.toHaveBeenCalled();
    sources.forEach((source, i) =>
      expect(source.destroy).toHaveBeenCalledTimes(i < failed ? 1 : 0),
    );
  },
);
it('releases every input after a compositor error and permits a fresh retry', () => {
  const sources = [texture(), texture()];
  const error = new Error('GPU composition failed');
  expect(() =>
    createComposedFillTexture(
      layers,
      (l) => sources[layers.indexOf(l)],
      () => {
        throw error;
      },
    ),
  ).toThrow(error);
  sources.forEach((source) => expect(source.destroy).toHaveBeenCalledTimes(1));
  const retry = [texture(), texture()];
  const output = texture();
  expect(
    createComposedFillTexture(
      layers,
      (l) => retry[layers.indexOf(l)],
      () => output,
    ).texture,
  ).toBe(output);
  retry.forEach((source) => expect(source.destroy).toHaveBeenCalledTimes(1));
  expect(output.destroy).not.toHaveBeenCalled();
});
