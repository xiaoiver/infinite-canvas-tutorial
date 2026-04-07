import { mat3 } from 'gl-matrix';
import { Entity, System } from '@lastolivegames/becsy';
import {
  AABB,
  Brush,
  Canvas,
  Children,
  Circle,
  ComputedBounds,
  ComputedPoints,
  ComputedTextMetrics,
  DropShadow,
  Ellipse,
  Embed,
  GlobalTransform,
  Group,
  HTML,
  Line,
  Marker,
  Mat3,
  OBB,
  Parent,
  Path,
  Polyline,
  Rect,
  Renderable,
  Stroke,
  Text,
  Transform,
  VectorNetwork,
} from '../components';
import { cloneStrokeWithHitTestWidth, decompose } from '../utils';
import { safeAddComponent } from '../history';

function isValidAabb(a: AABB): boolean {
  return (
    Number.isFinite(a.minX) &&
    Number.isFinite(a.minY) &&
    Number.isFinite(a.maxX) &&
    Number.isFinite(a.maxY) &&
    a.minX <= a.maxX &&
    a.minY <= a.maxY
  );
}

/** Union of child world-space AABBs (geometry or render). */
function mergeChildrenWorldAabb(
  entity: Entity,
  kind: 'geometryWorldBounds' | 'renderWorldBounds',
): AABB {
  const merged = new AABB(Infinity, Infinity, -Infinity, -Infinity);
  if (!entity.has(Parent)) {
    return merged;
  }
  for (const child of entity.read(Parent).children) {
    if (!child.has(ComputedBounds)) {
      continue;
    }
    const wb = child.read(ComputedBounds)[kind];
    if (!isValidAabb(wb)) {
      continue;
    }
    merged.minX = Math.min(merged.minX, wb.minX);
    merged.minY = Math.min(merged.minY, wb.minY);
    merged.maxX = Math.max(merged.maxX, wb.maxX);
    merged.maxY = Math.max(merged.maxY, wb.maxY);
  }
  return merged;
}

/** Map a world-space axis-aligned box into parent local space using inverse global matrix. */
function worldAabbToLocal(aabb: AABB, invGlobal: Mat3): AABB {
  const local = new AABB();
  local.addFrame(aabb.minX, aabb.minY, aabb.maxX, aabb.maxY, invGlobal);
  return local;
}

export class ComputeBounds extends System {
  renderables = this.query(
    (q) =>
      q.addedOrChanged
        .with(Renderable, GlobalTransform)
        .withAny(
          Transform,
          Circle,
          Ellipse,
          Rect,
          Line,
          Polyline,
          Path,
          Text,
          Brush,
          VectorNetwork,
          Group,
        ).trackWrites,
  );

  constructor() {
    super();
    this.query((q) => q.current.with(ComputedBounds).write);
    this.query(
      (q) =>
        q.using(
          Canvas,
          Circle,
          Ellipse,
          Rect,
          Line,
          Polyline,
          Path,
          ComputedPoints,
          Text,
          Brush,
          ComputedTextMetrics,
          Stroke,
          DropShadow,
          Marker,
          HTML,
          Embed,
          Parent,
          Children,
        ).read,
    );
  }

  execute() {
    const groupAncestorsToRefresh = new Set<Entity>();

    this.renderables.addedOrChanged.forEach((entity) => {
      updateBounds(entity);
      // 子节点变化时 Group 不在 addedOrChanged，需沿父链刷新 Group 的并集 bounds
      let e: Entity | undefined = entity;
      while (e?.has(Children)) {
        const parent = e.read(Children).parent;
        if (parent.has(Group)) {
          groupAncestorsToRefresh.add(parent);
        }
        e = parent;
      }
    });

    groupAncestorsToRefresh.forEach((group) => {
      updateBounds(group);
    });
  }
}

export function updateBounds(entity: Entity) {
  safeAddComponent(entity, ComputedBounds);
  const stroke = entity.has(Stroke) ? entity.read(Stroke) : undefined;
  const dropShadow = entity.has(DropShadow)
    ? entity.read(DropShadow)
    : undefined;
  let geometryBounds: AABB | undefined;
  let renderBounds: AABB | undefined;

  if (entity.has(Circle)) {
    geometryBounds = Circle.getGeometryBounds(entity.read(Circle));
    renderBounds = Circle.getRenderBounds(entity.read(Circle), stroke);
  } else if (entity.has(Ellipse)) {
    geometryBounds = Ellipse.getGeometryBounds(entity.read(Ellipse));
    renderBounds = Ellipse.getRenderBounds(entity.read(Ellipse), stroke);
  } else if (entity.has(Rect)) {
    geometryBounds = Rect.getGeometryBounds(entity.read(Rect));
    renderBounds = Rect.getRenderBounds(
      entity.read(Rect),
      stroke,
      dropShadow,
    );
  } else if (entity.has(Line)) {
    geometryBounds = Line.getGeometryBounds(entity.read(Line));
    const lineStroke =
      stroke == null ? undefined : cloneStrokeWithHitTestWidth(entity, stroke);
    renderBounds = Line.getRenderBounds(
      entity.read(Line),
      lineStroke,
      entity.has(Marker) ? entity.read(Marker) : undefined,
    );
  } else if (entity.has(Polyline)) {
    geometryBounds = Polyline.getGeometryBounds({
      ...entity.read(Polyline),
      points: entity.read(ComputedPoints).shiftedPoints,
    });
    const polyStroke =
      stroke == null ? undefined : cloneStrokeWithHitTestWidth(entity, stroke);
    renderBounds = Polyline.getRenderBounds(
      entity.read(Polyline),
      polyStroke,
      entity.has(Marker) ? entity.read(Marker) : undefined,
    );
  } else if (entity.has(Brush)) {
    geometryBounds = Brush.getGeometryBounds(entity.read(Brush));
    renderBounds = Brush.getRenderBounds(entity.read(Brush));
  } else if (entity.has(Path)) {
    geometryBounds = Path.getGeometryBounds(
      entity.read(Path),
      entity.read(ComputedPoints),
    );
    const pathStroke =
      stroke == null ? undefined : cloneStrokeWithHitTestWidth(entity, stroke);
    renderBounds = Path.getRenderBounds(
      entity.read(Path),
      entity.read(ComputedPoints),
      pathStroke,
      entity.has(Marker) ? entity.read(Marker) : undefined,
    );
  } else if (entity.has(Text)) {
    geometryBounds = Text.getGeometryBounds(
      entity.read(Text),
      entity.read(ComputedTextMetrics),
    );
    renderBounds = Text.getRenderBounds(
      entity.read(Text),
      entity.read(ComputedTextMetrics),
      stroke,
      dropShadow,
    );
  } else if (entity.has(VectorNetwork)) {
    geometryBounds = VectorNetwork.getGeometryBounds(
      entity.read(VectorNetwork),
    );
    renderBounds = VectorNetwork.getRenderBounds(
      entity.read(VectorNetwork),
      stroke,
    );
  } else if (entity.has(HTML)) {
    geometryBounds = HTML.getGeometryBounds(entity.read(HTML));
    renderBounds = geometryBounds;
  } else if (entity.has(Embed)) {
    geometryBounds = Embed.getGeometryBounds(entity.read(Embed));
    renderBounds = geometryBounds;
  } else if (entity.has(Group)) {
    if (entity.has(Parent)) {
      entity.read(Parent).children.forEach((child) => {
        updateBounds(child);
      });
    }
    const geomWorld = mergeChildrenWorldAabb(entity, 'geometryWorldBounds');
    const renderWorld = mergeChildrenWorldAabb(entity, 'renderWorldBounds');
    const empty = new AABB(Infinity, Infinity, -Infinity, -Infinity);

    const invGl = mat3.create();
    const invOk = mat3.invert(
      invGl,
      Mat3.toGLMat3(entity.read(GlobalTransform).matrix),
    );
    const inv = invOk ? Mat3.fromGLMat3(invGl) : null;

    if (isValidAabb(geomWorld)) {
      geometryBounds = inv ? worldAabbToLocal(geomWorld, inv) : geomWorld;
    } else {
      geometryBounds = empty;
    }
    if (isValidAabb(renderWorld)) {
      renderBounds = inv ? worldAabbToLocal(renderWorld, inv) : renderWorld;
    } else {
      renderBounds = empty;
    }
  }

  const hitArea = entity.has(Renderable)
    ? entity.read(Renderable).hitArea
    : null;
  if (hitArea) {
    if (hitArea instanceof Circle) {
      renderBounds = Circle.getRenderBounds(hitArea);
    } else if (hitArea instanceof Rect) {
      renderBounds = Rect.getRenderBounds(hitArea);
    }
  }

  if (geometryBounds) {
    entity.write(ComputedBounds).geometryBounds = geometryBounds;
  }
  if (renderBounds) {
    entity.write(ComputedBounds).renderBounds = renderBounds;
  }

  if (geometryBounds && renderBounds) {
    const matrix = entity.read(GlobalTransform).matrix;
    const { translation, rotation, scale } = decompose(Mat3.toGLMat3(matrix));

    const { geometryBounds, renderBounds } = entity.read(ComputedBounds);

    const geometryWorldBounds = new AABB();
    geometryWorldBounds.addBounds(geometryBounds, matrix);

    // apply global transform
    const renderWorldBounds = new AABB();
    renderWorldBounds.addBounds(renderBounds, matrix);

    /**
     * transformOBB：始终用 decompose 的平移 + 局部几何宽高（与实体局部坐标原点一致）。
     * Hover 高亮等「直接拷贝 Polyline/Path 局部点」的场景必须用此 OBB。
     *
     * selectionOBB：变换器 / getOBB；对 Polyline/Path/Line，(x,y) 对齐局部包围盒 min 角的世界坐标
     *（编辑顶点后点集可相对原点漂移）。@see AABB.addFrame
     */
    const transformOBB = new OBB({
      x: translation[0],
      y: translation[1],
      width: geometryBounds.maxX - geometryBounds.minX,
      height: geometryBounds.maxY - geometryBounds.minY,
      rotation,
      scaleX: scale[0],
      scaleY: scale[1],
    });

    let selectionX = transformOBB.x;
    let selectionY = transformOBB.y;
    if (entity.has(Polyline) || entity.has(Path) || entity.has(Line)) {
      const gx = geometryBounds.minX;
      const gy = geometryBounds.minY;
      const { m00, m01, m10, m11, m20, m21 } = matrix;
      selectionX = m00 * gx + m10 * gy + m20;
      selectionY = m01 * gx + m11 * gy + m21;
    }

    const selectionOBB = entity.has(Group)
      ? new OBB({
          x: geometryWorldBounds.minX,
          y: geometryWorldBounds.minY,
          width: geometryWorldBounds.maxX - geometryWorldBounds.minX,
          height: geometryWorldBounds.maxY - geometryWorldBounds.minY,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        })
      : new OBB({
          x: selectionX,
          y: selectionY,
          width: transformOBB.width,
          height: transformOBB.height,
          rotation: transformOBB.rotation,
          scaleX: transformOBB.scaleX,
          scaleY: transformOBB.scaleY,
        });

    Object.assign(entity.write(ComputedBounds), {
      renderWorldBounds,
      geometryWorldBounds,
      transformOBB,
      selectionOBB,
    });
  }

  if (entity.has(Parent) && !entity.has(Group)) {
    entity.read(Parent).children.forEach((child) => {
      updateBounds(child);
    });
  }
}
