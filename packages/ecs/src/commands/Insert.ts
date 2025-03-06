import { ComponentType, Entity, System } from '@lastolivegames/becsy';
import { Command } from './Command';
import { Bundle } from '../components';

/**
 * A [`Command`] that adds the components in a [`Bundle`] to an entity.
 */
export class Insert implements Command {
  constructor(
    public id: Entity,
    public bundles: (ComponentType<any> | Bundle)[],
  ) {}

  apply(system: System) {
    this.bundles.forEach((bundle) => {
      this.addBundle(bundle);
    });
  }

  private addBundle(bundle: Bundle) {
    // Add bundle.
    if (bundle instanceof Bundle) {
      Object.keys(bundle).forEach((key) => {
        if (bundle[key] instanceof Bundle) {
          this.addBundle(bundle[key]);
        } else if (bundle[key]) {
          // @ts-ignore
          this.id.add(bundle[key].constructor, bundle[key]);
        }
      });
    } else {
      // Add component.
      // @ts-ignore
      this.id.add(bundle.constructor, bundle);
    }
  }
}
