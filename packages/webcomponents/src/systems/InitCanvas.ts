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
  FillGradient,
  FillSolid,
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
  Locked,
} from '@infinite-canvas-tutorial/ecs';
import { Event } from '../event';
import { ExtendedAPI, pendingCanvases } from '../API';
import { LitStateManagement } from '../context';
import { InfiniteCanvas } from '../spectrum/infinite-canvas';
import { localizedTemplates } from '../i18n';

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
            FillSolid,
            FillGradient,
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
            Locked,
          ).write,
    );
  }

  // configureLocalization can only be called once, so we need to store the setLocale and getLocale functions in instance variables.
  #setLocale: (locale: string) => Promise<void>;
  #getLocale: () => string;

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

        try {
          const { getLocale, setLocale } = configureLocalization({
            sourceLocale,
            targetLocales,
            loadLocale: async (locale) => localizedTemplates.get(locale),
          });
          this.#setLocale = setLocale;
          this.#getLocale = getLocale;
        } catch (e) {}

        api.setLocale = this.#setLocale;
        api.getLocale = this.#getLocale;

        this.commands.execute();

        container.dispatchEvent(new CustomEvent(Event.READY, { detail: api }));
      });
      pendingCanvases.length = 0;
    }
  }
}
