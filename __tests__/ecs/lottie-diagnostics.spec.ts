import { inspectLottie } from '../../packages/plugin-lottie/src/diagnostics';

test('reports nested compatibility gaps with stable JSON pointers without mutating input', () => {
  const data = {
    ip: 0,
    op: 60,
    layers: [
      {
        ty: 4,
        ip: 0,
        op: 60,
        shapes: [
          { ty: 'gr', it: [{ ty: 'sr' }, { ty: 'rd' }, { ty: 'tm', m: 2 }] },
        ],
      },
      { ty: 5, masksProperties: [{}], tt: 1, ef: [{ ty: 5 }] },
    ],
    assets: [
      {
        id: 'nested',
        layers: [
          {
            ty: 4,
            sr: 2,
            tm: { k: 1 },
            ks: { sk: { k: 15 } },
            shapes: [{ ty: 'sh', ks: { x: 'value' } }],
          },
        ],
      },
    ],
  };
  const before = JSON.stringify(data);
  const diagnostics = inspectLottie(data);
  expect(diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'shape.rd',
        severity: 'unsupported',
        path: '/layers/0/shapes/0/it/1',
      }),
      expect.objectContaining({ code: 'shape.trim', severity: 'partial' }),
      expect.objectContaining({ code: 'layer.text', path: '/layers/1' }),
      expect.objectContaining({
        code: 'expression',
        path: '/assets/0/layers/0/shapes/0/ks/x',
      }),
      expect.objectContaining({ code: 'time.stretch' }),
      expect.objectContaining({ code: 'time.remap' }),
      expect.objectContaining({ code: 'transform.skew' }),
    ]),
  );
  expect(diagnostics.filter((d) => d.code === 'layer.text')).toHaveLength(1);
  expect(JSON.stringify(data)).toBe(before);
});

test('supported primitives, hidden features and effect type codes do not produce false layer warnings', () => {
  expect(
    inspectLottie({
      ip: 0,
      op: 60,
      layers: [
        {
          ty: 4,
          ip: 0,
          op: 60,
          ks: { sk: { k: 0 } },
          shapes: [
            { ty: 'rc', s: { k: [50, 50] } },
            { ty: 'el' },
            { ty: 'sh' },
            { ty: 'fl' },
            { ty: 'st' },
            {
              ty: 'sr',
              sy: 1,
              pt: {
                a: 1,
                k: [
                  { t: 0, s: [5] },
                  { t: 30, s: [8] },
                ],
              },
            },
            { ty: 'sr', sy: 2 },
            { ty: 'rp' },
            { ty: 'sr', hd: true },
          ],
        },
      ],
    }),
  ).toEqual([]);
});

test('flags spatial motion, primitive geometry, multiple paints and unknown operators', () => {
  const codes = inspectLottie({
    layers: [
      {
        ty: 4,
        shapes: [
          { ty: 'future' },
          { ty: 'el', s: { a: 1, k: [] } },
          { ty: 'fl' },
          { ty: 'fl' },
        ],
        ks: { p: { a: 1, k: [{ t: 0, to: [1, 2], ti: [0, 1] }] } },
      },
    ],
  }).map((d) => d.code);
  expect(codes).toEqual(
    expect.arrayContaining([
      'shape.type',
      'shape.geometry',
      'paint.multiple',
      'transform.spatial',
    ]),
  );
});

test('shared paints after a repeater report their partial compound paint semantics', () => {
  const diagnostics = inspectLottie({
    layers: [
      {
        ty: 4,
        shapes: [
          { ty: 'gr', it: [{ ty: 'sh' }, { ty: 'fl' }] },
          { ty: 'rp' },
          { ty: 'fl' },
        ],
      },
    ],
  });
  expect(diagnostics).toEqual([
    expect.objectContaining({
      code: 'shape.repeater.paint-scope',
      severity: 'partial',
      path: '/layers/0/shapes/1',
    }),
  ]);
});
