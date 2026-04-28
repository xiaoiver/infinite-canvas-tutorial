/**
 * borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/data/filesystem.ts#L80
 */

import { IMAGE_MIME_TYPES, MIME_TYPES } from '@infinite-canvas-tutorial/ecs';
import {
  fileOpen as _fileOpen,
  fileSave as _fileSave,
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
const INPUT_CHANGE_INTERVAL_MS = 500;
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

  return _fileOpen({
    description: opts.description,
    extensions,
    mimeTypes,
    multiple: opts.multiple ?? false,
    // @ts-ignore
    legacySetup: (resolve, reject, input) => {
      const scheduleRejection = debounce(reject, INPUT_CHANGE_INTERVAL_MS);
      const checkForFile = () => {
        // this hack might not work when expecting multiple files
        if (input.files?.length) {
          const ret = opts.multiple ? [...input.files] : input.files[0];
          resolve(ret as RetType);
        }
      };
      const focusHandler = () => {
        checkForFile();
        document.addEventListener('keyup', scheduleRejection);
        document.addEventListener('pointerup', scheduleRejection);
        scheduleRejection();
      };
      requestAnimationFrame(() => {
        window.addEventListener('focus', focusHandler);
      });
      const interval = window.setInterval(() => {
        checkForFile();
      }, INPUT_CHANGE_INTERVAL_MS);
      return (rejectPromise) => {
        clearInterval(interval);
        scheduleRejection.cancel();
        window.removeEventListener('focus', focusHandler);
        document.removeEventListener('keyup', scheduleRejection);
        document.removeEventListener('pointerup', scheduleRejection);
        if (rejectPromise) {
          // so that something is shown in console if we need to debug this
          console.warn('Opening the file was canceled (legacy-fs).');
          rejectPromise(
            new Error('Opening the file was canceled (legacy-fs).'),
          );
        }
      };
    },
  }) as Promise<RetType>;
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