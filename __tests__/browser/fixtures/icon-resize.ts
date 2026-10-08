import { settleECSFrames } from './ecs-frames';
import { createApp } from 'vue';
import IconLucide from '../../../packages/site/docs/components/IconLucide.vue';
import {
  type API,
  type IconFontSerializedNode,
  Circle,
  ComputedBounds,
  FillLayers,
  StrokeLayers,
  Transformable,
  sortByFractionalIndex,
} from '../../../packages/ecs/src';

let api: API;
const app = createApp(IconLucide);
app.mount('#demo');
document.querySelector('ic-spectrum-canvas')!.addEventListener(
  'ic-ready',
  (event) => {
    api = (event as CustomEvent<API>).detail;
  },
  { once: true },
);

const settle = () => settleECSFrames(api, 4);

const harness = {
  ready: () => !!api?.getNodeById('search-icon-lucide'),
  settle,
  order: () =>
    api
      .getNodes()
      .map((node) => api.getEntity(node))
      .sort(sortByFractionalIndex)
      .map((entity) => api.getNodeByEntity(entity)!.id),
  node: (id: string) => api.getNodeById(id) as IconFontSerializedNode,
  children(id: string) {
    return api.getChildren(api.getNodeById(id)).map((entity) => {
      const { minX, minY, maxX, maxY } =
        entity.read(ComputedBounds).geometryBounds;
      return {
        bounds: [minX, minY, maxX, maxY],
        fills: entity.has(FillLayers) ? entity.read(FillLayers).layers : [],
        strokes: entity.has(StrokeLayers)
          ? entity.read(StrokeLayers).layers
          : [],
      };
    });
  },
  async select(id: string) {
    await api.edit(
      () => {
        api.selectNodes([api.getNodeById(id)]);
        api.setAppState({
          taskbarSelected: [],
          snapToPixelGridEnabled: false,
          snapToObjectsEnabled: false,
        });
      },
      { capture: 'NEVER' },
    );
    await settle();
  },
  corners() {
    const tf = api.getCamera().read(Transformable);
    return [tf.tlAnchor, tf.trAnchor, tf.brAnchor, tf.blAnchor].map(
      (anchor) => {
        const { cx, cy } = anchor.read(Circle);
        return api.canvas2Viewport(
          api.transformer2Canvas({ x: cx, y: cy }, anchor),
        );
      },
    );
  },
  async undo() {
    api.undo();
    await settle();
  },
  async redo() {
    api.redo();
    await settle();
  },
  unmount: () => app.unmount(),
};
declare global {
  interface Window {
    iconResize: typeof harness;
  }
}
window.iconResize = harness;
