import { Entity, System } from '@lastolivegames/becsy';
import { DEG_TO_RAD, RAD_TO_DEG } from '@pixi/math';
import {
  AABB,
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
import { AnchorName, RenderTransformer } from './RenderTransformer';

enum SelectionMode {
  IDLE = 'IDLE',
  BRUSH = 'BRUSH',
  SINGLE = 'SINGLE',
  MULTIPLE = 'MULTIPLE',
  MOVE = 'MOVE',
  RESIZE = 'RESIZE',
}

/**
 * * Click to select individual object. Hold `Shift` and click on another object to select multiple objects.
 * * Brush(marquee) to select multiple objects.
 * @see https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects
 */
export class Select extends System {
  private readonly commands = new Commands(this);

  private readonly renderHighlighter = this.attach(RenderHighlighter);
  private readonly renderTransformer = this.attach(RenderTransformer);

  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private readonly selected = this.query((q) => q.current.with(Selected).read);
  private readonly highlighted = this.query(
    (q) => q.current.with(Highlighted).read,
  );

  #selectionMode: SelectionMode = SelectionMode.IDLE;

  #resizingAnchorName: AnchorName;
  #sin: number;
  #cos: number;
  #width: number;
  #height: number;

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
    anchorNodeX: number,
    anchorNodeY: number,
    anchorName: AnchorName,
    lockAspectRatio: boolean,
    centeredScaling: boolean,
  ) {
    this.selected.current.forEach((selected) => {
      // Hide transformer and highlighter
      if (selected.has(Highlighted)) {
        selected.remove(Highlighted);
      }
    });

    // FIXME: get transformer for multiple selected nodes
    const transformer = this.renderTransformer.getTransformer(
      this.selected.current[0],
    );
    const [tlAnchor, trAnchor, blAnchor, brAnchor] =
      transformer.read(Parent).children;

    let newHypotenuse: number;

    if (anchorName === AnchorName.TOP_LEFT) {
      Object.assign(tlAnchor.write(Circle), {
        cx: anchorNodeX,
        cy: anchorNodeY,
      });

      if (lockAspectRatio) {
        const comparePoint = centeredScaling
          ? {
              x: this.#width / 2,
              y: this.#height / 2,
            }
          : {
              x: brAnchor.read(Circle).cx,
              y: brAnchor.read(Circle).cy,
            };
        newHypotenuse = Math.sqrt(
          Math.pow(comparePoint.x - anchorNodeX, 2) +
            Math.pow(comparePoint.y - anchorNodeY, 2),
        );

        const { cx, cy } = tlAnchor.read(Circle);
        const reverseX = cx > comparePoint.x ? -1 : 1;
        const reverseY = cy > comparePoint.y ? -1 : 1;

        const x = newHypotenuse * this.#cos * reverseX;
        const y = newHypotenuse * this.#sin * reverseY;

        Object.assign(tlAnchor.write(Circle), {
          cx: comparePoint.x - x,
          cy: comparePoint.y - y,
        });
      }
    } else if (anchorName === AnchorName.TOP_RIGHT) {
      Object.assign(trAnchor.write(Circle), {
        cx: anchorNodeX,
        cy: anchorNodeY,
      });

      if (lockAspectRatio) {
        const comparePoint = centeredScaling
          ? {
              x: this.#width / 2,
              y: this.#height / 2,
            }
          : {
              x: blAnchor.read(Circle).cx,
              y: blAnchor.read(Circle).cy,
            };

        newHypotenuse = Math.sqrt(
          Math.pow(anchorNodeX - comparePoint.x, 2) +
            Math.pow(comparePoint.y - anchorNodeY, 2),
        );

        const { cx, cy } = trAnchor.read(Circle);
        const reverseX = cx < comparePoint.x ? -1 : 1;
        const reverseY = cy > comparePoint.y ? -1 : 1;

        const x = newHypotenuse * this.#cos * reverseX;
        const y = newHypotenuse * this.#sin * reverseY;

        Object.assign(trAnchor.write(Circle), {
          cx: comparePoint.x + x,
          cy: comparePoint.y - y,
        });
      }

      tlAnchor.write(Circle).cy = trAnchor.read(Circle).cy;
      brAnchor.write(Circle).cx = trAnchor.read(Circle).cx;
    } else if (anchorName === AnchorName.BOTTOM_LEFT) {
      Object.assign(blAnchor.write(Circle), {
        cx: anchorNodeX,
        cy: anchorNodeY,
      });

      if (lockAspectRatio) {
        const comparePoint = centeredScaling
          ? {
              x: this.#width / 2,
              y: this.#height / 2,
            }
          : {
              x: trAnchor.read(Circle).cx,
              y: trAnchor.read(Circle).cy,
            };

        newHypotenuse = Math.sqrt(
          Math.pow(comparePoint.x - anchorNodeX, 2) +
            Math.pow(anchorNodeY - comparePoint.y, 2),
        );

        const reverseX = comparePoint.x < anchorNodeX ? -1 : 1;

        const reverseY = anchorNodeY < comparePoint.y ? -1 : 1;

        const x = newHypotenuse * this.#cos * reverseX;
        const y = newHypotenuse * this.#sin * reverseY;

        Object.assign(blAnchor.write(Circle), {
          cx: comparePoint.x - x,
          cy: comparePoint.y + y,
        });
      }

      tlAnchor.write(Circle).cx = blAnchor.read(Circle).cx;
      brAnchor.write(Circle).cy = blAnchor.read(Circle).cy;
    } else if (anchorName === AnchorName.BOTTOM_RIGHT) {
      Object.assign(brAnchor.write(Circle), {
        cx: anchorNodeX,
        cy: anchorNodeY,
      });

      if (lockAspectRatio) {
        const comparePoint = centeredScaling
          ? {
              x: this.#width / 2,
              y: this.#height / 2,
            }
          : {
              x: tlAnchor.read(Circle).cx,
              y: tlAnchor.read(Circle).cy,
            };

        newHypotenuse = Math.sqrt(
          Math.pow(anchorNodeX - comparePoint.x, 2) +
            Math.pow(anchorNodeY - comparePoint.y, 2),
        );

        const reverseX = anchorNodeX < comparePoint.x ? -1 : 1;
        const reverseY = anchorNodeY < comparePoint.y ? -1 : 1;

        const x = newHypotenuse * this.#cos * reverseX;
        const y = newHypotenuse * this.#sin * reverseY;

        Object.assign(brAnchor.write(Circle), {
          cx: comparePoint.x + x,
          cy: comparePoint.y + y,
        });
      }
    } else if (anchorName === AnchorName.TOP_CENTER) {
      tlAnchor.write(Circle).cy = anchorNodeY;
    } else if (anchorName === AnchorName.BOTTOM_CENTER) {
      brAnchor.write(Circle).cy = anchorNodeY;
    } else if (anchorName === AnchorName.MIDDLE_LEFT) {
      tlAnchor.write(Circle).cx = anchorNodeX;
    } else if (anchorName === AnchorName.MIDDLE_RIGHT) {
      brAnchor.write(Circle).cx = anchorNodeX;
    }

    // if (centeredScaling) {
    //   const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
    //   const { cx: brCx, cy: brCy } = brAnchor.read(Circle);

    //   const topOffsetX = tlCx;
    //   const topOffsetY = tlCy;

    //   const bottomOffsetX = this.#width - brCx;
    //   const bottomOffsetY = this.#height - brCy;

    //   Object.assign(brAnchor.write(Circle), {
    //     cx: brCx - topOffsetX,
    //     cy: brCy - topOffsetY,
    //   });

    //   {
    //     const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
    //     Object.assign(tlAnchor.write(Circle), {
    //       cx: tlCx + bottomOffsetX,
    //       cy: tlCy + bottomOffsetY,
    //     });
    //   }
    // }

    const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
    const { cx: brCx, cy: brCy } = brAnchor.read(Circle);
    this.fitSelected(api, tlCx, tlCy, brCx - tlCx, brCy - tlCy);
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
            const { minX, minY, maxX, maxY } = this.getSelectedAABB();
            const width = maxX - minX;
            const height = maxY - minY;
            const hypotenuse = Math.sqrt(
              Math.pow(width, 2) + Math.pow(height, 2),
            );
            this.#sin = Math.abs(height / hypotenuse);
            this.#cos = Math.abs(width / hypotenuse);
            this.#width = width;
            this.#height = height;

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
              // TODO: rotation
              cursor.value = getCursor(value, 0);
            }
          } else {
            cursor.value = 'default';
          }
        }
        const toHighlight = this.getTopmostEntity(api, x, y, (e) => !e.has(UI));
        if (toHighlight) {
          this.highlighted.current.forEach((e) => {
            e.remove(Highlighted);
          });
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
              ex,
              ey,
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

  private getSelectedAABB() {
    const bounds = new AABB();
    this.selected.current.forEach((selected) => {
      const { geometryBounds } = selected.read(ComputedBounds);
      const { minX, minY, maxX, maxY } = geometryBounds;

      bounds.addFrame(minX, minY, maxX, maxY);
    });
    return bounds;
  }

  private fitSelected(
    api: API,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    // TODO: calculate all selected nodes' transform
    // TODO: update transformer immediately
    const node = api.getNodeByEntity(this.selected.current[0]);
    api.updateNodeTransform(node, {
      x,
      y,
      width,
      height,
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
