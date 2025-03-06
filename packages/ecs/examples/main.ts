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

let parent_entity: Entity;
let child_entity: Entity;
let grandchild_entity: Entity;

class StartUpSystem extends System {
  commands = new Commands(this);

  q = this.query(
    (q) => q.using(Parent, Children, Transform, GlobalTransform).write,
  );
  q2 = this.query((q) => q.current.with(Parent).read);

  initialize(): void {
    const parent = this.commands.spawn(new Transform());
    const child = this.commands.spawn(new Transform());
    parent.addChild(child.id());

    const grandchild = this.commands.spawn(new Transform());
    child.addChild(grandchild.id());

    parent_entity = parent.id().hold();
    child_entity = child.id().hold();
    grandchild_entity = grandchild.id().hold();
    this.commands.execute();

    parent_entity.write(Transform).scale.x = 2;
    child_entity.write(Transform).scale.x = 3;
  }

  execute(): void {
    // expect(parent_entity?.read(Parent).children).toBe([child_entity]);
  }
}

const app = new App({
  canvas: $canvas,
})
  .addPlugins(...DefaultPlugins)
  .addSystems(StartUp, StartUpSystem)
  .run();

// window.addEventListener('resize', () => {
//   resize(window.innerWidth, window.innerHeight);
//   canvas.resize(window.innerWidth, window.innerHeight);
// });
