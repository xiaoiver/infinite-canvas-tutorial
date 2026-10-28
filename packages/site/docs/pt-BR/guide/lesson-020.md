---
outline: deep
description: 'Habilite a edição colaborativa entre vários usuários com CRDT (Conflict-free Replicated Data Types). Implemente os princípios de software local-first usando Loro, indexação fracionária e sincronização em tempo real.'
head:
    - ['meta', { property: 'og:title', content: 'Lição 20 - Colaboração' }]
---
<script setup>
import LoroCRDT from '../../components/LoroCRDT.vue';
import YjsCRDT from '../../components/YjsCRDT.vue';
import PerfectCursors from '../../components/PerfectCursors.vue';
</script>

# Lição 20 - Colaboração {#lesson-20-collaboration}

Nesta lição, vamos ver como implementar a funcionalidade de edição colaborativa entre vários usuários.

-   Classificação e implementação de CRDTs
-   Usar Loro / Yjs e [BroadcastChannel] para simular colaboração em localhost
-   Usar [liveblocks] para implementar edição colaborativa entre servidores e vários clientes
-   CRDTs com criptografia de ponta a ponta
-   Awareness e presença, incluindo cursores de vários usuários e comentários

## CRDT {#crdt}

O que é CRDT? A introdução a seguir vem de [What are CRDTs]. Os recursos colaborativos do Google Docs / Figma / Tiptap são todos implementados com base nisso. Esse artigo também compara em detalhe as características de CRDT e OT:

> CRDT (conflict-free replicated data type) é uma estrutura de dados que pode ser replicada entre vários computadores em uma rede, em que as réplicas podem ser atualizadas de forma independente e em paralelo, sem necessidade de coordenação entre as réplicas, e com a garantia de que não ocorrerão conflitos.

A imagem a seguir, de [What are CRDTs], mostra que, sob o teorema CAP, o CRDT não oferece "consistência perfeita", e sim consistência eventual. Embora a consistência em tempo real não possa ser garantida, quando dois nós sincronizam mensagens, eles voltam a um estado consistente.

![CRDT satisfaz A + P + consistência eventual; um bom compromisso sob o CAP](https://loro.dev/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fa4858e2a50bc1a2d79722060156e89b0cac5815cf25e8c67e409aa0926280cef.6a607785.png&w=3840&q=75)

[How Figma's multiplayer technology works] explica por que o Figma não escolheu OT como o Google Docs.

> Também vale notar que a estrutura de dados do Figma não é um único CRDT. Em vez disso, ela se inspira em vários CRDTs separados e os usa em combinação para criar a estrutura de dados final que representa um documento do Figma (descrita abaixo).

### Dois tipos de CRDT {#two-types-of-crdts}

Existem dois tipos de CRDT: baseados em operação (Op-based) e baseados em estado (State-based). O princípio do primeiro é que, se dois usuários executam a mesma sequência de operações, o estado final do documento também deve ser o mesmo. Para isso, cada usuário mantém todas as operações executadas sobre os dados e sincroniza essas operações com os outros usuários para garantir o estado final. O segundo exige transferir o estado inteiro entre os nós. Embora o primeiro pareça exigir menos largura de banda, já que transmite apenas descrições de operações, ele exige uma implementação complexa para garantir operações idempotentes e tratar a ordem das operações. Em comparação, a implementação do segundo é mais simples.

Agora vamos entender o CRDT baseado em estado por meio desta série de tutoriais:

-   [An Interactive Intro to CRDTs]
-   [Building a Collaborative Pixel Art Editor with CRDTs]
-   [Making CRDTs 98% More Efficient]

O tutorial apresenta uma estrutura de dados genérica para CRDT que inclui uma função de merge que precisa satisfazer associatividade, comutatividade e idempotência. Essa função de merge pode ser um registrador Last-Writer Wins (LWW), que compara o próprio timestamp com o timestamp dos dados de entrada a cada vez e atualiza os próprios dados se o timestamp dos dados de entrada for maior:

```ts
interface CRDT<T, S> {
    value: T;
    state: S;
    merge(state: S): void;
}
```

Folhas de estilo no formato chave-valor combinam bem com o registrador LWW. [Designing Data Structures for Collaborative Apps] apresenta o estilo `{bold: true}` usado pelo editor Quill.

Mais útil para o nosso cenário é [How Figma's multiplayer technology works], em que o CTO do Figma apresenta a estrutura de árvore parecida com o DOM (grafo de cena) usada internamente. Cada objeto tem um ID e um conjunto de valores de propriedade, o que pode ser visto como um mapeamento de dois níveis: `Map<ObjectID, Map<Property, Value>>`. Estratégias de merge diferentes são adotadas ao tratar propriedades de objeto, adição e exclusão de objetos, ordem e outras questões:

-   Modificar a mesma propriedade de um objeto. Por exemplo, quando dois usuários modificam o valor da propriedade do mesmo objeto de texto para AB e BC, respectivamente, o Figma não usa um algoritmo de merge para obter ABC como resultado. O resultado depende de quando o servidor recebe as mensagens.
-   Adição e exclusão de objetos. A criação de objetos usa diretamente o registrador LWW. A diferença em relação ao modelo CRDT está no comportamento ao excluir objetos: o servidor do Figma não guarda as propriedades dos objetos excluídos e deixa o cliente cuidar do armazenamento para possíveis operações de desfazer.
-   Mudanças na estrutura do grafo de cena. Os nós filhos referenciam os IDs dos nós pais por meio de propriedades, e as posições na lista de nós são implementadas com indexação fracionária. A vantagem é que mudar a posição exige atualizar apenas um valor; veja: [Realtime editing of ordered sequences]. Um defeito dessa solução, a intercalação (interleaving), também não é considerado.

### Software local-first {#local-first-software}

[Local-first software - You own your data, in spite of the cloud]

> Neste artigo propomos "software local-first": um conjunto de princípios para software que permite colaboração e propriedade para os usuários. Os ideais local-first incluem a capacidade de trabalhar offline e colaborar entre vários dispositivos, ao mesmo tempo em que melhoram a segurança, a privacidade, a preservação de longo prazo e o controle dos dados pelo usuário.

A imagem a seguir, de [The past, present, and future of local-first], mostra que essa filosofia de desenvolvimento de software e gerenciamento de dados do local-first também pode ser implementada com base em CRDT.

![História do local-first](/local-first-history.png)

[How Figma's multiplayer technology works]

> O Figma permite que você fique offline por um tempo arbitrário e continue editando. Quando você volta a ficar online, o cliente baixa uma cópia atualizada do documento, reaplica as edições offline sobre esse estado mais recente e então continua sincronizando as atualizações por uma nova conexão WebSocket.

Editores de rich text e editores de código também oferecem suporte a isso; veja [TipTap offline support] e [The Full Spectrum of Collaboration].

### Implementação de CRDTs {#implementation-of-crdts}

O Y.js e suas adaptações para outras linguagens são, sem dúvida, as implementações de CRDT mais conhecidas. O texto a seguir vem de <https://tiptap.dev/docs/collaboration/getting-started/overview#about-yjs>

> Como CRDT, o Y.js garante que a sequência de mudanças não afete o estado final do documento, de forma parecida com o modo como o Git opera com commits. Isso garante que todas as cópias dos dados permaneçam consistentes em ambientes diferentes.

Como não precisamos lidar com a mesclagem de texto ou rich text em estados colaborativos, bastam estruturas de dados simples para armazenar o estado da tela, como [Y.Map]. Outras implementações de CRDT também oferecem APIs parecidas, por exemplo:

-   O Liveblocks oferece `LiveObject/List/Map`; veja: [Data Structures in Liveblocks]
-   O Automerge oferece [Simple Values], com suporte a todos os tipos legais em JSON, inclusive `Date`
-   O Loro também oferece [Map]

## Simular com BroadcastChannel {#simulate-with-broadcast-channel}

Agora vamos seguir [Loro Excalidraw Example] e [dgmjs-plugin-yjs] e usar o recurso do [BroadcastChannel] de permitir comunicação entre várias abas da mesma origem para simular o efeito de vários usuários colaborando.

### Exemplo com Loro {#example-with-loro}

No Excalidraw, dá para usar o hook `onChange` para observar mudanças em todas as formas da cena:

```tsx
<Excalidraw
    onChange={(elements) => {
        const v = getVersion(elements);
    }}
/>
```

Quando os registros de histórico mudam, invocamos esse hook:

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

Seguindo [Excalidraw updateScene], também podemos oferecer um método `updateNodes` para atualizar o grafo de cena.

```ts
api.updateNodes(nodes);
```

Abaixo, usamos o Loro como exemplo para simular o efeito de vários usuários colaborando na edição. Aproveitamos o recurso [BroadcastChannel] para permitir a comunicação entre várias abas da mesma origem. Sempre que o conteúdo da tela muda, uma mensagem é enviada às outras páginas. Ao receber uma mensagem de outra página, a sincronização é concluída. Portanto, cada página precisa atuar ao mesmo tempo como emissora e receptora de mensagens.

Primeiro, vamos examinar a implementação do código do receptor de mensagens. Primeiro, crie uma instância de [LoroDoc]. Use uma estrutura [List] para armazenar a lista de gráficos. Ao receber uma mensagem, importe os dados para o LoroDoc. Como referência, veja [Exporting and Importing].

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

Em seguida, depois de converter `docNodes` em um objeto JavaScript, chame a API Canvas `updateNodes` para concluir a atualização da cena:

```ts
doc.subscribe((e) => {
    if (e.by !== 'local') {
        api.updateNodes(docNodes.toJSON());
    }
});
```

Agora vamos examinar a implementação do lado que envia mensagens. Ao assinar as mudanças do grafo de cena da tela pelo hook `onchange`, as mudanças são registradas no documento e enviadas. Isso dispara a atualização de cena anterior nas outras janelas:

```ts
api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
    if (recordLocalOps(docElements, nodes)) {
        doc.commit();
    }
};
```

Durante o envio das mudanças locais:

```ts
function recordLocalOps(
    loroList: LoroList,
    nodes: readonly { version?: number; isDeleted?: boolean }[],
): boolean {
    nodes = nodes.filter((e) => !e.isDeleted); // 首先排除掉被删除的图形
}
```

No exemplo abaixo, você pode arrastar, redimensionar ou mudar a cor do retângulo livremente na janela da esquerda ou da direita, e a outra janela sincroniza essas modificações: [Example with Loro]

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<LoroCRDT />
</div>
<div style="flex: 1;">
<LoroCRDT />
</div>
</div>

### Exemplo com Yjs {#example-with-yjs}

Primeiro, observe as mudanças da tela local e sincronize a lista de formas e os objetos de propriedade delas com o `Y.Doc` local:

```ts
api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
    doc.transact(() => {
        // 写入 Y.Doc
    }, local);
};
```

Depois, escute as mudanças do `Y.Doc`, distinguindo mudanças locais e remotas por meio de `origin`. Se a mudança se origina localmente, envie uma mensagem de sincronização; se se origina remotamente, atualize o conteúdo da tela.

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

## Usar o Liveblocks como backend {#use-liveblocks-as-backend}

A implementação baseada em BroadcastChannel acima é, no fim das contas, apenas um exemplo simples. Em seguida, vamos implementar um exemplo mais prático com [liveblocks] e Yjs.

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

Você pode abrir este exemplo em várias janelas do navegador: [Example with Liveblocks]

![Colaboração entre várias janelas](/liveblocks.gif)

## Suporte offline com IndexedDB {#offline-support-with-indexeddb}

Ao criar uma sala, o [liveblocks] também oferece a opção de configuração `offlineSupport_experimental` para ativar a funcionalidade offline com praticidade:

> Ative o suporte offline usando IndexedDB. Isso significa que, depois do primeiro carregamento, os documentos são armazenados localmente e carregam na hora.

```ts
import { getYjsProviderForRoom } from '@liveblocks/yjs';

const yProvider = getYjsProviderForRoom(room, {
    offlineSupport_experimental: true,
});
```

## Criptografia de ponta a ponta {#end-to-end-encryption}

Agora dá para armazenar documentos como CRDTs e usar algum tipo de servidor de sincronização para mesclar atualizações e encaminhá-las, garantindo que esse arquivo permaneça privado.

No artigo [End-to-End Encryption in the Browser], o Excalidraw apresenta uma abordagem simples de criptografia de ponta a ponta que permite a comunicação entre vários clientes e impede o servidor de ler o conteúdo. Os dados criptografados ficam na parte de hash do link, que o servidor não consegue ler, e são decodificados apenas no lado do cliente: <https://excalidraw.com/#json=5645858175451136,8w-G0ZXiOfRYAn7VWpANxw>

Em seguida, vamos analisar como o Excalidraw usa a Web Crypto API para implementar a funcionalidade.

### Gerar chave {#generate-key}

Use a API [generateKey] para selecionar o algoritmo [AES-GCM] e gerar uma chave aleatória. O parâmetro `extractable` indica que a chave pode ser exportada depois em um formato portável externamente pela API [exportKey]. Por exemplo, aqui selecionamos o formato [JSON Web Key] `‘jwk’`:

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

### Criptografar e descriptografar dados {#encrypt-decrypt-data}

Primeiro, gere números aleatórios criptograficamente seguros:

```ts
export const createIV = () => {
    const arr = new Uint8Array(IV_LENGTH_BYTES);
    return window.crypto.getRandomValues(arr);
};
```

Depois, use essa chave privada para criptografar os dados serializados da cena e envie-os do cliente para um armazenamento em nuvem como [firestore] ou AWS S3:

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

### Criptografia homomórfica de CRDT {#homomorphically-encrypting-crdt}

[Homomorphically Encrypting CRDTs]

## Awareness e presença {#awareness-presence}

O Yjs oferece um recurso de [Awareness & Presence] para compartilhar a posição do cursor e informações de status, permitindo que os usuários percebam a presença dos outros participantes da colaboração. Essa informação não é armazenada nos documentos do Yjs, porque não precisa persistir entre sessões. Ainda assim, ela pode ser propagada a todos os usuários como um objeto JSON, e os usuários removem o próprio status quando ficam offline.

![fonte: https://liveblocks.io/docs/ready-made-features/presence#Examples-using-Presence](https://liveblocks.io/_next/image?url=%2Fimages%2Fexamples%2Fthumbnails%2Flive-cursors-chat.jpg&w=828&q=90)

### Usar o Liveblocks como backend {#backend}

Como implementação de Provider para o Yjs, o [liveblocks] também oferece o recurso Presence na API Room. Dá para escutar eventos `pointermove` na tela e transmiti-los com [updatePresence]. Você precisa converter para o sistema de coordenadas de mundo antes de salvar. Para detalhes, veja [Lição 6 - Coordenadas]:

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

Isso permite que os clientes assinem as mudanças de status dos outros usuários, usadas para renderizar as posições do mouse. Aqui, a posição do mouse precisa ser convertida do sistema de coordenadas de mundo para o sistema de coordenadas do viewport:

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

É claro que dá para reduzir a frequência de atualização por meio de throttling. Afinal, não há uma necessidade real de exibir as posições do mouse dos outros "em tempo real". Mas isso levanta a questão seguinte.

```ts
const client = createClient({
    throttle: 16, // [!code ++]
    publicApiKey:
        'pk_dev_MYcFNShiwPwRDvuvhklopMg6SAkdASzz6QrOMQIlu86NkcuXVNxP06aXrxi9qo7M',
});
```

### Renderizar cursores suavemente {#smoothly-rendering-cursors}

[How to animate multiplayer cursors] mostra como os outros usuários percebem o cursor do mouse engasgando depois que o throttling reduz a frequência de atualização, parecido com derrubar a taxa de atualização de 60 FPS para 20 FPS.

![Cursor com engasgos](/jank-cursor.gif)

A solução é fazer o mouse se mover suavemente entre posições adjacentes, em vez de em degraus. Felizmente, o tldraw oferece o recurso [perfect-cursors], que cuida de tudo isso para nós.

[Example with perfect-cursors]

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<PerfectCursors />
</div>
<div style="flex: 1;">
<PerfectCursors />
</div>
</div>

Além disso, dá para usar [framer-motion], que oferece suporte a sintaxe declarativa (compatível com React/Vue) e emprega a função de easing Spring embutida para obter efeitos parecidos. Para detalhes, veja: [Example with framer-motion].

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

## Sobreposição de comentários {#comments-overlay}

Em cenários de edição colaborativa, o chat em tempo real e os comentários são essenciais. No Figma, os balões de comentário podem ser colocados em qualquer lugar da tela. Além disso, em níveis baixos de zoom, os comentários são agregados para dar uma visão geral do agrupamento de comentários. Conforme o nível de zoom aumenta, aparecem agrupamentos mais detalhados, até revelar a distribuição de cada balão de comentário individual. Para detalhes, veja: [Guide to comments in Figma].

![Comentários no Figma](https://help.figma.com/hc/article_attachments/31566555250071)

### Estrutura de dados {#data-structure}

Em seguida, vamos implementar uma funcionalidade parecida com base em [Liveblocks Comments]. Primeiro, vamos examinar a estrutura de dados: Thread e Comment mantêm uma relação de um para muitos.

![fonte: https://liveblocks.io/docs/ready-made-features/comments/concepts#Threads](https://liveblocks.io/_next/image?url=%2Fassets%2Fcomments%2Fcomment-thread-room-relation-dark.jpg&w=1920&q=100)

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

### Agrupamento {#cluster}

Nos cenários de agregação de pontos acima, precisamos enfrentar dois desafios principais:

1. Como agregar? Dado um ponto, como encontrar todos os pontos dentro de um raio especificado centrado nesse ponto?
2. Depois da agregação, dada uma caixa delimitadora (por exemplo, o viewport atual), como localizar todas as features agregadas contidas nela?

Para esses dois problemas (consultas por raio e por intervalo), percorrer cada ponto por força bruta é inerentemente ineficiente ao lidar com conjuntos enormes de pontos. Para obter uma busca eficiente, é preciso usar índices espaciais como [kdbush]. Embora não estejamos em um contexto de GIS, ainda dá para tirar inspiração da implementação de [supercluster].

Em cenários de agregação de pontos, os nós da árvore k-d contêm não só as features Point originais, mas também conjuntos de pontos agregados. Estes últimos exigem um ponto central agregado, cuja estrutura de dados é a seguinte:

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

Durante a fase de criação do índice, precisamos construir uma árvore k-d para cada nível de zoom:

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

Agregar pontos dentro de um intervalo especificado exige tratar duas questões:

1. Consultar todos os vizinhos dentro de um raio dado usando o raio de uma árvore k-d. O método `within` oferecido pelo kdbush serve a esse propósito.
2. Gerar as coordenadas do ponto agregado a partir das coordenadas dos pontos dentro do intervalo, ponderadas pelo número de pontos contido em cada subconjunto.

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

### Exibir agrupamentos {#display-clusters}

Consulte os pontos agregados dentro do intervalo do viewport:

```ts
const { cameraZoom } = this.api.getAppState();
const { minX, minY, maxX, maxY } = this.api.getViewportBounds();
this.clusters = this.cluster.getClusters([minX, minY, maxX, maxY], cameraZoom);
```

![Comentários em agrupamento](/comments-cluster.gif)

## fractional-indexing {#fractional-indexing}

Como mencionado antes, o grafo de cena pode ser visto como uma "árvore móvel", com conflitos possíveis em três cenários: adição, exclusão e movimentação. [Movable tree CRDTs and Loro's implementation] detalha a abordagem de implementação do Loro para esses três cenários. Por exemplo, ao excluir e mover o mesmo nó, os dois resultados são aceitáveis, dependendo da ordem em que o servidor recebe as mensagens. Porém, alguns cenários de operação podem criar ciclos depois da sincronização, como quando dois usuários executam as operações `B -> C` e `C -> B`, respectivamente, quebrando a definição estrutural da árvore.

![Exclusão e movimentação do mesmo nó](https://loro.dev/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fmove-delete-dark.17378273.png&w=3840&q=75)

```ts
import { Loro, LoroTree, LoroTreeNode } from 'loro-crdt';

let doc = new Loro();
let tree: LoroTree = doc.getTree('tree');
let root: LoroTreeNode = tree.createNode();
```

[Realtime editing of ordered sequences] apresenta como o Figma usa [fractional-indexing] para refletir as posições dos elementos no grafo de cena.

![Um exemplo de sequência de objetos sendo editados](https://cdn.sanity.io/images/599r6htc/regionalized/dc3ac373a86b1d25629d651e2b75100dc3d9fbb9-1400x1144.png?w=804&q=75&fit=max&auto=format&dpr=2)

O Excalidraw também usa a mesma implementação:

```ts
// @see https://github.com/excalidraw/excalidraw/blob/9ee0b8ffcbd3664a47748a93262860321a203821/packages/excalidraw/fractionalIndex.ts#L380
import { generateNKeysBetween } from 'fractional-indexing';
const fractionalIndices = generateNKeysBetween(
    elements[lowerBoundIndex]?.index,
    elements[upperBoundIndex]?.index,
    indices.length,
) as FractionalIndex[];
```

A Tree embutida do Loro inclui o algoritmo de índice fracionário; veja: [Movable tree CRDTs and Loro's implementation].

> Integramos o algoritmo Fractional Index ao Loro e o combinamos com a árvore móvel, tornando os nós filhos da árvore móvel ordenáveis.

Na [Lição 14], o objetivo é manipular a ordem de renderização por meio de `ZIndex`. Na interface do editor, essa funcionalidade aparece como recursos como "Ajustar ordem da camada", "Mover para cima" e "Mover para baixo". Portanto, quando `ZIndex` é adicionado pela primeira vez ou modificado, primeiro percorremos o grafo de cena, ordenando os nós filhos por `ZIndex`. Depois de obter o array ordenado, atualizamos o índice fracionário do nó atual com base nos dois nós irmãos imediatos.

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

Isso permite ordenar com base nos índices fracionários antes da renderização. Vale observar que não dá para usar [localeCompare] diretamente na comparação:

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

## Leitura adicional {#extended-reading}

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
[Lição 14]: /pt-BR/guide/lesson-014#z-index
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
[Lição 6 - Coordenadas]: /pt-BR/guide/lesson-006#coordinates
[Example with perfect-cursors]: /example/perfect-cursors
[Example with framer-motion]: https://liveblocks.io/examples/overlay-comments/nextjs-comments-overlay
[Liveblocks Comments]: https://liveblocks.io/docs/ready-made-features/comments
[framer-motion]: https://www.npmjs.com/package/framer-motion
[Guide to comments in Figma]: https://help.figma.com/hc/en-us/articles/360039825314-Guide-to-comments-in-Figma
[kdbush]: https://github.com/mourner/kdbush
[supercluster]: https://github.com/mapbox/supercluster
