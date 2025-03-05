import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.resolve('./__tests__/e2e/fixtures'),
  server: { port: 8080, open: '/' },
  base: '/infinitecanvas/',
});