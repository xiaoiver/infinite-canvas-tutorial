import { v4 as uuidv4 } from 'uuid';
import { MermaidConfig } from 'mermaid';
import { convertParsedMermaidDataToSerializedNodes } from './converter';
import { parseMermaid } from './parseMermaid';
import { Flowchart } from '@excalidraw/mermaid-to-excalidraw/dist/parser/flowchart';
import { Sequence } from '@excalidraw/mermaid-to-excalidraw/dist/parser/sequence';
import { State } from '@excalidraw/mermaid-to-excalidraw/dist/parser/state';
import { ERD } from '@excalidraw/mermaid-to-excalidraw/dist/parser/er';
import { Class } from '@excalidraw/mermaid-to-excalidraw/dist/parser/class';
import type { MindmapParsed } from './mindmapFromSvg';
import { LineSerializedNode, PathSerializedNode, SerializedNode } from '@infinite-canvas-tutorial/ecs';
import { PolylineSerializedNode } from '@infinite-canvas-tutorial/ecs';

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
  const serializedNodes = convertParsedMermaidDataToSerializedNodes(
    parsedMermaidData as Flowchart | Sequence | State | ERD | Class | MindmapParsed,
    {
      fontSize,
    },
  );

  return remapMermaidPasteNodeIds(serializedNodes);
}


function remapMermaidPasteNodeIds(nodes: SerializedNode[]): SerializedNode[] {
  const cloned = structuredClone(nodes) as SerializedNode[];
  const idMap = new Map<string, string>();
  for (const n of cloned) {
    idMap.set(n.id, uuidv4());
  }
  for (const n of cloned) {
    n.id = idMap.get(n.id)!;
    if (n.parentId) {
      n.parentId = idMap.get(n.parentId) ?? n.parentId;
    }
    if (n.type === 'polyline' || n.type === 'line' || n.type === 'path') {
      const edge = n as PolylineSerializedNode | LineSerializedNode | PathSerializedNode;
      if (edge.fromId) {
        edge.fromId = idMap.get(edge.fromId) ?? edge.fromId;
      }
      if (edge.toId) {
        edge.toId = idMap.get(edge.toId) ?? edge.toId;
      }
    }
  }
  return cloned;
}