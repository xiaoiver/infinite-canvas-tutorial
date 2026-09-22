declare module 'heic2any' {
  export interface Heic2anyOptions {
    blob: Blob;
    toType?: 'image/jpeg' | 'image/png' | 'image/gif';
    quality?: number;
    multiple?: boolean;
    gifInterval?: number;
  }

  export default function heic2any(
    options: Heic2anyOptions,
  ): Promise<Blob | Blob[]>;
}
