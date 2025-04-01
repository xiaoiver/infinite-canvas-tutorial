import { Entity, System } from '@lastolivegames/becsy';
import RBush from 'rbush';
import {
  AABB,
  Camera,
  Canvas,
  Children,
  ComputedBounds,
  ComputedCamera,
  Culled,
  Mat3,
} from '../components';
import { CameraControl } from './CameraControl';
import { getSceneRoot } from './Transform';

export interface RBushNodeAABB {
  entity: Entity;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
export class ViewportCulling extends System {
  bounds = this.query(
    (q) => q.addedOrChanged.and.removed.with(ComputedBounds).trackWrites,
  );

  cameras = this.query(
    (q) => q.addedOrChanged.with(ComputedCamera).trackWrites,
  );

  /**
   * Use its viewport2Canvas method.
   */
  cameraControl = this.attach(CameraControl);

  /**
   * Map of camera entity id to its viewport's AABB.
   */
  #cameraViewportMap: Record<number, AABB> = {};

  #cameraRBushMap: Record<number, RBush<RBushNodeAABB>> = {};

  constructor() {
    super();
    this.query(
      (q) => q.using(Camera, Canvas, Children).read.and.using(Culled).write,
    );
  }

  execute() {
    this.cameras.addedOrChanged.forEach((entity) => {
      this.updateViewport(entity);
    });

    const modified: Map<number, Set<Entity>> = new Map();
    const removed: Map<number, Set<Entity>> = new Map();

    this.bounds.addedOrChanged.forEach((entity) => {
      const camera = getSceneRoot(entity);
      if (!modified.has(camera.__id)) {
        modified.set(camera.__id, new Set());
      }
      modified.get(camera.__id)?.add(entity);
    });

    this.bounds.removed.forEach((entity) => {
      const camera = getSceneRoot(entity);
      if (!removed.has(camera.__id)) {
        removed.set(camera.__id, new Set());
      }
      removed.get(camera.__id)?.add(entity);
    });

    [removed, modified].forEach((map) => {
      map.forEach((entities, cameraId) => {
        let rBush = this.#cameraRBushMap[cameraId];
        if (!rBush) {
          rBush = this.#cameraRBushMap[cameraId] = new RBush();
        }

        entities.forEach((entity) => {
          rBush.remove(
            {
              entity,
              minX: 0,
              minY: 0,
              maxX: 0,
              maxY: 0,
            },
            (a, b) => a.entity === b.entity,
          );
        });
      });
    });

    modified.forEach((entities, cameraId) => {
      let rBush = this.#cameraRBushMap[cameraId];
      if (!rBush) {
        rBush = this.#cameraRBushMap[cameraId] = new RBush();
      }

      const bulk: RBushNodeAABB[] = [];
      entities.forEach((entity) => {
        const { bounds } = entity.read(ComputedBounds);
        bulk.push({
          minX: bounds.minX,
          minY: bounds.minY,
          maxX: bounds.maxX,
          maxY: bounds.maxY,
          entity,
        });
      });
      rBush.load(bulk);

      console.log(rBush.all());
    });

    // TODO: write culled component
  }

  private updateViewport(entity: Entity) {
    const { width, height } = entity.read(Camera).canvas.read(Canvas);
    const viewProjectionMatrixInv = Mat3.toGLMat3(
      entity.read(ComputedCamera).viewProjectionMatrixInv,
    );

    // tl, tr, br, bl
    const tl = this.cameraControl.viewport2Canvas(
      entity,
      {
        x: 0,
        y: 0,
      },
      viewProjectionMatrixInv,
    );
    const tr = this.cameraControl.viewport2Canvas(
      entity,
      {
        x: width,
        y: 0,
      },
      viewProjectionMatrixInv,
    );
    const br = this.cameraControl.viewport2Canvas(
      entity,
      {
        x: width,
        y: height,
      },
      viewProjectionMatrixInv,
    );
    const bl = this.cameraControl.viewport2Canvas(
      entity,
      {
        x: 0,
        y: height,
      },
      viewProjectionMatrixInv,
    );

    if (!this.#cameraViewportMap[entity.__id]) {
      this.#cameraViewportMap[entity.__id] = new AABB();
    }

    const viewport = this.#cameraViewportMap[entity.__id];
    viewport.minX = Math.min(tl.x, tr.x, br.x, bl.x);
    viewport.minY = Math.min(tl.y, tr.y, br.y, bl.y);
    viewport.maxX = Math.max(tl.x, tr.x, br.x, bl.x);
    viewport.maxY = Math.max(tl.y, tr.y, br.y, bl.y);
  }
}
