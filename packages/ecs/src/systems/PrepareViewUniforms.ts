import { System } from '@lastolivegames/becsy';
import { AppConfig, Camera } from '../components';

/**
 * Update {@link Camera} component.
 */
export class PrepareViewUniforms extends System {
  queries = this.query(
    (q) => q.addedOrChanged.with(Camera).trackWrites.using(Camera).write,
  );

  /**
   * Global app config.
   */
  private readonly appConfig = this.singleton.read(AppConfig); // can't use # field here

  /**
   * Used for extracting view uniforms from camera.
   */
  prepareUniforms: () => void;

  execute(): void {
    const {
      canvas: { width, height },
    } = this.appConfig;

    this.queries.addedOrChanged.forEach((entity) => {
      const camera = entity.read(Camera);
      camera.projection(width, height);

      this.prepareUniforms = () => {};
    });
  }
}
