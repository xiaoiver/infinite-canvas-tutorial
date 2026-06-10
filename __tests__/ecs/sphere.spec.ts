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
} from '../../packages/ecs/src';
import { createUnitSphereGeometry } from '../../packages/ecs/src/utils/geometry3d';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

// 验证带 UV 的 UV 球渲染（贴图管线：UV 顶点缓冲 + sampler 绑定始终存在）。
describe('Sphere', () => {
  it('should render a UV sphere centered on the canvas', async () => {
    const app = new App();

    let $canvas: HTMLCanvasElement;
    let canvasEntity: Entity | undefined;
    let cameraEntity: Entity | undefined;
    let sphereEntity: Entity | undefined;

    const MyPlugin: Plugin = () => {
      system(PreStartUp)(StandaloneSphereStartUpSystem);
      system((s) => s.before(ComputeZIndex))(StandaloneSphereStartUpSystem);
    };

    class StandaloneSphereStartUpSystem extends System {
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

        const { positions, normals, uvs, indices } =
          createUnitSphereGeometry([24, 16]);

        this.commands.spawn(
          new Camera3D({
            eye: [0, 0, 3.5],
            center: [0, 0, 0],
            clearColor: true,
          }),
        );

        sphereEntity = this.commands
          .spawn(
            new Mesh3D({ positions, normals, uvs, indices }),
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
              scale: [2, 2, 2],
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

    if (canvasEntity && cameraEntity && sphereEntity) {
      const canvas = canvasEntity.read(Canvas);
      expect(canvas.width).toBe(200);
      expect(canvas.height).toBe(200);
      expect(canvas.renderer).toBe('webgl');
      expect(sphereEntity.has(Mesh3D)).toBe(true);
      expect(sphereEntity.read(Mesh3D).uvs).not.toBeNull();
      expect(sphereEntity.read(Mesh3D).uvs!.length).toBe(
        (positionsCount(sphereEntity) ?? 0) * 2,
      );
    }

    const dir = `${__dirname}/snapshots`;
    await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'sphere',
    );

    await app.exit();
  });
});

function positionsCount(entity: Entity): number | undefined {
  if (!entity.has(Mesh3D)) {
    return undefined;
  }
  return entity.read(Mesh3D).positions.length / 3;
}
