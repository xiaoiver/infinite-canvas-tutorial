import {
  Pen,
  Task,
  Visibility,
  Selected,
  registerIconifyIconSet,
} from '@infinite-canvas-tutorial/ecs';

declare global {
  interface Window {
    editingProbe: {
      textPen: () => void;
      properties: () => void;
      textState: (id: string) => {
        content: string;
        visibility: string;
        rendered: string;
        fontSize: string | number;
      } | null;
      point: (id: string) => { x: number; y: number };
      selectedEntities: (canvasId: string) => string[];
    };
  }
}

// Keep test icons local: selecting an icon must not depend on a CDN or font download.
registerIconifyIconSet('regression', {
  width: 24,
  height: 24,
  icons: {
    square: { body: '<path d="M2 2H22V22H2Z" fill="currentColor"/>' },
    triangle: { body: '<path d="M12 2L22 22H2Z" fill="currentColor"/>' },
  },
});
export function textPen(id = 'left') {
  window.apis[id].setAppState({ penbarSelected: Pen.TEXT });
}

window.editingProbe = {
  selectedEntities: (canvasId) => {
    const api = window.apis[canvasId];
    return api
      .getNodes()
      .filter((node) => api.getEntity(node)?.has(Selected))
      .map((node) => node.id);
  },
  textPen,
  properties: () =>
    window.apis.left.setAppState({
      taskbarVisible: true,
      taskbarSelected: [Task.SHOW_PROPERTIES_PANEL],
    }),
  textState: (id) => {
    const api = window.apis.left;
    const node = api.getNodeById(id);
    if (node?.type !== 'text' || node.isDeleted) return null;
    const entity = api.getEntity(node);
    return {
      content: node.content,
      visibility: node.visibility ?? 'inherited',
      rendered: entity?.read(Visibility).value,
      fontSize: node.fontSize,
    };
  },
  point: (id) => {
    const api = window.apis.left;
    const { minX, minY, maxX, maxY } = api.getBounds([api.getNodeById(id)!]);
    return api.viewport2Client(
      api.canvas2Viewport({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }),
    );
  },
};
