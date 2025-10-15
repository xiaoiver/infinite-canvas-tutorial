<script setup>
import * as d3 from 'd3-color';
import { Rect } from '@infinite-canvas-tutorial/core';
import { Format, TextureUsage, BufferUsage, BufferFrequencyHint, VertexStepMode, TransparentWhite } from '@antv/g-device-api';
import { ref, computed, onMounted } from 'vue';

import { vert, frag } from './shaders/mesh-gradient';
import { paddingUniforms } from './utils';

let canvas;
let render;

const MAX_POINTS = 10;
const palettes = Array.from({ length: 4 }, () => [Math.random(), Math.random(), Math.random()]);
const positions = Array.from({ length: 4 }, () => [Math.random(), Math.random()]);

const wrapper = ref(null);
const u_NoiseRatio = ref(0.1);
const u_NoiseTime = ref(0);
const u_WarpSize = ref(0.5);
const u_WarpRatio = ref(0.8);
const u_GradientTypeIndex = ref(0);
const u_WarpShapeIndex = ref(0);
const u_BgColor = ref([Math.random(), Math.random(), Math.random()]);
const u_Colors = ref(palettes);
const u_Positions = ref(positions);
const u_PointsNum = ref(4);

const bgColor = computed(() => {
  return `rgba(${u_BgColor.value.map(color => color * 255).join(',')}, 1)`;
})

const handleGradientTypeChange = (value) => {
  u_GradientTypeIndex.value = Number(value);
  render();
};

const handleWarpShapeChange = (value) => {
  u_WarpShapeIndex.value = Number(value);
  render();
};

const handleBgColorChange = (e) => {
  const { r, g, b } = d3.rgb(e.target.getFormattedValue('rgba'));
  u_BgColor.value = [r / 255, g / 255, b / 255];
  render();
};

const handlePointColorChange = (index, e) => {
  const { r, g, b } = d3.rgb(e.target.getFormattedValue('rgba'));
  u_Colors.value[index] = [r / 255, g / 255, b / 255];
  render();
};

const addPoint = () => {
  if (u_Colors.value.length >= MAX_POINTS) return;

  u_Colors.value.push([Math.random(), Math.random(), Math.random()]);
  u_Positions.value.push([Math.random(), Math.random()]);
  render();
};

const removePoint = (index) => {
  if (u_Colors.value.length <= 1) return;

  u_Colors.value.splice(index, 1);
  u_Positions.value.splice(index, 1);
  render();
};

onMounted(() => {
  import('@infinite-canvas-tutorial/ui');

  const $canvas = wrapper.value;

  if (!$canvas) return;

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
      viewOrSize: 96 * Float32Array.BYTES_PER_ELEMENT,
      usage: BufferUsage.UNIFORM,
    });

    const updateUniforms = () => {
      const points = Array.from({ length: MAX_POINTS }, (_, index) => ({
        [`u_Points[${index}].color`]: u_Colors.value[index] || [0, 0, 0],
        [`u_Points[${index}].position`]: u_Positions.value[index] || [0, 0],
      })).reduce((acc, cur) => ({ ...acc, ...cur }), {});
      const uniforms = {
        ...points,
        u_BgColor: u_BgColor.value,
        u_PointsNum: u_PointsNum.value,
        u_NoiseRatio: u_NoiseRatio.value,
        u_NoiseTime: u_NoiseTime.value,
        u_WarpShapeIndex: u_WarpShapeIndex.value,
        u_WarpSize: u_WarpSize.value,
        u_WarpRatio: u_WarpRatio.value,
        u_GradientTypeIndex: u_GradientTypeIndex.value,
        u_Time: 0,
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
      fill: { texture }
    });
    canvas.appendChild(rect);

    render = () => {
      updateUniforms();
      renderToTexture();
      rect.renderDirtyFlag = true;
    };

    render();
  });
});
</script>

<style>
.small-details::part(header) {
  padding: 4px 8px;
}

.small-details::part(content) {
  padding: 4px;
}

sl-color-picker {
  height: 30px;
}

.label-on-left {
  --label-width: 3.75rem;
  --gap-width: 1rem;
}

.label-on-left::part(form-control) {
  display: grid;
  grid: auto / var(--label-width) 1fr;
  gap: var(--sl-spacing-3x-small) var(--gap-width);
  align-items: center;
}

.label-on-left::part(form-control-label) {
  text-align: right;
}

.label-on-left::part(form-control-help-text) {
  grid-column-start: 2;
}
</style>

<template>
  <div style="position: relative">
    <ic-canvas ref="wrapper" style="height: 400px"></ic-canvas>
    <div style="display: flex; flex-direction: row; gap: 10px;">
      <sl-select label="GradientType" size="small" :value="u_GradientTypeIndex.toString()"
        @sl-change="handleGradientTypeChange($event.target.value);">
        <sl-option value="0">Original</sl-option>
        <sl-option value="1">Bezier</sl-option>
        <sl-option value="2">Mesh</sl-option>
        <sl-option value="3">Enhanced Bezier</sl-option>
      </sl-select>
      <sl-select label="WarpShape" size="small" :value="u_WarpShapeIndex.toString()"
        @sl-change="handleWarpShapeChange($event.target.value);">
        <sl-option value="0">Snoise</sl-option>
        <sl-option value="1">Sine</sl-option>
        <sl-option value="2">ValueNoise</sl-option>
        <sl-option value="3">WorleyNoise</sl-option>
        <sl-option value="4">FBM</sl-option>
        <sl-option value="5">Voronoi</sl-option>
        <sl-option value="6">DomainWarp</sl-option>
        <sl-option value="7">WavesNoise</sl-option>
        <sl-option value="8">SmoothGradient</sl-option>
        <sl-option value="9">SphereNoise</sl-option>
        <sl-option value="10">RowsNoise</sl-option>
        <sl-option value="11">ColumnsNoise</sl-option>
        <sl-option value="12">FlatNoise</sl-option>
        <sl-option value="13">BlackHoleNoise</sl-option>
      </sl-select>
      <sl-input label="NoiseRatio" min="0" max="1" step="0.05" type="number" size="small" :value="u_NoiseRatio"
        @input="u_NoiseRatio = Number($event.target.value); render();" />
      <sl-input label="NoiseTime" min="0" max="1" step="0.05" type="number" size="small" :value="u_NoiseTime"
        @input="u_NoiseTime = Number($event.target.value); render();" />
      <sl-input label="WarpSize" min="0" max="1" step="0.05" type="number" size="small" :value="u_WarpSize"
        @input="u_WarpSize = Number($event.target.value); render();" />
      <sl-input label="WarpRatio" min="0" max="1" step="0.05" type="number" size="small" :value="u_WarpRatio"
        @input="u_WarpRatio = Number($event.target.value); render();" />
    </div>
    <div style="display: flex; align-items: center; flex-direction: row; gap: 10px; font-size: 14px;">
      <label for="bg-color">BackgroundColor</label>
      <sl-color-picker size="small" id="bg-color" :value="bgColor" @sl-input="handleBgColorChange" />
    </div>
    <sl-details class="small-details" summary="Points" open>
      <sl-icon-button name="plus-lg" label="Add point" @click="addPoint"></sl-icon-button>
      <ol style="margin: 0; padding: 0;">
        <li v-for="color, index in u_Colors" style="display: flex; align-items: center; gap: 10px;">
          <sl-icon-button name="dash-lg" label="Remove stop" @click="removePoint(index)"></sl-icon-button>
          <sl-color-picker size="small" :value="`rgba(${color.map(c => c * 255).join(',')}, 1)`"
            @sl-input="handlePointColorChange(index, $event)" />
          <div style="display: flex; align-items: center; flex-direction: row; gap: 10px; font-size: 14px;">
            <sl-input class="label-on-left" label="X" min="0" max="1" step="0.05" type="number" size="small"
              :value="u_Positions[index][0]" @input="u_Positions[index][0] = Number($event.target.value); render();" />
            <sl-input class="label-on-left" label="Y" min="0" max="1" step="0.05" type="number" size="small"
              :value="u_Positions[index][1]" @input="u_Positions[index][1] = Number($event.target.value); render();" />
          </div>
        </li>
      </ol>
    </sl-details>
  </div>
</template>
