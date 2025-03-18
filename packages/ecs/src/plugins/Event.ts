import { component, system } from '@lastolivegames/becsy';
import { App } from '../App';
import { Plugin } from '.';
import { CameraControl, EventWriter, PreUpdate, Select } from '../systems';
import { Event, Input, InputPoint } from '../components';

export const EventPlugin: Plugin = (app: App) => {
  component(Event);
  component(Input);
  component(InputPoint);
  system(PreUpdate)(EventWriter);

  system((s) => s.inAnyOrderWith(CameraControl, Select))(EventWriter);
};
