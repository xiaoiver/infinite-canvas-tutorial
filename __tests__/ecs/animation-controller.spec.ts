import {
  AnimationController,
  normalizeAnimationOptions,
  normalizeKeyframes,
  type AnimationDirection,
  type AnimationFillMode,
  type AnimationOptions,
  type Keyframe,
} from '../../packages/ecs/src/animation';
import { parseGradient } from '../../packages/ecs/src/utils/gradient';
import { normalizePathCommands } from '../../packages/ecs/src/utils/path-edit';

const create = (
  options: Partial<AnimationOptions> = {},
  frames: Keyframe[] = [{ x: 0 }, { x: 100 }],
) =>
  new AnimationController(frames, { duration: 1000, fill: 'both', ...options });

describe('animation timing and state', () => {
  it('pauses and resumes at the sampled position without counting paused wall time', () => {
    const c = create();
    c.pause();
    expect(c.getPlayState()).toBe('idle');
    c.play(1000);
    c.tick(1250);
    c.play(9000); // already running: no restart
    expect(c.tick(1500).currentTime).toBe(500);
    c.pause();
    expect(c.tick(9500).currentTime).toBe(500);
    expect(c.getCurrentValues()?.x).toBe(50);
    c.play(10000);
    expect(c.tick(10200).currentTime).toBe(700);
    expect(c.getCurrentValues()?.x).toBe(70);
  });

  it('seeks a paused controller, clamps negative time and resumes from the new position', () => {
    const c = create();
    c.seek(-50);
    expect(c.getPlayState()).toBe('paused');
    expect(c.getCurrentTime()).toBe(0);
    c.seek(600);
    expect(c.tick(10000).currentTime).toBe(600);
    c.play(10000);
    expect(c.tick(10100).currentTime).toBe(700);
  });

  it.each([0, NaN, Infinity, -Infinity])(
    'rejects invalid playback rate %s without changing the previous rate',
    (rate) => {
      const c = create();
      c.setPlaybackRate(2);
      expect(() => c.setPlaybackRate(rate)).toThrow('finite non-zero');
      expect(c.getPlaybackRate()).toBe(2);
    },
  );
  it.each([NaN, Infinity, -Infinity])(
    'rejects non-finite seek %s without moving',
    (time) => {
      const c = create();
      c.seek(250);
      expect(() => c.seek(time)).toThrow('finite');
      expect(c.getCurrentTime()).toBe(250);
    },
  );
  it.each([0.5, 2, -2])(
    'applies playback rate %s and preserves position across pause',
    (rate) => {
      const c = create();
      c.setPlaybackRate(rate);
      c.play(1000);
      expect(c.tick(1100).currentTime).toBe(100 * Math.abs(rate));
      expect(c.getCurrentValues()?.x).toBe(rate < 0 ? 80 : 10 * rate);
      c.pause();
      c.play(10000);
      expect(c.tick(10100).currentTime).toBe(200 * Math.abs(rate));
    },
  );

  it('can cancel and replay a running controller from the beginning', () => {
    const c = create();
    c.play(1000);
    c.tick(1400);
    c.cancel();
    expect(c.getPlayState()).toBe('cancelled');
    expect(c.tick(10000).currentTime).toBe(0);
    c.play(10000);
    expect(c.tick(10200).currentTime).toBe(200);
  });
  it('finishes finite tracks and keeps infinite tracks at their current position', () => {
    const c = create({ delay: 100, iterations: 3 });
    c.finish();
    expect(c.getCurrentTime()).toBe(3100);
    expect(c.getPlayState()).toBe('finished');
    expect(c.getCurrentValues()?.x).toBe(100);
    const infinite = create({ iterations: 'infinite' });
    infinite.seek(3400);
    infinite.finish();
    expect(infinite.getCurrentTime()).toBe(3400);
    expect(infinite.getPlayState()).toBe('finished');
    expect(infinite.getCurrentValues()?.x).toBe(40);
  });

  for (const fill of [
    'none',
    'backwards',
    'forwards',
    'both',
  ] as AnimationFillMode[]) {
    it(`applies ${fill} fill on each side of the delay and active interval`, () => {
      const c = create({ delay: 200, fill });
      c.seek(100);
      expect(c.getSnapshot()).toMatchObject({
        isBefore: true,
        isActive: false,
        isAfter: false,
      });
      expect(c.getCurrentValues()).toEqual(
        ['both', 'backwards'].includes(fill) ? { x: 0 } : null,
      );
      c.seek(200);
      expect(c.getCurrentValues()).toEqual({ x: 0 });
      c.seek(700);
      expect(c.getCurrentValues()).toEqual({ x: 50 });
      c.seek(1200);
      expect(c.getCurrentValues()).toEqual({ x: 100 });
      c.seek(1201);
      expect(c.getSnapshot()).toMatchObject({
        isBefore: false,
        isActive: false,
        isAfter: true,
      });
      expect(c.getCurrentValues()).toEqual(
        ['both', 'forwards'].includes(fill) ? { x: 100 } : null,
      );
    });
  }
  const directions: [AnimationDirection, number[], number][] = [
    ['normal', [25, 25, 25], 100],
    ['reverse', [75, 75, 75], 0],
    ['alternate', [25, 75, 25], 100],
  ];
  it.each(directions)(
    'samples %s direction across repeats and at the finite endpoint',
    (direction, expected, end) => {
      const c = create({ iterations: 3, direction });
      [250, 1250, 2250].forEach((time, i) => {
        c.seek(time);
        expect(c.getSnapshot().currentIteration).toBe(i);
        expect(c.getCurrentValues()?.x).toBe(expected[i]);
      });
      c.seek(3000);
      expect(c.getCurrentValues()?.x).toBe(end);
      c.seek(3100);
      expect(c.getCurrentValues()?.x).toBe(end);
    },
  );
  it('finishes an even alternate track on its first value and never advances an infinite track to finished', () => {
    const c = create({ iterations: 2, direction: 'alternate' });
    c.play(0);
    c.tick(2000);
    expect(c.getPlayState()).toBe('finished');
    expect(c.getCurrentValues()?.x).toBe(0);
    const infinite = create({ iterations: 'infinite' });
    infinite.play(0);
    infinite.tick(10250);
    expect(infinite.getPlayState()).toBe('running');
    expect(infinite.getCurrentValues()?.x).toBe(25);
  });
  it('reverses direction before playback and while paused', () => {
    const c = create();
    c.reverse(0);
    c.play(0);
    c.tick(250);
    expect(c.getSnapshot().direction).toBe('backward');
    expect(c.getCurrentValues()?.x).toBe(75);
    c.pause();
    c.reverse(250);
    expect(c.getPlaybackRate()).toBe(1);
    expect(c.getPlayState()).toBe('paused');
  });
});

describe('keyframe editing and easing', () => {
  it('normalizes missing/invalid timings and rejects invalid transform origins', () => {
    expect(
      normalizeAnimationOptions({
        duration: NaN,
        delay: Infinity,
        easing: 'unknown',
        transformOrigin: { x: 1, y: NaN },
      }),
    ).toMatchObject({
      duration: 300,
      delay: 0,
      easing: 'linear',
      transformOrigin: undefined,
    });
    expect(
      normalizeAnimationOptions({ duration: -20, delay: -10 }),
    ).toMatchObject({ duration: 0, delay: 0 });
    const c = create({ transformOrigin: { x: 10, y: 20 } });
    c.setOptions({ transformOrigin: undefined });
    expect(c.getOptions().transformOrigin).toBeUndefined();
  });
  it('interpolates missing offsets between explicit offsets without mutating input', () => {
    const frames = [
      { offset: -1, x: 0 },
      { x: 1 },
      { x: 2 },
      { offset: 0.9, x: 3 },
      { offset: 2, x: 4 },
    ];
    const before = structuredClone(frames);
    expect(normalizeKeyframes(frames).map((frame) => frame.offset)).toEqual([
      0, 0.3, 0.6, 0.9, 1,
    ]);
    expect(frames).toEqual(before);
    expect(() => normalizeKeyframes([])).toThrow('at least one');
  });
  it('retains a single keyframe, ignores out-of-range edits, and keeps runtime state on valid edits', () => {
    const c = create();
    c.play(0);
    c.tick(250);
    const before = c.serialize();
    c.updateKeyframe(-1, { x: 999 });
    c.updateKeyframe(2, { x: 999 });
    c.removeKeyframe(-1);
    c.removeKeyframe(2);
    expect(c.serialize()).toEqual(before);
    c.setKeyframes([{ x: 20 }]);
    c.removeKeyframe(0);
    expect(c.getKeyframes()).toHaveLength(1);
    expect(c.getPlayState()).toBe('running');
    expect(c.getCurrentTime()).toBe(250);
    expect(c.getCurrentValues()).toEqual({ x: 20 });
    before.keyframes[0].x = 999;
    expect(c.getCurrentValues()).toEqual({ x: 20 });
  });
  it('carries sparse values from the adjacent frame and preserves discrete values until the endpoint', () => {
    const c = create({}, [
      { x: 0, visible: false },
      { opacity: 0.5, visible: true },
    ]);
    c.seek(500);
    expect(c.getCurrentValues()).toEqual({
      x: 0,
      opacity: 0.5,
      visible: false,
    });
    c.seek(1000);
    expect(c.getCurrentValues()).toEqual({
      x: undefined,
      opacity: 0.5,
      visible: true,
    });
  });
  it('respects explicit keyframe intervals and nonlinear easing', () => {
    const c = create({}, [
      { offset: 0.2, x: 10 },
      { offset: 0.6, x: 50, easing: 'ease-in' },
      { offset: 0.8, x: 90 },
    ]);
    c.seek(100);
    expect(c.getCurrentValues()?.x).toBe(10);
    c.seek(400);
    expect(c.getCurrentValues()?.x).toBeGreaterThan(10);
    expect(c.getCurrentValues()?.x).toBeLessThan(30);
    c.seek(700);
    expect(c.getCurrentValues()?.x).toBeCloseTo(70);
    c.seek(900);
    expect(c.getCurrentValues()?.x).toBe(90);
  });
  it.each(['spring(1, 100, 5)', 'spring(1, 100, 20)', 'spring(1, 100, 30)'])(
    'samples finite bounded values with %s',
    (easing) => {
      const c = create({ easing });
      c.seek(500);
      const value = c.getCurrentValues()?.x as number;
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(50);
      expect(value).toBeLessThanOrEqual(100);
    },
  );
  it.each([
    'spring(0, 100, 5)',
    'spring(1, -1, 5)',
    'spring(., 100, 5)',
    'unknown',
  ])('falls back to linear for invalid easing %s', (easing) => {
    const c = create({ easing });
    c.seek(250);
    expect(c.getCurrentValues()?.x).toBe(25);
  });
});

describe('animated paints and geometry', () => {
  it.each([
    [
      [10, 20],
      [30, 40],
      [20, 30],
    ],
    ['10, 20', '30 40', [20, 30]],
    [
      [10, NaN],
      [30, 40],
      [10, NaN],
    ],
    [false, true, false],
  ])(
    'interpolates compatible dash arrays and leaves other values discrete',
    (from, to, expected) => {
      const c = create({}, [{ value: from }, { value: to }]);
      c.seek(500);
      expect(c.getCurrentValues()?.value).toEqual(expected);
    },
  );
  it('interpolates alpha without NaN channels for transparent paint', () => {
    const c = create({}, [
      { fill: 'transparent' },
      { fill: 'rgba(255, 0, 0, 0.8)' },
    ]);
    c.seek(500);
    expect(c.getCurrentValues()?.fill).toBe('rgba(128, 0, 0, 0.4)');
  });
  it('resamples unequal linear-gradient stops and interpolates angle, color and alpha', () => {
    const c = create({}, [
      { fill: 'linear-gradient(0deg, red 0%, blue 100%)' },
      {
        fill: 'linear-gradient(180deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.5) 50%, rgba(0, 0, 0, 0.5) 100%)',
      },
    ]);
    c.seek(500);
    expect(c.getCurrentValues()?.fill).toBe(
      'linear-gradient(90deg, rgba(128, 0, 0, 0.75) 0%, rgba(64, 0, 64, 0.75) 50%, rgba(0, 0, 128, 0.75) 100%)',
    );
    expect(parseGradient(c.getCurrentValues()!.fill as string)?.[0].type).toBe(
      'linear-gradient',
    );
  });
  it('retains nonuniform stop positions when interpolating a gradient with itself', () => {
    const paint = 'linear-gradient(30deg, red 25%, blue 75%)';
    const c = create({}, [{ fill: paint }, { fill: paint }]);
    c.seek(500);
    expect(c.getCurrentValues()?.fill).toBe(
      'linear-gradient(30deg, rgb(255, 0, 0) 25%, rgb(0, 0, 255) 75%)',
    );
  });
  it('preserves both colors of a hard gradient stop', () => {
    const paint = 'linear-gradient(0deg, red 0%, red 50%, blue 50%, blue 100%)';
    const c = create({}, [{ fill: paint }, { fill: paint }]);
    c.seek(500);
    expect(c.getCurrentValues()?.fill).toBe(
      'linear-gradient(0deg, rgb(255, 0, 0) 0%, rgb(255, 0, 0) 50%, rgb(0, 0, 255) 50%, rgb(0, 0, 255) 100%)',
    );
  });
  it('retains a hard stop when aligning gradients with unequal stop counts', () => {
    const c = create({}, [
      { fill: 'linear-gradient(0deg, red 0%, red 50%, blue 50%, blue 100%)' },
      { fill: 'linear-gradient(0deg, black 0%, black 50%, black 100%)' },
    ]);
    c.seek(500);
    expect(c.getCurrentValues()?.fill).toBe(
      'linear-gradient(0deg, rgb(128, 0, 0) 0%, rgb(128, 0, 0) 50%, rgb(0, 0, 128) 50%, rgb(0, 0, 128) 100%)',
    );
  });
  it('samples extra breakpoints while extending boundary colors', () => {
    const c = create({}, [
      { fill: 'linear-gradient(0deg, red 25%, blue 75%)' },
      { fill: 'linear-gradient(0deg, black 0%, black 50%, black 100%)' },
    ]);
    c.seek(500);
    expect(c.getCurrentValues()?.fill).toBe(
      'linear-gradient(0deg, rgb(128, 0, 0) 0%, rgb(128, 0, 0) 25%, rgb(64, 0, 64) 50%, rgb(0, 0, 128) 75%, rgb(0, 0, 128) 100%)',
    );
  });
  it('animates corresponding stop positions when their counts match', () => {
    const c = create({}, [
      { fill: 'linear-gradient(0deg, red 20%, blue 80%)' },
      { fill: 'linear-gradient(0deg, red 40%, blue 100%)' },
    ]);
    c.seek(500);
    expect(c.getCurrentValues()?.fill).toBe(
      'linear-gradient(0deg, rgb(255, 0, 0) 30%, rgb(0, 0, 255) 90%)',
    );
  });
  it.each([
    'none',
    'inherit',
    'currentColor',
    'url(#paint)',
    'radial-gradient(red, blue)',
    'linear-gradient(broken)',
  ])(
    'keeps unsupported paint %s out of the SVG path morphing parser',
    (paint) => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const c = create({}, [{ fill: paint }, { fill: 'url(#other)' }]);
        c.seek(500);
        expect(c.getCurrentValues()?.fill).toBe(paint);
        expect(error).not.toHaveBeenCalled();
      } finally {
        error.mockRestore();
      }
    },
  );
  it('morphs path strings and command arrays into an interpolated cubic', () => {
    const c = create({}, [
      { d: 'M 0 0 C 10 0 20 0 30 0' },
      {
        d: [
          ['M', 0, 20],
          ['C', 10, 20, 20, 20, 30, 20],
        ],
      },
    ]);
    c.seek(500);
    expect(normalizePathCommands(c.getCurrentValues()!.d as string)).toEqual([
      ['M', 0, 10],
      ['C', 10, 10, 20, 10, 30, 10],
    ]);
  });
  it('equalizes paths with different segment counts and opposite contour winding', () => {
    const c = create({}, [
      { d: 'M0 0 L20 0 L20 20 L0 20 Z' },
      { d: 'M0 0 L0 20 L10 20 L20 20 L20 0 Z' },
    ]);
    c.seek(500);
    const commands = normalizePathCommands(c.getCurrentValues()!.d as string);
    expect(commands[0]).toEqual(['M', 0, 0]);
    expect(commands.filter(([command]) => command === 'C')).toHaveLength(5);
    expect(
      commands.every((command) => command.slice(1).every(Number.isFinite)),
    ).toBe(true);
  });
  it('retains an empty path until its replacement endpoint', () => {
    const c = create({}, [{ d: '' }, { d: 'M0 0L10 10' }]);
    c.seek(500);
    expect(c.getCurrentValues()?.d).toBe('');
    c.seek(1000);
    expect(c.getCurrentValues()?.d).toBe('M0 0L10 10');
  });
});
