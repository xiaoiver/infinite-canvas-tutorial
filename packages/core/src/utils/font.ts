import bidiFactory from 'bidi-js';

type TextSegment = { text: string; direction: 'ltr' | 'rtl' };

const bidi = bidiFactory();

export class CanvasTextMetrics {
  measureText(text: string) {
    const segmentStack = [new Array<TextSegment>()];

    const reduceStack = (stack: TextSegment[][], target: number) => {
      const validatedTarget = target < 0 ? 0 : target;
      while (stack.length > validatedTarget + 1) {
        const current = stack.pop()!;
        stack[stack.length - 1]!.push(...current.reverse());
      }
    };
    const pushInStack = (
      stack: TextSegment[][],
      text: string,
      level: number,
    ) => {
      if (level + 1 > stack.length) {
        stack.push(
          ...Array.from(
            { length: level + 1 - stack.length },
            () => new Array<TextSegment>(),
          ),
        );
      } else {
        reduceStack(stack, level);
      }
      stack[level]!.push({ text, direction: level % 2 === 0 ? 'ltr' : 'rtl' });
    };

    const embeddingLevels = bidi.getEmbeddingLevels(text);
    const iter = embeddingLevels.levels.entries();
    const first = iter.next();
    if (!first.done) {
      let [prevIndex, prevLevel] = first.value;
      for (const [i, level] of iter) {
        if (level !== prevLevel) {
          pushInStack(segmentStack, text.slice(prevIndex, i), prevLevel);
          prevIndex = i;
          prevLevel = level;
        }
      }
      pushInStack(segmentStack, text.slice(prevIndex), prevLevel);
      reduceStack(segmentStack, 0);
    }

    // const base = { x: 0, y: 0 };
    // const glyphs = new Array<{
    //   id: number;
    //   base: { x: number; y: number };
    // }>();
    // for (const segment of segmentStack[0]!) {
    // }
  }
}
