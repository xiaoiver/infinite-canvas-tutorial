import type * as Lottie from './type';
import type { LoadAnimationOptions } from './load-animation-options';
import { LottieAnimation } from './LottieAnimation';
import { parse } from './parser';

export type { LoadAnimationOptions } from './load-animation-options';

export {
  evaluateLottieExpression,
  propertyHasExpression,
} from './expressions';
export type {
  BakedKeyframeAnimation,
  ExpressionBakeContext,
  ExpressionKeyframe,
  LottieExpressionEvalContext,
} from './expressions';

/**
 * @see https://github.com/airbnb/lottie-web/wiki/loadAnimation-options
 * @see https://github.com/airbnb/lottie-web#other-loading-options
 */
export function loadAnimation(
  data: Lottie.Animation,
  options: Partial<LoadAnimationOptions>,
): LottieAnimation {
  const { width, height, elements, context } = parse(data, options);
  return new LottieAnimation(width, height, elements, context);
}