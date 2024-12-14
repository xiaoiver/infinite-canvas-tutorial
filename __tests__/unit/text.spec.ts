import { Text } from '../../packages/core/src';

describe('Text', () => {
  it('should get/set attributes correctly.', () => {
    const text = new Text({
      x: 50,
      y: 50,
      content: 'Hello, world!',
      fill: '#F67676',
    });
    expect(text.x).toBe(50);
    expect(text.y).toBe(50);
    expect(text.content).toBe('Hello, world!');
    expect(text.fill).toBe('#F67676');
    expect(text.fillRGB).toEqual({ b: 118, g: 118, opacity: 1, r: 246 });

    const defaultText = new Text();
    expect(defaultText.x).toBe(0);
    expect(defaultText.y).toBe(0);
    expect(defaultText.content).toBe('');
    expect(defaultText.fill).toBe('black');
    expect(defaultText.fillRGB).toEqual({
      b: 0,
      g: 0,
      opacity: 1,
      r: 0,
    });
    expect(defaultText.visible).toBe(true);
  });
});
