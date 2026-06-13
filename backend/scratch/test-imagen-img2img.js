import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const ai = new GoogleGenAI({
  enterprise: true,
  project: 'flowsocial-498207',
  location: 'us-central1'
});

async function main() {
  try {
    const baseImagePath = path.resolve('test-imagen-out.jpg');
    if (!fs.existsSync(baseImagePath)) {
      console.error('Base image does not exist. Run test-imagen.js first.');
      return;
    }

    const base64Image = fs.readFileSync(baseImagePath).toString('base64');
    console.log('Sending image-to-image generation request...');

    // In modern SDK, image-to-image is typically passed as 'image' alongside the prompt
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: 'A close-up portrait of a subject wearing sunglasses, high quality, 8k',
      image: {
        imageBytes: base64Image,
        mimeType: 'image/jpeg'
      },
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '9:16'
      }
    });

    console.log('Response keys:', Object.keys(response));
    if (response.generatedImages && response.generatedImages.length > 0) {
      const img = response.generatedImages[0];
      const buffer = Buffer.from(img.image.imageBytes, 'base64');
      fs.writeFileSync('test-imagen-img2img-out.jpg', buffer);
      console.log('Image-to-Image generated successfully! Saved to test-imagen-img2img-out.jpg');
    } else {
      console.error('No images generated:', response);
    }
  } catch (err) {
    console.error('Error in Imagen img2img:', err);
  }
}

main();
