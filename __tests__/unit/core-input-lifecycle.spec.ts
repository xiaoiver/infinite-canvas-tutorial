import { JSDOM } from 'jsdom';
import { DOMEventListener } from '../../packages/core/src/plugins/DOMEventListener';
import { SyncHook } from '../../packages/core/src/utils/tapable/SyncHook';

it.each(['pointer', 'mouse', 'touch'])(
  'detaches %s input from a destroyed canvas while peers and replacements remain active',
  (mode) => {
    const { window } = new JSDOM();
    const names = [
      'pointerDown',
      'pointerUp',
      'pointerMove',
      'pointerOut',
      'pointerOver',
      'pointerWheel',
      'pointerCancel',
    ] as const;
    const fixture = () => {
      const canvas = window.document.createElement('canvas');
      window.document.body.append(canvas);
      const hooks: any = { init: new SyncHook(), destroy: new SyncHook() };
      const calls = Object.fromEntries(names.map((name) => [name, 0]));
      for (const name of names) {
        hooks[name] = new SyncHook();
        hooks[name].tap(() => calls[name]++);
      }
      new DOMEventListener().apply({
        canvas,
        hooks,
        globalThis: window,
        supportsPointerEvents: mode === 'pointer',
        supportsTouchEvents: mode === 'touch',
      } as any);
      hooks.init.call();
      return { canvas, hooks, calls };
    };
    const emit = (canvas: HTMLCanvasElement) => {
      const dispatch = (target: any, type: string) =>
        target.dispatchEvent(
          new window.Event(type, { bubbles: true, cancelable: true }),
        );
      dispatch(canvas, 'wheel');
      if (mode === 'pointer') {
        for (const type of ['pointerdown', 'pointerleave', 'pointerover'])
          dispatch(canvas, type);
        for (const type of ['pointermove', 'pointerup', 'pointercancel'])
          dispatch(window, type);
      } else {
        for (const type of ['mousedown', 'mouseout', 'mouseover'])
          dispatch(canvas, type);
        for (const type of ['mousemove', 'mouseup']) dispatch(window, type);
        if (mode === 'touch')
          for (const type of [
            'touchstart',
            'touchend',
            'touchmove',
            'touchcancel',
          ])
            dispatch(canvas, type);
      }
    };
    const first = fixture(),
      peer = fixture();
    try {
      emit(first.canvas);
      expect(first.calls.pointerDown).toBeGreaterThan(0);
      expect(first.calls.pointerMove).toBeGreaterThan(0);
      if (mode !== 'mouse')
        expect(first.calls.pointerCancel).toBeGreaterThan(0);
      first.hooks.destroy.call();
      first.hooks.destroy.call();
      const retired = { ...first.calls },
        beforePeer = { ...peer.calls };
      emit(first.canvas);
      emit(peer.canvas);
      expect(first.calls).toEqual(retired);
      expect(peer.calls.pointerDown).toBeGreaterThan(beforePeer.pointerDown);
      expect(peer.calls.pointerMove).toBeGreaterThan(beforePeer.pointerMove);
      if (mode !== 'mouse')
        expect(peer.calls.pointerCancel).toBeGreaterThan(
          beforePeer.pointerCancel,
        );
      const replacement = fixture();
      emit(replacement.canvas);
      expect(replacement.calls.pointerDown).toBeGreaterThan(0);
      expect(first.calls).toEqual(retired);
      replacement.hooks.destroy.call();
      peer.hooks.destroy.call();
      const endedPeer = { ...peer.calls },
        endedReplacement = { ...replacement.calls };
      emit(first.canvas);
      emit(peer.canvas);
      emit(replacement.canvas);
      expect(first.calls).toEqual(retired);
      expect(peer.calls).toEqual(endedPeer);
      expect(replacement.calls).toEqual(endedReplacement);
    } finally {
      first.hooks.destroy.call();
      peer.hooks.destroy.call();
      window.close();
    }
  },
);
