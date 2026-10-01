// React lifecycle tests use a fake custom element and do not need native canvas.
// GPU rendering is verified in the browser suite. Disable jsdom's optional
// binding before Jest loads its environment (also supports --ignore-scripts).
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, ...args) {
  if (request === 'canvas') return {};
  return originalLoad.call(this, request, ...args);
};
