<script setup>
import MermaidWatercolor from '../components/MermaidWatercolor.vue'
</script>

Draw a watercolor-style Mermaid flowchart:

-   Rendering uses [vello], so you need a browser with WebGPU compute shader support. See [Lesson 35 - Tile-based Rendering].
-   [mermaid-to-excalidraw] parses Mermaid flowchart syntax. See [Lesson 32 - Text to diagram].
-   Watercolor-style fills use [watercolorizer].
-   The font is [Gaegu].

<MermaidWatercolor />

[vello]: https://github.com/linebender/vello
[mermaid-to-excalidraw]: https://github.com/excalidraw/mermaid-to-excalidraw
[Lesson 32 - Text to diagram]: /guide/lesson-032
[Lesson 35 - Tile-based Rendering]: /guide/lesson-035
[watercolorizer]: https://github.com/32bitkid/watercolorizer
[Gaegu]: https://fonts.google.com/specimen/Gaegu
