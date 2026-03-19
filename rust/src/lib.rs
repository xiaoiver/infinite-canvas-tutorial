//! Vello 2D GPU 渲染层：桌面与 wasm 共用逻辑。
//! Reference: [Graphite](https://github.com/GraphiteEditor/Graphite), [Vello](https://github.com/linebender/vello).
//!
//! 相机 transform 完全由 JS 侧通过 setCameraTransform 同步，Rust 不再监听 Mouse/Cursor/Touch 事件。

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
use serde::{Deserialize, Serialize};

#[cfg(target_arch = "wasm32")]
use std::cell::{Cell, RefCell};
#[cfg(target_arch = "wasm32")]
use std::collections::HashMap;
use std::sync::Arc;
use vello::kurbo::{Affine, BezPath, Cap, Ellipse, Join, Line, PathEl, Point, Rect, RoundedRect, Shape, Stroke, StrokeOpts, Vec2};

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

/// 描边对齐方式
#[derive(Clone, Debug, Default)]
pub enum StrokeAlignment {
    #[default]
    Center,
    Inner,
    Outer,
}

impl StrokeAlignment {
    fn from_str(s: &str) -> Self {
        match s {
            "inner" => StrokeAlignment::Inner,
            "outer" => StrokeAlignment::Outer,
            _ => StrokeAlignment::Center,
        }
    }
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
    pub alignment: StrokeAlignment,
    /// 模糊半径（标准差），0 表示不模糊
    pub blur: f64,
}

impl StrokeParams {
    fn to_kurbo_stroke(&self) -> Stroke {
        self.to_kurbo_stroke_with_width(self.width)
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

// ---------- 几何工具：Path 命中测试 & 包围盒（考虑 stroke 样式） ----------

/// Path flatten 后的子路径（open/closed polyline）。
#[derive(Clone, Debug)]
struct FlattenedSubpath {
    points: Vec<Point>,
    closed: bool,
}

fn cap_from_str(s: &str) -> Cap {
    match s {
        "round" => Cap::Round,
        "square" => Cap::Square,
        _ => Cap::Butt,
    }
}

fn join_from_str(s: &str) -> Join {
    match s {
        "round" => Join::Round,
        "bevel" => Join::Bevel,
        _ => Join::Miter,
    }
}

fn flatten_bez_path(path: &BezPath, tolerance: f64) -> Vec<FlattenedSubpath> {
    // kurbo 0.13 的 BezPath 不直接提供我们想要的“带 tolerance 的 flatten 回调”接口，
    // 这里用采样把 Quad/Cubic 细分成折线，作为命中与 bounds 的近似基础。
    let mut subs: Vec<FlattenedSubpath> = Vec::new();
    let mut cur: Vec<Point> = Vec::new();
    let mut closed = false;

    let mut cur_pt = Point::ORIGIN;
    let mut has_cur_pt = false;

    let push_subpath_if_any = |subs: &mut Vec<FlattenedSubpath>, cur: &mut Vec<Point>, closed: bool| {
        if cur.len() >= 2 {
            subs.push(FlattenedSubpath {
                points: cur.clone(),
                closed,
            });
        }
        cur.clear();
    };

    let quad_point = |p0: Point, p1: Point, p2: Point, t: f64| -> Point {
        let mt = 1.0 - t;
        let x = mt * mt * p0.x + 2.0 * mt * t * p1.x + t * t * p2.x;
        let y = mt * mt * p0.y + 2.0 * mt * t * p1.y + t * t * p2.y;
        Point::new(x, y)
    };
    let cubic_point = |p0: Point, p1: Point, p2: Point, p3: Point, t: f64| -> Point {
        let mt = 1.0 - t;
        let mt2 = mt * mt;
        let t2 = t * t;
        let x = mt2 * mt * p0.x
            + 3.0 * mt2 * t * p1.x
            + 3.0 * mt * t2 * p2.x
            + t2 * t * p3.x;
        let y = mt2 * mt * p0.y
            + 3.0 * mt2 * t * p1.y
            + 3.0 * mt * t2 * p2.y
            + t2 * t * p3.y;
        Point::new(x, y)
    };

    for el in path.iter() {
        match el {
            PathEl::MoveTo(p) => {
                push_subpath_if_any(&mut subs, &mut cur, closed);
                closed = false;
                cur.push(p);
                cur_pt = p;
                has_cur_pt = true;
            }
            PathEl::LineTo(p) => {
                if !has_cur_pt {
                    cur.push(p);
                    cur_pt = p;
                    has_cur_pt = true;
                } else {
                    cur.push(p);
                    cur_pt = p;
                }
            }
            PathEl::QuadTo(p1, p2) => {
                if !has_cur_pt {
                    // 非法 path：没有起点，直接把终点当起点
                    cur.push(p2);
                    cur_pt = p2;
                    has_cur_pt = true;
                    continue;
                }
                let p0 = cur_pt;
                let approx_len =
                    ((p1.x - p0.x).hypot(p1.y - p0.y) + (p2.x - p1.x).hypot(p2.y - p1.y)).max(1e-6);
                let mut n = (approx_len / tolerance.max(1e-3)).ceil() as usize;
                n = n.clamp(1, 200);
                for i in 1..=n {
                    let t = i as f64 / n as f64;
                    cur.push(quad_point(p0, p1, p2, t));
                }
                cur_pt = p2;
            }
            PathEl::CurveTo(p1, p2, p3) => {
                if !has_cur_pt {
                    cur.push(p3);
                    cur_pt = p3;
                    has_cur_pt = true;
                    continue;
                }
                let p0 = cur_pt;
                let approx_len = ((p1.x - p0.x).hypot(p1.y - p0.y)
                    + (p2.x - p1.x).hypot(p2.y - p1.y)
                    + (p3.x - p2.x).hypot(p3.y - p2.y))
                    .max(1e-6);
                let mut n = (approx_len / tolerance.max(1e-3)).ceil() as usize;
                n = n.clamp(1, 300);
                for i in 1..=n {
                    let t = i as f64 / n as f64;
                    cur.push(cubic_point(p0, p1, p2, p3, t));
                }
                cur_pt = p3;
            }
            PathEl::ClosePath => {
                closed = true;
            }
        }
    }

    if cur.len() >= 2 {
        subs.push(FlattenedSubpath { points: cur, closed });
    }
    subs
}

fn dist_point_to_segment(p: Point, a: Point, b: Point) -> f64 {
    let ab = Vec2::new(b.x - a.x, b.y - a.y);
    let ap = Vec2::new(p.x - a.x, p.y - a.y);
    let denom = ab.x * ab.x + ab.y * ab.y;
    if denom == 0.0 {
        return ((p.x - a.x).powi(2) + (p.y - a.y).powi(2)).sqrt();
    }
    let mut t = (ap.x * ab.x + ap.y * ab.y) / denom;
    if t < 0.0 {
        t = 0.0;
    } else if t > 1.0 {
        t = 1.0;
    }
    let proj = Point::new(a.x + ab.x * t, a.y + ab.y * t);
    ((p.x - proj.x).powi(2) + (p.y - proj.y).powi(2)).sqrt()
}

fn point_in_polygon_evenodd(p: Point, poly: &[Point]) -> bool {
    // Ray casting, even-odd rule.
    if poly.len() < 3 {
        return false;
    }
    let mut inside = false;
    let mut j = poly.len() - 1;
    for i in 0..poly.len() {
        let xi = poly[i].x;
        let yi = poly[i].y;
        let xj = poly[j].x;
        let yj = poly[j].y;
        // 避免水平边导致除零；水平边不会改变交点计数（采用常见的半开区间处理）。
        let dy = yj - yi;
        let intersect = (yi > p.y) != (yj > p.y)
            && dy != 0.0
            && (p.x < (xj - xi) * (p.y - yi) / dy + xi);
        if intersect {
            inside = !inside;
        }
        j = i;
    }
    inside
}

fn point_in_polygon_nonzero(p: Point, poly: &[Point]) -> bool {
    // Nonzero winding rule.
    if poly.len() < 3 {
        return false;
    }
    let mut winding: i32 = 0;
    let mut j = poly.len() - 1;
    for i in 0..poly.len() {
        let a = poly[j];
        let b = poly[i];
        if a.y <= p.y {
            if b.y > p.y && (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y) > 0.0 {
                winding += 1;
            }
        } else if b.y <= p.y && (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y) < 0.0 {
            winding -= 1;
        }
        j = i;
    }
    winding != 0
}

fn is_point_in_path_fill(d: &str, x: f64, y: f64, fill_rule: &str) -> bool {
    let Ok(bez) = BezPath::from_svg(d) else { return false; };
    let subs = flatten_bez_path(&bez, 0.25);
    let p = Point::new(x, y);

    // SVG 的 fill-rule 作用于整个复合路径：evenodd/非零环绕。
    if fill_rule == "evenodd" {
        let mut inside = false;
        for sp in subs.iter() {
            if sp.closed && sp.points.len() >= 3 && point_in_polygon_evenodd(p, &sp.points) {
                inside = !inside;
            }
        }
        inside
    } else {
        // nonzero：对每个 closed contour 累加 winding（这里用“逐 contour 判断”近似；
        // 对于复杂自交路径仍是近似，但比简单 bbox 更接近 Canvas2D）。
        // 更精确的做法是对所有边统一累计 winding；当前实现已足够用于选择/拾取。
        for sp in subs.iter() {
            if sp.closed && sp.points.len() >= 3 && point_in_polygon_nonzero(p, &sp.points) {
                return true;
            }
        }
        false
    }
}

fn stroke_effective_half_width(stroke: &StrokeParams) -> f64 {
    let base = match stroke.alignment {
        StrokeAlignment::Inner => 0.0,
        StrokeAlignment::Outer => stroke.width,
        StrokeAlignment::Center => stroke.width * 0.5,
    };
    let join = join_from_str(stroke.linejoin.as_str());
    let join_factor = if matches!(join, Join::Miter) {
        stroke.miter_limit.max(1.0)
    } else {
        1.0
    };
    // blur 以 3σ 近似可见范围
    let blur_expand = (stroke.blur.max(0.0)) * 3.0;
    base * join_factor + blur_expand
}

fn is_point_in_path_stroke(d: &str, x: f64, y: f64, stroke: &StrokeParams) -> bool {
    let Ok(bez) = BezPath::from_svg(d) else { return false; };
    let subs = flatten_bez_path(&bez, 0.25);
    let p = Point::new(x, y);

    // 注意：这里的命中是“近似 Canvas2D 的 isPointInStroke”，采用 flatten 后的线段距离。
    // 对曲线越精确，tolerance 越小（但更慢）。
    let cap = cap_from_str(stroke.linecap.as_str());
    let join = join_from_str(stroke.linejoin.as_str());
    let hw = stroke_effective_half_width(stroke);
    if hw <= 0.0 {
        return false;
    }

    for sp in subs.iter() {
        if sp.points.len() < 2 {
            continue;
        }

        // 线段距离
        for i in 0..(sp.points.len() - 1) {
            let a = sp.points[i];
            let b = sp.points[i + 1];
            if dist_point_to_segment(p, a, b) <= hw {
                return true;
            }
        }
        if sp.closed {
            // close segment
            let a = *sp.points.last().unwrap();
            let b = sp.points[0];
            if dist_point_to_segment(p, a, b) <= hw {
                return true;
            }
        }

        // join/cap 的“保守补偿”（避免锐角/端点附近漏选）
        // - join：round/miter/bevel 在拐角外侧可能超出两条线段的距离阈值，这里用顶点圆近似补充
        if sp.points.len() >= 3 {
            for v in sp.points.iter().skip(1).take(sp.points.len() - 2) {
                let dv = ((p.x - v.x).powi(2) + (p.y - v.y).powi(2)).sqrt();
                let r = match join {
                    Join::Miter => hw,
                    _ => hw,
                };
                if dv <= r {
                    return true;
                }
            }
        }

        // - cap：open path 需要考虑 round/square 的端帽区域
        if !sp.closed {
            let p0 = sp.points[0];
            let p1 = sp.points[1];
            let pn = *sp.points.last().unwrap();
            let pn1 = sp.points[sp.points.len() - 2];

            match cap {
                Cap::Round => {
                    let d0 = ((p.x - p0.x).powi(2) + (p.y - p0.y).powi(2)).sqrt();
                    let dn = ((p.x - pn.x).powi(2) + (p.y - pn.y).powi(2)).sqrt();
                    if d0 <= hw || dn <= hw {
                        return true;
                    }
                }
                Cap::Square => {
                    // 端点沿切线方向外扩 hw 的矩形近似
                    let dir0 = Vec2::new(p0.x - p1.x, p0.y - p1.y);
                    let dirn = Vec2::new(pn.x - pn1.x, pn.y - pn1.y);

                    let square_cap_hit = |end: Point, dir: Vec2| -> bool {
                        let len = (dir.x * dir.x + dir.y * dir.y).sqrt();
                        if len == 0.0 {
                            return false;
                        }
                        let ux = dir.x / len;
                        let uy = dir.y / len;
                        // 投影到切线/法线坐标
                        let dx = p.x - end.x;
                        let dy = p.y - end.y;
                        let t = dx * ux + dy * uy;
                        let n = (-uy) * dx + ux * dy;
                        t >= 0.0 && t <= hw && n.abs() <= hw
                    };

                    if square_cap_hit(p0, dir0) || square_cap_hit(pn, dirn) {
                        return true;
                    }
                }
                _ => {}
            }
        }
    }
    false
}

#[allow(dead_code)]
fn path_geometry_bounds(d: &str) -> Option<Rect> {
    let Ok(bez) = BezPath::from_svg(d) else { return None; };
    let bbox = bez.bounding_box();
    Some(bbox)
}

/// 精确包围盒：fill 用 BezPath::bounding_box()，stroke 用 Kurbo 的 stroke 展开成轮廓 path 再取 bbox，两者 union。
/// 若提供 marker_start/marker_end 为 "line" 且 marker_factor > 0，则在起点/终点处按 marker 的 V 形范围（半径 r = stroke_width * marker_factor）扩张。
fn path_render_bounds(
    d: &str,
    stroke: Option<&StrokeParams>,
    marker_start: &str,
    marker_end: &str,
    marker_factor: f32,
) -> Option<Rect> {
    let bez = BezPath::from_svg(d).ok()?;
    let fill_rect = bez.bounding_box();
    let mut result = fill_rect;

    if let Some(s) = stroke {
        if s.width > 0.0 {
            let kurbo_stroke = s.to_kurbo_stroke();
            let opts = StrokeOpts::default();
            const TOLERANCE: f64 = 0.1;
            let stroke_path = vello::kurbo::stroke(bez.iter(), &kurbo_stroke, &opts, TOLERANCE);
            let stroke_rect = stroke_path.bounding_box();
            result = result.union(stroke_rect);
        }
        let blur = s.blur.max(0.0) * 3.0;
        if blur > 0.0 {
            result = Rect::new(
                result.x0 - blur,
                result.y0 - blur,
                result.x1 + blur,
                result.y1 + blur,
            );
        }
        // marker（line）：起点/终点处 V 形箭头，半径 r = stroke_width * marker_factor，扩张 bbox
        if marker_factor > 0.0 && (marker_start == "line" || marker_end == "line") {
            if let Some(((sx, sy), _start_angle, (ex, ey), _end_angle)) = path_start_end_tangents(&bez) {
                let r = s.width * marker_factor as f64;
                let expand_marker = |rect: Rect, px: f64, py: f64| {
                    rect.union(Rect::new(px - r, py - r, px + r, py + r))
                };
                if marker_start == "line" {
                    result = expand_marker(result, sx, sy);
                }
                if marker_end == "line" {
                    result = expand_marker(result, ex, ey);
                }
            }
        }
    }

    Some(result)
}

/// Drop shadow 参数
#[derive(Clone, Debug, Default)]
pub struct DropShadow {
    pub color: [f32; 4],
    pub blur: f64,
    pub offset_x: f64,
    pub offset_y: f64,
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
        z_index: f32,
        ui: bool,
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
        /// fill 模糊半径（标准差）
        fill_blur: f64,
        /// drop shadow 效果
        drop_shadow: Option<DropShadow>,
    },
    Ellipse {
        id: String,
        parent_id: Option<String>,
        z_index: f32,
        ui: bool,
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
        /// drop shadow 效果
        drop_shadow: Option<DropShadow>,
    },
    Line {
        id: String,
        parent_id: Option<String>,
        z_index: f32,
        ui: bool,
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
        /// 线段起点 marker：'none' | 'line'
        marker_start: String,
        /// 线段终点 marker：'none' | 'line'
        marker_end: String,
        /// marker 尺寸因子（如箭头长度）
        marker_factor: f32,
    },
    /// 文本，属性对齐 ecs TextAttributes / TextSerializedNode
    Text {
        id: String,
        parent_id: Option<String>,
        z_index: f32,
        ui: bool,
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
        font_kerning: bool,
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
    },
    /// 图片填充的矩形，image_data 为 RGBA 像素数据。
    ImageRect {
        id: String,
        parent_id: Option<String>,
        z_index: f32,
        ui: bool,
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
        /// drop shadow 效果
        drop_shadow: Option<DropShadow>,
    },
    /// SVG path，d 为 path 的 d 属性（如 "M 10 10 L 100 100 Z"）。
    Path {
        id: String,
        parent_id: Option<String>,
        z_index: f32,
        ui: bool,
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
        marker_start: String,
        marker_end: String,
        marker_factor: f32,
        /// drop shadow 效果
        drop_shadow: Option<DropShadow>,
    },
    /// 折线，points 为 [[x,y],[x,y],...]。
    Polyline {
        id: String,
        parent_id: Option<String>,
        z_index: f32,
        ui: bool,
        points: Vec<[f64; 2]>,
        stroke: Option<StrokeParams>,
        opacity: f32,
        fill_opacity: f32,
        stroke_opacity: f32,
        local_transform: Option<Mat3Array>,
        size_attenuation: bool,
        stroke_attenuation: bool,
        marker_start: String,
        marker_end: String,
        marker_factor: f32,
    },
    /// 组/容器，用于组织子元素。本身没有可见内容，只提供变换和层级。
    Group {
        id: String,
        parent_id: Option<String>,
        z_index: f32,
        ui: bool,
        local_transform: Option<Mat3Array>,
    },
    /// 手绘风格矩形。
    RoughRect {
        id: String,
        parent_id: Option<String>,
        z_index: f32,
        ui: bool,
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
        z_index: f32,
        ui: bool,
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
        z_index: f32,
        ui: bool,
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
    /// 手绘风格折线。
    RoughPolyline {
        id: String,
        parent_id: Option<String>,
        z_index: f32,
        ui: bool,
        points: Vec<[f64; 2]>,
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
    /// 手绘风格 SVG path。
    RoughPath {
        id: String,
        parent_id: Option<String>,
        z_index: f32,
        ui: bool,
        d: String,
        fill: [f32; 4],
        stroke: Option<StrokeParams>,
        fill_rule: String,
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
}

#[cfg(target_arch = "wasm32")]
impl JsShape {
    fn id(&self) -> &str {
        match self {
            JsShape::Rect { id, .. } | JsShape::Ellipse { id, .. } | JsShape::Line { id, .. } | JsShape::Text { id, .. } | JsShape::ImageRect { id, .. } | JsShape::Path { id, .. } | JsShape::Polyline { id, .. } | JsShape::Group { id, .. } | JsShape::RoughRect { id, .. } | JsShape::RoughEllipse { id, .. } | JsShape::RoughLine { id, .. } | JsShape::RoughPolyline { id, .. } | JsShape::RoughPath { id, .. } => id,
        }
    }
    fn parent_id(&self) -> Option<&str> {
        match self {
            JsShape::Rect { parent_id, .. } | JsShape::Ellipse { parent_id, .. } | JsShape::Line { parent_id, .. } | JsShape::Text { parent_id, .. } | JsShape::ImageRect { parent_id, .. } | JsShape::Path { parent_id, .. } | JsShape::Polyline { parent_id, .. } | JsShape::Group { parent_id, .. } | JsShape::RoughRect { parent_id, .. } | JsShape::RoughEllipse { parent_id, .. } | JsShape::RoughLine { parent_id, .. } | JsShape::RoughPolyline { parent_id, .. } | JsShape::RoughPath { parent_id, .. } => parent_id.as_deref(),
        }
    }
    fn z_index(&self) -> f32 {
        match self {
            JsShape::Rect { z_index, .. } | JsShape::Ellipse { z_index, .. } | JsShape::Line { z_index, .. } | JsShape::Text { z_index, .. } | JsShape::ImageRect { z_index, .. } | JsShape::Path { z_index, .. } | JsShape::Polyline { z_index, .. } | JsShape::Group { z_index, .. } | JsShape::RoughRect { z_index, .. } | JsShape::RoughEllipse { z_index, .. } | JsShape::RoughLine { z_index, .. } | JsShape::RoughPolyline { z_index, .. } | JsShape::RoughPath { z_index, .. } => *z_index,
        }
    }

    fn ui(&self) -> bool {
        match self {
            JsShape::Rect { ui, .. }
            | JsShape::Ellipse { ui, .. }
            | JsShape::Line { ui, .. }
            | JsShape::Text { ui, .. }
            | JsShape::ImageRect { ui, .. }
            | JsShape::Path { ui, .. }
            | JsShape::Polyline { ui, .. }
            | JsShape::Group { ui, .. }
            | JsShape::RoughRect { ui, .. }
            | JsShape::RoughEllipse { ui, .. }
            | JsShape::RoughLine { ui, .. }
            | JsShape::RoughPolyline { ui, .. }
            | JsShape::RoughPath { ui, .. } => *ui,
        }
    }
    /// 若存在则返回 local_transform（ECS Mat3 格式）。
    fn local_transform(&self) -> Option<&Mat3Array> {
        match self {
            JsShape::Rect { local_transform, .. } | JsShape::Ellipse { local_transform, .. } | JsShape::Line { local_transform, .. } | JsShape::Text { local_transform, .. } | JsShape::ImageRect { local_transform, .. } | JsShape::Path { local_transform, .. } | JsShape::Polyline { local_transform, .. } | JsShape::Group { local_transform, .. } | JsShape::RoughRect { local_transform, .. } | JsShape::RoughEllipse { local_transform, .. } | JsShape::RoughLine { local_transform, .. } | JsShape::RoughPolyline { local_transform, .. } | JsShape::RoughPath { local_transform, .. } => local_transform.as_ref(),
        }
    }
    /// 局部坐标系下的"原点"（用于计算相对父节点的偏移）。
    fn local_origin(&self) -> Point {
        match self {
            JsShape::Rect { x, y, .. } | JsShape::ImageRect { x, y, .. } | JsShape::RoughRect { x, y, .. } => Point::new(*x, *y),
            JsShape::Ellipse { cx, cy, .. } | JsShape::RoughEllipse { cx, cy, .. } => Point::new(*cx, *cy),
            JsShape::Line { x1, y1, .. } | JsShape::RoughLine { x1, y1, .. } => Point::new(*x1, *y1),
            JsShape::Text { anchor_x, anchor_y, .. } => Point::new(*anchor_x, *anchor_y),
            JsShape::Path { .. } | JsShape::Polyline { .. } | JsShape::Group { .. } | JsShape::RoughPolyline { .. } | JsShape::RoughPath { .. } => Point::ORIGIN,
        }
    }
}

#[cfg(target_arch = "wasm32")]
thread_local! {
    /// 每个画布 id 对应一份图形列表，支持多画布。
    static CANVAS_SHAPES: RefCell<HashMap<u32, Vec<JsShape>>> = RefCell::new(HashMap::new());
    static NEXT_CANVAS_ID: RefCell<u32> = RefCell::new(0);
    /// 多画布：在同一次 runWithCanvas 调用批次中收集的 (canvas, on_ready)，由 run_all_canvases_async 统一处理。
    static PENDING_CANVASES: RefCell<Vec<(web_sys::HtmlCanvasElement, js_sys::Function)>> = RefCell::new(Vec::new());
    /// 是否已调度过“统一 runner”，保证只启动一个 event loop。
    static RUNNER_SCHEDULED: Cell<bool> = Cell::new(false);
    /// 默认字体 TTF/OTF 字节列表，由 registerFont 等 API 设置后才能渲染文本。
    /// 目前简化为使用第一个字体进行排版与渲染；未来可以在 Parley 侧扩展为真正的字体 fallback。
    static FONT_BYTES: RefCell<Vec<Vec<u8>>> = RefCell::new(Vec::new());
    /// 待应用的相机变换，由 setCameraTransform 设置，下一帧渲染前应用。
    static CAMERA_TRANSFORM_PENDING: RefCell<HashMap<u32, Affine>> = RefCell::new(HashMap::new());
    /// 待应用的 canvas 级渲染开关，由 setCanvasRenderOptions 设置，仅影响下一帧。
    static CANVAS_RENDER_OPTIONS_PENDING: RefCell<HashMap<u32, CanvasRenderOptions>> =
        RefCell::new(HashMap::new());
    /// canvas_id -> Window，用于由 JS 触发重绘。
    static CANVAS_WINDOWS: RefCell<HashMap<u32, Arc<Window>>> = RefCell::new(HashMap::new());
    /// 导出局部图：下一帧用给定视口渲染，渲染后调用 on_rendered，再下一帧恢复画布尺寸与变换。
    static EXPORT_VIEW_PENDING: RefCell<HashMap<u32, (ExportViewOpts, js_sys::Function)>> = RefCell::new(HashMap::new());
    /// 导出帧已渲染，下一帧需要恢复画布。
    static RESTORE_PENDING: RefCell<HashMap<u32, ()>> = RefCell::new(HashMap::new());
    /// 恢复用：保存的 (width, height, transform)。
    static RESTORE_STATE: RefCell<HashMap<u32, (u32, u32, Affine)>> = RefCell::new(HashMap::new());
    /// emoji 图片缓存：字符 -> (RGBA 数据, 宽度, 高度)
    static EMOJI_CACHE: RefCell<HashMap<String, (Vec<u8>, u32, u32)>> = RefCell::new(HashMap::new());
    /// 字形缓存：(文本, 字体大小, font_family, line_height_bits, letter_spacing_bits, font_kerning, word_wrap, word_wrap_width_bits, text_align, font_weight, font_style, font_variant) -> (FontData, glyphs, size, emoji_positions)，命中时直接使用，避免每帧重新排版（尤其对中文字体）
    static GLYPH_CACHE: RefCell<
        HashMap<
            (String, u32, String, u32, u32, bool, bool, u64, String, String, String, String),
            (Vec<(vello::peniko::FontData, Vec<vello::Glyph>)>, f32, Vec<EmojiPosition>),
        >,
    > = RefCell::new(HashMap::new());
    /// 全局 FontContext 缓存，避免每帧重建
    static FONT_CONTEXT: RefCell<Option<parley::FontContext>> = RefCell::new(None);
    /// 已注册字体指纹（避免中文字体每帧重复 register_fonts）
    static LAST_REGISTERED_FONT_FINGERPRINT: RefCell<Option<u64>> = RefCell::new(None);
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

/// Canvas 级别渲染开关：用于控制下一帧是否绘制网格/UI 图形。
pub struct CanvasRenderOptions {
    pub grid: bool,
    pub ui: bool,
}

impl Default for CanvasRenderOptions {
    fn default() -> Self {
        Self { grid: true, ui: true }
    }
}

#[cfg(target_arch = "wasm32")]
fn take_pending_canvas_render_options(canvas_id: Option<u32>) -> CanvasRenderOptions {
    canvas_id
        .and_then(|cid| CANVAS_RENDER_OPTIONS_PENDING.with(|c| c.borrow_mut().remove(&cid)))
        .unwrap_or_default()
}

#[cfg(not(target_arch = "wasm32"))]
fn take_pending_canvas_render_options(_canvas_id: Option<u32>) -> CanvasRenderOptions {
    CanvasRenderOptions::default()
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
    pub z_index: f32,
    #[serde(default)]
    pub ui: bool,
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
    #[serde(default)]
    pub fill_blur: f64,
    #[serde(default)]
    pub drop_shadow: Option<DropShadowOptions>,
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
    pub z_index: f32,
    #[serde(default)]
    pub ui: bool,
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
    #[serde(default)]
    pub drop_shadow: Option<DropShadowOptions>,
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
    pub z_index: f32,
    #[serde(default)]
    pub ui: bool,
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
    #[serde(default = "default_marker_start")]
    pub marker_start: String,
    #[serde(default = "default_marker_end")]
    pub marker_end: String,
    #[serde(default = "default_marker_factor")]
    pub marker_factor: f32,
}

/// Drop shadow 选项
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DropShadowOptions {
    #[serde(default = "default_rgba")]
    pub color: [f32; 4],
    #[serde(default)]
    pub blur: f64,
    #[serde(default)]
    pub offset_x: f64,
    #[serde(default)]
    pub offset_y: f64,
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
    #[serde(default = "default_stroke_alignment")]
    pub alignment: String,
    #[serde(default)]
    pub blur: f64,
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
#[cfg(target_arch = "wasm32")]
fn default_stroke_alignment() -> String {
    "center".to_string()
}
#[cfg(target_arch = "wasm32")]
fn default_marker_start() -> String {
    "none".to_string()
}
#[cfg(target_arch = "wasm32")]
fn default_marker_end() -> String {
    "none".to_string()
}
#[cfg(target_arch = "wasm32")]
fn default_marker_factor() -> f32 {
    3.0
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
    pub z_index: f32,
    #[serde(default)]
    pub ui: bool,
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
    #[serde(default)]
    pub drop_shadow: Option<DropShadowOptions>,
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
    pub z_index: f32,
    #[serde(default)]
    pub ui: bool,
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
    #[serde(default = "default_marker_start")]
    pub marker_start: String,
    #[serde(default = "default_marker_end")]
    pub marker_end: String,
    #[serde(default = "default_marker_factor")]
    pub marker_factor: f32,
    #[serde(default)]
    pub drop_shadow: Option<DropShadowOptions>,
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
    pub z_index: f32,
    #[serde(default)]
    pub ui: bool,
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
    #[serde(default = "default_marker_start")]
    pub marker_start: String,
    #[serde(default = "default_marker_end")]
    pub marker_end: String,
    #[serde(default = "default_marker_factor")]
    pub marker_factor: f32,
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
    pub z_index: f32,
    #[serde(default)]
    pub ui: bool,
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
    pub z_index: f32,
    #[serde(default)]
    pub ui: bool,
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
    pub z_index: f32,
    #[serde(default)]
    pub ui: bool,
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

/// RoughPolyline 选项。手绘风格折线。
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoughPolylineOptions {
    #[serde(deserialize_with = "deserialize_id")]
    pub id: String,
    #[serde(default, deserialize_with = "deserialize_parent_id")]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub z_index: f32,
    #[serde(default)]
    pub ui: bool,
    pub points: Vec<[f64; 2]>,
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

/// RoughPath 选项。手绘风格 SVG path。
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoughPathOptions {
    #[serde(deserialize_with = "deserialize_id")]
    pub id: String,
    #[serde(default, deserialize_with = "deserialize_parent_id")]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub z_index: f32,
    #[serde(default)]
    pub ui: bool,
    pub d: String,
    #[serde(default = "default_rgba_fill")]
    pub fill: [f32; 4],
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
    pub z_index: f32,
    #[serde(default)]
    pub ui: bool,
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
    pub z_index: f32,
    #[serde(default)]
    pub ui: bool,
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
    #[serde(default = "default_font_kerning")]
    pub font_kerning: bool,
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

/// 文本几何包围盒（局部坐标系下，以文本锚点为原点）。
/// JS 侧可在此基础上应用 local_transform / 世界变换，用于拾取或对齐。
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Serialize)]
pub struct TextBounds {
    pub min_x: f64,
    pub min_y: f64,
    pub max_x: f64,
    pub max_y: f64,
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
fn default_font_kerning() -> bool {
    true
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
fn default_rgba() -> [f32; 4] {
    [0.0, 0.0, 0.0, 0.5]
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

/// 从 BezPath 得到起点/终点位置与切线方向（弧度），用于 marker 绘制。
/// 返回 (start_pt, start_angle, end_pt, end_angle)。
fn path_start_end_tangents(path: &BezPath) -> Option<((f64, f64), f64, (f64, f64), f64)> {
    let el = path.elements();
    if el.is_empty() {
        return None;
    }
    let mut current = match el[0] {
        PathEl::MoveTo(p) => p,
        _ => return None,
    };
    let start_pt = (current.x, current.y);
    let mut start_angle = None::<f64>;
    let mut end_pt = (current.x, current.y);
    let mut end_angle = None::<f64>;
    let mut subpath_start = current;

    for i in 1..el.len() {
        match el[i] {
            PathEl::LineTo(p) => {
                let dx = p.x - current.x;
                let dy = p.y - current.y;
                let a = dy.atan2(dx);
                if start_angle.is_none() {
                    start_angle = Some(a);
                }
                end_angle = Some(a);
                end_pt = (p.x, p.y);
                current = p;
            }
            PathEl::QuadTo(p1, p2) => {
                let dx = p1.x - current.x;
                let dy = p1.y - current.y;
                if start_angle.is_none() && (dx != 0.0 || dy != 0.0) {
                    start_angle = Some(dy.atan2(dx));
                }
                let dxe = p2.x - p1.x;
                let dye = p2.y - p1.y;
                if dxe != 0.0 || dye != 0.0 {
                    end_angle = Some(dye.atan2(dxe));
                }
                end_pt = (p2.x, p2.y);
                current = p2;
            }
            PathEl::CurveTo(p1, p2, p3) => {
                let dx = p1.x - current.x;
                let dy = p1.y - current.y;
                if start_angle.is_none() && (dx != 0.0 || dy != 0.0) {
                    start_angle = Some(dy.atan2(dx));
                }
                let dxe = p3.x - p2.x;
                let dye = p3.y - p2.y;
                if dxe != 0.0 || dye != 0.0 {
                    end_angle = Some(dye.atan2(dxe));
                }
                end_pt = (p3.x, p3.y);
                current = p3;
            }
            PathEl::MoveTo(p) => {
                subpath_start = p;
                current = p;
                end_pt = (p.x, p.y);
                end_angle = None;
                // 不重置 start_*，保留整条 path 的起点（第一个 subpath 的起点）
            }
            PathEl::ClosePath => {
                let dx = subpath_start.x - current.x;
                let dy = subpath_start.y - current.y;
                if dx != 0.0 || dy != 0.0 {
                    end_angle = Some(dy.atan2(dx));
                }
                end_pt = (subpath_start.x, subpath_start.y);
                current = subpath_start;
            }
        }
    }
    let start_a = start_angle?;
    let end_a = end_angle?;
    Some((start_pt, start_a, end_pt, end_a))
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
        // 0x1F3FB..=0x1F3FF 被 0x1F300..=0x1F5FF 覆盖，跳过
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

/// Emoji 位置信息
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Clone)]
struct EmojiPosition {
    emoji: String,
    x: f64,
    y: f64,
}

/// 计算字体字节的指纹（长度 + 首尾若干字节），用于避免重复 register_fonts。
#[cfg(target_arch = "wasm32")]
fn font_bytes_fingerprint(bytes: &[u8]) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    bytes.len().hash(&mut hasher);
    let n = bytes.len().min(256);
    if n > 0 {
        bytes[..n].hash(&mut hasher);
        let tail = bytes.len().saturating_sub(256);
        if tail > n {
            bytes[tail..].hash(&mut hasher);
        }
    }
    hasher.finish()
}

/// 获取或创建 emoji 图片数据。
/// `size` 为渲染尺寸（像素），建议使用 2x 字体大小以得到高清图，绘制时再缩放到字体大小。
#[cfg(target_arch = "wasm32")]
fn get_or_create_emoji_image(emoji: &str, size: u32) -> Option<(Vec<u8>, u32, u32)> {
    let cache_key = format!("{}_{}", emoji, size);

    // 先检查缓存
    let cached = EMOJI_CACHE.with(|c| c.borrow().get(&cache_key).cloned());
    if let Some(data) = cached {
        return Some(data);
    }

    // 使用 HTML Canvas API 渲染 emoji（高清：canvas 再乘 DPR）
    let document = web_sys::window()?.document()?;
    let canvas = document.create_element("canvas").ok()?.dyn_into::<web_sys::HtmlCanvasElement>().ok()?;

    let dpr = web_sys::window()?.device_pixel_ratio() as f32;
    let canvas_size = (size as f32 * dpr).ceil() as u32;
    canvas.set_width(canvas_size);
    canvas.set_height(canvas_size);

    let ctx = canvas.get_context("2d").ok()??.dyn_into::<web_sys::CanvasRenderingContext2d>().ok()?;

    ctx.scale(dpr as f64, dpr as f64).ok()?;

    ctx.clear_rect(0.0, 0.0, size as f64, size as f64);
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

/// 将 CSS font-variant 映射为 Parley FontFeature 列表（如 small-caps -> smcp）。
#[cfg(target_arch = "wasm32")]
fn font_variant_to_features(variant: &str) -> Vec<parley::style::FontFeature> {
    use parley::style::FontFeature;
    let v = variant.to_lowercase();
    let v = v.trim();
    if v.is_empty() || v == "normal" {
        return Vec::new();
    }
    let mut out = Vec::new();
    for part in v.split(|c: char| c == ' ' || c == ',') {
        let part = part.trim();
        if part == "small-caps" {
            if let Some(f) = FontFeature::parse("smcp=1") {
                out.push(f);
            }
        } else if part == "all-small-caps" {
            if let Some(f) = FontFeature::parse("smcp=1") {
                out.push(f);
            }
            if let Some(f) = FontFeature::parse("c2sc=1") {
                out.push(f);
            }
        } else if part == "tabular-nums" {
            if let Some(f) = FontFeature::parse("tnum=1") {
                out.push(f);
            }
        } else if part == "lining-nums" {
            if let Some(f) = FontFeature::parse("lnum=1") {
                out.push(f);
            }
        } else if part == "oldstyle-nums" {
            if let Some(f) = FontFeature::parse("onum=1") {
                out.push(f);
            }
        }
    }
    out
}

/// 将 Canvas textAlign 字符串映射为 Parley Alignment。
#[cfg(target_arch = "wasm32")]
fn text_align_to_parley(align: &str) -> parley::Alignment {
    let a = align.trim();
    if a.eq_ignore_ascii_case("center") {
        parley::Alignment::Center
    } else if a.eq_ignore_ascii_case("end") || a.eq_ignore_ascii_case("right") {
        parley::Alignment::End
    } else {
        parley::Alignment::Start // "start" | "left" | "direction" 等
    }
}

/// 使用 Parley 将字符串与字体字节解析为 vello 可绘制的 Glyph 列表；支持 kerning、ligatures、bidi 等。
/// 返回 peniko FontData 供 draw_glyphs 使用，同时返回 emoji 的实际位置。
/// 使用全局 FontContext 缓存以提高性能。
/// font_family: 请求的字体族名称（如 "Gaegu"、"Noto Sans"），若在已注册字体中存在则使用，否则回退到集合中第一个 family。
/// line_height: 行高（绝对像素）；≤0 时使用字号作为默认行高。
/// font_kerning: 是否启用字距调整（对应 Canvas fontKerning）；false 时通过关闭 OpenType kern 特性实现。
/// text_align: 行内对齐，对应 Canvas textAlign（"start"|"left"|"center"|"end"|"right"）。
/// font_weight / font_style / font_variant: 对应 CSS font-weight、font-style、font-variant（如 "bold"、"italic"、"small-caps"）。
#[cfg(target_arch = "wasm32")]
fn build_text_glyphs_with_emoji_positions(
    content: &str,
    font_size_px: f32,
    letter_spacing: f32,
    line_height_px: f32,
    font_kerning: bool,
    font_family: &str,
    font_weight: &str,
    font_style: &str,
    font_variant: &str,
    word_wrap: bool,
    word_wrap_width: f64,
    text_align: &str,
) -> Option<(Vec<(vello::peniko::FontData, Vec<vello::Glyph>)>, f32, Vec<EmojiPosition>, Option<(f32, f32, f32, f32)>)> {
    use std::borrow::Cow;
    use parley::fontique::Blob;
    use parley::layout::PositionedLayoutItem;
    use parley::style::{FontFamily, FontFeature, FontSettings, FontStyle, FontWeight, OverflowWrap, WordBreakStrength};
    use parley::{AlignmentOptions, LayoutContext, LineHeight, StyleProperty};

    let font_bytes_list = FONT_BYTES.with(|c| c.borrow().clone());
    if font_bytes_list.is_empty() {
        return None;
    }

    FONT_CONTEXT.with(|fc| {
        let mut font_cx_ref = fc.borrow_mut();
        if font_cx_ref.is_none() {
            *font_cx_ref = Some(parley::FontContext::new());
        }

        let font_cx = font_cx_ref.as_mut()?;

        // 按 registerFont 的原始顺序注册，保证多字体时每个 family 都能被正确解析（排序会导致“仅最后一种字体生效”）。
        let fonts_for_fp: Vec<(u64, Vec<u8>)> = font_bytes_list
            .iter()
            .map(|bytes| (font_bytes_fingerprint(bytes), bytes.clone()))
            .collect();
        if fonts_for_fp.is_empty() {
            return None;
        }
        // 仅当字体集合变化时再注册；指纹用排序后的 fp 计算，使相同字体集合得到相同 combined_fp。
        let mut fps_sorted: Vec<u64> = fonts_for_fp.iter().map(|(fp, _)| *fp).collect();
        fps_sorted.sort_unstable();
        let mut combined_fp: u64 = 0;
        for fp in &fps_sorted {
            combined_fp = combined_fp.wrapping_mul(1315423911) ^ *fp;
        }
        let need_register = LAST_REGISTERED_FONT_FINGERPRINT.with(|r| {
            let mut ref_mut = r.borrow_mut();
            let prev = *ref_mut;
            if prev != Some(combined_fp) {
                *ref_mut = Some(combined_fp);
                true
            } else {
                false
            }
        });
        if need_register {
            font_cx.collection.clear();
            GLYPH_CACHE.with(|c| c.borrow_mut().clear());
            // 严格按 registerFont 顺序注册，便于 Parley 按 family 正确解析多字体。
            for (_, bytes) in &fonts_for_fp {
                let font_blob = Blob::new(Arc::new(bytes.clone()));
                font_cx.collection.register_fonts(font_blob, None);
            }
        }

        // 根据请求的 font_family 选择已注册字体中的 family：精确匹配（忽略大小写）或前缀匹配（如 "Noto Sans" 匹配 "Noto Sans CJK SC"）。
        // 按注册顺序，第一个注册的字体作为 fallback。
        let requested = font_family.trim();
        let family_names: Vec<String> = font_cx.collection.family_names().map(|s| s.to_string()).collect();
        let fallback_family = family_names.first().cloned().unwrap_or_else(|| "sans-serif".to_string());
        let family_name = if requested.is_empty() {
            fallback_family
        } else {
            family_names
                .iter()
                .find(|n| n.eq_ignore_ascii_case(requested) || n.starts_with(requested))
                .cloned()
                .unwrap_or_else(|| fallback_family)
        };

        let mut layout_cx = LayoutContext::new();
        // 按 run 收集：每个 run 用自己的 font 绘制，多字体 fallback 时不会错乱
        let mut glyph_runs: Vec<(vello::peniko::FontData, Vec<vello::Glyph>)> = Vec::new();
        let mut emoji_positions = Vec::new();
        let mut line_y = 0.0f32;
        // 用 Parley 的 line.metrics() 与 run.offset()/advance() 累加精确包围盒，避免每字 0.6/0.8/0.2 估计
        let mut layout_min_x = f32::INFINITY;
        let mut layout_min_y = f32::INFINITY;
        let mut layout_max_x = f32::NEG_INFINITY;
        let mut layout_max_y = f32::NEG_INFINITY;

        // 与 separate_emoji_from_text 一致：按 \n 分割，每段单独排版，避免 Parley 把换行符当成单独一行
        let line_segments: Vec<&str> = content.split('\n').collect();

        for segment in line_segments {
            if segment.is_empty() {
                // 空行（如连续 \n）仍占一行高度；绝对值时用 line_height_px，否则用字号
                line_y += if line_height_px > 0.0 { line_height_px } else { font_size_px };
                continue;
            }

            let mut builder = layout_cx.ranged_builder(font_cx, segment, 1.0, true);
            builder.push_default(FontFamily::Named(Cow::Borrowed(&family_name)));
            builder.push_default(if line_height_px > 0.0 {
                LineHeight::Absolute(line_height_px)
            } else {
                LineHeight::FontSizeRelative(1.0)
            });
            builder.push_default(StyleProperty::FontSize(font_size_px));
            if let Some(w) = FontWeight::parse(font_weight.trim()) {
                builder.push_default(StyleProperty::FontWeight(w));
            }
            if let Some(s) = FontStyle::parse(font_style.trim()) {
                builder.push_default(StyleProperty::FontStyle(s));
            }
            // font-variant 映射到 OpenType 特性（如 small-caps -> smcp）；与 font_kerning 合并为一次 FontFeatures
            let mut font_features = font_variant_to_features(font_variant.trim());
            if !font_kerning {
                if let Some(kern_off) = FontFeature::parse("kern=0") {
                    font_features.push(kern_off);
                }
            }
            if !font_features.is_empty() {
                builder.push_default(StyleProperty::FontFeatures(FontSettings::List(Cow::Owned(
                    font_features,
                ))));
            }
            if letter_spacing != 0.0 {
                builder.push_default(StyleProperty::LetterSpacing(letter_spacing));
            }
            // 开启 wordWrap 时允许在任意字符处换行，否则无空格长串（如 "Abcdefghijklmnop"）会整行显示不换行
            if word_wrap && word_wrap_width > 0.0 {
                builder.push_default(StyleProperty::WordBreak(WordBreakStrength::BreakAll));
                builder.push_default(StyleProperty::OverflowWrap(OverflowWrap::Anywhere));
            }

            let mut layout: parley::Layout<()> = builder.build(segment);
            // 当开启 wordWrap 且 wordWrapWidth > 0 时，按最大宽度换行（与 ECS Text 组件行为一致）
            let max_advance = if word_wrap && word_wrap_width > 0.0 {
                Some(word_wrap_width as f32)
            } else {
                None
            };
            layout.break_all_lines(max_advance);
            let alignment = text_align_to_parley(text_align);
            // text_align 对齐需要一个容器宽度作为参照；无 word_wrap 时用 layout 的实际宽度，
            // 这样 center/end 对齐才能正确偏移字形 x 坐标（否则 Parley 无从计算）。
            let align_width = max_advance.or_else(|| {
                let w = layout.width();
                if w > 0.0 { Some(w) } else { None }
            });
            layout.align(align_width, alignment, AlignmentOptions::default());

            let segment_char_indices: Vec<(usize, char)> = segment.char_indices().collect();
            let mut char_idx = 0usize;

            let segment_lines: Vec<_> = layout.lines().collect();
            for line in segment_lines {
                let line_min_y = line_y + line.metrics().min_coord;
                let line_max_y = line_y + line.metrics().max_coord;
                layout_min_y = layout_min_y.min(line_min_y);
                layout_max_y = layout_max_y.max(line_max_y);

                for item in line.items() {
                    if let PositionedLayoutItem::GlyphRun(run) = item {
                        let run_min_x = run.offset();
                        let run_max_x = run.offset() + run.advance();
                        layout_min_x = layout_min_x.min(run_min_x);
                        layout_max_x = layout_max_x.max(run_max_x);

                        let font_ref = run.run().font();
                        let bytes = font_ref.data.data().to_vec();
                        let blob = vello::peniko::Blob::from(bytes);
                        let font_data = vello::peniko::FontData::new(blob, font_ref.index);

                        let mut run_glyphs = Vec::new();
                        for g in run.positioned_glyphs() {
                            if char_idx >= segment_char_indices.len() {
                                break;
                            }
                            let (_byte_pos, ch) = segment_char_indices[char_idx];
                            char_idx += 1;

                            if is_emoji(ch) {
                                let emoji_str = extract_emoji_at(segment, segment_char_indices[char_idx - 1].0)
                                    .map(|(s, _)| s)
                                    .unwrap_or_else(|| ch.to_string());
                                emoji_positions.push(EmojiPosition {
                                    emoji: emoji_str,
                                    x: g.x as f64,
                                    y: (line_y + g.y) as f64,
                                });
                            } else {
                                run_glyphs.push(vello::Glyph {
                                    id: g.id,
                                    x: g.x,
                                    y: line_y + g.y,
                                });
                            }
                        }
                        if !run_glyphs.is_empty() {
                            glyph_runs.push((font_data, run_glyphs));
                        }
                    }
                }
                // 行高累加：以内容高度为底，若设置了 line_height 则不超过该值，避免 Parley 的 line_height 偏大导致中间多出一空行
                let content_h = line.metrics().max_coord - line.metrics().min_coord;
                let line_advance = if line_height_px > 0.0 {
                    let parley_lh = line.metrics().line_height;
                    content_h.max(parley_lh.min(line_height_px))
                } else {
                    content_h
                };
                line_y += line_advance;
            }
        }

        let layout_bounds = if layout_min_x.is_finite() && layout_min_y.is_finite()
            && layout_max_x.is_finite() && layout_max_y.is_finite()
        {
            Some((layout_min_x, layout_min_y, layout_max_x, layout_max_y))
        } else {
            None
        };

        Some((glyph_runs, font_size_px, emoji_positions, layout_bounds))
    })
}

/// 计算文本在其局部坐标系中的 AABB，返回值不包含任何父级/相机变换。
/// 坐标系约定与渲染时一致：锚点位于 (0, 0)，x 轴向右，y 轴向下。
#[cfg(target_arch = "wasm32")]
fn compute_text_bounds_internal(opts: &TextOptions) -> Option<TextBounds> {
    let font_size_eff = opts.font_size as f32;
    let letter_spacing_eff = opts.letter_spacing as f32;
    let line_height_px = opts.line_height as f32; // 绝对值（像素），≤0 时排版内部用字号作为默认

    let (glyph_runs, size_px, emoji_positions, layout_bounds) = build_text_glyphs_with_emoji_positions(
        &opts.content,
        font_size_eff,
        letter_spacing_eff,
        line_height_px,
        opts.font_kerning,
        &opts.font_family,
        &opts.font_weight,
        &opts.font_style,
        &opts.font_variant,
        opts.word_wrap,
        opts.word_wrap_width,
        &opts.text_align,
    )?;

    // 没有任何可见内容时，返回零大小包围盒。
    if glyph_runs.is_empty() && emoji_positions.is_empty() {
        return Some(TextBounds {
            min_x: 0.0,
            min_y: 0.0,
            max_x: 0.0,
            max_y: 0.0,
        });
    }

    let fs = size_px as f64;

    let (mut min_x, mut min_y, mut max_x, mut max_y) = match layout_bounds {
        Some((lx, ly, rx, ry)) => (lx as f64, ly as f64, rx as f64, ry as f64),
        None => {
            // 无布局度量时（如空行仅换行）退回按 glyph 位置粗略估计
            let mut mx = f64::INFINITY;
            let mut my = f64::INFINITY;
            let mut rx = f64::NEG_INFINITY;
            let mut ry = f64::NEG_INFINITY;
            for (_fd, run_glyphs) in &glyph_runs {
                for g in run_glyphs {
                    let gx = g.x as f64;
                    let gy = g.y as f64;
                    mx = mx.min(gx);
                    my = my.min(gy - fs * 0.8);
                    rx = rx.max(gx + fs * 0.6);
                    ry = ry.max(gy + fs * 0.2);
                }
            }
            (mx, my, rx, ry)
        }
    };

    // emoji：渲染时使用大小约等于字体大小的正方形，这里按同样近似。
    for emoji in &emoji_positions {
        let ex = emoji.x;
        let ey = emoji.y;

        let left = ex - fs * 0.5;
        let right = ex + fs * 0.5;
        let top = ey - fs;
        let bottom = ey;

        min_x = min_x.min(left);
        min_y = min_y.min(top);
        max_x = max_x.max(right);
        max_y = max_y.max(bottom);
    }

    if !min_x.is_finite() || !min_y.is_finite() || !max_x.is_finite() || !max_y.is_finite() {
        return Some(TextBounds {
            min_x: 0.0,
            min_y: 0.0,
            max_x: 0.0,
            max_y: 0.0,
        });
    }

    Some(TextBounds {
        min_x,
        min_y,
        max_x,
        max_y,
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
    /// 该窗口的相机变换，多画布时互不影响。
    pub transform: Affine,
}

/// 最小应用：与 [vello with_winit](https://github.com/linebender/vello/blob/main/examples/with_winit/src/lib.rs) 一致。
/// 相机 transform 完全由 JS 通过 setCameraTransform 同步，Rust 不监听输入事件。
/// wasm 多画布时 states 含多个元素；桌面单窗口时 states.len() <= 1。
pub struct VelloRendererApp {
    pub context: RenderContext,
    pub renderers: Vec<Option<Renderer>>,
    /// 每个窗口一份渲染状态；wasm 多画布时多个，桌面单窗口时一个。
    pub states: Vec<RenderState>,
    pub scene: Scene,
}

impl VelloRendererApp {
    pub fn new() -> Self {
        Self {
            context: RenderContext::new(),
            renderers: vec![],
            states: vec![],
            scene: Scene::new(),
        }
    }
}

impl ApplicationHandler for VelloRendererApp {
    fn resumed(&mut self, _event_loop: &ActiveEventLoop) {
        #[cfg(target_arch = "wasm32")]
        return;

        #[cfg(not(target_arch = "wasm32"))]
        {
            if !self.states.is_empty() {
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
            self.states.push(RenderState {
                surface,
                valid_surface: true,
                window,
                canvas_id: None,
                transform: Affine::IDENTITY,
            });
        }
    }

    fn window_event(
        &mut self,
        event_loop: &ActiveEventLoop,
        window_id: winit::window::WindowId,
        event: WindowEvent,
    ) {
        let Some(state) = self
            .states
            .iter_mut()
            .find(|s| s.window.id() == window_id)
        else {
            return;
        };
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
                let mut width = surface.config.width;
                let mut height = surface.config.height;

                #[cfg(target_arch = "wasm32")]
                if let Some(cid) = canvas_id {
                    let need_restore = RESTORE_PENDING.with(|c| c.borrow_mut().remove(&cid).is_some());
                    if need_restore {
                        if let Some((w, h, affine)) = RESTORE_STATE.with(|c| c.borrow_mut().remove(&cid)) {
                            state.transform = affine;
                            width = w;
                            height = h;
                            use winit::platform::web::WindowExtWebSys;
                            if let Some(canvas) = state.window.canvas() {
                                canvas.set_width(w);
                                canvas.set_height(h);
                            }
                            // RenderContext::resize_surface 在当前版本返回 ()。
                            self.context.resize_surface(surface, w, h);
                        }
                    } else if let Some((opts, on_rendered)) = EXPORT_VIEW_PENDING.with(|c| c.borrow_mut().remove(&cid)) {
                        let export_w = opts.width.max(1.0).min(8192.0) as u32;
                        let export_h = opts.height.max(1.0).min(8192.0) as u32;
                        RESTORE_STATE.with(|c| {
                            c.borrow_mut().insert(cid, (width, height, state.transform));
                        });
                        state.transform = Affine::translate(Vec2::new(-opts.left, -opts.top));
                        use winit::platform::web::WindowExtWebSys;
                        if let Some(canvas) = state.window.canvas() {
                            canvas.set_width(export_w);
                            canvas.set_height(export_h);
                        }
                        // RenderContext::resize_surface 在当前版本返回 ()。
                        self.context
                            .resize_surface(surface, export_w, export_h);
                        let device_handle = &self.context.devices[surface.dev_id];
                        // 导出局部图需要 1:1（1 像素 = 1 逻辑单位），不乘 DPR。
                        // 同时 setExportView 设置的 left/top/width/height 也是逻辑坐标。
                        let effective_transform = state.transform;
                        let render_opts = take_pending_canvas_render_options(canvas_id);
                        self.scene.reset();
                        add_shapes_to_scene(
                            &mut self.scene,
                            effective_transform,
                            export_w,
                            export_h,
                            canvas_id,
                            render_opts,
                        );
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
                                    width: export_w,
                                    height: export_h,
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
                                label: Some("Export Blit"),
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
                        let _ = on_rendered.call1(&JsValue::NULL, &JsValue::from(cid));
                        RESTORE_PENDING.with(|c| c.borrow_mut().insert(cid, ()));
                        state.window.request_redraw();
                        return;
                    }
                }

                if let Some(affine) = take_pending_camera_transform(canvas_id) {
                    state.transform = affine;
                }
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
                let effective_transform = state.transform * Affine::scale(dpr);
                let render_opts = take_pending_canvas_render_options(canvas_id);
                add_shapes_to_scene(
                    &mut self.scene,
                    effective_transform,
                    width,
                    height,
                    canvas_id,
                    render_opts,
                );

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
        v.sort_by(|a, b| a.z_index().partial_cmp(&b.z_index()).unwrap_or(std::cmp::Ordering::Equal));
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
    render_opts: CanvasRenderOptions,
) {
    if render_opts.grid {
        add_grid_to_scene(scene, transform, viewport_width, viewport_height);
    }
    #[cfg(target_arch = "wasm32")]
    if let Some(cid) = canvas_id {
        let shapes_all = get_user_shapes(cid);
        let mut shapes = sort_shapes_by_parent_z_index(&shapes_all);

        if !render_opts.ui {
            use std::collections::{HashMap, HashSet};

            // ui 会向下继承：只要自身或祖先带 ui=true，就视为 ui 节点。
            let mut meta: HashMap<String, (Option<String>, bool)> = HashMap::new();
            for s in &shapes_all {
                meta.insert(
                    s.id().to_string(),
                    (s.parent_id().map(|p| p.to_string()), s.ui()),
                );
            }

            let mut memo: HashMap<String, bool> = HashMap::new();
            let mut visiting: HashSet<String> = HashSet::new();

            fn effective_ui(
                id: &str,
                meta: &HashMap<String, (Option<String>, bool)>,
                memo: &mut HashMap<String, bool>,
                visiting: &mut HashSet<String>,
            ) -> bool {
                if let Some(v) = memo.get(id) {
                    return *v;
                }
                if visiting.contains(id) {
                    // 理论上不会有环，循环保护避免死递归。
                    return false;
                }
                visiting.insert(id.to_string());

                let Some((parent_id, self_ui)) = meta.get(id) else {
                    memo.insert(id.to_string(), false);
                    visiting.remove(id);
                    return false;
                };
                let parent_ui = parent_id
                    .as_deref()
                    .map(|pid| effective_ui(pid, meta, memo, visiting))
                    .unwrap_or(false);
                let result = *self_ui || parent_ui;
                memo.insert(id.to_string(), result);
                visiting.remove(id);
                result
            }

            shapes = shapes
                .into_iter()
                .filter(|s| !effective_ui(s.id(), &meta, &mut memo, &mut visiting))
                .collect();
        }

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
            fill_blur,
            drop_shadow,
            ..
        } => {
            let (w, h, r) = if size_attenuation {
                (width / scale, height / scale, radius / scale)
            } else {
                (width, height, radius)
            };
            // blur 也随 size_attenuation 缩放
            let blur_std_dev = if size_attenuation { fill_blur / scale } else { fill_blur };
            let (x0, y0, x1, y1) = (
                x.min(x + w),
                y.min(y + h),
                x.max(x + w),
                y.max(y + h),
            );
            let fill_mult = opacity * fill_opacity;

            // 获取 stroke 配置
            let stroke_config = stroke.as_ref().map(|s| {
                let width = if stroke_attenuation { s.width / scale } else { s.width };
                let color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                (width, color, &s.alignment)
            });

            // 根据 stroke alignment 调整几何形状
            let (fill_geom, stroke_geom) = if let Some((sw, _, alignment)) = stroke_config {
                match alignment {
                    StrokeAlignment::Inner => {
                        // Inner: fill 区域向内收缩 sw，stroke 在 fill 的外边缘
                        // 这样 stroke 会完全在原始矩形内部
                        let fill_rect = RoundedRect::new(
                            x0 + sw, y0 + sw,
                            x1 - sw, y1 - sw,
                            (r - sw).max(0.0)
                        );
                        // stroke 在 fill 的外边缘，即原始矩形的内边缘
                        let stroke_rect = RoundedRect::new(
                            x0 + sw / 2.0, y0 + sw / 2.0,
                            x1 - sw / 2.0, y1 - sw / 2.0,
                            (r - sw / 2.0).max(0.0)
                        );
                        (Some(fill_rect), Some((stroke_rect, sw)))
                    }
                    StrokeAlignment::Outer => {
                        // Outer: fill 区域不变，stroke 在外部
                        let offset = sw / 2.0;
                        let fill_rect = RoundedRect::new(x0, y0, x1, y1, r);
                        // stroke 圆角半径保持与 fill 相同，避免圆角过大
                        let stroke_rect = RoundedRect::new(
                            x0 - offset, y0 - offset,
                            x1 + offset, y1 + offset,
                            r
                        );
                        (Some(fill_rect), Some((stroke_rect, sw)))
                    }
                    StrokeAlignment::Center => {
                        // Center: fill 和 stroke 使用相同的几何形状
                        let rect = RoundedRect::new(x0, y0, x1, y1, r);
                        (Some(rect), Some((rect, sw)))
                    }
                }
            } else {
                // 无 stroke，只有 fill
                let fill_rect = RoundedRect::new(x0, y0, x1, y1, r);
                (Some(fill_rect), None)
            };

            // 绘制 drop shadow（在 fill 之前）
            if let Some(ref ds) = drop_shadow {
                let ds_blur = if size_attenuation { ds.blur / scale } else { ds.blur };
                let ds_offset_x = if size_attenuation { ds.offset_x / scale } else { ds.offset_x };
                let ds_offset_y = if size_attenuation { ds.offset_y / scale } else { ds.offset_y };

                if ds_blur > 0.0 {
                    // 有模糊：使用 draw_blurred_rounded_rect 绘制模糊阴影
                    let shadow_rect = Rect::new(x0 + ds_offset_x, y0 + ds_offset_y, x1 + ds_offset_x, y1 + ds_offset_y);
                    let shadow_color = apply_opacity_to_color(ds.color, opacity, 1.0);
                    scene.draw_blurred_rounded_rect(
                        shape_transform,
                        shadow_rect,
                        Color::new(shadow_color),
                        r,
                        ds_blur
                    );
                } else {
                    // 无模糊：直接绘制偏移的填充形状作为阴影
                    let shadow_color = apply_opacity_to_color(ds.color, opacity, 1.0);
                    let brush = vello::peniko::Brush::Solid(Color::new(shadow_color));
                    if r > 0.0 {
                        let shadow_rect = RoundedRect::new(
                            x0 + ds_offset_x, y0 + ds_offset_y,
                            x1 + ds_offset_x, y1 + ds_offset_y,
                            r
                        );
                        scene.fill(Fill::NonZero, shape_transform, &brush, None, &shadow_rect);
                    } else {
                        let shadow_rect = Rect::new(
                            x0 + ds_offset_x, y0 + ds_offset_y,
                            x1 + ds_offset_x, y1 + ds_offset_y
                        );
                        scene.fill(Fill::NonZero, shape_transform, &brush, None, &shadow_rect);
                    }
                }
            }

            // 绘制 fill
            if let Some(ref fill_geom) = fill_geom {
                // 检查是否需要模糊效果（需要圆角半径 > 0 且 blur > 0）
                let use_blur = blur_std_dev > 0.0 && r > 0.0 && fill_gradients.is_none();
                if use_blur {
                    // 使用 draw_blurred_rounded_rect 绘制模糊圆角矩形
                    let base_rect = Rect::new(x0, y0, x1, y1);
                    let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
                    scene.draw_blurred_rounded_rect(
                        shape_transform,
                        base_rect,
                        Color::new(fill_color),
                        r,
                        blur_std_dev
                    );
                } else if let Some(ref grads) = fill_gradients {
                    for g in grads.iter().rev() {
                        let brush = vello::peniko::Brush::Gradient(build_gradient_brush(g, fill_mult));
                        scene.fill(Fill::NonZero, shape_transform, &brush, None, fill_geom);
                    }
                } else {
                    let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
                    let brush = vello::peniko::Brush::Solid(Color::new(fill_color));
                    scene.fill(Fill::NonZero, shape_transform, &brush, None, fill_geom);
                }
            }

            // 绘制 stroke
            if let Some((ref stroke_geom, sw)) = stroke_geom {
                if let Some(ref s) = stroke {
                    let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                    let kurbo_stroke = s.to_kurbo_stroke_with_width(sw);
                    scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, stroke_geom);
                }
            }
        }
        JsShape::Ellipse { cx, cy, rx, ry, fill, fill_gradients, stroke, opacity, fill_opacity, stroke_opacity, size_attenuation, stroke_attenuation, .. } => {
            let (rx_eff, ry_eff) = if size_attenuation {
                (rx / scale, ry / scale)
            } else {
                (rx, ry)
            };
            let fill_mult = opacity * fill_opacity;

            // 获取 stroke 配置
            let stroke_config = stroke.as_ref().map(|s| {
                let width = if stroke_attenuation { s.width / scale } else { s.width };
                let color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                (width, color, &s.alignment)
            });

            // 根据 stroke alignment 调整几何形状
            let (fill_geom, stroke_geom) = if let Some((sw, _, alignment)) = stroke_config {
                match alignment {
                    StrokeAlignment::Inner => {
                        // Inner: fill 区域向内收缩 sw，stroke 在 fill 的外边缘
                        // 这样 stroke 会完全在原始椭圆内部
                        let fill_ellipse = Ellipse::new(
                            Point::new(cx, cy),
                            Vec2::new((rx_eff - sw).max(0.0), (ry_eff - sw).max(0.0)),
                            0.0
                        );
                        // stroke 在 fill 的外边缘，即原始椭圆的内边缘
                        let stroke_ellipse = Ellipse::new(
                            Point::new(cx, cy),
                            Vec2::new((rx_eff - sw / 2.0).max(0.0), (ry_eff - sw / 2.0).max(0.0)),
                            0.0
                        );
                        (Some(fill_ellipse), Some((stroke_ellipse, sw)))
                    }
                    StrokeAlignment::Outer => {
                        // Outer: fill 区域不变，stroke 在外部
                        let offset = sw / 2.0;
                        let fill_ellipse = Ellipse::new(Point::new(cx, cy), Vec2::new(rx_eff, ry_eff), 0.0);
                        let stroke_ellipse = Ellipse::new(
                            Point::new(cx, cy),
                            Vec2::new(rx_eff + offset, ry_eff + offset),
                            0.0
                        );
                        (Some(fill_ellipse), Some((stroke_ellipse, sw)))
                    }
                    StrokeAlignment::Center => {
                        // Center: fill 和 stroke 使用相同的几何形状
                        let ellipse = Ellipse::new(Point::new(cx, cy), Vec2::new(rx_eff, ry_eff), 0.0);
                        (Some(ellipse), Some((ellipse, sw)))
                    }
                }
            } else {
                // 无 stroke，只有 fill
                let fill_ellipse = Ellipse::new(Point::new(cx, cy), Vec2::new(rx_eff, ry_eff), 0.0);
                (Some(fill_ellipse), None)
            };

            // 绘制 fill
            if let Some(ref fill_geom) = fill_geom {
                if let Some(ref grads) = fill_gradients {
                    for g in grads.iter().rev() {
                        let brush = vello::peniko::Brush::Gradient(build_gradient_brush(g, fill_mult));
                        scene.fill(Fill::NonZero, shape_transform, &brush, None, fill_geom);
                    }
                } else {
                    let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
                    let brush = vello::peniko::Brush::Solid(Color::new(fill_color));
                    scene.fill(Fill::NonZero, shape_transform, &brush, None, fill_geom);
                }
            }

            // 绘制 stroke
            if let Some((ref stroke_geom, sw)) = stroke_geom {
                if let Some(ref s) = stroke {
                    let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                    let kurbo_stroke = s.to_kurbo_stroke_with_width(sw);
                    scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, stroke_geom);
                }
            }
        }
        JsShape::Line { x1, y1, x2, y2, stroke, opacity, stroke_opacity, size_attenuation, stroke_attenuation, marker_start, marker_end, marker_factor, .. } => {
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
            // 绘制起点/终点 marker（line）：用一条折线 path 画 V 形，接头处用 stroke 的 join 绘制
            // 端点 (x,y)，折线：left -> tip -> right，与 marker.ts lineArrow 角度一致
            if marker_factor > 0.0 && (marker_start == "line" || marker_end == "line") {
                let dx = x2 - x1;
                let dy = y2 - y1;
                let len = (dx * dx + dy * dy).sqrt();
                if len > 0.0 {
                    let angle = dy.atan2(dx);
                    let eff_width = if use_attenuation { stroke.width / scale } else { stroke.width };
                    let r = eff_width * marker_factor as f64;
                    const PI_6: f64 = std::f64::consts::FRAC_PI_6; // π/6
                    let mut stroke_line_arrow = |tip_x: f64, tip_y: f64, a: f64| {
                        let left_x = tip_x + r * (a + PI_6).cos();
                        let left_y = tip_y + r * (a + PI_6).sin();
                        let right_x = tip_x + r * (a - PI_6).cos();
                        let right_y = tip_y + r * (a - PI_6).sin();
                        let mut path = BezPath::new();
                        path.move_to(Point::new(left_x, left_y));
                        path.line_to(Point::new(tip_x, tip_y));
                        path.line_to(Point::new(right_x, right_y));
                        scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &path);
                    };
                    if marker_start == "line" {
                        // 起点：V 的尖端在线段起点 (x1,y1)，开口朝向 (x2,y2)
                        stroke_line_arrow(x1, y1, angle);
                    }
                    if marker_end == "line" {
                        // 终点：V 的尖端在线段终点 (x2,y2)，开口朝向 (x1,y1)
                        stroke_line_arrow(x2, y2, angle + std::f64::consts::PI);
                    }
                }
            }
        }
        JsShape::Text {
            content,
            font_size,
            font_family,
            font_weight,
            font_style,
            font_variant,
            letter_spacing,
            line_height,
            font_kerning,
            word_wrap,
            word_wrap_width,
            text_align,
            fill,
            opacity,
            fill_opacity,
            size_attenuation,
            ..
        } => {
            let (font_size_eff, letter_spacing_eff) = if size_attenuation {
                (font_size / scale, letter_spacing / scale)
            } else {
                (font_size, letter_spacing)
            };
            // wordWrapWidth 为文档/局部空间固定值，不随相机缩放改变；仅 size_attenuation 时与字号一起换算
            let word_wrap_width_eff = if size_attenuation {
                (word_wrap_width / scale).max(1e-6)
            } else {
                word_wrap_width
            };
            let line_height_px = line_height as f32; // 绝对值（像素），≤0 时排版内部用字号作为默认
            let letter_spacing_px = letter_spacing_eff as f32;
            let cache_key = (
                content.clone(),
                font_size_eff as u32,
                font_family.clone(),
                line_height_px.to_bits(),
                letter_spacing_px.to_bits(),
                font_kerning,
                word_wrap,
                word_wrap_width_eff.to_bits(),
                text_align.clone(),
                font_weight.clone(),
                font_style.clone(),
                font_variant.clone(),
            );

            // 渲染文本（使用 Parley 布局整个文本，获取准确的 emoji 位置）
            if !FONT_BYTES.with(|c| c.borrow().is_empty()) {

                // 尝试从缓存获取；命中则直接使用，避免每帧重新排版（中文字体排版成本高）
                let cached = GLYPH_CACHE.with(|c| c.borrow().get(&cache_key).cloned());

                let (glyph_runs, size, emoji_positions) = match cached {
                    Some((runs, s, em)) => (runs, s, em),
                    None => {
                        // 缓存未命中，构建字形和 emoji 位置后存入缓存
                        let result = build_text_glyphs_with_emoji_positions(
                            &content,
                            font_size_eff as f32,
                            letter_spacing_eff as f32,
                            line_height_px,
                            font_kerning,
                            &font_family,
                            &font_weight,
                            &font_style,
                            &font_variant,
                            word_wrap,
                            word_wrap_width_eff,
                            &text_align,
                        );
                        match result {
                            Some((runs, s, em, _)) => {
                                GLYPH_CACHE.with(|c| {
                                    c.borrow_mut().insert(cache_key, (runs.clone(), s, em.clone()));
                                });
                                (runs, s, em)
                            }
                            None => return,
                        }
                    }
                };

                let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
                let color = Color::new(fill_color);

                // 按 run 用对应字体绘制，多字体 fallback 时每个 run 用自己的 FontData
                for (font_data, glyphs) in &glyph_runs {
                    scene
                        .draw_glyphs(font_data)
                        .font_size(size)
                        .transform(shape_transform)
                        .brush(color)
                        .draw(Fill::NonZero, glyphs.clone().into_iter());
                }

                // 渲染 emoji 图片（在 glyph 位置上）；用 2x 分辨率渲染再缩放到字体大小，提升清晰度
                let emoji_render_size = ((font_size_eff * 2.0).ceil() as u32).max(48);
                for emoji_pos in &emoji_positions {
                    if let Some((image_data, img_width, img_height)) =
                        get_or_create_emoji_image(&emoji_pos.emoji, emoji_render_size)
                    {
                        let image = ImageData {
                            data: Blob::from(image_data),
                            format: ImageFormat::Rgba8,
                            alpha_type: ImageAlphaType::Alpha,
                            width: img_width,
                            height: img_height,
                        };
                        let brush = ImageBrush::new(image);

                        // emoji 尺寸
                        let emoji_size = font_size_eff;

                        // Parley 的 glyph 位置是基线系：x 为字形左缘，y 为基线。微调以对齐视觉中心。
                        const EMOJI_NUDGE_LEFT: f64 = 0.0;    // 向左微调（0 = 不偏）
                        const EMOJI_NUDGE_DOWN: f64 = 0.08;    // 向下微调，与 x-height 对齐
                        let s = emoji_size as f64;
                        let emoji_x = emoji_pos.x - s * 0.5 - s * EMOJI_NUDGE_LEFT;
                        let emoji_y = emoji_pos.y - s + s * EMOJI_NUDGE_DOWN;

                        // 计算完整的变换：shape_transform * 位置 * 缩放
                        let full_transform = shape_transform
                            * Affine::translate(Vec2::new(emoji_x as f64, emoji_y as f64))
                            * Affine::scale_non_uniform(
                                emoji_size / img_width as f64,
                                emoji_size / img_height as f64,
                            );

                        // 使用单位矩形作为几何体
                        let geom = Rect::new(0.0, 0.0, img_width as f64, img_height as f64);

                        scene.fill(
                            Fill::NonZero,
                            full_transform,
                            brush.as_ref(),
                            None,
                            &geom,
                        );
                    }
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
            drop_shadow,
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

                // 获取 stroke 配置
                let stroke_config = stroke.as_ref().map(|s| {
                    let width = if stroke_attenuation { s.width / scale } else { s.width };
                    let color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                    (width, color, &s.alignment)
                });

                // 根据 stroke alignment 调整几何形状
                let (fill_rect, stroke_rect, stroke_width) = if let Some((sw, _, alignment)) = stroke_config {
                    match alignment {
                        StrokeAlignment::Inner => {
                            // Inner: fill 区域向内收缩 sw，stroke 在 fill 的外边缘
                            // 这样 stroke 会完全在原始矩形内部
                            let fill_r = (r - sw).max(0.0);
                            let fill_x0 = x + sw;
                            let fill_y0 = y + sw;
                            let fill_x1 = x + w - sw;
                            let fill_y1 = y + h - sw;
                            // stroke 在 fill 的外边缘，即原始矩形的内边缘
                            let stroke_r = (r - sw / 2.0).max(0.0);
                            let stroke_x0 = x + sw / 2.0;
                            let stroke_y0 = y + sw / 2.0;
                            let stroke_x1 = x + w - sw / 2.0;
                            let stroke_y1 = y + h - sw / 2.0;
                            (Some((fill_x0, fill_y0, fill_x1, fill_y1, fill_r)), Some((stroke_x0, stroke_y0, stroke_x1, stroke_y1, stroke_r)), Some(sw))
                        }
                        StrokeAlignment::Outer => {
                            // Outer: fill 区域不变，stroke 在外部
                            let offset = sw / 2.0;
                            // stroke 圆角半径保持与 fill 相同，避免圆角过大
                            let stroke_r = r;
                            let stroke_x0 = x - offset;
                            let stroke_y0 = y - offset;
                            let stroke_x1 = x + w + offset;
                            let stroke_y1 = y + h + offset;
                            (Some((x, y, x + w, y + h, r)), Some((stroke_x0, stroke_y0, stroke_x1, stroke_y1, stroke_r)), Some(sw))
                        }
                        StrokeAlignment::Center => {
                            // Center: fill 和 stroke 使用相同的几何形状
                            (Some((x, y, x + w, y + h, r)), Some((x, y, x + w, y + h, r)), Some(sw))
                        }
                    }
                } else {
                    // 无 stroke，只有 fill
                    (Some((x, y, x + w, y + h, r)), None, None)
                };

                // 绘制 drop shadow（在 fill 之前）
                if let Some(ref ds) = drop_shadow {
                    let ds_blur = if size_attenuation { ds.blur / scale } else { ds.blur };
                    let ds_offset_x = if size_attenuation { ds.offset_x / scale } else { ds.offset_x };
                    let ds_offset_y = if size_attenuation { ds.offset_y / scale } else { ds.offset_y };

                    // 计算阴影矩形位置
                    let (sx0, sy0, sx1, sy1, sr) = fill_rect.unwrap_or((x, y, x + w, y + h, r));
                    let shadow_rect = Rect::new(sx0 + ds_offset_x, sy0 + ds_offset_y, sx1 + ds_offset_x, sy1 + ds_offset_y);
                    let shadow_color = apply_opacity_to_color(ds.color, opacity, 1.0);

                    if ds_blur > 0.0 {
                        // 使用 draw_blurred_rounded_rect 绘制模糊阴影
                        scene.draw_blurred_rounded_rect(
                            shape_transform,
                            shadow_rect,
                            Color::new(shadow_color),
                            sr,
                            ds_blur
                        );
                    } else {
                        // 无模糊：直接绘制偏移的矩形作为阴影
                        let brush = vello::peniko::Brush::Solid(Color::new(shadow_color));
                        if sr > 0.0 {
                            let shadow_geom = RoundedRect::new(
                                sx0 + ds_offset_x, sy0 + ds_offset_y,
                                sx1 + ds_offset_x, sy1 + ds_offset_y,
                                sr
                            );
                            scene.fill(Fill::NonZero, shape_transform, &brush, None, &shadow_geom);
                        } else {
                            let shadow_geom = Rect::new(
                                sx0 + ds_offset_x, sy0 + ds_offset_y,
                                sx1 + ds_offset_x, sy1 + ds_offset_y
                            );
                            scene.fill(Fill::NonZero, shape_transform, &brush, None, &shadow_geom);
                        }
                    }
                }

                // 绘制 fill
                if let Some((fx0, fy0, fx1, fy1, fr)) = fill_rect {
                    if fr > 0.0 {
                        let fill_geom = RoundedRect::new(fx0, fy0, fx1, fy1, fr);
                        scene.fill(Fill::NonZero, shape_transform, brush.as_ref(), Some(brush_transform), &fill_geom);
                    } else {
                        let fill_geom = Rect::new(fx0, fy0, fx1, fy1);
                        scene.fill(Fill::NonZero, shape_transform, brush.as_ref(), Some(brush_transform), &fill_geom);
                    }
                }

                // 绘制 stroke
                if let Some((sx0, sy0, sx1, sy1, sr)) = stroke_rect {
                    if let (Some(ref s), Some(sw)) = (stroke, stroke_width) {
                        let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                        let kurbo_stroke = s.to_kurbo_stroke_with_width(sw);
                        if sr > 0.0 {
                            let stroke_geom = RoundedRect::new(sx0, sy0, sx1, sy1, sr);
                            scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &stroke_geom);
                        } else {
                            let stroke_geom = Rect::new(sx0, sy0, sx1, sy1);
                            scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &stroke_geom);
                        }
                    }
                }
            }
        }
        JsShape::Path { d, fill, fill_gradients, stroke, fill_rule, opacity, fill_opacity, stroke_opacity, size_attenuation, stroke_attenuation, marker_start, marker_end, marker_factor, .. } => {
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

                // 获取 stroke 配置
                let stroke_config = stroke.as_ref().map(|s| {
                    let width = if stroke_attenuation { s.width / scale } else { s.width };
                    let color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                    (width, color, &s.alignment)
                });

                // 根据 stroke alignment 处理
                match stroke_config {
                    Some((sw, _, StrokeAlignment::Inner)) => {
                        // Inner: 先绘制 fill，然后 clip 到 fill 区域再绘制 stroke
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
                        // Inner stroke: 使用 clip 限制 stroke 在 fill 内部
                        if let Some(ref s) = stroke {
                            let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                            let kurbo_stroke = s.to_kurbo_stroke_with_width(sw);
                            scene.push_clip_layer(fill_mode, shape_transform, &bez_path);
                            scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &bez_path);
                            scene.pop_layer();
                        }
                    }
                    Some((sw, _, StrokeAlignment::Outer)) => {
                        // Outer: 先绘制 stroke（不 clip），再绘制 fill
                        if let Some(ref s) = stroke {
                            let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                            let kurbo_stroke = s.to_kurbo_stroke_with_width(sw);
                            scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &bez_path);
                        }
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
                    }
                    _ => {
                        // Center 或无 stroke: 标准绘制
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
                        if let Some((sw, _, _)) = stroke_config {
                            if let Some(ref s) = stroke {
                                let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                                let kurbo_stroke = s.to_kurbo_stroke_with_width(sw);
                                scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &bez_path);
                            }
                        }
                    }
                }
                // Path marker（line）：与 Line 相同的 V 形折线
                if stroke.is_some() && marker_factor > 0.0 && (marker_start == "line" || marker_end == "line") {
                    if let Some(ref s) = stroke {
                        if let Some(((sx, sy), start_angle, (ex, ey), end_angle)) = path_start_end_tangents(&bez_path) {
                            let sw = if stroke_attenuation { s.width / scale } else { s.width };
                            let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                            let kurbo_stroke = s.to_kurbo_stroke_with_width(sw);
                            let r = sw * marker_factor as f64;
                            const PI_6: f64 = std::f64::consts::FRAC_PI_6;
                            let mut stroke_line_arrow = |tip_x: f64, tip_y: f64, a: f64| {
                                let left_x = tip_x + r * (a + PI_6).cos();
                                let left_y = tip_y + r * (a + PI_6).sin();
                                let right_x = tip_x + r * (a - PI_6).cos();
                                let right_y = tip_y + r * (a - PI_6).sin();
                                let mut path = BezPath::new();
                                path.move_to(Point::new(left_x, left_y));
                                path.line_to(Point::new(tip_x, tip_y));
                                path.line_to(Point::new(right_x, right_y));
                                scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &path);
                            };
                            if marker_start == "line" {
                                stroke_line_arrow(sx, sy, start_angle);
                            }
                            if marker_end == "line" {
                                stroke_line_arrow(ex, ey, end_angle + std::f64::consts::PI);
                            }
                        }
                    }
                }
            }
        }
        JsShape::Polyline { points, stroke, opacity, stroke_opacity, size_attenuation, stroke_attenuation, marker_start, marker_end, marker_factor, .. } => {
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
                // Polyline marker（line）：与 Path 相同，用 path_start_end_tangents 保证与缩放后 path 一致
                if stroke.is_some() && marker_factor > 0.0 && (marker_start == "line" || marker_end == "line") {
                    if let Some(ref s) = stroke {
                        if let Some(((sx, sy), start_angle, (ex, ey), end_angle)) = path_start_end_tangents(&bez_path) {
                            let sw = if stroke_attenuation { s.width / scale } else { s.width };
                            let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                            let kurbo_stroke = s.to_kurbo_stroke_with_width(sw);
                            let r = sw * marker_factor as f64;
                            const PI_6: f64 = std::f64::consts::FRAC_PI_6;
                            let mut stroke_line_arrow = |tip_x: f64, tip_y: f64, a: f64| {
                                let left_x = tip_x + r * (a + PI_6).cos();
                                let left_y = tip_y + r * (a + PI_6).sin();
                                let right_x = tip_x + r * (a - PI_6).cos();
                                let right_y = tip_y + r * (a - PI_6).sin();
                                let mut path = BezPath::new();
                                path.move_to(Point::new(left_x, left_y));
                                path.line_to(Point::new(tip_x, tip_y));
                                path.line_to(Point::new(right_x, right_y));
                                scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &path);
                            };
                            if marker_start == "line" {
                                stroke_line_arrow(sx, sy, start_angle);
                            }
                            if marker_end == "line" {
                                stroke_line_arrow(ex, ey, end_angle + std::f64::consts::PI);
                            }
                        }
                    }
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
        JsShape::RoughPolyline { points, fill, stroke, opacity, fill_opacity, stroke_opacity, roughness, bowing, fill_style, hachure_angle, hachure_gap, curve_step_count, simplification, .. } => {
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
            let pts: Vec<roughr::Point2D<f32, _>> = points.iter().map(|p| roughr::Point2D::new(p[0] as f32, p[1] as f32)).collect();
            let generator = Generator::default();
            let drawable = generator.linear_path(&pts, false, &Some(options));

            render_rough_drawable(scene, shape_transform, &drawable, fill_color, stroke_color);
        }
        JsShape::RoughPath { d, fill, stroke, opacity, fill_opacity, stroke_opacity, roughness, bowing, fill_style, hachure_angle, hachure_gap, curve_step_count, simplification, .. } => {
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
            let drawable = generator.path(d.clone(), &Some(options));

            render_rough_drawable(scene, shape_transform, &drawable, fill_color, stroke_color);
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

/// wasm 多画布：从 PENDING_CANVASES 取出本批次所有 canvas，共用一个 event loop 创建多窗口，全部就绪后调用各自 on_ready，再 run_app。
#[cfg(target_arch = "wasm32")]
#[allow(deprecated)] // EventLoop::create_window 在 wasm 初始化时仍需使用
async fn run_all_canvases_async() {
    use winit::platform::web::WindowAttributesExtWebSys;

    let pending = PENDING_CANVASES.with(|c| c.borrow_mut().drain(..).collect::<Vec<_>>());
    if pending.is_empty() {
        RUNNER_SCHEDULED.set(false);
        return;
    }

    let event_loop = match EventLoop::new() {
        Ok(el) => el,
        Err(_) => {
            RUNNER_SCHEDULED.set(false);
            return;
        }
    };

    // 1) 为每个 canvas 分配 id、创建 window，收集 (canvas_id, window, width, height, on_ready)
    let mut context = RenderContext::new();
    let mut window_items: Vec<(u32, Arc<Window>, u32, u32, js_sys::Function)> =
        Vec::with_capacity(pending.len());

    for (canvas, on_ready) in pending {
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
            Err(_) => continue,
        };
        let (width, height) = {
            use winit::platform::web::WindowExtWebSys;
            if let Some(ref c) = window.canvas() {
                // Enable focus for clipboard events (paste, copy, cut)
                c.set_attribute("tabindex", "0").ok();
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
                (
                    size.width.max(MIN_SURFACE_WIDTH),
                    size.height.max(MIN_SURFACE_HEIGHT),
                )
            }
        };
        window_items.push((canvas_id, window, width, height, on_ready));
    }

    if window_items.is_empty() {
        RUNNER_SCHEDULED.set(false);
        return;
    }

    // 2) 串行为每个 window 创建 surface，收集 (canvas_id, window, surface, on_ready)
    let mut built: Vec<(
        u32,
        Arc<Window>,
        vello::util::RenderSurface<'static>,
        js_sys::Function,
    )> = Vec::with_capacity(window_items.len());
    for (canvas_id, window, width, height, on_ready) in window_items {
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
            Err(_) => continue,
        };
        built.push((canvas_id, window, surface, on_ready));
    }

    let mut renderers: Vec<Option<Renderer>> = vec![];
    renderers.resize_with(context.devices.len(), || None);
    let mut states: Vec<RenderState> = Vec::with_capacity(built.len());
    for (canvas_id, window, surface, on_ready) in built {
        let dev_id = surface.dev_id;
        renderers[dev_id].get_or_insert_with(|| {
            Renderer::new(
                &context.devices[dev_id].device,
                RendererOptions::default(),
            )
            .expect("create renderer")
        });
        CANVAS_WINDOWS.with(|c| {
            c.borrow_mut().insert(canvas_id, window.clone());
        });
        // Disable prevent_default to allow clipboard events (copy, paste, cut) to work
        #[cfg(target_arch = "wasm32")]
        {
            use winit::platform::web::WindowExtWebSys;
            window.set_prevent_default(false);
        }
        states.push(RenderState {
            surface,
            valid_surface: true,
            window: window.clone(),
            canvas_id: Some(canvas_id),
            transform: Affine::IDENTITY,
        });
        let _ = on_ready.call1(&JsValue::NULL, &JsValue::from(canvas_id));
        window.request_redraw();
    }

    let mut app = VelloRendererApp {
        context,
        renderers,
        states,
        scene: Scene::new(),
    };
    let _ = event_loop.run_app(&mut app);
}

/// 使用传入的 canvas 元素启动渲染。onReady(canvasId) 在画布就绪时调用，后续 addRect/addEllipse 等需传入该 canvasId。
/// 支持多画布：同一同步批次内多次调用 runWithCanvas 会共用一个 event loop，每个 canvas 都会收到 on_ready。
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
    PENDING_CANVASES.with(|c| {
        c.borrow_mut().push((canvas, on_ready));
    });
    if RUNNER_SCHEDULED.get() {
        return;
    }
    RUNNER_SCHEDULED.set(true);
    let closure = Closure::once(|| {
        wasm_bindgen_futures::spawn_local(run_all_canvases_async());
    });
    if let Ok(qmt) = js_sys::eval("queueMicrotask") {
        if let Some(f) = qmt.dyn_ref::<js_sys::Function>() {
            let _ = f.call1(&JsValue::NULL, closure.as_ref());
        }
    }
    closure.forget();
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
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    let fill_gradients = resolve_fill_gradients(&o.fill_gradient, &o.fill_gradients);
    let drop_shadow = o.drop_shadow.map(|ds| DropShadow {
        color: ds.color,
        blur: ds.blur,
        offset_x: ds.offset_x,
        offset_y: ds.offset_y,
    });
    push_shape(canvas_id, JsShape::Rect {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
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
        fill_blur: o.fill_blur,
        drop_shadow,
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
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    let fill_gradients = resolve_fill_gradients(&o.fill_gradient, &o.fill_gradients);
    let drop_shadow = o.drop_shadow.map(|ds| DropShadow {
        color: ds.color,
        blur: ds.blur,
        offset_x: ds.offset_x,
        offset_y: ds.offset_y,
    });
    push_shape(canvas_id, JsShape::Ellipse {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
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
        drop_shadow,
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
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    let drop_shadow = o.drop_shadow.map(|ds| DropShadow {
        color: ds.color,
        blur: ds.blur,
        offset_x: ds.offset_x,
        offset_y: ds.offset_y,
    });
    push_shape(canvas_id, JsShape::ImageRect {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
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
        drop_shadow,
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
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    let fill_gradients = resolve_fill_gradients(&o.fill_gradient, &o.fill_gradients);
    let drop_shadow = o.drop_shadow.map(|ds| DropShadow {
        color: ds.color,
        blur: ds.blur,
        offset_x: ds.offset_x,
        offset_y: ds.offset_y,
    });
    push_shape(canvas_id, JsShape::Path {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
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
        marker_start: o.marker_start,
        marker_end: o.marker_end,
        marker_factor: o.marker_factor,
        drop_shadow,
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
        alignment: StrokeAlignment::from_str(&s.alignment),
        blur: s.blur,
    }).unwrap_or_else(|| StrokeParams {
        width: 1.0,
        color: default_rgba_stroke(),
        linecap: default_linecap(),
        linejoin: default_linejoin(),
        miter_limit: default_miter_limit(),
        stroke_dasharray: None,
        stroke_dashoffset: 0.0,
        alignment: StrokeAlignment::Center,
        blur: 0.0,
    });
    push_shape(canvas_id, JsShape::Polyline {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        points: o.points,
        stroke: Some(stroke),
        opacity: o.opacity,
        fill_opacity: o.fill_opacity,
        stroke_opacity: o.stroke_opacity,
        local_transform: o.local_transform,
        size_attenuation: o.size_attenuation,
        stroke_attenuation: o.stroke_attenuation,
        marker_start: o.marker_start,
        marker_end: o.marker_end,
        marker_factor: o.marker_factor,
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
        ui: o.ui,
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
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    push_shape(canvas_id, JsShape::RoughRect {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
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
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    push_shape(canvas_id, JsShape::RoughEllipse {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
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
        alignment: StrokeAlignment::from_str(&s.alignment),
        blur: s.blur,
    }).unwrap_or_else(|| StrokeParams {
        width: 1.0,
        color: default_rgba_stroke(),
        linecap: default_linecap(),
        linejoin: default_linejoin(),
        miter_limit: default_miter_limit(),
        stroke_dasharray: None,
        stroke_dashoffset: 0.0,
        alignment: StrokeAlignment::Center,
        blur: 0.0,
    });
    push_shape(canvas_id, JsShape::RoughLine {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
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

/// 添加手绘风格折线。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addRoughPolyline)]
pub fn js_add_rough_polyline(canvas_id: u32, opts: JsValue) {
    let o: RoughPolylineOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addRoughPolyline: invalid options - {}", e).into());
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
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    push_shape(canvas_id, JsShape::RoughPolyline {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        points: o.points,
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

/// 添加手绘风格 SVG path。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = addRoughPath)]
pub fn js_add_rough_path(canvas_id: u32, opts: JsValue) {
    let o: RoughPathOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("addRoughPath: invalid options - {}", e).into());
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
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });
    push_shape(canvas_id, JsShape::RoughPath {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
        d: o.d,
        fill: o.fill,
        stroke,
        fill_rule: o.fill_rule,
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
        alignment: StrokeAlignment::from_str(&s.alignment),
        blur: s.blur,
    }).unwrap_or_else(|| StrokeParams {
        width: 1.0,
        color: default_rgba_stroke(),
        linecap: default_linecap(),
        linejoin: default_linejoin(),
        miter_limit: default_miter_limit(),
        stroke_dasharray: None,
        stroke_dashoffset: 0.0,
        alignment: StrokeAlignment::Center,
        blur: 0.0,
    });
    push_shape(canvas_id, JsShape::Line {
        id: o.id,
        parent_id: o.parent_id,
        z_index: o.z_index,
        ui: o.ui,
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
        marker_start: o.marker_start,
        marker_end: o.marker_end,
        marker_factor: o.marker_factor,
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
        ui: o.ui,
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
        font_kerning: o.font_kerning,
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
    });
}

/// 计算文本在局部坐标系（锚点为原点）下的几何包围盒，用于拾取或布局。
/// 入参与 addText 相同（除 canvasId 外），返回 { min_x, min_y, max_x, max_y }。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = computeTextBounds)]
pub fn js_compute_text_bounds(opts: JsValue) -> JsValue {
    let o: TextOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("computeTextBounds: invalid options - {}", e).into());
            return JsValue::NULL;
        }
    };

    match compute_text_bounds_internal(&o) {
        Some(bounds) => match serde_wasm_bindgen::to_value(&bounds) {
            Ok(v) => v,
            Err(e) => {
                web_sys::console::error_1(
                    &format!("computeTextBounds: failed to serialize result - {}", e).into(),
                );
                JsValue::NULL
            }
        },
        None => JsValue::NULL,
    }
}

/// Path 命中测试：近似 Canvas2D 的 isPointInStroke/isPointInPath（基于采样折线）。
/// - 当传入 stroke 且 fill=false 时：仅做 stroke 命中
/// - 否则：做 fill 命中（遵循 fillRule）
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathHitTestOptions {
    pub d: String,
    pub x: f64,
    pub y: f64,
    /// 是否有 fill（用于对齐 TS：有 fill 时优先走 isPointInPath）
    #[serde(default = "default_true")]
    pub fill: bool,
    /// "nonzero" | "evenodd"
    #[serde(default = "default_fill_rule")]
    pub fill_rule: String,
    #[serde(default)]
    pub stroke: Option<StrokeOptions>,
}

#[cfg(target_arch = "wasm32")]
fn default_true() -> bool {
    true
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = hitTestPath)]
pub fn js_hit_test_path(opts: JsValue) -> bool {
    let o: PathHitTestOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("hitTestPath: invalid options - {}", e).into());
            return false;
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
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });

    if stroke.is_some() && !o.fill {
        is_point_in_path_stroke(&o.d, o.x, o.y, stroke.as_ref().unwrap())
    } else if o.fill {
        is_point_in_path_fill(&o.d, o.x, o.y, &o.fill_rule)
    } else {
        false
    }
}

/// 计算 Path 的包围盒（返回局部坐标系下 bounds），可选考虑 stroke 与 marker（起点/终点箭头）的扩张。
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathBoundsOptions {
    pub d: String,
    #[serde(default)]
    pub stroke: Option<StrokeOptions>,
    /// 起点 marker：'none' | 'line'，为 "line" 时在起点扩张 r = stroke_width * marker_factor
    #[serde(default = "default_marker_start")]
    pub marker_start: String,
    /// 终点 marker：'none' | 'line'
    #[serde(default = "default_marker_end")]
    pub marker_end: String,
    #[serde(default = "default_marker_factor")]
    pub marker_factor: f32,
}

#[cfg(target_arch = "wasm32")]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bounds {
    pub min_x: f64,
    pub min_y: f64,
    pub max_x: f64,
    pub max_y: f64,
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = computePathBounds)]
pub fn js_compute_path_bounds(opts: JsValue) -> JsValue {
    let o: PathBoundsOptions = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(&format!("computePathBounds: invalid options - {}", e).into());
            return JsValue::NULL;
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
                alignment: StrokeAlignment::from_str(&s.alignment),
                blur: s.blur,
            })
        } else {
            None
        }
    });

    let Some(rect) = path_render_bounds(
        &o.d,
        stroke.as_ref(),
        &o.marker_start,
        &o.marker_end,
        o.marker_factor,
    ) else { return JsValue::NULL; };
    let out = Bounds {
        min_x: rect.x0,
        min_y: rect.y0,
        max_x: rect.x1,
        max_y: rect.y1,
    };

    match serde_wasm_bindgen::to_value(&out) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(
                &format!("computePathBounds: failed to serialize result - {}", e).into(),
            );
            JsValue::NULL
        }
    }
}

/// 追加一个字体（TTF/OTF 字节）到字体列表，用于多字体 / fallback。
/// 注意：当前实现仍然只使用第一个字体进行排版与渲染，
/// 该 API 主要用于未来在 Parley 侧扩展真正的多字体支持。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = registerFont)]
pub fn js_register_font(js_value: JsValue) {
    let bytes = js_sys::Uint8Array::new(&js_value).to_vec();
    FONT_BYTES.with(|c| {
        c.borrow_mut().push(bytes);
    });
}

/// 清空指定画布上由 JS 添加的所有图形。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = clearShapes)]
pub fn js_clear_shapes(canvas_id: u32) {
    clear_shapes_for_canvas(canvas_id);
}

/// 导出视口选项：逻辑坐标下 left, top, width, height；下一帧将画布临时改为 (width, height) 并设置变换使该区域 1:1 填满。
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportViewOpts {
    pub left: f64,
    pub top: f64,
    pub width: f64,
    pub height: f64,
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

/// 画布级渲染开关。用于控制下一帧是否绘制 `grid` 以及 ui 节点。
#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasRenderOptionsInput {
    #[serde(default = "default_canvas_grid")]
    pub grid: bool,
    #[serde(default = "default_canvas_ui")]
    pub ui: bool,
}

#[cfg(target_arch = "wasm32")]
fn default_canvas_grid() -> bool {
    true
}

#[cfg(target_arch = "wasm32")]
fn default_canvas_ui() -> bool {
    true
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = setCanvasRenderOptions)]
pub fn js_set_canvas_render_options(canvas_id: u32, opts: JsValue) {
    let o: CanvasRenderOptionsInput = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(
                &format!("setCanvasRenderOptions: invalid options - {}", e).into(),
            );
            return;
        }
    };

    let render_opts = CanvasRenderOptions { grid: o.grid, ui: o.ui };
    CANVAS_RENDER_OPTIONS_PENDING.with(|c| {
        c.borrow_mut().insert(canvas_id, render_opts);
    });

    if let Some(w) = CANVAS_WINDOWS.with(|c| c.borrow().get(&canvas_id).cloned()) {
        w.request_redraw();
    }
}

/// 设置下一帧“导出视口”：将画布临时改为 (width, height)，变换使世界坐标 (left, top) 到 (left+width, top+height) 1:1 映射到画布；渲染后调用 on_rendered(canvas_id)，再下一帧需调用 restoreCanvasAfterExport(canvas_id) 恢复。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = setExportView)]
pub fn js_set_export_view(canvas_id: u32, opts: JsValue, on_rendered: JsValue) {
    let o: ExportViewOpts = match serde_wasm_bindgen::from_value(opts) {
        Ok(v) => v,
        Err(e) => {
            web_sys::console::error_1(
                &format!("setExportView: invalid options - {}", e).into(),
            );
            return;
        }
    };
    let on_rendered: js_sys::Function = match on_rendered.dyn_into() {
        Ok(f) => f,
        Err(_) => {
            web_sys::console::error_1(
                &"[vello] setExportView: third argument must be function (canvasId) => void".into(),
            );
            return;
        }
    };
    EXPORT_VIEW_PENDING.with(|c| {
        c.borrow_mut().insert(canvas_id, (o, on_rendered));
    });
    if let Some(w) = CANVAS_WINDOWS.with(|c| c.borrow().get(&canvas_id).cloned()) {
        w.request_redraw();
    }
}

/// 恢复画布尺寸与相机变换（在 setExportView 的 on_rendered 里 toDataURL 后调用）。
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen(js_name = restoreCanvasAfterExport)]
pub fn js_restore_canvas_after_export(canvas_id: u32) {
    RESTORE_PENDING.with(|c| {
        c.borrow_mut().insert(canvas_id, ());
    });
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
