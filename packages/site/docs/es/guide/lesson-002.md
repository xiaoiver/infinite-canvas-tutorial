---
outline: deep
description: 'Aprende a añadir formas al lienzo y a dibujar un círculo mediante SDF (campo de distancia con signo). Trata las técnicas de antialiasing y el patrón de diseño de la marca de modificado para optimizar el rendimiento.'
head:
    - ['meta', { property: 'og:title', content: 'Lección 2 - Dibujar un círculo' }]
---
# Lección 2 - Dibujar un círculo {#lesson-2-draw-a-circle}

En esta lección aprenderás lo siguiente:

-   Añadir formas al lienzo
-   Dibujar un círculo mediante SDF
-   Antialiasing
-   Patrón de diseño de la marca de modificado

Cuando inicies el proyecto verás un círculo dibujado en el lienzo y podrás modificar el ancho y el alto o cambiar el renderizador WebGL / WebGPU.

```js eval code=false
width = Inputs.range([50, 300], { label: 'width', value: 100, step: 1 });
```

```js eval code=false
height = Inputs.range([50, 300], { label: 'height', value: 100, step: 1 });
```

```js eval code=false
renderer = Inputs.select(['webgl', 'webgpu'], { label: 'renderer' });
```

```js eval code=false inspector=false
canvas = (async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 100, 100, renderer);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 3,
    });
    canvas.appendChild(circle);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });

    return canvas;
})();
```

```js eval code=false inspector=false
call(() => {
    Utils.resizeCanvas(canvas, width, height);
});
```

```js eval code=false
call(() => {
    return canvas.getDOM();
});
```

## Añadir formas al lienzo {#adding-shapes-to-canvas}

En la lección anterior creamos un lienzo en blanco al que después añadiremos diversos gráficos. ¿Cómo diseñar una API así? Como desarrollador de front-end, puede que quieras inspirarte en el familiar [appendChild de la API de Node]:

```ts
canvas.appendChild(shape);
canvas.removeChild(shape);
```

Creamos de momento una clase base de figuras, de la que heredarán Circle, Ellipse, Rect y otras:

```ts
export abstract class Shape {}
```

Usamos un array para guardar la lista de formas del lienzo:

```ts
#shapes: Shape[] = [];

appendChild(shape: Shape) {
  this.#shapes.push(shape);
}

removeChild(shape: Shape) {
  const index = this.#shapes.indexOf(shape);
  if (index !== -1) {
    this.#shapes.splice(index, 1);
  }
}
```

Recorremos la lista de formas en el método de renderizado del lienzo y llamamos al hook de renderizado:

```ts{4}
render() {
  const { hooks } = this.#pluginContext;
  hooks.beginFrame.call();
  this.#shapes.forEach((shape) => {
    hooks.render.call(shape);
  });
  hooks.endFrame.call();
}
```

En el complemento de renderizado se crea un `RenderPass` antes del inicio de cada fotograma, encapsulado en la capa de abstracción de hardware. En WebGL no existe este concepto, pero en WebGPU [beginRenderPass] devuelve [GPURenderPassEncoder], que registra una serie de comandos, incluidos los comandos `draw`, como veremos más adelante en el hook `render`. Al crear el `RenderPass` proporcionamos los parámetros siguientes:

-   `colorAttachment`
-   `colorResolveTo`
-   `colorClearColor` Esto se implementa en WebGL con el comando [gl.clearColor]; en WebGPU se declara con la propiedad [clearValue], que aquí establecemos en blanco.

```ts{4}
hooks.beginFrame.tap(() => {
  this.#device.beginFrame();

  this.#renderPass = this.#device.createRenderPass({
    colorAttachment: [renderTarget],
    colorResolveTo: [onscreenTexture],
    colorClearColor: [TransparentWhite],
  });
});
```

En correspondencia con la creación, al final de cada fotograma se envía el `RenderPass`. El método [submit] correspondiente es fácil de encontrar en WebGPU, pero, por supuesto, la API nativa envía un buffer de comandos codificado, y la capa de abstracción de hardware simplifica estos conceptos.

```ts{2}
hooks.endFrame.tap(() => {
  this.#device.submitPass(this.#renderPass);
  this.#device.endFrame();
});
```

Por último llegamos al hook `render`, en el que cada figura se encarga de implementar la lógica para dibujarse a sí misma, y el complemento se encarga de pasar los objetos de la GPU necesarios, como Device y `RenderPass`.

```ts
hooks.render.tap((shape) => {});
```

## Dibujar un círculo {#draw-a-circle}

Lo primero que hay que hacer es definir los atributos básicos de un círculo. Si conoces el [circle] de SVG, sabrás que puedes definir la geometría de un círculo a partir de su centro, `cx/cy`, y de su radio, `r`, y que puedes usar los atributos de dibujo genéricos `fill` y `stroke` para cubrir las necesidades básicas.

```ts
export class Circle extends Shape {
    constructor(
        config: Partial<{
            cx: number;
            cy: number;
            r: number;
            fill: string;
        }> = {},
    ) {}
}
```

### Coordenadas del lienzo {#canvas-coordinates}

Como estamos hablando de atributos de posición como el centro del círculo `cx/cy`, es importante tener claro el sistema de coordenadas del lienzo que usamos. Tanto en Canvas como en SVG, el origen del sistema de coordenadas es la esquina superior izquierda, el eje X positivo apunta a 👉 y el eje Y positivo apunta a 👇. Sin embargo, el [sistema de coordenadas de recorte] que se usa en WebGL sigue la especificación de OpenGL: el origen está en el centro del viewport, el eje X apunta a 👉, el eje Y apunta a 👆 y el eje Z apunta hacia dentro de la pantalla. El cubo de abajo, cuya relación de aspecto es 2, también se conoce como coordenadas de dispositivo normalizadas (NDC):

![espacio de recorte](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection/clip_space_graph.svg)

Sin embargo, WebGPU sigue la especificación de Metal, que se diferencia de WebGL en que el eje Y positivo apunta a 👇 y el eje Z positivo apunta hacia fuera. También hay una diferencia en el rango de recorte del eje Z, que es `[-1, 1]` en WebGL y `[0, 1]` en WebGPU:

![Rangos del espacio de recorte Z en WebGL y WebGPU](/clip-space-z-range.png)

Nuestra capa de abstracción de hardware intenta suavizar las diferencias entre WebGL y WebGPU, pero en el sistema de coordenadas elige alinearse con Canvas / SVG, porque creemos que encaja mejor con lo que están acostumbrados quienes usan un tablero.

![cuadrícula predeterminada del lienzo](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Drawing_shapes/canvas_default_grid.png)

Así, si nuestro lienzo tiene un ancho y un alto de 200, el `Circle` añadido de la siguiente manera aparecerá en el centro del lienzo:

```ts
const circle = new Circle({
    cx: 100,
    cy: 100,
    r: 50,
    fill: 'red',
});
canvas.appendChild(circle);
```

La siguiente pregunta es cómo convertir `cx/cy` del sistema de coordenadas de pantalla a NDC para el pipeline de renderizado. Pasaremos el ancho y el alto del lienzo como un uniform, y la posición del círculo como un attribute. Dividir la posición entre el ancho y el alto nos da un valor en el rango `[0, 1]`, que se multiplica por dos y se le resta uno para convertirlo a `[-1, 1]`, que es el rango de valores en NDC. Por último, se invierte el eje Y hacia abajo:

```glsl
layout(std140) uniform SceneUniforms {
  vec2 u_Resolution; // width & height of canvas
};
layout(location = 1) in vec2 a_Position; // cx & cy

// Pixel space to [0, 1] (Screen space)
vec2 zeroToOne = (a_Position + a_Size * a_FragCoord) / u_Resolution;

// Convert from [0, 1] to [0, 2]
vec2 zeroToTwo = zeroToOne * 2.0;

// Convert from [0, 2] to [-1, 1] (NDC/clip space)
vec2 clipSpace = zeroToTwo - 1.0;

// Flip Y axis
gl_Position = vec4(clipSpace * vec2(1, -1), 0.0, 1.0);
```

### Procesar los valores de color {#processing-color-values}

A diferencia de Canvas o SVG, los valores de color en forma de cadena no se pueden usar directamente en WebGL o WebGPU, pero [d3-color] puede convertirlos al formato `{ r, g, b, opacity }`, que después se puede pasar directamente a un `attribute` como `vec4` o comprimido. Por ahora solo admitimos valores de color en el espacio RGB, lo que significa que [hsl] y [oklch] no están disponibles:

```ts
import * as d3 from 'd3-color';

set fill(fill: string) {
  this.#fill = fill;
  this.#fillRGB = d3.rgb(fill); // { r, g, b, opacity }
}
```

Aclarado el asunto del estilo, volvamos a la geometría. La malla de triángulos es una representación habitual de la geometría en el renderizado 3D, y [CircleGeometry] en Three.js genera la geometría de forma procedural dividiendo el círculo en triángulos desde el centro. Es evidente que, cuantos más triángulos hay, más suave es el círculo, y si solo hay dos triángulos, degenera en un cuadrado. Para obtener un círculo suave hacen falta más vértices, lo que provoca un aumento notable de la memoria de la GPU a medida que crece el número de círculos.

![Geometría de círculo en Three.js](/circle-geometry.png)

### SDF {#sdf}

Solo hacen falta cuatro vértices si se usa un método llamado funciones de distancia con signo (SDF). El diagrama siguiente visualiza el concepto de los SDF, a partir del artículo práctico [drawing-rectangles] del editor emergente Zed. Un punto del plano corresponde a un círculo de radio 100, con distancia 0 sobre el círculo, y valores negativos y positivos dentro y fuera del círculo, respectivamente:

![Círculo SDF](/sdf.svg)

> El artículo original usa animaciones de Lottie para mostrar la definición de un campo de distancia dirigido y la derivación de algunas fórmulas de la gráfica subyacente. En GPUI de Zed, el SDF también se usa para dibujar las gráficas subyacentes y obtener un mejor rendimiento.

Normalmente construimos el sistema de coordenadas en el vertex shader.

```glsl
layout(location = 0) in vec2 a_FragCoord;
out vec2 v_FragCoord;
void main() {
  v_FragCoord = a_FragCoord;
}
```

Con la información de distancia, puedes usar la fórmula SDF de distintas figuras en el fragment shader, llevar las coordenadas del píxel actual y determinar si el punto está dentro de la figura. Si está fuera, se puede descartar directamente; si no, se colorea. El código GLSL es el siguiente. A algunos efectos no les importa la transparencia parcial, sino que quieren mostrar algo o no mostrar nada en absoluto según el valor de color de una textura; consulta [Descartar fragmentos].

```glsl
float sdf_circle(vec2 p, float r) {
  return length(p) - r;
}

void main() {
  float distance = sdf_circle(v_FragCoord, 1.0);
  if (distance > 0.0) {
    discard;
  }
  outputColor = vec4(1.0, 0.0, 0.0, 1.0);
}
```

Además de usar menos vértices, el SDF ofrece las ventajas siguientes:

-   Antialiasing sencillo. Lo trataremos en la subsección siguiente.
-   Fácil de combinar. Las operaciones de intersección y de diferencia se pueden combinar para completar gráficos complejos.
-   Es fácil conseguir algunos efectos de aspecto complejo. Por ejemplo, trazos, esquinas redondeadas y sombras; por supuesto, presentaremos algunas limitaciones de este método cuando realicemos estos efectos.

También se puede encontrar una explicación y una derivación detallada del SDF en [distfunctions]. Este método sirve para dibujar diversas formas 2D e incluso 3D habituales, y seguiremos usándolo para dibujar rectángulos y texto.

Volvamos a la clase base de las figuras y añadamos un método que reciba los parámetros necesarios para dibujar:

```ts{2}
export abstract class Shape {
  abstract render(device: Device, renderPass: RenderPass): void;
}
```

Se llama en el hook `render` del complemento y se le pasan los parámetros necesarios:

```ts
hooks.render.tap((shape) => {
    shape.render(this.#device, this.#renderPass);
});
```

En el método `render` de `Circle` se construye un sistema de coordenadas unitario, coherente con el espacio de recorte, con cuatro vértices divididos en dos triángulos (V0 -> V1 -> V2 y V0 -> V2 -> V3) mediante el array de índices `indexBuffer`:

<img alt="círculo unidad" src="/unit-circle.png" width="300" />

```ts
this.#fragUnitBuffer = device.createBuffer({
    viewOrSize: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]),
    usage: BufferUsage.VERTEX,
});

this.#indexBuffer = device.createBuffer({
    viewOrSize: new Uint32Array([0, 1, 2, 0, 2, 3]),
    usage: BufferUsage.INDEX,
});
```

Cada uno de estos cuatro vértices puede compartir los mismos atributos de estilo, como el centro del círculo, el radio, el color de relleno, etc. Esto reduce el tamaño de la memoria del array de vértices:

```ts
this.#instancedBuffer = device.createBuffer({
    viewOrSize: new Float32Array([
        this.#cx,
        this.#cy,
        this.#r,
        this.#r,
        this.#fillRGB.r / 255,
        this.#fillRGB.g / 255,
        this.#fillRGB.b / 255,
        this.#fillRGB.opacity,
    ]),
    usage: BufferUsage.VERTEX,
});
```

A continuación se especifica cómo debe disponerse el array de vértices, que se asocia con el shader mediante `shaderLocation`.

```ts
this.#inputLayout = device.createInputLayout({
    vertexBufferDescriptors: [
        {
            arrayStride: 4 * 2,
            stepMode: VertexStepMode.VERTEX,
            attributes: [
                {
                    shaderLocation: 0, // layout(location = 0) in vec2 a_FragCoord;
                    offset: 0,
                    format: Format.F32_RG,
                },
            ],
        },
        {
            arrayStride: 4 * 8,
            stepMode: VertexStepMode.INSTANCE,
            attributes: [
                {
                    shaderLocation: 1, // layout(location = 1) in vec2 a_Position;
                    offset: 0,
                    format: Format.F32_RG,
                },
                {
                    shaderLocation: 2, // layout(location = 2) in vec2 a_Size;
                    offset: 4 * 2,
                    format: Format.F32_RG,
                },
                {
                    shaderLocation: 3, // layout(location = 3) in vec4 a_FillColor;
                    offset: 4 * 4,
                    format: Format.F32_RGBA,
                },
            ],
        },
    ],
    indexBufferFormat: Format.U32_R,
    program: this.#program,
});
```

Los SDF también sirven para dibujar elipses, rectángulos, texto y más, pero de momento no vamos a añadir otras formas y nos centraremos primero en otra cuestión.

## Antialiasing {#antialiasing}

Si miras de cerca o amplías, verás que los bordes están claramente dentados. Al fin y al cabo, en el fragment shader tomamos una decisión tajante para cada punto de píxel: o lo coloreamos o lo descartamos, sin transición intermedia.

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
    });
    canvas.appendChild(circle);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });
    return canvas.getDOM();
})();
```

A continuación nos basamos en el artículo [Bordes suaves de formas SDF] para usar varios enfoques distintos y comparar los resultados.

### Smoothstep {#smoothstep}

Lo primero que se nos ocurre es que podemos suavizar con la función integrada `smoothstep` de GLSL / WGSL, que genera un valor suavizado para un rango de valores indicado, similar al efecto de la función de easing `ease-in/out`, en comparación con la función `step`. Puedes visualizar su forma modificando los parámetros en [Smoothstep - thebookofshaders.com]; por ejemplo, en la figura siguiente, y vale 1 cuando x es mayor que `0`, y vale 0 cuando x es menor que `-0.5`, y la zona intermedia queda suavizada:

<img alt="smoothstep" src="/smoothstep.png" width="300" />

La distancia SDF calculada en la sección anterior es un valor negativo, y elegimos un valor fijo más pequeño, `0.01`, para poder suavizar el rango menor de distancias en los bordes, y el valor procesado se puede tratar como transparencia.

```glsl
float alpha = smoothstep(0.0, 0.01, -distance);

outputColor = v_FillColor;
outputColor.a *= alpha;
```

El efecto es el siguiente:

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 1,
    });
    canvas.appendChild(circle);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });
    return canvas.getDOM();
})();
```

El problema de este método es que aumenta ligeramente el radio del círculo, ya que al fin y al cabo es un uno por ciento más. Además, al ampliar (más adelante hablaremos de las funciones relacionadas con la cámara) los bordes no quedan lo bastante nítidos.

### División por un valor fijo {#divide-fixed}

La función `saturate` no está disponible en GLSL y se puede implementar con `clamp`:

```glsl
float alpha = clamp(-distance / 0.01, 0.0, 1.0);
```

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 2,
    });
    canvas.appendChild(circle);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });
    return canvas.getDOM();
})();
```

### Derivadas en espacio de pantalla {#screen-space-derivatives}

El uso de `fwidth` para el antialiasing basado en la distancia se describe en [Usar fwidth para el antialiasing basado en la distancia]. ¿Qué es `fwidth`?

[¿Qué son las derivadas en espacio de pantalla y cuándo las usaría?] y [¿Qué es fwidth y cómo funciona?] describen en detalle los conceptos y los cálculos del método. En pocas palabras, el fragment shader procesa un quad de 2×2 cada vez, en lugar de un solo punto de píxel. El razonamiento de la GPU para hacerlo es el siguiente, tomado de [Un recorrido por el pipeline gráfico de 2011, parte 8]:

> Además, este es un buen momento para explicar por qué trabajamos con quads de 2×2 píxeles y no con píxeles individuales. La razón principal son las derivadas. Los muestreadores de textura dependen de las derivadas en espacio de pantalla de las coordenadas de textura para seleccionar y filtrar los mipmaps (como vimos en la parte 4); y, a partir del shader model 3.0, esa misma maquinaria está disponible directamente para los pixel shaders en forma de instrucciones de derivadas.

Veamos cómo se calculan las derivadas parciales en cada quad de 2×2, por ejemplo para uv:

![fwidth de uv](https://pic2.zhimg.com/80/v2-0f2d0605965ab352aec8826d0eed02dd_1440w.webp)

Para que a quienes desarrollan les resulte más fácil hacerse una idea de cuánto ha cambiado el píxel para un valor dado, tanto OpenGL / WebGL como WebGPU ofrecen los métodos siguientes. Pero WebGL1 exige activar la extensión `GL_OES_standard_derivatives`, mientras que WebGL2 y WebGPU no:

-   `dFdx` calcula cuánto ha cambiado el valor de un atributo de parámetro a lo largo de un píxel en la dirección horizontal de la pantalla.
-   `dFdy` calcula cuánto ha cambiado el valor de un atributo de parámetro a lo largo de un píxel en la dirección vertical de la pantalla.
-   `fwidth` calcula `abs(dFdx) + abs(dFdy)`

Por tanto, tenemos dos formas de calcular cuánto cambia un parámetro dentro de un píxel. ¿Hay diferencias entre ellas?

```glsl
pixelSize = fwidth(dist);
/* or */
pixelSize = length(vec2(dFdx(dist), dFdy(dist)));
```

[AAA - Antialiasing analítico] señala que `fwidth` tiene menos coste que `length` y, aunque hay una ligera desviación en la dirección diagonal, en nuestro escenario es casi despreciable.

> Fast LAA tiene un ligero sesgo en las direcciones diagonales, lo que hace que las formas circulares parezcan muy ligeramente romboidales y tengan una curvatura un poco más acusada en las direcciones ortogonales, sobre todo cuando son pequeñas. A veces los bordes de las diagonales también quedan ligeramente borrosos.

Pasamos la distancia obtenida del cálculo del SDF y calculamos cuánto ha cambiado para reflejarlo en la transparencia.

```glsl
float alpha = clamp(-distance / fwidth(-distance), 0.0, 1.0);
```

```js eval code=false
(async () => {
    const { Canvas, Circle } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 3,
    });
    canvas.appendChild(circle);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });
    return canvas.getDOM();
})();
```

## Marca de modificado {#dirty-flag}

Antes escribíamos los atributos de estilo, como el color de relleno y el centro del círculo, en el array de vértices, así que, cuando queremos modificar el color, también tenemos que volver a modificar los datos del buffer. En el escenario de modificación continua del ejemplo siguiente, se produciría mucho coste innecesario si se llamara a la API subyacente de inmediato cada vez que se modifica una propiedad.

```ts
circle.fill = 'blue';
circle.fill = 'yellow';
circle.cx = 500;
```

Queremos aplazar las tareas costosas, como modificar datos, y fusionarlas en el momento adecuado, por ejemplo antes del renderizado, aplicando un patrón de diseño habitual llamado «marca de modificado»: [Marca de modificado - Game Programming Patterns]. Al modificar una propiedad, solo activamos la marca de modificado y no realizamos ninguna otra operación costosa:

```ts{4}
set cx(cx: number) {
  if (this.#cx !== cx) {
    this.#cx = cx;
    this.renderDirtyFlag = true;
  }
}
```

En el método `render`, el buffer subyacente solo se actualiza cuando se detecta una modificación de una propiedad, de modo que, por muchas veces que se modifique una propiedad entre renderizados, el buffer solo se actualiza una vez:

```ts
if (this.renderDirtyFlag) {
    this.#instancedBuffer.setSubData(
        0,
        new Uint8Array(
            new Float32Array([
                this.#cx,
                this.#cy,
                this.#r,
                this.#r,
                this.#fillRGB.r / 255,
                this.#fillRGB.g / 255,
                this.#fillRGB.b / 255,
                this.#fillRGB.opacity,
            ]).buffer,
        ),
    );
}
```

Por supuesto, no olvides restablecer la marca de modificado cuando termina el renderizado:

```ts
this.renderDirtyFlag = false;
```

Prueba el efecto:

```js eval code=false
cx2 = Inputs.range([50, 300], { label: 'cx', value: 100, step: 1 });
```

```js eval code=false
cy2 = Inputs.range([50, 300], { label: 'cy', value: 100, step: 1 });
```

```js eval code=false
r2 = Inputs.range([50, 300], { label: 'r', value: 100, step: 1 });
```

```js eval code=false
fill2 = Inputs.color({ label: 'fill', value: '#ff0000' });
```

```js eval code=false inspector=false
circle = (() => {
    const { Circle } = Lesson2;
    const circle = new Circle({
        cx: 100,
        cy: 100,
        r: 100,
        fill: 'red',
        antiAliasingType: 3,
    });
    return circle;
})();
```

```js eval code=false inspector=false
(() => {
    circle.cx = cx2;
    circle.cy = cy2;
    circle.r = r2;
    circle.fill = fill2;
})();
```

```js eval code=false
(async () => {
    const { Canvas } = Lesson2;

    const canvas = await Utils.createCanvas(Canvas, 200, 200);

    canvas.appendChild(circle);

    let id;
    const animate = () => {
        canvas.render();
        id = requestAnimationFrame(animate);
    };
    animate();

    unsubscribe(() => {
        cancelAnimationFrame(id);
        canvas.destroy();
    });
    return canvas.getDOM();
})();
```

En la introducción posterior a los grafos de escena también aplicaremos la marca de modificado.

## Lectura adicional {#extended-reading}

-   [distfunctions]
-   [Aprovechar Rust y la GPU para renderizar interfaces de usuario a 120 FPS]
-   [Transformación de distancia subpíxel: renderizado de fuentes de alta calidad para WebGPU]
-   [AAA - Antialiasing analítico]
-   [Aprende a programar shaders con Rick y Morty]

[appendChild de la API de Node]: https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild
[GPURenderPassEncoder]: https://developer.mozilla.org/en-US/docs/Web/API/GPURenderPassEncoder
[beginRenderPass]: https://developer.mozilla.org/en-US/docs/Web/API/GPUCommandEncoder/beginRenderPass
[submit]: https://developer.mozilla.org/en-US/docs/Web/API/GPUQueue/submit
[circle]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/circle
[d3-color]: https://github.com/d3/d3-color
[hsl]: https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/hsl
[CircleGeometry]: https://threejs.org/docs/#api/en/geometries/CircleGeometry
[drawing-rectangles]: https://zed.dev/blog/videogame#drawing-rectangles
[distfunctions]: https://iquilezles.org/articles/distfunctions/
[Aprovechar Rust y la GPU para renderizar interfaces de usuario a 120 FPS]: https://zed.dev/blog/videogame
[gl.clearColor]: https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/clearColor
[clearValue]: https://www.w3.org/TR/webgpu/#dom-gpurenderpasscolorattachment-clearvalue
[Usar fwidth para el antialiasing basado en la distancia]: http://www.numb3r23.net/2015/08/17/using-fwidth-for-distance-based-anti-aliasing/
[¿Qué es fwidth y cómo funciona?]: https://computergraphics.stackexchange.com/a/63
[¿Qué son las derivadas en espacio de pantalla y cuándo las usaría?]: https://gamedev.stackexchange.com/questions/130888/what-are-screen-space-derivatives-and-when-would-i-use-them
[Smoothstep - thebookofshaders.com]: https://thebookofshaders.com/glossary/?search=smoothstep
[Bordes suaves de formas SDF]: https://bohdon.com/docs/smooth-sdf-shape-edges/
[Transformación de distancia subpíxel: renderizado de fuentes de alta calidad para WebGPU]: https://acko.net/blog/subpixel-distance-transform/
[Un recorrido por el pipeline gráfico de 2011, parte 8]: https://fgiesen.wordpress.com/2011/07/10/a-trip-through-the-graphics-pipeline-2011-part-8/
[Descartar fragmentos]: https://learnopengl.com/Advanced-OpenGL/Blending
[AAA - Antialiasing analítico]: https://blog.frost.kiwi/analytical-anti-aliasing
[Aprende a programar shaders con Rick y Morty]: https://danielchasehooper.com/posts/code-animated-rick/
[oklch]: https://github.com/d3/d3-color/issues/87
[sistema de coordenadas de recorte]: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_model_view_projection#clip_space
[Marca de modificado - Game Programming Patterns]: https://gameprogrammingpatterns.com/dirty-flag.html
