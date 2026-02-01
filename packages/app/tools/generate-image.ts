import { put } from '@vercel/blob';
import { generateText, tool } from 'ai';
import z, { nanoid } from 'zod';

/**
 * When building a chatbot, you may want to allow the user to generate an image.
 * This can be done by creating a tool that generates an image using the generateImage function from the AI SDK.
 * @see https://ai-sdk.dev/cookbook/next/generate-image-with-chat-prompt
 * 
 * Image optimization:
 * @see https://vercel.com/docs/image-optimization
 */

export const generateImageTool = tool({
  description: 'Generate an image',
  inputSchema: z.object({
    prompt: z.string().describe('The prompt to generate the image from'),
  }),
  execute: async ({ prompt }) => {
    const result = await generateText({
      model: 'google/gemini-2.5-flash-image',
      prompt,
      providerOptions: {
        google: {
          quality: 'low'
        }
      }
    });

    const imageUrls: string[] = [];
    // Save generated images
    for (const file of result.files) {
      if (file.mediaType.startsWith('image/')) {
        const base64 = file.base64;

        // 1. 去掉 base64 前缀（例如 "data:image/png;base64,"）
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");

        // 2. 转换为 Buffer
        const fileBuffer = Buffer.from(base64Data, 'base64');

        // Upload with Vercel Blob
        const fileName = `${nanoid()}`;
        const blob = await put(fileName, fileBuffer, {
          access: 'public',
          addRandomSuffix: true,
        });

        imageUrls.push(blob.url);
      }
    }

    // in production, save this image to blob storage and return a URL
    return { images: imageUrls, prompt };
  },
});