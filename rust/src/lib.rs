//! Vello 2D GPU 渲染层：桌面与 wasm 共用逻辑。
//! Reference: [Graphite](https://github.com/GraphiteEditor/Graphite), [Vello](https://github.com/linebender/vello).
//!
//! 相机 transform 完全由 JS 侧通过 setCameraTransform 同步，Rust 不再监听 Mouse/Cursor/Touch 事件。

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use serde::Deserialize;

#[cfg(target_arch = "wasm32")]
use std::cell::RefCell;
#[cfg(target_arch = "wasm32")]
use std::collections::HashMap;
use std::sync::Arc;
use vello::kurbo::{Affine, BezPath, Cap, Ellipse, Join, Line, PathEl, Point, Rect, RoundedRect, Shape, Stroke, Vec2};

// roughr 用于手绘风格渲染
#[cfg(target_arch = "wasm32")]
use roughr::{core::Options, generator::Generator};
use vello::peniko::color::palette;
use vello::peniko::{Blob, Color, ColorStop, Fill, Gradient, ImageAlphaType, ImageBrush, ImageData, ImageFormat};
use vello::util::{RenderContext, RenderSurface};
use vello::wgpu;
use vello::{AaConfig, Renderer, RendererOptions, Scene};
use winit::application::ApplicationHandler;
use winit::dpi::LogicalSize;
use winit::event::WindowEvent;
use winit::event_loop::{ActiveEventLoop, EventLoop};
use winit::window::Window;

// ---------- JS API：由 JS 添加的图形，每帧从 thread_local 读取并绘制 ----------

/// ECS Mat3 的 9 个分量 (m00, m01, m02, m10, m11, m12, m20, m21, m22)。
pub type Mat3Array = [f64; 9];

/// 渐变色阶，offset 0–1，color 为 RGBA。
#[cfg(target_arch = "wasm32")]
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FillGradientStopOptions {
    pub offset: f32,
    pub color: [f32; 4],
}

/// 渐变填充选项，由 JS 解析 CSS 渐变后传入。
#[cfg(target_arch = "wasm32")]
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FillGradientOptions {
    /// "linear" | "radial" | "conic"
    pub r#type: String,
    /// 线性渐变起点
    #[serde(default)]
    pub x1: f64,
    #[serde(default)]
    pub y1: f64,
    /// 线性渐变终点
    #[serde(default)]
    pub x2: f64,
    #[serde(default)]
    pub y2: f64,
    /// 径向/圆锥渐变中心
    #[serde(default)]
    pub cx: f64,
    #[serde(default)]
    pub cy: f64,
    /// 径向渐变半径
    #[serde(default)]
    pub r: f64,
    /// 圆锥渐变角度（弧度），start_angle 到 end_angle
    #[serde(default)]
    pub start_angle: f64,
    #[serde(default)]
    pub end_angle: f64,
    pub stops: Vec<FillGradientStopOptions>,
}

/// 描边属性，用于 linecap/linejoin 等。
#[derive(Clone, Debug)]
pub struct StrokeParams {
    pub width: f64,
    pub color: [f32; 4],
    pub linecap: String,
    pub linejoin: String,
    pub miter_limit: f64,
    pub stroke_dasharray: Option<Vec<f64>>,
    pub stroke_dashoffset: f64,
}

impl StrokeParams {
    fn to_kurbo_stroke(&self) -> Stroke {
        let cap = match self.linecap.as_str() {
            "round" => Cap::Round,
            "square" => Cap::Square,
            _ => Cap::Butt,
        };
        let join = match self.linejoin.as_str() {
            "round" => Join::Round,
            "bevel" => Join::Bevel,
            _ => Join::Miter,
        };
        let mut stroke = Stroke::new(self.width)
            .with_caps(cap)
            .with_join(join)
            .with_miter_limit(self.miter_limit);
        // 添加虚线支持
        if let Some(ref dasharray) = self.stroke_dasharray {
            if dasharray.len() >= 2 {
                stroke = stroke.with_dashes(self.stroke_dashoffset, dasharray.clone());
            }
        }
        stroke
    }
    fn to_kurbo_stroke_with_width(&self, width: f64) -> Stroke {
        let cap = match self.linecap.as_str() {
            "round" => Cap::Round,
            "square" => Cap::Square,
            _ => Cap::Butt,
        };
        let join = match self.linejoin.as_str() {
            "round" => Join::Round,
            "bevel" => Join::Bevel,
            _ => Join::Miter,
        };
        let mut stroke = Stroke::new(width)
            .with_caps(cap)
            .with_join(join)
            .with_miter_limit(self.miter_limit);
        // 添加虚线支持
        if let Some(ref dasharray) = self.stroke_dasharray {
            if dasharray.len() >= 2 {
                stroke = stroke.with_dashes(self.stroke_dashoffset, dasharray.clone());
            }
        }
        stroke
    }
}

/// 渐变填充规格（与 wasm Options 解耦，供 add_js_shape_to_scene 使用）。
#[derive(Clone, Debug)]
pub struct FillGradientSpec {
    pub kind: String,
    pub x1: f64,
    pub y1: f64,
    pub x2: f64,
    pub y2: f64,
    pub cx: f64,
    pub cy: f64,
    pub r: f64,
    pub start_angle: f64,
    pub end_angle: f64,
    pub stops: Vec<(f32, [f32; 4])>,
}

/// JS 可创建的图形类型。坐标为其父节点局部空间（无 parentId 则为世界坐标）。
/// 可选 local_transform：将局部坐标变换到父空间；无则等价于 translate(x,y)。
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
        fill_gradients: Option<Vec<FillGradientSpec>>,
        stroke: Option<StrokeParams>,
        opacity: f32,
        fill_opacity: f32,
        stroke_opacity: f32,
        local_transform: Option<Mat3Array>,
        size_attenuation: bool,
        stroke_attenuation: bool,
    },
    Ellipse {
        id: String,
        parent_id: Option<String>,
        z_index: i32,
        cx: f64,
        cy: f64,
        rx: f64,
        ry: f64,
        fill: [f32; 4],
        fill_gradients: Option<Vec<FillGradientSpec>>,
        stroke: Option<StrokeParams>,
        opacity: f32,
        fill_opacity: f32,
        stroke_opacity: f32,
        local_transform: Option<Mat3Array>,
        size_attenuation: bool,
        stroke_attenuation: bool,
    },
    Line {
        id: String,
        parent_id: Option<String>,
        z_index: i32,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        stroke: StrokeParams,
        opacity: f32,
        stroke_opacity: f32,
        local_transform: Option<Mat3Array>,
        size_attenuation: bool,
        stroke_attenuation: bool,
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
        opacity: f32,
        fill_opacity: f32,
        stroke_opacity: f32,
        local_transform: Option<Mat3Array>,
        size_attenuation: bool,
        /// 预计算的文本布局缓存
        #[cfg(target_arch = "wasm32")]
        cached_layout: Option<CachedTextLayout>,
    },
    /// 图片填充的矩形，image_data 为 RGBA 像素数据。
    ImageRect {
        id: String,
        parent_id: Option<String>,
        z_index: i32,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        radius: f64,
        image_width: u32,
        image_height: u32,
        image_data: Vec<u8>,
        stroke: Option<StrokeParams>,
        opacity: f32,
        fill_opacity: f32,
        stroke_opacity: f32,
        local_transform: Option<Mat3Array>,
        size_attenuation: bool,
        stroke_attenuation: bool,
    },
    /// SVG path，d 为 path 的 d 属性（如 "M 10 10 L 100 100 Z"）。
    Path {
        id: String,
        parent_id: Option<String>,
        z_index: i32,
        d: String,
        fill: [f32; 4],
        fill_gradients: Option<Vec<FillGradientSpec>>,
        stroke: Option<StrokeParams>,
        fill_rule: String,
        opacity: f32,
        fill_opacity: f32,
        stroke_opacity: f32,
        local_transform: Option<Mat3Array>,
        size_attenuation: bool,
        stroke_attenuation: bool,
    },
    /// 折线，points 为 [[x,y],[x,y],...]。
    Polyline {
        id: String,
        parent_id: Option<String>,
        z_index: i32,
        points: Vec<[f64; 2]>,
        stroke: Option<StrokeParams>,
        opacity: f32,
        fill_opacity: f32,
        stroke_opacity: f32,
        local_transform: Option<Mat3Array>,
        size_attenuation: bool,
        stroke_attenuation: bool,
    },
    /// 组/容器，用于组织子元素。本身没有可见内容，只提供变换和层级。
    Group {
        id: String,
        parent_id: Option<String>,
        z_index: i32,
        local_transform: Option<Mat3Array>,
    },
    /// 手绘风格矩形。
    RoughRect {
        id: String,
        parent_id: Option<String>,
        z_index: i32,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        fill: [f32; 4],
        stroke: Option<StrokeParams>,
        opacity: f32,
        fill_opacity: f32,
        stroke_opacity: f32,
        local_transform: Option<Mat3Array>,
        /// roughness 参数：0 = 完美矩形，1 = 默认手绘风格，>1 = 更粗糙
        roughness: f32,
        /// bowing 参数：线条弯曲程度
        bowing: f32,
        /// 填充样式：hachure, solid, zigzag, cross-hatch, dots, dashed, zigzag-line
        fill_style: String,
        /// hachure 角度（度）
        hachure_angle: f32,
        /// hachure 间隙
        hachure_gap: f32,
        /// 曲线步数
        curve_step_count: f32,
        /// 简化程度
        simplification: f32,
    },
    /// 手绘风格椭圆/圆。
    RoughEllipse {
        id: String,
        parent_id: Option<String>,
        z_index: i32,
        cx: f64,
        cy: f64,
        rx: f64,
        ry: f64,
        fill: [f32; 4],
        stroke: Option<StrokeParams>,
        opacity: f32,
        fill_opacity: f32,
        stroke_opacity: f32,
        local_transform: Option<Mat3Array>,
        roughness: f32,
        bowing: f32,
        fill_style: String,
        hachure_angle: f32,
        hachure_gap: f32,
        curve_step_count: f32,
        simplification: f32,
    },
    /// 手绘风格线段。
    RoughLine {
        id: String,
        parent_id: Option<String>,
        z_index: i32,
        x1: f64,
        y1: f64,
        x2: f64,
        y2: f64,
        stroke: StrokeParams,
        opacity: f32,
        stroke_opacity: f32,
        local_transform: Option<Mat3Array>,
        roughness: f32,
        bowing: f32,
        simplification: f32,
    },
}

#[cfg(target_arch = "wasm32")]
impl JsShape {
    fn id(&self) -> &str {
        match self {
            JsShape::Rect { id, .. } | JsShape::Ellipse { id, .. } | JsShape::Line { id, .. } | JsShape::Text { id, .. } | JsShape::ImageRect { id, .. } | JsShape::Path { id, .. } | JsShape::Polyline { id, .. } | JsShape::Group { id, .. } | JsShape::RoughRect { id, .. } | JsShape::RoughEllipse { id, .. } | JsShape::RoughLine { id, .. } => id,
        }
    }
    fn parent_id(&self) -> Option<&str> {
        match self {
            JsShape::Rect { parent_id, .. } | JsShape::Ellipse { parent_id, .. } | JsShape::Line { parent_id, .. } | JsShape::Text { parent_id, .. } | JsShape::ImageRect { parent_id, .. } | JsShape::Path { parent_id, .. } | JsShape::Polyline { parent_id, .. } | JsShape::Group { parent_id, .. } | JsShape::RoughRect { parent_id, .. } | JsShape::RoughEllipse { parent_id, .. } | JsShape::RoughLine { parent_id, .. } => parent_id.as_deref(),
        }
    }
    fn z_index(&self) -> i32 {
        match self {
            JsShape::Rect { z_index, .. } | JsShape::Ellipse { z_index, .. } | JsShape::Line { z_index, .. } | JsShape::Text { z_index, .. } | JsShape::ImageRect { z_index, .. } | JsShape::Path { z_index, .. } | JsShape::Polyline { z_index, .. } | JsShape::Group { z_index, .. } | JsShape::RoughRect { z_index, .. } | JsShape::RoughEllipse { z_index, .. } | JsShape::RoughLine { z_index, .. } => *z_index,
        }
    }
    /// 若存在则返回 local_transform（ECS Mat3 格式）。
    fn local_transform(&self) -> Option<&Mat3Array> {
        match self {
            JsShape::Rect { local_transform, .. } | JsShape::Ellipse { local_transform, .. } | JsShape::Line { local_transform, .. } | JsShape::Text { local_transform, .. } | JsShape::ImageRect { local_transform, .. } | JsShape::Path { local_transform, .. } | JsShape::Polyline { local_transform, .. } | JsShape::Group { local_transform, .. } | JsShape::RoughRect { local_transform, .. } | JsShape::RoughEllipse { local_transform, .. } | JsShape::RoughLine { local_transform, .. } => local_transform.as_ref(),
        }
    }
    /// 局部坐标系下的"原点"（用于计算相对父节点的偏移）。
    fn local_origin(&self) -> Point {
        match self {
            JsShape::Rect { x, y, .. } | JsShape::ImageRect { x, y, .. } | JsShape::RoughRect { x, y, .. } => Point::new(*x, *y),
            JsShape::Ellipse { cx, cy, .. } | JsShape::RoughEllipse { cx, cy, .. } => Point::new(*cx, *cy),
            JsShape::Line { x1, y1, .. } | JsShape::RoughLine { x1, y1, .. } => Point::new(*x1, *y1),
            JsShape::Text { anchor_x, anchor_y, .. } => Point::new(*anchor_x, *anchor_y),
            JsShape::Path { .. } | JsShape::Polyline { .. } | JsShape::Group { .. } => Point::ORIGIN,
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
    /// 待应用的相机变换，由 setCameraTransform 设置，下一帧渲染前应用。
    static CAMERA_TRANSFORM_PENDING: RefCell<HashMap<u32, Affine>> = RefCell::new(HashMap::new());
    /// canvas_id -> Window，用于 requestRedraw 由 JS 触发重绘。
    static CANVAS_WINDOWS: RefCell<HashMap<u32, Arc<Window>>> = RefCell::new(HashMap::new());
    /// emoji 图片缓存：字符 -> (RGBA 数据, 宽度, 高度)
    static EMOJI_CACHE: RefCell<HashMap<String, (Vec<u8>, u32, u32)>> = RefCell::new(HashMap::new());
    /// 字形缓存：(文本, 字体大小) -> (FontData, glyphs, size)
    static GLYPH_CACHE: RefCell<HashMap<(String, u32), (vello::peniko::FontData, Vec<vello::Glyph>, f32)>> = RefCell::new(HashMap::new());
    /// 全局 FontContext 缓存，避免每帧重建
    static FONT_CONTEXT: RefCell<Option<parley::FontContext>> = RefCell::new(None);
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

#[cfg(target_arch = "wasm32")]
fn take_pending_camera_transform(canvas_id: Option<u32>) -> Option<Affine> {
    canvas_id.and_then(|cid| CAMERA_TRANSFORM_PENDING.with(|c| c.borrow_mut().remove(&cid)))
}

#[cfg(not(target_arch = "wasm32"))]
fn take_pending_camera_transform(_canvas_id: Option<u32>) -> Option<Affine> {
    None
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
    pub radius: f64,
    #[serde(default = "default_rgba_fill")]
    pub fill: [f32; 4],
    #[serde(default)]
    pub fill_gradient: Option<FillGradientOptions>,
    #[serde(default)]
    pub fill_gradients: Option<Vec<FillGradientOptions>>,
    #[serde(default)]
    pub stroke: Option<StrokeOptions>,
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    #[serde(default = "default_opacity")]
    pub fill_opacity: f32,
    #[serde(default = "default_opacity")]
    pub stroke_opacity: f32,
    #[serde(default, deserialize_with = "deserialize_mat3_opt")]
    pub local_transform: Option<Mat3Array>,
    #[serde(default)]
    pub size_attenuation: bool,
    #[serde(default)]
    pub stroke_attenuation: bool,
}

#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EllipseOptions {
    #[serde(deserialize_with = "deserialize_id")]
    pub id: String,
    #[serde(default, deserialize_with = "deserialize_parent_id")]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub z_index: i32,
    pub cx: f64,
    pub cy: f64,
    pub rx: f64,
    pub ry: f64,
    #[serde(default = "default_rgba_fill")]
    pub fill: [f32; 4],
    #[serde(default)]
    pub fill_gradient: Option<FillGradientOptions>,
    #[serde(default)]
    pub fill_gradients: Option<Vec<FillGradientOptions>>,
    #[serde(default)]
    pub stroke: Option<StrokeOptions>,
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    #[serde(default = "default_opacity")]
    pub fill_opacity: f32,
    #[serde(default = "default_opacity")]
    pub stroke_opacity: f32,
    #[serde(default, deserialize_with = "deserialize_mat3_opt")]
    pub local_transform: Option<Mat3Array>,
    #[serde(default)]
    pub size_attenuation: bool,
    #[serde(default)]
    pub stroke_attenuation: bool,
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
    #[serde(default)]
    pub stroke: Option<StrokeOptions>,
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    #[serde(default = "default_opacity")]
    pub stroke_opacity: f32,
    #[serde(default, deserialize_with = "deserialize_mat3_opt")]
    pub local_transform: Option<Mat3Array>,
    #[serde(default)]
    pub size_attenuation: bool,
    #[serde(default)]
    pub stroke_attenuation: bool,
}

#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StrokeOptions {
    pub width: f64,
    #[serde(default = "default_rgba_stroke")]
    pub color: [f32; 4],
    #[serde(default = "default_linecap")]
    pub linecap: String,
    #[serde(default = "default_linejoin")]
    pub linejoin: String,
    #[serde(default = "default_miter_limit")]
    pub miter_limit: f64,
    #[serde(rename = "dasharray", default)]
    pub stroke_dasharray: Option<Vec<f64>>,
    #[serde(rename = "dashoffset", default)]
    pub stroke_dashoffset: f64,
}

#[cfg(target_arch = "wasm32")]
fn default_linecap() -> String {
    "butt".to_string()
}
#[cfg(target_arch = "wasm32")]
fn default_linejoin() -> String {
    "miter".to_string()
}
#[cfg(target_arch = "wasm32")]
fn default_miter_limit() -> f64 {
    4.0
}

/// 图片矩形选项。imageData 需由 JS 通过 Uint8Array 传入 RGBA 像素数据。
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageRectOptions {
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
    pub radius: f64,
    pub image_width: u32,
    pub image_height: u32,
    #[serde(default)]
    pub stroke: Option<StrokeOptions>,
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    #[serde(default = "default_opacity")]
    pub fill_opacity: f32,
    #[serde(default = "default_opacity")]
    pub stroke_opacity: f32,
    #[serde(default, deserialize_with = "deserialize_mat3_opt")]
    pub local_transform: Option<Mat3Array>,
    #[serde(default)]
    pub size_attenuation: bool,
    #[serde(default)]
    pub stroke_attenuation: bool,
}

/// Path 选项。d 为 SVG path 的 d 属性。
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathOptions {
    #[serde(deserialize_with = "deserialize_id")]
    pub id: String,
    #[serde(default, deserialize_with = "deserialize_parent_id")]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub z_index: i32,
    pub d: String,
    #[serde(default = "default_rgba_fill")]
    pub fill: [f32; 4],
    #[serde(default)]
    pub fill_gradient: Option<FillGradientOptions>,
    #[serde(default)]
    pub fill_gradients: Option<Vec<FillGradientOptions>>,
    #[serde(default)]
    pub stroke: Option<StrokeOptions>,
    #[serde(default = "default_fill_rule")]
    pub fill_rule: String,
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    #[serde(default = "default_opacity")]
    pub fill_opacity: f32,
    #[serde(default = "default_opacity")]
    pub stroke_opacity: f32,
    #[serde(default, deserialize_with = "deserialize_mat3_opt")]
    pub local_transform: Option<Mat3Array>,
    #[serde(default)]
    pub size_attenuation: bool,
    #[serde(default)]
    pub stroke_attenuation: bool,
}

#[cfg(target_arch = "wasm32")]
fn default_fill_rule() -> String {
    "nonzero".to_string()
}

/// Polyline 选项。points 为 [[x,y],[x,y],...]。
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PolylineOptions {
    #[serde(deserialize_with = "deserialize_id")]
    pub id: String,
    #[serde(default, deserialize_with = "deserialize_parent_id")]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub z_index: i32,
    pub points: Vec<[f64; 2]>,
    #[serde(default)]
    pub stroke: Option<StrokeOptions>,
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    #[serde(default = "default_opacity")]
    pub fill_opacity: f32,
    #[serde(default = "default_opacity")]
    pub stroke_opacity: f32,
    #[serde(default, deserialize_with = "deserialize_mat3_opt")]
    pub local_transform: Option<Mat3Array>,
    #[serde(default)]
    pub size_attenuation: bool,
    #[serde(default)]
    pub stroke_attenuation: bool,
}

/// Group 选项。用于创建组/容器，组织子元素。
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupOptions {
    #[serde(deserialize_with = "deserialize_id")]
    pub id: String,
    #[serde(default, deserialize_with = "deserialize_parent_id")]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub z_index: i32,
    #[serde(default, deserialize_with = "deserialize_mat3_opt")]
    pub local_transform: Option<Mat3Array>,
}

/// Rough 填充样式。
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RoughFillStyle {
    Hachure,
    Solid,
    Zigzag,
    #[serde(rename = "cross-hatch")]
    CrossHatch,
    Dots,
    Dashed,
    #[serde(rename = "zigzag-line")]
    ZigzagLine,
}

#[cfg(target_arch = "wasm32")]
impl Default for RoughFillStyle {
    fn default() -> Self {
        RoughFillStyle::Hachure
    }
}

#[cfg(target_arch = "wasm32")]
impl RoughFillStyle {
    fn as_str(&self) -> &'static str {
        match self {
            RoughFillStyle::Hachure => "hachure",
            RoughFillStyle::Solid => "solid",
            RoughFillStyle::Zigzag => "zigzag",
            RoughFillStyle::CrossHatch => "cross-hatch",
            RoughFillStyle::Dots => "dots",
            RoughFillStyle::Dashed => "dashed",
            RoughFillStyle::ZigzagLine => "zigzag-line",
        }
    }
}

/// RoughRect 选项。手绘风格矩形。
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoughRectOptions {
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
    #[serde(default = "default_rgba_fill")]
    pub fill: [f32; 4],
    #[serde(default)]
    pub stroke: Option<StrokeOptions>,
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    #[serde(default = "default_opacity")]
    pub fill_opacity: f32,
    #[serde(default = "default_opacity")]
    pub stroke_opacity: f32,
    #[serde(default, deserialize_with = "deserialize_mat3_opt")]
    pub local_transform: Option<Mat3Array>,
    /// roughness 参数：0 = 完美矩形，1 = 默认手绘风格，>1 = 更粗糙
    #[serde(default = "default_roughness")]
    pub roughness: f32,
    /// bowing 参数：线条弯曲程度
    #[serde(default = "default_bowing")]
    pub bowing: f32,
    /// 填充样式
    #[serde(default)]
    pub fill_style: RoughFillStyle,
    /// hachure 角度（度）
    #[serde(default = "default_hachure_angle")]
    pub hachure_angle: f32,
    /// hachure 间隙
    #[serde(default = "default_hachure_gap")]
    pub hachure_gap: f32,
    /// 曲线步数
    #[serde(default = "default_curve_step_count")]
    pub curve_step_count: f32,
    /// 简化程度
    #[serde(default)]
    pub simplification: f32,
}

/// RoughEllipse 选项。手绘风格椭圆/圆。
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoughEllipseOptions {
    #[serde(deserialize_with = "deserialize_id")]
    pub id: String,
    #[serde(default, deserialize_with = "deserialize_parent_id")]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub z_index: i32,
    pub cx: f64,
    pub cy: f64,
    pub rx: f64,
    pub ry: f64,
    #[serde(default = "default_rgba_fill")]
    pub fill: [f32; 4],
    #[serde(default)]
    pub stroke: Option<StrokeOptions>,
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    #[serde(default = "default_opacity")]
    pub fill_opacity: f32,
    #[serde(default = "default_opacity")]
    pub stroke_opacity: f32,
    #[serde(default, deserialize_with = "deserialize_mat3_opt")]
    pub local_transform: Option<Mat3Array>,
    #[serde(default = "default_roughness")]
    pub roughness: f32,
    #[serde(default = "default_bowing")]
    pub bowing: f32,
    #[serde(default)]
    pub fill_style: RoughFillStyle,
    #[serde(default = "default_hachure_angle")]
    pub hachure_angle: f32,
    #[serde(default = "default_hachure_gap")]
    pub hachure_gap: f32,
    #[serde(default = "default_curve_step_count")]
    pub curve_step_count: f32,
    #[serde(default)]
    pub simplification: f32,
}

/// RoughLine 选项。手绘风格线段。
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoughLineOptions {
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
    #[serde(default)]
    pub stroke: Option<StrokeOptions>,
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    #[serde(default = "default_opacity")]
    pub stroke_opacity: f32,
    #[serde(default, deserialize_with = "deserialize_mat3_opt")]
    pub local_transform: Option<Mat3Array>,
    #[serde(default = "default_roughness")]
    pub roughness: f32,
    #[serde(default = "default_bowing")]
    pub bowing: f32,
    #[serde(default)]
    pub simplification: f32,
}

#[cfg(target_arch = "wasm32")]
fn default_roughness() -> f32 {
    1.0
}

#[cfg(target_arch = "wasm32")]
fn default_bowing() -> f32 {
    1.0
}

#[cfg(target_arch = "wasm32")]
fn default_hachure_angle() -> f32 {
    -41.0
}

#[cfg(target_arch = "wasm32")]
fn default_hachure_gap() -> f32 {
    4.0
}

#[cfg(target_arch = "wasm32")]
fn default_curve_step_count() -> f32 {
    9.0
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
    #[serde(default = "default_opacity")]
    pub opacity: f32,
    #[serde(default = "default_opacity")]
    pub fill_opacity: f32,
    #[serde(default = "default_opacity")]
    pub stroke_opacity: f32,
    #[serde(default, deserialize_with = "deserialize_mat3_opt")]
    pub local_transform: Option<Mat3Array>,
    #[serde(default)]
    pub size_attenuation: bool,
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
fn default_opacity() -> f32 {
    1.0
}

#[cfg(target_arch = "wasm32")]
fn fill_gradient_options_to_spec(o: &FillGradientOptions) -> FillGradientSpec {
    FillGradientSpec {
        kind: o.r#type.clone(),
        x1: o.x1,
        y1: o.y1,
        x2: o.x2,
        y2: o.y2,
        cx: o.cx,
        cy: o.cy,
        r: o.r,
        start_angle: o.start_angle,
        end_angle: o.end_angle,
        stops: o.stops.iter().map(|s| (s.offset, s.color)).collect(),
    }
}

#[cfg(target_arch = "wasm32")]
fn resolve_fill_gradients(
    fill_gradient: &Option<FillGradientOptions>,
    fill_gradients: &Option<Vec<FillGradientOptions>>,
) -> Option<Vec<FillGradientSpec>> {
    if let Some(ref grads) = fill_gradients {
        if !grads.is_empty() {
            return Some(grads.iter().map(fill_gradient_options_to_spec).collect());
        }
    }
    fill_gradient.as_ref().map(|g| vec![fill_gradient_options_to_spec(g)])
}

/// 将 FillGradientSpec 转为 peniko Gradient，用于 scene.fill。
/// fill_opacity_mult 为 opacity * fill_opacity，用于乘到每个 stop 的 alpha 上。
#[cfg(target_arch = "wasm32")]
fn build_gradient_brush(spec: &FillGradientSpec, fill_opacity_mult: f32) -> Gradient {
    let stops: Vec<ColorStop> = spec
        .stops
        .iter()
        .map(|(offset, color)| {
            let c = apply_opacity_to_color(*color, fill_opacity_mult, 1.0);
            ColorStop::from((*offset, Color::new(c)))
        })
        .collect();
    let gradient = match spec.kind.as_str() {
        "linear" => Gradient::new_linear((spec.x1, spec.y1), (spec.x2, spec.y2)),
        "radial" => Gradient::new_radial((spec.cx, spec.cy), spec.r as f32),
        "conic" => Gradient::new_sweep(
            (spec.cx, spec.cy),
            spec.start_angle as f32,
            spec.end_angle as f32,
        ),
        _ => Gradient::new_linear((spec.x1, spec.y1), (spec.x2, spec.y2)),
    };
    gradient.with_stops(stops.as_slice())
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

/// 反序列化可选的 transform（localTransform/globalTransform）：支持 { m00, m01, ... } 或 [m00..m22] 数组。
#[cfg(target_arch = "wasm32")]
fn deserialize_mat3_opt<'de, D>(d: D) -> Result<Option<Mat3Array>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    struct Mat3Obj {
        m00: f64, m01: f64, m02: f64,
        m10: f64, m11: f64, m12: f64,
        m20: f64, m21: f64, m22: f64,
    }
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Mat3Input {
        Array([f64; 9]),
        Object(Mat3Obj),
    }
    let opt: Option<Mat3Input> = Option::deserialize(d)?;
    Ok(opt.map(|m| match m {
        Mat3Input::Array(a) => a,
        Mat3Input::Object(o) => [
            o.m00, o.m01, o.m02, o.m10, o.m11, o.m12, o.m20, o.m21, o.m22,
        ],
    }))
}

/// 将 RGBA 颜色的 alpha 乘以 opacity 与 fill_opacity/stroke_opacity 的乘积。
fn apply_opacity_to_color(mut color: [f32; 4], opacity: f32, fill_or_stroke_opacity: f32) -> [f32; 4] {
    color[3] *= opacity * fill_or_stroke_opacity;
    color
}

/// 将 ECS Mat3 (m00..m22) 转换为 kurbo Affine。
fn mat3_to_affine(m: &Mat3Array) -> Affine {
    let [m00, m01, m02, m10, m11, m12, _m20, _m21, _m22] = *m;
    Affine::new([m00, m10, m01, m11, m02, m12])
}

/// 检测字符是否为 emoji（简化版：使用 Unicode 范围判断）
#[cfg(target_arch = "wasm32")]
fn is_emoji(ch: char) -> bool {
    // Emoji 主要 Unicode 范围
    match ch as u32 {
        0x1F600..=0x1F64F   // Emoticons
        | 0x1F300..=0x1F5FF   // Misc Symbols and Pictographs
        | 0x1F680..=0x1F6FF   // Transport and Map
        | 0x1F1E0..=0x1F1FF   // Flags
        | 0x2600..=0x26FF     // Misc symbols
        | 0x2700..=0x27BF     // Dingbats
        | 0x1F900..=0x1F9FF   // Supplemental Symbols and Pictographs
        | 0x1FA00..=0x1FA6F   // Chess Symbols, Symbols and Pictographs Extended-A
        | 0x1FA70..=0x1FAFF   // Symbols and Pictographs Extended-B
        | 0xFE00..=0xFE0F     // Variation Selectors
        | 0x1F3FB..=0x1F3FF   // Emoji modifiers (skin tone)
        | 0x200D              // Zero Width Joiner (用于组合 emoji)
        | 0x20E3              // Combining Enclosing Keycap
        => true,
        _ => false,
    }
}

/// 从文本中提取 emoji 段（可能包含 ZWJ 组合的 emoji）
#[cfg(target_arch = "wasm32")]
fn extract_emoji_at(text: &str, byte_pos: usize) -> Option<(String, usize)> {
    use unicode_segmentation::UnicodeSegmentation;

    let graphemes: Vec<&str> = text.graphemes(true).collect();
    let mut current_pos = 0;

    for g in graphemes {
        let g_bytes = g.len();
        if current_pos == byte_pos {
            // 检查这个 grapheme 是否包含 emoji
            let has_emoji = g.chars().any(|c| is_emoji(c));
            if has_emoji {
                return Some((g.to_string(), g_bytes));
            }
            return None;
        }
        current_pos += g_bytes;
    }
    None
}

/// 文本片段（非 emoji）
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Clone)]
struct TextPart {
    text: String,
    offset_x: f64,
    offset_y: f64,
}

/// Emoji 位置信息
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Clone)]
struct EmojiPosition {
    emoji: String,
    x: f64,
    y: f64,
}

/// 预计算的文本布局缓存
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Clone)]
struct CachedTextLayout {
    /// 文本片段（非 emoji）
    text_parts: Vec<TextPart>,
    /// Emoji 位置
    emoji_positions: Vec<EmojiPosition>,
    /// 内容哈希，用于检测变化
    content_hash: u64,
}

/// 计算字符串的简单哈希值
#[cfg(target_arch = "wasm32")]
fn compute_hash(s: &str) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    s.hash(&mut hasher);
    hasher.finish()
}

/// 分离文本中的 emoji 和普通字符，支持多行（按 \n 分割）
/// 返回：(普通文本片段列表, emoji 位置列表)
/// 位置以像素为单位，基于 font_size = 1.0 的基准计算
#[cfg(target_arch = "wasm32")]
fn separate_emoji_from_text(text: &str) -> (Vec<TextPart>, Vec<EmojiPosition>) {
    use unicode_segmentation::UnicodeSegmentation;

    let mut text_parts: Vec<TextPart> = Vec::new();
    let mut emoji_positions: Vec<EmojiPosition> = Vec::new();

    // 按行分割处理
    let lines: Vec<&str> = text.split('\n').collect();

    for (line_idx, line) in lines.iter().enumerate() {
        let line_offset_y = line_idx as f64; // 每行偏移 1em
        let graphemes: Vec<&str> = line.graphemes(true).collect();
        let mut segments: Vec<(String, f64, bool)> = Vec::new(); // (内容, 起始位置, 是否是emoji)
        let mut current_pos: f64 = 0.0;

        // 第一遍：按顺序记录所有片段及其位置
        let mut i = 0;
        while i < graphemes.len() {
            let g = graphemes[i];
            let is_emoji_char = g.chars().any(|c| is_emoji(c));

            if is_emoji_char {
                segments.push((g.to_string(), current_pos, true));
                // emoji 占 1em 宽度
                current_pos += 1.0;
                i += 1;
            } else {
                // 收集连续的非 emoji 文本
                let mut text = String::new();
                let start_pos = current_pos;
                while i < graphemes.len() {
                    let ch = graphemes[i];
                    if ch.chars().any(|c| is_emoji(c)) {
                        break;
                    }
                    text.push_str(ch);
                    // 拉丁字符约 0.6em，CJK 字符 1em
                    let is_wide = ch.chars().any(|c| {
                        matches!(c as u32, 0x4E00..=0x9FFF | 0x3000..=0x303F | 0xFF00..=0xFFEF)
                    });
                    current_pos += if is_wide { 1.0 } else { 0.6 };
                    i += 1;
                }
                if !text.is_empty() {
                    segments.push((text, start_pos, false));
                }
            }
        }

        // 第二遍：转换为 TextPart 和 EmojiPosition
        for (content, pos, is_emoji_flag) in segments {
            if is_emoji_flag {
                emoji_positions.push(EmojiPosition {
                    emoji: content,
                    x: pos,
                    y: line_offset_y,
                });
            } else {
                text_parts.push(TextPart {
                    text: content,
                    offset_x: pos,
                    offset_y: line_offset_y,
                });
            }
        }
    }

    (text_parts, emoji_positions)
}

/// 获取或创建 emoji 图片数据
#[cfg(target_arch = "wasm32")]
fn get_or_create_emoji_image(emoji: &str, size: u32) -> Option<(Vec<u8>, u32, u32)> {
    let cache_key = format!("{}_{}", emoji, size);

    // 先检查缓存
    let cached = EMOJI_CACHE.with(|c| c.borrow().get(&cache_key).cloned());
    if let Some(data) = cached {
        return Some(data);
    }

    // 使用 HTML Canvas API 渲染 emoji
    let document = web_sys::window()?.document()?;
    let canvas = document.create_element("canvas").ok()?.dyn_into::<web_sys::HtmlCanvasElement>().ok()?;

    // 设置 canvas 尺寸（考虑 HiDPI）
    let dpr = web_sys::window()?.device_pixel_ratio() as f32;
    let canvas_size = (size as f32 * dpr) as u32;
    canvas.set_width(canvas_size);
    canvas.set_height(canvas_size);

    let ctx = canvas.get_context("2d").ok()??.dyn_into::<web_sys::CanvasRenderingContext2d>().ok()?;

    // 缩放以匹配 DPR
    ctx.scale(dpr as f64, dpr as f64).ok()?;

    // 清除画布
    ctx.clear_rect(0.0, 0.0, size as f64, size as f64);

    // 绘制 emoji
    ctx.set_text_align("center");
    ctx.set_text_baseline("middle");
    ctx.set_font(&format!("{}px sans-serif", size));
    ctx.fill_text(emoji, (size / 2) as f64, (size / 2) as f64).ok()?;

    // 获取像素数据
    let image_data = ctx.get_image_data(0.0, 0.0, canvas_size as f64, canvas_size as f64).ok()?;
    let data = image_data.data();
    let rgba: Vec<u8> = data.to_vec();

    let result = (rgba, canvas_size, canvas_size);

    // 存入缓存
    EMOJI_CACHE.with(|c| {
        c.borrow_mut().insert(cache_key, result.clone());
    });

    Some(result)
}

/// 按父子关系解析世界变换；支持 local_transform，无则等价于 translate(local_origin)。
#[cfg(target_arch = "wasm32")]
fn compute_world_transforms(shapes: &[JsShape]) -> HashMap<String, Affine> {
    let mut map: HashMap<String, Affine> = HashMap::new();
    let max_passes = shapes.len().max(1);
    for _ in 0..max_passes {
        let mut changed = false;
        for shape in shapes {
            if map.contains_key(shape.id()) {
                continue;
            }
            let local_affine = match shape.local_transform() {
                Some(m) => mat3_to_affine(m),
                None => Affine::translate(shape.local_origin().to_vec2()),
            };
            let world = match shape.parent_id() {
                Some(pid) => map
                    .get(pid)
                    .map(|p| *p * local_affine)
                    .unwrap_or(local_affine),
                None => local_affine,
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

/// 使用 Parley 将字符串与字体字节解析为 vello 可绘制的 Glyph 列表；支持 kerning、ligatures、bidi 等。
/// 返回 peniko FontData 供 draw_glyphs 使用。
/// 使用全局 FontContext 缓存以提高性能。
#[cfg(target_arch = "wasm32")]
fn build_text_glyphs(
    font_bytes: &[u8],
    content: &str,
    font_size_px: f32,
    letter_spacing: f32,
) -> Option<(vello::peniko::FontData, Vec<vello::Glyph>, f32)> {
    use std::borrow::Cow;
    use parley::fontique::Blob;
    use parley::layout::PositionedLayoutItem;
    use parley::style::FontFamily;
    use parley::{Alignment, AlignmentOptions, LayoutContext, LineHeight, StyleProperty};

    FONT_CONTEXT.with(|fc| {
        let mut font_cx_ref = fc.borrow_mut();
        if font_cx_ref.is_none() {
            *font_cx_ref = Some(parley::FontContext::new());
        }
        
        let font_cx = font_cx_ref.as_mut()?;

        // 只在字体未注册时注册
        let font_blob = Blob::new(Arc::new(font_bytes.to_vec()));
        font_cx.collection.register_fonts(font_blob, None);

        let family_name = font_cx
            .collection
            .family_names()
            .next()
            .unwrap_or("sans-serif")
            .to_string();

        let mut layout_cx = LayoutContext::new();
        let mut builder = layout_cx.ranged_builder(font_cx, content, 1.0, true);

        builder.push_default(FontFamily::Named(Cow::Borrowed(&family_name)));
        builder.push_default(LineHeight::FontSizeRelative(1.0));
        builder.push_default(StyleProperty::FontSize(font_size_px));
        if letter_spacing != 0.0 {
            builder.push_default(StyleProperty::LetterSpacing(letter_spacing));
        }

        let mut layout: parley::Layout<()> = builder.build(content);
        layout.break_all_lines(None);
        layout.align(None, Alignment::Start, AlignmentOptions::default());

        let mut glyphs = Vec::new();
        let mut line_y = 0.0f32;
        for line in layout.lines() {
            for item in line.items() {
                if let PositionedLayoutItem::GlyphRun(run) = item {
                    for g in run.positioned_glyphs() {
                        glyphs.push(vello::Glyph {
                            id: g.id,
                            x: g.x,
                            y: line_y + g.y,
                        });
                    }
                }
            }
            line_y += line.metrics().max_coord - line.metrics().min_coord;
        }

        let blob = vello::peniko::Blob::from(font_bytes.to_vec());
        let font_data = vello::peniko::FontData::new(blob, 0);
        Some((font_data, glyphs, font_size_px))
    })
}

/// 创建 surface 时使用的最小尺寸（浏览器中 canvas 可能尚未布局，inner_size 为 0）。
const MIN_SURFACE_WIDTH: u32 = 800;
const MIN_SURFACE_HEIGHT: u32 = 600;

/// 获取设备像素比。wasm 下 canvas 的 width/height 是物理像素（CSS 尺寸 × dpr），
/// 而 ECS 世界坐标是逻辑像素，需在变换中乘以 dpr 才能正确显示。
#[cfg(target_arch = "wasm32")]
fn device_pixel_ratio() -> f64 {
    web_sys::window()
        .map(|w| w.device_pixel_ratio())
        .unwrap_or(1.0)
}

#[cfg(not(target_arch = "wasm32"))]
fn device_pixel_ratio() -> f64 {
    1.0
}

/// 当前渲染状态：surface + 窗口。
pub struct RenderState {
    pub surface: RenderSurface<'static>,
    pub valid_surface: bool,
    pub window: Arc<Window>,
    /// wasm 多画布：该 surface 对应的 canvas id；桌面为 None。
    pub canvas_id: Option<u32>,
}

/// 最小应用：与 [vello with_winit](https://github.com/linebender/vello/blob/main/examples/with_winit/src/lib.rs) 一致。
/// 相机 transform 完全由 JS 通过 setCameraTransform 同步，Rust 不监听输入事件。
pub struct VelloRendererApp {
    pub context: RenderContext,
    pub renderers: Vec<Option<Renderer>>,
    pub state: Option<RenderState>,
    pub scene: Scene,
    /// 场景变换（世界 → 屏幕），由 JS setCameraTransform 设置。
    pub transform: Affine,
}

impl VelloRendererApp {
    pub fn new() -> Self {
        Self {
            context: RenderContext::new(),
            renderers: vec![],
            state: None,
            scene: Scene::new(),
            transform: Affine::IDENTITY,
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
                if let Some(affine) = take_pending_camera_transform(canvas_id) {
                    self.transform = affine;
                }
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
                // ECS 的相机变换基于 CSS 逻辑像素，Vello 渲染目标是物理像素
                // 平移已经在 JS 侧乘以 DPR，但缩放需要在这里调整
                let dpr = device_pixel_ratio();
                let effective_transform = self.transform * Affine::scale(dpr);
                add_shapes_to_scene(&mut self.scene, effective_transform, width, height, canvas_id);

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
            _ => {}
        }
    }

    fn about_to_wait(&mut self, _event_loop: &ActiveEventLoop) {}
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

/// 按父级上下文排序：z_index 仅在兄弟节点间生效，类似 CSS stacking context。
#[cfg(target_arch = "wasm32")]
fn sort_shapes_by_parent_z_index(shapes: &[JsShape]) -> Vec<JsShape> {
    use std::collections::HashMap;
    let mut by_parent: HashMap<Option<String>, Vec<JsShape>> = HashMap::new();
    for s in shapes {
        let pid = s.parent_id().map(|s| s.to_string());
        by_parent.entry(pid).or_default().push(s.clone());
    }
    for v in by_parent.values_mut() {
        v.sort_by_key(|s| s.z_index());
    }
    let mut result = Vec::with_capacity(shapes.len());
    fn visit(
        parent_id: Option<String>,
        by_parent: &HashMap<Option<String>, Vec<JsShape>>,
        result: &mut Vec<JsShape>,
    ) {
        if let Some(children) = by_parent.get(&parent_id) {
            for child in children {
                let id = child.id().to_string();
                result.push(child.clone());
                visit(Some(id), by_parent, result);
            }
        }
    }
    visit(None, &by_parent, &mut result);
    result
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
        let shapes = sort_shapes_by_parent_z_index(&get_user_shapes(cid));
        let world_transforms = compute_world_transforms(&shapes);
        for shape in shapes {
            add_js_shape_to_scene(scene, transform, shape, &world_transforms);
        }
    }
}

/// 将 JS fillStyle 字符串映射到 roughr FillStyle
#[cfg(target_arch = "wasm32")]
fn map_fill_style(style: &str) -> Option<roughr::core::FillStyle> {
    use roughr::core::FillStyle;
    match style {
        "solid" => Some(FillStyle::Solid),
        "zigzag" => Some(FillStyle::ZigZag),
        "cross-hatch" => Some(FillStyle::CrossHatch),
        "dots" => Some(FillStyle::Dots),
        "dashed" => Some(FillStyle::Dashed),
        "zigzag-line" => Some(FillStyle::ZigZagLine),
        _ => Some(FillStyle::Hachure),
    }
}

/// 将 roughr 的 Drawable 渲染到 Vello Scene
#[cfg(target_arch = "wasm32")]
fn render_rough_drawable(
    scene: &mut Scene,
    transform: Affine,
    drawable: &roughr::core::Drawable<f32>,
    fill_color: [f32; 4],
    stroke_color: Option<[f32; 4]>,
) {
    use roughr::core::{OpSetType, OpType};

    for set in &drawable.sets {
        let mut bez_path = BezPath::new();
        for op in &set.ops {
            match op.op {
                OpType::Move => {
                    if op.data.len() >= 2 {
                        bez_path.move_to((op.data[0] as f64, op.data[1] as f64));
                    }
                }
                OpType::LineTo => {
                    if op.data.len() >= 2 {
                        bez_path.line_to((op.data[0] as f64, op.data[1] as f64));
                    }
                }
                OpType::BCurveTo => {
                    if op.data.len() >= 6 {
                        bez_path.curve_to(
                            (op.data[0] as f64, op.data[1] as f64),
                            (op.data[2] as f64, op.data[3] as f64),
                            (op.data[4] as f64, op.data[5] as f64),
                        );
                    }
                }
                _ => {}
            }
        }

        match set.op_set_type {
            OpSetType::FillPath | OpSetType::FillSketch => {
                // Fill 路径使用传入的 fill_color
                if fill_color[3] > 0.0 {
                    scene.fill(Fill::NonZero, transform, Color::new(fill_color), None, &bez_path);
                }
            }
            OpSetType::Path => {
                // Stroke 路径使用传入的 stroke_color
                if let Some(stroke) = stroke_color {
                    if stroke[3] > 0.0 {
                        let stroke_width = set.size.map(|s| s.x).unwrap_or(1.0);
                        let kurbo_stroke = Stroke::new(stroke_width as f64);
                        scene.stroke(&kurbo_stroke, transform, Color::new(stroke), None, &bez_path);
                    }
                }
            }
        }
    }
}

#[cfg(target_arch = "wasm32")]
fn add_js_shape_to_scene(
    scene: &mut Scene,
    transform: Affine,
    shape: JsShape,
    world_transforms: &HashMap<String, Affine>,
) {
    let world = world_transforms
        .get(shape.id())
        .copied()
        .unwrap_or_else(|| Affine::translate(shape.local_origin().to_vec2()));
    let shape_transform = transform * world;
    // size_attenuation 应该只考虑相机缩放，不应该考虑 DPR
    // transform 包含了 DPR 缩放，所以需要除以 DPR 得到纯粹的相机缩放
    let dpr = device_pixel_ratio();
    let scale = (affine_scale_factor(transform) / dpr).max(1e-6);
    // 辅助函数：根据 stroke_attenuation 决定是否缩放线宽
    let apply_stroke_attenuation = |stroke: &StrokeParams, attenuation: bool| -> Stroke {
        if attenuation {
            stroke.to_kurbo_stroke_with_width(stroke.width / scale)
        } else {
            stroke.to_kurbo_stroke()
        }
    };
    match shape {
        JsShape::Rect {
            x,
            y,
            width,
            height,
            radius,
            fill,
            fill_gradients,
            stroke,
            opacity,
            fill_opacity,
            stroke_opacity,
            size_attenuation,
            stroke_attenuation,
            ..
        } => {
            let (w, h, r) = if size_attenuation {
                (width / scale, height / scale, radius / scale)
            } else {
                (width, height, radius)
            };
            let (x0, y0, x1, y1) = (
                x.min(x + w),
                y.min(y + h),
                x.max(x + w),
                y.max(y + h),
            );
            let fill_mult = opacity * fill_opacity;
            if r > 0.0 {
                let geom = RoundedRect::new(x0, y0, x1, y1, r);
                if let Some(ref grads) = fill_gradients {
                    for g in grads.iter().rev() {
                        let brush = vello::peniko::Brush::Gradient(build_gradient_brush(g, fill_mult));
                        scene.fill(Fill::NonZero, shape_transform, &brush, None, &geom);
                    }
                } else {
                    let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
                    let brush = vello::peniko::Brush::Solid(Color::new(fill_color));
                    scene.fill(Fill::NonZero, shape_transform, &brush, None, &geom);
                }
                if let Some(ref s) = stroke {
                    let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                    let kurbo_stroke = apply_stroke_attenuation(s, stroke_attenuation);
                    scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &geom);
                }
            } else {
                let geom = Rect::new(x0, y0, x1, y1);
                if let Some(ref grads) = fill_gradients {
                    for g in grads.iter().rev() {
                        let brush = vello::peniko::Brush::Gradient(build_gradient_brush(g, fill_mult));
                        scene.fill(Fill::NonZero, shape_transform, &brush, None, &geom);
                    }
                } else {
                    let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
                    let brush = vello::peniko::Brush::Solid(Color::new(fill_color));
                    scene.fill(Fill::NonZero, shape_transform, &brush, None, &geom);
                }
                if let Some(ref s) = stroke {
                    let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                    let kurbo_stroke = apply_stroke_attenuation(s, stroke_attenuation);
                    scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &geom);
                }
            }
        }
        JsShape::Ellipse { cx, cy, rx, ry, fill, fill_gradients, stroke, opacity, fill_opacity, stroke_opacity, size_attenuation, stroke_attenuation, .. } => {
            let (rx_eff, ry_eff) = if size_attenuation {
                (rx / scale, ry / scale)
            } else {
                (rx, ry)
            };
            let ellipse = Ellipse::new(Point::new(cx, cy), Vec2::new(rx_eff, ry_eff), 0.0);
            let fill_mult = opacity * fill_opacity;
            if let Some(ref grads) = fill_gradients {
                for g in grads.iter().rev() {
                    let brush = vello::peniko::Brush::Gradient(build_gradient_brush(g, fill_mult));
                    scene.fill(Fill::NonZero, shape_transform, &brush, None, &ellipse);
                }
            } else {
                let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
                let brush = vello::peniko::Brush::Solid(Color::new(fill_color));
                scene.fill(Fill::NonZero, shape_transform, &brush, None, &ellipse);
            }
            if let Some(ref s) = stroke {
                let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                let kurbo_stroke = apply_stroke_attenuation(s, stroke_attenuation);
                scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &ellipse);
            }
        }
        JsShape::Line { x1, y1, x2, y2, stroke, opacity, stroke_opacity, size_attenuation, stroke_attenuation, .. } => {
            let line = Line::new((x1, y1), (x2, y2));
            let stroke_color = apply_opacity_to_color(stroke.color, opacity, stroke_opacity);
            // Line 使用 size_attenuation 或 stroke_attenuation 都可以影响线宽
            let use_attenuation = size_attenuation || stroke_attenuation;
            let kurbo_stroke = if use_attenuation {
                stroke.to_kurbo_stroke_with_width(stroke.width / scale)
            } else {
                stroke.to_kurbo_stroke()
            };
            scene.stroke(
                &kurbo_stroke,
                shape_transform,
                Color::new(stroke_color),
                None,
                &line,
            );
        }
        JsShape::Text {
            content,
            font_size,
            letter_spacing,
            fill,
            opacity,
            fill_opacity,
            size_attenuation,
            cached_layout,
            ..
        } => {
            let (font_size_eff, letter_spacing_eff) = if size_attenuation {
                (font_size / scale, letter_spacing / scale)
            } else {
                (font_size, letter_spacing)
            };

            // 使用缓存的布局，如果没有则实时计算
            let (text_parts, emoji_positions) = match cached_layout {
                Some(layout) => (layout.text_parts.clone(), layout.emoji_positions.clone()),
                None => separate_emoji_from_text(&content),
            };

            let font_bytes = FONT_BYTES.with(|c| c.borrow().clone());

            // 渲染普通文本（非 emoji 部分）
            if let Some(bytes) = font_bytes {
                for part in &text_parts {
                    let cache_key = (part.text.clone(), font_size_eff as u32);

                    // 尝试从缓存获取字形
                    let cached = GLYPH_CACHE.with(|c| c.borrow().get(&cache_key).cloned());

                    let (font_data, glyphs, size) = match cached {
                        Some(data) => data,
                        None => {
                            // 缓存未命中，构建字形
                            match build_text_glyphs(
                                &bytes,
                                &part.text,
                                font_size_eff as f32,
                                letter_spacing_eff as f32,
                            ) {
                                Some(data) => {
                                    // 存入缓存
                                    GLYPH_CACHE.with(|c| {
                                        c.borrow_mut().insert(cache_key, data.clone());
                                    });
                                    data
                                }
                                None => continue,
                            }
                        }
                    };

                    let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
                    let color = Color::new(fill_color);

                    // 将 em 单位转换为实际像素偏移
                    let pixel_offset_x = part.offset_x * font_size_eff;
                    let pixel_offset_y = part.offset_y * font_size_eff;

                    // 计算这段文本的偏移（支持多行）
                    let part_transform =
                        shape_transform * Affine::translate(Vec2::new(pixel_offset_x, pixel_offset_y));

                    scene
                        .draw_glyphs(&font_data)
                        .font_size(size)
                        .transform(part_transform)
                        .brush(color)
                        .draw(Fill::NonZero, glyphs.into_iter());
                }
            }

            // 渲染 emoji 图片
            for emoji_pos in &emoji_positions {
                if let Some((image_data, img_width, img_height)) =
                    get_or_create_emoji_image(&emoji_pos.emoji, font_size_eff as u32)
                {
                    let image = ImageData {
                        data: Blob::from(image_data),
                        format: ImageFormat::Rgba8,
                        alpha_type: ImageAlphaType::Alpha,
                        width: img_width,
                        height: img_height,
                    };
                    let brush = ImageBrush::new(image);

                    // emoji 尺寸（考虑 size_attenuation）
                    let emoji_size = font_size_eff;

                    // 将 em 单位转换为实际像素位置
                    let emoji_x = emoji_pos.x * font_size_eff;
                    // 基线对齐：emoji 底部对齐到文本基线
                    // 文本基线通常在 y=0，emoji 需要向上偏移以基线对齐
                    // 加上行的 Y 偏移（支持多行）
                    let line_offset_y = emoji_pos.y * font_size_eff;
                    let emoji_y = line_offset_y - emoji_size * 0.85;

                    // 计算完整的变换：shape_transform * 位置 * 缩放
                    let full_transform = shape_transform
                        * Affine::translate(Vec2::new(emoji_x, emoji_y))
                        * Affine::scale_non_uniform(
                            emoji_size / img_width as f64,
                            emoji_size / img_height as f64,
                        );

                    // 使用单位矩形作为几何体，变换在 brush_transform 中
                    let geom = Rect::new(0.0, 0.0, img_width as f64, img_height as f64);

                    scene.fill(
                        Fill::NonZero,
                        full_transform,
                        brush.as_ref(),
                        None, // 变换已包含在 full_transform 中
                        &geom,
                    );
                }
            }
        }
        JsShape::ImageRect {
            x,
            y,
            width,
            height,
            radius,
            image_width,
            image_height,
            image_data,
            stroke,
            opacity,
            fill_opacity: _,
            stroke_opacity,
            size_attenuation,
            stroke_attenuation,
            ..
        } => {
            let (w, h, r) = if size_attenuation {
                (width / scale, height / scale, radius / scale)
            } else {
                (width, height, radius)
            };
            let expected_len = image_width as usize * image_height as usize * 4;
            if image_data.len() >= expected_len {
                let image = ImageData {
                    data: Blob::from(image_data.clone()),
                    format: ImageFormat::Rgba8,
                    alpha_type: ImageAlphaType::Alpha,
                    width: image_width,
                    height: image_height,
                };
                let brush = ImageBrush::new(image);
                let brush_transform = Affine::translate(Vec2::new(x, y))
                    * Affine::scale_non_uniform(w / image_width as f64, h / image_height as f64);
                if r > 0.0 {
                    let geom = RoundedRect::new(x, y, x + w, y + h, r);
                    scene.fill(Fill::NonZero, shape_transform, brush.as_ref(), Some(brush_transform), &geom);
                    if let Some(ref s) = stroke {
                        let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                        let kurbo_stroke = apply_stroke_attenuation(s, stroke_attenuation);
                        scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &geom);
                    }
                } else {
                    let geom = Rect::new(x, y, x + w, y + h);
                    scene.fill(Fill::NonZero, shape_transform, brush.as_ref(), Some(brush_transform), &geom);
                    if let Some(ref s) = stroke {
                        let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                        let kurbo_stroke = apply_stroke_attenuation(s, stroke_attenuation);
                        scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &geom);
                    }
                }
            }
        }
        JsShape::Path { d, fill, fill_gradients, stroke, fill_rule, opacity, fill_opacity, stroke_opacity, size_attenuation, stroke_attenuation, .. } => {
            if let Ok(mut bez_path) = BezPath::from_svg(d.as_str()) {
                if size_attenuation {
                    let bbox = bez_path.bounding_box();
                    let center = bbox.center();
                    bez_path.apply_affine(Affine::scale_about(1.0 / scale, center));
                }
                let fill_mode = if fill_rule.as_str() == "evenodd" {
                    Fill::EvenOdd
                } else {
                    Fill::NonZero
                };
                let fill_mult = opacity * fill_opacity;
                if let Some(ref grads) = fill_gradients {
                    for g in grads.iter().rev() {
                        let brush = vello::peniko::Brush::Gradient(build_gradient_brush(g, fill_mult));
                        scene.fill(fill_mode, shape_transform, &brush, None, &bez_path);
                    }
                } else {
                    let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
                    let brush = vello::peniko::Brush::Solid(Color::new(fill_color));
                    scene.fill(fill_mode, shape_transform, &brush, None, &bez_path);
                }
                if let Some(ref s) = stroke {
                    let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                    let kurbo_stroke = apply_stroke_attenuation(s, stroke_attenuation);
                    scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &bez_path);
                }
            }
        }
        JsShape::Polyline { points, stroke, opacity, stroke_opacity, size_attenuation, stroke_attenuation, .. } => {
            if points.len() >= 2 {
                let mut elements = vec![PathEl::MoveTo(Point::new(points[0][0], points[0][1]))];
                for p in points.iter().skip(1) {
                    elements.push(PathEl::LineTo(Point::new(p[0], p[1])));
                }
                let mut bez_path = BezPath::from_vec(elements);
                if size_attenuation {
                    let bbox = bez_path.bounding_box();
                    let center = bbox.center();
                    bez_path.apply_affine(Affine::scale_about(1.0 / scale, center));
                }
                if let Some(ref s) = stroke {
                    let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                    let kurbo_stroke = apply_stroke_attenuation(s, stroke_attenuation);
                    scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &bez_path);
                }
            }
        }
        JsShape::Group { .. } => {
            // 组/容器本身没有可见内容，只提供变换和层级。
            // 子元素通过 parent_id 关联，在 compute_world_transforms 中处理变换。
        }
        JsShape::RoughRect { x, y, width, height, fill, stroke, opacity, fill_opacity, stroke_opacity, roughness, bowing, fill_style, hachure_angle, hachure_gap, curve_step_count, simplification, .. } => {
            // 手绘风格矩形 - 使用 roughr 生成手绘路径
            let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
            let stroke_color = stroke.as_ref().map(|s| apply_opacity_to_color(s.color, opacity, stroke_opacity));
            let options = Options {
                roughness: Some(roughness),
                bowing: Some(bowing),
                fill: if fill_color[3] > 0.0 { Some(roughr::Srgba::new(fill_color[0], fill_color[1], fill_color[2], fill_color[3])) } else { None },
                fill_style: map_fill_style(&fill_style),
                hachure_angle: Some(hachure_angle),
                hachure_gap: if hachure_gap > 0.0 { Some(hachure_gap) } else { Some(stroke.as_ref().map(|s| s.width as f32).unwrap_or(1.0) * 4.0) },
                curve_step_count: Some(curve_step_count),
                simplification: Some(simplification),
                stroke: stroke_color.map(|c| roughr::Srgba::new(c[0], c[1], c[2], c[3])),
                ..Options::default()
            };
            let generator = Generator::default();
            let drawable = generator.rectangle(x as f32, y as f32, width as f32, height as f32, &Some(options));

            render_rough_drawable(scene, shape_transform, &drawable, fill_color, stroke_color);
        }
        JsShape::RoughEllipse { cx, cy, rx, ry, fill, stroke, opacity, fill_opacity, stroke_opacity, roughness, bowing, fill_style, hachure_angle, hachure_gap, curve_step_count, simplification, .. } => {
            // 手绘风格椭圆 - 使用 roughr 生成手绘路径
            let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
            let stroke_color = stroke.as_ref().map(|s| apply_opacity_to_color(s.color, opacity, stroke_opacity));
            let options = Options {
                roughness: Some(roughness),
                bowing: Some(bowing),
                fill: if fill_color[3] > 0.0 { Some(roughr::Srgba::new(fill_color[0], fill_color[1], fill_color[2], fill_color[3])) } else { None },
                fill_style: map_fill_style(&fill_style),
                hachure_angle: Some(hachure_angle),
                hachure_gap: if hachure_gap > 0.0 { Some(hachure_gap) } else { Some(stroke.as_ref().map(|s| s.width as f32).unwrap_or(1.0) * 4.0) },
                curve_step_count: Some(curve_step_count),
                simplification: Some(simplification),
                stroke: stroke_color.map(|c| roughr::Srgba::new(c[0], c[1], c[2], c[3])),
                ..Options::default()
            };
            let generator = Generator::default();
            let drawable = generator.ellipse(cx as f32, cy as f32, rx as f32 * 2.0, ry as f32 * 2.0, &Some(options));

            render_rough_drawable(scene, shape_transform, &drawable, fill_color, stroke_color);
        }
        JsShape::RoughLine { x1, y1, x2, y2, stroke, opacity, stroke_opacity, roughness, bowing, simplification, .. } => {
            // 手绘风格线段 - 使用 roughr 生成手绘路径
            let stroke_color_val = apply_opacity_to_color(stroke.color, opacity, stroke_opacity);
            let options = Options {
                roughness: Some(roughness),
                bowing: Some(bowing),
                simplification: Some(simplification),
                stroke: Some(roughr::Srgba::new(stroke_color_val[0], stroke_color_val[1], stroke_color_val[2], stroke_color_val[3])),
                ..Options::default()
            };
            let generator = Generator::default();
            let drawable = generator.line(x1 as f32, y1 as f32, x2 as f32, y2 as f32, &Some(options));

            render_rough_drawable(scene, shape_transform, &drawable, [0.0, 0.0, 0.0, 0.0], Some(stroke_color_val));
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

/// wasm 入口：异步创建 surface 后再 run_app。创建完成后会调用 on_ready(canvasId)，之后 addRect/addEllipse 等需传入该 id。
#[cfg(target_arch = "wasm32")]
#[allow(deprecated)] // EventLoop::create_window 在 wasm 初始化时仍需使用
pub async fn run_wasm_async(canvas: web_sys::HtmlCanvasElement, on_ready: js_sys::Function) {
    use winit::platform::web::WindowAttributesExtWebSys;

    let event_loop = match EventLoop::new() {
        Ok(el) => el,
        Err(_) => return,
    };
    let canvas_id = NEXT_CANVAS_ID.with(|c| {
        let mut id = c.borrow_mut();
        let next = *id;
        *id = id.saturating_add(1);
        next
    });

    CANVAS_SHAPES.with(|c| {
        c.borrow_mut().insert(canvas_id, Vec::new());
    });

    let mut attrs = Window::default_attributes()
        .with_inner_size(LogicalSize::new(800.0, 600.0))
        .with_resizable(true)
        .with_title("Vello Renderer - Infinite Canvas");
    attrs = attrs.with_canvas(Some(canvas));
    let window = match event_loop.create_window(attrs) {
        Ok(w) => Arc::new(w),
        Err(_) => return,
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
                (cw, ch)
            } else {
                (w, h)
            }
        } else {
            let size = window.inner_size();
            (size.width.max(MIN_SURFACE_WIDTH), size.height.max(MIN_SURFACE_HEIGHT))
        }
    };

    let mut context = RenderContext::new();

    let surface = match context
        .create_surface(
            window.clone(),
            width,
            height,
            wgpu::PresentMode::AutoVsync,
        )
        .await
    {
        Ok(s) => s,
        Err(_) => return,
    };

    let mut renderers: Vec<Option<Renderer>> = vec![];
    renderers.resize_with(context.devices.len(), || None);
    let dev_id = surface.dev_id;
    let renderer = match Renderer::new(
        &context.devices[dev_id].device,
        RendererOptions::default(),
    ) {
        Ok(r) => r,
        Err(_) => return,
    };
    renderers[dev_id] = Some(renderer);

    CANVAS_WINDOWS.with(|c| {
        c.borrow_mut().insert(canvas_id, window.clone());
    });
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
    };
    let _ = on_ready.call1(&JsValue::NULL, &JsValue::from(canvas_id));
    window.request_redraw();
    let _ = event_loop.run_app(&mut app);
}

/// 使用传入的 canvas 元素启动渲染。onReady(canvasId) 在画布就绪时调用，后续 addRect/addEllipse 等需传入该 canvasId。
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
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
            })
        } else {
            None
        }
    });
    let fill_gradients = resolve_fill_gradients(&o.fill_gradient, &o.fill_gradients);
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
        fill_gradients,
        stroke,
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        size_attenuation: o.size_attenuation,
        stroke_attenuation: o.stroke_attenuation,
    });
}

/// 添加椭圆。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addEllipse)]
pub fn js_add_ellipse(canvas_id: u32, opts: JsValue) {
    let o: EllipseOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addEllipse: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
            })
        } else {
            None
        }
    });
    let fill_gradients = resolve_fill_gradients(&o.fill_gradient, &o.fill_gradients);
    push_shape(canvas_id, JsShape::Ellipse {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        cx: o.cx,
        cy: o.cy,
        rx: o.rx,
        ry: o.ry,
        fill: o.fill,
        fill_gradients,
        stroke,
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        size_attenuation: o.size_attenuation,
        stroke_attenuation: o.stroke_attenuation,
    });
}

/// 添加图片填充的矩形。opts 需包含 imageData (Uint8Array RGBA)、imageWidth、imageHeight。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addImageRect)]
pub fn js_add_image_rect(canvas_id: u32, opts: JsValue) {
    let image_data: Vec<u8> = js_sys::Reflect::get(&opts, &"imageData".into())
        .ok()
        .and_then(|v| v.dyn_into::<js_sys::Uint8Array>().ok())
        .map(|a| a.to_vec())
        .unwrap_or_default();
    let o: ImageRectOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addImageRect: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
            })
        } else {
            None
        }
    });
    push_shape(canvas_id, JsShape::ImageRect {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        radius: o.radius,
        image_width: o.image_width,
        image_height: o.image_height,
        image_data,
        stroke,
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        size_attenuation: o.size_attenuation,
        stroke_attenuation: o.stroke_attenuation,
    });
}

/// 添加 path。opts 需包含 d（SVG path 的 d 属性）。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addPath)]
pub fn js_add_path(canvas_id: u32, opts: JsValue) {
    let o: PathOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addPath: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
            })
        } else {
            None
        }
    });
    let fill_gradients = resolve_fill_gradients(&o.fill_gradient, &o.fill_gradients);
    push_shape(canvas_id, JsShape::Path {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        d: o.d,
        fill: o.fill,
        fill_gradients,
        stroke,
        fill_rule: o.fill_rule,
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        size_attenuation: o.size_attenuation,
        stroke_attenuation: o.stroke_attenuation,
    });
}

/// 添加折线。opts 需包含 points（[[x,y],[x,y],...]）。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addPolyline)]
pub fn js_add_polyline(canvas_id: u32, opts: JsValue) {
    let o: PolylineOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addPolyline: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().map(|s| StrokeParams {
        width: s.width.max(0.5),
        color: s.color,
        linecap: s.linecap.clone(),
        linejoin: s.linejoin.clone(),
        miter_limit: s.miter_limit,
        stroke_dasharray: s.stroke_dasharray.clone(),
        stroke_dashoffset: s.stroke_dashoffset,
    }).unwrap_or_else(|| StrokeParams {
        width: 1.0,
        color: default_rgba_stroke(),
        linecap: default_linecap(),
        linejoin: default_linejoin(),
        miter_limit: default_miter_limit(),
        stroke_dasharray: None,
        stroke_dashoffset: 0.0,
    });
    push_shape(canvas_id, JsShape::Polyline {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        points: o.points,
        stroke: Some(stroke),
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        size_attenuation: o.size_attenuation,
        stroke_attenuation: o.stroke_attenuation,
    });
}

/// 添加组/容器。用于组织子元素，本身没有可见内容。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addGroup)]
pub fn js_add_group(canvas_id: u32, opts: JsValue) {
    let o: GroupOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addGroup: invalid options - {}", e).into());
            return;
        }
    };
    push_shape(canvas_id, JsShape::Group {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        local_transform: o.local_transform,
    });
}

/// 添加手绘风格矩形。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addRoughRect)]
pub fn js_add_rough_rect(canvas_id: u32, opts: JsValue) {
    let o: RoughRectOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addRoughRect: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
            })
        } else {
            None
        }
    });
    push_shape(canvas_id, JsShape::RoughRect {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        x: o.x,
        y: o.y,
        width: o.width,
        height: o.height,
        fill: o.fill,
        stroke,
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        roughness: o.roughness,
        bowing: o.bowing,
        fill_style: o.fill_style.as_str().to_string(),
        hachure_angle: o.hachure_angle,
        hachure_gap: o.hachure_gap,
        curve_step_count: o.curve_step_count,
        simplification: o.simplification,
    });
}

/// 添加手绘风格椭圆。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addRoughEllipse)]
pub fn js_add_rough_ellipse(canvas_id: u32, opts: JsValue) {
    let o: RoughEllipseOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addRoughEllipse: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().and_then(|s| {
        if s.width > 0.0 {
            Some(StrokeParams {
                width: s.width,
                color: s.color,
                linecap: s.linecap.clone(),
                linejoin: s.linejoin.clone(),
                miter_limit: s.miter_limit,
                stroke_dasharray: s.stroke_dasharray.clone(),
                stroke_dashoffset: s.stroke_dashoffset,
            })
        } else {
            None
        }
    });
    push_shape(canvas_id, JsShape::RoughEllipse {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        cx: o.cx,
        cy: o.cy,
        rx: o.rx,
        ry: o.ry,
        fill: o.fill,
        stroke,
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        roughness: o.roughness,
        bowing: o.bowing,
        fill_style: o.fill_style.as_str().to_string(),
        hachure_angle: o.hachure_angle,
        hachure_gap: o.hachure_gap,
        curve_step_count: o.curve_step_count,
        simplification: o.simplification,
    });
}

/// 添加手绘风格线段。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addRoughLine)]
pub fn js_add_rough_line(canvas_id: u32, opts: JsValue) {
    let o: RoughLineOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addRoughLine: invalid options - {}", e).into());
            return;
        }
    };
    let stroke = o.stroke.as_ref().map(|s| StrokeParams {
        width: s.width.max(0.5),
        color: s.color,
        linecap: s.linecap.clone(),
        linejoin: s.linejoin.clone(),
        miter_limit: s.miter_limit,
        stroke_dasharray: s.stroke_dasharray.clone(),
        stroke_dashoffset: s.stroke_dashoffset,
    }).unwrap_or_else(|| StrokeParams {
        width: 1.0,
        color: default_rgba_stroke(),
        linecap: default_linecap(),
        linejoin: default_linejoin(),
        miter_limit: default_miter_limit(),
        stroke_dasharray: None,
        stroke_dashoffset: 0.0,
    });
    push_shape(canvas_id, JsShape::RoughLine {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        x1: o.x1,
        y1: o.y1,
        x2: o.x2,
        y2: o.y2,
        stroke,
        opacity: o.opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        roughness: o.roughness,
        bowing: o.bowing,
        simplification: o.simplification,
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
    let stroke = o.stroke.as_ref().map(|s| StrokeParams {
        width: s.width.max(0.5),
        color: s.color,
        linecap: s.linecap.clone(),
        linejoin: s.linejoin.clone(),
        miter_limit: s.miter_limit,
        stroke_dasharray: s.stroke_dasharray.clone(),
        stroke_dashoffset: s.stroke_dashoffset,
    }).unwrap_or_else(|| StrokeParams {
        width: 1.0,
        color: default_rgba_stroke(),
        linecap: default_linecap(),
        linejoin: default_linejoin(),
        miter_limit: default_miter_limit(),
        stroke_dasharray: None,
        stroke_dashoffset: 0.0,
    });
    push_shape(canvas_id, JsShape::Line {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        x1: o.x1,
        y1: o.y1,
        x2: o.x2,
        y2: o.y2,
        stroke,
        opacity: o.opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        size_attenuation: o.size_attenuation,
        stroke_attenuation: o.stroke_attenuation,
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
    // 预计算文本布局
    let (text_parts, emoji_positions) = separate_emoji_from_text(&o.content);
    let content_hash = compute_hash(&o.content);

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
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        size_attenuation: o.size_attenuation,
        cached_layout: Some(CachedTextLayout {
            text_parts,
            emoji_positions,
            content_hash,
        }),
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

/// 相机变换选项，用于 setCameraTransform。
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraTransformOptions {
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
    #[serde(default = "default_scale")]
    pub scale: f64,
    #[serde(default)]
    pub rotation: f64,
}

#[cfg(target_arch = "wasm32")]
fn default_scale() -> f64 {
    1.0
}

/// 设置画布相机变换。opts 支持 { x, y, scale, rotation }，下一帧渲染前生效。
/// - x, y: 平移（世界坐标）
/// - scale: 缩放因子，1 为原始大小，2 为 2 倍放大
/// - rotation: 旋转弧度
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = setCameraTransform)]
pub fn js_set_camera_transform(canvas_id: u32, opts: JsValue) {
    let o: CameraTransformOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("setCameraTransform: invalid options - {}", e).into());
            return;
        }
    };
    // 构建与 ECS viewMatrix 等效的变换：S * R * T
    // ECS viewMatrix = (T_camera * R_camera * S_camera)^-1 = S_camera^-1 * R_camera^-1 * T_camera^-1
    // 其中 S_camera = S(1/zoom), R_camera = R(rotation), T_camera = T(x, y)
    // 所以 viewMatrix = S(zoom) * R(-rotation) * T(-x, -y)
    let affine = Affine::scale(o.scale)
        * Affine::rotate(o.rotation)
        * Affine::translate(Vec2::new(o.x, o.y));
    CAMERA_TRANSFORM_PENDING.with(|c| {
        c.borrow_mut().insert(canvas_id, affine);
    });
    if let Some(w) = CANVAS_WINDOWS.with(|c| c.borrow().get(&canvas_id).cloned()) {
        w.request_redraw();
    }
}

/// 请求画布重绘。JS 在更新相机或图形后调用，以触发下一帧渲染。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = requestRedraw)]
pub fn js_request_redraw(canvas_id: u32) {
    if let Some(w) = CANVAS_WINDOWS.with(|c| c.borrow().get(&canvas_id).cloned()) {
        w.request_redraw();
    }
}

/// 清空 emoji 缓存，释放内存。在切换字体或长时间运行后调用。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = clearEmojiCache)]
pub fn js_clear_emoji_cache() {
    EMOJI_CACHE.with(|c| c.borrow_mut().clear());
}

/// 清空字形缓存，释放内存。在切换字体或长时间运行后调用。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = clearGlyphCache)]
pub fn js_clear_glyph_cache() {
    GLYPH_CACHE.with(|c| c.borrow_mut().clear());
}

/// 清空所有缓存（emoji + 字形）。在切换字体或内存紧张时调用。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = clearAllCaches)]
pub fn js_clear_all_caches() {
    EMOJI_CACHE.with(|c| c.borrow_mut().clear());
    GLYPH_CACHE.with(|c| c.borrow_mut().clear());
}
