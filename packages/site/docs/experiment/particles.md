---
publish: false
---

We use WebGPU WGSL compute shader with @antv/g-device-api. For more information: <https://observablehq.com/@antv/compute-toys>. So we must use `ic-canvas` with `renderer="webgpu"`.

```html
<ic-canvas renderer="webgpu" />
```

<script setup>
import GPUParticlesSine from '../components/audio-visualizer/GPUParticlesSine.vue'
</script>

<GPUParticlesSine />

Let me briefly describe the implementation. The whole process inside compute shaders can be divided into four stages:

-   Simulate particles
-   Clear
-   Rasterize
-   Output to storage buffer
-   Blit to screen

The particle structure is really simple, it consists of 2 properties: `position` and `velocity`. We will load/store particles from/to storage textures later.

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

At the first frame, we assign the initial `position` & `velocity` for each particle.

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

And in each of the next frames, `position` will be updated with `velocity`.

```wgsl
let dt = custom.Speed * custom.TimeStep;
p.velocity += (ForceField(p.position.xyz, t) - custom.VelocityDecay * p.velocity) * dt;
p.position += p.velocity * dt;
```
