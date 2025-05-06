import { Entity, System } from '@lastolivegames/becsy';
import {
  Camera,
  Canvas,
  Children,
  ComputedBounds,
  ComputedCamera,
  Cursor,
  FillSolid,
  FractionalIndex,
  Highlighted,
  Input,
  InputPoint,
  Opacity,
  Parent,
  Pen,
  RBush,
  Rect,
  Renderable,
  Selected,
  Stroke,
  Transform,
  UI,
  UIType,
  Visibility,
  ZIndex,
} from '../components';
import { Commands } from '../commands/Commands';
import { distanceBetweenPoints } from '../utils';
import { API } from '../API';

enum SelectionMode {
  BRUSH,
  SINGLE,
  MULTIPLE,
  MOVE,
  RESIZE,
}

/**
 * * Click to select individual object. Hold `Shift` and click on another object to select multiple objects.
 * * Brush(marquee) to select multiple objects.
 * @see https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects
 */
export class Select extends System {
  private readonly commands = new Commands(this);

  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private readonly selected = this.query((q) => q.current.with(Selected).read);
  private readonly highlighted = this.query(
    (q) => q.current.with(Highlighted).read,
  );

  #selectionMode: SelectionMode;

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
          .using(Canvas, ComputedBounds)
          .read.update.using(
            InputPoint,
            Input,
            Cursor,
            Camera,
            UI,
            Selected,
            Highlighted,
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
    this.query((q) => q.using(ComputedCamera, FractionalIndex, RBush).read);
  }

  private getTopmostEntity(
    api: API,
    x: number,
    y: number,
    selector: (e: Entity) => boolean,
  ) {
    const { x: wx, y: wy } = api.viewport2Canvas({
      x,
      y,
    });
    const entities = api.elementsFromBBox(wx, wy, wx, wy);

    return entities.find(selector);
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
          this.#selectionBrush = undefined;
        }

        // Clear selection
        api.selectNodes([]);

        this.highlighted.current.forEach((e) => {
          e.remove(Highlighted);
        });

        return;
      }

      const input = canvas.write(Input);
      const cursor = canvas.write(Cursor);

      cursor.value = 'default';

      if (input.pointerDownTrigger) {
        const [x, y] = input.pointerViewport;
        const topmost = this.getTopmostEntity(api, x, y, (e) => !e.has(UI));

        // Click and hold on an empty part of the canvas.
        if (!topmost) {
          this.#selectionMode = SelectionMode.BRUSH;
          this.#pointerDownViewportX = x;
          this.#pointerDownViewportY = y;

          const { x: wx, y: wy } = api.viewport2Canvas({
            x,
            y,
          });
          this.#pointerDownCanvasX = wx;
          this.#pointerDownCanvasY = wy;
        } else if (topmost.has(Selected)) {
          // TODO: Click on a UI element, resize or move the object later
          this.#selectionMode = SelectionMode.MOVE;
        } else {
          if (input.shiftKey) {
            // TODO: multiple selection
          } else {
            this.#selectionMode = SelectionMode.SINGLE;
          }
        }
      }

      if (entity.has(ComputedCamera) && inputPoints.length === 0) {
        this.highlighted.current.forEach((e) => {
          e.remove(Highlighted);
        });

        // TODO: display to select hint when hover
        const [x, y] = input.pointerViewport;
        const toHighlight = this.getTopmostEntity(api, x, y, (e) => !e.has(UI));
        if (toHighlight) {
          toHighlight.add(Highlighted);
          // cursor.value = 'nw-resize';
        }
      }

      inputPoints.forEach((point) => {
        const inputPoint = point.write(InputPoint);
        const [x, y] = input.pointerViewport;

        if (inputPoint.prevPoint[0] === x && inputPoint.prevPoint[1] === y) {
          return;
        }

        if (this.#selectionMode === SelectionMode.MOVE) {
          // TODO: move the object
        } else if (this.#selectionMode === SelectionMode.BRUSH) {
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
                  new UI(UIType.BRUSH),
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

            const { x: wx, y: wy } = api.viewport2Canvas({
              x,
              y,
            });

            Object.assign(this.#selectionBrush.write(Rect), {
              x: this.#pointerDownCanvasX,
              y: this.#pointerDownCanvasY,
              width: wx - this.#pointerDownCanvasX,
              height: wy - this.#pointerDownCanvasY,
            });

            // TODO: multiple selection
          }
        }

        inputPoint.prevPoint = input.pointerViewport;
      });

      if (input.pointerUpTrigger) {
        this.highlighted.current.forEach((e) => {
          e.remove(Highlighted);
        });

        if (this.#selectionBrush) {
          this.#selectionBrush.write(Visibility).value = 'hidden';
        }

        const [x, y] = input.pointerViewport;

        if (this.#selectionMode === SelectionMode.BRUSH) {
          api.selectNodes([]);

          this.#pointerDownViewportX = undefined;
          this.#pointerDownViewportY = undefined;
          this.#pointerDownCanvasX = undefined;
          this.#pointerDownCanvasY = undefined;
        } else if (this.#selectionMode === SelectionMode.SINGLE) {
          // Single selection
          const toSelect = this.getTopmostEntity(api, x, y, (e) => !e.has(UI));

          if (!toSelect) {
            // Clear selection
            api.selectNodes([]);
          } else {
            const selected = api.getNodeByEntity(toSelect);
            api.selectNodes([selected]);
          }
        }
      }
    });
  }
}
