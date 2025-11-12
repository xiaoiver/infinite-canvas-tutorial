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
} from '../components';
import { getSceneRoot } from '../systems';
import { isBrowser, safeParseUrl, toDomPrecision } from '../utils';

export class RenderHTML extends System {
  private readonly htmls = this.query(
    (q) => q.added.and.changed.with(HTML, GlobalTransform).trackWrites,
  );

  private readonly embeds = this.query(
    (q) => q.added.and.changed.with(Embed, GlobalTransform).trackWrites,
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

const getSandboxPermissions = (permissions: TLEmbedShapePermissions) => {
  return Object.entries(permissions)
    .filter(([_perm, isEnabled]) => isEnabled)
    .map(([perm]) => perm)
    .join(' ');
};

export type TLEmbedShapePermissions = {
  [K in keyof typeof embedShapePermissionDefaults]?: boolean;
};
/**
 * Permissions with note inline from
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#attr-sandbox
 *
 * @see https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/defaultEmbedDefinitions.ts#L606
 */
export const embedShapePermissionDefaults = {
  // ========================================================================================
  // Disabled permissions
  // ========================================================================================
  // [MDN] Experimental: Allows for downloads to occur without a gesture from the user.
  // [REASON] Disabled because otherwise the <iframe/> can trick the user on behalf of us to perform an action.
  'allow-downloads-without-user-activation': false,
  // [MDN] Allows for downloads to occur with a gesture from the user.
  // [REASON] Disabled because otherwise the <iframe/> can trick the user on behalf of us to perform an action.
  'allow-downloads': false,
  // [MDN] Lets the resource open modal windows.
  // [REASON] The <iframe/> could 'window.prompt("Enter your tldraw password")'.
  'allow-modals': false,
  // [MDN] Lets the resource lock the screen orientation.
  // [REASON] Would interfere with the tldraw interface.
  'allow-orientation-lock': false,
  // [MDN] Lets the resource use the Pointer Lock API.
  // [REASON] Maybe we should allow this for games embeds (scratch/codepen/codesandbox).
  'allow-pointer-lock': false,
  // [MDN] Allows popups (such as window.open(), target="_blank", or showModalDialog()). If this keyword is not used, the popup will silently fail to open.
  // [REASON] We want to allow embeds to link back to their original sites (e.g. YouTube).
  'allow-popups': true,
  // [MDN] Lets the sandboxed document open new windows without those windows inheriting the sandboxing. For example, this can safely sandbox an advertisement without forcing the same restrictions upon the page the ad links to.
  // [REASON] We shouldn't allow popups as a embed could pretend to be us by opening a mocked version of tldraw. This is very unobvious when it is performed as an action within our app.
  'allow-popups-to-escape-sandbox': false,
  // [MDN] Lets the resource start a presentation session.
  // [REASON] Prevents embed from navigating away from tldraw and pretending to be us.
  'allow-presentation': false,
  // [MDN] Experimental: Lets the resource request access to the parent's storage capabilities with the Storage Access API.
  // [REASON] We don't want anyone else to access our storage.
  'allow-storage-access-by-user-activation': false,
  // [MDN] Lets the resource navigate the top-level browsing context (the one named _top).
  // [REASON] Prevents embed from navigating away from tldraw and pretending to be us.
  'allow-top-navigation': false,
  // [MDN] Lets the resource navigate the top-level browsing context, but only if initiated by a user gesture.
  // [REASON] Prevents embed from navigating away from tldraw and pretending to be us.
  'allow-top-navigation-by-user-activation': false,
  // ========================================================================================
  // Enabled permissions
  // ========================================================================================
  // [MDN] Lets the resource run scripts (but not create popup windows).
  'allow-scripts': true,
  // [MDN] If this token is not used, the resource is treated as being from a special origin that always fails the same-origin policy (potentially preventing access to data storage/cookies and some JavaScript APIs).
  'allow-same-origin': true,
  // [MDN] Allows the resource to submit forms. If this keyword is not used, form submission is blocked.
  'allow-forms': true,
} as const;
