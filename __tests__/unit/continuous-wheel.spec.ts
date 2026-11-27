import { continuousWheel } from '../browser/fixtures/continuous-wheel';
const initial = { x: 0, y: 0, zoom: 1 };
it('keeps receipt order and waits for a completed final target beyond the last receipt', () => {
  let time = 1;
  const c = continuousWheel(
    (v, i: { isTrusted: boolean; dy: number }) => ({ ...v, x: v.x + i.dy }),
    () => time,
  );
  c.start(initial);
  c.observe({ isTrusted: true, dy: 1 });
  time = 2;
  c.observe({ isTrusted: true, dy: 2 });
  time = 4;
  c.frame(1, 3, { ...initial, x: 3 }, { drawcalls: 1 });
  expect(c.status().ready).toBe(false); // Frame started before the final input.
  time = 7;
  c.frame(5, 6, { ...initial, x: 3 }, { drawcalls: 1 });
  const result = c.finish();
  expect(result.events.map((e) => e.requested.x)).toEqual([1, 3]);
  expect(result.frames).toHaveLength(2);
  expect(result.frames[1].observationMs).toBe(1);
  expect(c.busy).toBe(false);
});
it('rejects synthetic input, incomplete targets, parallel captures and use after disposal', () => {
  const c = continuousWheel(
    (v) => v,
    () => 1,
  );
  c.start(initial);
  expect(() => c.start(initial)).toThrow('busy');
  c.observe({ isTrusted: false });
  expect(c.status().errors).toEqual(['Trusted input required']);
  expect(() => c.finish()).toThrow('Trusted');
  c.cancel();
  c.start(initial);
  expect(() => c.finish()).toThrow('not completed');
  c.dispose();
  expect(() => c.start(initial)).toThrow('disposed');
});
it('drops cancelled histories and freezes caller-owned input/view snapshots', () => {
  let time = 1;
  const c = continuousWheel(
    (v, i: { isTrusted: boolean; dx: number }) => ({ ...v, x: v.x + i.dx }),
    () => time,
  );
  const view = { ...initial },
    input = { isTrusted: true, dx: 4 };
  c.start(view);
  c.observe(input);
  view.x = 99;
  input.dx = 99;
  time = 3;
  c.frame(2, 3, { ...initial, x: 4 }, {});
  const result = c.finish();
  expect(result.initial.x).toBe(0);
  expect(result.events[0].input.dx).toBe(4);
  c.start(initial);
  c.cancel();
  expect(c.status().events).toBe(0);
  c.observe(input);
  expect(c.status().events).toBe(0);
});
it('keeps UI accumulation separate from Float32 completed-camera normalization', () => {
  let time = 1;
  const c = continuousWheel(
    (v, i: { isTrusted: boolean; dx: number }) => ({ ...v, x: v.x + i.dx }),
    () => time,
    (v) => ({ ...v, x: Math.fround(v.x) }),
  );
  c.start({ ...initial, x: 100000 });
  for (let i = 0; i < 3; i++) {
    c.observe({ isTrusted: true, dx: 0.1 });
    time++;
  }
  c.frame(4, 5, { ...initial, x: Math.fround(100000.3) }, {});
  const r = c.finish();
  expect(r.events.at(-1)!.requested.x).toBeCloseTo(100000.3, 8);
});

it('marks only accepted input under an explicit diagnostic callback', () => {
  let time = 1;
  const calls: number[] = [];
  const c = continuousWheel(
    (v, i: { isTrusted: boolean; dx: number }) => ({ ...v, x: v.x + i.dx }),
    () => time,
    (v) => v,
    (sequence) => {
      calls.push(sequence);
      return { name: 'input-' + sequence, pageMs: time };
    },
  );
  c.start(initial);
  c.observe({ isTrusted: true, dx: 1 });
  time = 2;
  c.frame(2, 2, { ...initial, x: 1 }, {});
  expect(c.finish().events[0].traceMark).toEqual({
    name: 'input-1',
    pageMs: 1,
  });
  expect(calls).toEqual([1]);
  c.start(initial);
  c.observe({ isTrusted: false, dx: 1 });
  expect(calls).toEqual([1]);
  c.dispose();
  const ordinary = continuousWheel(
    (v) => v,
    () => time,
  );
  ordinary.start(initial);
  ordinary.observe({ isTrusted: true });
  ordinary.frame(2, 2, initial, {});
  expect(ordinary.finish().events[0]).not.toHaveProperty('traceMark');
});
