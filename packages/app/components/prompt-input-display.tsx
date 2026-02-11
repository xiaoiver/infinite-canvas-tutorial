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
import { useEffect, useRef } from "react";
import { usePromptInputController } from "./ai-elements/prompt-input";
import { convertToFiles, MaskPart } from "@/lib/file";
import { FileUIPart } from "ai";


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
        const imageUrl = attachment.type === "file" ? (attachment as FileUIPart).url : attachment.type === "data-mask" ? (attachment as MaskPart).data : undefined;
        const mediaType = attachment.type === "file" ? (attachment as FileUIPart).mediaType : attachment.type === "data-mask" ? 'image/png' : undefined;
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

