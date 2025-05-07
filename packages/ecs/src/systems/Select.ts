import { Entity, System } from '@lastolivegames/becsy';
import { DEG_TO_RAD, RAD_TO_DEG } from '@pixi/math';
import {
  Camera,
  Canvas,
  Children,
  Circle,
  ComputedBounds,
  ComputedCamera,
  Cursor,
  Ellipse,
  FillSolid,
  FractionalIndex,
  Highlighted,
  Input,
  InputPoint,
  Name,
  Opacity,
  Parent,
  Path,
  Pen,
  Polyline,
  RBush,
  Rect,
  Renderable,
  Selected,
  Stroke,
  StrokeAttenuation,
  Text,
  Transform,
  UI,
  UIType,
  Visibility,
  ZIndex,
} from '../components';
import { Commands } from '../commands/Commands';
import { distanceBetweenPoints, inRange } from '../utils';
import { API } from '../API';
import { RenderHighlighter } from './RenderHighlighter';
import { AnchorName } from '..';

enum SelectionMode {
  IDLE,
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

  private readonly renderHighlighter = this.attach(RenderHighlighter);

  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private readonly selected = this.query((q) => q.current.with(Selected).read);
  private readonly highlighted = this.query(
    (q) => q.current.with(Highlighted).read,
  );

  #selectionMode: SelectionMode = SelectionMode.IDLE;

  #resizingAnchorName: AnchorName;

  #selectionBrush: Entity;

  #pointerDownViewportX: number;
  #pointerDownViewportY: number;
  #pointerDownCanvasX: number;
  #pointerDownCanvasY: number;

  #pointerMoveViewportX: number;
  #pointerMoveViewportY: number;
  #pointerMoveCanvasX: number;
  #pointerMoveCanvasY: number;

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(Canvas, ComputedBounds)
          .read.update.and.using(Name)
          .read.and.using(
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
            Circle,
            Ellipse,
            Text,
            Path,
            Polyline,
            Visibility,
            ZIndex,
            StrokeAttenuation,
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

  private handleSelectedMoving(api: API, dx: number, dy: number) {
    this.selected.current.forEach((selected) => {
      // Hide transformer and highlighter
      if (selected.has(Highlighted)) {
        selected.remove(Highlighted);
      }
      const node = api.getNodeByEntity(selected);

      api.updateNodeTransform(node, {
        dx,
        dy,
      });
    });
  }

  private handleSelectedMoved(api: API) {
    api.setNodes(api.getNodes());
    api.record();

    this.selected.current.forEach((selected) => {
      if (!selected.has(Highlighted)) {
        selected.add(Highlighted);
      }
    });
  }

  private handleSelectedResizing(
    api: API,
    dx: number,
    dy: number,
    anchorName: AnchorName,
    lockAspectRatio: boolean,
    centeredScaling: boolean,
  ) {
    this.selected.current.forEach((selected) => {
      // Hide transformer and highlighter
      if (selected.has(Highlighted)) {
        selected.remove(Highlighted);
      }
      const node = api.getNodeByEntity(selected);

      const { x, y, width, height } = api.getNodeTransform(node);
      node.lockAspectRatio = lockAspectRatio;

      if (anchorName === AnchorName.BOTTOM_RIGHT) {
        api.updateNodeTransform(node, {
          width: width + dx,
          height: height + dy,
        });
      } else if (anchorName === AnchorName.TOP_LEFT) {
        api.updateNodeTransform(node, {
          x: x + dx,
          y: y + dy,
          width: width - dx,
          height: height - dy,
        });
      } else if (anchorName === AnchorName.TOP_RIGHT) {
        api.updateNodeTransform(node, {
          x,
          y: y + dy,
          width: width + dx,
          height: height - dy,
        });
      } else if (anchorName === AnchorName.BOTTOM_LEFT) {
        api.updateNodeTransform(node, {
          x: x + dx,
          y,
          width: width - dx,
          height: height + dy,
        });
      }
    });
  }

  private handleSelectedResized(api: API) {
    api.setNodes(api.getNodes());
    api.record();

    this.selected.current.forEach((selected) => {
      if (!selected.has(Highlighted)) {
        selected.add(Highlighted);
      }
    });
  }

  private handleBrushing(api: API, viewportX: number, viewportY: number) {
    // Use a threshold to avoid showing the selection brush when the pointer is moved a little.
    const shouldShowSelectionBrush =
      distanceBetweenPoints(
        viewportX,
        viewportY,
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
            new StrokeAttenuation(),
          )
          .id()
          .hold();

        const camera = this.commands.entity(api.getCamera());
        camera.appendChild(this.commands.entity(this.#selectionBrush));

        this.commands.execute();
      }

      this.#selectionBrush.write(Visibility).value = 'visible';

      const { x: wx, y: wy } = api.viewport2Canvas({
        x: viewportX,
        y: viewportY,
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

      if (input.pointerDownTrigger) {
        const [x, y] = input.pointerViewport;
        this.#pointerDownViewportX = x;
        this.#pointerDownViewportY = y;

        const { x: wx, y: wy } = api.viewport2Canvas({
          x,
          y,
        });
        this.#pointerDownCanvasX = wx;
        this.#pointerDownCanvasY = wy;

        const entities = api.elementsFromBBox(wx, wy, wx, wy);
        const topmost = entities[0];
        const topmostNonUI = entities.find((e) => !e.has(UI));

        // Click and hold on an empty part of the canvas.
        if (!topmost) {
          this.#selectionMode = SelectionMode.BRUSH;
        } else if (!topmost.has(UI)) {
          if (input.shiftKey) {
            // TODO: multiple selection
            this.#selectionMode = SelectionMode.MULTIPLE;
          } else {
            this.#selectionMode = SelectionMode.SINGLE;
          }
        } else {
          const { type } = topmost.read(UI);
          if (type === UIType.TRANSFORMER_MASK || type === UIType.HIGHLIGHTER) {
            if (topmostNonUI && !topmostNonUI.has(Selected)) {
              this.#selectionMode = SelectionMode.SINGLE;
            } else {
              this.#selectionMode = SelectionMode.MOVE;
            }
          } else if (type === UIType.TRANSFORMER_ANCHOR) {
            this.#resizingAnchorName = topmost.read(Name).value as AnchorName;
            this.#selectionMode = SelectionMode.RESIZE;
          }
        }
      }

      if (entity.has(ComputedCamera) && inputPoints.length === 0) {
        const [x, y] = input.pointerViewport;
        if (
          this.#pointerMoveViewportX === x &&
          this.#pointerMoveViewportY === y
        ) {
          return;
        }
        this.#pointerMoveViewportX = x;
        this.#pointerMoveViewportY = y;
        if (
          this.#selectionMode === SelectionMode.SINGLE ||
          this.#selectionMode === SelectionMode.IDLE
        ) {
          const transformer = this.getTopmostEntity(api, x, y, (e) =>
            e.has(UI),
          );
          if (transformer) {
            const { type } = transformer.read(UI);
            if (type === UIType.TRANSFORMER_MASK) {
              // TODO: top-center anchor
              cursor.value = 'default';
            } else if (type === UIType.TRANSFORMER_ANCHOR) {
              const { value } = transformer.read(Name);
              cursor.value = getCursor(value, 0);
            }
          } else {
            cursor.value = 'default';
          }
        }
        const toHighlight = this.getTopmostEntity(api, x, y, (e) => !e.has(UI));
        if (toHighlight && toHighlight.alive) {
          if (
            this.highlighted.current[0] &&
            this.highlighted.current[0] !== toHighlight
          ) {
            this.highlighted.current[0].remove(Highlighted);
          }
          if (!toHighlight.has(Highlighted)) {
            toHighlight.add(Highlighted);
            cursor.value = 'default';
          }
        }
      } else {
        // Dragging
        inputPoints.forEach((point) => {
          const inputPoint = point.write(InputPoint);
          const {
            prevPoint: [prevX, prevY],
          } = inputPoint;
          const [x, y] = input.pointerViewport;

          if (prevX === x && prevY === y) {
            return;
          }

          const { x: sx, y: sy } = api.viewport2Canvas({
            x: prevX,
            y: prevY,
          });
          const { x: ex, y: ey } = api.viewport2Canvas({
            x,
            y,
          });
          const dx = ex - sx;
          const dy = ey - sy;

          if (this.#selectionMode === SelectionMode.BRUSH) {
            this.handleBrushing(api, x, y);
          } else if (this.#selectionMode === SelectionMode.MOVE) {
            this.handleSelectedMoving(api, dx, dy);
          } else if (this.#selectionMode === SelectionMode.RESIZE) {
            this.handleSelectedResizing(
              api,
              dx,
              dy,
              this.#resizingAnchorName,
              input.shiftKey,
              input.altKey,
            );
          }

          inputPoint.prevPoint = input.pointerViewport;
        });
      }

      if (input.pointerUpTrigger) {
        this.highlighted.current.forEach((e) => {
          e.remove(Highlighted);
        });

        const [x, y] = input.pointerViewport;

        this.#pointerDownViewportX = undefined;
        this.#pointerDownViewportY = undefined;
        this.#pointerDownCanvasX = undefined;
        this.#pointerDownCanvasY = undefined;

        if (this.#selectionMode === SelectionMode.BRUSH) {
          if (this.#selectionBrush) {
            this.#selectionBrush.write(Visibility).value = 'hidden';
          }
          api.selectNodes([]);
          // TODO: Apply selection
        } else if (this.#selectionMode === SelectionMode.SINGLE) {
          // Single selection
          const toSelect = this.getTopmostEntity(api, x, y, (e) => !e.has(UI));
          if (toSelect) {
            const selected = api.getNodeByEntity(toSelect);
            if (selected) {
              api.selectNodes([selected]);
            }
          }
        } else if (this.#selectionMode === SelectionMode.MOVE) {
          // move the object and commit the changes
          this.handleSelectedMoved(api);
        } else if (this.#selectionMode === SelectionMode.RESIZE) {
          this.handleSelectedResized(api);
        }

        this.#selectionMode = SelectionMode.IDLE;
      }
    });
  }
}

const ANGLES = {
  'top-left': -45,
  'top-center': 0,
  'top-right': 45,
  'middle-right': -90,
  'middle-left': 90,
  'bottom-left': -135,
  'bottom-center': 180,
  'bottom-right': 135,
};

function getCursor(anchorName: string, rad: number) {
  rad += DEG_TO_RAD * (ANGLES[anchorName] || 0);
  const angle = (((RAD_TO_DEG * rad) % 360) + 360) % 360;

  if (inRange(angle, 315 + 22.5, 360) || inRange(angle, 0, 22.5)) {
    // TOP
    return 'ns-resize';
  } else if (inRange(angle, 45 - 22.5, 45 + 22.5)) {
    // TOP - RIGHT
    return 'nesw-resize';
  } else if (inRange(angle, 90 - 22.5, 90 + 22.5)) {
    // RIGHT
    return 'ew-resize';
  } else if (inRange(angle, 135 - 22.5, 135 + 22.5)) {
    // BOTTOM - RIGHT
    return 'nwse-resize';
  } else if (inRange(angle, 180 - 22.5, 180 + 22.5)) {
    // BOTTOM
    return 'ns-resize';
  } else if (inRange(angle, 225 - 22.5, 225 + 22.5)) {
    // BOTTOM - LEFT
    return 'nesw-resize';
  } else if (inRange(angle, 270 - 22.5, 270 + 22.5)) {
    // RIGHT
    return 'ew-resize';
  } else if (inRange(angle, 315 - 22.5, 315 + 22.5)) {
    // BOTTOM - RIGHT
    return 'nwse-resize';
  }
}
