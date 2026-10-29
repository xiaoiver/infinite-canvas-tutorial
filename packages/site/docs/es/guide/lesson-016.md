---
outline: deep
description: 'Explora las funciones avanzadas de texto, incluidos el renderizado con curvas de Bézier, los trazos de texto, las decoraciones, las sombras, el texto sobre un trazado y la edición interactiva de texto con selección y soporte de accesibilidad.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lección 16 - Funciones avanzadas de texto',
          },
      ]
---

<script setup>
import WebFontLoader from '../../components/WebFontLoader.vue';
import Opentype from '../../components/Opentype.vue';
import Harfbuzz from '../../components/Harfbuzz.vue';
import TeXMath from '../../components/TeXMath.vue';
import TextDropShadow from '../../components/TextDropShadow.vue';
import TextStroke from '../../components/TextStroke.vue';
import TextDecoration from '../../components/TextDecoration.vue';
import TextPath from '../../components/TextPath.vue';
import PhysicalText from '../../components/PhysicalText.vue';
import TextEditor from '../../components/TextEditor.vue';
</script>

# Lección 16 - Funciones avanzadas de texto {#lesson-16-text-advanced-features}

En la lección anterior presentamos los principios del renderizado de texto basado en SDF, experimentamos con ESDT y MSDF para mejorar la calidad del renderizado y mencionamos las funciones avanzadas de renderizado de texto que CanvasKit ofrece frente a Canvas.

En esta lección veremos primero métodos de renderizado más allá del SDF y, después, comentaremos e intentaremos implementar funciones como las líneas decorativas, las sombras y el texto que sigue trazados. Por último, el texto no solo debe poder renderizarse, sino también tener una buena interacción: trataremos temas como los cuadros de entrada, la selección de texto y la A11y.

Veamos primero qué métodos de renderizado de texto hay además del SDF.

## Renderizar texto con curvas de Bézier {#render-text-with-bezier-curve}

Con la función de exportación a SVG de Figma puedes ver que su texto también se renderiza con Paths. Si no tenemos en cuenta el rendimiento del renderizado ni los caracteres CJK, usar curvas de Bézier para renderizar texto es, en efecto, una buena elección. Para obtener la información vectorial de los caracteres en un entorno de navegador, podemos usar:

-   [opentype.js]
-   use-gpu usa [use-gpu-text], que está envuelto a partir de [ab-glyph](https://github.com/alexheretic/ab-glyph)
-   Cada vez más aplicaciones usan [harfbuzzjs]; consulta: [Estado del renderizado de texto en 2024]. Por ejemplo, [font-mesh-pipeline] es una demostración sencilla

A continuación mostraremos ejemplos de renderizado de texto con opentype.js y harfbuzzjs, y ambos admiten el formato de fuente `ttf`.

### opentype.js {#opentypejs}

opentype.js ofrece el método `getPath`, que completa el shaping y obtiene los [path-commands] de SVG a partir del contenido del texto, la posición y el tamaño de fuente.

```ts
opentype.load('fonts/Roboto-Black.ttf', function (err, font) {
    const path = font.getPath('Hello, World!', 0, 0, 32); // x, y, fontSize
    // convert to svg path definition
});
```

<Opentype />

### harfbuzzjs {#harfbuzzjs}

Primero se inicializa el WASM de harfbuzzjs con la sintaxis ?init de Vite. Después se carga el archivo de fuente y se crea un objeto de fuente.

```ts
import init from 'harfbuzzjs/hb.wasm?init';
import hbjs from 'harfbuzzjs/hbjs.js';

const instance = await init();
hb = hbjs(instance);

const data = await (
    await window.fetch('/fonts/NotoSans-Regular.ttf')
).arrayBuffer();
blob = hb.createBlob(data);
face = hb.createFace(blob, 0);
font = hb.createFont(face);
font.setScale(32, 32); // Set font size
```

Después se crea un objeto buffer y se añade el contenido del texto. Como ya se dijo, harfbuzz no maneja BiDi, así que hay que fijar a mano la dirección del texto. Por último, se llama al método hb.shape para hacer el cálculo de shaping.

```ts
buffer = hb.createBuffer();
buffer.addText('Hello, world!');
buffer.guessSegmentProperties();
// TODO: use BiDi
// buffer.setDirection(segment.direction);

hb.shape(font, buffer);
const result = buffer.json(font);
```

Ahora tenemos los datos del glifo y podemos usar Path para dibujarlo.

```ts
result.forEach(function (x) {
    const d = font.glyphToPath(x.g);
    const path = new Path({
        d,
        fill: '#F67676',
    });
});
```

<Harfbuzz />

### Renderizado de matemáticas TeX {#tex-math-rendering}

Podemos usar [MathJax] para renderizar fórmulas matemáticas de TeX, convertirlas a SVG y después renderizarlas con Path. Aquí seguimos el enfoque de [LaTeX en motion-canvas] para obtener el SVGElement:

```ts
const JaxDocument = mathjax.document('', {
    InputJax: new TeX({ packages: AllPackages }),
    OutputJax: new SVG({ fontCache: 'local' }),
});

const svg = Adaptor.innerHTML(JaxDocument.convert(formula));
const parser = new DOMParser();
const doc = parser.parseFromString(svg, 'image/svg+xml');
const $svg = doc.documentElement;
```

Después usamos el método presentado en [Lección 10 - De SVGElement a nodo serializado] para convertir el SVGElement en gráficos y añadirlos al lienzo.

```ts
const root = await deserializeNode(fromSVGElement($svg));
```

<TeXMath />

## Trazo de texto {#text-stroke}

Tanto [strokeText] en Canvas como [-webkit-text-stroke] en CSS ofrecen trazos de texto. La buena noticia es que los trazos son fáciles de implementar de forma natural en SDF:

```glsl
if (strokeWidth > 0.0 && strokeColor.a > 0.0) {
    float fillAlpha = smoothstep(buff - gamma_scaled, buff + gamma_scaled, dist);
    float strokeThreshold = buff - strokeWidth / fontSize;
    float strokeAlpha = smoothstep(strokeThreshold - gamma_scaled, strokeThreshold + gamma_scaled, dist);

    vec4 finalColor = mix(strokeColor, fillColor, fillAlpha);
    outputColor = finalColor;
    opacity *= strokeAlpha;
}
```

A continuación se muestran renderizados basados en SDF y MSDF, y se puede ver que MSDF se mantiene nítido incluso con trazo:

<TextStroke />

## Decoración de texto {#text-decoration}

En CSS, los navegadores antiguos tenían una implementación tosca de [text-decoration], ejemplificada por `underline`, de donde se toma la imagen siguiente: [Elaborar subrayados de enlaces en Medium]

![Feos. Distraen. Subrayados inaceptables](https://miro.medium.com/v2/resize:fit:2000/format:webp/1*RmN57MMY_q9-kEt7j7eiVA.gif)

> El subrayado perfecto debe ser visible, pero discreto: tiene que permitir que la gente se dé cuenta de qué es clicable, sin atraer demasiada atención sobre sí mismo. Debe situarse a la distancia justa del texto y quedar cómodamente detrás de él cuando los descendentes quieran ocupar el mismo espacio:

![Subrayado bonito](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*5iD2Znv03I2XR5QI3KLJrg.png)

Los navegadores actuales han perfeccionado esta implementación. Además, Canvas no ofrece esta función, y CanvasKit la amplía con un conjunto de propiedades que corresponden al `text-decoration` de CSS:

```ts
// @see https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration#constituent_properties
// @see https://skia.org/docs/dev/design/text_shaper/#principles
const paraStyle = new CanvasKit.ParagraphStyle({
    textStyle: {
        decoration: CanvasKit.UnderlineDecoration,
        decorationColor,
        decorationThickness,
        decorationStyle: CanvasKit.DecorationStyle.Solid,
    },
});
```

Otra implementación interesante, [underlineJS], se basa en Canvas.

### Usar polilínea {#use-polyline}

El estilo de la línea de decoración lo controla la propiedad `decorationStyle`:

```ts
export type TextDecorationStyle =
  | 'solid'
  | 'double'
  | 'dotted'
  | 'dashed'
  | 'wavy';
: TextDecorationStyle;
```

En el estilo `solid` más sencillo, por ejemplo, pasamos `decorationColor` y `decorationThickness` como `strokeColor` y `strokeWidth`:

```ts
if (instance instanceof Text) {
    const {
        decorationColorRGB,
        decorationThickness,
        decorationStyle,
        metrics,
    } = instance;
    u_StrokeColor = [
        decorationColorRGB.r / 255,
        decorationColorRGB.g / 255,
        decorationColorRGB.b / 255,
        fo,
    ];
    u_ZIndexStrokeWidth[1] = decorationThickness;
}
```

### Estilo de decoración {#decoration-style}

La propia Polyline admite `strokeDasharray`, así que tanto `dotted` como `dashed` se pueden lograr con ella. Aquí nos referimos a la implementación de Skia para fijar la proporción entre `dash` y `gap`:

```c++
// @see https://github.com/google/skia/blob/main/modules/skparagraph/src/Decorations.cpp#L187
SkScalar scaleFactor = textStyle.getFontSize() / 14.f;
switch (textStyle.getDecorationStyle()) {
    case TextDecorationStyle::kDotted: {
        dashPathEffect.emplace(1.0f * scaleFactor, 1.5f * scaleFactor);
        break;
    }
    case TextDecorationStyle::kDashed: {
        dashPathEffect.emplace(4.0f * scaleFactor, 2.0f * scaleFactor);
        break;
    }
    default: break;
}
```

En concreto, hay que calcular y muestrear las líneas `wavy`, lo que haremos aquí generando un Path de SVG y usando el método descrito en [Lección 13 - Muestreo en una curva]:

```c++
// @see https://github.com/google/skia/blob/main/modules/skparagraph/src/Decorations.cpp#L215
let d = 'M 0 0';
while (x_start + quarterWave * 2 < line.width) {
    d += ` Q ${x_start + quarterWave} ${
        wave_count % 2 != 0 ? quarterWave : -quarterWave
    } ${x_start + quarterWave * 2} 0`;

    x_start += quarterWave * 2;
    ++wave_count;
}
```

El efecto es el siguiente:

<TextDecoration />

### Calcular la posición {#calculate-position}

La posición la controla la propiedad `decorationLine`:

```ts
export type TextDecorationLine =
    | 'underline'
    | 'overline'
    | 'line-through'
    | 'none';
```

Nos referimos a la implementación de Skia [Decorations::calculatePosition] para `underline` como ejemplo:

```c++
void Decorations::calculatePosition(TextDecoration decoration, SkScalar ascent) {
    switch (decoration) {
        case TextDecoration::kUnderline:
            if ((fFontMetrics.fFlags & SkFontMetrics::FontMetricsFlags::kUnderlinePositionIsValid_Flag) &&
                fFontMetrics.fUnderlinePosition > 0) {
                fPosition  = fFontMetrics.fUnderlinePosition;
            } else {
                fPosition = fThickness;
            }
            fPosition -= ascent;
            break;
    }
}
```

### Exportar SVG {#export-svg-text-decoration}

Por desgracia, a día de hoy (2025.7.9), SVG no admite por completo [text-decoration]. En la imagen de la derecha, de abajo, text-decoration-color no respeta el azul que fijamos, sino que lo sustituye el color del texto, y text-decoration-style no se admite en absoluto. Consulta: [Decoración de texto de un texto SVG en HTML].

> Al parecer, text-decoration-color no se aplica a los elementos de texto SVG

En Figma se evita esto exportando como `<path>`. Nosotros seguimos queriendo conservar `<text>`, así que, al exportar SVG, solo podemos usar envoltorios `<foreignObject>`; mira a la izquierda, abajo:

```html
<foreignObject width="50" height="20">
    <span style="text-decoration: underline; text-decoration-color: blue;">
        Text
    </span>
</foreignObject>
```

<svg viewBox="0 0 100 20">
  <foreignObject width="50" height="20">
    <span style="text-decoration: underline; text-decoration-color: blue;">
      Text
    </span>
  </foreignObject>
  <text x="50" y="17" style="text-decoration: underline; text-decoration-color: blue;"  >
    Text
  </text>
</svg>

## Sombras {#dropshadow}

Pixi.js ofrece [DropShadowFilter], pero podemos implementarlo directamente en SDF sin usar posprocesado. Usa `shadowOffset` y `shadowBlurRadius` para controlar el desplazamiento y el desenfoque de la textura SDF.

```glsl
// @see https://github.com/soimy/pixi-msdf-text/blob/master/src/msdf.frag#L49
vec3 shadowSample = texture2D(uSampler, vTextureCoord - shadowOffset).rgb;
float shadowDist = median(shadowSample.r, shadowSample.g, shadowSample.b);
float distAlpha = smoothstep(0.5 - shadowSmoothing, 0.5 + shadowSmoothing, shadowDist);
vec4 shadow = vec4(shadowColor, shadowAlpha * distAlpha);
gl_FragColor = mix(shadow, text, text.a);
```

<TextDropShadow />

## Texto a lo largo de un trazado {#text-along-path}

En la comunidad de Figma, muchos usuarios esperan esta función; por ejemplo: [Hacer que el texto siga un trazado o un círculo]. Hace poco recibió soporte oficial: [Escribir texto sobre un trazado].

![Escribir texto sobre un trazado](https://help.figma.com/hc/article_attachments/31937313416471)

En SVG, esto se puede lograr con [textPath]; consulta: [Texto curvo a lo largo de un trazado]

```html
<path
    id="curve"
    d="M73.2,148.6c4-6.1,65.5-96.8,178.6-95.6c111.3,1.2,170.8,90.3,175.1,97"
/>
<text width="500">
    <textPath xlink:href="#curve"> Dangerous Curves Ahead </textPath>
</text>
```

Skia ofrece el método `MakeOnPath`; consulta [Dibujar texto a lo largo de un trazado]:

```ts
const textblob = CanvasKit.TextBlob.MakeOnPath(text, skPath, skFont);
canvas.drawTextBlob(textblob, 0, 0, textPaint);
```

En Mapbox, colocar etiquetas a lo largo de carreteras y ríos es un escenario habitual; consulta [Colocación de etiquetas de mapa en Mapbox GL]

![Colocación de etiquetas de mapa en Mapbox GL](https://miro.medium.com/v2/resize:fit:480/format:webp/0*qVAASwC-tjIXnjax.gif)

Kittl ofrece una herramienta [Escribe texto con facilidad sobre cualquier trazado].

Consulta [fabricjs - texto sobre un trazado] para otra implementación. Coloca cada glifo según la **longitud de arco** en el centro de su caja de avance y, después, usa la tangente a esa misma distancia para su orientación. Un parámetro de Bézier `t` no es, en general, una fracción de longitud: el muestreo del punto y de la tangente debe usar la misma correspondencia de longitud de arco, como se describe en [Lección 13 - Muestreo en una curva].

```ts
const centerDistance =
    startOffset + alignmentOffset + advanceBefore + advance / 2;
const ratio = centerDistance / totalPathLength;
const point = curve.getPointAt(ratio);
const tangent = curve.getTangentAt(ratio);
```

El ancho de avance sitúa el glifo siguiente. Difiere del ancho de la textura, de los bearings de tinta y del padding del SDF. `letterSpacing` solo se aplica entre glifos adyacentes.

### Ajustar la rotación {#adjust-rotation}

La implementación rota cada quad en la CPU alrededor del **origen de la línea base del glifo** y después lo renderiza con SDF/MSDF. Rotar alrededor del borde inferior de la textura desplazaría el texto de forma distinta para cada fuente y cada tamaño.

```ts
const rotation = Math.atan2(tangent[1], tangent[0]);
const x =
    point[0] -
    (Math.cos(rotation) * advance) / 2 -
    Math.sin(rotation) * pathOffset;
const y =
    point[1] -
    (Math.sin(rotation) * advance) / 2 +
    Math.cos(rotation) * pathOffset;
```

Este ejemplo usa la línea base `alphabetic`; otros ajustes de `textBaseline` también siguen la normal local. Los límites son la unión de los rectángulos de tinta de los glifos rotados, así que cambiar el contenido, el tamaño, el trazado o los desplazamientos también actualiza los límites de selección.

| Atributo        | Comportamiento                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `textAlign`     | `start` / `left`, `center` o `end` / `right`, respecto a la longitud disponible del trazado                              |
| `startOffset`   | Desplaza el texto alineado a lo largo de su dirección de lectura, en unidades del documento                              |
| `side`          | `left` sigue el trazado; `right` recorre desde el otro extremo y rota los glifos conservando el orden de lectura         |
| `pathOffset`    | Desplaza la línea base a lo largo de la normal local; los valores positivos quedan a 90° en sentido horario desde la tangente de la dirección de lectura |
| `letterSpacing` | Añade distancia entre glifos adyacentes                                                                                  |

En los trazados abiertos, los glifos cuyo centro cae más allá de cualquiera de los extremos se omiten, en lugar de dar la vuelta o amontonarse en un extremo. Un único contorno cerrado puede cruzar su costura con desplazamientos positivos o negativos, con como máximo una vuelta por línea. Las subrutas separadas concatenan sus longitudes sin inventar una línea a través de los huecos de `M`. Las líneas adicionales siguen la normal local con el espaciado de su line-height.

Arrastra el texto o el control azul a lo largo del trazado, y arrastra los puntos de control naranjas para cambiar la forma de la curva. Alterna entre una curva, un círculo y una línea, cambia de lado y de alineación, o ajusta el espaciado y la distancia a la línea base. Los controles admiten las teclas de flecha, Shift para pasos más grandes y Esc para cancelar; un gesto táctil cancelado restaura su estado inicial.

<TextPath />

Este ejemplo usa el renderizador de texto SDF de `core`. Las mejoras de maquetación y edición del trazado conservan el pipeline de grafemas existente; no añaden shaping completo de OpenType ni soporte de ligaduras.

ECS también admite estos atributos de trazado, con gestos del transformador, picking de glifos, deshacer/rehacer y edición de texto. Prueba el [ejemplo de texto sobre trazado en ECS](/example/text-path#ecs-editor); la edición usa un cuadro de texto recto y, al confirmar, se restaura la maquetación curva.

### Exportar SVG {#export-svg-text-path}

SVG nativo admite [textPath], como se muestra abajo; consulta [Texto curvo a lo largo de un trazado]. El exportador comparte la maquetación del lienzo y emite elementos `<tspan>` posicionados con `x`, `y` y `rotate` para conservar los cambios de lado, el recorte por desbordamiento y las costuras cerradas en navegadores con distinto soporte de `textPath side`. La serialización JSON conserva el trazado, el lado, la alineación y los desplazamientos para seguir editando después de importar.

```html
<path
    id="MyPath"
    fill="none"
    stroke="red"
    d="M10,90 Q90,90 90,45 Q90,10 50,10 Q10,10 10,40 Q10,70 45,70 Q70,70 75,50"
></path>
<text>
    <textPath href="#MyPath">Quick brown fox jumps over the lazy dog.</textPath>
</text>
```

<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <!-- para ocultar el trazado, normalmente se envuelve en un elemento <defs> -->
  <!-- <defs> -->
  <path id="MyPath" fill="none" stroke="red" d="M10,90 Q90,90 90,45 Q90,10 50,10 Q10,10 10,40 Q10,70 45,70 Q70,70 75,50"></path>
  <!-- </defs> -->

  <text>
    <textPath href="#MyPath">Quick brown fox jumps over the lazy dog.</textPath>
  </text>
</svg>

## Interacción más amigable {#more-friendly-interaction}

Los `<textarea>` nativos del navegador ofrecen funciones cómodas como cursores parpadeantes, selecciones, control por teclado, copiar y pegar, etc. Si quieres implementar estas funciones desde cero sobre `<canvas>`, sería una tarea muy tediosa, por ejemplo [fabricjs - cargar fuentes personalizadas] y google docs, así que no elegiremos esta opción.

<TextEditor />

### Entrada de texto {#textarea}

Abajo, a partir de Figma, se puede ver que el elemento nativo `<textarea>` se usa para posicionarse sobre el lienzo y, cuando se hace doble clic en Text, se muestra el cuadro de entrada:

![textarea en Figma](/textarea-in-figma.png)

Esto también se usa en excalidraw; consulta: [textWysiwyg.tsx].

![Editor de texto en excalidraw](/excalidraw-text-editor.png)

También añadimos un elemento `<ic-text-editor>` para que se ajuste lo más posible al renderizado de Text en el lienzo. El elemento nativo `<textarea>` se reinicia en cuanto a estilo, por ejemplo sin mostrar bordes ni fondos. Las propiedades `fontFamily`, `fontSize` y `color` tienen propiedades CSS correspondientes que se pueden fijar directamente, pero hay que tener en cuenta varios factores al usar posicionamiento absoluto:

```ts
@customElement('ic-text-editor')
export class TextEditor extends LitElement {
    static styles = css`
        :host {
            position: absolute;
        }
        textarea {
            position: absolute;
            display: none;
            margin: 0;
            padding: 0;
            border: 0;
            outline: 0;
            resize: none;
            background: transparent;
        }
    `;

    @query('textarea')
    editable: HTMLTextAreaElement;

    render() {
        return html`<textarea></textarea>`;
    }
}
```

Primero hay que convertir las coordenadas de posición del evento de ratón del doble clic al sistema de coordenadas del viewport:

```ts
const { x, y } = this.api.canvas2Viewport({
    x: this.node.x,
    y: this.node.y,
});

this.editable.style.left = `${x}px`;
this.editable.style.top = `${y}px`;
```

Después hay que tener en cuenta el nivel de zoom actual de la cámara:

```ts
const { zoom } = this.api.getCamera().read(ComputedCamera);
this.editable.style.transform = `scale(${zoom})`;
this.editable.style.transformOrigin = `left top`;
```

Por último, queremos que el desplazamiento sobre el elemento `<textarea>` no dispare el comportamiento predeterminado del navegador, sino que lo atraviese y lo dispare sobre el elemento `<canvas>`, que realiza las operaciones de paneo y zoom de la cámara:

```ts
handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const newWheelEvent = new WheelEvent('wheel', {});
    $canvas.dispatchEvent(newWheelEvent);
};
```

El efecto es el siguiente:

![paneo y zoom con la cámara](/text-editor-with-camera.gif)

### Calcular el tamaño cuando cambia el texto {#calculate-size}

Hay que volver a calcular y fijar el ancho y el alto de `<textarea>` al escribir y al pegar texto en tiempo real.

### Manejar Tab {#in-and-outdent}

El comportamiento predeterminado de pulsar la tecla Tab en `<textarea>` es cambiar el foco al elemento siguiente. Queremos que sea igual que en el editor de código.

[excalidraw - manejar Tab]

### Selección de texto {#text-selection}

Cuando ya se puede superponer un textarea sobre Text, es fácil implementar esta función.

## Efectos especiales {#special-effects}

### Cargar fuentes web {#load-web-font}

Para las soluciones que usan la API de Canvas2D para generar el SDF, basta con usar [webfontloader] para cargar primero las fuentes y después indicar la fuente con `fontFamily`.

```ts
import WebFont from 'webfontloader';
WebFont.load({
    google: {
        families: ['Gaegu'], // specify font
    },
    active: () => {
        const text = new Text({
            x: 150,
            y: 150,
            content: 'Hello, world',
            fontFamily: 'Gaegu', // specify font
            fontSize: 55,
            fill: '#F67676',
        });
    },
});
```

<WebFontLoader />

También puedes cambiar al modo Text y seleccionar la fuente personalizada `Gaegu` en el ejemplo de la página de inicio:

![WebFont en el lápiz de texto](/webfont-in-text-pen.png)

### Material Design en la GPU {#material-design-on-the-gpu}

[Material Design en la GPU] presenta un efecto de material basado en texto SDF, que usa mapas de normales e iluminación para simular la tinta que se extiende sobre el papel. No necesitamos tener en cuenta la iluminación: basta con usar ruido simplex para implementarlo y añadir varios efectos de absorción:

```js
import { simplex_2d } from './simplex-2d';
import { aastep } from './aastep';
export const absorb = /* wgsl */ `
  ${aastep}
  ${simplex_2d}
  float absorb(float sdf, vec2 uv, float scale, float falloff) {
    float distort = sdf + snoise(uv * scale) * falloff;
    return aastep(0.5, distort);
  }
`;
```

<PhysicalText />

## Lectura adicional {#extended-reading}

-   [Material Design en la GPU]
-   [Hacer que el texto siga un trazado o un círculo]
-   [Texto curvo a lo largo de un trazado]
-   [Dibujar texto a lo largo de un trazado]
-   [textPath]
-   [Colocación de etiquetas de mapa en Mapbox GL]

[Material Design en la GPU]: https://mattdesl.svbtle.com/material-design-on-the-gpu
[Hacer que el texto siga un trazado o un círculo]: https://forum.figma.com/t/make-text-follow-a-path-or-a-circle/23476/34
[Texto curvo a lo largo de un trazado]: https://css-tricks.com/snippets/svg/curved-text-along-path/
[Dibujar texto a lo largo de un trazado]: https://fiddle.skia.org/c/@Canvas_drawTextRSXform
[textPath]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/textPath
[Colocación de etiquetas de mapa en Mapbox GL]: https://blog.mapbox.com/map-label-placement-in-mapbox-gl-c6f843a7caaa
[font-mesh-pipeline]: https://github.com/beanandbean/font-mesh-pipeline
[opentype.js]: https://github.com/opentypejs/opentype.js
[use-gpu-text]: https://gitlab.com/unconed/use.gpu/-/tree/master/rust/use-gpu-text
[harfbuzzjs]: https://github.com/harfbuzz/harfbuzzjs
[Estado del renderizado de texto en 2024]: https://behdad.org/text2024/
[webfontloader]: https://github.com/typekit/webfontloader
[DropShadowFilter]: https://pixijs.io/filters/docs/DropShadowFilter.html
[MathJax]: https://github.com/mathjax/MathJax-src
[LaTeX en motion-canvas]: https://github.com/motion-canvas/motion-canvas/issues/190
[Lección 10 - De SVGElement a nodo serializado]: /es/guide/lesson-010#svgelement-to-serialized-node
[path-commands]: https://github.com/opentypejs/opentype.js?tab=readme-ov-file#path-commands
[text-decoration]: https://developer.mozilla.org/en-US/docs/Web/CSS/text-decoration
[Escribe texto con facilidad sobre cualquier trazado]: https://www.kittl.com/article/easily-type-text-on-any-path
[textWysiwyg.tsx]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/wysiwyg/textWysiwyg.tsx
[fabricjs - texto sobre un trazado]: https://fabricjs.com/demos/text-on-path/
[fabricjs - cargar fuentes personalizadas]: https://fabricjs.com/demos/loading-custom-fonts/
[excalidraw - manejar Tab]: https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/wysiwyg/textWysiwyg.tsx#L412-L429
[underlineJS]: https://github.com/wentin/underlineJS
[Elaborar subrayados de enlaces en Medium]: https://medium.design/crafting-link-underlines-on-medium-7c03a9274f9
[-webkit-text-stroke]: https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-text-stroke
[strokeText]: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/strokeText
[Decorations::calculatePosition]: https://github.com/google/skia/blob/main/modules/skparagraph/src/Decorations.cpp#L161-L185
[Lección 13 - Muestreo en una curva]: /es/guide/lesson-013#sample-on-curve
[Decoración de texto de un texto SVG en HTML]: https://stackoverflow.com/questions/76894327/text-decoration-of-a-text-svg-in-html
[Escribir texto sobre un trazado]: https://help.figma.com/hc/en-us/articles/360039956434-Guide-to-text-in-Figma-Design#h_01JTH0B6GEA7AVVXVS72X7ANHK
