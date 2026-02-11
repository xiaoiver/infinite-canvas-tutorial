import { ImageGallery } from "@/components/ai-elements/image-gallery"
import { InferUITool } from "ai";
import { decomposeImageTool } from "../../tools/decompose-image";

export type DecomposeImageUITool = InferUITool<typeof decomposeImageTool>;

export const DecomposeImageOutput = (
  {
    output,
  }: {
    output: DecomposeImageUITool['output']
  }
) => {

  const images = output?.value?.map((item: { type: string; url?: string }) => item.url!) || [];

  if (images.length === 0) {
    return null;
  }

  return <div className="p-2 flex flex-col gap-2">
    <ImageGallery
      images={images}
      alt={'Decomposed Image'}
    />
  </div>;
}