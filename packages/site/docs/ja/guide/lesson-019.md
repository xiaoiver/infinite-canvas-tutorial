---
outline: deep
description: '履歴管理で元に戻す／やり直す機能を実装します。状態のスナップショット、増分更新、そして共同編集を支える履歴エントリの記録について学びます。'
head:
    - ['meta', { property: 'og:title', content: '第19課 - 履歴' }]
---

<script setup>
import History from '../../components/History.vue';
</script>

# 第 19 課 - 履歴 {#lesson-19-history}

この課では、履歴に関する機能を実装する方法を見ていきます。

<History />

テキストエディタでもグラフィカルエディタでも、履歴と元に戻す・やり直す機能は欠かせません。[JavaScript-Undo-Manager] の実装と同じように、undoStack を使って各操作とその逆操作を保存できます。

```ts
function createPerson(id, name) {
    // first creation
    addPerson(id, name);

    // make undoable
    undoManager.add({
        undo: () => removePerson(id),
        redo: () => addPerson(id, name),
    });
}
```

元に戻す操作とやり直す操作を、二つのスタックで別々に管理することもできます。参照: [UI Algorithms: A Tiny Undo Stack]。[How Figma's multiplayer technology works] の最後の節では、Figma の実装方法が紹介されています。

> このため Figma では、元に戻す操作はその時点でやり直し履歴を変更し、同様にやり直す操作はその時点で元に戻す履歴を変更します。

[Excalidraw HistoryEntry] を参考に、元に戻す操作とやり直す操作を管理する History クラスを追加します。

```ts
export class History {
    #undoStack: HistoryStack = [];
    #redoStack: HistoryStack = [];

    clear() {
        this.#undoStack.length = 0;
        this.#redoStack.length = 0;
    }
}
```

履歴スタックの各エントリには、システム状態に対する二種類の変更が含まれます。以下で説明します。

```ts
type HistoryStack = HistoryEntry[];
export class HistoryEntry {
    private constructor(
        public readonly appStateChange: AppStateChange,
        public readonly elementsChange: ElementsChange,
    ) {}
}
```

## 状態の設計 {#design-states}

Excalidraw を参考に、システム状態を `AppState` と `Elements` に分けます。前者にはキャンバスと UI コンポーネントの状態が含まれます。たとえば現在のテーマ、カメラのズームレベル、ツールバーの構成や選択状態などです。

```ts
export interface AppState {
    theme: Theme;
    checkboardStyle: CheckboardStyle;
    cameraZoom: number;
    penbarAll: Pen[];
    penbarSelected: Pen;
    taskbarAll: Task[];
    taskbarSelected: Task[];
    layersSelected: SerializedNode['id'][];
    propertiesOpened: SerializedNode['id'][];
}
```

ご覧のとおり、`{ penbar: { all: [], selected: [] } }` のような入れ子のオブジェクトより、平坦なデータ構造を好みます。再帰が不要で、状態の diff をより速く簡単にするためです。参照: [distinctKeysIterator]。

後者はキャンバス上の図形の配列で、図形のシリアライズという文脈で [第 10 課] において既に扱いました。ここでは木構造の代わりに平坦な配列を使い、`attributes` オブジェクトの属性を最上位へ上げ、親子関係は `parentId` で親ノードの `id` と関連付ける、少し異なる表し方をします。ただし木構造をそのまま辿って描画することはできないので、何らかの規則で図形配列を並べ替える必要があります。この方法は後で扱います。

```ts
// before
interface SerializedNode {
    id: string;
    children: [];
    attributes: {
        fill: string;
        stroke: string;
    };
}

// after
interface SerializedNode {
    id: string;
    parentId?: string;
    fill: string;
    stroke: string;
}
```

共同編集を考慮して、後から `version` のような属性を追加します。

## スナップショットとしての状態 {#state-as-a-snapshot}

[State as a Snapshot] の次の図は、React の render 関数が実行されたあと、DOM ツリーを更新する前にスナップショットを取る様子を示しています。

![React のスナップショット](/react-snapshot.png)

スナップショットには、上で定義した二種類のシステム状態が含まれます。どの瞬間でもシステムのスナップショットは一つだけで、状態が変わるたびに現在のスナップショットと計算して、対応する状態の変更を得られます。たとえば `ElementsChange` の「図形が一つ削除された」、`AppStateChange` の「レイヤーが一つ選択された」などです。

```ts
class Snapshot {
    private constructor(
        public readonly elements: Map<string, SerializedNode>,
        public readonly appState: AppState,
    ) {}
}
```

では、システムはスナップショットをどのように更新すべきでしょうか。戦略としては、直接上書きするか、増分更新を計算するかを選べます。excalidraw は、この二つの振る舞いを表す [captureUpdate] を提供しています。二つは異なる場面に向いています。たとえば直接上書きはシーンの初期化に向いています。この時点では、空のキャンバス状態へ戻る必要がないからです。

```ts
class Store {
    private _snapshot = Snapshot.empty();

    commit(
        elements: Map<string, SerializedNode> | undefined,
        appState: AppState | undefined,
    ) {
        try {
            // Capture has precedence since it also performs update
            if (this.#scheduledActions.has(CaptureUpdateAction.IMMEDIATELY)) {
                this.captureIncrement(elements, appState);
            } else if (this.#scheduledActions.has(CaptureUpdateAction.NEVER)) {
                this.updateSnapshot(elements, appState);
            }
        } finally {
            // Defensively reset all scheduled actions, potentially cleans up other runtime garbage
            this.#scheduledActions = new Set();
        }
    }
}
```

増分の計算方法と、それを使って `HistoryEntry` を作る方法に焦点を当てます。

```ts
class Store {
    captureIncrement(
        elements: Map<string, SerializedNode> | undefined,
        appState: AppState | undefined,
    ) {
        const prevSnapshot = this.snapshot;
        const nextSnapshot = this.snapshot.maybeClone(elements, appState);
        const elementsChange = nextSnapshot.meta.didElementsChange
            ? ElementsChange.calculate(
                  prevSnapshot.elements,
                  nextSnapshot.elements,
                  this.api,
              )
            : ElementsChange.empty();
        // AppStateChange 同理

        // Use history.record to create HistoryEntry
    }
}
```

履歴エントリを追加する方法を見てみましょう。

## 履歴エントリを記録する {#record-history-entry}

この節の冒頭の例では、API を使って矩形の塗り色を更新する履歴を二つ挿入しました。上部ツールバーの元に戻す操作とやり直す操作で確認できます。

```ts
api.updateNode(node, {
    fill: 'red',
});
api.record();

api.updateNode(node, {
    fill: 'blue',
});
api.record();
```

`api.record` を呼び出すたびに、現在の `AppState` と `Elements` の状態でスナップショットを更新します。

```ts
class API {
    record(
        captureUpdateAction: CaptureUpdateActionType = CaptureUpdateAction.IMMEDIATELY,
    ) {
        if (
            captureUpdateAction === CaptureUpdateAction.NEVER ||
            this.#store.snapshot.isEmpty()
        ) {
            this.#store.shouldUpdateSnapshot();
        } else {
            this.#store.shouldCaptureIncrement();
        }
        this.#store.commit(arrayToMap(this.getNodes()), this.getAppState());
    }
}
```

`api.record` を呼び出すたびに、図形の状態が実際に変わったため履歴が一つ追加されます。ただし、AppState だけの変更では redoStack をリセットしてはならない点に注意が必要です。変更が起きたときは、その変更の逆操作を undoStack に追加します。

```ts
export class History {
    record(elementsChange: ElementsChange, appStateChange: AppStateChange) {
        const entry = HistoryEntry.create(appStateChange, elementsChange);

        if (!entry.isEmpty()) {
            // 添加逆操作
            this.#undoStack.push(entry.inverse());
            if (!entry.elementsChange.isEmpty()) {
                this.#redoStack.length = 0;
            }
        }
    }
}
```

ここで、`AppStateChange` と `ElementsChange` という、`Change` のためのデータ構造をどう設計するかを見られます。そうすれば汎用の `entry.inverse()` を使え、変更できる属性ごとに `add/removeFill` `add/removeStroke` のように記述する必要がなくなります。

## 変更構造の設計 {#design-change-structure}

Excalidraw の `Change` インターフェースはとても単純です。

```ts
export interface Change<T> {
    /**
     * Inverses the `Delta`s inside while creating a new `Change`.
     */
    inverse(): Change<T>;

    /**
     * Applies the `Change` to the previous object.
     *
     * @returns a tuple of the next object `T` with applied change, and `boolean`, indicating whether the applied change resulted in a visible change.
     */
    applyTo(previous: T, ...options: unknown[]): [T, boolean];

    /**
     * Checks whether there are actually `Delta`s.
     */
    isEmpty(): boolean;
}
```

二種類の状態変更はジェネリクスで記述でき、ここで `SceneElementsMap` は `Map<SerializedNode[‘id’], SerializedNode>` です。

```ts
class AppStateChange implements Change<AppState> {}
class ElementsChange implements Change<SceneElementsMap> {}
```

より単純な `AppStateChange` から始めます。コンストラクタは、削除された属性と追加または変更された属性を受け取る `Delta` インスタンスで、反転が必要なら二つの順序を入れ替えるだけです。

```ts
class AppStateChange implements Change<AppState> {
    private constructor(private readonly delta: Delta<AppState>) {}

    inverse(): AppStateChange {
        const inversedDelta = Delta.create(
            this.delta.inserted,
            this.delta.deleted,
        );
        return new AppStateChange(inversedDelta);
    }
}

class Delta<T> {
    private constructor(
        public readonly deleted: Partial<T>,
        public readonly inserted: Partial<T>,
    ) {}
}
```

## 変更を適用する {#apply-changes}

```ts
export class ElementsChange implements Change<SceneElementsMap> {
    applyTo(
        elements: SceneElementsMap,
        snapshot: Map<string, SerializedNode>,
    ): [SceneElementsMap, boolean] {
        this.updated.forEach((delta, id) => {
            const { inserted, deleted } = delta;
            const element = nextElements.get(id);
            if (element) {
                Object.keys(deleted).forEach((key) => {
                    delete element[key];
                });
                Object.assign(element, inserted);
                this.api.updateNode(element, delta.inserted);
            }
        });
    }
}
```

[UI Algorithms: A Tiny Undo Stack]: https://blog.julik.nl/2025/03/a-tiny-undo-stack
[JavaScript-Undo-Manager]: https://github.com/ArthurClemens/JavaScript-Undo-Manager
[distinctKeysIterator]: https://github.com/excalidraw/excalidraw/blob/dff69e91912507bbfcc68b35277cc6031ce5b437/packages/excalidraw/change.ts#L359
[第 10 課]: /ja/guide/lesson-010#shape-to-serialized-node
[State as a Snapshot]: https://react.dev/learn/state-as-a-snapshot
[Excalidraw HistoryEntry]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/history.ts#L160-L164
[captureUpdate]: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#captureupdate
