/** Benchmark/test query only. Shipped entries do not parse this control. */
export function drawingBufferQuery(search: string) {
  const value = new URLSearchParams(search).get('preserveDrawingBuffer');
  if (value === null) return;
  if (value !== '0' && value !== '1')
    throw new Error('Invalid drawing-buffer request');
  return value === '1';
}
type ProbeState = { requested: boolean; restored: boolean; attempts: number };
type ProbedCanvas = HTMLCanvasElement & {
  __canvasDrawingBufferExperiment?: ProbeState;
};
/** Test-only override. Restore the exact original method immediately after creation. */
export function installDrawingBufferProbe(
  canvas: ProbedCanvas,
  requested: boolean | undefined,
) {
  if (requested === undefined) return;
  if (canvas.__canvasDrawingBufferExperiment)
    throw new Error('Drawing-buffer probe already installed');
  const descriptor = Object.getOwnPropertyDescriptor(canvas, 'getContext'),
    original = canvas.getContext;
  const state: ProbeState = { requested, restored: false, attempts: 0 };
  const restore = () => {
    if (state.restored) return;
    if (canvas.getContext === wrapped) {
      if (descriptor) Object.defineProperty(canvas, 'getContext', descriptor);
      else Reflect.deleteProperty(canvas, 'getContext');
    }
    state.restored = canvas.getContext === original;
  };
  const wrapped = function (this: HTMLCanvasElement, ...args: any[]) {
    if (
      this !== canvas ||
      !['webgl2', 'webgl', 'experimental-webgl'].includes(args[0])
    )
      return (original as any).apply(this, args);
    state.attempts++;
    try {
      const context = (original as any).call(this, args[0], {
        ...args[1],
        preserveDrawingBuffer: requested,
      });
      if (context) restore();
      return context;
    } catch (error) {
      restore();
      throw error;
    }
  } as typeof canvas.getContext;
  Object.defineProperty(canvas, '__canvasDrawingBufferExperiment', {
    value: state,
    configurable: true,
  });
  try {
    canvas.getContext = wrapped;
  } catch (error) {
    Reflect.deleteProperty(canvas, '__canvasDrawingBufferExperiment');
    throw error;
  }
  return {
    state,
    dispose() {
      restore();
      if (canvas.__canvasDrawingBufferExperiment === state)
        Reflect.deleteProperty(canvas, '__canvasDrawingBufferExperiment');
    },
  };
}
/** Read the existing context outside any frame/input clock; never create another canvas. */
export function readDrawingBufferContext(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  if (!gl) throw new Error('No WebGL context');
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    api:
      typeof WebGL2RenderingContext !== 'undefined' &&
      gl instanceof WebGL2RenderingContext
        ? 'webgl2'
        : 'webgl',
    renderer: String(gl.getParameter(gl.RENDERER)),
    unmaskedRenderer: debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : undefined,
    version: String(gl.getParameter(gl.VERSION)),
    shadingLanguageVersion: String(
      gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
    ),
    attributes: gl.getContextAttributes(),
    overrideRestored: (canvas as ProbedCanvas).__canvasDrawingBufferExperiment
      ?.restored,
    overrideAttempts: (canvas as ProbedCanvas).__canvasDrawingBufferExperiment
      ?.attempts,
  };
}
