---
outline: deep
description: 'CRDT(Conflict-free Replicated Data Type, 충돌 없는 복제 데이터 타입)로 다중 사용자 협업 편집을 구현합니다. Loro, 분수 인덱싱, 실시간 동기화로 로컬 퍼스트 소프트웨어 원칙을 적용합니다.'
head:
    - ['meta', { property: 'og:title', content: '20강 - 협업' }]
---

<script setup>
import LoroCRDT from '../../components/LoroCRDT.vue';
import YjsCRDT from '../../components/YjsCRDT.vue';
import PerfectCursors from '../../components/PerfectCursors.vue';
</script>

# 20강 - 협업 {#lesson-20-collaboration}

이번 강의에서는 다중 사용자 협업 편집 기능을 구현하는 방법을 살펴봅니다.

-   CRDT의 분류와 구현
-   Loro / Yjs와 [BroadcastChannel]을 사용해 localhost에서 협업을 시뮬레이션
-   [liveblocks]로 서버와 여러 클라이언트 사이의 협업 편집을 구현
-   종단 간 암호화된 CRDT
-   Awareness와 Presence. 다중 사용자 커서와 댓글을 포함합니다

## CRDT {#crdt}

CRDT란 무엇일까요? 다음 소개는 [What are CRDTs]에서 가져왔습니다. Google Docs / Figma / Tiptap의 협업 기능은 모두 이것을 기반으로 구현되어 있습니다. 이 글은 CRDT와 운영 변환(OT)의 특성도 자세히 비교합니다.

> CRDT(conflict-free replicated data type, 충돌 없는 복제 데이터 타입)는 네트워크상의 여러 컴퓨터에 복제할 수 있는 데이터 구조입니다. 각 복제본은 복제본끼리 조율하지 않고도 독립적으로, 그리고 병렬로 갱신할 수 있으며, 충돌이 발생하지 않는다는 보장이 있습니다.

[What are CRDTs]의 다음 그림은 CAP 정리 아래에서 CRDT가 "완벽한 일관성"이 아니라 최종 일관성을 제공한다는 점을 보여 줍니다. 실시간 일관성은 보장할 수 없지만, 두 노드가 메시지를 동기화하면 다시 일치한 상태로 돌아옵니다.

![CRDT는 A + P + 최종 일관성을 만족합니다. CAP 아래에서의 타협점](https://loro.dev/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fa4858e2a50bc1a2d79722060156e89b0cac5815cf25e8c67e409aa0926280cef.6a607785.png&w=3840&q=75)

[How Figma's multiplayer technology works]는 Figma가 Google Docs처럼 OT를 고르지 않은 이유를 설명합니다.

> Figma의 데이터 구조는 하나의 CRDT가 아니라는 점도 짚어 둘 만합니다. 여러 개의 서로 다른 CRDT에서 착안하여 그것들을 조합하고, Figma 문서를 나타내는 최종 데이터 구조를 만듭니다(아래에서 설명합니다).

### CRDT의 두 가지 유형 {#two-types-of-crdts}

CRDT에는 연산 기반(Op-based)과 상태 기반(State-based)의 두 유형이 있습니다. 전자의 원리는, 두 사용자가 같은 순서의 연산을 실행하면 문서의 최종 상태도 같아야 한다는 것입니다. 이를 위해 각 사용자는 데이터에 대해 실행된 모든 연산을 유지하고, 그 연산을 다른 사용자와 동기화하여 최종 상태를 맞춥니다. 후자는 노드 사이에 전체 상태를 전달해야 합니다. 전자는 연산의 설명만 전송하므로 대역폭이 더 적게 드는 것처럼 보이지만, 연산의 멱등성을 보장하고 연산 순서 문제를 처리하려면 구현이 복잡해집니다. 그에 비해 후자의 구현은 더 단순합니다.

이제 다음 튜토리얼 시리즈로 State-based CRDT를 이해해 보겠습니다.

-   [An Interactive Intro to CRDTs]
-   [Building a Collaborative Pixel Art Editor with CRDTs]
-   [Making CRDTs 98% More Efficient]

이 튜토리얼은 결합법칙, 교환법칙, 멱등성을 만족해야 하는 병합 함수를 포함한 CRDT의 일반적인 데이터 구조를 제시합니다. 이 병합 함수는 Last-Writer Wins(LWW) Register가 될 수 있습니다. 자신의 타임스탬프와 입력 데이터의 타임스탬프를 매번 비교하고, 입력 데이터의 타임스탬프가 더 크면 자신의 데이터를 갱신합니다.

```ts
interface CRDT<T, S> {
    value: T;
    state: S;
    merge(state: S): void;
}
```

키-값 형태의 스타일시트는 LWW Register에 잘 맞습니다. [Designing Data Structures for Collaborative Apps]는 Quill 에디터가 사용하는 `{bold: true}` 스타일을 소개합니다.

우리 시나리오에 더 도움이 되는 글은 [How Figma's multiplayer technology works]입니다. Figma의 CTO가 내부에서 사용하는 DOM과 비슷한 트리 구조(씬 그래프)를 소개합니다. 각 오브젝트에는 ID와 속성 값의 집합이 있으며, 이것은 2단계 매핑 `Map<ObjectID, Map<Property, Value>>`로 볼 수 있습니다. 오브젝트 속성, 오브젝트 추가/삭제, 순서 등을 다룰 때 서로 다른 병합 전략을 사용합니다.

-   한 오브젝트의 같은 속성을 수정하는 경우. 예를 들어 두 사용자가 같은 텍스트 오브젝트의 속성 값을 각각 AB와 BC로 바꾸면, Figma는 병합 알고리즘으로 ABC를 만들지 않고 서버가 메시지를 받은 시점에 따릅니다.
-   오브젝트 추가/삭제. 오브젝트 생성은 LWW Register를 그대로 사용합니다. CRDT 모델과 다른 점은 삭제 동작입니다. Figma 서버는 삭제된 오브젝트의 속성을 저장하지 않고, 이후 실행 취소에 필요할 수 있는 저장은 클라이언트가 담당합니다.
-   씬 그래프 구조의 변화. 자식 노드는 속성으로 부모 노드 ID를 참조하고, 노드 목록 안의 위치는 Fractional indexing으로 구현합니다. 장점은 위치를 바꿀 때 값 하나만 갱신하면 된다는 점입니다. 자세한 내용은 [Realtime editing of ordered sequences]를 참고하세요. 이 방식의 결함 중 하나인 인터리빙(interleaving)도 고려하지 않습니다.

### 로컬 퍼스트 소프트웨어 {#local-first-software}

[Local-first software - You own your data, in spite of the cloud]

> 이 글에서 우리는 "로컬 퍼스트 소프트웨어"를 제안합니다. 사용자가 협업과 소유를 함께 가질 수 있게 하는 소프트웨어 원칙의 묶음입니다. 로컬 퍼스트가 지향하는 것에는 오프라인에서 작업하고 여러 기기에서 협업하는 능력이 포함되며, 이와 함께 데이터의 보안, 프라이버시, 장기 보존, 사용자 통제를 높입니다.

[The past, present, and future of local-first]의 다음 그림은, 로컬 퍼스트라는 소프트웨어 개발과 데이터 관리 철학도 CRDT를 기반으로 구현할 수 있음을 보여 줍니다.

![로컬 퍼스트의 역사](/local-first-history.png)

[How Figma's multiplayer technology works]

> Figma에서는 임의의 시간 동안 오프라인으로 전환한 뒤에도 편집을 계속할 수 있습니다. 다시 온라인으로 돌아오면 클라이언트는 문서의 최신 사본을 다운로드하고, 그 최신 상태 위에 오프라인 편집을 다시 적용한 다음, 새 WebSocket 연결로 업데이트 동기화를 이어 갑니다.

리치 텍스트 에디터와 코드 에디터도 이를 지원합니다. [TipTap offline support]와 [The Full Spectrum of Collaboration]을 참고하세요.

### CRDT의 구현 {#implementation-of-crdts}

Y.js와 다른 언어로의 이식은 의심할 여지 없이 가장 잘 알려진 CRDT 구현입니다. 다음 문장은 <https://tiptap.dev/docs/collaboration/getting-started/overview#about-yjs>에서 가져왔습니다.

> CRDT인 Y.js는 변경의 순서가 문서의 최종 상태에 영향을 주지 않도록 합니다. Git이 커밋을 다루는 방식과 비슷합니다. 이로써 서로 다른 환경에 있는 모든 데이터 사본이 일치한 상태로 유지됩니다.

협업 상태에서 텍스트나 리치 텍스트를 병합할 필요가 없으므로, 캔버스 상태를 저장할 단순한 데이터 구조만 있으면 됩니다. 예를 들어 [Y.Map]이 있습니다. 다른 CRDT 구현도 비슷한 API를 제공합니다.

-   Liveblocks는 `LiveObject/List/Map`을 제공합니다. 자세한 내용은 [Data Structures in Liveblocks]를 참고하세요.
-   Automerge는 [Simple Values]를 제공하며, JSON의 모든 적법한 타입을 지원하고 `Date`까지 포함합니다.
-   Loro도 [Map]을 제공합니다.

## BroadcastChannel로 시뮬레이션 {#simulate-with-broadcast-channel}

이제 [Loro Excalidraw Example]과 [dgmjs-plugin-yjs]를 참고하여, 동일 출처의 여러 탭이 통신할 수 있는 [BroadcastChannel]의 특성으로 여러 사용자가 협업하는 효과를 시뮬레이션합니다.

### Loro 예제 {#example-with-loro}

Excalidraw에서는 `onChange` 훅으로 씬 안의 모든 도형 변화를 감시할 수 있습니다.

```tsx
<Excalidraw
    onChange={(elements) => {
        const v = getVersion(elements);
    }}
/>
```

히스토리 기록이 바뀌면 이 훅을 호출합니다.

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

[Excalidraw updateScene]을 참고하면, 씬 그래프를 갱신하는 `updateNodes` 메서드도 제공할 수 있습니다.

```ts
api.updateNodes(nodes);
```

아래에서는 Loro를 예로 들어 여러 사용자가 함께 편집하는 효과를 시뮬레이션합니다. [BroadcastChannel]로 동일 출처의 여러 탭이 통신하게 합니다. 캔버스 내용이 바뀔 때마다 다른 페이지로 메시지를 보냅니다. 다른 페이지에서 메시지를 받으면 동기화를 마칩니다. 따라서 각 페이지는 메시지 송신자와 수신자를 동시에 맡아야 합니다.

먼저 메시지 수신 쪽의 구현을 살펴봅니다. 먼저 [LoroDoc] 인스턴스를 만듭니다. [List] 구조로 도형 목록을 저장합니다. 메시지를 받으면 그 데이터를 LoroDoc으로 가져옵니다. 참고 자료는 [Exporting and Importing]입니다.

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

이어서 `docNodes`를 JavaScript 객체로 변환한 뒤, 캔버스 API `updateNodes`를 호출하여 씬 갱신을 마칩니다.

```ts
doc.subscribe((e) => {
    if (e.by !== 'local') {
        api.updateNodes(docNodes.toJSON());
    }
});
```

이제 메시지 송신 쪽의 구현을 살펴봅니다. `onchange` 훅으로 캔버스 씬 그래프의 변화를 구독하고, 그 변화를 문서에 기록한 뒤 제출합니다. 그러면 다른 창에서 앞에서 본 씬 갱신이 일어납니다.

```ts
api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
    if (recordLocalOps(docElements, nodes)) {
        doc.commit();
    }
};
```

로컬 변경을 제출하는 동안:

```ts
function recordLocalOps(
    loroList: LoroList,
    nodes: readonly { version?: number; isDeleted?: boolean }[],
): boolean {
    nodes = nodes.filter((e) => !e.isDeleted); // 首先排除掉被删除的图形
}
```

아래 예제에서는 왼쪽이나 오른쪽 창에서 사각형을 자유롭게 드래그하거나, 크기를 바꾸거나, 색을 바꿀 수 있으며, 다른 창이 그 수정을 동기화합니다. [Example with Loro]

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<LoroCRDT />
</div>
<div style="flex: 1;">
<LoroCRDT />
</div>
</div>

### Yjs 예제 {#example-with-yjs}

먼저 로컬 캔버스의 변화를 감시하고, 도형 목록과 그 속성 객체를 로컬 `Y.Doc`에 동기화합니다.

```ts
api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
    doc.transact(() => {
        // 写入 Y.Doc
    }, local);
};
```

이어서 `Y.Doc`의 변화를 수신하고, `origin`으로 로컬 변화와 원격 변화를 구분합니다. 변화가 로컬에서 왔으면 동기화 메시지를 보내고, 원격에서 왔으면 캔버스 내용을 갱신합니다.

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

## Liveblocks를 백엔드로 사용 {#use-liveblocks-as-backend}

위의 BroadcastChannel 기반 구현은 어디까지나 단순한 예제입니다. 다음에는 [liveblocks]와 Yjs로 더 실용적인 예제를 구현합니다.

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

이 예제는 여러 브라우저 창에서 열 수 있습니다. [Example with Liveblocks]

![여러 창 사이의 협업](/liveblocks.gif)

## IndexedDB로 오프라인 지원 {#offline-support-with-indexeddb}

룸을 만들 때 [liveblocks]는 오프라인 기능을 손쉽게 켜는 `offlineSupport_experimental` 설정 항목도 제공합니다.

> IndexedDB로 오프라인 지원을 켭니다. 첫 로드 이후에는 문서가 로컬에 저장되고 즉시 불러와집니다.

```ts
import { getYjsProviderForRoom } from '@liveblocks/yjs';

const yProvider = getYjsProviderForRoom(room, {
    offlineSupport_experimental: true,
});
```

## 종단 간 암호화 {#end-to-end-encryption}

이제 문서를 CRDT로 저장하고, 어떤 동기화 서버로 업데이트를 병합하고 전달하면서도 이 파일은 비공개로 유지할 수 있습니다.

글 [End-to-End Encryption in the Browser]에서 Excalidraw는 단순한 종단 간 암호화 방식을 소개합니다. 여러 클라이언트가 통신하면서도 서버는 내용을 읽지 못합니다. 암호화된 데이터는 서버가 읽을 수 없는 링크의 해시 부분에 두고, 클라이언트에서만 디코딩합니다. <https://excalidraw.com/#json=5645858175451136,8w-G0ZXiOfRYAn7VWpANxw>

다음에는 Excalidraw가 Web Crypto API로 이 기능을 구현하는 방식을 분석합니다.

### 키 생성 {#generate-key}

[generateKey] API로 [AES-GCM] 알고리즘을 선택하고 무작위 키를 생성합니다. `extractable` 매개변수는 나중에 [exportKey] API로 키를 외부로 옮길 수 있는 형식으로 내보낼 수 있음을 나타냅니다. 예를 들어 여기서는 [JSON Web Key] 형식인 `‘jwk’`를 선택합니다.

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

### 데이터 암호화와 복호화 {#encrypt-decrypt-data}

먼저 암호학적으로 안전한 난수를 생성합니다.

```ts
export const createIV = () => {
    const arr = new Uint8Array(IV_LENGTH_BYTES);
    return window.crypto.getRandomValues(arr);
};
```

그런 다음 이 개인 키로 직렬화된 씬 데이터를 암호화하고, 클라이언트에서 [firestore]나 AWS S3 같은 클라우드 저장소로 업로드합니다.

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

### CRDT의 동형 암호화 {#homomorphically-encrypting-crdt}

[Homomorphically Encrypting CRDTs]

## Awareness와 Presence {#awareness-presence}

Yjs는 커서 위치와 상태 정보를 공유하는 [Awareness & Presence] 기능을 제공합니다. 사용자는 다른 협업 참여자가 있다는 것을 인지할 수 있습니다. 이 정보는 세션을 넘어 유지할 필요가 없으므로 Yjs 문서 안에 저장하지 않습니다. 다만 JSON 객체로 모든 사용자에게 전파할 수 있고, 사용자가 오프라인이 되면 자신의 상태를 제거합니다.

![출처: https://liveblocks.io/docs/ready-made-features/presence#Examples-using-Presence](https://liveblocks.io/_next/image?url=%2Fimages%2Fexamples%2Fthumbnails%2Flive-cursors-chat.jpg&w=828&q=90)

### Liveblocks를 백엔드로 사용 {#backend}

Yjs의 Provider 구현인 [liveblocks]도 Room API에서 Presence 기능을 제공합니다. 캔버스의 `pointermove` 이벤트를 수신하고 [updatePresence]로 방송할 수 있습니다. 저장하기 전에 월드 좌표계로 변환해야 합니다. 자세한 내용은 [Lesson 6 - Coordinates]를 참고하세요.

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

이렇게 하면 클라이언트가 다른 사용자의 상태 변화를 구독하고, 그 정보로 마우스 위치를 그릴 수 있습니다. 여기서는 마우스 위치를 월드 좌표계에서 뷰포트 좌표계로 변환해야 합니다.

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

물론 스로틀링으로 갱신 빈도를 낮출 수 있습니다. 다른 사람의 마우스 위치를 "실시간"으로 보여줄 필요는 없기 때문입니다. 하지만 여기서 다음 문제가 생깁니다.

```ts
const client = createClient({
    throttle: 16, // [!code ++]
    publicApiKey:
        'pk_dev_MYcFNShiwPwRDvuvhklopMg6SAkdASzz6QrOMQIlu86NkcuXVNxP06aXrxi9qo7M',
});
```

### 커서를 부드럽게 렌더링 {#smoothly-rendering-cursors}

[How to animate multiplayer cursors]는 스로틀링으로 갱신 빈도를 낮춘 뒤, 다른 사용자에게 마우스 커서가 끊겨 보이는 모습을 보여 줍니다. 새로 고침 빈도가 60FPS에서 20FPS로 떨어진 것과 비슷합니다.

![끊기는 커서](/jank-cursor.gif)

해결책은 마우스가 인접한 위치 사이를 단계적으로 뛰지 않고 부드럽게 이동하게 하는 것입니다. 다행히 tldraw가 이 처리를 모두 맡아 주는 [perfect-cursors] 기능을 제공합니다.

[Example with perfect-cursors]

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<PerfectCursors />
</div>
<div style="flex: 1;">
<PerfectCursors />
</div>
</div>

또한 [framer-motion]을 사용할 수 있습니다. 선언적 문법을 지원하고(React/Vue와 호환), 내장 Spring 이징 함수로 비슷한 효과를 냅니다. 자세한 내용은 [Example with framer-motion]을 참고하세요.

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

## 댓글 오버레이 {#comments-overlay}

협업 편집에서 실시간 채팅과 댓글은 중요합니다. Figma 안에서는 캔버스의 아무 곳에나 댓글 말풍선을 둘 수 있습니다. 또한 줌 레벨이 낮을 때는 댓글을 모아 댓글 클러스터의 개요를 보여 줍니다. 줌 레벨이 올라가면 더 잘게 나뉜 클러스터가 나타나고, 마지막에는 각 댓글 말풍선의 분포가 드러납니다. 자세한 내용은 [Guide to comments in Figma]를 참고하세요.

![Figma의 댓글](https://help.figma.com/hc/article_attachments/31566555250071)

### 데이터 구조 {#data-structure}

다음에는 [Liveblocks Comments]를 기반으로 비슷한 기능을 구현합니다. 먼저 데이터 구조를 살펴봅니다. Thread와 Comment는 일대다 관계입니다.

![출처: https://liveblocks.io/docs/ready-made-features/comments/concepts#Threads](https://liveblocks.io/_next/image?url=%2Fassets%2Fcomments%2Fcomment-thread-room-relation-dark.jpg&w=1920&q=100)

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

### 클러스터 {#cluster}

위의 점 집계 시나리오에서는 두 가지 핵심 과제를 해결해야 합니다.

1. 어떻게 집계할까요? 한 점이 주어졌을 때, 그 점을 중심으로 지정한 반경 안의 모든 점을 어떻게 찾을까요?
2. 집계한 뒤, 바운딩 박스(예를 들어 현재 뷰포트)가 주어지면 그 안에 포함된 집계된 피처를 어떻게 찾을까요?

이 두 문제(반경 질의와 범위 질의)에서, 점이 매우 많을 때 모든 점을 무차별 순회하는 방식은 본질적으로 비효율적입니다. 효율적으로 검색하려면 [kdbush] 같은 공간 인덱스를 써야 합니다. GIS 맥락은 아니지만, [supercluster]의 구현에서 아이디어를 얻을 수 있습니다.

점 집계에서 k-d 트리 노드에는 원래의 Point 피처뿐 아니라 집계된 점 집합도 들어 있습니다. 후자에는 집계된 중심점이 필요하며, 그 데이터 구조는 다음과 같습니다.

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

인덱스를 만드는 단계에서는 각 줌 레벨마다 k-d 트리를 구성해야 합니다.

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

지정한 범위 안의 점을 집계하려면 두 가지를 처리해야 합니다.

1. k-d 트리의 반경으로 주어진 반경 안의 모든 이웃을 질의합니다. kdbush가 제공하는 `within` 메서드가 이 역할을 합니다.
2. 범위 안 점들의 좌표로 집계점의 좌표를 만듭니다. 가중치는 각 부분집합이 포함하는 점의 개수입니다.

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

### 클러스터 표시 {#display-clusters}

뷰포트 범위 안의 집계된 점을 질의합니다.

```ts
const { cameraZoom } = this.api.getAppState();
const { minX, minY, maxX, maxY } = this.api.getViewportBounds();
this.clusters = this.cluster.getClusters([minX, minY, maxX, maxY], cameraZoom);
```

![클러스터로 모인 댓글](/comments-cluster.gif)

## fractional-indexing {#fractional-indexing}

앞에서 말한 것처럼 씬 그래프는 "이동 가능한 트리(movable tree)"로 볼 수 있으며, 일어날 수 있는 충돌은 추가, 삭제, 이동의 세 가지입니다. [Movable tree CRDTs and Loro's implementation]은 이 세 시나리오에 대한 Loro의 구현 접근을 자세히 설명합니다. 예를 들어 같은 노드를 삭제하고 이동하면 두 결과 모두 받아들일 수 있으며, 서버가 메시지를 받은 순서에 따릅니다. 다만 어떤 연산은 동기화 뒤에 순환을 만들 수 있습니다. 두 사용자가 각각 `B -> C`와 `C -> B`를 수행하면 트리의 구조 정의가 깨집니다.

![같은 노드의 삭제와 이동](https://loro.dev/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fmove-delete-dark.17378273.png&w=3840&q=75)

```ts
import { Loro, LoroTree, LoroTreeNode } from 'loro-crdt';

let doc = new Loro();
let tree: LoroTree = doc.getTree('tree');
let root: LoroTreeNode = tree.createNode();
```

[Realtime editing of ordered sequences]는 Figma가 [fractional-indexing]으로 씬 그래프 안의 요소 위치를 나타내는 방법을 소개합니다.

![편집 중인 오브젝트 순서의 예](https://cdn.sanity.io/images/599r6htc/regionalized/dc3ac373a86b1d25629d651e2b75100dc3d9fbb9-1400x1144.png?w=804&q=75&fit=max&auto=format&dpr=2)

Excalidraw도 같은 구현을 사용합니다.

```ts
// @see https://github.com/excalidraw/excalidraw/blob/9ee0b8ffcbd3664a47748a93262860321a203821/packages/excalidraw/fractionalIndex.ts#L380
import { generateNKeysBetween } from 'fractional-indexing';
const fractionalIndices = generateNKeysBetween(
    elements[lowerBoundIndex]?.index,
    elements[upperBoundIndex]?.index,
    indices.length,
) as FractionalIndex[];
```

Loro에 내장된 Tree에는 Fractional Index 알고리즘이 포함되어 있습니다. 자세한 내용은 [Movable tree CRDTs and Loro's implementation]을 참고하세요.

> Fractional Index 알고리즘을 Loro에 통합하고 movable tree와 결합하여, movable tree의 자식 노드를 정렬할 수 있게 했습니다.

[Lesson 14]에서는 `ZIndex`로 렌더링 순서를 다루려 합니다. 에디터 UI에서 이 기능은 "레이어 순서 조정", "위로 이동", "아래로 이동" 같은 모습으로 나타납니다. 따라서 `ZIndex`가 처음 추가되거나 수정될 때, 먼저 씬 그래프를 순회하며 자식 노드를 `ZIndex`로 정렬합니다. 정렬된 배열을 얻은 뒤, 바로 앞뒤의 형제 노드 두 개를 기준으로 현재 노드의 분수 인덱스를 갱신합니다.

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

이렇게 하면 렌더링 전에 분수 인덱스를 기준으로 정렬할 수 있습니다. [localeCompare]로 직접 비교할 수는 없습니다.

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

## 더 읽어보기 {#extended-reading}

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
[Lesson 14]: /ko/guide/lesson-014#z-index
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
[Lesson 6 - Coordinates]: /ko/guide/lesson-006#coordinates
[Example with perfect-cursors]: /example/perfect-cursors
[Example with framer-motion]: https://liveblocks.io/examples/overlay-comments/nextjs-comments-overlay
[Liveblocks Comments]: https://liveblocks.io/docs/ready-made-features/comments
[framer-motion]: https://www.npmjs.com/package/framer-motion
[Guide to comments in Figma]: https://help.figma.com/hc/en-us/articles/360039825314-Guide-to-comments-in-Figma
[kdbush]: https://github.com/mourner/kdbush
[supercluster]: https://github.com/mapbox/supercluster
