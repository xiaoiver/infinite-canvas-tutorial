---
outline: deep
description: '探索Radiance Cascades技术，实现实时全局光照效果。学习现代图形渲染中的高级光照技术和性能优化方法。'
---

<script setup>
import RadianceCascades from '../../components/RadianceCascades.vue'
</script>

# 课程 37 - 基于 Radiance Cascades 的 GI

在 [课程 35 - 基于瓦片的渲染] 中我们使用了基于 WebGPU Compute Shader 的渲染器 vello。在本节中我们可以尝试一种同样基于 Compute Shader 的全局光照效果。

完整原理介绍详见：[Fundamentals of Radiance Cascades]

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

<RadianceCascades />

## 生成距离场 {#distance-pass}

先使用解析几何。在 [课程 2 - 绘制圆] 和 [课程 9 - 绘制椭圆和矩形] 中我们已经介绍过 Circle Ellipse 和 Rect 的 SDF，在图形边缘和内部距离为 `0`。下图为可视化效果，使用 `saturate(d * DIST_FIELD_VIZ_SCALE)` 将原始距离映射到 `[0,1]`：

![rc sdf](/rc-sdf.png)

为了生成距离场纹理，Vertex shader 依然使用一个全屏三角形（类似之前 post processing 中的做法），`prims` 记录了场景中图形基础几何信息，便于使用 `sdf_prim` 生成解析几何距离场。最终结果写入 `rc_dist` 纹理中，该纹理使用全画布分辨率，格式为 `R16F` 存储无符号距离。

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
  // d 为并集 SDF：形内 <0、形外 >0、边 ≈0。R 存 max(d,0)：实心内部与边上为 0，外部为到边界的正距离。
  return vec4(max(d, 0.0), 0.0, 0.0, 1.0);
}
```

### JFA {#jfa}

Jump Flood Algorithm (JFA) 是一种并行距离场生成算法。它的核心思想是：通过指数级递减的"跳跃步长"，让信息在 `log₂(N)` 轮内传遍整个网格。

[bevy_radiance_cascades]

-   输入：JFA 的 `texture_2d<u32>`（存种子坐标）。
-   输出：当前像素到该种子的欧氏距离，写入 R16Float 距离图。

这样射线步进可以用较大的步长跳到下一个“安全”距离，而不是固定小步长。

```wgsl
@group(0) @binding(0) var<uniform> step_size: i32;
@group(0) @binding(1) var tex_jfa_source: texture_2d<u32>;
@group(0) @binding(2) var tex_jfa_destination: texture_storage_2d<rg16uint, write>;

const OFFSET_COUNT = 8;

@compute
@workgroup_size(8, 8, 1)
fn jfa(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>
) {
    let base_coord = vec2<i32>(global_id.xy);
    let base_coordf = vec2<f32>(base_coord);
    let dimension = vec2<i32>(textureDimensions(tex_jfa_source, 0));

    if any(base_coord >= dimension) {
        return;
    }

    var uv_offsets = array<vec2<i32>, OFFSET_COUNT>(
        vec2<i32>(-1, 1),
        vec2<i32>(0, 1),
        vec2<i32>(1, 1),
        vec2<i32>(-1, 0),
        vec2<i32>(1, 0),
        vec2<i32>(-1, -1),
        vec2<i32>(0, -1),
        vec2<i32>(1, -1),
    );

    var best_coord = textureLoad(tex_jfa_source, base_coord, 0).rg;
    let delta = vec2<f32>(best_coord) - base_coordf;
    var min_distance = dot(delta, delta);

    for (var i = 0; i < OFFSET_COUNT; i++) {
        let offset_coord = base_coord + uv_offsets[i] * step_size;
        if any(offset_coord >= dimension) || any(offset_coord < vec2<i32>(0)) {
            continue;
        }

        let offset_tex = textureLoad(tex_jfa_source, offset_coord, 0).rg;

        let delta = vec2<f32>(offset_tex) - base_coordf;
        let dist = dot(delta, delta);

        if dist < min_distance {
            min_distance = dist;
            best_coord = offset_tex;
        }
    }

    textureStore(
        tex_jfa_destination,
        base_coord,
        vec4<u32>(best_coord, 0, 0)
    );
}
```

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

### mipmap

把最后一级联结果按 probe 网格做平均，写到缩小的 radiance_mipmap

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

### 合成最终结果

main + radiance_mipmap，把间接光加回 HDR 主色

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
[课程 2 - 绘制圆]: /zh/guide/lesson-002#sdf
[课程 9 - 绘制椭圆和矩形]: /zh/guide/lesson-009#stretch-approximately-method
[课程 35 - 基于瓦片的渲染]: /zh/guide/lesson-035
