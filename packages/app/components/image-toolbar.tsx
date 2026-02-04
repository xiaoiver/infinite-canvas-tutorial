'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SquareDashed } from 'lucide-react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { isSingleImageAtom, selectedNodesAtom, canvasApiAtom, targetImageAtom } from '@/atoms/canvas-selection';
import { Pen, RectSerializedNode, SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { Event } from '@infinite-canvas-tutorial/webcomponents';

type Tool = 'draw-rect-mask';

export function ImageToolbar() {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const isSingleImage = useAtomValue(isSingleImageAtom);
  const selectedNodes = useAtomValue(selectedNodesAtom);
  const canvasApi = useAtomValue(canvasApiAtom);
  const [targetImage, setTargetImage] = useAtom(targetImageAtom);
  const t = useTranslations('toolbar');

  // // 当选择工具时，如果 targetImage 为 null，则设置为当前的 selectedImageNode
  // useEffect(() => {
  //   if (selectedTool && !targetImage && selectedImageNode) {
  //     setTargetImage(selectedImageNode);
  //   }
  // }, [selectedTool, selectedImageNode, targetImage, setTargetImage]);

  // // 当取消选择工具时，更新 targetImage 为当前的 selectedImageNode
  // useEffect(() => {
  //   if (!selectedTool && selectedImageNode) {
  //     setTargetImage(selectedImageNode);
  //   }
  // }, [selectedTool, selectedImageNode, setTargetImage]);

  const handleRectDrawn = useCallback((e: CustomEvent<{ node: SerializedNode }>) => {
    const rect = e.detail.node as RectSerializedNode;
    if (targetImage) {
      // Make this rect as the child of selected image node
      // @ts-expect-error
      rect.usage = 'mask';

      if (canvasApi) {
        // 继续保持工具在矩形绘制状态，默认行为会切换成 Select 工具
        canvasApi.setAppState({ penbarSelected: Pen.DRAW_RECT });
        canvasApi.reparentNode(rect, targetImage);
        canvasApi.record();
      }
    }
  }, [targetImage]);

  useEffect(() => {
    if (canvasApi) {
      canvasApi.element.addEventListener(Event.RECT_DRAWN, handleRectDrawn);
    }
    return () => {
      if (canvasApi) {
        canvasApi.element.removeEventListener(Event.RECT_DRAWN, handleRectDrawn);
      }
    };
  }, [canvasApi, handleRectDrawn]);

  // 处理工具选择
  const handleToolSelect = (tool: Tool | '') => {
    if (tool === '') {
      setSelectedTool(null);
      if (canvasApi) {
        canvasApi.setAppState({ penbarSelected: Pen.SELECT });
      }
      return;
    }
    
    setSelectedTool(tool as Tool);
    // 当选择工具时，如果 targetImage 为 null，立即设置为当前的 selectedImageNode
    // if (!targetImage && selectedImageNode) {
    //   setTargetImage(selectedImageNode);
    // }
    if (canvasApi) {
      if (tool === 'draw-rect-mask') {
        canvasApi.setAppState({ penbarSelected: Pen.DRAW_RECT });
      } else {
        canvasApi.setAppState({ penbarSelected: Pen.SELECT });
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
    </ToggleGroup>
  );
}

