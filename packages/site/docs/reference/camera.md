---
outline: deep
publish: false
---

For camera-related content, refer to: [Lesson 4 - Camera]. After [Getting the API], you can call the related methods:

```ts
api.createLandmark();
```

## createLandmark

Create a Landmark that represents the camera state

```ts
createLandmark(params: Partial<Landmark> = {}): Partial<Landmark>
```

Landmark includes the following properties:

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

Switch the camera to a Landmark, with optional smooth transition animation parameters:

```ts
gotoLandmark(
    landmark: Partial<Landmark>,
    options: Partial<LandmarkAnimationEffectTiming> = {},
) {}
```

Parameters can refer to the Web Animation API's [getTiming] method:

```ts
interface LandmarkAnimationEffectTiming {
    easing: string;
    duration: number;
    onframe: (t: number) => void;
    onfinish: () => void;
}
```

The parameters are as follows:

-   `easing` Easing function. Currently only supports `'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'`
-   `duration` Animation duration. `0` means no animation effect
-   `onframe` Callback function. Called on every frame during the animation
-   `onfinish` Callback function. Called when the animation finishes

Methods like [zoomTo] are implemented based on this method.

## cancelLandmarkAnimation

Cancel the ongoing camera animation.

## zoomTo

```ts
zoomTo(zoom: number, effectTiming?: Partial<LandmarkAnimationEffectTiming>) {}
```

For example, set the zoom level to `2`

```ts
api.zoomTo(2);
```

## fitToScreen

Place the bounding box composed of all canvas content at the center of the viewport, ensuring all content can be accommodated:

```ts
fitToScreen(effectTiming?: Partial<LandmarkAnimationEffectTiming>)
```

## fillScreen

Fill the viewport as much as possible with the bounding box composed of all canvas content, which may not display all content:

```ts
fillScreen(effectTiming?: Partial<LandmarkAnimationEffectTiming>)
```

## viewport2Canvas

Transform a point from the Viewport coordinate system to the Canvas coordinate system.

```ts
viewport2Canvas({ x, y }: IPointData): IPointData {}
```

## canvas2Viewport

Transform a point from the Canvas coordinate system to the Viewport coordinate system.

```ts
canvas2Viewport({ x, y }: IPointData): IPointData {}
```

For example, when implementing a text input box, you need to place a `<textarea>` at the specified Canvas coordinates

```ts
// text-editor.ts
const { x, y } = this.api.canvas2Viewport({
    x: this.node.x,
    y: this.node.y,
});

this.editable.style.left = `${x}px`;
this.editable.style.top = `${y}px`;
```

[Lesson 4 - Camera]: /guide/lesson-004
[Getting the API]: /reference/create-app#use-api
[zoomTo]: /reference/camera#zoomto
[getTiming]: https://developer.mozilla.org/en-US/docs/Web/API/AnimationEffect/getTiming
