import { component, system } from '@lastolivegames/becsy';
import { App } from '../App';
import { Plugin } from '.';
import { EventReader, EventWriter, PreUpdate } from '../systems';
import { Event } from '../components';

export const EventPlugin: Plugin = (app: App) => {
  component(Event);
  app.addSystems(PreUpdate, EventWriter, EventReader);

  system((s) => s.inAnyOrderWith(EventReader))(EventWriter);
};
