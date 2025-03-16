import { component, system } from '@lastolivegames/becsy';
import { App } from '../App';
import { Plugin } from '.';
import { EventWriter, PreUpdate } from '../systems';
import { Event, Input, InputPoint } from '../components';

export const EventPlugin: Plugin = (app: App) => {
  component(Event);
  component(Input);
  component(InputPoint);
  system(PreUpdate)(EventWriter);
};
