import {
  Plugin,
  Pen,
  Last,
  system,
  DrawEraser,
  RenderTransformer,
  RenderHighlighter,
} from '@infinite-canvas-tutorial/ecs';
// import { registerPen } from '@infinite-canvas-tutorial/webcomponents';
// import { html } from 'lit';
// import { msg, str } from '@lit/localize';
import { LaserPointerSystem } from './system';

export const LaserPointerPlugin: Plugin = () => {
  // registerPen(
  //   Pen.LASER_POINTER,
  //   html`<sp-icon-events slot="icon"></sp-icon-events>`,
  //   msg(str`Laser Pointer`),
  // );

  system((s) =>
    s
      .after(DrawEraser)
      .before(Last)
      .before(RenderTransformer, RenderHighlighter),
  )(LaserPointerSystem);
};
