---
publish: false
---

我们使用 WebGPU WGSL compute shader 和 @antv/g-device-api。更多信息：<https://observablehq.com/@antv/compute-toys>。所以必须使用 `ic-canvas` 并设置 `renderer="webgpu"`。

```html
<ic-canvas renderer="webgpu" />
```

<script setup>
import GPUParticlesSine from '../../components/audio-visualizer/GPUParticlesSine.vue'
</script>

<GPUParticlesSine />

下面我们简要介绍下 Compute Shader 中的流程，可以分成以下几个阶段：

-   Simulate particles
-   Clear
-   Rasterize
-   Output to storage buffer
-   Blit to screen

粒子的数据结构很简单，包含两个属性 `position` 和 `velocity`. 我们稍后会从/向 storage texture 中加载/存储粒子。

```wgsl
struct Particle {
  position: float4,
  velocity: float4,
}

fn LoadParticle(pix: int2) -> Particle {
  var p: Particle;
  p.position = textureLoad(pass_in, pix, 0, 0);
  p.velocity = textureLoad(pass_in, pix, 1, 0);
  return p;
}

fn SaveParticle(pix: int2, p: Particle) {
  textureStore(pass_out, pix, 0, p.position);
  textureStore(pass_out, pix, 1, p.velocity);
}
```

在第一帧，我们为每个粒子分配初始的 `position` & `velocity`。

```wgsl
@compute @workgroup_size(16, 16)
fn SimulateParticles(@builtin(global_invocation_id) id: uint3) {
  if (time.frame == 0u) {
    let rng = rand4();

    // Normalize from [0, 1] to [-1, 1].
    p.position = float4(2.0 * rng.xyz - 1.0, 0.0);
    p.velocity = float4(0.0, 0.0, 0.0, 0.0);
  }
}
```

在每一帧中，`position` 会根据 `velocity` 进行更新。

```wgsl
let dt = custom.Speed * custom.TimeStep;
p.velocity += (ForceField(p.position.xyz, t) - custom.VelocityDecay * p.velocity) * dt;
p.position += p.velocity * dt;
```
