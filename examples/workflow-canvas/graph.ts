export type NodeKind =
  | 'prompt'
  | 'reference'
  | 'image'
  | 'motion'
  | 'grade'
  | 'output';
export interface WorkflowNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  pipeline: number;
}
export interface Edge {
  id: string;
  from: string;
  to: string;
}
export interface View {
  x: number;
  y: number;
  zoom: number;
}
export interface Graph {
  nodes: WorkflowNode[];
  edges: Edge[];
  width: number;
  height: number;
}
export const titles: Record<NodeKind, string> = {
  prompt: 'Creative direction',
  reference: 'Visual reference',
  image: 'Generate image',
  motion: 'Bring it to life',
  grade: 'Color & atmosphere',
  output: 'The final cut',
};
export const accents: Record<NodeKind, string> = {
  prompt: '#c7b2f4',
  reference: '#e0ba8b',
  image: '#bded8d',
  motion: '#a9caff',
  grade: '#f2b6cb',
  output: '#bded8d',
};
const layout: [NodeKind, number, number, number, number][] = [
  ['prompt', 0, 150, 252, 242],
  ['reference', 0, 474, 252, 266],
  ['image', 360, 224, 280, 350],
  ['motion', 748, 100, 280, 350],
  ['grade', 748, 548, 280, 264],
  ['output', 1140, 248, 294, 366],
];
const links = [
  [0, 2],
  [1, 2],
  [2, 3],
  [2, 4],
  [3, 5],
  [4, 5],
];
/** Deterministic repeated workflows make scale comparisons reproducible. */
export function makeGraph(count: number): Graph {
  const nodes: WorkflowNode[] = [];
  const edges: Edge[] = [];
  const pipelines = Math.ceil(count / layout.length);
  const columns = Math.ceil(Math.sqrt(pipelines));
  let width = 0;
  let height = 0;
  for (let p = 0; p < pipelines; p++) {
    const dx = (p % columns) * 1630;
    const dy = Math.floor(p / columns) * 980;
    layout.forEach(([kind, x, y, w, h], i) => {
      if (nodes.length >= count) return;
      nodes.push({
        id: `node-${p}-${i}`,
        kind,
        x: x + dx,
        y: y + dy,
        width: w,
        height: h,
        pipeline: p,
      });
      width = Math.max(width, x + dx + w);
      height = Math.max(height, y + dy + h);
    });
    links.forEach(([from, to], i) => {
      if (p * layout.length + to >= count) return;
      edges.push({
        id: `edge-${p}-${i}`,
        from: `node-${p}-${from}`,
        to: `node-${p}-${to}`,
      });
    });
  }
  return { nodes, edges, width, height };
}
export function visibleNodes(
  nodes: WorkflowNode[],
  view: View,
  width: number,
  height: number,
) {
  const right = view.x + width / view.zoom;
  const bottom = view.y + height / view.zoom;
  return nodes.filter(
    (n) =>
      n.x + n.width >= view.x &&
      n.y + n.height >= view.y &&
      n.x <= right &&
      n.y <= bottom,
  );
}
export function edgePath(from: WorkflowNode, to: WorkflowNode) {
  const x1 = from.x + from.width - 3;
  const y1 = from.y + 46;
  const x2 = to.x + 3;
  const y2 = to.y + 46;
  const bend = Math.max(70, Math.abs(x2 - x1) * 0.48);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`;
}
/** Keep the world point beneath an anchor fixed while zooming. */
export function zoomAt(view: View, zoom: number, x: number, y: number): View {
  const next = Math.min(2, Math.max(0.018, zoom));
  return {
    x: view.x + x / view.zoom - x / next,
    y: view.y + y / view.zoom - y / next,
    zoom: next,
  };
}
export function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  ];
}
