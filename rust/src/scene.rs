#[cfg(target_arch = "wasm32")]
use std::collections::HashMap;

use vello::kurbo::{Affine, BezPath, Ellipse, Line, PathEl, Point, Rect, RoundedRect, Shape, Stroke, Vec2};
use vello::peniko::{Blob, Color, ColorStop, Fill, Gradient, ImageAlphaType, ImageBrush, ImageData, ImageFormat};
use vello::Scene;

#[cfg(target_arch = "wasm32")]
use roughr::{core::Options, generator::Generator};

use crate::types::{CanvasRenderOptions, FillGradientSpec, JsShape, StrokeAlignment, StrokeParams};
use crate::types::{apply_opacity_to_color, mat3_to_affine};
#[cfg(target_arch = "wasm32")]
use crate::path_utils::svg_path_first_closed_polygon;
#[cfg(target_arch = "wasm32")]
use crate::watercolor::{self, WatercolorProfile};
#[cfg(target_arch = "wasm32")]
use crate::state::{get_user_shapes, FONT_BYTES, GLYPH_CACHE, IMAGE_BRUSH_CACHE};
#[cfg(target_arch = "wasm32")]
use crate::text::{build_text_glyphs_with_emoji_positions, get_or_create_emoji_image};
use crate::path_utils::path_start_end_tangents;
use crate::renderer::device_pixel_ratio;

pub fn affine_scale_factor(affine: Affine) -> f64 {
    let det = affine.determinant();
    det.abs().sqrt()
}

pub fn add_grid_to_scene(scene: &mut Scene, transform: Affine, viewport_width: u32, viewport_height: u32) {
    const GRID_MAJOR_STEP: f64 = 100.0;
    const GRID_MINOR_STEP: f64 = 10.0;
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

    let step = GRID_MINOR_STEP;
    let start_x = (min_x / step).floor() * step;
    let start_y = (min_y / step).floor() * step;
    let mut x = start_x;
    while x <= max_x {
        let line = Line::new((x, min_y), (x, max_y));
        scene.stroke(&Stroke::new(minor_width), transform, minor_color, None, &line);
        x += step;
    }
    let mut y = start_y;
    while y <= max_y {
        let line = Line::new((min_x, y), (max_x, y));
        scene.stroke(&Stroke::new(minor_width), transform, minor_color, None, &line);
        y += step;
    }

    let step = GRID_MAJOR_STEP;
    let start_x = (min_x / step).floor() * step;
    let start_y = (min_y / step).floor() * step;
    let mut x = start_x;
    while x <= max_x {
        let line = Line::new((x, min_y), (x, max_y));
        scene.stroke(&Stroke::new(major_width), transform, major_color, None, &line);
        x += step;
    }
    let mut y = start_y;
    while y <= max_y {
        let line = Line::new((min_x, y), (max_x, y));
        scene.stroke(&Stroke::new(major_width), transform, major_color, None, &line);
        y += step;
    }
}

#[cfg(target_arch = "wasm32")]
pub fn sort_shapes_by_parent_z_index(shapes: &[JsShape]) -> Vec<JsShape> {
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
pub fn add_shapes_to_scene(
    scene: &mut Scene,
    transform: Affine,
    viewport_width: u32,
    viewport_height: u32,
    canvas_id: Option<u32>,
    render_opts: CanvasRenderOptions,
    gpu_procedural_grid: bool,
) {
    // Vello line grid only if GPU procedural path is off but a line/dot style is still requested.
    if render_opts.grid
        && !gpu_procedural_grid
        && render_opts.checkboard_style > 0
    {
        add_grid_to_scene(scene, transform, viewport_width, viewport_height);
    }
    #[cfg(target_arch = "wasm32")]
    if let Some(cid) = canvas_id {
        let shapes_all = get_user_shapes(cid);
        let mut shapes = sort_shapes_by_parent_z_index(&shapes_all);

        if !render_opts.ui {
            use std::collections::{HashMap, HashSet};

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

pub fn build_gradient_brush(spec: &FillGradientSpec, fill_opacity_mult: f32) -> Gradient {
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

#[cfg(target_arch = "wasm32")]
pub fn compute_world_transforms(shapes: &[JsShape]) -> HashMap<String, Affine> {
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

#[cfg(target_arch = "wasm32")]
fn fill_style_is_watercolor(s: &str) -> bool {
    s == "watercolor"
}

#[cfg(target_arch = "wasm32")]
fn polygon_to_bezpath(points: &[[f64; 2]]) -> BezPath {
    let mut p = BezPath::new();
    if points.len() < 3 {
        return p;
    }
    p.move_to(Point::new(points[0][0], points[0][1]));
    for q in points.iter().skip(1) {
        p.line_to(Point::new(q[0], q[1]));
    }
    p.close_path();
    p
}

#[cfg(target_arch = "wasm32")]
fn render_watercolor_fill_layers(
    scene: &mut Scene,
    shape_transform: Affine,
    base_polygon: Vec<[f64; 2]>,
    profile: WatercolorProfile,
    fill_color: [f32; 4],
    roughness: f32,
    seed: i32,
) {
    if base_polygon.len() < 3 {
        return;
    }
    let params = watercolor::watercolor_params(base_polygon.len(), roughness, profile, seed);
    let layers = watercolor::watercolor_layers(base_polygon, &params, seed);
    let la = (watercolor::WATERCOLOR_LAYER_FILL_OPACITY as f32) * fill_color[3];
    let layer_color = [fill_color[0], fill_color[1], fill_color[2], la];
    for layer in layers {
        let bp = polygon_to_bezpath(&layer);
        scene.fill(Fill::NonZero, shape_transform, Color::new(layer_color), None, &bp);
    }
}

#[cfg(target_arch = "wasm32")]
fn render_rough_drawable(
    scene: &mut Scene,
    transform: Affine,
    drawable: &roughr::core::Drawable<f32>,
    fill_color: [f32; 4],
    stroke_color: Option<[f32; 4]>,
) {
    use roughr::core::{OpSetType, OpType};

    let stroke_width = drawable.options.stroke_width.unwrap_or(1.0);
    let fill_weight = {
        let fw = drawable.options.fill_weight.unwrap_or(-1.0);
        if fw >= 0.0 { fw } else { stroke_width / 2.0 }
    } as f64;
    let stroke_width = stroke_width as f64;
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
            OpSetType::FillPath => {
                if fill_color[3] > 0.0 {
                    scene.fill(Fill::NonZero, transform, Color::new(fill_color), None, &bez_path);
                }
            }
            OpSetType::FillSketch => {
                if fill_color[3] > 0.0 {
                    let kurbo_stroke = Stroke::new(fill_weight);
                    scene.stroke(&kurbo_stroke, transform, Color::new(fill_color), None, &bez_path);
                }
            }
            OpSetType::Path => {
                if let Some(stroke) = stroke_color {
                    if stroke[3] > 0.0 {
                        let kurbo_stroke = Stroke::new(stroke_width);
                        scene.stroke(&kurbo_stroke, transform, Color::new(stroke), None, &bez_path);
                    }
                }
            }
        }
    }
}

fn marker_enabled(marker: &str) -> bool {
    matches!(marker, "line" | "triangle" | "diamond")
}

fn stroke_marker_path(
    scene: &mut Scene,
    shape_transform: Affine,
    marker_type: &str,
    tip_x: f64,
    tip_y: f64,
    a: f64,
    r: f64,
    kurbo_stroke: &Stroke,
    stroke_color: [f32; 4],
) {
    const PI_6: f64 = std::f64::consts::FRAC_PI_6;
    let left_x = tip_x + r * (a + PI_6).cos();
    let left_y = tip_y + r * (a + PI_6).sin();
    let right_x = tip_x + r * (a - PI_6).cos();
    let right_y = tip_y + r * (a - PI_6).sin();
    let mut path = BezPath::new();
    match marker_type {
        "line" => {
            path.move_to(Point::new(left_x, left_y));
            path.line_to(Point::new(tip_x, tip_y));
            path.line_to(Point::new(right_x, right_y));
        }
        "triangle" => {
            path.move_to(Point::new(left_x, left_y));
            path.line_to(Point::new(tip_x, tip_y));
            path.line_to(Point::new(right_x, right_y));
            path.close_path();
        }
        "diamond" => {
            let cos = a.cos();
            let sin = a.sin();
            let center_x = tip_x + cos * r * 0.5;
            let center_y = tip_y + sin * r * 0.5;
            let back_x = tip_x + cos * r;
            let back_y = tip_y + sin * r;
            let half_width = r * 0.4;
            let d_left_x = center_x - sin * half_width;
            let d_left_y = center_y + cos * half_width;
            let d_right_x = center_x + sin * half_width;
            let d_right_y = center_y - cos * half_width;
            path.move_to(Point::new(tip_x, tip_y));
            path.line_to(Point::new(d_left_x, d_left_y));
            path.line_to(Point::new(back_x, back_y));
            path.line_to(Point::new(d_right_x, d_right_y));
            path.close_path();
        }
        _ => return,
    }
    scene.stroke(
        kurbo_stroke,
        shape_transform,
        Color::new(stroke_color),
        None,
        &path,
    );
}

#[cfg(target_arch = "wasm32")]
pub fn add_js_shape_to_scene(
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
    let dpr = device_pixel_ratio();
    let scale = (affine_scale_factor(transform) / dpr).max(1e-6);
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
            let blur_std_dev = if size_attenuation { fill_blur / scale } else { fill_blur };
            let (x0, y0, x1, y1) = (
                x.min(x + w),
                y.min(y + h),
                x.max(x + w),
                y.max(y + h),
            );
            let fill_mult = opacity * fill_opacity;

            let stroke_config = stroke.as_ref().map(|s| {
                let width = if stroke_attenuation { s.width / scale } else { s.width };
                let color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                (width, color, &s.alignment)
            });

            let (fill_geom, stroke_geom) = if let Some((sw, _, alignment)) = stroke_config {
                match alignment {
                    StrokeAlignment::Inner => {
                        let fill_rect = RoundedRect::new(
                            x0 + sw, y0 + sw,
                            x1 - sw, y1 - sw,
                            (r - sw).max(0.0)
                        );
                        let stroke_rect = RoundedRect::new(
                            x0 + sw / 2.0, y0 + sw / 2.0,
                            x1 - sw / 2.0, y1 - sw / 2.0,
                            (r - sw / 2.0).max(0.0)
                        );
                        (Some(fill_rect), Some((stroke_rect, sw)))
                    }
                    StrokeAlignment::Outer => {
                        let offset = sw / 2.0;
                        let fill_rect = RoundedRect::new(x0, y0, x1, y1, r);
                        let stroke_rect = RoundedRect::new(
                            x0 - offset, y0 - offset,
                            x1 + offset, y1 + offset,
                            r
                        );
                        (Some(fill_rect), Some((stroke_rect, sw)))
                    }
                    StrokeAlignment::Center => {
                        let rect = RoundedRect::new(x0, y0, x1, y1, r);
                        (Some(rect), Some((rect, sw)))
                    }
                }
            } else {
                let fill_rect = RoundedRect::new(x0, y0, x1, y1, r);
                (Some(fill_rect), None)
            };

            if let Some(ref ds) = drop_shadow {
                let ds_blur = if size_attenuation { ds.blur / scale } else { ds.blur };
                let ds_offset_x = if size_attenuation { ds.offset_x / scale } else { ds.offset_x };
                let ds_offset_y = if size_attenuation { ds.offset_y / scale } else { ds.offset_y };

                if ds_blur > 0.0 {
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

            if let Some(ref fill_geom) = fill_geom {
                let use_blur = blur_std_dev > 0.0 && r > 0.0 && fill_gradients.is_none();
                if use_blur {
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

            let stroke_config = stroke.as_ref().map(|s| {
                let width = if stroke_attenuation { s.width / scale } else { s.width };
                let color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                (width, color, &s.alignment)
            });

            let (fill_geom, stroke_geom) = if let Some((sw, _, alignment)) = stroke_config {
                match alignment {
                    StrokeAlignment::Inner => {
                        let fill_ellipse = Ellipse::new(
                            Point::new(cx, cy),
                            Vec2::new((rx_eff - sw).max(0.0), (ry_eff - sw).max(0.0)),
                            0.0
                        );
                        let stroke_ellipse = Ellipse::new(
                            Point::new(cx, cy),
                            Vec2::new((rx_eff - sw / 2.0).max(0.0), (ry_eff - sw / 2.0).max(0.0)),
                            0.0
                        );
                        (Some(fill_ellipse), Some((stroke_ellipse, sw)))
                    }
                    StrokeAlignment::Outer => {
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
                        let ellipse = Ellipse::new(Point::new(cx, cy), Vec2::new(rx_eff, ry_eff), 0.0);
                        (Some(ellipse), Some((ellipse, sw)))
                    }
                }
            } else {
                let fill_ellipse = Ellipse::new(Point::new(cx, cy), Vec2::new(rx_eff, ry_eff), 0.0);
                (Some(fill_ellipse), None)
            };

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
            let use_attenuation = size_attenuation || stroke_attenuation;
            let kurbo_stroke = if use_attenuation {
                stroke.to_kurbo_stroke_with_width(stroke.width / scale)
            } else {
                stroke.to_kurbo_stroke()
            };
            scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &line);
            if marker_factor > 0.0
                && (marker_enabled(marker_start.as_str())
                    || marker_enabled(marker_end.as_str()))
            {
                let dx = x2 - x1;
                let dy = y2 - y1;
                let len = (dx * dx + dy * dy).sqrt();
                if len > 0.0 {
                    let angle = dy.atan2(dx);
                    let eff_width = if use_attenuation { stroke.width / scale } else { stroke.width };
                    let r = eff_width * marker_factor as f64;
                    if marker_enabled(marker_start.as_str()) {
                        stroke_marker_path(
                            scene,
                            shape_transform,
                            marker_start.as_str(),
                            x1,
                            y1,
                            angle,
                            r,
                            &kurbo_stroke,
                            stroke_color,
                        );
                    }
                    if marker_enabled(marker_end.as_str()) {
                        stroke_marker_path(
                            scene,
                            shape_transform,
                            marker_end.as_str(),
                            x2,
                            y2,
                            angle + std::f64::consts::PI,
                            r,
                            &kurbo_stroke,
                            stroke_color,
                        );
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
            stroke,
            opacity,
            fill_opacity,
            stroke_opacity,
            size_attenuation,
            ..
        } => {
            let (font_size_eff, letter_spacing_eff) = if size_attenuation {
                (font_size / scale, letter_spacing / scale)
            } else {
                (font_size, letter_spacing)
            };
            let word_wrap_width_eff = if size_attenuation {
                (word_wrap_width / scale).max(1e-6)
            } else {
                word_wrap_width
            };
            let line_height_px = line_height as f32;
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

            if !FONT_BYTES.with(|c| c.borrow().is_empty()) {
                let cached = GLYPH_CACHE.with(|c| c.borrow().get(&cache_key).cloned());

                let (glyph_runs, size, emoji_positions) = match cached {
                    Some((runs, s, em)) => (runs, s, em),
                    None => {
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
                let fill_brush = Color::new(fill_color);

                if let Some(ref s) = stroke {
                    let stroke_width = if size_attenuation { s.width / scale } else { s.width };
                    let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                    if stroke_width > 0.0 && stroke_color[3] > 0.0 {
                        // Approximate text outline by drawing offset fills around glyphs.
                        // This keeps the implementation lightweight without converting glyphs to paths.
                        let radius = (stroke_width / 2.0).max(0.5);
                        let samples = ((radius * 8.0).ceil() as usize).clamp(8, 48);
                        let outline_brush = Color::new(stroke_color);
                        for i in 0..samples {
                            let t = i as f64 / samples as f64;
                            let theta = t * std::f64::consts::TAU;
                            let dx = radius * theta.cos();
                            let dy = radius * theta.sin();
                            let outline_transform = shape_transform * Affine::translate(Vec2::new(dx, dy));
                            for (font_data, glyphs) in &glyph_runs {
                                scene
                                    .draw_glyphs(font_data)
                                    .font_size(size)
                                    .transform(outline_transform)
                                    .brush(outline_brush)
                                    .draw(Fill::NonZero, glyphs.clone().into_iter());
                            }
                        }
                    }
                }

                for (font_data, glyphs) in &glyph_runs {
                    scene
                        .draw_glyphs(font_data)
                        .font_size(size)
                        .transform(shape_transform)
                        .brush(fill_brush)
                        .draw(Fill::NonZero, glyphs.clone().into_iter());
                }

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

                        let emoji_size = font_size_eff;

                        // `emoji_pos` matches `vello::Glyph` placement: x is the glyph origin (left edge
                        // of the advance slot), y is the baseline — same as `build_text_glyphs_with_emoji_positions`.
                        // Use dynamic vertical offset derived from run ascent/descent instead of a
                        // single hard-coded value, so different fonts stay visually aligned.
                        const EMOJI_NUDGE_LEFT: f64 = 0.0;
                        let s = emoji_size as f64;
                        let nudge_down = (emoji_pos.descent_ratio as f64).clamp(0.10, 0.22);
                        let emoji_x = emoji_pos.x - s * EMOJI_NUDGE_LEFT;
                        let emoji_y = emoji_pos.y - s + s * nudge_down;

                        let full_transform = shape_transform
                            * Affine::translate(Vec2::new(emoji_x as f64, emoji_y as f64))
                            * Affine::scale_non_uniform(
                                emoji_size / img_width as f64,
                                emoji_size / img_height as f64,
                            );

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
            id,
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
            let brush_transform = Affine::translate(Vec2::new(x, y))
                * Affine::scale_non_uniform(w / image_width as f64, h / image_height as f64);

                let stroke_config = stroke.as_ref().map(|s| {
                    let width = if stroke_attenuation { s.width / scale } else { s.width };
                    let color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                    (width, color, &s.alignment)
                });

                let (fill_rect, stroke_rect, stroke_width) = if let Some((sw, _, alignment)) = stroke_config {
                    match alignment {
                        StrokeAlignment::Inner => {
                            let fill_r = (r - sw).max(0.0);
                            let fill_x0 = x + sw;
                            let fill_y0 = y + sw;
                            let fill_x1 = x + w - sw;
                            let fill_y1 = y + h - sw;
                            let stroke_r = (r - sw / 2.0).max(0.0);
                            let stroke_x0 = x + sw / 2.0;
                            let stroke_y0 = y + sw / 2.0;
                            let stroke_x1 = x + w - sw / 2.0;
                            let stroke_y1 = y + h - sw / 2.0;
                            (Some((fill_x0, fill_y0, fill_x1, fill_y1, fill_r)), Some((stroke_x0, stroke_y0, stroke_x1, stroke_y1, stroke_r)), Some(sw))
                        }
                        StrokeAlignment::Outer => {
                            let offset = sw / 2.0;
                            let stroke_r = r;
                            let stroke_x0 = x - offset;
                            let stroke_y0 = y - offset;
                            let stroke_x1 = x + w + offset;
                            let stroke_y1 = y + h + offset;
                            (Some((x, y, x + w, y + h, r)), Some((stroke_x0, stroke_y0, stroke_x1, stroke_y1, stroke_r)), Some(sw))
                        }
                        StrokeAlignment::Center => {
                            (Some((x, y, x + w, y + h, r)), Some((x, y, x + w, y + h, r)), Some(sw))
                        }
                    }
                } else {
                    (Some((x, y, x + w, y + h, r)), None, None)
                };

                if let Some(ref ds) = drop_shadow {
                    let ds_blur = if size_attenuation { ds.blur / scale } else { ds.blur };
                    let ds_offset_x = if size_attenuation { ds.offset_x / scale } else { ds.offset_x };
                    let ds_offset_y = if size_attenuation { ds.offset_y / scale } else { ds.offset_y };

                    let (sx0, sy0, sx1, sy1, sr) = fill_rect.unwrap_or((x, y, x + w, y + h, r));
                    let shadow_rect = Rect::new(sx0 + ds_offset_x, sy0 + ds_offset_y, sx1 + ds_offset_x, sy1 + ds_offset_y);
                    let shadow_color = apply_opacity_to_color(ds.color, opacity, 1.0);

                    if ds_blur > 0.0 {
                        scene.draw_blurred_rounded_rect(
                            shape_transform,
                            shadow_rect,
                            Color::new(shadow_color),
                            sr,
                            ds_blur
                        );
                    } else {
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

                if let Some((fx0, fy0, fx1, fy1, fr)) = fill_rect {
                    // 用缓存复用 ImageBrush，避免每次 redraw 都触发 wgpu 的 texture 上传。
                    IMAGE_BRUSH_CACHE.with(|cache_cell| {
                        let mut cache = cache_cell.borrow_mut();
                        let brush = if let Some(cached) = cache.get(id.as_str()) {
                            cached
                        } else {
                            if image_data.len() < expected_len {
                                return;
                            }
                            let image = ImageData {
                                // 仅在 cache miss 时消费 image_data，避免每帧都构造。
                                data: Blob::from(image_data),
                                format: ImageFormat::Rgba8,
                                alpha_type: ImageAlphaType::Alpha,
                                width: image_width,
                                height: image_height,
                            };
                            let brush = ImageBrush::new(image);
                            cache.insert(id.clone(), brush);
                            cache.get(id.as_str()).expect("just inserted")
                        };

                        if fr > 0.0 {
                            let fill_geom = RoundedRect::new(fx0, fy0, fx1, fy1, fr);
                            scene.fill(
                                Fill::NonZero,
                                shape_transform,
                                brush.as_ref(),
                                Some(brush_transform),
                                &fill_geom,
                            );
                        } else {
                            let fill_geom = Rect::new(fx0, fy0, fx1, fy1);
                            scene.fill(
                                Fill::NonZero,
                                shape_transform,
                                brush.as_ref(),
                                Some(brush_transform),
                                &fill_geom,
                            );
                        }
                    });
                }

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

                let stroke_config = stroke.as_ref().map(|s| {
                    let width = if stroke_attenuation { s.width / scale } else { s.width };
                    let color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                    (width, color, &s.alignment)
                });

                match stroke_config {
                    Some((sw, _, StrokeAlignment::Inner)) => {
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
                            let kurbo_stroke = s.to_kurbo_stroke_with_width(sw);
                            scene.push_clip_layer(fill_mode, shape_transform, &bez_path);
                            scene.stroke(&kurbo_stroke, shape_transform, Color::new(stroke_color), None, &bez_path);
                            scene.pop_layer();
                        }
                    }
                    Some((sw, _, StrokeAlignment::Outer)) => {
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
                if stroke.is_some()
                    && marker_factor > 0.0
                    && (marker_enabled(marker_start.as_str())
                        || marker_enabled(marker_end.as_str()))
                {
                    if let Some(ref s) = stroke {
                        if let Some(((sx, sy), start_angle, (ex, ey), end_angle)) = path_start_end_tangents(&bez_path) {
                            let sw = if stroke_attenuation { s.width / scale } else { s.width };
                            let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                            let kurbo_stroke = s.to_kurbo_stroke_with_width(sw);
                            let r = sw * marker_factor as f64;
                            if marker_enabled(marker_start.as_str()) {
                                stroke_marker_path(
                                    scene,
                                    shape_transform,
                                    marker_start.as_str(),
                                    sx,
                                    sy,
                                    start_angle,
                                    r,
                                    &kurbo_stroke,
                                    stroke_color,
                                );
                            }
                            if marker_enabled(marker_end.as_str()) {
                                stroke_marker_path(
                                    scene,
                                    shape_transform,
                                    marker_end.as_str(),
                                    ex,
                                    ey,
                                    end_angle + std::f64::consts::PI,
                                    r,
                                    &kurbo_stroke,
                                    stroke_color,
                                );
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
                if stroke.is_some()
                    && marker_factor > 0.0
                    && (marker_enabled(marker_start.as_str())
                        || marker_enabled(marker_end.as_str()))
                {
                    if let Some(ref s) = stroke {
                        if let Some(((sx, sy), start_angle, (ex, ey), end_angle)) = path_start_end_tangents(&bez_path) {
                            let sw = if stroke_attenuation { s.width / scale } else { s.width };
                            let stroke_color = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                            let kurbo_stroke = s.to_kurbo_stroke_with_width(sw);
                            let r = sw * marker_factor as f64;
                            if marker_enabled(marker_start.as_str()) {
                                stroke_marker_path(
                                    scene,
                                    shape_transform,
                                    marker_start.as_str(),
                                    sx,
                                    sy,
                                    start_angle,
                                    r,
                                    &kurbo_stroke,
                                    stroke_color,
                                );
                            }
                            if marker_enabled(marker_end.as_str()) {
                                stroke_marker_path(
                                    scene,
                                    shape_transform,
                                    marker_end.as_str(),
                                    ex,
                                    ey,
                                    end_angle + std::f64::consts::PI,
                                    r,
                                    &kurbo_stroke,
                                    stroke_color,
                                );
                            }
                        }
                    }
                }
            }
        }
        JsShape::Brush { .. } => {
            // Brush is rendered by the dedicated GPU brush pass.
        }
        JsShape::Group { .. } => {}
        JsShape::RoughRect { x, y, width, height, fill, stroke, opacity, fill_opacity, stroke_opacity, roughness, bowing, fill_style, hachure_angle, hachure_gap, fill_weight, curve_step_count, simplification, rough_seed, .. } => {
            let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
            let stroke_color = stroke.as_ref().map(|s| apply_opacity_to_color(s.color, opacity, stroke_opacity));
            let wc = fill_style_is_watercolor(&fill_style) && fill_color[3] > 0.0;
            if wc {
                let div = ((width * width + height * height).sqrt() / 40.0).round().clamp(4.0, 16.0) as usize;
                let mut base = watercolor::subdivide_axis_aligned_rect(width, height, div);
                for p in &mut base {
                    p[0] += x;
                    p[1] += y;
                }
                render_watercolor_fill_layers(
                    scene,
                    shape_transform,
                    base,
                    WatercolorProfile::Rect,
                    fill_color,
                    roughness,
                    rough_seed,
                );
            }
            let options = Options {
                roughness: Some(roughness),
                bowing: Some(bowing),
                fill: if wc {
                    None
                } else if fill_color[3] > 0.0 {
                    Some(roughr::Srgba::new(fill_color[0], fill_color[1], fill_color[2], fill_color[3]))
                } else {
                    None
                },
                fill_style: if wc { map_fill_style("solid") } else { map_fill_style(&fill_style) },
                hachure_angle: Some(hachure_angle),
                hachure_gap: if hachure_gap > 0.0 { Some(hachure_gap) } else { Some(stroke.as_ref().map(|s| s.width as f32).unwrap_or(1.0) * 4.0) },
                curve_step_count: Some(curve_step_count),
                simplification: Some(simplification),
                stroke: stroke_color.map(|c| roughr::Srgba::new(c[0], c[1], c[2], c[3])),
                stroke_width: stroke.as_ref().map(|s| s.width as f32),
                fill_weight: if fill_weight >= 0.0 { Some(fill_weight) } else { None },
                ..Options::default()
            };
            let generator = Generator::default();
            let drawable = generator.rectangle(x as f32, y as f32, width as f32, height as f32, &Some(options));
            render_rough_drawable(
                scene,
                shape_transform,
                &drawable,
                if wc { [0.0, 0.0, 0.0, 0.0] } else { fill_color },
                stroke_color,
            );
        }
        JsShape::RoughEllipse { cx, cy, rx, ry, fill, stroke, opacity, fill_opacity, stroke_opacity, roughness, bowing, fill_style, hachure_angle, hachure_gap, fill_weight, curve_step_count, simplification, rough_seed, .. } => {
            let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
            let stroke_color = stroke.as_ref().map(|s| apply_opacity_to_color(s.color, opacity, stroke_opacity));
            let wc = fill_style_is_watercolor(&fill_style) && fill_color[3] > 0.0;
            if wc {
                let base = watercolor::sample_ellipse(cx, cy, rx, ry, 40);
                render_watercolor_fill_layers(
                    scene,
                    shape_transform,
                    base,
                    WatercolorProfile::Default,
                    fill_color,
                    roughness,
                    rough_seed,
                );
            }
            let options = Options {
                roughness: Some(roughness),
                bowing: Some(bowing),
                fill: if wc {
                    None
                } else if fill_color[3] > 0.0 {
                    Some(roughr::Srgba::new(fill_color[0], fill_color[1], fill_color[2], fill_color[3]))
                } else {
                    None
                },
                fill_style: if wc { map_fill_style("solid") } else { map_fill_style(&fill_style) },
                hachure_angle: Some(hachure_angle),
                hachure_gap: if hachure_gap > 0.0 { Some(hachure_gap) } else { Some(stroke.as_ref().map(|s| s.width as f32).unwrap_or(1.0) * 4.0) },
                curve_step_count: Some(curve_step_count),
                simplification: Some(simplification),
                stroke: stroke_color.map(|c| roughr::Srgba::new(c[0], c[1], c[2], c[3])),
                stroke_width: stroke.as_ref().map(|s| s.width as f32),
                fill_weight: if fill_weight >= 0.0 { Some(fill_weight) } else { None },
                ..Options::default()
            };
            let generator = Generator::default();
            let drawable = generator.ellipse(cx as f32, cy as f32, rx as f32 * 2.0, ry as f32 * 2.0, &Some(options));
            render_rough_drawable(
                scene,
                shape_transform,
                &drawable,
                if wc { [0.0, 0.0, 0.0, 0.0] } else { fill_color },
                stroke_color,
            );
        }
        JsShape::RoughLine { x1, y1, x2, y2, stroke, opacity, stroke_opacity, roughness, bowing, simplification, marker_start, marker_end, marker_factor, .. } => {
            let stroke_color_val = apply_opacity_to_color(stroke.color, opacity, stroke_opacity);
            let options = Options {
                roughness: Some(roughness),
                bowing: Some(bowing),
                simplification: Some(simplification),
                stroke: Some(roughr::Srgba::new(stroke_color_val[0], stroke_color_val[1], stroke_color_val[2], stroke_color_val[3])),
                stroke_width: Some(stroke.width as f32),
                ..Options::default()
            };
            let generator = Generator::default();
            let drawable = generator.line(x1 as f32, y1 as f32, x2 as f32, y2 as f32, &Some(options));
            render_rough_drawable(scene, shape_transform, &drawable, [0.0, 0.0, 0.0, 0.0], Some(stroke_color_val));
            if marker_factor > 0.0
                && (marker_enabled(marker_start.as_str())
                    || marker_enabled(marker_end.as_str()))
            {
                let dx = x2 - x1;
                let dy = y2 - y1;
                let len = (dx * dx + dy * dy).sqrt();
                if len > 0.0 {
                    let angle = dy.atan2(dx);
                    let r = stroke.width * marker_factor as f64;
                    let kurbo_stroke = stroke.to_kurbo_stroke();
                    if marker_enabled(marker_start.as_str()) {
                        stroke_marker_path(
                            scene,
                            shape_transform,
                            marker_start.as_str(),
                            x1,
                            y1,
                            angle,
                            r,
                            &kurbo_stroke,
                            stroke_color_val,
                        );
                    }
                    if marker_enabled(marker_end.as_str()) {
                        stroke_marker_path(
                            scene,
                            shape_transform,
                            marker_end.as_str(),
                            x2,
                            y2,
                            angle + std::f64::consts::PI,
                            r,
                            &kurbo_stroke,
                            stroke_color_val,
                        );
                    }
                }
            }
        }
        JsShape::RoughPolyline { points, fill, stroke, opacity, fill_opacity, stroke_opacity, roughness, bowing, fill_style, hachure_angle, hachure_gap, fill_weight, curve_step_count, simplification, marker_start, marker_end, marker_factor, rough_seed, .. } => {
            let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
            let stroke_color = stroke.as_ref().map(|s| apply_opacity_to_color(s.color, opacity, stroke_opacity));
            let wc_requested = fill_style_is_watercolor(&fill_style) && fill_color[3] > 0.0;
            let mut base: Vec<[f64; 2]> = points.iter().map(|p| [p[0], p[1]]).collect();
            if base.len() >= 3 {
                let first = base[0];
                let last = *base.last().unwrap();
                if (first[0] - last[0]).abs() > 1e-9 || (first[1] - last[1]).abs() > 1e-9 {
                    base.push(first);
                }
            }
            let wc = wc_requested && base.len() >= 3;
            if wc {
                render_watercolor_fill_layers(
                    scene,
                    shape_transform,
                    base,
                    WatercolorProfile::Default,
                    fill_color,
                    roughness,
                    rough_seed,
                );
            }
            let options = Options {
                roughness: Some(roughness),
                bowing: Some(bowing),
                fill: if wc {
                    None
                } else if fill_color[3] > 0.0 {
                    Some(roughr::Srgba::new(fill_color[0], fill_color[1], fill_color[2], fill_color[3]))
                } else {
                    None
                },
                fill_style: if wc { map_fill_style("solid") } else { map_fill_style(&fill_style) },
                hachure_angle: Some(hachure_angle),
                hachure_gap: if hachure_gap > 0.0 { Some(hachure_gap) } else { Some(stroke.as_ref().map(|s| s.width as f32).unwrap_or(1.0) * 4.0) },
                curve_step_count: Some(curve_step_count),
                simplification: Some(simplification),
                stroke: stroke_color.map(|c| roughr::Srgba::new(c[0], c[1], c[2], c[3])),
                stroke_width: stroke.as_ref().map(|s| s.width as f32),
                fill_weight: if fill_weight >= 0.0 { Some(fill_weight) } else { None },
                ..Options::default()
            };
            let pts: Vec<roughr::Point2D<f32, _>> = points.iter().map(|p| roughr::Point2D::new(p[0] as f32, p[1] as f32)).collect();
            let generator = Generator::default();
            let drawable = generator.linear_path(&pts, false, &Some(options));
            render_rough_drawable(
                scene,
                shape_transform,
                &drawable,
                if wc { [0.0, 0.0, 0.0, 0.0] } else { fill_color },
                stroke_color,
            );
            if stroke.is_some()
                && marker_factor > 0.0
                && (marker_enabled(marker_start.as_str())
                    || marker_enabled(marker_end.as_str()))
                && points.len() >= 2
            {
                if let Some(ref s) = stroke {
                    let mut elements = vec![PathEl::MoveTo(Point::new(points[0][0], points[0][1]))];
                    for p in points.iter().skip(1) {
                        elements.push(PathEl::LineTo(Point::new(p[0], p[1])));
                    }
                    let bez_path = BezPath::from_vec(elements);
                    if let Some(((sx, sy), start_angle, (ex, ey), end_angle)) = path_start_end_tangents(&bez_path) {
                        let stroke_color_val = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                        let kurbo_stroke = s.to_kurbo_stroke();
                        let r = s.width * marker_factor as f64;
                        if marker_enabled(marker_start.as_str()) {
                            stroke_marker_path(
                                scene,
                                shape_transform,
                                marker_start.as_str(),
                                sx,
                                sy,
                                start_angle,
                                r,
                                &kurbo_stroke,
                                stroke_color_val,
                            );
                        }
                        if marker_enabled(marker_end.as_str()) {
                            stroke_marker_path(
                                scene,
                                shape_transform,
                                marker_end.as_str(),
                                ex,
                                ey,
                                end_angle + std::f64::consts::PI,
                                r,
                                &kurbo_stroke,
                                stroke_color_val,
                            );
                        }
                    }
                }
            }
        }
        JsShape::RoughPath { d, fill, stroke, opacity, fill_opacity, stroke_opacity, roughness, bowing, fill_style, hachure_angle, hachure_gap, fill_weight, curve_step_count, simplification, marker_start, marker_end, marker_factor, rough_seed, .. } => {
            let fill_color = apply_opacity_to_color(fill, opacity, fill_opacity);
            let stroke_color = stroke.as_ref().map(|s| apply_opacity_to_color(s.color, opacity, stroke_opacity));
            let wc_requested = fill_style_is_watercolor(&fill_style) && fill_color[3] > 0.0;
            let wc_base = wc_requested.then(|| svg_path_first_closed_polygon(d.as_str(), 0.25)).flatten();
            let wc = wc_base.is_some();
            if let Some(ref base) = wc_base {
                render_watercolor_fill_layers(
                    scene,
                    shape_transform,
                    base.clone(),
                    WatercolorProfile::Default,
                    fill_color,
                    roughness,
                    rough_seed,
                );
            }
            let options = Options {
                roughness: Some(roughness),
                bowing: Some(bowing),
                fill: if wc {
                    None
                } else if fill_color[3] > 0.0 {
                    Some(roughr::Srgba::new(fill_color[0], fill_color[1], fill_color[2], fill_color[3]))
                } else {
                    None
                },
                fill_style: if wc { map_fill_style("solid") } else { map_fill_style(&fill_style) },
                hachure_angle: Some(hachure_angle),
                hachure_gap: if hachure_gap > 0.0 { Some(hachure_gap) } else { Some(stroke.as_ref().map(|s| s.width as f32).unwrap_or(1.0) * 4.0) },
                curve_step_count: Some(curve_step_count),
                simplification: Some(simplification),
                stroke: stroke_color.map(|c| roughr::Srgba::new(c[0], c[1], c[2], c[3])),
                stroke_width: stroke.as_ref().map(|s| s.width as f32),
                fill_weight: if fill_weight >= 0.0 { Some(fill_weight) } else { None },
                ..Options::default()
            };
            let generator = Generator::default();
            let drawable = generator.path(d.clone(), &Some(options));
            render_rough_drawable(
                scene,
                shape_transform,
                &drawable,
                if wc { [0.0, 0.0, 0.0, 0.0] } else { fill_color },
                stroke_color,
            );
            if stroke.is_some()
                && marker_factor > 0.0
                && (marker_enabled(marker_start.as_str())
                    || marker_enabled(marker_end.as_str()))
            {
                if let Ok(bez_path) = BezPath::from_svg(d.as_str()) {
                    if let Some(ref s) = stroke {
                        if let Some(((sx, sy), start_angle, (ex, ey), end_angle)) = path_start_end_tangents(&bez_path) {
                            let stroke_color_val = apply_opacity_to_color(s.color, opacity, stroke_opacity);
                            let kurbo_stroke = s.to_kurbo_stroke();
                            let r = s.width * marker_factor as f64;
                            if marker_enabled(marker_start.as_str()) {
                                stroke_marker_path(
                                    scene,
                                    shape_transform,
                                    marker_start.as_str(),
                                    sx,
                                    sy,
                                    start_angle,
                                    r,
                                    &kurbo_stroke,
                                    stroke_color_val,
                                );
                            }
                            if marker_enabled(marker_end.as_str()) {
                                stroke_marker_path(
                                    scene,
                                    shape_transform,
                                    marker_end.as_str(),
                                    ex,
                                    ey,
                                    end_angle + std::f64::consts::PI,
                                    r,
                                    &kurbo_stroke,
                                    stroke_color_val,
                                );
                            }
                        }
                    }
                }
            }
        }
    }
}
