<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
// @see https://vitejs.dev/guide/features.html#import-with-query-suffixes
import Worker from './worker.js?worker&inline';

const canvasRef = ref(null);
let stats;

const clonePointerEvent = (e) => {
  return {
    cancelable: e.cancelable,
    pointerId: e.pointerId,
    width: e.width,
    height: e.height,
    isPrimary: e.isPrimary,
    pointerType: e.pointerType,
    pressure: e.pressure,
    tangentialPressure: e.tangentialPressure,
    tiltX: e.tiltX,
    tiltY: e.tiltY,
    twist: e.twist,
    isTrusted: e.isTrusted,
    type: e.type,
    altKey: e.altKey,
    button: e.button,
    buttons: e.buttons,
    clientX: e.clientX,
    clientY: e.clientY,
    ctrlKey: e.ctrlKey,
    metaKey: e.metaKey,
    movementX: e.movementX,
    movementY: e.movementY,
    pageX: e.pageX,
    pageY: e.pageY,
    screenX: e.screenX,
    screenY: e.screenY,
    deltaMode: e.deltaMode,
    deltaX: e.deltaX,
    deltaY: e.deltaY,
    deltaZ: e.deltaZ,
  };
};

let worker;
onMounted(() => {
  const mainCanvas = canvasRef.value;

  if (mainCanvas) {
    if ('OffscreenCanvas' in window && 'transferControlToOffscreen' in mainCanvas
    ) {
      const offscreenCanvas = mainCanvas.transferControlToOffscreen();

      // Create a new worker
      // const workerUrl = new URL('./worker.js', import.meta.url).href;
      // worker = new Worker(workerUrl, { type: 'module' });

      worker = new Worker();
      worker.onmessage = function (event) {
        if (event.data.type === 'cursor') {
          mainCanvas.style.cursor = event.data.cursor;
        } else if (event.data.type === 'frame') {
          stats?.update();
        }
      };

      // Send the offscreen canvas to the worker
      worker.postMessage({
        type: 'init',
        offscreenCanvas,
        devicePixelRatio: window.devicePixelRatio,
        boundingClientRect: mainCanvas.getBoundingClientRect()
      }, [offscreenCanvas]);

      // listen to pointer events and transfer them to worker
      document.addEventListener(
        'pointermove',
        (e) => {
          worker.postMessage({
            type: 'event',
            name: 'pointermove',
            event: clonePointerEvent(e)
          });
        },
        true,
      );
      mainCanvas.addEventListener(
        'pointerdown',
        (e) => {
          worker.postMessage({
            type: 'event',
            name: 'pointerdown',
            event: clonePointerEvent(e)
          });
        },
        true,
      );
      mainCanvas.addEventListener(
        'pointerleave',
        (e) => {
          worker.postMessage({
            type: 'event',
            name: 'pointerleave',
            event: clonePointerEvent(e)
          });
        },
        true,
      );
      mainCanvas.addEventListener(
        'pointerover',
        (e) => {
          worker.postMessage({
            type: 'event',
            name: 'pointerover',
            event: clonePointerEvent(e)
          });
        },
        true,
      );
      window.addEventListener(
        'pointerup',
        (e) => {
          worker.postMessage({
            type: 'event',
            name: 'pointerup',
            event: clonePointerEvent(e)
          });
        },
        true,
      );
      window.addEventListener(
        'pointercancel',
        (e) => {
          worker.postMessage({
            type: 'event',
            name: 'pointercancel',
            event: clonePointerEvent(e)
          });
        },
        true,
      );
      mainCanvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        worker.postMessage({
          type: 'event',
          name: 'wheel',
          event: clonePointerEvent(e)
        });
      }, {
        // passive: true,
        capture: true,
      });
      window.addEventListener('resize', () => {
        worker.postMessage({
          type: 'resize',
          width: mainCanvas.width / window.devicePixelRatio,
          height: mainCanvas.height / window.devicePixelRatio,
        });
      });
    }
  }

  import('stats.js').then(m => {
    const Stats = m.default;
    stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';
    mainCanvas.parentElement.appendChild($stats);
  });
});

onUnmounted(() => {
  worker.terminate();
});
</script>

<template>
  <div style="position: relative">
    <canvas width="1000" height="1000" style="width:500px;height:500px;" ref="canvasRef"></canvas>
  </div>
</template>
