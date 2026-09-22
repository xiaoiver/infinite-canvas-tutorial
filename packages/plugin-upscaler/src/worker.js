import Upscaler from 'upscaler';
import * as models from '@upscalerjs/esrgan-medium';
import * as tf from '@tensorflow/tfjs';

const upscaler = new Upscaler({
  model: models.x4,
});

const upscaleImage = async ([data, shape]) => {
  const tensor = tf.tensor(data, shape);

  let upscaledImg;
  try {
    upscaledImg = await upscaler.upscale(tensor, {
      output: 'tensor',
      patchSize: 16,
      padding: 2,
    });
    const upscaledShape = upscaledImg.shape;
    const upscaledData = await upscaledImg.data();
    return [upscaledData, upscaledShape];
  } finally {
    tensor.dispose();
    upscaledImg?.dispose();
  }
};

async function warmUp() {
  await upscaler.warmup({ patchSize: 16, padding: 2 });
}

self.onmessage = async (e) => {
  const { type, data, requestId } = e.data;
  const reply = (message) => self.postMessage({ ...message, requestId });
  try {
    if (type === 'ping') {
      await warmUp();
      reply({ done: true, type: 'pong' });
    } else if (type === 'upscaleImage') {
      const result = await upscaleImage(data);
      reply({ done: true, type: 'upscaleImageDone', data: result });
    }
  } catch (error) {
    reply({
      done: true,
      type: 'error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
