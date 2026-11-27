interface Page<T> {
  shapes: T[];
  destroyed: boolean;
}
interface Harness<T> {
  nodes(count: number): T[];
  frame(nodes: T[]): Page<T>[];
  isBatch(page: Page<T>): boolean;
  eligible(node: T): boolean;
  unsupported(node: T, value: boolean): void;
  dispose(): void;
}
/** Real planners and drawcall classes; GPU submission is the harness boundary. */
export function orderedBatchPagesContract<T>(
  name: string,
  setup: () => Harness<T>,
) {
  describe(name + ' page order and ownership', () => {
    it('compacts interleaved order edits rather than creating a page per old owner', () => {
      const h = setup();
      try {
        const nodes = h.nodes(512);
        h.frame(nodes);
        const interleaved = Array.from({ length: 256 }, (_, i) => [
          nodes[i],
          nodes[i + 256],
        ]).flat();
        const next = h.frame(interleaved);
        expect(next.map((p) => p.shapes.length)).toEqual([256, 256]);
        expect(next.flatMap((p) => p.shapes)).toEqual(interleaved);
      } finally {
        h.dispose();
      }
    });
    it('compacts sparse old pages instead of preserving one page per small fragment', () => {
      const h = setup();
      try {
        const nodes = h.nodes(768);
        h.frame(nodes);
        const visible = nodes.filter((_, i) => i % 8 === 0);
        const next = h.frame(visible);
        expect(next).toHaveLength(1);
        expect(next[0].shapes).toEqual(visible);
      } finally {
        h.dispose();
      }
    });
    it('rereads eligibility during membership changes, even inside a dense old page', () => {
      const h = setup();
      try {
        const nodes = h.nodes(512);
        h.frame(nodes);
        h.unsupported(nodes[140], true);
        const next = h.frame(nodes.slice(1));
        expect(h.eligible(nodes[140])).toBe(false);
        for (const page of next.filter((p) => h.isBatch(p)))
          expect(page.shapes.every((n) => h.eligible(n))).toBe(true);
        h.unsupported(nodes[140], false);
        const restored = h.frame(nodes);
        expect(restored.every((p) => h.isBatch(p))).toBe(true);
        expect(restored.flatMap((p) => p.shapes)).toEqual(nodes);
      } finally {
        h.dispose();
      }
    });
    it('retires empty pages and gives reentered members fresh live ownership', () => {
      const h = setup();
      try {
        const nodes = h.nodes(512),
          first = h.frame(nodes);
        expect(h.frame([])).toEqual([]);
        expect(first.every((p) => p.destroyed)).toBe(true);
        const next = h.frame(nodes.slice(0, 32));
        expect(next).toHaveLength(1);
        expect(first).not.toContain(next[0]);
        expect(next[0].destroyed).toBe(false);
        expect(next[0].shapes).toEqual(nodes.slice(0, 32));
      } finally {
        h.dispose();
      }
    });
  });
}
