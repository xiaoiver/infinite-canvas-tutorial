import {
  Bindings,
  Buffer,
  BufferUsage,
  ComputePass,
  ComputePipeline,
} from '@infinite-canvas-tutorial/device-api';
import { modulate } from '../../utils';
import { flattenParticleComputeWgsl } from './flattenParticleWgsl';
import { EcsGPUParticle } from './EcsGPUParticle';
import {
  DEFAULT_MESH_SAMPLE_COUNT,
  fibonacciSphereVec4,
  sampleMeshSurfaceUniform,
  type MeshTriangleSoup,
} from './meshSurfaceSample';

export interface EcsMeshParticleOptions {
  radius: number;
  sinea: number;
  sineb: number;
  speed: number;
  blur: number;
  samples: number;
  mode: number;
  /** 表面采样粒子数上限（≤ maxParticles） */
  targetSampleCount: number;
  maxParticles: number;
}

const RASTER_WG = 256;

/**
 * 三角网格表面均匀采样点 → 与 {@link EcsSineParticle} 相同原子缓冲管线，Rasterize 按粒子索引投射。
 */
export class EcsMeshParticle extends EcsGPUParticle {
  private options: EcsMeshParticleOptions;
  private customUniformBuffer!: Buffer;
  private storageBuffer!: Buffer;
  private meshPointsBuffer!: Buffer;
  private meshColorsBuffer!: Buffer;
  private meshUseVertexColor = false;
  private clearPipeline!: ComputePipeline;
  private rasterizePipeline!: ComputePipeline;
  private mainImagePipeline!: ComputePipeline;
  private clearBindings!: Bindings;
  private rasterizeBindings!: Bindings;
  private mainImageBindings!: Bindings;
  private meshParticleCount = 1;

  constructor(options: Partial<EcsMeshParticleOptions> = {}) {
    super();
    this.options = {
      radius: 6,
      sinea: 1,
      sineb: 1,
      speed: 0.885,
      blur: 0,
      samples: 0.001,
      mode: 0,
      targetSampleCount: DEFAULT_MESH_SAMPLE_COUNT,
      maxParticles: 65_536,
      ...options,
    };
  }

  getParticleCount(): number {
    return this.meshParticleCount;
  }

  /** 用已解析的三角网格更新粒子（CPU 面积加权采样） */
  setMeshSoup(soup: MeshTriangleSoup): void {
    const cap = Math.min(
      this.options.targetSampleCount,
      this.options.maxParticles,
    );
    const sampled = sampleMeshSurfaceUniform(soup, cap);
    this.uploadMeshSamples(
      sampled.positions,
      sampled.colors,
      sampled.hasVertexColor,
    );
  }

  /**
   * 上传粒子位置（vec4）与可选的每粒子 RGBA（顶点色采样结果）。
   */
  uploadMeshSamples(
    sampledVec4: Float32Array,
    sampledColors?: Float32Array,
    useVertexColor?: boolean,
  ): void {
    const maxP = this.options.maxParticles;
    const n = Math.min(maxP, Math.floor(sampledVec4.length / 4));
    if (n < 1) {
      this.meshParticleCount = 1;
      this.meshUseVertexColor = false;
      const one = new Float32Array(4);
      one[3] = 1;
      this.meshPointsBuffer.setSubData(0, new Uint8Array(one.buffer));
      const cw = new Float32Array(4);
      cw[0] = 1;
      cw[1] = 1;
      cw[2] = 1;
      cw[3] = 1;
      this.meshColorsBuffer.setSubData(0, new Uint8Array(cw.buffer));
      return;
    }
    this.meshParticleCount = n;
    this.meshPointsBuffer.setSubData(
      0,
      new Uint8Array(
        sampledVec4.buffer,
        sampledVec4.byteOffset,
        n * 4 * 4,
      ),
    );

    const vc = !!(useVertexColor && sampledColors && sampledColors.length >= n * 4);
    this.meshUseVertexColor = vc;
    if (vc) {
      this.meshColorsBuffer.setSubData(
        0,
        new Uint8Array(
          sampledColors.buffer,
          sampledColors.byteOffset,
          n * 4 * 4,
        ),
      );
    } else {
      const white = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        white[i * 4] = 1;
        white[i * 4 + 1] = 1;
        white[i * 4 + 2] = 1;
        white[i * 4 + 3] = 1;
      }
      this.meshColorsBuffer.setSubData(0, new Uint8Array(white.buffer));
    }
  }

  private destroyComputeOnly(): void {
    if (!this.customUniformBuffer) {
      return;
    }
    this.customUniformBuffer.destroy();
    this.storageBuffer.destroy();
    this.meshPointsBuffer.destroy();
    this.meshColorsBuffer.destroy();
    this.clearPipeline.destroy();
    this.rasterizePipeline.destroy();
    this.mainImagePipeline.destroy();
  }

  protected onAfterResize(): void {
    this.destroyComputeOnly();
    this.buildComputePipelines();
  }

  private buildComputePipelines(): void {
    const { device, screen, canvas } = this;
    const $canvas = canvas;
    const maxP = this.options.maxParticles;

    const custom = /* wgsl */ `
  #define_import_path custom
  
  struct Custom {
    Radius: f32,
    Sinea: f32,
    Sineb: f32,
    Speed: f32,
    Blur: f32,
    Samples: f32,
    Mode: f32,
    ParticleCount: f32,
    // x = vertex color flag; yzw unused
    Options: vec4<f32>,
  }
  @group(0) @binding(2) var<uniform> custom: Custom;
    `;

    const computeWgsl = /* wgsl */ `
  #import prelude::{screen, time, mouse};
  #import math::{PI, TWO_PI, nrand4, state};
  #import camera::{Camera, camera, GetCameraMatrix, Project};
  #import custom::{custom};
  
    @group(2) @binding(0) var<storage, read_write> atomic_storage : array<atomic<i32>>;
    @group(2) @binding(1) var<storage, read> mesh_points : array<vec4<f32>>;
    @group(2) @binding(2) var<storage, read> mesh_colors : array<vec4<f32>>;
  
    const MaxSamples = 64.0;
    const FOV = 1.2;
  
    const DEPTH_MIN = 0.2;
    const DEPTH_MAX = 5.0;
    const DEPTH_BITS = 16u;
  
    fn SetCamera(ang: float2, fov: float)
    {
        camera.fov = fov;
        camera.cam = GetCameraMatrix(ang);
        camera.pos = - (camera.cam*float3(3.0*custom.Radius+0.5,0.0,0.0));
        camera.size = float2(textureDimensions(screen));
    }
  
    @compute @workgroup_size(16, 16)
    fn Clear(@builtin(global_invocation_id) id: uint3) {
        let screen_size = int2(textureDimensions(screen));
        let idx0 = int(id.x) + int(screen_size.x * int(id.y));
  
        atomicStore(&atomic_storage[idx0*4+0], 0);
        atomicStore(&atomic_storage[idx0*4+1], 0);
        atomicStore(&atomic_storage[idx0*4+2], 0);
        atomicStore(&atomic_storage[idx0*4+3], 0);
    }
  
    fn Pack(a: uint, b: uint) -> int
    {
        return int(a + (b << (31u - DEPTH_BITS)));
    }
  
    fn Unpack(a: int) -> float
    {
        let mask = i32((1u << (DEPTH_BITS - 1u)) - 1u);
        return float(a & mask) / 256.0;
    }
  
    fn ClosestPoint(color: float3, depth: float, index: int)
    {
        let inverseDepth = 1.0/depth;
        let scaledDepth = (inverseDepth - 1.0/DEPTH_MAX)/(1.0/DEPTH_MIN - 1.0/DEPTH_MAX);
  
        if(scaledDepth > 1.0 || scaledDepth < 0.0)
        {
            return;
        }
  
        let uintDepth = uint(scaledDepth*float((1u << DEPTH_BITS) - 1u));
        let uintColor = uint3(color * 256.0);
  
        atomicMax(&atomic_storage[index*4+0], Pack(uintColor.x, uintDepth));
        atomicMax(&atomic_storage[index*4+1], Pack(uintColor.y, uintDepth));
        atomicMax(&atomic_storage[index*4+2], Pack(uintColor.z, uintDepth));
    }
  
    fn AdditiveBlend(color: float3, depth: float, index: int)
    {
        let scaledColor = 256.0 * color/depth;
  
        atomicAdd(&atomic_storage[index*4+0], int(scaledColor.x));
        atomicAdd(&atomic_storage[index*4+1], int(scaledColor.y));
        atomicAdd(&atomic_storage[index*4+2], int(scaledColor.z));
    }
  
    fn RasterizePoint(pos: float3, color: float3)
    {
        let screen_size = int2(camera.size);
        let projectedPos = Project(camera, pos);
        let screenCoord = int2(projectedPos.xy);
  
        if(screenCoord.x < 0 || screenCoord.x >= screen_size.x ||
            screenCoord.y < 0 || screenCoord.y >= screen_size.y || projectedPos.z < 0.0)
        {
            return;
        }
  
        let idx = screenCoord.x + screen_size.x * screenCoord.y;
  
        if(custom.Mode < 0.5)
        {
            AdditiveBlend(color, projectedPos.z, idx);
        }
        else
        {
            ClosestPoint(color, projectedPos.z, idx);
        }
    }
  
    @compute @workgroup_size(${RASTER_WG}, 1, 1)
    fn Rasterize(@builtin(global_invocation_id) id: uint3) {
        let pid = id.x;
        let pc = u32(max(0.0, floor(custom.ParticleCount + 0.5)));
        if (pc < 1u) { return; }
        if (pid >= pc) { return; }

        let screen_size = int2(textureDimensions(screen));
        let screen_size_f = float2(screen_size);
  
        let ang = float2(mouse.pos.xy)*float2(-TWO_PI, PI)/screen_size_f + float2(0.4, 0.4);
  
        SetCamera(ang, FOV);
  
        state = uint4(pid, 0u, 0u, 0u*time.frame);
  
        let base = mesh_points[pid].xyz;
        let sec = custom.Speed * time.elapsed;
        var pos = base * (0.9 + 0.08 * custom.Radius / 6.0);
        pos += sin(float3(2.0,1.0,1.5)*sec)*0.07*custom.Sinea*sin(12.0*base);
        pos += float3(0.0, 0.0, sin(sec)*0.04*custom.Sineb);
  
        var col: float3;
        if (custom.Options.x > 0.5) {
          let vc = mesh_colors[pid].xyz;
          let wobble = 0.92 + 0.08 * sin(sec * 2.1 + dot(base, float3(3.1, 2.7, 4.2)));
          col = clamp(vc * wobble, float3(0.05), float3(1.0));
        } else {
          col = float3(0.5 + 0.5*sin(7.0*base + float3(sec, sec*1.1, sec*0.9)));
          col = clamp(col * 1.25, float3(0.2), float3(1.0));
        }
        RasterizePoint(pos, col);
    }
  
  fn Sample(pos: int2) -> float3 {
    let screen_size = int2(textureDimensions(screen));
    let idx = pos.x + screen_size.x * pos.y;
    let denom = max(1.0, custom.ParticleCount);
  
    var color: float3;
    if (custom.Mode < 0.5) {
      let x = float(atomicLoad(&atomic_storage[idx*4+0]))/(256.0);
      let y = float(atomicLoad(&atomic_storage[idx*4+1]))/(256.0);
      let z = float(atomicLoad(&atomic_storage[idx*4+2]))/(256.0);
  
      let acc = float3(x,y,z);
      color = clamp(1.2 * tanh(0.22*acc/denom), float3(0.0), float3(1.0));
    } else {
      let x = Unpack(atomicLoad(&atomic_storage[idx*4+0]));
      let y = Unpack(atomicLoad(&atomic_storage[idx*4+1]));
      let z = Unpack(atomicLoad(&atomic_storage[idx*4+2]));
  
      color = float3(x,y,z);
    }
  
    return abs(color);
  }
  
  @compute @workgroup_size(16, 16)
  fn main_image(@builtin(global_invocation_id) id: uint3) {
    let screen_size = uint2(textureDimensions(screen));
  
    if (id.x >= screen_size.x || id.y >= screen_size.y) { return; }
  
    let color = float4(Sample(int2(id.xy)),1.0);
  
    textureStore(screen, int2(id.xy), color);
  }
  `;

    const flatWgsl = flattenParticleComputeWgsl(custom, computeWgsl);

    const clearProgram = device.createProgram({
      compute: { entryPoint: 'Clear', wgsl: flatWgsl },
    });
    const rasterizeProgram = device.createProgram({
      compute: { entryPoint: 'Rasterize', wgsl: flatWgsl },
    });
    const mainImageProgram = device.createProgram({
      compute: { entryPoint: 'main_image', wgsl: flatWgsl },
    });

    const customUniformBuffer = device.createBuffer({
      viewOrSize: 12 * Float32Array.BYTES_PER_ELEMENT,
      usage: BufferUsage.UNIFORM,
    });

    const storageBuffer = device.createBuffer({
      viewOrSize:
        $canvas.width * $canvas.height * 4 * Float32Array.BYTES_PER_ELEMENT,
      usage: BufferUsage.STORAGE,
    });

    const meshPointsBuffer = device.createBuffer({
      viewOrSize: maxP * 4 * Float32Array.BYTES_PER_ELEMENT,
      usage: BufferUsage.STORAGE,
    });
    const meshColorsBuffer = device.createBuffer({
      viewOrSize: maxP * 4 * Float32Array.BYTES_PER_ELEMENT,
      usage: BufferUsage.STORAGE,
    });

    const clearPipeline = device.createComputePipeline({
      inputLayout: null,
      program: clearProgram,
    });
    const rasterizePipeline = device.createComputePipeline({
      inputLayout: null,
      program: rasterizeProgram,
    });
    const mainImagePipeline = device.createComputePipeline({
      inputLayout: null,
      program: mainImageProgram,
    });

    const clearBindings = device.createBindings({
      pipeline: clearPipeline,
      storageBufferBindings: [{ buffer: storageBuffer }],
      storageTextureBindings: [{ texture: screen }],
    });
    const rasterizeBindings = device.createBindings({
      pipeline: rasterizePipeline,
      uniformBufferBindings: [
        { buffer: this.timeBuffer },
        { buffer: this.mouseBuffer },
        { buffer: customUniformBuffer },
      ],
      storageBufferBindings: [
        { buffer: storageBuffer },
        { buffer: meshPointsBuffer },
        { buffer: meshColorsBuffer },
      ],
      storageTextureBindings: [{ texture: screen }],
    });
    const mainImageBindings = device.createBindings({
      pipeline: mainImagePipeline,
      uniformBufferBindings: [{ binding: 2, buffer: customUniformBuffer }],
      storageBufferBindings: [{ buffer: storageBuffer }],
      storageTextureBindings: [{ texture: screen }],
    });

    this.customUniformBuffer = customUniformBuffer;
    this.storageBuffer = storageBuffer;
    this.meshPointsBuffer = meshPointsBuffer;
    this.meshColorsBuffer = meshColorsBuffer;
    this.clearPipeline = clearPipeline;
    this.clearBindings = clearBindings;
    this.rasterizePipeline = rasterizePipeline;
    this.rasterizeBindings = rasterizeBindings;
    this.mainImagePipeline = mainImagePipeline;
    this.mainImageBindings = mainImageBindings;

    const seedN = Math.min(4096, maxP);
    this.uploadMeshSamples(fibonacciSphereVec4(seedN));
  }

  registerShaderModule(): void {
    this.buildComputePipelines();
  }

  protected prepareCompute({
    overallAvg,
    upperAvgFr,
    lowerAvgFr,
  }: {
    overallAvg: number;
    upperAvgFr: number;
    lowerAvgFr: number;
    lowerMaxFr: number;
    upperMaxFr: number;
  }): void {
    const { options, customUniformBuffer } = this;
    const u8 = new Uint8Array(12 * Float32Array.BYTES_PER_ELEMENT);
    const f32 = new Float32Array(u8.buffer, 0, 12);
    f32[0] = (modulate(overallAvg, 0, 1, 0.5, 4) / 4000) * options.radius;
    f32[1] = (modulate(upperAvgFr, 0, 1, 0.5, 4) / 3) * options.sinea;
    f32[2] = (modulate(lowerAvgFr, 0, 1, 0.5, 4) / 3) * options.sineb;
    f32[3] = options.speed;
    f32[4] = options.blur;
    f32[5] = options.samples;
    f32[6] = options.mode;
    f32[7] = this.meshParticleCount;
    f32[8] = this.meshUseVertexColor ? 1 : 0;
    f32[9] = 0;
    f32[10] = 0;
    f32[11] = 0;
    customUniformBuffer.setSubData(0, u8);
  }

  protected encodeComputePasses(computePass: ComputePass): void {
    const {
      canvas,
      clearPipeline,
      clearBindings,
      rasterizePipeline,
      rasterizeBindings,
      mainImagePipeline,
      mainImageBindings,
    } = this;
    const $canvas = canvas;

    const x = Math.ceil($canvas.width / 16);
    const y = Math.ceil($canvas.height / 16);

    computePass.setPipeline(clearPipeline);
    computePass.setBindings(clearBindings);
    computePass.dispatchWorkgroups(x, y);

    computePass.setPipeline(rasterizePipeline);
    computePass.setBindings(rasterizeBindings);
    const rg = Math.ceil(this.meshParticleCount / RASTER_WG);
    computePass.dispatchWorkgroups(rg, 1, 1);

    computePass.setPipeline(mainImagePipeline);
    computePass.setBindings(mainImageBindings);
    computePass.dispatchWorkgroups(x, y);
  }

  update(options: Partial<EcsMeshParticleOptions>) {
    this.options = { ...this.options, ...options };
  }

  destroy(): void {
    this.destroyComputeOnly();
    super.destroy();
  }
}
