import { ImageGallery } from "@/components/ai-elements/image-gallery"
import { InferUITool } from "ai";
import { generateImageTool } from "../../tools/generate-image";

export type GenerateImageUITool = InferUITool<typeof generateImageTool>;

export const GenerateImageOutput = (
  {
    output,
  }: {
    output: GenerateImageUITool['output']
  }
) => {
  const images = 'value' in output && output.value
    ? output.value.map((item: { type: 'image-url'; url: string }) => item.url)
    : [];

  return <div className="p-2 flex flex-col gap-2">
    <ImageGallery
      images={images}
      alt={'Generated Image'}
    />
  </div>;
}