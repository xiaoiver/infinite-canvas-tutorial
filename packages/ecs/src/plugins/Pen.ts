import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import {
  ComputeBounds,
  EventWriter,
  PropagateTransforms,
  RenderHighlighter,
  RenderTransformer,
  Select,
  EditVectorNetwork,
  SetCursor,
  SetupDevice,
  Sort,
  SyncSimpleTransforms,
  DrawRect,
  CameraControl,
  ComputeCamera,
  Last,
  ComputeVisibility,
} from '../systems';
import {
  Highlighted,
  Anchor,
  Selected,
  Transformable,
  UI,
  VectorNetwork,
} from '../components';

export const PenPlugin: Plugin = () => {
  component(UI);
  component(Selected);
  component(Highlighted);
  component(Transformable);
  component(Anchor);
  component(VectorNetwork);

  system((s) =>
    s
      .after(
        ComputeBounds,
        EventWriter,
        SetupDevice,
        SyncSimpleTransforms,
        PropagateTransforms,
        Sort,
        SetCursor,
        ComputeCamera,
        ComputeVisibility,
        CameraControl,
      )
      .before(Last),
  )(Select);
  system((s) => s.after(Select))(EditVectorNetwork);
  system((s) => s.after(EditVectorNetwork))(DrawRect);
  system((s) => s.afterWritersOf(Selected))(RenderTransformer);
  system((s) =>
    s.afterWritersOf(Highlighted).inAnyOrderWith(RenderTransformer),
  )(RenderHighlighter);
};
