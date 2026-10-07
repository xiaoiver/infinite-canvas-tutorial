import './ecs-text';
import {
  ComputedBounds,
  ComputedTextMetrics,
  loadBitmapFont,
  serializeNodesToSVGElements,
} from '@infinite-canvas-tutorial/ecs';
import type { TextSerializedNode } from '@infinite-canvas-tutorial/ecs';
import type { TextPathCase } from './text-path';
import fontData from '../../../packages/site/docs/public/fonts/msdf-sans-serif.json';
import fontImage from '../../../packages/site/docs/public/fonts/msdf-atlas-sans-serif.png?url';

const api = window.textTest.api;
const reference = document.querySelector<HTMLCanvasElement>('#reference')!;
const bitmap = await loadBitmapFont.parse(
  JSON.stringify({
    ...fontData,
    info: { ...fontData.info, face: 'PathBitmap' },
    pages: [fontImage],
  }),
);
await api.edit(() => api.loadBitmapFont(bitmap));
await window.textTest.rendered();
let config: TextPathCase;
async function raster(svg: string) {
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    image.src = url;
    await image.decode();
    const ctx = reference.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 640, 340);
    ctx.drawImage(image, 0, 0);
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function nativeReference() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '640');
  svg.setAttribute('height', '340');
  const path = document.createElementNS(ns, 'path');
  path.id = 'curve';
  path.setAttribute('d', config.referencePath ?? config.path);
  const defs = document.createElementNS(ns, 'defs');
  defs.append(path);
  svg.append(defs);
  // Temporarily attach for reliable geometry measurement in WebKit.
  document.body.append(svg);
  const length = path.getTotalLength();
  svg.remove();
  const label = document.createElementNS(ns, 'text');
  label.setAttribute('font-family', 'sans-serif');
  label.setAttribute('font-size', String(config.fontSize ?? 48));
  label.style.fontKerning = 'none';
  label.style.fontVariantLigatures = 'none';
  label.setAttribute('letter-spacing', String(config.letterSpacing ?? 0));
  label.setAttribute('dy', String(config.pathOffset ?? 0));
  label.setAttribute(
    'transform',
    `translate(${config.x ?? 0},${config.y ?? 0})`,
  );
  const align =
    config.textAlign === 'center'
      ? 0.5
      : config.textAlign === 'end' || config.textAlign === 'right'
      ? 1
      : 0;
  label.setAttribute(
    'text-anchor',
    align === 0.5 ? 'middle' : align === 1 ? 'end' : 'start',
  );
  const along = document.createElementNS(ns, 'textPath');
  along.setAttribute('href', '#curve');
  along.setAttribute(
    'startOffset',
    // SVG includes trailing tracking in its anchor width; our layout spaces only between glyphs.
    String(
      align * (length + (config.letterSpacing ?? 0)) +
        (config.startOffset ?? 0),
    ),
  );
  along.textContent = config.content ?? 'Wavy type';
  label.append(along);
  svg.append(label);
  await raster(new XMLSerializer().serializeToString(svg));
}

window.textPathTest = {
  async render(options) {
    config = options;
    await window.textTest.render({
      path: options.path,
      side: options.side,
      startOffset: options.startOffset,
      pathOffset: options.pathOffset,
      textAlign: options.textAlign,
      letterSpacing: options.letterSpacing,
      content: options.content ?? 'Wavy type',
      fontSize: options.fontSize ?? 48,
      fontFamily: options.bitmap ? bitmap.fontFamily : 'sans-serif',
      anchorX: options.x ?? 0,
      anchorY: options.y ?? 0,
    });
    await nativeReference();
  },
  async update(options) {
    config = { ...config, ...options };
    await window.textTest.update(options);
    await nativeReference();
  },
  bounds() {
    const { minX, minY, maxX, maxY } = api
      .getEntity(api.getNodeById('text')!)
      .read(ComputedBounds).geometryWorldBounds;
    return { minX, minY, maxX, maxY };
  },
  async exported() {
    const elements = await serializeNodesToSVGElements([
      structuredClone(api.getNodeById('text')!),
    ]);
    await raster(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="340">${elements
        .map((e) => new XMLSerializer().serializeToString(e))
        .join('')}</svg>`,
    );
  },
  async mountDemo() {},
  unmountDemo() {},
};
window.ecsPathTest = {
  node: () => api.getNodeById('text') as TextSerializedNode,
  glyphs: () =>
    api
      .getEntity(api.getNodeById('text')!)
      .read(ComputedTextMetrics)
      .pathGlyphs.map((g) => ({ ...g })),
  hit: (x, y) =>
    api
      .elementsFromPoint({ x, y })
      .some((e) => api.getNodeByEntity(e)?.id === 'text'),
  corners: () => {
    const entity = api.getEntity(api.getNodeById('text')!);
    const b = entity.read(ComputedBounds).geometryBounds;
    return [
      [b.minX, b.minY],
      [b.maxX, b.minY],
      [b.maxX, b.maxY],
      [b.minX, b.maxY],
    ].map(([x, y]) =>
      api.canvas2Viewport(api.transformer2Canvas({ x, y }, entity)),
    );
  },
  glyphCenter: (index) => {
    const entity = api.getEntity(api.getNodeById('text')!);
    const g = entity.read(ComputedTextMetrics).pathGlyphs[index];
    const x = (g.left + g.right) / 2,
      y = (g.top + g.bottom) / 2;
    return api.canvas2Viewport(
      api.transformer2Canvas(
        {
          x: g.x + Math.cos(g.rotation) * x - Math.sin(g.rotation) * y,
          y: g.y + Math.sin(g.rotation) * x + Math.cos(g.rotation) * y,
        },
        entity,
      ),
    );
  },
};
document.querySelector('#status')!.textContent = 'Path ready';

declare global {
  interface Window {
    ecsPathTest: {
      node: () => TextSerializedNode;
      glyphs: () => ComputedTextMetrics['pathGlyphs'];
      hit: (x: number, y: number) => boolean;
      corners: () => { x: number; y: number }[];
      glyphCenter: (index: number) => { x: number; y: number };
    };
  }
}
