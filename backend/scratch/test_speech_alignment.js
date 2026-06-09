import { alignWordSequences, assignTimestampsToWords, mapTimestamps } from '../services/speech.js';

function runTests() {
  console.log("--- Running Sequence Alignment Tests ---");

  // Case 1: Exact matches
  const script1 = ["Hello", "world", "this", "is", "a", "test"];
  const gcp1 = [
    { word: "Hello", start_time: 0.1, end_time: 0.4 },
    { word: "world", start_time: 0.5, end_time: 0.8 },
    { word: "this", start_time: 0.9, end_time: 1.2 },
    { word: "is", start_time: 1.3, end_time: 1.5 },
    { word: "a", start_time: 1.6, end_time: 1.7 },
    { word: "test", start_time: 1.8, end_time: 2.2 }
  ];
  
  const aligned1 = assignTimestampsToWords(script1, gcp1);
  console.log("Aligned 1 (Exact Match):", aligned1);
  if (aligned1[0].start_time !== 0.1 || aligned1[5].end_time !== 2.2) {
    throw new Error("Case 1 failed: Incorrect timestamps on exact match");
  }

  // Case 2: Missing spoken words (Script has words, GCP STT missed them)
  const script2 = ["Hello", "beautiful", "world", "today"];
  const gcp2 = [
    { word: "Hello", start_time: 0.1, end_time: 0.4 },
    // "beautiful" is missed by GCP STT
    { word: "world", start_time: 0.9, end_time: 1.2 },
    { word: "today", start_time: 1.3, end_time: 1.7 }
  ];
  const aligned2 = assignTimestampsToWords(script2, gcp2);
  console.log("Aligned 2 (Missed spoken word):", aligned2);
  if (aligned2[1].start_time === null || aligned2[1].start_time < 0.4 || aligned2[1].end_time > 0.9) {
    throw new Error("Case 2 failed: Missed word did not get interpolated correctly");
  }

  // Case 3: Extra spoken words (GCP STT transcribed words not in script)
  const script3 = ["Hello", "world"];
  const gcp3 = [
    { word: "Hello", start_time: 0.1, end_time: 0.4 },
    { word: "uh", start_time: 0.5, end_time: 0.7 }, // filler word
    { word: "world", start_time: 0.8, end_time: 1.2 }
  ];
  const aligned3 = assignTimestampsToWords(script3, gcp3);
  console.log("Aligned 3 (Extra spoken words):", aligned3);
  if (aligned3[0].end_time !== 0.4 || aligned3[1].start_time !== 0.8) {
    throw new Error("Case 3 failed: Did not skip extra spoken words correctly");
  }

  // Case 4: Map source timestamps to a target list of different size
  const src = [
    { word: "a", start_time: 1.0, end_time: 1.5 },
    { word: "b", start_time: 1.6, end_time: 2.1 }
  ];
  const tgt = ["X", "Y", "Z"];
  const mapped = mapTimestamps(src, tgt);
  console.log("Mapped 4 (Source to target different lengths):", mapped);
  if (mapped.length !== 3 || mapped[0].start_time !== 1.0 || mapped[2].end_time !== 2.1) {
    throw new Error("Case 4 failed: Incorrect length mapping");
  }

  console.log("✅ All alignment tests passed successfully!");
}

runTests();
