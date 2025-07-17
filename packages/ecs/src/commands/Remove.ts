import { ComponentType, Entity, System } from '@lastolivegames/becsy';
import { Command } from './Command';
import { Bundle } from '../components';

/**
 * A [`Command`] that removes the components in a [`Bundle`] from an entity.
 */
export class Remove implements Command {
  constructor(
    public id: Entity,
    public bundles: (ComponentType<any> | Bundle)[],
  ) {}

  apply(system: System) {
    this.bundles.forEach((bundle) => {
      this.removeBundle(bundle);
    });
  }

  private removeBundle(bundle: Bundle) {
    try {
      // Remove bundle.
      if (bundle instanceof Bundle) {
        Object.keys(bundle).forEach((key) => {
          if (bundle[key] instanceof Bundle) {
            this.removeBundle(bundle[key]);
          } else if (bundle[key]) {
            // @ts-ignore
            this.id.remove(bundle[key].constructor, bundle[key]);
          }
        });
      } else {
        // Remove component.
        // @ts-ignore
        this.id.remove(bundle.constructor, bundle);
      }
    } catch (e) {
      console.log(e);
    }
  }
}
