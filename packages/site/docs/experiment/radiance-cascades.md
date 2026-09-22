---
layout: 'doc'
aside: false
---

<script setup>
import RadianceCascades from '../components/RadianceCascades.vue'
</script>

Light up your mermaid flowchart with global illumination!

-   2D Radiance cascades based on [bevy_radiance_cascades]
-   Rendering uses vello, so you need a browser with WebGPU support
-   Use mermaid-to-excalidraw to parse Mermaid flowchart syntax

For more details, see: [Lesson 37 - GI with Radiance Cascades]

<RadianceCascades />

[Lesson 37 - GI with Radiance Cascades]: /guide/lesson-037
[bevy_radiance_cascades]: https://github.com/nixonyh/bevy_radiance_cascades
