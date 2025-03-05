import { createContext } from '@lit/context';
import type { Canvas } from '../Canvas';

export const canvasContext = createContext<Canvas>(Symbol('canvas'));
