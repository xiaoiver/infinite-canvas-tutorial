<script setup>
import { Circle } from '@infinite-canvas-tutorial/core';
import { onMounted, onUnmounted, ref } from 'vue';
import Stats from 'stats.js';
import Worker from './worker.js?worker&inline';

const canvasRef = ref(null);
const total = ref(0);
const culled = ref(0);
const circles = [];
let canvas;

const stats = new Stats();
stats.showPanel(0);
const $stats = stats.dom;
$stats.style.position = 'absolute';
$stats.style.left = '0px';
$stats.style.top = '0px';

const add500Circles = () => {
  for (let i = 0; i < 500; i++) {
    const circle = new Circle({
      cx: Math.random() * 1000,
      cy: Math.random() * 1000,
      r: Math.random() * 20,
      fill: `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
        Math.random() * 255,
      )},${Math.floor(Math.random() * 255)})`,
    });
    canvas.appendChild(circle);
    circles.push(circle);
  }
};

let worker;
onMounted(() => {
  const mainCanvas = canvasRef.value;
  const mainCtx = mainCanvas.getContext('bitmaprenderer');

  if (mainCanvas) {
    if ('OffscreenCanvas' in window && 'transferFromImageBitmap' in mainCtx) {
      const offscreenCanvas = new window.IOffscreenCanvas(mainCanvas.width, mainCanvas.height);

      // Create a new worker
      worker = new Worker();
      worker.onmessage = function (event) {
        if (event.data instanceof window.ImageBitmap) {

          mainCtx.transferFromImageBitmap(event.data);
        }
      };

      // Send the offscreen canvas to the worker
      worker.postMessage({
        type: 'init',
        offscreenCanvas,
        devicePixelRatio: window.devicePixelRatio
      }, [offscreenCanvas]);

      const { left, top } = mainCanvas.getBoundingClientRect();
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
          clientX: e.clientX - left, // account for $canvas' offset
          clientY: e.clientY - top,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          movementX: e.movementX,
          movementY: e.movementY,
          pageX: e.pageX,
          pageY: e.pageY,
          screenX: e.screenX,
          screenY: e.screenY,
        };
      };

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
    }
  }


  // const $canvas = document.querySelector('ic-canvas-lesson8');

  // $canvas.parentElement.appendChild($stats);

  // $canvas.addEventListener('ic-ready', (e) => {
  //   canvas = e.detail;
  //   add500Circles();
  // });

  // $canvas.addEventListener('ic-frame', (e) => {
  //   stats.update();
  //   total.value = circles.length;
  //   culled.value = circles.filter((circle) => circle.culled).length;
  // });
  // }
});

onUnmounted(() => {
  worker.terminate();
});
</script>

<template>
  <span>total: {{ total }}</span>
  &nbsp;
  <span>culled: {{ culled }}</span>
  &nbsp;
  <sl-button size="small" @click="add500Circles">Add 500 circles</sl-button>
  <div style="position: relative">
    <canvas width="1000" height="1000" style="width:500px;height:500px;" ref="canvasRef"></canvas>
  </div>
</template>
