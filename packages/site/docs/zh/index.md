---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
    name: 一个无限画布教程
    tagline: 一步步构建一个可用的无限画布
    image:
        src: /canvas.png
        alt: Infinite Canvas
    actions:
        - theme: brand
          text: 课程列表
          link: /zh/guide/lesson-001
        - theme: alt
          text: 示例
          link: /zh/example/solar-system

features:
    - title: 高性能渲染
      details: 使用 WebGL & WebGPU
    - title: 可交互
      details: 基于 <a href="https://genji-md.dev">genji</a> 实现的可交互代码块
    - title: 框架无关
      details: 基于 Web Components 实现的 UI 组件
    - title: 丰富的图形
      details: 2D 图形、便签、画笔
---

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas');
});
```

```js eval code=false inspector=false
call(() => {
    const {
        Canvas,
        Rect,
        Polyline,
        Path,
        RoughCircle,
        RoughRect,
        RoughPolyline,
        RoughPath,
        Text,
        deserializeNode,
        fromSVGElement,
        TesselationMethod,
        loadBitmapFont,
    } = Core;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas.parentElement.style.position = 'relative';
    $icCanvas.parentElement.appendChild($stats);

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const polyline1 = new Polyline({
            points: [
                [100, 100],
                [100, 200],
                [200, 100],
            ],
            stroke: 'red',
            strokeWidth: 20,
            fill: 'none',
        });
        canvas.appendChild(polyline1);

        const polyline2 = new Polyline({
            points: [
                [220, 100],
                [220, 200],
                [320, 100],
            ],
            stroke: 'red',
            strokeWidth: 20,
            strokeLinejoin: 'bevel',
            fill: 'none',
        });
        canvas.appendChild(polyline2);

        const polyline3 = new Polyline({
            points: [
                [340, 100],
                [340, 200],
                [440, 100],
            ],
            stroke: 'red',
            strokeWidth: 20,
            strokeLinejoin: 'round',
            strokeLinecap: 'round',
            fill: 'none',
        });
        canvas.appendChild(polyline3);

        const polyline4 = new Polyline({
            points: [
                [100, 300],
                [200, 300],
                [300, 210],
                [400, 300],
                [500, 300],
            ],
            stroke: 'red',
            strokeWidth: 20,
            strokeLinejoin: 'round',
            strokeLinecap: 'round',
            strokeDasharray: [10, 5],
            fill: 'none',
        });
        canvas.appendChild(polyline4);

        const rect2 = new Rect({
            x: 500,
            y: 100,
            fill: 'black',
            fillOpacity: 0.5,
            stroke: 'red',
            strokeWidth: 10,
            dropShadowBlurRadius: 10,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            strokeDasharray: [5, 5],
        });
        rect2.width = 100;
        rect2.height = 100;
        canvas.appendChild(rect2);

        const circle = new RoughCircle({
            cx: 400,
            cy: 400,
            r: 50,
            fill: 'black',
            strokeWidth: 2,
            stroke: 'red',
            fillStyle: 'zigzag',
        });
        canvas.appendChild(circle);

        const rect = new RoughRect({
            x: 500,
            y: 400,
            fill: 'black',
            strokeWidth: 2,
            stroke: 'red',
            fillStyle: 'dots',
        });
        rect.width = 100;
        rect.height = 50;
        canvas.appendChild(rect);

        const roughPolyline = new RoughPolyline({
            points: [
                [0, 0],
                [50, 0],
                [50, 50],
                [100, 100],
            ],
            strokeWidth: 2,
            stroke: 'red',
            bowing: 2,
            roughness: 4,
        });
        roughPolyline.position.x = 520;
        roughPolyline.position.y = 300;
        canvas.appendChild(roughPolyline);

        const roughPath = new RoughPath({
            d: 'M230 230 A 45 45, 0, 1, 1, 275 275 L 275 230 Z',
            fill: 'blue',
            strokeWidth: 2,
            stroke: 'red',
            fillStyle: 'dashed',
        });
        roughPath.position.x = 420;
        roughPath.position.y = 200;
        canvas.appendChild(roughPath);

        fetch(
            '/Ghostscript_Tiger.svg',
            // '/photo-camera.svg',
        ).then(async (res) => {
            const svg = await res.text();
            const $container = document.createElement('div');
            $container.innerHTML = svg;
            const $svg = $container.children[0];
            for (const child of $svg.children) {
                const group = await deserializeNode(fromSVGElement(child));
                group.children.forEach((path) => {
                    path.tessellationMethod = TesselationMethod.LIBTESS;
                    path.cullable = false;
                });
                group.position.x = 80;
                group.position.y = 320;
                canvas.appendChild(group);
            }
        });

        // evenodd fill rule
        const star = new Path({
            d: 'M150 0 L121 90 L198 35 L102 35 L179 90 Z',
            fill: '#F67676',
            fillRule: 'evenodd',
            tessellationMethod: TesselationMethod.LIBTESS, // instead of earcut
        });
        canvas.appendChild(star);

        // holes
        const ring = new Path({
            d: 'M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10 Z M 50 30 A 20 20 0 1 1 50 70 A 20 20 0 1 1 50 30 Z',
            fill: '#F67676',
        });
        canvas.appendChild(ring);

        // SDF
        const text = new Text({
            x: 300,
            y: 500,
            content: 'Hello, world!',
            fontSize: 20,
        });
        canvas.appendChild(text);

        // MSDF
        fetch('/fonts/msdf-sans-serif.json').then(async (res) => {
            const font = await loadBitmapFont.parse(await res.text());
            const text = new Text({
                x: 300,
                y: 550,
                content: 'Hello, world!',
                fontSize: 45,
                fill: '#F67676',
                fontFamily: 'sans-serif',
                bitmapFont: font,
            });
            canvas.appendChild(text);
        });

        // Bitmap font
        fetch('/fonts/desyrel.xml').then(async (res) => {
            const font = await loadBitmapFont.parse(await res.text());
            const text = new Text({
                x: 300,
                y: 500,
                content: 'Hello, world',
                fontSize: 55,
                fill: '#F67676',
                fontFamily: 'Desyrel',
                bitmapFont: font,
            });
            canvas.appendChild(text);
        });
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```
