import { Entity, System } from '@lastolivegames/becsy';
import { Renderable } from '../components';
import RBush from 'rbush';
import {
  AABB,
  Camera,
  Canvas,
  Children,
  ComputedBounds,
  ComputedCamera,
  Culled,
  Parent,
  Visibility,
} from '../components';
import { CameraControl } from './CameraControl';
import { getDescendants, getSceneRoot } from './Transform';

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
    (q) => q.current.and.addedOrChanged.with(ComputedCamera).trackWrites,
  );

  visibilities = this.query(
    (q) => q.addedChangedOrRemoved.with(Visibility).trackWrites,
  );

  /**
   * Use its viewport2Canvas method.
   */
  cameraControl = this.attach(CameraControl);

  /**
   * Map of camera entity id to its viewport's AABB.
   */
  #cameraViewportMap: WeakMap<Entity, AABB> = new WeakMap();

  #cameraRBushMap: WeakMap<Entity, RBush<RBushNodeAABB>> = new WeakMap();

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(Camera, Canvas, Children, Parent, Renderable)
          .read.and.using(Culled).write,
    );
  }

  execute() {
    const entitiesToCull: WeakMap<Entity, Set<Entity>> = new WeakMap();
    this.cameras.current.forEach((camera) => {
      entitiesToCull.set(camera, new Set());
    });

    this.cameras.addedOrChanged.forEach((camera) => {
      this.updateViewport(camera);

      // Recalcaulate all renderables' culled status under this camera.
      getDescendants(camera).forEach((child) => {
        entitiesToCull.get(camera)?.add(child);
      });
    });

    this.visibilities.addedChangedOrRemoved.forEach((entity) => {
      const camera = getSceneRoot(entity);
      if (entitiesToCull.has(camera)) {
        entitiesToCull.get(camera)?.add(entity);
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
      if (!removed.has(camera)) {
        removed.set(camera, new Set());
      }
      removed.get(camera)?.add(entity);
    });

    [removed, modified].forEach((map) => {
      map.forEach((entities, camera) => {
        const rBush = this.getOrCreateRBush(camera);

        entities.forEach((entity) => {
          entitiesToCull.get(camera)?.add(entity);

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

    modified.forEach((entities, camera) => {
      const rBush = this.getOrCreateRBush(camera);

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
    });

    // Write culled component.
    this.cameras.current.forEach((camera) => {
      if (entitiesToCull.get(camera)?.size === 0) {
        return;
      }

      const rBush = this.getOrCreateRBush(camera);
      const viewport = this.getOrCreateViewport(camera);

      const entitiesInViewport = rBush
        .search(viewport)
        .map((bush) => bush.entity);

      entitiesToCull.get(camera)?.forEach((entity) => {
        if (!entity.has(Visibility)) {
          return;
        }

        const visibility = entity.read(Visibility);

        if (!entity.has(Renderable)) {
          return;
        }

        // TODO: inherit visibility from parent
        if (
          visibility.value === 'visible' &&
          entitiesInViewport.includes(entity)
        ) {
          if (entity.has(Culled)) {
            entity.remove(Culled);
          }
        } else if (
          visibility.value === 'hidden' ||
          !entitiesInViewport.includes(entity)
        ) {
          if (!entity.has(Culled)) {
            entity.add(Culled);
          }
        }
      });
    });
  }

  elementsFromBBox(
    camera: Entity,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ) {
    const rBush = this.getOrCreateRBush(camera);

    const rBushNodes = rBush.search({
      minX,
      minY,
      maxX,
      maxY,
    });

    console.log(minX, minY, rBushNodes);

    return rBushNodes.map((node) => node.entity);
  }

  private getOrCreateRBush(camera: Entity) {
    let rBush = this.#cameraRBushMap.get(camera);
    if (!rBush) {
      this.#cameraRBushMap.set(camera, new RBush<RBushNodeAABB>());
      rBush = this.#cameraRBushMap.get(camera);
    }
    return rBush;
  }

  private getOrCreateViewport(camera: Entity) {
    let viewport = this.#cameraViewportMap.get(camera);
    if (!viewport) {
      this.#cameraViewportMap.set(camera, new AABB());
      viewport = this.#cameraViewportMap.get(camera);
    }
    return viewport;
  }

  private updateViewport(camera: Entity) {
    const { width, height } = camera.read(Camera).canvas.read(Canvas);
    // tl, tr, br, bl
    const tl = this.cameraControl.viewport2Canvas(camera, {
      x: 0,
      y: 0,
    });
    const tr = this.cameraControl.viewport2Canvas(camera, {
      x: width,
      y: 0,
    });
    const br = this.cameraControl.viewport2Canvas(camera, {
      x: width,
      y: height,
    });
    const bl = this.cameraControl.viewport2Canvas(camera, {
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
