---
outline: deep
description: 'Draw rectangle mode. Implementation of brush features, including line drawing algorithms to eliminate jitter and silky smooth drawing experience. Learn the implementation principles and optimization techniques of brush libraries such as p5.brush.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lesson 25 - Drawing mode and brush',
          },
      ]
---

<script setup>
import DrawRect from '../components/DrawRect.vue'
</script>

# Lesson 25 - Drawing mode and brush

在 [Lesson 14 - Canvas mode and auxiliary UI] 中我们介绍了手型和选择模式，在本节课中我们将介绍绘制模式：包括矩形和椭圆，以及更加自由的笔刷模式。

## Draw rect mode {#draw-rect-mode}

<DrawRect />

First add the following canvas mode. The implementation of drawing ellipses is almost identical, so I won't repeat the introduction:

```ts
export enum Pen {
    HAND = 'hand',
    SELECT = 'select',
    DRAW_RECT = 'draw-rect', // [!code ++]
    DRAW_Ellipse = 'draw-ellipse', // [!code ++]
}
```

In [Lesson 18 - Refactor with ECS] we introduced the ECS architecture, where a `DrawRect` System is created, and once in that mode, the cursor style is set to `crosshair`:

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

Then as the mouse is dragged, the rectangle is continually redrawn in the target area, similar to the box selection effect in selection mode. When the mouse is lifted to complete the creation of the rectangle, it switches from draw rectangle mode to selection mode:

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

### Redraw rect {#redraw-rect}

### Size label {#size-label}

## Brush mode {#brush-mode}

[Draw with illustration tools]

## Extended reading {#extended-reading}

-   [Draw with illustration tools]
-   [p5.brush]

[Lesson 14 - Canvas mode and auxiliary UI]: /guide/lesson-014
[Lesson 18 - Refactor with ECS]: /guide/lesson-018
[Draw with illustration tools]: https://help.figma.com/hc/en-us/articles/31440438150935-Draw-with-illustration-tools
[p5.brush]: https://github.com/acamposuribe/p5.brush
