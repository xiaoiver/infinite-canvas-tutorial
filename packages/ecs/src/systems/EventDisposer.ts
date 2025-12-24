import { System } from '@lastolivegames/becsy';
import { Camera, Canvas, Input, InputPoint } from '../components';

export class EventDisposer extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera).read);

  constructor() {
    super();
    this.query((q) => q.using(Canvas, InputPoint, Input).write);
  }

  execute() {
    this.cameras.current.forEach((camera) => {
      if (!camera.has(Camera)) {
        return;
      }

      const { canvas } = camera.read(Camera);
      if (!canvas) {
        return;
      }

      const input = canvas.write(Input);

      Object.assign(input, {
        wheelTrigger: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        key: undefined,
      });
    });
  }
}
