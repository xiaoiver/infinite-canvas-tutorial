export function measureHTML(html: string) {
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'nowrap'; // 如果你想单行测量
  div.innerHTML = html;
  document.body.appendChild(div);

  const rect = {
    width: div.offsetWidth,
    height: div.offsetHeight,
  };

  document.body.removeChild(div);
  return rect;
}
