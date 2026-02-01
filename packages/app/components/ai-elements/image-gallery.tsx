"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Download, X, ZoomIn } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';

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
  imageUrl 
}: { 
  className?: string;
  imageUrl: string;
}) => {
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

  return (
    <div className={cn("flex gap-2", className)}>
      <Button 
        variant="outline" 
        size="icon"
        className="h-6 w-6"
        onClick={handleDownload}
      >
        <Download className="size-3" />
      </Button>
    </div>
  );
};