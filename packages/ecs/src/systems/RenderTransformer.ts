// @see https://gist.github.com/mattdesl/47412d930dcd8cd765c871a65532ffac
import distanceBetweenPointAndLineSegment from 'point-to-segment-2d';
import { Entity, System } from '@lastolivegames/becsy';
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
} from '../components';
import { mat3 } from 'gl-matrix';
import { Commands } from '../commands';
import { getDescendants, getSceneRoot } from './Transform';
import { vec2 } from 'gl-matrix';
import { API } from '..';
import { inside } from '../utils/math';
import { distanceBetweenPoints } from '../utils/matrix';

export const TRANSFORMER_Z_INDEX = 100000;
const TRANSFORMER_ANCHOR_RADIUS = 5;
export const TRANSFORMER_ANCHOR_ROTATE_RADIUS = 20;
export const TRANSFORMER_ANCHOR_RESIZE_RADIUS = 10;

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
    q.added.and.removed.and.current.with(Selected),
  );

  private readonly bounds = this.query(
    (q) => q.changed.with(ComputedBounds).trackWrites,
  );

  #transformers = new WeakMap<Entity, Entity>();

  constructor() {
    super();

    this.query(
      (q) =>
        q
          .using(ComputedBounds)
          .read.and.using(
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

  getTransformer(entity: Entity) {
    if (this.#transformers.has(entity)) {
      return this.#transformers.get(entity);
    }
    return null;
  }

  execute() {
    this.selected.added.forEach((entity) => {
      // Group
      if (!entity.has(ComputedBounds)) {
        return;
      }

      const { geometryBounds } = entity.read(ComputedBounds);
      const { minX, minY, maxX, maxY } = geometryBounds;
      const width = maxX - minX;
      const height = maxY - minY;
      const { rotation } = entity.read(Transform);

      const transformer = this.commands
        .spawn(
          new UI(UIType.TRANSFORMER_MASK),
          new Transform({
            rotation,
          }),
          new Renderable(),
          new FillSolid('white'), // --spectrum-blue-100
          new Opacity({ fillOpacity: 0 }),
          new Stroke({ width: 1, color: '#147af3' }), // --spectrum-thumbnail-border-color-selected
          new Rect({
            x: minX,
            y: minY,
            width,
            height,
          }),
          new ZIndex(TRANSFORMER_Z_INDEX),
          new StrokeAttenuation(),
        )
        .id()
        .hold();

      const tlAnchor = this.createAnchor(minX, minY, AnchorName.TOP_LEFT);
      const trAnchor = this.createAnchor(maxX, minY, AnchorName.TOP_RIGHT);
      const blAnchor = this.createAnchor(minX, maxY, AnchorName.BOTTOM_LEFT);
      const brAnchor = this.createAnchor(maxX, maxY, AnchorName.BOTTOM_RIGHT);

      const transformEntity = this.commands.entity(transformer);
      transformEntity.appendChild(this.commands.entity(tlAnchor));
      transformEntity.appendChild(this.commands.entity(trAnchor));
      transformEntity.appendChild(this.commands.entity(blAnchor));
      transformEntity.appendChild(this.commands.entity(brAnchor));

      this.commands.execute();

      const camera = this.commands.entity(getSceneRoot(entity));
      camera.appendChild(this.commands.entity(transformer));

      this.commands.execute();

      this.#transformers.set(entity, transformer);
    });

    this.selected.removed.forEach((entity) => {
      if (this.#transformers.has(entity)) {
        const transformer = this.#transformers.get(entity);

        transformer.add(ToBeDeleted);
        getDescendants(transformer).forEach((child) => {
          child.add(ToBeDeleted);
        });

        this.#transformers.delete(entity);
      }
    });

    this.bounds.changed.forEach((entity) => {
      if (entity.has(Selected)) {
        const transformer = this.#transformers.get(entity);

        const { geometryBounds } = entity.read(ComputedBounds);
        const { minX, minY, maxX, maxY } = geometryBounds;
        const width = maxX - minX;
        const height = maxY - minY;
        const { rotation } = entity.read(Transform);

        Object.assign(transformer.write(Rect), {
          x: minX,
          y: minY,
          width,
          height,
        });

        const [tlAnchor, trAnchor, blAnchor, brAnchor] =
          transformer.read(Parent).children;

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
      }
    });
  }

  private createAnchor(cx: number, cy: number, name: string) {
    return this.commands
      .spawn(
        new UI(UIType.TRANSFORMER_ANCHOR),
        new Name(name),
        new Transform(),
        new Renderable(),
        new FillSolid('#fff'),
        new Stroke({ width: 1, color: '#147af3' }),
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

  getOBB() {
    const transformer = this.getTransformer(this.selected.current[0]);
    const rotation = transformer.read(Transform).rotation;
    const totalPoints: [number, number][] = [];
    this.selected.current.forEach((selected) => {
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
   * Hit test with transformer, return anchor name and cursor.
   */
  hitTest(api: API, x: number, y: number) {
    const point = [x, y] as [number, number];

    const transformer = this.getTransformer(this.selected.current[0]);

    const [tlAnchor, trAnchor, blAnchor, brAnchor] =
      transformer.read(Parent).children;

    const tlAnchorViewport = api.canvas2Viewport({
      x: tlAnchor.read(Circle).cx,
      y: tlAnchor.read(Circle).cy,
    });

    const trAnchorViewport = api.canvas2Viewport({
      x: trAnchor.read(Circle).cx,
      y: trAnchor.read(Circle).cy,
    });

    const blAnchorViewport = api.canvas2Viewport({
      x: blAnchor.read(Circle).cx,
      y: blAnchor.read(Circle).cy,
    });

    const brAnchorViewport = api.canvas2Viewport({
      x: brAnchor.read(Circle).cx,
      y: brAnchor.read(Circle).cy,
    });

    const isInside = inside(point, [
      [tlAnchorViewport.x, tlAnchorViewport.y],
      [trAnchorViewport.x, trAnchorViewport.y],
      [brAnchorViewport.x, brAnchorViewport.y],
      [blAnchorViewport.x, blAnchorViewport.y],
    ]);

    const distanceToTL = distanceBetweenPoints(
      x,
      y,
      tlAnchorViewport.x,
      tlAnchorViewport.y,
    );
    const distanceToTR = distanceBetweenPoints(
      x,
      y,
      trAnchorViewport.x,
      trAnchorViewport.y,
    );
    const distanceToBL = distanceBetweenPoints(
      x,
      y,
      blAnchorViewport.x,
      blAnchorViewport.y,
    );
    const distanceToBR = distanceBetweenPoints(
      x,
      y,
      brAnchorViewport.x,
      brAnchorViewport.y,
    );

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
      [tlAnchorViewport.x, tlAnchorViewport.y],
      [trAnchorViewport.x, trAnchorViewport.y],
    );

    const distanceToBottomEdge = distanceBetweenPointAndLineSegment(
      point,
      [blAnchorViewport.x, blAnchorViewport.y],
      [brAnchorViewport.x, brAnchorViewport.y],
    );

    const distanceToLeftEdge = distanceBetweenPointAndLineSegment(
      point,
      [tlAnchorViewport.x, tlAnchorViewport.y],
      [blAnchorViewport.x, blAnchorViewport.y],
    );

    const distanceToRightEdge = distanceBetweenPointAndLineSegment(
      point,
      [trAnchorViewport.x, trAnchorViewport.y],
      [brAnchorViewport.x, brAnchorViewport.y],
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
