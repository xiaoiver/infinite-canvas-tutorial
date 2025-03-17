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
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '../src';

const canvas = document.querySelector('ic-canvas')!;

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
      ).write,
  );

  cameras = this.query((q) => q.added.with(Camera));

  parentEntity: Entity;

  initialize(): void {
    const parent = this.commands.spawn(
      new Transform(),
      new Renderable(),
      new FillSolid('red'),
      new Circle({ cx: 100, cy: 100, r: 100 }),
    );
    this.parentEntity = parent.id().hold();

    this.commands.execute();
  }

  execute(): void {
    this.cameras.added.forEach((camera) => {
      this.commands
        .entity(camera)
        .appendChild(this.commands.entity(this.parentEntity));

      this.commands.execute();
    });
  }
}
