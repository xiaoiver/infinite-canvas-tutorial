import {
  BufferUsage,
  type Device,
  type RenderPass,
} from '../../../packages/device-api/src';
import { Mat4 } from '../../../packages/ecs/src/components/math/Mat4';
import { ResourceScope } from '../../../packages/ecs/src/resources/ResourceScope';
import { RenderCache } from '../../../packages/ecs/src/utils/render-cache';
import { createGizmoFrame } from '../../../packages/ecs/src/utils/gizmo-frame';
import {
  sceneUniformsToPickScene,
  type Camera3DSceneUniforms,
} from '../../../packages/ecs/src/utils/mesh3d-scene';
import type { GizmoDrawInstance } from '../../../packages/ecs/src/systems/gizmo3d/gizmo-uniforms';

export function gizmoInstance(id: number, x = 0): GizmoDrawInstance {
  const scene: Camera3DSceneUniforms = {
    mode: 'standard',
    projMatrix: Mat4.ortho(-200, 200, -100, 100, 0.1, 1000),
    viewMatrix: Mat4.lookAt([0, 0, 300], [0, 0, 0], [0, 1, 0]),
    canvasViewProjection: Mat4.IDENTITY,
    sceneParams: [0, 0, 0, 0],
  };
  return {
    id,
    scene,
    frame: createGizmoFrame(
      sceneUniformsToPickScene(scene),
      [x, 0, 0],
      400,
      200,
    )!,
    rotation: [0.1, 0.2, 0.3],
    activeAxis: 'x',
    activePartKind: 'translate',
  };
}

export function fakeGizmoGPU() {
  let id = 0;
  const releases: string[] = [];
  const borrowed: { destroy: jest.Mock }[] = [];
  const resource = (kind: string) => {
    const label = `${kind}:${++id}`;
    return {
      id,
      destroy: jest.fn(() => {
        releases.push(label);
      }),
    };
  };
  const cached = () => {
    const result = { ...resource('cached'), setUniformsLegacy: jest.fn() };
    borrowed.push(result);
    return result;
  };
  const buffers: {
    id: number;
    usage: BufferUsage;
    bytes: Uint8Array;
    setSubData: jest.Mock;
    destroy: jest.Mock;
  }[] = [];
  const bindings: {
    uniformBufferBindings: { buffer: (typeof buffers)[number] }[];
    destroy: jest.Mock;
  }[] = [];
  const device = {
    createProgram: jest.fn(cached),
    createInputLayout: jest.fn(cached),
    createRenderPipeline: jest.fn(cached),
    createBuffer: jest.fn(({ viewOrSize, usage }) => {
      const bytes = new Uint8Array(
        typeof viewOrSize === 'number' ? viewOrSize : viewOrSize.byteLength,
      );
      const result = {
        ...resource('buffer'),
        usage,
        bytes,
        setSubData: jest.fn((offset: number, data: Uint8Array) =>
          bytes.set(data, offset),
        ),
      };
      buffers.push(result);
      return result;
    }),
    createBindings: jest.fn((descriptor) => {
      const result = { ...resource('bindings'), ...descriptor };
      bindings.push(result);
      return result;
    }),
    destroy: jest.fn(() => {
      releases.push('device');
    }),
  };
  let bound: (typeof bindings)[number];
  const draws: typeof bindings = [];
  const pass = {
    setViewport: jest.fn(),
    setPipeline: jest.fn(),
    setBindings: jest.fn((value) => {
      bound = value;
    }),
    setVertexInput: jest.fn(),
    // Retain references, not copies: inspect uniform contents AFTER all draws,
    // like a backend that submits the command buffer at the end of the pass.
    drawIndexed: jest.fn(() => {
      draws.push(bound);
    }),
  };
  const renderCache = new RenderCache(device as unknown as Device);
  const scope = new ResourceScope();
  scope.add(() => device.destroy());
  scope.add(() => renderCache.destroy());
  return {
    device: device as unknown as Device,
    mocks: device,
    renderCache,
    scope,
    releases,
    borrowed,
    buffers,
    bindings,
    draws,
    pass: pass as unknown as RenderPass,
  };
}
