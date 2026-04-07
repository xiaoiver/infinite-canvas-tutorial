//! Analytic signed distance helpers for filled [`crate::types::JsShape::Rect`] / [`crate::types::JsShape::Ellipse`]
//! and stroked [`crate::types::JsShape::Line`] / [`crate::types::JsShape::Polyline`] (segment union + half-width),
//! aligned with `packages/core/src/shaders/sdf.ts` (`sdf_circle` / `sdf_ellipse` / `sdf_rounded_box`).
//! Inside the shape is **negative**, outside **positive**.

use std::collections::HashMap;

use vello::kurbo::{Affine, Point};

use crate::types::{JsShape, StrokeAlignment};

const EPS: f64 = 1e-18;

/// Fill region used for distance queries (matches Vello fill geometry in `add_js_shape_to_scene`).
#[derive(Clone, Debug, PartialEq)]
pub enum FillSdfPrimitive {
    RoundedRect {
        x0: f64,
        y0: f64,
        x1: f64,
        y1: f64,
        corner_r: f64,
    },
    Ellipse {
        cx: f64,
        cy: f64,
        rx: f64,
        ry: f64,
    },
    /// 线段 `(x0,y0)-(x1,y1)` 的笔画区域：`sdSegment` 无符号距离 − `half_width`（内负外正）。
    Segment {
        x0: f64,
        y0: f64,
        x1: f64,
        y1: f64,
        half_width: f64,
    },
    /// 折线笔画：各相邻顶点对的线段 SDF 取 `min`（与多段 `Line` 并集一致）。
    PolylineStroke {
        points: Vec<[f64; 2]>,
        half_width: f64,
    },
}

/// `length(p) - r` — matches `sdf_circle` in sdf.ts.
#[inline]
fn point_len(p: Point) -> f64 {
    (p.x * p.x + p.y * p.y).sqrt()
}

#[inline]
pub fn sdf_circle(p: Point, r: f64) -> f64 {
    point_len(p) - r
}

/// Ellipse centered at origin, semi-axes `rx`, `ry` — matches `sdf_ellipse` in sdf.ts.
#[inline]
pub fn sdf_ellipse(p: Point, rx: f64, ry: f64) -> f64 {
    if rx.abs() < EPS || ry.abs() < EPS {
        return f64::MAX;
    }
    // Circle fast path (stable at center).
    if (rx - ry).abs() < 1e-12 * rx.max(ry).max(1.0) {
        return sdf_circle(p, 0.5 * (rx + ry));
    }
    let k0 = ((p.x / rx).powi(2) + (p.y / ry).powi(2)).sqrt();
    let k1 = ((p.x / (rx * rx)).powi(2) + (p.y / (ry * ry)).powi(2)).sqrt();
    if k1 < EPS {
        // Limit at center: signed distance ≈ -min(rx, ry).
        return -rx.min(ry);
    }
    k0 * (k0 - 1.0) / k1
}

/// Axis-aligned rounded box: `p` relative to **center**, `half` = half-extents, `r` corner radius.
/// Matches `sdf_rounded_box` in sdf.ts.
#[inline]
pub fn sdf_rounded_box(p: Point, half: Point, r: f64) -> f64 {
    let hw = half.x.abs();
    let hh = half.y.abs();
    let r = r.min(hw).min(hh).max(0.0);
    let q = Point::new(p.x.abs() - hw + r, p.y.abs() - hh + r);
    q.x.max(q.y).min(0.0) + point_len(Point::new(q.x.max(0.0), q.y.max(0.0))) - r
}

/// 无符号距离到线段 `a`–`b`（与 IQ `sdSegment` 一致）。
#[inline]
pub fn sdf_segment_unsigned(p: Point, a: Point, b: Point) -> f64 {
    let pa = Point::new(p.x - a.x, p.y - a.y);
    let ba = Point::new(b.x - a.x, b.y - a.y);
    let ba_len_sq = ba.x * ba.x + ba.y * ba.y;
    if ba_len_sq < EPS {
        return f64::hypot(p.x - a.x, p.y - a.y);
    }
    let h = ((pa.x * ba.x + pa.y * ba.y) / ba_len_sq).clamp(0.0, 1.0);
    let hx = pa.x - ba.x * h;
    let hy = pa.y - ba.y * h;
    (hx * hx + hy * hy).sqrt()
}

/// Distance in shape **local** space (same coordinates as `JsShape` fields).
pub fn sdf_fill_primitive_local(p: Point, prim: &FillSdfPrimitive) -> f64 {
    match prim {
        FillSdfPrimitive::RoundedRect {
            x0,
            y0,
            x1,
            y1,
            corner_r,
        } => {
            let cx = 0.5 * (x0 + x1);
            let cy = 0.5 * (y0 + y1);
            let hw = 0.5 * (x1 - x0).abs();
            let hh = 0.5 * (y1 - y0).abs();
            let p_rel = Point::new(p.x - cx, p.y - cy);
            sdf_rounded_box(p_rel, Point::new(hw, hh), *corner_r)
        }
        FillSdfPrimitive::Ellipse { cx, cy, rx, ry } => {
            sdf_ellipse(Point::new(p.x - cx, p.y - cy), *rx, *ry)
        }
        FillSdfPrimitive::Segment {
            x0,
            y0,
            x1,
            y1,
            half_width,
        } => {
            let a = Point::new(*x0, *y0);
            let b = Point::new(*x1, *y1);
            sdf_segment_unsigned(p, a, b) - half_width
        }
        FillSdfPrimitive::PolylineStroke { points, half_width } => {
            if points.len() < 2 {
                return f64::MAX;
            }
            let mut m = f64::MAX;
            for w in points.windows(2) {
                let a = Point::new(w[0][0], w[0][1]);
                let b = Point::new(w[1][0], w[1][1]);
                let d = sdf_segment_unsigned(p, a, b) - half_width;
                m = m.min(d);
            }
            m
        }
    }
}

/// `p_canvas`: point in the same space as Vello’s `shape_transform * local`.
pub fn sdf_fill_primitive_canvas(
    p_canvas: Point,
    canvas_transform: Affine,
    world: Affine,
    prim: &FillSdfPrimitive,
) -> f64 {
    let shape_affine = canvas_transform * world;
    let inv = shape_affine.inverse();
    let p_local = inv * p_canvas;
    sdf_fill_primitive_local(p_local, prim)
}

fn canvas_scale(canvas_transform: Affine, dpr: f64) -> f64 {
    let det = canvas_transform.determinant();
    (det.abs().sqrt() / dpr).max(1e-6)
}

/// Builds the same fill region as [`crate::scene::add_js_shape_to_scene`] (fill only; stroke ring ignored).
pub fn fill_sdf_primitive_from_js_shape(
    shape: &JsShape,
    canvas_transform: Affine,
    dpr: f64,
) -> Option<FillSdfPrimitive> {
    let scale = canvas_scale(canvas_transform, dpr);
    match shape {
        JsShape::Rect {
            x,
            y,
            width,
            height,
            radius,
            stroke,
            size_attenuation,
            stroke_attenuation,
            ..
        } => {
            let (w, h, r) = if *size_attenuation {
                (width / scale, height / scale, radius / scale)
            } else {
                (*width, *height, *radius)
            };
            let (x0, y0, x1, y1) = (
                x.min(x + w),
                y.min(y + h),
                x.max(x + w),
                y.max(y + h),
            );
            let stroke_config = stroke.as_ref().map(|s| {
                let width = if *stroke_attenuation {
                    s.width / scale
                } else {
                    s.width
                };
                (width, &s.alignment)
            });
            let (x0, y0, x1, y1, corner_r) = if let Some((sw, alignment)) = stroke_config {
                match alignment {
                    StrokeAlignment::Inner => (
                        x0 + sw,
                        y0 + sw,
                        x1 - sw,
                        y1 - sw,
                        (r - sw).max(0.0),
                    ),
                    StrokeAlignment::Outer | StrokeAlignment::Center => (x0, y0, x1, y1, r),
                }
            } else {
                (x0, y0, x1, y1, r)
            };
            Some(FillSdfPrimitive::RoundedRect {
                x0,
                y0,
                x1,
                y1,
                corner_r,
            })
        }
        JsShape::Ellipse {
            cx,
            cy,
            rx,
            ry,
            stroke,
            size_attenuation,
            stroke_attenuation,
            ..
        } => {
            let (rx_eff, ry_eff) = if *size_attenuation {
                (rx / scale, ry / scale)
            } else {
                (*rx, *ry)
            };
            let stroke_config = stroke.as_ref().map(|s| {
                let width = if *stroke_attenuation {
                    s.width / scale
                } else {
                    s.width
                };
                (width, &s.alignment)
            });
            let (rx, ry) = if let Some((sw, alignment)) = stroke_config {
                match alignment {
                    StrokeAlignment::Inner => (
                        (rx_eff - sw).max(0.0),
                        (ry_eff - sw).max(0.0),
                    ),
                    StrokeAlignment::Outer | StrokeAlignment::Center => (rx_eff, ry_eff),
                }
            } else {
                (rx_eff, ry_eff)
            };
            Some(FillSdfPrimitive::Ellipse {
                cx: *cx,
                cy: *cy,
                rx,
                ry,
            })
        }
        JsShape::Line {
            x1,
            y1,
            x2,
            y2,
            stroke,
            size_attenuation,
            stroke_attenuation,
            ..
        } => {
            let (x0, y0, x1e, y1e) = if *size_attenuation {
                (x1 / scale, y1 / scale, x2 / scale, y2 / scale)
            } else {
                (*x1, *y1, *x2, *y2)
            };
            let sw = if *stroke_attenuation {
                stroke.width / scale
            } else {
                stroke.width
            };
            // 笔画有厚度；宽度过小时仍给最小半宽，避免 GI 仅落在零测集上。
            let half_w = (sw * 0.5).max(0.25);
            Some(FillSdfPrimitive::Segment {
                x0,
                y0,
                x1: x1e,
                y1: y1e,
                half_width: half_w,
            })
        }
        JsShape::Polyline {
            points,
            stroke,
            size_attenuation,
            stroke_attenuation,
            ..
        } => {
            let stroke = stroke.as_ref()?;
            if points.len() < 2 {
                return None;
            }
            let pts: Vec<[f64; 2]> = if *size_attenuation {
                points.iter().map(|[x, y]| [x / scale, y / scale]).collect()
            } else {
                points.clone()
            };
            let sw = if *stroke_attenuation {
                stroke.width / scale
            } else {
                stroke.width
            };
            let half_w = (sw * 0.5).max(0.25);
            Some(FillSdfPrimitive::PolylineStroke {
                points: pts,
                half_width: half_w,
            })
        }
        _ => None,
    }
}

/// Union of filled primitives: `min` of per-shape distances. Skips shapes without SDF (`fill_sdf_primitive_from_js_shape` none).
pub fn min_scene_sdf_distance(
    p_canvas: Point,
    canvas_transform: Affine,
    dpr: f64,
    shapes: &[JsShape],
    world_transforms: &HashMap<String, Affine>,
) -> Option<f64> {
    let mut best: Option<f64> = None;
    for shape in shapes {
        let Some(prim) = fill_sdf_primitive_from_js_shape(shape, canvas_transform, dpr) else {
            continue;
        };
        let id = match shape {
            JsShape::Rect { id, .. }
            | JsShape::Ellipse { id, .. }
            | JsShape::Line { id, .. }
            | JsShape::Polyline { id, .. } => id.as_str(),
            _ => continue,
        };
        let origin = match shape {
            JsShape::Rect { x, y, .. } => Point::new(*x, *y),
            JsShape::Ellipse { cx, cy, .. } => Point::new(*cx, *cy),
            JsShape::Line { x1, y1, .. } => Point::new(*x1, *y1),
            JsShape::Polyline { points, .. } => {
                if points.is_empty() {
                    Point::ORIGIN
                } else {
                    Point::new(points[0][0], points[0][1])
                }
            }
            _ => Point::ORIGIN,
        };
        let world = world_transforms
            .get(id)
            .copied()
            .unwrap_or_else(|| Affine::translate(origin.to_vec2()));
        let d = sdf_fill_primitive_canvas(p_canvas, canvas_transform, world, &prim);
        best = Some(best.map_or(d, |b| b.min(d)));
    }
    best
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{JsShape, StrokeAlignment, StrokeParams};

    fn stroke_w4() -> StrokeParams {
        StrokeParams {
            width: 4.0,
            color: [0.0, 0.0, 0.0, 1.0],
            linecap: "round".into(),
            linejoin: "round".into(),
            miter_limit: 4.0,
            stroke_dasharray: None,
            stroke_dashoffset: 0.0,
            alignment: StrokeAlignment::Center,
            blur: 0.0,
        }
    }

    #[test]
    fn circle_center_inside() {
        let p = Point::new(0.0, 0.0);
        assert!(sdf_circle(p, 10.0) < 0.0);
        assert!((sdf_circle(p, 10.0) - (-10.0)).abs() < 1e-9);
    }

    #[test]
    fn circle_far_outside() {
        let p = Point::new(100.0, 0.0);
        let d = sdf_circle(p, 10.0);
        assert!(d > 0.0);
        assert!((d - 90.0).abs() < 1e-9);
    }

    #[test]
    fn ellipse_center_inside() {
        let d = sdf_ellipse(Point::ORIGIN, 10.0, 5.0);
        assert!(d < 0.0);
        assert!((d + 5.0).abs() < 1e-5);
    }

    #[test]
    fn ellipse_outside_along_x() {
        let d = sdf_ellipse(Point::new(25.0, 0.0), 10.0, 5.0);
        assert!(d > 0.0);
    }

    #[test]
    fn rounded_rect_center_inside() {
        let d = sdf_rounded_box(Point::ORIGIN, Point::new(50.0, 40.0), 4.0);
        assert!(d < 0.0);
    }

    #[test]
    fn rounded_rect_far_outside() {
        let d = sdf_rounded_box(Point::new(200.0, 0.0), Point::new(50.0, 40.0), 4.0);
        assert!(d > 0.0);
    }

    #[test]
    fn fill_primitive_rect_local_matches_rounded_box() {
        let prim = FillSdfPrimitive::RoundedRect {
            x0: 0.0,
            y0: 0.0,
            x1: 100.0,
            y1: 80.0,
            corner_r: 8.0,
        };
        let c = Point::new(50.0, 40.0);
        assert!(sdf_fill_primitive_local(c, &prim) < 0.0);
        let d = sdf_fill_primitive_local(Point::new(500.0, 40.0), &prim);
        assert!(d > 100.0);
    }

    #[test]
    fn segment_stroke_signed_distance() {
        let prim = FillSdfPrimitive::Segment {
            x0: 0.0,
            y0: 0.0,
            x1: 10.0,
            y1: 0.0,
            half_width: 2.0,
        };
        // 中心线上方、笔画内
        assert!(sdf_fill_primitive_local(Point::new(5.0, 0.0), &prim) < 0.0);
        // 远离线段
        assert!(sdf_fill_primitive_local(Point::new(5.0, 5.0), &prim) > 0.0);
    }

    #[test]
    fn polyline_stroke_is_min_of_segments() {
        let prim = FillSdfPrimitive::PolylineStroke {
            points: vec![[0.0, 0.0], [10.0, 0.0], [10.0, 10.0]],
            half_width: 2.0,
        };
        assert!(sdf_fill_primitive_local(Point::new(5.0, 0.0), &prim) < 0.0);
        assert!(sdf_fill_primitive_local(Point::new(10.0, 5.0), &prim) < 0.0);
        assert!(sdf_fill_primitive_local(Point::new(10.0, 0.0), &prim) < 0.0);
        assert!(sdf_fill_primitive_local(Point::new(50.0, 50.0), &prim) > 0.0);
    }

    #[test]
    fn min_scene_polyline_matches_union() {
        let pl = JsShape::Polyline {
            id: "p".into(),
            parent_id: None,
            z_index: 0.0,
            ui: false,
            points: vec![[0.0, 0.0], [10.0, 0.0], [10.0, 10.0]],
            stroke: Some(stroke_w4()),
            opacity: 1.0,
            fill_opacity: 1.0,
            stroke_opacity: 1.0,
            local_transform: None,
            size_attenuation: false,
            stroke_attenuation: false,
            marker_start: String::new(),
            marker_end: String::new(),
            marker_factor: 1.0,
        };
        let shapes = vec![pl];
        let mut map = HashMap::new();
        map.insert("p".into(), Affine::IDENTITY);
        let m = min_scene_sdf_distance(Point::new(5.0, 0.0), Affine::IDENTITY, 1.0, &shapes, &map);
        assert!(m.is_some() && m.unwrap() < 0.0);
    }

    #[test]
    fn min_scene_two_rects() {
        let a = JsShape::Rect {
            id: "a".into(),
            parent_id: None,
            z_index: 0.0,
            ui: false,
            x: 0.0,
            y: 0.0,
            width: 10.0,
            height: 10.0,
            radius: 0.0,
            fill: [1.0, 0.0, 0.0, 1.0],
            fill_gradients: None,
            stroke: None,
            opacity: 1.0,
            fill_opacity: 1.0,
            stroke_opacity: 1.0,
            local_transform: None,
            size_attenuation: false,
            stroke_attenuation: false,
            fill_blur: 0.0,
            drop_shadow: None,
        };
        let b = JsShape::Rect {
            id: "b".into(),
            parent_id: None,
            z_index: 1.0,
            ui: false,
            x: 100.0,
            y: 0.0,
            width: 10.0,
            height: 10.0,
            radius: 0.0,
            fill: [0.0, 1.0, 0.0, 1.0],
            fill_gradients: None,
            stroke: None,
            opacity: 1.0,
            fill_opacity: 1.0,
            stroke_opacity: 1.0,
            local_transform: None,
            size_attenuation: false,
            stroke_attenuation: false,
            fill_blur: 0.0,
            drop_shadow: None,
        };
        let shapes = vec![a, b];
        let mut map = HashMap::new();
        map.insert("a".into(), Affine::IDENTITY);
        map.insert("b".into(), Affine::IDENTITY);
        let p = Point::new(5.0, 5.0);
        let m = min_scene_sdf_distance(p, Affine::IDENTITY, 1.0, &shapes, &map).unwrap();
        assert!(m < 0.0);
        let p_far = Point::new(50.0, 5.0);
        let m2 = min_scene_sdf_distance(p_far, Affine::IDENTITY, 1.0, &shapes, &map).unwrap();
        assert!(m2 > 0.0);
    }
}
