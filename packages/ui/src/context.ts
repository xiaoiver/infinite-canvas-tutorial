import { createContext } from '@lit/context';
import type { Canvas } from '@infinite-canvas-tutorial/core';

export const canvasContext = createContext<Canvas>(Symbol('canvas'));
