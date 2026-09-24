/**
 * Mermaid namespaces SVG IDs by render ID. The upstream graph parsers still
 * query some of the original database IDs. Adapt queries on this private
 * container only; keep the SVG IDs and all their references intact.
 */
export function useScopedSvgSelectors(
  container: HTMLElement,
  renderId: string,
) {
  const prefix = `${renderId}-`;
  const ids = new Map<string, string>();
  for (const element of Array.from(container.querySelectorAll('[id]'))) {
    if (element.id.startsWith(prefix)) {
      const localId = element.id.slice(prefix.length);
      ids.set(localId, element.id);
      // Class counters can differ between getDiagramFromText() and render().
      // Expose the logical ID through the parser's existing data-id fallback.
      const classId = /^classId-(.*)-\d+$/.exec(localId)?.[1];
      if (classId && !element.hasAttribute('data-id')) {
        element.setAttribute('data-id', classId);
      }
    }
  }

  const scopeSelector = (selector: string) =>
    selector.replace(
      /\[id(\^?=)(['"])(.*?)\2\]|#([\w-]+)/g,
      (match, operator: string, quote: string, id: string, hashId: string) => {
        if (hashId) {
          const scoped = ids.get(hashId);
          return scoped ? `#${CSS.escape(scoped)}` : match;
        }
        const scoped =
          operator === '^='
            ? [...ids.keys()].some((key) => key.startsWith(id)) &&
              `${prefix}${id}`
            : ids.get(id);
        return scoped ? `[id${operator}${quote}${scoped}${quote}]` : match;
      },
    );

  const querySelector = container.querySelector.bind(container);
  const querySelectorAll = container.querySelectorAll.bind(container);
  container.querySelector = ((selector: string) =>
    querySelector(scopeSelector(selector))) as typeof container.querySelector;
  container.querySelectorAll = ((selector: string) =>
    querySelectorAll(
      scopeSelector(selector),
    )) as typeof container.querySelectorAll;
}
