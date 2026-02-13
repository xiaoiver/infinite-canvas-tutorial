'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Lasso, Layers, Loader2, MousePointerClick, Pencil, PenTool, SquareDashed } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { isSingleImageAtom, selectedNodesAtom, canvasApiAtom } from '@/atoms/canvas-selection';
import { sendMessageAtom, chatIdAtom } from '@/atoms/chat';
import { PathSerializedNode, Pen, RectSerializedNode, SerializedNode, TRANSFORMER_MASK_FILL_COLOR } from '@infinite-canvas-tutorial/ecs';
import { Event } from '@infinite-canvas-tutorial/webcomponents';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Button } from './ui/button';
import { convertToFiles } from '@/lib/file';
import { FileUIPart } from 'ai';
import { canvasToFloat32Array, image2Canvas, resizeCanvas, sliceTensorMask } from '@/lib/sam/utils';
import { HtmlSerializedNode } from '../../ecs/lib/utils';

const imageSize = { w: 1024, h: 1024 };
export type ImageTool = 'draw-rect-mask' | 'draw-pencil-freehand-mask' | 'draw-lasso-mask' | 'draw-smart-click-mask';

export function ImageToolbar() {
  const [imageTool, setImageTool] = useState<ImageTool | null>(null);
  const isSingleImage = useAtomValue(isSingleImageAtom);
  const selectedNodes = useAtomValue(selectedNodesAtom);
  const canvasApi = useAtomValue(canvasApiAtom);
  const sendMessage = useAtomValue(sendMessageAtom);
  const chatId = useAtomValue(chatIdAtom);
  const [targetImage, setTargetImage] = useState<RectSerializedNode | null>(null);
  const t = useTranslations('toolbar');
  const tChats = useTranslations('chats');
  const workerRef = useRef<Worker | null>(null);
  const [samWorkerLoading, setSamWorkerLoading] = useState(false);

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

  const handleLassoDrawn = useCallback((e: CustomEvent<{ node: SerializedNode }>) => {
    const lasso = e.detail.node as PathSerializedNode;
    setImageTool(null);
    if (targetImage) {
      // @ts-expect-error
      lasso.usage = 'mask';
      if (canvasApi) {
        canvasApi.reparentNode(lasso, targetImage);
        canvasApi.record();
        canvasApi.selectNodes([targetImage]);
      }
    }
  }, [targetImage]);

  const handlePointDrawn = useCallback((e: CustomEvent<{ x: number, y: number }>) => {
    setImageTool(null);
    const { x: canvasX, y: canvasY } = e.detail;
    const label = 1;
    if (targetImage && canvasApi) {
      // const marker: HtmlSerializedNode = {
      //   type: 'html',
      //   html: `<div>xxxx</div>`,
      //   x: canvasX,
      //   y: canvasY,
      //   width: 100,
      //   height: 100,
      //   // @ts-expect-error - TODO: Add usage to HtmlSerializedNode
      //   usage: 'mask',
      // };
      // if (canvasApi) {
      //   canvasApi.updateNode(marker);
      //   canvasApi.reparentNode(marker, targetImage);
      //   canvasApi.record();
      //   canvasApi.selectNodes([targetImage]);
      // }

      // const { x: canvasX, y: canvasY } = canvasApi.viewport2Canvas({ x: viewportX, y: viewportY });
      const x = canvasX - (targetImage.x as number);
      const y = canvasY - (targetImage.y as number);

      const { width, height } = canvasApi.getAbsoluteTransformAndSize(targetImage);
      // input image will be resized to 1024x1024 -> normalize mouse pos to 1024x1024
      const point = {
        x: (x / width) * imageSize.w,
        y: (y / height) * imageSize.h,
        label,
      };
      
      workerRef.current?.postMessage({
        type: 'decodeMask',
        data: {
          points: [point],
          maskArray: null,
          maskShape: null,
        },
      });
    }
  }, [targetImage]);

  useEffect(() => {
    if (canvasApi) {
      canvasApi.element.addEventListener(Event.RECT_DRAWN, handleRectDrawn);
      canvasApi.element.addEventListener(Event.PENCIL_DRAWN, handlePencilDrawn);
      canvasApi.element.addEventListener(Event.LASSO_DRAWN, handleLassoDrawn);
      canvasApi.element.addEventListener(Event.POINT_DRAWN, handlePointDrawn);
    }
    return () => {
      if (canvasApi) {
        canvasApi.element.removeEventListener(Event.RECT_DRAWN, handleRectDrawn);
        canvasApi.element.removeEventListener(Event.PENCIL_DRAWN, handlePencilDrawn);
        canvasApi.element.removeEventListener(Event.LASSO_DRAWN, handleLassoDrawn);
        canvasApi.element.removeEventListener(Event.POINT_DRAWN, handlePointDrawn);
      }
    };
  }, [canvasApi, handleRectDrawn, handlePencilDrawn, handleLassoDrawn, handlePointDrawn]);

  const handleToolSelect = (tool: ImageTool) => {
    if (!tool) {
      setImageTool(null);
      if (canvasApi) {
        canvasApi.setAppState({ penbarSelected: Pen.SELECT });
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
        canvasApi.setAppState({ 
          penbarSelected: Pen.DRAW_RECT,
          penbarDrawRect: {
            ...canvasApi.getAppState().penbarDrawRect,
            stroke: 'none',
            strokeWidth: 0,
            strokeOpacity: 0,
          }
        });
      } else if (tool === 'draw-pencil-freehand-mask') {
        canvasApi.setAppState({
          penbarSelected: Pen.PENCIL, 
          penbarPencil: {
            ...canvasApi.getAppState().penbarPencil,
            stroke: TRANSFORMER_MASK_FILL_COLOR,
            strokeWidth: 40,
            strokeOpacity: 0.5,
          }
        });
      } else if (tool === 'draw-lasso-mask') {
        canvasApi.setAppState({
          penbarSelected: Pen.LASSO,
          penbarLasso: {
            ...canvasApi.getAppState().penbarLasso,
            mode: 'draw',
            stroke: 'none',
            strokeWidth: 0,
            strokeOpacity: 0,
          }
        });
      } else if (tool === 'draw-smart-click-mask') {
        canvasApi.setAppState({
          penbarSelected: Pen.DRAW_POINT,
        });
        // create worker on first click
        if (!workerRef.current) {
          try {
            setSamWorkerLoading(true);
            const worker = new Worker(
              new URL("../lib/sam/worker.ts", import.meta.url)
            );
            workerRef.current = worker;
          } catch (error) {
            console.error('Failed to create SAM worker:', error);
          }
        }
      } else {
        canvasApi.setAppState({ penbarSelected: Pen.SELECT });
      }

      // if (selectedNodes) {
      //   canvasApi.highlightNodes(selectedNodes);
      // }
    }
  };

  const handleDecomposeImage = () => {
    if (sendMessage && canvasApi) {
      const files = convertToFiles(canvasApi, selectedNodes?.[0] as RectSerializedNode) as FileUIPart[];
      sendMessage(
        { 
          text: tChats('decomposeImageDescription'),
          files,
        },
        {
          body: {
            chatId
          },
        },
      );
    }
  };

  const handleVectorizeImage = () => {
    if (sendMessage && canvasApi) {
      const files = convertToFiles(canvasApi, selectedNodes?.[0] as RectSerializedNode) as FileUIPart[];
      sendMessage(
        { text: tChats('vectorizeImageDescription'), files },
        {
          body: {
            chatId
          },
        },
      );
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

  // Cleanup worker on unmount
  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;

    worker.onmessage = async (event) => {
      const { type, data } = event.data;
      if (type == 'pong') {
        const { success } = data;
        if (success) {
          const canvas = await image2Canvas(targetImage!.fill!);
          worker.postMessage({
            type: 'encodeImage',
            data: canvasToFloat32Array(resizeCanvas(canvas, imageSize)),
          });
        } else {
          console.error('Failed to load SAM model');
        }
      } else if (type == 'encodeImageDone') {
        console.log('encodeImageDone');
        setSamWorkerLoading(false);
      } else if (type == 'decodeMaskResult') {
        // SAM2 returns 3 mask along with scores -> select best one
        const maskTensors = data.masks;
        const maskScores = data.iou_predictions.cpuData;
        const bestMaskIdx = maskScores.indexOf(Math.max(...maskScores));
        const maskCanvas = sliceTensorMask(maskTensors, bestMaskIdx);

        const maskCanvasResized = resizeCanvas(maskCanvas, {
          w: imageSize.w,
          h: imageSize.h,
        });

        const maskDataURL = maskCanvasResized.toDataURL();
        // console.log('maskDataURL', maskDataURL);

        if (canvasApi && targetImage) {
          // const maskId = targetImage.id + '-mask';
        }
      }
    };
    worker.postMessage({ type: 'ping' });

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, [targetImage, canvasApi]);

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
      <div className="flex gap-2 text-sm text-accent-foreground items-center">
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem value="draw-smart-click-mask" aria-label="Draw smart click mask tool">
                  {samWorkerLoading ? <Loader2 className="animate-spin" /> : <MousePointerClick />}
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>
                {t('drawSmartClickMask')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </ToggleGroup>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-sm" className="px-2" onClick={handleDecomposeImage}>
              <Layers />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t('decomposeImage')}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-sm" className="px-2" onClick={handleVectorizeImage}>
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

