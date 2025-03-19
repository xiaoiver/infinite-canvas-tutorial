import {
  System,
  Commands,
  PreStartUp,
  Parent,
  Children,
  Transform,
  Renderable,
  FillSolid,
  Stroke,
  Circle,
  Camera,
  Entity,
  svgElementsToSerializedNodes,
  serializedNodesToEntities,
  Ellipse,
  Path,
  Polyline,
  Rect,
  Text,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '../src';
// import '../src/shoelace';
import '../src/spectrum';

// const canvas = document.querySelector('ic-shoelace-canvas')!;
const canvas = document.querySelector('ic-spectrum-canvas')!;

canvas.addEventListener(Event.READY, (e) => {
  const app = e.detail;
  app.addSystems(PreStartUp, StartUpSystem);
});

canvas.addEventListener(Event.RESIZED, (e) => {
  console.log('resized', e.detail);
});

class StartUpSystem extends System {
  private readonly commands = new Commands(this);

  q = this.query(
    (q) =>
      q.using(
        Camera,
        Transform,
        Parent,
        Children,
        Renderable,
        FillSolid,
        Stroke,
        Circle,
        Ellipse,
        Rect,
        Polyline,
        Path,
        Text,
      ).write,
  );

  cameras = this.query((q) => q.added.with(Camera));

  entities: Entity[];

  $svg: SVGSVGElement;

  async prepare() {
    const res = await fetch('/maslow-hierarchy.svg');
    const svg = await res.text();

    // TODO: extract semantic groups inside comments
    const $container = document.createElement('div');
    $container.innerHTML = svg;
    this.$svg = $container.children[0] as SVGSVGElement;
  }

  initialize(): void {
    const nodes = svgElementsToSerializedNodes(
      Array.from(this.$svg.children) as SVGElement[],
      0,
      [],
      undefined,
    );
    console.log(nodes);

    this.entities = serializedNodesToEntities(nodes, this.commands);
    this.commands.execute();

    // <group>
    // const root = this.commands.spawn(
    //   new Transform({
    //     translation: {
    //       x: 100,
    //       y: 100,
    //     },
    //   }),
    // );
    // this.rootEntity = root.id().hold();

    // // <circle>
    // const parent = this.commands.spawn(
    //   new Transform(),
    //   new Renderable(),
    //   new FillSolid('red'),
    //   new Circle({ cx: 0, cy: 0, r: 100 }),
    // );
    // this.parentEntity = parent.id().hold();

    // root.appendChild(parent);

    // this.commands.execute();
  }

  execute(): void {
    this.cameras.added.forEach((camera) => {
      this.entities.forEach((entity) => {
        if (!entity.has(Children)) {
          this.commands
            .entity(camera)
            .appendChild(this.commands.entity(entity));
        }
      });
      this.commands.execute();
    });
  }
}
