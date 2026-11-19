import { defineConfig } from '@playwright/test';
import base from './playwright.polyline-lod.config';
export default defineConfig({
  ...base,
  testMatch: 'core-path-instances.spec.ts',
});
