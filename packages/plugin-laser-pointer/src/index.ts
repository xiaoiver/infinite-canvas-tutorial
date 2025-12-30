export * from './plugin';

declare module '@infinite-canvas-tutorial/ecs' {
  interface AppState {
    /**
     * Laser pointer size
     */
    laserPointerSize: number;
    /**
     * Laser pointer color
     */
    laserPointerColor: string;
  }
}
