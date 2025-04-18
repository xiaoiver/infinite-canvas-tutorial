import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import {
  ComputeBounds,
  EventWriter,
  PropagateTransforms,
  RenderTransformer,
  Select,
  SetCursor,
  SetupDevice,
  Sort,
  SyncSimpleTransforms,
} from '../systems';
import { Selected, UI } from '../components';

export const PenPlugin: Plugin = () => {
  component(UI);
  component(Selected);

  system((s) =>
    s.after(
      ComputeBounds,
      EventWriter,
      SetupDevice,
      SyncSimpleTransforms,
      PropagateTransforms,
      Sort,
      SetCursor,
    ),
  )(Select);
  system((s) => s.afterWritersOf(Selected))(RenderTransformer);
};
