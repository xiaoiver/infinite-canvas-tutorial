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
import { createCubeGeometry } from './cube-geometry';

DOMAdapter.set(NodeJSAdapter);

/** @see cube.spec.ts — linked + perspective（与 main.ts 一致） */
describe('Cube perspective', () => {
  it('should render a linked perspective cube at canvas (100, 100)', async () => {
    const app = new App();

    let $canvas: HTMLCanvasElement;
    let cubeEntity: Entity | undefined;

    const MyPlugin: Plugin = () => {
      system(PreStartUp)(LinkedPerspectiveCubeStartUpSystem);
      system((s) => s.before(ComputeZIndex))(LinkedPerspectiveCubeStartUpSystem);
    };

    class LinkedPerspectiveCubeStartUpSystem extends System {
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

        api.createCanvas({
          element: $canvas,
          width: 200,
          height: 200,
          devicePixelRatio: 1,
        });

        api.createCamera({ zoom: 1, x: 0, y: 0 });

        const { positions, normals, indices } = createCubeGeometry(1);

        this.commands.spawn(
          new Camera3D({
            linked: true,
            projection: 'perspective',
            clearColor: true,
          }),
        );

        cubeEntity = this.commands
          .spawn(
            new Mesh3D({ positions, normals, indices }),
            new Material3D({
              baseColor: [1, 1, 1, 1],
              ambient: 0.25,
              diffuse: 0.75,
              specular: 0.4,
              shininess: 48,
            }),
            new Transform3D({
              translation: [100, 100, 40],
              rotation: [0.3, 0.6, 0],
              scale: [100, 100, 100],
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

    expect(cubeEntity?.read(Transform3D).translation).toEqual([100, 100, 40]);

    const dir = `${__dirname}/snapshots`;
    await expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'cube-perspective',
    );

    await app.exit();
  });
});
