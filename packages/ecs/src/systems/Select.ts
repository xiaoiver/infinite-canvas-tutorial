import { DEG_TO_RAD } from '@pixi/math';
import { Entity, System } from '@lastolivegames/becsy';
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
  GlobalTransform,
  Highlighted,
  Input,
  InputPoint,
  Name,
  OBB,
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
  Transformable,
  UI,
  UIType,
  Visibility,
  ZIndex,
} from '../components';
import { Commands } from '../commands/Commands';
import { distanceBetweenPoints, getCursor, rotateAroundPoint } from '../utils';
import { API } from '../API';
import { RenderHighlighter } from './RenderHighlighter';
import {
  AnchorName,
  RenderTransformer,
  TRANSFORMER_ANCHOR_STROKE_COLOR,
} from './RenderTransformer';

enum SelectionMode {
  IDLE = 'IDLE',
  BRUSH = 'BRUSH',
  READY_TO_SELECT = 'READY_TO_SELECT',
  SELECT = 'SELECT',
  READY_TO_MOVE = 'READY_TO_MOVE',
  MOVE = 'MOVE',
  READY_TO_RESIZE = 'READY_TO_RESIZE',
  RESIZE = 'RESIZE',
  READY_TO_ROTATE = 'READY_TO_ROTATE',
  ROTATE = 'ROTATE',
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

  #selectionMode: SelectionMode = SelectionMode.IDLE;

  #resizingAnchorName: AnchorName;
  #sin: number;
  #cos: number;
  #width: number;
  #height: number;
  #rotation: number;
  #center: [number, number];

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
          .read.update.and.using(Name, GlobalTransform)
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
            Transformable,
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

  private handleSelectedRotating(
    api: API,
    anchorNodeX: number,
    anchorNodeY: number,
  ) {
    const x = anchorNodeX - this.#width / 2;
    const y = -anchorNodeY + this.#height / 2;
    // hor angle is changed?
    let delta = Math.atan2(-y, x) + Math.PI / 2;

    const obb = this.renderTransformer.getOBB(api.getCamera());

    const newOBB = rotateAroundPoint(obb, delta, {
      x: this.#center[0],
      y: this.#center[1],
    });

    console.log(obb, newOBB);

    this.fitSelected(api, newOBB);
  }

  private handleSelectedResizing(
    api: API,
    x: number,
    y: number,
    anchorName: AnchorName,
    lockAspectRatio: boolean,
    centeredScaling: boolean,
  ) {
    const camera = api.getCamera();
    this.renderHighlighter.unhighlight(this.selected.current);

    const { mask, tlAnchor, trAnchor, blAnchor, brAnchor } = api
      .getCamera()
      .read(Transformable);

    const anchor =
      anchorName === AnchorName.TOP_LEFT
        ? tlAnchor
        : anchorName === AnchorName.TOP_RIGHT
        ? trAnchor
        : anchorName === AnchorName.BOTTOM_LEFT
        ? blAnchor
        : brAnchor;
    this.renderTransformer.setAnchorPositionInCanvas(camera, anchor, {
      x,
      y,
    });
    const { cx: anchorNodeX, cy: anchorNodeY } = anchor.read(Circle);

    let newHypotenuse: number;

    if (anchorName === AnchorName.TOP_LEFT) {
      if (lockAspectRatio) {
        const comparePoint = centeredScaling
          ? {
              x: this.#center[0],
              y: this.#center[1],
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

      if (centeredScaling) {
        const { cx, cy } = tlAnchor.read(Circle);
        Object.assign(brAnchor.write(Circle), {
          cx: 2 * this.#center[0] - cx,
          cy: 2 * this.#center[1] - cy,
        });
      }
    } else if (anchorName === AnchorName.TOP_RIGHT) {
      if (lockAspectRatio) {
        const comparePoint = centeredScaling
          ? {
              x: this.#center[0],
              y: this.#center[1],
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

      if (centeredScaling) {
        const { cx, cy } = trAnchor.read(Circle);
        Object.assign(tlAnchor.write(Circle), {
          cx: 2 * this.#center[0] - cx,
          cy,
        });
        Object.assign(brAnchor.write(Circle), {
          cx,
          cy: 2 * this.#center[1] - cy,
        });
      }
    } else if (anchorName === AnchorName.BOTTOM_LEFT) {
      if (lockAspectRatio) {
        const comparePoint = centeredScaling
          ? {
              x: this.#center[0],
              y: this.#center[1],
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

      if (centeredScaling) {
        const { cx, cy } = blAnchor.read(Circle);
        Object.assign(tlAnchor.write(Circle), {
          cx,
          cy: 2 * this.#center[1] - cy,
        });
        Object.assign(brAnchor.write(Circle), {
          cx: 2 * this.#center[0] - cx,
          cy,
        });
      }
    } else if (anchorName === AnchorName.BOTTOM_RIGHT) {
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

      if (centeredScaling) {
        const { cx, cy } = brAnchor.read(Circle);
        Object.assign(tlAnchor.write(Circle), {
          cx: 2 * this.#center[0] - cx,
          cy: 2 * this.#center[1] - cy,
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

    const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
    const { cx: brCx, cy: brCy } = brAnchor.read(Circle);

    // const { x, y } = this.renderTransformer.getAnchorPositionInCanvas(
    //   camera,
    //   tlAnchor,
    // );
    // const width = brCx - tlCx;
    // const height = brCy - tlCy;

    this.fitSelected(api, new OBB(tlCx, tlCy, brCx, brCy, this.#rotation));
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

  private handleSelectedRotated(api: API) {
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
            new Stroke({ width: 1, color: TRANSFORMER_ANCHOR_STROKE_COLOR }), // --spectrum-thumbnail-border-color-selected
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
    }
  }

  execute() {
    this.cameras.current.forEach((camera) => {
      const { canvas } = camera.read(Camera);

      if (!canvas) {
        return;
      }

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

        this.renderHighlighter.clear();

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

        if (this.#selectionMode === SelectionMode.IDLE) {
          this.#selectionMode = SelectionMode.BRUSH;
        } else if (this.#selectionMode === SelectionMode.READY_TO_SELECT) {
          this.#selectionMode = SelectionMode.SELECT;
        } else if (this.#selectionMode === SelectionMode.READY_TO_MOVE) {
          this.#selectionMode = SelectionMode.MOVE;
        } else if (
          this.#selectionMode === SelectionMode.READY_TO_RESIZE ||
          this.#selectionMode === SelectionMode.READY_TO_ROTATE
        ) {
          const { minX, minY, maxX, maxY, rotation } =
            this.renderTransformer.getOBB(api.getCamera());
          const width = maxX - minX;
          const height = maxY - minY;
          const hypotenuse = Math.sqrt(
            Math.pow(width, 2) + Math.pow(height, 2),
          );
          this.#sin = Math.abs(height / hypotenuse);
          this.#cos = Math.abs(width / hypotenuse);
          this.#width = width;
          this.#height = height;
          this.#center = [minX + width / 2, minY + height / 2];
          this.#rotation = rotation;
          if (this.#selectionMode === SelectionMode.READY_TO_RESIZE) {
            this.#selectionMode = SelectionMode.RESIZE;
          } else if (this.#selectionMode === SelectionMode.READY_TO_ROTATE) {
            this.#selectionMode = SelectionMode.ROTATE;
          }
        }
      }

      let toHighlight: Entity | undefined;
      if (camera.has(ComputedCamera) && inputPoints.length === 0) {
        const [x, y] = input.pointerViewport;
        if (
          this.#pointerMoveViewportX === x &&
          this.#pointerMoveViewportY === y
        ) {
          return;
        }
        this.#pointerMoveViewportX = x;
        this.#pointerMoveViewportY = y;

        this.renderHighlighter.clear();
        // Highlight the topmost non-ui element
        toHighlight = this.getTopmostEntity(api, x, y, (e) => !e.has(UI));
        if (toHighlight) {
          this.renderHighlighter.highlight([toHighlight]);
          this.#selectionMode = SelectionMode.READY_TO_SELECT;
          // console.log('highlight', toHighlight.__id);
        }

        // Hit test with transformer
        if (this.selected.current.length >= 1) {
          const { anchor, cursor: cursorName } =
            this.renderTransformer.hitTest(api, { x, y }) || {};
          if (anchor) {
            cursor.value = getCursor(cursorName, 45 * DEG_TO_RAD);
            this.#resizingAnchorName = anchor;
            if (cursorName.includes('rotate')) {
              this.#selectionMode = SelectionMode.READY_TO_ROTATE;
            } else if (cursorName.includes('resize')) {
              this.#selectionMode = SelectionMode.READY_TO_RESIZE;
            } else if (anchor === AnchorName.INSIDE) {
              this.#selectionMode = SelectionMode.READY_TO_MOVE;
            } else {
              if (toHighlight) {
                this.#selectionMode = SelectionMode.READY_TO_SELECT;
              } else {
                this.#selectionMode = SelectionMode.IDLE;
              }
            }
          }
        }
      }

      // Dragging
      inputPoints.forEach((point) => {
        const inputPoint = point.write(InputPoint);
        const {
          prevPoint: [prevX, prevY],
        } = inputPoint;
        const [x, y] = input.pointerViewport;

        // TODO: If the pointer is not moved, change the selection mode to SELECT
        if (prevX === x && prevY === y) {
          // if (this.#selectionMode === SelectionMode.MOVE) {
          //   this.#selectionMode = SelectionMode.SELECT;
          // }
          return;
        }
        // if (this.#selectionMode === SelectionMode.SELECT) {
        //   this.#selectionMode = SelectionMode.MOVE;
        // }

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
        } else if (this.#selectionMode === SelectionMode.ROTATE) {
          this.handleSelectedRotating(api, ex, ey);
        }

        inputPoint.prevPoint = input.pointerViewport;
      });

      if (input.pointerUpTrigger) {
        this.renderHighlighter.clear();

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
          this.#selectionMode = SelectionMode.IDLE;
          // TODO: Apply selection
        } else if (this.#selectionMode === SelectionMode.SELECT) {
          if (input.shiftKey) {
            // Add to selection
          } else {
            // Single selection
            const toSelect = this.getTopmostEntity(
              api,
              x,
              y,
              (e) => !e.has(UI),
            );
            if (toSelect) {
              const selected = api.getNodeByEntity(toSelect);
              if (selected) {
                api.selectNodes([selected]);
              }
            }
          }
          this.#selectionMode = SelectionMode.IDLE;
        } else if (this.#selectionMode === SelectionMode.MOVE) {
          this.handleSelectedMoved(api);
          this.#selectionMode = SelectionMode.READY_TO_MOVE;
        } else if (this.#selectionMode === SelectionMode.RESIZE) {
          this.handleSelectedResized(api);
          this.#selectionMode = SelectionMode.READY_TO_RESIZE;
        } else if (this.#selectionMode === SelectionMode.ROTATE) {
          this.handleSelectedRotated(api);
          this.#selectionMode = SelectionMode.READY_TO_ROTATE;
        }
      }
    });
  }

  private fitSelected(api: API, obb: OBB) {
    const { minX, maxX, minY, maxY, rotation } = obb;
    const width = maxX - minX;
    const height = maxY - minY;
    const x = minX;
    const y = minY;

    // const oldTr = new Transform();
    // oldTr.translate(oldAttrs.x, oldAttrs.y);
    // oldTr.rotate(oldAttrs.rotation);
    // oldTr.scale(oldAttrs.width / baseSize, oldAttrs.height / baseSize);

    // TODO: calculate all selected nodes' transform
    // TODO: update transformer immediately
    const node = api.getNodeByEntity(this.selected.current[0]);
    api.updateNodeTransform(node, {
      x,
      y,
      width,
      height,
      rotation,
    });
  }
}
