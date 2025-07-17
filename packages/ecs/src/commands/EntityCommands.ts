import EventEmitter from 'eventemitter3';
import { ComponentType, Entity } from '@lastolivegames/becsy';
import { AddChild } from './AddChild';
import { Insert } from './Insert';
import { Remove } from './Remove';
import { RemoveChild } from './RemoveChild';
import { Commands } from './Commands';
import { Bundle } from '../components';

/**
 * A list of commands that will be run to modify an [entity](crate::entity).
 */
export class EntityCommands extends EventEmitter {
  constructor(public entity: Entity, public commands: Commands) {
    super();
  }

  /**
   * Returns the [`Entity`] id of the entity.
   *
   * @example
   * let entity_id = commands.spawn_empty().id();
   */
  id() {
    return this.entity;
  }

  /**
   * Adds a [`Bundle`] of components to the entity.
   * This will overwrite any previous value(s) of the same component type.
   *
   * @example
   * commands
   *   .entity(0)
   *   .insert([Defense, { x: 10 }], [Transform, { translation } ])
   *   .insert([Bundle, { transform }])
   */
  insert(...bundles: (ComponentType<any> | Bundle)[]) {
    this.commands.add(new Insert(this.entity, bundles));
    return this;
  }

  /**
   * Removes a [`Bundle`] of components from the entity.
   * @example
   * commands.entity(0).remove(Transform);
   */
  remove(...bundles: (ComponentType<any> | Bundle)[]) {
    this.commands.add(new Remove(this.entity, bundles));
  }

  /**
   * Despawns the entity.
   */
  despawn() {
    // this.commands.add(CommandsType.DESPAWN, this.entity, null, null);
  }

  /**
   * Adds a single child.
   * If the children were previously children of another parent,
   * that parent's [`Children`] component will have those children removed from its list.
   * Removing all children from a parent causes its [`Children`] component to be removed from the entity.
   */
  appendChild(child: EntityCommands) {
    this.commands.add(new AddChild(this.id(), child.id()));
    return this;
  }

  removeChild(child: EntityCommands) {
    this.commands.add(new RemoveChild(this.id(), child.id()));
    return this;
  }

  // addEventListener(
  //   type: string,
  //   listener: EventListenerOrEventListenerObject,
  //   options?: boolean | AddEventListenerOptions,
  // ) {
  //   const capture =
  //     (isBoolean(options) && options) || (isObject(options) && options.capture);
  //   const signal = isObject(options) ? options.signal : undefined;
  //   const once = isObject(options) && options.once;
  //   const context = isFunction(listener) ? undefined : listener;

  //   type = capture ? `${type}capture` : type;
  //   const listenerFn = isFunction(listener) ? listener : listener.handleEvent;

  //   if (signal) {
  //     signal.addEventListener('abort', () => {
  //       this.off(type, listenerFn, context);
  //     });
  //   }

  //   if (once) {
  //     this.once(type, listenerFn, context);
  //   } else {
  //     this.on(type, listenerFn, context);
  //   }
  // }

  // removeEventListener(
  //   type: string,
  //   listener: EventListenerOrEventListenerObject,
  //   options?: boolean | EventListenerOptions,
  // ) {
  //   const capture =
  //     (isBoolean(options) && options) || (isObject(options) && options.capture);
  //   const context = isFunction(listener) ? undefined : listener;

  //   type = capture ? `${type}capture` : type;
  //   listener = isFunction(listener) ? listener : listener?.handleEvent;

  //   this.off(type, listener, context);
  // }

  // dispatchEvent(e: Event) {
  //   if (!(e instanceof FederatedEvent)) {
  //     throw new Error(
  //       'Container cannot propagate events outside of the Federated Events API',
  //     );
  //   }

  //   e.defaultPrevented = false;
  //   e.path = [];
  //   // @ts-ignore
  //   e.target = this.entity;
  //   e.manager.dispatchEvent(e);

  //   return !e.defaultPrevented;
  // }
}
