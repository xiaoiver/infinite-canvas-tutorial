import { co, System } from '@lastolivegames/becsy';
import { CanvasConfig, Event, InteractivePointerEvent } from '../components';
import { getGlobalThis } from '../utils';

export class CameraControl extends System {
  private readonly event = this.singleton.read(Event);

  execute() {
    // if (this.event.value) {
    //   console.log(this.event.value.type);
    // }
  }
}
