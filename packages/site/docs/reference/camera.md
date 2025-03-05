---
outline: deep
publish: false
---

See [Lesson 4 - Camera] for more information.

Import the `Camera` class from `@infinite-canvas-tutorial/core`.

```ts
import { Camera } from '@infinite-canvas-tutorial/core';
const camera = new Camera(100, 100);
```

Or get it from the already created [Canvas]:

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

[Lesson 4 - Camera]: /guide/lesson-004
[Canvas]: /reference/canvas
