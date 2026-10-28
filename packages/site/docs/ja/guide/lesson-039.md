---
outline: deep
description: '既存の 2D 無限キャンバスの上に、本物の 3D メッシュレンダリングを重ねます。統一された 3D 空間、Camera3D、MeshPipeline3D を扱います。'
head:
    - [
          'meta',
          { property: 'og:title', content: '第39課 - 3D メッシュレンダリング' },
      ]
---

<script setup>
import Cube from '../../components/Cube.vue'
import CubePerspective from '../../components/CubePerspective.vue'
import Lighting from '../../components/Lighting.vue'
import GltfDuck from '../../components/GltfDuck.vue'
import SvgExtrusion from '../../components/SvgExtrusion.vue'
import IconExtrusion from '../../components/IconExtrusion.vue'
</script>

# 第 39 課 - 3D メッシュレンダリング {#lesson-39-3d-mesh-rendering}

[第 30 課 - ポストプロセスとレンダーグラフ][Lesson 30 - Post-processing and render graph]より前は、キャンバス上のすべてが 2D パイプラインを通っていました。正投影カメラ、SDF、パスの三角形分割による塗りなどです。この課では、その 2D レンダラーを置き換えずに 3D メッシュの分岐を追加します。頂点は法線を持ち、透視投影と正投影、深度テストを経て、同じキャンバス上で 2D レイヤーと合成されます。

## Framer、Spline、Rive、Bevy {#framer-spline-rive-bevy}

Framer と Spline で 2D と 3D を組み合わせる中心的な考え方は、二つの技術的な道筋にまとめられます。各製品は、自らの位置づけに応じて異なるアーキテクチャを選んでいます。

Framer の 3D 機能は、本質的には CSS 3D 変換を強化して包んだものであり、本物の 3D レンダリングパイプラインではありません。そのため外部の 3D モデルの読み込み（GLB/OBJ）はなく、実際のライティング、影、マテリアルシステムもありません。3D 効果はカードの裏返しやパララックスレイヤーのような単純な場合に限られます。参照: [How to Turn 2D Elements into Interactive 3D Objects in Framer]

![出典: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer](https://framerusercontent.com/images/j0Ohpy2LqEoU8uSlHGeoymyLlg.png)

Spline は本物の 3D エディタで、アーキテクチャはゲームエンジンに近いものです。Spline では独立した [UI Scenes]（2D キャンバス）を作り、3D シーンの UI Frame オブジェクトのテクスチャとして使えます。[Working with 2D and 3D objects]

![出典: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects](https://cdn.spline.design/_assets/docs/957fce0d-3bef-420c-90b0-9085ffec39fd.png)

Rive は今も基本的には 2D のツールです。「立体的に見える」印象は 2.5D 変換やメッシュ変形のような手法から来るもので、完全な 3D パイプラインではありません。

私たちのアプローチは [2D Rendering in Bevy] に近いものです。2D 図形は **z = 0** 平面上にあり、3D モデルは同じワールドを共有します。2D カメラをパンまたはズームすると、3D カメラは任意で追従できます。実装は [PR #271](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/271) を参照してください。

## アーキテクチャの概要 {#architecture}

```plaintext
Same WebGL/WebGPU context
  └─ MeshPipeline render graph
       ├─ Pass: 3D (MeshPipeline3D.drawMeshes)
       ├─ Pass: 3D Gizmo (RenderGizmo3D.drawGizmos, on top of meshes)
       ├─ Pass: grid / 2D vector (existing BatchManager)
       └─ Pass: post-processing → present
```

-   **`Renderer3DPlugin`**: 3D コンポーネントを登録し、`MeshPipeline3D`（GPU キャッシュ）、**`CameraSync`**（2D カメラとの連動）、**`Pick3D`**（選択／ドラッグ）、**`RenderGizmo3D`**（変換ギズモの描画）をスケジュールします。
-   **`MeshPipeline3D`**: 独自のスワップチェーンを画面に提示しません。`MeshPipeline` のメインパスの中で **先に 3D を描き、その後 2D を描き**、カラーアタッチメントと深度アタッチメントを共有します。
-   既存の **`Mesh.ts`** は引き続き **2D ベクターの塗り**です。3D の `Mesh3D` と混同しないでください。

プラグインの設定:

```ts
import {
    App,
    DefaultPlugins,
    DefaultRenderer3DPlugin,
} from '@infinite-canvas-tutorial/ecs';

const app = new App().addPlugins(...DefaultPlugins, DefaultRenderer3DPlugin);
app.run();
```

## 中核コンポーネント {#components}

| コンポーネント    | 役割                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **`Camera3D`**    | `projection: 'perspective' \| 'orthographic'`。`linked` のとき `CameraSync` が 2D のパン／ズームに従います                     |
| **`Mesh3D`**      | `positions`、`normals`、任意の `indices`（三角形メッシュ）                                                                     |
| **`Material3D`**  | メタリック・ラフネス PBR: `baseColor`、`metallic`、`roughness`、アンビエントの強さ。レガシーフィールドは互換性のために残します |
| **`Light3D`**     | `ambient` / `directional` / `point` / `spot`。[シーンライティングの例](/example/lighting)を参照してください                    |
| **`Transform3D`** | 平行移動、オイラー回転、スケール                                                                                               |
| **`Selected3D`**  | 3D の選択状態: ギズモモード、アクティブな軸／平面、ドラッグの基準点など。[3D 変換ギズモ](#gizmo)を参照してください             |
| **`Mat4`**        | 4×4 行列のヘルパー（`perspective` / `ortho` / `lookAt`）                                                                       |

ECS の `commands.spawn` でエンティティを生成します。例は次のとおりです。

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

## 統一された 3D 空間（連動カメラ） {#unified-space}

**キャンバスをパン／ズームしたときに 2D と 3D を一緒に動かす**には、`Camera3D` に `linked: true` を設定します。

毎フレーム、`CameraSync` は 2D の `ComputedCamera` の `(x, y, zoom)` を読み、3D カメラの `eye` / `center` / `baseDistance` に書き込みます。

-   ズーム: `baseDistance = canvas.height / 2`、`eye.z = baseDistance / zoom`。z = 0 における 2D の `mat3.projection` の見える高さと一致します。
-   **連動した正投影**（`projection: 'orthographic'`）: `eye = [x, -y, distance]`、`center = [x, -y, 0]`（2D キャンバスの Y は下向き、3D ワールドの Y は上向きです。`canvasWorldToWorld3D` で反転します）
-   **連動した透視投影**（`projection: 'perspective'`）: `eye = [x, y, distance]`、`center = [x, y, 0]`（2D ノードと同じです。**キャンバス座標で、Y は下向き**です）

### 連動 + 正投影 {#linked-orthographic}

`MeshPipeline3D` は 2D の `viewProjectionMatrix` をそのまま使います。Y の反転、パン、ズームが含まれるため、`extrude3d` と 2D の矩形が厳密に揃います。

[立方体（正投影）](/example/cube)の例は **連動 + 正投影** を使います（`translation: [200, 100, 40]`）。

<Cube />

### 連動 + 透視投影 {#linked-perspective}

透視投影モードでは、画面上の位置は **完全な 2D VP** から決まります。パン、ズーム、Y の反転は 2D と一致します。深度は `Transform3D.translation.z` に透視行列を適用し、近いほど大きく見えます。アンカーは `translation` の `(x, y, z)` なので、オブジェクトは 2D と同じ `(x, y)` に置かれます。

[立方体（透視投影）](/example/cube-perspective)は、上の **連動 + 透視投影** の設定を使います。キャンバスをドラッグすると、立方体は 2D レイヤーと一緒にパンおよびズームするはずです。

<CubePerspective />

## レイキャストによるピッキング {#raycast-picking}

3D の選択とギズモの操作は **`Pick3D`** システムが処理します。選択ツールが有効なとき、**`Select`** も同じシステムを使います。ポインタを押すと、カーソル下のビューポートピクセルをギズモのハンドルと `Mesh3D` の三角形に対して調べます。GPU のピッキングパスは使いません。計算はすべて CPU 上の `ray-casting.ts` と `pick3d-probe.ts` で行います。

### パイプライン {#pipeline}

```plaintext
viewport (x, y)
  └─ buildPickSceneForViewport(camera, …)  →  Mesh3DPickScene (same matrices as rendering)
       └─ probePick3DAtViewport(…)
            ├─ 1. gizmo parts on Selected3D entities (screen-space / ray, per part)
            └─ 2. all Mesh3D on this canvas → keep closest hit (smallest t)
```

**優先順位**: すでに選択されているエンティティの **ギズモハンドルを先に** 調べます。どれも当たらないときだけ、シーンのメッシュを調べます。メッシュ同士では、レイに沿った **距離が最も小さい** ヒット（連動した透視投影では、深度が最も大きく最も手前のヒット）が選ばれます。

### 標準レイキャスト（正投影 / 自由カメラ） {#standard-raycast-orthographic-free-camera}

連動した透視投影以外のモードでは、ピッキングは一般的な 3D エディタと同じです。

1. **`screenToRay`**: ビューポートピクセル → NDC → **`inv(view × projection)`** で近平面と遠平面の点を逆投影し、ワールド空間のレイを得ます。
2. **`rayMeshIntersection`**: メッシュの頂点をエンティティのモデル行列で変換したあと、次を行います。
    - **ブロードフェーズ**: レイと変換後の **AABB**（軸平行バウンディングボックス）を比較します（スラブ法）。
    - **ナローフェーズ**: 各三角形に **Möller–Trumbore** のレイと三角形の判定を行い、最も近い `t` を残します。

```ts
// packages/ecs/src/utils/ray-casting.ts (simplified)
const invVP = computeInvViewProjection(projMatrix, viewMatrix);
const ray = screenToRay(vx, vy, width, height, invVP);
const hit = rayMeshIntersection(ray, positions, indices, modelMatrix);
// hit: { t, point, triangleIndex } | null
```

**連動した正投影**（`linked + orthographic`）は同じ経路を再利用します。`MeshPipeline3D` が 2D の `viewProjectionMatrix` をピック用シーンに渡すので、クリックは 2D の矩形および `extrude3d` と揃ったままです。

### 連動した透視投影: スクリーン空間の三角形 {#linked-perspective-screen-space-triangles}

**連動した透視投影**は、メッシュのヒットにワールドレイを使い**ません**。画面上の位置は完全な 2D VP が決め、深度は `translation.z` に対する別の透視行列から来ます。頂点シェーダーと揃えるため、**`pickMeshLinkedPerspective`** は同じユニフォームで各三角形をビューポート空間へ投影し、カーソルが **2D に投影された三角形**の中にあるかを調べて（`pointInTriangle2D`）、そのピクセルで **最も手前の深度**を選びます。このモードのギズモ部品も同じヘルパーを再利用します（ハンドルには任意の Z 方向スクリーンオフセットを付けられます）。

これにより、透視投影の立方体がある無限キャンバスをパン／ズームしても、「見えているものが、そのまま選べます」。

### ドラッグの制約 {#drag-constraints}

ギズモを押すと、初期ポーズと固定された投影を持つ `GizmoSession` が作られます。通常のカメラでは、ポインタの移動をレイとアクティブな制約平面との交差で求めます。連動カメラは、画面に表示されたハンドルの投影を逆に解き、その中には Z 方向のスクリーンオフセットも含まれます。平行移動は選択された軸または平面に従い、回転はローカルなリング軸に従います。無効なサンプルや退化したサンプルは、プレビューを変えません。

セッションは移動中にランタイムコンポーネントを更新します。離すと、宣言的なソースがドキュメントの編集を一つと、元に戻す項目を一つ発行します。Escape、ポインタのキャンセル、またはキャンバスから離れると、開始時のポーズに戻し、編集は記録しません。

アクティブなカメラ、その投影／ビュー、またはキャンバスサイズを変えると、押したままのジェスチャはキャンセルされます。ソースのポーズ、ジオメトリ、または祖先の変換を外部から編集してもキャンセルされます。ランタイムのプレビューは **現在のドキュメント** に戻るので、古いポインタ解放が API 編集や元に戻す操作を上書きすることはありません。名前や色のような無関係な編集は、通常どおり続くドラッグとマージできます。別のキャンバスでの変更は、このジェスチャを中断しません。ハンドルを再度押せば、新しいビューで開始できます。

計算されたレイアウトもジェスチャの文脈に含まれます。Yoga は、ドキュメント上の対応するフィールドを変えずに、ソースの位置やサイズを変えることがあります。祖先の変換を含むこうした変化は、プレビューをキャンセルします。キャンセルは新しいレイアウトを保ち、プレビューがまだ所有している座標だけを戻します。それ以外は変わっていないレイアウトで Escape を押すと、ドキュメントと違っていても、計算された開始位置に戻ります。セッション自身が書いたプレビューは、セッションを無効にしません。

`GizmoSourceFrame` はソースと祖先のローカルなジオメトリをスナップショットとして残し、ワールド行列の更新遅れによる誤った中断を避けます。ポインタセッションがソースのプレビューを所有している間、コンパニオン同期はそのソースを再び書きません。コンパニオンメッシュを直接操作する統合コードは、既存の逆方向同期を維持します。

変化のないフレームは、コンパニオンの変換やマテリアルを書き直しません。ポーズやマテリアルの編集は、生成済みの CPU ジオメトリを再利用します。ジオメトリの構成が変わると、そのキャッシュだけを別に無効化します。

`MeshPipeline3D` は、ポーズ／マテリアルの編集中も GPU の頂点、法線、UV、インデックス、メッシュごとのユニフォームバッファを再利用します。ジオメトリを無効化するのは `Mesh3D` への書き込みだけです。配列を直接編集するときは、先に `entity.write(Mesh3D)` でコンポーネントを取得してください。キャッシュはコンパニオン同期のあとでその書き込みを消費し、スキップされたドローをまたいで保持したあと、次のドローで置き換えを一度だけアップロードします。ジオメトリ配列が同じメッシュは、一つのキャンバス内でアップロード済みのジオメトリを共有し、各メッシュは自分のモデルユニフォームとドローバインディングを保持します。インプレースのジオメトリ編集は新しい世代をアップロードします。他のインスタンスは、更新または削除されるまで以前の GPU スナップショットを保持します。
各キャンバスが自分のキャッシュとシーンユニフォームを所有します。メッシュを削除するか別のキャンバスへ移すと、古いバッファが解放されます。キャンバスを破棄すると、デバイスより先にそのリソースが解放されます。失敗した割り当てはロールバックされ、以前の完全なキャッシュ項目を置き換えずに再試行できます。

モデル行列と法線行列は、ポーズが変わったときだけ再計算します。モデルユニフォームのアップロードも、変化のないフレームとカメラだけの変更はスキップします。マテリアルの編集と完了したテクスチャの読み込みは、それらの行列を作り直さずにユニフォームを更新します。変換／色配列のインプレース編集は、値で比較します。

シーンユニフォームはキャンバスごとにキャッシュされます。カメラと連動した 2D ビューが変わるとシーン行列を更新します。ライトが変わると、それらの行列を作り直さずにライティングデータだけを詰め直します。変化のないドローでは、シーンデータと各メッシュのドローバインディングの両方を再利用します。テクスチャの準備または置き換え、ジオメトリの再構築、GPU リソースの置き換えは、影響するバインディングを無効化します。バインディングは、参照しているバッファとテクスチャより先に解放されます。失敗したシーンのアップロードとバインディングの割り当ては、再試行できます。

3D レイヤー一覧は、アイドルフレームごとに全メッシュを走査するのではなく、ECS のジオメトリ、メタデータ、所属範囲、メンバーシップの変化に従います。選択のメンバーシップは別に追跡するので、ギズモハンドルへホバーしても一覧は再構築されません。レイヤー項目は、後の選択と、元に戻す／やり直したあとも使えるように、安定したエンティティ参照を保持します。

ハンドルの色、軸、ポインタ操作の全体は [3D 変換ギズモ](#gizmo) を参照してください。

## 3D 変換ギズモ {#gizmo}

**選択ツール**（`penbarSelected === Pen.SELECT`）で 3D メッシュをクリックすると、エンティティに **`Selected3D`** が付き、中心に **平行移動** ハンドルが描かれます。赤／緑／青の矢印と、半透明の平面ウィジェットです。ハンドルをドラッグすると **`Transform3D.translation`** に書き戻します。2D の `Selected` + `RenderTransformer` に似ていますが、別の 3D ピックと描画の経路を通ります。

### 操作の流れ {#gizmo-flow}

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

### 座標とハンドルの意味 {#gizmo-axes}

[統一された 3D 空間](#unified-space)と同じく、ギズモは Blender 式の Y-up ではなく **キャンバス座標（Y は下向き）** を使います。

| 色  | 軸  | 方向（典型的な連動キャンバスのビュー） | ドラッグで更新する値 |
| --- | --- | -------------------------------------- | -------------------- |
| 赤  | +X  | 右                                     | `translation.x`      |
| 緑  | +Y  | 下                                     | `translation.y`      |
| 青  | +Z  | **深度**（画面の奥へ `z+`）            | `translation.z`      |

-   **矢印**: 一つの軸に沿って平行移動します。
-   **平面**（`xy` / `xz` / `yz` の半透明な正方形）: 二つの成分を同時に動かします（例: `xy` は X と Y だけを変え、Z は変えません）。

-   **結合モード `transform`（既定。Spline に近い）**: 平行移動の矢印／平面と回転リングを **同時に** 表示します。どのハンドルをつかんでも、その操作が実行されます（`activePartKind`: `translate` | `rotate`）。`W` / `E` によるモード切り替えはありません。
-   **矢印 / 平面** をドラッグすると `Transform3D.translation` が更新されます。**リング** をドラッグすると `Transform3D.rotation` が更新されます（メッシュと同じローカルなオイラー角）。
-   リングはオブジェクトの現在の向きに従い、矢印はキャンバスのワールド軸のままです（X は右、Y は下、Z は深度）。
-   ピッキングはスクリーン空間で **最も近い** ヒットを使います。重なると矢印が上にあるので、平行移動が優先されます。`scale` は後のために残してあります。

### 押し出した矩形の編集 {#extrude-editing}

`extrude3d` を持つ `rect` は、宣言的なメッシュと同じギズモを使います。直列化オプションには、高さオフセットとローカルな 3D 回転が含まれるようになりました。

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

-   XY の平行移動は、親座標におけるソース矩形の `x`/`y` に書き込みます。回転、スケール、反転した親も含みます。特異な親変換は逆行列が存在しないため、プレビューを拒否します。
-   Z の平行移動は `depth` を保ったまま `extrude3d.z` を変えます。3D 回転がゼロのとき、`z` は前面の高さオフセットで、コンパニオンの中心は `z - depth / 2` にあります。
-   リングの回転は `extrude3d.rotation` に書き込みます。ソースがすでに持つワールド空間の 2D 回転に対する、ラジアン単位の XYZ オイラー角です。ソースの 2D `rotation` はそのままです。通常の回転した図形では、コンパニオンは `Rz(sourceAngle) × Rx(x) × Ry(y) × Rz(z)` で合成します。

離すと一度コミットされ、キャンセルするとプレビューが戻ります。元に戻す／やり直しとドキュメントの再読み込みは、同じポーズを復元します。押し出しを無効にするかコンパニオンを置き換えるとジェスチャが中断され、古くなったコンパニオンを作り直す代わりに現在のドキュメントを復元します。

`extrude3d: true` は引き続き深度 100 を意味し、数値は引き続き深度を指定します。オブジェクト値の既定は深度 100、高さオフセット 0、回転 `[0, 0, 0]` です。更新はオプション値全体を置き換えます。省略したフィールドは、それらの既定値に戻ります。スケールハンドルはまだありません。サイズを変えるには矩形の寸法と `depth` を使ってください。Rect の押し出しは、ローカルな角を回転とスケールに沿って送ります。角丸、反転、変換された親から来るせん断はメッシュに焼き込まれるので、底面は編集可能な 2D ソースと揃ったままです。特異な親変換では、新しいメッシュを作れません。

### 閉じた Path の押し出し {#extrude-path}

単色の塗りが一つある閉じた Path も、同じ `extrude3d` オプションを使えます。前面と背面は、穴を含む塗りの輪郭に従います。`d` または `fillRule` を編集するとメッシュが再構築されます。平行移動はそのメッシュを再利用します。変換された親から来るせん断はメッシュに焼き込まれるので、その線形変換が変わるとメッシュが再構築されます。

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

すべてのサブパスは閉じていなければなりません。開いたパス、ストロークのレイヤー、複数または単色でない塗り、非多様体の輪郭、特異な変換は、2D のまま表示されます。Path は元のドキュメントノードを保持し、ギズモ編集、元に戻す、再読み込みをサポートします。

### アイコンを 3D にする {#icon-to-3d}

<IconExtrusion />

App で Icon を選択し、**3D → アイコンを 3D に変換** を開きます。深度とマテリアルプリセット（マット、グロス、メタル）を選びます。変換は、キャップとジョインを含む SVG ストロークを閉じた輪郭へ展開します。塗られた部分と穴は、一つのグループ内の編集可能な Path になります。グループを選ぶと全部品の深度やマテリアルを変え、Path を選ぶと輪郭やベベルを編集します。元に戻すと IconFont が復元されます。変換結果は、その時点のアイコンジオメトリのスナップショットです。

`registerIconifyIconSet` でアイコンセットを登録したあと、コードからも同じ変換を使えます。

```ts
const result = iconFontToExtrudedPaths(iconNode, {
    depth: 40,
    bevelSize: 2,
    metallic: 1,
    roughness: 0.25,
});
if (result) api.updateNodes([result.group, ...result.paths]);
```

`metallic` と `roughness` は 0 から 1 の PBR パラメータです。これらのプリセットは既存のライティングパイプラインを使います。透明なガラスと屈折はまだサポートしていません。SVG フィルタ、グラデーション、未対応のペイントは、押し出しの前に輪郭を手で整える必要があることがあります。

`sideColor` は側面用の任意の CSS 色です。前面と背面はソースの塗りを保ちます。省略すると、すべての面がソースの塗り色を使います。側面色はペイントの変更なので、編集しても既存のメッシュジオメトリを再利用します。

SVG の `<path>`、`<polygon>`、`<rect>`、`<circle>`、`<ellipse>` 要素と、閉じた `<polyline>` 要素は、`svgElementsToExtrudedNodes` で塗りの押し出しソースとして読み込めます。このヘルパーは、それ以外の読み込んだ図形を 2D のままにします。無効な深度は、既定値へ黙って変えず拒否します。

```ts
import { svgElementsToExtrudedNodes } from '@infinite-canvas-tutorial/ecs';

const svg = new DOMParser().parseFromString(source, 'image/svg+xml');
const nodes = svgElementsToExtrudedNodes(
    svg.documentElement as unknown as SVGSVGElement,
    40,
);
api.updateNodes(nodes);
```

オンライン App で矩形または Path を選ぶと、上部ツールバーに **3D** コントロールが開きます。押し出しを有効にしてから、深度とベベルを編集します。プロジェクトメニューの **SVG を 3D として読み込む** は、見える図柄が SVG ビューポートの一部だけを占めていても、その図柄をキャンバス中央に置き、未対応のレイヤーは 2D のまま残します。**書き出し → GLB（3D）** で、プロジェクト内の準備できた押し出しメッシュをすべてダウンロードします。App ではベベルプロファイル（1–8 セグメント）と、任意の 16 進数の側面色も指定できます。側面色を空にすると、図形の塗りを使います。メッシュを作れない Path では、App が押し出し操作を無効にし、閉じた輪郭、塗り、ストロークの要件を表示します。

変換器は、単色の塗りが一つある閉じた輪郭を受け付けます。`<path>`、`<line>`、`<polyline>`、`<polygon>`、`<rect>`、`<circle>`、`<ellipse>` 上の単色 SVG ストロークは、閉じた編集可能な Path へ展開されます。したがって、ストロークだけの開いた線とパスも押し出せます。図形に塗りとストロークの両方があるとき、ストロークは塗られたソースの上の別 Path になります。どちらも SVG グループの変換を保ち、GLB へ書き出せます。丸いキャップと四角いキャップ、そして丸いジョイン、ベベルジョイン、マイタージョインが保持されます。SVG の `stroke="none"` プレースホルダは無視されます。変換器は `evenodd` の穴を含む `fill-rule` を保持し、SVG グループからペイントとストローク幅を継承します。ただ塗られた矩形は編集可能な Rect ノードのまま残り、角丸矩形、楕円、閉じたポリラインは編集可能な Path になります。塗り、ストローク、不透明度、塗り規則、ストロークジオメトリに対するインライン `style` 宣言は、プレゼンテーション属性より優先します。`fill="currentColor"` と `stroke="currentColor"` は、図形、グループ、`<use>` インスタンス、SVG ルートのうち最も近い `color` に対して解決されます。色がなければ既定は黒です。`style` で与えたストロークも展開できます。外部 CSS スタイルシートは解析しません。押し出しでは、角丸矩形が SVG の独立した `rx` と `ry` を楕円の角の弧として保持します。欠けた半径はもう一方を既定にし、各半径は対応する辺の半分にクランプされます。通常の 2D Rect インポータは、引き続き角の半径を一つだけ保存します。解決できる正の長さの SVG ダッシュパターンは、奇数長のパターンと `stroke-dashoffset` を含めて、編集可能な別々の実線輪郭へ展開されます。長さ 0 のダッシュに丸いキャップがあると、押し出された点になります。`non-scaling-stroke` は、SVG グループ変換と `viewBox` の拡大縮小を経ても指定された幅を保ちます。インポータは中心線を先に投影してから、編集可能な 3D 輪郭へ展開します。この幅は読み込み時に焼き込まれるので、その後のエディタのズームは 3D メッシュを通常の空間オブジェクトとして拡大縮小します。クリップパスやスライスされたビューポートの下にある非スケーリングストローク、長さ 0 の間隔、ほかのキャップが付いた長さ 0 のダッシュ、グラデーション、ペイントサーバー、未対応の SVG 図形は 2D のままです。`patternUnits="userSpaceOnUse"` で、整数ピクセルのタイルと基本的な SVG 図形を含む自己完結の `<pattern>` 塗りは、繰り返す 2D 塗りとして読み込みます。リンクされたリソース、パターン変換、ゼロでないパターン原点はまだ対応していません。矩形上の円形 `<radialGradient>` 塗りは、`userSpaceOnUse`、明示的な数値の中心と半径、中心と一致する焦点を使うとき、2D のまま残します。楕円グラデーション、ずらした焦点、グラデーション変換を含む、その他の自己完結な放射グラデーションは、矩形、円、楕円、パス、ポリゴンに適用でき、ラスタライズした SVG 画像塗りを使います。図形は編集可能なままで、グラデーションの色停止は個別に編集できるペイントではなく、その画像へ焼き込まれます。SVG 画像塗りは、ズームインするときにテクスチャサイズの上限までベクターソースから描き直されるので、倍率を上げても縁がより鮮明なままです。ストロークが有効な閉じたメッシュを生成できない場合は、元の 2D ノードを保ちます。展開されたストローク輪郭は、座標を正規化する間、小数第 6 位まで残すので、非常に細いディテールが最終的なメッシュ検査の前につぶれません。対応する図形またはグループを指すローカルな `<use href="#id">` とレガシーの `xlink:href` は、前方参照と繰り返し参照を含めて独立したインスタンスを作ります。インスタンスのピクセルオフセット、変換、継承された塗りは押し出しの前に適用され、各インスタンスは自分の編集可能な ID を受け取ります。循環参照と解決できない参照はスキップされます。`<use>` は `viewBox` を持つ `<symbol>` も参照できます。インスタンスまたはシンボルが正のピクセル `width` と `height` を提供する必要があります。インスタンスの寸法がシンボルの寸法より優先します。シンボルの `preserveAspectRatio` は、`meet` の配置、`none`、押し出し輪郭の `slice` クリップをサポートします。有効な寸法がないか不正な場合、そのシンボルインスタンスはスキップされます。外部参照はまだ読み込みません。明示的な正のピクセル寸法と `viewBox` を持つ入れ子の `<svg>` 要素も、編集可能なビューポートグループを作ります。その `x`/`y`、変換、`preserveAspectRatio` は押し出された子に影響します。ローカルな `<use>` は、こうした SVG 要素の一つを参照し、ビューポート寸法を別に上書きできます。入れ子の SVG ビューポートは、生成された押し出し輪郭を既定でクリップします。`slice` も含みます。はみ出したジオメトリを残すには `overflow="visible"` を設定してください。完全に内側にある図形はグループ関係を保つので、ビューポートグループを動かすとその 3D メッシュも一緒に動きます。端を横切る図形は、クリップされた Path になります。ローカルな `clip-path="url(#id)"` とインライン CSS の `clip-path` も、対象となる 3D 輪郭をクリップするようになりました。`<clipPath>` には Path、ポリゴン、ポリライン、矩形、円、楕円、入れ子のグループ、およびそれらの図形を指すローカルな `<use>` 参照を含められます。それらの図形は和集合を作り、`clip-rule="evenodd"` は穴を開けられます。グループと繰り返される `<use>` インスタンス上のクリップはそれぞれの変換に従い、複数の祖先クリップは互いに、そして SVG ビューポートと交差します。`clipPathUnits="objectBoundingBox"` は、単一図形のバウンド、またはグループ内の対応する子図形のバウンドを、その変換も含めて使います。クリップされた輪郭は編集可能な Path になります。クリップの内側に完全に入る輪郭は、元のノードとグループ関係を保ちます。解決できない、または未対応のクリップ定義は 2D のままです。マスク、フィルタ、クリップパス内のテキスト、外部クリップ参照は 3D へ変換しません。`display="none"`、または継承された `visibility="hidden"` の要素は 3D メッシュを作りません。子孫は `visibility="visible"` を明示的に設定できます。ルートの `<svg>` を渡すと、明示的なピクセル `width`/`height` と `viewBox` が適用されます。`preserveAspectRatio` も含みます。塗りの押し出しは、入れ子グループの SVG `skewX`、`skewY`、せん断を含む `matrix(...)` 変換も保持します。合成変換にせん断が含まれると、これらの輪郭はサンプリングされた線分からなる編集可能な Path になります。通常の viewBox スケールは、矩形と曲線 Path を元の形のまま編集できるように保ちます。明示的なピクセルのビューポート寸法がない SVG は、viewBox 座標を保ちます。未対応の 2D 図形は引き続き通常の SVG インポータを使い、そのインポータはソースのせん断を保持しません。

`preserveAspectRatio="slice"` のとき、塗りの押し出し輪郭はビューポートに合わせてクリップされます。穴と、複数の島に分かれた図形も含みます。ビューポート内に完全に入る図形は、Rect または曲線 Path の形を保ちます。未対応の 2D 図形は引き続き通常のインポータに従い、このヘルパーはそれらをクリップしません。

下の **Repeated use sample** を選ぶと、同じ定義を異なる塗りで作った二つのインスタンスと、そのそばの通常の矩形を調べられます。**Symbol viewport sample** を選ぶと、穴のあるシンボル一つのビューポートインスタンスを二つ比較します。一つ目はシンボルの寸法を使い、二つ目は自分の寸法を指定します。**Nested SVG viewport sample** を選ぶと、インラインの SVG ビューポートと、`<use>` で参照した二つ目のインスタンスを比較します。両者の押し出し輪郭は、それぞれのビューポートに合わせてクリップされます。**Paint style + currentColor sample** を選ぶと、継承された色とインスタンス固有の色、インラインの塗り上書き、スタイル指定されたストロークを比較します。**Stroke caps + joins sample** を選ぶと、丸いキャップと四角いキャップ、別の 3D 輪郭を持つ塗られた図形、グループ変換の下の非スケーリングストローク、押し出された破線ストロークと丸い点を比較します。**Clip paths + repeated use sample** を選ぶと、穴があり互いに独立してクリップされた二つのインスタンスと、オブジェクトバウンドの和集合でクリップされた図形を調べます。**Group bounds + clip use sample** を選ぶと、変換されたグループ上のオブジェクトバウンドクリップを調べます。二つの窓は、一つのローカル定義を再利用します。

SVG の事前検査は、各輪郭がメッシュになれるかを確認します。その CPU ジオメトリは、メッシュ最大 256 個、ジオメトリ配列の合計 8 MiB までの最近キャッシュに残るので、非同期のキャンバス更新が 3D コンパニオンを作るときに再利用できます。より古い項目は追い出されます。GPU ジオメトリはキャンバスごとに別のキャッシュを持ちます。`pnpm bench:svg-import:browser` を実行すると、リポジトリの [Ghostscript Tiger SVG](/Ghostscript_Tiger.svg) と他の代表的な作品について、読み込みと編集の時間を調べられます。その SVG をダウンロードし、上の **Upload SVG** で編集可能なレイヤーを見て、ズーム段階を比較することもできます。読み込んだ SVG レイヤーが重なるとき、押し出された前面は入れ子グループ内のレイヤーを含めて SVG のペイント順を保ちます。連動した 3D ビューでは、後から描かれたレイヤーが先に描かれたレイヤーの上に見えます。GLB 書き出しは押し出しノードを同じ手前から奥への走査順で並べ、私たちの glTF インポータがその順序を保持します。同一平面上の不透明で平らな押し出しについて、書き出しは重なるレイヤーを深度方向に、最も薄い押し出しの厚さの最大 5% だけ離すこともあります。これにより、キャンバス上の編集可能な図形は動かさずに、glTF ビューアが異なる深度バッファ値を得ます。互いに交差しないスタックは別々に処理されるので、遠くの 3D メッシュがこの間隔を無効にしません。投影バウンドが、傾いたまたは透明な押し出し、別の高さ、あるいは独立した 3D メッシュと重なるスタックは、オーサリングされた変換を保ちます。極端に大きい、または遠いモデルは、ビューアの深度バッファ精度によって小さな深度差を失うことがあります。

Path と Rect の押し出しの両端にベベルを付けるには、`extrude3d.bevelSize`（キャンバス単位）を設定します。デモではこれを **Bevel** として出しています。内側オフセットが塗りのトポロジを保つとき、穴、複数の島、凹んだ角をサポートします。輪郭が衝突するか狭い領域がつぶれると、図形は鋭いエッジを保ちます。深度やサイズを変えると、ソースは編集可能なままコンパニオンメッシュが再構築されます。解決された塗り境界の頂点が 4096 を超える図形も、メッシュ作業量を抑えるために鋭いままです。

`extrude3d.bevelSegments` を `1` にすると直線ベベルです（既定）。`2`–`8` は丸い四分円プロファイルです。セグメントが多いほどシルエットは滑らかになり、メッシュの三角形は増えます。デモの **Bevel profile** コントロールで、読み込んだ SVG 図形の直線プロファイルと丸いプロファイルを比較できます。

例の **Download GLB** ボタンは、生成された 3D メッシュを自己完結の glTF バイナリファイルとして書き出します。`api.exportGlb` で準備できた押し出し図形をすべてダウンロードするか、ノードを渡して選択だけを書き出します（選択されたグループの子を含む）:

```ts
await api.exportGlb();
const glb = await api.exportGlb({
    nodes: [api.getNodeById('extruded-vector')!],
    download: false,
}); // Uint8Array
```

書き出しは、キャンバスの Y が下向きの座標を glTF の Y が上向きの座標へ変換し、現在の 3D ポーズ、単色の塗り、任意の側面色を保ちます。準備できたメッシュのコンパニオンだけを書き出し、未対応の 2D SVG 図形は含めません。ベースカラーテクスチャは PNG または JPEG として埋め込まれます（それ以外のデコード可能な形式は PNG へ変換されます）。テクスチャ URL は CORS の fetch を許可していなければなりません。同期の `api.export({ format:
ExportFormat.GLB })` は、テクスチャのない書き出しに引き続き使えます。
より低レベルのメッシュ書き出しでは、`exportMeshesToGlb(sources, await loadGlbImages(sources))` を呼び出します。

**ViewBox + shear sample** で、変換された輪郭とその evenodd の穴を調べ、押し出しをオフにして 2D の底面と比較してください。**Slice clipping sample** で、穴、分かれた二つの断片、SVG ビューポートで切られた曲線の端を見てください。

<SvgExtrusion />

## ライティング {#lighting}

静止した立方体、球、円柱で、アンビエント、ディレクショナル、ポイント、スポットのライトを比較します。ライトを切り替え、強度／範囲と球のメタリック／ラフネスを調整し、スタジオ環境ライティングと影の投影を有効にするか、スポットライトの周回を再生します。ポイントライトとスポットライトは、元の滑らかな範囲減衰を使うか、設定可能な基準距離とともに逆二乗減衰を選べます。レンダラーは、sRGB からリニアへ変換した入力とフィルム調トーンマッピングで、GGX の直接照明を使います。LDR パノラマまたは Radiance HDR 画像が、球面調和の拡散照明と、split-sum BRDF ルックアップを伴うプリフィルタされた反射を提供します。

`castShadow: true` のディレクショナル、ポイント、スポットライトは、同時に最大二つまで影を落とし、3 × 3 PCF でフィルタされます。各ライトは `shadowStrength`（0–1）、`shadowSoftness`（0–4 テクセル）、`shadowBiasScale`（0–4）、`shadowNormalBias`（0–10 キャンバス単位）を設定できます。既定値は元の見え方を保ちます。各メッシュは `material3d.castShadow` と `material3d.receiveShadow` で、影を落とすことと受けることを別々に無効にできます（どちらも既定は `true`）。ディレクショナルマップは現在のメッシュに合わせます。半角 85° 未満のスポット円錐は透視マップを一つ使い、より広い円錐とポイントライトはアトラス面を六つ使います。アトラス面の継ぎ目での PCF サンプルは、端のテクセルを繰り返さず、隣の面をサンプルします。コントロール、マップサイズ、API の詳細は [ライティングの例](/example/lighting) を参照してください。

自己発光する面は、`material3d.emissiveFactor` と `emissiveStrength` で、シーンライトを追加せずに発光を制御します。glTF の `KHR_materials_emissive_strength` はマテリアルとともに読み込みと書き出しを行います。[ライティングの例](/example/lighting) の立方体の発光スライダーを試してください。

照明に依存しない単色には `material3d.unlit` があり、シーンライトとトーンマッピングを迂回しつつ、ベースカラーテクスチャとアルファは残します。glTF の `KHR_materials_unlit` は読み込みと GLB 書き出しで保持されます。[ライティングの例](/example/lighting) の立方体トグルで、発光と比較してください。

テクスチャの切り抜きと半透明な面には、`material3d.alphaMode` の `mask` と `blend` があります。影の挙動と順序の制限は [3D メッシュの透明度の例](/example/mesh3d-alpha) を参照してください。

WebGL1 のフラグメントシェーダーは、ユニフォーム配列を読むときに定数インデックスを必要とします。レンダラーは WebGL1 で、ライトデータとシャドウ行列に対して範囲を限定した参照を生成します。WebGL2 と WebGPU はネイティブなインデックスを保ちます。マテリアルのシェーディングは色を `main()` へ返すので、unlit マテリアルでも WebGL1 の出力変換が実行されます。ブラウザの回帰テストは WebGL1 を強制し、頂点色、接線空間の法線マップ、複数ライト、ディレクショナル／ポイントの影を検査します。

<Lighting />

## glTF モデル {#gltf}

宣言的な `mesh3d` ジオメトリで外部の glTF/GLB を読み込みます（`geometry: { type: 'gltf', url: '…' }`）。Khronos の **Duck** サンプルは、`/data/` 以下の `.gltf` + `.bin` の組を使います。メッシュは中心に揃え、単位バウンドへ正規化したあと、`scale3d` でスケールします。

glTF のベースカラー係数はリニア RGB を使い、ECS はマテリアルのベースカラーを sRGB で保存します。読み込みは両者の間を変換し、GLB 書き出しは再びリニア RGB へ戻すので、マテリアルの色は往復しても安定して残ります。

インポータは glTF の `doubleSided`、`normalTexture`、`occlusionTexture`、オーサリングされた `TANGENT` 属性も保持します。法線マップはライティングの法線を変え、オクルージョンは間接光だけに影響します。[インタラクティブな PBR モデル](/example/gltf-duck#pbr-material)は、法線マッピングがオーサリングされた接線をいつ使い、UV からいつ導くかを説明します。

glTF の `COLOR_0` 頂点色（float、または正規化された符号なし byte/short、RGB または RGBA）は、リニア空間でマテリアルのベースカラーに乗算されます。[インタラクティブな頂点色モデル](/example/gltf-duck#vertex-colors)は、シーンライトがあるときとないときの結果を示します。書き出しは色を float RGBA として保持します。

インポータは、三角形リスト、トライアングルストリップ（`mode: 5`）、トライアングルファン（`mode: 6`）を、インデックスの有無にかかわらず受け付けます。レンダリングと GLB 書き出しのために三角形リストへ変換します。ミラーされたノード変換は三角形のワインディングも直し、片面のサーフェスが見えたままになるようにします。

スパースな glTF accessor は、位置、法線、UV、色、接線、三角形インデックスをサポートします。ベースデータがなければ 0 から始まり、スパース値は列挙された要素だけを置き換えます。読み込んだメッシュは、通常の密な GLB バッファとして書き出されます。

<GltfDuck />

## さらに読む {#extended-reading}

-   [Working with 2D and 3D objects]
-   [Bevy Core3dPlugin](https://docs.rs/bevy/latest/bevy/core_pipeline/core_3d/struct.Core3dPlugin.html)（プラグインの階層化の参考）

[Lesson 30 - Post-processing and render graph]: /ja/guide/lesson-030
[How to Turn 2D Elements into Interactive 3D Objects in Framer]: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer
[UI Scenes]: https://docs.spline.design/designing-in-3-d/ui-scenes
[Working with 2D and 3D objects]: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects
[2D Rendering in Bevy]: https://bevy.org/examples/2d-rendering/2d-shapes/
