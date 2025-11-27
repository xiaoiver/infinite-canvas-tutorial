import {
  Camera,
  Canvas,
  ComputedCamera,
  Cursor,
  Input,
  Pen,
  System,
} from '@infinite-canvas-tutorial/ecs';
import { Event, ExtendedAPI } from '..';

const COMMENT_CURSOR =
  'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAALzSURBVHgB7VZNSxtRFH0T86WtMYlSkTZBgwQkG4noX+hC6N6FUAql3bixiy6lu1q6EAqKgroriERR/4A/wW5aoRbUCoW0NLT5ziRze840oWma2snE4iYHLm/y5t1373v33DNRqoMOOujgmtFlYY1W/zwxMeEyDKN7cnJSTk9PDfWfYQafm5vz7e/vP61UKm9E5DNMh32CvT04OHg8Ozt7o379lQY/Pj5+gECF7e1tGR4eFo/HI5g23G63jI+PGzs7O3gtXxKJxP2qn0NdAcxNTk5OXmYyGQmHw8bIyIhsbm7K+fm56LouFxcXsry8LKOjo4bf7zey2SxL8qLe3y54cm1ra+thLpcTnLSysLDAUwpq/9tYw/z8vLmOyR4dHT1S7WJ6ejqAfVOBQMDcnED9pRlq80ySN4XH4szMzIBqgw8a6vlkd3eX11u5LHhjEuQIuQJePLObAJ1c2PB9PB6XlZUVsQqWZWNjQyKRiBQKhXexWMytbKALhPKz1ch2Eq0VkKD0A1J9fX0BZUFnGtmqOZ3OboyBYrGoBgcHFTZTVjE0NKToB/S6XC7u888yNCbgQEDOmVFRCqVp1kuZTCaV1+vl47d8Pl+xk4CGBGyzd29vT6H2vIU0dKGkqgdpBe5gMBhCEjqdQSZLta91AUWJ3bO+vv4c/jeVtW9NewnUglMv4EsdSI+NjcXh71c2WtEN8QljkzITKJfLTTWgUREpQmC/gbrL4uIiT08h8iob4A3cwZ4FJsC2KpVK5k3UG2osZ2dnZt9TfPidYPDDw8ME/CKwfmVTiJw+ny8IAn1YWloyv3rqJ5H+MLBdotGoQDV5Cfrq6uorzEdht3kQZRPsioGpqam76XSaKsQ7Lv/FsCT9cW1t7XUoFLoHv1g1uKeV0zdbSPayhv09PT23MLoa1pk3A26UYDmHw5FCmdhyX2HfYbpqAc0SYOtQxXqrI3/XxElTv8pAolL28lVjEi3/RdMumXfUmTS8q+eHoWwITgc1/ACISOO+I0u03wAAAABJRU5ErkJggg==") 4 28, pointer';

export class Comment extends System {
  private readonly cameras = this.query((q) => q.current.with(Camera));

  constructor() {
    super();
    this.query(
      (q) =>
        q.using(Canvas, Input, ComputedCamera).read.and.using(Cursor).write,
    );
  }

  execute(): void {
    this.cameras.current.forEach((camera) => {
      const { canvas } = camera.read(Camera);
      const api = canvas.read(Canvas).api as ExtendedAPI;

      const pen = api.getAppState().penbarSelected;
      if (pen !== Pen.COMMENT) {
        return;
      }

      const cursor = canvas.write(Cursor);
      if (cursor.value !== COMMENT_CURSOR) {
        cursor.value = COMMENT_CURSOR;
      }

      const input = canvas.read(Input);
      if (input.pointerDownTrigger) {
        const [viewportX, viewportY] = input.pointerViewport;
        const { x: canvasX, y: canvasY } = api.viewport2Canvas({
          x: viewportX,
          y: viewportY,
        });

        api.element.dispatchEvent(
          new CustomEvent(Event.COMMENT_ADDED, {
            detail: {
              canvasX,
              canvasY,
              viewportX,
              viewportY,
            },
          }),
        );
      }
    });
  }
}
