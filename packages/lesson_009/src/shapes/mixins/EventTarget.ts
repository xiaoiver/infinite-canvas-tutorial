import EventEmitter from 'eventemitter3';
import { Rectangle } from '@pixi/math';
import {
  Cursor,
  FederatedEvent,
  FederatedEventTarget,
  FederatedOptions,
  PointerEvents,
} from '../../events';
import { isBoolean, isFunction, isObject } from '../../utils';

export class EventTarget extends EventEmitter implements FederatedEventTarget {
  pointerEvents: PointerEvents;
  cursor: Cursor | string;
  hitArea: Rectangle | undefined;
  draggable: boolean;
  droppable: boolean;

  constructor(attributes: Partial<FederatedOptions> = {}) {
    super();

    const { cursor, hitArea, pointerEvents, draggable, droppable } = attributes;

    this.cursor = cursor ?? 'default';
    this.hitArea = hitArea;
    this.pointerEvents = pointerEvents ?? 'auto';
    this.draggable = draggable ?? false;
    this.droppable = droppable ?? false;
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    const capture =
      (isBoolean(options) && options) || (isObject(options) && options.capture);
    const signal = isObject(options) ? options.signal : undefined;
    const once = isObject(options) && options.once;
    const context = isFunction(listener) ? undefined : listener;

    type = capture ? `${type}capture` : type;
    const listenerFn = isFunction(listener) ? listener : listener.handleEvent;

    if (signal) {
      signal.addEventListener('abort', () => {
        this.off(type, listenerFn, context);
      });
    }

    if (once) {
      this.once(type, listenerFn, context);
    } else {
      this.on(type, listenerFn, context);
    }
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) {
    const capture =
      (isBoolean(options) && options) || (isObject(options) && options.capture);
    const context = isFunction(listener) ? undefined : listener;

    type = capture ? `${type}capture` : type;
    listener = isFunction(listener) ? listener : listener?.handleEvent;

    this.off(type, listener, context);
  }

  dispatchEvent(e: Event) {
    if (!(e instanceof FederatedEvent)) {
      throw new Error(
        'Container cannot propagate events outside of the Federated Events API',
      );
    }

    e.defaultPrevented = false;
    e.path = [];
    e.target = this as unknown as FederatedEventTarget;
    e.manager.dispatchEvent(e);

    return !e.defaultPrevented;
  }
}
