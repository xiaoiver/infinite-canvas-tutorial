import { put } from "@vercel/blob";
import { GeneratedFile } from "ai";
import { nanoid } from 'nanoid';

export async function uploadImage(image: GeneratedFile) {
  const base64 = image.base64;
  // 1. 去掉 base64 前缀（例如 "data:image/png;base64,"）
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
  const suffix = image.mediaType.split('/')[1];

  // 2. 转换为 Buffer
  const fileBuffer = Buffer.from(base64Data, 'base64');

  // Upload with Vercel Blob
  const fileName = `${nanoid()}.${suffix}`;
  const blob = await put(fileName, fileBuffer, {
    access: 'public',
    addRandomSuffix: true,
  });
  return blob.url;
}