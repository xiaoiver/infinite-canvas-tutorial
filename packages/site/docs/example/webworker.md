---
---

<a href="/guide/lesson-011#rendering-in-webworker">Rendering in WebWorker</a>

-   `transferControlToOffscreen` from main thread to WebWorker.
-   Listen to events such as `pointerdown` / `resize` on main thread and transfer serialized version later.

<script setup>
import WebWorker from '../components/WebWorker.vue'
</script>

<WebWorker />
