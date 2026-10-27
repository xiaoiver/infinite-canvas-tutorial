import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

let root: Root | undefined;

function renderGeneratedCode(source: string, css: string, component: string) {
  let stylesheet = document.querySelector<HTMLStyleElement>('#generated-css');
  if (!stylesheet) {
    stylesheet = document.createElement('style');
    stylesheet.id = 'generated-css';
    document.head.append(stylesheet);
  }
  stylesheet.textContent = css;
  const exported: Record<string, React.ComponentType> = {};
  const requireModule = (name: string) => {
    if (name === 'react') return React;
    if (name === 'react/jsx-runtime') return jsxRuntime;
    throw new Error(`Unexpected generated import: ${name}`);
  };
  new Function('require', 'exports', source)(requireModule, exported);
  const Component = exported[component];
  if (!Component) throw new Error(`Missing generated component: ${component}`);
  const host = document.querySelector('#root');
  if (!host) throw new Error('Missing React root');
  root?.unmount();
  root = createRoot(host);
  flushSync(() => root!.render(<Component />));
}

declare global {
  interface Window {
    renderGeneratedCode: typeof renderGeneratedCode;
  }
}

window.renderGeneratedCode = renderGeneratedCode;
