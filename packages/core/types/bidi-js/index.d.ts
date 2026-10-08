declare module 'bidi-js' {
  export type EmbeddingLevels = {
    levels: Uint8Array;
    paragraphs: { start: number; end: number; level: number }[];
  };

  const bidiFactory: () => {
    getBidiCharTypeName: (char: string) => string;
    getMirroredCharacter: (char: string) => string | null;
    getReorderedIndices: (
      text: string,
      embeddingLevels: EmbeddingLevels,
    ) => number[];
    getEmbeddingLevels: (
      text: string,
      explicitDirection?: 'ltr' | 'rtl',
    ) => EmbeddingLevels;

    getReorderSegments: (
      text: string,
      embeddingLevels: EmbeddingLevels,
    ) => [number, number][];
  };
  export default bidiFactory;
}
