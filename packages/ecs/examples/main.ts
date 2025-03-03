import { App, Commands, Transform } from '../src';

const $canvas = document.getElementById('canvas') as HTMLCanvasElement;
const resize = (width: number, height: number) => {
  $canvas.width = width * window.devicePixelRatio;
  $canvas.height = height * window.devicePixelRatio;
  $canvas.style.width = `${width}px`;
  $canvas.style.height = `${height}px`;
  $canvas.style.outline = 'none';
  $canvas.style.padding = '0px';
  $canvas.style.margin = '0px';
};
resize(window.innerWidth, window.innerHeight);

let started = false;

const app = new App({
  canvas: $canvas,
})
  .addSystems(({ commands }) => {
    if (started) return;
    started = true;

    const parent = commands.spawn(Transform);
    const child = commands.spawn(Transform);
    const grandChild = commands.spawn(Transform);
    parent.appendChild(child);
    child.appendChild(grandChild);

    commands.execute();

    parent.id().set(Transform, (transform) => {
      transform.position.set(100, 100);
      return transform;
    });

    console.log(parent.id().get(Transform)?.worldTransform);
    console.log(child.id().get(Transform)?.worldTransform);
    console.log(grandChild.id().get(Transform)?.worldTransform);
    child.id().set(Transform, (transform) => {
      transform.position.set(200, 200);
      return transform;
    });

    child.removeChild(grandChild);
  })
  .run();

// window.addEventListener('resize', () => {
//   resize(window.innerWidth, window.innerHeight);
//   canvas.resize(window.innerWidth, window.innerHeight);
// });
