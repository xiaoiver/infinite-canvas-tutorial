import {
  API,
  type AppState,
  Text,
  Pen,
  ComputedBounds,
  Transformable,
  App,
  Canvas,
  Theme,
  ThemeMode,
  Grid,
  Camera,
  Parent,
  Children,
  Transform,
  Renderable,
  FillLayers,
  StrokeLayers,
  Stroke,
  Rect,
  Polyline,
  Path,
  Visibility,
  Name,
  DropShadow,
  ZIndex,
  Opacity,
  GlobalTransform,
  VectorNetwork,
  Circle,
  Ellipse,
  Commands,
  ComputeZIndex,
  DefaultPlugins,
  DefaultStateManagement,
  PreStartUp,
  System,
  system,
  CheckboardStyle,
  StrokeAttenuation,
} from '@infinite-canvas-tutorial/ecs';
import { TinySDF } from '../../../packages/ecs/src/utils/glyph/tiny-sdf';
import { GlyphManager } from '../../../packages/ecs/src/utils/glyph/glyph-manager';
import '../../../packages/webcomponents/src/spectrum/text-editor';
import gaeguUrl from '../../../packages/webcomponents/examples/Gaegu-Regular.ttf?url';
import notoUrl from '../../../packages/webcomponents/examples/NotoSans-Regular.ttf?url';
import italicUrl from '../../../packages/webcomponents/examples/NotoSans-Italic.ttf?url';
import type { TextEditor } from '../../../packages/webcomponents/src/spectrum/text-editor';
import type { ExtendedAPI } from '../../../packages/webcomponents/src/API';

const actual = document.querySelector<HTMLCanvasElement>('#actual')!;
const editor = document.querySelector<TextEditor>('ic-spectrum-text-editor')!;
let api: API;
let draws = 0;
let uploads = 0;
let rasterMs = 0;
const draw = TinySDF.prototype.draw;
TinySDF.prototype.draw = function (...args) {
  draws++;
  const start = performance.now();
  const result = draw.apply(this, args);
  rasterMs += performance.now() - start;
  return result;
};
const generate = GlyphManager.prototype.generateAtlas;
GlyphManager.prototype.generateAtlas = function (...args) {
  const before = this.getAtlasTexture();
  const result = generate.apply(this, args);
  if (this.getAtlasTexture() !== before) uploads++;
  return result;
};
// Forward live app state just as LitStateManagement's context provider does.
class EditorState extends DefaultStateManagement {
  setAppState(state: AppState) {
    super.setAppState(state);
    editor.appState = state;
    editor.requestUpdate();
  }
}
class Bootstrap extends System {
  access = this.query(
    (q) =>
      q.using(
        Text,
        Canvas,
        Theme,
        Grid,
        Camera,
        Parent,
        Children,
        Transform,
        Renderable,
        FillLayers,
        StrokeLayers,
        Stroke,
        Rect,
        Polyline,
        Path,
        Visibility,
        Name,
        DropShadow,
        ZIndex,
        Opacity,
        GlobalTransform,
        StrokeAttenuation,
        VectorNetwork,
        Circle,
        Ellipse,
      ).write,
  );
  initialize() {
    api = new API(new EditorState(), new Commands(this));
    api.createCanvas({
      element: actual,
      width: 640,
      height: Number(actual.getAttribute('height') ?? 320),
      devicePixelRatio: 1,
    });
    api.createCamera({ zoom: 1 });
    api.setAppState({
      penbarSelected: Pen.SELECT,
      checkboardStyle: CheckboardStyle.NONE,
      theme: {
        mode: ThemeMode.LIGHT,
        colors: { light: { background: '#ffffff' } },
      },
    });
  }
}
const app = new App().addPlugins(...DefaultPlugins, () => {
  system(PreStartUp)(Bootstrap);
  system((s) => s.before(ComputeZIndex))(Bootstrap);
});
const rendered = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
await Promise.all(
  [
    ['Gaegu', gaeguUrl],
    ['NotoSans', notoUrl],
    ['NotoItalic', italicUrl],
  ].map(async ([family, url]) => {
    const face = new FontFace(family, `url(${url})`);
    (document.fonts as FontFaceSet & { add(face: FontFace): void }).add(
      await face.load(),
    );
  }),
);
await app.run();
editor.api = Object.assign(api, {
  element: document.querySelector('#host'),
}) as unknown as ExtendedAPI;
editor.appState = api.getAppState();
editor.requestUpdate();
window.textTest = {
  api,
  counts: () => ({ draws, uploads, rasterMs }),
  resetCounts: () => {
    draws = 0;
    uploads = 0;
    rasterMs = 0;
  },
  rendered,
  async render(attrs = {}) {
    await api.edit(() => {
      api.deleteNodesById(['text']);
      api.setAppState({ cameraZoom: 1, cameraX: 0, cameraY: 0 });
      api.updateNodes([
        {
          id: 'text',
          type: 'text',
          content: 'hijk',
          fontFamily: 'Gaegu',
          fontSize: 96,
          anchorX: 100,
          anchorY: 180,
          zIndex: 1,
          fills: [{ type: 'solid', value: 'black' }],
          ...attrs,
        },
      ]);
    });
    await rendered();
  },
  async update(attrs) {
    await api.edit(() => api.updateNode(api.getNodeById('text')!, attrs));
    await rendered();
  },
  async select() {
    await api.edit(() => api.selectNodes([api.getNodeById('text')!]));
    await rendered();
  },
  anchors() {
    const tf = api.getCamera().read(Transformable);
    return [
      tf.tlAnchor,
      tf.trAnchor,
      tf.brAnchor,
      tf.blAnchor,
      tf.centerAnchor,
    ].map((anchor) => {
      const { cx, cy } = anchor.read(Circle);
      return api.canvas2Viewport(
        api.transformer2Canvas({ x: cx, y: cy }, anchor),
      );
    });
  },
  corners() {
    const entity = api.getEntity(api.getNodeById('text')!);
    const bounds = entity.read(ComputedBounds).geometryBounds;
    return [
      [0, 0],
      [bounds.maxX - bounds.minX, 0],
      [bounds.maxX - bounds.minX, bounds.maxY - bounds.minY],
      [0, bounds.maxY - bounds.minY],
    ].map(([x, y]) =>
      api.canvas2Viewport(api.transformer2Canvas({ x, y }, entity)),
    );
  },
};
document.querySelector('#status')!.textContent = 'Ready';

export type TextHarness = typeof window.textTest;
declare global {
  interface Window {
    textTest: {
      api: API;
      counts: () => { draws: number; uploads: number; rasterMs: number };
      resetCounts: () => void;
      rendered: () => Promise<void>;
      render: (
        attrs?: Partial<
          import('@infinite-canvas-tutorial/ecs').TextSerializedNode
        >,
      ) => Promise<void>;
      update: (
        attrs: Partial<
          import('@infinite-canvas-tutorial/ecs').TextSerializedNode
        >,
      ) => Promise<void>;
      select: () => Promise<void>;
      anchors: () => { x: number; y: number }[];
      corners: () => { x: number; y: number }[];
    };
  }
}
