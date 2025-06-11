import {
  Camera,
  Canvas,
  Children,
  Circle,
  Commands,
  ComputedCamera,
  Cursor,
  DropShadow,
  Ellipse,
  FillGradient,
  FillSolid,
  Grid,
  Name,
  Opacity,
  Parent,
  Path,
  Polyline,
  Rect,
  Renderable,
  Selected,
  Stroke,
  System,
  Text,
  Transform,
  Visibility,
  ZIndex,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '../event';
import { ExtendedAPI, pendingCanvases } from '../API';
import { LitStateManagement } from '../context';
import { InfiniteCanvas } from '../spectrum/infinite-canvas';

export class InitCanvas extends System {
  private readonly commands = new Commands(this);

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(ComputedCamera)
          .read.and.using(
            Canvas,
            Camera,
            Grid,
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
            Selected,
            Opacity,
            DropShadow,
            ZIndex,
          ).write,
    );
  }

  execute() {
    if (pendingCanvases.length) {
      pendingCanvases.forEach(({ container, canvas, camera }) => {
        const { appStateProvider, nodesProvider, apiProvider } =
          container as InfiniteCanvas;

        const stateManagement = new LitStateManagement(
          appStateProvider,
          nodesProvider,
        );
        const api = new ExtendedAPI(stateManagement, this.commands, container);
        apiProvider.setValue(api);

        api.createCanvas({ ...canvas, api });
        api.createCamera(camera);

        this.commands.execute();

        container.dispatchEvent(new CustomEvent(Event.READY, { detail: api }));
      });
      pendingCanvases.length = 0;
    }
  }
}
