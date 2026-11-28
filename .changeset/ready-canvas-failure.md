---
'@infinite-canvas-tutorial/ecs': minor
'@infinite-canvas-tutorial/core': patch
---

Expose default ECS renderer readiness through `API.initialized`, rejecting initialization failures and cancellation instead of treating a running World as a ready GPU. Make Core renderer teardown safe after context creation failure, cancel pending initialization on destruction and release devices acquired after cancellation.
