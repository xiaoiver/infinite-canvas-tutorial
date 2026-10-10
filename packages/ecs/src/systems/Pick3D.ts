import { System, type Entity } from '@lastolivegames/becsy';
import {
  Camera,
  Camera3D,
  Canvas,
  Canvas3DScope,
  ComputedCamera,
  Input,
  Mesh3D,
  Material3D,
  Pen,
  Transform3D,
  Extrude3DTarget,
  Extrude3D,
  ComputedBounds,
  Mesh3DNodeTarget,
  Mesh3DNode,
  Transform,
  Rect,
  Children,
  GlobalTransform,
} from '../components';
import { Selected3D } from '../components/geometry3d/Selected3D';
import type { Mesh3DPickScene } from '../utils/ray-casting';
import {
  has3DMeshGizmoSelectedForCanvas,
  set3DGizmoDragging,
  set3DMeshGizmoSelectedForCanvas,
} from '../utils/pick3d-bridge';
import { beginGizmoPointerGesture } from './pick3d/gizmo-pointer';
import { GizmoSession } from './pick3d/gizmo-session';
import type { API } from '../API';
import {
  buildPickSceneForViewport,
  probePick3DAtViewport,
} from '../utils/pick3d-probe';
import {
  filterEntitiesForCanvas,
  findCamera2DForCanvas,
  findCamera3DForCanvas,
} from '../utils/canvas3d-scope';

/**
 * 3D Picking System.
 *
 * On pointer-down, casts a ray from the camera through the clicked viewport
 * pixel. Tests against all Mesh3D entities (with Transform3D + Material3D).
 * If a mesh is hit:
 *   - Adds/updates {@link Selected3D} component on the entity.
 * If gizmo handles are hit (on already-selected entity):
 *   - Sets activeAxis and begins drag.
 * On pointer-move while dragging:
 *   - Updates Transform3D based on axis constraint.
 * On pointer-up:
 *   - Ends drag.
 */
export class Pick3D extends System {
  private readonly sessions = new Map<API, GizmoSession>();
  private cameras3D = this.query((q) => q.current.with(Camera3D).read);
  private cameras2D = this.query(
    (q) => q.current.with(Camera, ComputedCamera).read,
  );

  private canvases = this.query((q) => q.current.with(Canvas).read);

  private meshes3D = this.query(
    (q) => q.current.with(Mesh3D, Material3D, Transform3D).read,
  );

  private selected3D = this.query(
    (q) => q.current.with(Selected3D, Transform3D).write,
  );

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(
            Input,
            Camera3D,
            Camera,
            Canvas,
            Canvas3DScope,
            ComputedCamera,
            Mesh3D,
            Material3D,
            Transform3D,
            Selected3D,
            Extrude3DTarget,
            Extrude3D,
            ComputedBounds,
            Mesh3DNodeTarget,
            Mesh3DNode,
            Transform,
            Rect,
            Children,
            GlobalTransform,
          )
          .read.and.using(
            Selected3D,
            Transform3D,
            Mesh3DNode,
            Extrude3D,
            Transform,
          ).write,
    );
  }

  execute(): void {
    const active = new Set<API>();
    for (const canvas of this.canvases.current) {
      const { api } = canvas.read(Canvas);
      active.add(api);
      const session = this.sessions.get(api);
      const input = canvas.has(Input) ? canvas.read(Input) : undefined;
      const resolved = this.resolveCamera3D(canvas);
      if (
        session &&
        (!session.valid() ||
          !input ||
          !resolved ||
          api.getAppState().penbarSelected !== Pen.SELECT ||
          input.pointerCancelled ||
          input.key === 'Escape')
      ) {
        this.finishSession(api, false);
      }
      if (!input || !resolved) continue;
      this.syncMesh3DLayers(api, canvas);
      if (
        api.getAppState().penbarSelected !== Pen.SELECT ||
        input.pointerCancelled ||
        input.key === 'Escape'
      )
        continue;
      const { camera } = resolved;
      // Samples retain press/release ordering even when both arrive in one frame.
      // Triggers remain a fallback for integrations that populate Input directly.
      const samples = input.pointerSamples.length
        ? input.pointerSamples
        : [
            ...(input.pointerDownTrigger
              ? [
                  {
                    phase: 'down',
                    x: input.pointerDownViewport[0],
                    y: input.pointerDownViewport[1],
                  },
                ]
              : []),
            ...(input.pointerUpTrigger
              ? [
                  {
                    phase: 'up',
                    x: input.pointerViewport[0],
                    y: input.pointerViewport[1],
                  },
                ]
              : []),
          ];
      for (const sample of samples) {
        if (sample.phase === 'down') {
          if (input.pointerButton !== 0) continue;
          this.finishSession(api, false);
          this.handlePointerDown([sample.x, sample.y], camera, canvas);
        } else {
          this.sessions.get(api)?.update([sample.x, sample.y]);
          if (sample.phase === 'up') this.finishSession(api, true);
        }
      }
      if (!samples.length) {
        if (this.sessions.has(api)) {
          this.sessions.get(api)!.update([...input.pointerViewport]);
        } else this.updateGizmoHover(input, camera, canvas);
      }
    }
    // Dispose only this world's sessions; a canvas in another world is independent.
    for (const [api, session] of this.sessions) {
      if (!active.has(api)) {
        session.finish(api, false);
        this.sessions.delete(api);
        set3DGizmoDragging(api, false);
      }
    }
  }

  finalize(): void {
    for (const [api] of this.sessions) set3DGizmoDragging(api, false);
    this.sessions.clear();
  }

  private finishSession(api: API, commit: boolean): void {
    const session = this.sessions.get(api);
    if (!session) return;
    session.finish(api, commit);
    this.sessions.delete(api);
    set3DGizmoDragging(api, false);
  }

  private resolveCamera3D(canvas: Entity): { camera: Camera3D } | undefined {
    const canvasCount = this.canvases.current.length || 1;
    const cameraEntity = findCamera3DForCanvas(
      this.cameras3D.current,
      canvas,
      canvasCount,
    );
    if (!cameraEntity) {
      return undefined;
    }
    return { camera: cameraEntity.read(Camera3D) };
  }

  private canvasMeshes(canvas: Entity): Entity[] {
    const canvasCount = this.canvases.current.length || 1;
    return filterEntitiesForCanvas(this.meshes3D.current, canvas, canvasCount);
  }

  private canvasSelected(canvas: Entity): Entity[] {
    const canvasCount = this.canvases.current.length || 1;
    return this.selected3D.current.filter(
      (entity) =>
        filterEntitiesForCanvas([entity], canvas, canvasCount).length > 0,
    );
  }

  private resolveMesh3DSourceNode(api: Canvas['api'], entity: Entity) {
    if (entity.has(Extrude3DTarget)) {
      return api.getNodeByEntity(entity.read(Extrude3DTarget).source);
    }
    if (entity.has(Mesh3DNodeTarget)) {
      return api.getNodeByEntity(entity.read(Mesh3DNodeTarget).source);
    }
    return undefined;
  }

  private syncMesh3DLayers(api: Canvas['api'], canvasEntity: Entity): void {
    const scopedMeshes = this.canvasMeshes(canvasEntity);
    const layers = scopedMeshes.map((entity) => {
      const sourceNode = this.resolveMesh3DSourceNode(api, entity);
      const id = sourceNode?.id ?? `mesh3d:${entity.__id}`;
      const mesh = entity.read(Mesh3D);

      return {
        id,
        name: sourceNode?.name || `3D Mesh ${entity.__id}`,
        sourceNodeId: sourceNode?.id,
        vertexCount: mesh.vertexCount,
        entity,
      };
    });

    api.setMesh3DLayers(layers);
    const selected = this.canvasSelected(canvasEntity);
    // Deleting/disabling a companion can clear selection without a pointer event.
    const hasSelection = selected.length > 0;
    if (has3DMeshGizmoSelectedForCanvas(canvasEntity) !== hasSelection)
      set3DMeshGizmoSelectedForCanvas(canvasEntity, hasSelection);
    api.setSelectedMesh3DLayerIds(
      selected
        .map((entity) => api.getMesh3DLayerIdByEntity(entity))
        .filter((id): id is string => !!id),
    );
  }

  private handlePointerDown(
    viewport: [number, number],
    camera: Camera3D,
    canvasEntity: Entity,
  ): void {
    const { api } = canvasEntity.read(Canvas);
    const [vx, vy] = viewport;
    const { width, height } = this.getViewportSize(canvasEntity);
    if (width <= 0 || height <= 0) return;

    const pickScene = this.buildPickScene(camera, width, height, canvasEntity);
    if (!pickScene) return;

    const scopedMeshes = this.canvasMeshes(canvasEntity);
    const scopedSelected = this.canvasSelected(canvasEntity);

    const probe = probePick3DAtViewport(
      vx,
      vy,
      width,
      height,
      camera,
      pickScene,
      scopedMeshes,
      scopedSelected,
    );

    if (probe.kind === 'gizmo') {
      const gesture = beginGizmoPointerGesture(
        probe.entity.read(Transform3D),
        probe.axis,
        probe.partKind,
        probe.frame,
        [vx, vy],
        probe.hit.point,
      );
      if (gesture) {
        this.sessions.set(api, new GizmoSession(probe.entity.hold(), gesture));
        set3DGizmoDragging(api, true);
      }
      return;
    }

    const closestEntity = probe.kind === 'mesh' ? probe.entity : null;

    for (const entity of scopedSelected) {
      if (entity !== closestEntity && entity.has(Selected3D)) {
        entity.remove(Selected3D);
      }
    }

    if (closestEntity) {
      if (!closestEntity.has(Selected3D)) {
        closestEntity.add(Selected3D, {
          mode: 'transform',
          activeAxis: 'none',
          activePartKind: null,
          dragging: false,
        });
      }
      api.runAtNextTick(() => api.syncMesh3DLayerAppState(closestEntity));
    } else {
      api.runAtNextTick(() => api.clearMesh3DLayerAppState());
    }

    set3DGizmoDragging(api, false);
    set3DMeshGizmoSelectedForCanvas(canvasEntity, closestEntity != null);
  }

  /** Highlight hovered gizmo handle (activeAxis) without starting a drag. */
  private updateGizmoHover(
    input: Input,
    camera: Camera3D,
    canvasEntity: Entity,
  ): void {
    const scopedSelected = this.canvasSelected(canvasEntity);
    for (const entity of scopedSelected) {
      if (entity.has(Selected3D) && entity.read(Selected3D).dragging) {
        return;
      }
    }

    if (scopedSelected.length === 0) {
      return;
    }

    const [vx, vy] = input.pointerViewport;
    const { width, height } = this.getViewportSize(canvasEntity);
    if (width <= 0 || height <= 0) {
      return;
    }

    const pickScene = this.buildPickScene(camera, width, height, canvasEntity);
    if (!pickScene) {
      return;
    }

    const probe = probePick3DAtViewport(
      vx,
      vy,
      width,
      height,
      camera,
      pickScene,
      this.canvasMeshes(canvasEntity),
      scopedSelected,
    );

    for (const entity of scopedSelected) {
      if (!entity.has(Selected3D)) {
        continue;
      }
      const sel = entity.write(Selected3D);
      if (probe.kind === 'gizmo' && probe.entity === entity) {
        sel.activeAxis = probe.axis;
        sel.activePartKind = probe.partKind;
      } else {
        sel.activeAxis = 'none';
        sel.activePartKind = null;
      }
    }
  }

  private buildPickScene(
    camera: Camera3D,
    viewportWidth: number,
    viewportHeight: number,
    canvasEntity: Entity,
  ): Mesh3DPickScene | null {
    const cam2d = camera.linked
      ? findCamera2DForCanvas(this.cameras2D.current, canvasEntity)
      : undefined;
    const { width: logicalW, height: logicalH } = canvasEntity.read(Canvas);

    return buildPickSceneForViewport(
      camera,
      viewportWidth,
      viewportHeight,
      logicalW > 0 ? logicalW : viewportWidth,
      logicalH > 0 ? logicalH : viewportHeight,
      cam2d,
    );
  }

  private getViewportSize(canvasEntity: Entity): {
    width: number;
    height: number;
  } {
    const { width, height } = canvasEntity.read(Canvas);
    return { width, height };
  }
}
