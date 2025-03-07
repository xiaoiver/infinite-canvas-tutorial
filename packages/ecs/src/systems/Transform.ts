import { Entity, system, System } from '@lastolivegames/becsy';
import { Children, GlobalTransform, Parent, Transform } from '../components';
import { Mat3 } from '../components/math/Mat3';

/**
 * Update {@link GlobalTransform} component of entities that aren't in the hierarchy
 * Third party plugins should ensure that this is used in concert with {@link PropagateTransforms}.
 */
export class SyncSimpleTransforms extends System {
  queries = this.query(
    (q) =>
      q.addedOrChanged
        .with(Transform)
        .but.without(Parent, Children)
        .trackWrites.using(GlobalTransform).write,
  );

  root = this.query(
    (q) =>
      q.addedOrChanged
        .with(Transform, Parent)
        .without(Children)
        .trackWrites.using(GlobalTransform).write,
  );

  orphaned = this.query(
    (q) => q.removed.with(Parent).using(GlobalTransform).write,
  );

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
    // Update changed entities.
    this.queries.addedOrChanged.forEach((entity) => {
      this.syncTransform(entity);
    });

    this.root.addedOrChanged.forEach((entity) => {
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
@system((s) => s.after(SyncSimpleTransforms))
export class PropagateTransforms extends System {
  queries = this.query(
    (q) =>
      q.addedOrChanged
        .with(Transform, Parent)
        .trackWrites.using(GlobalTransform).write,
  );

  execute(): void {
    this.queries.addedOrChanged.forEach((entity) => {
      const worldTransform = entity.read(GlobalTransform);

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
