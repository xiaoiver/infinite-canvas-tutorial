import { System } from '@lastolivegames/becsy';
import {
  Camera,
  Canvas,
  Children,
  HTML,
  HTMLContainer,
  GlobalTransform,
  Mat3,
  Embed,
  Culled,
} from '../components';
import { getSceneRoot } from '../systems';
import {
  embedShapePermissionDefaults,
  getSandboxPermissions,
  isBrowser,
  safeParseUrl,
  toDomPrecision,
} from '../utils';

export class RenderHTML extends System {
  private readonly htmls = this.query(
    (q) => q.added.and.changed.with(HTML, GlobalTransform).trackWrites,
  );

  private readonly embeds = this.query(
    (q) => q.added.and.changed.with(Embed, GlobalTransform).trackWrites,
  );

  private readonly culled = this.query(
    (q) =>
      q.withAny(HTML, Embed).addedChangedOrRemoved.with(Culled).trackWrites,
  );

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(Camera, Canvas, Children, GlobalTransform)
          .read.and.using(HTMLContainer, Embed).write,
    );
  }

  execute() {
    if (!isBrowser) {
      return;
    }

    this.culled.addedChangedOrRemoved.forEach((entity) => {
      entity.read(HTMLContainer).element.style.display = entity.has(Culled)
        ? 'none'
        : 'block';
    });

    this.htmls.added.forEach((entity) => {
      const { html, width, height } = entity.read(HTML);
      const { element } = entity.read(HTMLContainer);

      // Create HTML container if not exists.
      if (!element) {
        entity.write(HTMLContainer).element = document.createElement('div');
      }

      const { matrix } = entity.read(GlobalTransform);

      const camera = getSceneRoot(entity);
      const { canvas } = camera.read(Camera);
      const { api } = canvas.read(Canvas);
      const htmlLayer = api.getHtmlLayer();

      const $child = entity.read(HTMLContainer).element;
      $child.innerHTML = html;
      $child.style.position = 'absolute';
      $child.style.pointerEvents = 'none';
      $child.style.overflow = 'hidden';
      $child.style.transformOrigin = 'top left';
      $child.style.contain = 'size layout';

      htmlLayer.appendChild($child);

      this.updateCSSTransform($child, matrix, width, height);
    });

    this.htmls.changed.forEach((entity) => {
      const $child = entity.read(HTMLContainer).element;
      const { matrix } = entity.read(GlobalTransform);
      const { width, height } = entity.read(HTML);
      this.updateCSSTransform($child, matrix, width, height);
    });

    this.embeds.added.forEach((entity) => {
      const { url, width, height } = entity.read(Embed);
      const { element } = entity.read(HTMLContainer);

      // Create HTML container if not exists.
      if (!element) {
        entity.write(HTMLContainer).element = document.createElement('div');
      }

      const { matrix } = entity.read(GlobalTransform);

      const camera = getSceneRoot(entity);
      const { canvas } = camera.read(Camera);
      const { api } = canvas.read(Canvas);
      const htmlLayer = api.getHtmlLayer();

      const $child = entity.read(HTMLContainer).element;
      $child.style.position = 'absolute';
      $child.style.pointerEvents = 'none';
      $child.style.overflow = 'hidden';
      $child.style.transformOrigin = 'top left';
      $child.style.contain = 'size layout';

      let embedUrl = url;
      const urlObj = safeParseUrl(url);
      if (urlObj) {
        const hostname = urlObj.hostname.replace(/^www./, '');
        if (hostname === 'youtu.be') {
          const videoId = urlObj.pathname.split('/').filter(Boolean)[0];
          const searchParams = new URLSearchParams(urlObj.search);
          const timeStart = searchParams.get('t');
          if (timeStart) {
            searchParams.set('start', timeStart);
            searchParams.delete('t');
          }
          const search = searchParams.toString()
            ? '?' + searchParams.toString()
            : '';
          embedUrl = `https://www.youtube.com/embed/${videoId}${search}`;
        } else if (
          (hostname === 'youtube.com' || hostname === 'm.youtube.com') &&
          urlObj.pathname.match(/^\/watch/)
        ) {
          const videoId = urlObj.searchParams.get('v');
          const searchParams = new URLSearchParams(urlObj.search);
          searchParams.delete('v');
          const timeStart = searchParams.get('t');
          if (timeStart) {
            searchParams.set('start', timeStart);
            searchParams.delete('t');
          }
          const search = searchParams.toString()
            ? '?' + searchParams.toString()
            : '';
          embedUrl = `https://www.youtube.com/embed/${videoId}${search}`;
        }
      }

      const $iframe = document.createElement('iframe');
      $iframe.src = embedUrl;
      $iframe.draggable = false;
      $iframe.frameBorder = '0';
      $iframe.referrerPolicy = 'no-referrer-when-downgrade';
      $iframe.tabIndex = -1;
      $iframe.style.border = '0';
      $iframe.style.pointerEvents = 'none';
      $iframe.sandbox = getSandboxPermissions({
        ...embedShapePermissionDefaults,
        ...{
          'allow-presentation': true,
          'allow-popups-to-escape-sandbox': true,
        },
      });

      $child.appendChild($iframe);
      htmlLayer.appendChild($child);

      this.updateCSSTransform($child, matrix, width, height, $iframe);
    });

    this.embeds.changed.forEach((entity) => {
      const $child = entity.read(HTMLContainer).element;
      const $iframe = $child.querySelector('iframe');
      const { matrix } = entity.read(GlobalTransform);
      const { width, height } = entity.read(Embed);
      this.updateCSSTransform($child, matrix, width, height, $iframe);
    });
  }

  private updateCSSTransform(
    $child: HTMLElement,
    matrix: Mat3,
    width: number,
    height: number,
    $iframe?: HTMLIFrameElement,
  ) {
    $child.style.transform = `matrix(${toDomPrecision(
      matrix.m00,
    )}, ${toDomPrecision(matrix.m01)}, ${toDomPrecision(
      matrix.m10,
    )}, ${toDomPrecision(matrix.m11)}, ${toDomPrecision(
      matrix.m20,
    )}, ${toDomPrecision(matrix.m21)})`;
    $child.style.width = `${toDomPrecision(width)}px`;
    $child.style.height = `${toDomPrecision(height)}px`;

    if ($iframe) {
      $iframe.width = `${toDomPrecision(width)}px`;
      $iframe.height = `${toDomPrecision(height)}px`;
    }
  }
}
