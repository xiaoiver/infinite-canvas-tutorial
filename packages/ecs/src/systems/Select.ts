import { Entity, System } from '@lastolivegames/becsy';
import { mat3 } from 'gl-matrix';
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
  TransformableStatus,
  UI,
  UIType,
  Visibility,
  ZIndex,
  AnchorName,
  VectorNetwork,
  ComputedCameraControl,
  ComputedPoints,
  DropShadow,
  Culled,
  SnapPoint,
  Snap,
  ToBeDeleted,
  Brush,
  HTML,
  Embed,
  Editable,
} from '../components';
import { Commands } from '../commands/Commands';
import {
  calculateOffset,
  decompose,
  distanceBetweenPoints,
  getCursor,
  getGridPoint,
  SerializedNode,
  snapDraggedElements,
  // snapDraggedElements,
  snapToGrid,
} from '../utils';
import { API } from '../API';
import {
  getOBB,
  hitTest,
  TRANSFORMER_ANCHOR_STROKE_COLOR,
  TRANSFORMER_MASK_FILL_COLOR,
} from './RenderTransformer';
import { updateGlobalTransform } from './Transform';
import { safeAddComponent, safeRemoveComponent } from '../history';
import { updateComputedPoints } from './ComputePoints';

export enum SelectionMode {
  IDLE = 'IDLE',
  READY_TO_BRUSH = 'READY_TO_BRUSH',
  BRUSH = 'BRUSH',
  READY_TO_SELECT = 'READY_TO_SELECT',
  SELECT = 'SELECT',
  READY_TO_MOVE = 'READY_TO_MOVE',
  MOVE = 'MOVE',
  READY_TO_RESIZE = 'READY_TO_RESIZE',
  RESIZE = 'RESIZE',
  READY_TO_ROTATE = 'READY_TO_ROTATE',
  ROTATE = 'ROTATE',
  READY_TO_MOVE_CONTROL_POINT = 'READY_TO_MOVE_CONTROL_POINT',
  MOVE_CONTROL_POINT = 'MOVE_CONTROL_POINT',
  EDITING = 'EDITING',
}

export interface SelectOBB {
  mode: SelectionMode;
  resizingAnchorName: AnchorName;
  nodes: SerializedNode[];

  obb: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
  };
  sin: number;
  cos: number;

  pointerMoveViewportX: number;
  pointerMoveViewportY: number;

  brush: Entity;

  editing: Entity;
}

/**
 * * Click to select individual object. Hold `Shift` and click on another object to select multiple objects.
 * * Brush(marquee) to select multiple objects.
 * @see https://help.figma.com/hc/en-us/articles/360040449873-Select-layers-and-objects
 */
export class Select extends System {
  private readonly commands = new Commands(this);

  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  private selections = new Map<number, SelectOBB>();

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(ComputedCameraControl, Culled, Brush)
          .read.update.and.using(
            Canvas,
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
            HTML,
            Embed,
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
            VectorNetwork,
            ComputedBounds,
            ComputedPoints,
            DropShadow,
            Snap,
            SnapPoint,
            ToBeDeleted,
            Editable,
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
    const { snapToPixelGridSize } = api.getAppState();
    const camera = api.getCamera();
    camera.write(Transformable).status = TransformableStatus.MOVING;

    const selection = this.selections.get(camera.__id);

    const { pointerDownCanvasX, pointerDownCanvasY } = camera.read(
      ComputedCameraControl,
    );
    const [gridEx, gridEy] = getGridPoint(ex, ey, snapToPixelGridSize);
    const [gridPointerDownCanvasX, gridPointerDownCanvasY] = getGridPoint(
      pointerDownCanvasX,
      pointerDownCanvasY,
      snapToPixelGridSize,
    );

    const dragOffset: [number, number] = [
      gridEx - gridPointerDownCanvasX,
      gridEy - gridPointerDownCanvasY,
    ];

    const { snapOffset, snapLines } = snapDraggedElements(api, dragOffset);

    // const offset = calculateOffset(
    //   [selection.obb.x, selection.obb.y],
    //   dragOffset,
    //   snapOffset,
    //   snapToPixelGridSize,
    // );

    this.createSnapPoints(camera, snapLines);

    const { selecteds, mask } = camera.read(Transformable);
    selecteds.forEach((selected) => {
      // Hide transformer and highlighter
      if (selected.has(Highlighted)) {
        selected.remove(Highlighted);
      }
      const node = api.getNodeByEntity(selected);

      const oldNode = selection.nodes.find((n) => n.id === node.id);
      if (oldNode) {
        api.updateNodeOBB(node, {
          x: oldNode.x + dragOffset[0],
          y: oldNode.y + dragOffset[1],
        });
      }
      updateGlobalTransform(selected);
      updateComputedPoints(selected);
    });

    updateGlobalTransform(mask);
  }

  private handleSelectedMoved(api: API, selection: SelectOBB) {
    const camera = api.getCamera();

    api.setNodes(api.getNodes());
    api.record();

    const { selecteds } = camera.read(Transformable);
    selecteds.forEach((selected) => {
      if (!selected.has(Highlighted)) {
        selected.add(Highlighted);
      }
    });

    camera.write(Transformable).status = TransformableStatus.MOVED;

    this.saveSelectedOBB(api, selection);

    if (camera.has(Snap)) {
      [...camera.read(Snap).points].forEach((point) => {
        point.add(ToBeDeleted);
        point.remove(SnapPoint);
      });
    }
  }

  private handleSelectedRotating(
    api: API,
    anchorNodeX: number,
    anchorNodeY: number,
  ) {
    const camera = api.getCamera();
    camera.write(Transformable).status = TransformableStatus.ROTATING;
    const { obb } = this.selections.get(camera.__id);

    const sl = api.canvas2Transformer({
      x: anchorNodeX,
      y: anchorNodeY,
    });

    const x = sl.x - obb.width / 2;
    const y = sl.y - obb.height / 2;

    let delta = Math.atan2(-y, x) + Math.PI / 2;

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
    canvasX: number,
    canvasY: number,
    lockAspectRatio: boolean,
    centeredScaling: boolean,
    selection: SelectOBB,
  ) {
    const camera = api.getCamera();
    const { resizingAnchorName, obb, cos, sin } = selection;
    const { rotation, scaleX, scaleY } = obb;

    // Use the lock aspect ratio of the selected node if there is only one
    const { layersSelected } = api.getAppState();
    if (layersSelected.length === 1) {
      const node = api.getNodeById(layersSelected[0]);
      lockAspectRatio = node.lockAspectRatio ?? lockAspectRatio;
    }

    camera.write(Transformable).status = TransformableStatus.RESIZING;

    const { tlAnchor, trAnchor, blAnchor, brAnchor } =
      camera.read(Transformable);
    const prevTlAnchorX = tlAnchor.read(Circle).cx;
    const prevTlAnchorY = tlAnchor.read(Circle).cy;
    const prevBrAnchorX = brAnchor.read(Circle).cx;
    const prevBrAnchorY = brAnchor.read(Circle).cy;
    const { x, y } = api.canvas2Transformer({
      x: canvasX,
      y: canvasY,
    });

    let anchor: Entity;
    const anchorName = resizingAnchorName;
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
        cx: x,
        cy: y,
      });
    }

    let newHypotenuse: number;

    if (anchorName === AnchorName.TOP_LEFT) {
      if (lockAspectRatio) {
        const comparePoint = centeredScaling
          ? {
              x: obb.width / 2,
              y: obb.height / 2,
            }
          : {
              x: brAnchor.read(Circle).cx,
              y: brAnchor.read(Circle).cy,
            };
        newHypotenuse = Math.sqrt(
          Math.pow(comparePoint.x - x, 2) + Math.pow(comparePoint.y - y, 2),
        );

        const { cx, cy } = tlAnchor.read(Circle);
        const reverseX = cx > comparePoint.x ? -1 : 1;
        const reverseY = cy > comparePoint.y ? -1 : 1;

        Object.assign(tlAnchor.write(Circle), {
          cx: comparePoint.x - newHypotenuse * cos * reverseX,
          cy: comparePoint.y - newHypotenuse * sin * reverseY,
        });
      }
    } else if (anchorName === AnchorName.TOP_RIGHT) {
      if (lockAspectRatio) {
        const comparePoint = centeredScaling
          ? {
              x: obb.width / 2,
              y: obb.height / 2,
            }
          : {
              x: blAnchor.read(Circle).cx,
              y: blAnchor.read(Circle).cy,
            };

        newHypotenuse = Math.sqrt(
          Math.pow(x - comparePoint.x, 2) + Math.pow(comparePoint.y - y, 2),
        );

        const { cx, cy } = trAnchor.read(Circle);
        const reverseX = cx < comparePoint.x ? -1 : 1;
        const reverseY = cy > comparePoint.y ? -1 : 1;

        Object.assign(trAnchor.write(Circle), {
          cx: comparePoint.x + newHypotenuse * cos * reverseX,
          cy: comparePoint.y - newHypotenuse * sin * reverseY,
        });
      }

      tlAnchor.write(Circle).cy = trAnchor.read(Circle).cy;
      brAnchor.write(Circle).cx = trAnchor.read(Circle).cx;
    } else if (anchorName === AnchorName.BOTTOM_LEFT) {
      if (lockAspectRatio) {
        const comparePoint = centeredScaling
          ? {
              x: obb.width / 2,
              y: obb.height / 2,
            }
          : {
              x: trAnchor.read(Circle).cx,
              y: trAnchor.read(Circle).cy,
            };

        newHypotenuse = Math.sqrt(
          Math.pow(comparePoint.x - x, 2) + Math.pow(y - comparePoint.y, 2),
        );

        const reverseX = comparePoint.x < x ? -1 : 1;
        const reverseY = y < comparePoint.y ? -1 : 1;

        Object.assign(blAnchor.write(Circle), {
          cx: comparePoint.x - newHypotenuse * cos * reverseX,
          cy: comparePoint.y + newHypotenuse * sin * reverseY,
        });
      }

      tlAnchor.write(Circle).cx = blAnchor.read(Circle).cx;
      brAnchor.write(Circle).cy = blAnchor.read(Circle).cy;
    } else if (anchorName === AnchorName.BOTTOM_RIGHT) {
      if (lockAspectRatio) {
        const comparePoint = centeredScaling
          ? {
              x: obb.width / 2,
              y: obb.height / 2,
            }
          : {
              x: tlAnchor.read(Circle).cx,
              y: tlAnchor.read(Circle).cy,
            };

        newHypotenuse = Math.sqrt(
          Math.pow(x - comparePoint.x, 2) + Math.pow(y - comparePoint.y, 2),
        );

        const reverseX = brAnchor.read(Circle).cx < comparePoint.x ? -1 : 1;
        const reverseY = brAnchor.read(Circle).cy < comparePoint.y ? -1 : 1;
        Object.assign(brAnchor.write(Circle), {
          cx: comparePoint.x + newHypotenuse * cos * reverseX,
          cy: comparePoint.y + newHypotenuse * sin * reverseY,
        });
      }
    } else if (anchorName === AnchorName.TOP_CENTER) {
      tlAnchor.write(Circle).cy = y;
    } else if (anchorName === AnchorName.BOTTOM_CENTER) {
      brAnchor.write(Circle).cy = y;
    } else if (anchorName === AnchorName.MIDDLE_LEFT) {
      tlAnchor.write(Circle).cx = x;
    } else if (anchorName === AnchorName.MIDDLE_RIGHT) {
      brAnchor.write(Circle).cx = x;
    }

    if (lockAspectRatio) {
      if (
        anchorName === AnchorName.MIDDLE_LEFT ||
        anchorName === AnchorName.MIDDLE_RIGHT
      ) {
        const newWidth = brAnchor.read(Circle).cx - tlAnchor.read(Circle).cx;
        const tan = sin / cos;
        const newHeight = newWidth * tan;
        const deltaY = newHeight - (prevBrAnchorY - prevTlAnchorY);
        brAnchor.write(Circle).cy = brAnchor.read(Circle).cy + deltaY / 2;
        tlAnchor.write(Circle).cy = tlAnchor.read(Circle).cy - deltaY / 2;
      } else if (
        anchorName === AnchorName.TOP_CENTER ||
        anchorName === AnchorName.BOTTOM_CENTER
      ) {
        const newHeight = brAnchor.read(Circle).cy - tlAnchor.read(Circle).cy;
        const tan = sin / cos;
        const newWidth = newHeight / tan;
        const deltaX = newWidth - (prevBrAnchorX - prevTlAnchorX);
        brAnchor.write(Circle).cx = brAnchor.read(Circle).cx + deltaX / 2;
        tlAnchor.write(Circle).cx = tlAnchor.read(Circle).cx - deltaX / 2;
      }
    }

    if (centeredScaling) {
      const topOffsetX = tlAnchor.read(Circle).cx - prevTlAnchorX;
      const topOffsetY = tlAnchor.read(Circle).cy - prevTlAnchorY;

      const bottomOffsetX = brAnchor.read(Circle).cx - prevBrAnchorX;
      const bottomOffsetY = brAnchor.read(Circle).cy - prevBrAnchorY;

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

      this.fitSelected(
        api,
        {
          x,
          y,
          width,
          height,
          rotation,
          scaleX,
          scaleY,
        },
        selection,
      );
    }
  }

  private handleSelectedResized(api: API, selection: SelectOBB) {
    const camera = api.getCamera();
    camera.write(Transformable).status = TransformableStatus.RESIZED;

    api.setNodes(api.getNodes());
    api.record();

    const { selecteds } = camera.read(Transformable);
    selecteds.forEach((selected) => {
      if (!selected.has(Highlighted)) {
        selected.add(Highlighted);
      }
    });

    this.saveSelectedOBB(api, selection);
  }

  private handleSelectedRotated(api: API, selection: SelectOBB) {
    const camera = api.getCamera();
    camera.write(Transformable).status = TransformableStatus.ROTATED;

    api.setNodes(api.getNodes());
    api.record();

    const { selecteds } = camera.read(Transformable);
    selecteds.forEach((selected) => {
      if (!selected.has(Highlighted)) {
        selected.add(Highlighted);
      }
    });

    this.saveSelectedOBB(api, selection);
  }

  private handleBrushing(api: API, viewportX: number, viewportY: number) {
    const camera = api.getCamera();
    const selection = this.selections.get(camera.__id);

    const {
      pointerDownViewportX,
      pointerDownViewportY,
      pointerDownCanvasX,
      pointerDownCanvasY,
    } = camera.read(ComputedCameraControl);

    // Use a threshold to avoid showing the selection brush when the pointer is moved a little.
    const shouldShowSelectionBrush =
      distanceBetweenPoints(
        viewportX,
        viewportY,
        pointerDownViewportX,
        pointerDownViewportY,
      ) > 10;

    if (shouldShowSelectionBrush) {
      if (!selection.brush) {
        selection.brush = this.commands
          .spawn(
            new UI(UIType.BRUSH),
            new Transform(),
            new Renderable(),
            new FillSolid(TRANSFORMER_MASK_FILL_COLOR),
            new Opacity({ fillOpacity: 0.5 }),
            new Stroke({ width: 1, color: TRANSFORMER_ANCHOR_STROKE_COLOR }),
            new Rect(),
            new Visibility('hidden'),
            new ZIndex(Infinity),
            new StrokeAttenuation(),
          )
          .id()
          .hold();

        const camera = this.commands.entity(api.getCamera());
        camera.appendChild(this.commands.entity(selection.brush));
        this.commands.execute();
      }

      selection.brush.write(Visibility).value = 'visible';

      const { x: wx, y: wy } = api.viewport2Canvas({
        x: viewportX,
        y: viewportY,
      });

      Object.assign(selection.brush.write(Rect), {
        x: pointerDownCanvasX,
        y: pointerDownCanvasY,
        width: wx - pointerDownCanvasX,
        height: wy - pointerDownCanvasY,
      });
      updateGlobalTransform(selection.brush);

      // Select elements in the brush
      this.applyBrushSelection(api, selection, true);
    }
  }

  execute() {
    this.cameras.current.forEach((camera) => {
      if (!camera.has(Camera)) {
        return;
      }

      const { canvas } = camera.read(Camera);
      if (!canvas) {
        return;
      }

      const { inputPoints, api } = canvas.read(Canvas);
      const pen = api.getAppState().penbarSelected;

      const input = canvas.write(Input);

      if (pen !== Pen.SELECT) {
        Object.assign(input, {
          wheelTrigger: false,
          ctrlKey: false,
          metaKey: false,
          shiftKey: false,
          key: undefined,
        });

        // Clear selection
        if (pen !== Pen.VECTOR_NETWORK) {
          api.selectNodes([]);
        }
        api.highlightNodes([]);

        if (pen !== Pen.VECTOR_NETWORK) {
          return;
        }
      }

      const cursor = canvas.write(Cursor);

      safeAddComponent(camera, Transformable);

      if (!this.selections.has(camera.__id)) {
        this.selections.set(camera.__id, {
          mode: SelectionMode.IDLE,
          resizingAnchorName: AnchorName.INSIDE,
          nodes: api.getNodes(),
          obb: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
          },
          sin: 0,
          cos: 0,
          pointerMoveViewportX: 0,
          pointerMoveViewportY: 0,
          brush: undefined,
          editing: undefined,
        });
      }

      if (input.doubleClickTrigger) {
        // FIXME: Only support Polyline for now
        const { selecteds } = camera.read(Transformable);
        if (selecteds.length === 1) {
          const selected = selecteds[0];

          const selection = this.selections.get(camera.__id);
          selection.mode = SelectionMode.EDITING;

          // Enter edit mode
          api.updateNode(api.getNodeByEntity(selected), { isEditing: true });
          selection.editing = selected;

          if (selected.has(Polyline)) {
            const vectorNetwork = VectorNetwork.fromEntity(selected);
            safeRemoveComponent(selected, Polyline);

            api.runAtNextTick(() => {
              safeAddComponent(selected, VectorNetwork, vectorNetwork);
            });

            // Enter VectorNetwork edit mode
            api.setAppState({
              penbarSelected: Pen.VECTOR_NETWORK,
            });

            return;
          }
        }
      }

      const selection = this.selections.get(camera.__id);
      if (input.pointerDownTrigger) {
        const [x, y] = input.pointerViewport;

        if (selection.mode === SelectionMode.IDLE) {
          selection.mode = SelectionMode.READY_TO_BRUSH;
          api.selectNodes([]);
        } else if (selection.mode === SelectionMode.READY_TO_SELECT) {
          selection.mode = SelectionMode.SELECT;
        } else if (selection.mode === SelectionMode.READY_TO_MOVE) {
          cursor.value = 'grab';
          selection.mode = SelectionMode.MOVE;
        } else if (
          selection.mode === SelectionMode.READY_TO_RESIZE ||
          selection.mode === SelectionMode.READY_TO_ROTATE
        ) {
          this.saveSelectedOBB(api, selection);
          if (selection.mode === SelectionMode.READY_TO_RESIZE) {
            selection.mode = SelectionMode.RESIZE;
          } else if (selection.mode === SelectionMode.READY_TO_ROTATE) {
            selection.mode = SelectionMode.ROTATE;
          }
          // } else if (
          //   selection.mode === SelectionMode.READY_TO_MOVE_CONTROL_POINT
          // ) {
          //   selection.mode = SelectionMode.MOVE_CONTROL_POINT;
        }

        if (selection.mode === SelectionMode.SELECT) {
          const toSelect = this.getTopmostEntity(api, x, y, (e) => !e.has(UI));
          if (toSelect) {
            const selected = api.getNodeByEntity(toSelect);
            if (selected) {
              if (
                api.getAppState().layersSelected.length > 1 &&
                api.getAppState().layersSelected.includes(selected.id)
              ) {
                // deselect if already selected in a group
                api.deselectNodes([selected]);
              } else {
                api.selectNodes([selected], input.shiftKey); // single or multi select
              }
            }
          }

          if (api.getAppState().layersSelected.length > 0) {
            selection.mode = SelectionMode.MOVE;
          }
        } else if (selection.mode === SelectionMode.EDITING) {
          const toSelect = this.getTopmostEntity(api, x, y, (e) => !e.has(UI));
          if (selection.editing && toSelect !== selection.editing) {
            api.updateNode(api.getNodeByEntity(selection.editing), {
              isEditing: false,
            });
            selection.editing = undefined;
            selection.mode = SelectionMode.SELECT;
          }
        }
      }

      let toHighlight: Entity | undefined;
      if (camera.has(ComputedCamera) && inputPoints.length === 0) {
        const [x, y] = input.pointerViewport;
        if (
          selection.pointerMoveViewportX !== x &&
          selection.pointerMoveViewportY !== y
        ) {
          selection.pointerMoveViewportX = x;
          selection.pointerMoveViewportY = y;

          api.highlightNodes([]);

          // Highlight the topmost non-ui element
          toHighlight = this.getTopmostEntity(api, x, y, (e) => !e.has(UI));
          if (toHighlight) {
            if (
              selection.mode !== SelectionMode.BRUSH &&
              selection.mode !== SelectionMode.MOVE
            ) {
              selection.mode = SelectionMode.READY_TO_SELECT;
            }
          } else if (selection.mode !== SelectionMode.BRUSH) {
            selection.mode = SelectionMode.IDLE;
          }
          const { mask, selecteds } = camera.read(Transformable);

          cursor.value = 'default';

          // Hit test with transformer
          if (selecteds.length >= 1) {
            const { anchor, cursor: cursorName } = hitTest(api, { x, y }) || {};

            if (anchor) {
              if (anchor === AnchorName.CONTROL) {
                // cursor.value = 'move';
                // (selection as SelectVectorNetwork).activeControlPointIndex =
                //   index;
              } else {
                const { rotation, scale } = mask.read(Transform);
                cursor.value = getCursor(
                  cursorName,
                  rotation,
                  '',
                  Math.sign(scale[0] * scale[1]) < 0,
                );
                selection.resizingAnchorName = anchor;

                if (cursorName.includes('rotate')) {
                  selection.mode = SelectionMode.READY_TO_ROTATE;
                  toHighlight = undefined;
                } else if (cursorName.includes('resize')) {
                  selection.mode = SelectionMode.READY_TO_RESIZE;
                  toHighlight = undefined;
                } else if (anchor === AnchorName.INSIDE) {
                  // Only in single transformer, we can select other objects.
                  if (
                    toHighlight &&
                    toHighlight !== selecteds[0] &&
                    selecteds.length === 1
                  ) {
                    selection.mode = SelectionMode.READY_TO_SELECT;
                  } else {
                    // In group can toggle selection.
                    if (input.shiftKey) {
                      selection.mode = SelectionMode.READY_TO_SELECT;
                    } else {
                      // Disable highlight, only allow move.
                      toHighlight = undefined;

                      if (
                        selection.mode !== SelectionMode.BRUSH &&
                        selection.mode !== SelectionMode.MOVE
                      ) {
                        selection.mode = SelectionMode.READY_TO_MOVE;
                      }
                    }
                  }
                } else {
                  if (toHighlight) {
                    selection.mode = SelectionMode.READY_TO_SELECT;
                  } else if (selection.mode !== SelectionMode.BRUSH) {
                    selection.mode = SelectionMode.IDLE;
                  }
                }
              }
            }
          }

          if (toHighlight) {
            api.highlightNodes([api.getNodeByEntity(toHighlight)]);
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
          return;
        }

        let { x: sx, y: sy } = api.viewport2Canvas({
          x: prevX,
          y: prevY,
        });
        let { x: ex, y: ey } = api.viewport2Canvas({
          x,
          y,
        });

        const { snapToPixelGridEnabled, snapToPixelGridSize } =
          api.getAppState();
        if (snapToPixelGridEnabled) {
          sx = snapToGrid(sx, snapToPixelGridSize);
          sy = snapToGrid(sy, snapToPixelGridSize);
          ex = snapToGrid(ex, snapToPixelGridSize);
          ey = snapToGrid(ey, snapToPixelGridSize);
        }

        if (
          selection.mode === SelectionMode.READY_TO_BRUSH ||
          selection.mode === SelectionMode.BRUSH
        ) {
          this.handleBrushing(api, x, y);
          selection.mode = SelectionMode.BRUSH;
        } else if (selection.mode === SelectionMode.MOVE) {
          cursor.value = 'grabbing';

          this.handleSelectedMoving(api, sx, sy, ex, ey);
        } else if (selection.mode === SelectionMode.RESIZE) {
          this.handleSelectedResizing(
            api,
            ex,
            ey,
            input.shiftKey,
            input.altKey,
            selection,
          );
        } else if (selection.mode === SelectionMode.ROTATE) {
          this.handleSelectedRotating(api, ex, ey);
          // } else if (selection.mode === SelectionMode.MOVE_CONTROL_POINT) {
          // this.handleSelectedMovingControlPoint(api, sx, sy, ex, ey);
        }

        // FIXME: This should be done in the last relative system
        inputPoint.prevPoint = input.pointerViewport;
      });

      if (input.key === 'Escape') {
        api.selectNodes([]);
        api.highlightNodes([]);
        if (selection.mode === SelectionMode.BRUSH) {
          this.hideBrush(selection);
        }
      }

      if (input.pointerUpTrigger) {
        if (selection.mode === SelectionMode.BRUSH) {
          this.hideBrush(selection);
          this.applyBrushSelection(api, selection, false);
        } else if (selection.mode === SelectionMode.MOVE) {
          this.handleSelectedMoved(api, selection);
          selection.mode = SelectionMode.READY_TO_MOVE;
        } else if (
          selection.mode === SelectionMode.RESIZE ||
          selection.mode === SelectionMode.READY_TO_RESIZE
        ) {
          this.handleSelectedResized(api, selection);
          selection.mode = SelectionMode.READY_TO_RESIZE;
        } else if (selection.mode === SelectionMode.ROTATE) {
          this.handleSelectedRotated(api, selection);
          selection.mode = SelectionMode.READY_TO_ROTATE;
          // } else if (selection.mode === SelectionMode.MOVE_CONTROL_POINT) {
          //   this.handleSelectedMovedControlPoint(
          //     api,
          //     selection as SelectVectorNetwork,
          //   );
          //   selection.mode = SelectionMode.READY_TO_MOVE_CONTROL_POINT;
        }
      }

      Object.assign(input, {
        wheelTrigger: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        key: undefined,
      });
    });
  }

  private hideBrush(selection: SelectOBB) {
    if (selection.brush) {
      selection.brush.write(Visibility).value = 'hidden';
    }
    selection.mode = SelectionMode.IDLE;
  }

  private applyBrushSelection(
    api: API,
    selection: SelectOBB,
    needHighlight: boolean,
  ) {
    if (selection.brush) {
      const { x, y, width, height } = selection.brush.read(Rect);
      const minX = Math.min(x, x + width);
      const minY = Math.min(y, y + height);
      const maxX = Math.max(x, x + width);
      const maxY = Math.max(y, y + height);
      const selecteds = api
        .elementsFromBBox(minX, minY, maxX, maxY)
        .filter((e) => !e.has(UI))
        .map((e) => api.getNodeByEntity(e));
      api.selectNodes(selecteds);

      if (needHighlight) {
        api.highlightNodes(selecteds);
      }
    }
  }

  private saveSelectedOBB(api: API, selection: SelectOBB) {
    const camera = api.getCamera();
    const obb = getOBB(camera);
    selection.obb = {
      x: obb.x,
      y: obb.y,
      width: obb.width,
      height: obb.height,
      rotation: obb.rotation,
      scaleX: obb.scaleX,
      scaleY: obb.scaleY,
    };
    const { width, height } = selection.obb;
    const hypotenuse = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
    selection.sin = Math.abs(height / hypotenuse);
    selection.cos = Math.abs(width / hypotenuse);

    selection.nodes = [...api.getNodes()];
  }

  private fitSelected(api: API, newAttrs: OBB, selection: SelectOBB) {
    const camera = api.getCamera();
    const { selecteds } = camera.read(Transformable);
    const { width, height } = newAttrs;
    const epsilon = 0.01;
    const oldAttrs = {
      x: selection.obb.x,
      y: selection.obb.y,
      width: selection.obb.width,
      height: selection.obb.height,
      rotation: selection.obb.rotation,
      scaleX: selection.obb.scaleX,
      scaleY: selection.obb.scaleY,
    };
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

    const { flipEnabled } = api.getAppState();
    if (flipEnabled) {
      mat3.translate(newTr, newTr, [newAttrs.x, newAttrs.y]);
      mat3.rotate(newTr, newTr, newAttrs.rotation);
      mat3.scale(newTr, newTr, [newScaleX, newScaleY]);
    } else {
      mat3.translate(newTr, newTr, [newAttrs.x, newAttrs.y]);
      mat3.rotate(newTr, newTr, newAttrs.rotation);
      mat3.translate(newTr, newTr, [
        newAttrs.width < 0 ? newAttrs.width : 0,
        newAttrs.height < 0 ? newAttrs.height : 0,
      ]);
      mat3.scale(newTr, newTr, [Math.abs(newScaleX), Math.abs(newScaleY)]);
    }

    // Borrow from Konva.js
    // @see https://github.com/konvajs/konva/blob/9a9bd00cd377a6d12cce3ee7c9fbf906afa55de5/src/shapes/Transformer.ts#L1103
    // [delta transform] = [new transform] * [old transform inverted]
    const delta = mat3.multiply(
      newTr,
      newTr,
      mat3.invert(mat3.create(), oldTr),
    );

    selecteds.forEach((selected) => {
      const node = api.getNodeByEntity(selected);
      const oldNode = selection.nodes.find((n) => n.id === node.id);
      // for each node we have the same [delta transform]
      // the equations is
      // [delta transform] * [parent transform] * [old local transform] = [parent transform] * [new local transform]
      // and we need to find [new local transform]
      // [new local] = [parent inverted] * [delta] * [parent] * [old local]
      const parentTransform = api.getParentTransform(selected);
      const localTransform = api.getTransform(oldNode);

      const newLocalTransform = mat3.create();
      mat3.multiply(newLocalTransform, parentTransform, localTransform);
      mat3.multiply(newLocalTransform, delta, newLocalTransform);
      mat3.multiply(
        newLocalTransform,
        mat3.invert(mat3.create(), parentTransform),
        newLocalTransform,
      );

      const { rotation, translation, scale } = decompose(newLocalTransform);

      const obb = {
        x: translation[0],
        y: translation[1],
        width: Math.max(oldNode.width * scale[0], epsilon),
        height: Math.max(oldNode.height * scale[1], epsilon),
        rotation,
        scaleX: oldAttrs.scaleX * (Math.sign(width) || 1),
        scaleY: oldAttrs.scaleY * (Math.sign(height) || 1),
      };

      api.updateNodeOBB(
        node,
        obb,
        node.lockAspectRatio,
        newLocalTransform,
        oldNode,
      );
      selection.obb.scaleX = obb.scaleX;
      selection.obb.scaleY = obb.scaleY;

      updateGlobalTransform(selected);
      updateComputedPoints(selected);
    });
  }

  private createSnapPoints(
    camera: Entity,
    snapLines: { type: string; points: [number, number][] }[],
  ) {
    safeAddComponent(camera, Snap);

    [...camera.read(Snap).points].forEach((point) => {
      point.add(ToBeDeleted);
      point.remove(SnapPoint);
    });

    snapLines.forEach(({ type, points }) => {
      if (type === 'points') {
        const snapPoint = this.commands.spawn(new SnapPoint()).id();
        this.commands.execute();
        snapPoint.write(SnapPoint).camera = camera;
        snapPoint.write(SnapPoint).points = points;
      }
    });

    this.commands.execute();
  }
}
