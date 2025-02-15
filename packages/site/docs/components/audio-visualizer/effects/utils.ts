import {
  AddressMode,
  Device,
  FilterMode,
  Format,
  MipmapFilterMode,
  ProgramDescriptor,
  Texture,
} from '@antv/g-device-api';

export const alias = /* wgsl */ `
    alias int = i32;
    alias uint = u32;
    alias float = f32;
    alias int2 = vec2<i32>;
    alias int3 = vec3<i32>;
    alias int4 = vec4<i32>;
    alias uint2 = vec2<u32>;
    alias uint3 = vec3<u32>;
    alias uint4 = vec4<u32>;
    alias float2 = vec2<f32>;
    alias float3 = vec3<f32>;
    alias float4 = vec4<f32>;
    alias bool2 = vec2<bool>;
    alias bool3 = vec3<bool>;
    alias bool4 = vec4<bool>;
    alias float2x2 = mat2x2<f32>;
    alias float2x3 = mat2x3<f32>;
    alias float2x4 = mat2x4<f32>;
    alias float3x2 = mat3x2<f32>;
    alias float3x3 = mat3x3<f32>;
    alias float3x4 = mat3x4<f32>;
    alias float4x2 = mat4x2<f32>;
    alias float4x3 = mat4x3<f32>;
    alias float4x4 = mat4x4<f32>;
    `;

/**
 * Use naga-oil to combine and manipulate shaders.
 * The order is important.
 */
export function registerShaderModule(device: Device, shader: string): string {
  const compiler = device['WGSLComposer'];
  return compiler.wgsl_compile(alias + shader);
}

export function defineStr(k: string, v: string): string {
  return `#define ${k} ${v}`;
}

export function createProgram(
  device: Device,
  desc: ProgramDescriptor,
  defines?: Record<string, boolean | number>,
) {
  const compiler = device['WGSLComposer'];

  // Prepend defines.
  const prefix =
    Object.keys(defines || {})
      .map((key) => {
        return defineStr(key, '');
      })
      .join('\n') + '\n';

  Object.keys(desc).forEach((key) => {
    desc[key].wgsl = alias + desc[key].wgsl;

    if (desc[key].defines) {
      desc[key].wgsl = prefix + desc[key].wgsl;
    }
    // Use naga-oil to combine shaders.
    desc[key].wgsl = compiler.wgsl_compile(desc[key].wgsl);
  });

  return device.createProgram(desc);
}

/**
 * @see https://github.com/compute-toys/wgpu-compute-toy/blob/master/src/lib.rs#L367
 * @see https://github.com/compute-toys/wgpu-compute-toy/blob/master/src/bind.rs#L437
 */
export const prelude = /* wgsl */ `
    #define_import_path prelude
    
    struct Time {
      frame: u32,
      elapsed : f32
    }
  
    struct Mouse { 
      pos: uint2, 
      click: int
    }
    
    @group(0) @binding(0) var<uniform> time : Time;
    @group(0) @binding(1) var<uniform> mouse: Mouse;
    @group(1) @binding(0) var pass_in: texture_2d_array<f32>;
    @group(1) @binding(1) var bilinear: sampler;
    @group(3) @binding(0) var screen : texture_storage_2d<rgba16float, write>;
    @group(3) @binding(1) var pass_out: texture_storage_2d_array<rgba16float,write>;
    
    fn passStore(pass_index: int, coord: int2, value: float4) {
      textureStore(pass_out, coord, pass_index, value);
    }
    
    fn passLoad(pass_index: int, coord: int2, lod: int) -> float4 {
      return textureLoad(pass_in, coord, pass_index, lod);
    }
    
    fn passSampleLevelBilinearRepeat(pass_index: int, uv: float2, lod: float) -> float4 {
      return textureSampleLevel(pass_in, bilinear, fract(uv), pass_index, lod);
    }
    `;

/**
 * https://github.com/compute-toys/wgpu-compute-toy/blob/master/src/blit.wgsl
 */
export function createBlitPipelineAndBindings(device: Device, screen: Texture) {
  const sampler = device.createSampler({
    addressModeU: AddressMode.CLAMP_TO_EDGE,
    addressModeV: AddressMode.CLAMP_TO_EDGE,
    minFilter: FilterMode.BILINEAR,
    magFilter: FilterMode.BILINEAR,
    mipmapFilter: MipmapFilterMode.LINEAR,
  });

  const renderProgram = device.createProgram({
    vertex: {
      entryPoint: 'fullscreen_vertex_shader',
      wgsl: /* wgsl */ `
    struct FullscreenVertexOutput {
      @builtin(position)
      position: vec4<f32>,
      @location(0)
      uv: vec2<f32>,
    };
    
    // This vertex shader produces the following, when drawn using indices 0..3:
    //
    //  1 |  0-----x.....2
    //  0 |  |  s  |  . ´
    // -1 |  x_____x´
    // -2 |  :  .´
    // -3 |  1´
    //    +---------------
    //      -1  0  1  2  3
    //
    // The axes are clip-space x and y. The region marked s is the visible region.
    // The digits in the corners of the right-angled triangle are the vertex
    // indices.
    //
    // The top-left has UV 0,0, the bottom-left has 0,2, and the top-right has 2,0.
    // This means that the UV gets interpolated to 1,1 at the bottom-right corner
    // of the clip-space rectangle that is at 1,-1 in clip space.
    @vertex
    fn fullscreen_vertex_shader(@builtin(vertex_index) vertex_index: u32) -> FullscreenVertexOutput {
      // See the explanation above for how this works
      let uv = vec2<f32>(f32(vertex_index >> 1u), f32(vertex_index & 1u)) * 2.0;
      let clip_position = vec4<f32>(uv * vec2<f32>(2.0, -2.0) + vec2<f32>(-1.0, 1.0), 0.0, 1.0);
    
      return FullscreenVertexOutput(clip_position, uv);
    }
    `,
    },
    fragment: {
      entryPoint: 'fs_main_linear_to_srgb',
      wgsl: /* wgsl */ `
    struct FullscreenVertexOutput {
      @builtin(position)
      position: vec4<f32>,
      @location(0)
      uv: vec2<f32>,
    };
    
    @group(1) @binding(0) var in_texture : texture_2d<f32>;
    @group(1) @binding(1) var in_sampler : sampler;
    
    fn srgb_to_linear(rgb: vec3<f32>) -> vec3<f32> {
      return select(
          pow((rgb + 0.055) * (1.0 / 1.055), vec3<f32>(2.4)),
          rgb * (1.0/12.92),
          rgb <= vec3<f32>(0.04045));
    }
    
    fn linear_to_srgb(rgb: vec3<f32>) -> vec3<f32> {
      return select(
          1.055 * pow(rgb, vec3(1.0 / 2.4)) - 0.055,
          rgb * 12.92,
          rgb <= vec3<f32>(0.0031308));
    }
        
    @fragment
    fn fs_main(in: FullscreenVertexOutput) -> @location(0) vec4<f32> {
        return textureSample(in_texture, in_sampler, in.uv);
    }
    
    @fragment
    fn fs_main_linear_to_srgb(in: FullscreenVertexOutput) -> @location(0) vec4<f32> {
        let rgba = textureSample(in_texture, in_sampler, in.uv);
        return vec4<f32>(linear_to_srgb(rgba.rgb), rgba.a);
    }
    
    @fragment
    fn fs_main_rgbe_to_linear(in: FullscreenVertexOutput) -> @location(0) vec4<f32> {
        let rgbe = textureSample(in_texture, in_sampler, in.uv);
        return vec4<f32>(rgbe.rgb * exp2(rgbe.a * 255. - 128.), 1.);
    }
    `,
    },
  });

  const renderPipeline = device.createRenderPipeline({
    inputLayout: null,
    program: renderProgram,
    colorAttachmentFormats: [Format.U8_RGBA_RT],
  });
  const showResultBindings = device.createBindings({
    pipeline: renderPipeline,
    samplerBindings: [
      {
        texture: screen, // Binding = 0
        sampler, // Binding = 1
      },
    ],
  });

  return {
    pipeline: renderPipeline,
    bindings: showResultBindings,
  };
}

export const math = /* wgsl */ `
  #define_import_path math
  
  const PI = 3.14159265;
  const TWO_PI = 6.28318530718;
  
  var<private> state : uint4;
  
  fn pcg4d(a: uint4) -> uint4 {
    var v = a * 1664525u + 1013904223u;
    v.x += v.y*v.w; v.y += v.z*v.x; v.z += v.x*v.y; v.w += v.y*v.z;
    v = v ^  ( v >> uint4(16u) );
    v.x += v.y*v.w; v.y += v.z*v.x; v.z += v.x*v.y; v.w += v.y*v.z;
    return v;
  }
  
  fn rand4() -> float4 {
    state = pcg4d(state);
    return float4(state)/float(0xffffffffu); 
  }
  
  fn nrand4(sigma: float, mean: float4) -> float4 {
    let Z = rand4();
    return mean + sigma * sqrt(-2.0 * log(Z.xxyy)) * 
            float4(cos(TWO_PI * Z.z),sin(TWO_PI * Z.z),cos(TWO_PI * Z.w),sin(TWO_PI * Z.w));
  }
  
  fn disk(r: float2) -> float2 {
    return vec2(sin(TWO_PI*r.x), cos(TWO_PI*r.x))*(r.y);
  }
  
  fn sqr(x: float) -> float {
    return x*x;
  }
  
  fn diag(a: float4) -> float4x4 {
    return float4x4(
        a.x,0.0,0.0,0.0,
        0.0,a.y,0.0,0.0,
        0.0,0.0,a.z,0.0,
        0.0,0.0,0.0,a.w
    );
  }
  
  fn rand4s(seed: uint4) -> float4 { 
    return float4(pcg4d(seed))/float(0xffffffffu); 
  }
    `;

export const camera = /* wgsl */ `
  #define_import_path camera
  
  struct Camera {
    pos: float3,
    cam: float3x3,
    fov: float,
    size: float2
  }
  
  var<private> camera : Camera;
  
  fn GetCameraMatrix(ang: float2) -> float3x3 {
    let x_dir = float3(cos(ang.x)*sin(ang.y), cos(ang.y), sin(ang.x)*sin(ang.y));
    let y_dir = normalize(cross(x_dir, float3(0.0,1.0,0.0)));
    let z_dir = normalize(cross(y_dir, x_dir));
    return float3x3(-x_dir, y_dir, z_dir);
  }
  
  //project to clip space
  fn Project(cam: Camera, p: float3) -> float3 {
    let td = distance(cam.pos, p);
    let dir = (p - cam.pos)/td;
    let screen = dir*cam.cam;
    return float3(screen.yz*cam.size.y/(cam.fov*screen.x) + 0.5*cam.size,screen.x*td);
  }
  `;

export const particle = /* wgsl */ `
  #define_import_path particle
  
  #import prelude::{pass_in, pass_out};
  #import camera::{Project, camera};
  
  struct Particle {
    position: float4,
    velocity: float4,
  }
  
  @group(2) @binding(0) var<storage, read_write> atomic_storage : array<atomic<i32>>;
  
  fn AdditiveBlend(color: float3, depth: float, index: int) {
    let scaledColor = 256.0 * color/depth;
  
    atomicAdd(&atomic_storage[index*4+0], int(scaledColor.x));
    atomicAdd(&atomic_storage[index*4+1], int(scaledColor.y));
    atomicAdd(&atomic_storage[index*4+2], int(scaledColor.z));
  }
  
  fn RasterizePoint(pos: float3, color: float3) {
    let screen_size = int2(camera.size);
    let projectedPos = Project(camera, pos);
    let screenCoord = int2(projectedPos.xy);
    
    //outside of our view
    if (screenCoord.x < 0 || screenCoord.x >= screen_size.x || 
        screenCoord.y < 0 || screenCoord.y >= screen_size.y || projectedPos.z < 0.0)
    {
        return;
    }
  
    let idx = screenCoord.x + screen_size.x * screenCoord.y;
    
    AdditiveBlend(color, projectedPos.z, idx);
  }
    
  fn LoadParticle(pix: int2) -> Particle {
    var p: Particle;
    p.position = textureLoad(pass_in, pix, 0, 0); 
    p.velocity = textureLoad(pass_in, pix, 1, 0);
    return p;
  }
  
  fn SaveParticle(pix: int2, p: Particle) {
    textureStore(pass_out, pix, 0, p.position); 
    textureStore(pass_out, pix, 1, p.velocity); 
  }
    `;
