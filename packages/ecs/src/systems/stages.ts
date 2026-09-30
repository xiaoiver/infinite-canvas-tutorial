import { System } from '@lastolivegames/becsy';

/**
 * The schedule that contains the app logic that is evaluated each tick of [`App::update()`].
 *
 * By default, it will run the following schedules in the given order:
 *
 * On the first run of the schedule (and only on the first run), it will run:
 * * [`PreStartup`]
 * * [`Startup`]
 * * [`PostStartup`]
 *
 * Then it will run:
 * * [`First`]
 * * [`PreUpdate`]
 * * [`StateTransition`]
 * * [`RunFixedUpdateLoop`]
 *     * This will run [`FixedUpdate`] zero to many times, based on how much time has elapsed.
 * * [`Update`]
 * * [`PostUpdate`]
 * * [`Last`]
 */

/**
 * The schedule that runs before [`Startup`].
 */
export const PreStartUp = System.group();

/**
 * The schedule that runs once when the app starts.
 */
export const StartUp = System.group();

/**
 * The schedule that runs once after [`Startup`].
 */
export const PostStartUp = System.group();

/**
 * Runs first in the schedule.
 */
export const First = System.group();

/**
 * The schedule that contains logic that must run before [`Update`]. For example, a system that reads raw keyboard
 * input OS events into an `Events` resource. This enables systems in [`Update`] to consume the events from the `Events`
 * resource without actually knowing about (or taking a direct scheduler dependency on) the "os-level keyboard event system".
 *
 * [`PreUpdate`] exists to do "engine/plugin preparation work" that ensures the APIs consumed in [`Update`] are "ready".
 * [`PreUpdate`] abstracts out "pre work implementation details".
 *
 * See the [`Main`] schedule for some details about how schedules are run.
 */
export const PreUpdate = System.group();

/**
 * The schedule that contains app logic.
 */
export const Update = System.group();

/**
 * The schedule that contains logic that must run after [`Update`]. For example, synchronizing "local transforms" in a hierarchy
 * to "global" absolute transforms. This enables the [`PostUpdate`] transform-sync system to react to "local transform" changes in
 * [`Update`] without the [`Update`] systems needing to know about (or add scheduler dependencies for) the "global transform sync system".
 *
 * [`PostUpdate`] exists to do "engine/plugin response work" to things that happened in [`Update`].
 * [`PostUpdate`] abstracts out "implementation details" from users defining systems in [`Update`].
 *
 * See the [`Main`] schedule for some details about how schedules are run.
 */
export const PostUpdate = System.group();

/**
 * Runs last in the schedule.
 */
export const Last = System.group();

const stages = [
  PreStartUp,
  StartUp,
  PostStartUp,
  First,
  PreUpdate,
  Update,
  PostUpdate,
  Last,
];

/** @internal Prepare the shared stage definitions for a new World. */
export function prepareStages() {
  // Becsy 0.16 caches World-specific SystemBoxes on each group and consumes its
  // schedule builder. Keep the group identities used by plugin decorators, but
  // discard the previous World's cache and rebuild our ordering constraints.
  stages.forEach((stage, index) => {
    Reflect.deleteProperty(stage, '__systems');
    stage.__executed = false;
    stage.__scheduleBuilder = undefined;
    const next = stages[index + 1];
    if (next) stage.schedule((s) => s.before(next));
  });
}

prepareStages();
