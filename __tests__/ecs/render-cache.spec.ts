import {
  AddressMode,
  FilterMode,
  Format,
  MipmapFilterMode,
  VertexStepMode,
  type Device,
  type BindingsDescriptor,
  type InputLayoutDescriptor,
  type RenderPipelineDescriptor,
  type SamplerDescriptor,
} from '../../packages/device-api/src';
import { RenderCache } from '../../packages/ecs/src/utils/render-cache';

function fixture() {
  let id = 1;
  const resources: { id: number; destroy: jest.Mock }[] = [];
  const allocate = (_descriptor: unknown) => {
    const resource = { id: id++, destroy: jest.fn() };
    resources.push(resource);
    return resource;
  };
  const device = {
    createBindings: jest.fn(allocate),
    createRenderPipeline: jest.fn(allocate),
    createInputLayout: jest.fn(allocate),
    createProgram: jest.fn(allocate),
    createSampler: jest.fn(allocate),
  };
  return {
    cache: new RenderCache(device as unknown as Device),
    device,
    resources,
  };
}

const sampler = (): SamplerDescriptor => ({
  addressModeU: AddressMode.CLAMP_TO_EDGE,
  addressModeV: AddressMode.CLAMP_TO_EDGE,
  minFilter: FilterMode.BILINEAR,
  magFilter: FilterMode.BILINEAR,
  mipmapFilter: MipmapFilterMode.NO_MIP,
});
const program = { id: 10 } as any;
const pipeline = (): RenderPipelineDescriptor => ({
  program,
  inputLayout: null,
  colorAttachmentFormats: [Format.U8_RGBA_RT],
  depthStencilAttachmentFormat: null,
  sampleCount: 1,
});
const layout = (): InputLayoutDescriptor => ({
  program,
  indexBufferFormat: Format.U16_R,
  vertexBufferDescriptors: [
    null,
    {
      arrayStride: 8,
      stepMode: VertexStepMode.VERTEX,
      attributes: [{ shaderLocation: 0, offset: 0, format: Format.F32_RG }],
    },
  ],
});

it('reuses equal sampler values and snapshots a caller-owned descriptor', () => {
  const { cache, device } = fixture();
  const descriptor = sampler();
  const first = cache.createSampler(descriptor);
  expect(cache.createSampler(sampler())).toBe(first);
  descriptor.magFilter = FilterMode.POINT;
  expect(cache.createSampler(descriptor)).not.toBe(first);
  expect(cache.createSampler(sampler())).toBe(first);
  expect(device.createSampler).toHaveBeenCalledTimes(2);
  expect(device.createSampler.mock.calls[0][0]).toMatchObject(sampler());
  cache.destroy();
});

it('distinguishes the W address mode of volume-texture samplers', () => {
  const { cache } = fixture();
  const clamp = cache.createSampler({
    ...sampler(),
    addressModeW: AddressMode.CLAMP_TO_EDGE,
  });
  const repeat = cache.createSampler({
    ...sampler(),
    addressModeW: AddressMode.REPEAT,
  });
  expect(repeat).not.toBe(clamp);
  expect(
    cache.createSampler({ ...sampler(), addressModeW: AddressMode.REPEAT }),
  ).toBe(repeat);
  cache.destroy();
});

it('normalizes attachment holes before looking up a pipeline', () => {
  const { cache, device } = fixture();
  const descriptor = {
    ...pipeline(),
    colorAttachmentFormats: [null, Format.U8_RGBA_RT],
  };
  const first = cache.createRenderPipeline(descriptor);
  expect(cache.createRenderPipeline(descriptor)).toBe(first);
  expect(cache.createRenderPipeline(pipeline())).toBe(first);
  expect(descriptor.colorAttachmentFormats).toEqual([null, Format.U8_RGBA_RT]);
  expect(device.createRenderPipeline).toHaveBeenCalledTimes(1);
  cache.destroy();
});

it('normalizes a frozen layout without mutating its caller or losing nested snapshots', () => {
  const { cache, device } = fixture();
  const descriptor = Object.freeze(layout());
  const first = cache.createInputLayout(descriptor);
  expect(descriptor.vertexBufferDescriptors).toHaveLength(2);
  expect(cache.createInputLayout(layout())).toBe(first);
  descriptor.vertexBufferDescriptors[1]!.attributes[0].offset = 4;
  expect(cache.createInputLayout(descriptor)).not.toBe(first);
  expect(cache.createInputLayout(layout())).toBe(first);
  expect(device.createInputLayout).toHaveBeenCalledTimes(2);
  cache.destroy();
});

it('reuses shader text values and keeps the key independent of later source edits', () => {
  const { cache } = fixture();
  const descriptor = {
    vertex: { glsl: 'vertex' },
    fragment: { glsl: 'fragment' },
  };
  const first = cache.createProgram(descriptor);
  descriptor.fragment.glsl = 'different fragment';
  expect(cache.createProgram(descriptor)).not.toBe(first);
  expect(
    cache.createProgram({
      vertex: { glsl: 'vertex' },
      fragment: { glsl: 'fragment' },
    }),
  ).toBe(first);
  cache.destroy();
});

it('releases every cached resource once and starts a fresh cache after teardown', () => {
  const { cache, resources } = fixture();
  cache.createSampler(sampler());
  cache.createProgram({ vertex: { glsl: 'v' } });
  cache.createInputLayout(layout());
  cache.createRenderPipeline(pipeline());
  cache.createBindings({});
  cache.destroy();
  cache.destroy();
  expect(resources).toHaveLength(5);
  resources.forEach((resource) =>
    expect(resource.destroy).toHaveBeenCalledTimes(1),
  );
  const next = cache.createSampler(sampler());
  expect(resources).toHaveLength(6);
  expect(next).not.toBe(resources[0]);
  cache.destroy();
  resources.forEach((resource) =>
    expect(resource.destroy).toHaveBeenCalledTimes(1),
  );
});

it('snapshots buffer ranges and texture bindings while preserving GPU resource identity', () => {
  const { cache, device } = fixture();
  const buffer = { id: 40 } as any;
  const texture = { id: 41 } as any;
  const volume = { id: 42 } as any;
  const gpuSampler = cache.createSampler(sampler());
  const gpuPipeline = cache.createRenderPipeline(pipeline());
  const descriptor = (): BindingsDescriptor => ({
    pipeline: gpuPipeline,
    samplerBindings: [{ texture, sampler: gpuSampler }],
    uniformBufferBindings: [{ buffer, binding: 0, offset: 0, size: 64 }],
    storageBufferBindings: [{ buffer, binding: 1, offset: 64, size: 128 }],
    storageTextureBindings: [{ texture: volume, binding: 2 }],
  });
  const original = descriptor();
  const first = cache.createBindings(original);
  expect(cache.createBindings(descriptor())).toBe(first);
  original.uniformBufferBindings![0].offset = 16;
  expect(cache.createBindings(original)).not.toBe(first);
  const changedStorage = descriptor();
  changedStorage.storageBufferBindings![0].size = 256;
  expect(cache.createBindings(changedStorage)).not.toBe(first);
  const changedTexture = descriptor();
  changedTexture.storageTextureBindings![0].binding = 3;
  expect(cache.createBindings(changedTexture)).not.toBe(first);
  const changedSampler = descriptor();
  changedSampler.samplerBindings![0].texture = volume;
  expect(cache.createBindings(changedSampler)).not.toBe(first);
  expect(cache.createBindings(descriptor())).toBe(first);
  expect(device.createBindings).toHaveBeenCalledTimes(5);
  const saved = device.createBindings.mock.calls[0][0] as BindingsDescriptor;
  expect(saved.uniformBufferBindings![0]).toEqual({
    buffer,
    binding: 0,
    offset: 0,
    size: 64,
  });
  expect(saved.uniformBufferBindings![0].buffer).toBe(buffer);
  expect(saved.samplerBindings![0].texture).toBe(texture);
  cache.destroy();
});

it('distinguishes pipelines with different sample counts even when their hashes collide', () => {
  const { cache } = fixture();
  const original = pipeline();
  const first = cache.createRenderPipeline(original);
  original.sampleCount = 4;
  const msaa = cache.createRenderPipeline(original);
  expect(msaa).not.toBe(first);
  expect(cache.createRenderPipeline({ ...pipeline(), sampleCount: 4 })).toBe(
    msaa,
  );
  expect(cache.createRenderPipeline(pipeline())).toBe(first);
  const withLayout = {
    ...pipeline(),
    inputLayout: cache.createInputLayout(layout()),
  };
  expect(cache.createRenderPipeline(withLayout)).not.toBe(first);
  expect(cache.createRenderPipeline(withLayout)).toBe(
    cache.createRenderPipeline(withLayout),
  );
  cache.destroy();
});

it('does not retain a failed allocation and allows retry with the same key', () => {
  const { cache, device, resources } = fixture();
  device.createSampler.mockImplementationOnce(() => {
    throw new Error('device unavailable');
  });
  expect(() => cache.createSampler(sampler())).toThrow('device unavailable');
  expect(resources).toHaveLength(0);
  const next = cache.createSampler(sampler());
  expect(cache.createSampler(sampler())).toBe(next);
  expect(device.createSampler).toHaveBeenCalledTimes(2);
  cache.destroy();
  expect(resources[0].destroy).toHaveBeenCalledTimes(1);
});
