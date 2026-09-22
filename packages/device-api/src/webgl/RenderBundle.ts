import { RenderBundle, ResourceType } from '../api';
import { ResourceBase_GL } from './ResourceBase';

export class RenderBundle_GL extends ResourceBase_GL implements RenderBundle {
  type: ResourceType.RenderBundle = ResourceType.RenderBundle;

  private commands: (() => void)[] = [];

  push(f: () => void) {
    this.commands.push(f);
  }

  replay() {
    this.commands.forEach((f) => f());
  }
}
