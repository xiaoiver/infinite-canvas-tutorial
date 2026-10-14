import {
  API,
  App,
  Commands,
  DefaultPlugins,
  DefaultStateManagement,
  PreStartUp,
  System,
  system,
  CheckboardStyle,
  ThemeMode,
  type SerializedNode,
} from '@infinite-canvas-tutorial/ecs';
import { settleECSFrames } from './ecs-frames';

const apis: API[] = [];
class Bootstrap extends System {
  access = this.query((q) => q.usingAll.write);
  initialize() {
    for (const side of ['left', 'right']) {
      const api = new API(new DefaultStateManagement(), new Commands(this));
      api.createCanvas({
        element: document.querySelector<HTMLCanvasElement>(`#${side}`)!,
        width: 200,
        height: 120,
        devicePixelRatio: 1,
      });
      api.createCamera({ zoom: 1, x: 0, y: 0 });
      api.setAppState({
        animationEditing: true,
        animationPlaying: false,
        animationCurrentTime: 0,
        checkboardStyle: CheckboardStyle.NONE,
        theme: {
          mode: ThemeMode.LIGHT,
          colors: { light: { background: 'transparent' } },
        },
      });
      apis.push(api);
    }
  }
}
const app = new App().addPlugins(...DefaultPlugins, () => {
  system(PreStartUp)(Bootstrap);
  system((s) => s.inAnyOrderWith(s.allSystems))(Bootstrap);
});
await app.run();
const harness = {
  async render(nodes: SerializedNode[], side = 0) {
    const api = apis[side];
    await api.edit(() => api.replaceDocument(nodes), { capture: 'NEVER' });
    await settleECSFrames(api);
    return api.getCanvasElement().toDataURL();
  },
  async seek(time: number, side = 0) {
    const api = apis[side];
    await api.edit(() => api.setAnimationCurrentTime(time), {
      capture: 'NEVER',
    });
    await settleECSFrames(api);
    return apis.map((api) => api.getCanvasElement().toDataURL());
  },
  dispose: () => app.exit(),
};
window.animationStateTest = harness;
declare global {
  interface Window {
    animationStateTest: typeof harness;
  }
}
document.querySelector('#status')!.textContent = 'Ready';
