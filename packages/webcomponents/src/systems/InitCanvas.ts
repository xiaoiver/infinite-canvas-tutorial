import {
  Camera,
  Canvas,
  Children,
  Circle,
  Commands,
  Cursor,
  Ellipse,
  FillGradient,
  FillSolid,
  Name,
  Parent,
  Path,
  Polyline,
  Rect,
  Renderable,
  Stroke,
  System,
  Text,
  Transform,
  Visibility,
} from '@infinite-canvas-tutorial/ecs';
import { Container } from '../components';
import { Event } from '../event';
import { API, pendingCanvases } from '../API';
import { InfiniteCanvas } from '../spectrum/infinite-canvas';

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
          Name,
          Cursor,
          Transform,
          Parent,
          Children,
          Renderable,
          Visibility,
          FillSolid,
          FillGradient,
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
        (container as InfiniteCanvas).apiProvider.setValue(api);

        api.createCanvas(canvas);
        api.createCamera(camera);

        api.getAppState = (container as InfiniteCanvas).getAppState.bind(
          container,
        );
        api.setAppState = (container as InfiniteCanvas).setAppState.bind(
          container,
        );
        api.getNodes = (container as InfiniteCanvas).getNodes.bind(container);
        api.setNodes = (container as InfiniteCanvas).setNodes.bind(container);

        this.commands.execute();

        container.dispatchEvent(new CustomEvent(Event.READY, { detail: api }));
      });
      pendingCanvases.length = 0;
    }
  }
}
