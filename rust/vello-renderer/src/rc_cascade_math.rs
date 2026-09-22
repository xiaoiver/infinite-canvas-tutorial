//! 与 [bevy_radiance_cascades](https://github.com/nixonyh/bevy_radiance_cascades) 中 `RadianceCascadesConfig` / `Probe` 对齐的 Rust 参数与级联数估计。

/// 与 Bevy `RadianceCascadesConfig::resolution_factor` 一致（cascade0 方向数为 `4^resolution_factor` 量级）。
pub const RC_RESOLUTION_FACTOR: u32 = 1;
/// Cascade0 区间长度（全分辨率像素）；与 Bevy `interval0` 一致。
pub const RC_INTERVAL0: f32 = 2.0;
/// 单帧最多级联数（与 bevy_radiance_cascades `MAX_CASCADE_COUNT` 一致）。
pub const RC_MAX_CASCADES: usize = 16;

/// 对应 `assets/shaders/radiance_probe.wgsl` 中的 `Probe`（std140 对齐由 uniform 打包保证）。
#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct Probe {
    pub width: u32,
    pub start: f32,
    pub range: f32,
}

/// `resolution_factor` 对应 Bevy 插件的 `RadianceCascadesConfig::resolution_factor`，`interval0` 为 cascade0 区间长度（像素）。
pub fn probe_for_cascade(c: u32, resolution_factor: u32, interval0: f32) -> Probe {
    let width = 1u32 << (c + resolution_factor);
    let start = interval0 * (1.0 - 4.0_f32.powi(c as i32)) / -3.0;
    let range = interval0 * 4.0_f32.powi(c as i32);
    Probe {
        width,
        start,
        range,
    }
}

/// 与 `radiance_cascades.rs` 中 `calculate_cascade_count` 相同的几何级数界（屏幕对角线覆盖）。
pub fn cascade_count_for_diagonal(max_length_px: f32, interval0: f32, max_cascades: usize) -> usize {
    let a1 = interval0.max(1.0);
    let n = ((1.0 + 3.0 * max_length_px / a1).log(4.0)).ceil() as usize;
    n.min(max_cascades)
}

/// 按 GI 缓冲对角线像素长度估计级联数（至少 1）。
pub fn cascade_count_for_gi_size(gi_w: u32, gi_h: u32) -> usize {
    let diag = ((gi_w * gi_w + gi_h * gi_h) as f32).sqrt();
    cascade_count_for_diagonal(diag, RC_INTERVAL0, RC_MAX_CASCADES).max(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn probe_c0_matches_bevy_default_resolution1() {
        let p = probe_for_cascade(0, 1, 2.0);
        assert_eq!(p.width, 2);
        assert!((p.start - 0.0).abs() < 1e-5);
        assert!((p.range - 2.0).abs() < 1e-5);
    }

    #[test]
    fn cascade_count_is_positive() {
        let n = cascade_count_for_diagonal(1920.0_f32.hypot(1080.0), 2.0, 16);
        assert!(n > 0 && n <= 16);
    }

}
