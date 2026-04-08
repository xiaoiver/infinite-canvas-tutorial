---
layout: 'doc'
aside: false
---

<script setup>
import RadianceCascades from '../../components/RadianceCascades.vue'
</script>

详见：[课程 37 - 基于 Radiance Cascades 的 GI]

<RadianceCascades />

参考：[bevy_radiance_cascades]

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

[课程 37 - 基于 Radiance Cascades 的 GI]: /zh/guide/lesson-037
[bevy_radiance_cascades]: https://github.com/nixonyh/bevy_radiance_cascades
