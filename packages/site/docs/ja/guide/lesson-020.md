---
outline: deep
description: 'CRDT（Conflict-free Replicated Data Type、コンフリクトフリー複製データ型）で複数ユーザーの共同編集を実装します。Loro、フラクショナルインデックス、リアルタイム同期を使い、ローカルファーストの原則を適用します。'
head:
    - ['meta', { property: 'og:title', content: '第20課 - 共同編集' }]
---

<script setup>
import LoroCRDT from '../../components/LoroCRDT.vue';
import YjsCRDT from '../../components/YjsCRDT.vue';
import PerfectCursors from '../../components/PerfectCursors.vue';
</script>

# 第 20 課 - 共同編集 {#lesson-20-collaboration}

この課では、複数ユーザーによる共同編集機能の実装を見ていきます。

-   CRDT の分類と実装
-   Loro / Yjs と [BroadcastChannel] を使い、localhost 上で共同編集をシミュレートする
-   [liveblocks] で、サーバーと複数クライアントの間の共同編集を実装する
-   エンドツーエンド暗号化された CRDT
-   Awareness と Presence。マルチプレイヤーカーソルとコメントを含みます

## CRDT {#crdt}

CRDT とは何でしょうか。次の説明は [What are CRDTs] からのものです。Google Docs / Figma / Tiptap の共同編集機能は、いずれもこれに基づいて実装されています。この記事は CRDT と操作変換（OT）の特徴も詳しく比較しています。

> CRDT（conflict-free replicated data type、コンフリクトフリー複製データ型）は、ネットワーク上の複数のコンピュータへ複製できるデータ構造です。各レプリカはレプリカ間で調整しなくても、独立かつ並列に更新でき、衝突が起きないことが保証されます。

[What are CRDTs] の次の図は、CAP 定理のもとで CRDT が「完全な一貫性」ではなく結果整合性を提供することを示しています。リアルタイムの一貫性は保証できませんが、二つのノードがメッセージを同期すると、再び一致した状態に戻ります。

![CRDT は A + P + 結果整合性を満たします。CAP のもとでのトレードオフ](https://loro.dev/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fa4858e2a50bc1a2d79722060156e89b0cac5815cf25e8c67e409aa0926280cef.6a607785.png&w=3840&q=75)

[How Figma's multiplayer technology works] は、Figma が Google Docs のように OT を選ばなかった理由を説明しています。

> Figma のデータ構造は単一の CRDT ではない点も注目に値します。複数の別々の CRDT から着想を得て組み合わせ、Figma ドキュメントを表す最終的なデータ構造を作ります（以下で説明します）。

### CRDT の二種類 {#two-types-of-crdts}

CRDT には、操作ベース（Op-based）と状態ベース（State-based）の二種類があります。前者の原理は、二人のユーザーが同じ順序の操作を実行すれば、ドキュメントの最終状態も同じになるというものです。そのために各ユーザーはデータに対して実行した操作をすべて保持し、その操作を他のユーザーと同期して最終状態を揃えます。後者はノード間で状態全体を転送する必要があります。前者は操作の説明だけを送るので帯域が少なく済むように見えますが、操作の冪等性を保証し、操作順の問題を扱うには実装が複雑になります。比べると、後者の実装は単純です。

次のチュートリアルシリーズで、State-based CRDT を理解していきます。

-   [An Interactive Intro to CRDTs]
-   [Building a Collaborative Pixel Art Editor with CRDTs]
-   [Making CRDTs 98% More Efficient]

このチュートリアルは、結合法則、交換法則、冪等性を満たす必要があるマージ関数を含む、CRDT の汎用データ構造を示します。このマージ関数は Last-Writer Wins(LWW) Register にできます。自分のタイムスタンプと入力データのタイムスタンプを毎回比較し、入力データのタイムスタンプの方が大きければ自分のデータを更新します。

```ts
interface CRDT<T, S> {
    value: T;
    state: S;
    merge(state: S): void;
}
```

キーと値のスタイルシートは LWW Register に向いています。[Designing Data Structures for Collaborative Apps] は、Quill エディタが使う `{bold: true}` スタイルを紹介しています。

私たちの場面でより役立つのは [How Figma's multiplayer technology works] です。Figma の CTO が、内部で使う DOM に似た木構造（シーングラフ）を紹介しています。各オブジェクトには ID とプロパティ値の組があり、二段の写像 `Map<ObjectID, Map<Property, Value>>` と見なせます。オブジェクトのプロパティ、オブジェクトの追加と削除、順序などを扱うとき、異なるマージ戦略を採ります。

-   オブジェクトの同じプロパティを変更する場合。たとえば二人のユーザーが同じテキストオブジェクトのプロパティ値をそれぞれ AB と BC に変更しても、Figma はマージアルゴリズムで ABC を結果にしません。サーバーがメッセージを受け取った時点に依存します。
-   オブジェクトの追加と削除。オブジェクトの作成には LWW Register をそのまま使います。CRDT モデルとの違いは削除時の挙動です。Figma のサーバーは削除されたオブジェクトのプロパティを保存せず、あとで元に戻す操作に備えた保存はクライアントに任せます。
-   シーングラフ構造の変化。子ノードはプロパティで親ノードの ID を参照し、ノードリスト内の位置は Fractional indexing で実装します。利点は、位置を変えるときに値を一つ更新すればよいことです。詳しくは [Realtime editing of ordered sequences] を参照してください。この方式の欠陥の一つであるインターリーブ（interleaving）も考慮しません。

### ローカルファーストのソフトウェア {#local-first-software}

[Local-first software - You own your data, in spite of the cloud]

> この記事では「ローカルファーストのソフトウェア」を提案します。ユーザーに共同編集と所有の両方を可能にする、ソフトウェアの原則の集まりです。ローカルファーストが目指すものには、オフラインで作業し、複数のデバイスをまたいで共同編集する能力が含まれ、同時にデータのセキュリティ、プライバシー、長期保存、ユーザーによる管理を高めます。

[The past, present, and future of local-first] の次の図は、ローカルファーストというソフトウェア開発とデータ管理の考え方も、CRDT に基づいて実装できることを示しています。

![ローカルファーストの歴史](/local-first-history.png)

[How Figma's multiplayer technology works]

> Figma では、任意の時間オフラインになっても編集を続けられます。オンラインに戻ると、クライアントはドキュメントの新しいコピーをダウンロードし、その最新状態の上にオフラインの編集を再適用してから、新しい WebSocket 接続で更新の同期を続けます。

リッチテキストエディタとコードエディタもこれに対応しています。[TipTap offline support] と [The Full Spectrum of Collaboration] を参照してください。

### CRDT の実装 {#implementation-of-crdts}

Y.js と、他の言語への移植は、疑いなく最も有名な CRDT 実装です。次の文は <https://tiptap.dev/docs/collaboration/getting-started/overview#about-yjs> からのものです。

> CRDT である Y.js は、変更の順序がドキュメントの最終状態に影響しないようにします。Git がコミットを扱う方法に似ています。これにより、異なる環境にあるデータのコピーがすべて一致したままになります。

共同編集の状態でテキストやリッチテキストをマージする必要がないので、キャンバスの状態を保存する単純なデータ構造があれば足ります。たとえば [Y.Map] です。他の CRDT 実装も似た API を提供します。

-   Liveblocks は `LiveObject/List/Map` を提供します。詳しくは [Data Structures in Liveblocks] を参照してください。
-   Automerge は [Simple Values] を提供し、JSON の正当な型をすべてサポートし、`Date` も含みます。
-   Loro も [Map] を提供します。

## BroadcastChannel でシミュレートする {#simulate-with-broadcast-channel}

ここでは [Loro Excalidraw Example] と [dgmjs-plugin-yjs] を参考に、同一オリジンの複数タブ間で通信できる [BroadcastChannel] の特性を使い、複数ユーザーが共同編集する効果をシミュレートします。

### Loro の例 {#example-with-loro}

Excalidraw では、`onChange` フックでシーン内のすべての図形の変化を監視できます。

```tsx
<Excalidraw
    onChange={(elements) => {
        const v = getVersion(elements);
    }}
/>
```

履歴の記録が変化したとき、このフックを呼び出します。

```ts
export class API {
    onchange: (snapshot: {
        appState: AppState;
        nodes: SerializedNode[];
    }) => void;
}

api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
};
```

[Excalidraw updateScene] を参考にすれば、シーングラフを更新する `updateNodes` メソッドも提供できます。

```ts
api.updateNodes(nodes);
```

以下では Loro を例に、複数ユーザーが共同で編集する効果をシミュレートします。[BroadcastChannel] を使い、同一オリジン内の複数タブが通信できるようにします。キャンバスの内容が変わるたびに、他のページへメッセージを送ります。他のページからメッセージを受け取ると、同期が完了します。したがって各ページは、メッセージの送信側と受信側を同時に担う必要があります。

まずメッセージ受信側の実装を見ます。まず [LoroDoc] のインスタンスを作ります。[List] 構造で図形リストを保存します。メッセージを受け取ったら、そのデータを LoroDoc にインポートします。参考は [Exporting and Importing] です。

```ts
import { LoroDoc } from 'loro-crdt';

const channel = new BroadcastChannel('loro-crdt');
const doc = new LoroDoc();
const docNodes = doc.getList('nodes');

channel.onmessage = (e) => {
    const bytes = new Uint8Array(e.data);
    doc.import(bytes);
};
```

さらに、`docNodes` を JavaScript オブジェクトへ変換したあと、キャンバス API の `updateNodes` を呼び出してシーンの更新を完了します。

```ts
doc.subscribe((e) => {
    if (e.by !== 'local') {
        api.updateNodes(docNodes.toJSON());
    }
});
```

次にメッセージ送信側の実装を見ます。`onchange` フックでキャンバスのシーングラフの変化を購読し、変化をドキュメントに記録してから送信します。すると他のウィンドウで、先ほどのシーン更新が起きます。

```ts
api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
    if (recordLocalOps(docElements, nodes)) {
        doc.commit();
    }
};
```

ローカルの変更を送信する間：

```ts
function recordLocalOps(
    loroList: LoroList,
    nodes: readonly { version?: number; isDeleted?: boolean }[],
): boolean {
    nodes = nodes.filter((e) => !e.isDeleted); // 首先排除掉被删除的图形
}
```

下の例では、左右どちらのウィンドウでも矩形を自由にドラッグしたり、サイズを変えたり、色を変えたりでき、もう一方のウィンドウがそれらの変更を同期します。[Example with Loro]

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<LoroCRDT />
</div>
<div style="flex: 1;">
<LoroCRDT />
</div>
</div>

### Yjs の例 {#example-with-yjs}

まずローカルキャンバスの変化を監視し、図形リストとそのプロパティオブジェクトをローカルの `Y.Doc` に同期します。

```ts
api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
    doc.transact(() => {
        // 写入 Y.Doc
    }, local);
};
```

次に `Y.Doc` の変化を待ち受け、`origin` でローカルの変化とリモートの変化を区別します。変化がローカル由来なら同期メッセージを送り、リモート由来ならキャンバスの内容を更新します。

```ts
doc.on('update', (update, origin) => {
    if (origin === local) {
        channel.postMessage(update);
    }

    if (origin !== local) {
        const nodes = yArray.toArray().map((node) => node.toJSON());
        api.updateNodes(nodes);
    }
});
```

[Example with Yjs]

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<YjsCRDT />
</div>
<div style="flex: 1;">
<YjsCRDT />
</div>
</div>

## Liveblocks をバックエンドとして使う {#use-liveblocks-as-backend}

上の BroadcastChannel に基づく実装は、あくまで単純な例です。次は [liveblocks] と Yjs で、より実用的な例を実装します。

```ts
import { createClient } from '@liveblocks/client';
import { getYjsProviderForRoom } from '@liveblocks/yjs';

const client = createClient({});
const { room, leave } = client.enterRoom('my-room-id', {});

const yProvider = getYjsProviderForRoom(room, {
    // Enable V2 encoding for better performance with LiveMaps
    // https://liveblocks.io/docs/guides/yjs-best-practices-and-tips#Enable-experimental-V2-encoding-for-Y.Maps
    useV2Encoding_experimental: true,
});
const yDoc = yProvider.getYDoc();
```

この例は複数のブラウザウィンドウで開けます。[Example with Liveblocks]

![複数ウィンドウ間の共同編集](/liveblocks.gif)

## IndexedDB によるオフライン対応 {#offline-support-with-indexeddb}

ルームを作るとき、[liveblocks] はオフライン機能を手軽に有効にする `offlineSupport_experimental` という設定も提供します。

> IndexedDB を使ってオフライン対応を有効にします。最初の読み込みのあと、ドキュメントはローカルに保存され、すぐに読み込まれます。

```ts
import { getYjsProviderForRoom } from '@liveblocks/yjs';

const yProvider = getYjsProviderForRoom(room, {
    offlineSupport_experimental: true,
});
```

## エンドツーエンド暗号化 {#end-to-end-encryption}

これでドキュメントを CRDT として保存し、何らかの同期サーバーで更新をマージして転送しながら、このファイルを非公開のままにできます。

記事 [End-to-End Encryption in the Browser] で、Excalidraw は単純なエンドツーエンド暗号化の方法を紹介しています。各クライアントは通信できますが、サーバーは内容を読めません。暗号化したデータはサーバーが読めないリンクのハッシュ部分に置き、クライアント側だけでデコードします。<https://excalidraw.com/#json=5645858175451136,8w-G0ZXiOfRYAn7VWpANxw>

次に、Excalidraw が Web Crypto API でこの機能を実装する方法を分析します。

### 鍵の生成 {#generate-key}

[generateKey] API で [AES-GCM] アルゴリズムを選び、ランダムな鍵を生成します。`extractable` パラメータは、あとから [exportKey] API で鍵を外部へ持ち出せる形式でエクスポートできることを示します。たとえばここでは [JSON Web Key] の `‘jwk’` 形式を選びます。

```ts
// @see https://github.com/excalidraw/excalidraw/blob/7f66e1fe897873713ba04410534be2d97b9139af/packages/excalidraw/data/encryption.ts#L17
export const generateEncryptionKey = async <
    T extends 'string' | 'cryptoKey' = 'string',
>(
    returnAs?: T,
): Promise<T extends 'cryptoKey' ? CryptoKey : string> => {
    const key = await window.crypto.subtle.generateKey(
        {
            name: 'AES-GCM',
            length: ENCRYPTION_KEY_BITS,
        },
        true, // extractable
        ['encrypt', 'decrypt'],
    );
    return (
        returnAs === 'cryptoKey'
            ? key
            : (await window.crypto.subtle.exportKey('jwk', key)).k
    ) as T extends 'cryptoKey' ? CryptoKey : string;
};
```

### データの暗号化と復号 {#encrypt-decrypt-data}

まず、暗号論的に安全な乱数を生成します。

```ts
export const createIV = () => {
    const arr = new Uint8Array(IV_LENGTH_BYTES);
    return window.crypto.getRandomValues(arr);
};
```

次にこの秘密鍵でシリアライズしたシーンデータを暗号化し、クライアントから [firestore] や AWS S3 のようなクラウドストレージへアップロードします。

```ts
// @see https://github.com/excalidraw/excalidraw/blob/7f66e1fe897873713ba04410534be2d97b9139af/excalidraw-app/components/ExportToExcalidrawPlus.tsx#L42
const encryptionKey = (await generateEncryptionKey())!;
const encryptedData = await encryptData(
    // 使用 iv 加密
    encryptionKey,
    serializeAsJSON(elements, appState, files, 'database'), // 序列化数据
);
const blob = new Blob(
    [encryptedData.iv, new Uint8Array(encryptedData.encryptedBuffer)],
    {
        type: MIME_TYPES.binary,
    },
);

// Upload blob to Firebase / AWS S3
```

### CRDT の準同型暗号化 {#homomorphically-encrypting-crdt}

[Homomorphically Encrypting CRDTs]

## Awareness と Presence {#awareness-presence}

Yjs は、カーソル位置と状態情報を共有する [Awareness & Presence] 機能を提供します。ユーザーは、他の共同編集参加者がいることを知覚できます。この情報はセッションをまたいで永続化する必要がないので、Yjs ドキュメントの中には保存しません。ただし JSON オブジェクトとしてすべてのユーザーへ伝播でき、ユーザーがオフラインになると自分の状態を削除します。

![出典: https://liveblocks.io/docs/ready-made-features/presence#Examples-using-Presence](https://liveblocks.io/_next/image?url=%2Fimages%2Fexamples%2Fthumbnails%2Flive-cursors-chat.jpg&w=828&q=90)

### Liveblocks をバックエンドとして使う {#backend}

Yjs の Provider 実装である [liveblocks] も、Room API で Presence 機能を提供します。キャンバスの `pointermove` イベントを待ち受け、[updatePresence] でブロードキャストできます。保存する前にワールド座標系へ変換する必要があります。詳しくは [Lesson 6 - Coordinates] を参照してください。

```ts
function onPointerMove(event) {
    const { x, y } = api.viewport2Canvas({
        x: event.offsetX,
        y: event.offsetY,
    });
    room.updatePresence({
        cursor: {
            x
            y,
        },
    });
}
```

これにより、クライアントは他のユーザーの状態変化を購読し、その情報でマウス位置を描画できます。ここでは、マウス位置をワールド座標系からビューポート座標系へ変換する必要があります。

```ts
room.subscribe('others', (others) => {
    others.forEach((other) => {
        // [{ cursor: {} }, { cursor: {} }, ...]
        const { x, y } = api.canvas2Viewport({
            x: other.presence.cursor.x,
            y: other.presence.cursor.y,
        });
        // Render cursor with [x, y]
    });
});
```

もちろん、スロットリングで更新頻度を下げられます。他の人のマウス位置を「リアルタイム」で表示する必要は、そもそもないからです。ただし、ここで次の問題が出てきます。

```ts
const client = createClient({
    throttle: 16, // [!code ++]
    publicApiKey:
        'pk_dev_MYcFNShiwPwRDvuvhklopMg6SAkdASzz6QrOMQIlu86NkcuXVNxP06aXrxi9qo7M',
});
```

### カーソルを滑らかに描画する {#smoothly-rendering-cursors}

[How to animate multiplayer cursors] は、スロットリングで更新頻度を下げたあと、他のユーザーから見てマウスカーソルがカクつく様子を示しています。リフレッシュレートが 60FPS から 20FPS に落ちたのに似ています。

![カクつくカーソル](/jank-cursor.gif)

解決策は、マウスが隣り合う位置の間を段階的に跳ぶのではなく、滑らかに動くようにすることです。幸い tldraw は、この処理をすべて引き受けてくれる [perfect-cursors] 機能を提供しています。

[Example with perfect-cursors]

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<PerfectCursors />
</div>
<div style="flex: 1;">
<PerfectCursors />
</div>
</div>

さらに [framer-motion] も使えます。宣言的な構文をサポートし（React/Vue と互換）、組み込みの Spring イージング関数で似た効果を出します。詳しくは [Example with framer-motion] を参照してください。

```vue
// Cursor.vue
<script lang="ts" setup>
import { motion } from 'motion-v';
</script>
<template>
    <motion.div
        class="Cursor"
        aria-hidden="true"
        :initial="{ x, y }"
        :animate="{ x, y }"
        :transition="{
            type: 'spring',
            damping: 20,
            mass: 0.4,
            stiffness: 400,
        }"
    >
        <svg path="..."></svg>
    </motion.div>
</template>
```

## コメントオーバーレイ {#comments-overlay}

共同編集では、リアルタイムのチャットとコメントが重要です。Figma の中では、キャンバスの任意の位置にコメントバブルを置けます。また、ズームレベルが低いときはコメントを集約し、コメントクラスタの概要を示します。ズームレベルが上がると、より細かいクラスタが現れ、最終的には個々のコメントバブルの分布が見えます。詳しくは [Guide to comments in Figma] を参照してください。

![Figma のコメント](https://help.figma.com/hc/article_attachments/31566555250071)

### データ構造 {#data-structure}

次に [Liveblocks Comments] に基づいて似た機能を実装します。まずデータ構造を見ます。Thread と Comment は一対多の関係です。

![出典: https://liveblocks.io/docs/ready-made-features/comments/concepts#Threads](https://liveblocks.io/_next/image?url=%2Fassets%2Fcomments%2Fcomment-thread-room-relation-dark.jpg&w=1920&q=100)

```ts
interface Thread {
    id: string;
    roomId: string; // liveblocks room
    createdAt: Date;
    comments: Comment[];
    metadata: {
        x: number; // x position in canvas coordinates
        y: number;
    };
}
```

### クラスタ {#cluster}

上の点の集約では、二つの課題を解決する必要があります。

1. どのように集約するのか。ある点が与えられたとき、その点を中心とする指定半径の中にある点をすべて見つけるにはどうするか。
2. 集約したあと、バウンディングボックス（たとえば現在のビューポート）が与えられたとき、その中に含まれる集約済みフィーチャをすべて見つけるにはどうするか。

この二つの問題（半径クエリと範囲クエリ）では、点が膨大なとき、すべての点を総当たりで走査する方法は本質的に非効率です。効率よく検索するには、[kdbush] のような空間インデックスを使う必要があります。GIS の文脈ではありませんが、[supercluster] の実装から着想を得られます。

点の集約では、k-d ツリーのノードには元の Point フィーチャだけでなく、集約された点集合も入ります。後者には集約された中心点が必要で、そのデータ構造は次のとおりです。

```ts
// createPointCluster
data.push(
    x,
    y, // projected point coordinates
    Infinity, // the last zoom the point was processed at
    i, // index of the source feature in the original input array
    -1, // parent cluster id
    1, // number of points in a cluster
);
```

インデックスを作る段階では、ズームレベルごとに k-d ツリーを構築する必要があります。

```ts
// supercluster/index.js

// maxZoom
// minZoom
let clusters = [];
for (let i = 0; i < points.length; i++) {
    clusters.push(createPointCluster(points[i], i));
}
// Create root k-d tree
this.trees[maxZoom + 1] = new KDBush(
    clusters,
    getX,
    getY,
    nodeSize,
    Float32Array,
);
for (let z = maxZoom; z >= minZoom; z--) {
    clusters = this._cluster(clusters, z);
    this.trees[z] = new KDBush(clusters, getX, getY, nodeSize, Float32Array);
}
```

指定範囲内の点を集約するには、二つの問題を扱う必要があります。

1. k-d ツリーの半径で、与えられた半径内のすべての近傍を問い合わせます。kdbush が提供する `within` メソッドがこの役割を担います。
2. 範囲内の点の座標から、集約点の座標を作ります。重みは、各部分集合に含まれる点の数です。

```ts
getClusters(bbox, zoom) {
// Get k-d tree on current zoom level
    const tree = this.trees[this._limitZoom(zoom)];
// Query the index array of features contained within the bounding box
    const ids = tree.range(minX, minY, maxX, maxY);
    const clusters = [];
    for (const id of ids) {
// Locate a k-d tree node via index
        const c = tree.points[id];
// If the node is a point set, create the corresponding GeoJSON feature; if it is a single point, return it directly.
        clusters.push(c.numPoints ? getClusterJSON(c) : this.points[c.index]);
    }
    return clusters;
}
```

### クラスタの表示 {#display-clusters}

ビューポート範囲内の集約された点を問い合わせます。

```ts
const { cameraZoom } = this.api.getAppState();
const { minX, minY, maxX, maxY } = this.api.getViewportBounds();
this.clusters = this.cluster.getClusters([minX, minY, maxX, maxY], cameraZoom);
```

![クラスタ表示のコメント](/comments-cluster.gif)

## fractional-indexing {#fractional-indexing}

先に述べたように、シーングラフは「移動可能な木（movable tree）」と見なせます。起こり得る衝突は、追加、削除、移動の三つです。[Movable tree CRDTs and Loro's implementation] は、この三つの場面における Loro の実装方針を詳しく説明しています。たとえば同じノードを削除しつつ移動する場合、どちらの結果も受け入れられ、サーバーがメッセージを受け取った順序によります。ただし、同期のあとで循環を作る操作もあります。二人のユーザーがそれぞれ `B -> C` と `C -> B` を行うと、木の構造上の定義が壊れます。

![同一ノードの削除と移動](https://loro.dev/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fmove-delete-dark.17378273.png&w=3840&q=75)

```ts
import { Loro, LoroTree, LoroTreeNode } from 'loro-crdt';

let doc = new Loro();
let tree: LoroTree = doc.getTree('tree');
let root: LoroTreeNode = tree.createNode();
```

[Realtime editing of ordered sequences] は、Figma が [fractional-indexing] でシーングラフ内の要素位置を表す方法を紹介しています。

![編集されるオブジェクト列の例](https://cdn.sanity.io/images/599r6htc/regionalized/dc3ac373a86b1d25629d651e2b75100dc3d9fbb9-1400x1144.png?w=804&q=75&fit=max&auto=format&dpr=2)

Excalidraw も同じ実装を使います。

```ts
// @see https://github.com/excalidraw/excalidraw/blob/9ee0b8ffcbd3664a47748a93262860321a203821/packages/excalidraw/fractionalIndex.ts#L380
import { generateNKeysBetween } from 'fractional-indexing';
const fractionalIndices = generateNKeysBetween(
    elements[lowerBoundIndex]?.index,
    elements[upperBoundIndex]?.index,
    indices.length,
) as FractionalIndex[];
```

Loro 組み込みの Tree には Fractional Index アルゴリズムが含まれます。詳しくは [Movable tree CRDTs and Loro's implementation] を参照してください。

> Fractional Index アルゴリズムを Loro に統合し、movable tree と組み合わせて、movable tree の子ノードをソートできるようにしました。

[Lesson 14] では、`ZIndex` で描画順を操作することを目指します。エディタ UI では、この機能は「レイヤー順の調整」「上へ移動」「下へ移動」のような機能として現れます。したがって `ZIndex` が初めて追加されるとき、または変更されるとき、まずシーングラフを走査し、子ノードを `ZIndex` でソートします。ソート済みの配列を得たあと、直前と直後の兄弟ノードに基づいて、現在のノードのフラクショナルインデックスを更新します。

```ts
class ComputeZIndex extends System {
    private readonly zIndexes = this.query(
        (q) => q.addedOrChanged.with(ZIndex).trackWrites,
    );

    execute() {
        this.zIndexes.addedOrChanged.forEach((entity) => {
            // Travese scenegraph, sort children by z-index
            const descendants = getDescendants(
                getSceneRoot(entity),
                sortByZIndex,
            );
            const index = descendants.indexOf(entity);
            const prev = descendants[index - 1] || null;
            const next = descendants[index + 1] || null;
            const prevFractionalIndex =
                (prev?.has(FractionalIndex) &&
                    prev.read(FractionalIndex)?.value) ||
                null;
            const nextFractionalIndex =
                (next?.has(FractionalIndex) &&
                    next.read(FractionalIndex)?.value) ||
                null;

            // Generate fractional index with prev and next node
            const key = generateKeyBetween(
                prevFractionalIndex, // a0
                nextFractionalIndex, // a2
            );

            if (!entity.has(FractionalIndex)) {
                entity.add(FractionalIndex);
            }
            entity.write(FractionalIndex).value = key; // a1
        });
    }
}
```

これにより、描画の前にフラクショナルインデックスでソートできます。[localeCompare] を比較に直接使うことはできません。

```ts
export function sortByFractionalIndex(a: Entity, b: Entity) {
    if (a.has(FractionalIndex) && b.has(FractionalIndex)) {
        const aFractionalIndex = a.read(FractionalIndex).value;
        const bFractionalIndex = b.read(FractionalIndex).value;

        // Can't use localeCompare here.
        // @see https://github.com/rocicorp/fractional-indexing/issues/20
        if (aFractionalIndex < bFractionalIndex) return -1;
        if (aFractionalIndex > bFractionalIndex) return 1;
        return 0;
    }

    return 0;
}
```

## さらに読む {#extended-reading}

-   [How Figma's multiplayer technology works]
-   [Movable tree CRDTs and Loro's implementation]
-   [Learn Yjs]
-   [CRDTs: The Hard Parts]
-   [An Interactive Intro to CRDTs]
-   [The Full Spectrum of Collaboration]
-   [Building Figma Multiplayer Cursors]

[What are CRDTs]: https://loro.dev/docs/concepts/crdt
[CRDTs: The Hard Parts]: https://www.youtube.com/watch?v=x7drE24geUw
[Local-first software - You own your data, in spite of the cloud]: https://www.inkandswitch.com/local-first/
[Loro Excalidraw Example]: https://github.com/loro-dev/loro-excalidraw
[The past, present, and future of local-first]: https://speakerdeck.com/ept/the-past-present-and-future-of-local-first
[TipTap offline support]: https://tiptap.dev/docs/guides/offline-support
[An Interactive Intro to CRDTs]: https://jakelazaroff.com/words/an-interactive-intro-to-crdts/
[Building a Collaborative Pixel Art Editor with CRDTs]: https://jakelazaroff.com/words/building-a-collaborative-pixel-art-editor-with-crdts/
[Making CRDTs 98% More Efficient]: https://jakelazaroff.com/words/making-crdts-98-percent-more-efficient/
[Learn Yjs]: https://learn.yjs.dev/
[dgmjs-plugin-yjs]: https://github.com/dgmjs/dgmjs/tree/main/packages/dgmjs-plugin-yjs
[Designing Data Structures for Collaborative Apps]: https://mattweidner.com/2022/02/10/collaborative-data-design.html
[The Full Spectrum of Collaboration]: https://zed.dev/blog/full-spectrum-of-collaboration
[Data Structures in Liveblocks]: https://liveblocks.io/docs/api-reference/liveblocks-client#Data-structures
[Y.Map]: https://docs.yjs.dev/api/shared-types/y.map
[Simple Values]: https://automerge.org/docs/documents/values/
[Map]: https://loro.dev/docs/tutorial/map
[How Figma's multiplayer technology works]: https://www.figma.com/blog/how-figmas-multiplayer-technology-works/
[Realtime editing of ordered sequences]: https://www.figma.com/blog/realtime-editing-of-ordered-sequences/#fractional-indexing
[BroadcastChannel]: https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
[Excalidraw updateScene]: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#updatescene
[fractional-indexing]: https://github.com/rocicorp/fractional-indexing
[Movable tree CRDTs and Loro's implementation]: https://loro.dev/blog/movable-tree
[Lesson 14]: /ja/guide/lesson-014#z-index
[localeCompare]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare
[Homomorphically Encrypting CRDTs]: https://jakelazaroff.com/words/homomorphically-encrypted-crdts/
[End-to-End Encryption in the Browser]: https://plus.excalidraw.com/blog/end-to-end-encryption
[Building Figma Multiplayer Cursors]: https://mskelton.dev/blog/building-figma-multiplayer-cursors
[How to animate multiplayer cursors]: https://liveblocks.io/blog/how-to-animate-multiplayer-cursors
[List]: https://loro.dev/docs/tutorial/list
[LoroDoc]: https://loro.dev/docs/tutorial/loro_doc
[Exporting and Importing]: https://loro.dev/docs/tutorial/loro_doc#exporting-and-importing
[generateKey]: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey
[exportKey]: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/exportKey
[AES-GCM]: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt#aes-gcm
[JSON Web Key]: https://developer.mozilla.org/zh-CN/docs/Web/API/SubtleCrypto/importKey#json_web_key
[firestore]: https://firebase.google.com/docs/firestore
[liveblocks]: https://liveblocks.io/multiplayer-editing
[Awareness & Presence]: https://docs.yjs.dev/getting-started/adding-awareness
[Example with Loro]: /example/loro
[Example with Yjs]: /example/yjs
[Example with Liveblocks]: /example/liveblocks
[updatePresence]: https://liveblocks.io/docs/api-reference/liveblocks-client#Room.updatePresence
[perfect-cursors]: https://github.com/steveruizok/perfect-cursors
[Lesson 6 - Coordinates]: /ja/guide/lesson-006#coordinates
[Example with perfect-cursors]: /example/perfect-cursors
[Example with framer-motion]: https://liveblocks.io/examples/overlay-comments/nextjs-comments-overlay
[Liveblocks Comments]: https://liveblocks.io/docs/ready-made-features/comments
[framer-motion]: https://www.npmjs.com/package/framer-motion
[Guide to comments in Figma]: https://help.figma.com/hc/en-us/articles/360039825314-Guide-to-comments-in-Figma
[kdbush]: https://github.com/mourner/kdbush
[supercluster]: https://github.com/mapbox/supercluster
