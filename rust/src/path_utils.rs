use vello::kurbo::{BezPath, Cap, Join, PathEl, Point, Rect, Shape, StrokeOpts, Vec2};

use crate::types::{StrokeAlignment, StrokeParams};

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
        let x = mt2 * mt * p0.x + 3.0 * mt2 * t * p1.x + 3.0 * mt * t2 * p2.x + t2 * t * p3.x;
        let y = mt2 * mt * p0.y + 3.0 * mt2 * t * p1.y + 3.0 * mt * t2 * p2.y + t2 * t * p3.y;
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
    if t < 0.0 { t = 0.0; } else if t > 1.0 { t = 1.0; }
    let proj = Point::new(a.x + ab.x * t, a.y + ab.y * t);
    ((p.x - proj.x).powi(2) + (p.y - proj.y).powi(2)).sqrt()
}

fn point_in_polygon_evenodd(p: Point, poly: &[Point]) -> bool {
    if poly.len() < 3 { return false; }
    let mut inside = false;
    let mut j = poly.len() - 1;
    for i in 0..poly.len() {
        let xi = poly[i].x;
        let yi = poly[i].y;
        let xj = poly[j].x;
        let yj = poly[j].y;
        let dy = yj - yi;
        let intersect = (yi > p.y) != (yj > p.y)
            && dy != 0.0
            && (p.x < (xj - xi) * (p.y - yi) / dy + xi);
        if intersect { inside = !inside; }
        j = i;
    }
    inside
}

fn point_in_polygon_nonzero(p: Point, poly: &[Point]) -> bool {
    if poly.len() < 3 { return false; }
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

pub fn is_point_in_path_fill(d: &str, x: f64, y: f64, fill_rule: &str) -> bool {
    let Ok(bez) = BezPath::from_svg(d) else { return false; };
    let subs = flatten_bez_path(&bez, 0.25);
    let p = Point::new(x, y);

    if fill_rule == "evenodd" {
        let mut inside = false;
        for sp in subs.iter() {
            if sp.closed && sp.points.len() >= 3 && point_in_polygon_evenodd(p, &sp.points) {
                inside = !inside;
            }
        }
        inside
    } else {
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
    let blur_expand = (stroke.blur.max(0.0)) * 3.0;
    base * join_factor + blur_expand
}

pub fn is_point_in_path_stroke(d: &str, x: f64, y: f64, stroke: &StrokeParams) -> bool {
    let Ok(bez) = BezPath::from_svg(d) else { return false; };
    let subs = flatten_bez_path(&bez, 0.25);
    let p = Point::new(x, y);

    let cap = cap_from_str(stroke.linecap.as_str());
    let join = join_from_str(stroke.linejoin.as_str());
    let hw = stroke_effective_half_width(stroke);
    if hw <= 0.0 { return false; }

    for sp in subs.iter() {
        if sp.points.len() < 2 { continue; }

        for i in 0..(sp.points.len() - 1) {
            let a = sp.points[i];
            let b = sp.points[i + 1];
            if dist_point_to_segment(p, a, b) <= hw { return true; }
        }
        if sp.closed {
            let a = *sp.points.last().unwrap();
            let b = sp.points[0];
            if dist_point_to_segment(p, a, b) <= hw { return true; }
        }

        if sp.points.len() >= 3 {
            for v in sp.points.iter().skip(1).take(sp.points.len() - 2) {
                let dv = ((p.x - v.x).powi(2) + (p.y - v.y).powi(2)).sqrt();
                let r = match join { Join::Miter => hw, _ => hw };
                if dv <= r { return true; }
            }
        }

        if !sp.closed {
            let p0 = sp.points[0];
            let p1 = sp.points[1];
            let pn = *sp.points.last().unwrap();
            let pn1 = sp.points[sp.points.len() - 2];

            match cap {
                Cap::Round => {
                    let d0 = ((p.x - p0.x).powi(2) + (p.y - p0.y).powi(2)).sqrt();
                    let dn = ((p.x - pn.x).powi(2) + (p.y - pn.y).powi(2)).sqrt();
                    if d0 <= hw || dn <= hw { return true; }
                }
                Cap::Square => {
                    let dir0 = Vec2::new(p0.x - p1.x, p0.y - p1.y);
                    let dirn = Vec2::new(pn.x - pn1.x, pn.y - pn1.y);
                    let square_cap_hit = |end: Point, dir: Vec2| -> bool {
                        let len = (dir.x * dir.x + dir.y * dir.y).sqrt();
                        if len == 0.0 { return false; }
                        let ux = dir.x / len;
                        let uy = dir.y / len;
                        let dx = p.x - end.x;
                        let dy = p.y - end.y;
                        let t = dx * ux + dy * uy;
                        let n = (-uy) * dx + ux * dy;
                        t >= 0.0 && t <= hw && n.abs() <= hw
                    };
                    if square_cap_hit(p0, dir0) || square_cap_hit(pn, dirn) { return true; }
                }
                _ => {}
            }
        }
    }
    false
}

pub fn path_start_end_tangents(path: &BezPath) -> Option<((f64, f64), f64, (f64, f64), f64)> {
    let el = path.elements();
    if el.is_empty() { return None; }
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
                if start_angle.is_none() { start_angle = Some(a); }
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
                if dxe != 0.0 || dye != 0.0 { end_angle = Some(dye.atan2(dxe)); }
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
                if dxe != 0.0 || dye != 0.0 { end_angle = Some(dye.atan2(dxe)); }
                end_pt = (p3.x, p3.y);
                current = p3;
            }
            PathEl::MoveTo(p) => {
                subpath_start = p;
                current = p;
                end_pt = (p.x, p.y);
                end_angle = None;
            }
            PathEl::ClosePath => {
                let dx = subpath_start.x - current.x;
                let dy = subpath_start.y - current.y;
                if dx != 0.0 || dy != 0.0 { end_angle = Some(dy.atan2(dx)); }
                end_pt = (subpath_start.x, subpath_start.y);
                current = subpath_start;
            }
        }
    }
    let start_a = start_angle?;
    let end_a = end_angle?;
    Some((start_pt, start_a, end_pt, end_a))
}

pub fn path_render_bounds(
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
        if marker_factor > 0.0 && (marker_start == "line" || marker_end == "line") {
            if let Some(((sx, sy), _start_angle, (ex, ey), _end_angle)) = path_start_end_tangents(&bez) {
                let r = s.width * marker_factor as f64;
                let expand_marker = |rect: Rect, px: f64, py: f64| {
                    rect.union(Rect::new(px - r, py - r, px + r, py + r))
                };
                if marker_start == "line" { result = expand_marker(result, sx, sy); }
                if marker_end == "line" { result = expand_marker(result, ex, ey); }
            }
        }
    }

    Some(result)
}
