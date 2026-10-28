---
outline: deep
description: 'Aprende a dibujar líneas rectas mediante geometría de líneas y técnicas en el espacio de pantalla. Implementa patrones de cuadrícula y de puntos, y añade el renderizado de malla de alambre para las figuras geométricas.'
head:
    - ['meta', { property: 'og:title', content: 'Lección 5 - Cuadrícula' }]
---
# Lección 5 - Cuadrícula {#lesson-5-grid}

En esta lección aprenderás lo siguiente:

-   Dibujar líneas rectas con geometría de líneas o con técnicas en el espacio de pantalla.
-   Dibujar una cuadrícula de puntos.
-   Dibujar la malla de alambre de una geometría.

```js eval code=false
$button = call(() => {
    const $button = document.createElement('button');
    $button.textContent = 'FlyTo origin';
    return $button;
});
```

```js eval code=false
checkboardStyle = Inputs.radio(['none', 'grid', 'dots'], {
    label: 'Checkboard Style',
    value: 'grid',
});
```

```js eval code=false inspector=false
canvas = call(() => {
    const { Canvas } = Lesson5;
    return Utils.createCanvas(Canvas, 400, 400);
});
```

```js eval code=false inspector=false
call(() => {
    const styles = ['none', 'grid', 'dots'];
    canvas.setCheckboardStyle(styles.indexOf(checkboardStyle));
});
```

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson5;

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
    });
    const earth = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'blue',
    });
    const moon = new Circle({
        cx: 0,
        cy: 0,
        r: 25,
        fill: 'yellow',
    });
    solarSystem.appendChild(sun);
    solarSystem.appendChild(earthOrbit);
    earthOrbit.appendChild(earth);
    earthOrbit.appendChild(moonOrbit);
    moonOrbit.appendChild(moon);

    solarSystem.position.x = 200;
    solarSystem.position.y = 200;
    earthOrbit.position.x = 100;
    moonOrbit.position.x = 100;

    canvas.appendChild(solarSystem);

    let id;
    const animate = () => {
        solarSystem.rotation += 0.01;
        earthOrbit.rotation += 0.02;
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    const landmark = canvas.camera.createLandmark({
        x: 0,
        y: 0,
        zoom: 1,
        rotation: 0,
    });
    $button.onclick = () => {
        canvas.camera.gotoLandmark(landmark, {
            duration: 1000,
            easing: 'ease',
        });
    };

    return canvas.getDOM();
})();
```

En Figma y FigJam, las cuadrículas aparecen al acercar el zoom hasta cierto nivel: las primeras se muestran como líneas y las segundas, como puntos.

![cuadrícula de FigJam](/figjam-grid.png)

Miro permite alternar entre líneas y puntos:

![cuadrícula de Miro](/miro-grid.png)

Empecemos por la cuadrícula de líneas.

## Cuadrícula de líneas {#lines-grid}

En primer lugar, la cuadrícula no debe formar parte del grafo de escena. No queremos que la cuadrícula aumente o disminuya de escala cuando se hace zoom en el lienzo. Sí queremos, en cambio, que tenga un efecto de aparición y desaparición gradual al hacer zoom. Por eso renderizamos primero la cuadrícula en el hook `beginFrame` y pasamos la información necesaria de la escena, como la cámara:

```ts
hooks.initAsync.tapPromise(async () => {
    this.#grid = new Grid();
});
hooks.beginFrame.tap(() => {
    this.#grid.render(
        this.#device,
        this.#renderPass,
        this.#uniformBuffer,
        camera,
    );
});
```

### Geometría de líneas {#line-geometry}

El enfoque más directo es similar a [GridHelper - Three.js]: se crea un conjunto de líneas a partir del tamaño de la cuadrícula:

```ts
// https://github.com/mrdoob/three.js/blob/master/src/helpers/GridHelper.js#L25-L37
for (var i = 0, j = 0, k = -halfSize; i <= divisions; i++, k += step) {
    vertices.push(-halfSize, 0, k, halfSize, 0, k);
    vertices.push(k, 0, -halfSize, k, 0, halfSize);
}

var geometry = new BufferGeometry();
geometry.addAttribute('position', new Float32BufferAttribute(vertices, 3));
geometry.addAttribute('color', new Float32BufferAttribute(colors, 3));

var material = new LineBasicMaterial({ vertexColors: VertexColors });
LineSegments.call(this, geometry, material);
```

En el proyecto [thetamath], de Evan, CTO de Figma, la cuadrícula también se implementa de esta manera: se construyen las líneas necesarias de la cuadrícula tanto en horizontal como en vertical:

```ts
for (let x = left; x < right; x++) {
    const tx = ox + (x * zoom) / step;
    this.strokeLine();
}
for (let y = top; y < bottom; y++) {
    const ty = oy - (y * zoom) / step;
    this.strokeLine();
}
```

¿Cómo dibujamos líneas rectas en WebGL? Antes escribí un texto sobre [Dibujar líneas rectas en WebGL (chino)]. En resumen, si no tenemos en cuenta las uniones, solo hace falta estirar hacia fuera por ambos lados a lo largo de la dirección de la normal y usar dos triángulos para dibujar:

![extruir una línea](https://pica.zhimg.com/70/v2-afa28c8cf89369a162816f21b7f53314_1440w.avis?source=172ae18b&biz_tag=Post)

[thetamath] también emplea dos pequeños trucos. El primero es el uso de la [tira de triángulos] que, frente a los `Triangles` normales, permite ahorrar vértices: se pasa de `3N` a `N + 2`, donde `N` es el número de triángulos:

```ts{5}
this.#pipeline = device.createRenderPipeline({
    inputLayout: this.#inputLayout,
    program: this.#program,
    colorAttachmentFormats: [Format.U8_RGBA_RT],
    topology: PrimitiveTopology.TRIANGLE_STRIP,
});
```

En segundo lugar, almacena el color en cuatro `Bytes`:

```ts
255 | (255 << 8) | (255 << 16) | (127 << 24);
```

Junto con [vertexAttribPointer], declara que cada componente es `gl.UNSIGNED_BYTE` y que hay que normalizarlo:

```ts{13}
this.#inputLayout = device.createInputLayout({
  vertexBufferDescriptors: [
    {
      arrayStride: 4 * 5,
      stepMode: VertexStepMode.VERTEX,
      attributes: [
        {
          format: Format.F32_RGBA,
          offset: 0,
          shaderLocation: 0,
        },
        {
          format: Format.U8_RGBA_NORM,
          offset: 4 * 4,
          shaderLocation: 1,
        },
      ],
    },
  ],
  indexBufferFormat: null,
  program: this.#program,
});
```

Probémoslo:

```js eval code=false
(async () => {
    const { Canvas, Circle, Group } = Lesson5;
    const canvas = await Utils.createCanvas(Canvas, 400, 400);
    const $canvas = canvas.getDOM();

    canvas.setGridImplementation(0);

    const solarSystem = new Group();
    const earthOrbit = new Group();
    const moonOrbit = new Group();

    const sun = new Circle({
        cx: 0,
        cy: 0,
        r: 100,
        fill: 'red',
    });
    const earth = new Circle({
        cx: 0,
        cy: 0,
        r: 50,
        fill: 'blue',
    });
    const moon = new Circle({
        cx: 0,
        cy: 0,
        r: 25,
        fill: 'yellow',
    });
    solarSystem.appendChild(sun);
    solarSystem.appendChild(earthOrbit);
    earthOrbit.appendChild(earth);
    earthOrbit.appendChild(moonOrbit);
    moonOrbit.appendChild(moon);

    solarSystem.position.x = 200;
    solarSystem.position.y = 200;
    earthOrbit.position.x = 100;
    moonOrbit.position.x = 100;

    canvas.appendChild(solarSystem);

    let id;
    const animate = () => {
        solarSystem.rotation += 0.01;
        earthOrbit.rotation += 0.02;
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    return $canvas;
})();
```

En este método, cuanto mayor es el tamaño del lienzo y cuanto mayor es la densidad de la cuadrícula, más vértices hacen falta. ¿Hay una forma de lograrlo con menos vértices? Como la cuadrícula siempre ocupa toda la pantalla, ¿se puede hacer en el espacio de pantalla?

### Patrones en el shader de fragmentos {#patterns-in-fragment-shader}

Como dice [Construcción de secciones transversales flexibles y potentes con GridPaper y WebGL]:

> En lugar de renderizar todas estas líneas como geometría, podemos usar un shader de fragmentos de WebGL para generar las líneas píxel a píxel.

La ventaja de implementarlo en el espacio de pantalla es que solo hace falta un único quad que llene la pantalla, con apenas cuatro vértices, a los que se les pasan coordenadas del sistema de coordenadas de clip. Por supuesto, también se puede usar un triángulo a pantalla completa, que solo necesita tres vértices. Este enfoque es bastante habitual en el posprocesado:

```ts
this.appendVertex(-1, -1);
this.appendVertex(-1, 1);
this.appendVertex(1, -1);
this.appendVertex(1, 1);
```

De este modo, en el shader de vértices puedes usarlas directamente, sin ninguna transformación:

```glsl
layout(location = 0) in vec4 a_Position;
void main() {
  gl_Position = vec4(a_Position.xy, 0, 1);
}
```

Para dibujar la cuadrícula en el shader de fragmentos necesitas las coordenadas de los píxeles en el sistema de coordenadas mundial. Por tanto, con la inversa de la matriz de transformación de proyección de la cámara puedes convertir las coordenadas del sistema de coordenadas de clip al sistema de coordenadas mundial:

```glsl{4}
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
};

out vec2 v_Position;

vec2 project_clipspace_to_world(vec2 p) {
  return (u_ViewProjectionInvMatrix * vec3(p, 1.0)).xy;
}

void main() {
  v_Position = project_clipspace_to_world(a_Position.xy);
}
```

En Canvas2D y SVG, las cuadrículas suelen implementarse con patrones. La idea básica al hacerlo con un shader de fragmentos es parecida: se usa la función integrada `fract` para dibujar un patrón. Al escalar el espacio de coordenadas inicial por un factor de n y usar después `fract` para obtener la parte fraccionaria, solo tienes que considerar un bloque pequeño cuyo rango de coordenadas es `0-1`. Si quieres más información, consulta [El libro de los shaders - Patrones].

![patrones](https://pic4.zhimg.com/80/v2-1f7b0bc49eefe692f5a3c5935725feef_1440w.webp)

El código siguiente procede del [shader de cuadrícula con antialiasing] de Evan:

```ts
vec4 render_grid_checkerboard(vec2 coord) {
  // Compute anti-aliased world-space grid lines
  vec2 grid = abs(fract(coord / gridSize - 0.5) - 0.5) / fwidth(coord) * gridSize;
  float line = min(grid.x, grid.y);
  float alpha = 1.0 - min(line, 1.0);
}
```

Queremos dibujar dos conjuntos de cuadrículas con grosores distintos, de modo que el espaciado de la cuadrícula fina sea `1/5` del de la cuadrícula gruesa. Al mismo tiempo, comprobamos si el píxel actual está más cerca de la cuadrícula gruesa:

```glsl
vec2 size = scale_grid_size(u_ZoomScale);
float gridSize1 = size.x;
float gridSize2 = gridSize1 / 5.0;
```

### Cuadrícula basada en textura {#texture-based}

[El mejor shader de cuadrícula (hasta ahora)] describe otro esquema basado en texturas. Sobre todo cuando queremos que las propias líneas tengan perspectiva, este esquema funciona mejor que una cuadrícula de ancho fijo en el espacio de pantalla. Por ejemplo, en la imagen de abajo hay un claro fenómeno de «muaré» en el lado derecho, mientras que el color de las líneas más a la izquierda será más fino y más oscuro.

![cuadrícula de textura frente a cuadrícula de líneas](https://miro.medium.com/v2/resize:fit:1360/format:webp/1*P4a5_Z1u5WXOQWpVglPb2g.png)

En el artículo original, el autor introdujo varias mejoras en el grosor en perspectiva, atenuó los patrones de «muaré», etc. Abajo se muestran ejemplos en Shadertoy:

<iframe width="640" height="360" frameborder="0" src="https://www.shadertoy.com/embed/mdVfWw?gui=true&t=10&paused=true&muted=false" allowfullscreen></iframe>

## Cuadrícula de puntos {#dots-grid}

Para una cuadrícula de puntos seguimos optando por tratarla dentro del shader de fragmentos, en el espacio de pantalla. Aunque es posible dibujar círculos con el método de campo de distancia con signo (SDF) que vimos antes, hacerlo exigiría una gran cantidad de vértices. Por eso seguimos reutilizando el patrón de las cuadrículas de líneas rectas; aquí solo empleamos el SDF para decidir si un píxel está dentro de un círculo, un método que ya vimos en la segunda lección:

```glsl
vec2 grid2 = abs(fract(coord / gridSize2 - 0.5) - 0.5) / fwidth(coord) * gridSize2;
alpha = 1.0 - smoothstep(0.0, 1.0, length(grid2) - BASE_DOT_SIZE * u_ZoomScale / zoomStep);
```

Para poder alternar entre cuadrículas de líneas rectas y cuadrículas de puntos, podemos introducir una nueva variable uniform que distinga los estilos de cuadrícula.

```glsl{6}
layout(std140) uniform SceneUniforms {
  mat3 u_ProjectionMatrix;
  mat3 u_ViewMatrix;
  mat3 u_ViewProjectionInvMatrix;
  float u_ZoomScale;
  float u_CheckboardStyle;
};
```

Ahora podemos dibujar distintas cuadrículas en el shader de fragmentos de esta forma:

```glsl
const int CHECKERBOARD_STYLE_NONE = 0;
const int CHECKERBOARD_STYLE_GRID = 1;
const int CHECKERBOARD_STYLE_DOTS = 2;

vec4 render_grid_checkerboard(vec2 coord) {
  int checkboardStyle = int(floor(u_CheckboardStyle + 0.5));
  if (checkboardStyle == CHECKERBOARD_STYLE_GRID) {
    // lines grid
  } else if (checkboardStyle == CHECKERBOARD_STYLE_DOTS) {
    // dots grid
  }
}
```

Puedes volver al ejemplo del principio de la página y alternar entre los distintos estilos de cuadrícula.

Por último se ofrece un ejemplo interesante que incorpora interacción con el ratón: [Cómo programar un sutil efecto de fondo con shaders en React Three Fiber]

<video autoplay="" controls="" loop="" muted="" src="https://codrops-1f606.kxcdn.com/codrops/wp-content/uploads/2024/10/shaderbackground.mp4?x39556" playsinline=""></video>

## Ajuste del brillo {#adjusting-brightness}

En los shaders que usan Figma y FigJam también se calcula el brillo de los colores y, a partir de esos valores de brillo, se ajustan los colores. En concreto, se emplea un algoritmo de ajuste de color basado en el brillo, pensado para mejorar el atractivo visual de los colores y hacer que el texto o los gráficos se vean con más claridad sobre fondos más brillantes.

Se ha definido un vector de pesos `weights`, con pesos fijados según las características no lineales de cómo percibe el ojo humano el brillo de los distintos colores. Esto se usa habitualmente para calcular valores de brillo en el espacio de color RGB.

```glsl{2}
vec3 gridColor; // Store the final adjusted color value
vec3 weights = vec3(0.299, 0.587, 0.114);
float c2 = dot(rgb * rgb, weights); // Calculate weighted sum of squares of RGB, c2 is an estimate of color brightness
float luminance = sqrt(c2);
```

Si el valor de brillo es mayor que 0.5, eso indica que el color ya es bastante brillante. El código calculará un factor de ajuste, target, y lo usará para modificar el valor de color rgb, de modo que el color quede un poco más oscuro. Este cambio hace que el color sea más fácil de observar sobre un fondo brillante. Si el valor de brillo no es mayor que 0.5, el color es comparativamente oscuro y el código seguirá otra estrategia para ajustarlo.

Primero calcula un nuevo valor objetivo de brillo, target, y después usa la función `mix` para mezclar el color rgb con el blanco puro `vec3(1)`, según los resultados del cálculo de `b` y `a`. La proporción final de la mezcla de color la determina la relación de `b` respecto a `a`. Aquí, `a` y `b` se calculan a partir del valor de brillo del color original y sirven para controlar el proceso de ajuste del color.

```glsl
if (luminance > 0.5) {
    float target = (luminance - 0.05) / luminance;
    gridColor = rgb * target;
}
else {
    float target = luminance * 0.8 + 0.15;
    float c1 = dot(rgb, weights);
    float a = 1.0 - 2.0 * c1 + c2;
    float b = c2 - c1;
    gridColor = mix(rgb, vec3(1), (b + sqrt(b * b - a * (c2 - target * target))) / a);
}
rgb = mix(rgb, gridColor, gridWeight);
```

## Dibujar la malla de alambre {#wireframe}

Dibujar la malla de alambre también usa técnicas parecidas, que sirven para depurar geometría compleja, como [Dibujar polilínea].

### Coordenadas baricéntricas {#barycentric-coordinates}

La idea es, en realidad, bastante simple. Queremos dibujar la malla de alambre de cada triángulo durante la rasterización, así que necesitamos saber a qué distancia está el fragmento actual de los tres lados del triángulo. En cuanto sea menor que el ancho del borde, colorearemos el fragmento actual con el color del borde. La clave, por tanto, es cómo calcular la distancia del fragmento a los tres lados del triángulo. Podemos usar coordenadas baricéntricas. Como solo nos importa el triángulo en el que se encuentra el fragmento actual, podemos usar las coordenadas baricéntricas de los tres vértices para construir un sistema de coordenadas baricéntricas y, después, usar la interpolación del shader de fragmentos para obtener las coordenadas baricéntricas del fragmento actual.

De hecho, el pipeline de renderizado también usa las coordenadas baricéntricas como pesos para determinar el color del fragmento, como se ve en la figura de abajo. Puedes seguir leyendo el artículo sobre la implementación de la rasterización en scratchapixel: [Rasterización].

![baricéntricas](https://www.scratchapixel.com/images/rasterization/barycentric2.png)

Veamos la implementación concreta. Primero se pasan las coordenadas baricéntricas a los vértices. Hay que garantizar que las coordenadas de los tres vértices del triángulo sean `(1,0,0)`, `(0,1,0)` y `(0,0,1)`. Si al dibujar usas `gl.drawArrays()`, solo tienes que pasar las coordenadas de los tres vértices en orden y repetirlas varias veces (el número de triángulos), por ejemplo:

```glsl
layout(location = BARYCENTRIC) in vec3 a_Barycentric;
out vec3 v_Barycentric;

void main() {
  v_Barycentric = a_Barycentric;
}
```

Después, en el shader de fragmentos, cuando cualquier componente de las coordenadas baricéntricas es menor que el umbral del ancho del borde, puede considerarse un borde. Aquí se usan las funciones integradas de glsl `any()` y `lessThan()`:

```glsl
in vec3 v_Barycentric;
void main() {
  // less than border width
  if (any(lessThan(v_Barycentric, vec3(0.1)))) {
    // border color
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    // fill background color
    gl_FragColor = vec4(0.5, 0.5, 0.5, 1.0);
  }
}
```

Y, como en el ejemplo anterior de dibujar cuadrículas de líneas rectas, queremos que el ancho de la línea se mantenga constante con independencia del zoom de la cámara, así que seguimos usando `fwidth()`:

```glsl
float edgeFactor() {
  vec3 d = fwidth(v_Barycentric);
  vec3 a3 = smoothstep(vec3(0.0), d * u_WireframeLineWidth, v_Barycentric);
  return min(min(a3.x, a3.y), a3.z);
}
```

### Reasignar los datos de vértices {#reallocate-vertex-data}

En el ejemplo anterior usamos `gl.drawArrays()` al dibujar, pero si usamos `gl.drawElements()`, que aprovecha mejor el espacio, es decir, si compartimos algunos vértices (por ejemplo, un plano solo usa 4 vértices en lugar de 6), no podemos asignar sin más las coordenadas baricéntricas según el orden de los vértices: hay que asignarlas según el índice del vértice. Sin embargo, no todos los métodos de asignación son tan simples. Por ejemplo, en el problema de Stack Overflow [Problema con las coordenadas baricéntricas al usar vértices compartidos] verás que el `?` no se puede asignar. La razón de fondo es que, cuando hay vértices compartidos, una vez asignadas las coordenadas baricéntricas de un triángulo, la coordenada del vértice que falta del triángulo siguiente que comparte el mismo lado ya queda determinada:

![no hay coordenada baricéntrica para el signo de interrogación](https://pica.zhimg.com/v2-30c2f4ab848d5f0cfcf8f6934b030298_b.jpg)

Por eso, cuando la malla de alambre está activada, hay que expandir los índices reutilizados. Por ejemplo, los 6 vértices originales que usan 4 índices `[0, 1, 2, 0, 2, 3]` se expanden a `[0, 1, 2, 3, 4, 5]`, y hay que reasignar los datos del arreglo de vértices.

```ts
let cursor = 0;
const uniqueIndices = new Uint32Array(indiceNum); // Reallocate indices
for (let i = 0; i < indiceNum; i++) {
    const ii = this.#indexBufferData[i];
    for (let j = 0; j < bufferDatas.length; j++) {
        const { arrayStride } = this.#vertexBufferDescriptors[j];
        const size = arrayStride / 4;
        for (let k = 0; k < size; k++) {
            bufferDatas[j][cursor * size + k] =
                originalVertexBuffers[j][ii * size + k]; // Reallocate vertex data
        }
    }
    uniqueIndices[i] = cursor;
    cursor++;
}
```

El efecto es el siguiente, y más adelante se presentarán más formas de dibujar gráficos.

<script setup>
import Wireframe from '../../components/Wireframe.vue'
</script>

<Wireframe />

## Lectura adicional {#extended-reading}

-   [thetamath]
-   [El mejor shader de cuadrícula (hasta ahora)]
-   [Dibujar una cuadrícula en WebGL (chino)]
-   [Cómo dibujar líneas de cuadrícula de un plano con WebGL (chino)]
-   [Cómo programar un sutil efecto de fondo con shaders en React Three Fiber]
-   [Amor, derivadas y bucles]

[thetamath]: http://thetamath.com/app/y=x%5E(3)-x
[GridHelper - Three.js]: https://threejs.org/docs/#api/en/helpers/GridHelper
[Dibujar una cuadrícula en WebGL (chino)]: https://zhuanlan.zhihu.com/p/66637363
[Cómo dibujar líneas de cuadrícula de un plano con WebGL (chino)]: https://www.zhihu.com/question/325261675/answer/3149510989
[Dibujar líneas rectas en WebGL (chino)]: https://zhuanlan.zhihu.com/p/59541559
[tira de triángulos]: https://en.wikipedia.org/wiki/Triangle_strip
[Construcción de secciones transversales flexibles y potentes con GridPaper y WebGL]: https://medium.com/life-at-propeller/building-flexible-and-powerful-cross-sections-with-gridpaper-and-webgl-c5b3b9929c71
[vertexAttribPointer]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/vertexAttribPointer
[El libro de los shaders - Patrones]: https://thebookofshaders.com/09/?lan=ch
[shader de cuadrícula con antialiasing]: https://madebyevan.com/shaders/grid/
[El mejor shader de cuadrícula (hasta ahora)]: https://bgolus.medium.com/the-best-darn-grid-shader-yet-727f9278b9d8
[Dibujar polilínea]: /es/guide/lesson-012
[Rasterización]: https://www.scratchapixel.com/lessons/3d-basic-rendering/rasterization-practical-implementation/rasterization-stage.html
[Problema con las coordenadas baricéntricas al usar vértices compartidos]: https://stackoverflow.com/questions/24839857/wireframe-shader-issue-with-barycentric-coordinates-when-using-shared-vertices
[Cómo programar un sutil efecto de fondo con shaders en React Three Fiber]: https://tympanus.net/codrops/2024/10/31/how-to-code-a-subtle-shader-background-effect-with-react-three-fiber/
[Amor, derivadas y bucles]: https://medium.com/@akella/love-derivatives-and-loops-f4a0da6e2458
