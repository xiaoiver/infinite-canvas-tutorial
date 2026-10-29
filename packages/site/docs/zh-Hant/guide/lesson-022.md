---
outline: deep
description: '探索 VectorNetwork，作為 SVG 路徑的進階替代方案。了解拓撲定義、共用的頂點與邊、填色演算法，以及用於複雜向量圖形編輯的拓撲算子。'
head:
    - ['meta', { property: 'og:title', content: '第 22 課 - VectorNetwork' }]
---

<script setup>
import VectorNetwork from '../../components/VectorNetwork.vue';
import VectorNetworkCube from '../../components/VectorNetworkCube.vue';
import VectorNetworkFaceCut from '../../components/VectorNetworkFaceCut.vue';
</script>

# 第 22 課 - VectorNetwork {#lesson-22-vectornetwork}

在這一課，你會學到：

-   SVG Path 的限制
-   什麼是 VectorNetwork？
-   使用鋼筆工具修改 Path
-   雙擊進入向量編輯模式，以及移動／彎曲／切斷／填色工具
-   拓撲算子：分割線段、刪除頂點、切斷以打開封閉迴圈

## SVG Path 的限制 {#limitations-of-svg-path}

在[第 13 課 - 繪製路徑與手繪風格]中，我們學過如何繪製路徑。Figma 也提供 [VectorPath API]，它支援 SVG Path 指令的一個子集（見：[VectorPath-data]）以及 [fillRule]（在 Figma 中稱為 windingRule）。

```ts
node.vectorPaths = [
    {
        windingRule: 'EVENODD',
        data: 'M 0 100 L 100 100 L 50 0 Z',
    },
];
```

那麼為什麼要引入 [VectorNetwork API]？原因是 SVG Path 有一些固有限制。[Figma 向量網路背後的工程] 這篇文章生動地展示了這一點。下面這個圖形無法只用一條 Path 描述：

![不是合法的路徑](https://alexharri.com/images/posts/vector-networks/3.svg)

它只能拆成多條 Path 來描述。雖然做得到，但在編輯情境中，某些直覺的操作無法達成。例如拖曳左下方的中心頂點時，只有一個頂點會跟著動，因為它由兩條獨立的 Path 組成：

![用多條路徑建立更複雜的圖形](https://alexharri.com/images/posts/vector-networks/4.svg)

除了頂點不能連接超過 2 條邊，邊也不能被共用。[向量圖形複體] 的原始論文與簡報比較了 SVG 與平面圖（Planar maps），兩者都無法支援重疊、共用頂點與邊，因而引出一種新的幾何表示（以下稱為 VGC）：

![SVG 與平面圖的比較](/svg-path-vector-network-comparison.jpeg)

[vpaint] 以 VGC 為基礎實作。合併點與邊之後，編輯時的互動效果非常自然：

![vpaint](https://camo.githubusercontent.com/42f888c041ecc6799e9fe2bd3c895fcd8037417188a0d1db840e0ce0701a5201/68747470733a2f2f7777772e7667632e696f2f696d616765732f676c75652d30312d332d32346670732e676966)

或者用 [Figma 向量網路背後的工程] 裡拖曳立方體一條邊的例子：

![拖曳立方體的一條邊](https://alexharri.com/images/posts/vector-networks/31.svg)

雙擊進入編輯模式，然後拖曳立方體的任意一條邊：

<VectorNetworkCube />

值得一提的是，[HN 上的討論]指出 VGC 與 Figma 的 VectorNetwork 極為相似。考慮到兩者大約在同一時期開始探索，並經由不同路徑得到相近的解法，下文將使用 VectorNetwork 這個詞。

> 我是 Figma 的執行長。關於向量網路的大部分原始洞見是在 2013 年形成的，不過我們之後持續打磨實作。我們直到 2015 年 12 月才結束隱身階段並推出 Figma 的封閉測試版，所以在那之前沒有部落格內容。
> 乍看之下，這篇論文精巧極了！我很期待讀它！我不認為自己以前看過；以兩者重疊的程度來說，這很令人意外。

來看看 VectorNetwork 是如何定義的。

## VectorNetwork 的拓撲定義 {#topology-of-vector-network}

VectorNetwork／VGC 的定義比 Path 複雜得多。它的資料結構是一張由頂點、邊與面（填色區域）組成的圖。下圖來自 [向量圖形複體] 原始論文。

![VGC 的拓撲](/vgc-topology.png)

這裡只討論拓撲定義。其他繪製屬性可以和 Path 保持一致：

> 在這個核心結構之上，還可以加入更多繪製屬性，以便精細控制渲染。例如我們加入了頂點半徑、可變的邊寬、單元顏色（可以是透明的），以及邊接合處的樣式（斜接接合或斜角接合）。

頂點很容易理解。在 VGC 中，邊由一對 `start` 與 `end` 頂點索引組成，兩者重合時形成自環。

![VGC 中的節點與邊](/vgc-node-edge.png)

填色區域由頂點的封閉迴圈定義。在 VGC 中，它們用一組半邊（halfedge）定義：

![VGC 中的面](/vgc-face.png)

下面的三角形範例來自 [VectorNetwork API]。可以看到它和 VGC 基本一致，只是填色區域由頂點索引與 fillRule 定義。其他非幾何屬性（例如 `strokeCap`）仍與 Path 一致：

```ts
node.vectorNetwork = {
    // The vertices of the triangle
    vertices: [
        { x: 0, y: 100 },
        { x: 100, y: 100 },
        { x: 50, y: 0 },
    ],

    // The edges of the triangle. 'start' and 'end' refer to indices in the vertices array.
    segments: [
        {
            start: 0,
            tangentStart: { x: 0, y: 0 }, // optional
            end: 1,
            tangentEnd: { x: 0, y: 0 }, // optional
        },
        {
            start: 1,
            end: 2,
        },
        {
            start: 2,
            end: 0,
        },
    ],

    // The loop that forms the triangle. Each loop is a
    // sequence of indices into the segments array.
    regions: [{ windingRule: 'NONZERO', loops: [[0, 1, 2]] }],
};
```

依照 Figma 對三次曲線的慣例：*P*₀ 是起點錨點，*P*₃ 是終點錨點，*P*₁ = *P*₀ + `tangentStart`，*P*₂ = *P*₃ + `tangentEnd`。當兩個控制點都與各自的錨點重合（直線）時，使用兩個點；否則用 `CubicBezierCurve.getPoints` 取樣，並依弦長與控制點凸包選擇分段數（大約 8–64）。

在編輯情境中，頂點與邊由使用者定義，填色區域則需要由系統自動計算。那麼要如何找出這些填色區域？

### 填色 {#filling}

在 `click to fill` 這類操作中，需要找出頂點構成的最小迴圈。

![來源：https://www.figma.com/blog/introducing-vector-networks/](https://alexharri.com/images/posts/vector-networks/40.gif)

我們把 VectorNetwork 視為平面圖，並把每條線段拆成兩條有向半邊。在每個頂點，依極角排序向外的邊；沿著「下一條半邊」（相對於進來的反向邊，最順時針的那條向外邊）走，就能枚舉每一個最小面。包住點擊位置的最小面就是目標區域，把它有序的線段索引迴圈寫入 `VectorRegion.loops`，就能重用上面的填色三角化。

```ts
export function findRegionLoopAtPoint(
    vertices: VectorVertexLike[],
    segments: VectorSegmentLike[],
    point: [number, number],
): number[] | null;
```

> 數值穩健性：共線的邊、重合的頂點與自環都需要 EPS 容差與退化情況的處理；在這種走訪下，無界的外側面具有正的有向面積，必須略過。

### 轉換成 VectorNetwork {#convert-to-vector-network}

依照 [figma-fill-rule-editor]，我們使用這些型別定義：

```ts
export class VectorNetwork {
    @field.object declare vertices: VectorVertex[];
    @field.object declare segments: VectorSegment[];
    @field.object declare regions?: VectorRegion[];
}

interface VectorVertex {
    x: number;
    y: number;
    strokeLinecap?: Stroke['linecap'];
    strokeLinejoin?: Stroke['linejoin'];
    cornerRadius?: number;
    handleMirroring?: HandleMirroring;
}

interface VectorSegment {
    start: number;
    end: number;
    tangentStart?: VectorVertex;
    tangentEnd?: VectorVertex;
}

interface VectorRegion {
    fillRule: CanvasFillRule;
    loops: ReadonlyArray<ReadonlyArray<number>>;
}
```

[折線]是最容易轉換成 VectorNetwork 的幾何：

```ts
class VectorNetwork {
    static fromEntity(entity: Entity): VectorNetwork {
        if (entity.has(Polyline)) {
            const { points } = entity.read(Polyline);
            const vertices: VectorVertex[] = points.map(([x, y]) => ({ x, y }));
            const segments: VectorSegment[] = points.slice(1).map((_, i) => ({
                start: i,
                end: i + 1,
            }));

            return { vertices, segments };
        }
    }
}
```

轉換 `Path` 更費事：先把 SVG 路徑指令正規化（`path2Absolute`），再依序解析每條指令。`M/L/H/V` 產生直線段；`C/S/Q/T` 產生三次曲線（`Q/T` 先提升為三次），把絕對控制點轉成 Figma 風格的相對切線 `tangentStart = P1 - P0` 與 `tangentEnd = P2 - P3`；`S/T` 會追蹤上一個控制點以便反射；遇到 `Z` 時，若最後一點與起點重合，就重用起點頂點以避免重複，封閉的子路徑則產生一個區域迴圈。這段邏輯位於純函式 `pathToVectorNetwork(d, fillRule)`，當 `entity.has(Path)` 時由 `fromEntity` 呼叫。

## 三角化 {#tessellatation}

### 描邊 {#stroke}

我們把圖轉成折線，並用[第 12 課 - 繪製折線]的方法渲染。

-   為每個頂點維護鄰接關係。
-   走訪尚未使用的邊：從一條起始邊向前與向後延伸，只有當目前頂點恰好還剩一條未使用的邊時才繼續，因此度數為 2 的接合處會變成一條折線（用接合而不是端點帽）。
-   在分支處停止（度數 ≥ 3）；用 `NaN` 分隔子路徑。

對於每一條走過的邊：

-   使用 Figma 的三次曲線：*P*₀ 與 *P*₃ 是錨點，*P*₁ = *P*₀ + `tangentStart`，*P*₂ = *P*₃ + `tangentEnd`。
-   直線邊（控制點位於錨點）使用兩個點。
-   否則使用 `CubicBezierCurve.getPoints`，分段數由弦長與控制點凸包推導。

```ts
function tessellateVectorSegment(
    vertices: VectorVertexLike[],
    seg: VectorSegmentLike,
): number[] {
    const a = vertices[seg.start];
    const b = vertices[seg.end];
    const p0 = vec2.fromValues(a.x, a.y);
    const p3 = vec2.fromValues(b.x, b.y);

    const ts = seg.tangentStart;
    const te = seg.tangentEnd;
    const p1 = vec2.create();
    const p2 = vec2.create();
    vec2.add(p1, p0, vec2.fromValues(ts?.x ?? 0, ts?.y ?? 0));
    vec2.add(p2, p3, vec2.fromValues(te?.x ?? 0, te?.y ?? 0));
}
```

<VectorNetwork />

### 填色 {#fill}

走訪每一筆 Figma `loops` 項目（有序的線段索引），用同一個 `tessellateVectorSegment` 三角化每一條邊（包括三次曲線），依走訪順序縫合，去掉重複的點，並閉合這個環。

-   對每個區域與每個迴圈，建立一條封閉輪廓。
-   **nonzero**（或 Figma 的 `windingRule: 'NONZERO'`）：對所有輪廓使用 `triangulate`（libtess）的非零纏繞，支援不相連的島與巢狀孔洞，與輪廓順序無關。
-   **evenodd**（或 `EVENODD`）：`triangulate`（libtess）。
-   多個區域依序三角化；頂點與索引串接成一個網格，並帶有累加的頂點偏移。

### 點擊以填滿區域 {#click-to-fill}

雙擊一個 VectorNetwork 並選擇 **填色（Fill）**。懸停會預覽包住指標的最小面；點擊以填色，再點一次則清除。每次點擊是一步復原。拖曳、被取消的指標與多點觸控縮放不會提交填色。切換工具、按下 Esc、在圖形外的空白畫布上點擊，或銷毀畫布，都會清除預覽。

試試下面的立方體，它一開始就處於 **填色** 模式。懸停在正面、頂面或右面以預覽，然後點擊填色。填滿兩個相鄰的面，再點其中任意一個：只有那個面會被清除。使用畫布的 **復原／重做** 按鈕逐步查看你的變更。

<VectorNetworkCube fill />

在 **填色** 模式中，點擊工具按鈕旁的色票以開啟取色器。點擊面之前先選擇顏色或輸入顏色值。改變顏色也會更新這個網路中所有已經填色的面；顏色變更可以復原。目前各個面共用同一種填色樣式。

`findVectorNetworkFaces` 走訪有向半邊，並把不相連封閉元件的外邊界當成孔洞附加上去。預覽與新建的區域使用 `evenodd`，因此孔洞不依賴邊的儲存方向。既有的 `nonzero`／`evenodd` 填色會依覆蓋範圍解析成最小面；清除一個面時會保留相鄰的填色。

面共用節點的 `fills`。只有描邊的網路上的第一筆填色，會使用鋼筆設定的可見填色，否則退回藍色。預覽存在暫時的 SVG 覆層中，絕不會進入文件、匯出或歷史紀錄。拾取使用局部座標，並支援旋轉、鏡射與縮放。

填色會在尋找面之前，於暫存幾何中把交叉處拆成共用頂點。懸停不會改變文件：第一次填色點擊會同時提交拓撲與繪製，一次復原會把兩者都還原。每個面獨立的繪製仍然是另一項擴充。

## 用鋼筆繪製 {#drawing-with-pen}

選擇 **Vector Network** 鋼筆。點擊以放置轉角錨點；拖曳以放置平滑錨點。第一個錨點在第一條邊提交之前只是暫時預覽，因此放棄單一的點不會建立空的文件節點。

一次拖曳會定義新錨點的向外控制點。它的向內控制點是相反向量，向外向量則成為下一條邊的 `tangentStart`。橡皮筋預覽與已提交的幾何使用同一組三次控制，包括在第一個錨點上的拖曳。預覽也會顯示控制點連線。

在 10 個視埠像素內點擊既有錨點，即可閉合網路並回到選取。吸附使用按下時的位置，因此把閉合控制點拖開不會多建立一個頂點。封閉的面會自動偵測，並用鋼筆設定的填色渲染；預設的僅描邊樣式在使用 **填色** 之前保持不填色。點擊作用中的錨點，或按下 **Enter／Esc**，即可結束一條開放路徑。尚未完成的拖曳會被捨棄。

每條已提交的邊是一步復原。指標取消、離開畫布與切換工具會捨棄進行中的手勢；已提交的邊會保留。復原或外部的幾何編輯會清除延續點，因此下一筆不能接到一個過期的頂點上。預覽屬於該畫布的 SVG 覆層，並從已儲存的節點、歷史紀錄與匯出中排除；銷毀畫布會把它們移除。

### 延續既有的網路 {#resume-with-pen}

選取一個 VectorNetwork 並切換到鋼筆。懸停在既有頂點附近可以看到吸附指示，點擊它作為起點，再點擊或拖曳下一個錨點，即可在同一個網路上新增一條邊。這能延伸端點，並在共用頂點上建立分支。選擇第一個錨點不會改變文件；每條已提交的邊是一步復原。從頂點以外的地方開始，會建立另一個網路。

延續支援旋轉、非均勻縮放與鏡射，預覽與提交使用同一組三次控制。既有的邊控制點、填色與孔洞會被保留；用填色來為新圍起來的面著色。連到既有頂點會結束這一筆，重描一條完全相同的邊不會產生重複。鎖定、隱藏或不可逆的節點不能被延續。繪製過程中的取消、切換工具或復原會捨棄進行中的邊，並保留已完成的編輯。

## 彎曲 {#bending}

在 **彎曲（Bend）** 中，直接拖曳邊上的一個內部點。它的錨點保持固定，被抓住的曲線點跟著指標移動。直線邊會變成三次貝茲曲線。每次更新都從指標按下時的快照開始，避免控制點位移不斷累積。拾取使用螢幕座標，包括旋轉、鏡射與非均勻縮放。

在參數 `t` 處，兩個控制點權重是 `a = 3(1-t)²t` 與 `b = 3(1-t)t²`。對於指標位移 `Δ`，控制點分別移動 `aΔ/(a²+b²)` 與 `bΔ/(a²+b²)`。這在讓被抓住的點留在指標下方的同時，使控制點位移的平方和最小。直接彎曲邊會解除其端點的控制點耦合；其他邊保留自己的控制點。靠近端點時，錨點與控制點的互動優先。

雙擊一個向量網路，選擇 **彎曲**，再選取一個錨點以顯示它的控制點。對於恰好連接兩條邊端的錨點，**控制點耦合（Handle coupling）** 提供三種模式：

-   **獨立（Independent）**：移動其中一個控制點，不改變另一個。
-   **對齊角度（Align angles）**：讓控制點留在相反的射線上，同時保留另一個控制點的長度。
-   **鏡射角度與長度（Mirror angle and length）**：讓控制點方向相反且等長。

改變模式會立刻對齊這一對，並以第一個非零控制點作為參考。拖曳時按住 **Alt** 可打破耦合；之後該錨點保持獨立。有三個或更多邊端接入的分支頂點，控制點保持獨立。一個自環算兩個端。塌縮的控制點沒有方向，因此只耦合角度時會保留另一個控制點，直到被拖曳的控制點再次具有方向。

直線邊會露出指向另一個端點的暫時控制點位置；拖曳其中一個就會建立它的貝茲控制。這些輔助線在被拖曳之前不會改變已儲存的幾何。每一次完成的拖曳或耦合變更都是一步復原。**Esc**、指標取消、離開畫布或切換工具，會取消進行中的拖曳並還原原本的幾何。改變曲線範圍時，在旋轉、鏡射與縮放下會保留錨點位置。

下面來自 [向量網路介紹 - 彎曲]。對貝茲曲線編輯而言，這在 Path 與 VectorNetwork 中都很常見：

> 今日的向量圖形以三次貝茲樣條為基礎。這種曲線有兩個稱為控制點的額外點，它們位於曲線本身之外，控制曲線彎曲的程度，有點像磁鐵把鐵絲吸向自己。改變曲線形狀時，是在空間中拖曳控制點，而不是直接拖曳曲線。

![邊上的控制點](https://alexharri.com/images/posts/vector-networks/39.svg)

在 VectorNetwork 的邊定義中，`tangentStart` 與 `tangentEnd` 可以定義三次貝茲曲線的兩個控制點。兩者都是 `[0, 0]` 時，它退化成直線。

也可以試試 Konva 範例 [如何用錨點修改線段上的點？] 或 [bezierjs]。

雙擊編輯模式、移動／彎曲／切斷／填色工具列，以及中點插入，會在下面的[進入編輯模式與工具列](#vector-edit-mode)說明。

![Figma 中的向量編輯模式](/figma-vectornetwork-mode.png)

```ts
export enum Pen {
    SELECT = 'select',
    HAND = 'hand',
    VECTOR_NETWORK = 'vector-network', // [!code ++]
}
```

這和[第 21 課 - Transformer]中以 OBB 為基礎的做法不同：

-   在編輯模式中，拖曳一條 `VectorSegment` 會移動兩個端點；共用這些頂點的相鄰邊會自然跟著動。
-   拖曳一個 `VectorVertex` 只移動那個頂點；每一條共用它的線段都會自動跟著動——這是 Vector Network 相對於 Path 的核心優勢。新座標透過單一入口 `API.updateNodeVectorNetwork(node, vectorNetwork)` 寫回，它會更新實體的 `VectorNetwork` 元件，並觸發重新三角化與歷史紀錄（復原／重做）。

```ts
// packages/ecs/src/systems/Select.ts
// In handleControlPointMoving, for a vector-network node:
// 1. Read the VectorNetwork component and map the pointer back to local
//    space via the inverse of GlobalTransform.
// 2. Update vertices[activeIndex].x/y.
// 3. Call api.updateNodeVectorNetwork to write back.
```

寫回時，`VectorNetwork.getGeometryBounds` 會重新計算幾何包圍範圍，並把所有頂點平移 `-minX/-minY`，把左上角正規化到局部 `(0, 0)`。在把補償偏移加到 `node.x/y` 之前，它會套用節點的縮放與旋轉，把偏移表達在父座標系統中。因此重新定基準會保留世界空間中的錨點位置。切線是相對於錨點的，不需要平移。

### 進入編輯模式與工具列 {#vector-edit-mode}

依照 Figma 的 [編輯向量圖層]，雙擊一個 `vector-network` 節點即可進入頂點編輯模式：在實體上設定 `Editable.isEditing = true`，並顯示置底置中的 **移動／彎曲／切斷／填色（Move / Bend / Cut / Fill）** 工具列（`VectorNetworkEditMode`，見 `context-vector-network-edit-bar.ts`）。離開編輯（工具列關閉按鈕、Esc，或點擊空白畫布）會寫入 `isEditing: false`；`RenderTransformer` 會隱藏所有編輯錨點（頂點、線段中點、切線控制點）。

| 模式 | 互動 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **移動（Move）** | 拖曳頂點；懸停在線段上以顯示中點，點擊以插入新頂點 |
| **彎曲（Bend）** | 拖曳一條邊直接把它彎曲，或用三種耦合模式編輯它的控制點 |
| **切斷（Cut）** | 與移動相同的中點插入；**點擊一個頂點**以在切斷點打破拓撲，並自動切換到移動，以便把它們拖開 |
| **填色（Fill）** | 懸停以預覽封閉的面；點擊以切換它的填色，同時保留孔洞與相鄰的面 |

錨點的 **懸停醒目提示** 與 **選取** 是分開的：指標離開時會清除 `Transformable.hoveredControlPointIndex`；`selectedControlPointIndex` 在點擊之後會保留，直到你點擊空白處或圖形內部。

### 移動：在線段中點插入頂點 {#insert-at-midpoint}

懸停在線段上時，在曲線中點渲染一個中點錨點（`t = 0.5`；對三次邊而言，是曲線上的那個點）。點擊會呼叫 `splitSegmentAt`（見[建立與刪除](#creation--delete)）以分割這條邊並寫回網路。見 `Select.insertControlPointFromMidpoint` 與 `RenderTransformer.findHoveredVectorNetworkSegmentIndex`（視埠到局部的曲線距離）。

移動可以拖曳單一頂點，或拖曳整條邊並移動兩個端點，同時保留切線。旋轉、縮放與鏡射過的節點使用按下時捕捉的座標系統，避免包圍範圍改變時產生漂移。頂點在靠近另一個頂點時會吸附，並在放開時合併。Esc、指標取消或切換工具會還原整個手勢，包括新插入的中點。切斷在點擊時提交，放開時仍保持不相連。刪除作用在選取的頂點上，即使指標已經移開也一樣。

拖曳期間的幾何變更保持未提交。復原與重做會先還原手勢開始時的幾何，再套用歷史紀錄，讓包圍範圍與頂點來自同一次編輯。如果外部更新已經替換了幾何或變換，舊手勢會被捨棄：之後的移動、放開或 Escape 都不能還原那份過期快照。只改變樣式不會中斷拖曳，取消幾何變更時會保留新的繪製。拖曳期間的刪除會先取消尚未完成的移動，再刪除選取的原始頂點；若是新插入的中點，則只取消那次插入。

## 拓撲算子 {#topological-operators}

### 自動分割交叉 {#automatic-intersections}

提交一條鋼筆邊，或結束一次移動或彎曲拖曳時，會把該網路內的橫向交叉與 T 型接合連起來。這支援直線、三次貝茲、多重交叉，以及三次曲線的自交。de Casteljau 細分會保留曲線形狀；區域與孔洞的走訪會依走訪順序重寫。既有的頂點索引保持穩定，因此鋼筆延續仍然從被點擊的端點開始。

拖曳期間拓撲保持不變。分割會在放開時與圖形編輯一起提交；取消則不會留下接合，復原／重做涵蓋整個操作。呼叫 `splitVectorNetworkIntersections(network)` 可以明確地把匯入的幾何正規化。偵測使用自適應細分與數值精修；相切接觸、重疊區段的布林合併，以及跨不同節點的連接都不支援。只有端點的接觸保持分開，以保留切斷的結果。

Figma 支援[布林運算]，例如聯集。

![來源：https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations](https://help.figma.com/hc/article_attachments/30101990451607)

Paper.js 對實作可能是有用的參考。

### 建立與刪除 {#creation--delete}

[Vector Network 的刪除與修復]

新增頂點：在參數 `t` 處把一條線段分成兩條，並插入新頂點（三次邊用 de Casteljau 細分以保留曲線），而不是在點陣列裡做普通的拼接：

```ts
export function splitSegmentAt(
    network: VectorNetworkData,
    segIdx: number,
    t: number,
): number; // Mutates network and returns the new vertex index.
```

刪除頂點：移除該頂點及其入射邊之後，度數為 2 的鄰居會被「修復」，把它的兩條邊合併成一條，使路徑保持相連（對應 Figma 的 Delete and Heal）。在編輯模式中以 **Delete／Backspace** 觸發：

```ts
export function deleteVertex(
    network: VectorNetworkData,
    vertexIdx: number,
): VectorNetworkData;
```

> 刪除、打斷與合併會回傳一個新的網路；`splitSegmentAt` 會變更傳入的網路複本，並回傳插入的頂點索引。`packages/ecs/src/utils/vector-network-topology.ts` 中的算子與渲染解耦，可以獨立測試；編輯系統把它們的結果透過 `API.updateNodeVectorNetwork` 回饋。

對於曲線，修復會先嘗試還原原本被細分的三次曲線。否則它會擬合一條帶有已檢查誤差界限的三次曲線，預設為控制點包圍範圍的 5%；`maxError` 以局部單位設定容差。若無法滿足容差，就保留原本的網路。**Shift + Delete／Backspace** 會移除頂點與入射邊，而不進行修復。分割與編輯會依走訪順序重新對應邊界索引，並保留有效的區域。

### 黏合與分離 {#glue-unglue}

![黏合與分離算子](/vgc-operator-glue-unglue.png)

在 **移動** 中選取一個頂點，然後點擊 **黏合／分離（Glue / Unglue）**（鎖鏈圖示）。面板會把頂點標成 **V1、V2、…**，並把入射邊標成畫布上的 **E1、E2、…**。

-   **黏合**：選擇一個目標頂點並確認。選取的頂點會移到目標上，它們的連接會被合併。不同的曲線與彎曲的自環會被保留；完全相同的邊會合併。
-   **分離**：勾選要拆開的邊端，然後確認。會在同一位置建立一個新頂點，只連到那些端。它會成為選取狀態，因此你可以立刻把它拖開。至少要讓一個端留在原始頂點上。自環的起點與終點可以分開選擇。

試著選取立方體正面右上的接合處，開啟 **黏合／分離**，並拆開 **E7 · Start**。把選取的複本拖開，再用 **黏合**、以 **V3** 為目標把它接回去。

<VectorNetworkCube topology />

預覽不會修改文件。取消會把它關閉且不改變幾何；外部的幾何更新、復原，或離開編輯模式，都會使進行中的操作失效。每一次確認的操作是一步復原。分離會保留曲線幾何與仍然封閉的區域；打開外邊界或孔洞會移除整個受影響的填色區域。黏合會恢復連接性，但不會自動恢復被移除的填色：請再次使用填色，或用復原恢復完整的先前狀態。

`glueVertices(network, source, target)` 與 `unglueVertex(network, vertex, endpoints)` 回傳 `VectorTopologyResult`：失敗原因，或是新的網路、頂點／線段索引對應，以及選取的頂點索引。端點使用 `{ segmentIndex, end: 'start' | 'end' }`；API 中的索引從零開始。輸入不會被變更。這個第一階段作用在同一個網路內的頂點上；共用邊與面的操作在下面說明。

#### 共用邊的黏合／分離 {#shared-edge-glue-unglue}

在 **移動** 中選取一個端點並開啟 **黏合／分離**，然後把 **拓撲目標（Topology target）** 設為 **邊（Edges）**。選擇一條 **來源邊（Source edge）**，以把它入射的填色區域標成 **R1、R2、…**。被勾選的區域會醒目提示。邊界用途標成 **R（區域）· L（迴圈）· 在迴圈中的位置**，全部從 1 開始。

下面的立方體有三個填色的面。選取正面右上的頂點 **V3**，選擇 **分離邊 → E7**，勾選 **R2 · L1 · 4**（頂面），然後確認。頂面現在使用複本 **E10**，右面仍然使用 **E7**。分離會自動進入 **彎曲**：拖曳對角線的中間，只彎曲複本與頂面的邊界。兩個端點仍然共用。若要改為編輯重疊的原始邊，回到移動，在邊面板中選擇 E7，並點擊 **彎曲選取的邊**。

<VectorNetworkCube edges />

復原這次彎曲，讓曲線再次重合，切回移動並選取 V3。在邊面板中，選擇 **黏合邊** 以把 **E10** 合併進 **E7**。黏合支援相反的儲存方向，並會焊接索引不同但位置重合的端點頂點。只會移除被要求的來源邊；無關的重複邊會留下。曲線或控制點不符、端點不相容、兩條邊用在同一個邊界迴圈中，以及可能改變非零填色的部分纏繞反轉，都會被拒絕。

分離會保留曲線幾何、端點與所有區域（包括孔洞），只把選取的邊界用途移到複本上。至少要有一處用途留在原始邊上。區域目前儲存的是填色邊界：一條邊至少需要兩處這樣的用途，因此必要時請先填滿相鄰的面。填色可以把匯入的寬區域正規化成各自的面。複本仍然重疊時，使用彎曲或黏合；填色以及面的切斷／取消切斷仍然假設平面嵌入。每一次黏合／分離是一步復原。預覽與 **彎曲選取的邊** 不會建立歷史紀錄項目。

純函式 `vectorEdgeUses(network, edge)` 回傳 `{ regionIndex, loopIndex, offset }` 項目。`unglueVectorNetworkEdge(network, edge, uses)` 與 `glueVectorNetworkEdges(network, source, target)` 回傳 `VectorEdgeTopologyResult`：新的網路、頂點／邊索引對應與選取的邊，或失敗原因。API 索引從零開始；輸入不會被變更。

### 切斷與取消切斷 {#cut-uncut}

![切斷與取消切斷算子](/vgc-operator-cut-uncut.png)

#### 分割與合併面 {#split-and-merge-faces}

在 **移動** 中選取一個頂點，並點擊 **切斷／取消切斷面（Cut / Uncut faces）**（分裂路徑圖示）。**切斷面** 用一條直線接縫連接同一個面的邊界頂點，包括連到孔洞或孔洞之間的連接。**取消切斷邊** 會移除相鄰面之間的共用邊，或連接邊界元件的接縫。頂點位置與既有的曲線控制點保持不變。兩種操作都支援一步復原／重做。

試試下面填色的正面：選取它的 **左下頂點 V1**，選擇 **切斷面 → V3**，然後確認。新的對角線 **E10** 會把藍色的面分成兩個填色的三角形。再次開啟面板，選擇 **取消切斷邊 → E10**，確認後把它們合併回去。你可以用填色清除其中一個三角形；此時取消切斷會說明兩側必須具有相同的填色狀態，而不是出乎意料地改變已繪製的區域。

<VectorNetworkCube faces />

切斷必須留在一個平面面的內部：與另一條邊交叉或接觸、與一條邊重疊，或穿過孔洞，都會被拒絕。兩側既有的曲線邊界與孔洞會被保留。切斷目前使用直線接縫，而不是任意繪製的曲線。當取消切斷合併兩個有界的面時，兩者都必須已填色，或兩者都未填色。移除連接孔洞邊界的接縫會保留原本的填色。懸空的描邊不會被當成連接邊界的接縫而移除。預覽是暫時的；取消、復原、改變選取的頂點，或外部的幾何更新，都會捨棄它。被拒絕的操作會說明原因，並且不建立歷史紀錄項目。

純函式 `cutVectorNetworkFace(network, from, to)` 與 `uncutVectorNetworkEdge(network, edgeIndex)` 回傳 `VectorFaceTopologyResult`，包含失敗原因，或新的網路、頂點／邊索引對應與選取的頂點。索引從零開始。填色區域會被正規化成最小的平面面，並保留可見的繪製區域與孔洞。這個面操作和下面描述的、用來打開頂點的既有切斷工具是分開的。

#### 連接孔洞邊界 {#connecting-hole-boundaries}

下面的環有一個未填色的孔洞。在移動中，選取外側左上角 **V1**，開啟 **切斷／取消切斷面**，並選擇 **切斷面 → V5**。新的 **E9** 把外邊界連到孔洞。藍色區域仍然是一個面，孔洞保持透明，邊界會沿 E9 的兩個方向各走一次。

接著選取外側右上角 **V2**，並選擇 **切斷面 → V6**。新的 **E10** 把這個環分成兩個面，填色可以分別切換它們。在不改變填色的情況下，選取 V2 並 **取消切斷邊 → E10**，再選取 V1 並 **取消切斷邊 → E9**，即可還原成具有兩條分開邊界迴圈的環。每一步都支援復原與重做。

<VectorNetworkFaceCut />

當整條接縫位於同一個面內部、且不接觸其他邊界時，也可以連接兩個孔洞。連接不同的邊界會移除一個邊界迴圈而不新增面；在同一個邊界內切斷則會新增一個面。既有的曲線邊界保持不變，填色會被正規化成 `evenodd` 面區域，同時保留它們的覆蓋範圍。

#### 打開一個頂點 {#open-a-vertex}

切斷會 **在選取的頂點打破拓撲**。複製該頂點，保留它的第一個入射端點，並把其餘端點移到複本上。封閉迴圈與開放鏈使用同一條規則。對於三角形 `0—1—2—0`，在頂點 `1` 切斷：

```plaintext
Before:  0 — 1 — 2 — 0 (closed)
After:   1 — 0 — 2 — 3 (3 coincident with 1, open polyline)
segments: [0,1], [3,2], [2,0]
```

在開放折線上，**複製被切斷的頂點**，並把除了第一條入射邊以外的邊都改派到複本上，使兩條鏈可以在移動模式中被拉開。見 `breakVertex`：

```ts
export function breakVertex(
    network: VectorNetworkData,
    vertexIndex: number,
): VectorNetworkData | null;
```

在切斷模式中點擊頂點會呼叫 `breakVectorNetworkAtVertex`（`Select.ts`），寫回網路、記錄歷史，並 `setAppState({ vectorNetworkEditMode: MOVE })`，以便立刻拖曳。邊界仍然封閉的區域會被保留。無效的邊界會移除包含它的區域，包括孔洞被打破時，以避免意外填滿那個孔洞。清除時使用明確的 `regions: []`，使實體與復原歷史保持同步。只有一個頂點的三次自環也可以被切斷。

## 延伸閱讀 {#extended-reading}

-   [向量網路介紹]
-   [Figma 向量網路背後的工程]
-   [向量圖形複體]
-   [圖形編輯器開發：鋼筆工具的實作]
-   [vpaint]
-   [penpot]

[向量網路介紹]: https://www.figma.com/blog/introducing-vector-networks/
[向量網路介紹 - 彎曲]: https://www.figma.com/blog/introducing-vector-networks/#bending
[Vector Network 的刪除與修復]: https://www.figma.com/blog/delete-and-heal-for-vector-networks/
[VectorNetwork API]: https://www.figma.com/plugin-docs/api/VectorNetwork/
[VectorPath API]: https://www.figma.com/plugin-docs/api/VectorPath/
[VectorPath-data]: https://www.figma.com/plugin-docs/api/properties/VectorPath-data/
[向量圖形複體]: https://www.borisdalstein.com/research/vgc/
[Figma 向量網路背後的工程]: https://alexharri.com/blog/vector-networks
[HN 上的討論]: https://news.ycombinator.com/item?id=39241825
[vpaint]: https://github.com/dalboris/vpaint
[penpot]: https://github.com/penpot/penpot
[圖形編輯器開發：鋼筆工具的實作]: https://zhuanlan.zhihu.com/p/694407842
[第 12 課 - 繪製折線]: /zh-Hant/guide/lesson-012
[第 13 課 - 繪製路徑與手繪風格]: /zh-Hant/guide/lesson-013
[fillRule]: /zh-Hant/guide/lesson-013#fill-rule
[如何用錨點修改線段上的點？]: https://konvajs.org/docs/sandbox/Modify_Curves_with_Anchor_Points.html
[bezierjs]: http://pomax.github.io/bezierjs
[figma-fill-rule-editor]: https://github.com/evanw/figma-fill-rule-editor
[折線]: /zh-Hant/guide/lesson-012
[第 21 課 - Transformer]: /zh-Hant/guide/lesson-021
[編輯向量圖層]: https://help.figma.com/hc/en-us/articles/360039957634-Edit-vector-layers#h_01JYM29VEN8ABWTDXJR529446R
[布林運算]: https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations
