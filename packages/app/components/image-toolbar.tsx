'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Lasso, Layers, Pencil, PenTool, SquareDashed } from 'lucide-react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { isSingleImageAtom, selectedNodesAtom, canvasApiAtom } from '@/atoms/canvas-selection';
import { PathSerializedNode, Pen, RectSerializedNode, SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { Event } from '@infinite-canvas-tutorial/webcomponents';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Button } from './ui/button';

export type ImageTool = 'draw-rect-mask' | 'draw-pencil-freehand-mask' | 'draw-lasso-mask' | 'split-layers';

export function ImageToolbar() {
  const [imageTool, setImageTool] = useState<ImageTool | null>(null);
  const isSingleImage = useAtomValue(isSingleImageAtom);
  const selectedNodes = useAtomValue(selectedNodesAtom);
  const canvasApi = useAtomValue(canvasApiAtom);
  const [targetImage, setTargetImage] = useState<RectSerializedNode | null>(null);
  const t = useTranslations('toolbar');

  const handleRectDrawn = useCallback((e: CustomEvent<{ node: SerializedNode }>) => {
    const rect = e.detail.node as RectSerializedNode;
    setImageTool(null);
    if (targetImage) {
      // Make this rect as the child of selected image node
      // @ts-expect-error
      rect.usage = 'mask';
      if (canvasApi) {
        canvasApi.reparentNode(rect, targetImage);
        canvasApi.record();
        canvasApi.selectNodes([targetImage]);
      }
    }
  }, [targetImage]);

  const handlePencilDrawn = useCallback((e: CustomEvent<{ node: SerializedNode }>) => {
    const pencil = e.detail.node as PathSerializedNode;
    setImageTool(null);
    if (targetImage) {
      // @ts-expect-error
      pencil.usage = 'mask';
      if (canvasApi) {
        canvasApi.reparentNode(pencil, targetImage);
        canvasApi.record();
        canvasApi.selectNodes([targetImage]);
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
  }, [canvasApi, handleRectDrawn, handlePencilDrawn]);

  const handleToolSelect = (tool: ImageTool) => {
    if (!tool) {
      setImageTool(null);
      if (canvasApi) {
        canvasApi.setAppState({ penbarSelected: Pen.SELECT });
        // 恢复选择之前的图形
        if (targetImage) {
          canvasApi.runAtNextTick(() => {
            canvasApi.selectNodes([targetImage], false, false);
          });
        }
        setTargetImage(null);
      }
      return;
    }

    setImageTool(tool as ImageTool);
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

      // if (selectedNodes) {
      //   canvasApi.highlightNodes(selectedNodes);
      // }
    }
  };

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (!canvasApi || !targetImage) return;
    
    if (e.key === 'Escape') {
      setImageTool(null);
      if (canvasApi) {
        canvasApi.setAppState({ penbarSelected: Pen.SELECT });
        if (targetImage) {
          canvasApi.runAtNextTick(() => {
            canvasApi.selectNodes([targetImage]);
          });
        }
      }
    }
  }, [canvasApi, targetImage]);

  // Esc to quit the image tool
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);

  if (imageTool === 'draw-rect-mask' || imageTool === 'draw-pencil-freehand-mask' || imageTool === 'draw-lasso-mask') {
    return (
      <div className="flex gap-2 text-sm text-accent-foreground items-center">
        {imageTool === 'draw-rect-mask' && t('drawRectMaskDescription')}
        {imageTool === 'draw-pencil-freehand-mask' && t('drawPencilFreehandMaskDescription')}
        {imageTool === 'draw-lasso-mask' && t('drawLassoMaskDescription')}
      </div>
    );
  }

  if (!isSingleImage) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex gap-2">
        <ToggleGroup 
          size="sm" 
          variant="outline" 
          type="single"
          value={imageTool || undefined}
          onValueChange={handleToolSelect}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem value="draw-rect-mask" aria-label="Draw rect mask tool">
                <SquareDashed />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>
              {t('drawRectMask')}
            </TooltipContent>
          </Tooltip>
        
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
        <ToggleGroupItem value="draw-pencil-freehand-mask" aria-label="Draw pencil freehand mask tool">
          
                <Pencil />
              
        </ToggleGroupItem>
        </TooltipTrigger>
              <TooltipContent>
                {t('drawPencilFreehandMask')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
        <ToggleGroupItem value="draw-lasso-mask" aria-label="Draw lasso mask tool">
          
                <Lasso />
              
        </ToggleGroupItem>
        </TooltipTrigger>
              <TooltipContent>
                {t('drawLassoMask')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
      </ToggleGroup>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon-sm" className="px-2">
            <Layers />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {t('splitLayers')}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="icon-sm" className="px-2">
            <PenTool />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {t('vectorize')}
        </TooltipContent>
      </Tooltip>
    </div>
    </TooltipProvider>
  );
}

