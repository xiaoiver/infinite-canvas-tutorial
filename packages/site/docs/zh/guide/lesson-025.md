---
outline: deep
description: '绘制矩形模式。实现画笔功能，包括画线消抖动算法和丝滑绘制体验。学习p5.brush等画笔库的实现原理和优化技术。'
head:
    - ['meta', { property: 'og:title', content: '课程 25 - 绘制模式与笔刷' }]
---

<script setup>
import DrawRect from '../../components/DrawRect.vue'
</script>

# 课程 25 - 绘制模式与笔刷

在 [课程 14 - 画布模式] 中我们介绍了手型和选择模式，在本节课中我们将介绍绘制模式：包括矩形和椭圆，以及更加自由的笔刷模式。

## 矩形绘制模式 {#draw-rect-mode}

<DrawRect />

首先增加以下模式，绘制椭圆的实现几乎一致，就不重复介绍了：

```ts
export enum Pen {
    HAND = 'hand',
    SELECT = 'select',
    DRAW_RECT = 'draw-rect', // [!code ++]
    DRAW_Ellipse = 'draw-ellipse', // [!code ++]
}
```

在 [课程 18 - 使用 ECS 重构] 中我们介绍了 ECS 架构，这里创建一个 `DrawRect` 的 System，一旦进入该模式，就将鼠标样式设置为 `crosshair`：

```ts
import { System } from '@lastolivegames/becsy';

export class DrawRect extends System {
    execute() {
        if (pen !== Pen.DRAW_RECT) {
            return;
        }

        const input = canvas.write(Input);
        const cursor = canvas.write(Cursor);

        cursor.value = 'crosshair';
        //...
    }
}
```

然后随着鼠标拖拽，在目标区域不断重绘矩形，类似选择模式中的框选效果。当鼠标抬起完成矩形的创建，从绘制矩形模式切换到选择模式：

```ts
export class DrawRect extends System {
    execute() {
        //...
        // 拖拽，绘制辅助 UI
        this.handleBrushing(api, x, y);

        if (input.pointerUpTrigger) {
            // 鼠标抬起，创建矩形
            const node: RectSerializedNode = {
                id: uuidv4(),
                type: 'rect',
                x,
                y,
                width,
                height,
            };
            api.setPen(Pen.SELECT); // 模式切换
            api.updateNode(node);
            api.record(); // 保存历史记录
        }
    }
}
```

### 绘制矩形 {#redraw-rect}

### 绘制尺寸标签 {#size-label}

## 笔刷模式 {#brush-mode}

在 Figma 中称作 [Draw with illustration tools]

## 扩展阅读 {#extended-reading}

-   [Draw with illustration tools]
-   [p5.brush]

[课程 14 - 画布模式]: /zh/guide/lesson-014
[课程 18 - 使用 ECS 重构]: /zh/guide/lesson-018
[Draw with illustration tools]: https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools
[p5.brush]: https://github.com/acamposuribe/p5.brush
