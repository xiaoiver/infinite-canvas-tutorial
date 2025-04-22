import _gl from 'gl';
import '../useSnapshotMatchers';
import {
  App,
  Camera,
  Canvas,
  Children,
  Circle,
  Commands,
  DOMAdapter,
  DefaultPlugins,
  DefaultStateManagement,
  Entity,
  FillSolid,
  Grid,
  Parent,
  Pen,
  Plugin,
  PreStartUp,
  Renderable,
  Stroke,
  System,
  Theme,
  Transform,
  Visibility,
  system,
  API,
} from '../../packages/ecs/src';
import { NodeJSAdapter, sleep } from '../utils';

DOMAdapter.set(NodeJSAdapter);

describe('Hierarchy', () => {
  it('should create a hierarchy', async () => {
    const app = new App();

    let $canvas: HTMLCanvasElement;
    let canvasEntity: Entity | undefined;
    let cameraEntity: Entity | undefined;
    let parentEntity: Entity | undefined;
    let childEntity: Entity | undefined;

    const MyPlugin: Plugin = () => {
      system(PreStartUp)(StartUpSystem);
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
            Parent,
            Children,
            Transform,
            Renderable,
            FillSolid,
            Stroke,
            Circle,
            Visibility,
          ).write,
      );

      initialize(): void {
        $canvas = DOMAdapter.get().createCanvas(200, 200) as HTMLCanvasElement;

        const api = new API(new DefaultStateManagement(), this.commands);

        const canvas = this.commands.spawn(
          new Canvas({
            element: $canvas,
            width: 200,
            height: 200,
            devicePixelRatio: 1,
            api,
          }),
        );

        const camera = this.commands.spawn(
          new Camera({
            canvas: canvas.id(),
          }),
          new Transform(),
        );

        const parent = this.commands.spawn(
          new Transform(),
          new Renderable(),
          new FillSolid('red'),
          new Circle({ cx: 100, cy: 100, r: 100 }),
          new Visibility(),
        );

        camera.appendChild(parent);

        const child = this.commands.spawn(
          new Transform(),
          new Renderable(),
          new FillSolid('green'),
          new Stroke({
            color: 'black',
            width: 10,
            alignment: 'center',
            dasharray: [10, 10],
          }),
          new Circle({ cx: 100, cy: 100, r: 50 }),
          // new Visibility(),
        );
        parent.appendChild(child);

        canvasEntity = canvas.id().hold();
        cameraEntity = camera.id().hold();
        parentEntity = parent.id().hold();
        childEntity = child.id().hold();

        this.commands.execute();
      }
    }

    app.addPlugins(...DefaultPlugins, MyPlugin);

    await app.run();

    await sleep(300);

    if (canvasEntity && cameraEntity && parentEntity && childEntity) {
      const canvas = canvasEntity.read(Canvas);
      expect(canvas.devicePixelRatio).toBe(1);
      expect(canvas.width).toBe(200);
      expect(canvas.height).toBe(200);
      expect(canvas.renderer).toBe('webgl');
      expect(canvas.cameras).toHaveLength(1);

      const camera = cameraEntity.read(Camera);
      expect(camera.canvas.isSame(canvasEntity)).toBeTruthy();
      expect(cameraEntity.read(Parent).children).toHaveLength(1);
      expect(
        cameraEntity.read(Parent).children[0].isSame(parentEntity),
      ).toBeTruthy();

      const parent = parentEntity.read(Parent);
      expect(parent.children).toHaveLength(1);
      expect(parent.children[0].isSame(childEntity)).toBeTruthy();

      const child = childEntity.read(Children);
      expect(child.parent.isSame(parentEntity)).toBeTruthy();
    }

    const dir = `${__dirname}/snapshots`;
    expect($canvas!.getContext('webgl1')).toMatchWebGLSnapshot(
      dir,
      'hierarchy',
    );

    await app.exit();
  });
});
