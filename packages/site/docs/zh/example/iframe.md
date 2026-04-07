---
title: "嵌入 iframe（如视频）"
description: "将外部页面与画布变换合成。"
---
<!-- example-intro:zh -->

# 嵌入 iframe（如视频）

iframe 受 **sandbox**、**自动播放** 与 CSP 约束，可与 [第 29 课](/zh/guide/lesson-029) 的嵌入主题对照。

若需离线导出缩略图，可考虑截帧策略。

## 交互示例

<script setup>
import Iframe from '../../components/Iframe.vue'
</script>

使用 `<iframe>` 嵌入 YouTube

```ts
const node = {
    id: 'embed-1',
    type: 'embed',
    url: 'https://www.youtube.com/watch?v=37fvFffAmf8',
    x: 100,
    y: 100,
    width: 800,
    height: 450,
    lockAspectRatio: true,
};
```

<Iframe />
