import * as Y from 'yjs';
import {
  CanvasYjsManager,
  validCanvasNodes,
} from '../../packages/app/lib/yjs/canvas-yjs-manager';

it('stores new nodes without version and repairs empty cached entries', () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const doc = new Y.Doc();
  const yArray = doc.getArray<Y.Map<any>>('nodes');
  const manager = Object.create(CanvasYjsManager.prototype) as CanvasYjsManager;
  Object.assign(manager, { doc, yArray });

  yArray.push([new Y.Map()]);
  expect(manager.loadNodes()).toEqual([]);
  expect(yArray.length).toBe(0);
  expect(warning).toHaveBeenCalledWith(
    'Ignored 1 cached canvas node(s) without an ID.',
  );

  manager.recordLocalOps([
    { id: 'rect-a', type: 'rect', x: 10, width: 20 },
  ]);
  expect(manager.loadNodes()).toEqual([
    { id: 'rect-a', type: 'rect', x: 10, width: 20 },
  ]);

  manager.recordLocalOps([
    { id: 'rect-b', type: 'rect', x: 30, width: 40 },
  ]);
  expect(manager.loadNodes()).toEqual([
    { id: 'rect-b', type: 'rect', x: 30, width: 40 },
  ]);
  expect(yArray.get(0).has('x')).toBe(true);
  doc.destroy();
  warning.mockRestore();
});

it('ignores cached records without an ID before loading history', () => {
  expect(validCanvasNodes([{} as never, { id: 'ok', type: 'rect' }])).toEqual([
    { id: 'ok', type: 'rect' },
  ]);
});
