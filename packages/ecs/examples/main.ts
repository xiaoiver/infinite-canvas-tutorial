import {
  App,
  Entity,
  Commands,
  System,
  StartUp,
  Transform,
  Parent,
  Children,
  DefaultPlugins,
  GlobalTransform,
  Camera,
  Grid,
  Theme,
  CanvasConfig,
  PreStartUp,
  WindowResized,
  Renderable,
  FillSolid,
  Circle,
  Rect,
  DropShadow,
  Stroke,
  Polyline,
  Path,
  Rough,
} from '../src';

const $canvas = document.getElementById('canvas') as HTMLCanvasElement;
const resize = (width: number, height: number) => {
  $canvas.width = width * window.devicePixelRatio;
  $canvas.height = height * window.devicePixelRatio;
  $canvas.style.width = `${width}px`;
  $canvas.style.height = `${height}px`;
  $canvas.style.outline = 'none';
  $canvas.style.padding = '0px';
  $canvas.style.margin = '0px';
};
resize(window.innerWidth, window.innerHeight);

let parentEntity: Entity;
let childEntity: Entity;
let grandchildEntity: Entity;
let polylineEntity: Entity;

class StartUpSystem extends System {
  private readonly commands = new Commands(this);

  q = this.query(
    (q) =>
      q.using(
        CanvasConfig,
        WindowResized,
        // Theme,
        // Grid,
        Camera,
        Parent,
        Children,
        Transform,
        GlobalTransform,
        Renderable,
        FillSolid,
        Stroke,
        DropShadow,
        Circle,
        Rect,
        Polyline,
        Path,
        Rough,
      ).write,
  );

  // w = this.query((q) => q.changed.with(WindowResized).trackWrites);

  initialize(): void {
    Object.assign(this.singleton.write(CanvasConfig), {
      canvas: $canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    });

    const camera = this.commands.spawn(new Camera());

    const parent = this.commands.spawn(
      new Transform(),
      new Renderable(),
      new FillSolid('red'),
      new Circle({ cx: 0, cy: 0, r: 100 }),
    );
    const child = this.commands.spawn(
      new Transform(),
      new Renderable(),
      new FillSolid('green'),
      new Stroke({
        stroke: 'black',
        width: 10,
        alignment: 'center',
        dasharray: [10, 10],
      }),
      new Circle({ cx: 0, cy: 0, r: 50 }),
    );
    parent.appendChild(child);

    const grandchild = this.commands.spawn(
      new Transform(),
      new Renderable(),
      new FillSolid('blue'),
      new DropShadow({
        dropShadowColor: 'rgba(0, 0, 0, 0.5)',
        dropShadowBlurRadius: 10,
        dropShadowOffsetX: 10,
        dropShadowOffsetY: 10,
      }),
      new Rect({ x: 0, y: 0, width: 100, height: 100, cornerRadius: 10 }),
    );
    child.appendChild(grandchild);

    const polyline = this.commands.spawn(
      new Transform({
        translation: { x: 200, y: 200 },
      }),
      new Renderable(),
      new Stroke({
        stroke: 'black',
        width: 10,
        alignment: 'center',
        dasharray: [10, 10],
      }),
      new Polyline({
        points: [
          [0, 0],
          [100, 100],
          [200, 0],
        ],
      }),
    );
    child.appendChild(polyline);

    const path = this.commands.spawn(
      new Transform({
        translation: { x: 200, y: 100 },
      }),
      new Renderable(),
      new Stroke({
        stroke: 'black',
        width: 10,
        alignment: 'center',
        dasharray: [10, 10],
      }),
      new FillSolid('blue'),
      new Path({
        d: 'M 0 0 L 100 100 L 200 0 Z',
      }),
    );
    child.appendChild(path);

    const rough = this.commands.spawn(
      new Transform({
        translation: { x: 200, y: -50 },
      }),
      new Renderable(),
      new FillSolid('blue'),
      new DropShadow({
        dropShadowColor: 'rgba(0, 0, 0, 0.5)',
        dropShadowBlurRadius: 10,
        dropShadowOffsetX: 10,
        dropShadowOffsetY: 10,
      }),
      new Stroke({
        stroke: 'black',
        width: 10,
      }),
      new Rough(),
      new Rect({ x: 0, y: 0, width: 100, height: 100, cornerRadius: 10 }),
    );
    child.appendChild(rough);

    parentEntity = parent.id().hold();
    childEntity = child.id().hold();
    grandchildEntity = grandchild.id().hold();
    polylineEntity = polyline.id().hold();
    this.commands.execute();

    Object.assign(parentEntity.write(Transform), {
      translation: { x: 100, y: 100 },
    });
    childEntity.write(Transform).scale.x = 1;
    grandchildEntity.write(Transform).scale.x = 1;

    window.addEventListener('resize', () => {
      resize(window.innerWidth, window.innerHeight);

      Object.assign(this.singleton.write(WindowResized), {
        width: window.innerWidth,
        height: window.innerHeight,
      });
    });
  }

  execute(): void {
    // this.w.changed.forEach((entity) => {
    //   console.log(entity.read(WindowResized));
    // });
    // expect(parent_entity?.read(Parent).children).toBe([child_entity]);
  }
}

const app = new App()
  .addPlugins(...DefaultPlugins)
  .addSystems(PreStartUp, StartUpSystem)
  .run();
