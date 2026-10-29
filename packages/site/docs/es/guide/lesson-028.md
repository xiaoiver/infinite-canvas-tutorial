---
outline: deep
description: 'Integración con la IA mediante diálogos de chat con modelos de generación de imágenes como GPT 4o y Nano banana. Usa SAM para segmentar la imagen en un WebWorker, usa LaMa para el inpainting y amplía la imagen con UpscalerJS.'
head:
    - [
          'meta',
          { property: 'og:title', content: 'Lección 28 - Integración con la IA' },
      ]
---

<script setup>
import WhenCanvasMeetsChat from '../../components/WhenCanvasMeetsChat.vue'
</script>

# Lección 28 - Integración con la IA {#lesson-28-integrating-with-ai}

Hoy, GPT 4o (gpt-image-1) y Nano banana (gemini-2.5-flash-image) han bajado de forma notable la barrera de la edición de imágenes. Desde el punto de vista de la interacción entre la persona y la computadora, la combinación de interfaces de chat y de lienzo es cada vez más popular. El historial de chat con los modelos refleja de forma natural el historial de modificación de las imágenes, mientras que un lienzo que se puede arrastrar con libertad hace naturales la selección de imágenes y el procesamiento en paralelo. Para más detalles, consulta [UI for AI].

La imagen de abajo muestra la interfaz del producto Lovart, que usa Konva.js, mencionado en nuestra [Lección 21 - Transformer], como tecnología subyacente. Aunque se centra sobre todo en la edición de imágenes, conserva funciones habituales de los editores gráficos, como la lista de capas oculta de forma predeterminada en la esquina inferior izquierda, y la barra de herramientas de la izquierda también puede insertar algunas formas básicas.

![Lovart](/lovart.png)

Recraft también está probando la funcionalidad de chat. Por lo que he observado, el lienzo y el chat se están convirtiendo en los dos puntos de entrada principales de este tipo de editor:

![Chat de Recraft](/recraft-chat.png)

En esta lección lo combinaremos con Nano banana para enriquecer nuestra funcionalidad de edición de imágenes.

<WhenCanvasMeetsChat />

## Integrar modelos {#client-sdk}

Para usar Nano banana elegí [fal.ai] en lugar de la [generative-ai] oficial de Google. El motivo es que una API unificada me facilita comparar los efectos de otros modelos de generación de imágenes, como [qwen-image-edit] o [FLUX.1 Kontext].

Hay muchos otros SDK agregados, como [OpenRouter]. Tomando como ejemplo la interfaz de generación de imágenes, solo hace falta pasar un prompt para recibir la URL de la imagen generada y la respuesta de texto original del modelo:

```ts
import { fal } from '@fal-ai/client';

const result = await fal.subscribe('fal-ai/gemini-25-flash-image', {
    input: {
        prompt: '',
    },
});
console.log(result.data); // { image: [{ url: 'https://...' }]; description: 'Sure, this is your image:' }
```

La API de edición de imágenes también acepta un conjunto de URL de imágenes como parámetros. Incluso al pasar DataURL codificadas, pueden seguir apareciendo avisos como «Unable to read image information». Por eso, [fal.ai] ofrece una interfaz de subida de archivos, que nos permite activar las subidas cuando se añaden imágenes locales al lienzo.

### Diseño de la API {#api-design}

Necesitamos una API encargada de generar y modificar imágenes. En ambos escenarios, los parámetros deben ser idénticos: un prompt y una lista de imágenes de referencia.

```ts
import { fal } from '@fal-ai/client';

api.createOrEditImage = async (
    isEdit: boolean,
    prompt: string,
    image_urls: string[],
): Promise<{ images: { url: string }[]; description: string }> => {
    const result = await fal.subscribe(
        isEdit
            ? 'fal-ai/gemini-25-flash-image/edit'
            : 'fal-ai/gemini-25-flash-image',
        {
            input: {
                prompt,
                image_urls,
            },
        },
    );
    return result.data;
};
```

### Cuadro de chat {#chatbox}

El cuadro de chat ofrece otro punto de partida además del lienzo.

### Quitar el fondo {#remove-background}

Haz doble clic en la imagen para entrar en el modo de edición:

```ts
private async removeBackground() {
    this.removingBackground = true;
    const { images } = await createOrEditImage(
        true,
        'Remove background from the image',
        [this.node.fill],
    );
    if (images.length > 0) {
        this.api.runAtNextTick(() => {
        this.api.updateNode(newImage, { fill: images[0].url });

        this.api.record();
        this.removingBackground = false;
        });
    }
}
```

## Relleno selectivo {#inpainting}

Sirve para borrar o modificar objetos existentes seleccionados en una imagen y, al mismo tiempo, dejar el resto sin cambios.

<https://www.recraft.ai/docs#inpaint-image>

> El inpainting sustituye o modifica partes concretas de una imagen. Usa una máscara para identificar las áreas que hay que rellenar: los píxeles blancos representan las regiones que se van a repintar y los píxeles negros indican las áreas que se mantienen intactas; es decir, los píxeles blancos se rellenan según lo indicado en el prompt.

Cuando alguien dibuja un área cerrada con un editor sencillo, hay que convertirla en un parámetro de máscara para pasarlo a la API. Esta máscara es, en esencia, una imagen en escala de grises:

![relleno selectivo en gpt-4o](/inpainting.webp)

Aquí se hace evidente la importancia de los editores. Incluso las funciones de edición sencillas tienen valor. Recraft menciona tres puntos: <https://www.recraft.ai/blog/inpainting-with-ai-how-to-edit-images-with-precision-using-recraft>

1. Facilidad para acercar y alejar el zoom. Al fin y al cabo es una operación de precisión, así que el zoom del lienzo es crucial.
2. Inpainting con IA mediante modelos de segmentación como SAM, de forma automática
3. Flexibilidad creativa

### Crear la máscara {#create-mask}

Ofrecemos varios métodos de interacción para que se generen máscaras:

1. [Lección 26 - Herramienta de selección]
2. [Lección 25 - Modo de dibujo y pincel]

### Usar SAM mediante WebGPU {#use-sam-via-webgpu}

Además de permitir definir el área de modificación con la mayor precisión posible, sería aún mejor si la selección del área pudiera hacerse con métodos más sencillos, como hacer clic para seleccionar.

![Selección inteligente en Midjourney](/midjourney-smart-select.jpeg)

En [Lección 1 - Capas de abstracción de hardware] presentamos las ventajas de WebGPU (Figma también actualizó hace poco su motor de renderizado). Más allá del renderizado, hace posible la GPGPU en el navegador gracias al soporte de Compute Shader. ONNX ofrece un runtime para la web, lo que permite la inferencia en tiempo real directamente en el navegador sin consumir tokens. Para más detalles, consulta: [Cómo añadir aprendizaje automático a tu aplicación web con ONNX Runtime].

Nos basamos en este artículo: [Segmentación de imágenes en el navegador con Segment Anything Model 2] e implementamos las optimizaciones siguientes:

-   Se utilizó el [formato de modelo ORT] para reducir el tamaño de los modelos descargados en tiempo de ejecución
-   Se empleó WebGPU para obtener velocidades de inferencia más altas. Para más detalles, consulta: [Usar el proveedor de ejecución WebGPU]
-   Se ejecutó dentro de WebWorkers para evitar bloquear el hilo principal

Los reunimos en el [complemento SAM]. Aquí está nuestro ejemplo: [Usar SAM en un WebWorker].

![SAM en un WebWorker](/sam.gif)

Para otras prácticas y materiales relacionados con SAM3, consulta:

-   [Segment Anything 2, en WebGPU]
-   [Solicitud de scripts oficiales de exportación a ONNX y de conversión a TensorRT para SAM3]

La máscara obtenida mediante SAM puede usarse como imagen de referencia para alimentar el modelo de imagen original.

### Usar LaMa {#use-lama}

[Inpainting de imágenes en el cliente con ONNX y Next.js] explica cómo usar el modelo [LaMa] en el cliente.

### Combinar varias imágenes {#combine-multiple-images}

Usar el lienzo nos permite obtener información posicional adicional sobre las imágenes, que a menudo es difícil de describir con el lenguaje. Por ejemplo, podemos arrastrar una taza de té a cualquier posición de un escritorio y componer una imagen.

## Expansión de la imagen {#outpainting}

Esta función todavía no tiene una implementación de API correspondiente de OpenAI. Veamos primero cómo lo hace Recraft. <https://www.recraft.ai/blog/ai-outpainting-how-to-expand-images>

> El outpainting permite ampliar una imagen más allá de su marco original. Es especialmente útil para completar imágenes recortadas o añadir más escenario de fondo.

Sirve para mantener sin cambios los objetos seleccionados de la imagen, por ejemplo al cambiar el fondo:

![Expansión en Recraft](/outpainting-fixed.webp)

O para expandir hacia fuera:

![Expansión en Recraft](/outpainting.webp)

Ahora mismo, GPT 4o solo admite tres tamaños fijos, mientras que Nano banana necesita algunos trucos para lograr una salida de imagen de tamaño arbitrario, como pasar una imagen en blanco de un tamaño indicado como referencia e insistir en ello en el prompt. Podemos hacer esto muy natural mediante operaciones en el lienzo: basta con arrastrar hasta el tamaño adecuado, y la aplicación genera de forma automática esta imagen de referencia en blanco a través de la Canvas API.

## Separación de capas {#layer-separation}

-   [Editar texto en imágenes con IA]
-   [Mover cualquier cosa con difusión de escenas por capas]

### De ráster a vector {#raster-to-vector}

Muchas herramientas en línea y de código abierto ofrecen soluciones basadas en el procesamiento de imágenes tradicional:

-   Recraft [vectorizador de imágenes con IA]
-   Lottiefiles [conversor de ráster a vector]
-   [vtracer]

Sin embargo, este enfoque no da resultados satisfactorios en el procesamiento de texto:

![De ráster a vector en lottiefiles. fuente: https://lottiefiles.com/tools/raster-to-vector](/lottiefiles-raster-vector.png)

El motivo es que este algoritmo suele dividirse en las etapas siguientes, y la primera no distingue entre el texto y los gráficos aptos para vectorizar:

1. El «recorrido de trazados» convierte los píxeles en trazados
2. Los trazados se simplifican en polígonos
3. Se intenta suavizar los polígonos

![fuente: https://www.visioncortex.org/vtracer-docs#path-walking](https://www.visioncortex.org/public/vtracer/WalkerOptim.svg)

### Separar el fondo y el texto {#split-background-text}

Primero se usa una herramienta parecida al OCR para identificar las regiones de texto y generar una máscara. Después se quita la máscara y el modelo regenera la imagen mediante un proceso de inpainting estándar, para obtener una imagen de fondo sin texto.

[FLUX-Text: una base sencilla y avanzada de transformador de difusión para la edición de texto en escenas]

![edición de texto con flux-text](/flux-text.png)

Con el [Qwen-Image-Layered] de código abierto se puede descomponer en capas. En el [complemento de fal.ai] logramos el efecto siguiente:

![Qwen-Image-Layered](/decompose-layers.gif)

### Reconocimiento de fuentes {#font-recognition}

A continuación hay que identificar los atributos de estilo, como la fuente y el tamaño de fuente, dentro del área de texto.

[TextStyleBrush: transferencia de la estética del texto a partir de un solo ejemplo]

Adobe Photoshop ofrece [Coincidir fuentes]:

![Selecciona una fuente de la lista de fuentes similares en el cuadro de diálogo Coincidir fuentes](https://helpx-prod.scene7.com/is/image/HelpxProd/A-sample-document-showing-an-image-with-the-text-s?$pjpeg$&jpegSize=300&wid=1600)

[whatfontis] ofrece una API pública que hace coincidir la fuente más cercana de su biblioteca de fuentes con un área indicada dentro de una imagen.

```json
[
    {
        "title": "Abril Fatface",
        "url": "https://www.whatfontis.com/FF_Abril-Fatface.font",
        "image": "https://www.whatfontis.com/img16/A/B/FF_Abril-FatfaceA.png"
    }
]
```

Por último, superpón todas las capas.

## Ampliar la imagen {#upscale-image}

Podemos ampliar la imagen con un modelo; la imagen de comparación siguiente procede de [Topaz Gigapixel]:

![fuente: https://www.adobe.com/products/photoshop/image-upscaler.html](https://www.adobe.com/products/photoshop/media_1bef0720b9cf0858149ccc837fa56e1ed726defe6.jpg?width=2000&format=webply&optimize=medium)

Podemos usar [fal-ai/topaz/upscale/image] o [SeedVR2] en fal.ai. En el navegador podemos usar [UpscalerJS] en un webworker; consulta nuestro [complemento de ampliación], que usa de forma predeterminada el modelo `@upscalerjs/esrgan-medium 4x`.

![@upscalerjs/esrgan-medium 4x](/upscaler.png)

### Otro runtime del navegador {#other-browser-runtime}

[UpscalerJS] usa tensorflow.js; puedes elegir [super-resolution-js] con el runtime de ONNX, o un runtime nuevo llamado LiteRT:

![Ampliador de imágenes con LiteRT.js](/image-upscaler.jpg)

## WebMCP para el lienzo del proyecto {#webmcp}

El editor del proyecto con la sesión iniciada registra seis [herramientas imperativas de WebMCP] cuando `document.modelContext` está disponible: `get_canvas_summary`, `get_selection`, `get_nodes`, `export_canvas_code`, `create_shape` y `update_node`. Por ejemplo, un agente puede leer la selección actual, crear un rectángulo y después cambiar su ancho. Las dos herramientas de escritura usan la misma ruta `api.edit()` que el editor, así que las ediciones entran en el historial de deshacer y en la colaboración del lienzo.

WebMCP exige ahora mismo un navegador compatible (prueba de origen de Chrome 149, o la marca de desarrollo `chrome://flags/#enable-webmcp-testing`). Abre un proyecto que te pertenezca e inicia sesión antes de probar las herramientas. Los demás navegadores siguen funcionando como editores normales. Las herramientas se retiran cuando se cierra el lienzo o cambia el proyecto. La primera versión puede crear y editar rectángulos y elipses; las lecturas de nodos devuelven un conjunto limitado de propiedades y la exportación de código tiene un límite de 32 000 caracteres.

En la página del proyecto puedes inspeccionar las herramientas desde DevTools y probar una edición completa:

```js
const tools = await document.modelContext.getTools();
const findTool = (name) => tools.find((tool) => tool.name === name);
const summary = await document.modelContext.executeTool(
    findTool('get_canvas_summary'),
    {},
);
console.log(JSON.parse(summary));

const created = JSON.parse(
    await document.modelContext.executeTool(findTool('create_shape'), {
        type: 'rect',
        x: 100,
        y: 100,
        width: 200,
        height: 100,
        fill: '#3b82f6',
    }),
);
await document.modelContext.executeTool(findTool('update_node'), {
    id: created.id,
    width: 240,
});
```

Deshacer en el editor restaura el ancho anterior del rectángulo. Las herramientas se circunscriben al proyecto actual y no exponen datos del lienzo de otros proyectos.

WebMCP opera dentro de una pestaña abierta del navegador. Un servidor MCP independiente para agentes de escritorio es una integración aparte y futura.

### Otras integraciones de MCP {#other-mcp-integrations}

[MCP: qué es y por qué importa]:

> En lugar de tener solo una GUI o una API que usan las personas, obtienes una interfaz de IA «gratis». Esta idea ha llevado al concepto de «desarrollo MCP-first», en el que construyes el servidor MCP de tu aplicación antes que la GUI, o en paralelo con ella.

### pencil.dev {#pencil-dev}

El lienzo vectorial MCP bidireccional con el que soñabas. Consulta [pencil.dev]

> Pencil no ofrece solo herramientas de lectura de MCP, sino también acceso de escritura completo y muchas otras herramientas prácticas para operar el lienzo por completo. Esta es la verdadera magia. Puedes conectar todo el mundo de los MCP, traer datos de otras fuentes como bases de datos, API, datos de gráficos, Playwright/Puppeteer, o conectar otros agentes con facilidad. Tú tienes el control.

[Figma MCP Server] puede manipular la [Figma API].

[Lección 21 - Transformer]: /es/guide/lesson-021
[UI for AI]: https://medium.com/ui-for-ai
[Lección 1 - Capas de abstracción de hardware]: /es/guide/lesson-001#hardware-abstraction-layers
[Segmentación de imágenes en el navegador con Segment Anything Model 2]: https://medium.com/@geronimo7/in-browser-image-segmentation-with-segment-anything-model-2-c72680170d92
[fal.ai]: https://fal.ai/
[OpenRouter]: https://openrouter.ai/
[qwen-image-edit]: https://fal.ai/models/fal-ai/qwen-image-edit
[FLUX.1 Kontext]: https://fal.ai/models/fal-ai/flux-pro/kontext
[generative-ai]: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions
[Lección 26 - Herramienta de selección]: /es/guide/lesson-026#marquee-selection
[Lección 25 - Modo de dibujo y pincel]: /es/guide/lesson-025#brush-mode
[MCP: qué es y por qué importa]: https://addyo.substack.com/p/mcp-what-it-is-and-why-it-matters
[Figma MCP Server]: https://github.com/GLips/Figma-Context-MCP
[Figma API]: https://www.figma.com/developers/api
[herramientas imperativas de WebMCP]: https://developer.chrome.com/docs/ai/webmcp/imperative-api
[Editar texto en imágenes con IA]: https://medium.com/data-science/editing-text-in-images-with-ai-03dee75d8b9c
[whatfontis]: https://www.whatfontis.com/API-identify-fonts-from-image.html#font_Examples_good
[Coincidir fuentes]: https://helpx.adobe.com/photoshop/desktop/text-typography/select-manage-fonts/match-fonts.html
[FLUX-Text: una base sencilla y avanzada de transformador de difusión para la edición de texto en escenas]: https://arxiv.org/pdf/2505.03329
[TextStyleBrush: transferencia de la estética del texto a partir de un solo ejemplo]: https://arxiv.org/pdf/2106.08385
[Mover cualquier cosa con difusión de escenas por capas]: https://openaccess.thecvf.com/content/CVPR2024/papers/Ren_Move_Anything_with_Layered_Scene_Diffusion_CVPR_2024_paper.pdf
[conversor de ráster a vector]: https://lottiefiles.com/tools/raster-to-vector
[vectorizador de imágenes con IA]: https://www.recraft.ai/ai-image-vectorizer
[vtracer]: https://github.com/visioncortex/vtracer
[Segment Anything 2, en WebGPU]: https://lucasgelfond.online/software/webgpu-sam2/
[LaMa]: https://github.com/advimman/lama
[Inpainting de imágenes en el cliente con ONNX y Next.js]: https://medium.com/@geronimo7/client-side-image-inpainting-with-onnx-and-next-js-3d9508dfd059
[Solicitud de scripts oficiales de exportación a ONNX y de conversión a TensorRT para SAM3]: https://github.com/facebookresearch/sam3/issues/224
[Usar SAM en un WebWorker]: /experiment/sam-in-worker
[complemento SAM]: /reference/sam
[complemento de fal.ai]: /reference/fal
[complemento de ampliación]: /reference/upscaler
[Cómo añadir aprendizaje automático a tu aplicación web con ONNX Runtime]: https://onnxruntime.ai/docs/tutorials/web/
[formato de modelo ORT]: https://onnxruntime.ai/docs/performance/model-optimizations/ort-format-models.html
[Usar el proveedor de ejecución WebGPU]: https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html
[Qwen-Image-Layered]: https://arxiv.org/pdf/2512.15603
[SeedVR2]: https://huggingface.co/ByteDance-Seed/SeedVR2-7B
[UpscalerJS]: https://upscalerjs.com/documentation/guides/browser/performance/webworker
[super-resolution-js]: https://github.com/josephrocca/super-resolution-js
[Topaz Gigapixel]: https://www.topazlabs.com/topaz-gigapixel
[fal-ai/topaz/upscale/image]: https://fal.ai/models/fal-ai/topaz/upscale/image/api
[pencil.dev]: https://www.pencil.dev/
