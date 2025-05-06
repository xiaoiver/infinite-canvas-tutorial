import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import {
  ComputeBounds,
  EventWriter,
  PropagateTransforms,
  RenderHighlighter,
  RenderTransformer,
  Select,
  SetCursor,
  SetupDevice,
  Sort,
  SyncSimpleTransforms,
} from '../systems';
import { Highlighted, Selected, UI } from '../components';

export const PenPlugin: Plugin = () => {
  component(UI);
  component(Selected);
  component(Highlighted);

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
  system((s) =>
    s.afterWritersOf(Highlighted).inAnyOrderWith(RenderTransformer),
  )(RenderHighlighter);
};
