import {
  API,
  App,
  Commands,
  DefaultPlugins,
  DefaultRenderer3DPlugin,
  DefaultStateManagement,
  PreStartUp,
  System,
  system,
  Pen,
  Mesh3DNode,
  Extrude3D,
  Camera3D,
  Canvas3DScope,
  type SerializedNode,
  Transform3D,
  Selected3D,
  GPUResource,
  Mesh3D,
  Rect,
  Transform,
  ExportFormat,
  svgElementsToExtrudedNodes,
} from '@infinite-canvas-tutorial/ecs';
import { YogaPlugin } from '@infinite-canvas-tutorial/yoga';
import { BufferUsage } from '@infinite-canvas-tutorial/device-api';
import { importExtrudedSvg } from '../../../packages/app/lib/import-extruded-svg';
import { ensure3DCamera } from '../../../packages/app/lib/ensure-3d-camera';
import { settleECSFrames } from './ecs-frames';
import { MESH_SCENE_UNIFORM_FLOATS } from '../../../packages/ecs/src/systems/mesh3d/mesh-scene-uniforms';
import { MESH_MODEL_UNIFORM_FLOATS } from '../../../packages/ecs/src/systems/mesh3d/mesh-model-uniforms';

let api: API;
const params = new URLSearchParams(location.search);
const width = Number(params.get('width') || 200);
const height = Number(params.get('height') || 200);
const zoom = Number(params.get('zoom') || 1);
const rotation = Number(params.get('rotation') || 0);
const z = Number(params.get('z') || 0);
class Bootstrap extends System {
  access = this.query((q) => q.usingAll.write);
  initialize() {
    api = new API(new DefaultStateManagement(), new Commands(this));
    const element = document.querySelector<HTMLCanvasElement>('#canvas')!;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    api.createCanvas({
      element,
      width,
      height,
      devicePixelRatio: Number(params.get('dpr') || 1),
    });
    api.createCamera({ zoom, x: 0, y: 0, rotation });
    api.setAppState({ penbarSelected: Pen.SELECT });
    if (
      !params.has('appCamera') &&
      (params.has('extrude') ||
        params.has('extrudePath') ||
        params.has('extrudePrimitive'))
    ) {
      const commands = new Commands(this);
      commands.spawn(
        new Camera3D({
          linked: true,
          projection: 'perspective',
          clearColor: false,
        }),
        new Canvas3DScope({ canvas: api.getCanvas() }),
      );
      commands.execute();
    }
  }
}
const app = new App().addPlugins(
  ...DefaultPlugins,
  DefaultRenderer3DPlugin,
  ...(params.has('yoga') ? [YogaPlugin] : []),
  () => {
    system(PreStartUp)(Bootstrap);
    system((s) => s.inAnyOrderWith(s.allSystems))(Bootstrap);
  },
);
const uploads: unknown[] = [];
const derivedUpdates = {
  modelUploads: 0,
  sceneUploads: 0,
  meshBindings: 0,
  layerScans: 0,
};
const resetDerivedUpdates = () => {
  derivedUpdates.modelUploads = 0;
  derivedUpdates.sceneUploads = 0;
  derivedUpdates.meshBindings = 0;
  derivedUpdates.layerScans = 0;
};
const harness = {
  api: () => api,
  importAndExportSvg: async (source: string) => {
    const nodes = importExtrudedSvg(source, 24, { x: 100, y: 100 });
    await api.edit((editor) => editor.replaceDocument(nodes, 'remote'));
    await settleECSFrames(api, 3);
    const initialGlb = api.export({
      format: ExportFormat.GLB,
      download: false,
    });
    const sourceNode = api
      .getNodes()
      .find((node) => 'extrude3d' in node && node.extrude3d);
    if (!sourceNode) throw new Error('Imported SVG has no extrusion');
    await api.edit((editor) =>
      editor.updateNode(editor.getNodeById(sourceNode.id), {
        extrude3d: {
          depth: 32,
          bevelSize: 3,
          bevelSegments: 4,
          sideColor: '#ff00ff',
        },
      }),
    );
    await settleECSFrames(api, 3);
    const editedGlb = api.export({ format: ExportFormat.GLB, download: false });
    return {
      nodes: api.getNodes(),
      initialGlb: Array.from(initialGlb),
      editedGlb: Array.from(editedGlb),
    };
  },
  svgExtrusionState: () => {
    const node = api.getNodeById('model');
    const entity = api.getEntity(node);
    const mesh = entity.read(Extrude3D).meshEntity!;
    return {
      type: node.type,
      fillRule: node.type === 'path' ? node.fillRule : undefined,
      depth: node.type === 'path' ? node.extrude3d : undefined,
      triangles: mesh.read(Mesh3D).indices.length / 3,
    };
  },
  resetDerivedUpdates,
  derivedUpdates: () => ({ ...derivedUpdates }),
  settle: () => settleECSFrames(api, 3),
  trackGeometryUploads: () => {
    const device = api.getCanvas().read(GPUResource).device;
    const createBuffer = device.createBuffer.bind(device);
    device.createBuffer = (descriptor) => {
      uploads.push(descriptor.viewOrSize);
      return createBuffer(descriptor);
    };
  },
  geometryUploads: () => {
    const entity = api.getEntity(api.getNodeById('model'));
    const mesh = (
      entity.has(Extrude3D)
        ? entity.read(Extrude3D).meshEntity!
        : entity.read(Mesh3DNode).meshEntity!
    ).read(Mesh3D);
    const arrays = [mesh.positions, mesh.normals, mesh.uvs, mesh.indices];
    return uploads.filter((data) => arrays.includes(data as Float32Array))
      .length;
  },
  state: () => {
    const node = api.getNodeById('model');
    const entity = api.getEntity(node);
    const mesh = entity.has(Extrude3D)
      ? entity.read(Extrude3D).meshEntity!
      : entity.read(Mesh3DNode).meshEntity!;
    return {
      node,
      origin: {
        x: entity.read(Transform).translation.x,
        y: entity.read(Transform).translation.y,
      },
      size: {
        width: entity.read(Rect).width,
        height: entity.read(Rect).height,
      },
      translation: [...mesh.read(Transform3D).translation],
      rotation: [...mesh.read(Transform3D).rotation],
      scale: [...mesh.read(Transform3D).scale],
      dragging: mesh.has(Selected3D) && mesh.read(Selected3D).dragging,
      axis: mesh.has(Selected3D) ? mesh.read(Selected3D).activeAxis : 'none',
      partKind: mesh.has(Selected3D)
        ? mesh.read(Selected3D).activePartKind
        : null,
      center: api.canvas2Viewport({ x: 80, y: 80 }),
    };
  },
};
declare global {
  interface Window {
    gizmoTest: typeof harness;
  }
}
window.gizmoTest = harness;
async function init() {
  await app.run();
  while (!api.getCanvas().has(GPUResource)) await harness.settle();
  if (params.has('appCamera')) {
    const installation = ensure3DCamera(api);
    if (ensure3DCamera(api) !== installation)
      throw new Error('App 3D camera initialization was not idempotent');
    await installation;
  }
  // Observe actual scene/model UBO writes and mesh bindings, excluding gizmos.
  const device = api.getCanvas().read(GPUResource).device;
  const sceneBuffers = new WeakSet<object>();
  const createBuffer = device.createBuffer.bind(device);
  device.createBuffer = (descriptor) => {
    const buffer = createBuffer(descriptor);
    if (descriptor.usage === BufferUsage.UNIFORM) {
      const isScene = descriptor.viewOrSize === MESH_SCENE_UNIFORM_FLOATS * 4;
      const isModel = descriptor.viewOrSize === MESH_MODEL_UNIFORM_FLOATS * 4;
      if (isScene) sceneBuffers.add(buffer);
      if (isScene || isModel) {
        const upload = buffer.setSubData.bind(buffer);
        buffer.setSubData = (...args) => {
          if (isScene) derivedUpdates.sceneUploads++;
          else derivedUpdates.modelUploads++;
          upload(...args);
        };
      }
    }
    return buffer;
  };
  const createBindings = device.createBindings.bind(device);
  device.createBindings = (descriptor) => {
    if (
      descriptor.uniformBufferBindings?.some(({ buffer }) =>
        sceneBuffers.has(buffer),
      )
    )
      derivedUpdates.meshBindings++;
    return createBindings(descriptor);
  };
  const setLayers = api.setMesh3DLayers.bind(api);
  api.setMesh3DLayers = (layers) => {
    derivedUpdates.layerScans++;
    return setLayers(layers);
  };
  await api.edit(
    (editor) => {
      const node: SerializedNode =
        params.has('extrudePath') || params.has('extrudePrimitive')
          ? svgElementsToExtrudedNodes(
              [
                new DOMParser().parseFromString(
                  params.has('extrudePrimitive')
                    ? '<svg xmlns="http://www.w3.org/2000/svg"><ellipse id="model" cx="80" cy="80" rx="20" ry="15" fill="#33aabb"/></svg>'
                    : '<svg xmlns="http://www.w3.org/2000/svg"><path id="model" d="M60 60 H100 V100 H60 Z M72 72 H88 V88 H72 Z" fill="#33aabb" fill-rule="evenodd"/></svg>',
                  'image/svg+xml',
                ).documentElement.firstElementChild as SVGElement,
              ],
              20,
            )[0]
          : params.has('extrude')
          ? {
              id: 'model',
              type: 'rect',
              zIndex: 0,
              x: 60,
              y: 60,
              width: 40,
              height: 40,
              extrude3d: { depth: 20, z: 10 },
              fills: [{ type: 'solid', value: '#33aabb' }],
            }
          : {
              id: 'model',
              type: 'mesh3d',
              zIndex: 0,
              x: 60,
              y: 60,
              z,
              width: 40,
              height: 40,
              scale3d: 20,
            };
      const nodes: SerializedNode[] = params.has('alpha')
        ? [
            {
              id: 'alpha-floor',
              type: 'mesh3d',
              zIndex: 0,
              x: 0,
              y: 0,
              z: 100,
              width: 200,
              height: 200,
              geometry: { type: 'plane' },
              scale3d: [200, 200, 1],
              rotation3d: [0, Math.PI, 0],
              material3d: { baseColor: '#ffffff', castShadow: false },
              camera3d: {
                linked: true,
                projection: 'perspective',
                clearColor: false,
              },
            },
            {
              id: 'alpha-mask',
              type: 'mesh3d',
              zIndex: 1,
              x: 20,
              y: 20,
              z: 20,
              width: 70,
              height: 70,
              geometry: { type: 'plane' },
              scale3d: [70, 70, 1],
              rotation3d: [0, Math.PI, 0],
              material3d: {
                map:
                  'data:image/svg+xml,' +
                  encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="1" height="2" fill="red"/></svg>',
                  ),
                alphaMode: 'mask',
                alphaCutoff: 0.5,
                castShadow: true,
              },
            },
            {
              id: 'alpha-near',
              type: 'mesh3d',
              zIndex: 2,
              x: 120,
              y: 55,
              z: 0,
              width: 60,
              height: 80,
              geometry: { type: 'plane' },
              scale3d: [60, 80, 1],
              rotation3d: [0, Math.PI, 0],
              material3d: {
                baseColor: [1, 0, 0, 0.6],
                alphaMode: 'blend',
                castShadow: false,
              },
            },
            {
              id: 'alpha-far',
              type: 'mesh3d',
              zIndex: 3,
              x: 105,
              y: 55,
              z: 50,
              width: 60,
              height: 80,
              geometry: { type: 'plane' },
              scale3d: [60, 80, 1],
              rotation3d: [0, Math.PI, 0],
              material3d: {
                baseColor: [0, 0, 1, 0.6],
                alphaMode: 'blend',
                castShadow: false,
              },
            },
            {
              id: 'alpha-ambient',
              type: 'light3d',
              zIndex: 4,
              lightType: 'ambient',
              intensity: 1,
            },
            {
              id: 'alpha-sun',
              type: 'light3d',
              zIndex: 5,
              lightType: 'directional',
              direction: [0.3, 0.4, 0.6],
              intensity: 1,
              castShadow: true,
            },
          ]
        : [node];
      if (params.has('yoga')) {
        node.parentId = 'layout';
        nodes.unshift({
          id: 'layout',
          type: 'rect',
          zIndex: -1,
          x: 0,
          y: 0,
          width: 200,
          height: 160,
          display: 'flex',
          flexDirection: 'row',
          padding: [60, 60],
          fills: [],
        });
      }
      editor.replaceDocument(nodes, 'remote');
      if (!params.has('alpha'))
        editor.selectNodes([editor.getNodeById('model')]);
    },
    { capture: 'NEVER' },
  );
  await harness.settle();
  api.clearHistory();
  document.querySelector('#status')!.textContent = 'Ready';
}
void init();
