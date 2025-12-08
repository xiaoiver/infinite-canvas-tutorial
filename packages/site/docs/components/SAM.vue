<script setup lang="ts">
import {
  App,
  Pen,
  DefaultPlugins,
  RectSerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { ref, onMounted, onUnmounted } from 'vue';
import { LoadingOutlined } from '@ant-design/icons-vue';
import { Event, UIPlugin } from '@infinite-canvas-tutorial/webcomponents';
// @see https://vitejs.dev/guide/features.html#import-with-query-suffixes
import Worker from './sam-worker.js?worker&inline';

const wrapper = ref<HTMLElement | null>(null);
let api: any | undefined;
let onReady: ((api: CustomEvent<any>) => void) | undefined;
let loading = ref(false);
let loadingMessage = ref('');
let worker;

// resize+pad all images to 1024x1024
const imageSize = { w: 1024, h: 1024 };
const maskSize = { w: 256, h: 256 };

function image2Canvas(url: string, size: { w: number, h: number }): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.src = url;
  img.crossOrigin = "Anonymous";
  return new Promise((resolve, reject) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, size.w, size.h);
      resolve(canvas);
    };
    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };
  });
}

/** 
 * input: HTMLCanvasElement (RGB)
 * output: Float32Array for later conversion to ORT.Tensor of shape [1, 3, canvas.width, canvas.height]
 *  
 * inspired by: https://onnxruntime.ai/docs/tutorials/web/classify-images-nextjs-github-template.html
 **/
function canvasToFloat32Array(canvas: HTMLCanvasElement): { float32Array: Float32Array, shape: number[] } {
  const imageData = canvas
    .getContext("2d")
    .getImageData(0, 0, canvas.width, canvas.height).data;
  const shape = [1, 3, canvas.width, canvas.height];

  const [redArray, greenArray, blueArray] = [[], [], []];

  for (let i = 0; i < imageData.length; i += 4) {
    redArray.push(imageData[i]);
    greenArray.push(imageData[i + 1]);
    blueArray.push(imageData[i + 2]);
    // skip data[i + 3] to filter out the alpha channel
  }

  const transposedData = redArray.concat(greenArray).concat(blueArray);

  let i,
    l = transposedData.length;
  const float32Array = new Float32Array(shape[1] * shape[2] * shape[3]);
  for (i = 0; i < l; i++) {
    float32Array[i] = transposedData[i] / 255.0; // convert to float
  }

  return { float32Array, shape };
}

const pointsRef = ref<{ x: number, y: number, label: number }[]>([]);
const prevMaskArray = ref<Float32Array | null>(null);

// const imageClick = (event: MouseEvent) => {
//   event.preventDefault();

//   const canvas = canvasEl.current;
//   const rect = event.target.getBoundingClientRect();

//   // input image will be resized to 1024x1024 -> normalize mouse pos to 1024x1024
//   const point = {
//     x: ((event.clientX - rect.left) / canvas.width) * imageSize.w,
//     y: ((event.clientY - rect.top) / canvas.height) * imageSize.h,
//     label: event.button === 0 ? 1 : 0,
//   };
//   pointsRef.value.push(point);

//   // do we have a mask already? ie. a refinement click?
//   if (prevMaskArray.value) {
//     const maskShape = [1, 1, maskSize.w, maskSize.h]

//     worker.postMessage({
//       type: "decodeMask",
//       data: {
//         points: pointsRef.value,
//         maskArray: prevMaskArray.value,
//         maskShape: maskShape,
//       }
//     });      
//   } else {
//     worker.postMessage({
//       type: "decodeMask",
//       data: {
//         points: pointsRef.value,
//         maskArray: null,
//         maskShape: null,
//       }
//     });      
//   }

//   loading.value = true;
//   loadingMessage.value = 'Decoding...';
// };

const resetState = () => {
  pointsRef.value = [];
  prevMaskArray.value = null;
}

onMounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  worker = new Worker();
  worker.onmessage = function (event) {
    const { type, data } = event.data;

    if (type == "pong") {
      const { success, device } = data;
      if (success) {
        loading.value = false;
        loadingMessage.value = '';
      } else {
        console.error("Error (check JS console)");
      }
    } else if (type == "downloadInProgress" || type == "loadingInProgress") {
      loading.value = true;
      loadingMessage.value = 'Loading SAM models...';
    } else if (type == "encodeImageDone") {
      loading.value = false;
      loadingMessage.value = '';
    } else if (type == "decodeMaskResult") {
      loading.value = false;
      loadingMessage.value = '';

      // SAM2 returns 3 mask along with scores -> select best one
      // const maskTensors = data.masks;
      // const [bs, noMasks, width, height] = maskTensors.dims;
      // const maskScores = data.iou_predictions.cpuData;
      // const bestMaskIdx = maskScores.indexOf(Math.max(...maskScores));
      // const bestMaskArray = sliceTensor(maskTensors, bestMaskIdx)
      // let bestMaskCanvas = float32ArrayToCanvas(bestMaskArray, width, height)
      // bestMaskCanvas = resizeCanvas(bestMaskCanvas, imageSize);
    } else if (type == "stats") {
      // setStats(data);
    }
  };
  worker.postMessage({ type: "ping" });

  onReady = async (e) => {
    api = e.detail;

    api.setAppState({
      ...api.getAppState(),
      penbarSelected: Pen.SELECT,
      penbarAll: [Pen.SELECT, Pen.DRAW_RECT],
    });

    api.encodeImage = async (image: string) => {
      loading.value = true;
      loadingMessage.value = 'Encoding image...';
      worker.postMessage({
        type: "encodeImage",
        data: canvasToFloat32Array(await image2Canvas(image, imageSize)),
      });
    };

    api.segmentWithPoints = async (points: { x: number, y: number, xNormalized: number, yNormalized: number }[]) => {
      if (points.length === 0) {
        return;
      }

      const { xNormalized, yNormalized } = points[0];
      // input image will be resized to 1024x1024 -> normalize mouse pos to 1024x1024
      const point = {
        x: xNormalized * imageSize.w,
        y: yNormalized * imageSize.h,
        label: 0,
      };
      worker.postMessage({
        type: "decodeMask",
        data: {
          points: [point],
          maskArray: null,
          maskShape: null,
        }
      });
    };

    const node: RectSerializedNode = {
      id: 'snap-to-pixel-grid-1',
      type: 'rect',
      x: 50,
      y: 50,
      width: 200,
      height: 200,
      fill: 'https://v3b.fal.media/files/b/tiger/v1lf1EcPP1X1pw_YOKM4o.jpg',
    };

    api.updateNode(node);
    api.selectNodes([node]);
    api.record();
  };

  canvas.addEventListener(Event.READY, onReady);

  // App only runs once
  if (!(window as any).worldInited) {
    (window as any).worldInited = true;
    await import('@infinite-canvas-tutorial/webcomponents/spectrum');
    new App().addPlugins(...DefaultPlugins, UIPlugin).run();
  } else {
    // 等待组件更新完成后检查API是否已经准备好
    setTimeout(() => {
      // 检查canvas的apiProvider是否已经有值
      const canvasElement = canvas as any;
      if (canvasElement.apiProvider?.value) {
        // 如果API已经准备好，手动触发onReady
        const readyEvent = new CustomEvent(Event.READY, {
          detail: canvasElement.apiProvider.value
        });
        onReady?.(readyEvent);
      } else {
        // 如果API还没准备好，监听API的变化
        let checkCount = 0;
        const checkInterval = setInterval(() => {
          checkCount++;
          if (canvasElement.apiProvider?.value) {
            clearInterval(checkInterval);
            const readyEvent = new CustomEvent(Event.READY, {
              detail: canvasElement.apiProvider.value
            });
            onReady?.(readyEvent);
          } else if (checkCount > 50) { // 5秒超时
            clearInterval(checkInterval);
            console.warn('Canvas API initialization timeout');
          }
        }, 100);
      }
    }, 100);
  }
});

onUnmounted(async () => {
  const canvas = wrapper.value;
  if (!canvas) {
    return;
  }

  if (onReady) {
    canvas.removeEventListener(Event.READY, onReady);
  }

  worker.terminate();

  api?.destroy();
});
</script>

<style scoped>
.mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
}
</style>

<template>
  <ic-spectrum-canvas ref="wrapper" style="width: 100%; height: 300px"></ic-spectrum-canvas>
  <div class="mask" v-if="loading">
    <LoadingOutlined />
    <span v-if="loadingMessage">{{ loadingMessage }}</span>
  </div>
</template>
