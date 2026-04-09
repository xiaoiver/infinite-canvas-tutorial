import {
  AnimationController,
  normalizeAnimationOptions,
  normalizeKeyframes,
} from '../../packages/ecs/src/animation';

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
});
