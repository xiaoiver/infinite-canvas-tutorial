---
outline: deep
description: 'Deriva las representaciones SDF de elipses y rectángulos redondeados. Aprende a añadir sombras exteriores e interiores a las figuras y a implementar la prueba de punto dentro de la forma para geometrías complejas.'
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lección 9 - Dibujar elipses y rectángulos',
          },
      ]
---
# Lección 9 - Dibujar elipses y rectángulos {#lesson-9-drawing-ellipse-and-rectangle}

En esta lección aprenderás lo siguiente:

-   Derivar las representaciones SDF de la elipse y del rectángulo redondeado
-   Añadir sombras exteriores e interiores al rectángulo redondeado y a otros SDF
-   Determinar si un punto cualquiera está dentro de una elipse o de un rectángulo redondeado

En la [Lección 2] usamos los SDF para dibujar círculos, y es fácil extenderlo a la elipse y al rectángulo. [Funciones de distancia 2D] ofrece más expresiones SDF para gráficos 2D:

```glsl
float sdf_ellipse(vec2 p, vec2 r) {}
float sdf_rounded_box(vec2 p, vec2 b, vec4 r) {}
```

En el shader, usa la variable `shape` para distinguir estas tres formas, de modo que podamos dibujarlas con el mismo conjunto de shaders:

```glsl
if (shape < 0.5) {
  outerDistance = sdf_circle(v_FragCoord, 1.0);
  innerDistance = sdf_circle(v_FragCoord, r.x);
} else if (shape < 1.5) {
  outerDistance = sdf_ellipse(v_FragCoord, vec2(wh, 1.0));
  innerDistance = sdf_ellipse(v_FragCoord, r);
} else if (shape < 2.5) {
  outerDistance = sdf_rounded_box(v_FragCoord, vec2(wh, 1.0), 0.0);
  innerDistance = sdf_rounded_box(v_FragCoord, r, 0.0);
}
```

A continuación, veamos cómo se deriva el SDF.

## Rectángulo {#rect}

[El SDF de una caja] y [Aprovechar Rust y la GPU para renderizar interfaces de usuario a 120 FPS] han mostrado el proceso de derivación en forma de vídeos y animaciones.

A partir de la simetría del rectángulo, al colocar su centro en el origen, podemos transformar el problema de la distancia de cualquier punto al borde del rectángulo al primer cuadrante mediante la función `abs()`, donde `p` es la coordenada de un punto cualquiera, `b` es la coordenada de la esquina superior derecha del rectángulo y, como el centro coincide con el origen, es `[width / 2, height / 2]`, y `q` representa el vector desde el punto hasta la esquina superior derecha:

```glsl
float sdf_box(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
}
```

![función abs del SDF del rectángulo](/rect-sdf-abs.png)

Después considera el caso en el que el punto está fuera del rectángulo. Si se extiende hacia fuera desde la esquina superior derecha del rectángulo, se puede dividir en cuatro cuadrantes. En el primer cuadrante de la figura siguiente, la distancia es la longitud del vector `q`, `length(q)`. Si el punto cae en el segundo cuadrante, la distancia es `q.y` porque `q.x` es negativo y, del mismo modo, si cae en el cuarto cuadrante, la distancia es `q.x`.

![SDF del rectángulo](/rect-sdf-dist.png)

El autor original usó con ingenio `length(max(q, 0.0))` para unificar estos tres casos, y `max()` para eliminar las componentes negativas, reduciendo al máximo el juicio por ramas en el shader. Después considera el caso en el que el punto está dentro del rectángulo, es decir, en el tercer cuadrante de la figura anterior: en ese momento las dos componentes de `q` son negativas, `max(q.x, q.y)` puede obtener el valor absoluto de la distancia más cercana, y el `min()` más externo puede unificar el caso en el que el punto está dentro con los tres anteriores, de nuevo para reducir el juicio por ramas. El SDF completo es el siguiente:

```glsl
float sdf_box(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
```

Hasta aquí podemos dibujar rectángulos y, tomando como referencia [SVG \<rect\>], añadir las propiedades siguientes:

```js
const rect = new Rect({
    x,
    y,
    width,
    height,
    fill,
});
```

### Añadir esquinas redondeadas {#rounded-rect}

La figura siguiente procede de [Redondear esquinas en los SDF]. Si observamos el campo de distancia visualizado mediante curvas de nivel, podemos ver que el propio rectángulo está redondeado. Si tomamos como ejemplo los puntos cercanos a la esquina superior derecha del rectángulo, no hay un único punto a igual distancia, sino que se distribuyen sobre la circunferencia cuyo centro es esa esquina superior derecha.

![SDF de rectángulo redondeado](/rect-sdf-rounded.png)

De hecho, no solo los rectángulos: todos los gráficos representados mediante SDF se pueden convertir en versiones «redondeadas». La figura siguiente procede de [Funciones de distancia 2D]:

```glsl
float opRound( in vec2 p, in float r ) {
  return sdShape(p) - r;
}
```

![más formas redondeadas](/shapes-sdf-rounded.png)

Así, la representación SDF completa del rectángulo redondeado es la siguiente:

```glsl
float sdf_rounded_box(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
```

Siguiendo la nomenclatura de Figma, usamos `cornerRadius`, pero el SDF por sí solo no puede lograr el efecto `smoothing`; consulta [Ajustar el radio de esquina y el suavizado] y [En busca desesperada de los squircles] para los detalles. Además, también es posible admitir un radio de esquina distinto en cada esquina; consulta [Zed Blade WGSL], un shader que Zed escribió sobre el renderizador [blade], con sintaxis WGSL.

```js eval code=false
$icCanvas2 = call(() => {
    return document.createElement('ic-canvas-lesson9');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect } = Lesson9;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas2.parentElement.style.position = 'relative';
    $icCanvas2.parentElement.appendChild($stats);

    $icCanvas2.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        for (let i = 0; i < 1000; i++) {
            const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                Math.random() * 255,
            )},${Math.floor(Math.random() * 255)})`;
            const rect = new Rect({
                x: Math.random() * 1000,
                y: Math.random() * 1000,
                fill,
                cornerRadius: 10,
            });
            // rect.x = Math.random() * 1000;
            // rect.y = Math.random() * 1000;
            rect.width = Math.random() * 40;
            rect.height = Math.random() * 40;
            canvas.appendChild(rect);

            rect.addEventListener('pointerenter', () => {
                rect.fill = 'red';
            });
            rect.addEventListener('pointerleave', () => {
                rect.fill = fill;
            });
        }
    });

    $icCanvas2.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

### Añadir sombra exterior {#drop-shadow}

Cuando se habla de sombras, puede que hayas oído hablar de [box-shadow] y de `filter: drop-shadow()` en CSS. La figura siguiente procede del artículo [Drop-shadow: el filtro CSS infravalorado], que muestra de forma intuitiva la diferencia entre ambos:

![Comparar box-shadow con drop-shadow](https://css-irl.info/drop-shadow-01.jpg)

El segundo suele usarse más, como en [tailwindcss - sombra exterior]. Así que añadimos las propiedades siguientes al rectángulo:

```ts
rect.dropShadowColor = 'black';
rect.dropShadowOffsetX = 10;
rect.dropShadowOffsetY = 10;
rect.dropShadowBlurRadius = 5;
```

![Sombra exterior en Figma](/figma-drop-shadow.png)

A continuación usaremos WebGL / WebGPU para dibujar sombras de gráficos 2D. El enfoque habitual es usar un desenfoque gaussiano en el posprocesado, como el [DropShadowFilter] de Pixi.js. El efecto de desenfoque gaussiano 2D se puede descomponer en dos efectos 1D, horizontal y vertical, pero la operación de convolución sigue exigiendo muestrear los píxeles vecinos (según el tamaño del núcleo de convolución).

El CTO de Figma, Evan Wallace, presentó un método de aproximación más rápido en el artículo [Sombras rápidas de rectángulos redondeados], que no requiere muestrear texturas, y el artículo [Aprovechar Rust y la GPU para renderizar interfaces de usuario a 120 FPS] también ofreció una introducción más detallada. La convolución de la función gaussiana con la función escalón equivale a la integral de la función gaussiana, que da como resultado la función de error [Función de error] (también conocida como erf). Por tanto, generar un rectángulo desenfocado equivale a desenfocar cada dimensión por separado y después tomar la intersección de los dos resultados, sin considerar el radio de esquina.

Función gaussiana:

$$ f(x) = \frac{\exp(-x^2 / (2 \sigma^2))}{(\sigma \sqrt{2 \pi})} $$

La función de error es la integral de una función gaussiana y se usa para describir la función de distribución acumulada de una distribución normal.

$$ ∫f(x)dx=F(x) $$

$$ F(x) = \frac{(1 + erf(\frac{x}{\sigma \sqrt2}))}{2} $$

Una aproximación habitual de la función de error procede de [Abramowitz y Stegun. Manual de funciones matemáticas.]

$$ erf(x) ≈ \frac{x}{1 + ax^2 + bx^4 + cx^6 + dx^8 + ex^{10}} $$

donde los coeficientes de los términos del polinomio son:

$$
\displaylines{
a =0.278393, \\
b =0.230389, \\
c =0.000972, \\
d =0.078108, \\
e =2.03380×10^{−4}
}
$$

La implementación siguiente procede de [Zed Blade WGSL], que hemos reescrito en GLSL. [Rectángulos redondeados desenfocados] también ofrece otra versión de erf.

```glsl
vec2 erf(vec2 x) {
  vec2 s = sign(x), a = abs(x);
  x = 1.0 + (0.278393 + (0.230389 + 0.078108 * (a * a)) * a) * a;
  x *= x;
  return s - s / (x * x);
}
```

De momento dejemos de lado las esquinas redondeadas y calculemos el valor final de la máscara de sombra. Aquí el límite de la sombra lo determina la diferencia entre `integral_x` e `integral_y`. `integral_x.x - integral_x.y` calcula el ancho de la sombra en el eje x, e `integral_y.x - integral_y.y` calcula el alto de la sombra en el eje y. Multiplica estos dos valores para obtener el valor final de la máscara de sombra.

```glsl
// Return the mask for the shadow of a box from lower to upper
float rect_shadow(vec2 pixel_position, vec2 origin, vec2 size, float sigma) {
  vec2 bottom_right = origin + size;
  vec2 x_distance = vec2(pixel_position.x - origin.x, pixel_position.x - bottom_right.x);
  vec2 y_distance = vec2(pixel_position.y - origin.y, pixel_position.y - bottom_right.y);
  vec2 integral_x = 0.5 + 0.5 * erf(x_distance * (sqrt(0.5) / sigma));
  vec2 integral_y = 0.5 + 0.5 * erf(y_distance * (sqrt(0.5) / sigma));
  return (integral_x.x - integral_x.y) * (integral_y.x - integral_y.y);
}
```

Sin embargo, no existe una solución de forma cerrada como la anterior para la convolución 2D de un rectángulo redondeado con una gaussiana, porque la fórmula de un rectángulo redondeado no es separable. La astucia de la aproximación de Evan Wallace consiste en hacer una convolución exacta de forma cerrada a lo largo de un eje y, después, deslizar manualmente la gaussiana a lo largo del eje opuesto un número finito de veces:

```glsl
float blur_along_x(float x, float y, float sigma, float corner, vec2 half_size) {
  float delta = min(half_size.y - corner - abs(y), 0.);
  float curved =
  half_size.x - corner + sqrt(max(0., corner * corner - delta * delta));
  vec2 integral =
  0.5 + 0.5 * erf((x + vec2(-curved, curved)) * (sqrt(0.5) / sigma));
  return integral.y - integral.x;
}
```

```glsl
// The signal is only non-zero in a limited range, so don't waste samples
float low = center_to_point.y - half_size.y;
float high = center_to_point.y + half_size.y;
float start = clamp(-3. * blur_radius, low, high);
float end = clamp(3. * blur_radius, low, high);

// Accumulate samples (we can get away with surprisingly few samples)
float step = (end - start) / 4.;
float y = start + step * 0.5;

for (int i = 0; i < 4; i++) {
  alpha += blur_along_x(center_to_point.x, center_to_point.y - y, blur_radius,
                        cornerRadius, half_size) *
          gaussian(y, blur_radius) * step;
  y += step;
}
```

En la implementación, las sombras hay que dibujarlas por separado para cada rectángulo, lo que rompe el efecto del lote combinado anterior. El motivo es que tenemos que hacerlo en un orden de dibujo estricto, e incluso reordenar antes de cada repintado. El código siguiente procede de este artículo: [Sombras rápidas de rectángulos redondeados]. Antes de dibujar hay que ordenar todos los rectángulos por una profundidad preestablecida y después dibujar, por turno, la sombra y el cuerpo:

```ts
render() {
  boxes.sort(function(a, b) {
    return a.depth - b.depth;
  });
  for (var i = 0; i < boxes.length; i++) {
    boxes[i].callback(); // Draw shadow first and then the rectangle itself.
  }
}
```

Como ejemplo, los dos rectángulos siguientes se dibujan en este orden: sombra del rectángulo verde, rectángulo verde, sombra del rectángulo rojo, rectángulo rojo. Si seguimos la idea anterior de fusionar las dos sombras y los dos cuerpos de los rectángulos en dos lotes de dibujo separados, no podremos hacer que las sombras de los rectángulos rojos se proyecten sobre los rectángulos verdes. Así que, al usarlo, hay que asignar `batchable = false` a los rectángulos con sombras.

```js eval code=false
$icCanvas3 = call(() => {
    return document.createElement('ic-canvas-lesson9');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect } = Lesson9;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas3.parentElement.style.position = 'relative';
    $icCanvas3.parentElement.appendChild($stats);

    $icCanvas3.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        const rect = new Rect({
            x: 50,
            y: 50,
            fill: 'green',
            cornerRadius: 50,
            batchable: false,
            dropShadowColor: 'black',
            dropShadowOffsetX: 10,
            dropShadowOffsetY: 10,
            dropShadowBlurRadius: 10,
        });
        rect.width = 400;
        rect.height = 100;
        canvas.appendChild(rect);

        const rect2 = new Rect({
            x: 100,
            y: 100,
            fill: 'red',
            batchable: false,
            cornerRadius: 50,
            dropShadowColor: 'black',
            dropShadowBlurRadius: 10,
        });
        rect2.width = 400;
        rect2.height = 100;
        canvas.appendChild(rect2);
    });

    $icCanvas3.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

Otra cosa que hay que tener en cuenta es que, debido al radio de desenfoque de la sombra, hay que hacer que el rectángulo se expanda un margen respecto de su tamaño original, que aquí se fija en `3 * dropShadowBlurRadius`.

```glsl
float margin = 3.0 * dropShadow.z;
origin += dropShadow.xy;
v_Origin = origin;
v_Size = size;

origin -= margin;
size += 2.0 * margin;
vec2 center = origin + size / 2.0;
v_Point = center + a_FragCoord * (size / 2.0);
```

Por último, las sombras también afectan al cálculo de `RenderBounds`; si no, los rectángulos se descartarían de forma incorrecta cuando su cuerpo está fuera del viewport pero sus sombras están dentro:

```ts
this.renderBounds.addBounds(
    new AABB(
        x + dropShadowOffsetX - dropShadowBlurRadius,
        y + dropShadowOffsetY - dropShadowBlurRadius,
        x + dropShadowOffsetX + width + dropShadowBlurRadius,
        y + dropShadowOffsetY + height + dropShadowBlurRadius,
    ),
);
```

A partir de este enfoque también se pueden conseguir algunos efectos interesantes; consulta [Efecto de desenfoque de lente de formas con SDF y WebGL].

Evidentemente, el método anterior solo funciona para rectángulos redondeados, pero ¿hay un método más general para círculos, elipses y otras representaciones SDF? Hay un ejemplo en Shadertoy: [Sombra exterior de un rectángulo redondeado] y, curiosamente, hay otro ejemplo basado en este que permite implementar tanto la sombra exterior como la interior. A continuación nos centramos en la implementación de la sombra interior.

### Añadir sombra interior {#inner-shadow}

La imagen siguiente muestra el efecto de sombra interior de Figma, que se usa a menudo en componentes de UI como un botón.

![Sombra interior en Figma](/figma-inner-shadow.png)

Añadamos los atributos siguientes:

```ts
rect.innerShadowColor = 'black';
rect.innerShadowOffsetX = 10;
rect.innerShadowOffsetY = 10;
rect.innerShadowBlurRadius = 5;
```

Tomando como referencia el ejemplo de Shadertoy [Sombra interior de un rectángulo redondeado], añadimos de forma parecida la lógica de dibujo de la sombra a cada una de las tres formas actuales. Aquí usamos `sigmoid` para suavizar:

```glsl
float make_shadow(vec2 pos, vec2 halfSize, float cornerRd, float blurRd, float distMul, float shape) {
  float distance;
  if (shape < 0.5) {
    distance = sdf_circle(pos, halfSize.x);
  } else if (shape < 1.5) {
    distance = sdf_ellipse(pos, halfSize);
  } else if (shape < 2.5) {
    distance = sdf_rounded_box(pos, halfSize, cornerRd + blurRd);
  }
  float dist = sigmoid(distMul * distance / blurRd);
  return clamp(dist, 0.0, 1.0);
}
```

```js eval code=false
$icCanvas4 = call(() => {
    return document.createElement('ic-canvas-lesson9');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Rect, Circle, Ellipse } = Lesson9;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas4.parentElement.style.position = 'relative';
    $icCanvas4.parentElement.appendChild($stats);

    $icCanvas4.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;
        for (let i = 0; i < 10; i++) {
            const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                Math.random() * 255,
            )},${Math.floor(Math.random() * 255)})`;

            const rect = new Rect({
                x: Math.random() * 1000,
                y: Math.random() * 1000,
                fill,
                cornerRadius: 50,
                innerShadowColor: 'black',
                innerShadowOffsetX: Math.random() * 20 - 10,
                innerShadowOffsetY: Math.random() * 20 - 10,
                innerShadowBlurRadius: Math.random() * 10,
            });
            rect.width = 200;
            rect.height = 100;
            canvas.appendChild(rect);

            const circle = new Circle({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                r: 100,
                fill,
                innerShadowColor: 'black',
                innerShadowOffsetX: Math.random() * 20 - 10,
                innerShadowOffsetY: Math.random() * 20 - 10,
                innerShadowBlurRadius: Math.random() * 10,
            });
            canvas.appendChild(circle);

            const ellipse = new Ellipse({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                rx: 100,
                ry: 50,
                fill,
                innerShadowColor: 'blue',
                innerShadowOffsetX: Math.random() * 20 - 10,
                innerShadowOffsetY: Math.random() * 20 - 10,
                innerShadowBlurRadius: Math.random() * 10,
            });
            canvas.appendChild(ellipse);
        }
    });

    $icCanvas4.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## Elipse {#ellipse}

A diferencia de determinar la distancia más cercana de un punto arbitrario a un círculo, el método exacto para analizar una elipse es mucho más complejo, y [Distancia a una elipse] ofrece dos métodos: la ecuación cuártica y el método de Newton.

### Ecuación cuártica {#quartic-equation}

Una elipse se representa mediante $q(\omega) = \{ a⋅cos \omega, b⋅sin \omega \}$, donde el cuadrado de la distancia de cualquier punto $p$ a un punto de la elipse es:

$$ s^2(\omega) = \left| q(\omega) - p \right|^2 $$

Desarrollada:

$$ a^2cos^2\omega + b^2sin^2\omega + x^2 + y^2 - 2(axcos \omega - bysin \omega) $$

Al derivar respecto de $\omega$:

$$ −2a^2sin\omega ⋅cos\omega + 2b^2cos\omega ⋅sin\omega + 2axsin\omega − 2bycos\omega $$

La derivada en el punto más cercano es 0, y se obtiene al sustituir $\lambda=cos\omega$:

$$ \sqrt{1-\lambda^{2}}\left(\left(b^{2}-a^{2}\right) \lambda+a x\right)=b y \lambda $$

Se trata de una ecuación cuártica de una variable para $\lambda$, con los coeficientes de cada término:

$$
\displaylines{
  a_4=\left(b^{2}-a^{2}\right)^{2} \\
  a_3=2 a x\left(b^{2}-a^{2}\right) \\
  a_2=\left(a^{2} x^{2}+b^{2} y^{2}\right)-\left(b^{2}-a^{2}\right)^{2} \\
  a_1=-2 a x\left(b^{2}-a^{2}\right) \\
  a_0=-a^{2} x^{2}
}
$$

Para reducir a 1 el coeficiente del término de cuarto grado y obtener un [Polinomio mónico], divide cada uno de los coeficientes anteriores entre $a_4$, y no te preocupes por dividir entre 0 porque es una elipse. Usa también la sustitución $m n$:

$$ m=x \frac{a}{b^{2}-a^{2}} \quad n=y \frac{b}{b^{2}-a^{2}} $$

Así se obtiene la [Ecuación cuártica], con los coeficientes siguientes:

$$
\displaylines{
  a_4=1\\
  a_3=2m \\
  a_2=m^2 + n^2  - 1 \\
  a_1=-2m \\
  a_0=-m^2
}
$$

Como el coeficiente de mayor grado es 1, esto se puede transformar en un problema de resolver una ecuación cúbica [Fórmula cúbica], usando la [Cúbica resolvente]:

$$
\displaylines{
f(x)=x^4+a_3x^3+a_2x^2+a_1x+a_0 \\
g(x)=x^3+b_2x^2+b_1x+b_0
}
$$

donde los coeficientes se corresponden así:

$$
b_2 = -a_2 \quad
b_1 = a_1a_3-4a_0 \quad
b_0 = 4a_0a_2-a_1^2-a_0a_3^2
$$

Al sustituir se obtiene:

$$
b_2 = -(m^2+n^2-1) \quad
b_1 = 0 \quad
b_0 = -4m^2n^2
$$

Resolver la [Fórmula cúbica] implica intentar eliminar los coeficientes binomiales, lo que se puede hacer mediante $z=x-1/3k_2$. Esto da la forma estándar $x^3+px=q$, donde:

$$
p = (3k_1-k_2^2)/3 \quad
q = (9k_1k_2-27k_0-2k_2^3)/27
$$

Al sustituir $b_0 b_1 b_2$ se obtiene:

$$
\displaylines{
p = -(m^2+n^2-1)^2/3 \\
q = 4m^2n^2+2(m^2+n^2-1)^3/27
}
$$

Si se sigue simplificando la ecuación anterior, sea:

$$
\displaylines{
Q = (\frac{m^2+n^2-1}{3})^2 \\
R = 2m^2n^2 + (\frac{m^2+n^2-1}{3})^3
}
$$

La forma normalizada queda: $x^3 - 3Qx + 2R = 0$

Este método es costoso en cálculo, y el ejemplo escrito en Shadertoy que se muestra en [Distancia a una elipse] tiene un FPS mucho menor que los dos métodos que se describen a continuación.

### Método de Newton {#newton-method}

El vector formado por cualquier punto $p$ y el punto más cercano $q$ de la elipse debe ser perpendicular a la tangente a la elipse en el punto $q$.

$$ <p-q(\omega), q'(\omega)> = 0 $$

Donde:

$$ q'(\omega) = (-a⋅sin \omega, b⋅cos \omega) $$

Al sustituir se obtiene:

$$
\displaylines{
  f(\omega) = -a⋅sin \omega ⋅(x-a⋅cos \omega) + b⋅cos \omega ⋅(y-b⋅sin \omega) = 0 \\
  f'(\omega) = -<p-u,v> - <v,v> \\

  u = ( a⋅cos \omega, b⋅sin \omega ) \\
  v = (-a⋅sin \omega, b⋅cos \omega )
}
$$

El [Método de Newton] es un método para resolver ecuaciones de forma aproximada en los dominios de los números reales y complejos.

$$x_{n+1} =x_n-{\frac {f(x_n)}{f'(x_n)}} $$

Al sustituir se obtiene:

$$\omega_{n+1} = \omega_n + {\frac {<p-u,v>}{<p-u,u> + <v,v>}} $$

[Distancia a una elipse]. El autor original usó 5 iteraciones para lograr un resultado muy bueno:

```glsl
for (int i=0; i<5; i++) {
  vec2 cs = vec2(cos(w),sin(w));
  vec2 u = ab*vec2( cs.x,cs.y);
  vec2 v = ab*vec2(-cs.y,cs.x);
  w = w + dot(p-u,v)/(dot(p-u,u)+dot(v,v));
}
```

Lo único que falta a continuación es encontrar $\omega_0$. Siguiendo con la simetría y considerando solo el caso en el que el punto está en el primer cuadrante, primero se determina si el punto está dentro de la elipse y se sustituye en la ecuación de la elipse:

```glsl
bool s = dot(p/ab,p/ab)>1.0;
```

Si está fuera de la elipse, se puede estirar hasta convertirla en un círculo (el método que se describe en la subsección siguiente también se usará), donde $\omega_0 = atan(y / x)$, y después estirar de nuevo hacia la elipse en la dirección inversa: $\omega_0 = atan(a⋅y / b⋅x)$

Si está dentro de la elipse, elige el semieje mayor $0$ o el semieje menor $\pi/2$ como punto de partida:

```glsl
float w = s ? atan(p.y*ab.x, p.x*ab.y) :
  ((ab.x*(p.x-ab.x)<ab.y*(p.y-ab.y))? 1.5707963 : 0.0);
```

Comparado con el método anterior de resolver una ecuación cuártica de una variable, este método tiene menos coste. Aun así, contiene un bucle for con un número fijo de iteraciones, que se desenrolla al compilar GLSL; consulta [Rendimiento de los bucles en un shader].
Por último, presentaremos un método de estimación aproximada con el coste mínimo.

### Método aproximado de estiramiento {#stretch-approximately-method}

[SDF de elipsoide] describe este método de estirar hasta un círculo unidad y después recuperar la elipse. Pero ¿cómo eliges los coeficientes de estiramiento al recuperar? Si el punto está en el eje X, el coeficiente es `r.x`, y en el eje Y es `r.y`, y primero se elige el menor de los dos:

```glsl
float sdf_ellipse_V1( in vec2 p, in vec2 r )
{
  float k1 = length(p/r);
  return (k1-1.0)*min(r.x,r.y);
}
```

El renderizado real revela que este enfoque tiene problemas importantes en el eje mayor y no se ajusta bien:

![artefacto en el borde de la elipse](/ellipse-approximate-v1.png)

El autor original dio una versión mejorada:

```glsl
float sdf_ellipse_V3( in vec3 p, in vec3 r )
{
  float k1 = length(p/r);
  return length(p)*(1.0-1.0/k1);
}
```

Sin embargo, el renderizado real revela que este enfoque tiene un dentado importante en los bordes:

![artefacto en el borde de la elipse](/ellipse-approximate-v3.png)

Al final los autores añadieron la consideración de los gradientes, que también usamos:

```glsl
float sdf_ellipse_V2( in vec2 p, in vec2 r )
{
  float k1 = length(p/r);
  float k2 = length(p/(r*r));
  return k1*(k1-1.0)/k2;
}
```

Puedes ver que los resultados son mucho mejores.

```js eval code=false
$icCanvas = call(() => {
    return document.createElement('ic-canvas-lesson9');
});
```

```js eval code=false inspector=false
call(() => {
    const { Canvas, Ellipse } = Lesson9;

    const stats = new Stats();
    stats.showPanel(0);
    const $stats = stats.dom;
    $stats.style.position = 'absolute';
    $stats.style.left = '0px';
    $stats.style.top = '0px';

    $icCanvas.parentElement.style.position = 'relative';
    $icCanvas.parentElement.appendChild($stats);

    $icCanvas.addEventListener('ic-ready', (e) => {
        const canvas = e.detail;

        for (let i = 0; i < 1000; i++) {
            const fill = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
                Math.random() * 255,
            )},${Math.floor(Math.random() * 255)})`;
            const ellipse = new Ellipse({
                cx: Math.random() * 1000,
                cy: Math.random() * 1000,
                rx: Math.random() * 20,
                ry: Math.random() * 20,
                fill,
            });
            canvas.appendChild(ellipse);
            ellipse.addEventListener('pointerenter', () => {
                ellipse.fill = 'red';
            });
            ellipse.addEventListener('pointerleave', () => {
                ellipse.fill = fill;
            });
        }
    });

    $icCanvas.addEventListener('ic-frame', (e) => {
        stats.update();
    });
});
```

## Picking {#picking}

Ahora mismo nuestro plugin de picking usa el [Método geométrico], así que necesitamos implementar métodos de determinación separados para elipses y rectángulos redondeados, y más adelante presentaremos un método de picking más general, basado en la GPU y codificado por color. En los dos ejemplos anteriores puedes pasar el ratón por encima de cualquier forma para probar el efecto de picking.

### Elipse {#picking-ellipse}

Las decisiones de picking de la elipse son más sencillas; por ejemplo, de forma predeterminada se tienen en cuenta las áreas de relleno y de trazo:

```ts
function isPointInEllipse(
    x: number,
    y: number,
    h: number,
    k: number,
    a: number,
    b: number,
) {
    const dx = x - h;
    const dy = y - k;

    const squaredDistance = (dx * dx) / (a * a) + (dy * dy) / (b * b);

    // Inside ellipse
    return squaredDistance <= 1;
}
```

### Rectángulo redondeado {#picking-rounded-rect}

También es muy sencillo si no se consideran las esquinas redondeadas.

```ts
function isPointInRoundedRectangle(
    x: number,
    y: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    r: number,
) {
    // Determine if a point is inside the corners of a rectangle.
    function isInsideCorner(
        x: number,
        y: number,
        cornerX: number,
        cornerY: number,
        r: number,
    ) {
        const distance = Math.sqrt(
            Math.pow(x - cornerX, 2) + Math.pow(y - cornerY, 2),
        );
        return distance <= r;
    }

    // Determine if a point is inside a rounded rectangle
    if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
        // Points inside the rectangle
        if (
            isInsideCorner(x, y, x1 + r, y1 + r, r) || // top-left
            isInsideCorner(x, y, x2 - r, y1 + r, r) || // top-right
            isInsideCorner(x, y, x2 - r, y2 - r, r) || // bottom-right
            isInsideCorner(x, y, x1 + r, y2 - r, r) // bottom-left
        ) {
            return true; // Points inside the corner
        }
        return !(
            x <= x1 + r ||
            x >= x2 - r || // The point is on the non-circular boundary of the rectangle
            y <= y1 + r ||
            y >= y2 - r
        );
    }
    return false; // Points outside the rectangle
}
```

## Lectura adicional {#extended-reading}

-   [Distancia a una elipse]
-   [Distancia de un punto a una elipse, un elipsoide o un hiperelipsoide]
-   [Sombras rápidas de rectángulos redondeados]
-   [Rectángulos redondeados desenfocados]
-   [En busca desesperada de los squircles]

[Lección 2]: /es/guide/lesson-002
[Funciones de distancia 2D]: https://iquilezles.org/articles/distfunctions2d/
[Distancia a una elipse]: https://iquilezles.org/articles/ellipsedist/
[SDF de elipsoide]: https://iquilezles.org/articles/ellipsoids/
[El SDF de una caja]: https://www.youtube.com/watch?v=62-pRVZuS5c&t=18s&ab_channel=InigoQuilez
[Redondear esquinas en los SDF]: https://www.youtube.com/watch?v=s5NGeUV2EyU&t=110s
[Aprovechar Rust y la GPU para renderizar interfaces de usuario a 120 FPS]: https://zed.dev/blog/videogame
[Rectángulos redondeados desenfocados]: https://raphlinus.github.io/graphics/2020/04/21/blurred-rounded-rects.html
[Efecto de desenfoque de lente de formas con SDF y WebGL]: https://tympanus.net/codrops/2024/06/12/shape-lens-blur-effect-with-sdfs-and-webgl/
[Ecuación cuártica]: https://mathworld.wolfram.com/QuarticEquation.html
[Fórmula cúbica]: https://mathworld.wolfram.com/CubicFormula.html
[Polinomio mónico]: https://mathworld.wolfram.com/MonicPolynomial.html
[Cúbica resolvente]: https://mathworld.wolfram.com/ResolventCubic.html
[Método de Newton]: https://en.wikipedia.org/wiki/Newton%27s_method
[Distancia de un punto a una elipse, un elipsoide o un hiperelipsoide]: https://www.geometrictools.com/Documentation/DistancePointEllipseEllipsoid.pdf
[Rendimiento de los bucles en un shader]: https://computergraphics.stackexchange.com/questions/2153/loop-performance-in-a-shader
[SVG \<rect\>]: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/rect
[Ajustar el radio de esquina y el suavizado]: https://help.figma.com/hc/en-us/articles/360050986854-Adjust-corner-radius-and-smoothing
[Sombras rápidas de rectángulos redondeados]: https://madebyevan.com/shaders/fast-rounded-rectangle-shadows/
[DropShadowFilter]: https://pixijs.io/filters/docs/DropShadowFilter.html
[Función de error]: https://en.wikipedia.org/wiki/Error_function
[Método geométrico]: /es/guide/lesson-006#geometric-method
[Abramowitz y Stegun. Manual de funciones matemáticas.]: https://personal.math.ubc.ca/~cbm/aands/page_299.htm
[box-shadow]: https://developer.mozilla.org/en-US/docs/Web/CSS/box-shadow
[Zed Blade WGSL]: https://github.com/zed-industries/zed/blob/main/crates/gpui/src/platform/blade/shaders.wgsl
[blade]: https://github.com/kvark/blade
[Drop-shadow: el filtro CSS infravalorado]: https://css-irl.info/drop-shadow-the-underrated-css-filter/
[tailwindcss - sombra exterior]: https://tailwindcss.com/docs/drop-shadow
[Sombra exterior de un rectángulo redondeado]: https://www.shadertoy.com/view/NtVSW1
[Sombra interior de un rectángulo redondeado]: https://www.shadertoy.com/view/mssGzn
[En busca desesperada de los squircles]: https://www.figma.com/blog/desperately-seeking-squircles/
