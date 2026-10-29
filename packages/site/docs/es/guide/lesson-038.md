---
outline: deep
description: 'Tokens de diseño, variables, temas, generación por componentes e integración de fuentes de iconos en Pencil. Exporta SVG, Iconify y el camino del diseño al código.'
---

<script setup>
import IconLucide from '../../components/IconLucide.vue'
import IconButton from '../../components/IconButton.vue'
import ComponentsInstances from '../../components/ComponentsInstances.vue'
import DesignToCodeInterfaces from '../../components/DesignToCodeInterfaces.vue'
</script>

# Lección 38 - Del diseño al código {#lesson-38-from-design-to-code}

## Variables y temas {#variables-and-themes}

Pencil admite un sistema completo de tokens de diseño, con valores condicionales para varios temas. Consulta [Variables and Themes]. Las variables reducen los valores fijos en el código: el modelo no necesita emitir colores concretos (menos errores de `#RRGGBB`) ni aprender la tabla de tokens de tu sistema de diseño. Solo necesita nombres semánticos de variables, y el renderizador los resuelve.

```ts
api.setAppState({
    variables: {
        'color.background': { type: 'color', value: '#FFFFFF' },
        'text.title': { type: 'number', value: 72 },
    },
});
api.updateNodes([
    {
        id: 'r1',
        type: 'rect',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        zIndex: 1,
        fill: '$color.background',
        stroke: '$color.background',
    },
]);
```

Cuando el modelo diseña para el modo oscuro, no necesita dos paletas completas. Le bastan referencias como `$color.bg`, y el `theme` del nodo controla el valor resuelto.

```json
"variables": {
  "color.bg": {
    "type": "color",
    "value": [
      { "value": "#FFFFFF", "theme": { "mode": "light" } },
      { "value": "#000000", "theme": { "mode": "dark" } }
    ]
  }
}
```

El modelo tampoco necesita calcular valores en píxeles ni cablear puntos de ruptura adaptativos. Declara la intención, y el motor de layout calcula la geometría. Consulta [Lección 33 - Motor de layout].

### Tipos de variables {#variable-types}

Figma admite cuatro clases de variables. Consulta [Guide to variables in Figma]

-   Color (`#000000`)
-   Número
-   Cadena, p. ej. `fontFamily` o el contenido del texto
-   Booleano

![fuente: https://help.figma.com/hc/en-us/articles/14506821864087-Overview-of-variables-collections-and-modes](https://help.figma.com/hc/article_attachments/30211233510039)

![fuente: https://help.figma.com/hc/en-us/articles/15145852043927-Create-and-manage-variables-and-collections](https://help.figma.com/hc/article_attachments/26964398869143)

### Panel de propiedades y selector de variables {#property-panel-and-variable-picker}

Con un nodo seleccionado, el panel de propiedades de Spectrum puede vincular variables de diseño de `AppState.variables` al **relleno / color del trazo / anchura del trazo / tamaño de fuente**: elige un nombre en el desplegable para escribir `$token`. Cuando está vinculado, aparece una insignia morada, y puedes **desvincular** en una sola acción (se escribe de vuelta el literal resuelto actual y se registra el historial). El selector de color y el deslizador de anchura del trazo muestran siempre los valores **resueltos**, así que un `$...` en bruto nunca se usa como color CSS no válido.

### Exportar SVG {#export-svg}

Hay varias estrategias de exportación. La predeterminada son los literales resueltos:

```ts
export type DesignVariablesSvgExportMode =
    /** Resolve $ → literal */
    | 'resolved'
    /** Keep `$token` strings (attributes may be non-standard; good for post-processing) */
    | 'preserve-token'
    /** `:root{--x:...}` + `fill="var(--x)"` */
    | 'css-var';
```

También puedes usar el modo de variables CSS: las globales se declaran bajo `:root`, así que puedes ajustarlas en las herramientas de desarrollo. Consulta [Using CSS custom properties (variables)]

```html
<svg>
    <defs>
        <style>
            :root {
                --color-background: #2563eb;
                --color-stroke: red;
                --text-title: 72px;
            }
        </style>
    </defs>
    <rect
        fill="var(--color-background)"
        stroke="var(--color-stroke)"
        stroke-width="2"
        width="100"
        height="100"
        id="node-r1"
    />
</svg>
```

## Icono {#icon}

Los iconos importan al generar interfaces. [Lucide] ya se usa mucho en la generación de código React, y Pencil admite gráficos integrados parecidos:

```ts
export interface IconFont extends Entity, Size, CanHaveEffects {
    type: 'icon_font';
    /** Name of the icon in the icon font */
    iconFontName?: StringOrVariable;
    /** Icon font to use. Valid fonts are 'lucide', 'feather', 'Material Symbols Outlined', 'Material Symbols Rounded', 'Material Symbols Sharp', 'phosphor' */
    iconFontFamily?: StringOrVariable;
    /** Variable font weight, only valid for icon fonts with variable weight. Values from 100 to 700. */
    weight?: NumberOrVariable;
    fill?: Fills;
}
```

En OpenPencil, `iconLookup` es una función inyectable, lo que significa:

-   **Flexibilidad**: cualquier origen de iconos (Iconify, Lucide, personalizado)
-   **Carga del modelo**: el modelo solo escribe `iconFontName: "SearchIcon"`. El entorno de ejecución resuelve los trazados

```ts
private drawIconFont(canvas, node, x, y, w, h, opacity) {
  const iconName = iNode.iconFontName ?? iNode.name ?? '';
  const iconMatch = this.iconLookup?.(iconName) ?? null;
  const iconD = iconMatch?.d ?? FALLBACK_ICON_D;  // SVG path data
  const iconStyle = iconMatch?.style ?? 'stroke';   // stroke or fill

  // Resolve SVG path → Skia path → scale → draw
}
```

Nuestras definiciones:

```ts
export interface IconFontAttributes {
  /** Name of the icon in the font family */
  iconFontName?: StringOrVariable;
  /**
   * Font family, e.g. 'lucide', 'feather', 'Material Symbols Outlined', 'phosphor', etc.
   */
  iconFontFamily?: StringOrVariable;
}

export interface IconFontSerializedNode
  extends BaseSerializeNode<'iconfont'>,
  Partial<IconFontAttributes>;
```

### Registrar un icono en tiempo de ejecución {#register-icon-at-runtime}

Usamos la forma de icono de [IconifyJSON] para cargar Lucide, Material y otros conjuntos en tiempo de ejecución, mediante un JSON que incluye el SVG:

```ts
import { registerIconifyIconSet } from '@infinite-canvas-tutorial/ecs';

const m = await import('@iconify/json/json/lucide.json');
registerIconifyIconSet('lucide', m);
```

Los cuerpos de icono aceptan atributos SVG con comillas simples o dobles. Los trazados, rectángulos, círculos, elipses y líneas pueden usar etiquetas autocerradas o de cierre explícito. Los atributos de relleno y de trazo de un `<g>` anidado los heredan sus formas.

El JSON del icono se mapea a nuestro grafo de escena igual que antes: un icono Search se convierte en un `Group` con hijos `Path` y `Circle`, de forma parecida a convertir un SVG en nuestras formas.

```json
"search": {
    "body": "<g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\"><path d=\"m21 21l-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/></g>"
}
```

También mapeamos la anchura, la altura y `strokeWidth` al grafo convertido:

```ts
function buildIconFontScalablePrimitives(
    iconFontName: string,
    iconFontFamily: string,
    targetWidth: number,
    targetHeight: number,
): ScaledIconPrimitive[] {}
```

<IconLucide />

### Mostrar en el panel de capas {#display-in-the-layer-panel}

Iconify incluye Web Components para mostrarlos. Consulta [Iconify Icon web component]. Los usamos como miniaturas en la lista de capas:

```ts
import 'iconify-icon';

if (this.node.type === 'iconfont') {
    const iconName = this.#normalizeIconifyName(
        this.node as IconFontSerializedNode,
    );
    thumbnail = iconName
        ? html`<iconify-icon icon=${iconName}></iconify-icon>`
        : html`<sp-icon-group></sp-icon-group>`;
}
```

### Exportar SVG {#export-svg-2}

### Renderizar con layout {#render-component-with-layout}

Junto con la [Lección 33 - Motor de layout], puedes construir un botón que incluya un icono:

```ts
const button1 = {
    id: 'icon-button',
    type: 'rect',
    fill: 'grey',
    display: 'flex',
    width: 200,
    height: 100,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    cornerRadius: 10,
    gap: 10,
} as const;

const searchIcon = {
    id: 'icon-button-search',
    parentId: 'icon-button',
    type: 'iconfont',
    iconFontName: 'search',
    iconFontFamily: 'lucide',
};

const text = {
    id: 'icon-button-text',
    parentId: 'icon-button',
    type: 'text',
    content: 'Button',
};
```

<IconButton />

Queremos un `Button` con varias **variantes**, en el mismo espíritu que [Shadcn UI], para no tener que escribir la misma estructura una y otra vez:

```tsx
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
```

## Componentes y slots {#components-and-slots}

En los archivos `.pen`, el sistema `ref` + `descendants` es, en la práctica, un modelo de herencia de componentes pensado para la IA: el modelo no tiene que entender la pila de bajo nivel (rectángulo redondeado + texto + padding). Puede señalar un `round-button` ya existente en el sistema de diseño y sobrescribir la etiqueta. Es la misma idea de «heredar y después sobrescribir» que en el código. Consulta [Components and Instances].

```json
{
    "id": "round-button",
    "type": "g",
    "reusable": true,
    "cornerRadius": 9999,
    "children": [
        {
            "id": "label",
            "type": "text",
            "content": "Submit",
            "fill": "#000000"
            ...
        }
    ]
}

{
    "id": "save-round-button",
    "type": "ref",
    "ref": "round-button",
    "descendants": { "label": { "content": "Save" } }
}
```

<ComponentsInstances />

## Diseño ↔ código {#design-to-code}

[Design ↔ Code]

La idea clave de [Design ↔ Code] es que el paso de diseño a código **no** es una conjetura de la IA de píxel a código. Como el formato `.ic` ya codifica primitivas cómodas para el código (layout flex, variables de diseño, componentes `reusable`/`ref`, nombres semánticos y fuentes de iconos), el grafo de escena **es** una IR hecha para el código. Así, el núcleo es un **transpilador determinista**, y la IA solo ayuda en la capa de nombres y de limpieza de la estructura.

### Canalización {#design-to-code-pipeline}

Seguimos la canalización de exportación SVG, pero insertamos una **IR de código** independiente del framework, de modo que añadir un framework de destino nuevo sea solo un emisor más:

```text
.ic SceneGraph
  → expandRefSerializedNodes   // reuse existing ref/reusable handling
  → CodeIR                     // element tree + structured style + token refs + component defs
  → Emitter                    // react-tailwind | html-css | ...
```

El nodo de la IR de código conserva: un **rol** (contenedor / texto / icono / imagen / forma), **referencias `$token` pendientes de resolver**, un **estilo flex** estructurado y las **relaciones de componentes** `reusable`/`ref`.

### Punto de entrada {#design-to-code-entry}

`API.exportCode` es la contraparte de `renderToSVG`. Sin argumentos, transpila toda la escena. Pasa nodos para transpilar una selección.

```ts
const code = api.exportCode(undefined, {
    framework: 'react-tailwind', // or 'html-css'
    variablesMode: 'css-var', // 'resolved' | 'preserve-token' | 'css-var'
    componentStructure: 'preserve', // 'preserve' | 'flatten'
});
```

También puedes llamar a la función pura de forma directa:

```ts
import { serializedNodesToCode } from '@infinite-canvas-tutorial/ecs';

const code = serializedNodesToCode(nodes, {
    framework: 'react-tailwind',
    variables,
});
```

### Correspondencia de conceptos {#design-to-code-mapping}

Los nodos del lienzo se convierten en elementos de diseño, texto, imagen o SVG. `reusable` y `ref` corresponden a componentes e instancias React; las variables se exportan según el modo elegido. Consulta la [tabla completa](/es/guide/design-to-code-reference#concept-mapping).

### Modos de variables {#design-to-code-variable-modes}

Los tres modos de variables coinciden con la semántica de la exportación SVG:

-   `resolved` (predeterminado): resuelve `$token` a literales (p. ej., `bg-[#FFFFFF]`).
-   `css-var`: emite `var(--token)` para los estilos (p. ej., `bg-[var(--color-bg)]`). La exportación HTML/CSS incluye un bloque `:root { … }`. React limita el ámbito de las definiciones a cada componente exportado, incluidos los componentes reutilizables que se renderizan por su cuenta. Las instancias anidadas comparten el ámbito del padre, así que exportaciones separadas pueden usar valores distintos para el mismo token. Los tokens de contenido de texto se resuelven en sus valores actuales porque las propiedades personalizadas de CSS no pueden sustituir nodos de texto.
-   `preserve-token`: conserva `$token` (se envía a un `style` en línea para el posprocesado).

### Componentes e instancias {#design-to-code-components}

Con `componentStructure: 'preserve'` (predeterminado), cada `reusable` se exporta como componente React y cada `ref` como instancia. Las modificaciones admitidas de texto, estilo y diseño se convierten en props; otras expanden la instancia para conservar su apariencia.

Consulta las reglas para texto, imágenes, rellenos, Path, recortes y mezcla en los [detalles de exportación](/es/guide/design-to-code-reference).

```tsx
interface RoundButtonProps {
    label?: string;
}

export function RoundButton({ label = 'Submit' }: RoundButtonProps) {
    return (
        <div className="flex items-center justify-center w-[120px] h-[40px] rounded-[9999px]">
            <span>{label}</span>
        </div>
    );
}

export function Design() {
    return <RoundButton label="Save" />;
}
```

`componentStructure: 'flatten'` es el recurso de respaldo: expande cada instancia mediante `expandRefSerializedNodes` en DOM concreto, sin definiciones de componentes. El emisor HTML/CSS siempre aplana, porque HTML no tiene concepto de componente.

### Ejemplos de interfaces reales {#practical-interface-examples}

Prueba un panel de datos, una página de precios y una pantalla de pago móvil en el lienzo del editor IC. Edita los nodos y genera, copia o descarga código desde el lienzo actual. Selecciona HTML/CSS y usa **HTML preview** para ver el resultado. La página de precios utiliza una tarjeta reutilizable.

<DesignToCodeInterfaces />

Descarga `.ic` para seguir editando en la [aplicación en línea](https://app.infinitecanvas.cc/) o abre el HTML en el navegador. Para React, descarga el proyecto, descomprímelo y ejecuta `pnpm install` y `pnpm dev`. El código generado es la capa de presentación; conecta la navegación, los pagos y los datos en tu aplicación. Consulta los [detalles de exportación](/es/guide/design-to-code-reference#practical-interface-examples).

### Línea de comandos {#cli}

El repositorio también incluye una CLI sin conexión para archivos `.ic` (Node.js 20+). Exporta el diseño desde el editor con **Exportar como… > .ic** y guárdalo como `design.ic`. Desde la raíz del repositorio, construye sus dependencias del workspace en orden y después ejecuta:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @infinite-canvas-tutorial/device-api build:cjs
corepack pnpm --filter @infinite-canvas-tutorial/ecs build:cjs
corepack pnpm --filter @infinite-canvas-tutorial/cli build
node packages/cli/dist/cli.js validate design.ic
node packages/cli/dist/cli.js inspect design.ic --json
node packages/cli/dist/cli.js codegen design.ic --framework react-tailwind --variables-mode css-var --component-name Design --output Design.tsx
node packages/cli/dist/cli.js codegen design.ic --framework html-css --output design.html
```

`inspect --json` informa de los recuentos de nodos y de raíces, de los nodos reutilizables, de las variables y de los recuentos de URL de recursos. Si omites `--output`, el código generado se imprime en stdout. Los documentos o las opciones no válidos devuelven un estado de salida distinto de cero, con un mensaje de error. La CLI produce el mismo componente de React o el mismo fragmento HTML/CSS que el generador de código del editor. Usa las variables y el tema del documento, no accede a un proyecto en línea y rechaza las imágenes `blob:` temporales que no pueden sobrevivir fuera del navegador. Usa data URL o URL de imagen duraderas en los documentos exportados.

### Inverso: código → diseño {#design-to-code-reverse}

La dirección inversa (analizar el AST de JSX/HTML y volver a nodos `.ic`) es más difícil y más ambigua, así que se deja para una segunda fase. El primer hito recomendado es un **viaje de ida y vuelta idempotente** del código que emite este transpilador (diseño → código → diseño sin pérdida de información), antes de extenderlo a código escrito a mano de forma arbitraria.

## Lectura adicional {#extended-reading}

[Variables and Themes]: https://docs.pencil.dev/for-developers/the-pen-format#variables-and-themes
[Guide to variables in Figma]: https://help.figma.com/hc/en-us/articles/15339657135383-Guide-to-variables-in-Figma
[Using CSS custom properties (variables)]: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties
[Design ↔ Code]: https://docs.pencil.dev/design-and-code/design-to-code
[Lección 33 - Motor de layout]: /es/guide/lesson-033
[IconifyJSON]: https://iconify.design/docs/types/iconify-json.html
[Iconify Icon web component]: https://iconify.design/docs/iconify-icon/
[Lucide]: https://lucide.dev/icons
[Shadcn UI]: https://ui.shadcn.com/docs/components/radix/button
[Components and Instances]: https://docs.pencil.dev/for-developers/the-pen-format#components-and-instances
