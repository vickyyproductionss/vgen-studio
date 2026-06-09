import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  enterprise: true,
  project: 'flowsocial-498207',
  location: 'us-central1'
});

async function testModel(modelName) {
  try {
    console.log(`Testing ${modelName}...`);
    const response = await ai.models.generateContent({
      model: modelName,
      contents: 'Say "OK"'
    });
    console.log(`✅ SUCCESS [${modelName}]:`, response.text.trim());
    return true;
  } catch (err) {
    console.error(`❌ FAILED  [${modelName}]:`, err.message);
    return false;
  }
}

async function main() {
  console.log("Probing 2.5 Pro models on Vertex AI...");
  const models = [
    'gemini-2.5-pro',
    'gemini-2.5-pro-001',
    'gemini-2.5-pro-preview',
  ];
  
  for (const model of models) {
    await testModel(model);
    console.log("---------------------------------------");
  }
}

main();
