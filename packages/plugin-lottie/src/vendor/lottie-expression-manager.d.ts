/**
 * Bundled from airbnb/lottie-web ExpressionManager (see scripts in package README).
 */
declare const ExpressionManager: {
  initiateExpression: (
    elem: unknown,
    data: unknown,
    property: unknown,
  ) => (value: unknown) => unknown;
  resetFrame: () => void;
};
export default ExpressionManager;
