/**
 * Borrow from https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/change.ts#L399
 */

import { AppState } from '../context';
import { Change } from './Change';
import { Delta } from './Delta';
import { SceneElementsMap } from './ElementsChange';

export class AppStateChange implements Change<AppState> {
  private constructor(private readonly delta: Delta<AppState>) {}

  static empty() {
    return new AppStateChange(Delta.create({}, {}));
  }

  static calculate<T extends AppState>(
    prevAppState: T,
    nextAppState: T,
  ): AppStateChange {
    const delta = Delta.calculate(
      prevAppState,
      nextAppState,
      undefined,
      // AppStateChange.postProcess,
    );

    return new AppStateChange(delta);
  }

  // private static postProcess<T extends ObservedAppState>(
  //   deleted: Partial<T>,
  //   inserted: Partial<T>,
  // ): [Partial<T>, Partial<T>] {
  //   try {
  //     Delta.diffObjects(
  //       deleted,
  //       inserted,
  //       "selectedElementIds",
  //       // ts language server has a bit trouble resolving this, so we are giving it a little push
  //       (_) => true as ValueOf<T["selectedElementIds"]>,
  //     );
  //     Delta.diffObjects(
  //       deleted,
  //       inserted,
  //       "selectedGroupIds",
  //       (prevValue) => (prevValue ?? false) as ValueOf<T["selectedGroupIds"]>,
  //     );
  //   } catch (e) {
  //     // if postprocessing fails it does not make sense to bubble up, but let's make sure we know about it
  //     console.error(`Couldn't postprocess appstate change deltas.`);
  //   } finally {
  //     return [deleted, inserted];
  //   }
  // }

  inverse(): AppStateChange {
    const inversedDelta = Delta.create(this.delta.inserted, this.delta.deleted);
    return new AppStateChange(inversedDelta);
  }

  applyTo(
    appState: AppState,
    nextElements: SceneElementsMap,
  ): [AppState, boolean] {
    // TODO: selected elements

    const directlyApplicablePartial = this.delta.inserted;

    const nextAppState = {
      ...appState,
      ...directlyApplicablePartial,
    };

    return [nextAppState, true];
  }

  isEmpty(): boolean {
    return Delta.isEmpty(this.delta);
  }
}
