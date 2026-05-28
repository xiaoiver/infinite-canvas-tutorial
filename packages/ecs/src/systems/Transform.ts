import { Entity, System } from '@lastolivegames/becsy';
import {
  Mat3,
  Camera,
  Children,
  GlobalTransform,
  Parent,
  Transform,
  Canvas,
} from '../components';

function syncTransform(
  entity: Entity,
  checkGlobalTransform: boolean = true,
): void {
  if (!entity.has(Transform)) {
    return;
  }

  const transform = entity.read(Transform);
  if (checkGlobalTransform && !entity.has(GlobalTransform)) {
    entity.add(GlobalTransform, new GlobalTransform());
  }
  entity.write(GlobalTransform).matrix = Mat3.fromTransform(transform);
}

/**
 * Update {@link GlobalTransform} component of entities that aren't in the hierarchy
 * Third party plugins should ensure that this is used in concert with {@link PropagateTransforms}.
 */
export class SyncSimpleTransforms extends System {
  queries = this.query(
    (q) =>
      q.addedOrChanged.with(Transform).but.without(Parent, Children)
        .trackWrites,
  );

  cameras = this.query(
    (q) =>
      q.addedOrChanged.with(Transform, Parent).without(Children).trackWrites,
  );

  orphaned = this.query((q) => q.removed.with(Parent));

  constructor() {
    super();
    this.query((q) => q.using(GlobalTransform).write);
  }

  execute(): void {
    this.cameras.addedOrChanged.forEach((entity) => {
      syncTransform(entity);
    });

    // Update changed entities.
    this.queries.addedOrChanged.forEach((entity) => {
      syncTransform(entity);
    });

    // Update orphaned entities.
    this.orphaned.removed.forEach((entity) => {
      syncTransform(entity, false);
    });
  }
}

/**
 * Update {@link GlobalTransform} component of entities based on entity hierarchy and {@link Transform} components.
 * Use `after` constraints here to ensure that the {@link SyncSimpleTransforms} system has run first.
 * @see https://lastolivegames.github.io/becsy/guide/architecture/systems#execution-order
 */
export class PropagateTransforms extends System {
  queries = this.query(
    (q) =>
      q
        .without(Camera)
        .with(Transform)
        .addedOrChanged.trackWrites.using(GlobalTransform).write,
  );

  constructor() {
    super();
    this.query((q) => q.using(Canvas, Camera, Parent, Children).read);
  }

  execute(): void {
    this.queries.addedOrChanged.forEach((entity) => {
      updateGlobalTransform(entity);
    });
  }
}

/** Returns false if the entity was deleted (Becsy throws on component access). */
export function isEntityAlive(entity: Entity | undefined): entity is Entity {
  if (!entity) {
    return false;
  }
  try {
    void entity.has(Camera);
    return true;
  } catch {
    return false;
  }
}

export function getSceneRoot(entity: Entity): Entity {
  if (!isEntityAlive(entity) || !entity.has(Children)) {
    return entity;
  }

  const parent = entity.read(Children).parent;
  if (parent && isEntityAlive(parent)) {
    return getSceneRoot(parent);
  }
  return entity;
}

export function getDescendants(
  entity: Entity,
  compareFn?: (a: Entity, b: Entity) => number,
): Entity[] {
  if (!entity.has(Parent)) {
    return [];
  }
  const children = [...entity.read(Parent).children];

  if (compareFn) {
    children.sort(compareFn);
  }

  return children.flatMap((child) => [
    child,
    ...getDescendants(child, compareFn),
  ]);
}

export function updateGlobalTransform(entity: Entity): void {
  if (!isEntityAlive(entity) || !entity.has(Transform)) {
    return;
  }

  let parentWorldTransform = Mat3.IDENTITY;
  if (entity.has(Children)) {
    const parent = entity.read(Children).parent;
    if (parent && isEntityAlive(parent)) {
      parentWorldTransform = parent.has(Camera)
        ? Mat3.IDENTITY
        : parent.has(GlobalTransform)
          ? parent.read(GlobalTransform).matrix
          : Mat3.IDENTITY;
    }
  }

  const localTransform = entity.read(Transform);
  const worldTransform = parentWorldTransform.mul_mat3(
    Mat3.fromTransform(localTransform),
  );
  if (!entity.has(GlobalTransform)) {
    entity.add(GlobalTransform, new GlobalTransform(worldTransform));
  } else {
    entity.write(GlobalTransform).matrix = worldTransform;
  }

  if (entity.has(Parent)) {
    entity.read(Parent).children.forEach((child) => {
      if (isEntityAlive(child)) {
        updateGlobalTransform(child);
      }
    });
  }
}
