import { PostProcessingRenderer } from '../../packages/plugin-filter/src/PostProcessingRenderer';
import type { Effect } from '../../packages/plugin-filter/src/filter';

/**
 * Regression test for "Error with global filters".
 *
 * The render graph hands a fresh (or recycled) resolve texture to the
 * post-processing renderer every frame. The renderer used to build its sampler
 * bindings exactly once and keep reusing them, which left it pointing at a
 * stale/destroyed texture on subsequent frames and broke global filters such as
 * `fxaa() brightness(0.8) noise(0.1)`. The bindings must therefore be rebuilt
 * from the *current* input texture on every render call.
 */
describe('PostProcessingRenderer global filter bindings', () => {
  function createHarness() {
    const buffers = {
      uniform: { setSubData: jest.fn(), destroy: jest.fn() },
      vertex: { setSubData: jest.fn(), destroy: jest.fn() },
    };
    let bufferIndex = 0;
    const device = {
      createBuffer: jest.fn(() =>
        bufferIndex++ === 0 ? buffers.uniform : buffers.vertex,
      ),
      queryVendorInfo: () => ({ platformString: 'WebGL' }),
      createInputLayout: jest.fn(() => ({ id: 'il', destroy: jest.fn() })),
      createRenderPipeline: jest.fn(() => ({ id: 'pipeline', destroy: jest.fn() })),
    };

    const program = { id: 'prog', setUniformsLegacy: jest.fn(), destroy: jest.fn() };
    // Mimic RenderCache.createBindings: dedupe by input texture id.
    const bindingsByTexture = new Map<unknown, { texture: unknown }>();
    const createBindings = jest.fn((descriptor: any) => {
      const texture = descriptor.samplerBindings[0].texture;
      let bindings = bindingsByTexture.get(texture);
      if (!bindings) {
        bindings = { texture };
        bindingsByTexture.set(texture, bindings);
      }
      return bindings;
    });
    const renderCache = {
      createProgram: jest.fn(() => program),
      createSampler: jest.fn(() => ({ id: 'sampler' })),
      createBindings,
    };

    const swapChain = {
      getCanvas: () => ({ width: 100, height: 100 }),
    };

    const renderPass = {
      setViewport: jest.fn(),
      setPipeline: jest.fn(),
      setVertexInput: jest.fn(),
      setBindings: jest.fn(),
      draw: jest.fn(),
    };

    const renderer = new PostProcessingRenderer(
      device as any,
      swapChain as any,
      renderCache as any,
    );
    return { renderer, renderPass, createBindings };
  }

  it('rebuilds bindings with the current texture on every frame', () => {
    const { renderer, renderPass, createBindings } = createHarness();
    const effect = { type: 'brightness', value: 0.8 } as Effect;

    const textureFrame1 = { id: 1 };
    const textureFrame2 = { id: 2 };

    renderer.render(renderPass as any, textureFrame1 as any, effect);
    expect(renderPass.setBindings).toHaveBeenLastCalledWith(
      expect.objectContaining({ texture: textureFrame1 }),
    );

    renderer.render(renderPass as any, textureFrame2 as any, effect);
    expect(renderPass.setBindings).toHaveBeenLastCalledWith(
      expect.objectContaining({ texture: textureFrame2 }),
    );

    // A new texture id must trigger a new bindings lookup.
    expect(createBindings).toHaveBeenCalledTimes(2);
  });
});
