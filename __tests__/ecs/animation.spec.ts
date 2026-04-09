import {
  AnimationController,
  normalizeAnimationOptions,
  normalizeKeyframes,
} from '../../packages/ecs/src/animation';
import { computeTranslationWithTransformOrigin } from '../../packages/ecs/src/systems/Animation';

describe('Animation', () => {
  describe('normalizeAnimationOptions', () => {
    it('should fill defaults for optional fields', () => {
      const options = normalizeAnimationOptions({ duration: 1000 });
      expect(options).toMatchObject({
        duration: 1000,
        delay: 0,
        iterations: 1,
        direction: 'normal',
        fill: 'none',
        easing: 'linear',
      });
    });

    it('should keep transformOrigin when valid', () => {
      const options = normalizeAnimationOptions({
        duration: 300,
        transformOrigin: { x: 50, y: 25 },
      });
      expect(options.transformOrigin).toEqual({ x: 50, y: 25 });
    });
  });

  describe('normalizeKeyframes', () => {
    it('should auto-calculate missing offsets and inherit easing', () => {
      const keyframes = normalizeKeyframes(
        [{ x: 0 }, { x: 50 }, { x: 100 }],
        'ease-in',
      );

      expect(keyframes[0].offset).toBe(0);
      expect(keyframes[1].offset).toBe(0.5);
      expect(keyframes[2].offset).toBe(1);
      expect(keyframes[0].easing).toBe('ease-in');
      expect(keyframes[1].easing).toBe('ease-in');
      expect(keyframes[2].easing).toBe('ease-in');
    });
  });

  describe('AnimationController', () => {
    it('should interpolate named colors with d3-color parser', () => {
      const controller = new AnimationController(
        [
          { fill: 'green' },
          { fill: 'red' },
        ],
        { duration: 1000, easing: 'linear', fill: 'both' },
      );

      controller.seek(500);
      const values = controller.getCurrentValues();
      expect(values?.fill).toBe('rgba(128, 64, 0, 1)');
    });

    it('should interpolate strokeDasharray from string literals', () => {
      const controller = new AnimationController(
        [
          { strokeDasharray: '10 5' },
          { strokeDasharray: '2 11' },
        ],
        { duration: 1000, easing: 'linear', fill: 'both' },
      );

      controller.seek(500);
      const values = controller.getCurrentValues();
      expect(values?.strokeDasharray).toEqual([6, 8]);
    });

    it('should keep strokeDashoffset key intact for system mapping', () => {
      const controller = new AnimationController(
        [
          { strokeDashoffset: 0 },
          { strokeDashoffset: -20 },
        ],
        { duration: 1000, easing: 'linear', fill: 'both' },
      );

      controller.seek(250);
      const values = controller.getCurrentValues();
      expect(values?.strokeDashoffset).toBe(-5);
    });

    it('should return null before delay when fill mode is none', () => {
      const controller = new AnimationController(
        [{ x: 0 }, { x: 100 }],
        { duration: 1000, delay: 200, fill: 'none' },
      );

      controller.seek(100);
      expect(controller.getCurrentValues()).toBeNull();
    });
  });

  describe('transform origin compensation', () => {
    it('should keep origin world position unchanged when rotating', () => {
      const result = computeTranslationWithTransformOrigin({
        currentTranslation: { x: 0, y: 0 },
        currentScale: { x: 1, y: 1 },
        currentRotation: 0,
        nextScale: { x: 1, y: 1 },
        nextRotation: Math.PI / 2,
        origin: { x: 10, y: 0 },
      });

      // rotate around (10,0): entity origin should move to (10,-10)
      expect(result.x).toBeCloseTo(10, 6);
      expect(result.y).toBeCloseTo(-10, 6);
    });
  });
});
