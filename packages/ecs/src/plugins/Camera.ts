import { component } from '@lastolivegames/becsy';
import { App } from '../App';
import { Plugin } from '.';
import { Camera } from '../components';
import { PreStartUp, SyncCamera } from '../systems';

export const CameraPlugin: Plugin = (app: App) => {
  component(Camera);
  app.addSystems(PreStartUp, SyncCamera);
};
