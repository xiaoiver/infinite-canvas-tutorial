<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { PLYLoader } from '@loaders.gl/ply';
import { load } from '@loaders.gl/core';
import { mat4 } from 'gl-matrix';

const wrapper = ref < HTMLCanvasElement | null > (null);
const button = ref < HTMLButtonElement | null > (null);

// ====== WebGPU setup ======
function normalizePositions(positions: Float32Array) {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  const centerX = (minX + maxX) * 0.5;
  const centerY = (minY + maxY) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;

  const extentX = maxX - minX;
  const extentY = maxY - minY;
  const extentZ = maxZ - minZ;
  const maxExtent = Math.max(extentX, extentY, extentZ) || 1;
  const scale = 2 / maxExtent;

  const normalized = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    normalized[i] = (positions[i] - centerX) * scale;
    normalized[i + 1] = (positions[i + 1] - centerY) * scale;
    normalized[i + 2] = (positions[i + 2] - centerZ) * scale;
  }

  return normalized;
}

async function initWebGPU(canvas: HTMLCanvasElement, positions: Float32Array, analyser: AnalyserNode) {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'premultiplied' });

  const normalizedPositions = normalizePositions(positions);
  const vertexCount = normalizedPositions.length / 3;

  // Vertex buffer
  const positionBuffer = device.createBuffer({
    size: normalizedPositions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(positionBuffer.getMappedRange()).set(normalizedPositions);
  positionBuffer.unmap();

  // Uniform buffer for frequency magnitude (1 float)
  const uniformBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Shaders
  const shaderCode = `
      struct Uniforms { freq: f32 };
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;

      @vertex
      fn vs_main(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
        let scale = 1.0 + uniforms.freq * 0.003;
        return vec4(position * scale, 1.0);
      }

      @fragment
      fn fs_main() -> @location(0) vec4<f32> {
        return vec4(0.9, 0.7, 1.0, 1.0);
      }
    `;

  const shaderModule = device.createShaderModule({ code: shaderCode });

  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: 12,
        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }]
      }],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{ format }],
    },
    primitive: { topology: 'point-list' },
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  // Audio-driven render loop
  const freqData = new Uint8Array(analyser.frequencyBinCount);

  function frame() {
    analyser.getByteFrequencyData(freqData);
    const avg = freqData.reduce((a, b) => a + b, 0) / freqData.length / 255.0;
    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([avg]));

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, positionBuffer);
    pass.draw(vertexCount);
    pass.end();
    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }
  frame();
}

onMounted(() => {
  // ====== Button click to start ======
  if (!button.value || !wrapper.value) return;

  button.value.addEventListener('click', async () => {

    // Initialize audio
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audio = new Audio('/music.mp3'); // <-- change your file path
    audio.crossOrigin = "anonymous";
    audio.loop = true;
    await audio.play(); // ✅ Now it's allowed (inside user click)
    const src = audioCtx.createMediaElementSource(audio);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    analyser.connect(audioCtx.destination);

    // Load PLY point cloud
    const data = await load('https://threejs.org/examples/models/ply/ascii/dolphins.ply', PLYLoader);
    const canvas = wrapper.value;
    initWebGPU(canvas, data.attributes['POSITION'].value as Float32Array, analyser);
  });
});
</script>

<template>
  <button ref="button">Start</button>
  <canvas ref="wrapper" width="800" height="800" style="width: 400px; height: 400px; border: 1px solid #000;"></canvas>
</template>