//! Fullscreen procedural grid (WGPU) + composite with Vello output.
//! Logic aligned with `packages/ecs/src/shaders/grid.ts`.

use vello::kurbo::Affine;

use crate::types::CanvasRenderOptions;
use vello::wgpu::{
    self, BindGroup, BindGroupDescriptor, BindGroupEntry, BindGroupLayout,
    BindGroupLayoutDescriptor, BindGroupLayoutEntry, BindingResource, BindingType,
    Buffer, BufferBindingType, BufferDescriptor, BufferUsages, ColorTargetState,
    ColorWrites, CommandEncoder, Device, FragmentState, FrontFace, MultisampleState,
    Operations, PipelineCompilationOptions, PipelineLayoutDescriptor, PrimitiveState,
    RenderPassColorAttachment, RenderPassDescriptor, RenderPipeline, RenderPipelineDescriptor,
    Sampler, SamplerBindingType, SamplerDescriptor, ShaderModuleDescriptor, ShaderSource,
    Texture, TextureDescriptor, TextureDimension, TextureFormat, TextureSampleType,
    TextureUsages, TextureView, TextureViewDimension, VertexState,
};

const WGSL: &str = r#"
struct GridUniforms {
    col0: vec4<f32>,
    col1: vec4<f32>,
    col2: vec4<f32>,
    background: vec4<f32>,
    grid_color: vec4<f32>,
    zoom_style: vec4<f32>,
}

@group(0) @binding(0) var<uniform> u: GridUniforms;

struct VsOut {
    @builtin(position) clip_pos: vec4<f32>,
    @location(0) ndc: vec2<f32>,
}

@vertex
fn grid_vs(@builtin(vertex_index) vi: u32) -> VsOut {
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

const CHECKERBOARD_STYLE_NONE: i32 = 0;
const CHECKERBOARD_STYLE_GRID: i32 = 1;
const CHECKERBOARD_STYLE_DOTS: i32 = 2;
const BASE_GRID_PIXEL_SIZE: f32 = 100.0;
const BASE_DOT_SIZE: f32 = 8.0;

fn scale_grid_size(zoom: f32) -> vec2<f32> {
    if zoom < 0.125 {
        return vec2(BASE_GRID_PIXEL_SIZE * 125.0, 0.125);
    } else if zoom < 0.25 {
        return vec2(BASE_GRID_PIXEL_SIZE * 25.0, 0.25);
    } else if zoom < 0.5 {
        return vec2(BASE_GRID_PIXEL_SIZE * 5.0, 0.5);
    }
    return vec2(BASE_GRID_PIXEL_SIZE, 4.0);
}

fn render_grid_checkerboard(coord: vec2<f32>) -> vec4<f32> {
    var alpha: f32 = 0.0;
    let zoom = u.zoom_style.x;
    let size = scale_grid_size(zoom);
    let grid_size1 = size.x;
    let grid_size2 = grid_size1 / 10.0;
    let zoom_step = size.y;
    let style = i32(floor(u.zoom_style.y + 0.5));

    if style == CHECKERBOARD_STYLE_GRID {
        let fw = fwidth(coord);
        let grid1 = abs(fract(coord / grid_size1 - 0.5) - 0.5) / fw * grid_size1 / 2.0;
        let grid2 = abs(fract(coord / grid_size2 - 0.5) - 0.5) / fw * grid_size2;
        let v1 = 1.0 - min(min(grid1.x, grid1.y), 1.0);
        let v2 = 1.0 - min(min(grid2.x, grid2.y), 1.0);
        if v1 > 0.0 {
            alpha = v1;
        } else {
            alpha = v2 * clamp(zoom / zoom_step, 0.0, 1.0);
        }
    } else if style == CHECKERBOARD_STYLE_DOTS {
        let fw = fwidth(coord);
        let grid2 = abs(fract(coord / grid_size2 - 0.5) - 0.5) / fw * grid_size2;
        let zoom_step_d = scale_grid_size(zoom).y;
        alpha = 1.0 - smoothstep(0.0, 1.0, length(grid2) - BASE_DOT_SIZE * zoom / zoom_step_d);
    }

    return mix(u.background, u.grid_color, alpha);
}

@fragment
fn grid_fs(i: VsOut) -> @location(0) vec4<f32> {
    let cx = i.ndc.x;
    let cy = i.ndc.y;
    let coord = vec2(
        u.col0.x * cx + u.col1.x * cy + u.col2.x,
        u.col0.y * cx + u.col1.y * cy + u.col2.y,
    );
    return render_grid_checkerboard(coord);
}

@group(0) @binding(0) var t_bg: texture_2d<f32>;
@group(0) @binding(1) var t_vello: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

@vertex
fn composite_vs(@builtin(vertex_index) vi: u32) -> VsOut {
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
fn composite_fs(i: VsOut) -> @location(0) vec4<f32> {
    let uv = vec2(i.ndc.x * 0.5 + 0.5, 0.5 - i.ndc.y * 0.5);
    let bg = textureSample(t_bg, samp, uv);
    let fg = textureSample(t_vello, samp, uv);
    let a = clamp(fg.a, 0.0, 1.0);
    // Vello 离屏层为预乘 RGBA；须用预乘 over，勿再用 `fg.rgb * a`（会二次乘 alpha）。
    let rgb = fg.rgb + bg.rgb * (1.0 - a);
    return vec4(rgb, 1.0);
}
"#;

/// Intermediate textures: grid background, Vello layer, and composite output (render target).
/// Vello's `RenderSurface::target_view` is compute-only (no `RENDER_ATTACHMENT`), so composite
/// must write here; the blitter then copies `composite_view` → swapchain.
pub struct GridLayerTextures {
    pub width: u32,
    pub height: u32,
    pub bg: Texture,
    pub bg_view: TextureView,
    pub vello: Texture,
    pub vello_view: TextureView,
    pub composite: Texture,
    pub composite_view: TextureView,
}

impl GridLayerTextures {
    pub fn new(device: &Device, width: u32, height: u32) -> Self {
        let size = wgpu::Extent3d {
            width,
            height,
            depth_or_array_layers: 1,
        };
        let desc_bg = TextureDescriptor {
            label: Some("grid_bg"),
            size,
            mip_level_count: 1,
            sample_count: 1,
            dimension: TextureDimension::D2,
            format: TextureFormat::Rgba8Unorm,
            usage: TextureUsages::RENDER_ATTACHMENT | TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        };
        let bg = device.create_texture(&desc_bg);
        let bg_view = bg.create_view(&wgpu::TextureViewDescriptor::default());

        let desc_vello = TextureDescriptor {
            label: Some("vello_layer"),
            size,
            mip_level_count: 1,
            sample_count: 1,
            dimension: TextureDimension::D2,
            format: TextureFormat::Rgba8Unorm,
            usage: TextureUsages::STORAGE_BINDING | TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        };
        let vello = device.create_texture(&desc_vello);
        let vello_view = vello.create_view(&wgpu::TextureViewDescriptor::default());

        let desc_composite = TextureDescriptor {
            label: Some("grid_composite_out"),
            size,
            mip_level_count: 1,
            sample_count: 1,
            dimension: TextureDimension::D2,
            format: TextureFormat::Rgba8Unorm,
            usage: TextureUsages::RENDER_ATTACHMENT | TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        };
        let composite = device.create_texture(&desc_composite);
        let composite_view = composite.create_view(&wgpu::TextureViewDescriptor::default());

        Self {
            width,
            height,
            bg,
            bg_view,
            vello,
            vello_view,
            composite,
            composite_view,
        }
    }
}

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

/// NDC → 帧缓冲 **物理像素** `(px, py)`（与 `GpuRcPrim.inv = inverse(canvas_transform * world)` 左乘一致）。
/// 网格/背景等「画布空间」应继续用 [`world_from_clip_matrix`]（`inverse(transform) * pixel`）。
pub fn pixel_from_ndc_matrix(width: u32, height: u32) -> [[f32; 3]; 3] {
    let w = width.max(1) as f64;
    let h = height.max(1) as f64;
    let p = [
        [w / 2.0, 0.0, w / 2.0],
        [0.0, -h / 2.0, h / 2.0],
        [0.0, 0.0, 1.0],
    ];
    [
        [p[0][0] as f32, p[0][1] as f32, p[0][2] as f32],
        [p[1][0] as f32, p[1][1] as f32, p[1][2] as f32],
        [p[2][0] as f32, p[2][1] as f32, p[2][2] as f32],
    ]
}

/// `world.xy = M * vec3(ndc.xy, 1)` 与 `inverse(transform) * pixel` 一致（画布/相机空间，供网格等）。
pub fn world_from_clip_matrix(inv: Affine, width: u32, height: u32) -> [[f32; 3]; 3] {
    let w = width.max(1) as f64;
    let h = height.max(1) as f64;
    let c = inv.as_coeffs();
    let (a, b, c2, d, e, f) = (c[0], c[1], c[2], c[3], c[4], c[5]);
    let inv_m = [
        [a, c2, e],
        [b, d, f],
        [0.0, 0.0, 1.0],
    ];
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

pub struct GridPass {
    grid_pipeline: RenderPipeline,
    composite_pipeline: RenderPipeline,
    composite_layout: BindGroupLayout,
    sampler: Sampler,
    uniform_buf: Buffer,
    grid_bind_group: BindGroup,
}

impl GridPass {
    pub fn new(device: &Device) -> Self {
        let module = device.create_shader_module(ShaderModuleDescriptor {
            label: Some("grid_pass"),
            source: ShaderSource::Wgsl(WGSL.into()),
        });

        let grid_layout = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("grid_uniform_layout"),
            entries: &[BindGroupLayoutEntry {
                binding: 0,
                visibility: wgpu::ShaderStages::FRAGMENT,
                ty: BindingType::Buffer {
                    ty: BufferBindingType::Uniform,
                    has_dynamic_offset: false,
                    min_binding_size: None,
                },
                count: None,
            }],
        });

        let grid_pipeline_layout = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("grid_pl"),
            bind_group_layouts: &[&grid_layout],
            immediate_size: 0,
        });

        let grid_pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("grid_pipeline"),
            layout: Some(&grid_pipeline_layout),
            vertex: VertexState {
                module: &module,
                entry_point: Some("grid_vs"),
                compilation_options: PipelineCompilationOptions::default(),
                buffers: &[],
            },
            fragment: Some(FragmentState {
                module: &module,
                entry_point: Some("grid_fs"),
                compilation_options: PipelineCompilationOptions::default(),
                targets: &[Some(ColorTargetState {
                    format: TextureFormat::Rgba8Unorm,
                    blend: Some(wgpu::BlendState::REPLACE),
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

        let composite_layout = device.create_bind_group_layout(&BindGroupLayoutDescriptor {
            label: Some("composite_layout"),
            entries: &[
                BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: BindingType::Texture {
                        sample_type: TextureSampleType::Float { filterable: true },
                        view_dimension: TextureViewDimension::D2,
                        multisampled: false,
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

        let composite_pl = device.create_pipeline_layout(&PipelineLayoutDescriptor {
            label: Some("composite_pl"),
            bind_group_layouts: &[&composite_layout],
            immediate_size: 0,
        });

        let composite_pipeline = device.create_render_pipeline(&RenderPipelineDescriptor {
            label: Some("composite_pipeline"),
            layout: Some(&composite_pl),
            vertex: VertexState {
                module: &module,
                entry_point: Some("composite_vs"),
                compilation_options: PipelineCompilationOptions::default(),
                buffers: &[],
            },
            fragment: Some(FragmentState {
                module: &module,
                entry_point: Some("composite_fs"),
                compilation_options: PipelineCompilationOptions::default(),
                targets: &[Some(ColorTargetState {
                    format: TextureFormat::Rgba8Unorm,
                    blend: Some(wgpu::BlendState::REPLACE),
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
            label: Some("grid_uniforms"),
            size: 96,
            usage: BufferUsages::UNIFORM | BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        let grid_bind_group = device.create_bind_group(&BindGroupDescriptor {
            label: Some("grid_bg"),
            layout: &grid_layout,
            entries: &[BindGroupEntry {
                binding: 0,
                resource: uniform_buf.as_entire_binding(),
            }],
        });

        let sampler = device.create_sampler(&SamplerDescriptor {
            label: Some("grid_composite"),
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });

        Self {
            grid_pipeline,
            composite_pipeline,
            composite_layout,
            sampler,
            uniform_buf,
            grid_bind_group,
        }
    }

    pub fn write_uniforms(
        &self,
        queue: &wgpu::Queue,
        inv_transform: Affine,
        width: u32,
        height: u32,
        zoom_scale: f64,
        render_opts: &CanvasRenderOptions,
    ) {
        let m = world_from_clip_matrix(inv_transform, width, height);
        let col0 = [m[0][0], m[1][0], m[2][0], 0.0_f32];
        let col1 = [m[0][1], m[1][1], m[2][1], 0.0_f32];
        let col2 = [m[0][2], m[1][2], m[2][2], 0.0_f32];
        let style_f = (render_opts.checkboard_style.min(2)) as f32;
        let zoom_style = [zoom_scale as f32, style_f, 0.0, 0.0];
        let mut raw = [0u8; 96];
        fn pack4(raw: &mut [u8], off: usize, v: [f32; 4]) {
            for i in 0..4 {
                raw[off + i * 4..off + i * 4 + 4].copy_from_slice(&v[i].to_le_bytes());
            }
        }
        pack4(&mut raw, 0, col0);
        pack4(&mut raw, 16, col1);
        pack4(&mut raw, 32, col2);
        pack4(&mut raw, 48, render_opts.background_rgba);
        pack4(&mut raw, 64, render_opts.grid_rgba);
        pack4(&mut raw, 80, zoom_style);
        queue.write_buffer(&self.uniform_buf, 0, &raw);
    }

    pub fn encode_grid_pass(&self, encoder: &mut CommandEncoder, bg_view: &TextureView) {
        let mut pass = encoder.begin_render_pass(&RenderPassDescriptor {
            label: Some("grid_pass"),
            color_attachments: &[Some(RenderPassColorAttachment {
                view: bg_view,
                depth_slice: None,
                resolve_target: None,
                ops: Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::WHITE),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
            multiview_mask: None,
        });
        pass.set_pipeline(&self.grid_pipeline);
        pass.set_bind_group(0, &self.grid_bind_group, &[]);
        pass.draw(0..3, 0..1);
    }

    pub fn encode_composite_pass(
        &self,
        device: &Device,
        encoder: &mut CommandEncoder,
        composite_out_view: &TextureView,
        bg_view: &TextureView,
        vello_view: &TextureView,
    ) {
        let bind = device.create_bind_group(&BindGroupDescriptor {
            label: Some("grid_composite_bind"),
            layout: &self.composite_layout,
            entries: &[
                BindGroupEntry {
                    binding: 0,
                    resource: BindingResource::TextureView(bg_view),
                },
                BindGroupEntry {
                    binding: 1,
                    resource: BindingResource::TextureView(vello_view),
                },
                BindGroupEntry {
                    binding: 2,
                    resource: BindingResource::Sampler(&self.sampler),
                },
            ],
        });

        let mut pass = encoder.begin_render_pass(&RenderPassDescriptor {
            label: Some("grid_composite"),
            color_attachments: &[Some(RenderPassColorAttachment {
                view: composite_out_view,
                depth_slice: None,
                resolve_target: None,
                ops: Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::WHITE),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: None,
            timestamp_writes: None,
            occlusion_query_set: None,
            multiview_mask: None,
        });
        pass.set_pipeline(&self.composite_pipeline);
        pass.set_bind_group(0, &bind, &[]);
        pass.draw(0..3, 0..1);
    }
}
