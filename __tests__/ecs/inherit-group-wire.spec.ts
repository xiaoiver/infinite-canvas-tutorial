import type { SerializedNode } from '../../packages/ecs/src';
import {
  getComputedInheritGroupWireMap,
  getComputedInheritGroupWireForId,
} from '../../packages/ecs/src/utils/inherit-group-wire';

const node = (
  id: string,
  patch: Partial<SerializedNode> = {},
): SerializedNode => ({ id, type: 'g', zIndex: 0, ...patch } as SerializedNode);

describe('group wire inheritance boundaries', () => {
  it('owns paint layer copies and leaves authored overrides untouched', () => {
    const fills = [{ type: 'solid' as const, value: 'red' }];
    const strokes = [{ type: 'solid' as const, value: 'blue' }];
    const scene = [
      node('root', { fills, strokes }),
      node('leaf', { parentId: 'root' }),
    ];
    const result = getComputedInheritGroupWireMap(scene);
    (result.get('leaf').fills as typeof fills)[0].value = 'green';
    (result.get('leaf').strokes as typeof strokes)[0].value = 'green';
    expect(fills[0].value).toBe('red');
    expect(strokes[0].value).toBe('blue');
    expect(scene[1]).not.toHaveProperty('fills');
  });

  it('uses only available ancestors for missing parents and unknown IDs', () => {
    expect(getComputedInheritGroupWireForId('absent', [])).toEqual({});
    expect(
      getComputedInheritGroupWireForId('leaf', [
        node('leaf', { parentId: 'absent', strokeWidth: 3 }),
      ]),
    ).toEqual({ strokeWidth: 3 });
  });

  it('respects explicit zero and empty overrides while undefined inherits', () => {
    const result = getComputedInheritGroupWireMap([
      node('root', {
        fills: [{ type: 'solid', value: 'red' }],
        opacity: 0.5,
        strokeWidth: 3,
      }),
      node('leaf', {
        parentId: 'root',
        fills: [],
        opacity: 0,
        strokeWidth: undefined,
      }),
    ]);
    expect(result.get('leaf')).toEqual({
      fills: [],
      opacity: 0,
      strokeWidth: 3,
    });
  });

  it('terminates on malformed cyclic parent chains before document validation', () => {
    const result = getComputedInheritGroupWireMap([
      node('a', { parentId: 'b', strokeWidth: 3 }),
      node('b', { parentId: 'a', opacity: 0.5 }),
    ]);
    expect(result.get('a')).toMatchObject({ strokeWidth: 3, opacity: 0.5 });
    expect(result.get('b')).toMatchObject({ strokeWidth: 3, opacity: 0.5 });
  });
});
