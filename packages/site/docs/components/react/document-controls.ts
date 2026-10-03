import {
  createElement as h,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { useCanvasAPI } from '@infinite-canvas-tutorial/react';

const copy = {
  en: {
    group: 'Document',
    save: 'Save locally',
    load: 'Load saved',
    export: 'Export .ic',
    import: 'Import .ic',
    saved: 'Saved in this browser.',
    loaded: 'Loaded from this browser.',
    exported: 'Document downloaded.',
    imported: 'Document imported.',
    empty: 'No saved document for this canvas.',
  },
  zh: {
    group: '文档',
    save: '本地保存',
    load: '加载存档',
    export: '导出 .ic',
    import: '导入 .ic',
    saved: '已保存到此浏览器。',
    loaded: '已加载此浏览器中的存档。',
    exported: '已下载文档。',
    imported: '已导入文档。',
    empty: '此画布尚无本地存档。',
  },
};

/** Host-owned storage and file controls; importing this module is SSR-safe. */
export function DocumentControls({
  storageKey,
  filename = 'canvas.ic',
  locale = 'en',
}: {
  storageKey: string;
  filename?: string;
  locale?: 'en' | 'zh';
}) {
  const api = useCanvasAPI();
  const text = copy[locale];
  const input = useRef<HTMLInputElement>(null);
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const cancel = () => {
      active.current?.abort();
      active.current = null;
    };
    setBusy(false);
    setMessage('');
    setError('');
    const unsubscribe = api?.onDestroy(cancel);
    return () => {
      unsubscribe?.();
      cancel();
    };
  }, [api, storageKey]);

  const run = async (
    operation: (signal: AbortSignal) => Promise<boolean>,
    success: string,
  ) => {
    if (!api || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const applied = await operation(controller.signal);
      if (applied && !controller.signal.aborted) setMessage(success);
    } catch (reason) {
      if (!controller.signal.aborted) {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  };

  const read = (
    update: (editor: NonNullable<typeof api>) => void,
    signal: AbortSignal,
  ) => api!.edit((current) => update(current), { capture: 'NEVER', signal });

  const save = () =>
    run(
      (signal) =>
        read((api) => {
          localStorage.setItem(
            storageKey,
            JSON.stringify(api.exportIcDocument()),
          );
        }, signal),
      text.saved,
    );
  const load = () =>
    run(async (signal) => {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) {
        setMessage(text.empty);
        return false;
      }
      return api!.importIcDocument(raw, { signal });
    }, text.loaded);
  const exportFile = () =>
    run(
      (signal) =>
        read((api) => {
          const blob = new Blob(
            [JSON.stringify(api.exportIcDocument(), null, 2)],
            {
              type: 'application/json',
            },
          );
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.append(link);
          try {
            link.click();
          } finally {
            link.remove();
            URL.revokeObjectURL(url);
          }
        }, signal),
      text.exported,
    );
  const importFile = (file: File) =>
    run(async (signal) => {
      const raw = await file.text();
      if (signal.aborted) return false;
      return api!.importIcDocument(raw, { signal });
    }, text.imported);

  // The documentation uses Vue's JSX transform; create React elements explicitly.
  return h(
    'div',
    {
      className: 'document-controls',
      role: 'group',
      'aria-label': text.group,
      'aria-busy': busy,
    },
    h(
      'button',
      {
        type: 'button',
        'data-document-action': 'save',
        disabled: !api || busy,
        onClick: save,
      },
      text.save,
    ),
    h(
      'button',
      {
        type: 'button',
        'data-document-action': 'load',
        disabled: !api || busy,
        onClick: load,
      },
      text.load,
    ),
    h(
      'button',
      {
        type: 'button',
        'data-document-action': 'export',
        disabled: !api || busy,
        onClick: exportFile,
      },
      text.export,
    ),
    h(
      'button',
      {
        type: 'button',
        'data-document-action': 'import',
        disabled: !api || busy,
        onClick: () => input.current?.click(),
      },
      text.import,
    ),
    h('input', {
      ref: input,
      type: 'file',
      hidden: true,
      accept: '.ic,.json,application/json',
      disabled: !api || busy,
      'aria-label': text.import,
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void importFile(file);
      },
    }),
    message && h('p', { role: 'status' }, message),
    error && h('p', { role: 'alert' }, error),
  );
}
