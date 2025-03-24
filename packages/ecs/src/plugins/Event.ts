import { component, system } from '@lastolivegames/becsy';
import { Plugin } from './types';
import { EventWriter, SetupDevice } from '../systems';
import { Event, Input, InputPoint } from '../components';

export const EventPlugin: Plugin = () => {
  component(Event);
  component(Input);
  component(InputPoint);

  system((s) => s.after(SetupDevice))(EventWriter);
};
