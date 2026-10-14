import {
  CheckboardStyle,
  DOMAdapter,
  ExportFormat,
  ExportSVG,
  Grid,
  Screenshot,
  System,
  system,
  type API,
  type Plugin,
  type RectSerializedNode,
} from '../../packages/ecs/src';
import { createDocumentWorld } from '../helpers/ecs-document';

let world: Awaited<ReturnType<typeof createDocumentWorld>>;
let api: API;
const screenshots: Array<{ svg: string; dataURL: string; download: boolean }> =
  [];

class CaptureSVG extends System {
  private readonly screenshots = this.query((q) => q.added.with(Screenshot));

  execute() {
    this.screenshots.added.forEach((screenshot) => {
      const { svg, dataURL, download } = screenshot.read(Screenshot);
      screenshots.push({ svg, dataURL, download });
    });
  }
}

const capturePlugin: Plugin = () => {
  system((s) => s.after(ExportSVG))(CaptureSVG);
};

const rect: RectSerializedNode = {
  id: 'export-rect',
  type: 'rect',
  x: 20,
  y: 30,
  width: 40,
  height: 30,
  zIndex: 0,
  fills: [{ type: 'solid', value: 'red', opacity: 1 }],
};

beforeAll(async () => {
  world = await createDocumentWorld(1, false, [capturePlugin]);
  [api] = world.apis;
  DOMAdapter.set({
    ...DOMAdapter.get(),
    getXMLSerializer: () => new world.window.XMLSerializer(),
  });
});

beforeEach(async () => {
  screenshots.length = 0;
  await world.reset(api, [rect]);
  api.setAppState({ variables: {} });
  await world.edit(
    api,
    (editor) => {
      const canvas = editor.getCanvas();
      if (!canvas.has(Grid)) canvas.add(Grid);
      canvas.write(Grid).checkboardStyle = CheckboardStyle.GRID;
    },
    'NEVER',
  );
});

afterAll(async () => {
  await world?.dispose();
});

it('exports selected nodes once with their own bounds and padding', async () => {
  const node = api.getNodes()[0];
  const svg = await api.renderToSVG([node, node], { padding: 5 });

  expect(svg.getAttribute('width')).toBe('40');
  expect(svg.getAttribute('height')).toBe('30');
  expect(svg.getAttribute('viewBox')).toBe('15 25 50 40');
  expect(svg.querySelectorAll('rect')).toHaveLength(1);
});

it('exports line and dot grids only when requested', async () => {
  const lines = await api.renderToSVG([], { grid: true });
  expect(lines.querySelector('#small-grid')).not.toBeNull();
  expect(lines.querySelector('#grid')).not.toBeNull();

  await world.edit(
    api,
    (editor) => {
      editor.getCanvas().write(Grid).checkboardStyle = CheckboardStyle.DOTS;
    },
    'NEVER',
  );
  const dots = await api.renderToSVG([], { grid: true });
  expect(dots.querySelector('#dots-grid')).not.toBeNull();
  expect(dots.querySelectorAll('#dots-grid use')).toHaveLength(4);

  const noGrid = await api.renderToSVG([], { grid: false });
  expect(noGrid.querySelectorAll('pattern')).toHaveLength(0);
});

it('keeps referenced variables in a selected SVG export', async () => {
  api.setAppState({
    variables: { primary: { type: 'color', value: 'red' } },
  });
  await world.edit(
    api,
    (editor) => {
      editor.updateNode({
        ...rect,
        fills: [{ type: 'solid', value: '$primary', opacity: 1 }],
      });
    },
    'NEVER',
  );

  const svg = await api.renderToSVG([api.getNodes()[0]], {
    designVariablesExport: 'css-var',
  });
  expect(svg.querySelector('defs style')?.textContent).toContain('--primary');
  expect(svg.outerHTML).toContain('var(--primary)');
});

it('includes the clipping parent when exporting only its child', async () => {
  await world.reset(api, [
    { ...rect, id: 'clip-parent', clipMode: 'clip' },
    { ...rect, id: 'clip-child', parentId: 'clip-parent', x: 30, y: 40 },
  ]);

  const child = api.getNodes().find((node) => node.id === 'clip-child')!;
  const svg = await api.renderToSVG([child]);
  expect(svg.querySelector('clipPath')).not.toBeNull();
  expect(svg.querySelectorAll('rect').length).toBeGreaterThanOrEqual(2);
});

it('emits one screenshot result and releases the request after delivery', async () => {
  api.export({ format: ExportFormat.SVG, download: false });
  for (let i = 0; i < 4; i++) await world.frame();

  expect(screenshots).toHaveLength(1);
  expect(screenshots[0].svg).toContain('export-rect');
  expect(screenshots[0].dataURL).toMatch(/^data:image\/svg\+xml/);
  expect(screenshots[0].download).toBe(false);

  api.export({
    format: ExportFormat.SVG,
    download: true,
    nodes: [api.getNodes()[0]],
  });
  for (let i = 0; i < 4; i++) await world.frame();
  expect(screenshots).toHaveLength(2);
  expect(screenshots[1].download).toBe(true);
  expect(screenshots[1].svg).toContain('width="40" height="30"');
});
