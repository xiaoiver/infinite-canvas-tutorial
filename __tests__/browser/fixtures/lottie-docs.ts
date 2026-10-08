import { createApp } from 'vue';
import BouncyBall from '../../../packages/site/docs/components/AnimationLottieBouncyBall.vue';
import Bezier from '../../../packages/site/docs/components/AnimationLottieBezier.vue';
import PolyStar from '../../../packages/site/docs/components/AnimationLottiePolyStar.vue';
import Repeater from '../../../packages/site/docs/components/AnimationLottieRepeater.vue';
import type { API } from '../../../packages/ecs/src';

let api: API | undefined;
let app: ReturnType<typeof createApp>;
const cancelled: string[] = [];
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, options) => {
  options?.signal?.addEventListener(
    'abort',
    () => cancelled.push(String(input)),
    { once: true },
  );
  return nativeFetch(input, options);
};
function mount(bezier: boolean | 'polystar' | 'repeater' = false) {
  api = undefined;
  app = createApp(
    bezier === 'repeater'
      ? Repeater
      : bezier === 'polystar'
      ? PolyStar
      : bezier
      ? Bezier
      : BouncyBall,
  );
  app.mount('#demo');
  document.querySelector('ic-spectrum-canvas')!.addEventListener(
    'ic-ready',
    (event) => {
      api = (event as CustomEvent<API>).detail;
    },
    { once: true },
  );
}
const probe = {
  mount,
  unmount: () => app.unmount(),
  nodes: () => api?.getNodes().length ?? 0,
  values: () =>
    api
      ?.getNodes()
      .map((node) =>
        api!.getNodeAnimationController(node.id)?.getCurrentValues(),
      ) ?? [],
  paths: () =>
    api
      ?.getNodes()
      .filter((node) => node.type === 'path')
      .map(
        (node) =>
          api!.getNodeAnimationController(node.id)?.getCurrentValues()?.d,
      ) ?? [],
  ready: () => !!api,
  cancelled: () => cancelled,
};
declare global {
  interface Window {
    lottieDocs: typeof probe;
  }
}
window.lottieDocs = probe;
const params = new URLSearchParams(location.search);
mount(
  params.has('repeater')
    ? 'repeater'
    : params.has('polystar')
    ? 'polystar'
    : params.has('bezier'),
);
