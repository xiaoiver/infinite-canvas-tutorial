import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Pen, type API } from '@infinite-canvas-tutorial/ecs';
import { Event as CanvasEvent } from '@infinite-canvas-tutorial/webcomponents';
import {
  loadAnimation,
  type LottieDiagnostic,
} from '@infinite-canvas-tutorial/lottie';
import { ensureExampleWorld } from './ensure-example-world';

/** Own the request, queued edit, imported nodes and listener for one demo mount. */
export function useLottieExample(url: string, cameraX = 0) {
  const wrapper = ref<HTMLElement | null>(null);
  const playStateLabel = ref('—');
  const playbackSpeed = ref(1);
  const diagnostics = ref<readonly LottieDiagnostic[]>([]);
  const scope = new AbortController();
  let canvas: HTMLElement | null = null;
  let api: API | undefined;
  let animation: ReturnType<typeof loadAnimation> | undefined;
  let pending: AbortController | undefined;
  let disposeCanvas: (() => void) | undefined;
  let direction: 1 | -1 = 1;

  const runningLabel = () =>
    direction === 1 ? 'running' : 'running (reverse)';
  async function load() {
    if (!api || scope.signal.aborted) return;
    pending?.abort();
    const request = new AbortController();
    pending = request;
    const owner = api;
    let loaded: ReturnType<typeof loadAnimation> | undefined;
    playStateLabel.value = 'loading';
    try {
      const response = await fetch(url, { signal: request.signal });
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      const data = await response.json();
      if (scope.signal.aborted || request.signal.aborted) return;
      loaded = loadAnimation(data, { loop: true, autoplay: true });
      const next = loaded;
      const committed = await owner.edit(
        () => {
          next.setSpeed(playbackSpeed.value);
          next.render(owner);
        },
        { signal: request.signal, capture: 'NEVER' },
      );
      if (!committed || scope.signal.aborted || request.signal.aborted) {
        await next.destroy();
        return;
      }
      animation = next;
      direction = 1;
      diagnostics.value = next.getDiagnostics();
      playStateLabel.value = runningLabel();
    } catch {
      if (loaded) await loaded.destroy();
      if (!scope.signal.aborted && !request.signal.aborted)
        playStateLabel.value = 'load error';
    }
  }
  function onPlay() {
    animation?.play();
    if (animation) playStateLabel.value = runningLabel();
  }
  function onPause() {
    animation?.pause();
    if (animation) playStateLabel.value = 'paused';
  }
  function onStop() {
    animation?.stop();
    if (animation) playStateLabel.value = 'stopped';
  }
  function onReverse() {
    if (!animation) return;
    direction = direction === 1 ? -1 : 1;
    animation.setDirection(direction);
    animation.play();
    playStateLabel.value = runningLabel();
  }
  function onRestart() {
    if (!animation) {
      void load();
      return;
    }
    animation.stop();
    animation.play();
    playStateLabel.value = runningLabel();
  }
  function applyPlaybackSpeed() {
    animation?.setSpeed(playbackSpeed.value);
  }
  function cleanup() {
    scope.abort();
    pending?.abort();
    canvas?.removeEventListener(CanvasEvent.READY, onReady);
    void animation?.destroy();
    animation = undefined;
    api = undefined;
  }
  function onReady(event: Event) {
    if (scope.signal.aborted || api) return;
    api = (event as CustomEvent<API>).detail;
    disposeCanvas = api.onDestroy(cleanup);
    api.setAppState({
      cameraX,
      cameraZoom: 0.5,
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.HAND],
    });
    void load();
  }
  onMounted(async () => {
    canvas = wrapper.value;
    canvas?.addEventListener(CanvasEvent.READY, onReady);
    try {
      await ensureExampleWorld();
    } catch {
      if (!scope.signal.aborted) playStateLabel.value = 'load error';
    }
  });
  onBeforeUnmount(() => {
    cleanup();
    disposeCanvas?.();
  });
  return {
    wrapper,
    playStateLabel,
    playbackSpeed,
    diagnostics,
    onPlay,
    onPause,
    onStop,
    onReverse,
    onRestart,
    applyPlaybackSpeed,
  };
}
