---
outline: deep
---

# 课程 9 - 手绘风格

除了拖拽画布，

## 拖拽图形

无限画布通常都支持很多模式，例如选择模式、手型模式、记号笔模式等等。不同模式下同样的交互动作对应不同的操作。例如选择模式下，在画布上拖拽对应框选操作；在手型模式下会拖拽整个画布；记号笔模式下则是自由绘制笔迹。

让我们为画布增加选择和手型模式：

```ts
export enum CanvasMode {
  SELECT,
  HAND,
}

class Canvas {
  #mode: CanvasMode;
  setMode(mode: CanvasMode) {}
}
```
