import { entityCodesToText } from '@excalidraw/mermaid-to-excalidraw/dist/utils';

export interface MindmapParsed {
  type: 'mindmap';
  nodes: MindmapNodeItem[];
  edges: MindmapEdgeItem[];
}

export interface MindmapNodeItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  shape: 'rect' | 'ellipse';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

/** 仅保留拓扑：父节点 id → 子节点 id（与 Mermaid MindmapDB.generateEdges 中 start/end 一致） */
export interface MindmapEdgeItem {
  id: string;
  fromId: string;
  toId: string;
}

/** Mermaid mindmap 渲染后 db.getData() 中含节点与边（边 start/end 与 node.id 一致） */
export interface MindmapDbLike {
  getData(): {
    nodes?: Array<{
      id?: string | number;
      isGroup?: boolean;
      /** 与语法中节点文案一致；DOM 为 foreignObject 时优先用此项兜底 */
      label?: string | string[];
    }>;
    edges: Array<{ id?: string; start?: string; end?: string }>;
  };
}

function pickLayoutNodeLabel(n: {
  label?: string | string[] | undefined;
}): string {
  const l = n.label;
  if (l == null) {
    return '';
  }
  if (typeof l === 'string') {
    return l;
  }
  if (Array.isArray(l) && l.length > 0) {
    return String(l[0]);
  }
  return '';
}

/** Mermaid 在 htmlLabels 下用 foreignObject+xhtml:div，否则用 svg text */
function extractMindmapLabelFromGroup(g: SVGGElement): string {
  const labelG = g.querySelector('g.label');
  if (labelG) {
    const fo = labelG.querySelector('foreignObject');
    if (fo) {
      const div = fo.querySelector('div');
      const fromDiv =
        div?.innerText?.trim() ||
        div?.textContent?.trim() ||
        fo.textContent?.trim();
      if (fromDiv) {
        return fromDiv;
      }
    }
    const textEl = labelG.querySelector('text');
    if (textEl) {
      const tspans = textEl.querySelectorAll('tspan');
      const t = tspans.length
        ? Array.from(tspans)
            .map((el) => el.textContent?.trim() || '')
            .filter(Boolean)
            .join('\n')
        : textEl.textContent?.trim() || '';
      if (t) {
        return t;
      }
    }
    const plain = labelG.textContent?.trim();
    if (plain) {
      return plain;
    }
  }

  const anyFo = g.querySelector('foreignObject');
  if (anyFo) {
    const div = anyFo.querySelector('div');
    const t =
      div?.innerText?.trim() ||
      div?.textContent?.trim() ||
      anyFo.textContent?.trim();
    if (t) {
      return t;
    }
  }

  const textEl = g.querySelector('text');
  if (textEl) {
    const tspans = textEl.querySelectorAll('tspan');
    return tspans.length
      ? Array.from(tspans)
          .map((el) => el.textContent?.trim() || '')
          .filter(Boolean)
          .join('\n')
      : textEl.textContent?.trim() || '';
  }

  return '';
}

/** 外层 g 多为 id="node_0"（下划线）；内部 path 可能为 id="node-0"（连字符） */
function extractMindmapNodeIdFromGroup(g: SVGGElement): string | null {
  const selfId = g.id || g.getAttribute('id') || '';
  let m = selfId.match(/^node[-_](.+)$/);
  if (m) {
    return m[1];
  }
  const inner = g.querySelector(
    '[id^="node-"], [id^="node_"]',
  ) as SVGElement | null;
  if (inner?.id) {
    const innerM = inner.id.match(/^node[-_](.+)$/);
    if (innerM) {
      return innerM[1];
    }
  }
  return null;
}

/**
 * 节点几何仍来自渲染后的 SVG；边只取自 db（不解析 path 上的 points）。
 */
export function parseMindmapFromSvg(
  svgContainer: HTMLElement,
  mindmapDb: MindmapDbLike,
): MindmapParsed {
  const svg = svgContainer.querySelector('svg');
  if (!svg) {
    throw new Error('Mermaid mindmap: SVG not found');
  }
  const svgRect = svg.getBoundingClientRect();
  const nodes: MindmapNodeItem[] = [];
  const layout = mindmapDb.getData();
  const layoutNodes = (layout.nodes ?? []).filter((n) => !n.isGroup);

  const nodeRoot = svg.querySelector('g.nodes');
  if (nodeRoot) {
    const childGroups: SVGGElement[] = [];
    for (const child of Array.from(nodeRoot.children)) {
      if (child.tagName.toLowerCase() !== 'g') {
        continue;
      }
      const g = child as SVGGElement;
      const r = g.getBoundingClientRect();
      const w = r.width;
      const h = r.height;
      if (w < 0.5 || h < 0.5) {
        continue;
      }
      childGroups.push(g);
    }

    childGroups.forEach((g, index) => {
      const r = g.getBoundingClientRect();
      const x = r.left - svgRect.left;
      const y = r.top - svgRect.top;
      const w = r.width;
      const h = r.height;

      const fromDom = extractMindmapNodeIdFromGroup(g);
      const fromLayout =
        layoutNodes[index] != null && layoutNodes[index].id != null
          ? String(layoutNodes[index].id)
          : null;
      const id =
        fromDom ??
        fromLayout ??
        g.getAttribute('data-id') ??
        `mindmap-n-${nodes.length}`;

      let label = extractMindmapLabelFromGroup(g).trim();
      if (!label) {
        label = pickLayoutNodeLabel(layoutNodes[index] ?? {}).trim();
      }
      label = entityCodesToText(label);

      const circle = g.querySelector('circle');
      const shape: 'rect' | 'ellipse' = circle ? 'ellipse' : 'rect';

      const shapeEl = g.querySelector(
        'circle, path.node-bkg, path.basic, rect, polygon',
      ) as SVGElement | null;
      let fill: string | undefined;
      let stroke: string | undefined;
      let strokeWidth: number | undefined;
      if (shapeEl) {
        fill = shapeEl.getAttribute('fill') || undefined;
        stroke = shapeEl.getAttribute('stroke') || undefined;
        const sw = shapeEl.getAttribute('stroke-width');
        if (sw) {
          strokeWidth = parseFloat(sw);
        }
      }

      nodes.push({
        id,
        x,
        y,
        width: w,
        height: h,
        label,
        shape,
        fill,
        stroke,
        strokeWidth,
      });
    });
  }

  const edges: MindmapEdgeItem[] = (layout.edges ?? [])
    .map((edge) => {
      const fromId = edge.start != null ? String(edge.start) : '';
      const toId = edge.end != null ? String(edge.end) : '';
      return {
        id: edge.id ?? `edge-${fromId}-${toId}`,
        fromId,
        toId,
      };
    })
    .filter((e) => e.fromId.length > 0 && e.toId.length > 0);

  return { type: 'mindmap', nodes, edges };
}
