'use client';

import { useCallback, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ExtendedAPI, Event } from '@infinite-canvas-tutorial/webcomponents';
import { SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { Button } from '@/components/ui/button';
import { Undo2, Redo2, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// 缩放相关的常量
const ZOOM_STEPS = [0.02, 0.05, 0.1, 0.15, 0.2, 0.33, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];

interface ZoomToolbarProps {
  canvasApi: ExtendedAPI | null;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export default function ZoomToolbar({ canvasApi, canvasRef }: ZoomToolbarProps) {
  const t = useTranslations('zoom');
  
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  const updateHistoryState = useCallback(() => {
    if (canvasApi) {
      setCanUndo(!canvasApi.isUndoStackEmpty());
      setCanRedo(!canvasApi.isRedoStackEmpty());
    }
  }, [canvasApi]);

  const onZoomChanged = useCallback((e: CustomEvent<{ zoom: number }>) => {
    setZoomLevel(e.detail.zoom);
  }, []);

  const handleUndo = useCallback(() => {
    if (canvasApi && !canvasApi.isUndoStackEmpty()) {
      canvasApi.undo();
      // 延迟更新状态，等待 API 处理完成
      setTimeout(updateHistoryState, 0);
    }
  }, [canvasApi, updateHistoryState]);

  const handleRedo = useCallback(() => {
    if (canvasApi && !canvasApi.isRedoStackEmpty()) {
      canvasApi.redo();
      // 延迟更新状态，等待 API 处理完成
      setTimeout(updateHistoryState, 0);
    }
  }, [canvasApi, updateHistoryState]);

  const findZoomCeil = (zoom: number) => {
    return ZOOM_STEPS.find((step) => step > zoom) || ZOOM_STEPS[ZOOM_STEPS.length - 1];
  };
  const findZoomFloor = (zoom: number) => {
    return [...ZOOM_STEPS].reverse().find((step) => step < zoom) || ZOOM_STEPS[0];
  };

  const handleZoomIn = useCallback(() => {
    if (canvasApi) {
      const currentZoom = canvasApi.getAppState().cameraZoom;
      canvasApi.zoomTo(findZoomCeil(currentZoom));
    }
  }, [canvasApi]);

  const handleZoomOut = useCallback(() => {
    if (canvasApi) {
      const currentZoom = canvasApi.getAppState().cameraZoom;
      canvasApi.zoomTo(findZoomFloor(currentZoom));
    }
  }, [canvasApi]);

  const handleZoomTo50 = useCallback(() => {
    if (canvasApi) {
      canvasApi.zoomTo(0.5);
    }
  }, [canvasApi]);

  const handleZoomTo100 = useCallback(() => {
    if (canvasApi) {
      canvasApi.zoomTo(1);
    }
  }, [canvasApi]);

  const handleZoomTo200 = useCallback(() => {
    if (canvasApi) {
      canvasApi.zoomTo(2);
    }
  }, [canvasApi]);

  const handleFitToProject = useCallback(() => {
    if (canvasApi) {
      canvasApi.fitToScreen();
    }
  }, [canvasApi]);

  const handleFitToSelection = useCallback(() => {
    if (!canvasApi) {
      return;
    }
    const selectedIds = canvasApi.getAppState().layersSelected;
    if (selectedIds.length === 0) {
      return;
    }
    const selectedNodes = selectedIds
      .map(id => canvasApi!.getNodeById(id))
      .filter(Boolean) as SerializedNode[];
    if (selectedNodes.length === 0) {
      return;
    }
    const bounds = canvasApi.getBounds(selectedNodes);
    // 检查边界是否有效
    if (bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) {
      return;
    }
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    if (width <= 0 || height <= 0) {
      return;
    }
    // 获取 canvas element 的尺寸
    const canvasElement = canvasApi.getCanvasElement();
    const canvasWidth = canvasElement.clientWidth || canvasElement.width;
    const canvasHeight = canvasElement.clientHeight || canvasElement.height;
    if (canvasWidth <= 0 || canvasHeight <= 0) {
      return;
    }
    const scaleX = canvasWidth / width;
    const scaleY = canvasHeight / height;
    const newZoom = Math.min(scaleX, scaleY);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const currentZoom = canvasApi.getAppState().cameraZoom;
    canvasApi.gotoLandmark(
      canvasApi.createLandmark({
        x: centerX - canvasWidth / 2 / currentZoom,
        y: centerY - canvasHeight / 2 / currentZoom,
      }),
      {
        duration: 0,
        onfinish: () => {
          canvasApi?.zoomTo(newZoom);
        },
      },
    );
  }, [canvasApi]);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (!canvasApi) return;
    
    if ((e.key === '+' || e.key === '=') && e.metaKey) {
      e.preventDefault();
      const currentZoom = canvasApi.getAppState().cameraZoom;
      const nextZoom = ZOOM_STEPS.find((step) => step > currentZoom) || ZOOM_STEPS[ZOOM_STEPS.length - 1];
      canvasApi.zoomTo(nextZoom);
    } else if ((e.key === '-' || e.key === '_') && e.metaKey) {
      e.preventDefault();
      const currentZoom = canvasApi.getAppState().cameraZoom;
      const prevZoom = [...ZOOM_STEPS].reverse().find((step) => step < currentZoom) || ZOOM_STEPS[0];
      canvasApi.zoomTo(prevZoom);
    } else if (e.key === '1' && e.metaKey) {
      e.preventDefault();
      canvasApi.zoomTo(1);
    } else if (e.key === '2' && e.metaKey) {
      e.preventDefault();
      canvasApi.zoomTo(2);
    } else if (e.key === '0' && e.metaKey) {
      e.preventDefault();
      canvasApi.fitToScreen();
    }
  }, [canvasApi]);

  // 初始化状态
  useEffect(() => {
    if (canvasApi) {
      const appState = canvasApi.getAppState();
      setZoomLevel(appState.cameraZoom || 1);
      setCanUndo(!canvasApi.isUndoStackEmpty());
      setCanRedo(!canvasApi.isRedoStackEmpty());
    }
  }, [canvasApi]);

  // 监听缩放变化事件
  useEffect(() => {
    canvasRef.current?.addEventListener('keydown', onKeyDown);
    canvasRef.current?.addEventListener(Event.ZOOM_CHANGED, onZoomChanged as EventListener);
    return () => {
      canvasRef.current?.removeEventListener('keydown', onKeyDown);
      canvasRef.current?.removeEventListener(Event.ZOOM_CHANGED, onZoomChanged as EventListener);
    };
  }, [canvasRef, onZoomChanged, onKeyDown]);

  // 定期更新 undo/redo 状态
  useEffect(() => {
    if (!canvasApi) return;
    
    // 立即更新一次
    updateHistoryState();
    
    // 设置定期检查
    const interval = setInterval(() => {
      updateHistoryState();
    }, 100);
    
    return () => {
      clearInterval(interval);
    };
  }, [canvasApi, updateHistoryState]);

  return (
    <div className="absolute bottom-0 right-0 flex items-center gap-2 p-4 z-50">
      <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm border rounded-lg shadow-lg p-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleUndo}
          disabled={!canUndo}
          className="h-8 w-8"
          title="撤销 (⌘Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRedo}
          disabled={!canRedo}
          className="h-8 w-8"
          title="重做 (⇧⌘Z)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
        <div className="h-6 w-px bg-border mx-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-7 px-2 gap-1 text-sm font-medium"
            >
              <span className="min-w-[50px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" alignOffset={-5} sideOffset={8}>
            <DropdownMenuItem onClick={handleZoomIn}>
              {t('zoomIn')}
              <span className="ml-auto text-xs text-muted-foreground">⌘+</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleZoomOut}>
              {t('zoomOut')}
              <span className="ml-auto text-xs text-muted-foreground">⌘-</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleZoomTo50}>
              {t('zoomTo50')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleZoomTo100}>
              {t('zoomTo100')}
              <span className="ml-auto text-xs text-muted-foreground">⌘1</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleZoomTo200}>
              {t('zoomTo200')}
              <span className="ml-auto text-xs text-muted-foreground">⌘2</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleFitToProject}
              disabled={!canvasApi || canvasApi.getNodes().length === 0}
            >
              {t('fitToProject')}
              <span className="ml-auto text-xs text-muted-foreground">⌘0</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleFitToSelection}
              disabled={!canvasApi || canvasApi.getAppState().layersSelected.length === 0}
            >
              {t('fitToSelection')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

