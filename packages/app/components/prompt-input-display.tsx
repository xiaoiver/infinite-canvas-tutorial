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
import { useEffect } from "react";
import { usePromptInputAttachments } from "./ai-elements/prompt-input";
import { FileUIPart } from "ai";
import { ExtendedAPI } from "@infinite-canvas-tutorial/webcomponents";

const PromptInputAttachmentsDisplay = () => {
  const canvasApi = useAtomValue(canvasApiAtom);
  const selectedNodes = useAtomValue(selectedNodesAtom);
  const attachments = usePromptInputAttachments();

  useEffect(() => {
    if (!selectedNodes || !canvasApi) {
      return;
    }

    (async () => {
      try {
        attachments.clear();
        const files = (await Promise.all(selectedNodes.map(node => convertToFiles(canvasApi, node)))).flat();
        if (files.length > 0) {
          attachments.add(files.filter(Boolean) as File[]);
        }
      } catch (error) {
        console.error('Failed to convert base64 to File:', error);
      }
    })();
  }, [canvasApi, selectedNodes]);

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => {
        const mediaCategory = getMediaCategory(attachment);
        const label = getAttachmentLabel(attachment);

        return <AttachmentHoverCard key={attachment.id}>
          <AttachmentHoverCardTrigger asChild>
            <Attachment
              data={attachment}
              onRemove={() => attachments.remove(attachment.id)}
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
                attachment.type === "file" &&
                attachment.url && (
                  <div className="flex max-h-96 w-80 items-center justify-center overflow-hidden rounded-md border">
                    <img
                      alt={label}
                      className="max-h-full max-w-full object-contain"
                      height={384}
                      src={attachment.url}
                      width={320}
                    />
                  </div>
                )}
              <div className="space-y-1 px-0.5">
                <h4 className="font-semibold text-sm leading-none truncate max-w-[300px]">
                  {label}
                </h4>
                {attachment.mediaType && (
                  <p className="font-mono text-muted-foreground text-xs">
                    {attachment.mediaType}
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

async function convertToFiles(api: ExtendedAPI, node: SerializedNode, files: (FileUIPart | File)[] = [], parent?: SerializedNode): Promise<(FileUIPart | File)[]> {
  if ((node as any).usage === 'mask') {
    const relativeTo = { x: node.x as number, y: node.y as number, width: node.width as number, height: node.height as number };
    if (node.parentId && parent) {
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
      type: 'file' as const,
      url: maskUrl,
      mediaType: maskUrl ? 'image/png' :'application/octet-stream',
      filename: `MASK-${node.id}.png`,
    } as FileUIPart);
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
        const response = await fetch(base64OrURL, { method: 'HEAD' });
        const mediaType = response.headers.get('content-type') || 'image/png';
        const filename = base64OrURL.split('/').pop()?.split('?')[0] || node.id;
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