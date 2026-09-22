import { Entity, field } from '@lastolivegames/becsy';

/**
 * Tags 3D entities ({@link Mesh3D}, {@link Light3D}, {@link Camera3D}) with the
 * {@link Canvas} they belong to. Required when multiple canvases share one App.
 */
export class Canvas3DScope {
  @field.ref declare canvas: Entity;

  constructor(props?: { canvas?: Entity }) {
    if (props?.canvas) {
      this.canvas = props.canvas;
    }
  }
}
