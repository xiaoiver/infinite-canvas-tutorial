import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import { AnimationPlayer } from '../components';
import { AnimationSystem, Update } from '../systems';

export const AnimationPlugin: Plugin = () => {
  component(AnimationPlayer);
  system(Update)(AnimationSystem);
};
