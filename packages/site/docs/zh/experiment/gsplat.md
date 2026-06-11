# 3D 高斯泼溅

[3D 高斯泼溅](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)（3D
Gaussian Splatting，3DGS）用数百万个各向异性的 3D 高斯而非三角形来表示场景。每个高斯
拥有位置、各向异性协方差（由缩放与旋转构造）、不透明度，以及用球谐函数编码的视角相关颜色。
[PlayCanvas SuperSplat](https://github.com/playcanvas/supersplat) 等编辑器可以浏览
并编辑这类资产。

本实验新增了 `@infinite-canvas-tutorial/gsplat` 包，它在 `device-api` 之上加载高斯泼溅
资产并用 **EWA splatting** 渲染，因此同时支持 WebGL2 与 WebGPU。第一阶段 MVP 支持球谐
**0 阶**（DC 颜色）。

## 数据格式

每个高斯都会被解码为可直接渲染的线性空间数值：

| 字段     | 含义                        |
| -------- | --------------------------- |
| center   | 高斯中心 `(x, y, z)`        |
| scale    | 每个轴的标准差（线性）      |
| rotation | 单位四元数 `(x, y, z, w)`   |
| color    | `[0, 1]` 范围的 RGB DC 颜色 |
| opacity  | `[0, 1]` 范围的不透明度     |

支持两种资产格式：

-   **`.ply`** —— INRIA / SuperSplat 导出格式，支持 ASCII 与二进制（大/小端）。缩放以
    `log(scale)` 存储（需取 `exp`），不透明度以 logit 存储（需取 sigmoid），颜色为球谐
    DC 项（`0.5 + SH_C0 · f_dc_i`），四元数以 `(w, x, y, z)` 存储。
-   **`.splat`** —— 紧凑的 antimatter15 布局，每个高斯 32 字节。

```ts
import { parseGsplat } from '@infinite-canvas-tutorial/gsplat';

const buffer = await (await fetch('/scene.ply')).arrayBuffer();
const data = parseGsplat(buffer, { nameOrUrl: 'scene.ply' });
console.log(data.count, data.computeBounds());
```

## EWA 投影

每个高斯被绘制为一个**实例化四边形**。顶点着色器先由缩放与旋转构造 3D 协方差：

$$\Sigma = R\,S\,S^\top R^\top$$

再通过视图变换的透视雅可比矩阵 $J$ 投影为屏幕空间的 2D 协方差：

$$\Sigma' = J\,W\,\Sigma\,W^\top J^\top$$

得到的 2×2 矩阵给出椭圆的长/短轴，用于扩张四边形。片元着色器计算 2D 高斯权重并输出
预乘 alpha：

$$\alpha = \text{opacity} \cdot e^{-\frac{1}{2} d^2}$$

其中 `d` 是片元到椭圆中心、以特征轴为单位的距离。

## 深度排序

Alpha 混合要求**从后往前**绘制。每帧都用 `O(n)` 的 16 位计数排序按视空间深度（最远优先）
对高斯排序，并按排序结果上传实例缓冲，再用预乘 “over” 混合（`ONE`、
`ONE_MINUS_SRC_ALPHA`）绘制。

## WebGL2 与 WebGPU

着色器用 GLSL 300 ES 编写一次，由 `device-api` 为两种后端转译，因此渲染是可移植的。差异
在于**排序**：

-   本 MVP 每帧在 **CPU** 上排序，适合中小规模资产。
-   对于超大规模资产，计划使用 **GPU 基数排序**（WebGPU compute）或 WebGL2 的
    **Web Worker** 排序（详见包的 Roadmap）。

## 示例

`packages/site/docs/components/Gsplat.vue` 提供了一个自包含的参考组件：它创建一个
`device-api` 交换链，构造一个小的合成高斯球面，并用 `gl-matrix` 相机环绕浏览：

```ts
import { GsplatRenderer } from '@infinite-canvas-tutorial/gsplat';

const renderer = new GsplatRenderer(device);
renderer.setData(data);

// 每帧直接渲染到交换链的屏幕目标：
const onscreen = device.createRenderTargetFromTexture(
    swapChain.getOnscreenTexture(),
);
renderer.render({ viewMatrix, projectionMatrix, width, height }, onscreen);
onscreen.destroy();
```

省略第二个参数则会渲染到离屏纹理（由 `render` 返回），可作为填充使用或与其他图层合成。
