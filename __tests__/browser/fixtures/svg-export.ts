import { serializeNodesToSVGElements } from '../../../packages/ecs/src/utils/serialize/svg';
import type { SerializedNode } from '../../../packages/ecs/src/types/serialized-node';

function canvas(width: number, height: number) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return element;
}

const tile = canvas(8, 4);
const tileContext = tile.getContext('2d')!;
tileContext.fillStyle = 'red';
tileContext.fillRect(0, 0, 4, 4);
tileContext.fillStyle = 'blue';
tileContext.fillRect(4, 0, 4, 4);

async function rasterize(node: SerializedNode) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '180');
  svg.setAttribute('height', '120');
  svg.append(...(await serializeNodesToSVGElements([node])));
  const xml = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const context = canvas(180, 120).getContext('2d')!;
    context.drawImage(image, 0, 0);
    return context;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const svgExportTest = {
  async pattern(repetition: 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat') {
    const actual = await rasterize({
      id: 'rect',
      type: 'rect',
      zIndex: 0,
      x: 37,
      y: 19,
      width: 80,
      height: 40,
      fills: [{ type: 'pattern', value: tile.toDataURL(), repetition }],
    });
    // Canvas2D provides an independent oracle for the SVG repetition modes.
    const reference = canvas(180, 120).getContext('2d')!;
    reference.translate(37, 19);
    reference.fillStyle = reference.createPattern(tile, repetition)!;
    reference.fillRect(0, 0, 80, 40);
    const pixels = actual.getImageData(0, 0, 180, 120).data;
    const expected = reference.getImageData(0, 0, 180, 120).data;
    return {
      differingChannels: pixels.reduce(
        (n, value, i) => n + Number(value !== expected[i]),
        0,
      ),
      samples: [
        [38, 20],
        [42, 20],
        [46, 20],
        [38, 25],
      ].map(([x, y]) => Array.from(actual.getImageData(x, y, 1, 1).data)),
    };
  },
  async text(type: 'gradient' | 'image' | 'pattern') {
    const context = await rasterize({
      id: 'text',
      type: 'text',
      zIndex: 0,
      x: 20,
      y: 40,
      width: 100,
      height: 30,
      fontFamily: 'sans-serif',
      fontSize: 30,
      letterSpacing: 0,
      content: 'SVG',
      fills: [
        {
          type,
          value:
            type === 'gradient'
              ? 'linear-gradient(90deg, red, blue)'
              : tile.toDataURL(),
        },
      ],
    });
    const pixels = context.getImageData(0, 0, 180, 120).data;
    let painted = 0;
    let colored = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] > 0) {
        painted++;
        if (pixels[i] > 50 || pixels[i + 2] > 50) colored++;
      }
    }
    return { painted, colored };
  },
};

declare global {
  interface Window {
    svgExportTest: typeof svgExportTest;
  }
}
window.svgExportTest = svgExportTest;
document.querySelector('#status')!.textContent = 'Ready';
