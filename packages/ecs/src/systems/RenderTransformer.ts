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
  TransformableStatus,
  AnchorName,
  Visibility,
  Text,
  Camera,
  Anchor,
  Polyline,
  Path,
  VectorNetwork,
  FractionalIndex,
  Canvas,
  Pen,
  Mat3,
  Line,
  ComputedCamera,
  ComputedPoints,
  Binding,
} from '../components';
import { Commands } from '../commands';
import { updateGlobalTransform } from './Transform';
import { API } from '../API';
import { inside } from '../utils/math';
import { distanceBetweenPoints } from '../utils/matrix';
import { TRANSFORMER_Z_INDEX } from '../context';
import { safeAddComponent } from '../history';
import { vec2 } from 'gl-matrix';
import {
  collectPathControlHandles,
  collectPathHandleLineSegments,
  normalizePathCommands,
} from '../utils/path-edit';

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
          .using(
            ComputedBounds,
            ComputedCamera,
            Camera,
            FractionalIndex,
            Polyline,
            Path,
            Line,
            ComputedPoints,
          )
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
            Polyline,
            Path,
            Circle,
            ZIndex,
            SizeAttenuation,
            StrokeAttenuation,
            ToBeDeleted,
            Name,
            Visibility,
            Anchor,
            VectorNetwork,
            Text,
            Line,
            Binding,
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

      const { vertices } = selected.read(VectorNetwork);
      this.syncControlPoints(camera, vertices.length, transformable);

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
      transformable.segmentMidpoints?.forEach((midpoint) => {
        midpoint.write(Visibility).value = 'hidden';
      });
      // } else if (pen === Pen.CROP) {
      //   if (!transformable.cropMask) {
      //     this.createCropMask(camera, transformable);
      //   }
      //   const { cropMask } = camera.read(Transformable);
      //   const { layersCropping } = api.getAppState();
      //   if (layersCropping.length === 0) {
      //     cropMask.write(Visibility).value = 'hidden';
      //     return;
      //   }
      //   this.updateCropMask(camera);
    } else {
      if (!transformable.lineMask) {
        this.createLineMask(camera, transformable);
      }
      if (!transformable.polylineMask) {
        this.createPolylineMask(camera, transformable);
      }
      if (!transformable.mask) {
        this.createRectMask(camera, transformable);
      }

      const { selecteds, mask, lineMask, polylineMask } =
        camera.read(Transformable);
      if (selecteds.length === 0) {
        mask.write(Visibility).value = 'hidden';
        lineMask.write(Visibility).value = 'hidden';
        polylineMask.write(Visibility).value = 'hidden';
        return;
      }

      if (usePolylineMask(camera)) {
        mask.write(Visibility).value = 'hidden';
        lineMask.write(Visibility).value = 'hidden';
        this.updatePolylineMask(camera);
      } else if (useLineMask(camera)) {
        mask.write(Visibility).value = 'hidden';
        polylineMask.write(Visibility).value = 'hidden';
        this.updateLineMask(camera);
      } else {
        lineMask.write(Visibility).value = 'hidden';
        polylineMask.write(Visibility).value = 'hidden';
        this.updateRectMask(camera);
      }
    }
  }

  private updatePolylineControlPoints(camera: Entity) {
    const transformable = camera.write(Transformable);
    const { selecteds, polylineMask } = camera.read(Transformable);

    const selected = selecteds.length === 1 ? selecteds[0] : undefined;
    const isEditablePathSelected = selected?.hasSomeOf(Polyline, Path);
    if (!isEditablePathSelected) {
      transformable.controlPoints?.forEach((controlPoint) => {
        controlPoint.write(Visibility).value = 'hidden';
      });
      transformable.segmentMidpoints?.forEach((midpoint) => {
        midpoint.write(Visibility).value = 'hidden';
      });
      transformable.pathHandleLines?.forEach((lineEntity) => {
        lineEntity.write(Visibility).value = 'hidden';
      });
      this.syncPathHandleLines(polylineMask, 0, transformable);
      transformable.controlPointMeta = [];
      transformable.pathControlCommands = [];
      return;
    }

    const matrix = Mat3.toGLMat3(selected.read(GlobalTransform).matrix);
    if (selected.has(Polyline)) {
      this.syncPathHandleLines(polylineMask, 0, transformable);
      const { points } = selected.read(Polyline);
      this.syncControlPoints(polylineMask, points.length, transformable);
      this.syncSegmentMidpoints(
        polylineMask,
        Math.max(points.length - 1, 0),
        transformable,
      );
      transformable.controlPointMeta = [];
      transformable.pathControlCommands = [];

      transformable.controlPoints.forEach((controlPoint, i) => {
        const point = points[i];
        if (!point) {
          controlPoint.write(Visibility).value = 'hidden';
          return;
        }

        const transformed = vec2.transformMat3(vec2.create(), point, matrix);
        Object.assign(controlPoint.write(Circle), {
          cx: transformed[0],
          cy: transformed[1],
        });
        controlPoint.write(Visibility).value = 'visible';
        updateGlobalTransform(controlPoint);
      });

      transformable.segmentMidpoints?.forEach((midpoint, i) => {
        const point1 = points[i];
        const point2 = points[i + 1];
        if (!point1 || !point2) {
          midpoint.write(Visibility).value = 'hidden';
          return;
        }
        const midX = (point1[0] + point2[0]) / 2;
        const midY = (point1[1] + point2[1]) / 2;
        const transformed = vec2.transformMat3(
          vec2.create(),
          [midX, midY],
          matrix,
        );
        Object.assign(midpoint.write(Circle), {
          cx: transformed[0],
          cy: transformed[1],
        });
        midpoint.write(Visibility).value = 'visible';
        updateGlobalTransform(midpoint);
      });
      return;
    }

    const commands = normalizePathCommands(selected.read(Path).d);
    const handles = collectPathControlHandles(commands);
    const handleLineSegments = collectPathHandleLineSegments(commands);
    this.syncPathHandleLines(polylineMask, handleLineSegments.length, transformable);
    this.syncControlPoints(polylineMask, handles.length, transformable);
    this.syncSegmentMidpoints(polylineMask, 0, transformable);
    transformable.pathControlCommands = commands as unknown as (string | number)[][];
    transformable.controlPointMeta = handles.map((handle) => handle.meta);

    const pathLines = transformable.pathHandleLines ?? [];
    handleLineSegments.forEach((seg, i) => {
      const lineEntity = pathLines[i];
      if (!lineEntity?.has(Line)) {
        return;
      }
      const p1 = vec2.transformMat3(vec2.create(), [seg.x1, seg.y1], matrix);
      const p2 = vec2.transformMat3(vec2.create(), [seg.x2, seg.y2], matrix);
      Object.assign(lineEntity.write(Line), {
        x1: p1[0],
        y1: p1[1],
        x2: p2[0],
        y2: p2[1],
      });
      lineEntity.write(Visibility).value = 'visible';
      updateGlobalTransform(lineEntity);
    });

    transformable.controlPoints.forEach((controlPoint, i) => {
      const handle = handles[i];
      if (!handle) {
        controlPoint.write(Visibility).value = 'hidden';
        return;
      }

      const transformed = vec2.transformMat3(
        vec2.create(),
        [handle.x, handle.y],
        matrix,
      );
      Object.assign(controlPoint.write(Circle), {
        cx: transformed[0],
        cy: transformed[1],
      });
      controlPoint.write(Visibility).value = 'visible';
      updateGlobalTransform(controlPoint);
    });
  }

  private syncControlPoints(
    parent: Entity,
    targetCount: number,
    transformable: Transformable,
  ) {
    const toCreateAnchorNumber =
      targetCount - (transformable.controlPoints?.length ?? 0);
    if (toCreateAnchorNumber > 0) {
      const controlPoints = [];
      for (let i = 0; i < toCreateAnchorNumber; i++) {
        const anchor = this.createAnchor(0, 0, AnchorName.CONTROL);
        this.commands.entity(parent).appendChild(this.commands.entity(anchor));
        controlPoints.push(anchor);
      }

      Object.assign(transformable, {
        controlPoints: [
          ...(transformable.controlPoints ?? []),
          ...controlPoints,
        ],
      });
      this.commands.execute();
      return;
    }

    if (toCreateAnchorNumber < 0) {
      // Remove redundant control points.
      for (let i = 0; i < Math.abs(toCreateAnchorNumber); i++) {
        const anchor = transformable.controlPoints.pop();
        if (anchor) {
          anchor.add(ToBeDeleted);
        }
      }
    }
  }

  private createPathHandleLine() {
    const lineEntity = this.commands
      .spawn(
        new UI(UIType.TRANSFORMER_MASK),
        new Name('path-handle-line'),
        new Transform(),
        new Renderable(),
        new Line({ x1: 0, y1: 0, x2: 0, y2: 0 }),
        new Stroke({
          width: 1,
          color: TRANSFORMER_ANCHOR_STROKE_COLOR,
          dasharray: [6, 6],
        }),
        new Opacity({ opacity: 0.45 }),
        new StrokeAttenuation(),
        new SizeAttenuation(),
        new ZIndex(TRANSFORMER_Z_INDEX - 2),
        new Visibility(),
      )
      .id()
      .hold();

    return lineEntity;
  }

  private syncPathHandleLines(
    parent: Entity,
    targetCount: number,
    transformable: Transformable,
  ) {
    const toCreate =
      targetCount - (transformable.pathHandleLines?.length ?? 0);
    if (toCreate > 0) {
      const pathHandleLines: Entity[] = [];
      for (let i = 0; i < toCreate; i++) {
        const lineEntity = this.createPathHandleLine();
        this.commands.entity(parent).appendChild(this.commands.entity(lineEntity));
        pathHandleLines.push(lineEntity);
      }

      Object.assign(transformable, {
        pathHandleLines: [
          ...(transformable.pathHandleLines ?? []),
          ...pathHandleLines,
        ],
      });
      this.commands.execute();
      return;
    }

    if (toCreate < 0) {
      for (let i = 0; i < Math.abs(toCreate); i++) {
        const lineEntity = transformable.pathHandleLines?.pop();
        if (lineEntity) {
          lineEntity.add(ToBeDeleted);
        }
      }
    }
  }

  private syncSegmentMidpoints(
    parent: Entity,
    targetCount: number,
    transformable: Transformable,
  ) {
    const toCreateAnchorNumber =
      targetCount - (transformable.segmentMidpoints?.length ?? 0);
    if (toCreateAnchorNumber > 0) {
      const segmentMidpoints = [];
      for (let i = 0; i < toCreateAnchorNumber; i++) {
        const anchor = this.createAnchor(0, 0, AnchorName.SEGMENT_MIDPOINT);
        this.commands.entity(parent).appendChild(this.commands.entity(anchor));
        segmentMidpoints.push(anchor);
      }

      Object.assign(transformable, {
        segmentMidpoints: [
          ...(transformable.segmentMidpoints ?? []),
          ...segmentMidpoints,
        ],
      });
      this.commands.execute();
      return;
    }

    if (toCreateAnchorNumber < 0) {
      for (let i = 0; i < Math.abs(toCreateAnchorNumber); i++) {
        const anchor = transformable.segmentMidpoints.pop();
        if (anchor) {
          anchor.add(ToBeDeleted);
        }
      }
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
          const { lineMask, polylineMask } = camera.read(Transformable);
          if (lineMask) {
            lineMask.write(Visibility).value = 'hidden';
          }
          if (polylineMask) {
            polylineMask.write(Visibility).value = 'hidden';
          }
        }
        if (pen !== Pen.VECTOR_NETWORK) {
          const { controlPoints, segmentMidpoints, pathHandleLines } =
            camera.read(Transformable);
          const { selecteds } = camera.read(Transformable);
          const isPolylineSelected =
            pen === Pen.SELECT &&
            selecteds.length === 1 &&
            selecteds[0].hasSomeOf(Polyline, Path) &&
            !(selecteds[0].has(Binding) && selecteds[0].has(Polyline));
          if (!isPolylineSelected) {
            controlPoints &&
              controlPoints.forEach((controlPoint) => {
                controlPoint.write(Visibility).value = 'hidden';
              });
            segmentMidpoints &&
              segmentMidpoints.forEach((midpoint) => {
                midpoint.write(Visibility).value = 'hidden';
              });
            pathHandleLines &&
              pathHandleLines.forEach((lineEntity) => {
                lineEntity.write(Visibility).value = 'hidden';
              });
          }
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
      // 选中 Group 时 bounds 写在 Group 上；子节点 resize 只触发子 ComputedBounds 变化
      let e: Entity | undefined = entity;
      while (e) {
        if (e.has(Selected)) {
          camerasToUpdate.add(e.read(Selected).camera);
          break;
        }
        if (!e.has(Children)) {
          break;
        }
        e = e.read(Children).parent;
      }
    });

    camerasToUpdate.forEach((camera) => {
      this.createOrUpdate(camera);
    });
  }

  private createAnchor(cx: number, cy: number, name: string) {
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
          r:
            name === AnchorName.SEGMENT_MIDPOINT
              ? TRANSFORMER_ANCHOR_RADIUS - 1
              : name === AnchorName.CENTER
                ? TRANSFORMER_ANCHOR_RADIUS - 1
                : TRANSFORMER_ANCHOR_RADIUS,
        }),
        new StrokeAttenuation(),
        new SizeAttenuation(),
        new Visibility(),
      )
      .id()
      .hold();

    return anchor;
  }

  private createRectMask(camera: Entity, transformable: Transformable) {
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

    const tlAnchor = this.createAnchor(0, 0, AnchorName.TOP_LEFT);
    const trAnchor = this.createAnchor(0, 0, AnchorName.TOP_RIGHT);
    const blAnchor = this.createAnchor(0, 0, AnchorName.BOTTOM_LEFT);
    const brAnchor = this.createAnchor(0, 0, AnchorName.BOTTOM_RIGHT);
    const centerAnchor = this.createAnchor(0, 0, AnchorName.CENTER);

    this.commands
      .entity(mask)
      .appendChild(this.commands.entity(tlAnchor))
      .appendChild(this.commands.entity(trAnchor))
      .appendChild(this.commands.entity(blAnchor))
      .appendChild(this.commands.entity(brAnchor))
      .appendChild(this.commands.entity(centerAnchor));

    this.commands.entity(camera).appendChild(this.commands.entity(mask));
    this.commands.execute();

    Object.assign(transformable, {
      mask,
      tlAnchor,
      trAnchor,
      blAnchor,
      brAnchor,
      centerAnchor,
    });
  }

  private updateRectMask(camera: Entity) {
    const { x, y, width, height, rotation, scaleX, scaleY } = getOBB(camera);

    const { tlAnchor, trAnchor, blAnchor, brAnchor, centerAnchor, mask } =
      camera.read(Transformable);

    // if (width === 0 && height === 0) {
    //   mask.write(Visibility).value = 'hidden';
    //   return;
    // }

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
    const tf = camera.write(Transformable);
    if (
      !tf.rotatePivotPinned ||
      Number.isNaN(tf.rotatePivotX) ||
      Number.isNaN(tf.rotatePivotY)
    ) {
      tf.rotatePivotX = width / 2;
      tf.rotatePivotY = height / 2;
    }
    Object.assign(centerAnchor.write(Circle), {
      cx: tf.rotatePivotX,
      cy: tf.rotatePivotY,
    });

    updateGlobalTransform(mask);
  }

  private createLineMask(camera: Entity, transformable: Transformable) {
    const lineMask = this.commands
      .spawn(
        new UI(UIType.TRANSFORMER_MASK),
        new Transform(),
        new Renderable(),
        new Opacity({ opacity: 0 }),
        new Rect(),
        new ZIndex(TRANSFORMER_Z_INDEX),
        new Visibility(),
      )
      .id()
      .hold();
    const x1y1Anchor = this.createAnchor(0, 0, AnchorName.X1Y1);
    const x2y2Anchor = this.createAnchor(0, 0, AnchorName.X2Y2);

    Object.assign(transformable, {
      lineMask,
      x1y1Anchor,
      x2y2Anchor,
    });

    this.commands
      .entity(lineMask)
      .appendChild(this.commands.entity(x1y1Anchor))
      .appendChild(this.commands.entity(x2y2Anchor));

    this.commands.entity(camera).appendChild(this.commands.entity(lineMask));
    this.commands.execute();
  }

  private updateLineMask(camera: Entity) {
    const { lineMask, x1y1Anchor, x2y2Anchor, selecteds } =
      camera.read(Transformable);
    const { x, y, width, height, rotation, scaleX, scaleY } = getOBB(camera);

    const selected = selecteds[0];
    let point1: [number, number];
    let point2: [number, number];
    if (selected.has(Polyline)) {
      const { points } = selected.read(Polyline);
      point1 = points[0];
      point2 = points[points.length - 1];
      if (selected.has(Binding)) {
        x1y1Anchor.write(Visibility).value = 'visible';
        x2y2Anchor.write(Visibility).value = 'visible';
      } else {
        x1y1Anchor.write(Visibility).value = 'hidden';
        x2y2Anchor.write(Visibility).value = 'hidden';
      }
    } else if (selected.has(Line)) {
      const { x1, y1, x2, y2 } = selected.read(Line);
      point1 = [x1, y1];
      point2 = [x2, y2];
      x1y1Anchor.write(Visibility).value = 'visible';
      x2y2Anchor.write(Visibility).value = 'visible';
    }

    lineMask.write(Visibility).value = 'visible';

    Object.assign(lineMask.write(Rect), {
      x: 0,
      y: 0,
      width,
      height,
    });
    Object.assign(lineMask.write(Transform), {
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

    Object.assign(x1y1Anchor.write(Circle), {
      cx: point1[0],
      cy: point1[1],
    });
    Object.assign(x2y2Anchor.write(Circle), {
      cx: point2[0],
      cy: point2[1],
    });
    updateGlobalTransform(lineMask);
  }

  private createPolylineMask(camera: Entity, transformable: Transformable) {
    const polylineMask = this.commands
      .spawn(
        new UI(UIType.TRANSFORMER_MASK),
        new Transform(),
        new Renderable(),
        new Opacity({ opacity: 0 }),
        new Stroke({
          width: TRANSFORMER_ANCHOR_ROTATE_RADIUS * 2,
          color: TRANSFORMER_ANCHOR_STROKE_COLOR,
        }),
        new Polyline(),
        new ZIndex(TRANSFORMER_Z_INDEX),
        new Visibility(),
      )
      .id()
      .hold();

    Object.assign(transformable, {
      polylineMask,
    });

    this.commands
      .entity(camera)
      .appendChild(this.commands.entity(polylineMask));
    this.commands.execute();
  }

  private updatePolylineMask(camera: Entity) {
    const { polylineMask, selecteds } = camera.read(Transformable);
    const selected = selecteds[0];
    if (!selected || !selected.hasSomeOf(Polyline, Path)) {
      polylineMask.write(Visibility).value = 'hidden';
      return;
    }

    polylineMask.write(Visibility).value = 'visible';
    Object.assign(polylineMask.write(Transform), {
      translation: {
        x: 0,
        y: 0,
      },
      rotation: 0,
      scale: {
        x: 1,
        y: 1,
      },
    });
    if (selected.has(Polyline)) {
      polylineMask.write(Polyline).points = selected.read(Polyline).points;
    } else {
      polylineMask.write(Polyline).points = selected
        .read(ComputedPoints)
        .points.flat()
        .map((point) => [point[0], point[1]] as [number, number]);
    }

    this.updatePolylineControlPoints(camera);
    updateGlobalTransform(polylineMask);
  }
}

export function calculateOBBRecursive(entities: Entity[]): OBB {
  // Merge all descendants' bounds into one OBB without rotation & scale.
  const bounds = entities
    .map((entity) => {
      if (entity.has(ComputedBounds)) {
        const { geometryWorldBounds } = entity.read(ComputedBounds);
        return {
          minX: geometryWorldBounds.minX,
          minY: geometryWorldBounds.minY,
          maxX: geometryWorldBounds.maxX,
          maxY: geometryWorldBounds.maxY,
        };
      }

      if (entity.has(Parent)) {
        const { children } = entity.read(Parent);
        const childOBB = calculateOBBRecursive(children);
        return {
          minX: childOBB.x,
          minY: childOBB.y,
          maxX: childOBB.x + childOBB.width,
          maxY: childOBB.y + childOBB.height,
        };
      }
    })
    .filter((bound) => bound !== undefined);

  if (bounds.length === 0) {
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

  const { minX, minY, maxX, maxY } = bounds.reduce(
    (acc, bound) => {
      return {
        minX: Math.min(acc.minX, bound.minX),
        minY: Math.min(acc.minY, bound.minY),
        maxX: Math.max(acc.maxX, bound.maxX),
        maxY: Math.max(acc.maxY, bound.maxY),
      };
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
  };
}

/**
 * Get the OBB of the selected nodes.
 */
export function getOBB(camera: Entity): OBB {
  const tf = camera.read(Transformable);
  const { selecteds, status, resizeWidth, resizeHeight } = tf;

  // Single selected, keep the original OBB include rotation & scale.
  if (selecteds.length === 1) {
    const selected = selecteds[0];
    if (selected.has(ComputedBounds)) {
      const { selectionOBB } = selected.read(ComputedBounds);
      if (
        status === TransformableStatus.RESIZING &&
        resizeWidth >= 0 &&
        resizeHeight >= 0 &&
        selected.has(Text)
      ) {
        const text = selected.read(Text);
        if (text.wordWrap && (text.wordWrapWidth ?? 0) > 0) {
          const o = selectionOBB;
          return new OBB({
            x: o.x,
            y: o.y,
            width: resizeWidth,
            height: resizeHeight,
            rotation: o.rotation,
            scaleX: o.scaleX,
            scaleY: o.scaleY,
          });
        }
      }
      return selectionOBB;
    }
  }

  if (selecteds.length > 1) {
    return calculateOBBRecursive(selecteds);
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

function useLineMask(camera: Entity) {
  const { selecteds } = camera.read(Transformable);

  if (selecteds.length !== 1) {
    return false;
  }
  const selected = selecteds[0];
  if (selected.has(Line)) {
    return true;
  }
  // 绑定边：用线段两端锚点改接，不编辑折线顶点
  if (selected.has(Binding) && selected.has(Polyline)) {
    return true;
  }

  return false;
}

function usePolylineMask(camera: Entity) {
  const { selecteds } = camera.read(Transformable);

  if (selecteds.length === 1 && selecteds[0].hasSomeOf(Polyline, Path)) {
    if (selecteds[0].has(Binding) && selecteds[0].has(Polyline)) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Hit test with transformer, return anchor name and cursor.
 */
export function hitTest(api: API, { x, y }: IPointData) {
  const camera = api.getCamera();
  const { rotateEnabled, penbarSelected } = api.getAppState();
  const point = [x, y] as [number, number];
  const { selecteds } = camera.read(Transformable);
  const isSelectPolyline =
    penbarSelected === Pen.SELECT &&
    selecteds.length === 1 &&
    selecteds[0].hasSomeOf(Polyline, Path) &&
    !(selecteds[0].has(Binding) && selecteds[0].has(Polyline));
  const {
    tlAnchor,
    trAnchor,
    blAnchor,
    brAnchor,
    controlPoints,
    segmentMidpoints,
    mask,
    lineMask,
    polylineMask,
    x1y1Anchor,
    x2y2Anchor,
    centerAnchor,
  } = camera.read(Transformable);

  if (
    (penbarSelected === Pen.VECTOR_NETWORK || isSelectPolyline) &&
    controlPoints
  ) {
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
          cursor: 'crosshair',
          index: i,
        };
      }
    }

    const segmentMidpointsSafe = segmentMidpoints ?? [];
    for (let i = 0; i < segmentMidpointsSafe.length; i++) {
      const { cx, cy } = segmentMidpointsSafe[i].read(Circle);
      const { x: xx, y: yy } = api.canvas2Viewport({ x: cx, y: cy });
      const distance = distanceBetweenPoints(x, y, xx, yy);
      if (distance <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
        return {
          anchor: AnchorName.SEGMENT_MIDPOINT,
          cursor: 'crosshair',
          index: i,
        };
      }
    }
    if (penbarSelected === Pen.VECTOR_NETWORK) {
      return {
        anchor: AnchorName.OUTSIDE,
        cursor: 'default',
        index: -1,
      };
    }

    let minDistanceToSegments = Infinity;
    const selected = selecteds[0];
    if (selected.has(Polyline)) {
      const polylinePoints = polylineMask.read(Polyline).points;
      const viewportPoints = polylinePoints.map((polylinePoint) => {
        return api.canvas2Viewport(
          api.transformer2Canvas(
            {
              x: polylinePoint[0],
              y: polylinePoint[1],
            },
            polylineMask,
          ),
        );
      });
      for (let i = 0; i < viewportPoints.length - 1; i++) {
        minDistanceToSegments = Math.min(
          minDistanceToSegments,
          distanceBetweenPointAndLineSegment(
            point,
            [viewportPoints[i].x, viewportPoints[i].y],
            [viewportPoints[i + 1].x, viewportPoints[i + 1].y],
          ),
        );
      }
    } else if (selected.has(Path)) {
      const matrix = Mat3.toGLMat3(selected.read(GlobalTransform).matrix);
      selected.read(ComputedPoints).points.forEach((subpath) => {
        if (subpath.length < 2) {
          return;
        }
        const viewportPoints = subpath.map((subpathPoint) => {
          const transformed = vec2.transformMat3(
            vec2.create(),
            subpathPoint,
            matrix,
          );
          return api.canvas2Viewport({ x: transformed[0], y: transformed[1] });
        });
        for (let i = 0; i < viewportPoints.length - 1; i++) {
          minDistanceToSegments = Math.min(
            minDistanceToSegments,
            distanceBetweenPointAndLineSegment(
              point,
              [viewportPoints[i].x, viewportPoints[i].y],
              [viewportPoints[i + 1].x, viewportPoints[i + 1].y],
            ),
          );
        }
      });
    }

    if (minDistanceToSegments <= TRANSFORMER_ANCHOR_ROTATE_RADIUS) {
      return {
        anchor: AnchorName.INSIDE,
        cursor: 'default',
      };
    }

    return {
      anchor: AnchorName.OUTSIDE,
      cursor: 'default',
    };
  } else {
    if (useLineMask(camera)) {
      const { x: x1y1X, y: x1y1Y } = api.canvas2Viewport(
        api.transformer2Canvas(
          {
            x: x1y1Anchor.read(Circle).cx,
            y: x1y1Anchor.read(Circle).cy,
          },
          lineMask,
        ),
      );
      const { x: x2y2X, y: x2y2Y } = api.canvas2Viewport(
        api.transformer2Canvas(
          {
            x: x2y2Anchor.read(Circle).cx,
            y: x2y2Anchor.read(Circle).cy,
          },
          lineMask,
        ),
      );

      const isInside = inside(point, [
        [x1y1X, x1y1Y],
        [x1y1X, x2y2Y],
        [x2y2X, x1y1Y],
        [x2y2X, x2y2Y],
      ]);

      const distanceToX1y1 = distanceBetweenPoints(x, y, x1y1X, x1y1Y);
      const distanceToX2y2 = distanceBetweenPoints(x, y, x2y2X, x2y2Y);
      const minDistanceToAnchors = Math.min(distanceToX1y1, distanceToX2y2);

      if (minDistanceToAnchors <= TRANSFORMER_ANCHOR_RESIZE_RADIUS) {
        if (minDistanceToAnchors === distanceToX1y1) {
          return {
            anchor: AnchorName.X1Y1,
            cursor: 'crosshair',
          };
        } else if (minDistanceToAnchors === distanceToX2y2) {
          return {
            anchor: AnchorName.X2Y2,
            cursor: 'crosshair',
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
    } else {
      const { x: tlX, y: tlY } = api.canvas2Viewport(
        api.transformer2Canvas(
          {
            x: tlAnchor.read(Circle).cx,
            y: tlAnchor.read(Circle).cy,
          },
          mask,
        ),
      );
      const { x: trX, y: trY } = api.canvas2Viewport(
        api.transformer2Canvas(
          {
            x: trAnchor.read(Circle).cx,
            y: trAnchor.read(Circle).cy,
          },
          mask,
        ),
      );
      const { x: blX, y: blY } = api.canvas2Viewport(
        api.transformer2Canvas(
          {
            x: blAnchor.read(Circle).cx,
            y: blAnchor.read(Circle).cy,
          },
          mask,
        ),
      );
      const { x: brX, y: brY } = api.canvas2Viewport(
        api.transformer2Canvas(
          {
            x: brAnchor.read(Circle).cx,
            y: brAnchor.read(Circle).cy,
          },
          mask,
        ),
      );
      const { x: centerX, y: centerY } = api.canvas2Viewport(
        api.transformer2Canvas(
          {
            x: centerAnchor.read(Circle).cx,
            y: centerAnchor.read(Circle).cy,
          },
          mask,
        ),
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
      const distanceToCenter = distanceBetweenPoints(x, y, centerX, centerY);

      if (distanceToCenter <= TRANSFORMER_ANCHOR_RESIZE_RADIUS + 1) {
        return {
          anchor: AnchorName.CENTER,
          cursor: 'move',
        };
      }

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
}
