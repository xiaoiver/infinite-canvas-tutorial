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
import { distanceBetweenPoints } from '../utils';
export class Select extends System {
  private viewportCulling = this.attach(ViewportCulling);
  private cameraControl = this.attach(CameraControl);

  private readonly commands = new Commands(this);

  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  #selectionBrush: Entity;

  #pointerDownViewportX: number;
  #pointerDownViewportY: number;
  #pointerDownCanvasX: number;
  #pointerDownCanvasY: number;

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
      const { inputPoints, api } = canvas.read(Canvas);
      const pen = api.getAppState().penbarSelected[0];

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
        this.createEntity(InputPoint, {
          prevPoint: input.pointerViewport,
          canvas,
        });

        const [x, y] = input.pointerViewport;
        this.#pointerDownViewportX = x;
        this.#pointerDownViewportY = y;

        const { x: wx, y: wy } = this.cameraControl.viewport2Canvas(entity, {
          x,
          y,
        });
        this.#pointerDownCanvasX = wx;
        this.#pointerDownCanvasY = wy;

        // Single selection
        const entities = this.viewportCulling.elementsFromBBox(
          entity,
          wx,
          wy,
          wx,
          wy,
        );

        const selectedIds = [];
        if (entities.length > 0 && !entities[0].has(UI)) {
          const selected = api.getNodeByEntity(entities[0]);
          selectedIds.push(selected.id);
        }
        api.selectNodes(selectedIds);
      }

      inputPoints.forEach((point) => {
        const inputPoint = point.write(InputPoint);
        const [x, y] = input.pointerViewport;

        if (inputPoint.prevPoint[0] === x && inputPoint.prevPoint[1] === y) {
          return;
        }

        // Use a threshold to avoid showing the selection brush when the pointer is moved a little.
        const shouldShowSelectionBrush =
          distanceBetweenPoints(
            x,
            y,
            this.#pointerDownViewportX,
            this.#pointerDownViewportY,
          ) > 10;

        if (shouldShowSelectionBrush) {
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

          this.#selectionBrush.write(Visibility).value = 'visible';

          const { x: wx, y: wy } = this.cameraControl.viewport2Canvas(entity, {
            x,
            y,
          });

          Object.assign(this.#selectionBrush.write(Rect), {
            x: this.#pointerDownCanvasX,
            y: this.#pointerDownCanvasY,
            width: wx - this.#pointerDownCanvasX,
            height: wy - this.#pointerDownCanvasY,
          });
        }

        inputPoint.prevPoint = input.pointerViewport;
      });

      if (input.pointerUpTrigger) {
        for (const point of inputPoints) {
          point.delete();
        }

        if (this.#selectionBrush) {
          this.#selectionBrush.write(Visibility).value = 'hidden';
        }

        this.#pointerDownViewportX = undefined;
        this.#pointerDownViewportY = undefined;
        this.#pointerDownCanvasX = undefined;
        this.#pointerDownCanvasY = undefined;
      }
    });
  }
}
