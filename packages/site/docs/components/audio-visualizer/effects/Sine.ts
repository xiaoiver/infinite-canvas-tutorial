import {
  Bindings,
  Buffer,
  BufferUsage,
  ComputePipeline,
} from '@antv/g-device-api';
import { createProgram, registerShaderModule } from './utils';
import { modulate } from '../utils';
import { GPUParticle } from './GPUParticle';

export interface SineOptions {
  radius: number;
  sinea: number;
  sineb: number;
  speed: number;
  blur: number;
  samples: number;
  mode: number;
}

/**
 * @see https://compute.toys/view/21
 */
export class Sine extends GPUParticle {
  private options: SineOptions;
  private customUniformBuffer: Buffer;
  private clearPipeline: ComputePipeline;
  private clearBindings: Bindings;
  private rasterizePipeline: ComputePipeline;
  private rasterizeBindings: Bindings;
  private mainImagePipeline: ComputePipeline;
  private mainImageBindings: Bindings;

  constructor(options: Partial<SineOptions> = {}) {
    super();

    this.options = {
      radius: 6,
      sinea: 1,
      sineb: 1,
      speed: 0.885,
      blur: 0,
      samples: 0.001,
      mode: 0,
      ...options,
    };
  }

  registerShaderModule() {
    const { device, screen, canvas } = this;
    const $canvas = canvas.getDOM() as HTMLCanvasElement;
    const custom = /* wgsl */ `
  #define_import_path custom
  
  struct Custom {
    Radius: f32,
    Sinea: f32,
    Sineb: f32,
    Speed: f32,
    Blur: f32,
    Samples: f32,
    Mode: f32
  }
  @group(0) @binding(2) var<uniform> custom: Custom;
    `;
    registerShaderModule(device, custom);

    const computeWgsl = /* wgsl */ `
  #import prelude::{screen, time, mouse};
  #import math::{PI, TWO_PI, nrand4, state};
  #import camera::{Camera, camera, GetCameraMatrix, Project};
  #import custom::{custom};
  
    @group(2) @binding(0) var<storage, read_write> atomic_storage : array<atomic<i32>>;
  
    //Check Uniforms
    //Mode 0 - additive blending (atomicAdd)
    //Mode 1 - closest sample (atomicMax)
  
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
        let mask = (1 << (DEPTH_BITS - 1u)) - 1;
        return float(a & mask)/256.0;
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
  
        //outside of our view
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
  
    @compute @workgroup_size(16, 16)
    fn Rasterize(@builtin(global_invocation_id) id: uint3) {
        // Viewport resolution (in pixels)
        let screen_size = int2(textureDimensions(screen));
        let screen_size_f = float2(screen_size);
  
        let ang = float2(mouse.pos.xy)*float2(-TWO_PI, PI)/screen_size_f + float2(0.4, 0.4);
  
        SetCamera(ang, FOV);
  
        //RNG state
        state = uint4(id.x, id.y, id.z, 0u*time.frame);
  
        for(var i: i32 = 0; i < int(custom.Samples*MaxSamples + 1.0); i++)
        {
            let rand = nrand4(1.0, float4(0.0));
            var pos = 0.2*rand.xyz;
            let col = float3(0.5 + 0.5*sin(10.0*pos));
  
            let sec = 5.0+custom.Speed*time.elapsed;
            //move points along sines
            pos += sin(float3(2.0,1.0,1.5)*sec)*0.1*sin(30.0*custom.Sinea*pos);
            pos += sin(float3(2.0,1.0,1.5)*sec)*0.02*sin(30.0*custom.Sineb*pos.zxy);
  
            RasterizePoint(pos, col);
        }
    }
  
  fn Sample(pos: int2) -> float3 {
    let screen_size = int2(textureDimensions(screen));
    let idx = pos.x + screen_size.x * pos.y;
  
    var color: float3;
    if (custom.Mode < 0.5) {
      let x = float(atomicLoad(&atomic_storage[idx*4+0]))/(256.0);
      let y = float(atomicLoad(&atomic_storage[idx*4+1]))/(256.0);
      let z = float(atomicLoad(&atomic_storage[idx*4+2]))/(256.0);
  
      color = tanh(0.1*float3(x,y,z)/(custom.Samples*MaxSamples + 1.0));
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
  
    // Prevent overdraw for workgroups on the edge of the viewport
    if (id.x >= screen_size.x || id.y >= screen_size.y) { return; }
  
    let color = float4(Sample(int2(id.xy)),1.0);
  
    // Output to screen (linear colour space)
    textureStore(screen, int2(id.xy), color);
  }
  `;

    const clearProgram = createProgram(device, {
      compute: {
        entryPoint: 'Clear',
        wgsl: computeWgsl,
      },
    });
    const rasterizeProgram = createProgram(device, {
      compute: {
        entryPoint: 'Rasterize',
        wgsl: computeWgsl,
      },
    });
    const mainImageProgram = createProgram(device, {
      compute: {
        entryPoint: 'main_image',
        wgsl: computeWgsl,
      },
    });

    const customUniformBuffer = device.createBuffer({
      viewOrSize: 7 * Float32Array.BYTES_PER_ELEMENT,
      usage: BufferUsage.UNIFORM,
    });

    const storageBuffer = device.createBuffer({
      viewOrSize:
        $canvas.width * $canvas.height * 4 * Float32Array.BYTES_PER_ELEMENT,
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
      storageBufferBindings: [
        {
          buffer: storageBuffer,
        },
      ],
      storageTextureBindings: [
        {
          texture: screen,
        },
      ],
    });
    const rasterizeBindings = device.createBindings({
      pipeline: rasterizePipeline,
      uniformBufferBindings: [
        {
          buffer: this.timeBuffer,
        },
        {
          buffer: this.mouseBuffer,
        },
        {
          buffer: customUniformBuffer,
        },
      ],
      storageBufferBindings: [
        {
          buffer: storageBuffer,
        },
      ],
      storageTextureBindings: [
        {
          texture: screen,
        },
      ],
    });
    const mainImageBindings = device.createBindings({
      pipeline: mainImagePipeline,
      uniformBufferBindings: [
        {
          binding: 2,
          buffer: customUniformBuffer,
        },
      ],
      storageBufferBindings: [
        {
          buffer: storageBuffer,
        },
      ],
      storageTextureBindings: [
        {
          texture: screen,
        },
      ],
    });

    this.customUniformBuffer = customUniformBuffer;
    this.clearPipeline = clearPipeline;
    this.clearBindings = clearBindings;
    this.rasterizePipeline = rasterizePipeline;
    this.rasterizeBindings = rasterizeBindings;
    this.mainImagePipeline = mainImagePipeline;
    this.mainImageBindings = mainImageBindings;
  }

  compute({ overallAvg, upperAvgFr, lowerAvgFr }) {
    const {
      options,
      customUniformBuffer,
      device,
      canvas,
      clearPipeline,
      clearBindings,
      rasterizePipeline,
      rasterizeBindings,
      mainImagePipeline,
      mainImageBindings,
    } = this;
    const $canvas = canvas.getDOM() as HTMLCanvasElement;

    customUniformBuffer.setSubData(
      0,
      new Uint8Array(
        new Float32Array([
          (modulate(overallAvg, 0, 1, 0.5, 4) / 4000) * options.radius,
          (modulate(upperAvgFr, 0, 1, 0.5, 4) / 3) * options.sinea,
          (modulate(lowerAvgFr, 0, 1, 0.5, 4) / 3) * options.sineb,
          options.speed,
          options.blur,
          options.samples,
          options.mode,
        ]).buffer,
      ),
    );

    const x = Math.ceil($canvas.width / 16);
    const y = Math.ceil($canvas.height / 16);

    const computePass = device.createComputePass();
    computePass.setPipeline(clearPipeline);
    computePass.setBindings(clearBindings);
    computePass.dispatchWorkgroups(x, y);

    computePass.setPipeline(rasterizePipeline);
    computePass.setBindings(rasterizeBindings);
    computePass.dispatchWorkgroups(x, y);

    computePass.setPipeline(mainImagePipeline);
    computePass.setBindings(mainImageBindings);
    computePass.dispatchWorkgroups(x, y);
    device.submitPass(computePass);
  }

  update(options: Partial<SineOptions>) {
    this.options = {
      ...this.options,
      ...options,
    };
  }

  destroy(): void {
    this.customUniformBuffer.destroy();
    this.clearPipeline.destroy();
    this.rasterizePipeline.destroy();
    this.mainImagePipeline.destroy();

    super.destroy();
  }
}
