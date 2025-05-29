import { System } from '@lastolivegames/becsy';
import {
  ComputedVisibility,
  Visibility,
  Children,
  Parent,
} from '../components';
import { getDescendants } from './Transform';

export class ComputeVisibility extends System {
  private readonly visibility = this.query(
    (q) => q.addedOrChanged.with(Visibility).trackWrites,
  );

  constructor() {
    super();
    this.query(
      (q) => q.using(ComputedVisibility).write.and.using(Parent, Children).read,
    );
  }

  execute() {
    // Calculate the visibility of the entity with cascade
    this.visibility.addedOrChanged.forEach((entity) => {
      const { value } = entity.read(Visibility);

      if (!entity.has(ComputedVisibility)) {
        entity.add(ComputedVisibility);
      }
      const computedVisibility = entity.write(ComputedVisibility);

      if (value === 'inherited') {
        const parent = entity.has(Children) && entity.read(Children).parent;
        if (parent && parent.has(ComputedVisibility)) {
          computedVisibility.visible = parent.read(ComputedVisibility).visible;
        } else {
          computedVisibility.visible = true;
        }
      } else if (value === 'hidden') {
        computedVisibility.visible = false;
      } else if (value === 'visible') {
        computedVisibility.visible = true;
      }

      const computed = computedVisibility.visible;

      // Update children cascade
      getDescendants(entity).forEach((child) => {
        if (
          child.has(Visibility) &&
          child.read(Visibility).value === 'inherited'
        ) {
          if (!child.has(ComputedVisibility)) {
            child.add(ComputedVisibility, { visible: computed });
          } else {
            child.write(ComputedVisibility).visible = computed;
          }
        }
      });
    });
  }
}
