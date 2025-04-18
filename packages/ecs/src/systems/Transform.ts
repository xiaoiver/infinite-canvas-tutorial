import { Entity, System } from '@lastolivegames/becsy';
import {
  Mat3,
  Camera,
  Children,
  GlobalTransform,
  Parent,
  Transform,
} from '../components';

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

  private syncTransform(
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
    const globalTransform = entity.write(GlobalTransform);
    globalTransform.from(transform);
  }

  execute(): void {
    this.cameras.addedOrChanged.forEach((entity) => {
      this.syncTransform(entity);
    });

    // Update changed entities.
    this.queries.addedOrChanged.forEach((entity) => {
      this.syncTransform(entity);
    });

    // Update orphaned entities.
    this.orphaned.removed.forEach((entity) => {
      this.syncTransform(entity, false);
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
        .with(Transform, Parent)
        .addedOrChanged.trackWrites.using(GlobalTransform).write,
  );

  constructor() {
    super();
    this.query((q) => q.using(Camera).read);
  }

  execute(): void {
    this.queries.addedOrChanged.forEach((entity) => {
      // Camera's worldTransform reflects the camera's position in the world.
      // It is not affected by the hierarchy.
      const worldTransform =
        entity.has(Camera) || !entity.has(GlobalTransform)
          ? new GlobalTransform()
          : entity.read(GlobalTransform);

      entity.read(Parent).children.forEach((child) => {
        const localTransform = child.read(Transform);

        if (!child.has(GlobalTransform)) {
          child.add(GlobalTransform, new GlobalTransform());
        }

        child.write(GlobalTransform).matrix = worldTransform.matrix.mul_mat3(
          Mat3.from_scale_angle_translation(
            localTransform.scale,
            localTransform.rotation,
            localTransform.translation,
          ),
        );
      });
    });
  }
}

export function getSceneRoot(entity: Entity): Entity {
  if (!entity.has(Children)) {
    return entity;
  }

  const parent = entity.read(Children).parent;
  if (parent) {
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
