import { Entity, System } from '@lastolivegames/becsy';
import Rbush from 'rbush';
import { ComputedVisibility, RBushNodeAABB, Renderable } from '../components';
import {
  AABB,
  Camera,
  Canvas,
  Children,
  ComputedBounds,
  ComputedCamera,
  Culled,
  Parent,
  RBush,
} from '../components';
import { getDescendants, getSceneRoot } from './Transform';
import { API } from '..';

export class ViewportCulling extends System {
  bounds = this.query(
    (q) => q.addedOrChanged.and.removed.with(ComputedBounds).trackWrites,
  );

  cameras = this.query(
    (q) =>
      q.current.and.added.and.addedOrChanged.with(ComputedCamera).trackWrites,
  );

  visibilities = this.query(
    (q) => q.addedChangedOrRemoved.with(ComputedVisibility).trackWrites,
  );

  /**
   * Map of camera entity id to its viewport's AABB.
   */
  #cameraViewportMap: WeakMap<Entity, AABB> = new WeakMap();

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(Camera, Canvas, Children, Parent, Renderable)
          .read.and.using(Culled, RBush).write,
    );
  }

  /**
   * Since the entity is deleted, we need to remove it from the RBush.
   */
  remove(entity: Entity) {
    const camera = getSceneRoot(entity);

    if (camera === entity) {
      return;
    }

    const rBush = camera.read(RBush).value;
    rBush.remove(
      {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        entity,
      },
      (a, b) => a.entity === b.entity,
    );
  }

  execute() {
    const entitiesToCull: WeakMap<Entity, Set<Entity>> = new WeakMap();
    this.cameras.current.forEach((camera) => {
      entitiesToCull.set(camera, new Set());
    });

    this.cameras.added.forEach((camera) => {
      camera.add(RBush, { value: new Rbush<RBushNodeAABB>() });
    });

    this.cameras.addedOrChanged.forEach((camera) => {
      const { api } = camera.read(Camera).canvas.read(Canvas);
      this.updateViewport(camera, api);

      // Recalcaulate all renderables' culled status under this camera.
      getDescendants(camera).forEach((child) => {
        entitiesToCull.get(camera)?.add(child);
      });
    });

    this.visibilities.addedChangedOrRemoved.forEach((entity) => {
      const camera = getSceneRoot(entity);
      if (entitiesToCull.has(camera)) {
        entitiesToCull.get(camera).add(entity);
      }
    });

    const modified: Map<Entity, Set<Entity>> = new Map();
    const removed: Map<Entity, Set<Entity>> = new Map();

    this.bounds.addedOrChanged.forEach((entity) => {
      const camera = getSceneRoot(entity);
      if (!modified.has(camera)) {
        modified.set(camera, new Set());
      }
      modified.get(camera)?.add(entity);
    });

    this.bounds.removed.forEach((entity) => {
      const camera = getSceneRoot(entity);
      if (camera === entity) {
        return;
      }

      if (!removed.has(camera)) {
        removed.set(camera, new Set());
      }

      removed.get(camera).add(entity);
    });

    [removed, modified].forEach((map) => {
      map.forEach((entities, camera) => {
        const rBush = camera.read(RBush).value;

        entities.forEach((entity) => {
          entitiesToCull.get(camera)?.add(entity);
          rBush.remove(
            {
              minX: 0,
              minY: 0,
              maxX: 0,
              maxY: 0,
              entity,
            },
            (a, b) => a.entity === b.entity,
          );
        });
      });
    });

    modified.forEach((entities, camera) => {
      const rBush = camera.read(RBush).value;

      const bulk: RBushNodeAABB[] = [];
      entities.forEach((entity) => {
        const { bounds } = entity.read(ComputedBounds);
        const rBushNodeAABB: RBushNodeAABB = {
          minX: bounds.minX,
          minY: bounds.minY,
          maxX: bounds.maxX,
          maxY: bounds.maxY,
          entity,
        };
        bulk.push(rBushNodeAABB);
      });
      rBush.load(bulk);
    });

    // Write culled component.
    this.cameras.current.forEach((camera) => {
      if (entitiesToCull.get(camera)?.size === 0) {
        return;
      }

      const rBush = camera.read(RBush).value;
      const viewport = this.getOrCreateViewport(camera);

      const entitiesInViewport = rBush
        .search(viewport)
        .map((bush) => bush.entity);

      entitiesToCull.get(camera)?.forEach((entity) => {
        if (!entity.has(ComputedVisibility)) {
          return;
        }

        const { visible } = entity.read(ComputedVisibility);

        if (!entity.has(Renderable)) {
          return;
        }

        // Inherit visibility from parent
        if (visible && entitiesInViewport.includes(entity)) {
          if (entity.has(Culled)) {
            entity.remove(Culled);
          }
        } else if (!visible || !entitiesInViewport.includes(entity)) {
          if (!entity.has(Culled)) {
            entity.add(Culled);
          }
        }
      });
    });
  }

  private getOrCreateViewport(camera: Entity) {
    let viewport = this.#cameraViewportMap.get(camera);
    if (!viewport) {
      this.#cameraViewportMap.set(camera, new AABB());
      viewport = this.#cameraViewportMap.get(camera);
    }
    return viewport;
  }

  private updateViewport(camera: Entity, api: API) {
    const { width, height } = camera.read(Camera).canvas.read(Canvas);
    // tl, tr, br, bl
    const tl = api.viewport2Canvas({
      x: 0,
      y: 0,
    });
    const tr = api.viewport2Canvas({
      x: width,
      y: 0,
    });
    const br = api.viewport2Canvas({
      x: width,
      y: height,
    });
    const bl = api.viewport2Canvas({
      x: 0,
      y: height,
    });

    const viewport = this.getOrCreateViewport(camera);
    viewport.minX = Math.min(tl.x, tr.x, br.x, bl.x);
    viewport.minY = Math.min(tl.y, tr.y, br.y, bl.y);
    viewport.maxX = Math.max(tl.x, tr.x, br.x, bl.x);
    viewport.maxY = Math.max(tl.y, tr.y, br.y, bl.y);
  }
}
