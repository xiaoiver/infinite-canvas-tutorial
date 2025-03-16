/**
 * @see https://bevy-cheatbook.github.io/graphics/camera.html
 * @see https://bevy-cheatbook.github.io/2d/camera.html
 *
 * @see https://bevyengine.org/examples/3d-rendering/split-screen/
 *
 * @example
 *
 * ```ts
 * const camera = this.commands.spawn(new Camera(), new Transform());
 * camera.appendChild(circle);
 * camera.appendChild(rect);
 * ```
 */

export class Camera {
  // @field.staticString([ClipSpaceNearZ.NEGATIVE_ONE, ClipSpaceNearZ.ZERO]) declare clipSpaceNearZ: ClipSpaceNearZ;
}
