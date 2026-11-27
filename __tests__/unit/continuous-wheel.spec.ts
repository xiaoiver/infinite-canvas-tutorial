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
