/**
 * borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/filesystem.ts#L80
 */

import {
  IC_FILE_SUFFIX,
  IMAGE_MIME_TYPES,
  MIME_TYPES,
} from '@infinite-canvas-tutorial/ecs';
import {
  fileOpen as _fileOpen,
  fileSave as _fileSave,
  supported as fileSystemAccessSupported,
} from 'browser-fs-access';

export const debounce = <T extends any[]>(
  fn: (...args: T) => void,
  timeout: number,
) => {
  let handle = 0;
  let lastArgs: T | null = null;
  const ret = (...args: T) => {
    lastArgs = args;
    clearTimeout(handle);
    handle = window.setTimeout(() => {
      lastArgs = null;
      fn(...args);
    }, timeout);
  };
  ret.flush = () => {
    clearTimeout(handle);
    if (lastArgs) {
      const _lastArgs = lastArgs;
      lastArgs = null;
      fn(..._lastArgs);
    }
  };
  ret.cancel = () => {
    lastArgs = null;
    clearTimeout(handle);
  };
  return ret;
};

/**
 * borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/filesystem.ts
 */
type FILE_EXTENSION = Exclude<keyof typeof MIME_TYPES, 'binary'>;
/**
 * Image extensions for the native file picker. `heic` / `heif` are listed
 * explicitly so typings stay valid if ecs `lib` lags behind `clipboard.ts`.
 */
export type ImageFileExtension =
  | keyof typeof IMAGE_MIME_TYPES
  | 'heic'
  | 'heif';
export const fileOpen = <M extends boolean | undefined = false>(opts: {
  extensions?: ImageFileExtension[];
  description: string;
  multiple?: M;
}): Promise<M extends false | undefined ? File : File[]> => {
  // an unsafe TS hack, alas not much we can do AFAIK
  type RetType = M extends false | undefined ? File : File[];

  const mimeForImageExt = (type: ImageFileExtension): string => {
    if (type in IMAGE_MIME_TYPES) {
      return IMAGE_MIME_TYPES[type as keyof typeof IMAGE_MIME_TYPES];
    }
    if (type === 'heic') {
      return 'image/heic';
    }
    if (type === 'heif') {
      return 'image/heif';
    }
    return 'application/octet-stream';
  };

  const mimeTypes = opts.extensions?.reduce((mimeTypes, type) => {
    mimeTypes.push(mimeForImageExt(type));
    return mimeTypes;
  }, [] as string[]);

  const extensions = opts.extensions?.reduce((acc, ext) => {
    if (ext === 'jpg') {
      return acc.concat('.jpg', '.jpeg');
    }
    return acc.concat(`.${ext}`);
  }, [] as string[]);

  if (fileSystemAccessSupported) {
    return _fileOpen({
      description: opts.description,
      extensions,
      mimeTypes,
      multiple: opts.multiple ?? false,
    }) as Promise<RetType>;
  }

  // WebKit exposes showPicker(), but it may not open a file chooser. A native
  // input click also keeps activation within the originating toolbar event.
  return new Promise<RetType>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = [...(mimeTypes ?? []), ...(extensions ?? [])].join(',');
    input.multiple = opts.multiple ?? false;
    input.style.display = 'none';
    const cleanup = () => {
      input.removeEventListener('change', change);
      input.removeEventListener('cancel', cancel);
      input.remove();
    };
    const cancel = () => {
      cleanup();
      reject(new DOMException('Opening the file was cancelled', 'AbortError'));
    };
    const change = () => {
      const files = Array.from(input.files ?? []);
      if (!files.length) return cancel();
      cleanup();
      resolve((opts.multiple ? files : files[0]) as RetType);
    };
    input.addEventListener('change', change);
    input.addEventListener('cancel', cancel);
    document.body.append(input);
    try {
      input.click();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
};

export const fileSave = (
  blob: Blob | Promise<Blob>,
  opts: {
    /** supply without the extension */
    name: string;
    /** file extension */
    extension: FILE_EXTENSION;
    mimeTypes?: string[];
    description: string;
    /** existing FileSystemHandle */
    fileHandle?: FileSystemFileHandle | null;
  },
) => {
  return _fileSave(
    blob,
    {
      fileName: `${opts.name}.${opts.extension}`,
      description: opts.description,
      extensions: [`.${opts.extension}`],
      mimeTypes: opts.mimeTypes,
    },
    opts.fileHandle,
  );
};

export async function getDataURL(file: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = reader.result as string;
      resolve(dataURL);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

export async function getFileText(file: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
}

/**
 * Open an Infinite Canvas interchange document (`.ic`) and return its text
 * contents along with the original file name.
 */
export async function openIcDocument(): Promise<{
  name: string;
  contents: string;
}> {
  const file = await _fileOpen({
    description: 'Infinite Canvas document',
    extensions: [IC_FILE_SUFFIX],
    mimeTypes: ['application/json'],
    multiple: false,
  });
  const contents = await getFileText(file);
  return { name: file.name, contents };
}

/**
 * Open a Figma design file (`.fig`) and return its raw bytes.
 */
export async function openFigmaDocument(): Promise<{
  name: string;
  contents: Uint8Array;
}> {
  const file = await _fileOpen({
    description: 'Figma design file',
    extensions: ['.fig'],
    mimeTypes: ['application/octet-stream'],
    multiple: false,
  });
  const contents = new Uint8Array(await file.arrayBuffer());
  return { name: file.name, contents };
}