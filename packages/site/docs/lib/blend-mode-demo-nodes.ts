import type { SerializedNode } from '@infinite-canvas-tutorial/ecs';

const DEMO = 150;
const GAP = 28;
const ORIGIN_X = 48;
const ORIGIN_Y = 72;

const ELLIPSE_CX = 75;
const ELLIPSE_CY = 75;
const ELLIPSE_RX = 25;
const ELLIPSE_RY = 70;

/** ECS Transform rotates around (x, y); compensate for MDN-style transform-origin: center. */
function ellipseNodeForCenterRotation(
  ox: number,
  oy: number,
  rotationDeg: number,
) {
  const rotation = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const centerX = ox + ELLIPSE_CX;
  const centerY = oy + ELLIPSE_CY;
  const rotLocalCx = ELLIPSE_RX * cos - ELLIPSE_RY * sin;
  const rotLocalCy = ELLIPSE_RX * sin + ELLIPSE_RY * cos;
  return {
    x: centerX - rotLocalCx,
    y: centerY - rotLocalCy,
    width: ELLIPSE_RX * 2,
    height: ELLIPSE_RY * 2,
    rotation,
  };
}

const RGB_ELLIPSES = [
  {
    id: 'R',
    rotation: -30,
    fill: 'linear-gradient(90deg, #ff0000 0%, #ffffff 100%)',
  },
  {
    id: 'G',
    rotation: 90,
    fill: 'linear-gradient(90deg, #00ff00 0%, #ffffff 100%)',
  },
  {
    id: 'B',
    rotation: 210,
    fill: 'linear-gradient(90deg, #0000ff 0%, #ffffff 100%)',
  },
] as const;

const DEMO_BG_FILLS = [
  {
    type: 'gradient' as const,
    value: 'linear-gradient(to bottom, yellow 0%, magenta 50%, cyan 100%)',
  },
  {
    type: 'gradient' as const,
    value: 'linear-gradient(to right, black 0%, transparent 50%, white 100%)',
  },
];

const BLEND_MODES = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'difference',
  'colorBurn',
  'colorDodge',
  'softLight',
] as const;

export type BlendModeDemoMode = (typeof BLEND_MODES)[number];

export function buildBlendModeDemoNodes(): SerializedNode[] {
  const nodes: SerializedNode[] = [
    {
      id: 'blend-title',
      type: 'text',
      anchorX: ORIGIN_X,
      anchorY: 24,
      content:
        'MDN-style RGB ellipses — each ellipse uses the cell blendMode over the background',
      fontSize: 14,
      fontFamily: 'system-ui',
      textBaseline: 'top',
      fills: [{ type: 'solid', value: '#374151' }],
      zIndex: 100,
    },
  ];

  const addRgbEllipseDemo = (
    prefix: string,
    ox: number,
    oy: number,
    blendMode: BlendModeDemoMode,
    label?: string,
  ) => {
    nodes.push({
      id: `${prefix}-bg`,
      type: 'rect',
      x: ox,
      y: oy,
      width: DEMO,
      height: DEMO,
      fills: [...DEMO_BG_FILLS],
      zIndex: 0,
    });

    RGB_ELLIPSES.forEach(({ id, rotation, fill }, i) => {
      const ellipse = ellipseNodeForCenterRotation(ox, oy, rotation);
      nodes.push({
        id: `${prefix}-${id}`,
        type: 'ellipse',
        ...ellipse,
        fills: [{ type: 'gradient', value: fill }],
        blendMode,
        zIndex: i + 1,
      });
    });

    if (label) {
      nodes.push({
        id: `${prefix}-label`,
        type: 'text',
        anchorX: ox,
        anchorY: oy + DEMO + 8,
        content: label,
        fontSize: 11,
        fontFamily: 'system-ui',
        textBaseline: 'top',
        fills: [{ type: 'solid', value: '#6b7280' }],
        zIndex: 100,
      });
    }
  };

  BLEND_MODES.forEach((mode, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    addRgbEllipseDemo(
      `blend-${mode}`,
      ORIGIN_X + col * (DEMO + GAP),
      ORIGIN_Y + row * (DEMO + GAP + 24),
      mode,
      mode,
    );
  });

  return nodes;
}
