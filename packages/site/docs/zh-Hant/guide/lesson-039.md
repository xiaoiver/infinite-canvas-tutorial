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

| 元件 | 角色 |
| --- | --- |
| **`Camera3D`** | `projection: 'perspective' \| 'orthographic'`；當 `linked` 時，`CameraSync` 跟隨 2D 的平移／縮放 |
| **`Mesh3D`** | `positions`、`normals`，以及選用的 `indices`（三角形 Mesh） |
| **`Material3D`** | 金屬－粗糙度 PBR：`baseColor`、`metallic`、`roughness`，以及環境光強度；舊欄位仍保留以維持相容 |
| **`Light3D`** | `ambient`／`directional`／`point`／`spot`；見 [場景照明範例](/example/lighting) |
| **`Transform3D`** | 平移、歐拉旋轉、縮放 |
| **`Selected3D`** | 3D 選取狀態：Gizmo 模式、作用中的軸／平面、拖曳參考點等（見 [3D 變換 Gizmo](#gizmo)） |
| **`Mat4`** | 4×4 矩陣輔助（`perspective`／`ortho`／`lookAt`） |

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

| 顏色 | 軸 | 方向（典型的連動畫布視圖） | 拖曳會更新 |
| --- | --- | --- | --- |
| 紅 | +X | 向右 | `translation.x` |
| 綠 | +Y | 向下 | `translation.y` |
| 藍 | +Z | **深度**（`z+` 朝螢幕內） | `translation.z` |

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

轉換器接受帶有一層實心填色的封閉輪廓。`<path>`、`<line>`、`<polyline>`、`<polygon>`、`<rect>`、`<circle>` 或 `<ellipse>` 上的實心 SVG 描邊，會展開成封閉、可編輯的 Path。因此只有描邊的開放直線與路徑也可以擠出。當圖形同時有填色與描邊時，描邊會變成填色來源上方的另一個 Path；兩者都保留 SVG 群組變換，並且可以匯出成 GLB。圓形與方形線帽，以及圓角、斜角與斜接接合都會保留。SVG 的 `stroke="none"` 佔位會被忽略。轉換器保留 `fill-rule`，包含 `evenodd` 孔洞，並從 SVG 群組繼承塗料與描邊寬度。一般的填色矩形仍是可編輯的 Rect 節點；圓角矩形、橢圓與封閉折線會變成可編輯的 Path。
內嵌 `style` 宣告裡的填色、描邊、不透明度、填色規則與描邊幾何，會覆寫表現屬性。`fill="currentColor"` 與 `stroke="currentColor"` 會依圖形、群組、`<use>` 實例或 SVG 根上最近的 `color` 解析；沒有顏色時預設為黑色。透過 `style` 提供的描邊也可以展開。外部 CSS 樣式表不會被解析。
擠出時，圓角矩形會把 SVG 各自的 `rx` 與 `ry` 保留成橢圓圓角弧。缺少的半徑會預設成另一個，而且每個半徑會被限制在對應尺寸的一半以內。一般的 2D Rect 匯入器仍然只儲存單一圓角半徑。
可解析、長度為正的 SVG 虛線樣式，包含奇數長度的樣式與 `stroke-dashoffset`，會展開成各自可編輯的實心輪廓。
長度為零的虛線搭配圓形線帽，會產生一個擠出的圓點。`non-scaling-stroke` 會在 SVG 群組變換與 `viewBox` 縮放中保持指定的寬度：匯入器先投影中心線，再把它展開成可編輯的 3D 輪廓。這個寬度在匯入時就固定，因此之後編輯器縮放會照常縮放 3D Mesh。裁剪路徑或 slice 視埠下的非縮放描邊、長度為零的間隙、搭配其他線帽且長度為零的虛線、漸層、塗料伺服器，以及不支援的 SVG 圖形，仍留在 2D。
自足的 `<pattern>` 填色，若使用整數像素磁磚且 `patternUnits="userSpaceOnUse"`，會匯入成重複的 2D 填色。磁磚可以包含基本 SVG 圖形；連結的資源與非零的圖案原點尚未支援。支援的 `patternTransform` 函式（`matrix`、`translate`、`scale`、`rotate` 與 `skew`）在匯入的填色上仍可編輯。
畫布放大時，SVG 圖案磁磚會從向量來源重繪。磁磚間距在畫布座標中保持固定，柵格尺寸則以紋理上限為頂。
矩形上的圓形 `<radialGradient>` 填色，若使用 `userSpaceOnUse`、明確的數值中心與半徑，以及置中的焦點，也會以 2D 保留。矩形、圓、橢圓、路徑與多邊形上其他自足的放射漸層，包含橢圓漸層、偏移的焦點與漸層變換，會使用柵格化的 SVG 影像填色。圖形仍可編輯，而它的漸層色標烘進該影像，而不是各自可編輯的塗料控制。
你放大時，SVG 影像填色會從向量來源重繪，直到紋理尺寸上限，因此邊緣在較高倍率下仍比較銳利。
如果描邊無法產生有效的封閉 Mesh，就保留它原來的 2D 節點。
展開後的描邊輪廓在座標正規化時保留六位小數，因此很細的細節不會在最終 Mesh 檢查之前塌掉。
本地的 `<use href="#id">` 與舊式 `xlink:href` 對支援圖形或群組的參考，會建立獨立實例，包含向前參考與重複參考。實例的像素偏移、變換與繼承的填色會在擠出之前套用；每個實例得到自己可編輯的 ID。循環與無法解析的參考會被跳過。`<use>` 也可以參考帶有 `viewBox` 的 `<symbol>`，只要實例或 symbol 提供正的像素 `width` 與 `height`。實例尺寸覆寫 symbol 的尺寸。symbol 的 `preserveAspectRatio` 支援 `meet` 對齊、`none`，以及擠出輪廓的 `slice` 裁切。若有效尺寸不存在或無效，就跳過該 symbol 實例。外部參考尚未匯入。
帶有明確正像素尺寸與 `viewBox` 的巢狀 `<svg>` 元素，也會建立可編輯的視埠群組。它們的 `x`／`y`、變換與 `preserveAspectRatio` 會影響擠出的子節點。本地的 `<use>` 可以參考其中一個 SVG 元素，並獨立覆寫它的視埠尺寸。巢狀 SVG 視埠預設會裁切產生的擠出輪廓，包含 `slice`；設定 `overflow="visible"` 可保留超出的幾何。
完全包含在內的圖形保持群組關係，因此移動視埠群組也會移動它們的 3D Mesh。跨過邊緣的圖形成為裁切後的 Path。
本地的 `clip-path="url(#id)"` 與內嵌 CSS `clip-path` 現在也會裁切符合條件的 3D 輪廓。`<clipPath>` 可以包含 Path、多邊形、折線、矩形、圓、橢圓、巢狀群組，以及對那些圖形的本地 `<use>` 參考。它的圖形形成聯集；`clip-rule="evenodd"` 可以挖孔。群組與重複 `<use>` 實例上的裁剪跟隨它們的變換，多個祖先裁剪彼此相交，也與 SVG 視埠相交。`clipPathUnits="objectBoundingBox"` 使用單一圖形的範圍，或群組所支援子圖形的範圍，包含它們的變換。被裁切的輪廓變成可編輯的 Path；完全位於裁剪內的輪廓保留原來的節點與群組關係。無法解析或不支援的裁剪定義留在 2D。遮罩、濾鏡、裁剪路徑裡的文字，以及外部裁剪參考，不會轉成 3D。
帶有 `display="none"` 或繼承 `visibility="hidden"` 的元素不會產生 3D Mesh；後代可以明確設定 `visibility="visible"`。
把根 `<svg>` 傳進去，即可套用明確的像素 `width`／`height` 與 `viewBox`，包含 `preserveAspectRatio`。填色擠出也會保留巢狀群組中 SVG 的 `skewX`、`skewY`，以及剪切過的 `matrix(...)` 變換。當組合變換包含剪切時，這些輪廓會變成以取樣線段構成、仍可編輯的 Path。一般的 viewBox 縮放會讓矩形與曲線 Path 以原來的形式保持可編輯。沒有明確像素視埠尺寸的 SVG 保留它們的 viewBox 座標。不支援的 2D 圖形仍使用一般的 SVG 匯入器，它不會保留來源剪切。

使用 `preserveAspectRatio="slice"` 時，填色擠出輪廓會裁切到視埠，包含孔洞，以及被分成分開島嶼的圖形。完全位於視埠內的圖形保持 Rect 或曲線 Path 的形式。不支援的 2D 圖形仍跟隨一般匯入器，不會被這個輔助函式裁切。

在下方選擇 **Repeated use sample**，檢視同一個定義的兩個實例使用不同填色，旁邊還有一個一般矩形。
選擇 **Symbol viewport sample**，比較一個有孔 symbol 的兩個視埠實例。第一個使用 symbol 的尺寸；第二個設定自己的尺寸。
選擇 **Nested SVG viewport sample**，比較一個內嵌 SVG 視埠，以及用 `<use>` 參考的第二個實例；它們的擠出輪廓會裁切到各自的視埠。
選擇 **Paint style + currentColor sample**，比較繼承的顏色與實例專用的顏色、一個內嵌填色覆寫，以及一個有樣式的描邊。
選擇 **Stroke caps + joins sample**，比較圓形與方形線帽、一個帶有分開 3D 輪廓的填色圖形、群組變換下的非縮放描邊、擠出的虛線描邊，以及圓點。
選擇 **Clip paths + repeated use sample**，檢視兩個各自裁切、帶有孔洞的實例，以及一個由物件範圍聯集裁切的圖形。
選擇 **Group bounds + clip use sample**，檢視變換群組上的物件範圍裁剪，其中兩個窗口重用一個本地定義。

SVG 預先檢查會判斷每條輪廓能否形成 Mesh。得到的 CPU 幾何保存在最近的快取裡，最多 256 個 Mesh、幾何陣列合計 8 MiB，因此非同步的畫布更新建立 3D 伴生時可以重用它。較舊的項目會被逐出；GPU 幾何有自己的每畫布快取。
執行 `pnpm bench:svg-import:browser`，檢視儲存庫的 [Ghostscript Tiger SVG](/Ghostscript_Tiger.svg) 與其他代表性圖稿的匯入與編輯計時。你也可以下載該 SVG，並用上方的 **Upload SVG** 檢視可編輯圖層，以及比較不同縮放層級。
當匯入的 SVG 圖層重疊時，它們擠出後的正面保留 SVG 繪製順序，包含巢狀群組內的圖層。較晚的圖層在連動 3D 視圖中仍蓋在較早的圖層之上。
GLB 匯出以相同的由前到後走訪順序列出擠出節點，我們的 glTF 匯入器會保留這個順序。對於同一平面上不透明、平坦的擠出，匯出也會把重疊圖層在深度上分開，最多為最薄擠出厚度的 5%。這讓 glTF 檢視器得到不同的深度緩衝值，而不移動畫布上可編輯的圖形。每一組互不相交的堆疊各自處理，因此遠處的 3D Mesh 不會關閉這個間距。若某個堆疊的投影範圍與傾斜或透明的擠出、另一個抬升，或一個獨立的 3D Mesh 重疊，則保留它原本寫入的變換。極大或極遠的模型，仍可能因為檢視器的深度緩衝精度而失去微小的深度差異。

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

在靜止的立方體、球體與圓柱上比較環境光、方向光、點光源與聚光燈。切換光源，調整強度／範圍以及球體的金屬度／粗糙度，啟用攝影棚環境照明並投射陰影，或播放聚光燈軌道。點光源與聚光燈可以使用原來的平滑範圍衰減，或改用可設定參考距離的平方反比衰減。渲染器使用 GGX 直接照明，輸入從 sRGB 轉到線性，並做電影式色調對應。LDR 全景或 Radiance HDR 影像提供球諧漫射照明，以及搭配 split-sum BRDF 查找的預過濾反射。

最多兩盞 `castShadow: true` 的方向光、點光源或聚光燈可以同時投射陰影，並以 3 × 3 PCF 過濾。每盞燈可以設定 `shadowStrength`（0–1）、`shadowSoftness`（0–4 個紋素）、`shadowBiasScale`（0–4），以及 `shadowNormalBias`（0–10 個畫布單位）；預設值保留原來的外觀。每個 Mesh 可以透過 `material3d.castShadow` 與 `material3d.receiveShadow` 各自選擇不投射或不接收（兩者預設都是 `true`）。方向光貼圖貼合目前的 Mesh；半角低於 85° 的聚光錐使用一張透視貼圖，較寬的光錐與點光源使用六面圖集。圖集面接縫上的 PCF 取樣會改採相鄰面，而不是重複邊界紋素。控制項、貼圖尺寸與 API 細節見 [照明範例](/example/lighting)。

自發光表面用 `material3d.emissiveFactor` 與 `emissiveStrength` 控制發光，而不必加一盞場景光。glTF 的 `KHR_materials_emissive_strength` 會隨材質匯入與匯出；可在 [照明範例](/example/lighting) 裡試立方體的發光滑桿。

若要不受照明影響的平面顏色，`material3d.unlit` 會略過場景光與色調對應，同時保留基礎色紋理與 alpha。glTF 的 `KHR_materials_unlit` 在匯入與 GLB 匯出時會保留；在 [照明範例](/example/lighting) 裡用立方體開關，把它和自發光比較。

有紋理的鏤空與半透明表面，`material3d.alphaMode` 提供 `mask` 與 `blend`；它們的陰影行為與排序限制見 [3D Mesh 透明度範例](/example/mesh3d-alpha)。

WebGL1 片段著色器讀取 uniform 陣列時需要常數索引。渲染器會在 WebGL1 上為光源資料與陰影矩陣產生有界的查找；WebGL2 與 WebGPU 保留原生索引。材質著色把顏色傳回 `main()`，因此 WebGL1 的輸出轉換對無光照材質也會執行。瀏覽器回歸會強制使用 WebGL1，並檢查頂點顏色、切線空間法線貼圖、多個光源，以及方向光／點光源陰影。

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
