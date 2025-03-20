import { Plugin } from '.';
import { EventWriter } from '../systems';
import { Event, Input, InputPoint } from '../components';

export const EventPlugin: Plugin = () => {
  return [Event, Input, InputPoint, EventWriter];
};
