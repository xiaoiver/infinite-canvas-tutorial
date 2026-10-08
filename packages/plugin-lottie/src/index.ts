import type * as Lottie from './type';
import type { LoadAnimationOptions } from './load-animation-options';
import { LottieAnimation } from './LottieAnimation';
import { parse } from './parser';
import { inspectLottie } from './diagnostics';

export { inspectLottie } from './diagnostics';
export type { LottieDiagnostic } from './diagnostics';

export type { LoadAnimationOptions } from './load-animation-options';

export { evaluateLottieExpression, propertyHasExpression } from './expressions';
export type {
  BakedKeyframeAnimation,
  ExpressionBakeContext,
  ExpressionKeyframe,
  LottieExpressionEvalContext,
} from './expressions';
export {
  ellipsePerimeter,
  getShapePerimeter,
  hasLottieTrim,
  lottieTrimToStrokeDash,
  readLottieTrim,
} from './trim-paths';

/**
 * @see https://github.com/airbnb/lottie-web/wiki/loadAnimation-options
 * @see https://github.com/airbnb/lottie-web#other-loading-options
 */
export function loadAnimation(
  data: Lottie.Animation,
  options: Partial<LoadAnimationOptions> = {},
): LottieAnimation {
  const diagnostics = inspectLottie(data);
  diagnostics.forEach((diagnostic) => options.onDiagnostic?.(diagnostic));
  // completeData normalizes paths in place; keep the caller's JSON reusable.
  const { width, height, elements, context } = parse(
    structuredClone(data),
    options,
  );
  return new LottieAnimation(width, height, elements, context, diagnostics);
}
