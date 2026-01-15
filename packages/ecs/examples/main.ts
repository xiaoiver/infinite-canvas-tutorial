import {
  App,
  Entity,
  Commands,
  System,
  Transform,
  Parent,
  Children,
  DefaultPlugins,
  GlobalTransform,
  Camera,
  Grid,
  Theme,
  Renderable,
  FillSolid,
  Circle,
  Rect,
  DropShadow,
  Stroke,
  Polyline,
  Path,
  Rough,
  Text,
  Wireframe,
  Opacity,
  Visibility,
  ZIndex,
  Canvas,
  system,
  PreStartUp,
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

let canvasEntity: Entity;
let cameraEntity: Entity;
let parentEntity: Entity;
let childEntity: Entity;
let grandchildEntity: Entity;
let polylineEntity: Entity;

const MyPlugin = () => {
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
        DropShadow,
        Circle,
        Rect,
        Polyline,
        Path,
        Rough,
        Text,
        Wireframe,
        Opacity,
        Visibility,
        ZIndex,
      ).write,
  );

  initialize(): void {
    const canvas = this.commands.spawn(
      new Canvas({
        element: $canvas,
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
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
      new Circle({ cx: 0, cy: 0, r: 100 }),
      new Opacity(),
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
      new Wireframe(true),
      new Circle({ cx: 0, cy: 0, r: 50 }),
      // new Visibility(),
    );
    parent.appendChild(child);

    // const grandchild = this.commands.spawn(
    //   new Transform(),
    //   new Renderable(),
    //   new FillSolid('blue'),
    //   new DropShadow({
    //     color: 'rgba(0, 0, 0, 0.5)',
    //     blurRadius: 10,
    //     offsetX: 10,
    //     offsetY: 10,
    //   }),
    //   new Rect({ x: 0, y: 0, width: 100, height: 100, cornerRadius: 10 }),
    //   new Visibility(),
    // );
    // child.appendChild(grandchild);

    // const polyline = this.commands.spawn(
    //   new Transform({
    //     translation: { x: 200, y: 200 },
    //   }),
    //   new Renderable(),
    //   new Stroke({
    //     color: 'black',
    //     width: 10,
    //     alignment: 'center',
    //     dasharray: [10, 10],
    //   }),
    //   new Polyline({
    //     points: [
    //       [0, 0],
    //       [100, 100],
    //       [200, 0],
    //     ],
    //   }),
    //   new Visibility(),
    // );
    // child.appendChild(polyline);

    // const path = this.commands.spawn(
    //   new Transform({
    //     translation: { x: 200, y: 100 },
    //   }),
    //   new Renderable(),
    //   new Stroke({
    //     color: 'black',
    //     width: 10,
    //     alignment: 'center',
    //     dasharray: [10, 10],
    //   }),
    //   new FillSolid('yellow'),
    //   new Path({
    //     d: 'M 0 0 L 100 100 L 200 0 Z',
    //   }),
    //   new Visibility(),
    // );
    // child.appendChild(path);

    // const rough = this.commands.spawn(
    //   new Transform({
    //     translation: { x: 200, y: -50 },
    //   }),
    //   new Renderable(),
    //   new FillSolid('blue'),
    //   new DropShadow({
    //     color: 'rgba(0, 0, 0, 0.5)',
    //     blurRadius: 10,
    //     offsetX: 10,
    //     offsetY: 10,
    //   }),
    //   new Stroke({
    //     color: 'black',
    //     width: 10,
    //   }),
    //   new Rough(),
    //   new Rect({ x: 0, y: 0, width: 100, height: 100, cornerRadius: 10 }),
    //   new Visibility(),
    // );
    // child.appendChild(rough);

    // const roughCircle = this.commands.spawn(
    //   new Transform(),
    //   new Renderable(),
    //   new FillSolid('green'),
    //   new Stroke({
    //     color: 'black',
    //     width: 10,
    //   }),
    //   new Rough(),
    //   new Circle({ cx: 100, cy: 200, r: 50 }),
    //   new Visibility(),
    // );
    // parent.appendChild(roughCircle);

    // const text = this.commands.spawn(
    //   new Transform(),
    //   new Renderable(),
    //   new FillSolid('black'),
    //   new Text({
    //     x: 100,
    //     y: 300,
    //     content: 'Hello, world!',
    //     fontSize: 24,
    //     fontFamily: 'Arial',
    //   }),
    //   new Visibility(),
    // );
    // parent.appendChild(text);

    canvasEntity = canvas.id().hold();
    cameraEntity = camera.id().hold();
    parentEntity = parent.id().hold();
    childEntity = child.id().hold();
    // grandchildEntity = grandchild.id().hold();
    // polylineEntity = polyline.id().hold();

    this.commands.execute();

    // Object.assign(parentEntity.write(Transform), {
    //   translation: { x: 100, y: 100 },
    // });
    // childEntity.write(Transform).scale.x = 1;
    // grandchildEntity.write(Transform).scale.x = 1;

    // parent.addEventListener('pointerdown', (e) => {
    //   console.log('pointerdown', e);
    // });

    window.addEventListener('resize', () => {
      resize(window.innerWidth, window.innerHeight);

      Object.assign(canvasEntity.write(Canvas), {
        width: window.innerWidth,
        height: window.innerHeight,
      });
    });
  }

  execute(): void {
    // setTimeout(() => {
    // parentEntity.write(Opacity).opacity = 0.5;
    // childEntity.write(Stroke).width = 30;
    // cameraEntity.write(Camera).x = 20;
    // cameraEntity.write(Transform).translation.x = 100;
    // cameraEntity.write(Transform).scale.x = 2;
    // cameraEntity.write(Transform).scale.y = 2;
    // grandchildEntity.write(Transform).rotation = 20;
    // grandchildEntity.write(FillSolid).value = 'grey';
    // }, 1000);
    // expect(parent_entity?.read(Parent).children).toBe([child_entity]);
  }
}

const app = new App().addPlugins(...DefaultPlugins, MyPlugin).run();
