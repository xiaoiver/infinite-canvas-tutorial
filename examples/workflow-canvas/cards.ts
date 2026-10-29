import { accents, titles, type NodeKind } from './graph';

const specs: [NodeKind, number, number][] = [
  ['prompt', 252, 242],
  ['reference', 252, 266],
  ['image', 280, 350],
  ['motion', 280, 350],
  ['grade', 280, 264],
  ['output', 294, 366],
];
const font = (size: number, weight = 400) =>
  `${weight} ${size}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 9,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
/** Original procedural artwork: no third-party images or network requests. */
export function paintLandscape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  variant = 0,
) {
  ctx.save();
  rounded(ctx, x, y, w, h, 6);
  ctx.clip();
  ctx.translate(x, y);
  ctx.scale(w / 480, h / 300);
  const sky = ctx.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, '#1d2432');
  sky.addColorStop(0.48, '#b88972');
  sky.addColorStop(1, '#e6ba87');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 480, 300);
  const sun = ctx.createRadialGradient(326, 121, 2, 326, 121, 82);
  sun.addColorStop(0, '#ffe8be');
  sun.addColorStop(0.28, '#ffe0a399');
  sun.addColorStop(1, '#ffd99200');
  ctx.fillStyle = sun;
  ctx.fillRect(240, 30, 180, 180);
  ctx.fillStyle = '#ffe9ba';
  ctx.beginPath();
  ctx.arc(326, 121, 19, 0, Math.PI * 2);
  ctx.fill();
  for (let layer = 0; layer < 4; layer++) {
    const colors = ['#866d66', '#68544f', '#423d3e', '#22282b'];
    ctx.fillStyle = colors[layer];
    ctx.beginPath();
    ctx.moveTo(0, 300);
    for (let i = 0; i <= 48; i++) {
      const px = i * 10;
      const py =
        176 +
        layer * 31 +
        Math.sin(px * 0.009 + layer * 1.6 + variant * 0.2) * (20 + layer * 5);
      ctx.lineTo(px, py);
    }
    ctx.lineTo(480, 300);
    ctx.closePath();
    ctx.fill();
  }
  // Curving road and the small subject give every preview a film still composition.
  ctx.beginPath();
  ctx.moveTo(302, 174);
  ctx.bezierCurveTo(195, 230, 368, 218, 186, 300);
  ctx.lineTo(344, 300);
  ctx.bezierCurveTo(450, 244, 236, 220, 305, 174);
  const road = ctx.createLinearGradient(0, 190, 0, 300);
  road.addColorStop(0, '#5e5552');
  road.addColorStop(1, '#171e22');
  ctx.fillStyle = road;
  ctx.fill();
  ctx.fillStyle = '#131d22';
  rounded(ctx, 278, 229, 48, 18, 5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(286, 230);
  ctx.lineTo(294, 219);
  ctx.lineTo(313, 219);
  ctx.lineTo(321, 230);
  ctx.fill();
  ctx.fillStyle = '#92a5a4';
  ctx.fillRect(294, 222, 18, 7);
  ctx.fillStyle = '#ecaa70';
  ctx.fillRect(280, 238, 4, 3);
  ctx.fillRect(320, 238, 4, 3);
  // Seeded grain is generated once, never per frame.
  let seed = 77;
  for (let i = 0; i < 4200; i++) {
    seed = (seed * 16807) % 2147483647;
    const px = seed % 480;
    seed = (seed * 16807) % 2147483647;
    const py = seed % 300;
    ctx.fillStyle = i % 2 ? '#ffffff08' : '#0000000b';
    ctx.fillRect(px, py, 1, 1);
  }
  ctx.restore();
}
function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color = '#a0a6a2',
  size = 11,
  weight = 400,
) {
  ctx.font = font(size, weight);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
function pill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  color = '#9ba69e',
) {
  rounded(ctx, x, y, w, 23, 5);
  ctx.fillStyle = '#ffffff09';
  ctx.fill();
  label(ctx, text, x + 8, y + 15, color, 10);
}
/** Six cached 2× card textures. Repeated cards share image URLs/GPU textures. */
export async function createCardTextures(): Promise<Record<NodeKind, string>> {
  return Object.fromEntries(
    await Promise.all(
      specs.map(async ([kind, width, height], index) => {
        const canvas = document.createElement('canvas');
        canvas.width = width * 2;
        canvas.height = height * 2;
        const ctx = canvas.getContext('2d')!;
        ctx.scale(2, 2);
        rounded(ctx, 1, 1, width - 2, height - 2, 11);
        ctx.fillStyle = '#202421';
        ctx.fill();
        ctx.strokeStyle = '#3b403a';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = accents[kind];
        rounded(ctx, 15, 17, 25, 25, 6);
        ctx.globalAlpha = 0.12;
        ctx.fill();
        ctx.globalAlpha = 1;
        label(
          ctx,
          ['T', '◈', '✳', '↗', '◐', '▶'][index],
          22,
          34,
          accents[kind],
          14,
          600,
        );
        label(ctx, titles[kind], 49, 33, '#f1f3ed', 12, 550);
        label(ctx, '···', width - 29, 31, '#a0a6a2', 16);
        ctx.fillStyle = '#343a34';
        ctx.fillRect(14, 55, width - 28, 1);
        if (kind === 'prompt') {
          label(ctx, 'THE IDEA', 16, 79, '#818c81', 9, 600);
          [
            'A quiet road. A distant horizon.',
            'An endless possibility.',
            '',
            'A cinematic desert journey at',
            'golden hour. Warm light, 35mm',
            'film grain, slow tracking shot.',
          ].forEach((line, i) =>
            label(
              ctx,
              line,
              16,
              103 + i * 17,
              i < 2 ? '#e6e9df' : '#9ca59a',
              11,
            ),
          );
          pill(ctx, 'Text prompt', 16, height - 36, 79, '#c7b2f4');
          label(ctx, '126 characters', 145, height - 21, '#747e74', 9);
        } else if (kind === 'grade') {
          label(ctx, 'LOOK PRESET', 16, 81, '#818c81', 9, 600);
          ['#292f31', '#675a50', '#aa8a70', '#d1b28c', '#f4d9b0'].forEach(
            (color, i) => {
              ctx.fillStyle = color;
              rounded(ctx, 16 + i * 49, 96, 43, 45, 5);
              ctx.fill();
            },
          );
          label(ctx, 'Desert afterglow', 16, 166, '#e7e9e0', 12);
          label(ctx, 'Warmth', 16, 197);
          label(ctx, '+24', 237, 197, '#f2b6cb');
          rounded(ctx, 16, 210, width - 32, 3, 2);
          ctx.fillStyle = '#394039';
          ctx.fill();
          rounded(ctx, 16, 210, 164, 3, 2);
          ctx.fillStyle = '#d7a1b4';
          ctx.fill();
          pill(ctx, 'LUT · Kodak 2383', 16, height - 35, 119, '#f2b6cb');
        } else {
          const previewH =
            kind === 'reference' ? 139 : kind === 'output' ? 201 : 176;
          paintLandscape(ctx, 12, 68, width - 24, previewH, index);
          if (kind === 'motion' || kind === 'output') {
            ctx.fillStyle = '#111b1bb0';
            ctx.beginPath();
            ctx.arc(width / 2, 68 + previewH / 2, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f5f4e8';
            ctx.beginPath();
            ctx.moveTo(width / 2 - 4, 68 + previewH / 2 - 7);
            ctx.lineTo(width / 2 + 7, 68 + previewH / 2);
            ctx.lineTo(width / 2 - 4, 68 + previewH / 2 + 7);
            ctx.fill();
            pill(ctx, '00:08', width - 59, 68 + previewH - 31, 39, '#e5e7df');
          }
          const base = 68 + previewH;
          label(
            ctx,
            kind === 'reference'
              ? 'desert-road_01.png'
              : kind === 'output'
              ? 'Somewhere, beyond.'
              : 'Golden hour / take 01',
            16,
            base + 24,
            '#e2e7db',
            11,
          );
          if (kind !== 'reference') {
            pill(
              ctx,
              kind === 'image'
                ? 'FLUX.1 pro'
                : kind === 'motion'
                ? 'Kling 2.1'
                : '4K · 24 fps',
              16,
              base + 38,
              83,
              accents[kind],
            );
            label(
              ctx,
              kind === 'image' ? '16:9' : '8 seconds',
              width - 72,
              base + 53,
              '#8e9a8c',
              10,
            );
          }
          label(
            ctx,
            kind === 'reference'
              ? '1920 × 1080  ·  Image input'
              : kind === 'output'
              ? '●  Ready to export'
              : '●  Completed',
            16,
            height - 19,
            kind === 'reference' ? '#7f8a7d' : '#acd385',
            10,
          );
        }
        // Reusable input/output ports share the card texture.
        for (const px of [
          ...(kind === 'prompt' || kind === 'reference' ? [] : [3]),
          ...(kind === 'output' ? [] : [width - 3]),
        ]) {
          ctx.beginPath();
          ctx.arc(px, 46, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#d1e9ac';
          ctx.fill();
        }
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob((value) =>
            value
              ? resolve(value)
              : reject(new Error('Card texture encoding failed')),
          ),
        );
        return [kind, URL.createObjectURL(blob)];
      }),
    ),
  ) as Record<NodeKind, string>;
}
