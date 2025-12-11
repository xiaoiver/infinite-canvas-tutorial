import { Tensor } from 'onnxruntime-web';
import * as ort from 'onnxruntime-web/all';

const ENCODER_URL =
  'https://huggingface.co/g-ronimo/sam2-tiny/resolve/main/sam2_hiera_tiny_encoder.with_runtime_opt.ort';
const DECODER_URL =
  'https://huggingface.co/g-ronimo/sam2-tiny/resolve/main/sam2_hiera_tiny_decoder.onnx';

class SAM2 {
  bufferEncoder = null;
  bufferDecoder = null;
  sessionEncoder = null;
  sessionDecoder = null;
  image_encoded = null;

  constructor() {}

  async downloadModels() {
    this.bufferEncoder = await this.downloadModel(ENCODER_URL);
    this.bufferDecoder = await this.downloadModel(DECODER_URL);
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
    // console.log("File " + filename + " not in cache, downloading from " + url);
    console.log('File not in cache, downloading from ' + url);
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
    const success =
      (await this.getEncoderSession()) && (await this.getDecoderSession());

    return {
      success: success,
      device: success ? this.sessionEncoder[1] : null,
    };
  }

  async getORTSession(model) {
    /** Creating a session with executionProviders: {"webgpu", "cpu"} fails
     *  => "Error: multiple calls to 'initWasm()' detected."
     *  but ONLY in Safari and Firefox (wtf)
     *  seems to be related to web worker, see https://github.com/microsoft/onnxruntime/issues/22113
     *  => loop through each ep, catch e if not available and move on
     */
    let session = null;
    for (let ep of ['webgpu', 'cpu']) {
      try {
        session = await ort.InferenceSession.create(model, {
          executionProviders: [ep],
        });
      } catch (e) {
        console.error(e);
        continue;
      }

      return [session, ep];
    }
  }

  async getEncoderSession() {
    if (!this.sessionEncoder)
      this.sessionEncoder = await this.getORTSession(this.bufferEncoder);

    return this.sessionEncoder;
  }

  async getDecoderSession() {
    if (!this.sessionDecoder)
      this.sessionDecoder = await this.getORTSession(this.bufferDecoder);

    return this.sessionDecoder;
  }

  async encodeImage(inputTensor) {
    const [session, device] = await this.getEncoderSession();
    const results = await session.run({ image: inputTensor });

    this.image_encoded = {
      high_res_feats_0: results[session.outputNames[0]],
      high_res_feats_1: results[session.outputNames[1]],
      image_embed: results[session.outputNames[2]],
    };
  }

  async decode(points, masks) {
    const [session, device] = await this.getDecoderSession();
    const point = points[0];

    const inputs = {
      image_embed: this.image_encoded.image_embed,
      high_res_feats_0: this.image_encoded.high_res_feats_0,
      high_res_feats_1: this.image_encoded.high_res_feats_1,
      point_coords: new Tensor('float32', [point.x, point.y], [1, 1, 2]),
      point_labels: new Tensor('float32', [point.label], [1, 1]),
      mask_input: new Tensor(
        'float32',
        new Float32Array(256 * 256),
        [1, 1, 256, 256],
      ),
      has_mask_input: new Tensor('float32', [0], [1]),
      orig_im_size: new Tensor('int32', [1024, 1024], [2]),
    };

    return await session.run(inputs);
  }
}

const stats = {
  device: 'unknown',
  downloadModelsTime: [],
  encodeImageTimes: [],
  decodeTimes: [],
};

const sam = new SAM2();

// eslint-disable-next-line no-undef
self.onmessage = async (e) => {
  const { type, data } = e.data;

  if (type === 'ping') {
    self.postMessage({ type: 'downloadInProgress' });
    const startTime = performance.now();
    await sam.downloadModels();
    const durationMs = performance.now() - startTime;
    stats.downloadModelsTime.push(durationMs);

    self.postMessage({ type: 'loadingInProgress' });
    const report = await sam.createSessions();

    stats.device = report.device;

    self.postMessage({ type: 'pong', data: report });
    self.postMessage({ type: 'stats', data: stats });
  } else if (type === 'encodeImage') {
    const { float32Array, shape } = data;
    const imgTensor = new Tensor('float32', float32Array, shape);

    const startTime = performance.now();
    await sam.encodeImage(imgTensor);
    const durationMs = performance.now() - startTime;
    stats.encodeImageTimes.push(durationMs);

    self.postMessage({
      type: 'encodeImageDone',
      data: { durationMs: durationMs },
    });
    self.postMessage({ type: 'stats', data: stats });
  } else if (type === 'decodeMask') {
    const { points, maskArray, maskShape } = data;

    const startTime = performance.now();

    let decodingResults;
    if (maskArray) {
      const maskTensor = new Tensor('float32', maskArray, maskShape);
      decodingResults = await sam.decode(points, maskTensor);
    } else {
      decodingResults = await sam.decode(points);
    }
    // decodingResults = Tensor [B=1, Masks, W, H]

    self.postMessage({ type: 'decodeMaskResult', data: decodingResults });
    self.postMessage({ type: 'stats', data: stats });
  } else if (type === 'stats') {
    self.postMessage({ type: 'stats', data: stats });
  } else {
    throw new Error(`Unknown message type: ${type}`);
  }
};
