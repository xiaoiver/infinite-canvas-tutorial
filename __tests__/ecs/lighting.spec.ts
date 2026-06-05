import _gl from 'gl';
import '../useSnapshotMatchers';
import {
  App,
  Camera,
  Canvas,
  Canvas3DScope,
  Children,
  Commands,
  DOMAdapter,
  DefaultPlugins,
  DefaultRenderer3DPlugin,
  DefaultStateManagement,
  Entity,
  Grid,
  Light3D,
  Mesh3DNode,
  Name,
  Parent,
  Plugin,
  PreStartUp,
  Rect,
  Renderable,
  System,
  Theme,
  Transform,
  Visibility,
  ZIndex,
  system,
  API,
  ComputeZIndex,
  type SerializedNode,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

/** Fixed layout (no animation) aligned with site Lighting.vue, scaled for 400×200. */
const SCENE_CENTER = { x: 200, y: 100, z: 40 };
const SPOT_LIFT = 100;
const SPOT_BACK = 80;
const SPOT_ORBIT = 90;

function buildLightingSceneNodes(): SerializedNode[] {
  const spotX = SCENE_CENTER.x + SPOT_ORBIT;
  const spotY = SCENE_CENTER.y - SPOT_LIFT;
  const spotZ = SCENE_CENTER.z + SPOT_BACK;
  const dx = SCENE_CENTER.x - spotX;
  const dy = SCENE_CENTER.y - spotY;
  const dz = SCENE_CENTER.z - spotZ;
  const len = Math.hypot(dx, dy, dz) || 1;

  const cubeBase = {
    type: 'mesh3d' as const,
    y: 80,
    width: 60,
    height: 60,
    z: 40,
    zIndex: 0,
    scale3d: 55,
    rotation3d: [0.35, 0.5, 0] as [number, number, number],
  };

  return [
    {
      id: 'light-ambient',
      type: 'light3d',
      lightType: 'ambient',
      intensity: 0.35,
      zIndex: -3,
    },
    {
      id: 'light-key',
      type: 'light3d',
      lightType: 'directional',
      direction: [-0.45, -0.65, -0.55],
      intensity: 0.85,
      zIndex: -3,
    },
    {
      id: 'light-fill',
      type: 'light3d',
      lightType: 'directional',
      direction: [0.12, -0.28, 0.88],
      intensity: 0.42,
      zIndex: -3,
    },
    {
      id: 'light-spot',
      type: 'light3d',
      lightType: 'spot',
      x: spotX,
      y: spotY,
      z: spotZ,
      direction: [dx / len, dy / len, dz / len],
      color: '#ffe6b3',
      intensity: 1.4,
      range: 0,
      zIndex: -3,
    },
    {
      id: 'cube-red',
      ...cubeBase,
      x: 50,
      material3d: {
        baseColor: '#f25952',
        ambient: 0.25,
        diffuse: 0.75,
        specular: 0.35,
        shininess: 32,
      },
      camera3d: {
        linked: true,
        projection: 'perspective',
        clearColor: false,
      },
    },
    {
      id: 'cube-white',
      ...cubeBase,
      x: 150,
      material3d: {
        baseColor: '#ebeff2',
        ambient: 0.25,
        diffuse: 0.75,
        specular: 0.65,
        shininess: 96,
      },
    },
    {
      id: 'cube-blue',
      ...cubeBase,
      x: 250,
      material3d: {
        baseColor: '#478cf2',
        ambient: 0.25,
        diffuse: 0.75,
        specular: 0.45,
        shininess: 48,
      },
    },
  ];
}

describe('Lighting', () => {
  it('should render three lit cubes with ambient, directional, and spot lights', async () => {
    const app = new App();

    let $canvas: HTMLCanvasElement;
    let canvasEntity: Entity | undefined;

    const MyPlugin: Plugin = () => {
      system(PreStartUp)(LightingStartUpSystem);
      system((s) => s.before(ComputeZIndex))(LightingStartUpSystem);
    };

    class LightingStartUpSystem extends System {
      private readonly commands = new Commands(this);

      q = this.query(
        (q) =>
          q.using(
            Canvas,
            Theme,
            Grid,
            Camera,
            Parent,
            Children,
            Transform,
            Renderable,
            Rect,
            Mesh3DNode,
            Canvas3DScope,
            Light3D,
            Visibility,
            Name,
            ZIndex,
          ).write,
      );

      initialize(): void {
        $canvas = DOMAdapter.get().createCanvas(400, 200) as HTMLCanvasElement;

        const api = new API(new DefaultStateManagement(), this.commands);

        canvasEntity = api.createCanvas({
          element: $canvas,
          width: 400,
          height: 200,
          devicePixelRatio: 1,
        });

        api.createCamera({ zoom: 1, x: 0, y: 0 });
        api.updateNodes(buildLightingSceneNodes());
      }
    }

    app.addPlugins(...DefaultPlugins, DefaultRenderer3DPlugin, MyPlugin);

    await app.run();
    await sleep(400);

    if (canvasEntity) {
      const canvas = canvasEntity.read(Canvas);
      expect(canvas.devicePixelRatio).toBe(1);
      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(200);
      expect(canvas.renderer).toBe('webgl');
    }

    const dir = `${__dirname}/snapshots`;
    await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'lighting',
    );

    await app.exit();
  });
});
