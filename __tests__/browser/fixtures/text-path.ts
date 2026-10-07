import TextPathDemo from '../../../packages/site/docs/components/TextPath.vue';
import { createApp } from 'vue';
import {
  Canvas,
  CheckboardStyle,
  Text,
  Theme,
  serializeNode,
  toSVGElement,
  loadBitmapFont,
} from '../../../packages/core/src';
import fontData from '../../../packages/site/docs/public/fonts/msdf-sans-serif.json';
import fontImage from '../../../packages/site/docs/public/fonts/msdf-atlas-sans-serif.png?url';

export interface TextPathCase {
  content?: string;
  path: string;
  referencePath?: string;
  textAlign?: CanvasTextAlign;
  side?: 'left' | 'right';
  startOffset?: number;
  pathOffset?: number;
  letterSpacing?: number;
  bitmap?: boolean;
  fontSize?: number;
  x?: number;
  y?: number;
}

declare global {
  interface Window {
    textPathTest: {
      render(options: TextPathCase): Promise<void>;
      update(options: Partial<TextPathCase>): Promise<void>;
      bounds(): { minX: number; minY: number; maxX: number; maxY: number };
      exported(): Promise<void>;
      mountDemo(): Promise<void>;
      unmountDemo(): void;
    };
  }
}

async function main() {
  const actual = document.querySelector<HTMLCanvasElement>('#actual')!;
  const reference = document.querySelector<HTMLCanvasElement>('#reference')!;
  const canvas = await new Canvas({
    canvas: actual,
    devicePixelRatio: 1,
    checkboardStyle: CheckboardStyle.NONE,
    themeColors: {
      [Theme.LIGHT]: {
        background: '#ffffff',
        grid: '#ffffff',
        selectionBrushFill: '#ffffff',
        selectionBrushStroke: '#ffffff',
      },
    },
  }).initialized;
  let text: Text;
  const bitmap = await loadBitmapFont.parse(
    JSON.stringify({ ...fontData, pages: [fontImage] }),
  );
  let config: TextPathCase;
  let unmount: () => void;
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
      if (text) canvas.removeChild(text);
      text = new Text({
        content: options.content ?? 'Wavy type',
        fontSize: options.fontSize ?? 48,
        fontFamily: 'sans-serif',
        fill: 'black',
        ...options,
        bitmapFont: options.bitmap ? bitmap : undefined,
      });
      canvas.appendChild(text);
      canvas.render();
      await nativeReference();
    },
    async update(options) {
      config = { ...config, ...options };
      Object.assign(text, options);
      canvas.render();
      await nativeReference();
    },
    bounds() {
      const { minX, minY, maxX, maxY } = text.getGeometryBounds();
      return { minX, minY, maxX, maxY };
    },
    async exported() {
      const svg = toSVGElement(serializeNode(text)!);
      await raster(
        `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="340">${new XMLSerializer().serializeToString(
          svg,
        )}</svg>`,
      );
    },
    async mountDemo() {
      const app = createApp(TextPathDemo);
      app.mount('#demo');
      unmount = () => app.unmount();
    },
    unmountDemo() {
      unmount?.();
    },
  };
  document.querySelector('#status')!.textContent = 'Ready';
}
void main().catch((error) => {
  document.querySelector('#status')!.textContent = String(error);
  throw error;
});
