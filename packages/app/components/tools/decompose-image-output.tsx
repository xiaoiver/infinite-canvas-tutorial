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
  const images = 'value' in output && output.value
    ? output.value.map((item: { type: 'image-url'; url: string }) => item.url)
    : [];

  return <div className="p-2 flex flex-col gap-2">
    <ImageGallery
      images={images}
      alt={'Decomposed Image'}
    />
  </div>;
}