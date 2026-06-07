const scene = {
  text: 'This is a gym workout that is very strong and hot.',
  start_time: 0.0,
  end_time: 5.0,
  words: [
    { word: 'This', start_time: 0.0, end_time: 0.5 },
    { word: 'is', start_time: 0.5, end_time: 1.0 },
    { word: 'a', start_time: 1.0, end_time: 1.5 },
    { word: 'gym', start_time: 1.5, end_time: 2.2 },
    { word: 'workout', start_time: 2.2, end_time: 3.2 },
    { word: 'that', start_time: 3.2, end_time: 3.7 },
    { word: 'is', start_time: 3.7, end_time: 4.2 },
    { word: 'strong', start_time: 4.2, end_time: 5.0 }
  ]
};

const sceneDuration = 5.0;

const localWords = scene.words.map(item => ({
  word: item.word,
  start: Math.max(0, item.start_time - scene.start_time),
  end: Math.min(sceneDuration, item.end_time - scene.start_time)
}));

const chunks = [];
let currentChunk = [];
let currentLen = 0;
for (let i = 0; i < localWords.length; i++) {
  const item = localWords[i];
  if (currentChunk.length >= 3 || (currentChunk.length > 0 && currentLen + item.word.length > 20)) {
    chunks.push(currentChunk);
    currentChunk = [item];
    currentLen = item.word.length;
  } else {
    currentChunk.push(item);
    currentLen += (currentChunk.length > 1 ? 1 : 0) + item.word.length;
  }
}
if (currentChunk.length > 0) {
  chunks.push(currentChunk);
}

console.log('Chunks generated:', chunks.map(c => c.map(w => w.word)));

for (let j = 0; j < scene.words.length; j++) {
  const w = scene.words[j];
  
  let activeChunk = null;
  let activeWordIdxInChunk = -1;
  
  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const chunk = chunks[cIdx];
    const idx = chunk.findIndex(item => item.word === w.word && Math.abs(item.start - (w.start_time - scene.start_time)) < 0.01);
    if (idx !== -1) {
      activeChunk = chunk;
      activeWordIdxInChunk = idx;
      break;
    }
  }
  
  console.log(`Word: "${w.word}", Found activeChunk? ${activeChunk !== null}, idx: ${activeWordIdxInChunk}`);
}
