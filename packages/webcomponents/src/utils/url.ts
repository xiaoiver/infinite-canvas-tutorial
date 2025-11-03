// @see https://github.com/tldraw/tldraw/blob/ef0eba14c5a8baf4f36b3659ac9af98256d3b5dd/packages/tldraw/src/lib/defaultExternalContentHandlers.ts#L249
export async function extractExternalUrlMetadata(url: string) {
  let meta: {
    image: string;
    favicon: string;
    title: string;
    description: string;
  };

  try {
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
      favicon:
        doc.head
          .querySelector('link[rel="apple-touch-icon"]')
          ?.getAttribute('href') ??
        doc.head.querySelector('link[rel="icon"]')?.getAttribute('href') ??
        '',
      title:
        doc.head
          .querySelector('meta[property="og:title"]')
          ?.getAttribute('content') ?? url,
      description:
        doc.head
          .querySelector('meta[property="og:description"]')
          ?.getAttribute('content') ?? '',
    };
    if (!meta.image.startsWith('http')) {
      meta.image = new URL(meta.image, url).href;
    }
    if (!meta.favicon.startsWith('http')) {
      meta.favicon = new URL(meta.favicon, url).href;
    }
  } catch (error) {
    console.error(error);
    // toasts.addToast({
    // 	title: msg('assets.url.failed'),
    // 	severity: 'error',
    // })
    meta = { image: '', favicon: '', title: '', description: '' };
  }

  return meta;
}
