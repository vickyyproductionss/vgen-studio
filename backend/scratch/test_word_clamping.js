import { getLocalWordTimings } from '../services/video.js';

function clampWordTimings(words, start_time, end_time) {
  if (!words || words.length === 0) return [];
  const duration = end_time - start_time;
  const adjustedLocal = getLocalWordTimings(words, start_time, duration);
  return words.map((w, idx) => ({
    ...w,
    start_time: Number((start_time + adjustedLocal[idx].start).toFixed(3)),
    end_time: Number((start_time + adjustedLocal[idx].end).toFixed(3))
  }));
}

function runTests() {
  console.log('--- Running Clamping Tests ---');

  // Case 1: Words are already well-formed and inside bounds
  const words1 = [
    { word: 'Hello', start_time: 1.0, end_time: 1.4 },
    { word: 'World', start_time: 1.5, end_time: 1.9 }
  ];
  const res1 = clampWordTimings(words1, 0.5, 2.5);
  console.log('Test 1 (Well-formed):', res1);
  if (res1[0].start_time !== 1.0 || res1[1].end_time !== 1.9) {
    throw new Error('Test 1 failed: Altered well-formed word boundaries');
  }

  // Case 2: Words spill outside scene boundaries
  const words2 = [
    { word: 'First', start_time: 0.2, end_time: 0.8 }, // starts before segment start (0.5)
    { word: 'Second', start_time: 1.0, end_time: 2.8 } // ends after segment end (2.5)
  ];
  const res2 = clampWordTimings(words2, 0.5, 2.5);
  console.log('Test 2 (Outside boundaries):', res2);
  if (res2[0].start_time < 0.5 || res2[1].end_time > 2.5) {
    throw new Error('Test 2 failed: Words did not get clamped to segment boundaries');
  }

  // Case 3: Sequential ordering verification
  const words3 = [
    { word: 'One', start_time: 1.0, end_time: 1.8 },
    { word: 'Two', start_time: 1.5, end_time: 2.2 } // Overlaps with word One
  ];
  const res3 = clampWordTimings(words3, 0.8, 2.5);
  console.log('Test 3 (Sequential ordering):', res3);
  if (res3[1].start_time < res3[0].end_time) {
    throw new Error('Test 3 failed: Words overlap after adjustment');
  }

  console.log('All tests passed successfully!');
}

runTests();
