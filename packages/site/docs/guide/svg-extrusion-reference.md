---
title: SVG extrusion and import compatibility reference
outline: deep
---

# SVG extrusion and import compatibility reference

This page collects detailed SVG import and extrusion behavior. Return to the [lesson 39 demo](/guide/lesson-039#icon-to-3d) to try it in the editor.

## Contours, strokes and styles

The converter accepts closed contours with one solid fill. A solid SVG stroke on
`<path>`, `<line>`, `<polyline>`, `<polygon>`, `<rect>`, `<circle>` or `<ellipse>` is
expanded into a closed, editable Path. Stroke-only open lines and paths can
therefore be extruded. When a shape has both fill and stroke, the stroke becomes
a separate Path above the filled source; both retain the SVG group transform and
can be exported to GLB. Round and square caps and round, bevel and miter joins
are preserved. SVG's `stroke="none"` placeholder is ignored. The converter
preserves `fill-rule`, including `evenodd` holes, and inherits paint and stroke
width from SVG groups. Plain filled rectangles stay editable Rect nodes; rounded
rectangles, ellipses and closed polylines become editable Paths.
Inline `style` declarations for fill, stroke, opacity, fill rule and stroke
geometry override presentation attributes. `fill="currentColor"` and
`stroke="currentColor"` resolve against the nearest `color` on the shape, group,
`<use>` instance or SVG root; absent color defaults to black. A stroke supplied
through `style` can also be expanded. External CSS stylesheets are not parsed.
For extrusion, rounded rectangles preserve independent SVG `rx` and `ry` values
as elliptical corner arcs. A missing radius defaults to the other, and each
radius is clamped to half of its corresponding dimension. The ordinary 2D Rect
importer still stores a single corner radius.
Resolvable positive-length SVG dash patterns, including odd-length patterns and
`stroke-dashoffset`, are expanded into separate editable solid contours.
A zero-length dash with a round cap creates an extruded dot. A
`non-scaling-stroke` keeps its specified width through SVG group transforms and
`viewBox` scaling: the importer projects the centerline first, then expands it
into an editable 3D outline. This width is baked at import time, so subsequent
editor zoom scales the 3D mesh normally. Non-scaling strokes under clip paths
or sliced viewports, zero-length gaps, zero-length dashes with other caps,
gradients, paint servers and unsupported SVG shapes remain in 2D.

## Patterns and gradients

`<pattern>` fills with integer pixel tiles and `patternUnits="userSpaceOnUse"`
are imported as repeating 2D fills. The tile can contain basic SVG shapes and
local `<use>` references to those shapes. A local `href` on a pattern can inherit
tile content and attributes from another pattern. Tile shapes can use local
linear or radial gradients in their `fill` or `stroke`, including inherited
gradients. An `<image>` in the tile can contain an embedded PNG, JPEG, WebP or
AVIF data URL. The pattern stays editable as a 2D fill; its gradient stops and
image content are embedded in the tile resource. External references, cyclic
references, external images and other paint servers remain unsupported.
Use the **Gradient + image pattern sample** button in the lesson 39 demo to inspect
both tile paints on the editor canvas.
Numeric `x` and `y` pattern origins remain
aligned when the same pattern fills shapes at different positions, including
fills inherited from a group. Inherited pattern fills become editable fills on
the individual child shapes. Supported
`patternTransform` functions (`matrix`, `translate`, `scale`, `rotate` and `skew`)
remain editable on the imported fill.
As the canvas zooms in, SVG pattern tiles are redrawn from their vector source.
The tile spacing stays fixed in canvas coordinates, with raster size capped at
the texture limit.
Circular `<radialGradient>` fills on rectangles are also retained in 2D when they
use `userSpaceOnUse`, explicit numeric center and radius, and a centered focal
point. Other self-contained radial gradients on rectangles, circles, ellipses,
paths and polygons, including elliptical gradients, shifted focal points and
gradient transforms, use a rasterized SVG image fill. The shape remains editable,
while its gradient stops are baked into that image rather than separately editable
paint controls.
SVG image fills are redrawn from the vector source as you zoom in, up to the
texture size limit, so their edges stay sharper at higher magnification.
If a stroke cannot generate a valid closed mesh, its original 2D node is kept.
Expanded stroke contours retain six decimal places while their coordinates are
normalized, so very thin details do not collapse before the final mesh check.

## References and viewports

Local `<use href="#id">` and legacy `xlink:href` references to supported shapes or
groups create independent instances, including forward and repeated references.
Instance pixel offsets, transform and inherited fill are applied before extrusion;
each instance receives its own editable ID. Circular and unresolved references
are skipped. `<use>` can also reference a `<symbol>` with a `viewBox` when the
instance or symbol provides positive pixel `width` and `height`. Instance
dimensions override the symbol's dimensions. The symbol's
`preserveAspectRatio` supports `meet` alignments, `none`, and `slice` clipping
of extruded outlines. Missing or invalid effective dimensions skip that symbol
instance. External references are not imported yet.
Nested `<svg>` elements with explicit positive pixel dimensions and a `viewBox`
also create editable viewport groups. Their `x`/`y`, transform and
`preserveAspectRatio` affect extruded children. A local `<use>` may reference
one of these SVG elements and override its viewport dimensions independently.
Nested SVG viewports clip generated extrusion outlines by default, including
with `slice`; set `overflow="visible"` to retain overhanging geometry.
Fully contained shapes keep their group relationship, so moving the viewport
group also moves their 3D meshes. Shapes crossing an edge become clipped Paths.

## Clipping and visibility

Local `clip-path="url(#id)"` and inline CSS `clip-path` now clip eligible 3D
outlines too. A `<clipPath>` can contain Paths, polygons, polylines, rectangles,
circles, ellipses, nested groups and local `<use>` references to those shapes.
Its shapes form a union; `clip-rule="evenodd"`
can cut holes. Clips on groups and repeated `<use>` instances follow their
transforms, and multiple ancestor clips intersect with each other and with SVG
viewports. `clipPathUnits="objectBoundingBox"` uses the bounds of a single shape
or a group's supported child shapes, including their transforms. A clipped outline becomes an editable Path; an outline wholly
inside its clip keeps its original node and group relationship. Unresolved or
unsupported clip definitions stay in 2D. Masks, filters, text inside clip paths
and external clip references are not converted to 3D.
Elements with `display="none"` or inherited `visibility="hidden"` do not produce
3D meshes; a descendant can explicitly set `visibility="visible"`.
Pass the root `<svg>` to apply an explicit pixel `width`/`height` and `viewBox`,
including `preserveAspectRatio`. Filled extrusions also preserve SVG `skewX`,
`skewY`, and sheared `matrix(...)` transforms from nested groups. These outlines
become editable Paths with sampled line segments when the combined transform
contains shear. Plain viewBox scaling keeps rectangles and curved Paths editable
in their original form. SVGs without explicit pixel viewport dimensions keep
their viewBox coordinates. Unsupported 2D shapes still use the ordinary SVG
importer, which does not preserve source shear.

With `preserveAspectRatio="slice"`, filled extrusion outlines are clipped to
the viewport, including holes and shapes split into separate islands. Shapes
fully inside the viewport keep their Rect or curved Path form. Unsupported 2D
shapes still follow the ordinary importer and are not clipped by this helper.

## Examples and performance

In the lesson 39 demo, choose **Repeated use sample** to inspect two instances of the same
definition with different fills, alongside an ordinary rectangle.
Choose **Symbol viewport sample** to compare two viewport instances of one
holed symbol. The first uses the symbol's dimensions; the second sets its own.
Choose **Nested SVG viewport sample** to compare an inline SVG viewport and a
second instance referenced with `<use>`; their extruded outlines are clipped
to each viewport.
Choose **Paint style + currentColor sample** to compare inherited and
instance-specific colors, an inline fill override and a styled stroke.
Choose **Stroke caps + joins sample** to compare round and square caps, a
filled shape with a separate 3D outline, a non-scaling stroke under a group
transform, an extruded dashed stroke and round dots.
Choose **Clip paths + repeated use sample** to inspect two independently
clipped instances with holes and a shape clipped by an object-bounds union.
Choose **Group bounds + clip use sample** to inspect an object-bounds clip on a
transformed group whose two windows reuse one local definition.

SVG preflight checks whether each contour can form a mesh. The resulting CPU
geometry is kept in a recent cache of at most 256 meshes and 8 MiB of geometry
arrays, so it can be reused when the asynchronous canvas update creates the 3D
companions. Older entries are evicted; GPU geometry has its own per-canvas cache.
Run `pnpm bench:svg-import:browser` to inspect import and edit timings for the
repository's [Ghostscript Tiger SVG](/Ghostscript_Tiger.svg) and other
representative artwork. You can also download that SVG and use **Upload SVG**
in the lesson 39 demo to inspect the editable layers and compare different zoom levels.

## Overlapping layers and GLB

When imported SVG layers overlap, their extruded front faces retain the SVG
paint order, including layers inside nested groups. Later layers remain visible
over earlier ones in the linked 3D view.
GLB export lists the extrusion nodes in the same front-to-back traversal order,
which our glTF importer retains. For opaque, flat extrusions on one plane, the
export also separates overlapping layers in depth by at most 5% of the
thinnest extrusion. This gives glTF viewers distinct depth-buffer values without
moving the editable shapes in the canvas. Each nonintersecting stack is handled
independently, so a distant 3D mesh does not disable the spacing. A stack whose
projected bounds overlap a tilted or transparent extrusion, another elevation, or a standalone
3D mesh keeps its authored transforms. Extremely large or distant models can
still lose small depth differences to the viewer's depth-buffer precision.
