import { System, type Entity } from '@lastolivegames/becsy';
import { mat4 as glMat4, vec2, vec3 as glVec3 } from 'gl-matrix';
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
} from '../components';
import { Selected3D, type GizmoAxis } from '../components/geometry3d/Selected3D';
import { Mat3 } from '../components/math/Mat3';
import { Mat4 } from '../components/math/Mat4';
import {
  screenToRay,
  computeInvViewProjection,
  type Mesh3DPickScene,
  type Ray,
} from '../utils/ray-casting';
import {
  set3DGizmoDragging,
  set3DMeshGizmoSelectedForCanvas,
} from '../utils/pick3d-bridge';
import {
  angleOnRotationPlane,
  intersectRayWithPlane,
  isRotateGizmoAxis,
  rotationPlaneNormal,
  unwrapAngleDelta,
} from '../utils/gizmo-interaction';
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
  private cameras3D = this.query((q) => q.current.with(Camera3D).read);
  private cameras2D = this.query((q) =>
    q.current.with(Camera, ComputedCamera).read,
  );

  private canvases = this.query((q) => q.current.with(Canvas).read);

  private meshes3D = this.query((q) =>
    q.current.with(Mesh3D, Material3D, Transform3D).read,
  );

  private selected3D = this.query((q) =>
    q.current.with(Selected3D, Transform3D).write,
  );

  constructor() {
    super();
    this.query((q) =>
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
        )
        .read.and.using(Selected3D, Transform3D)
        .write,
    );
  }

  execute(): void {
    for (const canvasEntity of this.canvases.current) {
      if (!canvasEntity.has(Input)) continue;

      const resolved = this.resolveCamera3D(canvasEntity);
      if (!resolved) continue;
      const camera = resolved.camera;

      const { api } = canvasEntity.read(Canvas);
      if (api.getAppState().penbarSelected !== Pen.SELECT) continue;

      const input = canvasEntity.read(Input);

      if (!input.pointerDownTrigger && !input.pointerUpTrigger) {
        this.updateGizmoHover(input, camera, canvasEntity);
        this.handleDrag(input, camera, canvasEntity);
        continue;
      }

      if (input.pointerUpTrigger) {
        this.handlePointerUp(canvasEntity);
        continue;
      }

      if (input.pointerDownTrigger) {
        this.handlePointerDown(input, camera, canvasEntity);
      }
    }
  }

  private resolveCamera3D(
    canvas: Entity,
  ): { camera: Camera3D } | undefined {
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
    return filterEntitiesForCanvas(
      this.meshes3D.current,
      canvas,
      canvasCount,
    );
  }

  private canvasSelected(canvas: Entity): Entity[] {
    const canvasCount = this.canvases.current.length || 1;
    return this.selected3D.current.filter(
      (entity) =>
        filterEntitiesForCanvas([entity], canvas, canvasCount).length > 0,
    );
  }

  private handlePointerDown(
    input: Input,
    camera: Camera3D,
    canvasEntity: Entity,
  ): void {
    const [vx, vy] = input.pointerViewport;
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
      const transform = probe.entity.read(Transform3D);
      const translation = transform.translation;
      const rotation = transform.rotation;
      const anchor: [number, number, number] = [
        translation[0],
        translation[1],
        translation[2],
      ];
      const ray = this.buildRay(
        vx,
        vy,
        width,
        height,
        camera,
        pickScene,
        canvasEntity,
        anchor,
      );

      const sel = probe.entity.write(Selected3D);
      sel.activeAxis = probe.axis;
      sel.activePartKind = probe.partKind;
      sel.initialTranslation = [...translation];
      sel.initialRotation = [...rotation];
      sel.initialScale = [...transform.scale];
      sel.dragHitStart = null;
      sel.dragAngleStart = null;

      let canDrag = false;
      if (
        probe.partKind === 'rotate' &&
        isRotateGizmoAxis(probe.axis) &&
        ray
      ) {
        const hit = intersectRayWithPlane(
          ray,
          translation,
          rotationPlaneNormal(rotation, probe.axis),
        );
        if (hit) {
          sel.dragAngleStart = angleOnRotationPlane(
            hit,
            translation,
            probe.axis,
            rotation,
          );
          canDrag = true;
        }
      } else if (probe.partKind === 'translate' && ray) {
        const dragHitStart = this.intersectRayWithConstraintPlane(
          ray,
          probe.axis,
          translation,
        );
        if (dragHitStart) {
          sel.dragHitStart = dragHitStart;
          canDrag = true;
        }
      }

      sel.dragging = canDrag;
      set3DGizmoDragging(canDrag);
      if (!canDrag) {
        sel.dragHitStart = null;
        sel.dragAngleStart = null;
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
    }

    set3DGizmoDragging(false);
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

  private handlePointerUp(canvasEntity: Entity): void {
    for (const entity of this.canvasSelected(canvasEntity)) {
      if (!entity.has(Selected3D)) continue;

      const sel = entity.write(Selected3D);
      sel.dragging = false;
      sel.activeAxis = 'none';
      sel.activePartKind = null;
      sel.dragHitStart = null;
      sel.dragAngleStart = null;
    }
    set3DGizmoDragging(false);
  }

  private handleDrag(
    input: Input,
    camera: Camera3D,
    canvasEntity: Entity,
  ): void {
    let anyDragging = false;
    for (const entity of this.canvasSelected(canvasEntity)) {
      if (!entity.has(Selected3D)) continue;

      const sel = entity.read(Selected3D);
      if (!sel.dragging || sel.activeAxis === 'none') {
        continue;
      }

      const [vx, vy] = input.pointerViewport;
      const { width, height } = this.getViewportSize(canvasEntity);
      if (width <= 0 || height <= 0) continue;

      const pickScene = this.buildPickScene(camera, width, height, canvasEntity);
      if (!pickScene) continue;
      const transformRead = entity.read(Transform3D);
      const anchor: [number, number, number] = [
        transformRead.translation[0],
        transformRead.translation[1],
        transformRead.translation[2],
      ];
      const ray = this.buildRay(
        vx,
        vy,
        width,
        height,
        camera,
        pickScene,
        canvasEntity,
        anchor,
      );
      if (!ray) continue;

      anyDragging = true;
      entity.write(Selected3D);
      const transform = entity.write(Transform3D);

      if (
        sel.activePartKind === 'rotate' &&
        isRotateGizmoAxis(sel.activeAxis) &&
        sel.initialRotation &&
        sel.dragAngleStart !== null
      ) {
        const newRotation = this.computeConstrainedRotation(
          ray,
          sel.activeAxis,
          transformRead.translation,
          sel.initialRotation,
          sel.dragAngleStart,
        );
        if (newRotation) {
          transform.rotation = newRotation;
        }
      } else if (
        sel.activePartKind === 'translate' &&
        sel.initialTranslation &&
        sel.dragHitStart
      ) {
        const newTranslation = this.computeConstrainedTranslation(
          ray,
          sel.activeAxis,
          sel.initialTranslation,
          sel.dragHitStart,
        );
        if (newTranslation) {
          transform.translation = newTranslation;
        }
      }
    }
    set3DGizmoDragging(anyDragging);
  }

  private constraintPlaneNormal(axis: GizmoAxis): [number, number, number] | null {
    if (axis === 'x' || axis === 'z' || axis === 'xz') {
      return [0, 1, 0];
    }
    if (axis === 'y' || axis === 'xy') {
      return [0, 0, 1];
    }
    if (axis === 'yz') {
      return [1, 0, 0];
    }
    return null;
  }

  private intersectRayWithConstraintPlane(
    ray: Ray,
    axis: GizmoAxis,
    planePoint: [number, number, number],
  ): [number, number, number] | null {
    const planeNormal = this.constraintPlaneNormal(axis);
    if (!planeNormal) return null;
    return intersectRayWithPlane(ray, planePoint, planeNormal);
  }

  private computeConstrainedRotation(
    ray: Ray,
    axis: 'x' | 'y' | 'z',
    center: [number, number, number],
    initialRotation: [number, number, number],
    dragAngleStart: number,
  ): [number, number, number] | null {
    const hit = intersectRayWithPlane(
      ray,
      center,
      rotationPlaneNormal(initialRotation, axis),
    );
    if (!hit) return null;

    const angle = angleOnRotationPlane(hit, center, axis, initialRotation);
    const delta = unwrapAngleDelta(angle - dragAngleStart);
    const result: [number, number, number] = [...initialRotation];
    if (axis === 'x') result[0] = initialRotation[0] + delta;
    else if (axis === 'y') result[1] = initialRotation[1] + delta;
    else result[2] = initialRotation[2] + delta;
    return result;
  }

  /**
   * Constrained translation: delta = current plane hit − pointer-down plane hit.
   */
  private computeConstrainedTranslation(
    ray: Ray,
    axis: GizmoAxis,
    initialTranslation: [number, number, number],
    dragHitStart: [number, number, number],
  ): [number, number, number] | null {
    const planeNormal = this.constraintPlaneNormal(axis);
    if (!planeNormal) return null;

    const hitPoint = intersectRayWithPlane(
      ray,
      initialTranslation,
      planeNormal,
    );
    if (!hitPoint) return null;

    const delta: [number, number, number] = [
      hitPoint[0] - dragHitStart[0],
      hitPoint[1] - dragHitStart[1],
      hitPoint[2] - dragHitStart[2],
    ];

    const result: [number, number, number] = [...initialTranslation];
    if (axis === 'x' || axis === 'xy' || axis === 'xz') {
      result[0] = initialTranslation[0] + delta[0];
    }
    if (axis === 'y' || axis === 'xy' || axis === 'yz') {
      result[1] = initialTranslation[1] + delta[1];
    }
    if (axis === 'z' || axis === 'xz' || axis === 'yz') {
      result[2] = initialTranslation[2] + delta[2];
    }

    return result;
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

  /**
   * Build a world-space ray from viewport coordinates (standard / linked-ortho).
   */
  private buildRay(
    vx: number,
    vy: number,
    viewportWidth: number,
    viewportHeight: number,
    camera: Camera3D,
    pickScene: Mesh3DPickScene,
    canvasEntity: Entity,
    _anchor?: [number, number, number],
  ): Ray | null {
    if (pickScene.mode === 'linkedPerspective') {
      const cam2d = findCamera2DForCanvas(
        this.cameras2D.current,
        canvasEntity,
      );
      if (!cam2d) return null;
      const inv = Mat3.toGLMat3(
        cam2d.read(ComputedCamera).viewProjectionMatrixInv,
      );
      const ndc = vec2.fromValues(
        (vx / viewportWidth) * 2 - 1,
        1 - (vy / viewportHeight) * 2 - 1,
      );
      const canvasPt = vec2.transformMat3(vec2.create(), ndc, inv);
      const origin: [number, number, number] = [
        camera.eye[0],
        camera.eye[1],
        camera.eye[2],
      ];
      const target: [number, number, number] = [canvasPt[0], canvasPt[1], 0];
      const dir = glVec3.create();
      glVec3.subtract(dir, target, origin);
      if (glVec3.length(dir) < 1e-8) return null;
      glVec3.normalize(dir, dir);
      return {
        origin,
        direction: [dir[0], dir[1], dir[2]],
      };
    }
    const invVP = computeInvViewProjection(
      pickScene.projMatrix,
      pickScene.viewMatrix,
    );
    return screenToRay(vx, vy, viewportWidth, viewportHeight, invVP);
  }

  private getViewportSize(canvasEntity: Entity): { width: number; height: number } {
    const { width, height } = canvasEntity.read(Canvas);
    return { width, height };
  }
}
