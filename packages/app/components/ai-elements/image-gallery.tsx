"use client";

import { cn } from "@/lib/utils";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { TooltipContent, Tooltip, TooltipTrigger, TooltipProvider } from "../ui/tooltip";
import { useTranslations } from "next-intl";
import { insertImage } from "@/tools/insert-image-impl";
import { canvasApiAtom } from "@/atoms/canvas-selection";
import { useAtomValue } from "jotai";

export type ImageGalleryProps = {
  images: string[];
  alt?: string;
  className?: string;
};

/**
 * 图片展示组件
 * 支持网格布局、点击放大、响应式设计
 */
export const ImageGallery = ({
  images,
  alt = "Generated Image",
  className,
}: ImageGalleryProps) => {

  if (images.length === 0) {
    return null;
  }

  // 多张图片 - 网格布局
  return (
    <PhotoProvider>
      <div
        className={cn(
          "grid gap-2",
          images.length === 2
            ? "grid-cols-2"
            : images.length === 3
            ? "grid-cols-2"
            : images.length === 4
            ? "grid-cols-2"
            : "grid-cols-2 sm:grid-cols-3",
          className
        )}
      >
        {images.map((item, index) => (
          <PhotoView key={index} src={item}>
            <div className="relative group/item aspect-square overflow-hidden cursor-pointer bg-muted">
              <img 
                src={item} 
                alt={`${alt} ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <ImageToolbar 
                imageUrl={item}
                className="absolute top-2 right-2 opacity-0 group-hover/item:opacity-100 transition-opacity duration-300" 
              />
            </div>
          </PhotoView>
        ))}
      </div>
    </PhotoProvider>
  );
};

export const ImageToolbar = ({ 
  className,
  imageUrl,
}: { 
  className?: string;
  imageUrl: string;
}) => {
  const t = useTranslations('toolbar');
  const canvasApi = useAtomValue(canvasApiAtom);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发 PhotoView 的点击事件
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = imageUrl.split('/').pop() || 'image';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleInsertIntoCanvas = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canvasApi) {
      const image = new Image();
      image.src = imageUrl;
      image.onload = () => {
        const width = image.width;
        const height = image.height;
        insertImage(canvasApi, { image: imageUrl, width, height });
      };
      image.onerror = () => {
        console.error('Failed to load image');
      };
    }
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline" 
              size="icon"
              className="h-6 w-6"
              onClick={handleInsertIntoCanvas}
            >
              <ArrowLeft className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t('insertIntoCanvas')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline" 
              size="icon"
              className="h-6 w-6"
              onClick={handleDownload}
            >
              <Download className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t('download')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};