import { ImageGallery } from "@/components/ai-elements/image-gallery"
import { InferUITool } from "ai";
import { vectorizeImageTool } from "../../tools/vectorize-image";

export type VectorizeImageUITool = InferUITool<typeof vectorizeImageTool>;

export const VectorizeImageOutput = (
  {
    output,
  }: {
    output: VectorizeImageUITool['output']
  }
) => {
  const images = 'value' in output && output.value
    ? output.value.map((item) => item.url)
    : [];

  return <div className="p-2 flex flex-col gap-2">
    <ImageGallery
      images={images}
      alt={'Vectorized Image'}
    />
  </div>;
}