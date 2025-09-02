// @see https://gist.github.com/mattdesl/47412d930dcd8cd765c871a65532ffac
import distanceBetweenPointAndLineSegment from 'point-to-segment-2d';
import { Entity, System } from '@lastolivegames/becsy';
import { IPointData } from '@pixi/math';
import {
  Children,
  Circle,
  ComputedBounds,
  FillSolid,
  GlobalTransform,
  Name,
  OBB,
  Opacity,
  Parent,
  Rect,
  Renderable,
  Selected,
  SizeAttenuation,
  Stroke,
  StrokeAttenuation,
  ToBeDeleted,
  Transform,
  UI,
  UIType,
  ZIndex,
  Transformable,
  AnchorName,
  Visibility,
  Text,
  Camera,
  Anchor,
  Polyline,
  VectorNetwork,
  FractionalIndex,
  Canvas,
  Pen,
  Mat3,
  ComputedCamera,
} from '../components';
import { Commands } from '../commands';
import { updateGlobalTransform } from './Transform';
import { API } from '../API';
import { inside } from '../utils/math';
import { distanceBetweenPoints } from '../utils/matrix';
import { TRANSFORMER_Z_INDEX } from '../context';
import { safeAddComponent } from '../history';
import { vec2 } from 'gl-matrix';

const TRANSFORMER_ANCHOR_RADIUS = 5;
export const TRANSFORMER_ANCHOR_ROTATE_RADIUS = 20;
export const TRANSFORMER_ANCHOR_RESIZE_RADIUS = 5;
// --spectrum-thumbnail-border-color-selected
export const TRANSFORMER_MASK_FILL_COLOR = '#e0f2ff';
export const TRANSFORMER_ANCHOR_STROKE_COLOR = '#147af3';
export const TRANSFORMER_ANCHOR_FILL_COLOR = 'white';

/**
 * @see https://github.com/konvajs/konva/blob/master/src/shapes/Transformer.ts
 */
export class RenderTransformer extends System {
  private readonly commands = new Commands(this);

  private readonly cameras = this.query((q) =>
    q.current.and.added.with(Camera),
  );

  private readonly selected = this.query((q) =>
    q.current.and.added.and.removed.with(Selected),
  );

  private readonly bounds = this.query(
    (q) => q.changed.with(ComputedBounds).trackWrites,
  );

  constructor() {
    super();

    this.query(
      (q) =>
        q
          .using(ComputedBounds, Camera, FractionalIndex, Polyline)
          .read.and.using(
            Canvas,
            GlobalTransform,
            Transformable,
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
            Circle,
            ZIndex,
            SizeAttenuation,
            StrokeAttenuation,
            ToBeDeleted,
            Name,
            Visibility,
            Anchor,
            VectorNetwork,
          ).write,
    );
  }

  createOrUpdate(camera: Entity) {
    safeAddComponent(camera, Transformable);

    const { canvas } = camera.read(Camera);
    const { api } = canvas.read(Canvas);
    const pen = api.getAppState().penbarSelected;

    const transformable = camera.write(Transformable);

    if (pen === Pen.VECTOR_NETWORK) {
      const { selecteds } = camera.read(Transformable);
      const selected = selecteds[0];

      const { vertices, segments } = selected.read(VectorNetwork);

      const toCreateAnchorNumber =
        vertices.length - (transformable.controlPoints?.length ?? 0);
      if (toCreateAnchorNumber > 0) {
        const controlPoints = [];
        for (let i = 0; i < toCreateAnchorNumber; i++) {
          const anchor = this.createAnchor(
            camera,
            vertices[i].x,
            vertices[i].y,
            AnchorName.CONTROL,
          );
          this.commands
            .entity(camera)
            .appendChild(this.commands.entity(anchor));
          controlPoints.push(anchor);
        }

        Object.assign(transformable, {
          controlPoints: [
            ...(transformable.controlPoints ?? []),
            ...controlPoints,
          ],
        });

        this.commands.execute();
      } else {
        // Remove redundant control points
        for (let i = 0; i < Math.abs(toCreateAnchorNumber); i++) {
          const anchor = transformable.controlPoints.pop();
          if (anchor) {
            anchor.add(ToBeDeleted);
          }
        }
      }

      const matrix = Mat3.toGLMat3(selected.read(GlobalTransform).matrix);
      transformable.controlPoints.forEach((controlPoint, i) => {
        const { x, y } = vertices[i];
        const transformed = vec2.transformMat3(vec2.create(), [x, y], matrix);
        Object.assign(controlPoint.write(Circle), {
          cx: transformed[0],
          cy: transformed[1],
        });
        controlPoint.write(Visibility).value = 'visible';
        updateGlobalTransform(controlPoint);
      });
    } else {
      if (!transformable.mask) {
        const mask = this.commands
          .spawn(
            new UI(UIType.TRANSFORMER_MASK),
            new Transform(),
            new Renderable(),
            new FillSolid(TRANSFORMER_ANCHOR_FILL_COLOR),
            new Opacity({ fillOpacity: 0 }),
            new Stroke({ width: 1, color: TRANSFORMER_ANCHOR_STROKE_COLOR }),
            new Rect(),
            new StrokeAttenuation(),
            new ZIndex(TRANSFORMER_Z_INDEX),
            new Visibility(),
          )
          .id()
          .hold();

        const tlAnchor = this.createAnchor(camera, 0, 0, AnchorName.TOP_LEFT);
        const trAnchor = this.createAnchor(camera, 0, 0, AnchorName.TOP_RIGHT);
        const blAnchor = this.createAnchor(
          camera,
          0,
          0,
          AnchorName.BOTTOM_LEFT,
        );
        const brAnchor = this.createAnchor(
          camera,
          0,
          0,
          AnchorName.BOTTOM_RIGHT,
        );

        Object.assign(transformable, {
          mask,
          tlAnchor,
          trAnchor,
          blAnchor,
          brAnchor,
        });

        this.commands
          .entity(mask)
          .appendChild(this.commands.entity(tlAnchor))
          .appendChild(this.commands.entity(trAnchor))
          .appendChild(this.commands.entity(blAnchor))
          .appendChild(this.commands.entity(brAnchor));

        this.commands.entity(camera).appendChild(this.commands.entity(mask));
        this.commands.execute();
      }

      const { x, y, width, height, rotation, scaleX, scaleY } =
        this.getOBB(camera);

      const { mask, tlAnchor, trAnchor, blAnchor, brAnchor } =
        camera.read(Transformable);

      if (width === 0 && height === 0) {
        mask.write(Visibility).value = 'hidden';
        return;
      }

      mask.write(Visibility).value = 'visible';

      Object.assign(mask.write(Rect), {
        x: 0,
        y: 0,
        width,
        height,
      });
      Object.assign(mask.write(Transform), {
        translation: {
          x,
          y,
        },
        rotation,
        scale: {
          x: scaleX,
          y: scaleY,
        },
      });

      Object.assign(tlAnchor.write(Circle), {
        cx: 0,
        cy: 0,
      });

      Object.assign(trAnchor.write(Circle), {
        cx: width,
        cy: 0,
      });

      Object.assign(blAnchor.write(Circle), {
        cx: 0,
        cy: height,
      });

      Object.assign(brAnchor.write(Circle), {
        cx: width,
        cy: height,
      });

      updateGlobalTransform(mask);
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

      const { api } = canvas.read(Canvas);
      const pen = api.getAppState().penbarSelected;
      if (camera.has(Transformable)) {
        if (pen !== Pen.SELECT) {
          // Clear transformer
          const { mask } = camera.read(Transformable);
          if (mask) {
            mask.write(Visibility).value = 'hidden';
          }
        }
        if (pen !== Pen.VECTOR_NETWORK) {
          const { controlPoints } = camera.read(Transformable);
          controlPoints &&
            controlPoints.forEach((controlPoint) => {
              controlPoint.write(Visibility).value = 'hidden';
            });
        }
      }
    });

    const camerasToUpdate = new Set<Entity>();
    this.cameras.added.forEach((camera) => {
      camerasToUpdate.add(camera);
    });

    this.selected.added.forEach((selected) => {
      camerasToUpdate.add(selected.read(Selected).camera);
    });

    this.selected.removed.forEach((selected) => {
      this.accessRecentlyDeletedData();
      camerasToUpdate.add(selected.read(Selected).camera);
    });
    // Backrefs field Transformable.selecteds not configured to track recently deleted refs
    this.accessRecentlyDeletedData(false);

    this.bounds.changed.forEach((entity) => {
      if (entity.has(Selected)) {
        camerasToUpdate.add(entity.read(Selected).camera);
      }
    });

    camerasToUpdate.forEach((camera) => {
      this.createOrUpdate(camera);
    });
  }

  private createAnchor(camera: Entity, cx: number, cy: number, name: string) {
    const anchor = this.commands
      .spawn(
        new UI(UIType.TRANSFORMER_ANCHOR),
        new Name(name),
        new Transform(),
        new Renderable(),
        new FillSolid(TRANSFORMER_ANCHOR_FILL_COLOR),
        new Stroke({ width: 1, color: TRANSFORMER_ANCHOR_STROKE_COLOR }),
        new Circle({
          cx,
          cy,
          r: TRANSFORMER_ANCHOR_RADIUS,
        }),
        new SizeAttenuation(),
        new Visibility(),
      )
      .id()
      .hold();

    // FIXME:
    if (name === AnchorName.CONTROL) {
      anchor.add(Anchor, { camera });
      anchor.add(ZIndex, { value: TRANSFORMER_Z_INDEX });
    }

    return anchor;
  }

  /**
   * Hit test with transformer, return anchor name and cursor.
   */
  hitTest(api: API, { x, y }: IPointData) {
    const camera = api.getCamera();
    const { rotateEnabled, penbarSelected } = api.getAppState();
    const point = [x, y] as [number, number];
    const { tlAnchor, trAnchor, blAnchor, brAnchor, controlPoints } =
      camera.read(Transformable);

    if (penbarSelected === Pen.VECTOR_NETWORK) {
      for (let i = 0; i < controlPoints.length; i++) {
        const { cx, cy } = controlPoints[i].read(Circle);
        const { x: xx, y: yy } = api.canvas2Viewport({
          x: cx,
          y: cy,
        });
        const distance = distanceBetweenPoints(x, y, xx, yy);
        if (distance <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
          return {
            anchor: AnchorName.CONTROL,
            cursor: 'default',
            index: i,
          };
        }
      }

      return {
        anchor: AnchorName.OUTSIDE,
        cursor: 'default',
        index: -1,
      };
    } else {
      const { x: tlX, y: tlY } = api.canvas2Viewport(
        api.transformer2Canvas({
          x: tlAnchor.read(Circle).cx,
          y: tlAnchor.read(Circle).cy,
        }),
      );
      const { x: trX, y: trY } = api.canvas2Viewport(
        api.transformer2Canvas({
          x: trAnchor.read(Circle).cx,
          y: trAnchor.read(Circle).cy,
        }),
      );
      const { x: blX, y: blY } = api.canvas2Viewport(
        api.transformer2Canvas({
          x: blAnchor.read(Circle).cx,
          y: blAnchor.read(Circle).cy,
        }),
      );
      const { x: brX, y: brY } = api.canvas2Viewport(
        api.transformer2Canvas({
          x: brAnchor.read(Circle).cx,
          y: brAnchor.read(Circle).cy,
        }),
      );

      const isInside = inside(point, [
        [tlX, tlY],
        [trX, trY],
        [brX, brY],
        [blX, blY],
      ]);

      // Text's transform is not supported yet.
      const { selecteds } = camera.read(Transformable);
      if (selecteds.length === 1 && selecteds[0].has(Text)) {
        if (isInside) {
          return {
            anchor: AnchorName.INSIDE,
            cursor: 'default',
          };
        } else {
          return {
            anchor: AnchorName.OUTSIDE,
            cursor: 'default',
          };
        }
      }

      const distanceToTL = distanceBetweenPoints(x, y, tlX, tlY);
      const distanceToTR = distanceBetweenPoints(x, y, trX, trY);
      const distanceToBL = distanceBetweenPoints(x, y, blX, blY);
      const distanceToBR = distanceBetweenPoints(x, y, brX, brY);

      const minDistanceToAnchors = Math.min(
        distanceToTL,
        distanceToTR,
        distanceToBL,
        distanceToBR,
      );

      if (minDistanceToAnchors <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
        if (minDistanceToAnchors === distanceToTL) {
          return {
            anchor: AnchorName.TOP_LEFT,
            cursor: 'nwse-resize',
          };
        } else if (minDistanceToAnchors === distanceToTR) {
          return {
            anchor: AnchorName.TOP_RIGHT,
            cursor: 'nesw-resize',
          };
        } else if (minDistanceToAnchors === distanceToBL) {
          return {
            anchor: AnchorName.BOTTOM_LEFT,
            cursor: 'nesw-resize',
          };
        } else if (minDistanceToAnchors === distanceToBR) {
          return {
            anchor: AnchorName.BOTTOM_RIGHT,
            cursor: 'nwse-resize',
          };
        }
      } else if (
        rotateEnabled &&
        !isInside &&
        minDistanceToAnchors <= TRANSFORMER_ANCHOR_ROTATE_RADIUS
      ) {
        if (minDistanceToAnchors === distanceToTL) {
          return {
            anchor: AnchorName.TOP_LEFT,
            cursor: 'nwse-rotate',
          };
        } else if (minDistanceToAnchors === distanceToTR) {
          return {
            anchor: AnchorName.TOP_RIGHT,
            cursor: 'nesw-rotate',
          };
        } else if (minDistanceToAnchors === distanceToBL) {
          return {
            anchor: AnchorName.BOTTOM_LEFT,
            cursor: 'swne-rotate',
          };
        } else if (minDistanceToAnchors === distanceToBR) {
          return {
            anchor: AnchorName.BOTTOM_RIGHT,
            cursor: 'senw-rotate',
          };
        }
      }

      const distanceToTopEdge = distanceBetweenPointAndLineSegment(
        point,
        [tlX, tlY],
        [trX, trY],
      );

      const distanceToBottomEdge = distanceBetweenPointAndLineSegment(
        point,
        [blX, blY],
        [brX, brY],
      );

      const distanceToLeftEdge = distanceBetweenPointAndLineSegment(
        point,
        [tlX, tlY],
        [blX, blY],
      );

      const distanceToRightEdge = distanceBetweenPointAndLineSegment(
        point,
        [trX, trY],
        [brX, brY],
      );

      const minDistanceToEdges = Math.min(
        distanceToTopEdge,
        distanceToBottomEdge,
        distanceToLeftEdge,
        distanceToRightEdge,
      );

      if (minDistanceToEdges <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
        if (minDistanceToEdges === distanceToTopEdge) {
          return {
            anchor: AnchorName.TOP_CENTER,
            cursor: 'ns-resize',
          };
        } else if (minDistanceToEdges === distanceToBottomEdge) {
          return {
            anchor: AnchorName.BOTTOM_CENTER,
            cursor: 'ns-resize',
          };
        } else if (minDistanceToEdges === distanceToLeftEdge) {
          return {
            anchor: AnchorName.MIDDLE_LEFT,
            cursor: 'ew-resize',
          };
        } else if (minDistanceToEdges === distanceToRightEdge) {
          return {
            anchor: AnchorName.MIDDLE_RIGHT,
            cursor: 'ew-resize',
          };
        }
      }

      if (isInside) {
        return {
          anchor: AnchorName.INSIDE,
          cursor: 'default',
        };
      } else {
        return {
          anchor: AnchorName.OUTSIDE,
          cursor: 'default',
        };
      }
    }
  }

  getOBB(camera: Entity): OBB {
    const { selecteds } = camera.read(Transformable);

    if (selecteds.length === 1) {
      const selected = selecteds[0];
      if (selected.has(ComputedBounds)) {
        const { obb } = selected.read(ComputedBounds);

        return {
          x: obb.x,
          y: obb.y,
          width: obb.width,
          height: obb.height,
          rotation: obb.rotation,
          scaleX: obb.scaleX,
          scaleY: obb.scaleY,
        };
      }
    } else {
      // const rotation = mask.read(Transform).rotation;
      // const totalPoints: [number, number][] = [];
      // selecteds.forEach((selected) => {
      //   const { geometryBounds } = selected.read(ComputedBounds);
      //   const { minX, minY, maxX, maxY } = geometryBounds;
      //   const points = [
      //     [minX, minY],
      //     [maxX, minY],
      //     [maxX, maxY],
      //     [minX, maxY],
      //   ];
      //   const matrix = Mat3.toGLMat3(selected.read(GlobalTransform).matrix);
      //   points.forEach(function (point: [number, number]) {
      //     const transformed = vec2.transformMat3(vec2.create(), point, matrix);
      //     totalPoints.push([transformed[0], transformed[1]]);
      //   });
      // });
      // const tr = mat3.create();
      // mat3.rotate(tr, tr, -rotation);
      // let minX: number = Infinity,
      //   minY: number = Infinity,
      //   maxX: number = -Infinity,
      //   maxY: number = -Infinity;
      // totalPoints.forEach(function (point) {
      //   const transformed = vec2.transformMat3(vec2.create(), point, tr);
      //   if (minX === undefined) {
      //     minX = maxX = transformed[0];
      //     minY = maxY = transformed[1];
      //   }
      //   minX = Math.min(minX, transformed[0]);
      //   minY = Math.min(minY, transformed[1]);
      //   maxX = Math.max(maxX, transformed[0]);
      //   maxY = Math.max(maxY, transformed[1]);
      // });
      // mat3.invert(tr, tr);
      // // const p = vec2.transformMat3(vec2.create(), [minX, minY], tr);
      // const nodeRect = {
      //   // x: p[0],
      //   // y: p[1],
      //   width: maxX - minX,
      //   height: maxY - minY,
      //   rotation,
      // };
      // // this.#nodeRectCache.set(camera, nodeRect);
      // return nodeRect;
    }

    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    };
  }
}
