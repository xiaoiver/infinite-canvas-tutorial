// A real worker implementing the production protocol without downloading a model.
self.onmessage = ({ data: { requestId, type, data } }) => {
  if (type === 'ping') {
    self.postMessage({ requestId, type, data: { success: true }, done: true });
    return;
  }
  self.postMessage({ requestId, type: 'started', data: type });
  if (type === 'hold') return;
  self.postMessage({ requestId, type, data, done: true });
};
