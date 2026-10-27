import { strToU8, zipSync } from 'fflate';
import { responsiveStarterCss } from './design-to-code-responsive';

/** Files for a standalone Vite project generated from the current IC scene. */
export function reactStarterFiles(
  source: string,
  componentName: string,
  sceneId: string,
): Record<string, string> {
  const dependencies: Record<string, string> = {
    react: '19.2.3',
    'react-dom': '19.2.3',
  };
  if (source.includes("from 'lucide-react'"))
    dependencies['lucide-react'] = '0.545.0';
  if (source.includes("from '@iconify/react'"))
    dependencies['@iconify/react'] = '^6.0.0';
  const usesInter = source.includes('font-[Inter');
  if (usesInter) dependencies['@fontsource/inter'] = '5.3.0';
  const packageJson = {
    name: `${sceneId}-react`,
    private: true,
    type: 'module',
    packageManager: 'pnpm@9.15.9',
    scripts: {
      dev: 'vite',
      build: 'tsc --noEmit && vite build',
      preview: 'vite preview',
    },
    dependencies,
    devDependencies: {
      '@tailwindcss/postcss': '4.1.18',
      '@types/react': '19.2.10',
      '@types/react-dom': '19.2.3',
      tailwindcss: '4.1.18',
      typescript: '5.8.3',
      vite: '6.4.4',
    },
  };
  return {
    'package.json': `${JSON.stringify(packageJson, null, 2)}\n`,
    'index.html': `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${sceneId}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`,
    'postcss.config.mjs': `export default { plugins: { '@tailwindcss/postcss': {} } };\n`,
    'tsconfig.json': `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          useDefineForClassFields: true,
          lib: ['ES2022', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'Bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
        },
        include: ['src'],
      },
      null,
      2,
    )}\n`,
    'src/index.css': '@import "tailwindcss";\n',
    'src/responsive.css': responsiveStarterCss(sceneId),
    'src/App.tsx': source,
    'src/main.tsx': `import { createRoot } from 'react-dom/client';\nimport { ${componentName} } from './App';\nimport './index.css';\nimport './responsive.css';\n${
      usesInter
        ? [400, 500, 600, 700, 800]
            .map((weight) => `import '@fontsource/inter/${weight}.css';`)
            .join('\n') + '\n'
        : ''
    }\nconst root = document.getElementById('root');\nif (!root) throw new Error('Missing React root');\ncreateRoot(root).render(<div className="ic-starter ic-starter--${sceneId}"><${componentName} /></div>);\n`,
    'README.md': `# ${componentName}\n\nGenerated from the current IC canvas.\n\nRun with Node.js 20 or newer:\n\n\`\`\`sh\ncorepack pnpm install\ncorepack pnpm dev\n\`\`\`\n\nThe exported component is in \`src/App.tsx\`.${
      usesInter
        ? ' Inter font files are bundled locally in the production build.'
        : ''
    } The sample's narrow-screen layout rules are in \`src/responsive.css\`. Connect buttons, navigation, data, and responsive layouts to your application as needed.\n`,
  };
}

export function reactStarterArchive(
  files: Record<string, string | Uint8Array>,
): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([name, content]) => [
        name,
        typeof content === 'string' ? strToU8(content) : content,
      ]),
    ),
    { level: 6 },
  );
}
