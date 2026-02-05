'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Pencil, SquareDashed } from 'lucide-react';
import { useAtom, useAtomValue } from 'jotai';
import { isSingleImageAtom, selectedNodesAtom, canvasApiAtom, targetImageAtom } from '@/atoms/canvas-selection';
import { PathSerializedNode, Pen, RectSerializedNode, SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

type Tool = 'draw-rect-mask' | 'draw-pencil-freehand-mask';

export function ImageToolbar() {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const isSingleImage = useAtomValue(isSingleImageAtom);
  const selectedNodes = useAtomValue(selectedNodesAtom);
  const canvasApi = useAtomValue(canvasApiAtom);
  const [targetImage, setTargetImage] = useAtom(targetImageAtom);
  const t = useTranslations('toolbar');

  const handleRectDrawn = useCallback((e: CustomEvent<{ node: SerializedNode }>) => {
    const rect = e.detail.node as RectSerializedNode;
    if (targetImage) {
      // Make this rect as the child of selected image node
      // @ts-expect-error
      rect.usage = 'mask';

      if (canvasApi) {
        canvasApi.setAppState({ penbarSelected: Pen.DRAW_RECT });
        canvasApi.reparentNode(rect, targetImage);
        canvasApi.record();
      }
    }
  }, [targetImage]);

  const handlePencilDrawn = useCallback((e: CustomEvent<{ node: SerializedNode }>) => {
    const pencil = e.detail.node as PathSerializedNode;
    if (targetImage) {
      // @ts-expect-error
      pencil.usage = 'mask';

      if (canvasApi) {
        canvasApi.setAppState({ penbarSelected: Pen.PENCIL });
        canvasApi.reparentNode(pencil, targetImage);
        canvasApi.record();
      }
    }
  }, [targetImage]);
  
  useEffect(() => {
    if (canvasApi) {
      canvasApi.element.addEventListener(Event.RECT_DRAWN, handleRectDrawn);
      canvasApi.element.addEventListener(Event.PENCIL_DRAWN, handlePencilDrawn);
    }
    return () => {
      if (canvasApi) {
        canvasApi.element.removeEventListener(Event.RECT_DRAWN, handleRectDrawn);
        canvasApi.element.removeEventListener(Event.PENCIL_DRAWN, handlePencilDrawn);
      }
    };
  }, [canvasApi, handleRectDrawn]);

  // 处理工具选择
  const handleToolSelect = (tool: Tool | '') => {
    if (tool === '') {
      setSelectedTool(null);
      if (canvasApi) {
        canvasApi.setAppState({ penbarSelected: Pen.SELECT });
        // 恢复选择之前的图形
        if (targetImage) {
          canvasApi.selectNodes([targetImage]);
        }
        setTargetImage(null);
      }
      return;
    }

    setSelectedTool(tool as Tool);
    setTargetImage(selectedNodes?.[0] as RectSerializedNode);

    if (canvasApi) {
      

      if (tool === 'draw-rect-mask') {
        canvasApi.setAppState({ penbarSelected: Pen.DRAW_RECT });
      } else if (tool === 'draw-pencil-freehand-mask') {
        canvasApi.setAppState({ penbarSelected: Pen.PENCIL, penbarPencil: { 
          ...canvasApi.getAppState().penbarPencil,
          strokeWidth: 40 } });
      } else {
        canvasApi.setAppState({ penbarSelected: Pen.SELECT });
      }

      if (selectedNodes) {
        canvasApi.highlightNodes(selectedNodes);
      }
    }
  };

  // 只在选中图片或已选择工具时显示
  if (!isSingleImage && !selectedTool) {
    return null;
  }

  return (
    <ToggleGroup 
      size="sm" 
      variant="outline" 
      type="single" 
      value={selectedTool || undefined} 
      onValueChange={handleToolSelect}
    >
      <ToggleGroupItem value="draw-rect-mask" aria-label="Draw rect mask tool">
        <SquareDashed />
        {t('drawRectMask')}
      </ToggleGroupItem>
      <ToggleGroupItem value="draw-pencil-freehand-mask" aria-label="Draw pencil freehand mask tool">
        <Pencil />
        {t('drawPencilFreehandMask')}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

