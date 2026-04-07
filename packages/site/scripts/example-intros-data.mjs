/**
 * Bilingual intros for /example/* pages (SEO + AdSense-friendly body copy).
 * Keys match markdown basename without .md
 */
export const exampleIntros = {
  'solar-system': {
    en: {
      title: 'Nested scene graph: a simple solar system',
      description:
        'Animate nested Group nodes for sun, Earth orbit, and moon orbit on an infinite canvas using hierarchical transforms.',
      body: `This example shows how a **scene graph** composes rotation and translation: the root group rotates, child groups represent orbits, and circles represent celestial bodies. It is a compact illustration of parent–child transforms and per-frame updates from [Lesson 3 — Scene graph and transform](/guide/lesson-003).

The demo runs inside \`<ic-canvas>\` and updates transforms on each frame, which is the same mental model as building more complex diagrams or games on an infinite canvas.`,
    },
    zh: {
      title: '场景图嵌套：简易太阳系动画',
      description:
        '在无限画布上用嵌套的 Group 表现太阳、地球轨道与月球轨道，演示层级变换与逐帧动画。',
      body: `本示例说明 **场景图** 如何组合旋转与平移：根结点负责整体旋转，子 Group 表示轨道，圆形表示天体，对应 [第 3 课 — 场景图与变换](/zh/guide/lesson-003) 中的父子变换关系。

演示在 \`<ic-canvas>\` 中运行，每一帧更新各结点变换，与在无限画布上搭建更复杂图形或小游戏时的思路一致。`,
    },
  },
  webgpu: {
    en: {
      title: 'WebGPU renderer path',
      description:
        'Exercise the WebGPU backend of the canvas stack and compare behavior with the WebGL path.',
      body: `Use this page to confirm that shapes and the render loop behave correctly when the **WebGPU** HAL is selected. It complements the initialization and plugin topics in [Lesson 1](/guide/lesson-001) and the performance notes in [Lesson 8](/guide/lesson-008).

If WebGPU is unavailable in the browser, fall back to WebGL and compare frame cost or visual parity.`,
    },
    zh: {
      title: 'WebGPU 渲染路径',
      description:
        '在支持的环境下走 WebGPU 渲染路径，并与 WebGL 行为做对照。',
      body: `用于确认在选用 **WebGPU** 抽象层时，图形与渲染循环是否表现正常，可与 [第 1 课](/zh/guide/lesson-001) 的初始化与插件体系、[第 8 课](/zh/guide/lesson-008) 的性能讨论对照阅读。

若当前浏览器不可用 WebGPU，可改用 WebGL 并对比帧耗时或画面一致性。`,
    },
  },
  culling: {
    en: {
      title: 'Viewport culling to reduce draw load',
      description:
        'Skip shapes outside the visible frustum so large scenes stay responsive.',
      body: `**Frustum culling** avoids submitting geometry that cannot appear on screen. This sample visualizes which objects remain in the working set as you pan and zoom, tying directly to [Lesson 8 — Optimize performance](/guide/lesson-008).

Use it as a reference when you profile CPU/GPU time on boards with thousands of shapes.`,
    },
    zh: {
      title: '视锥裁剪以降低绘制负载',
      description:
        '对视野外的图形跳过提交，让大规模场景保持可交互帧率。',
      body: `**视锥裁剪** 避免把不可能出现在屏幕上的几何体送入渲染管线。本示例随平移、缩放展示仍参与绘制的对象集合，可与 [第 8 课 — 性能优化](/zh/guide/lesson-008) 对照。

当你在画板上放置成千上万图形、需要排查 CPU/GPU 耗时时，可把此页当作参考。`,
    },
  },
  instanced: {
    en: {
      title: 'Instanced drawing to batch similar geometry',
      description:
        'Pack many similar primitives into fewer draw calls using instancing.',
      body: `When you render large counts of **similar** shapes (stars, dots, repeated icons), instancing amortizes draw-call overhead. This demo connects to the same performance themes as [Lesson 8](/guide/lesson-008).

Compare frame time with and without instancing when stress-testing your scene.`,
    },
    zh: {
      title: '实例化绘制：合并相似几何',
      description:
        '用实例化把大量相似图元合并为更少次绘制调用。',
      body: `当你要绘制大量 **相似** 图形（星点、重复图标等）时，实例化能摊薄 draw call 开销，主题与 [第 8 课 — 性能优化](/zh/guide/lesson-008) 一致。

压测场景时可对比开启实例化前后的帧时间。`,
    },
  },
  picking: {
    en: {
      title: 'Accelerate hit-testing with a spatial index',
      description:
        'Use RBush-backed queries so picking stays fast on dense boards.',
      body: `Picking must stay **O(log n)** or better when thousands of bounds overlap the cursor. This example shows how a spatial index narrows candidates before precise tests, aligned with interaction work in [Lesson 6](/guide/lesson-006) and performance tuning in [Lesson 8](/guide/lesson-008).

Use it when debugging “missed clicks” or hover lag on large documents.`,
    },
    zh: {
      title: '用空间索引加速拾取',
      description:
        '结合 RBush 等结构，在密集场景中快速缩小候选图形。',
      body: `当光标附近有大量包围盒重叠时，拾取需要接近 **O(log n)** 的候选筛选，再去做精确判断。本示例对应 [第 6 课 — 事件系统](/zh/guide/lesson-006) 与 [第 8 课 — 性能优化](/zh/guide/lesson-008) 中的交互与调优思路。

适合用来排查「点不中」或悬浮卡顿等问题。`,
    },
  },
  rect: {
    en: {
      title: 'Rectangle geometry with live controls',
      description:
        'Drive position, size, corner radius, and fill of a rounded rectangle interactively.',
      body: `Rectangles (including rounded corners) are core primitives for UI and diagrams. The sliders below exercise the same attributes introduced in [Lesson 9 — Draw ellipse and rectangle](/guide/lesson-009): position, size, \`cornerRadius\`, and fill.

The embedded **genji** blocks let you mutate the shape every frame without rebuilding the page—ideal for teaching and quick experiments.`,
    },
    zh: {
      title: '矩形几何与实时参数',
      description:
        '交互调节位置、尺寸、圆角与填充，理解圆角矩形各属性。',
      body: `矩形（含圆角）是界面与图示中最常用的图元之一。下方滑块对应 [第 9 课 — 绘制椭圆与矩形](/zh/guide/lesson-009) 中的位置、尺寸、\`cornerRadius\` 与填充等概念。

内嵌 **genji** 代码块可在不刷新页面的情况下每帧更新参数，适合教学与快速试验。`,
    },
  },
  'rounded-rectangle-shadow': {
    en: {
      title: 'Drop shadows on rounded rectangles',
      description:
        'Tune shadow color and offset for rounded rects with interactive controls.',
      body: `Shadows separate layers visually and are implemented as part of the **effect** or post-processing stack depending on your pipeline. These controls map to shadow color and X/Y offset—see [Lesson 9](/guide/lesson-009) for the underlying shape and [Lesson 30](/guide/lesson-030) for broader post-processing ideas.

Use the sliders to find values that read well on both light and dark backgrounds.`,
    },
    zh: {
      title: '圆角矩形的投影参数',
      description:
        '交互调节投影颜色与偏移，观察圆角矩形上的阴影效果。',
      body: `投影用于分层与强调，具体实现可能落在特效或后处理管线中。下方控件对应阴影颜色与 X/Y 偏移，图元基础见 [第 9 课](/zh/guide/lesson-009)，管线层面可参考 [第 30 课 — 后处理与渲染图](/zh/guide/lesson-030)。

可拖动参数观察在浅色/深色背景下更易读的组合。`,
    },
  },
  webworker: {
    en: {
      title: 'Offload canvas work to a Web Worker',
      description:
        'Keep the main thread responsive while rasterizing or simulating in the background.',
      body: `Heavy work—large exports, simulations, or parsing—should not block input. Moving the canvas or compute stage to a **Web Worker** isolates long tasks from the UI thread, echoing SSR and testing themes in [Lesson 11](/guide/lesson-011).

Watch frame time and input latency while toggling worker usage in your own builds.`,
    },
    zh: {
      title: '将画布相关工作放到 Web Worker',
      description:
        '在后台栅格化或计算，避免长时间占用主线程影响交互。',
      body: `导出大图、仿真或解析等重任务不应阻塞输入。把画布或计算阶段放到 **Web Worker** 可与 [第 11 课 — 测试与服务端渲染](/zh/guide/lesson-011) 中讨论的离屏/服务端思路对照。

可在自研集成中对比使用 Worker 前后的帧时间与输入延迟。`,
    },
  },
  exporter: {
    en: {
      title: 'Export the canvas to PNG or SVG',
      description:
        'Snapshot vector or raster output for sharing and printing.',
      body: `Export ties the editor to the rest of the workflow—slides, docs, asset pipelines. This sample shows how to serialize the current scene to **image** formats; clipboard and file workflows appear in [Lesson 24](/guide/lesson-024).

Verify alpha, resolution, and color profile expectations for your target medium.`,
    },
    zh: {
      title: '将画布导出为 PNG / SVG',
      description:
        '把当前场景导出为位图或矢量，便于分享与印刷流程。',
      body: `导出能力把编辑器接入幻灯片、文档与素材管线。本示例演示如何将场景序列化为 **图像**；与剪贴板、文件相关的交互见 [第 24 课 — 上下文菜单与剪贴板](/zh/guide/lesson-024)。

请按目标媒介核对透明度、分辨率与色彩配置是否符合预期。`,
    },
  },
  'import-svg': {
    en: {
      title: 'Import SVG paths into the canvas',
      description:
        'Parse SVG content and map it to canvas paths and shapes.',
      body: `SVG is the lingua franca for 2D assets. Importing paths lets users bring logos and illustrations onto the board while preserving editability where possible—see also vector topics in [Lesson 22](/guide/lesson-022).

Handle viewBox, transforms, and unsupported elements explicitly in production importers.`,
    },
    zh: {
      title: '将 SVG 导入画布',
      description:
        '解析 SVG 并映射为画布上的路径与图形，便于复用存量素材。',
      body: `SVG 是二维素材的通用交换格式。导入路径可把徽标与插画搬到画板上，并在可行时保留可编辑性，可与 [第 22 课 — VectorNetwork](/zh/guide/lesson-022) 对照。

正式产品中需明确处理 viewBox、变换与不支持的元素。`,
    },
  },
  'wikipedia-datamap': {
    en: {
      title: 'Wikipedia embedding map with loaders.gl',
      description:
        'Load Arrow/CSV/ZIP datasets and plot them with deck.gl-style visualization.',
      body: `This example mixes **data loading** (\`@loaders.gl/*\`) with a large scatter-style map. It is heavier than a typical tutorial snippet: use it to study streaming formats, not as a minimal hello-world.

The referenced notebook shows how the same datasets were prepared; adapt paths and loaders for your own tiles.`,
    },
    zh: {
      title: 'Wikipedia 嵌入向量与 loaders.gl 数据管线',
      description:
        '从 Arrow/CSV/ZIP 等格式加载数据并做大规模散点可视化。',
      body: `本示例结合 **数据加载**（\`@loaders.gl/*\`）与类 deck.gl 的可视化，体量大于普通教学片段，适合作为数据管线参考，而非最小示例。

文内链接指向原始数据准备方式；集成时请按自己的切片与加载器调整路径。`,
    },
  },
  rough: {
    en: {
      title: 'Rough.js sketch style on the canvas',
      description:
        'Render hand-drawn strokes and fills using Rough.js integration.',
      body: `Sketchy rendering breaks the “perfect vector” look and matches whiteboard aesthetics. This demo follows [Lesson 13 — Draw path and sketchy style](/guide/lesson-013), including hachure and fill styles from **Rough.js**.

Tweak roughness and bowing to match brand or mood.`,
    },
    zh: {
      title: 'Rough.js 手绘风格渲染',
      description:
        '在画布上呈现手绘质感的描边与填充。',
      body: `手绘风格能打破「过于光滑」的矢量观感，更贴近白板与草图。本演示对应 [第 13 课 — Path 与手绘风格](/zh/guide/lesson-013)，涵盖 **Rough.js** 的填充与笔触参数。

可按品牌或场景调节粗糙度与弯曲等选项。`,
    },
  },
  wireframe: {
    en: {
      title: 'Wireframe overlay for layout debugging',
      description:
        'Draw bounding guides to inspect alignment and spacing.',
      body: `Wireframes help verify **layout engines**, snapping, and padding without permanent ink. Use them while building [Lesson 33 — Layout engine](/guide/lesson-033) integrations or debugging misaligned frames.

Toggle overlays only in dev builds to avoid confusing end users.`,
    },
    zh: {
      title: '线框叠加：辅助排查布局',
      description:
        '绘制包围与参考线，检查对齐与间距。',
      body: `线框便于在开发阶段验证 **布局引擎**、吸附与内边距，可与 [第 33 课 — 布局引擎](/zh/guide/lesson-033) 的集成对照。

建议仅在开发构建中开启，避免干扰最终用户。`,
    },
  },
  holes: {
    en: {
      title: 'Compound paths with holes',
      description:
        'Use winding rules and subpaths to cut holes in filled regions.',
      body: `Boolean-like holes appear in icons, donuts, and masks. This sample exercises path construction where **outer** and **inner** contours interact—see fill rules in [Lesson 13](/guide/lesson-013) and clipping in [Lesson 34](/guide/lesson-034).

Test both even-odd and non-zero rules if your importer emits ambiguous geometry.`,
    },
    zh: {
      title: '带孔洞的复合 Path',
      description:
        '用子路径与绕向规则在填充区域中挖出孔洞。',
      body: `带孔图形常见于图标、圆环与遮罩。本示例练习 **外轮廓与内轮廓** 的组合，可与 [第 13 课](/zh/guide/lesson-013) 的路径与 [第 34 课 — Group/Frame 与裁切](/zh/guide/lesson-034) 对照。

若几何来自导入器，请用 even-odd 与 non-zero 两种规则交叉验证。`,
    },
  },
  'fill-rule': {
    en: {
      title: 'Even-odd vs non-zero fill rules',
      description:
        'See how the same path geometry fills differently under each rule.',
      body: `The **fill rule** decides which regions are inside a self-intersecting or nested path. Interactive design tools expose this as a first-class toggle—essential for predictable SVG import.

Pair this page with compound paths and holes when debugging unexpected fills.`,
    },
    zh: {
      title: '填充规则：even-odd 与 non-zero',
      description:
        '同一几何在不同填充规则下会得到不同填充区域。',
      body: `**填充规则** 决定自相交或嵌套路径的「内部」区域，交互设计工具通常提供显式切换，对 SVG 导入的可预期性很重要。

可与带孔复合路径、导入器问题对照排查异常填充。`,
    },
  },
  'sdf-text': {
    en: {
      title: 'Text with a distance-field shader',
      description:
        'Render crisp text at multiple sizes using SDF techniques.',
      body: `Signed distance fields (**SDF**) scale text without jagged edges when mip-mapping and filtering are set up carefully. This ties into the broader text pipeline in [Lesson 15](/guide/lesson-015) and [Lesson 16](/guide/lesson-016).

Compare against MSDF and bitmap-font approaches on the same string for your target DPI.`,
    },
    zh: {
      title: '距离场（SDF）文本',
      description:
        '用 SDF 在多字号下保持边缘清晰。',
      body: `有向距离场（**SDF**）在合适的滤波与 mip 设置下，可在放大缩小时减少锯齿，与 [第 15](/zh/guide/lesson-015)、[第 16 课](/zh/guide/lesson-016) 的文本管线一脉相承。

可与同一段文字的 MSDF、位图字体方案在目标 DPI 下做对比。`,
    },
  },
  'bitmap-font': {
    en: {
      title: 'Bitmap font rendering',
      description:
        'Use prebaked glyph atlases for lightweight, deterministic text.',
      body: `**Bitmap fonts** trade flexibility for speed and simplicity—ideal for games and HUDs. The snippet shows loading an XML/texture pair and toggling kerning to see metric differences.

When you need full Unicode or webfont workflows, move toward HarfBuzz or Opentype.js examples below.`,
    },
    zh: {
      title: '位图字体文本',
      description:
        '使用预烘焙字形图集，换取轻量与可预期的性能。',
      body: `**位图字体** 以灵活性换取速度与实现简单，适合游戏与 HUD。示例代码展示如何加载 XML/纹理对，并可切换字距观察度量差异。

若需要完整 Unicode 或 Web 字体流程，可再参考 HarfBuzz、Opentype.js 等示例。`,
    },
  },
  'msdf-text': {
    en: {
      title: 'MSDF text rendering',
      description:
        'Multi-channel SDF preserves sharp corners better than single-channel SDF at oblique angles.',
      body: `**MSDF** improves on basic SDF for small sizes and diagonal strokes. Use this page next to the SDF and bitmap examples to pick a technique per use case.

Precompute atlases offline for large glyph sets to keep load times predictable.`,
    },
    zh: {
      title: 'MSDF 文本渲染',
      description:
        '多通道 SDF 在斜向笔画与小字号下往往比单通道 SDF 更稳。',
      body: `**MSDF** 可视为 SDF 的增强，可与 SDF、位图示例对照，按场景选型。

大字表建议在离线阶段预计算图集，以控制首包与加载时间。`,
    },
  },
  emoji: {
    en: {
      title: 'Color emoji alongside plain text',
      description:
        'Render emoji glyphs with the same text pipeline as Latin text.',
      body: `Emoji require **color** tables and often different fallback fonts. This sample extends the baseline text lesson ([Lesson 15](/guide/lesson-015)) with multi-codepoint sequences in one string.

Verify line height and baseline when mixing emoji with math or CJK.`,
    },
    zh: {
      title: '与正文混排的表情符号',
      description:
        '在同一文本管线中绘制彩色 emoji 与拉丁字符。',
      body: `Emoji 往往依赖 **彩色** 字形与独立回退字体。本示例在 [第 15 课 — 文本](/zh/guide/lesson-015) 的基础上，在同一段字符串中混合多码点序列。

与公式或 CJK 混排时请核对行高与基线。`,
    },
  },
  bidi: {
    en: {
      title: 'Bidirectional text layout',
      description:
        'Mix LTR and RTL scripts with correct intrinsic ordering.',
      body: `**Bidi** layout is required for Arabic and Hebrew mixed with English. HarfBuzz-level shaping (see related examples) resolves levels; this page shows canvas-level integration.

Test caret movement and selection with mixed-direction paragraphs.`,
    },
    zh: {
      title: '双向文字（Bidi）排版',
      description:
        '在同一段落中混合从左到右与从右到左的书写方向。',
      body: `**Bidi** 排版在阿语、希伯来语与英文混排时不可或缺，字形层面常依赖 HarfBuzz 等 shaping，本页展示与画布的集成。

请用混合方向段落测试光标移动与选区行为。`,
    },
  },
  harfbuzz: {
    en: {
      title: 'Text shaping with HarfBuzz',
      description:
        'Use HarfBuzz for complex scripts and OpenType features.',
      body: `**HarfBuzz** is the industry-standard shaper. Wiring it to your text runs unlocks ligatures, kerning, and script-specific rules beyond simple codepoint→glyph mapping—see [Lesson 15](/guide/lesson-015).

Ship WASM builds with lazy loading to keep initial bundles small.`,
    },
    zh: {
      title: '使用 HarfBuzz 进行文本 Shaping',
      description:
        '为复杂文字与 OpenType 特性提供工业级 shaping。',
      body: `**HarfBuzz** 是事实上的 shaping 实现，接入后可支持连字、字距与脚本相关规则，超越简单的码点→字形映射，见 [第 15 课](/zh/guide/lesson-015)。

WASM 建议按需懒加载以控制首包体积。`,
    },
  },
  opentype: {
    en: {
      title: 'Shaping with Opentype.js',
      description:
        'Pure-JS parsing and layout for lighter deployments.',
      body: `**Opentype.js** parses fonts in JavaScript—useful when you cannot ship HarfBuzz WASM or need quick prototypes. Coverage of complex scripts differs; validate against your target languages.

Pair with Canvas text metrics when tuning line breaks.`,
    },
    zh: {
      title: '使用 Opentype.js 进行 Shaping',
      description:
        '在纯 JS 环境中解析字体并布局，适合轻量部署。',
      body: `**Opentype.js** 在浏览器内解析字体，适合无法携带 HarfBuzz WASM 或需要快速原型的场景；复杂脚本覆盖与 HarfBuzz 可能有差异，请按目标语言验证。

换行与行盒请结合 Canvas 文本度量调整。`,
    },
  },
  'text-baseline': {
    en: {
      title: 'Canvas text baseline alignment',
      description:
        'Compare alphabetic, middle, and other baselines side by side.',
      body: `The **textBaseline** property changes where glyphs sit relative to a y-coordinate—critical when mixing text with shapes or icons. MDN documents the full enum; this demo renders two canvases for comparison.

Align labels to vector geometry using explicit baselines rather than magic offsets.`,
    },
    zh: {
      title: '文本基线（textBaseline）对齐',
      description:
        '并排对比 alphabetic、middle 等基线选项的视觉效果。',
      body: `**textBaseline** 决定纵坐标与字形相对关系，在与几何、图标混排时尤为关键；枚举释义可参考 MDN，本页用双画布对照。

与矢量几何对齐时优先显式基线，而非魔法偏移。`,
    },
  },
  'text-dropshadow': {
    en: {
      title: 'Drop shadow on text',
      description:
        'Layer shadow blur and offset for readable labels over busy backgrounds.',
      body: `Text shadows improve **contrast** on photos and gradients. Parameters mirror CSS-like shadow syntax; balance blur vs performance on low-end GPUs.

Related styling topics appear in [Lesson 16](/guide/lesson-016).`,
    },
    zh: {
      title: '文本投影',
      description:
        '在复杂背景上通过模糊与偏移提升可读性。',
      body: `文本阴影可提升照片、渐变等 **对比度**；参数语义接近 CSS 阴影，在低端 GPU 上需权衡模糊与性能。

可与 [第 16 课 — 文本高级特性](/zh/guide/lesson-016) 中的样式能力对照。`,
    },
  },
  'text-stroke': {
    en: {
      title: 'Outlined text (stroke)',
      description:
        'Draw hollow or dual-tone labels with stroke width and join style.',
      body: `Stroked text is common for stickers, maps, and UI chrome. Control **width**, **join**, and fill/stroke ordering to avoid artifacts at sharp corners.

Validate against your SDF/MSDF shader if you move outlines off the CPU.`,
    },
    zh: {
      title: '文本描边',
      description:
        '用描边宽度与连接样式制作空心字或双色标签。',
      body: `描边文本常见于贴纸、地图与界面装饰。需控制 **宽度**、**连接** 以及填充/描边顺序，避免尖角瑕疵。

若描边改到 GPU/SDF 管线，请与着色器行为交叉验证。`,
    },
  },
  'text-decoration': {
    en: {
      title: 'Underline and text decorations',
      description:
        'Apply underlines, skips, and thickness consistent with typographic norms.',
      body: `Decorations participate in **selection**, **accessibility**, and export to PDF/SVG. This sample isolates decoration parameters for experimentation.

Match platform conventions when mirroring native text fields.`,
    },
    zh: {
      title: '下划线与文本装饰',
      description:
        '实验下划线粗细、跳过规则等参数。',
      body: `装饰线与 **选区**、**无障碍** 以及导出 PDF/SVG 相关；本页单独拉出参数便于试验。

若模拟系统输入框，请尽量贴近平台惯例。`,
    },
  },
  'text-path': {
    en: {
      title: 'Text on a path',
      description:
        'Place glyphs along curves for badges and annotations.',
      body: `Path-on-text needs **arc length** sampling and rotation per glyph. Use it for circular badges and flow labels; performance scales with segment count.

See vector path math in [Lesson 12](/guide/lesson-012) and [Lesson 13](/guide/lesson-013).`,
    },
    zh: {
      title: '路径文本',
      description:
        '沿曲线排布字形，用于徽章与流式标注。',
      body: `路径文本需要按 **弧长** 采样并逐字旋转，适合圆形徽章与流向文字；性能与路径分段数量相关。

路径数学见 [第 12](/zh/guide/lesson-012)、[第 13 课](/zh/guide/lesson-013)。`,
    },
  },
  'physical-text': {
    en: {
      title: 'Soft, “physical” text shading',
      description:
        'Experiment with gradient-like shading for artistic typography.',
      body: `This variant explores **aesthetic** shading beyond flat fills—useful for posters and hero graphics rather than body copy.

Keep fallbacks for users who disable heavy shaders.`,
    },
    zh: {
      title: '晕染/物理感文本着色',
      description:
        '尝试超越扁平填色的艺术化字形着色。',
      body: `本变体偏重 **观感** 与海报式标题，而非正文排版；若使用较重着色器，请准备降级路径。`,
    },
  },
  'web-font-loader': {
    en: {
      title: 'Load webfonts before painting text',
      description:
        'Coordinate font loading with canvas render timing.',
      body: `FOIT/FOUT issues hit canvas just like DOM. **WebFontLoader** (or native \`document.fonts\`) should gate your first text draw—see [Lesson 15](/guide/lesson-015).

Preload critical fonts to avoid layout shift in collaborative sessions.`,
    },
    zh: {
      title: 'Web 字体加载与绘制时机',
      description:
        '在首帧绘制前协调字体就绪，避免闪烁与回退字体跳变。',
      body: `画布上的 FOIT/FOUT 与 DOM 类似，应使用 **WebFontLoader** 或 \`document.fonts\` 控制首次绘制时机，见 [第 15 课](/zh/guide/lesson-015)。

协同场景可对关键字体做预加载，减轻布局跳动。`,
    },
  },
  'tex-math': {
    en: {
      title: 'TeX math on the canvas',
      description:
        'Render LaTeX formulas to textures or paths for STEM content.',
      body: `STEM whiteboards often need **TeX**. Rasterizing formulas to images is straightforward; path extraction enables sharper zoom at the cost of complexity.

Cache results per formula string to keep interaction smooth.`,
    },
    zh: {
      title: '在画布上渲染 TeX 公式',
      description:
        '将 LaTeX 渲染为贴图或路径，服务理工类白板。',
      body: `理工场景常需要 **TeX**。栅格化最简单；提取路径在放大时更锐利但实现更重。

可按公式字符串缓存结果以保持交互流畅。`,
    },
  },
  'text-editor': {
    en: {
      title: 'Minimal rich text editor surface',
      description:
        'Edit runs of text with caret, selection, and basic styles.',
      body: `Building a **text editor** on canvas means reimplementing caret movement, selection rectangles, and IME composition—see [Lesson 15](/guide/lesson-015) and [Lesson 16](/guide/lesson-016).

Start from this sample before adding collaboration or AI assists.`,
    },
    zh: {
      title: '简易富文本编辑表面',
      description:
        '在画布上实现光标、选区与基础样式。',
      body: `在画布上搭建 **编辑器** 需重做光标、选区与 IME 等逻辑，见 [第 15](/zh/guide/lesson-015)、[第 16 课](/zh/guide/lesson-016)。

可在此示例上再叠加协同或 AI 能力。`,
    },
  },
  pretext: {
    en: {
      title: 'Pretext for shaping and layout metrics',
      description:
        'Use Pretext to obtain consistent measurements across engines.',
      body: `**Pretext** helps unify shaping data when mixing multiple backends. The upstream project documents API nuances—treat this page as a bridge experiment.

Validate line breaks against HarfBuzz for production.`,
    },
    zh: {
      title: '使用 Pretext 获取排版度量',
      description:
        '在多后端之间统一 shaping 与布局数据时的实验桥接。',
      body: `**Pretext** 可在混合后端时统一度量；上游文档对边界情况有说明，本页偏试验性质。

生产环境请与 HarfBuzz 等结果交叉校验换行。`,
    },
  },
  'web-animations-api': {
    en: {
      title: 'Web Animations API with canvas',
      description:
        'Drive properties with WAAPI timelines instead of ad-hoc rAF loops.',
      body: `The **Web Animations API** integrates with motion libraries and CSS timing—useful when coordinating canvas motion with DOM UI. Compare with manual loops from [Lesson 36](/guide/lesson-036) (animation lesson).

Prefer WAAPI when you need pause, seek, or playbackRate.`,
    },
    zh: {
      title: 'Web Animations API 与画布',
      description:
        '用 WAAPI 时间线驱动属性，替代临时 rAF 逻辑。',
      body: `**Web Animations API** 可与动效库、CSS 时间函数协同，适合画布与 DOM UI **同步** 动效，亦可与 [第 36 课 — 动画](/zh/guide/lesson-036) 中的手工循环对照。

需要暂停、跳转或 playbackRate 时优先考虑 WAAPI。`,
    },
  },
  'canvas-mode-select': {
    en: {
      title: 'Switch canvas interaction modes',
      description:
        'Toggle select, pan, draw, and other modes from a single surface.',
      body: `Mode switching is central to whiteboard UX—see [Lesson 14](/guide/lesson-014) for auxiliary UI and [Lesson 25](/guide/lesson-025) for drawing tools. This control surface keeps modes explicit for users.

Persist the active mode per document when restoring sessions.`,
    },
    zh: {
      title: '切换画布交互模式',
      description:
        '在选择、平移、绘制等模式间显式切换。',
      body: `模式切换是白板体验的核心，可与 [第 14 课](/zh/guide/lesson-014) 的辅助 UI、[第 25 课 — 绘制模式与笔刷](/zh/guide/lesson-025) 对照。

会话恢复时建议持久化当前模式。`,
    },
  },
  zindex: {
    en: {
      title: 'Change stacking order (z-index)',
      description:
        'Bring shapes forward or send them backward deterministically.',
      body: `Order defines occlusion for overlapping shapes. **z-index** or sibling order must match user expectations from design tools—related to grouping in [Lesson 34](/guide/lesson-034).

After batch imports, normalize z-order to avoid hidden selections.`,
    },
    zh: {
      title: '调整叠放顺序（z-index）',
      description:
        '将对象前移或后移，控制遮挡关系。',
      body: `叠放顺序决定互相覆盖时的可见性，需与用户对设计软件的预期一致，可与 [第 34 课](/zh/guide/lesson-034) 中的编组/Frame 对照。

批量导入后建议规范化顺序，避免选中对象被遮挡。`,
    },
  },
  'dragndrop-image': {
    en: {
      title: 'Drag-and-drop images onto the canvas',
      description:
        'Import raster assets from the desktop or browser tabs.',
      body: `Drag-and-drop is the fastest way to bring references onto a board. Parse **files** and **items** from the drop event, then decode images asynchronously—see asset topics in [Lesson 10](/guide/lesson-010).

Sanitize size and dimensions to protect memory on large pastes.`,
    },
    zh: {
      title: '拖拽图片到画布',
      description:
        '从桌面或浏览器拖入位图素材。',
      body: `拖拽是向画板引入参考图最快的方式。需在 drop 事件中解析 **文件** 与 **条目**，并异步解码，见 [第 10 课 — 图片导入导出](/zh/guide/lesson-010)。

对大图粘贴做尺寸与内存防护。`,
    },
  },
  'declarative-gradient': {
    en: {
      title: 'Declarative linear and radial gradients',
      description:
        'Define gradients as data instead of imperative shader tweaks.',
      body: `Declarative gradients map cleanly to design tokens and theme systems—see [Lesson 17 — Gradient and pattern](/guide/lesson-017). Serialize stops to JSON for persistence.

Validate color stops in sRGB vs display-p3 when branding matters.`,
    },
    zh: {
      title: '声明式线性/径向渐变',
      description:
        '用数据描述渐变，而非在代码里零散改着色器参数。',
      body: `声明式渐变便于对接设计变量与主题，序列化停止点即可持久化，见 [第 17 课 — 渐变与图案](/zh/guide/lesson-017)。

对品牌色域有要求时，请在 sRGB 与 display-p3 间核对色标。`,
    },
  },
  pattern: {
    en: {
      title: 'Tiled pattern fills',
      description:
        'Repeat bitmap or procedural fills across shapes.',
      body: `**Pattern** fills add texture to diagrams. Control tile size, offset, and transform to avoid moiré at export resolution—pattern support aligns with [Lesson 17](/guide/lesson-017).

Use high-resolution tiles for print exports.`,
    },
    zh: {
      title: '重复图案（Pattern）填充',
      description:
        '在位图或程序化纹理上平铺填充，增加质感。',
      body: `**图案** 填充常用于示意图纹理。需控制平铺尺寸、偏移与变换，避免导出分辨率下的摩尔纹，见 [第 17 课](/zh/guide/lesson-017)。

印刷导出宜使用足够分辨率的贴图。`,
    },
  },
  'image-processing': {
    en: {
      title: 'Image processing filters on canvas pixels',
      description:
        'Experiment with convolution-like operations for creative effects.',
      body: `Filters touch **pixels**—either CPU readbacks or GPU passes. This sample is a sandbox; production pipelines should prefer compute shaders or WASM for throughput—see post-processing in [Lesson 30](/guide/lesson-030).

Mind color space (gamma) when chaining filters.`,
    },
    zh: {
      title: '画布上的图像处理',
      description:
        '在像素域试验卷积类效果，用于创意滤镜。',
      body: `滤镜要么读回 CPU 处理，要么走 GPU Pass；本页偏沙盒，生产环境可优先考虑计算着色器或 WASM，见 [第 30 课 — 后处理](/zh/guide/lesson-030)。

串联滤镜时注意 **伽马/色彩空间**。`,
    },
  },
  mindmap: {
    en: {
      title: 'Mindmap layout prototype',
      description:
        'Auto-arrange branches around a central idea.',
      body: `Mindmaps pair **hierarchy layout** with freeform editing—see [Lesson 23 — Mindmap](/guide/lesson-023). This demo focuses on layout hints; styling follows your theme.

Export to image or outline formats for slides.`,
    },
    zh: {
      title: '思维导图布局示例',
      description:
        '围绕中心主题自动排布分支。',
      body: `思维导图结合 **层次布局** 与自由编辑，见 [第 23 课 — 思维导图](/zh/guide/lesson-023)。本示例侧重排布提示，样式可随主题调整。

可导出为图片或大纲供演示使用。`,
    },
  },
  tree: {
    en: {
      title: 'Tree diagram layout',
      description:
        'Lay out nodes in layered trees for org charts and taxonomies.',
      body: `Tree layouts are a subset of graph drawing with deterministic passes—compare with **FlexTree** for different spacing policies. Bindings to connectors appear in [Lesson 31](/guide/lesson-031).

Tune node size and rank spacing for readability.`,
    },
    zh: {
      title: '树形图布局',
      description:
        '用分层树布局展示组织结构或分类。',
      body: `树布局是图绘制中较可控的一类，可与 **FlexTree** 等不同间距策略对照；与连线的绑定见 [第 31 课 — 图形间连接](/zh/guide/lesson-031)。

请调节结点尺寸与层间距以保证可读性。`,
    },
  },
  flextree: {
    en: {
      title: 'FlexTree spacing variants',
      description:
        'Explore flexible spacing for wide vs deep trees.',
      body: `**FlexTree** algorithms trade horizontal vs vertical space differently. Pick parameters based on your typical graph depth and label width.

Combine with snapping from [Lesson 27](/guide/lesson-027) for tidy screenshots.`,
    },
    zh: {
      title: 'FlexTree 间距变体',
      description:
        '在宽而浅与深而窄的树之间调节空间分配。',
      body: `**FlexTree** 类算法对横纵空间权衡不同，可按常见深度与标签宽度选型。

可与 [第 27 课 — 吸附与对齐](/zh/guide/lesson-027) 配合获得更整齐的截图。`,
    },
  },
  binding: {
    en: {
      title: 'Bindings between shapes',
      description:
        'Keep connectors attached when nodes move or resize.',
      body: `**Bindings** encode logical connections separate from pixel drawing—core to diagrams and flow editors. Deep dive in [Lesson 31 — Bindings between shapes](/guide/lesson-031).

Handle orthogonal vs curved routes and obstacle avoidance in production tools.`,
    },
    zh: {
      title: '图形之间的绑定关系',
      description:
        '在结点移动或缩放时保持连线附着。',
      body: `**绑定** 将逻辑连接与像素绘制分离，是流程图编辑器的核心，详见 [第 31 课 — 图形间的连接关系](/zh/guide/lesson-031)。

正式产品还需处理正交/曲线走线与避障等。`,
    },
  },
  'draw-rect': {
    en: {
      title: 'Rectangle drawing tool',
      description:
        'Rubber-band rectangles with modifiers for square or center-anchored draws.',
      body: `Drawing tools translate pointer streams into shape edits—see [Lesson 25 — Drawing mode and brush](/guide/lesson-025). Rectangle mode is the simplest test bed for modifiers (Shift/Alt).

Snap to grid or objects from [Lesson 27](/guide/lesson-027) when precision matters.`,
    },
    zh: {
      title: '矩形绘制工具',
      description:
        '拖拽生成矩形，配合修饰键绘制正方形或中心锚定。',
      body: `绘制工具把指针轨迹转为图元编辑，见 [第 25 课 — 绘制模式与笔刷](/zh/guide/lesson-025)。矩形模式适合练习 Shift/Alt 等修饰键。

需要精度时可结合 [第 27 课 — 吸附与对齐](/zh/guide/lesson-027)。`,
    },
  },
  'draw-arrow': {
    en: {
      title: 'Arrow tool',
      description:
        'Create directed segments with arrowheads for diagrams.',
      body: `Arrows inherit polyline math from [Lesson 12](/guide/lesson-012) and styling from [Lesson 13](/guide/lesson-013). Tooling should preserve endpoint snapping and stroke styles.

Export arrows cleanly to SVG/PDF for documentation pipelines.`,
    },
    zh: {
      title: '箭头工具',
      description:
        '绘制带箭头的有向线段，用于示意图。',
      body: `箭头继承 [第 12 课 — 折线](/zh/guide/lesson-012) 的几何与 [第 13 课](/zh/guide/lesson-013) 的样式。工具层应保留端点吸附与描边设置。

导出到 SVG/PDF 时需保证箭头语义不丢。`,
    },
  },
  pencil: {
    en: {
      title: 'Pencil tool (polyline)',
      description:
        'Sample pointer input into smoothed polylines.',
      body: `The pencil records **raw samples** then simplifies or smooths—see brush tools in [Lesson 25](/guide/lesson-025). Balance latency vs fidelity for styluses vs mice.

Pressure curves matter for tablets.`,
    },
    zh: {
      title: '铅笔工具（折线）',
      description:
        '将指针采样为折线并可做平滑或简化。',
      body: `铅笔记录 **原始采样** 再简化/平滑，见 [第 25 课](/zh/guide/lesson-025)。手写笔与鼠标需在延迟与保真间取舍。

平板设备上压力曲线也很重要。`,
    },
  },
  'pencil-freehand': {
    en: {
      title: 'Pencil tool (freehand curves)',
      description:
        'Fit smoother curves to noisy input for handwriting-like strokes.',
      body: `Freehand mode fits **splines** or subdivided curves instead of dense polylines—useful for signatures and sketches. Compare file size vs polyline export.

Pair with laser/eraser tools for a complete drawing stack.`,
    },
    zh: {
      title: '铅笔工具（自由曲线）',
      description:
        '在噪声输入上拟合更平滑的曲线，接近手写观感。',
      body: `自由曲线模式用 **样条** 或细分曲线代替密集折线，适合签名与草图；导出时注意与折线方案的体积差异。

可与激光笔、橡皮等工具组成完整绘制栈。`,
    },
  },
  'brush-with-stamp': {
    en: {
      title: 'Brush with stamp texture',
      description:
        'Paint repeated stamps along the stroke path.',
      body: `Stamp brushes emulate markers and textures—see [Lesson 25](/guide/lesson-025). Spacing, rotation jitter, and pressure modulate the stamp stream.

Use alpha-friendly stamps to avoid dark overlap bands.`,
    },
    zh: {
      title: '带纹理戳记的笔刷',
      description:
        '沿笔迹重复放置戳记，模拟马克笔或纹理笔刷。',
      body: `戳记笔刷见 [第 25 课](/zh/guide/lesson-025)，通过间距、旋转抖动与压力调制序列。

宜使用带合适 alpha 的戳记，避免叠涂发黑。`,
    },
  },
  'laser-pointer': {
    en: {
      title: 'Laser pointer tool',
      description:
        'Ephemeral highlight for presentations without mutating the document.',
      body: `Laser pointers should **not** commit geometry—ideal for live sessions ([Lesson 25](/guide/lesson-025)). Fade-out timing and GPU cost stay small.

Offer a toggle to hide lasers in exported recordings if needed.`,
    },
    zh: {
      title: '激光笔工具',
      description:
        '用于演示的临时高亮，不写入文档几何。',
      body: `激光笔 **不应** 提交图元，适合实时讲解（[第 25 课](/zh/guide/lesson-025)）。淡出时间与 GPU 开销应保持很低。

若录制导出，可提供隐藏激光的选项。`,
    },
  },
  lasso: {
    en: {
      title: 'Lasso selection',
      description:
        'Select irregular regions by freehand outline.',
      body: `Lasso selection combines **path containment** tests with hit targets—see selection tooling in [Lesson 26](/guide/lesson-026). Optimize for many small objects via spatial indexes.

Differentiate tap vs drag thresholds to avoid accidental lassos.`,
    },
    zh: {
      title: '套索选择',
      description:
        '用自由轮廓圈选不规则区域。',
      body: `套索需做 **路径包含** 与命中对象测试，见 [第 26 课 — 选择工具](/zh/guide/lesson-026)；对象很多时可借助空间索引。

区分点击与拖拽阈值，减少误触套索。`,
    },
  },
  html: {
    en: {
      title: 'Embed HTML content on the canvas',
      description:
        'Place DOM subtrees that pan and zoom with the camera.',
      body: `Embedding **HTML** bridges design tools and the web platform—see [Lesson 29 — Embedding HTML content](/guide/lesson-029). Mind stacking contexts, focus rings, and accessibility when mixing DOM with canvas layers.

Throttle reflows when animating transforms.`,
    },
    zh: {
      title: '在画布中嵌入 HTML',
      description:
        '让 DOM 子树随相机平移缩放，与画布协同。',
      body: `嵌入 **HTML** 连接设计与 Web 平台，见 [第 29 课 — 嵌入 HTML](/zh/guide/lesson-029)。与画布层混用时注意层叠、焦点与无障碍。

动画变换时需控制重排频率。`,
    },
  },
  iframe: {
    en: {
      title: 'Embed iframes (e.g. video)',
      description:
        'Composite external media with canvas transforms.',
      body: `iframes carry **sandbox** and **autoplay** policies—coordinate with your CSP. Useful for YouTube or Figma embeds inside a board ([Lesson 29](/guide/lesson-029)).

Capture thumbnails if you need static exports without network playback.`,
    },
    zh: {
      title: '嵌入 iframe（如视频）',
      description:
        '将外部页面与画布变换合成。',
      body: `iframe 受 **sandbox**、**自动播放** 与 CSP 约束，可与 [第 29 课](/zh/guide/lesson-029) 的嵌入主题对照。

若需离线导出缩略图，可考虑截帧策略。`,
    },
  },
  loro: {
    en: {
      title: 'Collaboration with Loro CRDT',
      description:
        'Sync structured state with Loro’s CRDT primitives.',
      body: `**Loro** offers CRDT data types for collaborative apps—compare with Yjs in the adjacent example. Conflict resolution is automatic; UI must still converge sensibly.

See [Lesson 20 — Collaboration](/guide/lesson-020) for architecture context.`,
    },
    zh: {
      title: '使用 Loro CRDT 协同',
      description:
        '用 Loro 的 CRDT 数据结构同步文档状态。',
      body: `**Loro** 提供多种 CRDT 类型，可与旁边的 Yjs 示例对照；冲突虽自动合并，UI 仍需收敛到合理视图。

架构背景见 [第 20 课 — 协同](/zh/guide/lesson-020)。`,
    },
  },
  yjs: {
    en: {
      title: 'Real-time collaboration with Yjs',
      description:
        'Mirror canvas snapshots through Y.Doc and providers.',
      body: `**Yjs** is widely used for shared editing. This sample wires canvas changes into a \`Y.Doc\` and syncs via **BroadcastChannel** for local demos—production would use WebRTC or a websocket provider.

Deep patterns live in [Lesson 20 — Collaboration](/guide/lesson-020).`,
    },
    zh: {
      title: '使用 Yjs 实时协同',
      description:
        '通过 Y.Doc 与传输层镜像画布状态。',
      body: `**Yjs** 在协同编辑中应用广泛。本示例用 **BroadcastChannel** 做本地双窗演示，生产环境可换 WebRTC 或 WebSocket Provider。

深入模式见 [第 20 课 — 协同](/zh/guide/lesson-020)。`,
    },
  },
  liveblocks: {
    en: {
      title: 'Liveblocks presence and storage',
      description:
        'Use Liveblocks for rooms, presence, and persisted storage.',
      body: `**Liveblocks** bundles presence, storage, and comments for multiplayer products—good when you want managed infrastructure. Compare self-hosted CRDT costs before choosing.

Comments overlay example extends the same stack.`,
    },
    zh: {
      title: 'Liveblocks 在线房间与存储',
      description:
        '使用 Liveblocks 管理房间、在线状态与持久存储。',
      body: `**Liveblocks** 将在线状态、存储与评论等打包，适合希望使用托管后端的场景；可与自建 CRDT 成本对照。

评论叠加示例基于同一技术栈扩展。`,
    },
  },
  'perfect-cursors': {
    en: {
      title: 'Smoothed remote cursors',
      description:
        'Interpolate collaborator pointer streams for stable visuals.',
      body: `**Perfect-cursors** (or similar easing) reduces jitter when rendering peers’ pointers—important for perceived quality in multiplayer whiteboards.

Pair with Liveblocks/Yjs presence channels.`,
    },
    zh: {
      title: '平滑的远程光标',
      description:
        '对协作者指针流插值，减轻抖动。',
      body: `对远程光标做 **平滑**（如 perfect-cursors）可显著提升多人白板观感，建议与 Liveblocks/Yjs 的 presence 通道一起使用。`,
    },
  },
  'comments-overlay': {
    en: {
      title: 'Comment threads overlaid on the canvas',
      description:
        'Anchor discussions to coordinates with multiplayer backends.',
      body: `Comments need **anchors**, **permissions**, and **notifications**—often layered atop CRDT doc state. This demo shows overlay UI with Liveblocks; adapt auth to your tenant model.

Export comments alongside geometry for audit trails.`,
    },
    zh: {
      title: '画布上的评论层',
      description:
        '将讨论锚点到坐标，并与多人后端联动。',
      body: `评论需要 **锚点**、**权限** 与 **通知**，常叠在 CRDT 文档状态之上。本示例用 Liveblocks 展示叠加 UI；鉴权需按租户模型扩展。

审计场景可将评论与几何一并导出。`,
    },
  },
};
