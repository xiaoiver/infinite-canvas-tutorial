import { test, expect } from '@playwright/test';
import type {} from './fixtures/mermaid';

const diagrams = [
  {
    name: 'flowchart',
    definition: 'flowchart LR\nStart --> Finish',
    labels: ['Start', 'Finish'],
  },
  {
    name: 'sequence',
    definition: 'sequenceDiagram\nAlice->>Bob: Hello',
    labels: ['Alice', 'Bob', 'Hello'],
  },
  {
    name: 'state',
    definition:
      'stateDiagram-v2\n[*] --> Idle\nIdle --> Running\nRunning --> [*]',
    labels: ['Idle', 'Running'],
  },
  {
    name: 'ER',
    definition: 'erDiagram\nCUSTOMER ||--o{ ORDER : places',
    labels: ['CUSTOMER', 'ORDER'],
  },
  {
    name: 'class',
    definition: 'classDiagram\nVehicle <|-- Car\nVehicle : +drive()',
    labels: ['Vehicle', 'Car'],
  },
  {
    name: 'mindmap',
    definition: 'mindmap\n  root((Plan))\n    Build\n    Verify',
    labels: ['Plan', 'Build', 'Verify'],
  },
];

for (const { name, definition, labels } of diagrams) {
  test(`${name} converts to editable nodes with scoped SVG IDs`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('/mermaid.html');
    await expect(page.locator('#status')).toHaveText('Ready');
    const nodes = await page.evaluate(
      (source) => window.parseMermaidForTest(source),
      definition,
    );
    expect(errors).toEqual([]);
    expect(nodes.length).toBeGreaterThan(labels.length);
    for (const label of labels) {
      expect(
        nodes.some(
          (node) => node.type === 'text' && node.content.includes(label),
        ),
      ).toBe(true);
    }
    expect(
      nodes.some((node) => ['line', 'polyline', 'path'].includes(node.type)),
    ).toBe(true);
    await expect(page.locator('[id^="mermaid-to-excalidraw-"]')).toHaveCount(0);
  });
}

test('concurrent conversions retain isolated SVG IDs and unique canvas IDs', async ({
  page,
}) => {
  await page.goto('/mermaid.html');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(async () => {
    const svgIds: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of Array.from(record.removedNodes)) {
          if (!(node instanceof HTMLElement) || !node.id.endsWith('-container'))
            continue;
          for (const element of Array.from(
            node.querySelectorAll('g.node[id]'),
          )) {
            svgIds.push(element.id);
          }
        }
      }
    });
    observer.observe(document.body, { childList: true });
    const nodes = await Promise.all([
      window.parseMermaidForTest('classDiagram\nVehicle <|-- Car'),
      window.parseMermaidForTest('classDiagram\nVehicle <|-- Car'),
    ]);
    await Promise.resolve();
    observer.disconnect();
    return { svgIds, nodeIds: nodes.flat().map((node) => node.id) };
  });
  expect(result.svgIds.length).toBeGreaterThanOrEqual(4);
  expect(
    result.svgIds.every((id) => /^mermaid-to-excalidraw-\d+-/.test(id)),
  ).toBe(true);
  expect(new Set(result.svgIds).size).toBe(result.svgIds.length);
  expect(new Set(result.nodeIds).size).toBe(result.nodeIds.length);
  await expect(page.locator('[id^="mermaid-to-excalidraw-"]')).toHaveCount(0);
});
