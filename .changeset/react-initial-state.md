---
'@infinite-canvas-tutorial/ecs': patch
'@infinite-canvas-tutorial/react': patch
'@infinite-canvas-tutorial/device-api': patch
---

Notify snapshot subscribers when a scene is initialized or committed without an undo entry, preserving legacy local-edit callbacks used by collaboration adapters. Publish completed undo/redo snapshots once, seed React initialNodes without capturing history, and keep Provider selectors and initial node callbacks in sync without extra record calls. Resolve LUT GPU helpers from the declared device-api dependency. Ship the shader compiler bindings and WASM in both builds, expose the compiler asset, and preserve the WebGPU type reference so packed consumers can build without repository-only paths or dependencies.
