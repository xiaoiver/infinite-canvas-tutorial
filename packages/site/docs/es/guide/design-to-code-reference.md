---
title: Detalles de exportación de diseño a código
outline: deep
---

# Detalles de exportación de diseño a código

Vuelve a la [lección 38](/es/guide/lesson-038#design-to-code) para ver la API y los ejemplos.

## Correspondencia de conceptos {#concept-mapping}

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

## Componentes y reglas de exportación

Con `componentStructure: 'preserve'` (el valor predeterminado, y el argumento de venta de Pencil), cada raíz `reusable` se convierte en un componente y cada `ref` se convierte en una instancia. Los atributos que se pueden sobrescribir (`content`, `fills`, tipografía, incluidos `fontVariant` y `fontKerning`, decoración del texto, `opacity`, `visibility`, `cornerRadius`, `width`/`height` explícitos, `minWidth`/`maxWidth`/`minHeight`/`maxHeight`, `padding`, `margin`, huecos de flex, `flexDirection`, `alignItems`, `justifyContent`, `flexWrap`, `alignSelf`, `flexGrow`, `flexShrink`, `flexBasis`, `strokeWidth`, `strokes` y los campos de sombra paralela) que aparecen entre las instancias se elevan a props, con el valor de la plantilla como predeterminado.

Los valores numéricos de `lineHeight` son alturas en píxeles en `.ic`, así que la salida de React añade `px` en lugar de tratarlos como multiplicadores sin unidad. Un `fontKerning` booleano se convierte en el CSS `normal` o `none`.

Los arrays de espaciado se convierten en cadenas abreviadas de CSS, los campos de decoración del texto se combinan en una sola prop y los campos de sombra se combinan en una sola prop `boxShadow`. Una decoración con grosor cero se renderiza como `none`, igual que en el lienzo:

### Texto

Las exportaciones de texto usan una altura de línea sin unidad de `1.2` cuando no hay un `lineHeight` explícito, para que el espaciado flex del navegador se mantenga cerca de las métricas de texto del lienzo. Un `lineHeight` numérico explícito se sigue exportando en píxeles.

Los saltos de línea explícitos se conservan con `white-space: pre`. Cuando `wordWrap` está activado con un `wordWrapWidth` positivo, la salida usa `pre-wrap`, `overflow-wrap: anywhere` y esa anchura como máximo.

Un `maxLines` positivo añade un line clamp de CSS para `ellipsis` (el valor predeterminado) o un límite de altura de línea recortado para `clip`. Editar la anchura de ajuste de un texto reutilizable que ya se ajusta se convierte en una prop del componente.

Activar o desactivar el ajuste, o cambiar sus ajustes de truncado, expande la instancia para que el layout exportado siga la edición. El lienzo, por ahora, no aplica su ajuste `whiteSpace` al medir el texto.

Las cadenas marcadoras personalizadas de `textOverflow` no tienen equivalente en el CSS estándar.

### Imágenes y rellenos

En una imagen reutilizable, cambiar solo la URL de la imagen vincula la anulación `fills` de la instancia a la prop `<img src>` del componente. Cambiar el tipo de relleno, el ajuste, la posición o la opacidad del relleno expande la instancia, para que el elemento y los estilos generados reflejen la edición.

Una imagen hoja combina la opacidad de su único relleno con la opacidad del nodo en `<img>`. Un único relleno de imagen sobre una elipse se exporta como un `<img>` redondeado.

Los rectángulos y las elipses con relleno de imagen que tienen hijos usan un envoltorio posicionado y colocan un `<img>` decorativo detrás de esos hijos. El envoltorio lleva la opacidad del nodo, y `<img>` lleva la opacidad del relleno, el ajuste y la posición.

Un rectángulo con un único relleno de degradado CSS activado, lineal, radial o cónico, exporta ese degradado como `background-image`. Editar solo su valor de degradado en una instancia se convierte en una prop del componente.

Los rectángulos y las elipses con varios rellenos sólidos, de degradado admitido, de imagen o de patrón exportan fondos apilados en el orden de pintura. Un único patrón también se exporta como fondo CSS.

La sintaxis `conic-gradient(circle at …)` del lienzo se convierte al CSS `conic-gradient(at …)`. Las capas de imagen admiten `fill`, `contain`, `cover`, `none`, `scale-down` y la posición, y mantienen el contenido hijo por encima de la pintura.

Los patrones conservan su tamaño natural de tesela y su ajuste de repetición. Para las pinturas que necesitan opacidad independiente, `scale-down` de imagen o una transformación de patrón 2D admitida, el generador emite capas decorativas recortadas detrás de los hijos.

Los modos de mezcla de capa que CSS admite siguen siendo locales a la pila de rellenos. Las transformaciones de patrón admiten `matrix`, `translate`, `scale`, `rotate`, `skewX` y `skewY` en rectángulos y elipses con dimensiones explícitas.

El lienzo también decodifica imágenes de patrón basadas en URL y aplica estas transformaciones. Editar una pila o un patrón en una instancia reutilizable la expande.

Otros formatos de degradado, la sintaxis de transformación de patrón no admitida y los modos de mezcla sin equivalente en CSS, como `linearBurn` y `linearDodge`, todavía necesitan un tratamiento aparte.

Un único relleno sólido con opacidad menor que 1 se exporta mediante el CSS `color-mix`, y conserva el alfa del relleno sin atenuar los elementos hijos. La opacidad del nodo sigue siendo un `opacity` de CSS aparte. Editar un relleno translúcido en una instancia reutilizable expande esa instancia, para que la pintura generada conserve su opacidad.

### Transformaciones y layout

La rotación del nodo (almacenada en radianes) y `scaleX` / `scaleY` se exportan como una transformación CSS `rotate(...) scale(...)` con origen `0 0`, igual que el orden de transformación local del lienzo. Editar la transformación de una instancia expande esa instancia, para que la geometría cambiada entre en la exportación.

Los rectángulos y las elipses con `clipMode: clip` ahora recortan a sus hijos en el HTML y el React generados. Los rectángulos redondeados conservan su radio de esquina, y las elipses usan `border-radius: 50%`. Cambiar el modo de recorte de una instancia reutilizable expande esa instancia, para que se conserve su estado de recorte. Las máscaras `erase` y `soft` no tienen un equivalente directo de desbordamiento en CSS y no se exportan como recorte.

En un contenedor que no es flex, los hijos usan su `x` / `y` local del lienzo como posiciones CSS `left` / `top`. Los hijos flex permanecen en el flujo flex normal.

Yoga fija de forma predeterminada su `flexShrink` en `0`, así que la exportación pone `flex-shrink: 0` salvo que el nodo indique otro valor. Una instancia de componente conservada dentro de un contenedor que no es flex recibe un envoltorio posicionado.

Mover un hijo dentro de una instancia expande esa instancia para retener la edición. Cuando varios nodos de nivel superior tienen todos tamaños explícitos, la exportación también añade un marco relativo y conserva su espaciado, incluidos los límites rotados y volteados.

Las raíces sin tamaños medibles conservan el flujo normal del documento.

La `visibility` a nivel de nodo se convierte en la `visibility` de CSS, así que los nodos ocultos conservan su espacio de layout. El estado predeterminado `inherited` usa la herencia de CSS. Cambiar la visibilidad de una instancia reutilizable se convierte en una prop del componente, incluidas las ediciones de los descendientes.

### Formas vectoriales

Los trazados con datos `d` válidos se exportan como SVG en línea, en lugar de un marcador de posición rectangular. Cuando un Path tiene hijos, su SVG se sitúa detrás de ellos en un envoltorio posicionado, y conserva el contorno vectorial y las coordenadas locales de cada hijo.

Las capas de relleno hechas de colores sólidos, degradados lineales o radiales e imágenes se exportan como trazados SVG separados en el orden del lienzo, y conservan la opacidad de cada capa. Los modos de mezcla que CSS admite se aplican dentro de un grupo SVG aislado, así que solo se mezclan con las capas de relleno inferiores.

Los trazos activos de esos tipos de pintura conservan su pintura, su opacidad, los marcadores de extremo de línea, triángulo o diamante, la regla de relleno, la anchura, el extremo, la unión, el límite de inglete y los ajustes de guion. Los trazados, las líneas y las polilíneas con varios trazos exportan cada trazo en el orden del lienzo, con geometría compartida y mezcla de capas admitida por CSS.

Los trazados cerrados también conservan la alineación interior o exterior del trazo recortando o enmascarando cada capa. Los trazados abiertos siguen alineados al centro.

Los degradados y las pinturas de imagen siguen el viewBox del trazado. Los rellenos de imagen de un Path admiten `fill`, `contain`, `cover`, `none` y `scale-down`, incluidas las posiciones porcentuales intermedias.

Las alineaciones habituales de `fill` / `contain` / `cover` usan patrones SVG. Otros ajustes y posiciones usan un `foreignObject` SVG recortado con `object-fit` / `object-position` de CSS.

Los trazos de imagen usan patrones SVG para `fill`, `contain` o `cover` en las posiciones 0 %, 50 % o 100 %. Un único trazo de imagen con otro ajuste o posición usa una imagen HTML posicionada y una máscara de geometría SVG, y conserva su extremo, su unión, sus marcadores de extremo y su alineación interior o exterior en Chromium y WebKit.

Los trazos de imagen en capas con estos ajustes o posiciones también conservan el orden de pintura del lienzo, los modos de mezcla CSS admitidos, la opacidad y los marcadores de extremo, junto a las capas de trazo SVG. Usa una URL de imagen duradera o una data URL en el código exportado.

Una sombra paralela sigue la ilustración SVG sin sombrear a los hijos de un Path. Las anulaciones de pintura, geometría, marcador, alineación del trazo o sombra de un Path en una instancia reutilizable expanden esa instancia, para que el SVG refleje la edición.

Los modos de mezcla sin equivalente en CSS, como `linearBurn` y `linearDodge`, los degradados cónicos y de malla, y otros filtros de trazado, necesitan un tratamiento SVG aparte.

Las líneas y polilíneas hoja usan la misma canalización SVG. Sus extremos locales o su lista de puntos se convierten en un trazado abierto sin relleno.

El viewBox del SVG sigue el origen local de la geometría y centra un eje de anchura cero o de altura cero, así que los trazados desplazados y los trazos finos horizontales o verticales siguen siendo visibles en el código generado. Su trazo puede usar una única pintura activa sólida, de degradado lineal, de degradado radial o de imagen.

Las puntas de flecha de línea, triángulo y diamante usan marcadores SVG locales con la pintura del trazo. Las ediciones de geometría, pintura o marcador de una instancia reutilizable de línea o polilínea también expanden esa instancia.

Otros efectos de línea todavía necesitan un tratamiento aparte.

El `blendMode` a nivel de nodo se convierte en `mix-blend-mode` de CSS, incluida una prop del componente cuando una instancia lo cambia. `light` se mapea al CSS `lighten`. Los modos sin equivalente en CSS siguen la exportación SVG y se renderizan como `normal`. El `blendMode` propio de una capa de relleno se mezcla con los otros rellenos de ese nodo y no se trata como `mix-blend-mode` a nivel de nodo.

## Ejemplos prácticos {#practical-interface-examples}

Los ejemplos siguientes cargan un panel de analítica, una página de precios de SaaS y una pantalla de pago en móvil en el **lienzo del editor IC**. Las tres escenas usan layouts flex anidados y variables de color semánticas.

El pago usa una mesa de trabajo estrecha de 390 × 844. Selecciona y edita nodos en el lienzo y después actualiza, copia o descarga el código generado a partir del documento actual del lienzo con `API.exportCode`.

Con HTML/CSS seleccionado, usa **Vista previa HTML** para ver la página generada al tamaño de su mesa de trabajo en un marco aislado. Cambia de diseño para cargar otra escena editable.

Los ejemplos pasan a `API.exportCode` un mapa `semanticElements` indexado por identificador de nodo. Convierte los rectángulos y el texto seleccionados del lienzo en puntos de referencia HTML, encabezados y controles `<button type="button">` en ambas exportaciones. El mapa pertenece a la configuración de exportación de esta demostración. Conecta las acciones de los botones y la navegación en tu aplicación.

La página de precios usa una plantilla `reusable` de tarjeta de plan y tres instancias `ref`. El editor expande las instancias para renderizarlas y editarlas.

Esta demostración reconcilia el texto, el color, la tipografía y la decoración del texto, la opacidad, el tamaño explícito y las restricciones de tamaño, el espaciado, la alineación flex y el tamaño de los ítems, el borde sólido y las ediciones de sombra paralela, y los devuelve a anulaciones de instancia para las descargas de React y de `.ic`. La tarjeta Growth muestra un borde de acento.

Los valores numéricos de `flexBasis` y de restricción de tamaño se convierten en valores en píxeles en los estilos HTML/CSS y React. Si cambia la estructura de una tarjeta o una propiedad no admitida, la exportación usa sus nodos expandidos, para que el resultado siga coincidiendo con el lienzo.

Las tres exportaciones de React también se renderizan en una prueba de navegador con React 19 y Tailwind CSS 4. La prueba comprueba las posiciones clave del texto frente a la vista previa HTML, para que estos ejemplos sigan siendo ejecutables a medida que cambia el generador.

Descarga el archivo `.ic` para seguir editando el diseño en la [aplicación en línea](https://app.infinitecanvas.cc/) mediante **Importar desde… > .ic**. Descarga el archivo HTML y ábrelo directamente en un navegador.

Para React, elige **Descargar proyecto React** para obtener, a partir del lienzo actual, un ZIP de inicio con Vite, React 19 y Tailwind CSS 4. Descomprímelo y después ejecuta `pnpm install` y `pnpm dev`.

El componente exportado está en `src/App.tsx`. La plantilla incluye la fuente Inter en local cuando el diseño la usa.

Las imágenes `blob:` temporales del lienzo actual se copian en `public/assets` y se referencian con rutas locales. Las data URL permanecen en línea y las URL remotas siguen siendo remotas.

Su `src/responsive.css` añade layouts de pantalla estrecha para estos tres ejemplos y conserva el componente del tamaño de la mesa de trabajo en `src/App.tsx`. También puedes descargar solo el archivo `.tsx` para un proyecto ya existente.

El generador, por ahora, emite marcado de presentación. Conecta la navegación, las acciones de pago, los pagos y los datos en vivo a la lógica de tu aplicación después de exportar.
