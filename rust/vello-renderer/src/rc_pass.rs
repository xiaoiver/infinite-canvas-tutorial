//! Screen-space GI: analytic SDF + Bevy-style ping-pong radiance cascades (probe grid + spatial merge).
//! See <https://github.com/nixonyh/bevy_radiance_cascades>. WASM: Rect/Ellipse fills + Line / Polyline stroke (segment SDF).

use bytemuck::{Pod, Zeroable};
use vello::kurbo::Affine;
#[cfg(target_arch = "wasm32")]
use vello::kurbo::Point;
use vello::wgpu::{
    BindGroupDescriptor, BindGroupEntry, BindGroupLayout, BindGroupLayoutDescriptor,
    BindGroupLayoutEntry, BindingResource, BindingType, Buffer, BufferBinding, BufferBindingType,
    BufferDescriptor, BufferUsages,
    ColorTargetState, ColorWrites, CommandEncoder, ComputePassDescriptor, ComputePipeline,
    ComputePipelineDescriptor, Device, Extent3d, FilterMode, FragmentState, FrontFace,
    MipmapFilterMode, MultisampleState, Operations, PipelineCompilationOptions, PipelineLayoutDescriptor,
    PrimitiveState, Queue, RenderPassColorAttachment, RenderPassDescriptor, RenderPipeline,
    RenderPipelineDescriptor, Sampler, SamplerBindingType, SamplerDescriptor, ShaderModuleDescriptor,
    ShaderSource, StorageTextureAccess, Texture, TextureDescriptor, TextureDimension, TextureFormat,
    TextureSampleType, TextureUsages, TextureView, TextureViewDimension, VertexState,
};

use std::num::NonZeroU64;

use crate::grid_pass::pixel_from_ndc_matrix;
use crate::rc_cascade_math::{
    cascade_count_for_gi_size, probe_for_cascade, Probe, RC_INTERVAL0, RC_MAX_CASCADES,
    RC_RESOLUTION_FACTOR,
};
#[cfg(target_arch = "wasm32")]
use crate::renderer::device_pixel_ratio;
#[cfg(target_arch = "wasm32")]
use crate::sdf_primitives::{fill_sdf_primitive_from_js_shape, FillSdfPrimitive};
use crate::types::CanvasRenderOptions;
#[cfg(target_arch = "wasm32")]
use crate::types::JsShape;

pub const MAX_RC_PRIMITIVES: usize = 64;

#[repr(C)]
#[derive(Clone, Copy, Default, Pod, Zeroable)]
pub struct GpuRcPrim {
    pub inv: [f32; 6],
    pub kind: u32,
    pub _pad: u32,
    pub p0: [f32; 4],
    pub p1: [f32; 4],
}

const WGSL: &str = r#"
struct GpuRcPrim {
  inv: array<f32, 6>,
  kind: u32,
  _pad: u32,
  p0: vec4<f32>,
  p1: vec4<f32>,
}

struct DistHeader {
  screen: vec4<f32>,
  col0: vec4<f32>,
  col1: vec4<f32>,
  col2: vec4<f32>,
  count: u32,
  _p0: u32,
  _p1: u32,
  _p2: u32,
}

@group(0) @binding(0) var<uniform> header: DistHeader;
@group(0) @binding(1) var<storage, read> prims: array<GpuRcPrim>;

struct VsOut {
  @builtin(position) clip_pos: vec4<f32>,
  @location(0) ndc: vec2<f32>,
}

@vertex
fn dist_vs(@builtin(vertex_index) vi: u32) -> VsOut {
  var tri = array<vec2<f32>, 3>(
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0),
    vec2(-1.0, 3.0)
  );
  let p = tri[vi];
  var o: VsOut;
  o.clip_pos = vec4(p, 0.0, 1.0);
  o.ndc = p;
  return o;
}

fn sdf_ellipse(p: vec2<f32>, rx: f32, ry: f32) -> f32 {
  if rx < 1e-8 || ry < 1e-8 { return 1e9; }
  let k0 = length(p / vec2(rx, ry));
  let k1 = length(p / vec2(rx * rx, ry * ry));
  if k1 < 1e-18 { return -min(rx, ry); }
  return k0 * (k0 - 1.0) / k1;
}

fn sdf_rounded_box(p: vec2<f32>, b: vec2<f32>, r: f32) -> f32 {
  let hw = abs(b.x);
  let hh = abs(b.y);
  let rr = min(r, min(hw, hh));
  let q = abs(p) - vec2(hw, hh) + rr;
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - rr;
}

fn apply_inv(p: vec2<f32>, m: array<f32, 6>) -> vec2<f32> {
  return vec2(
    m[0] * p.x + m[2] * p.y + m[4],
    m[1] * p.x + m[3] * p.y + m[5]
  );
}

// IQ sdSegment：到线段 a–b 的无符号距离
fn sdf_segment_unsigned(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let ba_len_sq = dot(ba, ba);
  if ba_len_sq < 1e-18 {
    return length(pa);
  }
  let h = clamp(dot(pa, ba) / ba_len_sq, 0.0, 1.0);
  return length(pa - ba * h);
}

fn sdf_prim(p_canvas: vec2<f32>, prim: GpuRcPrim) -> f32 {
  let pl = apply_inv(p_canvas, prim.inv);
  if prim.kind == 0u {
    return sdf_ellipse(pl - vec2(prim.p0.x, prim.p0.y), prim.p0.z, prim.p0.w);
  }
  if prim.kind == 2u {
    let a = prim.p0.xy;
    let b = prim.p0.zw;
    let hw = prim.p1.x;
    return sdf_segment_unsigned(pl, a, b) - hw;
  }
  let x0 = prim.p0.x;
  let y0 = prim.p0.y;
  let x1 = prim.p0.z;
  let y1 = prim.p0.w;
  let cr = prim.p1.x;
  let cx = 0.5 * (x0 + x1);
  let cy = 0.5 * (y0 + y1);
  let hw = 0.5 * abs(x1 - x0);
  let hh = 0.5 * abs(y1 - y0);
  return sdf_rounded_box(pl - vec2(cx, cy), vec2(hw, hh), cr);
}

@fragment
fn dist_fs(i: VsOut) -> @location(0) vec4<f32> {
  let cx = i.ndc.x;
  let cy = i.ndc.y;
  let p_canvas = vec2(
    header.col0.x * cx + header.col1.x * cy + header.col2.x,
    header.col0.y * cx + header.col1.y * cy + header.col2.y,
  );
  var d = 1e6;
  let n = header.count;
  for (var i = 0u; i < 64u; i = i + 1u) {
    if i >= n { break; }
    d = min(d, sdf_prim(p_canvas, prims[i]));
  }
  // `d` 为并集 SDF：形内 <0、形外 >0、边界 =0。R 存 max(d,0)：形内与边界上均为 0，仅形外为到边界的正距离。
  return vec4(max(d, 0.0), 0.0, 0.0, 1.0);
}

struct GiBlendUniforms {
  // x = gi_strength；其余未使用（对齐 16B）
  params: vec4<f32>,
}

@group(0) @binding(0) var<uniform> gb: GiBlendUniforms;
@group(0) @binding(1) var t_base: texture_2d<f32>;
// `vello + radiance`（与 Bevy radiance_cascades_apply 输出一致）
@group(0) @binding(2) var t_gi: texture_2d<f32>;
@group(0) @binding(3) var t_vello: texture_2d<f32>;
@group(0) @binding(4) var samp_base: sampler;
@group(0) @binding(5) var samp_gi: sampler;

@vertex
fn gb_vs(@builtin(vertex_index) vi: u32) -> VsOut {
  var tri = array<vec2<f32>, 3>(
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0),
    vec2(-1.0, 3.0)
  );
  let p = tri[vi];
  var o: VsOut;
  o.clip_pos = vec4(p, 0.0, 1.0);
  o.ndc = p;
  return o;
}

fn radiance_at(uv: vec2<f32>) -> vec3<f32> {
  let vg = textureSampleLevel(t_gi, samp_gi, uv, 0.0);
  let v = textureSampleLevel(t_vello, samp_base, uv, 0.0);
  return max(vg.rgb - v.rgb, vec3(0.0));
}

@fragment
fn gb_fs(i: VsOut) -> @location(0) vec4<f32> {
  let uv = vec2(i.ndc.x * 0.5 + 0.5, 0.5 - i.ndc.y * 0.5);
  let gi = radiance_at(uv);
  let s = gb.params.x;
  let display_gain = 14.0;
  let g = gi * s * display_gain;
  let base = textureSampleLevel(t_base, samp_base, uv, 0.0);
  // 亮部压低 GI，避免曝掉；暗部 w→1 才能看见渗色。这不是物理「半影」，而是 LDR 叠间接光。
  let w = vec3(0.22) + vec3(0.78) * (vec3(1.0) - saturate(base.rgb));
  let rgb = clamp(base.rgb + g * w, vec3(0.0), vec3(1.0));
  return vec4(rgb, base.a);
}

// Bevy `radiance_cascades_apply`：`tex_main + tex_radiance_mipmap`
@group(0) @binding(0) var tex_main: texture_2d<f32>;
@group(0) @binding(1) var sampler_main: sampler;
@group(0) @binding(2) var tex_radiance_mipmap: texture_2d<f32>;
@group(0) @binding(3) var sampler_radiance_mipmap: sampler;

@vertex
fn rc_apply_vs(@builtin(vertex_index) vi: u32) -> VsOut {
  var tri = array<vec2<f32>, 3>(
    vec2(-1.0, -1.0),
    vec2(3.0, -1.0),
    vec2(-1.0, 3.0)
  );
  let p = tri[vi];
  var o: VsOut;
  o.clip_pos = vec4(p, 0.0, 1.0);
  o.ndc = p;
  return o;
}

@fragment
fn rc_apply_fs(i: VsOut) -> @location(0) vec4<f32> {
  let uv = vec2(i.ndc.x * 0.5 + 0.5, 0.5 - i.ndc.y * 0.5);
  let main = textureSample(tex_main, sampler_main, uv);
  let radiance = textureSample(tex_radiance_mipmap, sampler_radiance_mipmap, uv);
  return main + radiance;
}
"#;

/// Ping-pong 多级 cascade：逻辑对齐 [bevy_radiance_cascades `radiance_cascades.wgsl`](https://github.com/nixonyh/bevy_radiance_cascades/blob/main/assets/shaders/radiance_cascades.wgsl)。
/// 绑定顺序对齐 Bevy：`rs`（静态）、`probe`（dynamic uniform 256B stride）、`tex_main`、`tex_dist_field`、source、destination。
/// 本管线 `tex_main` 为全分辨率场景，`cascade` 纹理为 GI 分辨率，故 `rs.gi_scale` 将 probe 中心映射到全分辨率；`raymarch` 在 `tex_main`/`t_dist` 的像素坐标下进行。
/// `tex_dist_field.r`：`max(SDF,0)` — 形内与边界上均为 0，仅形外为到边界的正距离。表面判定用 `EPSILON` / `EPSILON_PX`；为 0 时 raymarch 先走命中分支再步进，避免 `dist==0` 当步长死循环。
const RC_COMPUTE_WGSL: &str = r#"
struct RcStaticUniforms {
  full_w: f32,
  full_h: f32,
  gi_w: f32,
  gi_h: f32,
  gi_scale: f32,
  max_march: f32,
  _pad: vec2<f32>,
}

struct Probe {
  width: u32,
  _pad: u32,
  start: f32,
  range: f32,
}

@group(0) @binding(0) var<uniform> rs: RcStaticUniforms;
@group(0) @binding(1) var<uniform> probe: Probe;
@group(0) @binding(2) var tex_main: texture_2d<f32>;
@group(0) @binding(3) var tex_dist_field: texture_2d<f32>;
@group(0) @binding(4) var tex_radiance_cascades_source: texture_2d<f32>;
@group(0) @binding(5) var tex_radiance_cascades_destination: texture_storage_2d<rgba16float, write>;

const PI2: f32 = 6.28318530718;
// bevy_radiance_cascades radiance_cascades.wgsl
const MAX_RAYMARCH: u32 = 32u;
const EPSILON: f32 = 4.88e-04;

fn raymarch(origin: vec2<f32>, ray_dir: vec2<f32>, range: f32) -> vec4<f32> {
  var color = vec4(0.0);
  var position = origin;
  var covered_range = 0.0;
  let dimensions = vec2<f32>(textureDimensions(tex_main));

  for (var r = 0u; r < MAX_RAYMARCH; r = r + 1u) {
    if (
      covered_range >= range ||
      any(position >= dimensions) ||
      any(position < vec2(0.0))
    ) {
      break;
    }

    let pr = round(position);
    var coord = vec2<i32>(i32(pr.x), i32(pr.y));
    coord = vec2<i32>(
      clamp(coord.x, 0, i32(dimensions.x) - 1),
      clamp(coord.y, 0, i32(dimensions.y) - 1),
    );

    var dist = textureLoad(tex_dist_field, coord, 0).r;

    if (dist < EPSILON) {
      // Vello 场景为 [0,1]；勿用 Bevy 的 abs−1 发光解码（会把主体压成 0）。
      color = textureLoad(tex_main, coord, 0);
      color.a = 1.0;
      break;
    }

    position = position + ray_dir * dist;
    covered_range = covered_range + dist;
  }
  return color;
}

fn fetch_cascade(
  probe_cell: vec2<i32>,
  probe_offset: vec2<i32>,
  offset_coord: vec2<u32>,
  dimensions: vec2<u32>,
  prev_width: u32,
) -> vec4<f32> {
  var prev_probe_cell = probe_cell / 2 + probe_offset;
  prev_probe_cell = clamp(
    prev_probe_cell,
    vec2<i32>(0),
    vec2<i32>(dimensions / vec2<u32>(prev_width, prev_width) - vec2<u32>(1u, 1u)),
  );
  let prev_probe_coord = vec2<u32>(prev_probe_cell) * prev_width + offset_coord;
  return textureLoad(tex_radiance_cascades_source, vec2<i32>(prev_probe_coord), 0);
}

fn merge(probe_cell: vec2<u32>, ray_index: u32) -> vec4<f32> {
  let dimensions = textureDimensions(tex_radiance_cascades_source);
  let prev_width = probe.width * 2u;

  var TL = vec4(0.0);
  var TR = vec4(0.0);
  var BL = vec4(0.0);
  var BR = vec4(0.0);

  let probe_cell_i = vec2<i32>(probe_cell);
  let probe_correction_offset = probe_cell_i - probe_cell_i / 2 * 2;

  let prev_ray_index_start = ray_index * 4u;
  for (var p = 0u; p < 4u; p = p + 1u) {
    let prev_ray_index = prev_ray_index_start + p;
    let offset_coord = vec2<u32>(
      prev_ray_index % prev_width,
      prev_ray_index / prev_width,
    );
    TL = TL + fetch_cascade(
      probe_cell_i,
      probe_correction_offset + vec2<i32>(-1, -1),
      offset_coord,
      dimensions,
      prev_width,
    );
    TR = TR + fetch_cascade(
      probe_cell_i,
      probe_correction_offset + vec2<i32>(0, -1),
      offset_coord,
      dimensions,
      prev_width,
    );
    BL = BL + fetch_cascade(
      probe_cell_i,
      probe_correction_offset + vec2<i32>(-1, 0),
      offset_coord,
      dimensions,
      prev_width,
    );
    BR = BR + fetch_cascade(
      probe_cell_i,
      probe_correction_offset + vec2<i32>(0, 0),
      offset_coord,
      dimensions,
      prev_width,
    );
  }

  let weight = vec2<f32>(0.75, 0.75)
    - vec2<f32>(f32(probe_correction_offset.x), f32(probe_correction_offset.y)) * 0.5;
  return mix(mix(TL, TR, weight.x), mix(BL, BR, weight.x), weight.y) * 0.25;
}

fn radiance_dispatch(merge_flag: u32, gid: vec3<u32>) {
  let base_coord = vec2<u32>(gid.x, gid.y);
  let gi_dims = vec2<u32>(textureDimensions(tex_radiance_cascades_source));
  if any(base_coord >= gi_dims) {
    return;
  }
  let probe_w = probe.width;
  // Coordinate inside the probe grid
  let probe_texel = vec2<u32>(base_coord.x % probe_w, base_coord.y % probe_w);

  let ray_index = probe_texel.x + probe_texel.y * probe_w;
  let ray_count = probe_w * probe_w;

  let ray_angle = (f32(ray_index) + 0.5) / f32(ray_count) * PI2;
  let ray_dir = normalize(vec2(cos(ray_angle), sin(ray_angle)));

  // Coordinate of cell in probe grid
  let probe_cell = vec2<u32>(base_coord.x / probe_w, base_coord.y / probe_w);
  // Start coordinate of the probe grid (in texture space)
  let probe_coord = vec2<u32>(probe_cell.x * probe_w, probe_cell.y * probe_w);

  // Center coordinate of the probe grid
  let probe_coord_center = probe_coord + vec2<u32>(probe_w / 2u, probe_w / 2u);
  let center_full = vec2<f32>(probe_coord_center) * rs.gi_scale;
  let origin = center_full + ray_dir * probe.start;

  var color = raymarch(origin, ray_dir, probe.range);
  if merge_flag != 0u && color.a != 1.0 {
    color = color + merge(probe_cell, ray_index);
  }
  textureStore(tex_radiance_cascades_destination, vec2<i32>(i32(base_coord.x), i32(base_coord.y)), color);
}

@compute @workgroup_size(8, 8, 1)
fn rc_cascade_first(@builtin(global_invocation_id) gid: vec3<u32>) {
  radiance_dispatch(0u, gid);
}

@compute @workgroup_size(8, 8, 1)
fn rc_cascade_merge(@builtin(global_invocation_id) gid: vec3<u32>) {
  radiance_dispatch(1u, gid);
}
"#;

/// 与 [bevy `radiance_cascades_mipmap.wgsl`](https://github.com/nixonyh/bevy_radiance_cascades/blob/main/assets/shaders/radiance_cascades_mipmap.wgsl) 一致
///（`ray_count = probe.width * 2`、对 `width×width` 次采样求和后除以 `ray_count`）。
const RC_MIPMAP_WGSL: &str = r#"
struct MipmapProbe {
  width: u32,
  start: f32,
  range: f32,
  _pad: u32,
}

@group(0) @binding(0) var<uniform> probe: MipmapProbe;
@group(0) @binding(1) var tex_radiance_cascades: texture_2d<f32>;
@group(0) @binding(2) var tex_radiance_mipmap: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8, 1)
fn rc_radiance_mipmap(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let base_coord = global_id.xy;
  let dimensions = textureDimensions(tex_radiance_mipmap);
  if any(base_coord >= dimensions) {
    return;
  }
  let pw = probe.width;
  let ray_count = pw * 2u;
  let probe_cell = base_coord * vec2<u32>(pw, pw);
  var accumulation = vec4(0.0);
  for (var y = 0u; y < pw; y = y + 1u) {
    for (var x = 0u; x < pw; x = x + 1u) {
      let coord = vec2<i32>(i32(probe_cell.x + x), i32(probe_cell.y + y));
      accumulation = accumulation + textureLoad(tex_radiance_cascades, coord, 0);
    }
  }
  accumulation = accumulation / f32(ray_count);
  textureStore(tex_radiance_mipmap, vec2<i32>(base_coord), accumulation);
}
"#;

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct MipmapProbeUniform {
    width: u32,
    start: f32,
    range: f32,
    _pad: u32,
}

/// 与 WGSL `RcStaticUniforms` 一致（32B）。
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct RcStaticGpuUniforms {
    full_w: f32,
    full_h: f32,
    gi_w: f32,
    gi_h: f32,
    gi_scale: f32,
    max_march: f32,
    _pad: [f32; 2],
}

/// Bevy `DynamicUniformBuffer<Probe>`：单槽 256B，GPU 仅读前 16B。
const PROBE_UNIFORM_STRIDE: usize = 256;

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct ProbeGpuUniform {
    width: u32,
    _pad0: u32,
    start: f32,
    range: f32,
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct ProbeUniformSlotPadded {
    head: ProbeGpuUniform,
    _rest: [u8; PROBE_UNIFORM_STRIDE - std::mem::size_of::<ProbeGpuUniform>()],
}

impl ProbeUniformSlotPadded {
    fn from_probe(p: &Probe) -> Self {
        Self {
            head: ProbeGpuUniform {
                width: p.width,
                _pad0: 0,
                start: p.start,
                range: p.range,
            },
            _rest: [0; PROBE_UNIFORM_STRIDE - std::mem::size_of::<ProbeGpuUniform>()],
        }
    }
}

#[cfg(target_arch = "wasm32")]
fn affine_inv_to_wgsl(inv: Affine) -> [f32; 6] {
    let c = inv.as_coeffs();
    [
        c[0] as f32,
        c[1] as f32,
        c[2] as f32,
        c[3] as f32,
        c[4] as f32,
        c[5] as f32,
    ]
}

/// `kind == 2`：线段笔画 SDF（与 `FillSdfPrimitive::Segment` 一致）。
#[cfg(target_arch = "wasm32")]
fn set_gpu_rc_prim_segment_payload(
    inv_wgsl: [f32; 6],
    x0: f64,
    y0: f64,
    x1: f64,
    y1: f64,
    half_width: f64,
    out: &mut GpuRcPrim,
) {
    out.inv = inv_wgsl;
    out.kind = 2;
    out.p0 = [x0 as f32, y0 as f32, x1 as f32, y1 as f32];
    out.p1 = [half_width as f32, 0.0, 0.0, 0.0];
}

#[cfg(target_arch = "wasm32")]
fn fill_prim_gpu(
    shape: &JsShape,
    canvas_transform: Affine,
    dpr: f64,
    world: Affine,
    out: &mut GpuRcPrim,
) -> bool {
    let Some(fill) = fill_sdf_primitive_from_js_shape(shape, canvas_transform, dpr) else {
        return false;
    };
    let shape_affine = canvas_transform * world;
    let inv_wgsl = affine_inv_to_wgsl(shape_affine.inverse());
    match fill {
        FillSdfPrimitive::PolylineStroke { .. } => false,
        FillSdfPrimitive::Ellipse { cx, cy, rx, ry } => {
            out.inv = inv_wgsl;
            out.kind = 0;
            out.p0 = [cx as f32, cy as f32, rx as f32, ry as f32];
            out.p1 = [0.0; 4];
            true
        }
        FillSdfPrimitive::RoundedRect {
            x0,
            y0,
            x1,
            y1,
            corner_r,
        } => {
            out.inv = inv_wgsl;
            out.kind = 1;
            out.p0 = [x0 as f32, y0 as f32, x1 as f32, y1 as f32];
            out.p1 = [corner_r as f32, 0.0, 0.0, 0.0];
            true
        }
        FillSdfPrimitive::Segment {
            x0,
            y0,
            x1,
            y1,
            half_width,
        } => {
            set_gpu_rc_prim_segment_payload(inv_wgsl, x0, y0, x1, y1, half_width, out);
            true
        }
    }
}

#[cfg(target_arch = "wasm32")]
pub fn collect_gpu_primitives(
    canvas_id: u32,
    canvas_transform: Affine,
    render_opts: &CanvasRenderOptions,
) -> Vec<GpuRcPrim> {
    use crate::scene::filtered_shapes_and_world_transforms;
    use crate::scene::UiShapeFilter;
    let Some((shapes, world_map)) =
        filtered_shapes_and_world_transforms(canvas_id, render_opts, UiShapeFilter::ExcludeUiMarked)
    else {
        return Vec::new();
    };
    let dpr = device_pixel_ratio();
    let mut v = Vec::new();
    for shape in &shapes {
        if v.len() >= MAX_RC_PRIMITIVES {
            break;
        }
        if let JsShape::Polyline { id, points, .. } = shape {
            let origin = if points.is_empty() {
                Point::ORIGIN
            } else {
                Point::new(points[0][0], points[0][1])
            };
            let world = world_map
                .get(id.as_str())
                .copied()
                .unwrap_or_else(|| Affine::translate(origin.to_vec2()));
            if let Some(FillSdfPrimitive::PolylineStroke {
                points: pts,
                half_width,
            }) = fill_sdf_primitive_from_js_shape(shape, canvas_transform, dpr)
            {
                let shape_affine = canvas_transform * world;
                let inv_wgsl = affine_inv_to_wgsl(shape_affine.inverse());
                for w in pts.windows(2) {
                    if v.len() >= MAX_RC_PRIMITIVES {
                        break;
                    }
                    let mut g = GpuRcPrim::default();
                    set_gpu_rc_prim_segment_payload(
                        inv_wgsl,
                        w[0][0],
                        w[0][1],
                        w[1][0],
                        w[1][1],
                        half_width,
                        &mut g,
                    );
                    v.push(g);
                }
            }
            continue;
        }

        let (id, origin) = match shape {
            JsShape::Rect { id, x, y, .. } => (id.as_str(), Point::new(*x, *y)),
            JsShape::Ellipse { id, cx, cy, .. } => (id.as_str(), Point::new(*cx, *cy)),
            JsShape::Line { id, x1, y1, .. } => (id.as_str(), Point::new(*x1, *y1)),
            _ => continue,
        };
        let world = world_map
            .get(id)
            .copied()
            .unwrap_or_else(|| Affine::translate(origin.to_vec2()));
        let mut g = GpuRcPrim::default();
        if fill_prim_gpu(shape, canvas_transform, dpr, world, &mut g) {
            v.push(g);
        }
    }
    v
}

#[cfg(not(target_arch = "wasm32"))]
pub fn collect_gpu_primitives(
    _canvas_id: u32,
    _canvas_transform: Affine,
    _render_opts: &CanvasRenderOptions,
) -> Vec<GpuRcPrim> {
    Vec::new()
}

/// 与 Bevy 一致：cascade / dist 同分辨率；`1` = 全分辨率（配合 mipmap + apply）。
pub const GI_RC_DOWNSCALE: u32 = 1;

pub struct RcPassTextures {
    pub width: u32,
    pub height: u32,
    pub gi_width: u32,
    pub gi_height: u32,
    /// 本帧级联数（已按 GI 尺寸与 probe 网格整除约束收紧）。
    pub cascade_count: usize,
    pub dist: Texture,
    pub dist_view: TextureView,
    pub rc_a: Texture,
    pub rc_a_view: TextureView,
    pub rc_b: Texture,
    pub rc_b_view: TextureView,
    /// `rc_apply` 全屏输出：`vello + radiance`（Bevy apply），供 `gi_blend` 与 `vello` 作差得间接光增量；尺寸与 GI 一致。
    pub rc_final: Texture,
    pub rc_final_view: TextureView,
    /// Bevy 式 probe 降采样网格（每 texel = 一个 probe 的方向平均）。
    pub mipmap_width: u32,
    pub mipmap_height: u32,
    pub rc_mipmap: Texture,
    pub rc_mipmap_view: TextureView,
    pub gi_out: Texture,
    pub gi_out_view: TextureView,
}

impl RcPassTextures {
    pub fn new(device: &Device, width: u32, height: u32) -> Self {
        let gi_width = (width / GI_RC_DOWNSCALE).max(1);
        let gi_height = (height / GI_RC_DOWNSCALE).max(1);
        let cascade_count = cascade_count_for_gi_size(gi_width, gi_height);
        let pw = probe_for_cascade(0, RC_RESOLUTION_FACTOR, RC_INTERVAL0).width.max(1);
        let mipmap_width = ((gi_width + pw - 1) / pw).max(1);
        let mipmap_height = ((gi_height + pw - 1) / pw).max(1);
        let mk_sz = |device: &Device, label: &'static str, format: TextureFormat, usage: TextureUsages, w: u32, h: u32| {
            let size = Extent3d {
                width: w,
                height: h,
                depth_or_array_layers: 1,
            };
            let t = device.create_texture(&TextureDescriptor {
                label: Some(label),
                size,
                mip_level_count: 1,
                sample_count: 1,
                dimension: TextureDimension::D2,
                format,
                usage,
                view_formats: &[],
            });
            let v = t.create_view(&vello::wgpu::TextureViewDescriptor::default());
            (t, v)
        };
        let (dist, dist_view) = mk_sz(
            device,
            "rc_dist",
            TextureFormat::R16Float,
            TextureUsages::RENDER_ATTACHMENT | TextureUsages::TEXTURE_BINDING,
            width,
            height,
        );
        let rc_usage = TextureUsages::STORAGE_BINDING | TextureUsages::TEXTURE_BINDING;
        let (rc_a, rc_a_view) = mk_sz(
            device,
            "rc_ping_a",
            TextureFormat::Rgba16Float,
            rc_usage,
            gi_width,
            gi_height,
        );
        let (rc_b, rc_b_view) = mk_sz(
            device,
            "rc_ping_b",
            TextureFormat::Rgba16Float,
            rc_usage,
            gi_width,
            gi_height,
        );
        let (rc_mipmap, rc_mipmap_view) = mk_sz(
            device,
            "rc_radiance_mipmap",
            TextureFormat::Rgba16Float,
            TextureUsages::STORAGE_BINDING | TextureUsages::TEXTURE_BINDING,
            mipmap_width,
            mipmap_height,
        );
        let (rc_final, rc_final_view) = mk_sz(
            device,
            "rc_apply_out",
            TextureFormat::Rgba16Float,
            TextureUsages::RENDER_ATTACHMENT | TextureUsages::TEXTURE_BINDING,
            gi_width,
            gi_height,
        );
        let (gi_out, gi_out_view) = mk_sz(
            device,
            "rc_gi_out",
            TextureFormat::Rgba8Unorm,
            TextureUsages::RENDER_ATTACHMENT | TextureUsages::TEXTURE_BINDING,
            width,
            height,
        );
        Self {
            width,
            height,
            gi_width,
            gi_height,
            cascade_count,
            dist,
            dist_view,
            rc_a,
            rc_a_view,
            rc_b,
            rc_b_view,
            rc_final,
            rc_final_view,
            mipmap_width,
            mipmap_height,
            rc_mipmap,
            rc_mipmap_view,
            gi_out,
            gi_out_view,
        }
    }

    /// Packed cascade 最后一级写入的视图（奇数级联数在 `rc_b`，偶数在 `rc_a`）；经 `encode_rc_mipmap` + `encode_rc_apply` 后再用于合成。
    pub fn gi_cascade_output_view(&self) -> &TextureView {
        if self.cascade_count % 2 == 1 {
            &self.rc_b_view
        } else {
            &self.rc_a_view
        }
    }
}

pub struct RcPass {
    dist_pipeline: RenderPipeline,
    dist_bind_layout: BindGroupLayout,
    dist_header_buf: Buffer,
    dist_prim_buf: Buffer,
    rc_cascade_first_pipeline: ComputePipeline,
    rc_cascade_merge_pipeline: ComputePipeline,
    rc_cascade_layout: BindGroupLayout,
    rc_cascade_static_buf: Buffer,
    rc_probe_dynamic_buf: Buffer,
    rc_mipmap_pipeline: ComputePipeline,
    rc_mipmap_layout: BindGroupLayout,
    rc_mipmap_uniform_buf: Buffer,
    rc_apply_pipeline: RenderPipeline,
    rc_apply_layout: BindGroupLayout,
    gi_blend_pipeline: RenderPipeline,
    gi_blend_layout: BindGroupLayout,
    gi_blend_uniform_buf: Buffer,
    /// `tex_main`：与 Bevy apply 一致（NonFiltering / 最近邻）。
    sampler_gi_blend_base: Sampler,
    /// `radiance`：与 Bevy `radiance_sampler` 一致（Linear）。
    sampler_gi_blend_gi: Sampler,
    sampler_rc_mipmap: Sampler,
}

impl RcPass {
    pub fn new(device: &Device) -> Self {
        let module = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("rc_dist_gi_blend"),
            source: ShaderSource::Wgsl(WGSL.into()),
        });
        let module_rc = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("rc_cascade_compute"),
            source: ShaderSource::Wgsl(RC_COMPUTE_WGSL.into()),
        });
        let module_mipmap = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("rc_mipmap_compute"),
            source: ShaderSource::Wgsl(RC_MIPMAP_WGSL.into()),
        });

        let dist_bind_layout = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("rc_dist_layout"),
            entries: &[
                BindGroupLayoutEntry {
                    binding: 0,
                    visibility: vello::wgpu::ShaderStages::VERTEX_FRAGMENT,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 1,
                    visibility: vello::wgpu::ShaderStages::FRAGMENT,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });
        let dist_pl = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("rc_dist_pl"),
            bind_group_layouts: &[&dist_bind_layout],
            immediate_size: 0,
        });
        let dist_pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("rc_dist"),
            layout: Some(&dist_pl),
            vertex: VertexState {
                module: &module,
                entry_point: Some("dist_vs"),
                compilation_options: PipelineCompilationOptions::default(),
                buffers: &[],
            },
            fragment: Some(FragmentState {
                module: &module,
                entry_point: Some("dist_fs"),
                compilation_options: PipelineCompilationOptions::default(),
                targets: &[Some(ColorTargetState {
                    format: TextureFormat::R16Float,
                    blend: Some(vello::wgpu::BlendState::REPLACE),
                    write_mask: ColorWrites::RED,
                })],
            }),
            primitive: PrimitiveState {
                front_face: FrontFace::Ccw,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: MultisampleState::default(),
            multiview_mask: None,
            cache: None,
        });

        let dist_header_buf = device.create_buffer(&BufferDescriptor {
            label: Some("rc_dist_header"),
            size: 256,
            usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let dist_prim_buf = device.create_buffer(&BufferDescriptor {
            label: Some("rc_dist_prims"),
            size: (MAX_RC_PRIMITIVES * std::mem::size_of::<GpuRcPrim>()) as u64,
            usage: BufferUsages::STORAGE | BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let rc_cascade_layout = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("rc_cascade_layout"),
            entries: &[
                BindGroupLayoutEntry {
                    binding: 0,
                    visibility: vello::wgpu::ShaderStages::COMPUTE,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: NonZeroU64::new(
                            std::mem::size_of::<RcStaticGpuUniforms>() as u64,
                        ),
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 1,
                    visibility: vello::wgpu::ShaderStages::COMPUTE,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Uniform,
                        has_dynamic_offset: true,
                        min_binding_size: NonZeroU64::new(PROBE_UNIFORM_STRIDE as u64),
                    },
                    count: None,
                },
                // 与 bevy_radiance_cascades：tex_main, tex_dist_field, source, destination
                BindGroupLayoutEntry {
                    binding: 2,
                    visibility: vello::wgpu::ShaderStages::COMPUTE,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: false },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 3,
                    visibility: vello::wgpu::ShaderStages::COMPUTE,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: false },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 4,
                    visibility: vello::wgpu::ShaderStages::COMPUTE,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: false },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 5,
                    visibility: vello::wgpu::ShaderStages::COMPUTE,
                    ty: BindingType::StorageTexture {
                        access: StorageTextureAccess::WriteOnly,
                        format: TextureFormat::Rgba16Float,
                        view_dimension: TextureViewDimension::D2,
                    },
                    count: None,
                },
            ],
        });
        let rc_cascade_pl = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("rc_cascade_pl"),
            bind_group_layouts: &[&rc_cascade_layout],
            immediate_size: 0,
        });
        let rc_cascade_first_pipeline = device.create_compute_pipeline(&ComputePipelineDescriptor {
            label: Some("rc_cascade_first"),
            layout: Some(&rc_cascade_pl),
            module: &module_rc,
            compilation_options: PipelineCompilationOptions::default(),
            cache: None,
            entry_point: Some("rc_cascade_first"),
        });
        let rc_cascade_merge_pipeline = device.create_compute_pipeline(&ComputePipelineDescriptor {
            label: Some("rc_cascade_merge"),
            layout: Some(&rc_cascade_pl),
            module: &module_rc,
            compilation_options: PipelineCompilationOptions::default(),
            cache: None,
            entry_point: Some("rc_cascade_merge"),
        });

        // 256B 与常见 UBO 对齐习惯一致（与原先单块 uniform 缓冲同尺寸）。
        let rc_cascade_static_buf = device.create_buffer(&BufferDescriptor {
            label: Some("rc_cascade_static"),
            size: 256,
            usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let rc_probe_dynamic_buf = device.create_buffer(&BufferDescriptor {
            label: Some("rc_probe_dynamic"),
            size: (RC_MAX_CASCADES * PROBE_UNIFORM_STRIDE) as u64,
            usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let rc_mipmap_layout = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("rc_mipmap_layout"),
            entries: &[
                BindGroupLayoutEntry {
                    binding: 0,
                    visibility: vello::wgpu::ShaderStages::COMPUTE,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 1,
                    visibility: vello::wgpu::ShaderStages::COMPUTE,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: false },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 2,
                    visibility: vello::wgpu::ShaderStages::COMPUTE,
                    ty: BindingType::StorageTexture {
                        access: StorageTextureAccess::WriteOnly,
                        format: TextureFormat::Rgba16Float,
                        view_dimension: TextureViewDimension::D2,
                    },
                    count: None,
                },
            ],
        });
        let rc_mipmap_pl = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("rc_mipmap_pl"),
            bind_group_layouts: &[&rc_mipmap_layout],
            immediate_size: 0,
        });
        let rc_mipmap_pipeline = device.create_compute_pipeline(&ComputePipelineDescriptor {
            label: Some("rc_radiance_mipmap"),
            layout: Some(&rc_mipmap_pl),
            module: &module_mipmap,
            compilation_options: PipelineCompilationOptions::default(),
            cache: None,
            entry_point: Some("rc_radiance_mipmap"),
        });
        let rc_mipmap_uniform_buf = device.create_buffer(&BufferDescriptor {
            label: Some("rc_mipmap_uniforms"),
            size: 256,
            usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let rc_apply_layout = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("rc_apply_layout"),
            entries: &[
                BindGroupLayoutEntry {
                    binding: 0,
                    visibility: vello::wgpu::ShaderStages::FRAGMENT,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: false },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 1,
                    visibility: vello::wgpu::ShaderStages::FRAGMENT,
                    ty: BindingType::Sampler(SamplerBindingType::NonFiltering),
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 2,
                    visibility: vello::wgpu::ShaderStages::FRAGMENT,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: true },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 3,
                    visibility: vello::wgpu::ShaderStages::FRAGMENT,
                    ty: BindingType::Sampler(SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });
        let rc_apply_pl = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("rc_apply_pl"),
            bind_group_layouts: &[&rc_apply_layout],
            immediate_size: 0,
        });
        let rc_apply_pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("rc_apply"),
            layout: Some(&rc_apply_pl),
            vertex: VertexState {
                module: &module,
                entry_point: Some("rc_apply_vs"),
                compilation_options: PipelineCompilationOptions::default(),
                buffers: &[],
            },
            fragment: Some(FragmentState {
                module: &module,
                entry_point: Some("rc_apply_fs"),
                compilation_options: PipelineCompilationOptions::default(),
                targets: &[Some(ColorTargetState {
                    format: TextureFormat::Rgba16Float,
                    blend: Some(vello::wgpu::BlendState::REPLACE),
                    write_mask: ColorWrites::ALL,
                })],
            }),
            primitive: PrimitiveState {
                front_face: FrontFace::Ccw,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: MultisampleState::default(),
            multiview_mask: None,
            cache: None,
        });

        let gi_blend_layout = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("gi_blend_layout"),
            entries: &[
                BindGroupLayoutEntry {
                    binding: 0,
                    visibility: vello::wgpu::ShaderStages::FRAGMENT,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 1,
                    visibility: vello::wgpu::ShaderStages::FRAGMENT,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: false },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 2,
                    visibility: vello::wgpu::ShaderStages::FRAGMENT,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: true },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 3,
                    visibility: vello::wgpu::ShaderStages::FRAGMENT,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: false },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 4,
                    visibility: vello::wgpu::ShaderStages::FRAGMENT,
                    ty: BindingType::Sampler(SamplerBindingType::NonFiltering),
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 5,
                    visibility: vello::wgpu::ShaderStages::FRAGMENT,
                    ty: BindingType::Sampler(SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });
        let gb_pl = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("gi_blend_pl"),
            bind_group_layouts: &[&gi_blend_layout],
            immediate_size: 0,
        });
        let gi_blend_pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("gi_blend"),
            layout: Some(&gb_pl),
            vertex: VertexState {
                module: &module,
                entry_point: Some("gb_vs"),
                compilation_options: PipelineCompilationOptions::default(),
                buffers: &[],
            },
            fragment: Some(FragmentState {
                module: &module,
                entry_point: Some("gb_fs"),
                compilation_options: PipelineCompilationOptions::default(),
                targets: &[Some(ColorTargetState {
                    format: TextureFormat::Rgba8Unorm,
                    blend: Some(vello::wgpu::BlendState::REPLACE),
                    write_mask: ColorWrites::ALL,
                })],
            }),
            primitive: PrimitiveState {
                front_face: FrontFace::Ccw,
                ..Default::default()
            },
            depth_stencil: None,
            multisample: MultisampleState::default(),
            multiview_mask: None,
            cache: None,
        });
        let gi_blend_uniform_buf = device.create_buffer(&BufferDescriptor {
            label: Some("gi_blend_u"),
            size: 16,
            usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let sampler_gi_blend_base = device.create_sampler(&SamplerDescriptor {
            label: Some("gi_blend_base_sampler"),
            mag_filter: FilterMode::Nearest,
            min_filter: FilterMode::Nearest,
            ..Default::default()
        });
        let sampler_gi_blend_gi = device.create_sampler(&SamplerDescriptor {
            label: Some("gi_blend_gi_sampler"),
            mag_filter: FilterMode::Linear,
            min_filter: FilterMode::Linear,
            ..Default::default()
        });
        // Linear：从 probe 网格上采样到全分辨率时更平滑，间接光在暗部才有可见的柔和渗色；Nearest 块感强、几乎无「晕」。
        let sampler_rc_mipmap = device.create_sampler(&SamplerDescriptor {
            label: Some("rc_mipmap_sampler"),
            mag_filter: FilterMode::Linear,
            min_filter: FilterMode::Linear,
            mipmap_filter: MipmapFilterMode::Nearest,
            ..Default::default()
        });

        Self {
            dist_pipeline,
            dist_bind_layout,
            dist_header_buf,
            dist_prim_buf,
            rc_cascade_first_pipeline,
            rc_cascade_merge_pipeline,
            rc_cascade_layout,
            rc_cascade_static_buf,
            rc_probe_dynamic_buf,
            rc_mipmap_pipeline,
            rc_mipmap_layout,
            rc_mipmap_uniform_buf,
            rc_apply_pipeline,
            rc_apply_layout,
            gi_blend_pipeline,
            gi_blend_layout,
            gi_blend_uniform_buf,
            sampler_gi_blend_base,
            sampler_gi_blend_gi,
            sampler_rc_mipmap,
        }
    }

    pub fn write_dist_data(
        &self,
        queue: &vello::wgpu::Queue,
        width: u32,
        height: u32,
        prims: &[GpuRcPrim],
    ) {
        // 与 Vello 一致：`p_canvas` 为物理像素坐标，`prim.inv = inverse(effective * world)` 满足 `inv * p = local`。
        // 勿用 `world_from_clip_matrix(inv)`（得到的是 `inverse(effective)*pixel`，会对 inv 多乘一次 `inverse(effective)`）。
        let m = pixel_from_ndc_matrix(width, height);
        let col0 = [m[0][0], m[1][0], m[2][0], 0.0_f32];
        let col1 = [m[0][1], m[1][1], m[2][1], 0.0_f32];
        let col2 = [m[0][2], m[1][2], m[2][2], 0.0_f32];
        let mut raw = [0u8; 256];
        fn pack4(raw: &mut [u8], off: usize, v: [f32; 4]) {
            for i in 0..4 {
                raw[off + i * 4..off + i * 4 + 4].copy_from_slice(&v[i].to_le_bytes());
            }
        }
        pack4(&mut raw, 0, [width as f32, height as f32, 0.0, 0.0]);
        pack4(&mut raw, 16, col0);
        pack4(&mut raw, 32, col1);
        pack4(&mut raw, 48, col2);
        let count = (prims.len().min(MAX_RC_PRIMITIVES)) as u32;
        raw[64..68].copy_from_slice(&count.to_le_bytes());
        queue.write_buffer(&self.dist_header_buf, 0, &raw);

        if !prims.is_empty() {
            let n = prims.len().min(MAX_RC_PRIMITIVES);
            queue.write_buffer(&self.dist_prim_buf, 0, bytemuck::cast_slice(&prims[..n]));
        }
    }

    pub fn write_gi_blend_uniforms(&self, queue: &vello::wgpu::Queue, strength: f32) {
        #[repr(C)]
        #[derive(Clone, Copy, Pod, Zeroable)]
        struct GiBlendUbo {
            params: [f32; 4],
        }
        let u = GiBlendUbo {
            params: [strength, 0.0, 0.0, 0.0],
        };
        queue.write_buffer(&self.gi_blend_uniform_buf, 0, bytemuck::bytes_of(&u));
    }

    pub fn encode_distance_pass(
        &self,
        device: &Device,
        encoder: &mut CommandEncoder,
        target: &TextureView,
        _prim_count: usize,
    ) {
        let bind = device.create_bind_group(&BindGroupDescriptor {
            label: Some("rc_dist_bg"),
            layout: &self.dist_bind_layout,
            entries: &[
                BindGroupEntry {
                    binding: 0,
                    resource: self.dist_header_buf.as_entire_binding(),
                },
                BindGroupEntry {
                    binding: 1,
                    resource: self.dist_prim_buf.as_entire_binding(),
                },
            ],
        });
        let mut pass = encoder.begin_render_pass(&RenderPassDescriptor {
            label: Some("rc_distance"),
            color_attachments: &[Some(RenderPassColorAttachment {
                view: target,
                depth_slice: None,
                resolve_target: None,
                ops: Operations {
                    load: vello::wgpu::LoadOp::Clear(vello::wgpu::Color {
                        r: 1e6,
                        g: 0.0,
                        b: 0.0,
                        a: 1.0,
                    }),
                    store: vello::wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
            multiview_mask: None,
        });
        pass.set_pipeline(&self.dist_pipeline);
        pass.set_bind_group(0, &bind, &[]);
        pass.draw(0..3, 0..1);
    }

    /// 与 Bevy `RadianceCascadesNode` 一致：**首趟 no-merge** 单独 compute pass → **merge** 单独 compute pass（probe 序与 01/10 ping-pong 同前）。
    pub fn encode_rc_cascade_passes(
        &self,
        device: &Device,
        queue: &Queue,
        encoder: &mut CommandEncoder,
        rc_a_view: &TextureView,
        rc_b_view: &TextureView,
        dist_view: &TextureView,
        scene_view: &TextureView,
        gi_width: u32,
        gi_height: u32,
        full_width: u32,
        full_height: u32,
        cascade_count: usize,
    ) {
        let gw = (gi_width + 7) / 8;
        let gh = (gi_height + 7) / 8;
        let gi_scale = GI_RC_DOWNSCALE as f32;
        let max_march = 32.0_f32;

        let static_u = RcStaticGpuUniforms {
            full_w: full_width as f32,
            full_h: full_height as f32,
            gi_w: gi_width as f32,
            gi_h: gi_height as f32,
            gi_scale,
            max_march,
            _pad: [0.0, 0.0],
        };
        queue.write_buffer(&self.rc_cascade_static_buf, 0, bytemuck::bytes_of(&static_u));

        for c in 0..cascade_count {
            let p = probe_for_cascade(c as u32, RC_RESOLUTION_FACTOR, RC_INTERVAL0);
            let slot = ProbeUniformSlotPadded::from_probe(&p);
            queue.write_buffer(
                &self.rc_probe_dynamic_buf,
                (c * PROBE_UNIFORM_STRIDE) as u64,
                bytemuck::bytes_of(&slot),
            );
        }

        let probe_binding = BufferBinding {
            buffer: &self.rc_probe_dynamic_buf,
            offset: 0,
            size: NonZeroU64::new(PROBE_UNIFORM_STRIDE as u64),
        };

        // Bevy `radiance_cascades_10`：读 rc_a，写 rc_b（storage）。
        let radiance_cascades_10 = device.create_bind_group(&BindGroupDescriptor {
            label: Some("radiance_cascades_10"),
            layout: &self.rc_cascade_layout,
            entries: &[
                BindGroupEntry {
                    binding: 0,
                    resource: self.rc_cascade_static_buf.as_entire_binding(),
                },
                BindGroupEntry {
                    binding: 1,
                    resource: BindingResource::Buffer(probe_binding.clone()),
                },
                BindGroupEntry {
                    binding: 2,
                    resource: BindingResource::TextureView(scene_view),
                },
                BindGroupEntry {
                    binding: 3,
                    resource: BindingResource::TextureView(dist_view),
                },
                BindGroupEntry {
                    binding: 4,
                    resource: BindingResource::TextureView(rc_a_view),
                },
                BindGroupEntry {
                    binding: 5,
                    resource: BindingResource::TextureView(rc_b_view),
                },
            ],
        });
        // Bevy `radiance_cascades_01`：读 rc_b，写 rc_a。
        let radiance_cascades_01 = device.create_bind_group(&BindGroupDescriptor {
            label: Some("radiance_cascades_01"),
            layout: &self.rc_cascade_layout,
            entries: &[
                BindGroupEntry {
                    binding: 0,
                    resource: self.rc_cascade_static_buf.as_entire_binding(),
                },
                BindGroupEntry {
                    binding: 1,
                    resource: BindingResource::Buffer(probe_binding),
                },
                BindGroupEntry {
                    binding: 2,
                    resource: BindingResource::TextureView(scene_view),
                },
                BindGroupEntry {
                    binding: 3,
                    resource: BindingResource::TextureView(dist_view),
                },
                BindGroupEntry {
                    binding: 4,
                    resource: BindingResource::TextureView(rc_b_view),
                },
                BindGroupEntry {
                    binding: 5,
                    resource: BindingResource::TextureView(rc_a_view),
                },
            ],
        });

        let first_offset = ((cascade_count.saturating_sub(1)) * PROBE_UNIFORM_STRIDE) as u32;

        // --- radiance_cascades_first_pass（no-merge，`radiance_cascades_10`）---
        {
            let mut pass = encoder.begin_compute_pass(&ComputePassDescriptor {
                label: Some("radiance_cascades_first_pass"),
                timestamp_writes: None,
            });
            pass.set_pipeline(&self.rc_cascade_first_pipeline);
            pass.set_bind_group(0, &radiance_cascades_10, &[first_offset]);
            pass.dispatch_workgroups(gw, gh, 1);
        }

        // --- radiance_cascades_merge_passes ---
        if cascade_count <= 1 {
            return;
        }
        let mut merge_pass = encoder.begin_compute_pass(&ComputePassDescriptor {
            label: Some("radiance_cascades_merge_passes"),
            timestamp_writes: None,
        });
        merge_pass.set_pipeline(&self.rc_cascade_merge_pipeline);
        for pass_i in 1..cascade_count {
            let cascade_idx = cascade_count - 1 - pass_i;
            let dyn_off = (cascade_idx * PROBE_UNIFORM_STRIDE) as u32;
            let merge_idx = pass_i - 1;
            let bg = if merge_idx % 2 == 0 {
                &radiance_cascades_01
            } else {
                &radiance_cascades_10
            };
            merge_pass.set_bind_group(0, bg, &[dyn_off]);
            merge_pass.dispatch_workgroups(gw, gh, 1);
        }
    }

    /// Bevy `radiance_cascades_mipmap`：packed cascade0 → 每 probe 一 texel。
    pub fn encode_rc_mipmap(
        &self,
        device: &Device,
        queue: &Queue,
        encoder: &mut CommandEncoder,
        packed_cascade_src: &TextureView,
        mipmap_dst: &TextureView,
        mipmap_w: u32,
        mipmap_h: u32,
    ) {
        let p0 = probe_for_cascade(0, RC_RESOLUTION_FACTOR, RC_INTERVAL0);
        let u = MipmapProbeUniform {
            width: p0.width,
            start: p0.start,
            range: p0.range,
            _pad: 0,
        };
        queue.write_buffer(&self.rc_mipmap_uniform_buf, 0, bytemuck::bytes_of(&u));
        let bind = device.create_bind_group(&BindGroupDescriptor {
            label: Some("rc_mipmap_bg"),
            layout: &self.rc_mipmap_layout,
            entries: &[
                BindGroupEntry {
                    binding: 0,
                    resource: self.rc_mipmap_uniform_buf.as_entire_binding(),
                },
                BindGroupEntry {
                    binding: 1,
                    resource: vello::wgpu::BindingResource::TextureView(packed_cascade_src),
                },
                BindGroupEntry {
                    binding: 2,
                    resource: vello::wgpu::BindingResource::TextureView(mipmap_dst),
                },
            ],
        });
        let mut pass = encoder.begin_compute_pass(&ComputePassDescriptor {
            label: Some("rc_mipmap"),
            timestamp_writes: None,
        });
        pass.set_pipeline(&self.rc_mipmap_pipeline);
        pass.set_bind_group(0, &bind, &[]);
        let gw = (mipmap_w + 7) / 8;
        let gh = (mipmap_h + 7) / 8;
        pass.dispatch_workgroups(gw, gh, 1);
    }

    /// 与 Bevy `radiance_cascades_apply` 一致：`tex_main + tex_radiance_mipmap` → `rc_final`（RGBA16Float）。
    pub fn encode_rc_apply(
        &self,
        device: &Device,
        encoder: &mut CommandEncoder,
        main_view: &TextureView,
        mipmap_src: &TextureView,
        rc_final: &TextureView,
    ) {
        let bind = device.create_bind_group(&BindGroupDescriptor {
            label: Some("rc_apply_bg"),
            layout: &self.rc_apply_layout,
            entries: &[
                BindGroupEntry {
                    binding: 0,
                    resource: vello::wgpu::BindingResource::TextureView(main_view),
                },
                BindGroupEntry {
                    binding: 1,
                    resource: vello::wgpu::BindingResource::Sampler(&self.sampler_gi_blend_base),
                },
                BindGroupEntry {
                    binding: 2,
                    resource: vello::wgpu::BindingResource::TextureView(mipmap_src),
                },
                BindGroupEntry {
                    binding: 3,
                    resource: vello::wgpu::BindingResource::Sampler(&self.sampler_rc_mipmap),
                },
            ],
        });
        let mut pass = encoder.begin_render_pass(&RenderPassDescriptor {
            label: Some("rc_apply"),
            color_attachments: &[Some(RenderPassColorAttachment {
                view: rc_final,
                depth_slice: None,
                resolve_target: None,
                ops: Operations {
                    load: vello::wgpu::LoadOp::Clear(vello::wgpu::Color {
                        r: 0.0,
                        g: 0.0,
                        b: 0.0,
                        a: 1.0,
                    }),
                    store: vello::wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
            multiview_mask: None,
        });
        pass.set_pipeline(&self.rc_apply_pipeline);
        pass.set_bind_group(0, &bind, &[]);
        pass.draw(0..3, 0..1);
    }

    /// `gi_view` 为 apply 输出（`vello + radiance`）；`vello_view` 为未加 GI 的场景层，用于在合成中只叠加间接光增量。
    pub fn encode_gi_blend(
        &self,
        device: &Device,
        encoder: &mut CommandEncoder,
        composite_view: &TextureView,
        gi_view: &TextureView,
        vello_view: &TextureView,
        out_view: &TextureView,
    ) {
        let bind = device.create_bind_group(&BindGroupDescriptor {
            label: Some("gi_blend_bg"),
            layout: &self.gi_blend_layout,
            entries: &[
                BindGroupEntry {
                    binding: 0,
                    resource: self.gi_blend_uniform_buf.as_entire_binding(),
                },
                BindGroupEntry {
                    binding: 1,
                    resource: vello::wgpu::BindingResource::TextureView(composite_view),
                },
                BindGroupEntry {
                    binding: 2,
                    resource: vello::wgpu::BindingResource::TextureView(gi_view),
                },
                BindGroupEntry {
                    binding: 3,
                    resource: vello::wgpu::BindingResource::TextureView(vello_view),
                },
                BindGroupEntry {
                    binding: 4,
                    resource: vello::wgpu::BindingResource::Sampler(&self.sampler_gi_blend_base),
                },
                BindGroupEntry {
                    binding: 5,
                    resource: vello::wgpu::BindingResource::Sampler(&self.sampler_gi_blend_gi),
                },
            ],
        });
        let mut pass = encoder.begin_render_pass(&RenderPassDescriptor {
            label: Some("gi_blend"),
            color_attachments: &[Some(RenderPassColorAttachment {
                view: out_view,
                depth_slice: None,
                resolve_target: None,
                ops: Operations {
                    load: vello::wgpu::LoadOp::Clear(vello::wgpu::Color::WHITE),
                    store: vello::wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
            multiview_mask: None,
        });
        pass.set_pipeline(&self.gi_blend_pipeline);
        pass.set_bind_group(0, &bind, &[]);
        pass.draw(0..3, 0..1);
    }
}
