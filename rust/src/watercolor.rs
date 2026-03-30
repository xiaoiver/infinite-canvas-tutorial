//! Port of [@watercolorizer/watercolorizer] for Vello — matches ECS `watercolor-rough.ts` options.
//!
//! [watercolorizer]: https://github.com/32bitkid/watercolorizer

/// Per-layer alpha factor (same as `WATERCOLOR_LAYER_FILL_OPACITY` in TS).
pub const WATERCOLOR_LAYER_FILL_OPACITY: f64 = 0.1;

const K_GAUSS_BLUR_5: [f64; 5] = [1.0, 4.0, 6.0, 4.0, 1.0];
const GAUSS_DIV: f64 = 16.0;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WatercolorProfile {
    Default,
    /// Axis-aligned rect: tighter evolution counts + higher weight floor.
    Rect,
}

#[derive(Clone, Debug)]
pub struct WatercolorParams {
    pub pre_evolutions: u32,
    pub evolutions: u32,
    pub layers_per_evolution: u32,
    pub layer_evolutions: u32,
    pub vertex_weights: Vec<f64>,
}

pub fn watercolor_params(
    polygon_len: usize,
    roughness: f32,
    profile: WatercolorProfile,
    seed: i32,
) -> WatercolorParams {
    let rough_scale = (roughness.clamp(0.0, 10.0) / 10.0) as f64;
    let s = to_seed_u32(seed);
    let weight_seed = s ^ 0x9e3779b9;
    let base_floor = 0.05 + 0.1 * (1.0 - rough_scale);
    let floor = match profile {
        WatercolorProfile::Rect => (base_floor + 0.06).min(0.22),
        WatercolorProfile::Default => base_floor,
    };
    let vertex_weights = seeded_random_weights(polygon_len, weight_seed, floor);
    let (pre, evo, lpe, le) = match profile {
        WatercolorProfile::Rect => (3, 2, 3, 2),
        WatercolorProfile::Default => (4, 2, 4, 2),
    };
    WatercolorParams {
        pre_evolutions: pre,
        evolutions: evo,
        layers_per_evolution: lpe,
        layer_evolutions: le,
        vertex_weights,
    }
}

fn to_seed_u32(seed: i32) -> u32 {
    if seed <= 0 {
        1
    } else {
        seed as u32
    }
}

/// Mulberry32 — same as TS `mulberry32`.
pub struct Mulberry32(u32);

impl Mulberry32 {
    pub fn new(seed: u32) -> Self {
        Self(seed.max(1))
    }

    pub fn next_f64(&mut self) -> f64 {
        self.0 = self.0.wrapping_add(0x6d2b79f5);
        let mut t = self.0;
        let mut r = (t ^ (t >> 15)).wrapping_mul(t | 1);
        r ^= r.wrapping_add(r.wrapping_mul(r ^ (r >> 7)).wrapping_mul(r | 61));
        ((r ^ (r >> 14)) as f64) / 4294967296.0
    }
}

fn gaussian(rand: &mut impl FnMut() -> f64, mu: f64, sigma: f64) -> f64 {
    let u = 1.0 - rand();
    let v = rand();
    let z = (-2.0 * u.ln()).sqrt() * (std::f64::consts::TAU * v).cos();
    z * sigma + mu
}

fn conv1d_wrap_gauss5(src: &[f64]) -> Vec<f64> {
    let n = src.len();
    if n == 0 {
        return vec![];
    }
    let k = K_GAUSS_BLUR_5.len();
    let k2 = k / 2;
    let mut out = vec![0.0; n];
    for j in 0..n {
        let mut sum = 0.0;
        for t in 0..k {
            let jn = j as isize + t as isize - k2 as isize;
            let idx = (jn.rem_euclid(n as isize)) as usize;
            sum += src[idx] * K_GAUSS_BLUR_5[t];
        }
        out[j] = sum / GAUSS_DIV;
    }
    out
}

fn seeded_random_weights(len: usize, seed: u32, floor: f64) -> Vec<f64> {
    if len == 0 {
        return vec![];
    }
    let mut rng = Mulberry32::new(seed);
    let mut initial: Vec<f64> = (0..len).map(|_| rng.next_f64()).collect();
    let smoothed = conv1d_wrap_gauss5(&initial);
    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    for &x in &smoothed {
        min = min.min(x);
        max = max.max(x);
    }
    let span = max - min;
    if span <= 1e-12 {
        return vec![1.0; len];
    }
    smoothed
        .into_iter()
        .map(|x| (x - min) / span)
        .map(|x| x * (1.0 - floor) + floor)
        .collect()
}

fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a * (1.0 - t) + b * t
}

fn clamp(min: f64, max: f64, v: f64) -> f64 {
    v.max(min).min(max)
}

fn vsub(a: [f64; 2], b: [f64; 2]) -> [f64; 2] {
    [a[0] - b[0], a[1] - b[1]]
}

fn vadd(a: [f64; 2], b: [f64; 2]) -> [f64; 2] {
    [a[0] + b[0], a[1] + b[1]]
}

fn vscale(a: [f64; 2], s: f64) -> [f64; 2] {
    [a[0] * s, a[1] * s]
}

fn vlen(a: [f64; 2]) -> f64 {
    (a[0] * a[0] + a[1] * a[1]).sqrt()
}

fn vnorm(mut a: [f64; 2]) -> [f64; 2] {
    let l = vlen(a);
    if l <= 1e-15 {
        return [0.0, 0.0];
    }
    a[0] /= l;
    a[1] /= l;
    a
}

fn vlerp(a: [f64; 2], b: [f64; 2], t: f64) -> [f64; 2] {
    [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
}

fn vrotate(v: [f64; 2], rad: f64) -> [f64; 2] {
    let c = rad.cos();
    let s = rad.sin();
    [v[0] * c - v[1] * s, v[0] * s + v[1] * c]
}

fn dist(a: [f64; 2], b: [f64; 2]) -> f64 {
    vlen(vsub(b, a))
}

#[derive(Clone, Copy)]
enum Winding {
    Cw,
    Ccw,
}

fn winding_order_of(points: &[[f64; 2]]) -> Winding {
    let mut sum = 0.0;
    let n = points.len();
    for i in 0..n {
        let j = (i + 1) % n;
        let x0 = points[i][0];
        let y0 = points[i][1];
        let x1 = points[j][0];
        let y1 = points[j][1];
        sum += (x1 - x0) * (y1 + y0);
    }
    if sum >= 0.0 {
        Winding::Cw
    } else {
        Winding::Ccw
    }
}

type PointsAndWeights = (Vec<[f64; 2]>, Vec<f64>);

fn distort_polygon(
    prev: &PointsAndWeights,
    winding: Winding,
    rand: &mut impl FnMut() -> f64,
) -> PointsAndWeights {
    let (points, weights) = prev;
    let n = points.len();
    let edge_tangent = match winding {
        Winding::Cw => std::f64::consts::FRAC_PI_2,
        Winding::Ccw => -std::f64::consts::FRAC_PI_2,
    };

    let mut mid_points: Vec<[f64; 2]> = Vec::with_capacity(n);
    let mut mid_weights: Vec<f64> = Vec::with_capacity(n);

    for i in 0..n {
        let i1 = (i + 1) % n;
        let a = points[i];
        let b = points[i1];
        let w0 = weights.get(i).copied().unwrap_or(1.0);
        let w1 = weights.get(i1).copied().unwrap_or(1.0);
        let len = dist(a, b);
        let mid_t = clamp(
            0.001,
            0.999,
            gaussian(rand, 0.5, 0.4 / 3.0),
        );
        let mid_pt = vlerp(a, b, mid_t);
        let w_mid = lerp(w0, w1, mid_t);

        let mut tan = vnorm(vsub(b, a));
        let theta = edge_tangent + gaussian(rand, 0.0, std::f64::consts::PI / 12.0);
        tan = vrotate(tan, theta);
        let scale = gaussian(rand, 0.0, len / 3.0);
        let s2 = if scale < 0.0 {
            scale / 5.0
        } else {
            scale
        };
        let magnitude = s2 * w_mid;
        let off = vscale(tan, magnitude);
        mid_points.push(vadd(mid_pt, off));
        mid_weights.push(w_mid);
    }

    let wiggled = wiggle_polygon(points, weights, rand);

    let mut next_points: Vec<[f64; 2]> = Vec::with_capacity(n * 2);
    for i in 0..n {
        next_points.push(wiggled[i]);
        next_points.push(mid_points[i]);
    }

    let mut next_weights: Vec<f64> = Vec::with_capacity(n * 2);
    for i in 0..n {
        next_weights.push(weights[i]);
        next_weights.push(mid_weights[i]);
    }

    (next_points, next_weights)
}

fn wiggle_polygon(
    points: &[[f64; 2]],
    weights: &[f64],
    rand: &mut impl FnMut() -> f64,
) -> Vec<[f64; 2]> {
    let n = points.len();
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let prev = (i + n - 1) % n;
        let next = (i + 1) % n;
        let a = points[prev];
        let b = points[i];
        let c = points[next];
        let ab = vsub(b, a);
        let cb = vsub(b, c);
        let mut dir = vadd(ab, cb);
        if vlen(dir) <= 1e-15 {
            out.push(b);
            continue;
        }
        dir = vnorm(dir);
        dir = vrotate(dir, gaussian(rand, 0.0, 0.5));
        let w = weights.get(i).copied().unwrap_or(1.0);
        let arc_dist = (vlen(ab) + vlen(cb)) / 2.0 / 3.0;
        let d = gaussian(rand, 0.0, arc_dist / 3.0).abs() * w;
        out.push(vadd(b, vscale(dir, d)));
    }
    out
}

fn rdp(points: &[[f64; 2]], epsilon: f64) -> Vec<[f64; 2]> {
    if points.len() <= 2 {
        return points.to_vec();
    }
    let mut dmax = 0.0;
    let mut idx = 0usize;
    let end = points.len() - 1;
    for i in 1..end {
        let d = point_line_dist(points[i], points[0], points[end]);
        if d > dmax {
            idx = i;
            dmax = d;
        }
    }
    if dmax > epsilon {
        let mut rec1 = rdp(&points[..=idx], epsilon);
        let rec2 = rdp(&points[idx..], epsilon);
        rec1.pop();
        rec1.extend(rec2);
        rec1
    } else {
        vec![points[0], points[end]]
    }
}

fn point_line_dist(p: [f64; 2], a: [f64; 2], b: [f64; 2]) -> f64 {
    let ab = vsub(b, a);
    let ap = vsub(p, a);
    let denom = ab[0] * ab[0] + ab[1] * ab[1];
    if denom <= 1e-18 {
        return dist(p, a);
    }
    let mut t = (ap[0] * ab[0] + ap[1] * ab[1]) / denom;
    t = clamp(0.0, 1.0, t);
    let proj = [a[0] + ab[0] * t, a[1] + ab[1] * t];
    dist(p, proj)
}

/// Same as TS `watercolorize` + per-layer `simplify(..., 1)`.
pub fn watercolor_layers(mut points: Vec<[f64; 2]>, params: &WatercolorParams, seed: i32) -> Vec<Vec<[f64; 2]>> {
    normalize_polygon(&mut points);
    if points.len() < 3 {
        return vec![];
    }
    let winding = winding_order_of(&points);
    let mut rng = Mulberry32::new(to_seed_u32(seed));

    let mut prev: PointsAndWeights = (points, params.vertex_weights.clone());

    for _ in 0..params.pre_evolutions {
        prev = distort_polygon(&prev, winding, &mut || rng.next_f64());
    }

    let mut layers_out: Vec<Vec<[f64; 2]>> = Vec::new();

    for _ in 0..params.evolutions {
        for _ in 0..params.layers_per_evolution {
            let mut acc = distort_polygon(&prev, winding, &mut || rng.next_f64());
            for _ in 0..params.layer_evolutions {
                acc = distort_polygon(&acc, winding, &mut || rng.next_f64());
            }
            let layer_pts = acc.0;
            let mut closed: Vec<[f64; 2]> = layer_pts.clone();
            if !closed.is_empty() {
                closed.push(closed[0]);
            }
            let simp = rdp(&closed, 1.0);
            let mut layer = simp;
            if layer.len() > 1 && layer[0] == *layer.last().unwrap() {
                layer.pop();
            }
            if layer.len() >= 3 {
                layers_out.push(layer);
            }
        }
        prev = distort_polygon(&prev, winding, &mut || rng.next_f64());
    }

    layers_out
}

/// Deduplicate consecutive points and closing duplicate.
pub fn normalize_polygon(points: &mut Vec<[f64; 2]>) {
    if points.is_empty() {
        return;
    }
    const EPS: f64 = 1e-6;
    let mut deduped: Vec<[f64; 2]> = vec![points[0]];
    for i in 1..points.len() {
        let p = points[i];
        let last = deduped[deduped.len() - 1];
        if (p[0] - last[0]).abs() > EPS || (p[1] - last[1]).abs() > EPS {
            deduped.push(p);
        }
    }
    if deduped.len() >= 2 {
        let a = deduped[0];
        let b = deduped[deduped.len() - 1];
        if (a[0] - b[0]).abs() <= EPS && (a[1] - b[1]).abs() <= EPS {
            deduped.pop();
        }
    }
    *points = deduped;
}

pub fn subdivide_axis_aligned_rect(width: f64, height: f64, divisions: usize) -> Vec<[f64; 2]> {
    let n = divisions.max(2);
    let mut out = Vec::new();
    for i in 0..n {
        out.push([(width * i as f64) / n as f64, 0.0]);
    }
    for i in 1..n {
        out.push([width, (height * i as f64) / n as f64]);
    }
    for i in 1..n {
        out.push([(width * (n - i) as f64) / n as f64, height]);
    }
    for i in 1..n {
        out.push([0.0, (height * (n - i) as f64) / n as f64]);
    }
    out
}

pub fn sample_ellipse(cx: f64, cy: f64, rx: f64, ry: f64, segments: usize) -> Vec<[f64; 2]> {
    let mut pts = Vec::with_capacity(segments);
    for i in 0..segments {
        let t = (i as f64 / segments as f64) * std::f64::consts::TAU;
        pts.push([cx + rx * t.cos(), cy + ry * t.sin()]);
    }
    pts
}
