import { system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import {
  ComputeBounds,
  EventWriter,
  PropagateTransforms,
  Select,
  SetupDevice,
  Sort,
  SyncSimpleTransforms,
} from '../systems';

export const PenPlugin: Plugin = () => {
  system((s) =>
    s.after(
      ComputeBounds,
      EventWriter,
      SetupDevice,
      SyncSimpleTransforms,
      PropagateTransforms,
      Sort,
    ),
  )(Select);
};
