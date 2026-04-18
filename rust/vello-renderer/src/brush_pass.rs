//! Fullscreen procedural brush pass (WGPU placeholder).
//! This mirrors the grid pass architecture so brush WGSL can be migrated incrementally.

use vello::kurbo::Affine;
use vello::wgpu::{
    self, BindGroup, BindGroupDescriptor, BindGroupEntry, BindGroupLayout, BindGroupLayoutDescriptor,
    BindGroupLayoutEntry, BindingType, Buffer,
    BufferBindingType, BufferDescriptor, BufferUsages, ColorTargetState, ColorWrites,
    CommandEncoder, Device, FragmentState, FrontFace, MultisampleState, Operations,
    PipelineCompilationOptions, PipelineLayoutDescriptor, PrimitiveState,
    RenderPassColorAttachment, RenderPassDescriptor, RenderPipeline, RenderPipelineDescriptor,
    Sampler, SamplerBindingType, SamplerDescriptor, ShaderModuleDescriptor, ShaderSource,
    Texture, TextureDescriptor, TextureDimension, TextureFormat, TextureSampleType, TextureUsages,
    TextureView, TextureViewDescriptor, TextureViewDimension, VertexState,
};

const WGSL: &str = r#"
struct BrushUniforms {
    col0: vec4<f32>,
    col1: vec4<f32>,
    col2: vec4<f32>,
    stroke_color: vec4<f32>,
    p0_r0: vec4<f32>,
    p1_r1: vec4<f32>,
    stamp: vec4<f32>, // x: interval, y: noise_factor, z: rotation_factor, w: enabled
    segment: vec4<f32>, // x: l0, y: l1, z: stamp_mode(0/1), w: reserved
}

@group(0) @binding(0) var<uniform> u: BrushUniforms;
@group(0) @binding(1) var t_stamp: texture_2d<f32>;
@group(0) @binding(2) var s_stamp: sampler;

struct VsOut {
    @builtin(position) clip_pos: vec4<f32>,
    @location(0) ndc: vec2<f32>,
}

@vertex
fn brush_vs(@builtin(vertex_index) vi: u32) -> VsOut {
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

fn world_coord_from_ndc(ndc: vec2<f32>) -> vec2<f32> {
    return vec2(
        u.col0.x * ndc.x + u.col1.x * ndc.y + u.col2.x,
        u.col0.y * ndc.x + u.col1.y * ndc.y + u.col2.y
    );
}

const EPS: f32 = 1e-6;
const STAMP_MODE_EQUIDISTANCE: i32 = 0;
const STAMP_MODE_RATIODISTANCE: i32 = 1;

fn x2n(x: f32, len: f32, r0: f32, r1: f32, stamp_interval: f32, stamp_mode: i32) -> f32 {
    if stamp_mode == STAMP_MODE_EQUIDISTANCE {
        return x / stamp_interval;
    }
    if abs(r0 - r1) < EPS {
        return x / (stamp_interval * r0);
    }
    let k = (1.0 - r1 / r0) / max(len, EPS);
    let inside = max(1.0 - k * x, EPS);
    return -len / (stamp_interval * (r0 - r1)) * log(inside);
}

fn n2x(n: f32, len: f32, r0: f32, r1: f32, stamp_interval: f32, stamp_mode: i32) -> f32 {
    if stamp_mode == STAMP_MODE_EQUIDISTANCE {
        return n * stamp_interval;
    }
    if abs(r0 - r1) < EPS {
        return n * stamp_interval * r0;
    }
    let t = -(r0 - r1) * n * stamp_interval / max(len, EPS);
    let denom = 1.0 - r1 / r0;
    if abs(denom) < EPS {
        return n * stamp_interval * r0;
    }
    return len * (1.0 - exp(t)) / denom;
}

fn rotate2(p: vec2<f32>, angle: f32) -> vec2<f32> {
    let c = cos(angle);
    let s = sin(angle);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

fn random2(st: vec2<f32>) -> f32 {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
}

fn noise2(st: vec2<f32>) -> f32 {
    let i = floor(st);
    let f = fract(st);
    let a = random2(i);
    let b = random2(i + vec2(1.0, 0.0));
    let c = random2(i + vec2(0.0, 1.0));
    let d = random2(i + vec2(1.0, 1.0));
    let u = f * f * (vec2(3.0, 3.0) - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

fn fbm2(st_in: vec2<f32>) -> f32 {
    var st = st_in;
    var value = 0.0;
    var amplitude = 0.5;
    for (var j = 0; j < 6; j = j + 1) {
        value = value + amplitude * noise2(st);
        st = st * 2.0;
        amplitude = amplitude * 0.5;
    }
    return value;
}

@fragment
fn brush_fs(i: VsOut) -> @location(0) vec4<f32> {
    if u.stamp.w < 0.5 {
        return vec4(0.0, 0.0, 0.0, 0.0);
    }

    let p = world_coord_from_ndc(i.ndc);
    let p0 = u.p0_r0.xy;
    let p1 = u.p1_r1.xy;
    let r0 = max(u.p0_r0.z, EPS);
    let r1 = max(u.p1_r1.z, EPS);
    let stamp_interval = max(u.stamp.x, EPS);
    let noise_factor = u.stamp.y;
    let rotation_factor = u.stamp.z;
    let stamp_mode = i32(floor(u.segment.z + 0.5));
    let l0 = u.segment.x;
    let l1 = u.segment.y;

    let tangent = normalize(p1 - p0);
    let normal = vec2(-tangent.y, tangent.x);
    let len = distance(p1, p0);
    if len <= EPS {
        return vec4(0.0, 0.0, 0.0, 0.0);
    }
    let p_local = vec2(dot(p - p0, tangent), dot(p - p0, normal));
    let d0 = distance(p, p0);
    let d1 = distance(p, p1);
    let d0cos = p_local.x / max(d0, EPS);
    let d1cos = (p_local.x - len) / max(d1, EPS);

    // Same geometry window as brush.ts: solve where a disk footprint can affect current pixel.
    let cos_theta = (r0 - r1) / len;
    // Match brush.ts corner removal to keep effective footprint consistent.
    if d0cos < cos_theta && d0 > r0 {
        return vec4(0.0, 0.0, 0.0, 0.0);
    }
    if d1cos > cos_theta && d1 > r1 {
        return vec4(0.0, 0.0, 0.0, 0.0);
    }
    let a = 1.0 - cos_theta * cos_theta;
    let b = 2.0 * (r0 * cos_theta - p_local.x);
    let c = p_local.x * p_local.x + p_local.y * p_local.y - r0 * r0;
    let delta = b * b - 4.0 * a * c;
    if delta <= 0.0 || abs(a) <= EPS {
        return vec4(0.0, 0.0, 0.0, 0.0);
    }

    let root = sqrt(delta);
    let temp = b + sign(b) * root;
    if abs(temp) <= EPS {
        return vec4(0.0, 0.0, 0.0, 0.0);
    }
    let x1 = -2.0 * c / temp;
    let x2 = -temp / (2.0 * a);
    let effect_front = min(x1, x2);
    let effect_back = max(x1, x2);

    let index0 = l0 / stamp_interval;
    var start_index: f32;
    if effect_front <= 0.0 {
        start_index = ceil(index0);
    } else {
        start_index = ceil(index0 + x2n(effect_front, len, r0, r1, stamp_interval, stamp_mode));
    }
    let index1 = l1 / stamp_interval;
    let back_index = x2n(effect_back, len, r0, r1, stamp_interval, stamp_mode) + index0;
    let end_index = min(index1, back_index);
    if start_index > end_index {
        return vec4(0.0, 0.0, 0.0, 0.0);
    }

    var alpha_acc = 0.0;
    var curr_index = start_index;
    for (var i = 0; i < 128; i = i + 1) {
        let curr_x = n2x(curr_index - index0, len, r0, r1, stamp_interval, stamp_mode);
        let curr_r = r0 - cos_theta * curr_x;
        if curr_r > EPS {
            let d = distance(p_local, vec2(curr_x, 0.0));
            var stamp_local = p_local - vec2(curr_x, 0.0);
            let angle = rotation_factor * radians(360.0 * fract(sin(curr_index) * 1.0));
            stamp_local = rotate2(stamp_local, angle);
            let uv = (stamp_local / curr_r + vec2(1.0, 1.0)) * 0.5;
            let in_uv = all(uv >= vec2(0.0, 0.0)) && all(uv <= vec2(1.0, 1.0));
            // Use explicit LOD to avoid uniform-control-flow requirement of textureSample.
            let tex_alpha = select(0.0, textureSampleLevel(t_stamp, s_stamp, uv, 0.0).a, in_uv);
            let disk_alpha = 1.0 - smoothstep(curr_r * 0.7, curr_r, d);
            let opacity_noise = noise_factor * fbm2(uv * 50.0);
            let stamp_alpha = clamp(tex_alpha - opacity_noise, 0.0, 1.0) * disk_alpha;
            let opacity = clamp(stamp_alpha * u.stroke_color.a, 0.0, 1.0);
            alpha_acc = alpha_acc * (1.0 - opacity) + opacity;
        }
        curr_index = curr_index + 1.0;
        if curr_index > end_index {
            break;
        }
    }

    if alpha_acc < 1e-4 {
        return vec4(0.0, 0.0, 0.0, 0.0);
    }
    return vec4(u.stroke_color.rgb, alpha_acc);
}
"#;

fn mat3_mul(a: &[[f64; 3]; 3], b: &[[f64; 3]; 3]) -> [[f64; 3]; 3] {
    let mut r = [[0.0_f64; 3]; 3];
    for i in 0..3 {
        for j in 0..3 {
            for k in 0..3 {
                r[i][j] += a[i][k] * b[k][j];
            }
        }
    }
    r
}

fn world_from_clip_matrix(inv: Affine, width: u32, height: u32) -> [[f32; 3]; 3] {
    let w = width.max(1) as f64;
    let h = height.max(1) as f64;
    let c = inv.as_coeffs();
    let (a, b, c2, d, e, f) = (c[0], c[1], c[2], c[3], c[4], c[5]);
    let inv_m = [[a, c2, e], [b, d, f], [0.0, 0.0, 1.0]];
    let p = [
        [w / 2.0, 0.0, w / 2.0],
        [0.0, -h / 2.0, h / 2.0],
        [0.0, 0.0, 1.0],
    ];
    let m = mat3_mul(&inv_m, &p);
    [
        [m[0][0] as f32, m[0][1] as f32, m[0][2] as f32],
        [m[1][0] as f32, m[1][1] as f32, m[1][2] as f32],
        [m[2][0] as f32, m[2][1] as f32, m[2][2] as f32],
    ]
}

pub struct BrushPass {
    pipeline: RenderPipeline,
    layout: BindGroupLayout,
    uniform_buf: Buffer,
    sampler: Sampler,
    stamp_texture: Texture,
    stamp_view: TextureView,
    bind_group: BindGroup,
    /// When false, `stamp_texture` is the shared 1×1 default; skip realloc on repeated `update_stamp_texture(None)`.
    stamp_is_custom: bool,
}

impl BrushPass {
    fn create_default_stamp_texture(device: &Device, queue: &wgpu::Queue) -> (Texture, TextureView) {
        let texture = device.create_texture(&TextureDescriptor {
            label: Some("brush_stamp_default"),
            size: wgpu::Extent3d {
                width: 1,
                height: 1,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: TextureDimension::D2,
            format: TextureFormat::Rgba8Unorm,
            usage: TextureUsages::TEXTURE_BINDING | TextureUsages::COPY_DST,
            view_formats: &[],
        });
        let white = [255u8, 255, 255, 255];
        queue.write_texture(
            wgpu::TexelCopyTextureInfo {
                texture: &texture,
                mip_level: 0,
                origin: wgpu::Origin3d::ZERO,
                aspect: wgpu::TextureAspect::All,
            },
            &white,
            wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(4),
                rows_per_image: Some(1),
            },
            wgpu::Extent3d {
                width: 1,
                height: 1,
                depth_or_array_layers: 1,
            },
        );
        let view = texture.create_view(&TextureViewDescriptor::default());
        (texture, view)
    }

    fn rebuild_bind_group(&mut self, device: &Device) {
        self.bind_group = device.create_bind_group(&BindGroupDescriptor {
            label: Some("brush_bind_group"),
            layout: &self.layout,
            entries: &[
                BindGroupEntry {
                    binding: 0,
                    resource: self.uniform_buf.as_entire_binding(),
                },
                BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&self.stamp_view),
                },
                BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&self.sampler),
                },
            ],
        });
    }

    pub fn new(device: &Device, queue: &wgpu::Queue) -> Self {
        let module = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("brush_pass"),
            source: ShaderSource::Wgsl(WGSL.into()),
        });

        let layout = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("brush_uniform_layout"),
            entries: &[
                BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: BindingType::Buffer {
                        ty: BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: true },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: BindingType::Sampler(SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("brush_pl"),
            bind_group_layouts: &[&layout],
            immediate_size: 0,
        });

        let pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("brush_pipeline"),
            layout: Some(&pipeline_layout),
            vertex: VertexState {
                module: &module,
                entry_point: Some("brush_vs"),
                compilation_options: PipelineCompilationOptions::default(),
                buffers: &[],
            },
            fragment: Some(FragmentState {
                module: &module,
                entry_point: Some("brush_fs"),
                compilation_options: PipelineCompilationOptions::default(),
                targets: &[Some(ColorTargetState {
                    format: TextureFormat::Rgba8Unorm,
                    blend: Some(wgpu::BlendState::ALPHA_BLENDING),
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

        let uniform_buf = device.create_buffer(&BufferDescriptor {
            label: Some("brush_uniforms"),
            size: 128,
            usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let sampler = device.create_sampler(&SamplerDescriptor {
            label: Some("brush_stamp_sampler"),
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });
        let (stamp_texture, stamp_view) = Self::create_default_stamp_texture(device, queue);
        let bind_group = device.create_bind_group(&BindGroupDescriptor {
            label: Some("brush_bind_group"),
            layout: &layout,
            entries: &[
                BindGroupEntry {
                    binding: 0,
                    resource: uniform_buf.as_entire_binding(),
                },
                BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&stamp_view),
                },
                BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&sampler),
                },
            ],
        });
        Self {
            pipeline,
            layout,
            uniform_buf,
            sampler,
            stamp_texture,
            stamp_view,
            bind_group,
            stamp_is_custom: false,
        }
    }

    pub fn update_stamp_texture(
        &mut self,
        device: &Device,
        queue: &wgpu::Queue,
        rgba: Option<(&[u8], u32, u32)>,
    ) {
        if let Some((data, w, h)) = rgba {
            if w > 0 && h > 0 && data.len() >= (w as usize * h as usize * 4) {
                self.stamp_texture = device.create_texture(&TextureDescriptor {
                    label: Some("brush_stamp_texture"),
                    size: wgpu::Extent3d {
                        width: w,
                        height: h,
                        depth_or_array_layers: 1,
                    },
                    mip_level_count: 1,
                    sample_count: 1,
                    dimension: TextureDimension::D2,
                    format: TextureFormat::Rgba8Unorm,
                    usage: TextureUsages::TEXTURE_BINDING | TextureUsages::COPY_DST,
                    view_formats: &[],
                });
                queue.write_texture(
                    wgpu::TexelCopyTextureInfo {
                        texture: &self.stamp_texture,
                        mip_level: 0,
                        origin: wgpu::Origin3d::ZERO,
                        aspect: wgpu::TextureAspect::All,
                    },
                    data,
                    wgpu::TexelCopyBufferLayout {
                        offset: 0,
                        bytes_per_row: Some(4 * w),
                        rows_per_image: Some(h),
                    },
                    wgpu::Extent3d {
                        width: w,
                        height: h,
                        depth_or_array_layers: 1,
                    },
                );
                self.stamp_view = self.stamp_texture.create_view(&TextureViewDescriptor::default());
                self.stamp_is_custom = true;
                self.rebuild_bind_group(device);
                return;
            }
        }
        if !self.stamp_is_custom {
            return;
        }
        let (tex, view) = Self::create_default_stamp_texture(device, queue);
        self.stamp_texture = tex;
        self.stamp_view = view;
        self.stamp_is_custom = false;
        self.rebuild_bind_group(device);
    }

    pub fn write_uniforms_disabled(
        &self,
        queue: &wgpu::Queue,
        inv_transform: Affine,
        width: u32,
        height: u32,
    ) {
        let m = world_from_clip_matrix(inv_transform, width, height);
        let col0 = [m[0][0], m[1][0], m[2][0], 0.0_f32];
        let col1 = [m[0][1], m[1][1], m[2][1], 0.0_f32];
        let col2 = [m[0][2], m[1][2], m[2][2], 0.0_f32];
        let stroke_color = [0.0_f32, 0.0, 0.0, 0.0];
        let p0_r0 = [0.0_f32, 0.0, 1.0, 0.0];
        let p1_r1 = [0.0_f32, 0.0, 1.0, 0.0];
        let stamp = [0.0_f32, 0.0, 0.0, 0.0];
        let segment = [0.0_f32, 0.0, 0.0, 0.0];

        let mut raw = [0u8; 128];
        fn pack4(raw: &mut [u8], off: usize, v: [f32; 4]) {
            for i in 0..4 {
                raw[off + i * 4..off + i * 4 + 4].copy_from_slice(&v[i].to_le_bytes());
            }
        }
        pack4(&mut raw, 0, col0);
        pack4(&mut raw, 16, col1);
        pack4(&mut raw, 32, col2);
        pack4(&mut raw, 48, stroke_color);
        pack4(&mut raw, 64, p0_r0);
        pack4(&mut raw, 80, p1_r1);
        pack4(&mut raw, 96, stamp);
        pack4(&mut raw, 112, segment);
        queue.write_buffer(&self.uniform_buf, 0, &raw);
    }

    pub fn write_uniforms_segment(
        &self,
        queue: &wgpu::Queue,
        inv_transform: Affine,
        width: u32,
        height: u32,
        stroke_color: [f32; 4],
        p0: [f32; 2],
        r0: f32,
        p1: [f32; 2],
        r1: f32,
        l0: f32,
        l1: f32,
        stamp_interval: f32,
        stamp_mode_ratio: bool,
        stamp_noise_factor: f32,
        stamp_rotation_factor: f32,
    ) {
        let m = world_from_clip_matrix(inv_transform, width, height);
        let col0 = [m[0][0], m[1][0], m[2][0], 0.0_f32];
        let col1 = [m[0][1], m[1][1], m[2][1], 0.0_f32];
        let col2 = [m[0][2], m[1][2], m[2][2], 0.0_f32];
        let p0_r0 = [p0[0], p0[1], r0.max(1e-6), 0.0];
        let p1_r1 = [p1[0], p1[1], r1.max(1e-6), 0.0];
        let stamp = [
            stamp_interval.max(1e-6),
            stamp_noise_factor.max(0.0),
            stamp_rotation_factor,
            1.0,
        ];
        let stamp_mode = if stamp_mode_ratio { 1.0 } else { 0.0 };
        let segment = [l0.max(0.0), l1.max(l0), stamp_mode, 0.0];

        let mut raw = [0u8; 128];
        fn pack4(raw: &mut [u8], off: usize, v: [f32; 4]) {
            for i in 0..4 {
                raw[off + i * 4..off + i * 4 + 4].copy_from_slice(&v[i].to_le_bytes());
            }
        }
        pack4(&mut raw, 0, col0);
        pack4(&mut raw, 16, col1);
        pack4(&mut raw, 32, col2);
        pack4(&mut raw, 48, stroke_color);
        pack4(&mut raw, 64, p0_r0);
        pack4(&mut raw, 80, p1_r1);
        pack4(&mut raw, 96, stamp);
        pack4(&mut raw, 112, segment);
        queue.write_buffer(&self.uniform_buf, 0, &raw);
    }

    pub fn encode_pass(&self, encoder: &mut CommandEncoder, target_view: &TextureView) {
        let mut pass = encoder.begin_render_pass(&RenderPassDescriptor {
            label: Some("brush_pass"),
            color_attachments: &[Some(RenderPassColorAttachment {
                view: target_view,
                depth_slice: None,
                resolve_target: None,
                ops: Operations {
                    load: wgpu::LoadOp::Load,
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
            multiview_mask: None,
        });
        pass.set_pipeline(&self.pipeline);
        pass.set_bind_group(0, &self.bind_group, &[]);
        pass.draw(0..3, 0..1);
    }
}
