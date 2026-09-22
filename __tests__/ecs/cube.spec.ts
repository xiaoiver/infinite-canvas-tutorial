import _gl from 'gl';
import '../useSnapshotMatchers';
import {
  App,
  Camera,
  Camera3D,
  Canvas,
  Commands,
  DOMAdapter,
  DefaultPlugins,
  DefaultRenderer3DPlugin,
  DefaultStateManagement,
  Entity,
  Grid,
  Material3D,
  Mesh3D,
  Plugin,
  PreStartUp,
  System,
  Theme,
  Transform,
  Transform3D,
  system,
  API,
  ComputeZIndex,
  GlobalTransform,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';
import { createCubeGeometry } from './cube-geometry';

DOMAdapter.set(NodeJSAdapter);

// linked + perspective：见同目录 cube-perspective.spec.ts（becsy 限制：每个 spec 文件只能 App.run 一次）
describe('Cube', () => {
  it('should render a cube centered on the canvas', async () => {
    const app = new App();

    let $canvas: HTMLCanvasElement;
    let canvasEntity: Entity | undefined;
    let cameraEntity: Entity | undefined;
    let cubeEntity: Entity | undefined;

    const MyPlugin: Plugin = () => {
      system(PreStartUp)(StandaloneCubeStartUpSystem);
      system((s) => s.before(ComputeZIndex))(StandaloneCubeStartUpSystem);
    };

    class StandaloneCubeStartUpSystem extends System {
      private readonly commands = new Commands(this);

      q = this.query(
        (q) =>
          q.using(
            Canvas,
            Theme,
            Grid,
            Camera,
            Transform,
            Camera3D,
            Mesh3D,
            Material3D,
            Transform3D,
            GlobalTransform,
          ).write,
      );

      initialize(): void {
        $canvas = DOMAdapter.get().createCanvas(200, 200) as HTMLCanvasElement;

        const api = new API(new DefaultStateManagement(), this.commands);

        canvasEntity = api.createCanvas({
          element: $canvas,
          width: 200,
          height: 200,
          devicePixelRatio: 1,
        });

        cameraEntity = api.createCamera({
          zoom: 1,
          x: 100,
          y: 100,
        });

        const { positions, normals, indices } = createCubeGeometry(1);

        this.commands.spawn(
          new Camera3D({
            eye: [0, 0, 3.5],
            center: [0, 0, 0],
            clearColor: true,
          }),
        );

        cubeEntity = this.commands
          .spawn(
            new Mesh3D({ positions, normals, indices }),
            new Material3D({
              baseColor: [0.25, 0.55, 0.95, 1],
              ambient: 0.15,
              diffuse: 0.75,
              specular: 0.4,
              shininess: 48,
            }),
            new Transform3D({
              translation: [0, 0, 0],
              rotation: [0.4, 0.4, 0],
              scale: [1, 1, 1],
            }),
          )
          .id()
          .hold();

        this.commands.execute();
      }
    }

    app.addPlugins(...DefaultPlugins, DefaultRenderer3DPlugin, MyPlugin);

    await app.run();

    await sleep(300);

    if (canvasEntity && cameraEntity && cubeEntity) {
      const canvas = canvasEntity.read(Canvas);
      expect(canvas.devicePixelRatio).toBe(1);
      expect(canvas.width).toBe(200);
      expect(canvas.height).toBe(200);
      expect(canvas.renderer).toBe('webgl');
      expect(canvas.cameras).toHaveLength(1);
      expect(cubeEntity.has(Mesh3D)).toBe(true);
      expect(cubeEntity.has(Material3D)).toBe(true);
      expect(cubeEntity.has(Transform3D)).toBe(true);
    }

    const dir = `${__dirname}/snapshots`;
    await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'cube',
    );

    await app.exit();
  });
});
