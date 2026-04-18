//! Vector network (Figma-style): cubic segments, closed regions for fill, open chains for stroke.
//! Curve convention matches TS `vector-network-stroke.ts`: P1 = start + tangentStart, P2 = end + tangentEnd.

use vello::kurbo::{BezPath, Point, Rect, Vec2};

const EPS: f64 = 1e-6;
const EPS2: f64 = EPS * EPS;

#[derive(Clone, Debug)]
pub struct VnVertex {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Debug)]
pub struct VnSegment {
    pub start: usize,
    pub end: usize,
    pub tangent_start: [f64; 2],
    pub tangent_end: [f64; 2],
}

#[derive(Clone, Debug)]
pub struct VnRegion {
    /// `true` = evenodd, `false` = nonzero winding.
    pub fill_rule_even_odd: bool,
    pub loops: Vec<Vec<usize>>,
}

#[derive(Clone, Copy)]
struct AdjEntry {
    seg: usize,
    other: usize,
}

fn is_straight(p0: Point, p1: Point, p2: Point, p3: Point) -> bool {
    p0.distance_squared(p1) < EPS2 && p2.distance_squared(p3) < EPS2
}

/// Forward cubic in storage order (start → end).
fn cubic_forward(vertices: &[VnVertex], seg: &VnSegment) -> Option<(Point, Point, Point, Point)> {
    let a = vertices.get(seg.start)?;
    let b = vertices.get(seg.end)?;
    let p0 = Point::new(a.x, a.y);
    let p3 = Point::new(b.x, b.y);
    let p1 = p0 + Vec2::new(seg.tangent_start[0], seg.tangent_start[1]);
    let p2 = p3 + Vec2::new(seg.tangent_end[0], seg.tangent_end[1]);
    Some((p0, p1, p2, p3))
}

/// Oriented cubic along edge from vertex `from` to vertex `to`.
pub fn oriented_cubic(
    vertices: &[VnVertex],
    seg: &VnSegment,
    from: usize,
    to: usize,
) -> Option<(Point, Point, Point, Point)> {
    if seg.start >= vertices.len() || seg.end >= vertices.len() {
        return None;
    }
    let (p0, p1, p2, p3) = cubic_forward(vertices, seg)?;
    if from == seg.start && to == seg.end {
        Some((p0, p1, p2, p3))
    } else if from == seg.end && to == seg.start {
        let q0 = p3;
        let q3 = p0;
        let q1 = Point::new(2.0 * p3.x - p2.x, 2.0 * p3.y - p2.y);
        let q2 = Point::new(2.0 * p0.x - p1.x, 2.0 * p0.y - p1.y);
        Some((q0, q1, q2, q3))
    } else {
        None
    }
}

fn append_cubic_seg(path: &mut BezPath, p0: Point, p1: Point, p2: Point, p3: Point) {
    if is_straight(p0, p1, p2, p3) {
        path.line_to(p3);
    } else {
        path.curve_to(p1, p2, p3);
    }
}

fn bezpath_from_cubic_chain(segs: &[(Point, Point, Point, Point)]) -> BezPath {
    let mut path = BezPath::new();
    if segs.is_empty() {
        return path;
    }
    let (p0, p1, p2, p3) = segs[0];
    path.move_to(p0);
    append_cubic_seg(&mut path, p0, p1, p2, p3);
    let mut prev = p3;
    for &(q0, q1, q2, q3) in &segs[1..] {
        if prev.distance_squared(q0) > EPS2 {
            path.line_to(q0);
        }
        append_cubic_seg(&mut path, q0, q1, q2, q3);
        prev = q3;
    }
    path
}

fn build_adjacency(segments: &[VnSegment], vertex_count: usize) -> Vec<Vec<AdjEntry>> {
    let mut adj = vec![Vec::new(); vertex_count.max(1)];
    for (i, s) in segments.iter().enumerate() {
        if s.start >= vertex_count || s.end >= vertex_count {
            continue;
        }
        adj[s.start].push(AdjEntry {
            seg: i,
            other: s.end,
        });
        adj[s.end].push(AdjEntry {
            seg: i,
            other: s.start,
        });
    }
    adj
}

fn pick_single_unused(v: usize, adj: &[Vec<AdjEntry>], used: &[bool]) -> Option<AdjEntry> {
    let list = adj.get(v)?;
    let mut found: Option<AdjEntry> = None;
    for e in list {
        if used[e.seg] {
            continue;
        }
        if found.is_some() {
            return None;
        }
        found = Some(*e);
    }
    found
}

/// Open stroke subpaths (one per connected chain in the segment graph; branches start new paths).
pub fn stroke_bezpaths(vertices: &[VnVertex], segments: &[VnSegment]) -> Vec<BezPath> {
    let vn = segments.len();
    if vertices.is_empty() || vn == 0 {
        return Vec::new();
    }
    let n = vertices.len();
    let adj = build_adjacency(segments, n);
    let mut used = vec![false; vn];
    let mut out = Vec::new();

    for si in 0..vn {
        if used[si] {
            continue;
        }
        let s = &segments[si];
        if s.start >= n || s.end >= n {
            continue;
        }
        let Some(first) = oriented_cubic(vertices, s, s.start, s.end) else {
            continue;
        };
        let mut cubics: Vec<(Point, Point, Point, Point)> = vec![first];
        used[si] = true;

        let mut current = s.end;
        while let Some(next) = pick_single_unused(current, &adj, &used) {
            let Some(c) = oriented_cubic(vertices, &segments[next.seg], current, next.other) else {
                break;
            };
            cubics.push(c);
            used[next.seg] = true;
            current = next.other;
        }

        current = s.start;
        while let Some(next) = pick_single_unused(current, &adj, &used) {
            let Some(c) = oriented_cubic(vertices, &segments[next.seg], current, next.other) else {
                break;
            };
            cubics.insert(0, c);
            used[next.seg] = true;
            current = next.other;
        }

        let bp = bezpath_from_cubic_chain(&cubics);
        if !bp.elements().is_empty() {
            out.push(bp);
        }
    }
    out
}

fn resolve_loop_orientation(seg: &VnSegment, prev_vertex: Option<usize>) -> (usize, usize) {
    match prev_vertex {
        None => (seg.start, seg.end),
        Some(pv) => {
            if seg.start == pv {
                (seg.start, seg.end)
            } else if seg.end == pv {
                (seg.end, seg.start)
            } else {
                (seg.start, seg.end)
            }
        }
    }
}

fn append_closed_loop(
    path: &mut BezPath,
    vertices: &[VnVertex],
    segments: &[VnSegment],
    loop_idx: &[usize],
) -> bool {
    if loop_idx.is_empty() {
        return false;
    }
    let mut prev_vertex: Option<usize> = None;
    let mut moved = false;

    for seg_i in loop_idx.iter().copied() {
        if seg_i >= segments.len() {
            continue;
        }
        let seg = &segments[seg_i];
        let (from_v, to_v) = resolve_loop_orientation(seg, prev_vertex);
        let Some((p0, p1, p2, p3)) = oriented_cubic(vertices, seg, from_v, to_v) else {
            continue;
        };
        if !moved {
            path.move_to(p0);
            append_cubic_seg(path, p0, p1, p2, p3);
            moved = true;
        } else {
            append_cubic_seg(path, p0, p1, p2, p3);
        }
        prev_vertex = Some(to_v);
    }

    if moved {
        path.close_path();
        true
    } else {
        false
    }
}

/// One compound path for a fill region (multiple `close_path` subpaths).
pub fn region_to_bezpath(
    vertices: &[VnVertex],
    segments: &[VnSegment],
    region: &VnRegion,
) -> Option<BezPath> {
    let mut path = BezPath::new();
    let mut any = false;
    for loop_idx in &region.loops {
        if append_closed_loop(&mut path, vertices, segments, loop_idx) {
            any = true;
        }
    }
    if any {
        Some(path)
    } else {
        None
    }
}

pub fn expand_bounds_with_segments(
    vertices: &[VnVertex],
    segments: &[VnSegment],
    mut min_x: f64,
    mut min_y: f64,
    mut max_x: f64,
    mut max_y: f64,
) -> (f64, f64, f64, f64) {
    let expand = |x: f64, y: f64, nx: &mut f64, ny: &mut f64, xx: &mut f64, xy: &mut f64| {
        if !x.is_finite() || !y.is_finite() {
            return;
        }
        *nx = nx.min(x);
        *ny = ny.min(y);
        *xx = xx.max(x);
        *xy = xy.max(y);
    };

    for seg in segments {
        let Some(a) = vertices.get(seg.start) else { continue };
        let Some(b) = vertices.get(seg.end) else { continue };
        let p0x = a.x;
        let p0y = a.y;
        let p3x = b.x;
        let p3y = b.y;
        let p1x = p0x + seg.tangent_start[0];
        let p1y = p0y + seg.tangent_start[1];
        let p2x = p3x + seg.tangent_end[0];
        let p2y = p3y + seg.tangent_end[1];
        expand(p0x, p0y, &mut min_x, &mut min_y, &mut max_x, &mut max_y);
        expand(p1x, p1y, &mut min_x, &mut min_y, &mut max_x, &mut max_y);
        expand(p2x, p2y, &mut min_x, &mut min_y, &mut max_x, &mut max_y);
        expand(p3x, p3y, &mut min_x, &mut min_y, &mut max_x, &mut max_y);
    }
    (min_x, min_y, max_x, max_y)
}

pub fn geometry_rect(vertices: &[VnVertex], segments: &[VnSegment]) -> Option<Rect> {
    if vertices.is_empty() {
        return None;
    }
    let mut min_x = f64::INFINITY;
    let mut min_y = f64::INFINITY;
    let mut max_x = f64::NEG_INFINITY;
    let mut max_y = f64::NEG_INFINITY;
    for v in vertices {
        if v.x.is_finite() && v.y.is_finite() {
            min_x = min_x.min(v.x);
            min_y = min_y.min(v.y);
            max_x = max_x.max(v.x);
            max_y = max_y.max(v.y);
        }
    }
    if !min_x.is_finite() {
        return None;
    }
    let (min_x, min_y, max_x, max_y) =
        expand_bounds_with_segments(vertices, segments, min_x, min_y, max_x, max_y);
    if min_x > max_x || min_y > max_y {
        return None;
    }
    Some(Rect::new(min_x, min_y, max_x, max_y))
}
