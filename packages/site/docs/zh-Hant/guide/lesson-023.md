---
outline: deep
description: '以樹狀版面演算法實作心智圖功能。研究從 d3-tree 到 d3-flextree 的演進、複雜度分析，以及擴充到 N 元樹，以支援彈性的心智圖。'
head:
    - ['meta', { property: 'og:title', content: '第 23 課 - 心智圖' }]
---

<script setup>
import Tree from '../../components/Tree.vue';
import FlexTree from '../../components/FlexTree.vue';
import Mindmap from '../../components/Mindmap.vue';
</script>

# 第 23 課 - 心智圖 {#lesson-23-mindmap}

許多無限畫布應用程式都支援心智圖，例如 [miro]、[excalidraw]、[canva]、[xmind] 等。
我很喜歡 [excalidraw] 的分類方式，它把心智圖再分成三種子類型：

-   [蜘蛛圖]適合腦力激盪的情境，從中心的核心主題像蜘蛛網一樣向外延伸。從渲染的角度，[mermaid] 也提供這種類型。
-   [樹狀圖]
-   [流程圖]

|                                                                          蜘蛛圖                                                                          |                                                                         樹狀圖                                                                         |                                                                             流程圖                                                                             |
| :----------------------------------------------------------------------------------------------------------------------------------------------------: | :----------------------------------------------------------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------------------------: |
| ![來源：https://plus.excalidraw.com/use-cases/mind-map#spider-map](https://excalidraw.nyc3.cdn.digitaloceanspaces.com/lp-cms/media/Spider%20map%20example.png) | ![來源：https://plus.excalidraw.com/use-cases/mind-map#tree-map](https://excalidraw.nyc3.cdn.digitaloceanspaces.com/lp-cms/media/Tree%20map%20example.png) | ![https://plus.excalidraw.com/use-cases/mind-map#multi-flow-map](https://excalidraw.nyc3.cdn.digitaloceanspaces.com/lp-cms/media/Multi-flow%20map%20example.png) |

這裡只討論最後一種。

雖然心智圖的最終呈現可以差很多，但從資料結構來看，心智圖是由節點與邊組成的樹狀結構。[markmap] 與 [mermaid] 會把 markdown 轉成這種結構。樹是一種特殊的圖結構，有向圖也有一些版面演算法，例如 [dagre] 與 [elkjs]，但這裡不考慮它們。

```json
{
    "id": "Modeling Methods",
    "children": [
        {
            "id": "Classification",
            "children": []
        }
    ]
}
```

對於這類資料，[d3-hierarchy] 提供一系列現成的演算法，我們只關注 [d3-tree]。

## d3-tree {#d3-tree}

先加上兩個稍後會介紹如何打破的限制：目標是二元樹，而且所有節點的尺寸相同（或者說沒有尺寸）。

[d3-tree] 的實作思路來自：[更整齊的樹狀繪圖]。它在先前研究的基礎上提出幾項美學標準：

> -   美學標準 1：樹中同一層的節點應
>     落在一條直線上，而定義各層的直線
>     應彼此平行。
> -   美學標準 2：左子節點應位於
>     父節點的左側，右子節點應位於右側。
> -   美學標準 3：父節點應位於其子節點的正上方中央。
> -   美學標準 4：一棵樹與其鏡像所畫出的圖應互為反射；此外，一棵子樹無論出現在樹的哪裡，畫法都應相同。

前三項標準的演進與改進可以閱讀 [繪製好看的樹]。它用 Python 程式碼與圖示，詳細展示先前論文的演算法思路。例如實作第三項標準很簡單：使用後序走訪，把父節點的 x 座標設為最左與最右子節點的中點：

```ts
// @see https://github.com/d3/d3-hierarchy/blob/main/src/tree.js#L150
var midpoint = (children[0].z + children[children.length - 1].z) / 2;
```

可以清楚看出它仍然不夠對稱，整體偏右，這就引出第四項標準：

|                                盡可能窄                                |                                父節點應位於其子節點的正上方中央                                |
| :---------------------------------------------------------------------: | :---------------------------------------------------------------------------------------------: |
| ![盡可能窄](https://llimllib.github.io/pymag-trees/images/figure3.png) | ![父節點應位於其子節點的正上方中央](https://llimllib.github.io/pymag-trees/images/figure4.png) |

把父節點置中的操作可能和它的兄弟節點位置衝突。這時需要移動整棵子樹，但如果使用下面的遞迴方式，演算法複雜度會變成 $O(n^2)$：

```python
def move_right(branch, n):
    branch.x += n
    for c in branch.children:
        move_right(c, n)
```

這時需要為節點加上 `mod` 屬性，讓父節點置中的操作可以暫時忽略衝突，稍後再移動。這樣就避免了遞迴，把演算法複雜度拉回 $O(n)$。還需要新增一個 `prelim` 屬性，這個名稱來自：[一般樹的節點定位演算法]：

```ts
// @see https://github.com/d3/d3-hierarchy/blob/main/src/tree.js#L67
function TreeNode(node, i) {
    this._ = node; // final position: _.x
    this.parent = null;
    this.children = null;
    this.z = 0; // prelim // [!code ++]
    this.m = 0; // mod // [!code ++]
}
```

因為使用後序走訪：

```ts
function tree(root) {
    var t = treeRoot(root);
    t.eachAfter(firstWalk);
    t.eachBefore(secondWalk);
}
```

在第二次的前序走訪中，遞迴累加 `mod`，完成向右的平移並得到最終位置 `_.x`。這對應原始論文中的 `PETRIFY` 步驟：

```ts
// @see https://github.com/d3/d3-hierarchy/blob/main/src/tree.js#L164
function secondWalk(v) {
    v._.x = v.z + v.parent.m; // final x
    v.m += v.parent.m;
}
```

這裡需要介紹 `contour`（輪廓）的概念。例如下面左樹的右輪廓是 `[1, 1, 2]`，右樹的左輪廓是 `[1, 0, 1]`。當需要避免這兩棵子樹重疊時，只要比較這兩條輪廓，就能決定右樹需要向右移動多少。在這個例子中，移動距離是 2。

![輪廓](https://llimllib.github.io/pymag-trees/images/figure6.png)

```python
def push_right(left, right):
    wl = contour(left, lt)
    wr = contour(right, gt)
    return max(x-y for x,y in zip(wl, wr)) + 1
```

取得子樹輪廓的演算法仍然需要遞迴，因此複雜度是 $O(n^2)$。為了最佳化，引入 `thread`（穿線）的概念。下圖中的虛線表示這種不同於父子關係的關係，勾勒出每棵子樹可能實際上並不存在的輪廓：

![ ](/thread.png)

```ts
function TreeNode(node, i) {
    this.t = null; // thread // [!code ++]
}
```

這樣在計算 `contour` 時，就可以跨越實際的階層結構，直接透過 `thread` 取得，把複雜度降到 $O(n)$：

```ts
// @see https://github.com/d3/d3-hierarchy/blob/main/src/tree.js#L15C1-L24C2
function nextLeft(v) {
    var children = v.children;
    return children ? children[0] : v.t;
}
function nextRight(v) {
    var children = v.children;
    return children ? children[children.length - 1] : v.t;
}
```

### 複雜度分析 {#math-analysis}

來回顧這個演算法。首先做一次後序走訪，計算節點的相對座標與 `thread`，然後做一次前序走訪，累加 `mod` 並決定每個節點的絕對座標位置。顯然，在這兩次走訪中每個節點只被拜訪一次。因此只需要決定第一次走訪中輪廓掃描的複雜度。

原始論文也對這一步的複雜度提供了數學分析。$F(T)$ 表示「在整棵樹 T 中，輪廓掃描總共需要拜訪多少個節點？」其中子樹的 $h(T)$ 表示從根到葉節點的最大深度，也就是路徑節點數減 1。它代表輪廓掃描時最壞情況的存取深度。逐層比較兩條輪廓的間距時，一旦任一條輪廓到達底部（沒有更深的層），掃描就停止，所以這裡使用 $min()$：

![ ](/tidy-analysis.png)

接下來只需要證明 $F(T) ≤ n(T)$，其中 $n(T)$ 表示子樹的節點總數。這就確認整體演算法複雜度是 $O(n)$。

作者提出假設：$F(T) = n(T) - h(T)$。理由是每個內部節點（非葉節點）最多參與一次輪廓比較，而葉節點不需要掃描，因為沒有子樹可比。整棵樹有 $n(T)$ 個節點，其中至少有 $h(T)$ 個葉節點位於最深的路徑上，因此最多只有 $n(T) − h(T)$ 個節點需要參與輪廓掃描。這實際上決定了掃描存取節點數的上界，接下來只需要證明：對任意樹 $T$，輪廓掃描存取的節點數 $Scan(T) ≤ F(T)$。

使用數學歸納法，它在 $N = 0$（不需要掃描）與 $N = 1$ 時成立。假設 $Scan(T) ≤ F(T) = n(T) − h(T)$。

依照定義（加上根節點）：

$$
\begin{align*}
n(T) &= 1 + n(T_l) + n(T_r) \\
h(T) &= 1 + max(h(T_r), h(T_r))
\end{align*}
$$

代入：

$$
\begin{align*}
F(T) &= n(T) − h(T) \\
    &= 1 + n(T_l) + n(T_r) − [1 + max(h(T_l), h(T_r))] \\
    &= [n(T_l) − h_l] + [n(T_r) − h_r] + [h_l + h_r − max(h_l, h_r)] \\
    &≥ F(T_l) + F(T_r) + min(h_l, h_r)
\end{align*}
$$

因此：$F(T) ≥ F(T_l) + F(T_r) + min(h(T_l), h(T_r)) ≥ Scan(T)$

### 擴充到 N 元樹 {#n-ary-tree}

我們可以從左到右依序處理需要平移的子樹，但這會得到下面的圖 (a)。也可以再加上從右到左的走訪，但這會得到情況 (b)。我們想要的是 (d) 的效果：

![來源：[讓 Walker 演算法在線性時間內執行]](/n-ary.png)

[一般樹的節點定位演算法]提出了一種解法。值得注意的是，[d3-tree] 的程式結構與變數名稱基本上沿用了這篇論文。下圖展示加入子樹過程中的重新排版效果：

![來源：[讓 Walker 演算法在線性時間內執行]](/n-ary-2.png)

`apportion` 函式是整個版面中核心的「子樹之間對齊邏輯」。它負責比較目前子樹與前一棵子樹的輪廓；若它們重疊，就給目前子樹加上一個 `shift`；更新修飾量，使後代節點也跟著調整；並平滑中間的修飾量，以避免「空隙」。

```plaintext
function apportion(v):
    leftMost = firstChild(v)
    rightMost = lastChild(v)
    defaultAncestor = leftMost

    for each child w from second to last:
        leftSibling = previousSibling(w)

        # Initialize contour pointers
        vip = w
        vim = leftSibling
        sip = vip.mod
        sim = vim.mod

        # Compare right contour of vim and left contour of vip
        while vim ≠ null and vip ≠ null:
            shift = (vim.prelim + sim + separation) - (vip.prelim + sip)

            if shift > 0:
                # Move current subtree right
                moveSubtree(ancestor(w, v, defaultAncestor), v, shift)
                sip += shift

            # move to next lower level
            vim = rightmostChild(vim)
            vip = leftmostChild(vip)

            sim += vim?.mod or 0
            sip += vip?.mod or 0

        # update default ancestor
        if rightMostChild(vim) ≠ null and leftMostChild(vip) == null:
            defaultAncestor = ancestor(w, v, defaultAncestor)

```

繼續為節點加上屬性以儲存 `shift`：

```ts
function TreeNode(node, i) {
    this.c = 0; // change  // [!code ++]
    this.s = 0; // shift  // [!code ++]
    this.A = null; // default ancestor // [!code ++]
    this.a = this; // ancestor // [!code ++]
}
```

其中 `moveSubtree` 把以 `wp` 為根的整棵子樹向右移動 `shift` 個單位。

```ts
// @see https://github.com/d3/d3-hierarchy/blob/main/src/tree.js#L28C10-L28C21
function moveSubtree(wm, wp, shift) {
    var change = shift / (wp.i - wm.i);
    wp.c -= change;
    wp.s += shift;
    wm.c += change;
    wp.z += shift;
    wp.m += shift;
}
```

這個實作的複雜度是 $O(n^2)$。[讓 Walker 演算法在線性時間內執行]試圖把它最佳化到 $O(n)$。

如果需要水平顯示，只要對調座標系統，交換節點的 x/y 座標即可。

<Tree />

## d3-flextree {#d3-flextree}

上面的演算法有一個明顯限制：它要求所有節點的寬度與高度相同，就像許多 d3-tree 範例用同樣大小的圓當作節點。我非常推薦閱讀 [在線性時間內繪製非分層的整齊樹] 與 [高效能的整齊樹視覺化]。

![ ](/layered-non-layered-tidy.png)

[d3-flextree] 就是為了解決這個問題而建立的，[markmap] 使用它。

> 那個演算法的一項限制是，它適用於所有節點尺寸都相同的樹。這對許多應用已經足夠，但允許節點尺寸不同的更一般解法，往往更可取。

效果如下：

<FlexTree />

## @antv/hierarchy {#antv-hierarchy}

[@antv/hierarchy] 中的 `mindmap` 演算法與 [mindmap-layouts] 提出以下美學要求：

-   根節點置中
-   子節點可以分布在左右兩側（通常對稱，或依照 `getSide` 設定）
-   同一層的節點在垂直方向均勻排列

它也支援定義節點尺寸，而且不使用輪廓掃描。大致步驟如下，整體演算法複雜度是 $O(n)$：

-   第一趟：快速設定一個基本的 x 座標。
-   第二趟：由下而上計算每棵子樹需要的垂直空間。
-   第三趟（調整階段）：由上而下，用算出的空間資訊，為所有子節點安排互不重疊的 y 座標。
-   第四趟：再次由下而上，依照子節點的最終版面，微調父節點位置以達到垂直置中。

效果如下：

<Mindmap />

## [WIP] 互動 {#interaction}

心智圖有許多特殊互動，包括點擊節點以展開／摺疊子節點。

## 延伸閱讀 {#extended-reading}

-   [HN 討論]
-   [繪製好看的樹]
-   [一般樹的節點定位演算法]
-   [讓 Walker 演算法在線性時間內執行]
-   [在線性時間內繪製非分層的整齊樹]
-   [高效能的整齊樹視覺化]

[markmap]: https://github.com/markmap/markmap
[@antv/hierarchy]: https://github.com/antvis/hierarchy/
[xmind]: https://xmind.com/
[miro]: https://miro.com/mind-map/
[excalidraw]: https://plus.excalidraw.com/use-cases/mind-map
[canva]: https://www.canva.com/graphs/mind-maps/
[蜘蛛圖]: https://en.wikipedia.org/wiki/Spider_mapping
[mermaid]: https://mermaid.js.org/syntax/mindmap.html
[樹狀圖]: https://en.wikipedia.org/wiki/Treemapping
[流程圖]: https://en.wikipedia.org/wiki/Flow_map
[d3-hierarchy]: https://d3js.org/d3-hierarchy
[d3-tree]: https://d3js.org/d3-hierarchy/tree
[d3-flextree]: https://github.com/Klortho/d3-flextree
[更整齊的樹狀繪圖]: https://reingold.co/tidier-drawings.pdf
[繪製好看的樹]: https://llimllib.github.io/pymag-trees/
[HN 討論]: https://news.ycombinator.com/item?id=10366299
[讓 Walker 演算法在線性時間內執行]: https://link.springer.com/content/pdf/10.1007/3-540-36151-0_32.pdf
[一般樹的節點定位演算法]: https://www.cs.unc.edu/techreports/89-034.pdf
[高效能的整齊樹視覺化]: https://www.zxch3n.com/tidy/tidy/
[在線性時間內繪製非分層的整齊樹]: https://github.com/Klortho/d3-flextree/blob/master/papers/van-der-ploeg-2013.pdf
[mindmap-layouts]: https://github.com/leungwensen/mindmap-layouts
[dagre]: https://github.com/dagrejs/dagre
[elkjs]: https://github.com/kieler/elkjs
