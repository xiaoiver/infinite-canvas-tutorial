# @infinite-canvas-tutorial/lottie

Import a supported subset of Lottie JSON into ECS nodes and keyframes.

```ts
import { inspectLottie, loadAnimation } from '@infinite-canvas-tutorial/lottie';

const diagnostics = inspectLottie(data); // Does not mutate JSON or evaluate expressions.
const animation = loadAnimation(data, { loop: true, autoplay: false });
await api.edit(() => animation.render(api), { capture: 'NEVER' });
animation.play();
animation.pause();
animation.goTo(30, true); // Composition-relative frame; default unit is seconds.
animation.setSpeed(2); // Positive speed, preserved when reversing.
animation.setDirection(-1);
animation.playSegments([60, 30]); // Reverse frame range; honors loop.
animation.stop(); // Pause at frame zero and clear the segment.
await animation.destroy(); // Cancel playback and remove the imported node tree.
```

An instance belongs to one canvas. Repeated rendering on that canvas is a no-op; destruction is idempotent and also runs on canvas teardown. Cancel pending fetches and queued edits when your component unmounts. `loop: true` repeats indefinitely, `false` plays once, and a number counts extra repeats. Control playback through the player; the ECS controllers returned by `getAnimations()` are sampled from one composition clock.

`animation.getDiagnostics()` and the optional `onDiagnostic` load callback expose known compatibility gaps as `{ code, severity, path, message }`. Severity is `partial` or `unsupported`; `path` is a JSON Pointer into the source. Import continues. An empty diagnostic list does not guarantee compatibility.

Basic shape layers, paths, groups and 2D transforms are available. Trim Paths currently approximates stroke coverage with dashes, with limitations for filled geometry, multiple paths, existing dash patterns, animated zero-length round caps, direction and modifier ordering. Repeater, text, effects, track mattes, skew, 3D and Lottie blend mapping are not implemented. Masks, images, timing, gradients, spatial motion and expressions have incomplete support.

PolyStar stars and polygons support point count, position, rotation, inner/outer radius and roundness animation, including temporal easing and holds. Fractional point counts are floored like lottie-web 5.13. Geometry is generated after sampling parameters, including fractional-frame and reverse seeks. These procedural tracks currently require the original Lottie JSON for reload; plain ECS keyframe serialization and the animation editor do not preserve them. Spatial tangents and modifier combinations retain their existing limitations. Curved strokes inherit existing ECS tessellation alpha seams; stroke reference tests cover silhouette and color rather than alpha parity.

See the [support matrix and interactive examples](https://infinitecanvas.cc/guide/lesson-036#lottie-compatibility). Expressions are baked at import using a limited shape-layer environment; the default engine is `lottie-web`. Set `expressions: false` to disable expression evaluation.
