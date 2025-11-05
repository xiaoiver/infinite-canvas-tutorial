import { System } from '@lastolivegames/becsy';
import { Camera, Canvas, Children, HTML, Transform } from '../components';
import { getSceneRoot } from '../systems';
import { isBrowser, toDomPrecision } from '../utils';

export class RenderHTML extends System {
  private readonly htmls = this.query((q) => q.added.with(HTML));

  constructor() {
    super();
    this.query((q) => q.using(Camera, Canvas, Children, Transform).read);
  }

  execute() {
    if (!isBrowser) {
      return;
    }

    this.htmls.added.forEach((entity) => {
      const { html, width, height } = entity.read(HTML);
      const { translation, rotation, scale } = entity.read(Transform);
      const { x, y } = translation;
      const { x: scaleX, y: scaleY } = scale;

      const camera = getSceneRoot(entity);
      const { canvas } = camera.read(Camera);
      const { api } = canvas.read(Canvas);
      const htmlLayer = api.getHtmlLayer();

      const $child = document.createElement('div');
      $child.innerHTML = html;
      $child.style.position = 'absolute';
      $child.style.pointerEvents = 'none';
      $child.style.overflow = 'visible';
      $child.style.transformOrigin = 'top left';
      $child.style.contain = 'size layout';
      $child.style.width = `${toDomPrecision(width)}px`;
      $child.style.height = `${toDomPrecision(height)}px`;
      $child.style.transform = `translate(${toDomPrecision(
        x,
      )}px, ${toDomPrecision(y)}px) scale(${toDomPrecision(
        scaleX,
      )}, ${toDomPrecision(scaleY)}) rotate(${toDomPrecision(rotation)}rad)`;
      htmlLayer.appendChild($child);
    });
  }
}
