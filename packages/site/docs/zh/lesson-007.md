---
outline: deep
---

# 课程 7 - UI 组件

在这节课中你将学习到以下内容：

## Web components

在选择组件库时，我不希望它绑定在某个具体的框架实现上。基于 Web components 的[Shoelace] 组件库是一个不错的选择，它同时支持 React、Vue 和 Angular。

由于本教程静态站点使用 [VitePress] 编写，因此在示例页面中使用了 [Vue 的接入方式]。

## 监听页面变化

```html
<sl-resize-observer ref="resizeObserverRef"></sl-resize-observer>
```

```ts
$resizeObserver.addEventListener('sl-resize', (event) => {
  const { width } = event.detail.entries[0].contentRect;
  resize(width, 500);
});
```

## 缩放组件

下图是 Miro 的缩放组件：

![miro toolbar](/miro-toolbar.png)

我们使用

```html
<sl-icon-button
  name="plus-lg"
  label="Zoom in"
  @click="() => canvas.zoomIn()"
></sl-icon-button>
```

```ts
canvas.camera;
```

[Shoelace]: https://shoelace.style/
[VitePress]: https://vitepress.dev/
[Vue 的接入方式]: https://shoelace.style/frameworks/vue
