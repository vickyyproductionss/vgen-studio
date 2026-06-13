import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

const ai = new GoogleGenAI({
  enterprise: true,
  project: 'flowsocial-498207',
  location: 'us-central1'
});

async function main() {
  try {
    console.log('Generating image...');
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: 'A high quality vertical photo of a neon cyber city at night, portrait aspect ratio, detailed, 8k',
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '9:16',
      }
    });

    console.log('Response keys:', Object.keys(response));
    if (response.generatedImages && response.generatedImages.length > 0) {
      const img = response.generatedImages[0];
      const base64Bytes = img.image.imageBytes;
      const buffer = Buffer.from(base64Bytes, 'base64');
      fs.writeFileSync('test-imagen-out.jpg', buffer);
      console.log('Image saved successfully to test-imagen-out.jpg!');
    } else {
      console.error('No images generated:', response);
    }
  } catch (err) {
    console.error('Error in Imagen generation:', err);
  }
}

main();
