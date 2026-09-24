import { parseMermaidToSerializedNodes } from '../../../packages/plugin-mermaid/src/parser';

declare global {
  interface Window {
    parseMermaidForTest: typeof parseMermaidToSerializedNodes;
  }
}

window.parseMermaidForTest = parseMermaidToSerializedNodes;
document.querySelector('#status')!.textContent = 'Ready';
