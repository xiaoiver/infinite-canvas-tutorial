import { System } from '@lastolivegames/becsy';
import { ComputedPoints, Path } from '../components';
import { parsePath } from '../utils';

/**
 * Compute the points of the path according to the definition.
 */
export class ComputePoints extends System {
  paths = this.query((q) => q.addedOrChanged.with(Path).trackWrites);

  constructor() {
    super();
    this.query((q) => q.current.with(ComputedPoints).write);
  }

  execute() {
    this.paths.addedOrChanged.forEach((entity) => {
      const { d } = entity.read(Path);

      const { subPaths } = parsePath(d);
      const points = subPaths.map((subPath) =>
        subPath
          .getPoints()
          .map((point) => [point[0], point[1]] as [number, number]),
      );

      if (!entity.has(ComputedPoints)) {
        entity.add(ComputedPoints);
      }
      entity.write(ComputedPoints).points = points;
    });
  }
}
