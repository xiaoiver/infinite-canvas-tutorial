'use client';

import { useTranslations } from 'next-intl';
import { useAtomValue } from 'jotai';
import { selectedNodesAtom, canvasApiAtom } from '@/atoms/canvas-selection';
import { RectSerializedNode } from '@infinite-canvas-tutorial/ecs';
import InputColor from './input-color';

export function ColorToolbar() {
  const selectedNodes = useAtomValue(selectedNodesAtom);
  const canvasApi = useAtomValue(canvasApiAtom);
  const t = useTranslations('toolbar');

  if (selectedNodes && selectedNodes.length > 1) {
    return null;
  }

  const selectedNode = selectedNodes?.[0];

  if (!selectedNode) {
    return null;
  }

  const fill = (selectedNode as RectSerializedNode)?.fill as string;
  const stroke = (selectedNode as RectSerializedNode)?.stroke as string;

  const handleFillChange = (value: string) => {
    if (canvasApi) {
      canvasApi.updateNode(selectedNode, { fill: value });
      canvasApi.record();
    }
  };
  const handleStrokeChange = (value: string) => {
    if (canvasApi) {
      canvasApi.updateNode(selectedNode, { stroke: value });
      canvasApi.record();
    }
  };

  return (
    <>
    {fill && <InputColor value={fill} onChange={handleFillChange} onBlur={() => {}} label={'fill'} className="flex" alpha={true} />}
    {stroke && <InputColor value={stroke} onChange={handleStrokeChange} onBlur={() => {}} label={'stroke'} className="flex" alpha={true} />}
    </>
  );
}