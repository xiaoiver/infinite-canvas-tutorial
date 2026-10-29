---
title: Compatibilidad de importación y extrusión SVG
outline: deep
---

# Compatibilidad de importación y extrusión SVG

Vuelve a la [demostración de la lección 39](/es/guide/lesson-039#icon-to-3d) para probarlo en el editor.

## Compatibilidad SVG

El conversor acepta contornos cerrados con un único relleno sólido. Un trazo SVG sólido sobre `<path>`, `<line>`, `<polyline>`, `<polygon>`, `<rect>`, `<circle>` o `<ellipse>` se expande en un Path cerrado y editable.

Por eso se pueden extruir las líneas y los trazados abiertos que solo tienen trazo. Cuando una forma tiene relleno y trazo a la vez, el trazo se convierte en un Path aparte por encima de la fuente rellena.

Ambos conservan la transformación del grupo SVG y se pueden exportar a GLB. Se conservan los extremos redondos y cuadrados, y las uniones redondas, en bisel y en inglete.

Se ignora el marcador de posición `stroke="none"` de SVG. El conversor conserva `fill-rule`, incluidos los huecos `evenodd`, y hereda la pintura y la anchura de trazo de los grupos SVG.

Los rectángulos rellenos sencillos siguen siendo nodos Rect editables. Los rectángulos redondeados, las elipses y las polilíneas cerradas se convierten en Path editables.

Las declaraciones `style` en línea de relleno, trazo, opacidad, regla de relleno y geometría del trazo tienen prioridad sobre los atributos de presentación. `fill="currentColor"` y `stroke="currentColor"` se resuelven contra el `color` más cercano de la forma, del grupo, de la instancia `<use>` o de la raíz SVG.

Si no hay color, el valor predeterminado es el negro. Un trazo aportado mediante `style` también se puede expandir.

Las hojas de estilo CSS externas no se analizan. Para la extrusión, los rectángulos redondeados conservan los valores SVG independientes de `rx` y `ry` como arcos de esquina elípticos.

Un radio ausente toma el valor del otro, y cada radio se limita a la mitad de su dimensión correspondiente. El importador ordinario de Rect 2D sigue almacenando un único radio de esquina.

Los patrones de guion SVG de longitud positiva que se pueden resolver, incluidos los patrones de longitud impar y `stroke-dashoffset`, se expanden en contornos sólidos editables separados. Un guion de longitud cero con extremo redondo crea un punto extruido.

Un `non-scaling-stroke` conserva su anchura indicada a través de las transformaciones de grupo SVG y del escalado de `viewBox`: el importador proyecta primero la línea central y después la expande en un contorno 3D editable. Esta anchura se hornea en el momento de la importación, así que el zoom posterior del editor escala la malla 3D con normalidad.

## Patrones y degradados

Los trazos que no escalan bajo trazados de recorte o viewports recortados, los huecos de longitud cero, los guiones de longitud cero con otros extremos, los degradados, los servidores de pintura y las formas SVG no admitidas permanecen en 2D. Los rellenos `<pattern>` autocontenidos, con teselas de píxeles enteros y `patternUnits="userSpaceOnUse"`, se importan como rellenos 2D que se repiten.

La tesela puede contener formas SVG básicas. La tesela admite `<use>` local, herencia, degradados lineales o radiales e imágenes PNG, JPEG, WebP o AVIF incrustadas.

Se admiten orígenes numéricos `x` / `y`; las referencias e imágenes externas y las referencias circulares no se admiten. Las funciones `patternTransform` admitidas (`matrix`, `translate`, `scale`, `rotate` y `skew`) siguen siendo editables en el relleno importado.

A medida que el lienzo hace zoom, las teselas del patrón SVG se vuelven a dibujar desde su fuente vectorial. El espaciado de las teselas permanece fijo en coordenadas del lienzo, con el tamaño de ráster limitado al límite de la textura.

Los rellenos `<radialGradient>` circulares sobre rectángulos también se conservan en 2D cuando usan `userSpaceOnUse`, un centro y un radio numéricos explícitos y un punto focal centrado. Otros degradados radiales autocontenidos sobre rectángulos, círculos, elipses, trazados y polígonos, incluidos los degradados elípticos, los puntos focales desplazados y las transformaciones de degradado, usan un relleno de imagen SVG rasterizado.

La forma sigue siendo editable, pero sus paradas de degradado se hornean en esa imagen y no son controles de pintura editables por separado. Los rellenos de imagen SVG se vuelven a dibujar desde la fuente vectorial a medida que haces zoom, hasta el límite de tamaño de la textura, para que sus bordes se mantengan más nítidos con más aumento.

Si un trazo no puede generar una malla cerrada válida, se conserva su nodo 2D original. Los contornos de trazo expandidos conservan seis decimales mientras se normalizan sus coordenadas, para que los detalles muy finos no se colapsen antes de la comprobación final de la malla.

## Referencias y viewports

Las referencias locales `<use href="#id">` y las heredadas `xlink:href` a formas o grupos admitidos crean instancias independientes, incluidas las referencias hacia delante y las repetidas. Los desplazamientos en píxeles de la instancia, la transformación y el relleno heredado se aplican antes de la extrusión.

Cada instancia recibe su propio identificador editable. Las referencias circulares y las no resueltas se omiten.

`<use>` también puede referirse a un `<symbol>` con `viewBox` cuando la instancia o el símbolo aportan `width` y `height` en píxeles positivos. Las dimensiones de la instancia tienen prioridad sobre las del símbolo.

El `preserveAspectRatio` del símbolo admite alineaciones `meet`, `none` y el recorte `slice` de los contornos extruidos. Si faltan las dimensiones efectivas o no son válidas, se omite esa instancia de símbolo.

Las referencias externas todavía no se importan. Los elementos `<svg>` anidados con dimensiones explícitas en píxeles positivos y un `viewBox` también crean grupos de viewport editables.

Su `x`/`y`, su transformación y su `preserveAspectRatio` afectan a los hijos extruidos. Un `<use>` local puede referirse a uno de estos elementos SVG y sobrescribir las dimensiones de su viewport de forma independiente.

Los viewports SVG anidados recortan de forma predeterminada los contornos de extrusión generados, también con `slice`. Pon `overflow="visible"` para conservar la geometría que sobresale.

Las formas contenidas por completo conservan su relación de grupo, así que mover el grupo del viewport también mueve sus mallas 3D. Las formas que cruzan un borde se convierten en Path recortados.

## Recorte y visibilidad

`clip-path="url(#id)"` local y el `clip-path` de CSS en línea ahora también recortan los contornos 3D elegibles. Un `<clipPath>` puede contener Path, polígonos, polilíneas, rectángulos, círculos, elipses, grupos anidados y referencias `<use>` locales a esas formas.

Sus formas forman una unión. `clip-rule="evenodd"` puede recortar huecos.

Los recortes de los grupos y de las instancias `<use>` repetidas siguen sus transformaciones, y varios recortes de ancestros se intersecan entre sí y con los viewports SVG. `clipPathUnits="objectBoundingBox"` usa los límites de una sola forma o de las formas hijas admitidas de un grupo, incluidas sus transformaciones.

Un contorno recortado se convierte en un Path editable. Un contorno que queda por completo dentro de su recorte conserva su nodo original y su relación de grupo.

Las definiciones de recorte no resueltas o no admitidas permanecen en 2D. Las máscaras, los filtros, el texto dentro de trazados de recorte y las referencias de recorte externas no se convierten a 3D.

Los elementos con `display="none"` o con `visibility="hidden"` heredado no producen mallas 3D. Un descendiente puede poner de forma explícita `visibility="visible"`.

Pasa la raíz `<svg>` para aplicar un `width`/`height` en píxeles explícito y un `viewBox`, incluido `preserveAspectRatio`. Las extrusiones rellenas también conservan las transformaciones SVG `skewX`, `skewY` y las `matrix(...)` sesgadas de los grupos anidados.

Estos contornos se convierten en Path editables con segmentos de línea muestreados cuando la transformación combinada contiene sesgado. El escalado sencillo de viewBox mantiene editables los rectángulos y los Path curvos en su forma original.

Los SVG sin dimensiones explícitas de viewport en píxeles conservan las coordenadas de su viewBox. Las formas 2D no admitidas siguen usando el importador SVG ordinario, que no conserva el sesgado de la fuente.

Con `preserveAspectRatio="slice"`, los contornos de extrusión rellenos se recortan al viewport, incluidos los huecos y las formas divididas en islas separadas. Las formas que quedan por completo dentro del viewport conservan su forma de Rect o de Path curvo. Las formas 2D no admitidas siguen al importador ordinario y esta función auxiliar no las recorta.

## Ejemplos y rendimiento

Elige **Muestra de uso repetido** en la demostración de la lección 39 para inspeccionar dos instancias de la misma definición con rellenos distintos, junto a un rectángulo ordinario. Elige **Muestra de viewport de symbol** para comparar dos instancias de viewport de un mismo símbolo con hueco.

La primera usa las dimensiones del símbolo. La segunda fija las suyas.

Elige **Muestra de viewport SVG anidado** para comparar un viewport SVG en línea y una segunda instancia referenciada con `<use>`. Sus contornos extruidos se recortan a cada viewport.

Elige **Muestra de estilo de pintura + currentColor** para comparar colores heredados y específicos de la instancia, una anulación de relleno en línea y un trazo con estilo. Elige **Muestra de extremos y uniones de trazo** para comparar extremos redondos y cuadrados, una forma rellena con un contorno 3D aparte, un trazo que no escala bajo una transformación de grupo, un trazo discontinuo extruido y puntos redondos.

Elige **Muestra de clip paths y uso repetido** para inspeccionar dos instancias recortadas de forma independiente, con huecos, y una forma recortada por una unión de límites de objeto. Elige **Muestra de límites de grupo y clip con use** para inspeccionar un recorte por límites de objeto sobre un grupo transformado cuyas dos ventanas reutilizan una definición local.

Las comprobaciones previas del SVG verifican si cada contorno puede formar una malla. La geometría de CPU resultante se guarda en una caché reciente de como máximo 256 mallas y 8 MiB de arrays de geometría, para poder reutilizarla cuando la actualización asíncrona del lienzo crea los compañeros 3D.

Las entradas más antiguas se desalojan. La geometría de GPU tiene su propia caché por lienzo.

Ejecuta `pnpm bench:svg-import:browser` para inspeccionar los tiempos de importación y de edición del [SVG Tiger de Ghostscript](/Ghostscript_Tiger.svg) del repositorio y de otras ilustraciones representativas. También puedes descargar ese SVG y usar **Subir SVG** en la demostración de la lección 39 para inspeccionar las capas editables y comparar distintos niveles de zoom.

Cuando las capas SVG importadas se solapan, sus caras frontales extruidas conservan el orden de pintura del SVG, incluidas las capas dentro de grupos anidados. Las capas posteriores siguen siendo visibles por encima de las anteriores en la vista 3D vinculada.

La exportación GLB enumera los nodos de extrusión en el mismo orden de recorrido de delante hacia atrás, que nuestro importador glTF conserva. Para extrusiones opacas y planas en un mismo plano, la exportación también separa en profundidad las capas que se solapan, como máximo un 5 % de la extrusión más delgada.

Esto da a los visores glTF valores distintos en el búfer de profundidad, sin mover las formas editables del lienzo. Cada pila que no se interseca se trata por su cuenta, así que una malla 3D lejana no desactiva el espaciado.

Una pila cuyos límites proyectados se solapan con una extrusión inclinada o transparente, con otra elevación o con una malla 3D independiente conserva las transformaciones de autor. Los modelos extremadamente grandes o lejanos todavía pueden perder las diferencias de profundidad pequeñas por la precisión del búfer de profundidad del visor.
