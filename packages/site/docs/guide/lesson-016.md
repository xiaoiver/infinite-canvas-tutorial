---
outline: deep
publish: false
---

<script setup>
import WebFontLoader from '../components/WebFontLoader.vue';
import Opentype from '../components/Opentype.vue';
import Harfbuzz from '../components/Harfbuzz.vue';
import TeXMath from '../components/TeXMath.vue';
import TextDropShadow from '../components/TextDropShadow.vue';
import TextStroke from '../components/TextStroke.vue';
import PhysicalText from '../components/PhysicalText.vue';
import TextEditor from '../components/TextEditor.vue';
</script>

# Lesson 16 - Advanced Text Features

In the previous lesson, we introduced the principles of SDF-based text rendering, experimented with ESDT and MSDF to improve rendering quality, and mentioned the advanced text rendering features that CanvasKit provides compared to Canvas.

In this lesson, we'll first look at rendering methods beyond SDF, then discuss and try to implement features like: decorative lines, shadows, text following paths. Finally, text should not only be renderable but also have good interaction - we'll discuss topics like input boxes, text selection, and A11y.

Let's first look at what text rendering methods are available besides SDF.

## Rendering Text with Bezier Curves {#render-text-with-bezier-curve}

Using Figma's SVG export feature, you can see that its text is also rendered using Paths. If we don't consider rendering performance and CJK characters, using Bezier curves to render text is indeed a good choice. To obtain vector information for characters in a browser environment, we can use:

-   [opentype.js]
-   use-gpu uses [use-gpu-text] which is wrapped based on [ab-glyph](https://github.com/alexheretic/ab-glyph)
-   More and more applications are using [harfbuzzjs], see: [State of Text Rendering 2024]. For example, [font-mesh-pipeline] is a simple demonstration

Below we'll show examples of rendering text using opentype.js and harfbuzzjs, both of which support the `ttf` font format.

### opentype.js {#opentypejs}

opentype.js provides the `getPath` method, which completes Shaping and obtains SVG [path-commands] given text content, position, and font size.

```ts
opentype.load('fonts/Roboto-Black.ttf', function (err, font) {
    const path = font.getPath('Hello, World!', 0, 0, 32); // x, y, fontSize
    // convert to svg path definition
});
```

<Opentype />

### harfbuzzjs {#harfbuzzjs}

First initialize harfbuzzjs WASM using Vite's ?init syntax. Then load the font file and create a font object.

```ts
import init from 'harfbuzzjs/hb.wasm?init';
import hbjs from 'harfbuzzjs/hbjs.js';

const instance = await init();
hb = hbjs(instance);

const data = await (
    await window.fetch('/fonts/NotoSans-Regular.ttf')
).arrayBuffer();
blob = hb.createBlob(data);
face = hb.createFace(blob, 0);
font = hb.createFont(face);
font.setScale(32, 32); // Set font size
```

Then create a buffer object and add text content. As mentioned before, harfbuzz doesn't handle BiDi, so we need to manually set the text direction. Finally, call hb.shape method to perform Shaping calculation.

```ts
buffer = hb.createBuffer();
buffer.addText('Hello, world!');
buffer.guessSegmentProperties();
// TODO: use BiDi
// buffer.setDirection(segment.direction);

hb.shape(font, buffer);
const result = buffer.json(font);
```

Now we have the glyph data, and we can use Path to draw it

```ts
result.forEach(function (x) {
    const d = font.glyphToPath(x.g);
    const path = new Path({
        d,
        fill: '#F67676',
    });
});
```

<Harfbuzz />

### TeX math rendering {#tex-math-rendering}

We can use [MathJax] to render TeX mathematical formulas, convert them to SVG, and then render them using Path. Here we follow the approach from [LaTeX in motion-canvas] to get SVGElement:

```ts
const JaxDocument = mathjax.document('', {
    InputJax: new TeX({ packages: AllPackages }),
    OutputJax: new SVG({ fontCache: 'local' }),
});

const svg = Adaptor.innerHTML(JaxDocument.convert(formula));
const parser = new DOMParser();
const doc = parser.parseFromString(svg, 'image/svg+xml');
const $svg = doc.documentElement;
```

Then use the method introduced in [Lesson 10 - From SVGElement to Serialized Node] to convert SVGElement to graphics and add them to the canvas.

```ts
const root = await deserializeNode(fromSVGElement($svg));
```

<TeXMath />

## Text stroke {#text-stroke}

Both [strokeText] in Canvas and [-webkit-text-stroke] in CSS provide text strokes. The good news is that strokes are naturally easy to implement in SDF:

```glsl
if (strokeWidth > 0.0 && strokeColor.a > 0.0) {
    float fillAlpha = smoothstep(buff - gamma_scaled, buff + gamma_scaled, dist);
    float strokeThreshold = buff - strokeWidth / fontSize;
    float strokeAlpha = smoothstep(strokeThreshold - gamma_scaled, strokeThreshold + gamma_scaled, dist);

    vec4 finalColor = mix(strokeColor, fillColor, fillAlpha);
    outputColor = finalColor;
    opacity *= strokeAlpha;
}
```

<TextStroke />

## Text Decoration {#text-decoration}

Early browsers had a crude implementation of [text-decoration], as exemplified by `underline`, from which the following image is taken: [Crafting link underlines on Medium]

![Ugly. Distracting. Unacceptable underlines](https://miro.medium.com/v2/resize:fit:2000/format:webp/1*RmN57MMY_q9-kEt7j7eiVA.gif)

> The perfect underline should be visible, but unobtrusive — allowing people to realize what’s clickable, but without drawing too much attention to itself. It should be positioned at just the right distance from the text, sitting comfortably behind it for when descenders want to occupy the same space:

![Beautiful underline](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*5iD2Znv03I2XR5QI3KLJrg.png)

[underlineJS]

## Shadows {#dropshadow}

Pixi.js provides [DropShadowFilter], but we can implement it directly in SDF without using post-processing. Use `shadowOffset` and `shadowBlurRadius` to control the offset and blurring of the SDF texture.

```glsl
// @see https://github.com/soimy/pixi-msdf-text/blob/master/src/msdf.frag#L49
vec3 shadowSample = texture2D(uSampler, vTextureCoord - shadowOffset).rgb;
float shadowDist = median(shadowSample.r, shadowSample.g, shadowSample.b);
float distAlpha = smoothstep(0.5 - shadowSmoothing, 0.5 + shadowSmoothing, shadowDist);
vec4 shadow = vec4(shadowColor, shadowAlpha * distAlpha);
gl_FragColor = mix(shadow, text, text.a);
```

<TextDropShadow />

## Text Along Path {#text-along-path}

In the Figma community, many users are looking forward to this feature, for example: [Make text follow a path or a circle]

In SVG, this can be achieved through [textPath], see: [Curved Text Along a Path]

```html
<path
    id="curve"
    d="M73.2,148.6c4-6.1,65.5-96.8,178.6-95.6c111.3,1.2,170.8,90.3,175.1,97"
/>
<text width="500">
    <textPath xlink:href="#curve"> Dangerous Curves Ahead </textPath>
</text>
```

Skia provides the `MakeOnPath` method, see [Draw text along a path]:

```ts
const textblob = CanvasKit.TextBlob.MakeOnPath(text, skPath, skFont);
canvas.drawTextBlob(textblob, 0, 0, textPaint);
```

In Mapbox, placing labels along roads and rivers is a common scenario, see [Map Label Placement in Mapbox GL]

![Map Label Placement in Mapbox GL](https://miro.medium.com/v2/resize:fit:480/format:webp/0*qVAASwC-tjIXnjax.gif)

Kittl provides a [Easily Type Text On Any Path] tool.

A more appropriate reference implementation comes from Fabricjs, see: [fabricjs - text on path].

## More Friendly Interaction {#more-friendly-interaction}

Browser-native `<textarea>`s provide convenient features such as blinking cursors, selections, keyboard control, copy and paste, etc. If you wish to implement these features from scratch based on `<canvas>`, it would be a very tedious task, e.g. [fabricjs - loading custom fonts] and google docs, so we won't be choosing this option.

<TextEditor />

### Text Input {#textarea}

Below, from Figma, you can see that the native `<textarea>` element is used to position itself on the canvas, and when Text is double-clicked, the input box is displayed:

![textarea in figma](/textarea-in-figma.png)

This is also used in excalidraw, see: [textWysiwyg.tsx]。

![Text editor in excalidraw](/excalidraw-text-editor.png)

We also add a `<ic-text-editor>` element to make it fit the Text rendering in the canvas as closely as possible. The native `<textarea>` element is stylistically reset, e.g. not showing borders and backgrounds. The `fontFamily`, `fontSize`, and `color` properties all have corresponding CSS properties that can be set directly, but there are a number of factors that need to be taken into account when using absolute positioning:

```ts
@customElement('ic-text-editor')
export class TextEditor extends LitElement {
    static styles = css`
        :host {
            position: absolute;
        }
        textarea {
            position: absolute;
            display: none;
            margin: 0;
            padding: 0;
            border: 0;
            outline: 0;
            resize: none;
            background: transparent;
        }
    `;

    @query('textarea')
    editable: HTMLTextAreaElement;

    render() {
        return html`<textarea></textarea>`;
    }
}
```

First you need to convert the mouse event position coordinates of the double click to the viewport coordinate system:

```ts
const { x, y } = this.api.canvas2Viewport({
    x: this.node.x,
    y: this.node.y,
});

this.editable.style.left = `${x}px`;
this.editable.style.top = `${y}px`;
```

The current zoom level of the camera then needs to be taken into account:

```ts
const { zoom } = this.api.getCamera().read(ComputedCamera);
this.editable.style.transform = `scale(${zoom})`;
this.editable.style.transformOrigin = `left top`;
```

Finally, we want scrolling on the `<textarea>` element not to trigger the browser's default behavior, but to cut through it and trigger it on the `<canvas>` element, which performs the camera pan and zoom operations:

```ts
handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const newWheelEvent = new WheelEvent('wheel', {});
    $canvas.dispatchEvent(newWheelEvent);
};
```

The effect is as follows:

![pan and zoom with camera](/text-editor-with-camera.gif)

### Calculate size when text changed {#calculate-size}

The width and height of `<textarea>` needs to be recalculated and set when typing and pasting text in real time.

### Handle Tab {#in-and-outdent}

The default behavior of pressing the Tab key in `<textarea>` is to switch focus to the next element. We want it to be the same as the code editor.

[excalidraw - handle tab]

### Text Selection {#text-selection}

Once you have support for overlaying textarea on Text, it's easy to implement this feature.

## Special Effects {#special-effects}

### Loading Web Fonts {#load-web-font}

For solutions using Canvas2D API to generate SDF, just use [webfontloader] to load fonts first, then specify the font using `fontFamily`.

```ts
import WebFont from 'webfontloader';
WebFont.load({
    google: {
        families: ['Gaegu'], // specify font
    },
    active: () => {
        const text = new Text({
            x: 150,
            y: 150,
            content: 'Hello, world',
            fontFamily: 'Gaegu', // specify font
            fontSize: 55,
            fill: '#F67676',
        });
    },
});
```

<WebFontLoader />

### Material Design on the GPU {#material-design-on-the-gpu}

[Material Design on the GPU] introduce a material effect based on SDF text, using normal maps and lighting to simulate ink spreading on paper. We don't need to consider lighting, just use simplex noise to implement it, and add multiple absorption effects:

```js
import { simplex_2d } from './simplex-2d';
import { aastep } from './aastep';
export const absorb = /* wgsl */ `
  ${aastep}
  ${simplex_2d}
  float absorb(float sdf, vec2 uv, float scale, float falloff) {
    float distort = sdf + snoise(uv * scale) * falloff;
    return aastep(0.5, distort);
  }
`;
```

<PhysicalText />

## Extended Reading {#extended-reading}

-   [Material Design on the GPU]
-   [Make text follow a path or a circle]
-   [Curved Text Along a Path]
-   [Draw text along a path]
-   [textPath]
-   [Map Label Placement in Mapbox GL]

[Material Design on the GPU]: https://mattdesl.svbtle.com/material-design-on-the-gpu
[Make text follow a path or a circle]: https://forum.figma.com/t/make-text-follow-a-path-or-a-circle/23476/34
[Curved Text Along a Path]: https://css-tricks.com/snippets/svg/curved-text-along-path/
[Draw text along a path]: https://fiddle.skia.org/c/@Canvas_drawTextRSXform
[textPath]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/textPath
[Map Label Placement in Mapbox GL]: https://blog.mapbox.com/map-label-placement-in-mapbox-gl-c6f843a7caaa
[font-mesh-pipeline]: https://github.com/beanandbean/font-mesh-pipeline
[opentype.js]: https://github.com/opentypejs/opentype.js
[use-gpu-text]: https://gitlab.com/unconed/use.gpu/-/tree/master/rust/use-gpu-text
[harfbuzzjs]: https://github.com/harfbuzz/harfbuzzjs
[State of Text Rendering 2024]: https://behdad.org/text2024/
[webfontloader]: https://github.com/typekit/webfontloader
[DropShadowFilter]: https://pixijs.io/filters/docs/DropShadowFilter.html
[MathJax]: https://github.com/mathjax/MathJax-src
[LaTeX in motion-canvas]: https://github.com/motion-canvas/motion-canvas/issues/190
[Lesson 10 - From SVGElement to Serialized Node]: /guide/lesson-010#svgelement-to-serialized-node
[path-commands]: https://github.com/opentypejs/opentype.js?tab=readme-ov-file#path-commands
[text-decoration]: https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration
[Easily Type Text On Any Path]: https://www.kittl.com/article/easily-type-text-on-any-path
[textWysiwyg.tsx]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/wysiwyg/textWysiwyg.tsx
[fabricjs - text on path]: https://fabricjs.com/demos/text-on-path/
[fabricjs - loading custom fonts]: https://fabricjs.com/demos/loading-custom-fonts/
[excalidraw - handle tab]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/wysiwyg/textWysiwyg.tsx#L412-L429
[underlineJS]: https://github.com/wentin/underlineJS
[Crafting link underlines on Medium]: https://medium.design/crafting-link-underlines-on-medium-7c03a9274f9
[-webkit-text-stroke]: https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-text-stroke
[strokeText]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/strokeText
