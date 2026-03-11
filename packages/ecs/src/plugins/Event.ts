import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import {
  Deleter,
  EventDisposer,
  EventWriter,
  Last,
  First,
} from '../systems';
import { Event, Input, InputPoint } from '../components';

export const EventPlugin: Plugin = () => {
  component(Event);
  component(Input);
  component(InputPoint);

  system(First)(EventWriter);
  system(Last)(EventDisposer);
  system((s) => s.before(Deleter))(EventDisposer);
};
