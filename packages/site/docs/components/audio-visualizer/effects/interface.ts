import { Canvas } from "@infinite-canvas-tutorial/core";

export interface Effect {
  init(canvas: Canvas): Promise<void>;
  resize(width: number, height: number): void;
  frame(frame: number, elapsed: number, mouse: any, buffer: Uint8Array): void;
  update(options: any): void;
  destroy(): void;
}
