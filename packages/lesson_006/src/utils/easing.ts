import BezierEasing from 'bezier-easing';

export const EASING_FUNCTION = {
  linear: BezierEasing(0, 0, 1, 1),
  ease: BezierEasing(0.25, 0.1, 0.25, 1),
  'ease-in': BezierEasing(0.42, 0, 1, 1),
  'ease-out': BezierEasing(0, 0, 0.58, 1),
  'ease-in-out': BezierEasing(0.42, 0, 0.58, 1),
};
