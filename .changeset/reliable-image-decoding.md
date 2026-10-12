---
'@infinite-canvas-tutorial/ecs': patch
---

Retry HEIC-to-PNG conversion failures as JPEG, load ordinary Blobs without a global
File constructor, and reject unsuccessful image HTTP responses before conversion.
Preserve the original image decode error when a diagnostic HEIC fetch or signature
probe fails. Keep lazy HEIC imports retryable and bitmap ownership with callers.
