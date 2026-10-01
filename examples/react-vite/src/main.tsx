import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CanvasEditor } from './canvas-editor';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main>
      <h1>React canvas with Vite</h1>
      <CanvasEditor />
    </main>
  </StrictMode>,
);
