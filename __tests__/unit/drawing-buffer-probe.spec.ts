import { installDrawingBufferProbe } from '../browser/fixtures/drawing-buffer';
const element = (getContext: (...args: any[]) => any = jest.fn(() => ({}))) =>
  Object.create({ getContext }) as HTMLCanvasElement;
it('leaves an unconfigured element completely untouched', () => {
  const c = element(),
    original = c.getContext,
    names = Object.getOwnPropertyNames(c);
  expect(installDrawingBufferProbe(c, undefined)).toBeUndefined();
  expect(c.getContext).toBe(original);
  expect(Object.getOwnPropertyNames(c)).toEqual(names);
});
it('restores an inherited method after creation and confines overrides to the receiver', () => {
  const get = jest.fn((_api, attrs) => attrs),
    c = element(get),
    other = element(),
    original = c.getContext;
  const probe = installDrawingBufferProbe(c, false)!;
  const borrowed = c.getContext as any;
  expect(
    borrowed.call(other, 'webgl', { preserveDrawingBuffer: true }),
  ).toEqual({ preserveDrawingBuffer: true });
  expect(probe.state.attempts).toBe(0);
  expect(
    (c.getContext as any)('webgl2', {
      alpha: false,
      preserveDrawingBuffer: true,
    }),
  ).toEqual({ alpha: false, preserveDrawingBuffer: false });
  expect(probe.state.restored).toBe(true);
  expect(probe.state.attempts).toBe(1);
  expect(c.getContext).toBe(original);
  expect(Object.hasOwn(c, 'getContext')).toBe(false);
  probe.dispose();
  expect(Object.hasOwn(c, '__canvasDrawingBufferExperiment')).toBe(false);
});
it('restores an exact own descriptor on failure and refuses overlapping probes', () => {
  const c = element(),
    original = jest.fn(() => {
      throw new Error('context failure');
    });
  Object.defineProperty(c, 'getContext', {
    value: original,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  const before = Object.getOwnPropertyDescriptor(c, 'getContext'),
    probe = installDrawingBufferProbe(c, true)!;
  expect(() => installDrawingBufferProbe(c, false)).toThrow(
    'already installed',
  );
  expect(() => c.getContext('webgl')).toThrow('context failure');
  expect(probe.state.restored).toBe(true);
  expect(Object.getOwnPropertyDescriptor(c, 'getContext')).toEqual(before);
  probe.dispose();
  expect(Object.hasOwn(c, '__canvasDrawingBufferExperiment')).toBe(false);
});
it('does not overwrite a method installed by another owner during cleanup', () => {
  const c = element(),
    probe = installDrawingBufferProbe(c, false)!,
    foreign = jest.fn(() => null);
  c.getContext = foreign as any;
  probe.dispose();
  expect(c.getContext).toBe(foreign);
  expect(probe.state.restored).toBe(false);
  expect(Object.hasOwn(c, '__canvasDrawingBufferExperiment')).toBe(false);
});
