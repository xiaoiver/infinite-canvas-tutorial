import { component } from '@lastolivegames/becsy';
import { Plugin } from './types';
import { Canvas, Cursor, Grid, Theme } from '../components';

export const CanvasPlugin: Plugin = () => {
  component(Canvas);
  component(Cursor);
  component(Grid);
  component(Theme);
};
