---
outline: deep
description: 'Habilita la edición colaborativa entre varios usuarios con CRDT (tipos de datos replicados libres de conflictos). Implementa los principios del software local-first con Loro, la indexación fraccionaria y la sincronización en tiempo real.'
head:
    - ['meta', { property: 'og:title', content: 'Lección 20 - Colaboración' }]
---
<script setup>
import LoroCRDT from '../../components/LoroCRDT.vue';
import YjsCRDT from '../../components/YjsCRDT.vue';
import PerfectCursors from '../../components/PerfectCursors.vue';
</script>

# Lección 20 - Colaboración {#lesson-20-collaboration}

En esta lección veremos cómo implementar la funcionalidad de edición colaborativa entre varios usuarios.

-   Clasificación e implementación de los CRDT
-   Uso de Loro / Yjs y [BroadcastChannel] para simular la colaboración en localhost
-   Uso de [liveblocks] para implementar la edición colaborativa entre servidores y varios clientes
-   CRDT cifrados de extremo a extremo
-   Awareness y presencia, incluidos los cursores multijugador y los comentarios

## CRDT {#crdt}

¿Qué es un CRDT? La introducción siguiente procede de [Qué son los CRDT]. Las funciones colaborativas de Google Docs / Figma / Tiptap se implementan a partir de él. Este artículo también compara con detalle las características de CRDT y OT:

> Un CRDT (tipo de datos replicado libre de conflictos, conflict-free replicated data type) es una estructura de datos que se puede replicar en varias computadoras de una red, donde las réplicas pueden actualizarse de forma independiente y en paralelo, sin necesidad de coordinación entre ellas, y con la garantía de que no se producirán conflictos.

La imagen siguiente, de [Qué son los CRDT], muestra que, según el teorema CAP, el CRDT no ofrece una «consistencia perfecta», sino consistencia eventual. Aunque no se puede garantizar la consistencia en tiempo real, cuando dos nodos sincronizan los mensajes vuelven a un estado consistente.

![El CRDT satisface A + P + consistencia eventual; un buen equilibrio bajo CAP](https://loro.dev/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fa4858e2a50bc1a2d79722060156e89b0cac5815cf25e8c67e409aa0926280cef.6a607785.png&w=3840&q=75)

[Cómo funciona la tecnología multijugador de Figma] explica por qué Figma no eligió OT, como hizo Google Docs.

> También merece la pena señalar que la estructura de datos de Figma no es un único CRDT. En su lugar, se inspira en varios CRDT distintos y los usa en combinación para crear la estructura de datos final que representa un documento de Figma (descrita más abajo).

### Dos tipos de CRDT {#two-types-of-crdts}

Hay dos tipos de CRDT: basados en operaciones (Op-based) y basados en estado (State-based). El principio de los primeros es que, si dos usuarios ejecutan la misma secuencia de operaciones, el estado final del documento también debe ser el mismo. Para conseguirlo, cada usuario conserva todas las operaciones ejecutadas sobre los datos y sincroniza esas operaciones con los demás usuarios para asegurar el estado final. Los segundos exigen transferir el estado completo entre nodos. Aunque los primeros parecen necesitar menos ancho de banda, porque solo transmiten descripciones de operaciones, su implementación es compleja para garantizar operaciones idempotentes y tratar los problemas de orden. En comparación, la implementación de los segundos es más sencilla.

Entendamos ahora el CRDT basado en estado a través de esta serie de tutoriales:

-   [Una introducción interactiva a los CRDT]
-   [Construir un editor colaborativo de pixel art con CRDT]
-   [Hacer los CRDT un 98 % más eficientes]

El tutorial ofrece una estructura de datos genérica para un CRDT que incluye una función de mezcla que debe cumplir la asociatividad, la conmutatividad y la idempotencia. Esta función de mezcla puede ser un registro de última escritura gana (Last-Writer Wins, LWW), que cada vez compara su propia marca de tiempo con la de los datos de entrada y actualiza sus propios datos si la marca de tiempo de la entrada es mayor:

```ts
interface CRDT<T, S> {
    value: T;
    state: S;
    merge(state: S): void;
}
```

Las hojas de estilo de tipo clave-valor encajan bien con el registro LWW. [Diseñar estructuras de datos para aplicaciones colaborativas] presenta el estilo `{bold: true}` que usa el editor Quill.

Más útil para nuestro escenario es [Cómo funciona la tecnología multijugador de Figma], donde el CTO de Figma presenta la estructura de árbol parecida al DOM (grafo de escena) que se usa internamente. Cada objeto tiene un ID y un conjunto de valores de propiedades, que se puede ver como una correspondencia de dos niveles: `Map<ObjectID, Map<Property, Value>>`. Se adoptan distintas estrategias de mezcla al tratar las propiedades de los objetos, la adición y eliminación de objetos, el orden y otras cuestiones:

-   Modificar la misma propiedad de un objeto. Por ejemplo, cuando dos usuarios modifican el valor de la propiedad del mismo objeto de texto a AB y BC respectivamente, Figma no usa un algoritmo de mezcla para obtener ABC como resultado, sino que depende de cuándo recibe el servidor los mensajes.
-   Adición y eliminación de objetos. Crear objetos usa directamente el registro LWW. La diferencia con el modelo CRDT está en el comportamiento al eliminar objetos: el servidor de Figma no guarda las propiedades de los objetos eliminados y deja que el cliente se ocupe del almacenamiento para posibles operaciones de deshacer.
-   Cambios en la estructura del grafo de escena. Los nodos hijo referencian los ID de los nodos padre mediante propiedades, y las posiciones en la lista de nodos se implementan con indexación fraccionaria. La ventaja es que cambiar de posición solo exige actualizar un valor; consulta [Edición en tiempo real de secuencias ordenadas]. Un defecto de esta solución, el intercalado (interleaving), tampoco se tiene en cuenta.

### Software local-first {#local-first-software}

[Software local-first: tus datos son tuyos, a pesar de la nube]

> En este artículo proponemos el «software local-first»: un conjunto de principios para un software que permite a los usuarios tanto la colaboración como la propiedad. Los ideales local-first incluyen la capacidad de trabajar sin conexión y colaborar entre varios dispositivos, y al mismo tiempo mejoran la seguridad, la privacidad, la conservación a largo plazo y el control de los datos por parte del usuario.

La imagen siguiente, de [El pasado, el presente y el futuro de local-first], muestra que esta filosofía de desarrollo de software y de gestión de datos, local-first, también se puede implementar a partir de CRDT.

![Historia de local-first](/local-first-history.png)

[Cómo funciona la tecnología multijugador de Figma]

> Figma te permite quedarte sin conexión durante un tiempo arbitrario y seguir editando. Cuando vuelves a estar en línea, el cliente descarga una copia reciente del documento, vuelve a aplicar las ediciones hechas sin conexión sobre este estado más reciente y después sigue sincronizando las actualizaciones por una nueva conexión WebSocket.

Los editores de texto enriquecido y los editores de código también admiten esto; consulta [Soporte sin conexión de TipTap] y [El espectro completo de la colaboración].

### Implementación de los CRDT {#implementation-of-crdts}

Y.js y sus adaptaciones a otros lenguajes son, sin duda, las implementaciones de CRDT más conocidas. El texto siguiente procede de <https://tiptap.dev/docs/collaboration/getting-started/overview#about-yjs>

> Como CRDT, Y.js garantiza que la secuencia de los cambios no afecta al estado final del documento, de forma parecida a cómo Git funciona con los commits. Esto garantiza que todas las copias de los datos permanezcan consistentes en distintos entornos.

Como no necesitamos ocuparnos de mezclar texto o texto enriquecido en estados colaborativos, solo hacen falta estructuras de datos sencillas para almacenar el estado del lienzo, como [Y.Map]. Otras implementaciones de CRDT también ofrecen API parecidas, por ejemplo:

-   Liveblocks ofrece `LiveObject/List/Map`; consulta [Estructuras de datos en Liveblocks]
-   Automerge ofrece [Valores simples], con todos los tipos legales de JSON, incluso `Date`
-   Loro también ofrece [Map]

## Simular con BroadcastChannel {#simulate-with-broadcast-channel}

Ahora tomemos como referencia [Ejemplo de Excalidraw con Loro] y [dgmjs-plugin-yjs], y usemos la capacidad de [BroadcastChannel] de comunicar varias pestañas del mismo origen para simular el efecto de varios usuarios colaborando.

### Ejemplo con Loro {#example-with-loro}

En Excalidraw puedes usar el hook `onChange` para observar los cambios de todas las formas de la escena:

```tsx
<Excalidraw
    onChange={(elements) => {
        const v = getVersion(elements);
    }}
/>
```

Cuando los registros del historial cambian, invocamos este hook:

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

Tomando como referencia [updateScene de Excalidraw], también podemos ofrecer un método `updateNodes` para actualizar el grafo de escena.

```ts
api.updateNodes(nodes);
```

A continuación usamos Loro como ejemplo para simular el efecto de varios usuarios colaborando en la edición. Aprovechamos la función [BroadcastChannel] para permitir la comunicación entre varias pestañas del mismo origen. Cada vez que cambia el contenido del lienzo, se envía un mensaje a las demás páginas. Al recibir un mensaje de otra página, se completa la sincronización. Por tanto, cada página debe actuar al mismo tiempo como emisora y como receptora de mensajes.

Veamos primero la implementación del código del receptor de mensajes. Primero se crea una instancia de [LoroDoc]. Se usa una estructura [List] para almacenar la lista de gráficos. Al recibir un mensaje, se importan los datos en el LoroDoc. Como referencia, consulta [Exportar e importar].

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

Además, después de convertir `docNodes` en un objeto de JavaScript, se llama a la API del lienzo `updateNodes` para completar la actualización de la escena:

```ts
doc.subscribe((e) => {
    if (e.by !== 'local') {
        api.updateNodes(docNodes.toJSON());
    }
});
```

Veamos ahora la implementación del lado que envía los mensajes. Al suscribirse a los cambios del grafo de escena del lienzo mediante el hook `onchange`, los cambios se registran en el documento y se envían. Esto dispara la actualización de escena anterior en las otras ventanas:

```ts
api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
    if (recordLocalOps(docElements, nodes)) {
        doc.commit();
    }
};
```

Durante el envío de los cambios locales:

```ts
function recordLocalOps(
    loroList: LoroList,
    nodes: readonly { version?: number; isDeleted?: boolean }[],
): boolean {
    nodes = nodes.filter((e) => !e.isDeleted); // 首先排除掉被删除的图形
}
```

En el ejemplo de abajo puedes arrastrar, cambiar el tamaño o cambiar el color del rectángulo con libertad en la ventana izquierda o en la derecha, y la otra ventana sincronizará esas modificaciones: [Ejemplo con Loro]

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<LoroCRDT />
</div>
<div style="flex: 1;">
<LoroCRDT />
</div>
</div>

### Ejemplo con Yjs {#example-with-yjs}

Primero se observan los cambios del lienzo local y se sincronizan la lista de formas y sus objetos de propiedades con el `Y.Doc` local:

```ts
api.onchange = (snapshot) => {
    const { appState, nodes } = snapshot;
    doc.transact(() => {
        // 写入 Y.Doc
    }, local);
};
```

Después se escuchan los cambios de `Y.Doc`, distinguiendo los cambios locales de los remotos mediante `origin`. Si el cambio se origina en local, se envía un mensaje de sincronización; si se origina en remoto, se actualiza el contenido del lienzo.

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

[Ejemplo con Yjs]

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<YjsCRDT />
</div>
<div style="flex: 1;">
<YjsCRDT />
</div>
</div>

## Usar Liveblocks como backend {#use-liveblocks-as-backend}

La implementación basada en BroadcastChannel de arriba, al fin y al cabo, es solo un ejemplo sencillo. A continuación implementaremos un ejemplo más práctico con [liveblocks] e Yjs.

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

Puedes abrir este ejemplo en varias ventanas del navegador: [Ejemplo con Liveblocks]

![Colaboración entre varias ventanas](/liveblocks.gif)

## Soporte sin conexión con IndexedDB {#offline-support-with-indexeddb}

Al crear una sala, [liveblocks] también ofrece la opción de configuración `offlineSupport_experimental` para activar con comodidad la funcionalidad sin conexión:

> Activa el soporte sin conexión con IndexedDB. Esto significa que, después de la primera carga, los documentos se almacenan en local y se cargan al instante.

```ts
import { getYjsProviderForRoom } from '@liveblocks/yjs';

const yProvider = getYjsProviderForRoom(room, {
    offlineSupport_experimental: true,
});
```

## Cifrado de extremo a extremo {#end-to-end-encryption}

Ahora podemos almacenar los documentos como CRDT y usar algún tipo de servidor de sincronización para mezclar las actualizaciones y reenviarlas, asegurando al mismo tiempo que este archivo siga siendo privado.

En el artículo [Cifrado de extremo a extremo en el navegador], Excalidraw presenta un enfoque sencillo de cifrado de extremo a extremo que permite la comunicación entre distintos clientes e impide que el servidor lea el contenido. Los datos cifrados se colocan en la parte del hash del enlace, que el servidor no puede leer, y solo se descodifican en el lado del cliente: <https://excalidraw.com/#json=5645858175451136,8w-G0ZXiOfRYAn7VWpANxw>

A continuación analizaremos cómo Excalidraw usa la API Web Crypto para implementar su funcionalidad.

### Generar la clave {#generate-key}

Usa la API [generateKey] para elegir el algoritmo [AES-GCM] y generar una clave aleatoria. El parámetro `extractable` indica que la clave se puede exportar más adelante en un formato portable externamente mediante la API [exportKey]. Por ejemplo, aquí elegimos el formato [JSON Web Key] `‘jwk’`:

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

### Cifrar y descifrar datos {#encrypt-decrypt-data}

Primero se generan números aleatorios criptográficamente seguros:

```ts
export const createIV = () => {
    const arr = new Uint8Array(IV_LENGTH_BYTES);
    return window.crypto.getRandomValues(arr);
};
```

Después se usa esta clave privada para cifrar los datos serializados de la escena y subirlos desde el cliente a un almacenamiento en la nube como [firestore] o AWS S3:

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

### Cifrado homomórfico de CRDT {#homomorphically-encrypting-crdt}

[Cifrado homomórfico de CRDT]

## Awareness y presencia {#awareness-presence}

Yjs ofrece una función de [Awareness y presencia] para compartir la posición del cursor y la información de estado, de modo que los usuarios perciban la presencia de los demás participantes de la colaboración. Esta información no se almacena dentro de los documentos de Yjs, porque no necesita persistir entre sesiones. Sin embargo, se puede propagar a todos los usuarios como un objeto JSON, y los usuarios retiran su propio estado cuando se desconectan.

![fuente: https://liveblocks.io/docs/ready-made-features/presence#Examples-using-Presence](https://liveblocks.io/_next/image?url=%2Fimages%2Fexamples%2Fthumbnails%2Flive-cursors-chat.jpg&w=828&q=90)

### Usar Liveblocks como backend {#backend}

Como implementación de Provider para Yjs, [liveblocks] también ofrece la función Presence en la API Room. Podemos escuchar los eventos `pointermove` del lienzo y difundirlos con [updatePresence]. Es importante convertir al sistema de coordenadas de mundo antes de guardar. Para más detalles, consulta [Lección 6 - Coordenadas]:

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

Esto permite a los clientes suscribirse a los cambios de estado de los demás usuarios, que se usan para renderizar las posiciones de su ratón. Aquí, la posición del ratón hay que convertirla del sistema de coordenadas de mundo al sistema de coordenadas del viewport:

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

Por supuesto, podemos reducir la frecuencia de actualización mediante el throttling: al fin y al cabo, no hace falta mostrar las posiciones del ratón de los demás en «tiempo real». Pero esto plantea la cuestión siguiente.

```ts
const client = createClient({
    throttle: 16, // [!code ++]
    publicApiKey:
        'pk_dev_MYcFNShiwPwRDvuvhklopMg6SAkdASzz6QrOMQIlu86NkcuXVNxP06aXrxi9qo7M',
});
```

### Renderizar cursores con suavidad {#smoothly-rendering-cursors}

[Cómo animar cursores multijugador] muestra cómo los demás usuarios perciben un cursor del ratón entrecortado cuando el throttling reduce la frecuencia de actualización, algo parecido a bajar la tasa de refresco de 60 FPS a 20 FPS.

![Cursor entrecortado](/jank-cursor.gif)

La solución consiste en hacer que el ratón se mueva con suavidad entre posiciones adyacentes, en lugar de a saltos. Por suerte, tldraw ofrece la función [perfect-cursors], que se ocupa de todo esto por nosotros.

[Ejemplo con perfect-cursors]

<div style="display:flex;flex-direction:row;">
<div style="flex: 1;">
<PerfectCursors />
</div>
<div style="flex: 1;">
<PerfectCursors />
</div>
</div>

Además, podemos usar [framer-motion], que admite sintaxis declarativa (compatible con React/Vue) y emplea su función de suavizado Spring integrada para conseguir efectos parecidos. Para más detalles, consulta [Ejemplo con framer-motion].

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

## Superposición de comentarios {#comments-overlay}

En los escenarios de edición colaborativa, el chat en tiempo real y los comentarios son cruciales. Dentro de Figma, las burbujas de comentarios se pueden colocar en cualquier lugar del lienzo. Además, con niveles de zoom bajos, los comentarios se agregan para ofrecer una visión general del clúster de comentarios. A medida que aumenta el nivel de zoom, aparecen clústeres más finos y, al final, se revela la distribución de cada burbuja de comentario individual. Para más detalles, consulta [Guía de comentarios en Figma].

![Comentarios en Figma](https://help.figma.com/hc/article_attachments/31566555250071)

### Estructura de datos {#data-structure}

A continuación implementaremos una funcionalidad parecida a partir de [Comentarios de Liveblocks]. Veamos primero la estructura de datos: Thread y Comment mantienen una relación de uno a muchos.

![fuente: https://liveblocks.io/docs/ready-made-features/comments/concepts#Threads](https://liveblocks.io/_next/image?url=%2Fassets%2Fcomments%2Fcomment-thread-room-relation-dark.jpg&w=1920&q=100)

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

### Clúster {#cluster}

En los escenarios de agregación de puntos anteriores hay que resolver dos retos clave:

1. ¿Cómo agregar? Dado un punto, ¿cómo encontramos todos los puntos dentro de un radio indicado, centrado en ese punto?
2. Después de agregar, dada una caja delimitadora (por ejemplo, el viewport actual), ¿cómo localizamos todos los elementos agregados que contiene?

Para estos dos problemas (consultas por radio y por rango), recorrer cada punto por fuerza bruta es ineficiente por naturaleza cuando se trata de conjuntos enormes de puntos. Para conseguir una búsqueda eficiente hay que emplear índices espaciales como [kdbush]. Aunque no estamos en un contexto GIS, podemos inspirarnos en la implementación de [supercluster].

En los escenarios de agregación de puntos, los nodos del árbol k-d contienen no solo los elementos Point originales, sino también conjuntos de puntos agregados. Estos últimos necesitan un punto central agregado, cuya estructura de datos es la siguiente:

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

Durante la fase de creación del índice hay que construir un árbol k-d para cada nivel de zoom:

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

Agregar puntos dentro de un rango indicado exige resolver dos cuestiones:

1. Consultar todos los vecinos dentro de un radio dado usando el radio de un árbol k-d. El método `within` que ofrece kdbush sirve para esto.
2. Generar las coordenadas del punto agregado a partir de las coordenadas de los puntos del rango, ponderadas por el número de puntos que contiene cada subconjunto.

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

### Mostrar los clústeres {#display-clusters}

Consulta los puntos agregados dentro del rango del viewport:

```ts
const { cameraZoom } = this.api.getAppState();
const { minX, minY, maxX, maxY } = this.api.getViewportBounds();
this.clusters = this.cluster.getClusters([minX, minY, maxX, maxY], cameraZoom);
```

![Comentarios en clúster](/comments-cluster.gif)

## Indexación fraccionaria {#fractional-indexing}

Como ya se dijo, el grafo de escena se puede ver como un «árbol móvil» (movable tree), y los conflictos posibles incluyen tres escenarios: adición, eliminación y movimiento. [CRDT de árboles móviles y la implementación de Loro] detalla el enfoque de implementación de Loro para estos tres escenarios. Por ejemplo, al eliminar y mover el mismo nodo, ambos resultados son aceptables, según el orden en el que el servidor recibe los mensajes. Sin embargo, algunos escenarios de operaciones pueden crear ciclos después de la sincronización, como cuando dos usuarios realizan respectivamente las operaciones `B -> C` y `C -> B`, y rompen la definición estructural del árbol.

![Eliminación y movimiento del mismo nodo](https://loro.dev/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fmove-delete-dark.17378273.png&w=3840&q=75)

```ts
import { Loro, LoroTree, LoroTreeNode } from 'loro-crdt';

let doc = new Loro();
let tree: LoroTree = doc.getTree('tree');
let root: LoroTreeNode = tree.createNode();
```

[Edición en tiempo real de secuencias ordenadas] presenta cómo Figma usa [fractional-indexing] para reflejar las posiciones de los elementos en el grafo de escena.

![Ejemplo de una secuencia de objetos en edición](https://cdn.sanity.io/images/599r6htc/regionalized/dc3ac373a86b1d25629d651e2b75100dc3d9fbb9-1400x1144.png?w=804&q=75&fit=max&auto=format&dpr=2)

Excalidraw también usa la misma implementación:

```ts
// @see https://github.com/excalidraw/excalidraw/blob/9ee0b8ffcbd3664a47748a93262860321a203821/packages/excalidraw/fractionalIndex.ts#L380
import { generateNKeysBetween } from 'fractional-indexing';
const fractionalIndices = generateNKeysBetween(
    elements[lowerBoundIndex]?.index,
    elements[upperBoundIndex]?.index,
    indices.length,
) as FractionalIndex[];
```

El Tree integrado de Loro incluye el algoritmo Fractional Index; consulta [CRDT de árboles móviles y la implementación de Loro].

> Integramos el algoritmo Fractional Index en Loro y lo combinamos con el árbol móvil, de modo que los nodos hijo del árbol móvil se pueden ordenar.

En la [Lección 14] buscamos manipular el orden de renderizado mediante `ZIndex`. En la interfaz del editor, esta funcionalidad se manifiesta como funciones del tipo «Ajustar el orden de las capas», «Subir» y «Bajar». Por tanto, cuando `ZIndex` se añade o se modifica por primera vez, primero recorremos el grafo de escena y ordenamos los nodos hijo por `ZIndex`. Después de obtener el array ordenado, actualizamos el índice fraccionario del nodo actual a partir de sus dos nodos hermanos inmediatos.

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

Esto permite ordenar a partir de los índices fraccionarios antes de renderizar. Conviene señalar que no puedes usar directamente [localeCompare] para la comparación:

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

## Lectura adicional {#extended-reading}

-   [Cómo funciona la tecnología multijugador de Figma]
-   [CRDT de árboles móviles y la implementación de Loro]
-   [Aprender Yjs]
-   [CRDT: las partes difíciles]
-   [Una introducción interactiva a los CRDT]
-   [El espectro completo de la colaboración]
-   [Construir cursores multijugador de Figma]

[Qué son los CRDT]: https://loro.dev/docs/concepts/crdt
[CRDT: las partes difíciles]: https://www.youtube.com/watch?v=x7drE24geUw
[Software local-first: tus datos son tuyos, a pesar de la nube]: https://www.inkandswitch.com/local-first/
[Ejemplo de Excalidraw con Loro]: https://github.com/loro-dev/loro-excalidraw
[El pasado, el presente y el futuro de local-first]: https://speakerdeck.com/ept/the-past-present-and-future-of-local-first
[Soporte sin conexión de TipTap]: https://tiptap.dev/docs/guides/offline-support
[Una introducción interactiva a los CRDT]: https://jakelazaroff.com/words/an-interactive-intro-to-crdts/
[Construir un editor colaborativo de pixel art con CRDT]: https://jakelazaroff.com/words/building-a-collaborative-pixel-art-editor-with-crdts/
[Hacer los CRDT un 98 % más eficientes]: https://jakelazaroff.com/words/making-crdts-98-percent-more-efficient/
[Aprender Yjs]: https://learn.yjs.dev/
[dgmjs-plugin-yjs]: https://github.com/dgmjs/dgmjs/tree/main/packages/dgmjs-plugin-yjs
[Diseñar estructuras de datos para aplicaciones colaborativas]: https://mattweidner.com/2022/02/10/collaborative-data-design.html
[El espectro completo de la colaboración]: https://zed.dev/blog/full-spectrum-of-collaboration
[Estructuras de datos en Liveblocks]: https://liveblocks.io/docs/api-reference/liveblocks-client#Data-structures
[Y.Map]: https://docs.yjs.dev/api/shared-types/y.map
[Valores simples]: https://automerge.org/docs/documents/values/
[Map]: https://loro.dev/docs/tutorial/map
[Cómo funciona la tecnología multijugador de Figma]: https://www.figma.com/blog/how-figmas-multiplayer-technology-works/
[Edición en tiempo real de secuencias ordenadas]: https://www.figma.com/blog/realtime-editing-of-ordered-sequences/#fractional-indexing
[BroadcastChannel]: https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
[updateScene de Excalidraw]: https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#updatescene
[fractional-indexing]: https://github.com/rocicorp/fractional-indexing
[CRDT de árboles móviles y la implementación de Loro]: https://loro.dev/blog/movable-tree
[Lección 14]: /es/guide/lesson-014#z-index
[localeCompare]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare
[Cifrado homomórfico de CRDT]: https://jakelazaroff.com/words/homomorphically-encrypted-crdts/
[Cifrado de extremo a extremo en el navegador]: https://plus.excalidraw.com/blog/end-to-end-encryption
[Construir cursores multijugador de Figma]: https://mskelton.dev/blog/building-figma-multiplayer-cursors
[Cómo animar cursores multijugador]: https://liveblocks.io/blog/how-to-animate-multiplayer-cursors
[List]: https://loro.dev/docs/tutorial/list
[LoroDoc]: https://loro.dev/docs/tutorial/loro_doc
[Exportar e importar]: https://loro.dev/docs/tutorial/loro_doc#exporting-and-importing
[generateKey]: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey
[exportKey]: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/exportKey
[AES-GCM]: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt#aes-gcm
[JSON Web Key]: https://developer.mozilla.org/zh-CN/docs/Web/API/SubtleCrypto/importKey#json_web_key
[firestore]: https://firebase.google.com/docs/firestore
[liveblocks]: https://liveblocks.io/multiplayer-editing
[Awareness y presencia]: https://docs.yjs.dev/getting-started/adding-awareness
[Ejemplo con Loro]: /example/loro
[Ejemplo con Yjs]: /example/yjs
[Ejemplo con Liveblocks]: /example/liveblocks
[updatePresence]: https://liveblocks.io/docs/api-reference/liveblocks-client#Room.updatePresence
[perfect-cursors]: https://github.com/steveruizok/perfect-cursors
[Lección 6 - Coordenadas]: /es/guide/lesson-006#coordinates
[Ejemplo con perfect-cursors]: /example/perfect-cursors
[Ejemplo con framer-motion]: https://liveblocks.io/examples/overlay-comments/nextjs-comments-overlay
[Comentarios de Liveblocks]: https://liveblocks.io/docs/ready-made-features/comments
[framer-motion]: https://www.npmjs.com/package/framer-motion
[Guía de comentarios en Figma]: https://help.figma.com/hc/en-us/articles/360039825314-Guide-to-comments-in-Figma
[kdbush]: https://github.com/mourner/kdbush
[supercluster]: https://github.com/mapbox/supercluster
