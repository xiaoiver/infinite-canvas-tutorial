import { API, DefaultStateManagement } from '../../packages/ecs/src/API';
import type { Commands } from '../../packages/ecs/src/commands';

it('round-trips client CSS pixels through a translated, non-uniformly scaled canvas', () => {
  const api = new API(new DefaultStateManagement(), {} as Commands);
  let bounds = { left: 120, top: 80, width: 800, height: 150 };
  const element = {
    offsetWidth: 400,
    offsetHeight: 300,
    getBoundingClientRect: () => bounds,
  } as HTMLCanvasElement;
  jest.spyOn(api, 'getCanvasElement').mockReturnValue(element);
  const viewport = { x: 80, y: 60 };
  expect(api.viewport2Client(viewport)).toEqual({ x: 280, y: 110 });
  expect(api.client2Viewport({ x: 280, y: 110 })).toEqual(viewport);
  // Scrolling/layout movement is read on each conversion, not cached.
  bounds = { ...bounds, left: -50, top: 20 };
  expect(api.viewport2Client(viewport)).toEqual({ x: 110, y: 50 });
  expect(api.client2Viewport(api.viewport2Client(viewport))).toEqual(viewport);
});
