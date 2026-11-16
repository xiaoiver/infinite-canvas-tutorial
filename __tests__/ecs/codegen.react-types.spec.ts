import * as ts from 'typescript';
import { emitReactTailwind } from '../../packages/ecs/src/utils/codegen/emit-react-tailwind';
import type {
  CodeIR,
  CodeNode,
} from '../../packages/ecs/src/utils/codegen/types';

describe('React codegen types', () => {
  it('imports CSSProperties for a visibility-only component and emits valid TSX', () => {
    const node = (extra: Partial<CodeNode> = {}): CodeNode => ({
      id: 'node',
      role: 'container',
      style: {},
      children: [],
      ...extra,
    });
    const ir: CodeIR = {
      variables: {},
      variablesMode: 'resolved',
      components: [
        {
          name: 'Card',
          templateId: 'card',
          root: node({
            bindings: [{ target: 'visibility', prop: 'visibility' }],
          }),
          props: [
            {
              name: 'visibility',
              target: 'visibility',
              defaultValue: { literal: 'visible' },
            },
          ],
        },
      ],
      roots: [node({ instanceOf: 'Card' })],
    };
    const code = emitReactTailwind(ir);

    // A minimal React/JSX contract keeps compilation independent of workspace
    // React versions and prevents ambient test types from hiding missing imports.
    const sources: Record<string, string> = {
      'Design.tsx': code,
      'react.d.ts': `
        declare module 'react' {
          export interface CSSProperties {
            visibility?: 'visible' | 'hidden' | 'collapse' | 'inherit';
          }
        }
        declare namespace JSX {
          interface IntrinsicElements {
            div: { style?: import('react').CSSProperties };
          }
        }
      `,
    };
    const options: ts.CompilerOptions = {
      jsx: ts.JsxEmit.Preserve,
      target: ts.ScriptTarget.ESNext,
      strict: true,
      noEmit: true,
      types: [],
    };
    const host = ts.createCompilerHost(options);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (fileName, languageVersion, ...args) =>
      sources[fileName] !== undefined
        ? ts.createSourceFile(fileName, sources[fileName], languageVersion)
        : getSourceFile(fileName, languageVersion, ...args);
    const program = ts.createProgram(Object.keys(sources), options, host);
    expect(
      ts
        .getPreEmitDiagnostics(program)
        .map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
        ),
    ).toEqual([]);
    expect(code).toContain("import type { CSSProperties } from 'react';");
    expect(code).toContain("visibility?: CSSProperties['visibility'];");
  });
});
