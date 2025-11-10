import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import { HTML, HTMLContainer } from '../components';
import { Deleter, Last, RenderHTML } from '../systems';

export const HTMLPlugin: Plugin = () => {
  component(HTML);
  component(HTMLContainer);

  system(Last)(RenderHTML);
  system((s) => s.before(Deleter))(RenderHTML);
};
