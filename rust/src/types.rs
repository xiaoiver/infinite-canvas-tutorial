#[cfg(target_arch = "wasm32")]
use serde::{Deserialize, Serialize};

use vello::kurbo::{Affine, Point};

pub type Mat3Array = [f64; 9];

#[cfg(target_arch = "wasm32")]
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FillGradientStopOptions {
    pub offset: f32,
    pub color: [f32; 4],
}

#[cfg(target_arch = "wasm32")]
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FillGradientOptions {
    pub r#type: String,
    #[serde(default)]
    pub x1: f64,
    #[serde(default)]
    pub y1: f64,
    #[serde(default)]
    pub x2: f64,
    #[serde(default)]
    pub y2: f64,
    #[serde(default)]
    pub cx: f64,
    #[serde(default)]
    pub cy: f64,
    #[serde(default)]
    pub r: f64,
    #[serde(default)]
    pub start_angle: f64,
    #[serde(default)]
    pub end_angle: f64,
    pub stops: Vec<FillGradientStopOptions>,
}

#[derive(Clone, Debug, Default)]
pub enum StrokeAlignment {
    #[default]
    Center,
    Inner,
    Outer,
}

impl StrokeAlignment {
    pub fn from_str(s: &str) -> Self {
        match s {
            "inner" => StrokeAlignment::Inner,
            "outer" => StrokeAlignment::Outer,
            _ => StrokeAlignment::Center,
        }
    }
}

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
    pub blur: f64,
}

impl StrokeParams {
    pub fn to_kurbo_stroke(&self) -> vello::kurbo::Stroke {
        self.to_kurbo_stroke_with_width(self.width)
    }
    pub fn to_kurbo_stroke_with_width(&self, width: f64) -> vello::kurbo::Stroke {
        use vello::kurbo::{Cap, Join, Stroke};
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
        if let Some(ref dasharray) = self.stroke_dasharray {
            if dasharray.len() >= 2 {
                stroke = stroke.with_dashes(self.stroke_dashoffset, dasharray.clone());
            }
        }
        stroke
    }
}

#[derive(Clone, Debug, Default)]
pub struct DropShadow {
    pub color: [f32; 4],
    pub blur: f64,
    pub offset_x: f64,
    pub offset_y: f64,
}

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
        fill_blur: f64,
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
        marker_start: String,
        marker_end: String,
        marker_factor: f32,
    },
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
        stroke: Option<StrokeParams>,
        opacity: f32,
        fill_opacity: f32,
        stroke_opacity: f32,
        local_transform: Option<Mat3Array>,
        size_attenuation: bool,
    },
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
        drop_shadow: Option<DropShadow>,
    },
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
        drop_shadow: Option<DropShadow>,
    },
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
    Group {
        id: String,
        parent_id: Option<String>,
        z_index: f32,
        ui: bool,
        local_transform: Option<Mat3Array>,
    },
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
        roughness: f32,
        bowing: f32,
        fill_style: String,
        hachure_angle: f32,
        hachure_gap: f32,
        fill_weight: f32,
        curve_step_count: f32,
        simplification: f32,
        /// `roughSeed` — watercolor / reproducible rough; `0` = default.
        rough_seed: i32,
    },
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
        fill_weight: f32,
        curve_step_count: f32,
        simplification: f32,
        rough_seed: i32,
    },
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
        marker_start: String,
        marker_end: String,
        marker_factor: f32,
    },
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
        fill_weight: f32,
        curve_step_count: f32,
        simplification: f32,
        marker_start: String,
        marker_end: String,
        marker_factor: f32,
        rough_seed: i32,
    },
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
        fill_weight: f32,
        curve_step_count: f32,
        simplification: f32,
        marker_start: String,
        marker_end: String,
        marker_factor: f32,
        rough_seed: i32,
    },
}

#[cfg(target_arch = "wasm32")]
impl JsShape {
    pub fn id(&self) -> &str {
        match self {
            JsShape::Rect { id, .. } | JsShape::Ellipse { id, .. } | JsShape::Line { id, .. } | JsShape::Text { id, .. } | JsShape::ImageRect { id, .. } | JsShape::Path { id, .. } | JsShape::Polyline { id, .. } | JsShape::Group { id, .. } | JsShape::RoughRect { id, .. } | JsShape::RoughEllipse { id, .. } | JsShape::RoughLine { id, .. } | JsShape::RoughPolyline { id, .. } | JsShape::RoughPath { id, .. } => id,
        }
    }
    pub fn parent_id(&self) -> Option<&str> {
        match self {
            JsShape::Rect { parent_id, .. } | JsShape::Ellipse { parent_id, .. } | JsShape::Line { parent_id, .. } | JsShape::Text { parent_id, .. } | JsShape::ImageRect { parent_id, .. } | JsShape::Path { parent_id, .. } | JsShape::Polyline { parent_id, .. } | JsShape::Group { parent_id, .. } | JsShape::RoughRect { parent_id, .. } | JsShape::RoughEllipse { parent_id, .. } | JsShape::RoughLine { parent_id, .. } | JsShape::RoughPolyline { parent_id, .. } | JsShape::RoughPath { parent_id, .. } => parent_id.as_deref(),
        }
    }
    pub fn z_index(&self) -> f32 {
        match self {
            JsShape::Rect { z_index, .. } | JsShape::Ellipse { z_index, .. } | JsShape::Line { z_index, .. } | JsShape::Text { z_index, .. } | JsShape::ImageRect { z_index, .. } | JsShape::Path { z_index, .. } | JsShape::Polyline { z_index, .. } | JsShape::Group { z_index, .. } | JsShape::RoughRect { z_index, .. } | JsShape::RoughEllipse { z_index, .. } | JsShape::RoughLine { z_index, .. } | JsShape::RoughPolyline { z_index, .. } | JsShape::RoughPath { z_index, .. } => *z_index,
        }
    }
    pub fn ui(&self) -> bool {
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
    pub fn local_transform(&self) -> Option<&Mat3Array> {
        match self {
            JsShape::Rect { local_transform, .. } | JsShape::Ellipse { local_transform, .. } | JsShape::Line { local_transform, .. } | JsShape::Text { local_transform, .. } | JsShape::ImageRect { local_transform, .. } | JsShape::Path { local_transform, .. } | JsShape::Polyline { local_transform, .. } | JsShape::Group { local_transform, .. } | JsShape::RoughRect { local_transform, .. } | JsShape::RoughEllipse { local_transform, .. } | JsShape::RoughLine { local_transform, .. } | JsShape::RoughPolyline { local_transform, .. } | JsShape::RoughPath { local_transform, .. } => local_transform.as_ref(),
        }
    }
    pub fn local_origin(&self) -> Point {
        match self {
            JsShape::Rect { x, y, .. } | JsShape::ImageRect { x, y, .. } | JsShape::RoughRect { x, y, .. } => Point::new(*x, *y),
            JsShape::Ellipse { cx, cy, .. } | JsShape::RoughEllipse { cx, cy, .. } => Point::new(*cx, *cy),
            JsShape::Line { x1, y1, .. } | JsShape::RoughLine { x1, y1, .. } => Point::new(*x1, *y1),
            JsShape::Text { anchor_x, anchor_y, .. } => Point::new(*anchor_x, *anchor_y),
            JsShape::Path { .. } | JsShape::Polyline { .. } | JsShape::Group { .. } | JsShape::RoughPolyline { .. } | JsShape::RoughPath { .. } => Point::ORIGIN,
        }
    }
}

/// 与 `Theme.ts` 浅色默认、`MeshPipeline` 经 `parseColor` 写入的 sRGB 0–1 一致。
pub const DEFAULT_LIGHT_CANVAS_BACKGROUND_RGBA: [f32; 4] =
    [0xfb as f32 / 255.0, 0xfb as f32 / 255.0, 0xfb as f32 / 255.0, 1.0];
pub const DEFAULT_LIGHT_CANVAS_GRID_RGBA: [f32; 4] =
    [0xde as f32 / 255.0, 0xde as f32 / 255.0, 0xde as f32 / 255.0, 1.0];

#[derive(Clone, Copy)]
pub struct CanvasRenderOptions {
    pub grid: bool,
    pub ui: bool,
    /// `0` = none, `1` = grid, `2` = dots — matches ECS `CheckboardStyle` / `u_CheckboardStyle`.
    pub checkboard_style: u8,
    /// sRGB 通道 0–1，与 TS `parseColor` + `/255` 一致。
    pub background_rgba: [f32; 4],
    pub grid_rgba: [f32; 4],
}

impl Default for CanvasRenderOptions {
    fn default() -> Self {
        Self {
            grid: true,
            ui: true,
            checkboard_style: 1,
            background_rgba: DEFAULT_LIGHT_CANVAS_BACKGROUND_RGBA,
            grid_rgba: DEFAULT_LIGHT_CANVAS_GRID_RGBA,
        }
    }
}

#[cfg(target_arch = "wasm32")]
#[derive(Debug, Serialize)]
pub struct TextBounds {
    pub min_x: f64,
    pub min_y: f64,
    pub max_x: f64,
    pub max_y: f64,
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

pub fn mat3_to_affine(m: &Mat3Array) -> Affine {
    let [m00, m01, m02, m10, m11, m12, _m20, _m21, _m22] = *m;
    Affine::new([m00, m10, m01, m11, m02, m12])
}

pub fn apply_opacity_to_color(mut color: [f32; 4], opacity: f32, fill_or_stroke_opacity: f32) -> [f32; 4] {
    color[3] *= opacity * fill_or_stroke_opacity;
    color
}

#[cfg(target_arch = "wasm32")]
pub fn fill_gradient_options_to_spec(o: &FillGradientOptions) -> FillGradientSpec {
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
pub fn resolve_fill_gradients(
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

#[cfg(target_arch = "wasm32")]
pub fn deserialize_id<'de, D>(d: D) -> Result<String, D::Error>
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
        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E> { Ok(v.to_string()) }
        fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E> { Ok(v.to_string()) }
        fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E> { Ok(v.to_string()) }
        fn visit_f64<E>(self, v: f64) -> Result<Self::Value, E> { Ok(v.to_string()) }
    }
    d.deserialize_any(IdVisitor)
}

#[cfg(target_arch = "wasm32")]
pub fn deserialize_parent_id<'de, D>(d: D) -> Result<Option<String>, D::Error>
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
        fn visit_none<E>(self) -> Result<Self::Value, E> { Ok(None) }
        fn visit_some<D2>(self, d: D2) -> Result<Self::Value, D2::Error>
        where D2: serde::Deserializer<'de> {
            deserialize_id(d).map(Some)
        }
        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E> { Ok(Some(v.to_string())) }
        fn visit_i64<E>(self, v: i64) -> Result<Self::Value, E> { Ok(Some(v.to_string())) }
        fn visit_u64<E>(self, v: u64) -> Result<Self::Value, E> { Ok(Some(v.to_string())) }
        fn visit_f64<E>(self, v: f64) -> Result<Self::Value, E> { Ok(Some(v.to_string())) }
    }
    d.deserialize_option(ParentIdVisitor)
}

#[cfg(target_arch = "wasm32")]
pub fn deserialize_mat3_opt<'de, D>(d: D) -> Result<Option<Mat3Array>, D::Error>
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

#[cfg(target_arch = "wasm32")]
pub fn default_linecap() -> String { "butt".to_string() }
#[cfg(target_arch = "wasm32")]
pub fn default_linejoin() -> String { "miter".to_string() }
#[cfg(target_arch = "wasm32")]
pub fn default_miter_limit() -> f64 { 4.0 }
#[cfg(target_arch = "wasm32")]
pub fn default_stroke_alignment() -> String { "center".to_string() }
#[cfg(target_arch = "wasm32")]
pub fn default_marker_start() -> String { "none".to_string() }
#[cfg(target_arch = "wasm32")]
pub fn default_marker_end() -> String { "none".to_string() }
#[cfg(target_arch = "wasm32")]
pub fn default_marker_factor() -> f32 { 3.0 }
#[cfg(target_arch = "wasm32")]
pub fn default_rgba() -> [f32; 4] { [0.0, 0.0, 0.0, 0.5] }
#[cfg(target_arch = "wasm32")]
pub fn default_rgba_fill() -> [f32; 4] { [1.0, 1.0, 1.0, 1.0] }
#[cfg(target_arch = "wasm32")]
pub fn default_rgba_fill_transparent() -> [f32; 4] { [0.0, 0.0, 0.0, 0.0] }
#[cfg(target_arch = "wasm32")]
pub fn default_rgba_stroke() -> [f32; 4] { [0.0, 0.0, 0.0, 1.0] }
#[cfg(target_arch = "wasm32")]
pub fn default_opacity() -> f32 { 1.0 }
#[cfg(target_arch = "wasm32")]
pub fn default_fill_rule() -> String { "nonzero".to_string() }
#[cfg(target_arch = "wasm32")]
pub fn default_font_family() -> String { "sans-serif".to_string() }
#[cfg(target_arch = "wasm32")]
pub fn default_font_size() -> f64 { 12.0 }
#[cfg(target_arch = "wasm32")]
pub fn default_font_weight() -> String { "normal".to_string() }
#[cfg(target_arch = "wasm32")]
pub fn default_font_style() -> String { "normal".to_string() }
#[cfg(target_arch = "wasm32")]
pub fn default_font_variant() -> String { "normal".to_string() }
#[cfg(target_arch = "wasm32")]
pub fn default_font_kerning() -> bool { true }
#[cfg(target_arch = "wasm32")]
pub fn default_white_space() -> String { "normal".to_string() }
#[cfg(target_arch = "wasm32")]
pub fn default_text_overflow() -> String { "clip".to_string() }
#[cfg(target_arch = "wasm32")]
pub fn default_max_lines() -> i32 { i32::MAX }
#[cfg(target_arch = "wasm32")]
pub fn default_text_align() -> String { "start".to_string() }
#[cfg(target_arch = "wasm32")]
pub fn default_text_baseline() -> String { "alphabetic".to_string() }
#[cfg(target_arch = "wasm32")]
pub fn default_roughness() -> f32 { 1.0 }

pub fn default_rough_seed() -> i32 {
    0
}
#[cfg(target_arch = "wasm32")]
pub fn default_bowing() -> f32 { 1.0 }
#[cfg(target_arch = "wasm32")]
pub fn default_hachure_angle() -> f32 { -41.0 }
#[cfg(target_arch = "wasm32")]
pub fn default_hachure_gap() -> f32 { 4.0 }
#[cfg(target_arch = "wasm32")]
pub fn default_fill_weight() -> f32 { -1.0 }
#[cfg(target_arch = "wasm32")]
pub fn default_curve_step_count() -> f32 { 9.0 }
#[cfg(target_arch = "wasm32")]
pub fn default_scale() -> f64 { 1.0 }
#[cfg(target_arch = "wasm32")]
pub fn default_canvas_grid() -> bool { true }
#[cfg(target_arch = "wasm32")]
pub fn default_canvas_ui() -> bool { true }
#[cfg(target_arch = "wasm32")]
pub fn default_checkboard_style_index() -> u8 {
    1
}

#[cfg(target_arch = "wasm32")]
pub fn default_canvas_background_rgba() -> [f32; 4] {
    DEFAULT_LIGHT_CANVAS_BACKGROUND_RGBA
}

#[cfg(target_arch = "wasm32")]
pub fn default_canvas_grid_rgba() -> [f32; 4] {
    DEFAULT_LIGHT_CANVAS_GRID_RGBA
}
#[cfg(target_arch = "wasm32")]
pub fn default_true() -> bool { true }

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
    #[serde(default = "default_rgba_fill_transparent")]
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
    Watercolor,
}

#[cfg(target_arch = "wasm32")]
impl Default for RoughFillStyle {
    fn default() -> Self { RoughFillStyle::Hachure }
}

#[cfg(target_arch = "wasm32")]
impl RoughFillStyle {
    pub fn as_str(&self) -> &'static str {
        match self {
            RoughFillStyle::Hachure => "hachure",
            RoughFillStyle::Solid => "solid",
            RoughFillStyle::Zigzag => "zigzag",
            RoughFillStyle::CrossHatch => "cross-hatch",
            RoughFillStyle::Dots => "dots",
            RoughFillStyle::Dashed => "dashed",
            RoughFillStyle::ZigzagLine => "zigzag-line",
            RoughFillStyle::Watercolor => "watercolor",
        }
    }
}

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
    #[serde(default = "default_fill_weight")]
    pub fill_weight: f32,
    #[serde(default = "default_rough_seed")]
    pub rough_seed: i32,
}

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
    #[serde(default = "default_fill_weight")]
    pub fill_weight: f32,
    #[serde(default = "default_rough_seed")]
    pub rough_seed: i32,
}

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
    #[serde(default = "default_fill_weight")]
    pub fill_weight: f32,
    #[serde(default = "default_marker_start")]
    pub marker_start: String,
    #[serde(default = "default_marker_end")]
    pub marker_end: String,
    #[serde(default = "default_marker_factor")]
    pub marker_factor: f32,
    #[serde(default = "default_rough_seed")]
    pub rough_seed: i32,
}

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
    #[serde(default = "default_fill_weight")]
    pub fill_weight: f32,
    #[serde(default = "default_marker_start")]
    pub marker_start: String,
    #[serde(default = "default_marker_end")]
    pub marker_end: String,
    #[serde(default = "default_marker_factor")]
    pub marker_factor: f32,
    #[serde(default = "default_rough_seed")]
    pub rough_seed: i32,
}

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
    #[serde(default = "default_marker_start")]
    pub marker_start: String,
    #[serde(default = "default_marker_end")]
    pub marker_end: String,
    #[serde(default = "default_marker_factor")]
    pub marker_factor: f32,
}

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
}

#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathHitTestOptions {
    pub d: String,
    pub x: f64,
    pub y: f64,
    #[serde(default = "default_true")]
    pub fill: bool,
    #[serde(default = "default_fill_rule")]
    pub fill_rule: String,
    #[serde(default)]
    pub stroke: Option<StrokeOptions>,
}

#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathBoundsOptions {
    pub d: String,
    #[serde(default)]
    pub stroke: Option<StrokeOptions>,
    #[serde(default = "default_marker_start")]
    pub marker_start: String,
    #[serde(default = "default_marker_end")]
    pub marker_end: String,
    #[serde(default = "default_marker_factor")]
    pub marker_factor: f32,
}

#[cfg(target_arch = "wasm32")]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportViewOpts {
    pub left: f64,
    pub top: f64,
    pub width: f64,
    pub height: f64,
}

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
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasRenderOptionsInput {
    #[serde(default = "default_canvas_grid")]
    pub grid: bool,
    #[serde(default = "default_canvas_ui")]
    pub ui: bool,
    #[serde(default = "default_checkboard_style_index")]
    pub checkboard_style: u8,
    #[serde(default = "default_canvas_background_rgba")]
    pub background_color: [f32; 4],
    #[serde(default = "default_canvas_grid_rgba")]
    pub grid_color: [f32; 4],
}
