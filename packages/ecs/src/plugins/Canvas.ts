import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import { Canvas, Cursor, Grid, Theme } from '../components';
import { ApplyEdits, Edit } from '../systems';

export const CanvasPlugin: Plugin = () => {
  component(Canvas);
  component(Cursor);
  component(Grid);
  component(Theme);
  system(Edit)(ApplyEdits);
  // Edits need broad write access. The Edit stage supplies their ordering;
  // component-based dependencies would also place them after derived writers.
  system((s) => s.inAnyOrderWith(s.allSystems))(ApplyEdits);
};
