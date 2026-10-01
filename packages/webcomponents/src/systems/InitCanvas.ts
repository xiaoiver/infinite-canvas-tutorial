import { configureLocalization } from '@lit/localize';
// Generated via output.localeCodesModule
import { sourceLocale, targetLocales } from '../generated/locale-codes';
import {
  Brush,
  Camera,
  Canvas,
  Children,
  Circle,
  Commands,
  ComputedBounds,
  ComputedCamera,
  Cursor,
  DropShadow,
  InnerShadow,
  Ellipse,
  FillLayers,
  Font,
  Grid,
  Name,
  Opacity,
  Parent,
  Path,
  Polyline,
  Rect,
  Renderable,
  Selected,
  Stroke,
  System,
  Text,
  Transform,
  Visibility,
  ZIndex,
  TextDecoration,
  Wireframe,
  Rough,
  VectorNetwork,
  Marker,
  Line,
  LockAspectRatio,
  HTML,
  HTMLContainer,
  Embed,
  Editable,
  Filter,
  Binding,
  Binded,
  PartialBinding,
  Locked,
  ClipMode,
  Flex,
  Group,
  Theme,
  AnimationPlayer,
  MaterialDirty,
  IconFont,
} from '@infinite-canvas-tutorial/ecs';
import { ExtendedAPI, pendingCanvases, pendingGpuReadyDispatch } from '../API';
import { LitStateManagement } from '../context';
import { InfiniteCanvas } from '../spectrum/infinite-canvas';
import { localizedTemplates } from '../i18n';

// Localization is global to Lit and must survive App teardown/recreation.
let localization: ReturnType<typeof configureLocalization> | undefined;

export class InitCanvas extends System {
  private readonly commands = new Commands(this);

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(ComputedCamera, ComputedBounds)
          .read.and.using(
            Canvas,
            Camera,
            Grid,
            Name,
            Cursor,
            Transform,
            Parent,
            Children,
            Renderable,
            Visibility,
            FillLayers,
            Stroke,
            Circle,
            Ellipse,
            Rect,
            Polyline,
            Line,
            Path,
            Text,
            Rough,
            Brush,
            VectorNetwork,
            Group,
            Selected,
            Opacity,
            DropShadow,
            ZIndex,
            Font,
            TextDecoration,
            Wireframe,
            Marker,
            InnerShadow,
            LockAspectRatio,
            HTML,
            HTMLContainer,
            Embed,
            Editable,
            Filter,
            Binding,
            Binded,
            PartialBinding,
            Locked,
            ClipMode,
            Flex,
            Theme,
            AnimationPlayer,
            MaterialDirty,
            IconFont,
          ).write,
    );
  }

  execute() {
    if (pendingCanvases.length) {
      pendingCanvases.forEach(({ container, canvas, camera }) => {
        const { appStateProvider, nodesProvider, apiProvider } =
          container as InfiniteCanvas;

        const stateManagement = new LitStateManagement(
          appStateProvider,
          nodesProvider,
        );
        const api = new ExtendedAPI(stateManagement, this.commands, container);
        apiProvider.setValue(api);

        api.createCanvas({ ...canvas, api });
        api.createCamera(camera);

        localization ??= configureLocalization({
          sourceLocale,
          targetLocales,
          loadLocale: async (locale) => localizedTemplates.get(locale),
        });

        api.setLocale = localization.setLocale;
        api.getLocale = localization.getLocale;

        this.commands.execute();

        const initialAppState = stateManagement.getAppState();
        api.setAppState({
          theme: initialAppState.theme,
          themeMode: initialAppState.themeMode,
          themePreference: initialAppState.themePreference,
        });

        pendingGpuReadyDispatch.push({ container, api });
      });
      pendingCanvases.length = 0;
    }
  }
}
