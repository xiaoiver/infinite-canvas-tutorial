import {
  Canvas,
  CheckboardStyle,
  Group,
  Text,
  Theme,
  serializeNode,
} from '../../../packages/core/src';
import { WebGLDeviceContribution } from '@antv/g-device-api';

const element = document.querySelector('canvas')!;
let deviceBaseline: ReturnType<typeof window.lifecycleProbes.resources>;
const create = WebGLDeviceContribution.prototype.createSwapChain;
WebGLDeviceContribution.prototype.createSwapChain = async function (...args) {
  const swap = await create.apply(this, args);
  deviceBaseline = window.lifecycleProbes.resources();
  return swap;
};
let canvas: Canvas;
try {
  canvas = await new Canvas({
    canvas: element,
    devicePixelRatio: 1,
    checkboardStyle: CheckboardStyle.NONE,
    themeColors: { [Theme.LIGHT]: { background: '#ffffff' } },
  }).initialized;
} finally {
  WebGLDeviceContribution.prototype.createSwapChain = create;
}
const gl = element.getContext('webgl2') ?? element.getContext('webgl');
if (!gl) throw new Error('A real WebGL context is required');
const group = new Group();
canvas.appendChild(group);
let texts: Text[] = [];
let destroyed = false;
function frame() {
  group.renderDirtyFlag = true;
  canvas.render();
}
function state() {
  return {
    resources: window.lifecycleProbes.resources(),
    visible: texts.filter((text) => text.parent && text.visible && !text.culled)
      .length,
    document: texts.map((text) => serializeNode(text)),
    error: gl!.getError(),
  };
}
const api = {
  state,
  ordered(value: boolean) {
    canvas.pathInstancing = value;
    frame();
  },
  replace(count: number, underline = true) {
    for (const text of texts) group.removeChild(text);
    texts = Array.from(
      { length: count },
      (_, i) =>
        new Text({
          x: 20 + (i % 2) * 220,
          y: 20 + Math.floor(i / 2) * 50,
          content: `Core text ${i}`,
          fontFamily: 'sans-serif',
          fontSize: 22,
          textBaseline: 'top',
          decorationLine: underline ? 'underline' : 'none',
          decorationStyle: 'solid',
          fill: '#2563eb',
          stroke: 'none',
          strokeWidth: 0,
        }),
    );
    for (const text of texts) group.appendChild(text);
    frame();
    return state();
  },
  clear() {
    for (const text of texts) group.removeChild(text);
    texts = [];
    frame();
    return state();
  },
  visible(value: boolean) {
    texts[0].visible = value;
    texts[0].renderDirtyFlag = true;
    frame();
    return state();
  },
  camera(x: number) {
    canvas.camera.x = x;
    frame();
    return state();
  },
  detach() {
    group.removeChild(texts[0]);
    frame();
    return state();
  },
  attach() {
    group.appendChild(texts[0]);
    frame();
    return state();
  },
  pick() {
    const bounds = texts[0].getBounds();
    return (
      canvas.elementFromPoint(
        (bounds.minX + bounds.maxX) / 2,
        (bounds.minY + bounds.maxY) / 2,
      ) === texts[0]
    );
  },
  export() {
    return canvas.toDataURL({ grid: false });
  },
  destroy() {
    if (!destroyed) {
      canvas.destroy();
      destroyed = true;
    }
    return deviceBaseline;
  },
};
frame();
Object.assign(window, { coreTextLifetime: api });
declare global {
  interface Window {
    coreTextLifetime: typeof api;
  }
}
document.querySelector('output')!.textContent = 'Ready';
