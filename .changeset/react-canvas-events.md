---
'@infinite-canvas-tutorial/react': minor
'@infinite-canvas-tutorial/webcomponents': patch
'@infinite-canvas-tutorial/ecs': patch
---

Add useCanvasEvent for typed DOM and canvas event subscriptions scoped to the
nearest Provider, with callback updates, native listener options, and automatic
cleanup on subscriber removal, canvas recreation, and API destruction.

Export CanvasEventMap for typed consumers and preserve the HTMLElementEventMap
augmentation. Fix point picking returning NaN after CameraControl clears its
press coordinates, and suppress events from cancelled pointer gestures.
Do not treat the pointerleave following a completed touch release as cancellation.
