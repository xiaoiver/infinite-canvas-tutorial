---
outline: deep
description: '히스토리 관리로 실행 취소와 다시 실행 기능을 구현합니다. 상태 스냅샷, 증분 업데이트, 그리고 협업 편집을 지원하기 위한 히스토리 항목 기록을 학습합니다.'
head:
    - ['meta', { property: 'og:title', content: '19강 - 히스토리' }]
---

<script setup>
import History from '../../components/History.vue';
</script>

# 19강 - 히스토리 {#lesson-19-history}

이번 강의에서는 히스토리와 관련된 기능을 구현하는 방법을 살펴봅니다.

<History />

텍스트 편집기이든 그래픽 편집기이든, 히스토리와 실행 취소·다시 실행 기능은 필수입니다. [JavaScript-Undo-Manager]의 구현처럼, undoStack으로 각 연산과 그 역연산을 저장할 수 있습니다.

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

실행 취소와 다시 실행을 두 개의 스택으로 나누어 관리할 수도 있습니다. 참고: [UI Algorithms: A Tiny Undo Stack]. [How Figma's multiplayer technology works]의 마지막 절은 Figma의 구현 방식을 소개합니다.

> 이 때문에 Figma에서는 실행 취소 연산이 실행 취소가 일어나는 시점에 다시 실행 히스토리를 바꾸고, 마찬가지로 다시 실행 연산이 다시 실행이 일어나는 시점에 실행 취소 히스토리를 바꿉니다.

[Excalidraw HistoryEntry]를 참고하여, 실행 취소와 다시 실행을 관리하는 History 클래스를 추가합니다.

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

히스토리 스택의 각 항목에는 시스템 상태에 대한 두 종류의 수정이 들어 있으며, 아래에서 설명합니다.

```ts
type HistoryStack = HistoryEntry[];
export class HistoryEntry {
    private constructor(
        public readonly appStateChange: AppStateChange,
        public readonly elementsChange: ElementsChange,
    ) {}
}
```

## 상태 설계 {#design-states}

Excalidraw를 참고하여 시스템 상태를 `AppState`와 `Elements`로 나눕니다. 전자에는 캔버스와 UI 컴포넌트의 상태가 포함됩니다. 예를 들어 현재 테마, 카메라 확대/축소 수준, 툴바 구성과 선택 상태 등입니다.

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

보시다시피, `{ penbar: { all: [], selected: [] } }` 같은 중첩 객체보다 평탄한 데이터 구조를 선호합니다. 재귀가 필요 없는, 더 빠르고 쉬운 상태 diff를 위해서입니다. 참고: [distinctKeysIterator].

후자는 캔버스에 있는 도형 배열이며, 도형 직렬화의 맥락에서 [10강]에서 이미 다루었습니다. 여기서는 트리 구조 대신 평탄한 배열을 쓰고, `attributes` 객체의 속성을 최상위로 올리며, 부모-자식 관계는 `parentId`로 부모 노드의 `id`와 연결하는 방식으로 조금 다르게 나타냅니다. 다만 트리 구조를 그대로 순회해서 렌더할 수는 없으므로, 어떤 규칙에 따라 도형 배열을 정렬해야 합니다. 이 내용은 나중에 다룹니다.

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

협업을 고려하여 나중에 `version` 같은 속성을 더 추가합니다.

## 스냅샷으로서의 상태 {#state-as-a-snapshot}

[State as a Snapshot]의 다음 그림은 React의 render 함수가 실행된 뒤, DOM 트리를 갱신하기 전에 스냅샷을 찍는 과정을 보여 줍니다.

![React 스냅샷](/react-snapshot.png)

스냅샷에는 위에서 정의한 두 종류의 시스템 상태가 들어 있습니다. 어느 순간이든 시스템의 스냅샷은 하나만 존재하며, 상태가 바뀔 때마다 현재 스냅샷과 계산하여 해당하는 상태 수정을 얻을 수 있습니다. 예를 들어 `ElementsChange`의 “도형 하나가 삭제되었다”, `AppStateChange`의 “레이어 하나가 선택되었다” 등이 있습니다.

```ts
class Snapshot {
    private constructor(
        public readonly elements: Map<string, SerializedNode>,
        public readonly appState: AppState,
    ) {}
}
```

그렇다면 시스템은 스냅샷을 어떻게 갱신해야 할까요? 전략상으로는 직접 덮어쓰거나, 증분 업데이트를 계산하는 방법을 고를 수 있습니다. excalidraw는 이 두 동작을 나타내는 [captureUpdate]를 제공합니다. 두 방식은 서로 다른 상황에 맞습니다. 예를 들어 직접 덮어쓰기는 씬 초기화에 적합합니다. 이 시점에는 빈 캔버스 상태로 되돌아갈 필요가 없기 때문입니다.

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

증분을 어떻게 계산하고, 그것으로 `HistoryEntry`를 만드는지에 집중해 보겠습니다.

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

히스토리 항목을 추가하는 방법을 살펴보겠습니다.

## 히스토리 항목 기록 {#record-history-entry}

이 절 맨 위의 예에서는 API로 사각형의 채우기 색을 갱신하는 히스토리 두 개를 넣었습니다. 상단 툴바의 실행 취소와 다시 실행으로 확인할 수 있습니다.

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

`api.record`를 호출할 때마다 현재 `AppState`와 `Elements` 상태로 스냅샷을 갱신합니다.

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

`api.record`를 호출할 때마다 도형의 상태가 실제로 바뀌었기 때문에 히스토리 기록이 하나 추가됩니다. 다만 AppState만 바뀐 경우에는 redoStack을 비우면 안 된다는 점이 중요합니다. 변경이 일어나면 그 변경의 역연산을 undoStack에 넣습니다.

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

이제 `AppStateChange`와 `ElementsChange`라는, `Change`를 위한 데이터 구조를 어떻게 설계할지 볼 수 있습니다. 그러면 범용적인 `entry.inverse()`를 쓸 수 있고, 변경 가능한 속성마다 `add/removeFill` `add/removeStroke`처럼 적을 필요가 없습니다.

## 변경 구조 설계 {#design-change-structure}

Excalidraw의 `Change` 인터페이스는 매우 단순합니다.

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

두 종류의 상태 변경은 제네릭으로 기술할 수 있으며, 여기서 `SceneElementsMap`은 `Map<SerializedNode[‘id’], SerializedNode>`입니다.

```ts
class AppStateChange implements Change<AppState> {}
class ElementsChange implements Change<SceneElementsMap> {}
```

더 단순한 `AppStateChange`부터 보겠습니다. 생성자는 삭제된 속성과 추가되거나 수정된 속성을 받는 `Delta` 인스턴스이며, 반전이 필요하면 둘의 순서만 바꾸면 됩니다.

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

## 변경 적용 {#apply-changes}

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
[10강]: /ko/guide/lesson-010#shape-to-serialized-node
[State as a Snapshot]: https://react.dev/learn/state-as-a-snapshot
[Excalidraw HistoryEntry]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/history.ts#L160-L164
[captureUpdate]: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#captureupdate
