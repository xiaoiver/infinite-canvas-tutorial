---
outline: deep
description: 'Integrated Flex layout system with support for the Yoga typesetting engine. Exploring layout engine development within the WebGL environment to achieve responsive interface design.'
publish: false
---

<script setup>
import YogaGap from '../components/YogaGap.vue'
import YogaFlexBasisGrowShrink from '../components/YogaFlexBasisGrowShrink.vue'
import YogaAlignItemsJustifyContent from '../components/YogaAlignItemsJustifyContent.vue'
import YogaMinMaxWidthHeight from '../components/YogaMinMaxWidthHeight.vue'
</script>

# Lesson 33 - Layout engine

Browsers implement several layout systems, such as Flexbox, Grid, and Block, making it easy to achieve effects like “centering” without manually calculating node positions.

For infinite canvas-like applications operating outside the DOM, you must implement your own layout engine logic. Figma has implemented Auto Layout, where `Grid` is currently in beta, while `Vertical` and `Horizontal` correspond to CSS's `flex-direction` property. For details, see: [Figma - Guide to auto layout]

![source: https://www.figma.com/community/file/1284819663700490015](/figma-flexbox.png)

Tools focused on design-to-code typically provide this capability. For details, see:
[Layout in pencil.dev]

> A parent object can take over the sizing and positioning of its children using a flexbox-style layout system via properties like layout, justifyContent and alignItems.

```ts
export interface Layout {
    /** Enable flex layout. None means all children are absolutely positioned and will not be affected by layout properties. Frames default to horizontal, groups default to none. */
    layout?: 'none' | 'vertical' | 'horizontal';
    /** The gap between children in the main axis direction. Defaults to 0. */
    gap?: NumberOrVariable;
    layoutIncludeStroke?: boolean;
    /** The Inside padding along the edge of the container */
    padding?:
        | /** The inside padding to all sides */ NumberOrVariable
        | /** The inside horizontal and vertical padding */ [
              NumberOrVariable,
              NumberOrVariable,
          ]
        | /** Top, Right, Bottom, Left padding */ [
              NumberOrVariable,
              NumberOrVariable,
              NumberOrVariable,
              NumberOrVariable,
          ];
    /** Control the justify alignment of the children along the main axis. Defaults to 'start'. */
    justifyContent?:
        | 'start'
        | 'center'
        | 'end'
        | 'space_between'
        | 'space_around';
    /** Control the alignment of children along the cross axis. Defaults to 'start'. */
    alignItems?: 'start' | 'center' | 'end';
}
```

![source: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Basic_concepts](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Flexible_box_layout/Basic_concepts/basics1.svg)

In this lesson, we will implement Flexbox layouts and support CSS properties with the same names on nodes:

```ts
const parent = {
    id: 'parent',
    type: 'rect',
    x: 100,
    y: 100,
    width: 200,
    height: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};
const child = {
    id: 'child',
    parentId: 'parent',
    type: 'rect',
    width: 50,
    height: 50,
};
```

## Yoga {#yoga}

Using the [Yoga] layout engine in the frontend is only possible via WASM. Currently, there are several available implementations:

-   [yoga-layout-prebuilt] It's been a long time since the last update.
-   [yoga-wasm-web] Early [satori] used it to convert HTML into SVG and compute layouts. [taffy] also has related [example](https://github.com/DioxusLabs/taffy/pull/394#issuecomment-1476430705)
-   [yoga-layout] We recommend using it, and our implementation is also based on it. [react-pdf/yoga] also use it.

It is worth noting that Yoga also applies to 3D space, provided that a plane is specified. For details, see:[react-three-flex]

> Another important difference with DOM Flexbox is that you have to specify the plane of the container in 3D. The elements will be positioned in the 2D plane given by the two axes, using width and height calculated along the two axes.

![axes_orientation](https://github.com/pmndrs/react-three-flex/raw/master/docs/axes_orientation.png)

### pixijs/layout {#pixijs-layout}

[pixijs/layout] is also implemented using Yoga. Similar implementations include: [pixi-flex-layout]

```ts
const container = new Container({
    layout: {
        width: '80%',
        height: '80%',
        gap: 4,
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignContent: 'center',
    },
});
```

### troika-flex-layout {#troika-flex-layout}

[troika-flex-layout], computed in a WebWorker using [yoga-layout-prebuilt]:

```ts
import { requestFlexLayout } from 'troika-flex-layout';

// Describe your layout style tree, with a unique id for each node:
const styleTree = {
    id: 'root',
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    children: [
        {
            id: 'child',
            width: '50%',
            height: '50%',
        },
    ],
};

// Initiate a layout request with a callback function:
requestFlexLayout(styleTree, (results) => {
    // The results are a mapping of node ids to layout boxes:
    // {
    //   root: { left: 0, top: 0, width: 100, height: 100 },
    //   child: { left: 25, top: 25, width: 50, height: 50 }
    // }
});
```

## Alternatives to Yoga {#alternatives-to-yoga}

Pure JS implementations:

-   [Motion Canvas Layouts] Native browser-based Flexbox implementation, eliminating the need to reimplement complex layout algorithms
-   [Simplifying WebGL: Building an Effective Layout Engine]

Rust implementations:

-   [stretch] implements Flexbox and provides a `stretch-layout` WASM binding, but it has not been maintained for a long time.
-   [taffy] A high-performance UI layout library written in Rust, currently implementing several CSS layout algorithms including Flexbox, Grid, and Block. However, WASM bindings are not yet available. For details, see: [taffy wasm bindings]

## Our implementation {#our-implementation}

We chose the official [yoga-layout]. Besides the familiar Flexbox, it also provides basic layout properties such as Margin and Padding.

```ts
import { loadYoga } from 'yoga-layout/load';

class YogaSystem extends System {
    async prepare() {
        Yoga = await loadYoga();
    }
}
```

A layout tree parallel to the scene graph needs to be constructed.

First, we need to build a layout tree parallel to the scene graph. Its node structure is as follows:

```ts
interface StyleTreeNode {
    id: string;
    top?: number | string;
    left?: number | string;
    width?: number | string;
    height?: number | string;
    children: StyleTreeNode[];
    padding?: number | number[];
    margin?: number | number[];
    gap?: number;
    rowGap?: number;
    columnGap?: number;
}
```

Then at the right time, convert the layout tree into a Yoga tree, run the layout computation, and apply the results to the scene graph nodes:

```ts
const root = Yoga.Node.createWithConfig(yogaConfig);
populateNode(root, styleTree);

root.calculateLayout();
const results = Object.create(null);
walkStyleTree(styleTree, (styleNode) => {
    const { id, yogaNode } = styleNode;
    results[id] = {
        x: yogaNode.getComputedLeft(),
        y: yogaNode.getComputedTop(),
        width: yogaNode.getComputedWidth(),
        height: yogaNode.getComputedHeight(),
    };
});
root.freeRecursive();
```

### When to do layout {#when-to-do-layout}

When the Flexbox container’s own size changes, layout must be recomputed and applied to its children’s positions and sizes. Likewise when new children are added to the container.

```ts
class YogaSystem extends System {
    private readonly bounds = this.query((q) =>
        q.addedOrChanged.and.removed
            .with(ComputedBounds)
            .trackWrites.and.with(Flex),
    );

    execute() {
        this.bounds.addedOrChanged.forEach((entity) => {
            // relayout
        });
    }
}
```

### AlignItems & JustifyContent {#align-items-justify-content}

The most common use is centering content with these two properties:

<YogaAlignItemsJustifyContent />

### Gap {#gap}

The following example demonstrates the effect of `padding` and `gap`:

```ts
const parent = {
    id: 'yoga-gap-parent',
    type: 'rect',
    x: 100,
    y: 100,
    width: 200,
    height: 250,
    fill: 'grey',
    display: 'flex',
    padding: 10,
    flexWrap: 'wrap',
    gap: 10,
    zIndex: 0,
};
```

<YogaGap />

### Flex Basis, Grow, and Shrink {#flex-basis-grow-shrink}

[Flex Basis, Grow, and Shrink]

> Flex grow accepts any floating point value >= 0, with 0 being the default value. A container will distribute any remaining space among its children weighted by the child’s flex grow value.

<YogaFlexBasisGrowShrink />

### Min/Max Width and Height {#min-max-width-height}

[Min/Max Width and Height]

<YogaMinMaxWidthHeight />

## Extended reading {#extended-reading}

-   [Simplifying WebGL: Building an Effective Layout Engine]
-   [clay]
-   [react-three-flex]
-   [Figma - Guide to auto layout]

[Yoga]: https://yogalayout.com/
[yoga-layout-prebuilt]: https://github.com/vadimdemedes/yoga-layout-prebuilt
[yoga-wasm-web]: https://github.com/shuding/yoga-wasm-web
[yoga-layout]: https://www.yogalayout.dev/
[taffy]: https://github.com/DioxusLabs/taffy
[Simplifying WebGL: Building an Effective Layout Engine]: https://blog.certa.dev/building-a-layout-engine-for-webgl
[troika-flex-layout]: https://github.com/protectwise/troika/blob/main/packages/troika-flex-layout/
[clay]: https://github.com/nicbarker/clay
[Motion Canvas Layouts]: https://motioncanvas.io/docs/layouts
[pixijs/layout]: https://github.com/pixijs/layout
[pixi-flex-layout]: https://github.com/fireveined/pixi-flex-layout/
[react-three-flex]: https://github.com/pmndrs/react-three-flex/
[satori]: https://github.com/vercel/satori
[stretch]: https://github.com/vislyhq/stretch
[taffy wasm bindings]: https://github.com/DioxusLabs/taffy/pull/394
[Figma - Guide to auto layout]: https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout
[react-pdf/yoga]: https://github.com/diegomura/react-pdf/blob/master/packages/layout/src/yoga/index.ts
[Flex Basis, Grow, and Shrink]: https://www.yogalayout.dev/docs/styling/flex-basis-grow-shrink
[Min/Max Width and Height]: https://www.yogalayout.dev/docs/styling/min-max-width-height
[Layout in pencil.dev]: https://docs.pencil.dev/for-developers/the-pen-format#layout
