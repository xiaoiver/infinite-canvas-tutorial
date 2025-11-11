---
outline: deep
description: ''
head:
    - [
          'meta',
          {
              property: 'og:title',
              content: 'Lesson 29 - Embedding HTML content',
          },
      ]
---

<script setup>
import HTML from '../components/HTML.vue'
</script>

# Lesson 29 - Embedding HTML content

Sometimes we want to embed HTML content on the canvas, such as a YouTube player, a CodeSandbox component, ShaderToy, and so on.

## Create an HTML Container {#create-html-container}

Excalidraw does not support embedding HTML content on the canvas, but tldraw supports [TLEmbedShape]. It displays an HTML container (with an iframe or other elements) alongside or overlaid on the canvas `<svg>` element in the page, instead of being “fully” inside a single canvas.

![HTML external content in tldraw](/html-in-tldraw.png)

### Camera Synchronization {#sync-camera}

In [Lesson 4 - Camera], we introduced a series of important camera parameters: translation, rotation, and zoom. Now we need to map the camera parameters to the HTML container's CSS transform so the canvas and HTML container stay in sync.

### HTML Shape

In the [External content sources] example, we can see how tldraw supports HTML content:

```ts
class DangerousHtmlExample extends BaseBoxShapeUtil<IDangerousHtmlShape> {
    static override type = 'html' as const;

    override getDefaultProps() {
        return {
            type: 'html',
            w: 500,
            h: 300,
            html: '<div>hello</div>',
        };
    }
}
```

We also add a serializable shape. Besides the common `x/y/width/height` props, the most important attribute is the `innerHTML` content:

```ts
export interface HtmlAttributes {
    html: string;
}
export interface HtmlSerializedNode
    extends BaseSerializeNode<'html'>,
        Partial<HtmlAttributes> {}
```

When the position changes, we need to synchronize it via a CSS transform:

```ts
const { matrix } = entity.read(GlobalTransform);

$child.style.transform = `matrix(${toDomPrecision(
    matrix.m00,
)}, ${toDomPrecision(matrix.m01)}, ${toDomPrecision(
    matrix.m10,
)}, ${toDomPrecision(matrix.m11)}, ${toDomPrecision(
    matrix.m20,
)}, ${toDomPrecision(matrix.m21)})`;
$child.style.width = `${toDomPrecision(width)}px`;
$child.style.height = `${toDomPrecision(height)}px`;
```

## Paste URL

In [Lesson 24 - Reading from Clipboard], we covered how to handle images and text content from the clipboard.

URLs are special text. In tldraw:

-   When the URL is recognized as an external link, the default handler fetches the page metadata (og:image, title, favicon, description), wraps it into a bookmark asset (TLBookmarkAsset) and the corresponding shape, and renders it with the bookmark style.
-   When the URL is embeddable content (such as YouTube, Figma, Google Maps, etc.), it renders via an `<iframe>`.
-   When the URL points to an image or video resource, it loads it as a media asset (TLImageAsset / TLVideoAsset) and renders it with ImageShapeUtil.

```ts
// @see https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/ui/hooks/clipboard/pasteUrl.ts#L12
export async function pasteUrl() {
    return await editor.putExternalContent({
        type: 'url',
        point,
        url,
        sources,
    });
}
```

### Bookmark {#bookmark}

```ts
// @see https://github.com/tldraw/tldraw/blob/ef0eba14c5a8baf4f36b3659ac9af98256d3b5dd/packages/tldraw/src/lib/defaultExternalContentHandlers.ts#L249
export async function defaultHandleExternalUrlAsset() {
    let meta: {
        image: string;
        favicon: string;
        title: string;
        description: string;
    };

    const resp = await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
    });
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    meta = {
        image:
            doc.head
                .querySelector('meta[property="og:image"]')
                ?.getAttribute('content') ?? '',
        // title, favicon, description
    };

    // Create bookmark asset
}
```

### iframe

## Paste HTML Content {#paste-html}

Code blocks copied from VSCode are HTML fragments:

```html
<meta charset="utf-8" />
<div
    style="color: #e4e4e4;background-color: #181818;font-family: Menlo, Monaco, 'Courier New', monospace;font-weight: normal;font-size: 12px;line-height: 18px;white-space: pre;"
>
    <div><span style="color: #d6d6dd;">### iframe</span></div>
</div>
```

We can try reading it from the clipboard:

```ts
const html = event.clipboardData?.getData(MIME_TYPES.html); // text/html
```

Then we can create the content based on the HTML. To get its size, insert the HTML into a hidden element and let the browser lay it out, then read its `offsetWidth` / `offsetHeight`.

```ts
function createHTML(
    api: ExtendedAPI,
    appState: AppState,
    html: string,
    position?: { x: number; y: number },
) {
    const { width, height } = measureHTML(html);

    updateAndSelectNodes(api, appState, [
        {
            id: uuidv4(),
            type: 'html',
            x: position?.x ?? 0,
            y: position?.y ?? 0,
            width,
            height,
            html,
        },
    ]);
}
```

<HTML />

## Export as SVG or Image {#export-svg-or-image}

In [Lesson 10 - Import and export images], we showed how to export the canvas content as SVG or PNG images. For HTML content you can rely on mature community solutions such as [html-to-image].

> This library uses a feature of SVG that allows having arbitrary HTML content inside of the \<foreignObject\> tag.

[External content sources]: https://tldraw.dev/examples/external-content-sources
[TLEmbedShape]: https://tldraw.dev/reference/tlschema/TLEmbedShape
[Lesson 24 - Reading from Clipboard]: /guide/lesson-024#clipboard-read
[Lesson 4 - Camera]: /guide/lesson-004
[Lesson 10 - Import and export images]: /guide/lesson-010
[html-to-image]: https://github.com/bubkoo/html-to-image
