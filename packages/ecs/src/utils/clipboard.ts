/**
 * borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/clipboard.ts#L212
 */

import { SerializedNode } from './serialize';

export const IMAGE_MIME_TYPES = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  jfif: 'image/jfif',
} as const;

export const MIME_TYPES = {
  text: 'text/plain',
  html: 'text/html',
  json: 'application/json',
  // binary
  binary: 'application/octet-stream',
  // image
  ...IMAGE_MIME_TYPES,
} as const;

export const ALLOWED_PASTE_MIME_TYPES = [
  MIME_TYPES.text,
  MIME_TYPES.html,
  ...Object.values(IMAGE_MIME_TYPES),
] as const;
type AllowedPasteMimeTypes = (typeof ALLOWED_PASTE_MIME_TYPES)[number];

const probablySupportsClipboardWriteText =
  typeof navigator !== 'undefined' &&
  'clipboard' in navigator &&
  'writeText' in navigator.clipboard;

// adapted from https://github.com/zenorocha/clipboard.js/blob/ce79f170aa655c408b6aab33c9472e8e4fa52e19/src/clipboard-action.js#L48
const copyTextViaExecCommand = (text: string | null) => {
  // execCommand doesn't allow copying empty strings, so if we're
  // clearing clipboard using this API, we must copy at least an empty char
  if (!text) {
    text = ' ';
  }

  const isRTL = document.documentElement.getAttribute('dir') === 'rtl';

  const textarea = document.createElement('textarea');

  textarea.style.border = '0';
  textarea.style.padding = '0';
  textarea.style.margin = '0';
  textarea.style.position = 'absolute';
  textarea.style[isRTL ? 'right' : 'left'] = '-9999px';
  const yPosition = window.pageYOffset || document.documentElement.scrollTop;
  textarea.style.top = `${yPosition}px`;
  // Prevent zooming on iOS
  textarea.style.fontSize = '12pt';

  textarea.setAttribute('readonly', '');
  textarea.value = text;

  document.body.appendChild(textarea);

  let success = false;

  try {
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    success = document.execCommand('copy');
  } catch (error: any) {
    console.error(error);
  }

  textarea.remove();

  return success;
};

export async function copyTextToClipboard(
  text: string,
  clipboardEvent?: ClipboardEvent,
) {
  // @see https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/clipboard.ts#L445
  // (1) first try using Async Clipboard API
  if (probablySupportsClipboardWriteText) {
    try {
      // NOTE: doesn't work on FF on non-HTTPS domains, or when document
      // not focused
      await navigator.clipboard.writeText(text || '');
      return;
    } catch (error: any) {
      console.error(error);
    }
  }

  // (2) if fails and we have access to ClipboardEvent, use plain old setData()
  try {
    if (clipboardEvent) {
      clipboardEvent.clipboardData?.setData(MIME_TYPES.text, text || '');
      if (clipboardEvent.clipboardData?.getData(MIME_TYPES.text) !== text) {
        throw new Error('Failed to setData on clipboardEvent');
      }
      return;
    }
  } catch (error: any) {
    console.error(error);
  }

  // (3) if that fails, use document.execCommand
  if (!copyTextViaExecCommand(text)) {
    throw new Error('Error copying to clipboard.');
  }
}

export interface ClipboardData {
  elements?: readonly SerializedNode[];
  text?: string;
  html?: string;
  files?: File[];
}

export type PastedMixedContent = { type: 'text' | 'imageUrl'; value: string }[];
type ParsedClipboardEventTextData =
  | { type: 'text'; value: string }
  | { type: 'html'; value: string };

const maybeParseHTMLPaste = (
  event: ClipboardEvent,
): ParsedClipboardEventTextData | null => {
  const html = event.clipboardData?.getData(MIME_TYPES.html);

  if (!html) {
    return null;
  }

  try {
    const doc = new DOMParser().parseFromString(html, MIME_TYPES.html);

    const content = parseHTMLTree(doc.body);

    if (content.length) {
      // return { type: 'mixedContent', value: content };
      return { type: 'html', value: html };
    }
  } catch (error: any) {
    console.error(`error in parseHTMLFromPaste: ${error.message}`);
  }

  return null;
};

/**
 * Parses "paste" ClipboardEvent.
 */
const parseClipboardEventTextData = async (
  event: ClipboardEvent,
  isPlainPaste = false,
): Promise<ParsedClipboardEventTextData> => {
  try {
    const mixedContent = !isPlainPaste && event && maybeParseHTMLPaste(event);

    if (mixedContent) {
      //   if (mixedContent.value.every((item) => item.type === 'text')) {
      //     return {
      //       type: 'text',
      //       value:
      //         event.clipboardData?.getData(MIME_TYPES.text) ||
      //         mixedContent.value
      //           .map((item) => item.value)
      //           .join('\n')
      //           .trim(),
      //     };
      //   }
      return mixedContent;
    }

    const text = event.clipboardData?.getData(MIME_TYPES.text);

    return { type: 'text', value: (text || '').trim() };
  } catch {
    return { type: 'text', value: '' };
  }
};

const clipboardContainsElements = (
  contents: any,
): contents is SerializedNode[] => {
  if (
    // [
    //   EXPORT_DATA_TYPES.excalidraw,
    //   EXPORT_DATA_TYPES.excalidrawClipboard,
    //   EXPORT_DATA_TYPES.excalidrawClipboardWithAPI,
    // ].includes(contents?.type) &&
    Array.isArray(contents)
  ) {
    return true;
  }
  return false;
};

export const parseClipboard = async (
  event: ClipboardEvent,
  isPlainPaste = false,
): Promise<ClipboardData> => {
  const parsedEventData = await parseClipboardEventTextData(
    event,
    isPlainPaste,
  );

  if (parsedEventData.type === 'html') {
    return {
      html: parsedEventData.value,
    };
  }

  // try {
  //   // if system clipboard contains spreadsheet, use it even though it's
  //   // technically possible it's staler than in-app clipboard
  //   const spreadsheetResult =
  //     !isPlainPaste && parsePotentialSpreadsheet(parsedEventData.value);

  //   if (spreadsheetResult) {
  //     return spreadsheetResult;
  //   }
  // } catch (error: any) {
  //   console.error(error);
  // }

  try {
    const systemClipboardData = JSON.parse(parsedEventData.value);
    if (clipboardContainsElements(systemClipboardData)) {
      return {
        elements: systemClipboardData,
      };
    }
  } catch {}

  return { text: parsedEventData.value };
};

export const createPasteEvent = ({
  types,
  files,
}: {
  types?: { [key in AllowedPasteMimeTypes]?: string | File };
  files?: File[];
}) => {
  if (!types && !files) {
    console.warn('createPasteEvent: no types or files provided');
  }

  const event = new ClipboardEvent('paste', {
    clipboardData: new DataTransfer(),
  });

  if (types) {
    for (const [type, value] of Object.entries(types)) {
      if (typeof value !== 'string') {
        files = files || [];
        files.push(value);
        continue;
      }
      try {
        event.clipboardData?.setData(type, value);
        if (event.clipboardData?.getData(type) !== value) {
          throw new Error(`Failed to set "${type}" as clipboardData item`);
        }
      } catch (error: any) {
        throw new Error(error.message);
      }
    }
  }

  if (files) {
    let idx = -1;
    for (const file of files) {
      idx++;
      try {
        event.clipboardData?.items.add(file);
        if (event.clipboardData?.files[idx] !== file) {
          throw new Error(
            `Failed to set file "${file.name}" as clipboardData item`,
          );
        }
      } catch (error: any) {
        throw new Error(error.message);
      }
    }
  }

  return event;
};

/** internal, specific to parsing paste events. Do not reuse. */
function parseHTMLTree(el: ChildNode) {
  let result: PastedMixedContent = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3) {
      const text = node.textContent?.trim();
      if (text) {
        result.push({ type: 'text', value: text });
      }
    } else if (node instanceof HTMLImageElement) {
      const url = node.getAttribute('src');
      if (url && url.startsWith('http')) {
        result.push({ type: 'imageUrl', value: url });
      }
    } else {
      result = result.concat(parseHTMLTree(node));
    }
  }
  return result;
}

export const isSupportedImageFileType = (type: string | null | undefined) => {
  return !!type && (Object.values(IMAGE_MIME_TYPES) as string[]).includes(type);
};

/**
 * Reads OS clipboard programmatically. May not work on all browsers.
 * Will prompt user for permission if not granted.
 */
export const readSystemClipboard = async () => {
  const types: { [key in AllowedPasteMimeTypes]?: string | File } = {};

  let clipboardItems: ClipboardItems;

  try {
    clipboardItems = await navigator.clipboard?.read();
  } catch (error: any) {
    try {
      if (navigator.clipboard?.readText) {
        console.warn(
          `navigator.clipboard.readText() failed (${error.message}). Failling back to navigator.clipboard.read()`,
        );
        const readText = await navigator.clipboard?.readText();
        if (readText) {
          return { [MIME_TYPES.text]: readText };
        }
      }
    } catch (error: any) {
      // @ts-ignore
      if (navigator.clipboard?.read) {
        console.warn(
          `navigator.clipboard.readText() failed (${error.message}). Failling back to navigator.clipboard.read()`,
        );
      } else {
        if (error.name === 'DataError') {
          console.warn(
            `navigator.clipboard.read() error, clipboard is probably empty: ${error.message}`,
          );
          return types;
        }

        throw error;
      }
    }
    throw error;
  }

  for (const item of clipboardItems) {
    for (const type of item.types) {
      // @ts-ignore
      if (!ALLOWED_PASTE_MIME_TYPES.includes(type)) {
        continue;
      }
      try {
        if (type === MIME_TYPES.text || type === MIME_TYPES.html) {
          types[type] = await (await item.getType(type)).text();
        } else if (isSupportedImageFileType(type)) {
          const imageBlob = await item.getType(type);
          const file = new File([imageBlob], '', {
            type,
          });
          types[type] = file;
        } else {
          throw new Error(`Unsupported clipboard type: ${type}`);
        }
      } catch (error: any) {
        console.warn(error.message);
      }
    }
  }

  if (Object.keys(types).length === 0) {
    console.warn('No clipboard data found from clipboard.read().');
    return types;
  }

  return types;
};
