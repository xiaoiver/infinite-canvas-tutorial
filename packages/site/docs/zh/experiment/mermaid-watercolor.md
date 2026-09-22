<script setup>
import MermaidWatercolor from '../../components/MermaidWatercolor.vue'
</script>

画一个水彩风格的 Mermaid 流程图：

-   使用 [vello] 渲染，因此需要在支持 WebGPU Compute Shader 的浏览器中运行，详见：[课程 35 - 基于瓦片的渲染]
-   使用 [mermaid-to-excalidraw] 解析 Mermaid 的流程图语法，详见：[课程 32 - 文本生成图表]
-   水彩风格化渲染使用 [watercolorizer]
-   字体使用 [Gaegu]

<MermaidWatercolor />

[vello]: https://github.com/linebender/vello
[mermaid-to-excalidraw]: https://github.com/excalidraw/mermaid-to-excalidraw
[课程 32 - 文本生成图表]: /zh/guide/lesson-032
[课程 35 - 基于瓦片的渲染]: /zh/guide/lesson-035
[watercolorizer]: https://github.com/32bitkid/watercolorizer
[Gaegu]: https://fonts.google.com/specimen/Gaegu
