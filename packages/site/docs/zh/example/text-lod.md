---
title: '文字 LOD'
description: '缩放 ECS 画布，对比完整字形与小字号逐行代理。'
---

<!-- example-intro:zh -->

# 文字 LOD

缩小文字密集的画布，观察普通文字变成每个非空行一个实色代理。本示例主动开启 LOD；库的默认值仍然关闭。

<script setup>
import TextLOD from '../../components/TextLOD.vue'
</script>

<TextLOD locale="zh" />

## 体验切换

1. 从**总览**开始，切换**文字 LOD**，在相同相机缩放下比较代理与完整字形。
2. 从总览进入 **7 px 滞回区间**，文字保持代理；先点击**查看细节**再回到 7 px，文字保持 full。屏幕字号小于 6 CSS px 时进入代理，大于 8 CSS px 时恢复完整文字。
3. 选中或悬停可见文字，立即恢复完整字形；取消选择后允许再次使用 LOD。双击文字可以编辑。
4. 修改文字数量、平移画布或调整页面宽度。计数沿用原有视口裁剪结果，并包含交互强制 full 的对象。

屏幕字号是本示例 18 px 字体经相机缩放后的 **CSS 像素**高度，不受设备像素比影响。计数是文字对象数，不是 drawcall 数、GPU 耗时或性能承诺。LOD 减少字形工作。符合条件的代理在运行时开启 `Renderable.batchable` 后还可以合批；本示例为每条文字开启了该字段。

## 在自己的画布中开启

```ts
api.setTextLODEnabled(true);

// 恢复原有的完整文字渲染路径。
api.setTextLODEnabled(false);
```

此开关只属于当前画布的运行时状态，不改变文档 JSON、撤销历史或协作数据。选中、悬停和编辑会恢复 full；拾取、吸附仍使用原始几何，栅格导出始终使用完整字形。复杂样式、效果、裁剪及不支持的文字安全回退 full。

文字 LOD（#674）和保持绘制顺序的实色图形合批优化（#675）均实现在 `packages/ecs`。同一套保持绘制顺序的规划器现在也支持文字行代理。只有相邻且兼容的对象会合批，每页最多 4,096 个非空行；完整文字和不支持的样式仍独立绘制，并形成批次边界。

本示例使用 ECS 渲染器。旧 Core SDF 文字示例使用另一套渲染路径，不受此开关控制。

## 开启代理合批

`batchable` 是 ECS 运行时组件字段，不是文档 JSON 属性。对于已存在的文字节点，在编辑事务内开启：

```ts
import { Renderable } from '@infinite-canvas-tutorial/ecs';

await api.edit(
    (editor) => {
        const node = editor.getNodeById('your-label');
        editor.getEntity(node).write(Renderable).batchable = true;
    },
    { capture: 'NEVER' },
);
```

LOD 仍需显式开启。保持 LOD 开启并将运行时字段改回 `false`，即可对照独立绘制的代理。选中、悬停、编辑和导出仍使用完整字形。
