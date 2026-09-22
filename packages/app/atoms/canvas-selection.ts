import { atom } from 'jotai';
import { isDataUrl, isUrl } from '@infinite-canvas-tutorial/ecs';
import { ExtendedAPI } from '@infinite-canvas-tutorial/webcomponents';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';

export const selectedNodesAtom = atom<SerializedNode[]>([]);

export const isSingleImageAtom = atom((get) => {
    const selectedNodes = get(selectedNodesAtom);
    if (!selectedNodes) {
        return false;
    }
    return selectedNodes.length === 1 && selectedNodes[0].type === 'rect' && (isUrl((selectedNodes[0] as any).fill as string) || isDataUrl((selectedNodes[0] as any).fill as string));
});

export const canvasApiAtom = atom<ExtendedAPI | null>(null);

// export const stopTriggerSelectedNodesAtom = atom<boolean>(false);

