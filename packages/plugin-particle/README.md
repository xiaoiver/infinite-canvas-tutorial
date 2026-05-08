# @infinite-canvas-tutorial/particle

WebGPU particle effects for **ECS / `@infinite-canvas-tutorial/device-api`** setups (e.g. Spectrum `ic-canvas`): `EcsSineParticle`, `EcsMeshParticle`, `EcsSpectrumParticleAudio`, and mesh sampling helpers.

## glTF / GLB（`loadMeshTriangleSoupFromFile`）

依赖包内已包含 `@loaders.gl/core`、`@loaders.gl/gltf`、`@loaders.gl/draco`、`@loaders.gl/obj`。`loadMeshTriangleSoupFromFile` 对 **`.gltf` / `.glb`** 使用 `parse(file, GLTFLoader, …)`，以解码 **glTF Embedded**（JSON 内 `data:` base64 buffer，无外链 `.bin`）与 **GLB**。

| 能力                                  | 说明                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **单文件 Embedded**                   | `.gltf` 内嵌 base64 buffer（Blender「glTF Embedded」导出）或 `.glb`。                                                     |
| **Draco**                             | 选项中带 `DracoLoader`，解压 `KHR_draco_mesh_compression`。                                                               |
| **顶点色 `COLOR_0`**                  | `FLOAT` / `normalized UINT8` / `normalized UINT16` 的 `VEC3`·`VEC4`。                                                     |
| **`baseColorFactor`**                 | 无 `COLOR_0` 时，若材质里**显式写了** `pbrMetallicRoughness.baseColorFactor`，则整 primitive 用该线性 RGBA 作为每顶点色。 |
| **`baseColorTexture` + `TEXCOORD_0`** | `EcsMeshParticle` 在 GPU 上对首张 baseColor 贴图 `textureSampleLevel` 采样（需 UV）。                                     |

## 表面粒子数量与策略

`EcsMeshParticle` 在 CPU 上调用 `sampleMeshSurface(soup, N, strategy)`：

| `meshSampleStrategy` | 行为                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`area`**（默认）   | `sampleMeshSurfaceUniform`：按**三角面积**加权选三角，再三角内均匀；大面粒子多，小脸易稀。                                                                                           |
| **`perTriangle`**    | `sampleMeshSurfacePerTriangleUniform`：总粒子按**三角个数**均分（每三角约 `⌊N/T⌋` 点，余数随机摊到部分三角），再三角内随机；**每个三角期望粒子数相同**，适合 Duck 眼睛等小三角区域。 |

-   调大 **`targetSampleCount`**（默认 `DEFAULT_MESH_SAMPLE_COUNT` = 12000，上限受 `maxParticles` 通常 65536）可显著改善细节。
-   改动 `targetSampleCount` 或 **strategy** 后需对已解析的 `MeshTriangleSoup` **再调一次** `setMeshSoup(soup)` 才会重新打点。

## `EcsMeshParticle` 取景（运行时）

构造或每帧前调用 `update({ ... })` 可改：

-   **`meshScale`**：归一化采样点再乘的缩放（默认 `1`；改小如 `0.65` 易装下全模型）。
-   **`meshOffset`**：`[x,y,z]` 平移（默认 `[0,0,0]`）。
-   **`viewFov`**：透视视野（默认 `1.2`；略大更广角）。
-   **`viewDistanceScale` / `viewDistanceBias`**：相机距离 = `(3·Radius_音频 + 0.5) * scale + bias`，用于整体拉远/拉近。
-   **`orbitYawSpeed`**：绕竖直轴缓慢公转（弧度/秒），叠在鼠标控制的方位角上；`0` 关闭。例：`0.12` rad/s → 一整圈约 52 秒。

`.gltf` + 外链 `.bin` 在浏览器 `file://` 或缺 base URL 时可能拉不到 buffer，优先用单文件 **GLB**。
