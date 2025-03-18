import { system } from '@lastolivegames/becsy';
import { Plugin } from '.';
import { App } from '../App';
import { CameraControl, Select } from '../systems';

export const PenPlugin: Plugin = (app: App) => {
  system((s) => s.after(CameraControl))(Select);
};
