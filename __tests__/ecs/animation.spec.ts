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

  describe('editing', () => {
    it('should report distinct animated property names', () => {
      const controller = new AnimationController(
        [
          { x: 0, opacity: 0 },
          { x: 100, opacity: 1 },
        ],
        { duration: 1000 },
      );
      expect(controller.getAnimatedProperties().sort()).toEqual([
        'opacity',
        'x',
      ]);
    });

    it('should compute total duration as delay + duration * iterations', () => {
      const controller = new AnimationController([{ x: 0 }, { x: 1 }], {
        duration: 500,
        delay: 200,
        iterations: 3,
      });
      expect(controller.getDuration()).toBe(200 + 500 * 3);
    });

    it('should collapse infinite iterations to a single iteration for duration', () => {
      const controller = new AnimationController([{ x: 0 }, { x: 1 }], {
        duration: 400,
        delay: 100,
        iterations: Infinity,
      });
      expect(controller.getDuration()).toBe(100 + 400);
    });

    it('should re-normalize keyframes on setKeyframes and preserve playback time', () => {
      const controller = new AnimationController([{ x: 0 }, { x: 100 }], {
        duration: 1000,
        fill: 'both',
      });
      controller.seek(500);
      controller.setKeyframes([{ x: 0 }, { x: 200 }, { x: 400 }]);

      const frames = controller.getKeyframes();
      expect(frames.map((f) => f.offset)).toEqual([0, 0.5, 1]);
      // Position is preserved, so re-sampling at the same time still works.
      expect(controller.getCurrentValues()?.x).toBeCloseTo(200, 6);
    });

    it('should update a single keyframe value by index', () => {
      const controller = new AnimationController([{ x: 0 }, { x: 100 }], {
        duration: 1000,
        fill: 'both',
      });
      controller.updateKeyframe(1, { x: 50 });
      controller.seek(1000);
      expect(controller.getCurrentValues()?.x).toBeCloseTo(50, 6);
    });

    it('should insert and remove keyframes (keeping at least one)', () => {
      const controller = new AnimationController([{ x: 0 }, { x: 100 }], {
        duration: 1000,
      });
      controller.insertKeyframe({ offset: 0.5, x: 25 });
      expect(controller.getKeyframes()).toHaveLength(3);

      controller.removeKeyframe(1);
      expect(controller.getKeyframes()).toHaveLength(2);

      // Cannot drop below a single keyframe.
      controller.removeKeyframe(0);
      controller.removeKeyframe(0);
      expect(controller.getKeyframes().length).toBeGreaterThanOrEqual(1);
    });

    it('should re-normalize options through setOptions', () => {
      const controller = new AnimationController([{ x: 0 }, { x: 1 }], {
        duration: 1000,
      });
      controller.setOptions({ duration: 2000, delay: 100 });
      const options = controller.getOptions();
      expect(options.duration).toBe(2000);
      expect(options.delay).toBe(100);
      // Untouched fields keep their normalized defaults.
      expect(options.iterations).toBe(1);
    });

    it('should produce a JSON round-trippable serialize() snapshot', () => {
      const controller = new AnimationController(
        [
          { x: 0, opacity: 0 },
          { x: 100, opacity: 1 },
        ],
        { duration: 1000, delay: 50, easing: 'ease-in' },
      );

      const serialized = controller.serialize();
      const clone = JSON.parse(JSON.stringify(serialized));
      const restored = new AnimationController(clone.keyframes, clone.options);

      expect(restored.getOptions().duration).toBe(1000);
      expect(restored.getOptions().delay).toBe(50);
      expect(restored.getAnimatedProperties().sort()).toEqual([
        'opacity',
        'x',
      ]);
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
