# WebKit SVG pattern investigation

The SVG pattern pixel tests in `__tests__/browser/svg-extrusion.spec.ts` are
temporarily skipped on WebKit. The issue is not fixed by this investigation.

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

Recreating the artwork after decoding, advancing more frames, changing the
camera, uploading pixel data instead of the canvas, and disabling mipmap
filtering did not fix the initial repeated-dot rendering. These experiments
were diagnostic and are not included in the implementation.

To continue, compare the actual ECS draw and material state for the pattern
and working gradient cases, then investigate the rerasterization crash
separately. Restore the WebKit pixel tests only after they pass at both the
fixture's device pixel ratio and ratio 1. Confirm behavior on an actual Safari
device before extrapolating the Linux Playwright result to production Safari.
