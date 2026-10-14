import {
  colorStopToString,
  isGradient,
  parseGradient,
  parseGradientAST,
  type ColorStop,
  type LinearGradient,
  type RadialGradient,
} from '../../packages/ecs/src/utils/gradient';

const linear = (value: string) => parseGradient(value)![0] as LinearGradient;

describe('gradient syntax and stops', () => {
  it.each([
    ['left', 180],
    ['top', -90],
    ['bottom', 90],
    ['right', 0],
    ['left top', 225],
    ['top left', 225],
    ['left bottom', 135],
    ['bottom left', 135],
    ['right top', -45],
    ['top right', -45],
    ['right bottom', 45],
    ['bottom right', 45],
  ])('maps the %s direction to the internal angle', (direction, angle) => {
    expect(linear(`linear-gradient(to ${direction}, red, blue)`).angle).toBe(
      angle,
    );
  });

  it.each([-450, -22.5, 0, 22.5, 720])(
    'retains the explicit %s degree angle',
    (angle) => {
      expect(linear(`linear-gradient(${angle}deg, red, blue)`).angle).toBe(
        angle,
      );
    },
  );

  it('spaces omitted stops between explicit anchors and retains hard stops', () => {
    const gradient = linear(
      'linear-gradient(red 10%, green, blue, white 70%, black 70%, yellow)',
    );
    expect(gradient.steps.map((s) => s.offset)).toEqual(
      [10, 30, 50, 70, 70, 100].map((value) => ({ type: '%', value })),
    );
    expect(gradient.steps.map((s) => s.color)).toEqual([
      'red',
      'green',
      'blue',
      'white',
      'black',
      'yellow',
    ]);
  });

  it('defaults the first and last stops and retains explicitly supplied units', () => {
    expect(
      linear('linear-gradient(red, blue)').steps.map((s) => s.offset.value),
    ).toEqual([0, 100]);
    expect(
      linear('linear-gradient(red 2px, blue 3em)').steps.map((s) => s.offset),
    ).toEqual([
      { type: 'px', value: 2 },
      { type: 'em', value: 3 },
    ]);
  });

  it('preserves layer order, fractional channels and alpha', () => {
    const gradients = parseGradient(
      'linear-gradient(rgb(1, 2, 3), rgba(4,5,6,.25)), radial-gradient(circle, #abcd, #aabbccdd)',
    ) as [LinearGradient, RadialGradient];
    expect(gradients.map((g) => g.type)).toEqual([
      'linear-gradient',
      'radial-gradient',
    ]);
    expect(gradients[0].steps.map((s) => s.color)).toEqual([
      'rgb(1,2,3)',
      'rgba(4,5,6,.25)',
    ]);
    expect(gradients[1].steps.map((s) => s.color)).toEqual([
      '#abcd',
      '#aabbccdd',
    ]);
  });

  it.each([
    [{ type: 'hex', value: 'abc' }, '#abc'],
    [{ type: 'literal', value: 'transparent' }, 'transparent'],
    [{ type: 'rgb', value: ['1', '2', '3'] }, 'rgb(1,2,3)'],
    [{ type: 'rgba', value: ['1', '2', '3', '.5'] }, 'rgba(1,2,3,.5)'],
  ] as [ColorStop, string][])(
    'serializes %j without changing its color',
    (stop, expected) => {
      expect(colorStopToString(stop)).toBe(expected);
    },
  );

  it.each([
    'linear-gradient red, blue)',
    'linear-gradient(red, blue',
    'linear-gradient(45deg red, blue)',
    'linear-gradient(red,, blue)',
    'linear-gradient(red,)',
    'linear-gradient(123, blue)',
    'linear-gradient(red, blue) trailing',
    'radial-gradient(circle at, red, blue)',
  ])('rejects malformed syntax and remains usable after %s', (value) => {
    expect(() => parseGradientAST(value)).toThrow();
    expect(linear('linear-gradient(red, blue)').steps).toHaveLength(2);
  });

  it('keeps AST results independent across parsing and caller mutations', () => {
    const first = parseGradientAST('linear-gradient(red, blue)');
    const before = structuredClone(first);
    parseGradient('radial-gradient(circle at left top, white, black)');
    expect(first).toEqual(before);
    const one = linear('linear-gradient(red, blue)');
    one.steps[0].color = 'green';
    expect(linear('linear-gradient(red, blue)').steps[0].color).toBe('red');
  });

  it.each(['', 'red', '#fff', 'url(image.png)'])(
    'leaves non-gradient %s to its paint handler',
    (value) => {
      expect(isGradient(value)).toBe(false);
      expect(parseGradient(value)).toBeUndefined();
    },
  );

  it('parses repeating syntax in the AST but does not advertise unsupported raster gradients', () => {
    for (const type of [
      'repeating-linear-gradient',
      'repeating-radial-gradient',
    ]) {
      expect(parseGradientAST(`${type}(red, blue)`)[0].type).toBe(type);
      expect(parseGradient(`${type}(red, blue)`)).toEqual([]);
    }
    expect(
      parseGradient('radial-gradient(ellipse at center, red, blue)'),
    ).toEqual([]);
  });
});

describe('radial and conic centers', () => {
  it.each([
    ['left', 0, 50],
    ['right', 100, 50],
    ['top', 50, 0],
    ['bottom', 50, 100],
    ['center', 50, 50],
    ['left top', 0, 0],
    ['top left', 0, 0],
    ['right bottom', 100, 100],
    ['bottom right', 100, 100],
    ['center bottom', 50, 100],
    ['right center', 100, 50],
    ['top center', 50, 0],
    ['bottom center', 50, 100],
  ])('resolves %s against the appropriate axes', (position, x, y) => {
    const gradient = parseGradient(
      `radial-gradient(circle at ${position}, red, blue)`,
    )![0];
    expect(gradient).toMatchObject({
      cx: { type: '%', value: x },
      cy: { type: '%', value: y },
    });
  });
  it.each([
    'closest-side',
    'farthest-side',
    'closest-corner',
    'farthest-corner',
  ])('retains %s and mixed center units', (size) => {
    expect(
      parseGradient(`radial-gradient(circle ${size} at 12.5px 75%, red, blue)`),
    ).toMatchObject([
      {
        cx: { type: 'px', value: 12.5 },
        cy: { type: '%', value: 75 },
        size: { type: 'extent-keyword', value: size },
      },
    ]);
  });
  it('retains an explicit radius and em center coordinates', () => {
    expect(
      parseGradient('radial-gradient(circle 12px at 2em 3px, red, blue)'),
    ).toMatchObject([
      {
        cx: { type: 'em', value: 2 },
        cy: { type: 'px', value: 3 },
        size: { type: 'px', value: '12' },
      },
    ]);
  });
  it('uses the center by default and retains the legacy conic circle center', () => {
    for (const type of ['radial-gradient', 'conic-gradient']) {
      expect(parseGradient(`${type}(red, blue)`)).toMatchObject([
        {
          cx: { type: '%', value: 50 },
          cy: { type: '%', value: 50 },
        },
      ]);
    }
    expect(
      parseGradient('conic-gradient(circle at 25% 75%, red, blue)'),
    ).toMatchObject([
      {
        type: 'conic-gradient',
        angle: 0,
        cx: { type: '%', value: 25 },
        cy: { type: '%', value: 75 },
      },
    ]);
  });
  it('accepts upper-case shape, size and position keywords', () => {
    expect(
      parseGradient(
        'RADIAL-GRADIENT(CIRCLE CLOSEST-SIDE AT RIGHT TOP, red, blue)',
      ),
    ).toMatchObject([
      {
        cx: { type: '%', value: 100 },
        cy: { type: '%', value: 0 },
        size: { type: 'extent-keyword', value: 'closest-side' },
      },
    ]);
  });
});
