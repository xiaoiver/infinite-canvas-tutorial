---
title: "将画布相关工作放到 Web Worker"
description: "在后台栅格化或计算，避免长时间占用主线程影响交互。"
---
<!-- example-intro:zh -->

# 将画布相关工作放到 Web Worker

导出大图、仿真或解析等重任务不应阻塞输入。把画布或计算阶段放到 **Web Worker** 可与 [第 11 课 — 测试与服务端渲染](/zh/guide/lesson-011) 中讨论的离屏/服务端思路对照。

可在自研集成中对比使用 Worker 前后的帧时间与输入延迟。

<a href="/zh/guide/lesson-011#rendering-in-webworker">在 WebWorker 中渲染</a>

-   使用 `transferControlToOffscreen` 将 Canvas 控制权从主线程转移到 WebWorker
-   在主线程监听 `pointerdown` / `resize` 事件，传递序列化对象到 WebWorker

<script setup>
import WebWorker from '../../components/WebWorker.vue'
</script>

<WebWorker />
