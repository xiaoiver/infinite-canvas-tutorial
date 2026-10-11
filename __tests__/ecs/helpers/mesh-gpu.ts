import { fakeGizmoGPU } from './gizmo-gpu';

export function fakeMeshGPU() {
  const gpu = fakeGizmoGPU();
  const allocate = gpu.mocks.createBuffer.getMockImplementation()!;
  gpu.mocks.createBuffer.mockImplementation((descriptor) => {
    const buffer = allocate(descriptor);
    const data = descriptor.viewOrSize;
    if (typeof data !== 'number')
      buffer.bytes.set(
        new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      );
    return buffer;
  });
  const textures: { destroy: jest.Mock; setImageData: jest.Mock }[] = [];
  const createTexture = jest.fn(() => {
    const result = { destroy: jest.fn(), setImageData: jest.fn() };
    textures.push(result);
    return result;
  });
  const createSampler = jest.fn(() => {
    const result = { destroy: jest.fn() };
    gpu.borrowed.push(result);
    return result;
  });
  Object.assign(gpu.device, { createTexture, createSampler });
  Object.assign(gpu.pass, { draw: jest.fn() });
  return { ...gpu, textures, createTexture, createSampler };
}
