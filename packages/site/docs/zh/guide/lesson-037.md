---
outline: deep
description: '探索Radiance Cascades技术，实现实时全局光照效果。学习现代图形渲染中的高级光照技术和性能优化方法。'
publish: false
---

# 课程 37 - 基于 Radiance Cascades 的 GI

[Fundamentals of Radiance Cascades]

> What we've observed is that the further we are from the closest object in the scene:
>
> -   The less spatial resolution we need. (e.g. the larger spacing can be between probes)
> -   The more angular resolution we need. (e.g. the more rays we need per probe)

整体流程如下：

```rust
let mut rc_enc = device_handle
    .device
    .create_command_encoder(&wgpu::CommandEncoderDescriptor {
        label: Some("rc_gi"),
    });
rp.encode_distance_pass();
rp.encode_rc_cascade_passes();
rp.encode_rc_mipmap();
rp.encode_rc_apply();
device_handle.queue.submit([rc_enc.finish()]);
```

## 生成距离场 {#distance-pass}

先使用解析几何。

![gi sdf](/gi-sdf.png)

Vertex shader 依然使用一个全屏三角形，`prims` 记录了场景中图形基础几何信息，便于使用 `sdf_prim` 生成解析几何距离场。最终结果写入 `rc_dist` 纹理中，该纹理使用全画布分辨率，格式为 `R16F` 存储无符号距离。

```wgsl
@group(0) @binding(0) var<uniform> header: DistHeader;
@group(0) @binding(1) var<storage, read> prims: array<GpuRcPrim>;

@fragment
fn dist_fs(i: VsOut) -> @location(0) vec4<f32> {
  var d = 1e6;
  let n = header.count;
  for (var i = 0u; i < 64u; i = i + 1u) {
    if i >= n { break; }
    d = min(d, sdf_prim(p_canvas, prims[i]));
  }
  // `d` 为并集 SDF：形内 <0、形外 >0、边 ≈0。R 存 max(d,0)：实心内部与边上为 0，外部为到边界的正距离。
  return vec4(max(d, 0.0), 0.0, 0.0, 1.0);
}
```

### JFA {#jfa}

## Cascade compute {#cascade-compute}

[Fundamentals of Radiance Cascades]

> A cascade is basically a grid of probes, in which all probes have equal properties. (e.g. interval count, interval length, probe spacing)

<video autoplay="" class="video" loop="" muted="" playsinline="" style="width:360px"><source src="https://m4xc.dev/anim/articles/fundamental-rc/spatial-exploit-anim.mp4" type="video/mp4"> Video tag is not supported.</video>

### ping-pong

CPU 侧调度（先粗后细、ping-pong）：第一趟用 rc_cascade_first（无 merge 分支），之后用 rc_cascade_merge；最后一级落在 rc_a 或 rc_b 由 cascade_count 奇偶决定（gi_cascade_output_view）。

```rust
for pass_i in 0..cascade_count {
    let cascade_idx = cascade_count - 1 - pass_i;
    let p = probe_for_cascade(cascade_idx as u32, RC_RESOLUTION_FACTOR, RC_INTERVAL0);
    // ...
    let pipeline: &ComputePipeline = if pass_i == 0 {
        &self.rc_cascade_first_pipeline
    } else {
        &self.rc_cascade_merge_pipeline
    };
    let (src_view, dst_view) = if pass_i == 0 {
        (rc_a_view, rc_b_view)
    } else if pass_i % 2 == 1 {
        (rc_b_view, rc_a_view)
    } else {
        (rc_a_view, rc_b_view)
    };
}
```

### Raymarch

绑定顺序与 Bevy radiance_cascades.wgsl 一致：tex_main、tex_dist_field、source、destination。

raymarch：在全分辨率 tex_main 上走，最多 32 步；用 tex_dist_field.r 作步长；命中条件 dist < EPSILON || dist < EPSILON_PX（JFA 用极小 ε，解析 SDF 用像素级 EPSILON_PX）。命中后读 LDR Vello 颜色（已去掉 Bevy 的 max(|c|-1,0) HDR 解码）。

```wgsl
fn raymarch(origin: vec2<f32>, ray_dir: vec2<f32>, range: f32) -> vec4<f32> {
  // ...
    if (dist < EPSILON || dist < EPSILON_PX) {
      color = textureLoad(tex_main, coord, 0);
      color.a = 1.0;
      break;
    }
    position = position + ray_dir * dist;
    covered_range = covered_range + dist;
  }
  return color;
}
```

radiance_dispatch：每个 GI texel 对应一个 probe 内的一条方向；origin 用 probe 中心 × gi_scale（当前为 1）+ probe_start；未命中且 merge 开启时加上 merge() 从上一级纹理插值来的辐射。

```wgsl
fn radiance_dispatch(merge_flag: u32, gid: vec3<u32>) {
  // ...
  let origin = center_full + ray_dir * ru.probe_start;
  var color = raymarch(origin, ray_dir, ru.probe_range);
  if merge_flag != 0u && color.a != 1.0 {
    color = color + merge(probe_cell, ray_index);
  }
  textureStore(tex_radiance_cascades_destination, ...);
}
```

-   rc_a/rc_b：GI 分辨率（当前 GI_RC_DOWNSCALE=1 时与画布一致），RGBA16F，级联 ping-pong。
-   rc_mipmap：尺寸为 ceil(gi/pw) × ceil(gi/pw)，每 texel 对应 cascade0 一个 probe 的方向平均。
-   rc_final：rc_apply 输出（vello + radiance），RGBA16F。
-   gi_out：最终给屏幕的 RGBA8，由 gi_blend 写入。

## 扩展阅读 {#extended-reading}

-   [Fundamentals of Radiance Cascades]
-   [Building Real-Time Global Illumination]
-   [Radiance Cascades]
-   [POC / Radiance Cascades]
-   [akari]
-   [bevy_radiance_cascades]
-   [compute toys]
-   [Guest: Radiance Cascades]

[Fundamentals of Radiance Cascades]: https://m4xc.dev/articles/fundamental-rc/
[Building Real-Time Global Illumination]: https://jason.today/gi
[Radiance Cascades]: https://jason.today/rc
[akari]: https://akari.lusion.co/#home
[compute toys]: https://compute.toys/view/1397
[POC / Radiance Cascades]: https://tmpvar.com/poc/radiance-cascades/
[bevy_radiance_cascades]: https://github.com/nixonyh/bevy_radiance_cascades
[Guest: Radiance Cascades]: https://mini.gmshaders.com/p/radiance-cascades
