import type { Entity } from '../../packages/ecs/src';
import {
  Camera3D,
  Canvas,
  Canvas3DScope,
  Extrude3D,
  GPUResource,
  Material3D,
  Light3D,
  Mesh3D,
  Transform3D,
  ToBeDeleted,
} from '../../packages/ecs/src/components';
import { MeshPipeline3D } from '../../packages/ecs/src/systems/MeshPipeline3D';
import { createGeometry } from '../../packages/ecs/src/utils/geometry3d';
import { loadImageBitmapUniversal } from '../../packages/ecs/src/utils/load-image-bitmap';
import { fakeMeshGPU } from './helpers/mesh-gpu';

// Controlled query snapshots exercise resource ownership; browser tests exercise
// the real ECS schedule and geometry write tracking with actual WebGL buffers.
jest.mock('../../packages/ecs/node_modules/@lastolivegames/becsy', () => ({
  ...jest.requireActual<any>(
    '../../packages/ecs/node_modules/@lastolivegames/becsy',
  ),
  System: class {
    static group = jest.requireActual<any>(
      '../../packages/ecs/node_modules/@lastolivegames/becsy',
    ).System.group;
    query() {
      return { current: [], removed: [], addedOrChanged: [] };
    }
    attach() {
      return { hasGizmoContent: () => false };
    }
  },
  co: (_target: any, _key: string, descriptor: any) => descriptor,
}));
jest.mock('../../packages/ecs/src/utils/load-image-bitmap');
const load = loadImageBitmapUniversal as jest.MockedFunction<
  typeof loadImageBitmapUniversal
>;
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  jest.clearAllMocks();
});
function fixture(count = 1) {
  const renderer = new MeshPipeline3D();
  const entity = (values: Map<any, any>, id: number): Entity =>
    ({
      __id: id,
      has: (type: any) => values.has(type),
      read: (type: any) => values.get(type),
      isSame(other: Entity) {
        return other.__id === id;
      },
    } as unknown as Entity);
  const slots = Array.from({ length: count }, (_, i) => {
    const gpu = fakeMeshGPU();
    cleanups.push(() => gpu.scope.dispose());
    const values = new Map<any, any>([
      [Canvas, { api: {}, width: 200, height: 200 }],
      [GPUResource, gpu],
    ]);
    const canvas = entity(values, i * 3);
    const mesh = new Mesh3D(createGeometry({ type: 'cube' }));
    const material = new Material3D();
    const transform = new Transform3D({ translation: [i * 20, 0, 0] });
    const meshValues = new Map<any, any>([
      [Canvas3DScope, { canvas }],
      [Mesh3D, mesh],
      [Material3D, material],
      [Transform3D, transform],
    ]);
    const target = entity(meshValues, i * 3 + 1);
    const camera = entity(
      new Map<any, any>([
        [Canvas3DScope, { canvas }],
        [Camera3D, new Camera3D()],
      ]),
      i * 3 + 2,
    );
    return {
      gpu,
      values,
      canvas,
      mesh,
      material,
      transform,
      target,
      camera,
      meshValues,
    };
  });
  const queries = renderer as any;
  queries.canvases.current = slots.map((s) => s.canvas);
  queries.cameras3D.current = slots.map((s) => s.camera);
  queries.meshes3D.current = slots.map((s) => s.target);
  cleanups.push(() => renderer.finalize());
  const draw = (i = 0) =>
    renderer.drawMeshes(slots[i].gpu.pass, slots[i].canvas, 400, 400);
  return { renderer, queries, slots, draw, entity };
}

it('reuses geometry while updating pose/material uniforms and avoids duplicate held companions', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    draw,
    entity,
  } = fixture();
  queries.extrudeSources.current = [
    entity(
      new Map([
        [
          Extrude3D,
          {
            meshEntity: entity(slot.meshValues, slot.target.__id),
          },
        ],
      ]),
      99,
    ),
  ];
  draw();
  expect(slot.gpu.draws).toHaveLength(1);
  const buffers = [...slot.gpu.buffers];
  const model = slot.gpu.draws[0].uniformBufferBindings[1].buffer;
  slot.transform.translation = [30, 40, 50];
  slot.material.baseColor = [0, 1, 0, 1];
  renderer.execute();
  draw();
  expect(slot.gpu.buffers).toEqual(buffers);
  const floats = new Float32Array(model.bytes.buffer);
  expect([...floats.slice(12, 15)]).toEqual([30, 40, 50]);
  expect([...floats.slice(32, 36)]).toEqual([0, 1, 0, 1]);
  for (const buffer of buffers) expect(buffer.destroy).not.toHaveBeenCalled();
  draw();
  expect(slot.gpu.bindings).toHaveLength(1);
  expect(slot.gpu.bindings[0].destroy).not.toHaveBeenCalled();
  expect(buffers[0].setSubData).toHaveBeenCalledTimes(1);
});

it('draws opaque meshes first and blends transparent meshes from far to near', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    entity,
    draw,
  } = fixture();
  const createMesh = (id: number, z: number, alphaMode: 'opaque' | 'blend') =>
    entity(
      new Map<any, any>([
        [Canvas3DScope, { canvas: slot.canvas }],
        [Mesh3D, new Mesh3D(createGeometry({ type: 'plane' }))],
        [Material3D, new Material3D({ alphaMode })],
        [Transform3D, new Transform3D({ translation: [0, 0, z] })],
      ]),
      id,
    );
  const opaque = createMesh(90, 0, 'opaque');
  const far = createMesh(91, -2, 'blend');
  slot.material.alphaMode = 'blend';
  slot.transform.translation = [0, 0, 2];
  queries.meshes3D.current = [slot.target, opaque, far];

  draw();
  const state = (renderer as any).states.get(slot.canvas.read(Canvas).api);
  const vertices = [opaque, far, slot.target].map(
    (mesh) => state.meshGPUCache.get(mesh.__id, mesh.read(Mesh3D)).vertexBuffer,
  );
  expect(
    (slot.gpu.pass.setVertexInput as jest.Mock).mock.calls.map(
      ([, buffers]) => buffers[0].buffer,
    ),
  ).toEqual(vertices);
  expect(slot.gpu.pass.setPipeline).toHaveBeenCalledTimes(2);
});

it('schedules a sampled shadow map for enabled directional and spot lights', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    entity,
  } = fixture();
  const light = new Light3D({ type: 'directional', castShadow: true });
  queries.lights3D.current = [
    entity(
      new Map([
        [Canvas3DScope, { canvas: slot.canvas }],
        [Light3D, light],
      ]),
      90,
    ),
  ];
  const targets: { width: number; sampledForShaderRead: boolean }[] = [];
  let setup: ((pass: any) => void) | undefined;
  const builder = {
    createRenderTargetID: (desc: any) => {
      targets.push(desc);
      return targets.length;
    },
    pushPass: (callback: (pass: any) => void) => {
      setup = callback;
    },
    resolveRenderTarget: (id: number) => id + 10,
  };
  const frame = renderer.scheduleShadowPass(builder as any, slot.canvas);
  expect(frame).toMatchObject([
    {
      lightIndex: 0,
      strength: 1,
      softness: 1,
      biasScale: 1,
      normalBias: 0,
      resolveID: 11,
    },
  ]);
  expect(targets[0]).toMatchObject({
    width: 1024,
    sampledForShaderRead: true,
    colorClearColor: { r: 1, g: 1, b: 1, a: 1 },
  });
  let execute: ((renderPass: any) => void) | undefined;
  setup!({
    setDebugName: jest.fn(),
    attachRenderTargetID: jest.fn(),
    exec: (callback: (renderPass: any) => void) => {
      execute = callback;
    },
  });
  execute!(slot.gpu.pass);
  expect(slot.gpu.pass.drawIndexed).toHaveBeenCalledTimes(1);
  slot.material.castShadow = false;
  expect(renderer.scheduleShadowPass(builder as any, slot.canvas)).toEqual([]);
  expect(targets).toHaveLength(2);
  slot.material.castShadow = true;
  light.castShadow = false;
  expect(renderer.scheduleShadowPass(builder as any, slot.canvas)).toEqual([]);
  expect(targets).toHaveLength(2);
  light.castShadow = true;
  light.shadowStrength = 0;
  expect(renderer.scheduleShadowPass(builder as any, slot.canvas)).toEqual([]);
  expect(targets).toHaveLength(2);
  light.shadowStrength = 0.5;
  light.shadowSoftness = 2;
  light.shadowBiasScale = 0.5;
  light.shadowNormalBias = 2;
  light.type = 'spot';
  light.position = [0, 0, -100];
  light.direction = [0, 0, 1];
  light.range = 500;
  light.castShadow = true;
  const spotFrame = renderer.scheduleShadowPass(builder as any, slot.canvas);
  expect(spotFrame).toMatchObject([
    {
      lightIndex: 0,
      strength: 0.5,
      softness: 2,
      biasScale: 0.5,
      normalBias: 2,
      resolveID: 13,
    },
  ]);
  expect(targets[2]).toMatchObject({ width: 1024, sampledForShaderRead: true });
  setup!({
    setDebugName: jest.fn(),
    attachRenderTargetID: jest.fn(),
    exec: (callback: (renderPass: any) => void) => {
      execute = callback;
    },
  });
  execute!(slot.gpu.pass);
  expect(slot.gpu.pass.drawIndexed).toHaveBeenCalledTimes(2);
  const invalid = new Light3D({ type: 'spot', castShadow: true });
  invalid.direction = [0, 0, 0];
  queries.lights3D.current.unshift(
    entity(
      new Map([
        [Canvas3DScope, { canvas: slot.canvas }],
        [Light3D, invalid],
      ]),
      89,
    ),
  );
  expect(
    renderer.scheduleShadowPass(builder as any, slot.canvas),
  ).toMatchObject([{ lightIndex: 1, resolveID: 15 }]);
});

it('refreshes alpha-test inputs before drawing a shadow map', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    entity,
  } = fixture();
  queries.lights3D.current = [
    entity(new Map([[Light3D, new Light3D({ castShadow: true })]]), 90),
  ];
  slot.material.alphaMode = 'mask';
  slot.material.alphaCutoff = 0.4;
  slot.material.baseColor = [1, 1, 1, 0.3];
  let setup: ((pass: any) => void) | undefined;
  const builder = {
    createRenderTargetID: jest.fn().mockReturnValue(1),
    pushPass: (callback: (pass: any) => void) => {
      setup = callback;
    },
    resolveRenderTarget: jest.fn().mockReturnValue(1),
  };
  expect(renderer.scheduleShadowPass(builder as any, slot.canvas)).toHaveLength(1);
  const state = (renderer as any).states.get(slot.canvas.read(Canvas).api);
  const gpu = state.meshGPUCache.get(slot.target.__id, slot.mesh);
  const model = new Float32Array(gpu.modelUniformBuffer.bytes.buffer);
  expect(model[35]).toBeCloseTo(0.3);
  expect(model[97]).toBe(1);
  expect(model[98]).toBeCloseTo(0.4);
  let execute: ((renderPass: any) => void) | undefined;
  setup!({
    setDebugName: jest.fn(),
    attachRenderTargetID: jest.fn(),
    exec: (callback: (renderPass: any) => void) => {
      execute = callback;
    },
  });
  execute!(slot.gpu.pass);
  expect(slot.gpu.bindings.at(-1)?.samplerBindings).toHaveLength(1);
  expect(slot.gpu.pass.setVertexInput).toHaveBeenCalledWith(
    expect.anything(),
    expect.arrayContaining([
      { buffer: gpu.vertexBuffer },
      { buffer: gpu.uvBuffer },
      { buffer: gpu.normalBuffer },
    ]),
    expect.anything(),
  );
  slot.material.alphaMode = 'opaque';
  renderer.scheduleShadowPass(builder as any, slot.canvas);
  expect(model[97]).toBe(0);
});

it('uses six shadow faces for a wide spotlight while keeping narrow cones on one map', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    entity,
  } = fixture();
  const light = new Light3D({
    type: 'spot',
    castShadow: true,
    position: [0, 0, -100],
    direction: [0, 0, 1],
    outerConeAngle: Math.PI / 2,
    range: 500,
  });
  queries.lights3D.current = [entity(new Map([[Light3D, light]]), 90)];
  const targets: any[] = [];
  let setup: ((pass: any) => void) | undefined;
  const builder = {
    createRenderTargetID: (description: any) => {
      targets.push(description);
      return targets.length;
    },
    pushPass: (callback: (pass: any) => void) => {
      setup = callback;
    },
    resolveRenderTarget: (id: number) => id,
  };

  const [wide] = renderer.scheduleShadowPass(builder as any, slot.canvas);
  expect(wide.faces).toHaveLength(6);
  expect(targets[0]).toMatchObject({ width: 1536, height: 1024 });
  let execute: ((renderPass: any) => void) | undefined;
  setup!({
    setDebugName: jest.fn(),
    attachRenderTargetID: jest.fn(),
    exec: (callback: (renderPass: any) => void) => {
      execute = callback;
    },
  });
  execute!(slot.gpu.pass);
  expect(slot.gpu.pass.setViewport).toHaveBeenCalledTimes(6);
  expect(slot.gpu.pass.drawIndexed).toHaveBeenCalled();

  light.outerConeAngle = Math.PI / 4;
  const [narrow] = renderer.scheduleShadowPass(builder as any, slot.canvas);
  expect(narrow.faces).toBeUndefined();
  expect(targets[2]).toMatchObject({ width: 1024, height: 1024 });
  // The shading cone widens invalid/equal authored inputs. The shadow map
  // must use the same sanitized angle or it misses illuminated receivers.
  light.innerConeAngle = Math.PI / 2;
  const [sanitized] = renderer.scheduleShadowPass(builder as any, slot.canvas);
  expect(sanitized.faces).toHaveLength(6);
  light.direction = [0, 0, 0];
  light.outerConeAngle = (120 * Math.PI) / 180;
  expect(renderer.scheduleShadowPass(builder as any, slot.canvas)).toEqual([]);
});

it('skips mesh bounds work when no light can cast a shadow', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    draw,
    entity,
  } = fixture();
  draw();
  const state = (renderer as any).states.get(slot.canvas.read(Canvas).api);
  const getMesh = jest.spyOn(state.meshGPUCache, 'get');
  const light = new Light3D({ type: 'directional', castShadow: false });
  queries.lights3D.current = [
    entity(new Map([[Light3D, new Light3D({ type: 'ambient' })]]), 89),
    entity(new Map([[Light3D, light]]), 90),
  ];
  expect(renderer.scheduleShadowPass({} as any, slot.canvas)).toEqual([]);
  light.castShadow = true;
  light.shadowStrength = 0;
  expect(renderer.scheduleShadowPass({} as any, slot.canvas)).toEqual([]);
  expect(getMesh).not.toHaveBeenCalled();
});

it('does not allocate a shadow map without a receiving mesh', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    entity,
  } = fixture();
  queries.lights3D.current = [
    entity(
      new Map([
        [Light3D, new Light3D({ type: 'directional', castShadow: true })],
      ]),
      90,
    ),
  ];
  const builder = {
    createRenderTargetID: jest.fn().mockReturnValue(1),
    pushPass: jest.fn(),
    resolveRenderTarget: jest.fn().mockReturnValue(1),
  };
  slot.material.receiveShadow = false;
  expect(renderer.scheduleShadowPass(builder as any, slot.canvas)).toEqual([]);
  expect(builder.createRenderTargetID).not.toHaveBeenCalled();
  queries.meshes3D.current.push(
    entity(
      new Map<any, any>([
        [Canvas3DScope, { canvas: slot.canvas }],
        [Mesh3D, new Mesh3D()],
        [Material3D, new Material3D({ castShadow: false })],
        [Transform3D, new Transform3D()],
      ]),
      99,
    ),
  );
  expect(renderer.scheduleShadowPass(builder as any, slot.canvas)).toEqual([]);
  expect(builder.createRenderTargetID).not.toHaveBeenCalled();
  slot.material.receiveShadow = true;
  expect(
    renderer.scheduleShadowPass(builder as any, slot.canvas),
  ).toMatchObject([{ lightIndex: 0 }]);
  expect(builder.pushPass).toHaveBeenCalledTimes(1);
});

it('skips a spot shadow map when its cone contains no casting mesh', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    entity,
  } = fixture();
  const receiver = entity(
    new Map<any, any>([
      [Canvas3DScope, { canvas: slot.canvas }],
      [Mesh3D, new Mesh3D(createGeometry({ type: 'cube' }))],
      [Material3D, new Material3D({ castShadow: false })],
      [Transform3D, new Transform3D({ translation: [100, 0, -100] })],
    ]),
    99,
  );
  queries.meshes3D.current.push(receiver);
  queries.lights3D.current = [
    entity(
      new Map([
        [
          Light3D,
          new Light3D({
            type: 'spot',
            castShadow: true,
            position: [0, 0, -100],
            direction: [1, 0, 0],
            range: 300,
          }),
        ],
      ]),
      90,
    ),
  ];
  const builder = {
    createRenderTargetID: jest.fn().mockReturnValue(1),
    pushPass: jest.fn(),
    resolveRenderTarget: jest.fn().mockReturnValue(1),
  };
  expect(renderer.scheduleShadowPass(builder as any, slot.canvas)).toEqual([]);
  expect(builder.createRenderTargetID).not.toHaveBeenCalled();
  slot.transform.translation = [50, 0, -100];
  expect(
    renderer.scheduleShadowPass(builder as any, slot.canvas),
  ).toMatchObject([{ lightIndex: 0 }]);
  expect(builder.pushPass).toHaveBeenCalledTimes(1);
});

it('snapshots light data before another ECS component read invalidates it', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    entity,
  } = fixture();
  let firstValid = true;
  const firstLight = new Proxy(
    new Light3D({ type: 'directional', castShadow: true }),
    {
      get(target, key) {
        if (!firstValid) throw new Error('stale Light3D component');
        return Reflect.get(target, key);
      },
    },
  );
  const first = entity(new Map([[Light3D, firstLight]]), 90);
  const second = entity(
    new Map([
      [Light3D, new Light3D({ type: 'directional', castShadow: true })],
    ]),
    91,
  );
  const readSecond = second.read.bind(second);
  (second as any).read = (type: any) => {
    if (type === Light3D) firstValid = false;
    return readSecond(type);
  };
  queries.lights3D.current = [first, second];
  let target = 0;
  const builder = {
    createRenderTargetID: () => ++target,
    pushPass: jest.fn(),
    resolveRenderTarget: (id: number) => id,
  };
  expect(renderer.scheduleShadowPass(builder as any, slot.canvas)).toHaveLength(
    2,
  );
});

it('executes a scheduled shadow pass after mesh component reads expire', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    entity,
  } = fixture();
  slot.transform.translation = [20, 0, 0];
  queries.lights3D.current = [
    entity(
      new Map([
        [Light3D, new Light3D({ type: 'directional', castShadow: true })],
      ]),
      90,
    ),
  ];
  let setup!: (pass: any) => void;
  const builder = {
    createRenderTargetID: () => 1,
    pushPass: (callback: (pass: any) => void) => {
      setup = callback;
    },
    resolveRenderTarget: () => 1,
  };
  expect(renderer.scheduleShadowPass(builder as any, slot.canvas)).toHaveLength(
    1,
  );
  // Render-graph execution happens after the ECS scheduling phase. A reused
  // component view must never be read by the deferred callback.
  (slot.target as any).read = () => {
    throw new Error('expired mesh component view');
  };
  let execute!: (pass: any) => void;
  setup({
    setDebugName: jest.fn(),
    attachRenderTargetID: jest.fn(),
    exec: (callback: (pass: any) => void) => {
      execute = callback;
    },
  });
  expect(() => execute(slot.gpu.pass)).not.toThrow();
  expect(slot.gpu.pass.drawIndexed).toHaveBeenCalledTimes(1);
});

it('draws every mesh in the color pass but only casters in the shadow pass', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    entity,
    draw,
  } = fixture();
  const receiver = entity(
    new Map<any, any>([
      [Canvas3DScope, { canvas: slot.canvas }],
      [Mesh3D, new Mesh3D(createGeometry({ type: 'cube' }))],
      [Material3D, new Material3D({ castShadow: false })],
      [Transform3D, new Transform3D({ translation: [40, 0, 0] })],
    ]),
    99,
  );
  queries.meshes3D.current.push(receiver);
  queries.lights3D.current = [
    entity(
      new Map([
        [Canvas3DScope, { canvas: slot.canvas }],
        [Light3D, new Light3D({ type: 'directional', castShadow: true })],
      ]),
      90,
    ),
  ];
  let setup: ((pass: any) => void) | undefined;
  const builder = {
    createRenderTargetID: () => 1,
    pushPass: (callback: (pass: any) => void) => {
      setup = callback;
    },
    resolveRenderTarget: () => 1,
  };
  expect(renderer.scheduleShadowPass(builder as any, slot.canvas)).toHaveLength(
    1,
  );
  let execute!: (pass: any) => void;
  setup!({
    setDebugName: jest.fn(),
    attachRenderTargetID: jest.fn(),
    exec: (callback: (pass: any) => void) => {
      execute = callback;
    },
  });
  execute(slot.gpu.pass);
  expect(slot.gpu.pass.drawIndexed).toHaveBeenCalledTimes(1);
  draw();
  expect(slot.gpu.pass.drawIndexed).toHaveBeenCalledTimes(3);
});

it('schedules two independent shadow maps and ignores later casters', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    entity,
  } = fixture();
  const lights = [
    new Light3D({ type: 'ambient' }),
    new Light3D({ type: 'directional', castShadow: true }),
    new Light3D({ type: 'point', castShadow: true, position: [0, 0, -100] }),
    new Light3D({ type: 'directional', castShadow: true }),
  ];
  queries.lights3D.current = lights.map((light, index) =>
    entity(
      new Map([
        [Canvas3DScope, { canvas: slot.canvas }],
        [Light3D, light],
      ]),
      90 + index,
    ),
  );
  const targets: { width: number }[] = [];
  const passes: ((pass: any) => void)[] = [];
  const builder = {
    createRenderTargetID: (desc: any) => {
      targets.push(desc);
      return targets.length;
    },
    pushPass: (callback: (pass: any) => void) => {
      passes.push(callback);
    },
    resolveRenderTarget: (id: number) => id + 10,
  };
  const frames = renderer.scheduleShadowPass(builder as any, slot.canvas);
  expect(frames).toMatchObject([
    { lightIndex: 0, resolveID: 11 },
    { lightIndex: 1, resolveID: 13, faces: expect.any(Array) },
  ]);
  expect(targets.map((target) => target.width)).toEqual([
    1024, 1024, 1536, 1536,
  ]);
  expect(passes).toHaveLength(2);
  for (const setup of passes) {
    let execute!: (pass: any) => void;
    setup({
      setDebugName: jest.fn(),
      attachRenderTargetID: jest.fn(),
      exec: (callback: (pass: any) => void) => {
        execute = callback;
      },
    });
    execute(slot.gpu.pass);
  }
  // The cube is visible to the directional light and only one point face.
  expect(slot.gpu.pass.drawIndexed).toHaveBeenCalledTimes(2);
  const sceneBuffers = (renderer as any).states.get(
    slot.canvas.read(Canvas).api,
  ).shadowSceneBuffers;
  expect(sceneBuffers[0]).not.toBe(sceneBuffers[6]);
  expect(sceneBuffers[0].setSubData).toHaveBeenCalledTimes(1);
  expect(sceneBuffers[6].setSubData).toHaveBeenCalledTimes(1);
  lights[2].shadowStrength = 0;
  expect(
    renderer.scheduleShadowPass(builder as any, slot.canvas),
  ).toMatchObject([{ lightIndex: 0 }, { lightIndex: 2 }]);
});

it('remembers geometry changes across skipped frames and uploads once on the next draw', () => {
  const {
    renderer,
    queries,
    slots: [slot],
    draw,
  } = fixture();
  draw();
  slot.mesh.positions[0] = 12;
  queries.geometryDirty.addedOrChanged = [slot.target];
  renderer.execute();
  queries.geometryDirty.addedOrChanged = [];
  renderer.execute();
  draw();
  draw();
  expect(slot.gpu.buffers).toHaveLength(11); // scene + two complete mesh allocations
  const vertices = (slot.gpu.pass.setVertexInput as jest.Mock).mock.calls.at(
    -1,
  )[1][0].buffer;
  expect(new Float32Array(vertices.bytes.buffer)[0]).toBe(12);
  for (const buffer of slot.gpu.buffers.slice(1, 6))
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
});

it.each([
  'empty',
  'deleted',
  'pending deletion',
  'material removed',
  'scope moved',
])('reclaims %s mesh resources without another draw', (reason) => {
  const {
    renderer,
    queries,
    slots: [slot, other],
    draw,
  } = fixture(2);
  draw();
  draw(1);
  if (reason === 'pending deletion') slot.meshValues.set(ToBeDeleted, {});
  if (reason === 'empty') slot.mesh.positions = new Float32Array();
  if (reason === 'deleted') {
    queries.meshes3D.current = [other.target];
    queries.meshes3D.removed = [slot.target];
  }
  if (reason === 'material removed') slot.meshValues.delete(Material3D);
  if (reason === 'scope moved')
    slot.meshValues.set(Canvas3DScope, { canvas: other.canvas });
  renderer.execute();
  for (const buffer of slot.gpu.buffers.slice(1))
    expect(buffer.destroy).toHaveBeenCalledTimes(1);
  for (const buffer of other.gpu.buffers)
    expect(buffer.destroy).not.toHaveBeenCalled();
  if (reason === 'scope moved') {
    draw(1);
    expect(other.gpu.buffers).toHaveLength(11);
  }
});

it.each(['device', 'renderCache', 'scope'] as const)(
  'replaces resources when the canvas %s changes',
  (key) => {
    const {
      renderer,
      slots: [slot],
      draw,
    } = fixture();
    draw();
    const old = [...slot.gpu.buffers];
    const replacement = fakeMeshGPU();
    cleanups.push(() => replacement.scope.dispose());
    slot.values.set(GPUResource, { ...slot.gpu, [key]: replacement[key] });
    draw(); // replacement can precede execute
    for (const buffer of old) expect(buffer.destroy).toHaveBeenCalledTimes(1);
    const current = [...slot.gpu.buffers, ...replacement.buffers].filter(
      (b) => !old.includes(b),
    );
    expect(current.length).toBeGreaterThan(0);
    if (key === 'scope') {
      slot.gpu.scope.dispose();
      for (const buffer of current)
        expect(buffer.destroy).not.toHaveBeenCalled();
    }
    renderer.finalize();
    for (const buffer of current)
      expect(buffer.destroy).toHaveBeenCalledTimes(1);
  },
);

it.each(['canvas removed', 'GPU removed', 'GPU replaced'])(
  'execute releases an invalid owner: %s',
  (reason) => {
    const {
      renderer,
      queries,
      slots: [slot],
      draw,
    } = fixture();
    draw();
    if (reason === 'canvas removed') queries.canvases.current = [];
    if (reason === 'GPU removed') slot.values.delete(GPUResource);
    if (reason === 'GPU replaced') {
      const replacement = fakeMeshGPU();
      cleanups.push(() => replacement.scope.dispose());
      slot.values.set(GPUResource, replacement);
    }
    renderer.execute();
    for (const resource of [...slot.gpu.buffers, ...slot.gpu.textures])
      expect(resource.destroy).toHaveBeenCalledTimes(1);
  },
);

it('releases owned buffers before the canvas device and leaves the other canvas alive', () => {
  const { renderer, slots, draw } = fixture(2);
  draw();
  draw(1);
  slots[0].gpu.scope.dispose();
  for (const resource of [
    ...slots[0].gpu.buffers,
    ...slots[0].gpu.textures,
    ...slots[0].gpu.borrowed,
  ])
    expect(resource.destroy).toHaveBeenCalledTimes(1);
  expect(slots[0].gpu.releases.at(-1)).toBe('device');
  for (const resource of [...slots[1].gpu.buffers, ...slots[1].gpu.borrowed])
    expect(resource.destroy).not.toHaveBeenCalled();
  draw(1);
  renderer.finalize();
  for (const resource of slots[1].gpu.borrowed)
    expect(resource.destroy).not.toHaveBeenCalled();
});

it('keeps scene and model uniforms independent even when canvases share a device', () => {
  const {
    slots: [first, second],
    draw,
  } = fixture(2);
  second.values.set(GPUResource, first.gpu);
  draw();
  draw(1);
  expect(first.gpu.buffers).toHaveLength(12);
  const a = first.gpu.draws[0].uniformBufferBindings;
  const b = second.gpu.draws[0].uniformBufferBindings;
  expect(a[0].buffer).not.toBe(b[0].buffer);
  expect(a[1].buffer).not.toBe(b[1].buffer);
  expect(new Float32Array(a[1].buffer.bytes.buffer)[12]).toBe(0);
  expect(new Float32Array(b[1].buffer.bytes.buffer)[12]).toBe(20);
});

it.each(['texture allocation', 'texture upload', 'sampler allocation'])(
  'rolls back failed pipeline setup: %s',
  (reason) => {
    const {
      slots: [slot],
      draw,
    } = fixture();
    if (reason === 'texture allocation')
      slot.gpu.createTexture.mockImplementationOnce(() => {
        throw new Error('setup failed');
      });
    if (reason === 'texture upload') {
      const allocate = slot.gpu.createTexture.getMockImplementation()!;
      slot.gpu.createTexture.mockImplementationOnce(() => {
        const texture = allocate();
        texture.setImageData.mockImplementationOnce(() => {
          throw new Error('setup failed');
        });
        return texture;
      });
    }
    if (reason === 'sampler allocation')
      slot.gpu.createSampler.mockImplementationOnce(() => {
        throw new Error('setup failed');
      });
    expect(draw).toThrow('setup failed');
    for (const resource of [...slot.gpu.buffers, ...slot.gpu.textures])
      expect(resource.destroy).toHaveBeenCalledTimes(1);
    for (const resource of slot.gpu.borrowed)
      expect(resource.destroy).not.toHaveBeenCalled();
    draw();
    expect(slot.gpu.draws).toHaveLength(1);
  },
);

it('attempts all releases after a destroy failure, including the other canvas', () => {
  const { renderer, slots, draw } = fixture(2);
  draw();
  draw(1);
  slots[0].gpu.buffers[1].destroy.mockImplementation(() => {
    throw new Error('destroy failed');
  });
  expect(() => renderer.finalize()).toThrow('Resource cleanup failed');
  expect(() => renderer.finalize()).not.toThrow();
  for (const slot of slots)
    for (const resource of [...slot.gpu.buffers, ...slot.gpu.textures])
      expect(resource.destroy).toHaveBeenCalledTimes(1);
});

it('discards a late image completion after its canvas is disposed', async () => {
  const {
    slots: [slot],
    draw,
  } = fixture();
  let resolve!: (image: ImageBitmap) => void;
  load.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  slot.material.map = 'https://example.test/image.png';
  draw();
  expect(load).toHaveBeenCalledTimes(1);
  draw();
  expect(load).toHaveBeenCalledTimes(1);
  slot.gpu.scope.dispose();
  const allocations = slot.gpu.textures.length;
  resolve({ width: 10, height: 10 } as ImageBitmap);
  await Promise.resolve();
  expect(slot.gpu.textures).toHaveLength(allocations);
  for (const texture of slot.gpu.textures)
    expect(texture.destroy).toHaveBeenCalledTimes(1);
});

it('refreshes scoped lights and camera viewport without reallocating bindings or model data', () => {
  const { renderer, queries, slots, draw, entity } = fixture(2);
  const light = new Light3D({ type: 'ambient', color: [1, 0, 0] });
  const scope = { canvas: slots[0].canvas };
  queries.lights3D.current = [
    entity(
      new Map<any, any>([
        [Light3D, light],
        [Canvas3DScope, scope],
      ]),
      99,
    ),
  ];
  draw(0);
  draw(1);
  const scenes = slots.map((slot) => slot.gpu.buffers[0]);
  const models = slots.map(
    (slot) => slot.gpu.draws[0].uniformBufferBindings[1].buffer,
  );
  const data = scenes.map((buffer) => new Float32Array(buffer.bytes.buffer));
  expect([...data[0].slice(52, 55)]).toEqual([1, 0, 0]);
  expect([...data[1].slice(52, 55)]).toEqual([1, 1, 1]);
  light.color[1] = 0.5;
  draw(0);
  draw(1);
  const halfSrgbInLinear = ((0.5 + 0.055) / 1.055) ** 2.4;
  expect(data[0][53]).toBeCloseTo(halfSrgbInLinear);
  expect(scenes[0].setSubData).toHaveBeenCalledTimes(2);
  expect(scenes[1].setSubData).toHaveBeenCalledTimes(1);
  scope.canvas = slots[1].canvas;
  draw(0);
  draw(1);
  expect([...data[0].slice(52, 55)]).toEqual([1, 1, 1]);
  expect(data[1][52]).toBe(1);
  expect(data[1][53]).toBeCloseTo(halfSrgbInLinear);
  expect(data[1][54]).toBe(0);
  const oldProjection = data[0][0];
  renderer.drawMeshes(slots[0].gpu.pass, slots[0].canvas, 800, 400);
  expect(data[0][0]).toBeCloseTo(oldProjection / 2);
  for (const [i, slot] of slots.entries()) {
    expect(slot.gpu.bindings).toHaveLength(1);
    expect(models[i].setSubData).toHaveBeenCalledTimes(1);
  }
});

it.each(['map', 'specularMap', 'bumpMap'] as const)(
  'rebinds a completed %s and releases bindings before their dependencies',
  async (field) => {
    const {
      renderer,
      queries,
      slots: [slot],
      draw,
    } = fixture();
    let complete!: (image: ImageBitmap) => void;
    load.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    slot.material[field] = 'texture.png';
    draw();
    draw();
    const first = slot.gpu.bindings[0];
    expect(slot.gpu.bindings).toHaveLength(1);
    expect(
      first.samplerBindings.every(
        (binding) => binding.texture === (slot.gpu.textures[0] as unknown),
      ),
    ).toBe(true);
    complete({ width: 4, height: 4 } as ImageBitmap);
    await Promise.resolve();
    draw();
    const loaded = slot.gpu.textures[2];
    const index = ['map', 'specularMap', 'bumpMap'].indexOf(field);
    const second = slot.gpu.bindings[1];
    expect(second.samplerBindings[index].texture).toBe(loaded);
    expect(first.destroy).toHaveBeenCalledTimes(1);
    const model = second.uniformBufferBindings[1].buffer;
    expect(new Float32Array(model.bytes.buffer)[48 + index]).toBe(1);
    draw();
    expect(slot.gpu.bindings).toHaveLength(2);
    // Replacing the geometry must release the bindings that reference its UBO.
    queries.geometryDirty.addedOrChanged = [slot.target];
    renderer.execute();
    draw();
    const third = slot.gpu.bindings[2];
    expect(second.destroy).toHaveBeenCalledTimes(1);
    expect(slot.gpu.releases.indexOf(`bindings:${second.id}`)).toBeLessThan(
      slot.gpu.releases.indexOf(`buffer:${model.id}`),
    );
    slot.gpu.scope.dispose();
    expect(third.destroy).toHaveBeenCalledTimes(1);
    expect(third.destroy.mock.invocationCallOrder[0]).toBeLessThan(
      loaded.destroy.mock.invocationCallOrder[0],
    );
    expect(third.destroy.mock.invocationCallOrder[0]).toBeLessThan(
      slot.gpu.buffers[0].destroy.mock.invocationCallOrder[0],
    );
  },
);

it('reuses the white binding through a failed load and replaces it when a texture is removed', async () => {
  const {
    slots: [slot],
    draw,
  } = fixture();
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  load.mockRejectedValueOnce(new Error('image failed'));
  slot.material.map = 'failed.png';
  draw();
  await Promise.resolve();
  await Promise.resolve();
  draw();
  expect(slot.gpu.bindings).toHaveLength(1);
  load.mockResolvedValueOnce({ width: 2, height: 2 } as ImageBitmap);
  slot.material.map = 'ready.png';
  draw();
  await Promise.resolve();
  draw();
  expect(slot.gpu.bindings).toHaveLength(2);
  slot.material.map = null;
  draw();
  expect(slot.gpu.bindings).toHaveLength(3);
  expect(slot.gpu.bindings[2].samplerBindings[0].texture).toBe(
    slot.gpu.textures[0],
  );
  expect(new Float32Array(slot.gpu.buffers[5].bytes.buffer)[48]).toBe(0);
  warn.mockRestore();
});
