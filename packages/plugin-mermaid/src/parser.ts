import { MermaidConfig } from 'mermaid';
import { convertParsedMermaidDataToSerializedNodes } from './converter';
import { parseMermaid } from '@excalidraw/mermaid-to-excalidraw/dist/parseMermaid';
import { Flowchart } from '@excalidraw/mermaid-to-excalidraw/dist/parser/flowchart';
import { Sequence } from '@excalidraw/mermaid-to-excalidraw/dist/parser/sequence';
/**
 * @see https://github.com/excalidraw/mermaid-to-excalidraw/blob/master/src/constants.ts#L9
 */
export const DEFAULT_FONT_SIZE = 20;

/**
 * @see https://docs.excalidraw.com/docs/@excalidraw/mermaid-to-excalidraw/codebase/parser/
 */

export async function parseMermaidToSerializedNodes(
  definition: string,
  config?: MermaidConfig
) {
  const mermaidConfig = config || {};
  const fontSize =
    parseInt(mermaidConfig.themeVariables?.fontSize ?? "") || DEFAULT_FONT_SIZE;

  const parsedMermaidData = await parseMermaid(definition, {
    ...mermaidConfig,
    themeVariables: {
      ...mermaidConfig.themeVariables,
      // Multiplying by 1.25 to increase the font size by 25% and render correctly in Excalidraw
      fontSize: `${fontSize * 1.25}px`,
    },
  });

  // Only font size supported for excalidraw elements
  const serializedNodes = convertParsedMermaidDataToSerializedNodes(parsedMermaidData as Flowchart | Sequence, {
    fontSize,
  });
  return serializedNodes;
}