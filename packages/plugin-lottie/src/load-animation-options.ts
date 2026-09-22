export interface LoadAnimationOptions {
  /**
   * @see https://github.com/airbnb/lottie-web/blob/master/player/js/animation/AnimationItem.js#L43
   */
  loop: boolean | number;

  /**
   * @see https://github.com/airbnb/lottie-web/blob/master/player/js/animation/AnimationItem.js#L42
   */
  autoplay: boolean;

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EffectTiming/fill
   */
  fill: FillMode;

  /**
   * When true (default), properties with an AE expression (`x` string on the JSON property) are
   * baked into per-frame keyframes at composition range. This is not lottie-web’s full
   * ExpressionManager — only `time`, `value`, `frame`, `width`, `height`, and `Math` are provided.
   * Set false for untrusted JSON (expressions use `new Function`).
   *
   * @see https://lottiefiles.github.io/lottie-docs/expressions/
   * @see https://github.com/airbnb/lottie-web/blob/master/player/js/utils/expressions/Expressions.js
   */
  expressions?: boolean;

  /**
   * How to evaluate AE expression strings (`x` on JSON properties) when {@link expressions} is true.
   * - `simple`: `new Function` with `time`, `value`, `frame`, `width`, `height`, `Math` only.
   * - `lottie-web`: bundled lottie-web {@link https://github.com/airbnb/lottie-web/blob/master/player/js/utils/expressions/ExpressionManager.js ExpressionManager}
   *   plus layer mocks (shape layers `ty === 4`); falls back to `simple` behavior if init fails.
   *
   * @default 'simple'
   */
  expressionEngine?: 'simple' | 'lottie-web';
}
