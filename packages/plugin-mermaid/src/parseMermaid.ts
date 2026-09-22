/**
 * 基于 @excalidraw/mermaid-to-excalidraw 的 parseMermaid，增加 mindmap 分支；
 * 并在渲染后规范化 SVG 尺寸、强制一帧布局，便于类图/思维导图等依赖 getBBox / getBoundingClientRect 的解析。
 *
 * 同步自 @excalidraw/mermaid-to-excalidraw@2.2.2 dist/parseMermaid.js
 */
import mermaid from 'mermaid';
import type { MermaidConfig } from 'mermaid';
import { MERMAID_CONFIG } from '@excalidraw/mermaid-to-excalidraw/dist/constants';
import { encodeEntities } from '@excalidraw/mermaid-to-excalidraw/dist/utils';
import { parseMermaidFlowChartDiagram } from '@excalidraw/mermaid-to-excalidraw/dist/parser/flowchart';
import { parseMermaidSequenceDiagram } from '@excalidraw/mermaid-to-excalidraw/dist/parser/sequence';
import { parseMermaidClassDiagram } from '@excalidraw/mermaid-to-excalidraw/dist/parser/class';
import { parseMermaidERDiagram } from '@excalidraw/mermaid-to-excalidraw/dist/parser/er';
import { parseMermaidStateDiagram } from '@excalidraw/mermaid-to-excalidraw/dist/parser/state';
import { runMermaidTaskSequentially } from '@excalidraw/mermaid-to-excalidraw/dist/mermaidExecutionQueue';
import { parseMindmapFromSvg, type MindmapDbLike } from './mindmapFromSvg';

let lastConfigHash: string | null = null;
let renderCounter = 0;

const hashConfig = (config: Record<string, unknown>) => JSON.stringify(config);

async function prepareSvgForMeasurement(svgContainer: HTMLElement): Promise<void> {
  const svgEl = svgContainer.querySelector('svg');
  if (!svgEl) {
    return;
  }
  const rect = svgEl.getBoundingClientRect();
  let w = rect.width;
  let h = rect.height;
  if (!w || !h) {
    const vb = svgEl.viewBox?.baseVal;
    if (vb && vb.width > 0 && vb.height > 0) {
      w = vb.width;
      h = vb.height;
    }
  }
  if (!w || !h) {
    w = w || 800;
    h = h || 600;
  }
  svgEl.setAttribute('width', `${w}`);
  svgEl.setAttribute('height', `${h}`);
  void svgContainer.offsetHeight;
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

const convertSvgToGraphImage = (svgContainer: HTMLElement) => {
  const svgEl = svgContainer.querySelector('svg');
  if (!svgEl) {
    throw new Error('SVG element not found');
  }
  const r = svgEl.getBoundingClientRect();
  const width = r.width;
  const height = r.height;
  svgEl.setAttribute('width', `${width}`);
  svgEl.setAttribute('height', `${height}`);
  const mimeType = 'image/svg+xml';
  const decoded = unescape(encodeURIComponent(svgEl.outerHTML));
  const base64 = btoa(decoded);
  const dataURL = `data:image/svg+xml;base64,${base64}`;
  return {
    type: 'graphImage' as const,
    mimeType,
    dataURL,
    width,
    height,
  };
};

export const parseMermaid = async (
  definition: string,
  config: MermaidConfig = MERMAID_CONFIG,
) => {
  return runMermaidTaskSequentially(async () => {
    const resolvedFontSize =
      config.themeVariables?.fontSize ?? MERMAID_CONFIG.themeVariables.fontSize;
    const mergedConfig = {
      ...MERMAID_CONFIG,
      ...config,
      fontSize: resolvedFontSize,
      themeVariables: {
        ...MERMAID_CONFIG.themeVariables,
        ...config.themeVariables,
        fontSize: resolvedFontSize,
      },
    };
    const configHash = hashConfig(mergedConfig as Record<string, unknown>);
    if (configHash !== lastConfigHash) {
      mermaid.initialize(mergedConfig);
      lastConfigHash = configHash;
    }
    const diagram = await mermaid.mermaidAPI.getDiagramFromText(encodeEntities(definition));
    const renderId = `mermaid-to-excalidraw-${renderCounter++}`;
    const svgContainer = document.createElement('div');
    svgContainer.setAttribute(
      'style',
      `opacity: 0; position: fixed; z-index: -1; left: -99999px; top: -99999px;`,
    );
    const containerId = `${renderId}-container`;
    svgContainer.id = containerId;
    document.getElementById(containerId)?.remove();
    document.body.appendChild(svgContainer);
    try {
      const { svg } = await mermaid.render(renderId, definition, svgContainer);
      svgContainer.innerHTML = svg;
      await prepareSvgForMeasurement(svgContainer);
      let data: unknown;
      try {
        switch (diagram.type) {
          case 'flowchart-v2':
          case 'graph': {
            data = parseMermaidFlowChartDiagram(
              diagram.db as Parameters<typeof parseMermaidFlowChartDiagram>[0],
              svgContainer,
            );
            break;
          }
          case 'sequence': {
            data = parseMermaidSequenceDiagram(diagram, svgContainer);
            break;
          }
          case 'class':
          case 'classDiagram': {
            data = parseMermaidClassDiagram(diagram, svgContainer);
            break;
          }
          case 'er': {
            data = parseMermaidERDiagram(
              diagram.db as Parameters<typeof parseMermaidERDiagram>[0],
              svgContainer,
            );
            break;
          }
          case 'state':
          case 'stateDiagram': {
            data = parseMermaidStateDiagram(
              diagram.db as Parameters<typeof parseMermaidStateDiagram>[0],
              svgContainer,
            );
            break;
          }
          case 'mindmap': {
            data = parseMindmapFromSvg(
              svgContainer,
              diagram.db as MindmapDbLike,
            );
            break;
          }
          default: {
            data = convertSvgToGraphImage(svgContainer);
          }
        }
      } catch (error) {
        console.error('Error processing Mermaid diagram:', error);
        data = convertSvgToGraphImage(svgContainer);
      }
      return data;
    } finally {
      svgContainer.remove();
    }
  });
};
