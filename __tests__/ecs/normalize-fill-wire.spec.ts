import { migrateLegacyFillWireInPlace } from '../../packages/ecs/src/utils/normalize-fill-wire';

describe('legacy image fills', () => {
  it.each([
    'https://example.com/photo.jpg',
    'http://example.com/photo.png',
    '//example.com/photo.webp',
    '/photo.png',
    './photo.png',
    '../images/photo.svg',
    'blob:https://example.com/image-id',
    'data:image/png;base64,aGVsbG8=',
    'data:image/svg+xml,%3Csvg%3E%3C/svg%3E',
  ])('migrates an image source in all historical wire forms: %s', (value) => {
    for (const input of [
      { fill: value, fillOpacity: 0.4 },
      { fillLayers: [{ type: 'solid', value, opacity: 0.4 }] },
      { fills: [{ type: 'solid', value, opacity: 0.4 }] },
    ]) {
      const attrs: Record<string, unknown> = input;
      migrateLegacyFillWireInPlace(attrs);
      expect(attrs).toEqual({
        fills: [{ type: 'image', value, opacity: 0.4 }],
      });
      const fills = attrs.fills;
      migrateLegacyFillWireInPlace(attrs);
      expect(attrs.fills).toBe(fills);
    }
  });

  it('preserves layer order and metadata without mutating shared layer objects', () => {
    const image = Object.freeze({
      type: 'solid',
      value: '/photo.png',
      opacity: '$image.opacity',
      enabled: false,
      blendMode: 'multiply',
      objectFit: 'contain',
      objectPosition: 'left top',
    });
    const color = Object.freeze({ type: 'solid', value: 'red' });
    const original = Object.freeze([color, image]);
    const attrs: Record<string, unknown> = { fills: original };
    migrateLegacyFillWireInPlace(attrs);
    expect(attrs.fills).toEqual([color, { ...image, type: 'image' }]);
    expect(original[1].type).toBe('solid');
  });

  it('preserves canonical paints and authoritative empty fills', () => {
    const fills = [
      ...[
        'red',
        '#336699',
        'none',
        'transparent',
        'rgb(2, 3, 4)',
        '$color',
        'var(--color)',
        'url(#paint)',
      ].map((value) => ({ type: 'solid', value })),
      { type: 'gradient', value: 'linear-gradient(red, blue)' },
      { type: 'image', value: '/photo.png', objectFit: 'cover' },
      { type: 'pattern', value: '/tile.png', repetition: 'repeat' },
    ];
    const attrs: Record<string, unknown> = {
      fills,
      fill: '/discard.png',
      fillOpacity: 0.1,
    };
    migrateLegacyFillWireInPlace(attrs);
    expect(attrs).toEqual({ fills });
    expect(attrs.fills).toBe(fills);
    const empty: Record<string, unknown> = { fills: [], fill: '/discard.png' };
    migrateLegacyFillWireInPlace(empty);
    expect(empty).toEqual({ fills: [] });
  });
});
