import '../../packages/ecs/src';
import { SDF } from '../../packages/ecs/src/drawcalls/SDF';
import { ImageTexturePool } from '../../packages/ecs/src/utils/image-texture-pool';
import { imageTexturePoolContract } from '../contracts/image-texture-pool';
imageTexturePoolContract(() => new ImageTexturePool());

it('does not resurrect a retired image drawcall from an old submission queue', () => {
  const draw = new SDF(null, null, null, null, false, 0, null);
  draw.destroy();
  const geometry = jest
    .spyOn(draw, 'createGeometry')
    .mockImplementation(() => {});
  const material = jest
    .spyOn(draw, 'createMaterial')
    .mockImplementation(() => {});
  const render = jest.spyOn(draw, 'render').mockImplementation(() => {});
  try {
    draw.submit(null, null, { u_ZoomScale: 1 }, null);
    expect(geometry).not.toHaveBeenCalled();
    expect(material).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  } finally {
    geometry.mockRestore();
    material.mockRestore();
    render.mockRestore();
  }
});
