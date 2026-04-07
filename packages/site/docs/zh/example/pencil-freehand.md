---
title: "铅笔工具（自由曲线）"
description: "在噪声输入上拟合更平滑的曲线，接近手写观感。"
---
<!-- example-intro:zh -->

# 铅笔工具（自由曲线）

自由曲线模式用 **样条** 或细分曲线代替密集折线，适合签名与草图；导出时注意与折线方案的体积差异。

可与激光笔、橡皮等工具组成完整绘制栈。

## 交互示例

<script setup>
import PencilFreehand from '../../components/PencilFreehand.vue'
</script>

<PencilFreehand />
