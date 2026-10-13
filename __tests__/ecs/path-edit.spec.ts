import {
  collectPathControlHandles,
  collectPathHandleLineSegments,
  normalizePathCommands,
  setPathHandlePoint,
  toPathData,
  type PathCommand,
} from '../../packages/ecs/src/utils/path-edit';

describe('editable SVG path commands', () => {
  it.each([
    [
      'M 10 20 30 40 50 60',
      [
        ['M', 10, 20],
        ['L', 30, 40],
        ['L', 50, 60],
      ],
    ],
    [
      'm 10 20 30 40 -5 -10',
      [
        ['M', 10, 20],
        ['L', 40, 60],
        ['L', 35, 50],
      ],
    ],
    [
      'M 10 20 H 40 60 V 80 100 h -5 v -10',
      [
        ['M', 10, 20],
        ['L', 40, 20],
        ['L', 60, 20],
        ['L', 60, 80],
        ['L', 60, 100],
        ['L', 55, 100],
        ['L', 55, 90],
      ],
    ],
    [
      'M 10 20 l 30 40 -5 -10 z l 5 6',
      [['M', 10, 20], ['L', 40, 60], ['L', 35, 50], ['Z'], ['L', 15, 26]],
    ],
    [
      'M 10 20 c 1 2 3 4 5 6 7 8 9 10 11 12',
      [
        ['M', 10, 20],
        ['C', 11, 22, 13, 24, 15, 26],
        ['C', 22, 34, 24, 36, 26, 38],
      ],
    ],
    [
      'M 10 20 q 1 2 3 4 5 6 7 8',
      [
        ['M', 10, 20],
        ['Q', 11, 22, 13, 24],
        ['Q', 18, 30, 20, 32],
      ],
    ],
    [
      'M 10 20 a 30 40 45 1 0 50 60 10 20 0 0 1 -5 -10',
      [
        ['M', 10, 20],
        ['A', 30, 40, 45, 1, 0, 60, 80],
        ['A', 10, 20, 0, 0, 1, 55, 70],
      ],
    ],
    [
      'M 10 20 L 40 50 Z M 80 90 l 5 6 z l 1 2',
      [
        ['M', 10, 20],
        ['L', 40, 50],
        ['Z'],
        ['M', 80, 90],
        ['L', 85, 96],
        ['Z'],
        ['L', 81, 92],
      ],
    ],
  ])('expands coordinates without moving the path: %s', (d, expected) => {
    expect(normalizePathCommands(d as string)).toEqual(expected);
  });

  it('reflects each preceding cubic control across its endpoint', () => {
    expect(
      normalizePathCommands(
        'M 0 0 C 10 20 30 40 50 60 S 80 90 100 110 130 140 150 160',
      ),
    ).toEqual([
      ['M', 0, 0],
      ['C', 10, 20, 30, 40, 50, 60],
      ['C', 70, 80, 80, 90, 100, 110],
      ['C', 120, 130, 130, 140, 150, 160],
    ]);
  });

  it('reflects quadratic controls through consecutive relative smooth segments', () => {
    expect(normalizePathCommands('M 0 0 Q 10 20 30 40 t 20 20 20 20')).toEqual([
      ['M', 0, 0],
      ['Q', 10, 20, 30, 40],
      ['Q', 50, 60, 50, 60],
      ['Q', 50, 60, 70, 80],
    ]);
  });

  it.each([
    ['M 20 30', 20, 30],
    ['L 20 30', 20, 30],
    ['H 20', 20, 60],
    ['V 30', 50, 30],
    ['Q 10 20 20 30', 20, 30],
    ['T 20 30', 20, 30],
    ['A 5 10 0 0 1 20 30', 20, 30],
    ['Z', 0, 0],
  ])('does not carry a cubic handle across %s', (middle, x, y) => {
    const commands = normalizePathCommands(
      `M 0 0 C 10 20 30 40 50 60 ${middle} s 10 20 30 40`,
    );
    expect(commands[commands.length - 1]).toEqual([
      'C',
      x,
      y,
      Number(x) + 10,
      Number(y) + 20,
      Number(x) + 30,
      Number(y) + 40,
    ]);
  });

  it.each([
    ['M 20 30', 20, 30],
    ['L 20 30', 20, 30],
    ['H 20', 20, 60],
    ['V 30', 50, 30],
    ['C 1 2 3 4 20 30', 20, 30],
    ['S 10 20 20 30', 20, 30],
    ['A 5 10 0 0 1 20 30', 20, 30],
    ['Z', 0, 0],
  ])('does not carry a quadratic handle across %s', (middle, x, y) => {
    const commands = normalizePathCommands(
      `M 0 0 Q 10 20 50 60 ${middle} t 30 40`,
    );
    expect(commands[commands.length - 1]).toEqual([
      'Q',
      x,
      y,
      Number(x) + 30,
      Number(y) + 40,
    ]);
  });

  it('keeps arc parameters while exposing only its endpoint as a control', () => {
    const commands = normalizePathCommands('M 10 20 A 30 40 45 1 0 60 80 Z');
    const handles = collectPathControlHandles(commands);
    expect(handles).toEqual([
      { x: 10, y: 20, meta: { commandIndex: 0, coordOffset: 1 } },
      { x: 60, y: 80, meta: { commandIndex: 1, coordOffset: 6 } },
    ]);
    setPathHandlePoint(commands, handles[1].meta, 75.5, -9.25);
    expect(commands[1]).toEqual(['A', 30, 40, 45, 1, 0, 75.5, -9.25]);
  });

  const mixed: PathCommand[] = [
    ['M', 10, 20],
    ['L', 30, 40],
    ['Q', 50, 60, 70, 80],
    ['C', 90, 100, 110, 120, 130, 140],
    ['Z'],
  ];
  it('orders anchors and handles by command and coordinate pair', () => {
    expect(collectPathControlHandles(mixed)).toEqual([
      { x: 10, y: 20, meta: { commandIndex: 0, coordOffset: 1 } },
      { x: 30, y: 40, meta: { commandIndex: 1, coordOffset: 1 } },
      { x: 50, y: 60, meta: { commandIndex: 2, coordOffset: 1 } },
      { x: 70, y: 80, meta: { commandIndex: 2, coordOffset: 3 } },
      { x: 90, y: 100, meta: { commandIndex: 3, coordOffset: 1 } },
      { x: 110, y: 120, meta: { commandIndex: 3, coordOffset: 3 } },
      { x: 130, y: 140, meta: { commandIndex: 3, coordOffset: 5 } },
    ]);
  });

  it.each([0, 1, 2, 3, 4, 5, 6])(
    'moves handle %i without changing other coordinates or command types',
    (index) => {
      const commands = structuredClone(mixed);
      const before = collectPathControlHandles(commands);
      setPathHandlePoint(commands, before[index].meta, -12.5, 93.75);
      const after = collectPathControlHandles(
        normalizePathCommands(toPathData(commands)),
      );
      expect(after).toEqual(
        before.map((handle, i) =>
          i === index ? { ...handle, x: -12.5, y: 93.75 } : handle,
        ),
      );
      expect(commands.map(([type]) => type)).toEqual(
        mixed.map(([type]) => type),
      );
      expect(mixed[0]).toEqual(['M', 10, 20]);
    },
  );

  it('ignores stale command references and supports paths without handles', () => {
    const commands = structuredClone(mixed);
    for (const commandIndex of [-1, commands.length])
      setPathHandlePoint(commands, { commandIndex, coordOffset: 1 }, 0, 0);
    expect(commands).toEqual(mixed);
    expect(collectPathControlHandles([])).toEqual([]);
    expect(collectPathHandleLineSegments([])).toEqual([]);
    expect(toPathData([])).toBe('');
  });

  it('attaches handle guides to the correct anchors across arcs, closes and subpaths', () => {
    const commands: PathCommand[] = [
      ['M', 10, 20],
      ['L', 30, 40],
      ['C', 35, 45, 50, 60, 70, 80],
      ['Q', 90, 100, 110, 120],
      ['A', 30, 40, 0, 0, 1, 150, 160],
      ['C', 170, 180, 190, 200, 210, 220],
      ['Z'],
      ['Q', 15, 25, 30, 35],
      ['M', 250, 260],
      ['Q', 270, 280, 290, 300],
    ];
    expect(collectPathHandleLineSegments(commands)).toEqual([
      { x1: 30, y1: 40, x2: 35, y2: 45 },
      { x1: 70, y1: 80, x2: 50, y2: 60 },
      { x1: 70, y1: 80, x2: 90, y2: 100 },
      { x1: 150, y1: 160, x2: 170, y2: 180 },
      { x1: 210, y1: 220, x2: 190, y2: 200 },
      { x1: 10, y1: 20, x2: 15, y2: 25 },
      { x1: 250, y1: 260, x2: 270, y2: 280 },
    ]);
  });
});
