---
outline: deep
description: 'Usa el posprocesado para tratar la imagen. Usa un grafo de renderizado para optimizar el pipeline.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lección 30 - Posprocesado y grafo de renderizado',
          },
      ]
---

<script setup>
import ImageProcessing from '../../components/ImageProcessing.vue'
import HalftoneDots from '../../components/HalftoneDots.vue'
import Pixelate from '../../components/Pixelate.vue'
import CRT from '../../components/CRT.vue'
import Glitch from '../../components/Glitch.vue'
import LiquidGlass from '../../components/LiquidGlass.vue'
import LiquidMetal from '../../components/LiquidMetal.vue'
import Heatmap from '../../components/Heatmap.vue'
import GenSmoke from '../../components/GenSmoke.vue'
import Ascii from '../../components/Ascii.vue'
import GlobalEffects from '../../components/GlobalEffects.vue'
</script>

# Lección 30 - Posprocesado y grafo de renderizado {#lesson-30-post-processing-and-render-graph}

En esta lección volvemos al posprocesado tradicional de imágenes basado en shaders (pasadas a pantalla completa, muestreo y efectos habituales) y, después, presentamos cómo usar un grafo de renderizado para organizar varias pasadas, gestionar los destinos de renderizado y la sincronización, y optimizar todo el pipeline de posprocesado.

## Efectos de posprocesado {#post-processing}

A partir de shaders se pueden lograr efectos habituales de procesamiento de imagen, como el desenfoque gaussiano, el ruido de Perlin, el glitch y, por supuesto, el «vidrio líquido» que se ha puesto de moda:

![fuente: https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers](/figma-liquid-glass.png)

![Ajuste en Photoshop Web](/adjust-ps-web.png)

Para más efectos, consulta:

-   [Procesamiento de imágenes]
-   [glfx.js]
-   [Paper Shaders]

En la implementación, los [filtros de Pixi.js] calculan el área de aplicación a partir de la caja delimitadora del objeto, renderizan el objeto en una textura de renderizado temporal y, después, aplican efectos de shader a esa textura.

### Renderizar en un RenderTarget {#render-to-render-target}

En Pixi.js:

```ts
// src/filters/FilterSystem.ts
const quadGeometry = new Geometry({
    attributes: {
        aPosition: {
            buffer: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
            format: 'float32x2',
            stride: 2 * 4,
            offset: 0,
        },
    },
    indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
});
```

### Muestreo {#sample}

A continuación hay que muestrear, desde la textura de todo el lienzo, el área en la que se encuentra la forma de destino:

```glsl
void main() {
  v_Uv = a_Position * (u_OutputFrame.zw / u_InputSize.xy) + u_OutputFrame.xy / u_InputSize.xy;

  gl_Position = vec4((a_Position * 2.0 - 1.0) * u_OutputTexture.xy / u_OutputFrame.zw * u_OutputTexture.z, 0.0, 1.0);
}
```

### Triángulo grande {#big-triangle}

Aquí podemos usar un triángulo a pantalla completa, que ahorra un vértice respecto a un Quad; consulta: [Optimizar triángulos para una pasada a pantalla completa]

![El rectángulo azul representa el viewport. El rojo es el contorno de la geometría](https://wallisc.github.io/assets/FullscreenPass/1tri.jpg)

```ts
this.#bigTriangleVertexBuffer = this.device.createBuffer({
    viewOrSize: new Float32Array([1, 3, -3, -1, 1, -1]),
    usage: BufferUsage.VERTEX,
    hint: BufferFrequencyHint.DYNAMIC,
});
```

El shader de vértices es muy sencillo; solo tiene que mapear correctamente las coordenadas de textura `v_Uv`:

```glsl
void main() {
  v_Uv = 0.5 * (a_Position + 1.0);
  gl_Position = vec4(a_Position, 0.0, 1.0);

  #ifdef VIEWPORT_ORIGIN_TL
    v_Uv.y = 1.0 - v_Uv.y;
  #endif
}
```

### Varios rellenos y orden de los filtros {#fill-filter-order}

En ECS, los filtros de ráster sobre primitivas SDF y Paths se ejecutan después de que los `fills` activados se hayan compuesto en el orden de pintado. La opacidad de capa y los modos de fusión participan en esa composición; la cadena de filtros procesa la textura resultante una sola vez, y la opacidad de la forma se aplica al dibujo final. Aplicar la misma cadena por separado a cada capa puede sustituir texturas que las capas anteriores todavía necesitan.

Por ejemplo, un relleno inferior rojo y un relleno superior azul con `opacity: 0.5` siguen viéndose púrpura bajo `brightness(0) contrast(0)`. Estos dos filtros usan la convención de ajuste de glfx, en la que cero es el valor neutro. Los efectos no neutros se ejecutan en el orden escrito en la cadena `filter`; intercambiar brillo y contraste puede cambiar el resultado.

Cambiar los rellenos o la geometría reconstruye la entrada de ráster afectada. Quitar los filtros de ráster libera la cadena fuera de pantalla, también cuando la forma vuelve al dibujo directo de color sólido. Las texturas intermedias de capa se liberan después de la composición, y las texturas de renderizado asociadas se liberan a través de sus destinos de renderizado.

### Alfa en los filtros de color {#filter-alpha}

Los ajustes de brillo, contraste, tono/saturación, ruido, puntos y semitono de color operan sobre RGB no premultiplicado, con independencia del alfa de la pintura. Las texturas de relleno por forma almacenan RGBA no premultiplicado; los filtros de todo el lienzo reciben RGBA premultiplicado y lo convierten para el ajuste. El RGB se recorta al rango representable antes de la premultiplicación, mientras que el alfa se conserva. Esto también evita que un resultado intermedio demasiado brillante cambie el filtro siguiente de forma inesperada.

Por ejemplo, `rgba(64,128,192,0.5)` con `brightness(0.2)` pasa a ser aproximadamente `rgba(115,179,243,0.5)` antes de aplicar la opacidad de la forma. Bajar el alfa de la pintura no debe reducir el propio ajuste de brillo. Estos filtros de color actualizan uniforms ordinarios en WebGL1 y también búferes de uniforms en WebGL2; los bloques escalares std140 conservan la alineación de 16 bytes que exige WebKit.

### Desenfoque fuera de la forma original {#blur-bounds}

Para las primitivas SDF y los rellenos Path ordinarios, un `blur()` positivo captura primero el relleno de la forma, la silueta y el trazo sólido SDF en una textura con padding transparente. El dibujo final cubre esa zona con padding, así que el desenfoque puede extenderse más allá de los bordes redondeados y entrar en los huecos del Path. Solo se expanden los límites de renderizado; la geometría de selección no cambia. Por ejemplo, `filter: 'blur(6px, 3)'` suaviza el contorno, mientras que `blur(0px)` lo conserva.

El muestreo interpola téxeles premultiplicados antes de volver a RGBA no premultiplicado. Así, un borde azul translúcido sigue siendo azul, en lugar de mezclar negro transparente en su RGB, también al acercar el zoom. El padding incluye la huella de muestreo de cada pasada y de cada desenfoque consecutivo. WebGL1 actualiza los uniforms del kernel de cada pasada justo antes de dibujar.

Esta ruta de captura cubre ahora los rellenos y trazos sólidos SDF y los rellenos ordinarios de Path y VectorNetwork. El texto, los trazos de Path separados, los rellenos rough, los dibujos de wireframe y de stencil y las entradas externas `FillTexture` conservan sus rutas de filtro existentes; todavía no reciben esta geometría expandida. El renderizado completo en WebGPU sigue necesitando una validación aparte.

### Brillo y contraste {#brightness-contrast}

Podemos usar la sintaxis de [filtro CSS], por ejemplo `filter: brightness(0.4);`

El shader siguiente ilustra la ruta premultiplicada de todo el lienzo; consulta [brightnesscontrast.js]. Los filtros por forma usan las funciones auxiliares de alfa compartidas para conservar el RGBA no premultiplicado.

```glsl
uniform sampler2D u_Texture;
in vec2 v_Uv;

layout(std140) uniform PostProcessingUniforms {
  vec4 u_BrightnessContrast;
};

out vec4 outputColor;

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);
  float brightness = u_BrightnessContrast.x;
  float contrast = u_BrightnessContrast.y;

  if (color.a > 0.0) {
    color.rgb /= color.a;
    color.rgb += brightness;
    if (contrast > 0.0) {
      color.rgb = (color.rgb - 0.5) / (1.0 - contrast) + 0.5;
    } else {
      color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5;
    }
    color.rgb = clamp(color.rgb, 0.0, 1.0) * color.a;
  } else {
    color = vec4(0.0);
  }

  outputColor = color;
}
```

<ImageProcessing />

### Ruido {#noise}

El ruido en el posprocesado suele generarse a partir de las UV de pantalla como valores pseudoaleatorios superpuestos al RGB, para simular grano de película, interferencia de señal y efectos parecidos. La implementación de este tutorial sigue el [filtro de ruido de glfx.js][glfx-noise], con aleatoriedad uniforme y un factor de intensidad `u_Noise` que controla la perturbación. Antes de escribir, los colores se despremultiplican y se vuelven a multiplicar por el alfa para evitar bordes grises en la transparencia.

En la cadena `filter` puedes escribir `noise(0.1)`; el valor entre paréntesis es la intensidad (aproximadamente 0–1). Si partes de herramientas de diseño, también puedes comparar la [capa de ruido de Spline][Spline - Noise Layer]: de forma parecida apila ruido procedural sobre materiales y rellenos; aquí aplicamos una pasada a pantalla completa sobre una textura ya rasterizada.

### Semitono {#halftone}

El semitono modula la luminosidad con un patrón regular para simular los puntos de impresión.

-   **Punto (trama de semitono)**: consulta [Pixi `dot.frag`][dot.frag]: muestrea `sin(x)·sin(y)` en coordenadas rotadas para puntos en blanco y negro; puede combinarse con la escala de grises para la impresión antigua y el semitono de cómic. Ejemplo de `filter`: `dot(1, 5, 1)` (escala, ángulo, escala de grises activada o no).
-   **Semitono de color**: consulta [glfx `colorhalftone.js`][colorhalftone.js]: trata el RGB al estilo CMY/K y modula cian, magenta, amarillo y negro con cuatro rejillas de seno en fases distintas para un aspecto de impresión a color. La forma abreviada `color-halftone(6)` solo indica el diámetro del punto, o `color-halftone(6, 0.5)` (diámetro y ángulo en radianes); la forma completa de cuatro parámetros puede fijar el centro del patrón y el ángulo.

```glsl
float halftonePattern(float rotAngle) {
// Continuous sine screen; no dot shape, grain, hex grid, etc.
  float s = sin(rotAngle), c = cos(rotAngle);
  vec2 tex = v_Uv * u_CH1.xy - u_CH0.xy;
  vec2 point = vec2(
    c * tex.x - s * tex.y,
    s * tex.x + c * tex.y
  ) * u_CH0.w;
  return (sin(point.x) * sin(point.y)) * 4.0;
}

void main() {
  vec4 color = texture(SAMPLER_2D(u_Texture), v_Uv);
  // ...
  vec3 cmy = 1.0 - color.rgb; // CMYK separation
  float k = min(cmy.x, min(cmy.y, cmy.z));
  // ...
  cmy = clamp(
    cmy * 10.0 - 3.0 + vec3(
      halftonePattern(baseAngle + 0.26179),
      halftonePattern(baseAngle + 1.30899),
      halftonePattern(baseAngle)
    ),
    0.0,
    1.0
  );
  k = clamp(k * 10.0 - 5.0 + halftonePattern(baseAngle + 0.78539), 0.0, 1.0);
  vec3 rgb = 1.0 - cmy - vec3(k);
  // ...
}
```

[Paper Shaders] adopta otro enfoque: admite puntos grandes al estilo de periódico, un tamaño de punto ligado a la luminosidad, y formas de punto intercambiables, rejillas hexagonales, grano y más.

<HalftoneDots />

### Pixelar {#pixelate}

Muestrea y amplía bloques para obtener un mosaico; consulta [Pixi `pixelate.frag`][pixelate.frag], por ejemplo `pixelate(12px)`. También puedes aplicarlo a degradados con ruido superpuesto.

<Pixelate />

### CRT y viñeta {#crt-vignette}

Imita el aspecto de un CRT antiguo, más la viñeta:

<CRT />

### Glitch {#glitch}

-   [CSSGlitchEffect]
-   [unityglitch]

<Glitch />

### Ascii {#ascii}

Primero divide la imagen en celdas con `uSize` y calcula la escala de grises; elige una constante de mapa de bits `n` a partir del nivel de gris y, para cada píxel de la celda, usa los bits de `n` para decidir claro u oscuro y multiplicarlo en el color. Es el enfoque habitual de fuente de mapa de bits y de arte ASCII: no son glifos vectoriales ni fuentes con textura.

```glsl
float n = 65536.0;
if (gray > 0.2) n = 65600.0; // .
if (gray > 0.3) n = 332772.0; // :
if (gray > 0.4) n = 15255086.0; // *
if (gray > 0.5) n = 23385164.0; // o
```

<Ascii />

### Vidrio líquido {#liquid-glass}

<LiquidGlass />

### Metal líquido {#liquid-metal}

<LiquidMetal />

### Mapa de calor {#heatmap}

<Heatmap />

### Humo generado {#gen-smoke}

<GenSmoke />

### Animación temporal {#time-animation}

Algunos efectos de posprocesado se pueden animar; lo habitual es pasar un valor de tiempo por fotograma (parecido a `u_Time` en Shadertoy):

```ts
export class PostEffectTime extends System {
    execute() {
        setPostEffectEngineTimeSeconds(perf.now() / 1000);
    }
}
```

[Lección 10 - Exportar GIF]

## Grafo de renderizado {#render-graph}

Un grafo de renderizado (Render Graph, a veces llamado FrameGraph) es una arquitectura de renderizado moderna que modela el proceso de renderizado como un grafo acíclico dirigido (DAG). En este modelo, cada pasada de renderizado y los recursos que usa se tratan como nodos y aristas; la estructura del grafo gestiona de forma automática las transiciones de estado de los recursos, la sincronización y los tiempos de vida.

-   [FrameGraph: arquitectura de renderizado extensible en Frostbite]
-   [Por qué hablar de grafos de renderizado]

![Ejemplo de grafo de fotogramas](/frame-graph.png)

El uso en [Grafo de renderizado en bevy] es el siguiente:

```rs
// @see https://docs.rs/bevy/latest/bevy/render/render_graph/struct.RenderGraph.html
let mut graph = RenderGraph::default();
graph.add_node(Labels::A, MyNode);
graph.add_node(Labels::B, MyNode);
graph.add_node_edge(Labels::B, Labels::A);
```

### Concepto de diseño {#design-concept}

Tomamos como referencia la implementación del grafo de renderizado de [noclip], que emplea un diseño en tres fases:

1. Fase de construcción del grafo: define de forma declarativa el pipeline de renderizado. Veremos cómo se usa en la subsección siguiente.
2. Fase de planificación: asigna y reutiliza recursos de forma automática. Se puede desglosar aún más en:

    - Fase de estadísticas: recorre todas las pasadas para contar las referencias de cada RenderTarget y ResolveTexture
    - Fase de asignación: asigna recursos bajo demanda. Los recupera del pool de objetos o los crea en el primer uso. Reutiliza recursos con las mismas especificaciones. Los devuelve al pool de objetos cuando el contador de referencias llega a cero.
    - Fase de liberación: los devuelve al pool de objetos cuando el contador de referencias llega a cero.

3. Fase de ejecución: ejecuta las pasadas de renderizado en secuencia.

La estructura de datos del grafo de renderizado es la siguiente. Guarda una descripción declarativa del grafo de renderizado, sin recursos reales. Solo registra las relaciones de ID entre Passes y Render Targets.

```ts
class GraphImpl {
    renderTargetDescriptions: Readonly<RGRenderTargetDescription>[] = [];
    resolveTextureRenderTargetIDs: number[] = [];
    passes: RenderGraphPass[] = [];
}
```

### Uso {#usage}

Cada vez que hace falta un redibujado, se crea un RenderGraphBuilder nuevo para construir el DAG. Ahora mismo, este DAG sencillo incluye una pasada de renderizado principal que escribe el resultado en un ColorRT y un DepthRT. Después añadiremos pasadas adicionales con `pushPass`. El ColorRT se puede consumir como entrada y, al final, este ColorRT se renderiza en la pantalla. La lógica principal de renderizado se escribe en la función de retrollamada de `pass.exec`, que recibe un objeto `RenderPass`. Para más detalles, consulta: [Lección 2].

```ts
const builder = renderGraph.newGraphBuilder();
builder.pushPass((pass) => {
    pass.setDebugName('Main Render Pass');
    pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);
    pass.attachRenderTargetID(RGAttachmentSlot.DepthStencil, mainDepthTargetID);
    pass.exec((renderPass) => {
        // Render grid
        // Render shapes in current scene
    });
});
builder.resolveRenderTargetToExternalTexture(
    mainColorTargetID,
    onscreenTexture,
);
renderGraph.execute();
```

### FXAA {#fxaa}

Ahora creamos una pasada FXAA aparte, fuera de la pasada de renderizado principal, para un antialiasing rápido. A diferencia de métodos tradicionales como MSAA, basados en el muestreo geométrico, FXAA no necesita muestras extra ni conocer la geometría de la escena; procesa directamente los píxeles finales, así que el coste de rendimiento es muy bajo. Este método convierte RGB a escala de grises con los pesos NTSC `0.299R + 0.587G + 0.114B` para la detección de bordes:

```glsl
float MonochromeNTSC(vec3 t_Color) {
  // NTSC primaries.
  return dot(t_Color.rgb, vec3(0.299, 0.587, 0.114));
}
```

Volviendo a la sintaxis declarativa del grafo de renderizado. Primero, obtén el ColorRT del paso anterior:

```ts
builder.pushPass((pass) => {
    pass.setDebugName('FXAA');
    pass.attachRenderTargetID(RGAttachmentSlot.Color0, mainColorTargetID);

    const mainColorResolveTextureID =
        builder.resolveRenderTarget(mainColorTargetID);
    pass.attachResolveTexture(mainColorResolveTextureID);

    pass.exec((passRenderer, scope) => {
        postProcessingRenderer.render(
            passRenderer,
            scope.getResolveTextureForID(mainColorResolveTextureID),
        );
    });
});
```

Aplicamos los tres efectos de posprocesado siguientes a todo el lienzo:

```ts
api.setAppState({
    filter: 'fxaa() brightness(0.8) noise(0.1)',
});
```

<GlobalEffects />

## Lectura adicional {#extended-reading}

-   [Blob Tracking]
-   [reveals.cool]
-   [Logotipo de metal líquido]

[Paper Shaders]: https://shaders.paper.design/
[filtros de Pixi.js]: https://github.com/pixijs/filters
[filtro CSS]: https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/filter
[Procesamiento de imágenes]: https://luma.gl/docs/api-reference/shadertools/shader-passes/image-processing
[glfx.js]: https://github.com/evanw/glfx.js
[brightnesscontrast.js]: https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/brightnesscontrast.js
[FrameGraph: arquitectura de renderizado extensible en Frostbite]: https://www.gdcvault.com/play/1024612/FrameGraph-Extensible-Rendering-Architecture-in
[Por qué hablar de grafos de renderizado]: https://logins.github.io/graphics/2021/05/31/RenderGraphs.html
[Grafo de renderizado en bevy]: https://github.com/bevyengine/bevy/discussions/2524
[noclip]: https://github.com/magcius/noclip.website
[Lección 2]: /es/guide/lesson-002
[Spline - Noise Layer]: https://docs.spline.design/materials-shading/noise-layer
[glfx-noise]: https://github.com/evanw/glfx.js/blob/master/src/filters/adjust/noise.js
[dot.frag]: https://github.com/pixijs/filters/blob/main/src/dot/dot.frag
[colorhalftone.js]: https://github.com/evanw/glfx.js/blob/master/src/filters/fun/colorhalftone.js
[pixelate.frag]: https://github.com/pixijs/filters/blob/main/src/pixelate/pixelate.frag
[Blob Tracking]: https://www.shadertoy.com/view/3fBXDD
[Optimizar triángulos para una pasada a pantalla completa]: https://wallisc.github.io/rendering/2021/04/18/Fullscreen-Pass.html
[CSSGlitchEffect]: https://tympanus.net/Tutorials/CSSGlitchEffect/
[unityglitch]: https://github.com/staffantan/unityglitch/blob/master/GlitchShader.shader
[reveals.cool]: https://reveals.cool/
[Logotipo de metal líquido]: https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shaders/liquid-metal.ts
[Lección 10 - Exportar GIF]: /es/guide/lesson-010#to-gif
