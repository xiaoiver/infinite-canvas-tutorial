import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';
import { emitReactTailwind } from '../../packages/ecs/src/utils/codegen/emit-react-tailwind';
import type {
  CodeIR,
  CodeNode,
} from '../../packages/ecs/src/utils/codegen/types';

const label: CodeNode = {
  id: 'label',
  role: 'text',
  style: {},
  children: [],
  text: { literal: 'Help' },
};
const variants: Array<{ name: string; node: Partial<CodeNode> }> = [
  { name: 'container link', node: { role: 'container' } },
  { name: 'text link', node: { role: 'text', text: { literal: 'Help' } } },
  {
    name: 'vector wrapper link',
    node: {
      role: 'shape',
      vectorPath: {
        d: 'M0 0L10 10',
        viewBoxX: 0,
        viewBoxY: 0,
        width: 10,
        height: 10,
        fillRule: 'nonzero',
      },
      children: [label],
    },
  },
  {
    name: 'image wrapper link',
    node: {
      role: 'image',
      image: { literal: '/photo.png' },
      children: [label],
    },
  },
];

describe.each(variants)('React codegen $name', ({ node }) => {
  it.each([
    '/help?q="x"',
    "/help?q='x'",
    '/help?topic=pay&lang=en',
    '/help?q=&quot;&amp;&#34;',
    '/help?q={value}\\path\nnext',
    '',
  ])('preserves href %j in valid TSX', (href) => {
    const ir: CodeIR = {
      variables: {},
      variablesMode: 'resolved',
      components: [],
      roots: [
        {
          id: 'link',
          role: 'container',
          style: {},
          children: [],
          ...node,
          element: { tag: 'a', href },
        },
      ],
    };
    const result = ts.transpileModule(emitReactTailwind(ir), {
      fileName: 'Design.tsx',
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        jsxFactory: 'jsx',
      },
    });
    expect(
      result.diagnostics?.map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      ),
    ).toEqual([]);

    // Capture JSX props to verify the runtime URL without a React dependency.
    const exports = {} as { Design: () => { href: string } };
    runInNewContext(result.outputText, {
      exports,
      jsx: (_tag: string, props: unknown) => props,
    });
    expect(exports.Design().href).toBe(href);
  });
});
