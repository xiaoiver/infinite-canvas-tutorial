import { TextEncoder, TextDecoder } from 'node:util';

Object.assign(globalThis, {
  TextEncoder,
  TextDecoder,
  IS_REACT_ACT_ENVIRONMENT: true,
});
// jsdom does not expose Node's structuredClone on its window global.
if (!globalThis.structuredClone) {
  globalThis.structuredClone = (value) => JSON.parse(JSON.stringify(value));
}
