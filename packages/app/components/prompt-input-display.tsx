import {
  Attachment,
  AttachmentHoverCard,
  AttachmentHoverCardTrigger,
  AttachmentHoverCardContent,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
  getAttachmentLabel,
  getMediaCategory,
} from "@/components/ai-elements/attachments";
import { canvasApiAtom, selectedNodesAtom } from "@/atoms/canvas-selection";
import { useAtomValue } from "jotai";
import { isDataUrl, isUrl, SerializedNode } from "@infinite-canvas-tutorial/ecs";
import { useEffect, useRef } from "react";
import { usePromptInputController } from "./ai-elements/prompt-input";
import { DataUIPart, FileUIPart } from "ai";
import { ExtendedAPI } from "@infinite-canvas-tutorial/webcomponents";

const PromptInputAttachmentsDisplay = () => {
  const canvasApi = useAtomValue(canvasApiAtom);
  const selectedNodes = useAtomValue(selectedNodesAtom);
  const controller = usePromptInputController();
  const lastProcessedNodesRef = useRef<string>('');

  useEffect(() => {
    if (!selectedNodes || !canvasApi || selectedNodes.length === 0) {
      // Clear attachments when no nodes are selected
      if (controller.attachments.files.length > 0) {
        controller.attachments.clear();
      }
      lastProcessedNodesRef.current = '';
      return;
    }

    // Create a stable key from selected nodes to detect changes
    const currentNodeIds = selectedNodes.map(node => node.id).sort().join(',');
    
    // Skip if we've already processed these exact nodes
    if (currentNodeIds === lastProcessedNodesRef.current) {
      return;
    }

    lastProcessedNodesRef.current = currentNodeIds;

    try {
      controller.attachments.clear();
      const files = selectedNodes.map(node => convertToFiles(canvasApi, node)).flat();
      if (files.length > 0) {
        files.filter(Boolean).forEach(file => {
          // @ts-expect-error id is not typed correctly
          if (!controller.attachments.files.find(f => f.id === file.id)) {
            controller.attachments.add([file]);
          }
        });
      }
    } catch (error) {
      console.error('Failed to convert base64 to File:', error);
    }
  }, [canvasApi, selectedNodes, controller]);

  if (controller.attachments.files.length === 0) {
    return null;
  }

  const handleRemoveAttachment = (id: string) => {
    controller.attachments.remove(id);

    // Deselect from canvas
    if (canvasApi) {
      canvasApi.deselectNodes([canvasApi.getNodeById(id)]);
    }
  };

  return (
    <Attachments variant="inline">
      {controller.attachments.files.map((attachment) => {
        const mediaCategory = getMediaCategory(attachment);
        const label = getAttachmentLabel(attachment);
        const imageUrl = attachment.type === "file" ? attachment.url : attachment.type === "data-mask" ? attachment.data : undefined;
        const mediaType = attachment.type === "file" ? attachment.mediaType : attachment.type === "data-mask" ? 'image/png' : undefined;
        return <AttachmentHoverCard key={attachment.id}>
          <AttachmentHoverCardTrigger asChild>
            <Attachment
              data={attachment}
              onRemove={() => handleRemoveAttachment(attachment.id)}
              className="max-w-30"
            >
              <div className="relative size-5 shrink-0">
                <div className="absolute inset-0 transition-opacity group-hover:opacity-0">
                  <AttachmentPreview />
                </div>
                <AttachmentRemove className="absolute inset-0" />
              </div>
              <AttachmentInfo />
            </Attachment>
          </AttachmentHoverCardTrigger>
          <AttachmentHoverCardContent>
            <div className="space-y-3">
              {mediaCategory === "image" &&
                imageUrl && (
                  <div className="flex max-h-96 w-80 items-center justify-center overflow-hidden rounded-md border">
                    <img
                      alt={label}
                      className="max-h-full max-w-full object-contain"
                      height={384}
                      src={imageUrl}
                      width={320}
                    />
                  </div>
                )}
              <div className="space-y-1 px-0.5">
                <h4 className="font-semibold text-sm leading-none truncate max-w-[300px]">
                  {label}
                </h4>
                {mediaType && (
                  <p className="font-mono text-muted-foreground text-xs">
                    {mediaType}
                  </p>
                )}
              </div>
            </div>
          </AttachmentHoverCardContent>
        </AttachmentHoverCard>
      })}
    </Attachments>
  );
};

export default PromptInputAttachmentsDisplay;

function convertToFiles(api: ExtendedAPI, node: SerializedNode, files: (FileUIPart | DataUIPart<{ mask: string }> | File)[] = [], parent?: SerializedNode): (FileUIPart | DataUIPart<{ mask: string }> | File)[] {
  if ((node as any).usage === 'mask') {
    const relativeTo = { x: node.x as number, y: node.y as number, width: node.width as number, height: node.height as number };
    if (node.parentId) {
      if (!parent) {
        parent = api.getNodeById(node.parentId);
      }
      relativeTo.x = parent.x as number;
      relativeTo.y = parent.y as number;
      relativeTo.width = parent.width as number;
      relativeTo.height = parent.height as number;
    }
    const mask = api.createMask([node], relativeTo);
    let maskUrl = 'shape';
    if (mask) {
      maskUrl = (mask as HTMLCanvasElement).toDataURL();
    }

    files.push({
      id: node.id,
      type: 'data-mask' as const,
      data: maskUrl,
    } as DataUIPart<{ mask: string }>);
  } else {
    // Image
    const base64OrURL = (node as any).fill as string;
    if (isDataUrl(base64OrURL) || isUrl(base64OrURL)) {
      if (isDataUrl(base64OrURL)) {
        // 将 base64 字符串转换为 Blob
        const base64Data = base64OrURL.includes(',') 
          ? base64OrURL.split(',')[1] 
          : base64OrURL;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        
        // 从 data URL 中提取 MIME 类型，默认为 image/png
        const mimeType = base64OrURL.match(/data:([^;]+);/)?.[1] || 'image/png';
        const blob = new Blob([byteArray], { type: mimeType });
        
        // 从 Blob 创建 File 对象，使用 node.id 作为文件名
        files.push(new File([blob], node.id, { type: mimeType }));
      } else if (isUrl(base64OrURL)) {
        // fetch HEAD to get the MIME type
        // const response = await fetch(base64OrURL, { method: 'HEAD' });
        // const mediaType = response.headers.get('content-type') || 'image/png';
        const filename = base64OrURL.split('/').pop()?.split('?')[0] || node.id;
        const suffix = base64OrURL.split('/').pop()?.split('?')[0]?.split('.').pop();
        let mediaType = 'image/png';
        if (suffix === 'jpg' || suffix === 'jpeg') {
          mediaType = 'image/jpeg';
        } else if (suffix === 'gif') {
          mediaType = 'image/gif';
        } else if (suffix === 'webp') {
          mediaType = 'image/webp';
        }
        files.push({
          id: node.id,
          type: 'file' as const,
          url: base64OrURL,
          mediaType,
          filename,
        } as FileUIPart);
      }
    } else {
      // TODO: use api.export
      files.push({
        id: node.id,
        type: 'file' as const,
        url: 'shape',
        mediaType: 'application/octet-stream',
        filename: node.id,
      } as FileUIPart);
    }
  }

  api.getChildren(node).forEach(child => convertToFiles(api, api.getNodeByEntity(child), files, node));

  return files;
}