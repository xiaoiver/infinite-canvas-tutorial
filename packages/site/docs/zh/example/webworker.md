---
publish: false
---

<a href="/zh/guide/lesson-011#rendering-in-webworker">在 WebWorker 中渲染</a>

-   使用 `transferControlToOffscreen` 将 Canvas 控制权从主线程转移到 WebWorker
-   在主线程监听 `pointerdown` / `resize` 事件，传递序列化对象到 WebWorker

<script setup>
import WebWorker from '../../components/WebWorker.vue'
</script>

<WebWorker />
