<script setup>
import { Rect } from '@infinite-canvas-tutorial/core';
import { Format, TextureUsage, BufferUsage, BufferFrequencyHint, VertexStepMode, TransparentWhite } from '@antv/g-device-api';
import { ref, onMounted } from 'vue';
import Stats from 'stats.js';
import { vert, frag } from './shaders/fbm';
import { paddingUniforms } from './utils';

let canvas;
let render;
let counter = 0;

const stats = new Stats();
stats.showPanel(0);
const $stats = stats.dom;
$stats.style.position = 'absolute';
$stats.style.left = '0px';
$stats.style.top = '0px';

const wrapper = ref(null);

onMounted(() => {
  import('@infinite-canvas-tutorial/ui');

  const $canvas = wrapper.value;

  if (!$canvas) return;

  $canvas.parentElement.appendChild($stats);

  $canvas.addEventListener('ic-ready', (e) => {
    canvas = e.detail;

    const device = canvas.getDevice();

    const width = 400;
    const height = 400;

    const texture = device.createTexture({
      format: Format.U8_RGBA_NORM,
      width,
      height,
      usage: TextureUsage.RENDER_TARGET,
    });
    const renderTarget =
      device.createRenderTargetFromTexture(texture);

    const program = device.createProgram({
      vertex: {
        glsl: vert,
      },
      fragment: {
        glsl: frag,
      },
    });

    const buffer = device.createBuffer({
      viewOrSize: 4 * Float32Array.BYTES_PER_ELEMENT,
      usage: BufferUsage.UNIFORM,
    });

    const updateUniforms = () => {
      const uniforms = {
        u_Time: (counter++ / 1000),
      };

      const floatArray = paddingUniforms(Object.values(uniforms));
      buffer.setSubData(0, new Uint8Array(new Float32Array(floatArray).buffer));
      program.setUniformsLegacy(uniforms);
    };

    const vertexBuffer = device.createBuffer({
      // rendering a fullscreen triangle instead of quad
      // @see https://www.saschawillems.de/blog/2016/08/13/vulkan-tutorial-on-rendering-a-fullscreen-quad-without-buffers/
      viewOrSize: new Float32Array([1, 3, -3, -1, 1, -1]),
      usage: BufferUsage.VERTEX,
      hint: BufferFrequencyHint.DYNAMIC,
    });

    const inputLayout = device.createInputLayout({
      vertexBufferDescriptors: [
        {
          arrayStride: 4 * 2,
          stepMode: VertexStepMode.VERTEX,
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: Format.F32_RG,
            },
          ],
        },
      ],
      indexBufferFormat: null,
      program,
    });

    const pipeline = device.createRenderPipeline({
      inputLayout,
      program,
      colorAttachmentFormats: [Format.U8_RGBA_NORM],
    });

    const bindings = device.createBindings({
      pipeline,
      uniformBufferBindings: [
        {
          buffer,
        },
      ]
    });

    const renderToTexture = () => {
      device.beginFrame();
      const renderPass = device.createRenderPass({
        colorAttachment: [renderTarget],
        colorResolveTo: [null],
        colorClearColor: [TransparentWhite],
        colorStore: [true],
        depthStencilAttachment: null,
        depthStencilResolveTo: null,
      });

      renderPass.setPipeline(pipeline);
      renderPass.setBindings(bindings);
      renderPass.setVertexInput(
        inputLayout,
        [
          {
            buffer: vertexBuffer,
          },
        ],
        null,
      );
      if (device.queryVendorInfo().platformString !== 'WebGPU') {
        renderPass.setViewport(0, 0, width, height);
      }
      renderPass.draw(3);
      device.submitPass(renderPass);
      device.endFrame();
    };

    const rect = new Rect({
      x: 100,
      y: 50,
      width: 300,
      height: 300,
      fill: texture
    });
    canvas.appendChild(rect);

    render = () => {
      updateUniforms();
      renderToTexture();
      rect.fill = texture;
      rect.renderDirtyFlag = true;
    };

    render();
  });

  $canvas.addEventListener('ic-frame', (e) => {
    stats.update();

    render();
  });
});
</script>

<template>
  <div style="position: relative">
    <ic-canvas ref="wrapper" style="height: 400px"></ic-canvas>
  </div>
</template>

