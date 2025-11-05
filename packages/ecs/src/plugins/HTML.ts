import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import { HTML } from '../components';
import { Last, RenderHTML } from '../systems';

export const HTMLPlugin: Plugin = () => {
  component(HTML);

  system(Last)(RenderHTML);
};
