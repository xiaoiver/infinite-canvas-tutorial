import Upscaler from 'upscaler';
import * as models from '@upscalerjs/esrgan-medium';
import * as tf from '@tensorflow/tfjs';

const upscaler = new Upscaler({
  model: models.x4,
});

const upscaleImage = async ([data, shape]) => {
  const tensor = tf.tensor(data, shape);

  try {
    const upscaledImg = await upscaler.upscale(tensor, {
      output: 'tensor',
      patchSize: 16,
      padding: 2,
    });
    const upscaledShape = upscaledImg.shape;
    const upscaledData = await upscaledImg.data();
    return [upscaledData, upscaledShape];
  } catch (error) {
    console.error('Error upscale image:', error);
  }
};

async function warmUp() {
  await upscaler.warmup({ patchSize: 16, padding: 2 });
}

self.onmessage = async (e) => {
  const { type, data } = e.data;
  if (type === 'ping') {
    await warmUp();
    self.postMessage({ type: 'pong' });
  } else if (type === 'upscaleImage') {
    const result = await upscaleImage(data);
    self.postMessage({ type: 'upscaleImageDone', data: result });
  }
};
