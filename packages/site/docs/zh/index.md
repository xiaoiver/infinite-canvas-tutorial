---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
    name: 一个无限画布教程
    tagline: 一步步构建一个可用的无限画布
    image:
        src: /app.png
        alt: Infinite Canvas
    actions:
        - theme: brand
          text: 应用
          link: https://app.infinitecanvas.cc/
        - theme: alt
          text: 课程列表
          link: /zh/guide/lesson-001
        - theme: alt
          text: 示例
          link: /zh/example/solar-system
        - theme: alt
          text: 文档
          link: /zh/reference/canvas
        - theme: alt
          text: 实验
          link: /zh/experiment/particles

features:
    - title: 高性能渲染
      details: 使用 WebGL & WebGPU
    - title: 框架无关
      details: 基于 Web Components 实现的 UI 组件
    - title: 集成 AI 能力
      details: 使用 vercel ai-sdk，生成、分解、矢量化图片并与画布聊天
    - title: 可交互
      details: 基于 <a href="https://genji-md.dev">genji</a> 实现的可交互代码块
---

这份教程包含基于 WebGL / WebGPU 的基础 2D 图形渲染实现：

-   [课程 2 - 绘制圆]：学习 WebGL 基础，使用 SDF（有向距离场）技术绘制抗锯齿圆形，理解片元着色器中的坐标变换和颜色混合
-   [课程 5 - 绘制网格]：实现无限延伸的网格背景，学习相机变换矩阵，处理屏幕坐标与世界坐标的相互转换
-   [课程 9 - 绘制椭圆和矩形]：使用 SDF 技术绘制椭圆、圆角矩形，实现描边和填充，支持多种圆角半径配置
-   [课程 12 - 绘制折线]：实现折线渲染，支持 butt、round、square 三种线帽样式，以及 miter、round、bevel 三种连接样式
-   [课程 13 - 绘制 Path & 手绘风格]：集成 Rough.js 实现手绘风格渲染，支持 hachure、solid、dots 等多种填充样式，以及可调节的粗糙度参数
-   [课程 15 - 绘制文本]：基于 Canvas API 实现文本 Shaping，实现文本渲染、字体加载、字距调整（kerning）和 emoji 支持
-   [课程 16 - 文本的高级特性]：实现文本自动换行（word wrap）、多行文本对齐（左对齐/居中/右对齐）、最大行数限制和文本溢出处理
-   [课程 25 - 绘制模式和笔刷]：绘制矩形、箭头，使用铅笔、笔刷、激光笔和橡皮擦工具
-   [课程 30 - 后处理与渲染图]：构建 Render Graph 渲染图系统，实现高斯模糊、阴影、发光等后处理效果，支持多 Pass 渲染管线
-   [课程 34 - Frame 与裁切]：实现 Frame 画框容器，支持 clip 裁剪模式（裁剪子元素超出部分）和 mask 遮罩效果
-   [课程 35 - 基于瓦片的渲染]：使用瓦片化（Tile-based）渲染技术优化大规模场景

也包含使用 Web Components 技术实现的 UI 组件：

-   [课程 7 - Web UI]：使用 Lit 框架构建 Web Components 组件，实现属性绑定、事件系统和 Shadow DOM 封装，创建可复用的 UI 控件
-   [课程 18 - 使用 ECS 重构]：使用 ECS（Entity-Component-System）架构重构核心系统，实现数据驱动设计，提升代码可维护性和性能
-   [课程 24 - 上下文菜单和剪贴板]：实现自定义右键上下文菜单，集成 Clipboard API 实现复制、剪切、粘贴功能，支持 SVG 和 PNG 格式导出

还有一些有趣的话题：

-   [课程 17 - 渐变和重复图案]：实现线性渐变、径向渐变和圆锥渐变，支持多色标配置，以及重复图案（pattern）填充
-   [课程 19 - 历史记录]：实现命令模式（Command Pattern）的历史记录系统，支持撤销（undo）、重做（redo）和事务批量操作
-   [课程 22 - VectorNetwork]：实现矢量网络（Vector Network）数据结构，支持 Figma 风格的矢量路径编辑，包括节点连接、路径合并和布尔运算

以及最重要的：

-   [课程 28 - 集成 AI 能力]：集成 Vercel AI SDK，实现智能绘图助手，支持自然语言生成图形、图像矢量化、智能布局建议和 AI 对话交互

[课程 2 - 绘制圆]: /zh/guide/lesson-002
[课程 5 - 绘制网格]: /zh/guide/lesson-005
[课程 9 - 绘制椭圆和矩形]: /zh/guide/lesson-009
[课程 12 - 绘制折线]: /zh/guide/lesson-012
[课程 13 - 绘制 Path & 手绘风格]: /zh/guide/lesson-013
[课程 15 - 绘制文本]: /zh/guide/lesson-015
[课程 16 - 文本的高级特性]: /zh/guide/lesson-016
[课程 7 - Web UI]: /zh/guide/lesson-007
[课程 18 - 使用 ECS 重构]: /zh/guide/lesson-018
[课程 19 - 历史记录]: /zh/guide/lesson-019
[课程 24 - 上下文菜单和剪贴板]: /zh/guide/lesson-024
[课程 22 - VectorNetwork]: /zh/guide/lesson-022
[课程 17 - 渐变和重复图案]: /zh/guide/lesson-017
[课程 25 - 绘制模式和笔刷]: /zh/guide/lesson-025
[课程 28 - 集成 AI 能力]: /zh/guide/lesson-028
[课程 30 - 后处理与渲染图]: /zh/guide/lesson-030
[课程 34 - Frame 与裁切]: /zh/guide/lesson-034
[课程 35 - 基于瓦片的渲染]: /zh/guide/lesson-035

## 图库

以下为项目与应用中的部分效果与功能展示（后处理、渲染、工具与集成等）。

<div class="home-gallery-section">
  <div class="home-gallery" role="list">
    <figure class="home-gallery__item" role="listitem">
      <img src="/gallery/halftone.png" alt="半色调后处理效果" width="1492" height="906" loading="lazy" decoding="async" />
      <figcaption>半色调</figcaption>
    </figure>
    <figure class="home-gallery__item" role="listitem">
      <img src="/gallery/liquid-metal.png" alt="液态金属文字与材质" width="1974" height="990" loading="lazy" decoding="async" />
      <figcaption>液态金属</figcaption>
    </figure>
    <figure class="home-gallery__item" role="listitem">
      <img src="/gallery/watercolor.png" alt="水彩风格渲染" width="1062" height="582" loading="lazy" decoding="async" />
      <figcaption>水彩</figcaption>
    </figure>
    <figure class="home-gallery__item" role="listitem">
      <img src="/gallery/pixelate.png" alt="像素化效果" width="1042" height="480" loading="lazy" decoding="async" />
      <figcaption>像素化</figcaption>
    </figure>
    <figure class="home-gallery__item" role="listitem">
      <img src="/gallery/radiance-cascades.png" alt="辐射级联光照" width="1370" height="798" loading="lazy" decoding="async" />
      <figcaption>辐射级联</figcaption>
    </figure>
    <figure class="home-gallery__item" role="listitem">
      <img src="/gallery/vello.png" alt="Vello GPU 渲染" width="1532" height="782" loading="lazy" decoding="async" />
      <figcaption>Vello</figcaption>
    </figure>
    <figure class="home-gallery__item" role="listitem">
      <img src="/gallery/iconfont.png" alt="画布上的图标字体" width="1272" height="662" loading="lazy" decoding="async" />
      <figcaption>图标字体</figcaption>
    </figure>
    <figure class="home-gallery__item" role="listitem">
      <img src="/gallery/mermaid.png" alt="Mermaid 图表" width="730" height="696" loading="lazy" decoding="async" />
      <figcaption>Mermaid</figcaption>
    </figure>
    <figure class="home-gallery__item" role="listitem">
      <img src="/gallery/brush-with-eraser.png" alt="笔刷与橡皮工具" width="980" height="454" loading="lazy" decoding="async" />
      <figcaption>笔刷与橡皮</figcaption>
    </figure>
    <figure class="home-gallery__item" role="listitem">
      <img src="/gallery/orth-connector.png" alt="正交连线" width="872" height="510" loading="lazy" decoding="async" />
      <figcaption>连线</figcaption>
    </figure>
  </div>
</div>
