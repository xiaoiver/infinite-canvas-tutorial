---
title: "调整叠放顺序（z-index）"
description: "将对象前移或后移，控制遮挡关系。"
---
<!-- example-intro:zh -->

# 调整叠放顺序（z-index）

叠放顺序决定互相覆盖时的可见性，需与用户对设计软件的预期一致，可与 [第 34 课](/zh/guide/lesson-034) 中的编组/Frame 对照。

批量导入后建议规范化顺序，避免选中对象被遮挡。

## 交互示例

<script setup>
import ZIndex from '../../components/ZIndex.vue'
</script>

通过鼠标右键唤起上下文菜单后，通过上移下移调整 `z-index`

<ZIndex />
