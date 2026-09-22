import hierarchy from '@antv/hierarchy';
import type {
  MindmapEdgeItem,
  MindmapNodeItem,
  MindmapParsed,
} from './mindmapFromSvg';

const mindmap = hierarchy.mindmap as (
  root: MindmapTreeData,
  options: MindmapLayoutOptions,
) => HierarchyRoot;

/** @antv/hierarchy mindmap 根节点（execute 返回值） */
interface HierarchyRoot {
  eachNode(cb: (node: HierarchyNode) => void): void;
}

interface HierarchyNode {
  x: number;
  y: number;
  width: number;
  height: number;
  hgap: number;
  vgap: number;
  data: MindmapTreeData;
}

interface MindmapTreeData {
  id: string;
  label: string;
  isRoot?: boolean;
  children: MindmapTreeData[];
}

interface MindmapLayoutOptions {
  direction: 'H' | 'V' | 'LR' | 'RL' | 'TB' | 'BT';
  getHeight: (d: MindmapTreeData) => number;
  getWidth: (d: MindmapTreeData) => number;
  getVGap: () => number;
  getHGap: () => number;
  getSubTreeSep: (d: MindmapTreeData) => number;
}

function measureLabelWidth(text: string, fontSize: number): number {
  if (typeof document === 'undefined') {
    return Math.max(32, (text || ' ').length * fontSize * 0.55);
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return Math.max(32, (text || ' ').length * fontSize * 0.55);
  }
  ctx.font = `${fontSize}px sans-serif`;
  return ctx.measureText(text || ' ').width;
}

function findRootId(
  nodeIds: Set<string>,
  edges: MindmapEdgeItem[],
): string | null {
  const toIds = new Set(edges.map((e) => e.toId));
  const roots = [...nodeIds].filter((id) => !toIds.has(id));
  if (roots.length === 1) {
    return roots[0];
  }
  if (roots.length === 0) {
    return [...nodeIds][0] ?? null;
  }
  return roots.sort()[0];
}

function buildTreeData(
  nodes: MindmapNodeItem[],
  edges: MindmapEdgeItem[],
): MindmapTreeData | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const rootId = findRootId(nodeIds, edges);
  if (rootId == null || !byId.has(rootId)) {
    return null;
  }

  const childrenMap = new Map<string, string[]>();
  for (const e of edges) {
    if (!nodeIds.has(e.fromId) || !nodeIds.has(e.toId)) {
      continue;
    }
    if (!childrenMap.has(e.fromId)) {
      childrenMap.set(e.fromId, []);
    }
    childrenMap.get(e.fromId)!.push(e.toId);
  }
  for (const [, arr] of childrenMap) {
    const seen = new Set<string>();
    const deduped = arr.filter((id) => {
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
    arr.length = 0;
    arr.push(...deduped);
  }

  const build = (id: string, ancestors: Set<string>): MindmapTreeData | null => {
    if (ancestors.has(id)) {
      return null;
    }
    const n = byId.get(id);
    if (!n) {
      return null;
    }
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(id);
    const childIds = childrenMap.get(id) ?? [];
    const children = childIds
      .map((cid) => build(cid, nextAncestors))
      .filter((c): c is MindmapTreeData => c != null);
    return {
      id,
      label: n.label || id,
      isRoot: id === rootId,
      children,
    };
  };

  return build(rootId, new Set());
}

function normalizeToPositiveOrigin(nodes: MindmapNodeItem[]): MindmapNodeItem[] {
  if (nodes.length === 0) {
    return nodes;
  }
  const margin = 24;
  let minX = Infinity;
  let minY = Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return nodes;
  }
  const dx = minX < margin ? margin - minX : 0;
  const dy = minY < margin ? margin - minY : 0;
  if (dx === 0 && dy === 0) {
    return nodes;
  }
  return nodes.map((n) => ({
    ...n,
    x: n.x + dx,
    y: n.y + dy,
  }));
}

/**
 * 使用 @antv/hierarchy 的 mindmap 布局（与 site/docs/components/Mindmap.vue 一致的方向与测量思路），
 * 覆盖 Mermaid SVG 中的 bbox 位置与尺寸。
 */
export function applyAntvMindmapLayout(
  chart: MindmapParsed,
  options: { fontSize: number },
): MindmapParsed {
  const { fontSize } = options;
  const tree = buildTreeData(chart.nodes, chart.edges);
  if (!tree || chart.nodes.length === 0) {
    return chart;
  }

  const rootLayout = mindmap(tree, {
    direction: 'H',
    getHeight(d: MindmapTreeData) {
      const lineCount = d.label.split('\n').length;
      if (d.isRoot) {
        return Math.max(48, fontSize * 2.2 * lineCount);
      }
      return Math.max(30, fontSize * 1.55 * lineCount);
    },
    getWidth(d: MindmapTreeData) {
      const label = d.label || d.id;
      const padding = d.isRoot ? 40 : 28;
      const fs = d.isRoot ? fontSize * 1.15 : fontSize;
      return measureLabelWidth(label, fs) + padding;
    },
    getVGap: () => 6,
    getHGap: () => 40,
    getSubTreeSep(d: MindmapTreeData) {
      if (!d.children?.length) {
        return 0;
      }
      return 10;
    },
  });

  const idToBox = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();

  rootLayout.eachNode((node: HierarchyNode) => {
    const id = String(node.data?.id ?? '');
    if (!id) {
      return;
    }
    const x = Math.round(node.x + node.hgap);
    const y = Math.round(node.y + node.vgap);
    const width = Math.round(node.width - node.hgap * 2);
    const height = Math.round(node.height - node.vgap * 2);
    idToBox.set(id, { x, y, width, height });
  });

  let nextNodes = chart.nodes.map((n) => {
    const box = idToBox.get(n.id);
    if (!box) {
      return n;
    }
    return {
      ...n,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    };
  });

  nextNodes = normalizeToPositiveOrigin(nextNodes);

  return { ...chart, nodes: nextNodes };
}
