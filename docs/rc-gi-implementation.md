# Radiance Cascades 屏幕空间 GI（rc_pass）实现说明

本文描述 `rust` 渲染器中 **解析 SDF 距离场 + Radiance Cascades（Bevy 式 probe 网格 + ping-pong）** 的屏幕空间间接光。思路参考 [MΛX: Fundamentals of Radiance Cascades](https://m4xc.dev/articles/fundamental-rc/)、[jason.today/rc](https://jason.today/rc)、[Naive GI](https://jason.today/gi)。

## 目标与范围

-   **输入**：与 Vello 一致的 **画布几何**（WASM 侧从 `JsShape` 收集 **矩形填充 / 椭圆填充**），以及 **Vello 离屏场景颜色** `t_scene`。
-   **输出**：合成阶段：`rgb = base.rgb + gi.rgb * giStrength`（`gb_fs`，对单像素 `radiance_at` 与 LDR 加权；无额外空间模糊）。
-   **非目标**：路径、文字、笔刷等 **不** 进入 GPU SDF 原语；原生非 WASM 构建中 `collect_gpu_primitives` 为空。

## 总体数据流

1. **背景**：网格或纯色 → `bg`。
2. **Vello** → `vello` 纹理。
3. **`rc_dist`**：`dist_fs` 写入有符号距离（**R** 通道）。
4. **Ping-pong cascade（compute）**：与 Bevy 相同——**首趟 no-merge** 单独 pass → **merge** 单独 pass；`rc_ping_a` / `rc_ping_b` 交替；**全分辨率**（`GI_RC_DOWNSCALE = 1`）与解析 SDF `dist` 对齐。
5. **`rc_radiance_mipmap`（compute）**：对齐 Bevy `radiance_cascades_mipmap.wgsl`——对 **cascade 0** 每个 probe 块内方向求平均，输出 **缩小网格** `rc_mipmap`（约 `ceil(W/pw)×ceil(H/pw)`）。
6. **`rc_apply`（fullscreen）**：对齐 Bevy `radiance_cascades_apply` 的**滤波上采样**思路——对 `rc_mipmap` **线性**采样（`sampler` 含 `mipmap_filter`，当前纹理仅 mip0），写入全分辨率 **`rc_final`**，仅 **RGB 间接光**（供 `gi_blend` 乘强度叠加）。
7. **`gi_out`**：`gi_blend` 以 `composite` 为底，叠加 `rc_final`。

**已移除**：早期「双 UV 区间 + `merge_intervals`」单 pass 近似；级联间合并改为与 Bevy 一致的 **上一级 radiance 纹理 spatial merge**。

**离屏**：`offscreen = gpu_grid || gi_enabled`。

## 解析 SDF 与 `GpuRcPrim`

与先前相同：画布坐标下 `min` 多原语 SDF；`GpuRcPrim` 存逆仿射与椭圆/圆角矩形参数。见 `sdf_primitives.rs`。

## WASM：`collect_gpu_primitives`

仅 Rect/Ellipse 填充；`fill_prim_gpu` 使用 `canvas_transform * world` 的逆。

## 与完整论文 RC 的差异

距离场仍为 **解析 SDF**（非 JFA）。`rc_mipmap` 目前 **单 mip 层**（与上游插件示例一致；`rc_apply` 对 mipmap 的采样器见 `rc_pass.rs`，可按需要改 Linear / Nearest）。级联数与 bevy_radiance_cascades 相同：按对角线由 `cascade_count_for_gi_size`（`log4` 几何界）估计，上限 16。

## 与 [Lommix/solis_2d](https://github.com/Lommix/solis_2d) 的对比（`radiance.rs`）

[solis_2d `radiance.rs`](https://github.com/Lommix/solis_2d/blob/master/src/radiance.rs) 把 **cascade / composite / mipmap 都做成全屏 Fragment**（`PipelineCache` + `fullscreen_shader_vertex_state`），绑定里除 SDF、级联纹理外还有 **`normal` 纹理**、**双 merge 纹理**、`GiGpuConfig` 与 **动态 `Probe` uniform**。这与本仓库 **cascade / mipmap 用 compute、仅 dist/apply/gi_blend 走 FS** 的结构不同，迁移成本较高，适合作为「另一种管线组织」参考，而非逐行对齐。

着色器侧（[`cascade.wgsl`](https://github.com/Lommix/solis_2d/blob/master/src/shaders/cascade.wgsl)）要点：

-   **射线推进**：对 `sdf_tex` **滤波采样**，用 **`abs(sample.a)` 累加步长**；命中条件与 **RGBA 打包**（`sample.a` 与 `sample.rgb` 的 emitter/内外关系）绑定，并含 **`march_to_positive`**（形内时可选先走到外侧再继续），与本文 **`textureLoad` R 通道解析 SDF + `abs(sd)` 薄带命中** 不是同一套编码。
-   **Cascade 0**：在已有 radiance 上可乘 **`normal_tex` 的 N·L**（`light_z`）做 **定向光调制**；我们当前 **无法线贴图、无平行光项**。
-   **Merge**：从 `last_cascade` **双线性插值**取上一级（`merge` 内算 UV），思路接近 RC「读上一级」，但布局公式与 [bevy_radiance_cascades](https://github.com/nixonyh/bevy_radiance_cascades) 的 compute 版不同。

[`composite.wgsl`](https://github.com/Lommix/solis_2d/blob/master/src/shaders/composite.wgsl)：`main + light + light * edge_highlight`，其中 **`edge_highlight ∝ 1/|sdf.a|`** 显式加强 **SDF 边缘**；另有 `absorb`、`modulate` 与 debug 开关。我们 **`gi_blend`** 是 **底图 + 加权 GI**，没有 solis 这条 **与距离成反比的边缘项**；若希望观感更接近 solis 的合成，可增加可选的 **edge 项**（需能采样到与 composite 对齐的 SDF）。

**小结**：solis_2d 更适合作为 **「全屏 RC + 法线 + 合成边缘增强」** 的参考；本仓库对齐的是 **bevy_radiance_cascades 的 compute + ping-pong**。若要吸收 solis 的优点，优先考虑 **独立法线 pass**、**composite 里可选 edge 项**，而不是整体替换为 solis 的 fragment cascade。

## 前端与选项

-   `CanvasRenderOptions`：`gi_enabled`、`gi_strength`（WASM camelCase）。
-   修改 `rust` 后需 **`wasm-pack build`**。

## 源码索引

| 模块          | 路径                                                                                   |
| ------------- | -------------------------------------------------------------------------------------- |
| RC / WGSL     | `rust/src/rc_pass.rs`（cascade / `rc_radiance_mipmap` / `rc_apply` + dist / gi_blend） |
| Bevy 对齐参数 | `rust/src/rc_cascade_math.rs`                                                          |
| 渲染顺序      | `rust/src/renderer.rs`                                                                 |
| 类型          | `rust/src/types.rs`                                                                    |
