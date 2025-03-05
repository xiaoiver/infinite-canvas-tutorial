import { EventBoundary } from './EventBoundary';
import { FederatedEvent } from './FederatedEvent';

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/Events/Creating_and_triggering_events
 *
 * @example
  const event = new CustomEvent('build', { detail: { prop1: 'xx' } });
  circle.addEventListener('build', (e) => {
    e.target; // circle
    e.detail; // { prop1: 'xx' }
  });

  circle.dispatchEvent(event);
 */
export class CustomEvent extends FederatedEvent {
  constructor(manager: EventBoundary, eventName: string, object?: object) {
    super(manager);

    this.type = eventName;
    // @ts-expect-error detail is not defined in Event
    this.detail = object;
  }
}
