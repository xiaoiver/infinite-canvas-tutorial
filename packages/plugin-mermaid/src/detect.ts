/**
 * Heuristic: first non-empty, non-%% line looks like a Mermaid diagram declaration.
 * @see packages/webcomponents/src/spectrum/mermaid-paste.ts — keep logic in sync for paste detection.
 */
export function isLikelyMermaidSyntax(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('<')) {
    return false;
  }

  for (const raw of trimmed.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('%%')) {
      continue;
    }

    return (
      /^(flowchart|graph)\s+/i.test(line) ||
      /^sequenceDiagram\b/i.test(line) ||
      /^stateDiagram(-v2)?\b/i.test(line) ||
      /^classDiagram\b/i.test(line) ||
      /^erDiagram\b/i.test(line) ||
      /^gantt\b/i.test(line) ||
      /^pie\b/i.test(line) ||
      /^journey\b/i.test(line) ||
      /^gitgraph\b/i.test(line) ||
      /^mindmap\b/i.test(line) ||
      /^timeline\b/i.test(line) ||
      /^block(-beta)?\b/i.test(line)
    );
  }

  return false;
}
