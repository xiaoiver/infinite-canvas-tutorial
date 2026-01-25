---
outline: deep
description: ''
publish: false
---

<script setup>
import Binding from '../components/Binding.vue'
import BindingWithEllipse from '../components/BindingWithEllipse.vue'
import BindingOrthogonal from '../components/BindingOrthogonal.vue'
import BindingConstraint from '../components/BindingConstraint.vue'
</script>

# Lesson 31 - Bindings between shapes

In [Lesson 23 - Mindmap], we only focused on the layout algorithms for nodes and edges, without diving into interactions such as moving edges when nodes are moved. Similarly, in [Lesson 25 - Drawing arrows], the properties of lines and arrows did not include binding information. In this lesson, we will complete this functionality.

## Data structure {#data-structure}

### Linear elements in excalidraw {#excalidraw-linear-element}

In Excalidraw, connection lines (such as arrows) are represented in the data model as `ExcalidrawLinearElement`, which adds connection-related fields:

```ts
export declare type PointBinding = {
    elementId: ExcalidrawBindableElement['id'];
    focus: number;
    gap: number;
};
export declare type ExcalidrawLinearElement = _ExcalidrawElementBase &
    Readonly<{
        type: 'line' | 'arrow';
        points: readonly Point[];
        lastCommittedPoint: Point | null;
        startBinding: PointBinding | null;
        endBinding: PointBinding | null;
        startArrowhead: Arrowhead | null;
        endArrowhead: Arrowhead | null;
    }>;
```

As shown above, each arrow has optional `startBinding` and `endBinding` fields, which exist at a different semantic level than `points`. The former represents semantic constraints, while the latter `points` represents geometric representation. When both exist simultaneously, `points` needs to be recalculated. Additionally, there are start and end arrow styles (`startArrowhead/endArrowhead`). The `elementId` in `PointBinding` points to the connected shape (bindable elements such as rectangles, ellipses, text, images, etc.), while `focus` and `gap` are used to locate the connection point (a floating-point index and offset distance). For example, below is an example of an arrow element in JSON:

```ts
{
  "type": "arrow",
  // ... other properties omitted ...
  "startBinding": {
    "elementId": "xw25sQBsbd2mecyjTrYHA",
    "focus": -0.0227,
    "gap": 15.6812
  },
  "endBinding": null,
  "points": [[0,0],[0,109]],
  "startArrowhead": null,
  "endArrowhead": null
}
```

In this example, the arrow's `startBinding` points to a shape with ID `"xw25sQBsbd2mecyjTrYHA"`, and `focus` and `gap` define the connection position starting from that shape's boundary.

At the same time, each bound shape (such as a rectangle or ellipse) has a `boundElements` list in its basic data structure, used to record all arrows or text elements connected to it. This field type is typically `{ id: ExcalidrawLinearElement["id"]; type: "arrow"|"text"; }[] | null`. In other words, the connection between arrows and shapes is maintained bidirectionally: arrows record the target element ID they bind to, and target elements record the arrow IDs pointing to them.

### Bindings in tldraw {#tldraw-binding}

In tldraw, "connection lines" themselves are also shapes (default is arrow shape), and their connection relationships are represented through Binding objects. Each binding record exists separately in storage, representing the association between two shapes. For arrow connections, the `TLArrowBinding` type is used, which is a specialization of `TLBaseBinding<'arrow',TLArrowBindingProps>`. A typical arrow binding record example is as follows:

```ts
{
  id: 'binding:abc123',
  typeName: 'binding',
  type: 'arrow',           // Binding type is arrow
  fromId: 'shape:arrow1',  // Arrow shape ID (arrow shape departure end)
  toId:   'shape:rect1',   // Target shape ID (shape the arrow points to)
  props: {
    terminal: 'end',       // Which end of the arrow to bind to (start or end)
    normalizedAnchor: { x: 0.5, y: 0.5 }, // Normalized anchor point on target shape
    isExact: false,        // Whether arrow enters inside target shape
    isPrecise: true,       // Whether to use anchor point precisely, otherwise use shape center
    snap: 'edge',          // Snap mode (such as edge snapping)
  },
  meta: {}
}
```

Here, the `fromId/toId` fields associate arrows with targets through shape IDs, and `props` stores connection details (such as anchor points, alignment options, etc.)

### antv/g6 {#antv-g6}

Connection relationships are logical, not geometric, and paths are calculated through `type` and edge routing algorithms:

```ts
interface EdgeConfig {
    id?: string;
    source: string; // Source node ID
    target: string; // Target node ID

    sourceAnchor?: number; // Source node anchor index
    targetAnchor?: number; // Target node anchor index

    type?: string; // line / polyline / cubic / loop ...
    style?: ShapeStyle;
}
```

Anchors are declared on nodes, with normalized coordinates:

```ts
anchorPoints: [
    [0.5, 0], // top
    [1, 0.5], // right
    [0.5, 1], // bottom
    [0, 0.5], // left
];
```

Anchor indices are used on edges, very similar to tldraw's `normalizedAnchor`, but G6 places the anchor definition authority on nodes:

```ts
{
    source: 'nodeA',
    target: 'nodeB',
    sourceAnchor: 1,
    targetAnchor: 3,
}
```

### mxGraph {#mxgraph}

mxGraph has a complete connection constraint system, defined on node shapes, representing allowed connection points:

```ts
class mxConnectionConstraint {
    point: mxPoint | null; // (0.5, 0) = top center (1, 0.5) = right center
    perimeter: boolean; // Indicates projection along shape boundary
}
```

### Our design {#our-design}

Similar to [Lesson 18 - Defining Parent-Child Components], we can implement bidirectional binding relationships:

```ts
class Binding {
    @field.ref declare from: Entity;
    @field.ref declare to: Entity;
}

class Binded {
    @field.backrefs(Binding, 'from') declare fromBindings: Entity[];
    @field.backrefs(Binding, 'to') declare toBindings: Entity[];
}
```

To declare an arrow from `rect-1` pointing to `rect-2`, the method is as follows:

```ts
const edge = {
    id: 'line-1',
    type: 'line',
    fromId: 'rect-1',
    toId: 'rect-2',
    stroke: 'black',
    strokeWidth: 10,
    markerEnd: 'line',
};
```

## Auto update {#auto-update}

When the position of connected shapes changes, the paths of bound edges need to be recalculated. We can query all shapes that have the `Binded` component, monitor their bounding box changes, and update bound edges at that time:

```ts
class RenderBindings extends System {
    private readonly boundeds = this.query(
        (q) => q.with(Binded).changed.with(ComputedBounds).trackWrites,
    );

    execute() {
        const bindingsToUpdate = new Set<Entity>();
        this.boundeds.changed.forEach((entity) => {
            const { fromBindings, toBindings } = entity.read(Binded);
            [...fromBindings, ...toBindings].forEach((binding) => {
                bindingsToUpdate.add(binding);
            });
        });
        // Recalculate paths of bound edges and render
    }
}
```

In the example below, you can try dragging nodes, and edges will recalculate paths and redraw:

<Binding />

Currently, the start and end points of edges are the bounding box centers of connected shapes, consistent with the effect when `isPrecise` equals `false` in tldraw, indicating imprecise binding.
In most cases, we want arrows not to pass through the connected shapes, but to elegantly dock at the shape edges.

## Perimeter algorithm {#perimeter}

For shape boundaries, drawio provides the `perimeter` property, changing it affects connections. For details, see: [Change the shape perimeter]

![Perimeter styles and port constraints](https://drawio-app.com/wp-content/uploads/2019/02/drawio-perimeter-constraint-styles.png)

```ts
// Note: generally next is passed as "the other center point", orthogonal is usually false
var pointA = graph.view.getPerimeterPoint(stateA, centerB, false, 0);
var pointB = graph.view.getPerimeterPoint(stateB, centerA, false, 0);
```

### Rectangle perimeter algorithm {#rectangle-perimeter}

The rectangle perimeter algorithm is the most commonly used. In the following implementation, `vertex` is the source node, and `next` is the bounding box center of the target node.
First, draw a line from the centers of the source and target node bounding boxes, then determine which edge of the source node bounding box the target point is closer to. The two diagonals of the bounding box divide the plane into four regions. The range of the left boundary is the region outside $[-\pi+t, \pi-t]$ (i.e., the judgment `alpha < -pi + t || alpha > pi - t` in the code):

```ts
function rectanglePerimeter(
    vertex: SerializedNode,
    next: IPointData,
    orthogonal: boolean,
): IPointData {
    const { x, y, width, height } = vertex;
    const cx = x + width / 2; // Source node center
    const cy = y + height / 2;
    const dx = next.x - cx;
    const dy = next.y - cy;
    const alpha = Math.atan2(dy, dx); // Slope of line from source node center to target node center
    const p: IPointData = { x: 0, y: 0 };
    const pi = Math.PI;
    const pi2 = Math.PI / 2;
    const beta = pi2 - alpha;
    const t = Math.atan2(height, width); // Diagonals divide into four regions
    if (alpha < -pi + t || alpha > pi - t) {
        // Intersects with left edge
        p.x = x;
        p.y = cy - (width * Math.tan(alpha)) / 2; // Calculate intersection point
    }
    // Other three edges omitted
    return p;
}
```

Finally, calculate the intersection point of the line with that edge as the departure point of the final line. For example, when we determine that the line will pass through the "left edge":

1. Determine $x$ coordinate: Since it's the left edge, the $x$ coordinate of the intersection point must equal the left boundary value of the rectangle, `vertex.x`.
2. Calculate $y$ offset:
    1. The horizontal distance from center to left edge is `width / 2`.
    2. Use the tangent formula: $\tan(\alpha) = \frac{\Delta y}{\Delta x}$.
    3. On the left side, $\Delta x = -(\text{width} / 2)$.
    4. So the vertical offset $\Delta y = \Delta x \cdot \tan(\alpha) = -\frac{\text{width}}{2} \cdot \tan(\alpha)$.
3. Final coordinate: `p.y = cy + Δy`, which is `cy - (width * Math.tan(alpha)) / 2` in the code.

draw.io also provides another option `orthogonal`, which means the calculated line needs to be orthogonally aligned (i.e., aligned with the x or y axis), and the line only considers horizontal or vertical extension. In this case, the other center point cannot be used as a reference:

```ts
if (orthogonal) {
    if (next.x >= x && next.x <= x + width) {
        p.x = next.x;
    } else if (next.y >= y && next.y <= y + height) {
        p.y = next.y;
    }
    if (next.x < x) {
        p.x = x;
    } else if (next.x > x + width) {
        p.x = x + width;
    }
    if (next.y < y) {
        p.y = y;
    } else if (next.y > y + height) {
        p.y = y + height;
    }
}
```

<BindingOrthogonal />

### Ellipse perimeter algorithm {#ellipse-perimeter}

For ellipse nodes, we need to calculate the intersection point of the line with it:

```ts
const d = dy / dx;
const h = cy - d * cx;
const e = a * a * d * d + b * b;
const f = -2 * cx * e;
const g = a * a * d * d * cx * cx + b * b * cx * cx - a * a * b * b;
const det = Math.sqrt(f * f - 4 * e * g);

const xout1 = (-f + det) / (2 * e);
const xout2 = (-f - det) / (2 * e);
const yout1 = d * xout1 + h;
const yout2 = d * xout2 + h;
const dist1 = Math.sqrt(Math.pow(xout1 - px, 2) + Math.pow(yout1 - py, 2));
const dist2 = Math.sqrt(Math.pow(xout2 - px, 2) + Math.pow(yout2 - py, 2));

let xout = 0;
let yout = 0;
if (dist1 < dist2) {
    xout = xout1;
    yout = yout1;
} else {
    xout = xout2;
    yout = yout2;
}
return { x: xout, y: yout };
```

The line passes through the center $(cx, cy)$, and its equation is $y = d \cdot x + h$:

-   Slope $d = \frac{dy}{dx}$
-   Intercept $h = cy - d \cdot cx$

Substitute the line equation into the ellipse standard equation:

$$\frac{(x-cx)^2}{a^2} + \frac{(d \cdot x + h - cy)^2}{b^2} = 1$$

Expand and rearrange into a quadratic equation in $x$: $ex^2 + fx + g = 0$. The e, f, g in the code correspond to:

-   $e$: Quadratic coefficient
-   $f$: Linear coefficient
-   $g$: Constant term

Quadratic formula: Use the discriminant $det = \sqrt{f^2 - 4eg}$ to calculate the two intersection points $xout1$ and $xout2$. Choose one point: A ray passing through an ellipse produces two intersection points (one in front, one behind). The code calculates the distances from both intersection points to the target point `next` (dist1 and dist2), and selects the closest point.

<BindingWithEllipse />

## Constraint {#constraint}

At this point, we have implemented logical connections on edges using only `fromId` and `toId`. The connection points for edges and nodes are floating, referred to as `FloatingTerminalPoint` in mxGraph. However, sometimes we want edges to depart from a fixed position on a node and enter from a fixed position on the connected shape, termed `FixedTerminalPoint` in mxGraph. In such cases, we need to define constraints, splitting the process into separate parts for nodes and edges.

### Constraint on node {#constraint-on-node}

Node constraints define where and how connections can be made. They are not “points” but rule objects, defined in mxGraph as follows:

```ts
class mxConnectionConstraint {
    point: mxPoint | null; // 归一化坐标 (0~1)
    perimeter: boolean; // 是否投射到边界
    name?: string; // 可选，端口名
}
```

In the accompanying draw.io editor, we can see numerous “blue connection points” on the diagram. These are defined by overriding the constraints on the diagram:

```ts
mxRectangleShape.prototype.getConstraints = function (style) {
    return [
        new mxConnectionConstraint(new mxPoint(0.5, 0), true), // top
        new mxConnectionConstraint(new mxPoint(1, 0.5), true), // right
        new mxConnectionConstraint(new mxPoint(0.5, 1), true), // bottom
        new mxConnectionConstraint(new mxPoint(0, 0.5), true), // left
    ];
};
```

Our constraints are defined as follows: A set of constraints can be declared on a node:

```ts
export interface ConstraintAttributes {
    x?: number;
    y?: number;
    perimeter?: boolean;
    dx?: number;
    dy?: number;
}

export interface BindedAttributes {
    constraints: ConstraintAttributes[];
}
```

Retrieve candidate constraints, select the nearest constraint, and convert the constraint into a geometric point. If projection onto the boundary is required, proceed to the boundary algorithm computation logic introduced in the previous section.

### Constraint on edge {#constraint-on-edge}

You also need to define which anchor point of the node the edge will enter or exit from. During interaction, this corresponds to dragging the edge's endpoint onto the node's anchor point. At this point, `entryX/entryY` must copy the `x/y` field from the anchor point constraint:

```ts
interface BindingAttributes {
    fromId: string;
    toId: string;
    orthogonal: boolean;
    exitX: number; // [!code ++]
    exitY: number; // [!code ++]
    exitPerimeter: boolean; // [!code ++]
    exitDx: number; // [!code ++]
    exitDy: number; // [!code ++]
    entryX: number; // [!code ++]
    entryY: number; // [!code ++]
    entryPerimeter: boolean; // [!code ++]
    entryDx: number; // [!code ++]
    entryDy: number; // [!code ++]
}
```

In the following example, we have defined anchor points `[1, 0]` and `[0, 1]` on the gray and green rectangles respectively.

<BindingConstraint />

## [WIP] Routing rules {#router}

Automatically select exit direction, insert turning points, avoid node bounding boxes:

```ts
┌──────┐        ┌──────┐
│ Node │ ─┐     │ Node │
└──────┘  └────▶└──────┘
```

![Connector styles](https://drawio-app.com/wp-content/uploads/2019/02/drawio-connector-styles.png)

## [WIP] Export SVG {#export-svg}

When exporting, it is no longer sufficient to save only geometric information; logical relationships must also be persisted.

```html
<line x1="0" y1="0" data-binding="" />
```

## [WIP] Editor {#editor}

### Highlight anchors {#highlight-anchors}

-   When a node is selected, display available anchor points from which connections can be initiated.
-   When an edge is selected, highlight dockable anchor points during dragging.

[Lesson 23 - Mindmap]: /zh/guide/lesson-023
[Lesson 25 - Drawing arrows]: /zh/guide/lesson-025#draw-arrow
[Lesson 18 - Defining Parent-Child Components]: /zh/guide/lesson-018#定义-component
[Change the shape perimeter]: https://www.drawio.com/doc/faq/shape-perimeter-change
