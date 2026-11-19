---
title: 'Path 合批'
description: '在 Core 与 ECS 中对比重复 Path 的保序合批及真实 WebGL 提交数量。'
---

<!-- example-intro:zh -->

# Path 合批

Core 与 ECS 中，重复的实色 Path 填充可以共享几何与实例页。本示例主动开启这项实验优化；两个包的默认值均为关闭。优化减少提交次数，保留原始路径精度。

<script setup>
import PathInstancing from '../../components/PathInstancing.vue'
</script>

<PathInstancing locale="zh" />

## 对比重复与交替路径

1. 保持**交替几何**关闭。路径几何一致，颜色不同。在相同相机位置切换 **Path 合批**，比较两个画布的可见数量与真实 drawcall 数。
2. 开启**交替几何**。两种路径按绘制顺序交替排列，没有相邻的兼容路径对。开关无法跨越中间几何合批。
3. 选择 1,000 条路径，平移、缩放或调整页面宽度。**总览**分别适配两个画布。点击或框选路径，比较计数前点击**取消选择**清除选择和悬停覆盖层。
4. 点击对应的 PNG 按钮预览完整精度的栅格导出。导出始终走普通的完整 Path 渲染路径，不受屏幕优化影响。

计数器只观察本示例各自 WebGL 上下文中的真实原生提交，包括背景和选择、悬停覆盖层。索引与非索引顶点数量乘以实例数，表示提交的工作量，不是唯一几何存储量。画布静止时保留最近完成的屏幕帧，导出帧不计入。计数不表示帧率或 GPU 耗时，观测本身也有开销。

1,000 条相同路径全部可见且没有交互覆盖层时，当前场景通常从 **1,001 次提交降至 2 次**：1,000 个独立填充变为一个实例填充，另有一次背景绘制。交替几何仍为 1,001 次。悬停或选择会增加计数。每个兼容实例页最多容纳 4,096 条路径；不支持的画笔、描边、效果、不同线性变换及其他渲染屏障使用完整路径。Core 对只有一个对象的连续段也使用普通 Mesh。

## 在自己的画布中开启

```ts
// Core：画布开关和每条 Path 的显式资格缺一不可。
canvas.pathInstancing = true;
const path = new Path({
    d: 'M0 0 H20 V20 H0 Z',
    fill: '#2563eb',
    batchable: true,
});
canvas.appendChild(path);
```

```ts
// ECS：两个字段均不写入文档数据。
api.setPathInstancingEnabled(true);
await api.edit(
    (editor) => {
        const node = editor.getNodeById('your-path');
        editor.getEntity(node).write(Renderable).batchable = true;
    },
    { capture: 'NEVER' },
);
```

将画布开关改回 `false` 即可恢复普通绘制。拾取、包围盒和选择保留原始几何，文档 JSON、历史与协作数据不变。此优化与[文字 LOD](./text-lod) 相互独立。
