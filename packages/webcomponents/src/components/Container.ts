import { field } from '@infinite-canvas-tutorial/ecs';
import { LitElement } from 'lit';

/**
 * Store the lit element that will be used to render the canvas.
 */
export class Container {
  @field.object declare element: LitElement;
}
