---
outline: deep
description: '无限画布的相机 API：平移、缩放、旋转与投影。详见课程 4。'
---

关于相机的相关内容可以参考：[课程 4 - 相机]。在 [获取 API] 后，可以调用相关方法：

```ts
api.createLandmark();
```

## 相机状态 {#get-set-camera-state}

通过 `get/setAppState` 可以获取或者设置相机状态：

```ts
cameraZoom: number;
cameraX: number;
cameraY: number;
cameraRotation: number;
cameraZoomFactor: number; // 缩放速度
```

## setCameraView（ECS）

在安全写入阶段提交临时 2D 导航，不创建文档或历史提交：

```ts
const applied = await api.setCameraView({ x: 100, y: 50, zoom: 0.5 });
```

写入阶段前的连续调用会合并，采用最后复制的位置与缩放；省略旋转时保留最近排队或已应用的旋转。
`api.edit()` 会分隔合并组，保持调用顺序；写入阶段内再次排队的请求在下一帧执行。
初始化后的相机会在早期 Edit 阶段更新，并在同一次执行中完成相机计算和渲染；首次相机初始化仍沿用已有的延后状态处理。

Promise 在状态应用后完成，不代表已经渲染；画布销毁时返回 `false`，非法或无法表示的数值会拒绝。
此方法只修改相机状态，保留未提交的文档改动和重做栈。原有 `runAtNextTick` 回调仍在后期执行。
Core 的相机 setter 与 `canvas.camera.gotoLandmark(view, { duration: 0 })` 会同步更新矩阵；两端的即时导航都会取消旧相机动画。

## createLandmark

创建一个代表相机状态的 Landmark

```ts
createLandmark(params: Partial<Landmark> = {}): Partial<Landmark>
```

Landmark 包括以下属性：

```ts
interface Landmark {
    x: number;
    y: number;
    zoom: number;
    viewportX: number;
    viewportY: number;
    rotation: number;
}
```

## gotoLandmark

将相机切换到 Landmark，可以设置平滑过渡的动画参数：

```ts
gotoLandmark(
    landmark: Partial<Landmark>,
    options: Partial<LandmarkAnimationEffectTiming> = {},
) {}
```

参数可以参考 Web Animation API 的 [getTiming] 方法：

```ts
interface LandmarkAnimationEffectTiming {
    easing: string;
    duration: number;
    onframe: (t: number) => void;
    onfinish: () => void;
}
```

其中各参数如下：

-   `easing` 缓动函数。目前仅支持 `'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'`
-   `duration` 动画持续时间。`0` 代表无动画效果
-   `onframe` 回调函数。动画过程中每一帧都会调用
-   `onfinish` 回调函数。动画结束后调用

[zoomTo] 等方法都是基于该方法实现的。

## cancelLandmarkAnimation

取消进行中的相机动画。

## zoomTo

```ts
zoomTo(zoom: number, effectTiming?: Partial<LandmarkAnimationEffectTiming>) {}
```

例如将缩放等级设置为 `2`

```ts
api.zoomTo(2);
```

## fitToScreen

将全部画布内容组成的包围盒放置在视口中心，保证能容纳全部内容：

```ts
fitToScreen(effectTiming?: Partial<LandmarkAnimationEffectTiming>)
```

## fillScreen

将全部画布内容组成的包围盒尽可能填充视口，可能无法展示全部内容：

```ts
fillScreen(effectTiming?: Partial<LandmarkAnimationEffectTiming>)
```

## viewport2Canvas

将 Viewport 坐标系下的点变换到 Canvas 坐标系下。

```ts
viewport2Canvas({ x, y }: IPointData): IPointData {}
```

## canvas2Viewport

将 Canvas 坐标系下的点变换到 Viewport 坐标系下。

```ts
canvas2Viewport({ x, y }: IPointData): IPointData {}
```

例如在实现文本输入框时，需要在指定 Canvas 坐标下放置 `<textarea>`

```ts
// text-editor.ts
const { x, y } = this.api.canvas2Viewport({
    x: this.node.x,
    y: this.node.y,
});

this.editable.style.left = `${x}px`;
this.editable.style.top = `${y}px`;
```

[课程 4 - 相机]: /zh/guide/lesson-004
[获取 API]: /zh/reference/create-app#use-api
[zoomTo]: /zh/reference/camera#zoomto
[getTiming]: https://developer.mozilla.org/en-US/docs/Web/API/AnimationEffect/getTiming
