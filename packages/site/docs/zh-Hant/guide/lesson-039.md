---
outline: deep
description: '在既有的 2D 無限畫布上疊加真正的 3D Mesh 渲染：統一的 3D 空間、Camera3D，以及 MeshPipeline3D。'
---

<script setup>
import Cube from '../../components/Cube.vue'
import CubePerspective from '../../components/CubePerspective.vue'
import Lighting from '../../components/Lighting.vue'
import GltfDuck from '../../components/GltfDuck.vue'
import SvgExtrusion from '../../components/SvgExtrusion.vue'
import IconExtrusion from '../../components/IconExtrusion.vue'
</script>

# 第 39 課 - 3D Mesh 渲染 {#lesson-39-3d-mesh-rendering}

在 [第 30 課 - 後處理與渲染圖] 之前，畫布上的一切都走 2D 管線：正交相機、SDF、路徑三角化填色，等等。這一課加上一條 3D Mesh 分支，而不取代那個 2D 渲染器：頂點帶有法線、透視／正交投影、深度測試，並在同一張畫布上與 2D 圖層合成。

## Framer、Spline、Rive 與 Bevy {#framer-spline-rive-bevy}

Framer 與 Spline 裡 2D／3D 融合的核心想法，可以收成兩條技術路徑。每個產品都依自己的定位選擇不同的架構。

Framer 的 3D 能力本質上是 CSS 3D transform 的加強包裝，不是真正的 3D 渲染管線。因此不能匯入外部 3D 模型（GLB／OBJ），也沒有真正的光照、陰影或材質系統。3D 效果限於卡片翻轉、視差圖層這類簡單情況。見：[How to Turn 2D Elements into Interactive 3D Objects in Framer]

![來源: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer](https://framerusercontent.com/images/j0Ohpy2LqEoU8uSlHGeoymyLlg.png)

Spline 是真正的 3D 編輯器，架構更接近遊戲引擎。Spline 讓你建立獨立的 [UI Scenes]（2D 畫布），再把它們當作 3D 場景裡 UI Frame 物件上的紋理。[Working with 2D and 3D objects]

![來源: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects](https://cdn.spline.design/_assets/docs/957fce0d-3bef-420c-90b0-9085ffec39fd.png)

Rive 今天基本上仍是 2D 工具。它的「3D 感覺」來自 2.5D 變換、Mesh 變形與類似技巧，而不是完整的 3D 管線。

我們的做法更接近 [2D Rendering in Bevy]：2D 圖形落在 **z = 0** 平面上，3D 模型共用同一個世界；當你平移／縮放 2D 相機時，3D 相機可以選擇跟著走。實作見 [PR #271](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/271)。

## 架構概觀 {#architecture}

```plaintext
Same WebGL/WebGPU context
  └─ MeshPipeline render graph
       ├─ Pass: 3D (MeshPipeline3D.drawMeshes)
       ├─ Pass: 3D Gizmo (RenderGizmo3D.drawGizmos, on top of meshes)
       ├─ Pass: grid / 2D vector (existing BatchManager)
       └─ Pass: post-processing → present
```

-   **`Renderer3DPlugin`**：註冊 3D 元件，並排程 `MeshPipeline3D`（GPU 快取）、**`CameraSync`**（與 2D 相機連動）、**`Pick3D`**（選取／拖曳），以及 **`RenderGizmo3D`**（繪製變換 Gizmo）。
-   **`MeshPipeline3D`**：不呈現自己的交換鏈；在 `MeshPipeline` 的主通道裡 **先畫 3D，再畫 2D**，共用顏色與深度附件。
-   既有的 **`Mesh.ts`** 仍然是 **2D 向量填色**。不要把它和 3D 的 `Mesh3D` 混淆。

外掛設定：

```ts
import {
    App,
    DefaultPlugins,
    DefaultRenderer3DPlugin,
} from '@infinite-canvas-tutorial/ecs';

const app = new App().addPlugins(...DefaultPlugins, DefaultRenderer3DPlugin);
app.run();
```

## 核心元件 {#components}

| 元件              | 角色                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| **`Camera3D`**    | `projection: 'perspective' \| 'orthographic'`；當 `linked` 時，`CameraSync` 跟隨 2D 的平移／縮放 |
| **`Mesh3D`**      | `positions`、`normals`，以及選用的 `indices`（三角形 Mesh）                                      |
| **`Material3D`**  | 金屬－粗糙度 PBR：`baseColor`、`metallic`、`roughness`，以及環境光強度；舊欄位仍保留以維持相容   |
| **`Light3D`**     | `ambient`／`directional`／`point`／`spot`；見 [場景照明範例](/example/lighting)                  |
| **`Transform3D`** | 平移、歐拉旋轉、縮放                                                                             |
| **`Selected3D`**  | 3D 選取狀態：Gizmo 模式、作用中的軸／平面、拖曳參考點等（見 [3D 變換 Gizmo](#gizmo)）            |
| **`Mat4`**        | 4×4 矩陣輔助（`perspective`／`ortho`／`lookAt`）                                                 |

透過 ECS 的 `commands.spawn` 產生實體，例如：

```ts
import {
    Camera3D,
    Mesh3D,
    Material3D,
    Transform3D,
} from '@infinite-canvas-tutorial/ecs';

commands.spawn(
    new Camera3D({
        eye: [3, 3, 5],
        center: [0, 0, 0],
        clearColor: true,
    }),
);

commands.spawn(
    new Mesh3D({ positions, normals, indices }),
    new Material3D({
        baseColor: [0.25, 0.55, 0.95, 1],
        ambient: 0.45,
        diffuse: 0.75,
        specular: 0.4,
        shininess: 48,
    }),
    new Transform3D({
        translation: [0, 0, 0],
        rotation: [0.3, 0.6, 0],
        scale: [1, 1, 1],
    }),
);
```

## 統一的 3D 空間（連動相機） {#unified-space}

要 **平移／縮放畫布，並讓 2D 與 3D 一起移動**，請在 `Camera3D` 上設定 `linked: true`。

每一幀，`CameraSync` 讀取 2D `ComputedCamera` 的 `(x, y, zoom)`，並寫入 3D 相機的 `eye`／`center`／`baseDistance`：

-   縮放：`baseDistance = canvas.height / 2`，`eye.z = baseDistance / zoom`，對應 z = 0 時 2D `mat3.projection` 的可見高度
-   **連動正交**（`projection: 'orthographic'`）：`eye = [x, -y, distance]`，`center = [x, -y, 0]`（2D 畫布的 Y 向下，3D 世界的 Y 向上，透過 `canvasWorldToWorld3D` 翻轉）
-   **連動透視**（`projection: 'perspective'`）：`eye = [x, y, distance]`，`center = [x, y, 0]`（與 2D 節點相同，**畫布座標，Y 向下**）

### 連動 + 正交 {#linked-orthographic}

`MeshPipeline3D` 直接使用 2D 的 `viewProjectionMatrix`（包含 Y 翻轉、平移與縮放），因此 `extrude3d` 與 2D 矩形嚴格對齊。

[立方體（正交）](/example/cube) 範例使用 **連動 + 正交**（`translation: [200, 100, 40]`）。

<Cube />

### 連動 + 透視 {#linked-perspective}

在透視模式中，螢幕位置來自 **完整的 2D VP**（平移、縮放與 Y 翻轉都與 2D 一致）；深度則對 `Transform3D.translation.z` 使用透視矩陣，以產生近大遠小。錨點是 `translation` 的 `(x, y, z)`，因此物件會落在與 2D 相同的 `(x, y)`。

[立方體（透視）](/example/cube-perspective) 使用上面的 **連動 + 透視** 設定；拖曳畫布時，立方體應與 2D 圖層一起平移與縮放。

<CubePerspective />

## 射線投射拾取 {#raycast-picking}

3D 選取與 Gizmo 互動由 **`Pick3D`** 系統處理（選取工具作用中時，**`Select`** 也會使用它）。指標按下時，游標下的視埠像素會拿來測試 Gizmo 把手與 `Mesh3D` 三角形。沒有 GPU 拾取通道，一切都在 CPU 上的 `ray-casting.ts` 與 `pick3d-probe.ts` 執行。

### 管線 {#pipeline}

```plaintext
viewport (x, y)
  └─ buildPickSceneForViewport(camera, …)  →  Mesh3DPickScene (same matrices as rendering)
       └─ probePick3DAtViewport(…)
            ├─ 1. gizmo parts on Selected3D entities (screen-space / ray, per part)
            └─ 2. all Mesh3D on this canvas → keep closest hit (smallest t)
```

**優先順序**：已經選取的實體會先探測 **Gizmo 把手**；都沒有命中時，才探測場景 Mesh。Mesh 之間，沿光線 **距離最小** 的命中（或在連動透視中深度最大、最靠近前面的命中）勝出。

### 標準射線投射（正交／自由相機） {#standard-raycast-orthographic-free-camera}

在非連動透視的模式裡，拾取與經典 3D 編輯器相同：

1. **`screenToRay`**：視埠像素 → NDC → 用 **`inv(view × projection)`** 反投影近平面與遠平面，得到世界空間光線。
2. **`rayMeshIntersection`**：用實體的模型矩陣變換 Mesh 頂點，然後：
    - **粗略階段**：光線對變換後的 **AABB**（slab 法）。
    - **精細階段**：對每個三角形做 **Möller–Trumbore** 光線–三角形測試；保留最近的 `t`。

```ts
// packages/ecs/src/utils/ray-casting.ts (simplified)
const invVP = computeInvViewProjection(projMatrix, viewMatrix);
const ray = screenToRay(vx, vy, width, height, invVP);
const hit = rayMeshIntersection(ray, positions, indices, modelMatrix);
// hit: { t, point, triangleIndex } | null
```

**連動正交**（`linked + orthographic`）重用同一條路徑：`MeshPipeline3D` 把 2D 的 `viewProjectionMatrix` 送進拾取場景，因此點擊仍與 2D 矩形以及 `extrude3d` 對齊。

### 連動透視：螢幕空間三角形 {#linked-perspective-screen-space-triangles}

**連動透視**對 Mesh 命中 **不** 使用世界光線。螢幕位置由完整的 2D VP 決定；深度來自作用在 `translation.z` 上的另一個透視矩陣。為了與頂點著色器一致，**`pickMeshLinkedPerspective`** 用相同的 uniform 把每個三角形投影到視埠空間，再測試游標是否落在 **2D 投影三角形**內（`pointInTriangle2D`），並挑選該像素上 **最前面的深度**。這個模式的 Gizmo 零件重用同一個輔助函式（把手可以選擇加上 Z 方向的螢幕偏移）。

這樣在帶有透視立方體的無限畫布上平移／縮放時，仍能做到「看到的就是能選到的」。

### 拖曳約束 {#drag-constraints}

按下 Gizmo 會建立一個 `GizmoSession`，帶有初始姿態與固定的投影。對一般相機，指標移動會讓光線與作用中的約束平面相交。連動相機會反解畫面上顯示的把手投影，包含它的 Z 螢幕偏移。平移沿著選取的軸或平面；旋轉沿著局部環軸。無效或退化的取樣不會改變預覽。

移動期間，這個 session 會更新執行期元件。放開時，宣告式來源會發布一次文件編輯與一筆復原紀錄。Escape、指標取消，或離開畫布，會恢復起始姿態，而且不記錄編輯。

改變作用中的相機、它的投影／視圖，或畫布尺寸，會取消按住的手勢。從外部編輯來源的姿態、幾何，或某個祖先的變換，也會取消它：執行期預覽回到 **目前的文件**，因此舊的指標放開不能覆寫 API 編輯或復原。無關的編輯，例如名稱與顏色，可以和正常繼續的拖曳合併。另一張畫布上的變更不會中斷它。再按一次把手，就能在新視圖中開始。

計算後的版面也是手勢脈絡的一部分。Yoga 可以改變來源的位置或尺寸，而不改那些文件欄位；這些變化，包括祖先變換，會取消預覽。取消會保留新的版面，只還原仍由預覽擁有的座標。在除此之外都沒有改變的版面上按 Escape，會回到計算出的起始位置，即使它與文件不同。session 自己寫入的預覽不會讓它失效。

`GizmoSourceFrame` 會對局部的來源／祖先幾何做快照，避免世界矩陣延遲更新造成的誤中斷。當指標 session 擁有來源預覽時，伴生同步不會再次寫入該來源。直接操作伴生物件的整合，仍保留它們的反向同步。

沒有變化的幀不會重寫伴生變換或材質，姿態或材質編輯會重用已產生的 CPU 幾何。幾何設定的變更會單獨讓該快取失效。

`MeshPipeline3D` 在姿態／材質編輯期間，也會重用 GPU 的頂點、法線、UV、索引，以及每個 Mesh 的 uniform 緩衝區。只有對 `Mesh3D` 的寫入會讓幾何失效；直接編輯陣列時，先用 `entity.write(Mesh3D)` 取得元件。快取在伴生同步之後消費那些寫入，跨過被跳過的繪製仍保留它們，並在下一次繪製時上傳一次替換結果。幾何陣列相同的 Mesh 在同一張畫布內共用已上傳的幾何，而每個 Mesh 保留自己的模型 uniform 與繪製繫結。原地的幾何編輯會上傳新的一代；其他實例保留先前的 GPU 快照，直到它們被更新或移除。
每張畫布擁有自己的快取與場景 uniform。移除 Mesh 或把它移到另一張畫布，會釋放舊的緩衝區；銷毀畫布時，會在裝置之前釋放它的資源。失敗的配置會回滾，並且可以重試，而不替換先前完整的快取項目。

模型矩陣與法線矩陣只在姿態改變時重新計算。模型 uniform 的上傳也會跳過沒有變化的幀，以及只有相機改變的情況；材質編輯與已完成的紋理載入會更新 uniform，而不重建那些矩陣。對變換／顏色陣列的原地編輯以值比較。

場景 uniform 按畫布快取。相機與連動的 2D 視圖改變時會更新場景矩陣；光源改變時會重新打包照明，而不重建那些矩陣。沒有變化的繪製會重用場景資料與每個 Mesh 的繪製繫結。紋理就緒或被替換、幾何重建，以及 GPU 資源替換，會讓受影響的繫結失效。繫結會在它們參考的緩衝區與紋理之前釋放。失敗的場景上傳與繫結配置仍可重試。

3D 圖層清單跟隨 ECS 的幾何、中繼資料、範圍與成員變更，而不是在每個閒置幀掃描每一個 Mesh。選取成員另外追蹤，因此懸停 Gizmo 把手不會重建清單。圖層項目保留穩定的實體參考，供之後選取使用，包含復原／重做之後。

把手顏色、軸，以及完整的指標流程，見 [3D 變換 Gizmo](#gizmo)。

## 3D 變換 Gizmo {#gizmo}

使用 **選取工具**（`penbarSelected === Pen.SELECT`）時，點擊 3D Mesh 會為實體加上 **`Selected3D`**，並在其中心繪製 **平移** 把手：紅／綠／藍箭頭，加上半透明的平面控制項。拖曳把手會寫回 **`Transform3D.translation`**。這與 2D 的 `Selected` + `RenderTransformer` 類似，但走另一條 3D 拾取與繪製路徑。

### 互動流程 {#gizmo-flow}

```plaintext
pointer down (Select tool)
  └─ Pick3D: probe gizmo first, then Mesh3D
       ├─ hit gizmo → capture pose/projection, create GizmoSession
       └─ hit mesh → select; miss → clear selection

pointer move (held)
  └─ GizmoSession.update → constrained runtime preview

pointer up
  └─ finish(true) → publish source pose once, record history

Escape / pointer cancel / leave
  └─ finish(false) → restore pose, clear gesture state
```

### 座標與把手的意義 {#gizmo-axes}

與 [統一的 3D 空間](#unified-space) 一致，Gizmo 使用 **畫布座標（Y 向下）**，而不是 Blender 那種 Y 向上：

| 顏色 | 軸  | 方向（典型的連動畫布視圖） | 拖曳會更新      |
| ---- | --- | -------------------------- | --------------- |
| 紅   | +X  | 向右                       | `translation.x` |
| 綠   | +Y  | 向下                       | `translation.y` |
| 藍   | +Z  | **深度**（`z+` 朝螢幕內）  | `translation.z` |

-   **箭頭**：沿單一軸平移。
-   **平面**（`xy`／`xz`／`yz` 半透明方塊）：一次移動兩個分量（例如 `xy` 只動 X 與 Y，不動 Z）。

-   **組合模式 `transform`（預設，類似 Spline）**：同時顯示平移箭頭／平面 **以及** 旋轉環；抓到哪個把手就執行那個操作（`activePartKind`：`translate`｜`rotate`），沒有 `W`／`E` 模式切換。
-   拖曳 **箭頭／平面** → 更新 `Transform3D.translation`；拖曳 **環** → 更新 `Transform3D.rotation`（局部歐拉角，與 Mesh 相同）。
-   環跟隨物件目前的朝向；箭頭留在畫布世界軸上（X 向右、Y 向下、Z 為深度）。
-   拾取使用螢幕空間的 **最近** 命中；重疊時箭頭在上面，因此平移勝出。`scale` 保留給以後。

### 編輯擠出的矩形 {#extrude-editing}

帶有 `extrude3d` 的 `rect` 使用與宣告式 Mesh 相同的 Gizmo。它可序列化的選項現在包含抬升，以及局部 3D 旋轉：

```ts
const node: RectSerializedNode = {
    id: 'extruded-card',
    type: 'rect',
    zIndex: 0,
    x: 100,
    y: 80,
    width: 160,
    height: 100,
    extrude3d: { depth: 80, z: 20, rotation: [0.2, 0.3, 0] },
    fills: [{ type: 'solid', value: '#3377dd' }],
};
```

-   XY 平移會寫入來源矩形在其父座標中的 `x`／`y`，包含旋轉、縮放或翻轉過的父節點。奇異的父變換會拒絕預覽，因為它的反矩陣不存在。
-   Z 平移改變 `extrude3d.z`，並保留 `depth`。在 3D 旋轉為零時，`z` 是正面的抬升；伴生中心位於 `z - depth / 2`。
-   環的旋轉寫入 `extrude3d.rotation`：相對於來源既有的世界空間 2D 旋轉、以弧度表示的 XYZ 歐拉角。它不會改動來源的 2D `rotation`。對一般的旋轉圖形，伴生會組合 `Rz(sourceAngle) × Rx(x) × Ry(y) × Rz(z)`。

放開時提交一次；取消會恢復預覽。復原／重做與重新載入文件會恢復同一個姿態。停用擠出或替換它的伴生，會中斷手勢，並恢復目前的文件，而不是重建一個過時的伴生。

`extrude3d: true` 仍然表示深度 100，數字仍然指定深度。物件值的預設是深度 100、抬升 0，以及旋轉 `[0, 0, 0]`。一次更新會替換整個選項值：省略的欄位回到那些預設。目前還沒有縮放把手；用矩形尺寸與 `depth` 改變大小。矩形擠出會讓局部角落跟著旋轉與縮放走。來自變換後父節點的圓角、鏡射與剪切會烘進 Mesh，因此它們的足跡仍與可編輯的 2D 來源對齊。奇異的父變換無法產生新的 Mesh。

### 擠出封閉的 Path {#extrude-path}

帶有一層實心填色的封閉 Path 可以使用同一個 `extrude3d` 選項。它的正面與背面跟隨填色輪廓，包含孔洞；編輯 `d` 或 `fillRule` 會重建 Mesh。平移會重用它。來自變換後父節點的剪切會烘進 Mesh，因此該線性變換的變更會重建它。

```ts
const vector: PathSerializedNode = {
    id: 'extruded-vector',
    type: 'path',
    zIndex: 0,
    x: 100,
    y: 80,
    d: 'M100 80 L200 80 L200 180 L100 180 Z M125 105 L125 155 L175 155 L175 105 Z',
    fillRule: 'evenodd',
    fills: [{ type: 'solid', value: '#3377dd' }],
    extrude3d: { depth: 40, z: 0, sideColor: '#facc15' },
};
```

所有子路徑都必須封閉。開放路徑、描邊圖層、多層或非實心填色、非流形輪廓，以及奇異變換，仍以 2D 顯示。Path 保留原來的文件節點，並支援 Gizmo 編輯、復原與重新載入。

### 把圖示變成 3D {#icon-to-3d}

<IconExtrusion />

在 App 裡選取一個 Icon，開啟 **3D → Convert icon to 3D**。選擇深度與材質預設（霧面、亮面或金屬）。轉換會把 SVG 描邊，包含線帽與接合，展開成封閉輪廓。填色部分與孔洞會變成同一個群組裡可編輯的 Path。選取群組可一次改變所有零件的深度或材質；選取一個 Path 可編輯它的輪廓或倒角。復原會還原 IconFont。這次轉換是圖示幾何的快照。

用 `registerIconifyIconSet` 註冊圖示集之後，程式碼可以使用相同的轉換：

```ts
const result = iconFontToExtrudedPaths(iconNode, {
    depth: 40,
    bevelSize: 2,
    metallic: 1,
    roughness: 0.25,
});
if (result) api.updateNodes([result.group, ...result.paths]);
```

`metallic` 與 `roughness` 是 0 到 1 之間的 PBR 參數。這些預設使用既有的照明管線。透明玻璃與折射尚未支援。SVG 濾鏡、漸層與不支援的塗料，在擠出之前可能需要手動整理輪廓。

`sideColor` 是側壁的選用 CSS 顏色；正面與背面保留來源填色。省略它時，所有面都使用來源填色。側壁顏色是塗料變更，因此編輯它會重用既有的 Mesh 幾何。

SVG 的 `<path>`、`<polygon>`、`<rect>`、`<circle>` 與 `<ellipse>` 元素，以及封閉的 `<polyline>` 元素，可以用 `svgElementsToExtrudedNodes` 匯入成填色擠出的來源。這個輔助函式會把其他匯入的圖形留在 2D；無效的深度會被拒絕，而不是悄悄改成預設值。

```ts
import { svgElementsToExtrudedNodes } from '@infinite-canvas-tutorial/ecs';

const svg = new DOMParser().parseFromString(source, 'image/svg+xml');
const nodes = svgElementsToExtrudedNodes(
    svg.documentElement as unknown as SVGSVGElement,
    40,
);
api.updateNodes(nodes);
```

在線上 App 中，選取矩形或 Path 即可在上方工具列開啟 **3D** 控制。啟用擠出，然後編輯它的深度與倒角。專案選單也提供 **Import SVG as 3D**，它會把可見圖稿置中到畫布上，即使圖稿只佔 SVG 視埠的一部分，並把不支援的圖層留在 2D。使用 **Export as → GLB (3D)** 下載專案中所有已就緒的擠出 Mesh。App 也讓你設定倒角剖面（1–8 段），以及選用的十六進位側壁顏色；側壁顏色留白就使用圖形的填色。
若某個 Path 無法產生 Mesh，App 會停用擠出動作，並顯示封閉輪廓、填色與描邊的要求。

**匯入支援範圍：**封閉的純色輪廓與支援的純色描邊可轉換為可編輯的 3D 圖形。漸層、圖案與其他不支援擠出的圖層會保留為 2D；支援的孔洞、群組變換、本地參考與裁剪會保留。外部參考、遮罩與濾鏡不會轉換為 3D。

下方示範可切換描邊、裁剪與重複參考。詳細支援條件請見 [SVG 擠出與匯入相容性參考](/zh-Hant/guide/svg-extrusion-reference)。

為 Path 與 Rect 擠出的兩端設定 `extrude3d.bevelSize`（畫布單位）即可加上倒角。示範把它顯示為 **Bevel**。當向內偏移仍保留填色拓撲時，支援孔洞、多個島嶼與凹角。如果輪廓碰撞，或狹窄區域塌陷，圖形會保留銳利邊緣。改變深度或尺寸會重建伴生 Mesh，同時讓來源保持可編輯。
解析後的填色邊界合計超過 4096 個頂點的圖形也會保持銳利，以限制 Mesh 的工作量。

把 `extrude3d.bevelSegments` 設成 `1` 得到直線倒角（預設），或設成 `2`–`8` 得到圓角的四分之一圓剖面。段數越多，輪廓越平滑，Mesh 三角形也越多。示範的 **Bevel profile** 控制讓你在匯入的 SVG 圖形上比較直線與圓角剖面。

範例的 **Download GLB** 按鈕把產生的 3D Mesh 匯出成自足的 glTF 二進位檔。使用 `api.exportGlb` 下載所有已就緒的擠出圖形，或傳入節點只匯出選取範圍（包含選取群組的子節點）：

```ts
await api.exportGlb();
const glb = await api.exportGlb({
    nodes: [api.getNodeById('extruded-vector')!],
    download: false,
}); // Uint8Array
```

匯出把畫布 Y 向下的座標轉成 glTF Y 向上的座標，並保留目前的 3D 姿態、實心填色與選用的側壁顏色。它只匯出已就緒的 Mesh 伴生；不支援的 2D SVG 圖形不會包含在內。基礎色紋理以 PNG 或 JPEG 嵌入（其他可解碼格式會轉成 PNG）。紋理 URL 必須允許 CORS 擷取。同步的 `api.export({ format: ExportFormat.GLB })` 仍可用於沒有紋理的匯出。
較低階的 Mesh 匯出，呼叫 `exportMeshesToGlb(sources, await loadGlbImages(sources))`。

使用 **ViewBox + shear sample** 檢視變換後的輪廓與它的 evenodd 孔洞，然後關掉擠出，比較 2D 足跡。
使用 **Slice clipping sample** 查看一個孔洞、兩塊分開的片段，以及被 SVG 視埠切過的曲線邊緣。

<SvgExtrusion />

## 照明 {#lighting}

在下方場景中比較環境光、方向光、點光源與聚光燈。調整球體的金屬度與粗糙度，切換環境貼圖，或試用陰影與移動的聚光燈。

場景最多使用 8 盞直接光，其中最多 2 盞符合條件的光源可投射陰影。自發光使用 `material3d.emissiveFactor` / `emissiveStrength`，無光照材質使用 `material3d.unlit`；鏤空與透明使用 `alphaMode`。

參數與限制請見[照明參考](/zh-Hant/guide/lighting-reference)，API 和操作請見[照明範例](/example/lighting)。

<Lighting />

## glTF 模型 {#gltf}

透過宣告式的 `mesh3d` 幾何（`geometry: { type: 'gltf', url: '…' }`）載入外部 glTF／GLB。Khronos 的 **Duck** 樣本在 `/data/` 下使用一對 `.gltf` + `.bin`；Mesh 會置中並正規化到單位範圍，再用 `scale3d` 縮放。

glTF 的基礎色係數使用線性 RGB，而 ECS 把材質基礎色存成 sRGB。匯入時會在兩者之間轉換；GLB 匯出再轉回線性 RGB，因此材質顏色在來回之後保持穩定。

匯入器也保留 glTF 的 `doubleSided`、`normalTexture`、`occlusionTexture`，以及檔案中寫入的 `TANGENT` 屬性。法線貼圖改變照明法線；遮蔽只影響間接光。[互動式 PBR 模型](/example/gltf-duck#pbr-material) 說明法線貼圖何時使用檔案中的切線，或從 UV 推導。

glTF 的 `COLOR_0` 頂點顏色（浮點數，或正規化的無號 byte／short，RGB 或 RGBA）在線性空間裡乘上材質基礎色。[互動式頂點顏色模型](/example/gltf-duck#vertex-colors) 顯示有無場景照明的結果。匯出把顏色保留成浮點 RGBA。

匯入器接受三角形清單、三角形帶（`mode: 5`）與三角形扇（`mode: 6`），有無索引皆可。它把它們轉成三角形清單，供渲染與 GLB 匯出。鏡射的節點變換也會修正三角形繞序，讓單面表面仍然可見。

稀疏的 glTF accessor 支援位置、法線、UV、顏色、切線與三角形索引。缺少的基礎資料從零開始；稀疏值只替換列出的元素。匯入的 Mesh 會匯出成一般的緊密 GLB 緩衝區。

<GltfDuck />

## 延伸閱讀 {#extended-reading}

-   [Working with 2D and 3D objects]
-   [Bevy Core3dPlugin](https://docs.rs/bevy/latest/bevy/core_pipeline/core_3d/struct.Core3dPlugin.html)（外掛分層參考）

[第 30 課 - 後處理與渲染圖]: /zh-Hant/guide/lesson-030
[How to Turn 2D Elements into Interactive 3D Objects in Framer]: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer
[UI Scenes]: https://docs.spline.design/designing-in-3-d/ui-scenes
[Working with 2D and 3D objects]: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects
[2D Rendering in Bevy]: https://bevy.org/examples/2d-rendering/2d-shapes/
