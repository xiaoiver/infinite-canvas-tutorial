// @see https://gist.github.com/mattdesl/47412d930dcd8cd765c871a65532ffac
import distanceBetweenPointAndLineSegment from 'point-to-segment-2d';
import { Entity, System } from '@lastolivegames/becsy';
import { mat3, vec2 } from 'gl-matrix';
import { IPointData } from '@pixi/math';
import {
  Children,
  Circle,
  ComputedBounds,
  FillSolid,
  GlobalTransform,
  Mat3,
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
  Canvas,
  ComputedCamera,
  Transformable,
} from '../components';
import { Commands } from '../commands';
import { getSceneRoot } from './Transform';
import { API } from '..';
import { inside } from '../utils/math';
import { distanceBetweenPoints } from '../utils/matrix';

export const TRANSFORMER_Z_INDEX = 100000;
const TRANSFORMER_ANCHOR_RADIUS = 5;
export const TRANSFORMER_ANCHOR_ROTATE_RADIUS = 20;
export const TRANSFORMER_ANCHOR_RESIZE_RADIUS = 10;
// --spectrum-thumbnail-border-color-selected
export const TRANSFORMER_ANCHOR_STROKE_COLOR = '#147af3';
export const TRANSFORMER_ANCHOR_FILL_COLOR = 'white';

export enum AnchorName {
  TOP_LEFT = 'top-left',
  TOP_RIGHT = 'top-right',
  BOTTOM_LEFT = 'bottom-left',
  BOTTOM_RIGHT = 'bottom-right',
  TOP_CENTER = 'top-center',
  MIDDLE_LEFT = 'middle-left',
  MIDDLE_RIGHT = 'middle-right',
  BOTTOM_CENTER = 'bottom-center',
  INSIDE = 'inside',
  OUTSIDE = 'outside',
}

/**
 * @see https://github.com/konvajs/konva/blob/master/src/shapes/Transformer.ts
 */
export class RenderTransformer extends System {
  private readonly commands = new Commands(this);

  private readonly selected = this.query((q) =>
    q.added.and.removed.with(Selected),
  );

  private readonly bounds = this.query(
    (q) => q.changed.with(ComputedBounds).trackWrites,
  );

  constructor() {
    super();

    this.query(
      (q) =>
        q
          .using(Canvas, ComputedBounds, GlobalTransform, ComputedCamera)
          .read.and.using(
            Canvas,
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
          ).write,
    );
  }

  createOrUpdate(camera: Entity) {
    if (!camera.has(Transformable)) {
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
        )
        .id()
        .hold();

      const tlAnchor = this.createAnchor(0, 0, AnchorName.TOP_LEFT);
      const trAnchor = this.createAnchor(0, 0, AnchorName.TOP_RIGHT);
      const blAnchor = this.createAnchor(0, 0, AnchorName.BOTTOM_LEFT);
      const brAnchor = this.createAnchor(0, 0, AnchorName.BOTTOM_RIGHT);

      camera.add(Transformable, {
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

    const { mask, tlAnchor, trAnchor, blAnchor, brAnchor, selecteds } =
      camera.read(Transformable);
    if (selecteds.length === 1) {
      const [selected] = selecteds;
      const { geometryBounds } = selected.read(ComputedBounds);
      const { minX, minY, maxX, maxY } = geometryBounds;
      const width = maxX - minX;
      const height = maxY - minY;
      const { translation, scale, rotation } = selected.read(Transform);
      // const matrix = Mat3.toGLMat3(selected.read(GlobalTransform).matrix);
      // const points = [
      //   vec2.transformMat3(vec2.create(), [minX, minY], matrix), // tl
      //   vec2.transformMat3(vec2.create(), [maxX, minY], matrix), // tr
      //   vec2.transformMat3(vec2.create(), [minX, maxY], matrix), // bl
      //   vec2.transformMat3(vec2.create(), [maxX, maxY], matrix), // br
      // ];

      Object.assign(mask.write(Rect), {
        x: minX,
        y: minY,
        width,
        height,
      });
      Object.assign(mask.write(Transform), {
        translation,
        scale,
        rotation,
      });

      Object.assign(tlAnchor.write(Circle), {
        cx: minX,
        cy: minY,
      });

      Object.assign(trAnchor.write(Circle), {
        cx: maxX,
        cy: minY,
      });

      Object.assign(blAnchor.write(Circle), {
        cx: minX,
        cy: maxY,
      });

      Object.assign(brAnchor.write(Circle), {
        cx: maxX,
        cy: maxY,
      });
    } else {
      selecteds.forEach((selected) => {});
    }
  }

  execute() {
    const camerasToUpdate = new Set<Entity>();

    this.selected.added.forEach((selected) => {
      camerasToUpdate.add(selected.read(Selected).camera);
    });

    this.selected.removed.forEach((selected) => {
      const camera = getSceneRoot(selected);
      camerasToUpdate.add(camera);
    });

    this.bounds.changed.forEach((entity) => {
      if (entity.has(Selected)) {
        const camera = getSceneRoot(entity);
        camerasToUpdate.add(camera);
      }
    });

    camerasToUpdate.forEach((camera) => {
      this.createOrUpdate(camera);
    });
  }

  private createAnchor(cx: number, cy: number, name: string) {
    return this.commands
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
      )
      .id()
      .hold();
  }

  getOBB(camera: Entity) {
    const { mask, selecteds } = camera.read(Transformable);
    const rotation = mask.read(Transform).rotation;

    if (selecteds.length === 1) {
      const [selected] = selecteds;
      const { geometryBounds } = selected.read(ComputedBounds);
      return new OBB(
        geometryBounds.minX,
        geometryBounds.minY,
        geometryBounds.maxX,
        geometryBounds.maxY,
        rotation,
      );
    }

    const totalPoints: [number, number][] = [];
    selecteds.forEach((selected) => {
      const { geometryBounds } = selected.read(ComputedBounds);
      const { minX, minY, maxX, maxY } = geometryBounds;
      const points = [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
      ];
      const matrix = Mat3.toGLMat3(selected.read(GlobalTransform).matrix);
      points.forEach(function (point: [number, number]) {
        const transformed = vec2.transformMat3(vec2.create(), point, matrix);
        totalPoints.push([transformed[0], transformed[1]]);
      });
    });

    const tr = mat3.create();
    mat3.rotate(tr, tr, -rotation);

    let minX: number = Infinity,
      minY: number = Infinity,
      maxX: number = -Infinity,
      maxY: number = -Infinity;
    totalPoints.forEach(function (point) {
      const transformed = vec2.transformMat3(vec2.create(), point, tr);
      if (minX === undefined) {
        minX = maxX = transformed[0];
        minY = maxY = transformed[1];
      }
      minX = Math.min(minX, transformed[0]);
      minY = Math.min(minY, transformed[1]);
      maxX = Math.max(maxX, transformed[0]);
      maxY = Math.max(maxY, transformed[1]);
    });

    mat3.invert(tr, tr);
    const p = vec2.transformMat3(vec2.create(), [minX, minY], tr);
    return new OBB(
      p[0],
      p[1],
      p[0] + (maxX - minX),
      p[1] + (maxY - minY),
      rotation,
    );
  }

  /**
   * Calculate anchor's position in canvas coordinate, account for transformer's transform.
   */
  getAnchorPositionInCanvas(camera: Entity, anchor: Entity): IPointData {
    const { mask } = camera.read(Transformable);
    const matrix = Mat3.toGLMat3(mask.read(GlobalTransform).matrix);
    const [x, y] = vec2.transformMat3(
      vec2.create(),
      [anchor.read(Circle).cx, anchor.read(Circle).cy],
      matrix,
    );
    return {
      x,
      y,
    };
  }

  canvas2LocalTransform(camera: Entity, point: IPointData, worldMatrix?: mat3) {
    const { mask } = camera.read(Transformable);
    const matrix =
      worldMatrix || Mat3.toGLMat3(mask.read(GlobalTransform).matrix);
    const invMatrix = mat3.invert(mat3.create(), matrix);
    const [x, y] = vec2.transformMat3(
      vec2.create(),
      [point.x, point.y],
      invMatrix,
    );
    return { x, y };
  }

  /**
   * Hit test with transformer, return anchor name and cursor.
   */
  hitTest(api: API, { x, y }: IPointData) {
    const point = [x, y] as [number, number];
    const { tlAnchor, trAnchor, blAnchor, brAnchor } = api
      .getCamera()
      .read(Transformable);

    const { x: tlX, y: tlY } = api.canvas2Viewport(
      this.getAnchorPositionInCanvas(api.getCamera(), tlAnchor),
    );
    const { x: trX, y: trY } = api.canvas2Viewport(
      this.getAnchorPositionInCanvas(api.getCamera(), trAnchor),
    );
    const { x: blX, y: blY } = api.canvas2Viewport(
      this.getAnchorPositionInCanvas(api.getCamera(), blAnchor),
    );
    const { x: brX, y: brY } = api.canvas2Viewport(
      this.getAnchorPositionInCanvas(api.getCamera(), brAnchor),
    );

    const isInside = inside(point, [
      [tlX, tlY],
      [trX, trY],
      [brX, brY],
      [blX, blY],
    ]);

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
