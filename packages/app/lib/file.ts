import { isDataUrl, isUrl, SerializedNode } from "@infinite-canvas-tutorial/ecs";
import { DataUIPart, FilePart, FileUIPart, ModelMessage } from "ai";
import { ExtendedAPI } from "@infinite-canvas-tutorial/webcomponents";

export type MaskPart = DataUIPart<{ mask: string }>;
export type ShapePart = DataUIPart<{ shape: string }>;

export function convertToFiles(api: ExtendedAPI, node: SerializedNode, files: (FileUIPart | MaskPart | ShapePart | File)[] = [], parent?: SerializedNode): (FileUIPart | MaskPart | ShapePart | File)[] {
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
    });
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
        // @see https://ai-sdk.dev/docs/reference/ai-sdk-core/model-message#imagepart
        files.push({
          id: node.id,
          type: 'file',
          url: base64OrURL,
          mediaType,
          filename,
        } as unknown as FileUIPart);
      }
    } else {
      const canvas = api.renderToCanvas(node, { width: node.width as number, height: node.height as number });
      files.push({
        id: node.id,
        type: 'data-shape',
        data: canvas.toDataURL(),
      } as ShapePart);
    }
  }

  api.getChildren(node).forEach(child => convertToFiles(api, api.getNodeByEntity(child), files, node));

  return files;
}

export function getImagesFromLastMessage(messages: ModelMessage[]) {
  const lastMessage = messages[messages.length - 1];
  const imageDataURLs = (lastMessage.content as FilePart[]).filter((part) => part.type === 'file' && part.filename !== 'mask' && part.mediaType.startsWith('image/')).map((part) => part.data);
  return imageDataURLs;
}

export function getMaskFromLastMessage(messages: ModelMessage[]) {
  const lastMessage = messages[messages.length - 1];
  const maskDataURLs = (lastMessage.content as FilePart[]).filter((part) => part.filename === 'mask').map((part) => part.data);
  return maskDataURLs;
}