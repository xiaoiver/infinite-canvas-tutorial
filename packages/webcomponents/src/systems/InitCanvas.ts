import {
  Camera,
  Canvas,
  Children,
  Circle,
  Commands,
  Cursor,
  Ellipse,
  FillSolid,
  Parent,
  Path,
  Polyline,
  Rect,
  Renderable,
  Stroke,
  System,
  Text,
  Transform,
} from '@infinite-canvas-tutorial/ecs';
import { Container } from '../components';
import { Event } from '../event';
import { API } from '../API';
import { pendingCanvases } from '../spectrum/infinite-canvas';

export class InitCanvasSystem extends System {
  private readonly commands = new Commands(this);

  constructor() {
    super();
    this.query(
      (q) =>
        q.using(
          Container,
          Canvas,
          Camera,
          Cursor,
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

  execute() {
    if (pendingCanvases.length) {
      pendingCanvases.forEach(({ container, canvas, camera }) => {
        const api = new API(container, this.commands);

        // @ts-ignore
        container.api = api;

        api.createCanvas(canvas);
        api.createCamera(camera);

        this.commands.execute();

        container.dispatchEvent(new CustomEvent(Event.READY, { detail: api }));
      });
      pendingCanvases.length = 0;
    }
  }
}
