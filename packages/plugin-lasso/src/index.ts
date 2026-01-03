export * from './plugin';

declare module '@infinite-canvas-tutorial/ecs' {
  interface AppState {
    lassoTrailStroke: string;
    lassoTrailFill: string;
    lassoTrailFillOpacity: number;
    lassoTrailStrokeDasharray: string;
    lassoTrailStrokeDashoffset: string;
  }
}
