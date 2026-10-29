---
outline: deep
description: 'Superpón un renderizado real de Mesh 3D sobre el lienzo 2D existente: espacio 3D unificado, Camera3D y MeshPipeline3D.'
---

<script setup>
import Cube from '../../components/Cube.vue'
import CubePerspective from '../../components/CubePerspective.vue'
import Lighting from '../../components/Lighting.vue'
import GltfDuck from '../../components/GltfDuck.vue'
import SvgExtrusion from '../../components/SvgExtrusion.vue'
import IconExtrusion from '../../components/IconExtrusion.vue'
</script>

# Lección 39 - Renderizado de Mesh 3D {#lesson-39-3d-mesh-rendering}

Antes de [Lección 30 - Posprocesado y grafo de renderizado], todo lo que había en el lienzo pasaba por la canalización 2D: cámara ortográfica, SDF, rellenos por triangulación de trazados, etc. Esta lección añade una rama de Mesh 3D sin reemplazar ese renderizador 2D: los vértices llevan normales, proyección en perspectiva u ortográfica, prueba de profundidad y composición con las capas 2D en el mismo lienzo.

## Framer, Spline, Rive y Bevy {#framer-spline-rive-bevy}

Las ideas centrales de la fusión 2D/3D en Framer y Spline se pueden resumir en dos caminos técnicos. Cada producto elige una arquitectura distinta según su enfoque.

La capacidad 3D de Framer es, en esencia, una envoltura mejorada de las transformaciones 3D de CSS, no una canalización de renderizado 3D real. Eso significa que no hay importación de modelos 3D externos (GLB/OBJ) ni un sistema real de iluminación, sombras o materiales. Los efectos 3D se limitan a casos sencillos, como el volteo de tarjetas y las capas de paralaje. Consulta: [How to Turn 2D Elements into Interactive 3D Objects in Framer]

![fuente: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer](https://framerusercontent.com/images/j0Ohpy2LqEoU8uSlHGeoymyLlg.png)

Spline es un editor 3D de verdad, con una arquitectura más cercana a la de un motor de juegos. Spline te permite crear [UI Scenes] independientes (lienzos 2D) y usarlas como texturas de objetos UI Frame en una escena 3D. [Working with 2D and 3D objects]

![fuente: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects](https://cdn.spline.design/_assets/docs/957fce0d-3bef-420c-90b0-9085ffec39fd.png)

Rive sigue siendo, en lo fundamental, una herramienta 2D. Su «sensación 3D» proviene de transformaciones 2.5D, deformación de mallas y trucos parecidos, no de una canalización 3D completa.

Nuestro enfoque se acerca a [2D Rendering in Bevy]: las formas 2D viven en el plano **z = 0** y los modelos 3D comparten el mismo mundo. Cuando desplazas o haces zoom con la cámara 2D, la cámara 3D puede seguirla de forma opcional. Consulta la implementación en [PR #271](https://github.com/xiaoiver/infinite-canvas-tutorial/pull/271).

## Visión general de la arquitectura {#architecture}

```plaintext
Same WebGL/WebGPU context
  └─ MeshPipeline render graph
       ├─ Pass: 3D (MeshPipeline3D.drawMeshes)
       ├─ Pass: 3D Gizmo (RenderGizmo3D.drawGizmos, on top of meshes)
       ├─ Pass: grid / 2D vector (existing BatchManager)
       └─ Pass: post-processing → present
```

-   **`Renderer3DPlugin`**: registra los componentes 3D y programa `MeshPipeline3D` (caché de GPU), **`CameraSync`** (acoplamiento con la cámara 2D), **`Pick3D`** (selección y arrastre) y **`RenderGizmo3D`** (dibujo del gizmo de transformación).
-   **`MeshPipeline3D`**: no presenta su propia swapchain. Dentro del pase principal de `MeshPipeline` **dibuja primero el 3D y después el 2D**, y comparte los adjuntos de color y de profundidad.
-   El **`Mesh.ts`** existente sigue siendo **relleno vectorial 2D**. No lo confundas con el `Mesh3D`.

Configuración del complemento:

```ts
import {
    App,
    DefaultPlugins,
    DefaultRenderer3DPlugin,
} from '@infinite-canvas-tutorial/ecs';

const app = new App().addPlugins(...DefaultPlugins, DefaultRenderer3DPlugin);
app.run();
```

## Componentes principales {#components}

| Componente | Función |
| --- | --- |
| **`Camera3D`** | `projection: 'perspective' \| 'orthographic'`; cuando `linked` está activo, `CameraSync` sigue el desplazamiento y el zoom 2D |
| **`Mesh3D`** | `positions`, `normals`, `indices` opcionales (malla de triángulos) |
| **`Material3D`** | PBR metallic-roughness: `baseColor`, `metallic`, `roughness` e intensidad ambiental; los campos heredados se conservan por compatibilidad |
| **`Light3D`** | `ambient` / `directional` / `point` / `spot`; consulta el [ejemplo de iluminación de la escena](/example/lighting) |
| **`Transform3D`** | traslación, rotación de Euler y escala |
| **`Selected3D`** | estado de selección 3D: modo del gizmo, eje o plano activo, punto de referencia del arrastre, etc. (consulta [Gizmo de transformación 3D](#gizmo)) |
| **`Mat4`** | ayudas para matrices 4×4 (`perspective` / `ortho` / `lookAt`) |

Crea entidades con `commands.spawn` del ECS, por ejemplo:

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

## Espacio 3D unificado (cámara vinculada) {#unified-space}

Para **desplazar y hacer zoom en el lienzo y mover juntos el 2D y el 3D**, pon `linked: true` en `Camera3D`.

En cada fotograma, `CameraSync` lee el `ComputedCamera` 2D `(x, y, zoom)` y escribe `eye` / `center` / `baseDistance` de la cámara 3D:

-   Zoom: `baseDistance = canvas.height / 2`, `eye.z = baseDistance / zoom`, de modo que coincida con la altura visible de `mat3.projection` 2D en z = 0
-   **Ortográfica vinculada** (`projection: 'orthographic'`): `eye = [x, -y, distance]`, `center = [x, -y, 0]` (la Y del lienzo 2D apunta hacia abajo y la Y del mundo 3D apunta hacia arriba; se voltea mediante `canvasWorldToWorld3D`)
-   **Perspectiva vinculada** (`projection: 'perspective'`): `eye = [x, y, distance]`, `center = [x, y, 0]` (igual que los nodos 2D: **coordenadas del lienzo, Y hacia abajo**)

### Vinculada + ortográfica {#linked-orthographic}

`MeshPipeline3D` usa de forma directa la `viewProjectionMatrix` 2D (incluido el volteo de Y, el desplazamiento y el zoom), lo que mantiene `extrude3d` y los rectángulos 2D estrictamente alineados.

El ejemplo [Cubo (ortográfico)](/example/cube) usa **vinculada + ortográfica** (`translation: [200, 100, 40]`).

<Cube />

### Vinculada + perspectiva {#linked-perspective}

En el modo de perspectiva, la posición en pantalla sale de la **VP 2D completa** (el desplazamiento, el zoom y el volteo de Y coinciden con el 2D). La profundidad usa una matriz de perspectiva sobre `Transform3D.translation.z` para el escorzo. El ancla es `(x, y, z)` de `translation`, así que el objeto cae en el mismo `(x, y)` que en 2D.

[Cubo (perspectiva)](/example/cube-perspective) usa la configuración **vinculada + perspectiva** de arriba. Cuando arrastras el lienzo, el cubo debe desplazarse y hacer zoom junto con las capas 2D.

<CubePerspective />

## Picking por raycast {#raycast-picking}

La selección 3D y la interacción con el gizmo las gestiona el sistema **`Pick3D`** (también se usa desde **`Select`** cuando la herramienta de selección está activa). Al pulsar el puntero, el píxel del viewport bajo el cursor se prueba contra las asas del gizmo y los triángulos de `Mesh3D`. No se usa un pase de picking en GPU: todo se ejecuta en la CPU, en `ray-casting.ts` y `pick3d-probe.ts`.

### Canalización {#pipeline}

```plaintext
viewport (x, y)
  └─ buildPickSceneForViewport(camera, …)  →  Mesh3DPickScene (same matrices as rendering)
       └─ probePick3DAtViewport(…)
            ├─ 1. gizmo parts on Selected3D entities (screen-space / ray, per part)
            └─ 2. all Mesh3D on this canvas → keep closest hit (smallest t)
```

**Prioridad**: las entidades que ya están seleccionadas se sondean primero en busca de **asas del gizmo**. Solo si ninguna recibe el impacto, el sondeo prueba las mallas de la escena. Entre las mallas, gana el impacto con la **distancia menor** a lo largo del rayo (o la profundidad mayor en la perspectiva vinculada).

### Raycast estándar (ortográfica / cámara libre) {#standard-raycast-orthographic-free-camera}

En los modos que no son de perspectiva vinculada, el picking refleja a los editores 3D clásicos:

1. **`screenToRay`**: píxeles del viewport → NDC → desproyección de cerca y de lejos con **`inv(view × projection)`** para obtener un rayo en espacio de mundo.
2. **`rayMeshIntersection`**: transforma los vértices de la malla con la matriz de modelo de la entidad y después:
    - **Fase amplia**: rayo frente a la **AABB** transformada (método de slabs).
    - **Fase estrecha**: prueba rayo-triángulo de **Möller–Trumbore** en cada triángulo; se conserva la `t` más cercana.

```ts
// packages/ecs/src/utils/ray-casting.ts (simplified)
const invVP = computeInvViewProjection(projMatrix, viewMatrix);
const ray = screenToRay(vx, vy, width, height, invVP);
const hit = rayMeshIntersection(ray, positions, indices, modelMatrix);
// hit: { t, point, triangleIndex } | null
```

La **ortográfica vinculada** (`linked + orthographic`) reutiliza el mismo camino: `MeshPipeline3D` introduce la `viewProjectionMatrix` 2D en la escena de picking, así que los clics siguen alineados con los rectángulos 2D y con `extrude3d`.

### Perspectiva vinculada: triángulos en espacio de pantalla {#linked-perspective-screen-space-triangles}

La **perspectiva vinculada** **no** usa un rayo de mundo para los impactos con mallas. La posición en pantalla la dirige la VP 2D completa. La profundidad sale de una matriz de perspectiva aparte sobre `translation.z`. Para coincidir con el shader de vértices, **`pickMeshLinkedPerspective`** proyecta cada triángulo al espacio del viewport con los mismos uniforms, después comprueba si el cursor cae dentro del **triángulo 2D proyectado** (`pointInTriangle2D`) y elige la **profundidad más frontal** en ese píxel. Las piezas del gizmo en este modo reutilizan la misma función auxiliar (con un sesgo de pantalla en Z opcional para las asas).

Así se mantiene que «lo que ves es lo que seleccionas» al desplazar o hacer zoom en el lienzo con un cubo en perspectiva.

### Restricciones de arrastre {#drag-constraints}

Una pulsación del gizmo crea una `GizmoSession` con la pose inicial y una proyección fija. En las cámaras ordinarias, el movimiento del puntero interseca un rayo con el plano de restricción activo. Las cámaras vinculadas invierten la proyección mostrada del asa, incluido su desplazamiento de pantalla en Z. La traslación sigue el eje o el plano seleccionado. La rotación sigue el eje local del anillo. Las muestras no válidas o degeneradas dejan la previsualización sin cambios.

La sesión actualiza los componentes de tiempo de ejecución durante el movimiento. Al soltar, una fuente declarativa publica una edición del documento y una entrada de deshacer. Escape, la cancelación del puntero o salir del lienzo restauran la pose inicial sin registrar una edición.

Cambiar la cámara activa, su proyección o su vista, o el tamaño del lienzo, cancela un gesto mantenido. Las ediciones externas de la pose de la fuente, de su geometría o de la transformación de un ancestro también lo cancelan: la previsualización de tiempo de ejecución vuelve al **documento actual**, así que soltar un puntero antiguo no puede sobrescribir una edición de la API ni un deshacer. Las ediciones no relacionadas, como nombres y colores, pueden fusionarse con un arrastre que continúa con normalidad. Los cambios en otro lienzo no lo interrumpen. Pulsa un asa otra vez para empezar en la vista nueva.

El layout calculado también forma parte del contexto del gesto. Yoga puede cambiar la posición o el tamaño de una fuente sin cambiar esos campos del documento. Esos cambios, incluidas las transformaciones de los ancestros, cancelan la previsualización. La cancelación conserva el layout nuevo y restaura solo las coordenadas que todavía pertenecen a la previsualización. Escape sobre un layout que, por lo demás, no ha cambiado vuelve a la posición inicial calculada, incluso cuando difiere del documento. Las propias escrituras de previsualización de la sesión no la invalidan.

`GizmoSourceFrame` toma una instantánea de la geometría local de la fuente y de los ancestros, y evita interrupciones falsas por actualizaciones retrasadas de la matriz de mundo. Mientras una sesión de puntero es dueña de la previsualización de la fuente, la sincronización del compañero no vuelve a escribir esa fuente. Las integraciones que manipulan un compañero de forma directa conservan su sincronización inversa.

Los fotogramas sin cambios no reescriben las transformaciones ni los materiales del compañero, y las ediciones de pose o de material reutilizan la geometría de CPU generada. Los cambios de configuración de la geometría invalidan esa caché por su cuenta.

`MeshPipeline3D` también reutiliza los búferes de GPU de vértices, normales, UV, índices y uniforms por malla durante las ediciones de pose y de material. Solo las escrituras de `Mesh3D` invalidan la geometría. Cuando edites arrays de forma directa, adquiere primero el componente con `entity.write(Mesh3D)`. La caché consume esas escrituras después de la sincronización del compañero, las conserva entre dibujos omitidos y sube el reemplazo una sola vez en el dibujo siguiente. Las mallas con arrays de geometría idénticos comparten la geometría subida dentro de un mismo lienzo, y cada malla conserva su propio uniform de modelo y sus vinculaciones de dibujo. Una edición de geometría in situ sube una generación nueva. Las otras instancias conservan su instantánea de GPU anterior hasta que se actualizan o se eliminan. Cada lienzo es dueño de su caché y de los uniforms de escena. Quitar una malla o moverla a otro lienzo libera los búferes antiguos, y destruir el lienzo libera sus recursos antes que el dispositivo. Las asignaciones fallidas se revierten y se pueden reintentar sin sustituir la entrada de caché completa anterior.

Las matrices de modelo y de normales solo se recalculan cuando cambia la pose. Las subidas del uniform de modelo también omiten los fotogramas sin cambios y los cambios que solo afectan a la cámara. Las ediciones de material y las cargas de textura terminadas actualizan los uniforms sin reconstruir esas matrices. Las ediciones in situ de los arrays de transformación y de color se comparan por valor.

Los uniforms de escena se cachean por lienzo. Los cambios de cámara y de la vista 2D vinculada actualizan las matrices de escena. Los cambios de luz reempaquetan la iluminación sin reconstruir esas matrices. Los dibujos sin cambios reutilizan tanto los datos de escena como las vinculaciones de dibujo de cada malla. La disponibilidad o el reemplazo de una textura, las reconstrucciones de geometría y el reemplazo de recursos de GPU invalidan las vinculaciones afectadas. Las vinculaciones se liberan antes que los búferes y las texturas a los que hacen referencia. Las subidas de escena fallidas y las asignaciones de vinculaciones se pueden reintentar.

La lista de capas 3D sigue los cambios de geometría, metadatos, ámbito y pertenencia del ECS, en lugar de recorrer cada malla en cada fotograma inactivo. La pertenencia de la selección se sigue aparte, así que pasar el cursor sobre las asas del gizmo no reconstruye la lista. Las entradas de capa conservan referencias de entidad estables para una selección posterior, también después de deshacer y rehacer.

Consulta [Gizmo de transformación 3D](#gizmo) para los colores de las asas, los ejes y el flujo completo del puntero.

## Gizmo de transformación 3D {#gizmo}

Con la **herramienta de selección** (`penbarSelected === Pen.SELECT`), hacer clic en una malla 3D añade **`Selected3D`** a la entidad y dibuja asas de **traslación** en su centro: flechas roja, verde y azul, más widgets de plano semitransparentes. Arrastrar un asa escribe de vuelta en **`Transform3D.translation`**. Se parece al `Selected` 2D + `RenderTransformer`, pero pasa por un camino aparte de picking y de dibujo 3D.

### Flujo de interacción {#gizmo-flow}

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

### Coordenadas y significado de las asas {#gizmo-axes}

De acuerdo con [Espacio 3D unificado](#unified-space), el gizmo usa **coordenadas del lienzo (Y hacia abajo)**, no el estilo de Blender con Y hacia arriba:

| Color | Eje | Dirección (vista típica del lienzo vinculado) | El arrastre actualiza |
| --- | --- | --- | --- |
| Rojo | +X | derecha | `translation.x` |
| Verde | +Y | abajo | `translation.y` |
| Azul | +Z | **profundidad** (`z+` hacia el interior de la pantalla) | `translation.z` |

-   **Flechas**: trasladan a lo largo de un solo eje.
-   **Planos** (cuadrados semitransparentes `xy` / `xz` / `yz`): mueven dos componentes a la vez (p. ej., `xy` = solo X e Y, no Z).

-   **Modo combinado `transform` (predeterminado, al estilo de Spline)**: muestra a la vez las flechas y los planos de traslación **y** los anillos de rotación. El asa que agarres ejecuta esa operación (`activePartKind`: `translate` | `rotate`). No hay un cambio de modo con `W` / `E`.
-   Arrastrar una **flecha / plano** → actualiza `Transform3D.translation`. Arrastrar un **anillo** → actualiza `Transform3D.rotation` (ángulos de Euler locales, iguales que los de la malla).
-   Los anillos siguen la orientación actual del objeto. Las flechas permanecen en los ejes de mundo del lienzo (X a la derecha, Y hacia abajo, Z en profundidad).
-   El picking usa el impacto **más cercano** en espacio de pantalla. Cuando se solapan, las flechas quedan encima, así que gana la traslación. `scale` queda reservado para más adelante.

### Editar rectángulos extruidos {#extrude-editing}

Un `rect` con `extrude3d` usa el mismo gizmo que una malla declarativa. Sus opciones serializables incluyen ahora la elevación y una rotación 3D local:

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

-   La traslación XY escribe el `x`/`y` del rectángulo fuente en las coordenadas de su padre, incluidos los padres rotados, escalados o volteados. Una transformación de padre singular rechaza la previsualización porque su inversa no existe.
-   La traslación Z cambia `extrude3d.z` y conserva `depth`. Con rotación 3D cero, `z` es la elevación del plano frontal. El centro del compañero está en `z - depth / 2`.
-   La rotación del anillo escribe `extrude3d.rotation`: ángulos de Euler XYZ en radianes, relativos a la rotación 2D ya existente de la fuente en espacio de mundo. Deja intacta la `rotation` 2D de la fuente. Para una forma rotada ordinaria, el compañero compone `Rz(sourceAngle) × Rx(x) × Ry(y) × Rz(z)`.

Al soltar se confirma una sola vez. La cancelación restaura la previsualización. Deshacer, rehacer y recargar el documento restauran la misma pose. Desactivar la extrusión o sustituir su compañero interrumpe el gesto y restaura el documento actual, en lugar de recrear un compañero obsoleto.

`extrude3d: true` sigue significando una profundidad de 100, y un número sigue especificando la profundidad. Los valores de objeto tienen de forma predeterminada profundidad 100, elevación 0 y rotación `[0, 0, 0]`. Una actualización sustituye el valor completo de la opción: los campos omitidos vuelven a esos valores predeterminados. Todavía no hay asas de escala. Usa las dimensiones del rectángulo y `depth` para cambiar el tamaño. La extrusión de un rectángulo sigue sus esquinas locales a través de la rotación y la escala. Las esquinas redondeadas, los reflejos y el sesgado que vienen de padres transformados se hornean en la malla, así que su huella sigue alineada con la fuente 2D editable. Una transformación de padre singular no puede producir una malla nueva.

### Extruir un Path cerrado {#extrude-path}

Un Path cerrado con un único relleno sólido puede usar la misma opción `extrude3d`. Sus caras frontal y trasera siguen los contornos rellenos, incluidos los huecos. Editar `d` o `fillRule` reconstruye la malla. La traslación la reutiliza. El sesgado que viene de padres transformados se hornea en la malla, así que los cambios de esa transformación lineal la reconstruyen.

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

Todos los subtrazados deben estar cerrados. Los trazados abiertos, las capas de trazo, los rellenos múltiples o no sólidos, los contornos no manifold y las transformaciones singulares siguen siendo visibles en 2D. El Path conserva su nodo de documento original y admite ediciones con el gizmo, deshacer y recargar.

### Convertir iconos en 3D {#icon-to-3d}

<IconExtrusion />

En la aplicación, selecciona un icono y abre **3D → Convertir icono a 3D**. Elige una profundidad y un preajuste de material (mate, brillante o metal). La conversión expande los trazos SVG, incluidos sus extremos y sus uniones, en contornos cerrados. Las partes rellenas y los huecos se convierten en Path editables dentro de un grupo. Selecciona el grupo para cambiar la profundidad o el material de todas las partes. Selecciona un Path para editar su contorno o su bisel. Deshacer restaura el IconFont. La conversión es una instantánea de la geometría del icono.

Después de registrar un conjunto de iconos con `registerIconifyIconSet`, el código puede usar la misma conversión:

```ts
const result = iconFontToExtrudedPaths(iconNode, {
    depth: 40,
    bevelSize: 2,
    metallic: 1,
    roughness: 0.25,
});
if (result) api.updateNodes([result.group, ...result.paths]);
```

`metallic` y `roughness` son parámetros PBR entre 0 y 1. Estos preajustes usan la canalización de iluminación existente. El vidrio transparente y la refracción todavía no se admiten. Los filtros SVG, los degradados y las pinturas no admitidas pueden exigir una limpieza manual del contorno antes de la extrusión.

`sideColor` es un color CSS opcional para las paredes. El frente y el dorso conservan el relleno de la fuente. Si lo omites, todas las caras usan el color de relleno de la fuente. El color lateral es un cambio de pintura, así que editarlo reutiliza la geometría de malla existente.

Los elementos SVG `<path>`, `<polygon>`, `<rect>`, `<circle>` y `<ellipse>`, más los elementos `<polyline>` cerrados, se pueden importar como fuentes de extrusión rellenas con `svgElementsToExtrudedNodes`. La función auxiliar conserva en 2D las otras formas importadas. Una profundidad no válida se rechaza, en lugar de cambiarla en silencio a un valor predeterminado.

```ts
import { svgElementsToExtrudedNodes } from '@infinite-canvas-tutorial/ecs';

const svg = new DOMParser().parseFromString(source, 'image/svg+xml');
const nodes = svgElementsToExtrudedNodes(
    svg.documentElement as unknown as SVGSVGElement,
    40,
);
api.updateNodes(nodes);
```

En la aplicación en línea, selecciona un rectángulo o un Path para abrir el control **3D** de la barra de herramientas superior. Activa la extrusión y después edita su profundidad y su bisel. El menú del proyecto también ofrece **Importar SVG como 3D**, que centra la ilustración visible en el lienzo, incluso cuando ocupa solo una parte del viewport SVG, y conserva en 2D las capas no admitidas. Usa **Exportar como → GLB (3D)** para descargar todas las mallas extruidas listas del proyecto. La aplicación también te permite fijar un perfil de bisel (1–8 segmentos) y un color lateral hexadecimal opcional. Deja el color lateral en blanco para usar el relleno de la forma. Si un Path no puede producir una malla, la aplicación desactiva la acción de extrusión y muestra los requisitos de contorno cerrado, relleno y trazo.

**Compatibilidad de importación:** los contornos cerrados con relleno sólido y los trazos sólidos admitidos se convierten en formas 3D editables. Los degradados, patrones y otras capas no extruibles permanecen en 2D. Se conservan los huecos, transformaciones, referencias locales y recortes admitidos; las referencias externas, máscaras y filtros no se convierten en 3D.

La demostración permite probar trazos, recortes y referencias repetidas. Consulta los [detalles de compatibilidad SVG](/es/guide/svg-extrusion-reference).

Pon `extrude3d.bevelSize` (en unidades del lienzo) para un bisel en ambos extremos de las extrusiones de Path y de Rect. La demostración lo expone como **Bisel**. Se admiten huecos, varias islas y esquinas cóncavas cuando el desplazamiento hacia dentro conserva la topología rellena. Si los contornos chocan o una región estrecha se colapsa, la forma conserva sus aristas vivas. Cambiar la profundidad o el tamaño reconstruye la malla compañera y mantiene editable la fuente. Las formas con más de 4096 vértices en sus límites de relleno resueltos también conservan las aristas vivas, para acotar el trabajo de la malla.

Pon `extrude3d.bevelSegments` en `1` para un bisel recto (el valor predeterminado), o en `2`–`8` para un perfil de cuarto de círculo redondeado. Más segmentos suavizan la silueta y añaden triángulos a la malla. El control **Perfil de bisel** de la demostración te permite comparar perfiles rectos y redondeados en las formas SVG importadas.

El botón **Descargar GLB** del ejemplo exporta las mallas 3D generadas como un archivo binario glTF autocontenido. Usa `api.exportGlb` para descargar todas las formas extruidas listas, o pasa nodos para exportar solo una selección (incluidos los hijos de los grupos seleccionados):

```ts
await api.exportGlb();
const glb = await api.exportGlb({
    nodes: [api.getNodeById('extruded-vector')!],
    download: false,
}); // Uint8Array
```

La exportación convierte las coordenadas Y hacia abajo del lienzo en coordenadas Y hacia arriba de glTF, y conserva la pose 3D actual, el relleno sólido y el color lateral opcional. Solo exporta los compañeros de malla que están listos. Las formas SVG 2D no admitidas no se incluyen. Las texturas de color base se incrustan como PNG o JPEG (los otros formatos decodificables se convierten a PNG). Las URL de textura deben permitir peticiones CORS. El `api.export({ format: ExportFormat.GLB })` síncrono sigue disponible para exportaciones sin textura. Para exportaciones de malla de más bajo nivel, llama a `exportMeshesToGlb(sources, await loadGlbImages(sources))`.

Usa **Muestra de viewBox y sesgado** para inspeccionar el contorno transformado y su hueco evenodd, y después desactiva la extrusión para comparar la huella 2D. Usa **Muestra de recorte slice** para ver un hueco, dos piezas separadas y un borde curvo cortado por el viewport SVG.

<SvgExtrusion />

## Iluminación {#lighting}

Compara luz ambiental, direccional, puntual y de foco en la escena. Ajusta el metalizado y la rugosidad de la esfera, cambia el mapa de entorno y prueba las sombras o el foco móvil.

Una escena admite hasta ocho luces directas y hasta dos luces aptas pueden proyectar sombras. Usa `material3d.emissiveFactor` / `emissiveStrength` para emisión, `material3d.unlit` para materiales sin iluminación y `alphaMode` para recortes o transparencia.

Consulta la [referencia de iluminación](/es/guide/lighting-reference) para parámetros y límites, y el [ejemplo de iluminación](/example/lighting) para la API y los controles.

<Lighting />

## Modelo glTF {#gltf}

Carga un glTF/GLB externo mediante geometría declarativa `mesh3d` (`geometry: { type: 'gltf', url: '…' }`). La muestra **Duck** de Khronos usa un par `.gltf` + `.bin` bajo `/data/`. Las mallas se centran y se normalizan a unos límites unitarios, y después se escalan con `scale3d`.

Los factores de color base de glTF usan RGB lineal, mientras que el ECS almacena los colores base del material como sRGB. La importación convierte entre ambos. La exportación GLB vuelve a convertir a RGB lineal, para que los colores del material permanezcan estables en un viaje de ida y vuelta.

El importador también conserva `doubleSided`, `normalTexture`, `occlusionTexture` y los atributos `TANGENT` de autor de glTF. Los mapas de normales alteran la normal de iluminación. La oclusión afecta solo a la luz indirecta. El [modelo PBR interactivo](/example/gltf-duck#pbr-material) explica cuándo el mapeo de normales usa tangentes de autor o las deriva de las UV.

Los colores de vértice `COLOR_0` de glTF (flotante, o byte o short sin signo normalizado, RGB o RGBA) multiplican el color base del material en espacio lineal. El [modelo interactivo con color de vértice](/example/gltf-duck#vertex-colors) muestra el resultado con iluminación de escena y sin ella. La exportación conserva los colores como RGBA flotante.

El importador acepta listas de triángulos, tiras de triángulos (`mode: 5`) y abanicos de triángulos (`mode: 6`), con índices o sin ellos. Los convierte en listas de triángulos para el renderizado y la exportación GLB. Las transformaciones de nodo reflejadas también corrigen el orden de los triángulos, para que las superficies de una sola cara sigan siendo visibles.

Se admiten los accessors dispersos de glTF para posiciones, normales, UV, colores, tangentes e índices de triángulos. Los datos base que faltan empiezan en cero. Los valores dispersos sustituyen solo los elementos enumerados. La malla importada se exporta como búferes GLB densos ordinarios.

<GltfDuck />

## Lectura adicional {#extended-reading}

-   [Working with 2D and 3D objects]
-   [Bevy Core3dPlugin](https://docs.rs/bevy/latest/bevy/core_pipeline/core_3d/struct.Core3dPlugin.html) (referencia de capas de complementos)

[Lección 30 - Posprocesado y grafo de renderizado]: /es/guide/lesson-030
[How to Turn 2D Elements into Interactive 3D Objects in Framer]: https://framer.university/blog/how-to-turn-2d-elements-into-interactive-3d-objects-in-framer
[UI Scenes]: https://docs.spline.design/designing-in-3-d/ui-scenes
[Working with 2D and 3D objects]: https://docs.spline.design/designing-in-3-d/working-with-2d-and-3d-objects
[2D Rendering in Bevy]: https://bevy.org/examples/2d-rendering/2d-shapes/
