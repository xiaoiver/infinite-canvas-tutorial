/**
 * borrow from https://github.com/geronimi73/next-lama/blob/main/app/worker.js
 */

import { Tensor } from 'onnxruntime-web';
import * as ort from 'onnxruntime-web/all';

// ort.env.wasm.numThreads=0
// ort.env.wasm.simd = false;
ort.env.wasm.wasmPaths =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';

const LAMA_URL =
  'https://huggingface.co/g-ronimo/lama/resolve/main/lama_fp32.onnx';

export class LAMA {
  modelBuffer = null;
  modelSession = null;
  modelEp = null;
  image_encoded = null;

  constructor() {}

  async downloadModels() {
    this.modelBuffer = await this.downloadModel(LAMA_URL);
  }

  async downloadModel(url) {
    // step 1: check if cached
    const root = await navigator.storage.getDirectory();
    const filename = url.split('/').pop();

    let fileHandle = await root
      .getFileHandle(filename)
      .catch((e) => console.error('File does not exist:', filename, e));

    if (fileHandle) {
      const file = await fileHandle.getFile();
      if (file.size > 0) return await file.arrayBuffer();
    }

    // step 2: download if not cached
    console.log('File ' + filename + ' not in cache, downloading from ' + url);
    let buffer = null;
    try {
      buffer = await fetch(url, {
        headers: new Headers({
          Origin: location.origin,
        }),
        mode: 'cors',
      }).then((response) => response.arrayBuffer());
    } catch (e) {
      console.error('Download of ' + url + ' failed: ', e);
      return null;
    }

    // step 3: store
    try {
      const fileHandle = await root.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(buffer);
      await writable.close();

      console.log('Stored ' + filename);
    } catch (e) {
      console.error('Storage of ' + filename + ' failed: ', e);
    }
    return buffer;
  }

  async createSessions() {
    const [session, ep] = await this.getORTSession();

    return {
      success: session != null,
      device: ep,
    };
  }

  async getORTSession() {
    /** Creating a session with executionProviders: {"webgpu", "cpu"} fails
     *  => "Error: multiple calls to 'initWasm()' detected."
     *  but ONLY in Safari and Firefox (wtf)
     *  seems to be related to web worker, see https://github.com/microsoft/onnxruntime/issues/22113
     *  => loop through each ep, catch e if not available and move on
     */
    if (!this.modelSession) {
      // for (let ep of ["cpu"]) {
      for (let ep of ['webgpu', 'cpu']) {
        try {
          // console.log("loading model on", ep)
          this.modelSession = await ort.InferenceSession.create(
            this.modelBuffer,
            { executionProviders: [ep] },
          );
          this.modelEp = ep;
          break;
        } catch (e) {
          console.error(e);
          continue;
        }
      }
    }
    return [this.modelSession, this.modelEp];
  }

  async removeArea(imageTensor, maskTensor) {
    const [session, device] = await this.getORTSession();
    const results = await session.run({
      image: imageTensor,
      mask: maskTensor,
    });

    console.log(results);

    return results;
  }
}

const lama = new LAMA();

self.onmessage = async (e) => {
  console.log('worker received message', e.data);

  const { type, data } = e.data;

  if (type === 'ping') {
    self.postMessage({ type: 'downloadInProgress' });
    await lama.downloadModels();

    self.postMessage({ type: 'loadingInProgress' });
    const report = await lama.createSessions();

    self.postMessage({ type: 'pong', data: report });
  } else if (type === 'runRemove') {
    const { imgArray, imgArrayShape, maskArray, maskArrayShape } = data;

    const imgTensor = new Tensor('float32', imgArray, imgArrayShape);
    const maskTensor = new Tensor('float32', maskArray, maskArrayShape);

    const result = await lama.removeArea(imgTensor, maskTensor);

    // result.output is the
    self.postMessage({ type: 'removeDone', data: result.output });
  } else {
    throw new Error(`Unknown message type: ${type}`);
  }
};
