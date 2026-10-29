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

| Concepto de `.ic` | Salida de código |
| --- | --- |
| `rect`/`g` + `display: flex` | `<div>` + utilidades de flex (`flex items-center …`) |
| Dirección de flex, alineación, tamaño, huecos y padding | Utilidades flex de Tailwind / CSS |
| `x` / `y` de un hijo dentro de un contenedor que no es flex | Posicionamiento absoluto respecto de ese contenedor |
| `cornerRadius` / `fills` / `strokes` / `dropShadow` | `rounded-* / bg-* / border / shadow-*` |
| `rect` con un relleno de imagen | `<img src>` con `object-fit` / `object-position` |
| `rect` con un solo relleno de degradado CSS | `background-image` de CSS |
| `ellipse` | `border-radius: 50%` de CSS |
| `path` hoja con relleno y trazo sólidos | `<path>` de SVG en línea con geometría vectorial |
| `line` / `polyline` hoja con trazo sólido | `<path>` de SVG en línea con geometría vectorial abierta |
| `rect` / `ellipse` + `clipMode: clip` | `overflow: hidden` de CSS en el elemento de recorte |
| `rotation` / `scaleX` / `scaleY` | `transform` de CSS alrededor de la esquina superior izquierda local |
| `blendMode` a nivel de nodo | `mix-blend-mode` de CSS |
| `visibility: hidden` / `visible` | Visibilidad de CSS sin quitar el espacio de layout |
| `text` + `content` | nodo de texto; un contenido `$token` conocido → valor de texto |
| línea, estilo, color y grosor de la decoración del texto | `text-decoration` de CSS |
| `fontVariant` / `fontKerning` | `font-variant` / `font-kerning` de CSS |
| `wordWrap` / `wordWrapWidth` | `white-space`, `overflow-wrap` y `max-width` |
| `maxLines` / `textOverflow` | line clamp de CSS o un recuento de líneas recortado |
| `iconfont` (lucide) | `lucide-react` `<Search />` |
| `iconfont` (otras familias) | `@iconify/react` `<Icon icon="family:name" />` |
| variable `$color.bg` | `bg-[var(--color-bg)]` (css-var) / literal (resolved) |
| raíz `reusable` | una definición de componente de React |
| anulaciones de `ref` + `descendants` | una instancia de componente con props |
| `name` | nombre de componente / prop / clase |

### Modos de variables {#design-to-code-variable-modes}

Los tres modos de variables coinciden con la semántica de la exportación SVG:

-   `resolved` (predeterminado): resuelve `$token` a literales (p. ej., `bg-[#FFFFFF]`).
-   `css-var`: emite `var(--token)` para los estilos (p. ej., `bg-[var(--color-bg)]`). La exportación HTML/CSS incluye un bloque `:root { … }`. React limita el ámbito de las definiciones a cada componente exportado, incluidos los componentes reutilizables que se renderizan por su cuenta. Las instancias anidadas comparten el ámbito del padre, así que exportaciones separadas pueden usar valores distintos para el mismo token. Los tokens de contenido de texto se resuelven en sus valores actuales porque las propiedades personalizadas de CSS no pueden sustituir nodos de texto.
-   `preserve-token`: conserva `$token` (se envía a un `style` en línea para el posprocesado).

### Componentes e instancias {#design-to-code-components}

Con `componentStructure: 'preserve'` (el valor predeterminado, y el argumento de venta de Pencil), cada raíz `reusable` se convierte en un componente y cada `ref` se convierte en una instancia. Los atributos que se pueden sobrescribir (`content`, `fills`, tipografía, incluidos `fontVariant` y `fontKerning`, decoración del texto, `opacity`, `visibility`, `cornerRadius`, `width`/`height` explícitos, `minWidth`/`maxWidth`/`minHeight`/`maxHeight`, `padding`, `margin`, huecos de flex, `flexDirection`, `alignItems`, `justifyContent`, `flexWrap`, `alignSelf`, `flexGrow`, `flexShrink`, `flexBasis`, `strokeWidth`, `strokes` y los campos de sombra paralela) que aparecen entre las instancias se elevan a props, con el valor de la plantilla como predeterminado. Los valores numéricos de `lineHeight` son alturas en píxeles en `.ic`, así que la salida de React añade `px` en lugar de tratarlos como multiplicadores sin unidad. Un `fontKerning` booleano se convierte en el CSS `normal` o `none`. Los arrays de espaciado se convierten en cadenas abreviadas de CSS, los campos de decoración del texto se combinan en una sola prop y los campos de sombra se combinan en una sola prop `boxShadow`. Una decoración con grosor cero se renderiza como `none`, igual que en el lienzo:

Las exportaciones de texto usan una altura de línea sin unidad de `1.2` cuando no hay un `lineHeight` explícito, para que el espaciado flex del navegador se mantenga cerca de las métricas de texto del lienzo. Un `lineHeight` numérico explícito se sigue exportando en píxeles. Los saltos de línea explícitos se conservan con `white-space: pre`. Cuando `wordWrap` está activado con un `wordWrapWidth` positivo, la salida usa `pre-wrap`, `overflow-wrap: anywhere` y esa anchura como máximo. Un `maxLines` positivo añade un line clamp de CSS para `ellipsis` (el valor predeterminado) o un límite de altura de línea recortado para `clip`. Editar la anchura de ajuste de un texto reutilizable que ya se ajusta se convierte en una prop del componente. Activar o desactivar el ajuste, o cambiar sus ajustes de truncado, expande la instancia para que el layout exportado siga la edición. El lienzo, por ahora, no aplica su ajuste `whiteSpace` al medir el texto. Las cadenas marcadoras personalizadas de `textOverflow` no tienen equivalente en el CSS estándar.

En una imagen reutilizable, cambiar solo la URL de la imagen vincula la anulación `fills` de la instancia a la prop `<img src>` del componente. Cambiar el tipo de relleno, el ajuste, la posición o la opacidad del relleno expande la instancia, para que el elemento y los estilos generados reflejen la edición. Una imagen hoja combina la opacidad de su único relleno con la opacidad del nodo en `<img>`. Un único relleno de imagen sobre una elipse se exporta como un `<img>` redondeado. Los rectángulos y las elipses con relleno de imagen que tienen hijos usan un envoltorio posicionado y colocan un `<img>` decorativo detrás de esos hijos. El envoltorio lleva la opacidad del nodo, y `<img>` lleva la opacidad del relleno, el ajuste y la posición.

Un rectángulo con un único relleno de degradado CSS activado, lineal, radial o cónico, exporta ese degradado como `background-image`. Editar solo su valor de degradado en una instancia se convierte en una prop del componente. Los rectángulos y las elipses con varios rellenos sólidos, de degradado admitido, de imagen o de patrón exportan fondos apilados en el orden de pintura. Un único patrón también se exporta como fondo CSS. La sintaxis `conic-gradient(circle at …)` del lienzo se convierte al CSS `conic-gradient(at …)`. Las capas de imagen admiten `fill`, `contain`, `cover`, `none`, `scale-down` y la posición, y mantienen el contenido hijo por encima de la pintura. Los patrones conservan su tamaño natural de tesela y su ajuste de repetición. Para las pinturas que necesitan opacidad independiente, `scale-down` de imagen o una transformación de patrón 2D admitida, el generador emite capas decorativas recortadas detrás de los hijos. Los modos de mezcla de capa que CSS admite siguen siendo locales a la pila de rellenos. Las transformaciones de patrón admiten `matrix`, `translate`, `scale`, `rotate`, `skewX` y `skewY` en rectángulos y elipses con dimensiones explícitas. El lienzo también decodifica imágenes de patrón basadas en URL y aplica estas transformaciones. Editar una pila o un patrón en una instancia reutilizable la expande. Otros formatos de degradado, la sintaxis de transformación de patrón no admitida y los modos de mezcla sin equivalente en CSS, como `linearBurn` y `linearDodge`, todavía necesitan un tratamiento aparte.

Un único relleno sólido con opacidad menor que 1 se exporta mediante el CSS `color-mix`, y conserva el alfa del relleno sin atenuar los elementos hijos. La opacidad del nodo sigue siendo un `opacity` de CSS aparte. Editar un relleno translúcido en una instancia reutilizable expande esa instancia, para que la pintura generada conserve su opacidad.

La rotación del nodo (almacenada en radianes) y `scaleX` / `scaleY` se exportan como una transformación CSS `rotate(...) scale(...)` con origen `0 0`, igual que el orden de transformación local del lienzo. Editar la transformación de una instancia expande esa instancia, para que la geometría cambiada entre en la exportación.

Los rectángulos y las elipses con `clipMode: clip` ahora recortan a sus hijos en el HTML y el React generados. Los rectángulos redondeados conservan su radio de esquina, y las elipses usan `border-radius: 50%`. Cambiar el modo de recorte de una instancia reutilizable expande esa instancia, para que se conserve su estado de recorte. Las máscaras `erase` y `soft` no tienen un equivalente directo de desbordamiento en CSS y no se exportan como recorte.

En un contenedor que no es flex, los hijos usan su `x` / `y` local del lienzo como posiciones CSS `left` / `top`. Los hijos flex permanecen en el flujo flex normal. Yoga fija de forma predeterminada su `flexShrink` en `0`, así que la exportación pone `flex-shrink: 0` salvo que el nodo indique otro valor. Una instancia de componente conservada dentro de un contenedor que no es flex recibe un envoltorio posicionado. Mover un hijo dentro de una instancia expande esa instancia para retener la edición. Cuando varios nodos de nivel superior tienen todos tamaños explícitos, la exportación también añade un marco relativo y conserva su espaciado, incluidos los límites rotados y volteados. Las raíces sin tamaños medibles conservan el flujo normal del documento.

La `visibility` a nivel de nodo se convierte en la `visibility` de CSS, así que los nodos ocultos conservan su espacio de layout. El estado predeterminado `inherited` usa la herencia de CSS. Cambiar la visibilidad de una instancia reutilizable se convierte en una prop del componente, incluidas las ediciones de los descendientes.

Los trazados con datos `d` válidos se exportan como SVG en línea, en lugar de un marcador de posición rectangular. Cuando un Path tiene hijos, su SVG se sitúa detrás de ellos en un envoltorio posicionado, y conserva el contorno vectorial y las coordenadas locales de cada hijo. Las capas de relleno hechas de colores sólidos, degradados lineales o radiales e imágenes se exportan como trazados SVG separados en el orden del lienzo, y conservan la opacidad de cada capa. Los modos de mezcla que CSS admite se aplican dentro de un grupo SVG aislado, así que solo se mezclan con las capas de relleno inferiores. Los trazos activos de esos tipos de pintura conservan su pintura, su opacidad, los marcadores de extremo de línea, triángulo o diamante, la regla de relleno, la anchura, el extremo, la unión, el límite de inglete y los ajustes de guion. Los trazados, las líneas y las polilíneas con varios trazos exportan cada trazo en el orden del lienzo, con geometría compartida y mezcla de capas admitida por CSS. Los trazados cerrados también conservan la alineación interior o exterior del trazo recortando o enmascarando cada capa. Los trazados abiertos siguen alineados al centro. Los degradados y las pinturas de imagen siguen el viewBox del trazado. Los rellenos de imagen de un Path admiten `fill`, `contain`, `cover`, `none` y `scale-down`, incluidas las posiciones porcentuales intermedias. Las alineaciones habituales de `fill` / `contain` / `cover` usan patrones SVG. Otros ajustes y posiciones usan un `foreignObject` SVG recortado con `object-fit` / `object-position` de CSS. Los trazos de imagen usan patrones SVG para `fill`, `contain` o `cover` en las posiciones 0 %, 50 % o 100 %. Un único trazo de imagen con otro ajuste o posición usa una imagen HTML posicionada y una máscara de geometría SVG, y conserva su extremo, su unión, sus marcadores de extremo y su alineación interior o exterior en Chromium y WebKit. Los trazos de imagen en capas con estos ajustes o posiciones también conservan el orden de pintura del lienzo, los modos de mezcla CSS admitidos, la opacidad y los marcadores de extremo, junto a las capas de trazo SVG. Usa una URL de imagen duradera o una data URL en el código exportado. Una sombra paralela sigue la ilustración SVG sin sombrear a los hijos de un Path. Las anulaciones de pintura, geometría, marcador, alineación del trazo o sombra de un Path en una instancia reutilizable expanden esa instancia, para que el SVG refleje la edición. Los modos de mezcla sin equivalente en CSS, como `linearBurn` y `linearDodge`, los degradados cónicos y de malla, y otros filtros de trazado, necesitan un tratamiento SVG aparte.

Las líneas y polilíneas hoja usan la misma canalización SVG. Sus extremos locales o su lista de puntos se convierten en un trazado abierto sin relleno. El viewBox del SVG sigue el origen local de la geometría y centra un eje de anchura cero o de altura cero, así que los trazados desplazados y los trazos finos horizontales o verticales siguen siendo visibles en el código generado. Su trazo puede usar una única pintura activa sólida, de degradado lineal, de degradado radial o de imagen. Las puntas de flecha de línea, triángulo y diamante usan marcadores SVG locales con la pintura del trazo. Las ediciones de geometría, pintura o marcador de una instancia reutilizable de línea o polilínea también expanden esa instancia. Otros efectos de línea todavía necesitan un tratamiento aparte.

El `blendMode` a nivel de nodo se convierte en `mix-blend-mode` de CSS, incluida una prop del componente cuando una instancia lo cambia. `light` se mapea al CSS `lighten`. Los modos sin equivalente en CSS siguen la exportación SVG y se renderizan como `normal`. El `blendMode` propio de una capa de relleno se mezcla con los otros rellenos de ese nodo y no se trata como `mix-blend-mode` a nivel de nodo.

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

Los ejemplos siguientes cargan un panel de analítica, una página de precios de SaaS y una pantalla de pago en móvil en el **lienzo del editor IC**. Las tres escenas usan layouts flex anidados y variables de color semánticas. El pago usa una mesa de trabajo estrecha de 390 × 844. Selecciona y edita nodos en el lienzo y después actualiza, copia o descarga el código generado a partir del documento actual del lienzo con `API.exportCode`. Con HTML/CSS seleccionado, usa **Vista previa HTML** para ver la página generada al tamaño de su mesa de trabajo en un marco aislado. Cambia de diseño para cargar otra escena editable.

Los ejemplos pasan a `API.exportCode` un mapa `semanticElements` indexado por identificador de nodo. Convierte los rectángulos y el texto seleccionados del lienzo en puntos de referencia HTML, encabezados y controles `<button type="button">` en ambas exportaciones. El mapa pertenece a la configuración de exportación de esta demostración. Conecta las acciones de los botones y la navegación en tu aplicación.

La página de precios usa una plantilla `reusable` de tarjeta de plan y tres instancias `ref`. El editor expande las instancias para renderizarlas y editarlas. Esta demostración reconcilia el texto, el color, la tipografía y la decoración del texto, la opacidad, el tamaño explícito y las restricciones de tamaño, el espaciado, la alineación flex y el tamaño de los ítems, el borde sólido y las ediciones de sombra paralela, y los devuelve a anulaciones de instancia para las descargas de React y de `.ic`. La tarjeta Growth muestra un borde de acento. Los valores numéricos de `flexBasis` y de restricción de tamaño se convierten en valores en píxeles en los estilos HTML/CSS y React. Si cambia la estructura de una tarjeta o una propiedad no admitida, la exportación usa sus nodos expandidos, para que el resultado siga coincidiendo con el lienzo.

Las tres exportaciones de React también se renderizan en una prueba de navegador con React 19 y Tailwind CSS 4. La prueba comprueba las posiciones clave del texto frente a la vista previa HTML, para que estos ejemplos sigan siendo ejecutables a medida que cambia el generador.

<DesignToCodeInterfaces />

Descarga el archivo `.ic` para seguir editando el diseño en la [aplicación en línea](https://app.infinitecanvas.cc/) mediante **Importar desde… > .ic**. Descarga el archivo HTML y ábrelo directamente en un navegador. Para React, elige **Descargar proyecto React** para obtener, a partir del lienzo actual, un ZIP de inicio con Vite, React 19 y Tailwind CSS 4. Descomprímelo y después ejecuta `pnpm install` y `pnpm dev`. El componente exportado está en `src/App.tsx`. La plantilla incluye la fuente Inter en local cuando el diseño la usa. Las imágenes `blob:` temporales del lienzo actual se copian en `public/assets` y se referencian con rutas locales. Las data URL permanecen en línea y las URL remotas siguen siendo remotas. Su `src/responsive.css` añade layouts de pantalla estrecha para estos tres ejemplos y conserva el componente del tamaño de la mesa de trabajo en `src/App.tsx`. También puedes descargar solo el archivo `.tsx` para un proyecto ya existente. El generador, por ahora, emite marcado de presentación. Conecta la navegación, las acciones de pago, los pagos y los datos en vivo a la lógica de tu aplicación después de exportar.

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
