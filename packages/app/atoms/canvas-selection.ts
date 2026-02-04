import { atom } from 'jotai';
import { isDataUrl, isUrl, RectSerializedNode } from '@infinite-canvas-tutorial/ecs';
import { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';

export const selectedNodesAtom = atom<SerializedNode[] | null>(null);

export const isSingleImageAtom = atom((get) => {
    const selectedNodes = get(selectedNodesAtom);
    if (!selectedNodes) {
        return false;
    }
    return selectedNodes.length === 1 && selectedNodes[0].type === 'rect' && (isUrl((selectedNodes[0] as any).fill as string) || isDataUrl((selectedNodes[0] as any).fill as string));
});

export const canvasApiAtom = atom<ExtendedAPI | null>(null);

// 目标图片节点（用于编辑工具）
export const targetImageAtom = atom<RectSerializedNode | null>(null);

