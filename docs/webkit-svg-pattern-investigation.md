# WebKit SVG pattern investigation

The SVG pattern pixel tests in `__tests__/browser/svg-extrusion.spec.ts` are
temporarily skipped on WebKit except for the solid-tile case. The issue is not
fixed by this investigation.

With the Playwright 1.55.1 WebKit Linux container and the iPhone 13 fixture:

-   At device pixel ratio 1, the repeated-dot test completes but the expected
    red pixels are absent from the canvas screenshot.
-   At device pixel ratio 3, the page can crash while the pattern tile is
    rerasterized. At ratio 1, zooming enough to trigger rerasterization also
    reproduced the crash.
-   The SVG tile decodes to an `ImageBitmap`. Canvas 2D pattern rendering
    produces the expected red pixel, and reading the uploaded ECS WebGL texture
    back through a framebuffer also returns that pixel. A standalone WebGL
    upload and readback succeeds in the same container.
-   A solid SVG extrusion and a radial-gradient example render successfully in
    that environment. An opaque pattern example at zoom 3 also passed; this
    does not establish that all patterns or Safari versions work.
-   A standalone Canvas 2D control, now covered by the browser suite, decodes an
    SVG, scales its bitmap into a tile, and repeats it with transparent gaps at
    raster scales 1 and 3. It succeeds in the tested WebKit container without ECS.
-   In one instrumented ECS run with pattern rerasterization disabled, the 60×60
    tile contained red pixels immediately after drawing the decoded bitmap, but
    the 300×300 repeated-pattern canvas contained none. An additional fresh
    Canvas 2D context also produced an empty repeated canvas in that run. This is
    a useful boundary to investigate, not yet a confirmed root cause.
-   Disabling pattern rerasterization avoided the initial crash in one run but
    left the ECS output blank. Copying the tile's pixels with `getImageData` and
    `putImageData` also left it blank. A non-opaque tile is not the only affected
    case: an opaque transformed-stripe case also closed the WebKit page.

The iPhone fixture's browser `devicePixelRatio` and the ECS canvas's configured
pixel ratio are separate: the fixture creates the canvas at ratio 1 unless its
`dpr` query parameter is supplied. Record both when reproducing a failure.

Recreating the artwork after decoding, advancing more frames, changing the
camera, uploading pixel data instead of the canvas, and disabling mipmap
filtering did not fix the initial repeated-dot rendering. These experiments
were diagnostic and are not included in the implementation.

To continue, isolate why repeating a populated tile produced an empty canvas in
the instrumented ECS run, including the exact source image and renderer state;
then investigate the rerasterization crash separately. Restore the WebKit pixel
tests only after they pass at both the fixture's device pixel ratio and ratio 1.
Confirm behavior on an actual Safari
device before extrapolating the Linux Playwright result to production Safari.
