import {
  DOMAdapter as CoreAdapter,
  Text as CoreText,
} from '../../packages/core/src';
import { DOMAdapter, measureText } from '../../packages/ecs/src';
import { NodeJSAdapter } from '../utils';

DOMAdapter.set(NodeJSAdapter);
CoreAdapter.set(NodeJSAdapter);

for (const engine of ['ecs', 'core']) {
  describe(`${engine} bidirectional glyph layout`, () => {
    const lines = (content: string) =>
      engine === 'ecs'
        ? measureText({ content, fontFamily: 'sans-serif', fontSize: 16 }).lines
        : new CoreText({ content, fontFamily: 'sans-serif', fontSize: 16 })
            .metrics.lines;

    it('matches the Pretext example’s native RTL emoji order', () => {
      expect(lines('سلام ABC גבא DEF 😁🚀')).toEqual(['🚀😁 DEF אבג ABC ﻡﻼﺳ']);
    });

    it.each([
      ['אב 👩‍💻👍🏽', '👍🏽👩‍💻 בא'],
      ['אב 🇨🇳🇺🇸', '🇨🇳🇺🇸 בא'],
      ['א\u05b7ב\u05bc', 'ב\u05bcא\u05b7'],
      ['אב (ABC) 123', '123 (ABC) בא'],
      ['𞤀𞤁 ABC', 'ABC 𞤁𞤀'],
      ['אב 𝟙𝟚 😁🚀', '🚀😁 𝟙𝟚 בא'],
      ['ABC אב DEF 😁🚀', 'ABC בא DEF 😁🚀'],
      ['__proto__', '__proto__'],
      ['constructor', 'constructor'],
    ])('keeps graphemes and bidi classes intact: %s', (content, expected) => {
      expect(lines(content)).toEqual([expected]);
      // Exercise the cached result as well.
      expect(lines(content)).toEqual([expected]);
    });

    it('preserves hard paragraph order and independently resolves each direction', () => {
      expect(lines('אב 😁🚀\nABC\nגד 👍🏽👩‍💻')).toEqual([
        '🚀😁 בא',
        'ABC',
        '👩‍💻👍🏽 דג',
      ]);
      expect(lines('אב\r\nגד')).toEqual(['בא', 'דג']);
    });
  });
}
