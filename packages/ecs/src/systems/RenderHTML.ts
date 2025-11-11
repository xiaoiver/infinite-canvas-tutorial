import { System } from '@lastolivegames/becsy';
import {
  Camera,
  Canvas,
  Children,
  HTML,
  HTMLContainer,
  GlobalTransform,
  Mat3,
} from '../components';
import { getSceneRoot } from '../systems';
import { isBrowser, toDomPrecision } from '../utils';

export class RenderHTML extends System {
  private readonly htmls = this.query(
    (q) => q.added.and.changed.with(HTML, GlobalTransform).trackWrites,
  );

  constructor() {
    super();
    this.query(
      (q) =>
        q
          .using(Camera, Canvas, Children, GlobalTransform)
          .read.and.using(HTMLContainer).write,
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
      $child.style.overflow = 'visible';
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
  }

  private updateCSSTransform(
    $child: HTMLElement,
    matrix: Mat3,
    width: number,
    height: number,
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
  }
}
