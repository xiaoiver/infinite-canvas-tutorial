import { DEG_TO_RAD, Matrix, RAD_TO_DEG } from '@pixi/math';
import { fromObject } from 'transformation-matrix';
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
  Mat3,
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
import { decompose, distanceBetweenPoints, getCursor } from '../utils';
import { API } from '../API';
import { RenderHighlighter } from './RenderHighlighter';
import {
  AnchorName,
  RenderTransformer,
  TRANSFORMER_ANCHOR_STROKE_COLOR,
} from './RenderTransformer';
import { mat3, vec2 } from 'gl-matrix';
import { decomposeTSR, rotateDEG } from 'transformation-matrix';
import { SerializedNode, updateGlobalTransform } from '..';

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

  #selectionMode: SelectionMode = SelectionMode.IDLE;

  #resizingAnchorName: AnchorName;

  /**
   * OBB
   */
  #x: number;
  #y: number;
  #width: number;
  #height: number;
  #rotation: number;
  #scaleX: number;
  #scaleY: number;
  #sin: number;
  #cos: number;
  #selectedNodes: SerializedNode[];

  #selectionBrush: Entity;

  #pointerDownViewportX: number;
  #pointerDownViewportY: number;
  #pointerDownCanvasX: number;
  #pointerDownCanvasY: number;
  #pointerMoveViewportX: number;
  #pointerMoveViewportY: number;

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(Canvas, ComputedBounds)
          .read.update.and.using(Name)
          .read.and.using(
            GlobalTransform,
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

  private handleSelectedMoving(
    api: API,
    sx: number,
    sy: number,
    ex: number,
    ey: number,
  ) {
    api.highlightNodes([]);
    const camera = api.getCamera();
    const { selecteds } = camera.read(Transformable);
    selecteds.forEach((selected) => {
      // Hide transformer and highlighter
      if (selected.has(Highlighted)) {
        selected.remove(Highlighted);
      }
      const node = api.getNodeByEntity(selected);

      api.updateNodeOBB(node, {
        x: node.x + ex - sx,
        y: node.y + ey - sy,
      });
    });

    this.renderTransformer.createOrUpdate(camera);
  }

  private handleSelectedMoved(api: API) {
    const camera = api.getCamera();
    api.setNodes(api.getNodes());
    api.record();

    const { selecteds } = api.getCamera().read(Transformable);
    selecteds.forEach((selected) => {
      if (!selected.has(Highlighted)) {
        selected.add(Highlighted);
      }
    });

    this.saveSelectedTransform(api);
  }

  private handleSelectedRotating(
    api: API,
    anchorNodeX: number,
    anchorNodeY: number,
  ) {
    const camera = api.getCamera();
    const sl = api.canvas2Transformer(
      {
        x: anchorNodeX,
        y: anchorNodeY,
      },
      // this.#matrix,
    );

    const x = sl.x - this.#width / 2;
    const y = sl.y - this.#height / 2;

    let delta = Math.atan2(-y, x) + Math.PI / 2;

    // const obb = this.renderTransformer.getOBB(camera);

    // const {
    //   scale: { sx, sy },
    //   rotation: { angle },
    //   translate: { tx, ty },
    // } = decomposeTSR(
    //   rotateDEG(delta * RAD_TO_DEG, this.#center[0], this.#center[1]),
    // );

    // this.fitSelected(api, {
    //   x: obb.minX,
    //   y: obb.minY,
    //   width: obb.maxX - obb.minX,
    //   height: obb.maxY - obb.minY,
    //   transform: {
    //     scale: { x: sx, y: sy },
    //     rotation: angle,
    //     translation: { x: tx, y: ty },
    //   },
    // });
  }

  private handleSelectedResizing(
    api: API,
    x: number,
    y: number,
    lockAspectRatio: boolean,
    centeredScaling: boolean,
  ) {
    const camera = api.getCamera();
    api.highlightNodes([]);

    const { tlAnchor, trAnchor, blAnchor, brAnchor } =
      camera.read(Transformable);
    const prevTlAnchorX = tlAnchor.read(Circle).cx;
    const prevTlAnchorY = tlAnchor.read(Circle).cy;
    const prevBrAnchorX = brAnchor.read(Circle).cx;
    const prevBrAnchorY = brAnchor.read(Circle).cy;
    const { x: anchorNodeX, y: anchorNodeY } = api.canvas2Transformer({
      x,
      y,
    });

    let anchor: Entity;
    const anchorName = this.#resizingAnchorName;
    if (anchorName === AnchorName.TOP_LEFT) {
      anchor = tlAnchor;
    } else if (anchorName === AnchorName.TOP_RIGHT) {
      anchor = trAnchor;
    } else if (anchorName === AnchorName.BOTTOM_LEFT) {
      anchor = blAnchor;
    } else if (anchorName === AnchorName.BOTTOM_RIGHT) {
      anchor = brAnchor;
    }

    if (anchor) {
      Object.assign(anchor.write(Circle), {
        cx: anchorNodeX,
        cy: anchorNodeY,
      });
    }

    let newHypotenuse: number;

    if (anchorName === AnchorName.TOP_LEFT) {
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

        const reverseX = brAnchor.read(Circle).cx < comparePoint.x ? -1 : 1;
        const reverseY = brAnchor.read(Circle).cy < comparePoint.y ? -1 : 1;

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

    if (centeredScaling) {
      const topOffsetX = tlAnchor.read(Circle).cx - prevTlAnchorX;
      const topOffsetY = tlAnchor.read(Circle).cy - prevTlAnchorY;

      const bottomOffsetX = brAnchor.read(Circle).cx - prevBrAnchorX;
      const bottomOffsetY = brAnchor.read(Circle).cy - prevBrAnchorY;

      console.log(bottomOffsetX, bottomOffsetY);

      Object.assign(brAnchor.write(Circle), {
        cx: brAnchor.read(Circle).cx - topOffsetX,
        cy: brAnchor.read(Circle).cy - topOffsetY,
      });

      Object.assign(tlAnchor.write(Circle), {
        cx: tlAnchor.read(Circle).cx - bottomOffsetX,
        cy: tlAnchor.read(Circle).cy - bottomOffsetY,
      });
    }

    const { cx: tlCx, cy: tlCy } = tlAnchor.read(Circle);
    const { cx: brCx, cy: brCy } = brAnchor.read(Circle);

    {
      const width = brCx - tlCx;
      const height = brCy - tlCy;

      const { x, y } = api.transformer2Canvas({ x: tlCx, y: tlCy });
      this.fitSelected(api, {
        x,
        y,
        width,
        height,
        rotation: this.#rotation,
        scaleX: this.#scaleX,
        scaleY: this.#scaleY,
      });
    }

    this.renderTransformer.createOrUpdate(camera);
  }

  private handleSelectedResized(api: API) {
    const camera = api.getCamera();

    api.setNodes(api.getNodes());
    api.record();

    const { selecteds } = camera.read(Transformable);
    selecteds.forEach((selected) => {
      if (!selected.has(Highlighted)) {
        selected.add(Highlighted);
      }
    });

    this.saveSelectedTransform(api);
  }

  private handleSelectedRotated(api: API) {
    const camera = api.getCamera();

    api.setNodes(api.getNodes());
    api.record();

    const { selecteds } = camera.read(Transformable);
    selecteds.forEach((selected) => {
      if (!selected.has(Highlighted)) {
        selected.add(Highlighted);
      }
    });

    this.saveSelectedTransform(api);
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
        api.highlightNodes([]);

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
          this.saveSelectedTransform(api);
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

        api.highlightNodes([]);
        // Highlight the topmost non-ui element
        toHighlight = this.getTopmostEntity(api, x, y, (e) => !e.has(UI));
        if (toHighlight) {
          api.highlightNodes([api.getNodeByEntity(toHighlight)]);
          this.#selectionMode = SelectionMode.READY_TO_SELECT;
          // console.log('highlight', toHighlight.__id);
        }

        if (camera.has(Transformable)) {
          const { mask, selecteds } = camera.read(Transformable);

          // Hit test with transformer
          if (selecteds.length >= 1) {
            const { anchor, cursor: cursorName } =
              this.renderTransformer.hitTest(api, { x, y }) || {};
            if (anchor) {
              const { rotation } = mask.read(Transform);
              cursor.value = getCursor(cursorName, rotation);
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

        if (this.#selectionMode === SelectionMode.BRUSH) {
          this.handleBrushing(api, x, y);
        } else if (this.#selectionMode === SelectionMode.MOVE) {
          this.handleSelectedMoving(api, sx, sy, ex, ey);
        } else if (this.#selectionMode === SelectionMode.RESIZE) {
          this.handleSelectedResizing(
            api,
            ex,
            ey,
            input.shiftKey,
            input.altKey,
          );
        } else if (this.#selectionMode === SelectionMode.ROTATE) {
          this.handleSelectedRotating(api, ex, ey);
        }

        inputPoint.prevPoint = input.pointerViewport;
      });

      if (input.pointerUpTrigger) {
        api.highlightNodes([]);

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

  private saveSelectedTransform(api: API) {
    const { x, y, width, height, rotation, scaleX, scaleY } =
      this.renderTransformer.getOBB(api.getCamera());
    const hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
    this.#sin = Math.abs(height / hypotenuse);
    this.#cos = Math.abs(width / hypotenuse);
    this.#width = width;
    this.#height = height;
    this.#rotation = rotation;
    this.#x = x;
    this.#y = y;
    this.#scaleX = scaleX;
    this.#scaleY = scaleY;

    this.#selectedNodes = api.getAppState().layersSelected.map((id) => {
      return { ...api.getNodeById(id) };
    });
  }

  private fitSelected(api: API, newAttrs: OBB) {
    const camera = api.getCamera();
    const { selecteds } = camera.read(Transformable);

    const { x, y, width, height, rotation, scaleX, scaleY } = newAttrs;
    const epsilon = 0.000001;

    const oldAttrs = {
      x: this.#x,
      y: this.#y,
      width: this.#width,
      height: this.#height,
      rotation: this.#rotation,
    };

    console.log('oldAttrs', oldAttrs);

    const baseSize = 10000000;
    const oldTr = mat3.create();
    mat3.translate(oldTr, oldTr, [oldAttrs.x, oldAttrs.y]);
    mat3.rotate(oldTr, oldTr, oldAttrs.rotation);
    mat3.scale(oldTr, oldTr, [
      oldAttrs.width / baseSize,
      oldAttrs.height / baseSize,
    ]);

    const newTr = mat3.create();
    const newScaleX = newAttrs.width / baseSize;
    const newScaleY = newAttrs.height / baseSize;
    mat3.translate(newTr, newTr, [newAttrs.x, newAttrs.y]);
    mat3.rotate(newTr, newTr, newAttrs.rotation);
    mat3.scale(newTr, newTr, [newScaleX, newScaleY]);

    // [delta transform] = [new transform] * [old transform inverted]
    const delta = mat3.multiply(
      newTr,
      newTr,
      mat3.invert(mat3.create(), oldTr),
    );

    if (selecteds.length === 1) {
      const [selected] = selecteds;
      const node = api.getNodeByEntity(selected);

      // if (width < 0) {
      //   if (this.#resizingAnchorName.includes('right')) {
      //     this.#resizingAnchorName = this.#resizingAnchorName.replace(
      //       'right',
      //       'left',
      //     ) as AnchorName;
      //   } else if (this.#resizingAnchorName.includes('left')) {
      //     this.#resizingAnchorName = this.#resizingAnchorName.replace(
      //       'left',
      //       'right',
      //     ) as AnchorName;
      //   }
      // }

      // if (height < 0) {
      //   if (this.#resizingAnchorName.includes('top')) {
      //     this.#resizingAnchorName = this.#resizingAnchorName.replace(
      //       'top',
      //       'bottom',
      //     ) as AnchorName;
      //   } else if (this.#resizingAnchorName.includes('bottom')) {
      //     this.#resizingAnchorName = this.#resizingAnchorName.replace(
      //       'bottom',
      //       'top',
      //     ) as AnchorName;
      //   }
      // }

      const oldNode = this.#selectedNodes.find((n) => n.id === node.id);
      api.updateNodeOBB(
        node,
        {
          x,
          y,
          width: Math.max(Math.abs(width), epsilon),
          height: Math.max(Math.abs(height), epsilon),
          rotation,
          scaleX: scaleX * (Math.sign(width) || 1),
          scaleY: scaleY * (Math.sign(height) || 1),
        },
        false,
        delta,
        oldNode,
      );

      updateGlobalTransform(selected);
    }

    // if (selecteds.length === 1) {
    //   const [selected] = selecteds;
    //   const node = api.getNodeByEntity(selected);

    //   // const { transform } = this.renderTransformer.getOBB(camera);
    //   const transform = this.#transform;
    //   const newMatrix = mat3.multiply(mat3.create(), transform, scaleMatrix);

    //   // const newGlobalOrigin = newMatrix.apply(
    //   //   scaleFromCenter
    //   //     ? { x: newRect.width / 2, y: newRect.height / 2 }
    //   //     : resizeOp.getLocalOrigin(newRect.width, newRect.height),
    //   // );
    //   // const globalOrigin = transform.apply(localOrigin);

    //   // const offset = {
    //   //   x: globalOrigin.x - newGlobalOrigin.x,
    //   //   y: globalOrigin.y - newGlobalOrigin.y,
    //   // };

    //   // mat3.multiply(newMatrix, mat3.fromTranslation(mat3.create(), [offset.x, offset.y]), newMatrix);

    //   api.updateNodeTransform(node, {
    //     x,
    //     y,
    //     width: Math.max(Math.abs(width), 0.000001),
    //     height: Math.max(Math.abs(height), 0.000001),
    //     matrix: newMatrix,
    //   });
    // }

    // selecteds.forEach((selected) => {
    //   // for each node we have the same [delta transform]
    //   // the equations is
    //   // [delta transform] * [parent transform] * [old local transform] = [parent transform] * [new local transform]
    //   // and we need to find [new local transform]
    //   // [new local] = [parent inverted] * [delta] * [parent] * [old local]
    //   // const parentTransform = node.getParent()!.getAbsoluteTransform();
    //   const parentTransform = selected.read(Children).parent.has(Camera)
    //     ? mat3.create()
    //     : Mat3.toGLMat3(
    //         selected.read(Children).parent.read(GlobalTransform).matrix,
    //       );
    //   const localTransform = Mat3.toGLMat3(
    //     Mat3.fromTransform(selected.read(Transform)),
    //   );
    //   // const localTransform = mat3.create();
    //   // // skip offset:
    //   // // localTransform.translate(node.offsetX(), node.offsetY());

    //   const newLocalTransform = mat3.create();
    //   mat3.multiply(
    //     newLocalTransform,
    //     newLocalTransform,
    //     mat3.invert(mat3.create(), parentTransform),
    //   );
    //   mat3.multiply(newLocalTransform, newLocalTransform, delta);
    //   mat3.multiply(newLocalTransform, newLocalTransform, parentTransform);
    //   mat3.multiply(newLocalTransform, newLocalTransform, localTransform);

    //   console.log(newLocalTransform);

    //   const node = api.getNodeByEntity(selected);
    //   api.updateNodeOBB(node, {
    //     matrix: newLocalTransform,
    //   });
    // });

    // this.#rotation = newAttrs.rotation;

    // this.renderTransformer.resetTransformCache(camera);
  }
}
