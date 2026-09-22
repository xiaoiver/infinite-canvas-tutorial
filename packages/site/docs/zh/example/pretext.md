---
title: "使用 Pretext 获取排版度量"
description: "在多后端之间统一 shaping 与布局数据时的实验桥接。"
---
<!-- example-intro:zh -->

# 使用 Pretext 获取排版度量

**Pretext** 可在混合后端时统一度量；上游文档对边界情况有说明，本页偏试验性质。

生产环境请与 HarfBuzz 等结果交叉校验换行。

## 交互示例

<script setup>
import Pretext from '../../components/Pretext.vue'
</script>

使用 [pretext] 进行文本度量

<Pretext />

[pretext]: https://github.com/chenglou/pretext
