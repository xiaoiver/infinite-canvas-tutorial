import { fal } from '@fal-ai/client';

// FIXME: Dangerous !!!
// use https://developers.cloudflare.com/workers/configuration/environment-variables/
fal.config({
  credentials:
    '5e973660-e3f7-492f-ae94-fb9c499252aa:143cc831830ba6cd4fe9fdb01a8564d0',
});

export async function createOrEditImage(
  isEdit: boolean,
  prompt: string,
  image_urls: string[],
): Promise<{ images: { url: string }[]; description: string }> {
  const result = await fal.subscribe(
    isEdit
      ? 'fal-ai/gemini-25-flash-image/edit'
      : 'fal-ai/gemini-25-flash-image',
    {
      input: {
        prompt,
        image_urls,
      },
    },
  );
  return result.data;
}
