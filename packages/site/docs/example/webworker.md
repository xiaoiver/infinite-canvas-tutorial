---
title: "Offload canvas work to a Web Worker"
description: "Keep the main thread responsive while rasterizing or simulating in the background."
---
<!-- example-intro:en -->

# Offload canvas work to a Web Worker

Heavy work—large exports, simulations, or parsing—should not block input. Moving the canvas or compute stage to a **Web Worker** isolates long tasks from the UI thread, echoing SSR and testing themes in [Lesson 11](/guide/lesson-011).

Watch frame time and input latency while toggling worker usage in your own builds.

<a href="/guide/lesson-011#rendering-in-webworker">Rendering in WebWorker</a>

-   `transferControlToOffscreen` from main thread to WebWorker.
-   Listen to events such as `pointerdown` / `resize` on main thread and transfer serialized version later.

<script setup>
import WebWorker from '../components/WebWorker.vue'
</script>

<WebWorker />
