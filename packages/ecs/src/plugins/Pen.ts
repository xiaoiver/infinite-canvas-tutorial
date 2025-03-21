import { Plugin } from './types';
import { Select } from '../systems';

export const PenPlugin: Plugin = () => {
  return [Select];
};
