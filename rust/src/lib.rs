//! Vello 2D GPU 渲染层：桌面与 wasm 共用逻辑。
//! Reference: [Graphite](https://github.com/GraphiteEditor/Graphite), [Vello](https://github.com/linebender/vello).

mod multi_touch;

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use serde::Deserialize;

#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;
#[cfg(target_arch = "wasm32")]
use std::collections::HashMap;
use std::sync::Arc;
use vello::kurbo::{Affine, Circle, Line, Point, RoundedRect, Stroke, Vec2};
use vello::peniko::color::palette;
use vello::peniko::{Color, Fill};
use vello::util::{RenderContext, RenderSurface};
use vello::wgpu;
use vello::{AaConfig, Renderer, RendererOptions, Scene};
use winit::application::ApplicationHandler;
use winit::dpi::LogicalSize;
use winit::event::{ElementState, MouseButton, MouseScrollDelta, WindowEvent};
use winit::event_loop::{ActiveEventLoop, EventLoop};
use winit::window::Window;

// ---------- JS API：由 JS 添加的图形，每帧从 thread_local 读取并绘制 ----------

/// JS 可创建的图形类型。坐标为其父节点局部空间（无 parentId 则为世界坐标）。
#[derive(Clone, Debug)]
pub enum JsShape {
    Rect {
        id: String,
        parent_id: Option<String>,
        z_index: i32,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        radius: f64,
        fill: [f32; 4],
        stroke: Option<(f64, [f32; 4])>,
    },
    Circle {
        id: String,
        parent_id: Option<String>,
        z_index: i32,
        cx: f64,
        cy: f64,
        r: f64,
        fill: [f32; 4],
        stroke: Option<(f64, [f32; 4])>,
    },
    Line {
        id: String,
        parent_id: Option<String>,
        z_index: i32,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        stroke_width: f64,
        color: [f32; 4],
    },
    /// 文本，属性对齐 ecs TextAttributes / TextSerializedNode
    Text {
        id: String,
        parent_id: Option<String>,
        z_index: i32,
        anchor_x: f64,
        anchor_y: f64,
        content: String,
        font_family: String,
        font_size: f64,
        font_weight: String,
        font_style: String,
        font_variant: String,
        letter_spacing: f64,
        line_height: f64,
        white_space: String,
        word_wrap: bool,
        word_wrap_width: f64,
        text_overflow: String,
        max_lines: i32,
        text_align: String,
        text_baseline: String,
        leading: f64,
        fill: [f32; 4],
    },
}

#[cfg(target_arch = "wasm32")]
impl JsShape {
    fn id(&self) -> &str {
        match self {
            JsShape::Rect { id, .. } | JsShape::Circle { id, .. } | JsShape::Line { id, .. } | JsShape::Text { id, .. } => id,
        }
    }
    fn parent_id(&self) -> Option<&str> {
        match self {
            JsShape::Rect { parent_id, .. } | JsShape::Circle { parent_id, .. } | JsShape::Line { parent_id, .. } | JsShape::Text { parent_id, .. } => parent_id.as_deref(),
        }
    }
    fn z_index(&self) -> i32 {
        match self {
            JsShape::Rect { z_index, .. } | JsShape::Circle { z_index, .. } | JsShape::Line { z_index, .. } | JsShape::Text { z_index, .. } => *z_index,
        }
    }
    /// 局部坐标系下的“原点”（用于计算相对父节点的偏移）。
    fn local_origin(&self) -> Point {
        match self {
            JsShape::Rect { x, y, .. } => Point::new(*x, *y),
            JsShape::Circle { cx, cy, .. } => Point::new(*cx, *cy),
            JsShape::Line { x1, y1, .. } => Point::new(*x1, *y1),
            JsShape::Text { anchor_x, anchor_y, .. } => Point::new(*anchor_x, *anchor_y),
        }
    }
}

#[cfg(target_arch = "wasm32")]
thread_local! {
    /// 每个画布 id 对应一份图形列表，支持多画布。
    static CANVAS_SHAPES: RefCell<HashMap<u32, Vec<JsShape>>> = RefCell::new(HashMap::new());
    static NEXT_CANVAS_ID: RefCell<u32> = RefCell::new(0);
    /// 默认字体 TTF/OTF 字节，由 registerDefaultFont 设置后才能渲染文本。
    static FONT_BYTES: RefCell<Option<Vec<u8>>> = RefCell::new(None);
}

#[cfg(target_arch = "wasm32")]
fn get_user_shapes(canvas_id: u32) -> Vec<JsShape> {
    CANVAS_SHAPES.with(|c| c.borrow().get(&canvas_id).cloned().unwrap_or_default())
}

#[cfg(target_arch = "wasm32")]
fn push_shape(canvas_id: u32, shape: JsShape) {
    CANVAS_SHAPES.with(|c| {
        c.borrow_mut().entry(canvas_id).or_default().push(shape);
    });
}

#[cfg(target_arch = "wasm32")]
fn clear_shapes_for_canvas(canvas_id: u32) {
    CANVAS_SHAPES.with(|c| {
        if let Some(list) = c.borrow_mut().get_mut(&canvas_id) {
            list.clear();
        }
    });
}

/// JS 传入的选项对象（仅 wasm，用于对象格式 API）
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RectOptions {
    #[serde(deserialize_with = "deserialize_id")]
    pub id: String,
    #[serde(default, deserialize_with = "deserialize_parent_id")]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub z_index: i32,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    #[serde(default)]
    pub radius: f64,
    #[serde(default = "default_rgba_fill")]
    pub fill: [f32; 4],
    #[serde(default)]
    pub stroke: Option<StrokeOptions>,
}

#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CircleOptions {
    #[serde(deserialize_with = "deserialize_id")]
    pub id: String,
    #[serde(default, deserialize_with = "deserialize_parent_id")]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub z_index: i32,
    pub cx: f64,
    pub cy: f64,
    pub r: f64,
    #[serde(default = "default_rgba_fill")]
    pub fill: [f32; 4],
    #[serde(default)]
    pub stroke: Option<StrokeOptions>,
}

#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineOptions {
    #[serde(deserialize_with = "deserialize_id")]
    pub id: String,
    #[serde(default, deserialize_with = "deserialize_parent_id")]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub z_index: i32,
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
    #[serde(default = "default_stroke_width")]
    pub stroke_width: f64,
    #[serde(default = "default_rgba_stroke")]
    pub color: [f32; 4],
}

#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrokeOptions {
    pub width: f64,
    #[serde(default = "default_rgba_stroke")]
    pub color: [f32; 4],
}

/// 文本选项，对齐 ecs TextAttributes / TextSerializedNode（不含 bitmapFont / physical / esdt）
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextOptions {
    #[serde(deserialize_with = "deserialize_id")]
    pub id: String,
    #[serde(default, deserialize_with = "deserialize_parent_id")]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub z_index: i32,
    #[serde(default)]
    pub anchor_x: f64,
    #[serde(default)]
    pub anchor_y: f64,
    #[serde(default)]
    pub content: String,
    #[serde(default = "default_font_family")]
    pub font_family: String,
    #[serde(default = "default_font_size")]
    pub font_size: f64,
    #[serde(default = "default_font_weight")]
    pub font_weight: String,
    #[serde(default = "default_font_style")]
    pub font_style: String,
    #[serde(default = "default_font_variant")]
    pub font_variant: String,
    #[serde(default)]
    pub letter_spacing: f64,
    #[serde(default)]
    pub line_height: f64,
    #[serde(default = "default_white_space")]
    pub white_space: String,
    #[serde(default)]
    pub word_wrap: bool,
    #[serde(default)]
    pub word_wrap_width: f64,
    #[serde(default = "default_text_overflow")]
    pub text_overflow: String,
    #[serde(default = "default_max_lines")]
    pub max_lines: i32,
    #[serde(default = "default_text_align")]
    pub text_align: String,
    #[serde(default = "default_text_baseline")]
    pub text_baseline: String,
    #[serde(default)]
    pub leading: f64,
    #[serde(default = "default_rgba_fill")]
    pub fill: [f32; 4],
}

#[cfg(target_arch = "wasm32")]
fn default_font_family() -> String {
    "sans-serif".to_string()
}
#[cfg(target_arch = "wasm32")]
fn default_font_size() -> f64 {
    12.0
}
#[cfg(target_arch = "wasm32")]
fn default_font_weight() -> String {
    "normal".to_string()
}
#[cfg(target_arch = "wasm32")]
fn default_font_style() -> String {
    "normal".to_string()
}
#[cfg(target_arch = "wasm32")]
fn default_font_variant() -> String {
    "normal".to_string()
}
#[cfg(target_arch = "wasm32")]
fn default_white_space() -> String {
    "normal".to_string()
}
#[cfg(target_arch = "wasm32")]
fn default_text_overflow() -> String {
    "clip".to_string()
}
#[cfg(target_arch = "wasm32")]
fn default_max_lines() -> i32 {
    i32::MAX
}
#[cfg(target_arch = "wasm32")]
fn default_text_align() -> String {
    "start".to_string()
}
#[cfg(target_arch = "wasm32")]
fn default_text_baseline() -> String {
    "alphabetic".to_string()
}

#[cfg(target_arch = "wasm32")]
fn default_rgba_fill() -> [f32; 4] {
    [1.0, 1.0, 1.0, 1.0]
}

#[cfg(target_arch = "wasm32")]
fn default_rgba_stroke() -> [f32; 4] {
    [0.0, 0.0, 0.0, 1.0]
}

#[cfg(target_arch = "wasm32")]
fn default_stroke_width() -> f64 {
    1.0
}

/// 反序列化 id：支持 JS 的 string 或 number。
#[cfg(target_arch = "wasm32")]
fn deserialize_id<'de, D>(d: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::Visitor;
    struct IdVisitor;
    impl<'de> Visitor<'de> for IdVisitor {
        type Value = String;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            write!(f, "string or number")
        }
        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E> {
            Ok(v.to_string())
        }
        fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E> {
            Ok(v.to_string())
        }
        fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E> {
            Ok(v.to_string())
        }
        fn visit_f64<E>(self, v: f64) -> Result<Self::Value, E> {
            Ok(v.to_string())
        }
    }
    d.deserialize_any(IdVisitor)
}

/// 反序列化 parentId：支持 string、number 或 null/undefined。
#[cfg(target_arch = "wasm32")]
fn deserialize_parent_id<'de, D>(d: D) -> Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::Visitor;
    struct ParentIdVisitor;
    impl<'de> Visitor<'de> for ParentIdVisitor {
        type Value = Option<String>;
        fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
            write!(f, "string, number, or null")
        }
        fn visit_none<E>(self) -> Result<Self::Value, E> {
            Ok(None)
        }
        fn visit_some<D2>(self, d: D2) -> Result<Self::Value, D2::Error>
        where
            D2: serde::Deserializer<'de>,
        {
            deserialize_id(d).map(Some)
        }
        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E> {
            Ok(Some(v.to_string()))
        }
        fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E> {
            Ok(Some(v.to_string()))
        }
        fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E> {
            Ok(Some(v.to_string()))
        }
        fn visit_f64<E>(self, v: f64) -> Result<Self::Value, E> {
            Ok(Some(v.to_string()))
        }
    }
    d.deserialize_option(ParentIdVisitor)
}

/// 按父子关系解析世界坐标原点；子节点坐标为父节点局部空间。
#[cfg(target_arch = "wasm32")]
fn compute_world_origins(shapes: &[JsShape]) -> HashMap<String, Point> {
    let mut map: HashMap<String, Point> = HashMap::new();
    let max_passes = shapes.len().max(1);
    for _ in 0..max_passes {
        let mut changed = false;
        for shape in shapes {
            if map.contains_key(shape.id()) {
                continue;
            }
            let local = shape.local_origin();
            let world = match shape.parent_id() {
                Some(pid) => map
                    .get(pid)
                    .map(|p| *p + local.to_vec2())
                    .unwrap_or(local),
                None => local,
            };
            map.insert(shape.id().to_string(), world);
            changed = true;
        }
        if !changed {
            break;
        }
    }
    map
}

/// 使用 skrifa 将字符串与字体字节解析为 vello 可绘制的 Glyph 列表；同时返回 peniko FontData 供 draw_glyphs 使用。
#[cfg(target_arch = "wasm32")]
fn build_text_glyphs(
    font_bytes: &[u8],
    content: &str,
    font_size_px: f32,
    letter_spacing: f32,
) -> Option<(vello::peniko::FontData, Vec<vello::Glyph>, f32)> {
    use skrifa::instance::Size;
    use skrifa::prelude::LocationRef;
    use skrifa::MetadataProvider;
    use skrifa::FontRef;
    let font_ref = FontRef::new(font_bytes).ok()?;
    let size = Size::new(font_size_px);
    let charmap = font_ref.charmap();
    let glyph_metrics = font_ref.glyph_metrics(size, LocationRef::default());
    let mut pen_x: f32 = 0.0;
    let mut glyphs = Vec::new();
    for ch in content.chars() {
        let gid = charmap.map(ch as u32)?;
        let advance = glyph_metrics.advance_width(gid).unwrap_or(0.0);
        glyphs.push(vello::Glyph {
            id: gid.to_u32(),
            x: pen_x,
            y: 0.0,
        });
        pen_x += advance + letter_spacing;
    }
    let blob = vello::peniko::Blob::from(font_bytes.to_vec());
    let font_data = vello::peniko::FontData::new(blob, 0);
    Some((font_data, glyphs, font_size_px))
}

/// 创建 surface 时使用的最小尺寸（浏览器中 canvas 可能尚未布局，inner_size 为 0）。
const MIN_SURFACE_WIDTH: u32 = 800;
const MIN_SURFACE_HEIGHT: u32 = 600;

/// 当前渲染状态：surface + 窗口。
pub struct RenderState {
    pub surface: RenderSurface<'static>,
    pub valid_surface: bool,
    pub window: Arc<Window>,
    /// wasm 多画布：该 surface 对应的 canvas id；桌面为 None。
    pub canvas_id: Option<u32>,
}

/// 最小应用：与 [vello with_winit](https://github.com/linebender/vello/blob/main/examples/with_winit/src/lib.rs) 一致，
/// 使用单一 transform (Affine) 做平移与绕光标缩放。
pub struct VelloRendererApp {
    pub context: RenderContext,
    pub renderers: Vec<Option<Renderer>>,
    pub state: Option<RenderState>,
    pub scene: Scene,
    /// 场景变换（世界 → 屏幕），平移 + 绕 prior_position 缩放。
    pub transform: Affine,
    pub mouse_pressed: bool,
    /// 上一帧光标位置，用于平移 delta 与缩放中心。
    pub prior_position: Option<Point>,
    pub touch_state: multi_touch::TouchState,
}

impl VelloRendererApp {
    pub fn new() -> Self {
        Self {
            context: RenderContext::new(),
            renderers: vec![],
            state: None,
            scene: Scene::new(),
            transform: Affine::IDENTITY,
            mouse_pressed: false,
            prior_position: None,
            touch_state: multi_touch::TouchState::new(),
        }
    }
}

impl ApplicationHandler for VelloRendererApp {
    fn resumed(&mut self, _event_loop: &ActiveEventLoop) {
        #[cfg(target_arch = "wasm32")]
        return;

        #[cfg(not(target_arch = "wasm32"))]
        {
            if self.state.is_some() {
                return;
            }
            let window = Arc::new(
                _event_loop
                    .create_window(
                        Window::default_attributes()
                            .with_inner_size(LogicalSize::new(800.0, 600.0))
                            .with_resizable(true)
                            .with_title("Vello Renderer - Infinite Canvas"),
                    )
                    .expect("create window"),
            );
            let size = window.inner_size();
            let surface_future = self.context.create_surface(
                window.clone(),
                size.width,
                size.height,
                wgpu::PresentMode::AutoVsync,
            );
            let surface = pollster::block_on(surface_future).expect("create surface");
            self.renderers
                .resize_with(self.context.devices.len(), || None);
            let dev_id = surface.dev_id;
            self.renderers[dev_id].get_or_insert_with(|| {
                Renderer::new(
                    &self.context.devices[dev_id].device,
                    RendererOptions::default(),
                )
                .expect("create renderer")
            });
            window.request_redraw();
            self.state = Some(RenderState {
                surface,
                valid_surface: true,
                window,
                canvas_id: None,
            });
        }
    }

    fn window_event(
        &mut self,
        event_loop: &ActiveEventLoop,
        window_id: winit::window::WindowId,
        event: WindowEvent,
    ) {
        let Some(state) = &mut self.state else {
            return;
        };
        if state.window.id() != window_id {
            return;
        }
        match event {
            WindowEvent::CloseRequested => event_loop.exit(),
            WindowEvent::Resized(size) => {
                if size.width != 0 && size.height != 0 {
                    let w = size.width.max(MIN_SURFACE_WIDTH);
                    let h = size.height.max(MIN_SURFACE_HEIGHT);
                    #[cfg(target_arch = "wasm32")]
                    {
                        use winit::platform::web::WindowExtWebSys;
                        if let Some(canvas) = state.window.canvas() {
                            canvas.set_width(w);
                            canvas.set_height(h);
                        }
                    }
                    self.context
                        .resize_surface(&mut state.surface, w, h);
                    state.valid_surface = true;
                    state.window.request_redraw();
                } else {
                    state.valid_surface = false;
                }
            }
            WindowEvent::RedrawRequested => {
                if !state.valid_surface {
                    return;
                }
                let canvas_id = state.canvas_id;
                let surface = &mut state.surface;
                let width = surface.config.width;
                let height = surface.config.height;
                if width == 0 || height == 0 {
                    state.window.request_redraw();
                    return;
                }
                state.window.request_redraw();
                let device_handle = &self.context.devices[surface.dev_id];

                self.scene.reset();
                add_shapes_to_scene(&mut self.scene, self.transform, width, height, canvas_id);

                self.renderers[surface.dev_id]
                    .as_mut()
                    .unwrap()
                    .render_to_texture(
                        &device_handle.device,
                        &device_handle.queue,
                        &self.scene,
                        &surface.target_view,
                        &vello::RenderParams {
                            base_color: palette::css::WHITE,
                            width,
                            height,
                            antialiasing_method: AaConfig::Msaa16,
                        },
                    )
                    .expect("render to texture");

                let surface_texture = surface
                    .surface
                    .get_current_texture()
                    .expect("get current texture");
                let mut encoder = device_handle
                    .device
                    .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                        label: Some("Surface Blit"),
                    });
                surface.blitter.copy(
                    &device_handle.device,
                    &mut encoder,
                    &surface.target_view,
                    &surface_texture
                        .texture
                        .create_view(&wgpu::TextureViewDescriptor::default()),
                );
                device_handle.queue.submit([encoder.finish()]);
                surface_texture.present();
                device_handle.device.poll(wgpu::PollType::Poll).unwrap();
            }
            WindowEvent::MouseInput { state, button, .. } => {
                if button == MouseButton::Left {
                    self.mouse_pressed = state == ElementState::Pressed;
                    if state == ElementState::Released {
                        self.prior_position = None;
                    }
                }
            }
            WindowEvent::CursorMoved { position, .. } => {
                let position = Point::new(position.x, position.y);
                if self.mouse_pressed {
                    if let Some(prior) = self.prior_position {
                        self.transform = self.transform.then_translate(position - prior);
                        state.window.request_redraw();
                    }
                }
                self.prior_position = Some(position);
            }
            WindowEvent::MouseWheel { delta, .. } => {
                const BASE: f64 = 1.05;
                const PIXELS_PER_LINE: f64 = 20.0;
                const MIN_ZOOM: f64 = 0.2;
                const MAX_ZOOM: f64 = 4.0;
                let surface = &state.surface;
                let w = surface.config.width as f64;
                let h = surface.config.height as f64;
                let zoom_center = self.prior_position.unwrap_or(Point::new(w / 2.0, h / 2.0));
                let exponent = match delta {
                    MouseScrollDelta::PixelDelta(p) => p.y / PIXELS_PER_LINE,
                    MouseScrollDelta::LineDelta(_, y) => y as f64,
                };
                let factor = BASE.powf(exponent);
                if (factor - 1.0).abs() >= 1e-9 && w >= 1.0 && h >= 1.0 {
                    let current_scale = affine_scale_factor(self.transform);
                    let new_scale = (current_scale * factor).clamp(MIN_ZOOM, MAX_ZOOM);
                    let effective_factor = new_scale / current_scale;
                    let c = zoom_center.to_vec2();
                    self.transform = Affine::translate(c)
                        * Affine::scale(effective_factor)
                        * Affine::translate(-c)
                        * self.transform;
                    state.window.request_redraw();
                }
            }
            WindowEvent::CursorLeft { .. } => {
                self.prior_position = None;
            }
            WindowEvent::Touch(touch) => {
                self.touch_state.add_event(&touch);
            }
            _ => {}
        }
    }

    fn about_to_wait(&mut self, _event_loop: &ActiveEventLoop) {
        self.touch_state.end_frame();
        if let Some(touch_info) = self.touch_state.info() {
            const MIN_ZOOM: f64 = 0.2;
            const MAX_ZOOM: f64 = 4.0;
            let current_scale = affine_scale_factor(self.transform);
            let new_scale = (current_scale * touch_info.zoom_delta).clamp(MIN_ZOOM, MAX_ZOOM);
            let effective_zoom_delta = new_scale / current_scale;
            let centre = Vec2::new(touch_info.zoom_centre.x, touch_info.zoom_centre.y);
            self.transform = Affine::translate(touch_info.translation_delta)
                * Affine::translate(centre)
                * Affine::scale(effective_zoom_delta)
                * Affine::rotate(touch_info.rotation_delta)
                * Affine::translate(-centre)
                * self.transform;
            if let Some(state) = &self.state {
                state.window.request_redraw();
            }
        }
    }
}

/// 从 Affine 提取线性缩放系数（均匀缩放时 = scale，非均匀时 ≈ 面积缩放的开方）。用于“固定像素线宽”：线宽/scale 再 stroke。
fn affine_scale_factor(affine: Affine) -> f64 {
    let det = affine.determinant();
    det.abs().sqrt()
}

/// 参考 ecs/shaders/grid.ts：在场景中绘制世界坐标下的网格（主网格 100，次网格 10），
/// 仅绘制视口可见区域，先画次网格再画主网格。
/// 线宽使用“固定像素”（strokeAttenuation）：用 transform 的缩放系数反除，使屏幕上看不随 zoom 变化。
fn add_grid_to_scene(scene: &mut Scene, transform: Affine, viewport_width: u32, viewport_height: u32) {
    const GRID_MAJOR_STEP: f64 = 100.0;
    const GRID_MINOR_STEP: f64 = 10.0;
    /// 期望的线宽（像素），实际 stroke 用 宽/scale 以抵消缩放，实现固定像素宽。
    const GRID_MINOR_WIDTH_PX: f64 = 0.35;
    const GRID_MAJOR_WIDTH_PX: f64 = 0.6;
    const GRID_MINOR_COLOR: [f32; 4] = [0.92, 0.92, 0.92, 1.0];
    const GRID_MAJOR_COLOR: [f32; 4] = [0.82, 0.82, 0.82, 1.0];

    let scale = affine_scale_factor(transform).max(1e-6);
    let minor_width = (GRID_MINOR_WIDTH_PX / scale).max(0.08);
    let major_width = (GRID_MAJOR_WIDTH_PX / scale).max(0.12);

    let inv = transform.inverse();
    let w = viewport_width as f64;
    let h = viewport_height as f64;
    let p00 = inv * Point::new(0.0, 0.0);
    let p10 = inv * Point::new(w, 0.0);
    let p11 = inv * Point::new(w, h);
    let p01 = inv * Point::new(0.0, h);
    let min_x = p00.x.min(p10.x).min(p11.x).min(p01.x) - GRID_MAJOR_STEP;
    let max_x = p00.x.max(p10.x).max(p11.x).max(p01.x) + GRID_MAJOR_STEP;
    let min_y = p00.y.min(p10.y).min(p11.y).min(p01.y) - GRID_MAJOR_STEP;
    let max_y = p00.y.max(p10.y).max(p11.y).max(p01.y) + GRID_MAJOR_STEP;

    let minor_color = Color::new(GRID_MINOR_COLOR);
    let major_color = Color::new(GRID_MAJOR_COLOR);

    // 次网格（先画，在下层）
    let step = GRID_MINOR_STEP;
    let start_x = (min_x / step).floor() * step;
    let start_y = (min_y / step).floor() * step;
    let mut x = start_x;
    while x <= max_x {
        let line = Line::new((x, min_y), (x, max_y));
        scene.stroke(
            &Stroke::new(minor_width),
            transform,
            minor_color,
            None,
            &line,
        );
        x += step;
    }
    let mut y = start_y;
    while y <= max_y {
        let line = Line::new((min_x, y), (max_x, y));
        scene.stroke(
            &Stroke::new(minor_width),
            transform,
            minor_color,
            None,
            &line,
        );
        y += step;
    }

    // 主网格（后画，在上层）
    let step = GRID_MAJOR_STEP;
    let start_x = (min_x / step).floor() * step;
    let start_y = (min_y / step).floor() * step;
    let mut x = start_x;
    while x <= max_x {
        let line = Line::new((x, min_y), (x, max_y));
        scene.stroke(
            &Stroke::new(major_width),
            transform,
            major_color,
            None,
            &line,
        );
        x += step;
    }
    let mut y = start_y;
    while y <= max_y {
        let line = Line::new((min_x, y), (max_x, y));
        scene.stroke(
            &Stroke::new(major_width),
            transform,
            major_color,
            None,
            &line,
        );
        y += step;
    }
}

#[allow(unused_variables)]
fn add_shapes_to_scene(
    scene: &mut Scene,
    transform: Affine,
    viewport_width: u32,
    viewport_height: u32,
    canvas_id: Option<u32>,
) {
    add_grid_to_scene(scene, transform, viewport_width, viewport_height);
    #[cfg(target_arch = "wasm32")]
    if let Some(cid) = canvas_id {
        let mut shapes = get_user_shapes(cid);
        shapes.sort_by_key(|s| s.z_index());
        let world_origins = compute_world_origins(&shapes);
        for shape in shapes {
            let world_origin = world_origins
                .get(shape.id())
                .copied()
                .unwrap_or_else(|| shape.local_origin());
            add_js_shape_to_scene(scene, transform, shape, world_origin);
        }
    }
}

#[cfg(target_arch = "wasm32")]
fn add_js_shape_to_scene(scene: &mut Scene, transform: Affine, shape: JsShape, world_origin: Point) {
    let local_origin = shape.local_origin();
    let offset = world_origin.to_vec2() - local_origin.to_vec2();
    let shape_transform = transform * Affine::translate(offset);
    match shape {
        JsShape::Rect {
            x,
            y,
            width,
            height,
            radius,
            fill,
            stroke,
            ..
        } => {
            let geom = if radius > 0.0 {
                vello::kurbo::RoundedRect::new(x, y, x + width, y + height, radius)
            } else {
                vello::kurbo::RoundedRect::from_rect(
                    vello::kurbo::Rect::new(x, y, x + width, y + height),
                    0.0,
                )
            };
            let color = Color::new(fill);
            scene.fill(Fill::NonZero, shape_transform, color, None, &geom);
            if let Some((w, s)) = stroke {
                scene.stroke(
                    &Stroke::new(w),
                    shape_transform,
                    Color::new(s),
                    None,
                    &geom,
                );
            }
        }
        JsShape::Circle { cx, cy, r, fill, stroke, .. } => {
            let circle = Circle::new((cx, cy), r);
            scene.fill(Fill::NonZero, shape_transform, Color::new(fill), None, &circle);
            if let Some((w, s)) = stroke {
                scene.stroke(&Stroke::new(w), shape_transform, Color::new(s), None, &circle);
            }
        }
        JsShape::Line {
            x1,
            y1,
            x2,
            y2,
            stroke_width,
            color,
            ..
        } => {
            let line = Line::new((x1, y1), (x2, y2));
            scene.stroke(
                &Stroke::new(stroke_width),
                shape_transform,
                Color::new(color),
                None,
                &line,
            );
        }
        JsShape::Text {
            content,
            font_size,
            letter_spacing,
            fill,
            ..
        } => {
            let font_bytes = FONT_BYTES.with(|c| c.borrow().clone());
            if let Some(bytes) = font_bytes {
                if let Some((font_data, glyphs, size)) =
                    build_text_glyphs(&bytes, &content, font_size as f32, letter_spacing as f32)
                {
                    let color = Color::new(fill);
                    scene
                        .draw_glyphs(&font_data)
                        .font_size(size)
                        .transform(shape_transform)
                        .brush(color)
                        .draw(Fill::NonZero, glyphs.into_iter());
                }
            }
        }
    }
}

/// 桌面入口：阻塞式 event loop，在 resumed 里 block_on(create_surface)。
#[cfg(not(target_arch = "wasm32"))]
pub fn run_native() -> anyhow::Result<()> {
    let mut app = VelloRendererApp::new();
    let event_loop = EventLoop::new()?;
    event_loop.run_app(&mut app).expect("event loop");
    Ok(())
}

/// wasm 入口：异步创建 surface 后再 run_app。创建完成后会调用 on_ready(canvasId)，之后 addRect/addCircle 等需传入该 id。
#[cfg(target_arch = "wasm32")]
#[allow(deprecated)] // EventLoop::create_window 在 wasm 初始化时仍需使用
pub async fn run_wasm_async(canvas: web_sys::HtmlCanvasElement, on_ready: js_sys::Function) {
    use winit::platform::web::WindowAttributesExtWebSys;

    fn log_vello(msg: &str) {
        web_sys::console::log_1(&format!("[vello] {}", msg).into());
    }
    fn err_vello(msg: &str) {
        web_sys::console::error_1(&format!("[vello] {}", msg).into());
    }

    log_vello("run_wasm_async: start");

    let event_loop = match EventLoop::new() {
        Ok(el) => {
            log_vello("EventLoop::new ok");
            el
        }
        Err(e) => {
            err_vello(&format!("EventLoop::new failed: {}", e));
            return;
        }
    };
    let canvas_id = NEXT_CANVAS_ID.with(|c| {
        let mut id = c.borrow_mut();
        let next = *id;
        *id = id.saturating_add(1);
        next
    });
    log_vello(&format!("canvas_id = {}", canvas_id));

    CANVAS_SHAPES.with(|c| {
        c.borrow_mut().insert(canvas_id, Vec::new());
    });

    let mut attrs = Window::default_attributes()
        .with_inner_size(LogicalSize::new(800.0, 600.0))
        .with_resizable(true)
        .with_title("Vello Renderer - Infinite Canvas");
    attrs = attrs.with_canvas(Some(canvas));
    let window = match event_loop.create_window(attrs) {
        Ok(w) => {
            log_vello("create_window ok");
            Arc::new(w)
        }
        Err(e) => {
            err_vello(&format!("create_window failed: {}", e));
            return;
        }
    };
    let (width, height) = {
        use winit::platform::web::WindowExtWebSys;
        if let Some(ref c) = window.canvas() {
            let w = c.width().max(MIN_SURFACE_WIDTH);
            let h = c.height().max(MIN_SURFACE_HEIGHT);
            if w == 0 || h == 0 {
                let cw = c.client_width().max(1) as u32;
                let ch = c.client_height().max(1) as u32;
                let cw = cw.max(MIN_SURFACE_WIDTH);
                let ch = ch.max(MIN_SURFACE_HEIGHT);
                c.set_width(cw);
                c.set_height(ch);
                log_vello(&format!("canvas size was 0, set to {}x{}", cw, ch));
                (cw, ch)
            } else {
                (w, h)
            }
        } else {
            let size = window.inner_size();
            (size.width.max(MIN_SURFACE_WIDTH), size.height.max(MIN_SURFACE_HEIGHT))
        }
    };
    log_vello(&format!("surface size {}x{}", width, height));

    let mut context = RenderContext::new();
    log_vello("RenderContext::new ok, creating surface (async)...");

    let surface = match context
        .create_surface(
            window.clone(),
            width,
            height,
            wgpu::PresentMode::AutoVsync,
        )
        .await
    {
        Ok(s) => {
            log_vello("create_surface ok");
            s
        }
        Err(e) => {
            err_vello(&format!("create_surface failed: {}", e));
            return;
        }
    };

    let mut renderers: Vec<Option<Renderer>> = vec![];
    renderers.resize_with(context.devices.len(), || None);
    let dev_id = surface.dev_id;
    let renderer = match Renderer::new(
        &context.devices[dev_id].device,
        RendererOptions::default(),
    ) {
        Ok(r) => {
            log_vello("Renderer::new ok");
            r
        }
        Err(e) => {
            err_vello(&format!("Renderer::new failed: {}", e));
            return;
        }
    };
    renderers[dev_id] = Some(renderer);

    let mut app = VelloRendererApp {
        context,
        renderers,
        state: Some(RenderState {
            surface,
            valid_surface: true,
            window: window.clone(),
            canvas_id: Some(canvas_id),
        }),
        scene: Scene::new(),
        transform: Affine::IDENTITY,
        mouse_pressed: false,
        prior_position: None,
        touch_state: multi_touch::TouchState::new(),
    };
    log_vello(&format!("calling on_ready(canvas_id={})", canvas_id));
    let _ = on_ready.call1(&JsValue::NULL, &JsValue::from(canvas_id));
    window.request_redraw();
    log_vello("entering event_loop.run_app");
    let _ = event_loop.run_app(&mut app);
}

/// 使用传入的 canvas 元素启动渲染。onReady(canvasId) 在画布就绪时调用，后续 addRect/addCircle 等需传入该 canvasId。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = runWithCanvas)]
pub fn run_with_canvas(canvas: JsValue, on_ready: JsValue) {
    use wasm_bindgen::JsCast;
    let canvas: web_sys::HtmlCanvasElement = match canvas.dyn_into() {
        Ok(c) => c,
        Err(_) => {
            web_sys::console::error_1(
                &"[vello] runWithCanvas: 第一个参数必须是 HTMLCanvasElement".into(),
            );
            return;
        }
    };
    let on_ready: js_sys::Function = match on_ready.dyn_into() {
        Ok(f) => f,
        Err(_) => {
            web_sys::console::error_1(
                &"[vello] runWithCanvas: 第二个参数必须是函数 (canvasId) => void".into(),
            );
            return;
        }
    };
    wasm_bindgen_futures::spawn_local(run_wasm_async(canvas, on_ready));
}

// ---------- JS API 导出：在画布上创建图形（世界坐标，随平移/缩放一起变换） ----------

/// 添加矩形。canvas_id 由 runWithCanvas 的 onReady 回调传入；opts 同前。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addRect)]
pub fn js_add_rect(canvas_id: u32, opts: JsValue) {
    let o: RectOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addRect: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some((s.width, s.color))
        } else {
            None
        }
    });
    push_shape(canvas_id, JsShape::Rect {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        radius: o.radius,
        fill: o.fill,
        stroke,
    });
}

/// 添加圆形。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addCircle)]
pub fn js_add_circle(canvas_id: u32, opts: JsValue) {
    let o: CircleOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addCircle: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some((s.width, s.color))
        } else {
            None
        }
    });
    push_shape(canvas_id, JsShape::Circle {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        cx: o.cx,
        cy: o.cy,
        r: o.r,
        fill: o.fill,
        stroke,
    });
}

/// 添加线段。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addLine)]
pub fn js_add_line(canvas_id: u32, opts: JsValue) {
    let o: LineOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addLine: invalid options - {}", e).into());
            return;
        }
    };
    push_shape(canvas_id, JsShape::Line {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        x1: o.x1,
        y1: o.y1,
        x2: o.x2,
        y2: o.y2,
        stroke_width: o.stroke_width.max(0.5),
        color: o.color,
    });
}

/// 添加文本。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addText)]
pub fn js_add_text(canvas_id: u32, opts: JsValue) {
    let o: TextOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addText: invalid options - {}", e).into());
            return;
        }
    };
    push_shape(canvas_id, JsShape::Text {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        anchor_x: o.anchor_x,
        anchor_y: o.anchor_y,
        content: o.content,
        font_family: o.font_family,
        font_size: o.font_size,
        font_weight: o.font_weight,
        font_style: o.font_style,
        font_variant: o.font_variant,
        letter_spacing: o.letter_spacing,
        line_height: o.line_height,
        white_space: o.white_space,
        word_wrap: o.word_wrap,
        word_wrap_width: o.word_wrap_width,
        text_overflow: o.text_overflow,
        max_lines: o.max_lines,
        text_align: o.text_align,
        text_baseline: o.text_baseline,
        leading: o.leading,
        fill: o.fill,
    });
}

/// 注册默认字体（TTF/OTF 字节）。用于 addText 渲染；传入 Uint8Array 或 ArrayBuffer。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = registerDefaultFont)]
pub fn js_register_default_font(js_value: JsValue) {
    let bytes = js_sys::Uint8Array::new(&js_value).to_vec();
    FONT_BYTES.with(|c| *c.borrow_mut() = Some(bytes));
}

/// 清空指定画布上由 JS 添加的所有图形。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = clearShapes)]
pub fn js_clear_shapes(canvas_id: u32) {
    clear_shapes_for_canvas(canvas_id);
}
