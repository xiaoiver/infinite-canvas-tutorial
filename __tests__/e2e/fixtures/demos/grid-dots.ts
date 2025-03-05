import { Canvas } from '../../../../packages/core/src';
import { CheckboardStyle } from '../../../../packages/core/src/plugins';

export async function render(canvas: Canvas) {
  canvas.checkboardStyle = CheckboardStyle.DOTS;
  canvas.render();
}
