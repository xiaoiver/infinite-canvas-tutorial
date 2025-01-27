---
outline: deep
publish: false
---

关于相机的相关内容可以参考：[课程 4 - 相机]。

从 `@infinite-canvas-tutorial/core` 中导入 `Camera` 类并创建。

```ts
import { Camera } from '@infinite-canvas-tutorial/core';
const camera = new Camera(100, 100);
```

或者从已经创建的[画布]中获取：

```ts
const camera = canvas.camera;
```

## constructor

## projectionMatrix

## viewMatrix

## viewProjectionMatrix

## viewProjectionMatrixInv

## matrix

## zoom

## x

## y

## rotation

## width

## height

## createLandmark

## gotoLandmark

## cancelLandmarkAnimation

## viewport2Canvas

## canvas2Viewport

[课程 4 - 相机]: /zh/guide/lesson-004
[画布]: /zh/reference/canvas
