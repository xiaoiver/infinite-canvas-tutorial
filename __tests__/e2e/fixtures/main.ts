import * as demos from './demos';
import { initExample } from './utils';

const select = document.createElement('select');
select.id = 'example-select';
select.style.margin = '1em';
select.onchange = onChange;
select.style.display = 'block';
document.body.append(select);

const options = Object.keys(demos).map((d) => {
  const option = document.createElement('option');
  option.textContent = d;
  option.value = d;
  return option;
});
options.forEach((d) => select.append(d));

const initialValue = new URL(location as any).searchParams.get(
  'name',
) as string;
const renderer =
  (new URL(location as any).searchParams.get('renderer') as
    | 'webgl'
    | 'webgpu'
    | undefined) || 'webgl';
if (demos[initialValue]) select.value = initialValue;

const $container = document.getElementById('container')!;

let callback: () => void;
render();

async function render() {
  if (callback) {
    callback();
  }
  $container.innerHTML = '';

  const demo = demos[select.value];
  callback = await initExample($container, demo, renderer);

  // @ts-ignore
  if (window.screenshot) {
    // @ts-ignore
    await window.screenshot();
  }
}

function onChange() {
  const { value } = select;
  history.pushState({ value }, '', `?name=${value}&renderer=${renderer}`);
  render();
}
