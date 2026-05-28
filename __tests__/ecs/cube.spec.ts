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
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

/** Unit cube centered at origin with per-face normals (24 verts, indexed). */
function createCubeGeometry(size = 1) {
  const h = size / 2;
  const faces: {
    normal: [number, number, number];
    verts: [number, number, number][];
  }[] = [
    { normal: [0, 0, 1], verts: [[-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]] },
    { normal: [0, 0, -1], verts: [[-h, -h, -h], [-h, h, -h], [h, h, -h], [h, -h, -h]] },
    { normal: [0, 1, 0], verts: [[-h, h, -h], [-h, h, h], [h, h, h], [h, h, -h]] },
    { normal: [0, -1, 0], verts: [[-h, -h, -h], [h, -h, -h], [h, -h, h], [-h, -h, h]] },
    { normal: [1, 0, 0], verts: [[h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h]] },
    { normal: [-1, 0, 0], verts: [[-h, -h, -h], [-h, -h, h], [-h, h, h], [-h, h, -h]] },
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let base = 0;

  for (const { normal, verts } of faces) {
    for (const v of verts) {
      positions.push(...v);
      normals.push(...normal);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    base += 4;
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}

describe('Cube', () => {
  it('should render a cube centered on the canvas', async () => {
    const app = new App();

    let $canvas: HTMLCanvasElement;
    let canvasEntity: Entity | undefined;
    let cameraEntity: Entity | undefined;
    let cubeEntity: Entity | undefined;

    const MyPlugin: Plugin = () => {
      system(PreStartUp)(StartUpSystem);
      system((s) => s.before(ComputeZIndex))(StartUpSystem);
    };

    class StartUpSystem extends System {
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

        const { positions, normals, indices } = createCubeGeometry(1);

        // 独立 3D 快照：用透视相机 + 世界原点处的 cube。
        // linked 模式要用画布坐标，且需与 2D 相机 pan 对齐（见 main.ts 的 [100,100,40]）；
        // 此处 2D 相机在 (100,100)，若 cube 放在 (0,0) 会被 2D VP 裁到视口外。
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
