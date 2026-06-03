import { Entity, System } from '@lastolivegames/becsy';
import { mat4 as glMat4, vec2, vec3 as glVec3 } from 'gl-matrix';
import {
  Camera,
  Camera3D,
  Canvas,
  ComputedCamera,
  Input,
  Mesh3D,
  Material3D,
  Pen,
  Transform3D,
} from '../components';
import { Selected3D, GizmoAxis } from '../components/geometry3d/Selected3D';
import { Mat3 } from '../components/math/Mat3';
import { Mat4 } from '../components/math/Mat4';
import {
  screenToRay,
  computeModelMatrix,
  computeInvViewProjection,
  pickMeshAtViewport,
  type Mesh3DPickScene,
  type Ray,
  type RayHitResult,
} from '../utils/ray-casting';
import { createTranslateGizmo, computeGizmoScale } from '../utils/gizmo-geometry';
import {
  buildCamera3DSceneUniforms,
  sceneUniformsToPickScene,
} from '../utils/mesh3d-scene';

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

  /** Cached gizmo geometry for hit-testing gizmo handles. */
  private gizmoParts = createTranslateGizmo();

  constructor() {
    super();
    this.query((q) =>
      q
        .using(
          Input,
          Camera3D,
          Camera,
          Canvas,
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
    const cameraEntity = this.cameras3D.current[0];
    if (!cameraEntity) return;

    const camera = cameraEntity.read(Camera3D);

    for (const canvasEntity of this.canvases.current) {
      if (!canvasEntity.has(Input)) continue;

      const { api } = canvasEntity.read(Canvas);
      if (api.getAppState().penbarSelected !== Pen.SELECT) continue;

      const input = canvasEntity.read(Input);

      // Handle drag updates on pointer move
      if (!input.pointerDownTrigger && !input.pointerUpTrigger) {
        this.handleDrag(input, camera);
        continue;
      }

      if (input.pointerUpTrigger) {
        this.handlePointerUp();
        continue;
      }

      // Pointer down – perform picking
      if (input.pointerDownTrigger) {
        this.handlePointerDown(input, camera);
      }
    }
  }

  private handlePointerDown(input: Input, camera: Camera3D): void {
    const [vx, vy] = input.pointerViewport;
    const { width, height } = this.getViewportSize();
    if (width <= 0 || height <= 0) return;

    const pickScene = this.buildPickScene(camera, width, height);
    if (!pickScene) return;

    // First, check if clicking on gizmo handles of already-selected entity
    for (const entity of this.selected3D.current) {
      const axis = this.hitTestGizmo(
        vx,
        vy,
        width,
        height,
        entity,
        camera,
        pickScene,
      );
      if (axis !== 'none') {
        const sel = entity.write(Selected3D);
        sel.activeAxis = axis;
        sel.dragging = true;
        const transform = entity.read(Transform3D);
        sel.dragStart = [...transform.translation];
        sel.initialTranslation = [...transform.translation];
        sel.initialRotation = [...transform.rotation];
        sel.initialScale = [...transform.scale];
        return;
      }
    }

    // Then, check mesh hits
    let closestHit: RayHitResult | null = null;
    let closestEntity: Entity | null = null;

    for (const entity of this.meshes3D.current) {
      const transform = entity.read(Transform3D);
      const mesh = entity.read(Mesh3D);
      const modelMatrix = computeModelMatrix(
        transform.translation,
        transform.rotation,
        transform.scale,
      );
      const anchor: [number, number, number] = [
        transform.translation[0],
        transform.translation[1],
        0,
      ];
      const hit = pickMeshAtViewport(
        vx,
        vy,
        width,
        height,
        mesh.positions,
        mesh.indices,
        modelMatrix,
        anchor,
        pickScene,
      );
      if (hit && (!closestHit || hit.t < closestHit.t)) {
        closestHit = hit;
        closestEntity = entity;
      }
    }

    // Deselect previously selected entities that are not the new target
    for (const entity of this.selected3D.current) {
      if (entity !== closestEntity && entity.has(Selected3D)) {
        entity.remove(Selected3D);
      }
    }

    // Select the hit entity
    if (closestEntity && closestHit) {
      if (!closestEntity.has(Selected3D)) {
        closestEntity.add(Selected3D, {
          mode: 'translate',
          activeAxis: 'none',
          dragging: false,
        });
      }
    }
  }

  private handlePointerUp(): void {
    for (const entity of this.selected3D.current) {
      if (!entity.has(Selected3D)) continue;

      const sel = entity.write(Selected3D);
      sel.dragging = false;
      sel.activeAxis = 'none';
      sel.dragStart = null;
    }
  }

  private handleDrag(input: Input, camera: Camera3D): void {
    for (const entity of this.selected3D.current) {
      if (!entity.has(Selected3D)) continue;

      const sel = entity.read(Selected3D);
      if (!sel.dragging || sel.activeAxis === 'none' || !sel.initialTranslation) {
        continue;
      }

      const [vx, vy] = input.pointerViewport;
      const { width, height } = this.getViewportSize();
      if (width <= 0 || height <= 0) continue;

      const pickScene = this.buildPickScene(camera, width, height);
      if (!pickScene) continue;
      const transformRead = entity.read(Transform3D);
      const anchor: [number, number, number] = [
        transformRead.translation[0],
        transformRead.translation[1],
        0,
      ];
      const ray = this.buildRay(
        vx,
        vy,
        width,
        height,
        camera,
        pickScene,
        anchor,
      );
      if (!ray) continue;

      // Project ray onto the constrained axis/plane to compute new position
      entity.write(Selected3D);
      const transform = entity.write(Transform3D);
      const newTranslation = this.computeConstrainedTranslation(
        ray,
        sel.activeAxis,
        sel.initialTranslation,
        sel.dragStart!,
      );

      if (newTranslation) {
        transform.translation = newTranslation;
      }
    }
  }

  /**
   * Compute constrained translation by projecting the ray onto the
   * dragged axis or plane.
   */
  private computeConstrainedTranslation(
    ray: Ray,
    axis: GizmoAxis,
    initialTranslation: [number, number, number],
    dragStart: [number, number, number],
  ): [number, number, number] | null {
    // For simplicity, project onto a plane that contains the drag axis
    // and is most perpendicular to the view direction.
    const origin = dragStart;

    let planeNormal: [number, number, number];
    if (axis === 'x') {
      // Plane with normal Y (project onto XZ plane)
      planeNormal = [0, 1, 0];
    } else if (axis === 'y') {
      planeNormal = [0, 0, 1];
    } else if (axis === 'z') {
      planeNormal = [0, 1, 0];
    } else if (axis === 'xy') {
      planeNormal = [0, 0, 1];
    } else if (axis === 'xz') {
      planeNormal = [0, 1, 0];
    } else if (axis === 'yz') {
      planeNormal = [1, 0, 0];
    } else {
      return null;
    }

    // Ray-plane intersection: t = dot(origin - ray.origin, normal) / dot(ray.dir, normal)
    const denom =
      ray.direction[0] * planeNormal[0] +
      ray.direction[1] * planeNormal[1] +
      ray.direction[2] * planeNormal[2];

    if (Math.abs(denom) < 1e-8) return null;

    const diff: [number, number, number] = [
      origin[0] - ray.origin[0],
      origin[1] - ray.origin[1],
      origin[2] - ray.origin[2],
    ];
    const t =
      (diff[0] * planeNormal[0] +
        diff[1] * planeNormal[1] +
        diff[2] * planeNormal[2]) /
      denom;

    if (t < 0) return null;

    const hitPoint: [number, number, number] = [
      ray.origin[0] + ray.direction[0] * t,
      ray.origin[1] + ray.direction[1] * t,
      ray.origin[2] + ray.direction[2] * t,
    ];

    // Compute delta from drag start to current hit
    const delta: [number, number, number] = [
      hitPoint[0] - origin[0],
      hitPoint[1] - origin[1],
      hitPoint[2] - origin[2],
    ];

    // Constrain to axis
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

  /**
   * Test ray against gizmo handles around a selected entity.
   */
  private hitTestGizmo(
    vx: number,
    vy: number,
    viewportWidth: number,
    viewportHeight: number,
    entity: Entity,
    camera: Camera3D,
    pickScene: Mesh3DPickScene,
  ): GizmoAxis {
    const transform = entity.read(Transform3D);
    const translation = transform.translation;

    // Compute gizmo scale for constant screen size
    const scale = computeGizmoScale(
      camera.eye,
      translation,
      camera.fovy,
      viewportHeight,
    );

    // Build gizmo model matrix (translate to object position, uniform scale)
    const gizmoModel = glMat4.create();
    glMat4.translate(gizmoModel, gizmoModel, translation);
    glMat4.scale(gizmoModel, gizmoModel, [scale, scale, scale]);

    const anchor: [number, number, number] = [
      translation[0],
      translation[1],
      0,
    ];

    // Test each gizmo part
    for (const part of this.gizmoParts) {
      const hit = pickMeshAtViewport(
        vx,
        vy,
        viewportWidth,
        viewportHeight,
        part.positions,
        part.indices,
        gizmoModel as unknown as Float32Array,
        anchor,
        pickScene,
      );
      if (hit) {
        return part.axis;
      }
    }

    return 'none';
  }

  private buildPickScene(
    camera: Camera3D,
    viewportWidth: number,
    viewportHeight: number,
  ): Mesh3DPickScene | null {
    const cam2d = camera.linked ? this.cameras2D.current[0] : undefined;
    const canvasEntity = this.canvases.current[0];
    const logicalW = canvasEntity
      ? canvasEntity.read(Canvas).width
      : viewportWidth;
    const logicalH = canvasEntity
      ? canvasEntity.read(Canvas).height
      : viewportHeight;
    const aspect =
      camera.linked && logicalW > 0 && logicalH > 0
        ? logicalW / logicalH
        : viewportWidth / viewportHeight;

    return sceneUniformsToPickScene(
      buildCamera3DSceneUniforms(camera, aspect, cam2d),
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
    _anchor?: [number, number, number],
  ): Ray | null {
    if (pickScene.mode === 'linkedPerspective') {
      const cam2d = this.cameras2D.current[0];
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

  private getViewportSize(): { width: number; height: number } {
    const canvasEntity = this.canvases.current[0];
    if (!canvasEntity) return { width: 0, height: 0 };
    const { width, height } = canvasEntity.read(Canvas);
    return { width, height };
  }
}
