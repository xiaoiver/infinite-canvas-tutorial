import { Entity, System } from '@lastolivegames/becsy';
import {
  Camera,
  Canvas,
  Children,
  ComputedCamera,
  Cursor,
  FillSolid,
  FractionalIndex,
  Input,
  InputPoint,
  Opacity,
  Parent,
  Pen,
  Rect,
  Renderable,
  Selected,
  Stroke,
  Transform,
  UI,
  Visibility,
  ZIndex,
} from '../components';
import { Commands } from '../commands/Commands';
import { ViewportCulling } from './ViewportCulling';
import { CameraControl } from './CameraControl';
export class Select extends System {
  private viewportCulling = this.attach(ViewportCulling);
  private cameraControl = this.attach(CameraControl);

  private readonly commands = new Commands(this);

  private readonly cameras = this.query((q) => q.current.with(Camera).read);
  private readonly selected = this.query((q) => q.current.with(Selected).read);

  #selectionBrush: Entity;

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(Canvas)
          .read.update.using(
            InputPoint,
            Input,
            Cursor,
            Camera,
            UI,
            Selected,
            Transform,
            Parent,
            Children,
            Renderable,
            FillSolid,
            Opacity,
            Stroke,
            Rect,
            Visibility,
            ZIndex,
          ).write,
    );
    this.query((q) => q.using(ComputedCamera, FractionalIndex).read);
  }

  execute() {
    this.cameras.current.forEach((entity) => {
      const camera = entity.read(Camera);

      if (!camera.canvas) {
        return;
      }

      const canvas = camera.canvas.hold();
      const { pen, inputPoints } = canvas.read(Canvas);

      if (pen !== Pen.SELECT) {
        if (this.#selectionBrush) {
          // Hide selection brush
          this.#selectionBrush.write(Visibility).value = 'hidden';
        }

        return;
      }

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);

      cursor.value = 'default';

      if (input.pointerDownTrigger) {
        if (!this.#selectionBrush) {
          this.#selectionBrush = this.commands
            .spawn(
              new UI(),
              new Transform(),
              new Renderable(),
              new FillSolid('#e0f2ff'), // --spectrum-blue-100
              new Opacity({ fillOpacity: 0.5 }),
              new Stroke({ width: 1, color: '#147af3' }), // --spectrum-thumbnail-border-color-selected
              new Rect(),
              new Visibility('hidden'),
              new ZIndex(Infinity),
            )
            .id()
            .hold();

          const camera = this.commands.entity(entity);
          camera.appendChild(this.commands.entity(this.#selectionBrush));

          this.commands.execute();
        }

        this.createEntity(InputPoint, {
          prevPoint: input.pointerViewport,
          canvas,
        });

        const [x, y] = input.pointerViewport;
        const { x: wx, y: wy } = this.cameraControl.viewport2Canvas(entity, {
          x,
          y,
        });

        this.#selectionBrush.write(Visibility).value = 'visible';

        Object.assign(this.#selectionBrush.write(Rect), {
          x: wx,
          y: wy,
          width: 0,
          height: 0,
        });

        // Single selection
        const entities = this.viewportCulling.elementsFromBBox(
          entity,
          wx,
          wy,
          wx,
          wy,
        );
        this.selected.current.forEach((entity) => {
          entity.remove(Selected);
        });
        if (entities.length > 0 && !entities[0].has(UI)) {
          entities[0].add(Selected);
        }
      }

      inputPoints.forEach((point) => {
        const inputPoint = point.write(InputPoint);
        const [x, y] = input.pointerViewport;

        if (inputPoint.prevPoint[0] === x && inputPoint.prevPoint[1] === y) {
          return;
        }

        const { x: wx, y: wy } = this.cameraControl.viewport2Canvas(entity, {
          x,
          y,
        });

        const rect = this.#selectionBrush.write(Rect);

        Object.assign(rect, {
          width: wx - rect.x,
          height: wy - rect.y,
        });

        inputPoint.prevPoint = input.pointerViewport;
      });

      if (input.pointerUpTrigger) {
        for (const point of inputPoints) {
          point.delete();
        }
        this.#selectionBrush.write(Visibility).value = 'hidden';
      }
    });
  }
}
