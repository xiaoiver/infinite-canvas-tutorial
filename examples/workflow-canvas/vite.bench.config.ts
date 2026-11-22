import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';
export default mergeConfig(base, defineConfig({
  cacheDir: '../../.test-results/workflow-vite',
  plugins:[{name:'workflow-benchmark-entry',transformIndexHtml(html){return html.replace('src="./main.ts"','src="./benchmark-entry.ts"');}}],
  server:{port:4181},
}));
