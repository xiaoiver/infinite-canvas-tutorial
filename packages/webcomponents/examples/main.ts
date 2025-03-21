import {
  App,
  System,
  Commands,
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
  PreStartUp,
  CameraControl,
  Select,
  DefaultPlugins,
} from '@infinite-canvas-tutorial/ecs';
import { Event, UIPlugin } from '../src';
// import '../src/shoelace';
// import { InitCanvasSystem } from '../src/systems/InitCanvas';
import '../src/spectrum';

// app.run();

{
  const MyPlugin = () => {
    return [StartUpSystem];
  };
  // const canvas = document.querySelector('ic-shoelace-canvas')!;
  const canvas = document.querySelector('#canvas1')!;

  // canvas.addEventListener(Event.READY, (e) => {
  //   const canvas = e.detail;
  //   console.log(canvas);
  // });

  const app = new App().addPlugins(...DefaultPlugins, UIPlugin, MyPlugin);
  app.run();

  class StartUpSystem extends System {
    private readonly commands = new Commands(this);

    constructor() {
      super();
      this.schedule((s) => s.before(PreStartUp));
      this.query(
        (q) =>
          q.using(
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
    }

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
    }

    execute(): void {
      this.cameras.added.forEach((camera) => {
        // const $canvas = camera.read(Camera).canvas.read(Canvas).element;
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
}

// {
//   const canvas = document.querySelector('#canvas2')!;

//   canvas.addEventListener(Event.READY, (e) => {
//     const app = e.detail;
//     app.addSystems(PreStartUp, StartUpSystem);
//   });

//   class StartUpSystem extends System {
//     private readonly commands = new Commands(this);

//     q = this.query(
//       (q) =>
//         q.using(
//           Camera,
//           Transform,
//           Parent,
//           Children,
//           Renderable,
//           FillSolid,
//           Stroke,
//           Circle,
//           Ellipse,
//           Rect,
//           Polyline,
//           Path,
//           Text,
//         ).write,
//     );

//     cameras = this.query((q) => q.added.with(Camera));

//     entities: Entity[];

//     $svg: SVGSVGElement;

//     async prepare() {
//       const res = await fetch('/maslow-hierarchy.svg');
//       const svg = await res.text();

//       // TODO: extract semantic groups inside comments
//       const $container = document.createElement('div');
//       $container.innerHTML = svg;
//       this.$svg = $container.children[0] as SVGSVGElement;
//     }

//     initialize(): void {
//       const nodes = svgElementsToSerializedNodes(
//         Array.from(this.$svg.children) as SVGElement[],
//         0,
//         [],
//         undefined,
//       );
//       console.log(nodes);

//       this.entities = serializedNodesToEntities(nodes, this.commands);
//       this.commands.execute();
//     }

//     execute(): void {
//       this.cameras.added.forEach((camera) => {
//         this.entities.forEach((entity) => {
//           if (!entity.has(Children)) {
//             this.commands
//               .entity(camera)
//               .appendChild(this.commands.entity(entity));
//           }
//         });
//         this.commands.execute();
//       });
//     }
//   }
// }
