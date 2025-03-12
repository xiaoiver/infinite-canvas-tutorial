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
        Circle,
      ).write,
  );
  q2 = this.query((q) => q.current.with(Parent).read);

  // w = this.query((q) => q.changed.with(WindowResized).trackWrites);
  w = this.singleton.read(WindowResized);

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
      new FillSolid(),
      new Circle({ cx: 100, cy: 100, r: 100 }),
    );
    const child = this.commands.spawn(new Transform());
    parent.appendChild(child.id());

    const grandchild = this.commands.spawn(new Transform());
    child.appendChild(grandchild.id());

    parentEntity = parent.id().hold();
    childEntity = child.id().hold();
    grandchildEntity = grandchild.id().hold();
    this.commands.execute();

    parentEntity.write(Transform).scale.x = 2;
    childEntity.write(Transform).scale.x = 3;
    grandchildEntity.write(Transform).scale.x = 4;

    window.addEventListener('resize', () => {
      resize(window.innerWidth, window.innerHeight);

      Object.assign(this.singleton.write(WindowResized), {
        width: window.innerWidth,
        height: window.innerHeight,
      });
    });
  }

  execute(): void {
    // expect(parent_entity?.read(Parent).children).toBe([child_entity]);
  }
}

const app = new App()
  .addPlugins(...DefaultPlugins)
  .addSystems(PreStartUp, StartUpSystem)
  .run();
