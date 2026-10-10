import { Entity, System } from '@lastolivegames/becsy';
import type { Device, RenderPass } from '@infinite-canvas-tutorial/device-api';
import {
  Camera,
  Camera3D,
  Canvas,
  Canvas3DScope,
  ComputedCamera,
  GPUResource,
  Transform3D,
} from '../components';
import { Selected3D } from '../components/geometry3d/Selected3D';
import { ResourceScope } from '../resources/ResourceScope';
import { createGizmoFrame } from '../utils/gizmo-frame';
import {
  filterEntitiesForCanvas,
  findCamera2DForCanvas,
  findCamera3DForCanvas,
} from '../utils/canvas3d-scope';
import {
  buildCamera3DSceneUniforms,
  sceneUniformsToPickScene,
} from '../utils/mesh3d-scene';
import type { RenderCache } from '../utils/render-cache';
import type { API } from '../API';
import { GizmoResources } from './gizmo3d/gizmo-resources';
import type { GizmoDrawInstance } from './gizmo3d/gizmo-uniforms';

interface CanvasState {
  device: Device;
  renderCache: RenderCache;
  scope: ResourceScope;
  resources: GizmoResources;
  dispose: () => void;
}

/** ECS selection/camera adapter; buffers and draw submission live outside the system. */
export class RenderGizmo3D extends System {
  private canvases = this.query((q) => q.current.with(Canvas).read);
  private cameras3D = this.query((q) => q.current.with(Camera3D).read);
  private cameras2D = this.query(
    (q) => q.current.with(Camera, ComputedCamera).read,
  );
  private selected3D = this.query(
    (q) => q.current.with(Selected3D, Transform3D).read,
  );
  private states = new Map<API, CanvasState>();

  constructor() {
    super();
    this.query((q) => q.using(Canvas3DScope, GPUResource).read);
  }

  private selected(canvas: Entity): Entity[] {
    return filterEntitiesForCanvas(
      this.selected3D.current,
      canvas,
      this.canvases.current.length || 1,
    );
  }

  hasGizmoContent(canvas?: Entity): boolean {
    return (canvas ? this.selected(canvas) : this.selected3D.current).some(
      (entity) => entity.has(Selected3D),
    );
  }

  private matches(state: CanvasState, canvas: Entity): boolean {
    if (!canvas.has(GPUResource)) return false;
    const { device, renderCache, scope } = canvas.read(GPUResource);
    return (
      state.device === device &&
      state.renderCache === renderCache &&
      state.scope === scope
    );
  }

  private resources(canvas: Entity): GizmoResources | undefined {
    if (!canvas.has(GPUResource)) return;
    const { api } = canvas.read(Canvas);
    const previous = this.states.get(api);
    if (previous && this.matches(previous, canvas)) return previous.resources;
    previous?.dispose();
    const { device, renderCache, scope } = canvas.read(GPUResource);
    const resources = new GizmoResources(device, renderCache);
    const state: CanvasState = {
      device,
      renderCache,
      scope,
      resources,
      dispose: () => {},
    };
    this.states.set(api, state);
    // The canvas scope disposes us before RenderCache and Device, even if
    // SetupDevice finalizes first. The returned disposer is idempotent.
    state.dispose = scope.add(() => {
      if (this.states.get(api) === state) this.states.delete(api);
      resources.destroy();
    });
    return this.states.get(api) === state ? resources : undefined;
  }

  drawGizmos(
    pass: RenderPass,
    canvas: Entity,
    width: number,
    height: number,
  ): void {
    if (width <= 0 || height <= 0 || !this.hasGizmoContent(canvas)) return;
    const cameraEntity = findCamera3DForCanvas(
      this.cameras3D.current,
      canvas,
      this.canvases.current.length || 1,
    );
    if (!cameraEntity) return;
    const camera = cameraEntity.read(Camera3D);
    const cam2d = camera.linked
      ? findCamera2DForCanvas(this.cameras2D.current, canvas)
      : undefined;
    const { width: logicalW, height: logicalH } = canvas.read(Canvas);
    const aspect =
      camera.linked && logicalW > 0 && logicalH > 0
        ? logicalW / logicalH
        : width / height;
    const scene = buildCamera3DSceneUniforms(camera, aspect, cam2d);
    const pickScene = sceneUniformsToPickScene(scene);
    const instances: GizmoDrawInstance[] = [];
    for (const entity of this.selected(canvas)) {
      if (!entity.has(Selected3D)) continue;
      const { translation, rotation } = entity.read(Transform3D);
      const frame = createGizmoFrame(
        pickScene,
        translation,
        logicalW > 0 ? logicalW : width,
        logicalH > 0 ? logicalH : height,
      );
      if (!frame) continue;
      const { activeAxis, activePartKind } = entity.read(Selected3D);
      instances.push({
        id: entity.__id,
        frame,
        scene,
        rotation: [...rotation],
        activeAxis,
        activePartKind,
      });
    }
    if (instances.length)
      this.resources(canvas)?.draw(pass, instances, width, height);
  }

  execute(): void {
    const active = new Map(
      this.canvases.current.map((canvas) => [canvas.read(Canvas).api, canvas]),
    );
    for (const [api, state] of this.states) {
      const canvas = active.get(api);
      if (!canvas || !this.matches(state, canvas)) state.dispose();
      else
        state.resources.retainObjects(
          new Set(this.selected(canvas).map((entity) => entity.__id)),
        );
    }
  }

  finalize(): void {
    const releases = new ResourceScope();
    for (const state of this.states.values()) releases.add(state.dispose);
    releases.dispose();
  }
}
