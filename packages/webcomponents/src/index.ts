import { App } from '@infinite-canvas-tutorial/ecs';

import { DefaultPlugins } from '@infinite-canvas-tutorial/ecs';

export * from './event';
export * from './utils';

export const app = new App().addPlugins(...DefaultPlugins);
