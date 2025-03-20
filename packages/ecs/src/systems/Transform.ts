import { Entity, System } from '@lastolivegames/becsy';
import {
  Camera,
  Children,
  GlobalTransform,
  Parent,
  Transform,
} from '../components';
import { Mat3 } from '../components';
import { PostStartUp } from '..';

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
    this.schedule((s) => s.after(PostStartUp));
  }

  private syncTransform(
    entity: Entity,
    checkGlobalTransform: boolean = true,
  ): void {
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
      console.log('camera', entity);
    });

    // Update changed entities.
    this.queries.addedOrChanged.forEach((entity) => {
      this.syncTransform(entity);
      console.log('queries', entity);
    });

    // Update orphaned entities.
    this.orphaned.removed.forEach((entity) => {
      this.syncTransform(entity, false);
      console.log('removed', entity);
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
    this.schedule((s) => s.after(SyncSimpleTransforms));
  }

  execute(): void {
    this.queries.addedOrChanged.forEach((entity) => {
      // Camera's worldTransform reflects the camera's position in the world.
      // It is not affected by the hierarchy.
      const worldTransform = entity.has(Camera)
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
