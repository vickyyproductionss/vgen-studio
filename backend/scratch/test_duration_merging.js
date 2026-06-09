// Test script to verify segment duration merging logic
const enforceMinimumSegmentDuration = (segs) => {
  if (!segs || segs.length <= 1) return segs;
  
  const minDuration = 2.0;
  const result = [];
  const segsCopy = segs.map(s => ({ ...s }));
  
  // First pass: merge short segments
  for (let i = 0; i < segsCopy.length; i++) {
    const current = segsCopy[i];
    const dur = current.end_time - current.start_time;
    
    if (dur < minDuration) {
      if (result.length > 0) {
        const prev = result[result.length - 1];
        console.log(`[Post-processing Aligner] Merging short segment ${i} (${dur.toFixed(2)}s) into previous segment (${(prev.end_time - prev.start_time).toFixed(2)}s)`);
        
        prev.end_time = Number(current.end_time.toFixed(3));
        prev.text = ((prev.text || '') + ' ' + (current.text || '')).trim();
        prev.text_hindi = ((prev.text_hindi || '') + ' ' + (current.text_hindi || '')).trim();
        prev.text_hinglish = ((prev.text_hinglish || '') + ' ' + (current.text_hinglish || '')).trim();
        
        prev.words = [...(prev.words || []), ...(current.words || [])];
        prev.words_hindi = [...(prev.words_hindi || []), ...(current.words_hindi || [])];
        prev.words_hinglish = [...(prev.words_hinglish || []), ...(current.words_hinglish || [])];
        
        if (current.isBeatSyncOnly && prev.isBeatSyncOnly) {
          prev.isBeatSyncOnly = true;
        } else {
          delete prev.isBeatSyncOnly;
        }
      } else if (i + 1 < segsCopy.length) {
        const next = segsCopy[i + 1];
        console.log(`[Post-processing Aligner] Merging short segment ${i} (${dur.toFixed(2)}s) forward into next segment (${(next.end_time - next.start_time).toFixed(2)}s)`);
        
        next.start_time = Number(current.start_time.toFixed(3));
        next.text = ((current.text || '') + ' ' + (next.text || '')).trim();
        next.text_hindi = ((current.text_hindi || '') + ' ' + (next.text_hindi || '')).trim();
        next.text_hinglish = ((current.text_hinglish || '') + ' ' + (next.text_hinglish || '')).trim();
        
        next.words = [...(current.words || []), ...(next.words || [])];
        next.words_hindi = [...(current.words_hindi || []), ...(next.words_hindi || [])];
        next.words_hinglish = [...(current.words_hinglish || []), ...(next.words_hinglish || [])];
        
        if (current.isBeatSyncOnly && next.isBeatSyncOnly) {
          next.isBeatSyncOnly = true;
        } else {
          delete next.isBeatSyncOnly;
        }
      } else {
        result.push(current);
      }
    } else {
      result.push(current);
    }
  }
  
  // Clean up pass: check if the last segment is too short and merge it back
  if (result.length > 1) {
    const lastIdx = result.length - 1;
    const last = result[lastIdx];
    const lastDur = last.end_time - last.start_time;
    if (lastDur < minDuration) {
      const prev = result[lastIdx - 1];
      console.log(`[Post-processing Aligner] Clean up merge: Merging last segment (${lastDur.toFixed(2)}s) into previous segment`);
      
      prev.end_time = Number(last.end_time.toFixed(3));
      prev.text = ((prev.text || '') + ' ' + (last.text || '')).trim();
      prev.text_hindi = ((prev.text_hindi || '') + ' ' + (last.text_hindi || '')).trim();
      prev.text_hinglish = ((prev.text_hinglish || '') + ' ' + (last.text_hinglish || '')).trim();
      
      prev.words = [...(prev.words || []), ...(last.words || [])];
      prev.words_hindi = [...(prev.words_hindi || []), ...(last.words_hindi || [])];
      prev.words_hinglish = [...(prev.words_hinglish || []), ...(last.words_hinglish || [])];
      
      if (last.isBeatSyncOnly && prev.isBeatSyncOnly) {
        prev.isBeatSyncOnly = true;
      } else {
        delete prev.isBeatSyncOnly;
      }
      result.pop();
    }
  }
  
  return result;
};

// ----------------------------------------------------
// RUN TEST SUITE
// ----------------------------------------------------
const testCases = [
  {
    name: "Standard well-spaced segments",
    input: [
      { start_time: 0.0, end_time: 2.5, text: "First segment" },
      { start_time: 2.5, end_time: 5.5, text: "Second segment" }
    ],
    expectedLength: 2,
    verify: (res) => {
      if (res[0].start_time !== 0.0 || res[0].end_time !== 2.5) return false;
      if (res[1].start_time !== 2.5 || res[1].end_time !== 5.5) return false;
      return true;
    }
  },
  {
    name: "First segment too short - merge forward",
    input: [
      { start_time: 0.0, end_time: 1.2, text: "Short first" },
      { start_time: 1.2, end_time: 3.5, text: "Second one" }
    ],
    expectedLength: 1,
    verify: (res) => {
      if (res[0].start_time !== 0.0 || res[0].end_time !== 3.5) return false;
      if (res[0].text !== "Short first Second one") return false;
      return true;
    }
  },
  {
    name: "Second segment too short - merge backward",
    input: [
      { start_time: 0.0, end_time: 2.5, text: "Good first" },
      { start_time: 2.5, end_time: 3.8, text: "Short second" }
    ],
    expectedLength: 1,
    verify: (res) => {
      if (res[0].start_time !== 0.0 || res[0].end_time !== 3.8) return false;
      if (res[0].text !== "Good first Short second") return false;
      return true;
    }
  },
  {
    name: "Three segments, middle is short - merge backward",
    input: [
      { start_time: 0.0, end_time: 2.2, text: "First" },
      { start_time: 2.2, end_time: 3.5, text: "Short middle" },
      { start_time: 3.5, end_time: 5.8, text: "Third" }
    ],
    expectedLength: 2,
    verify: (res) => {
      if (res[0].start_time !== 0.0 || res[0].end_time !== 3.5) return false;
      if (res[1].start_time !== 3.5 || res[1].end_time !== 5.8) return false;
      if (res[0].text !== "First Short middle") return false;
      return true;
    }
  },
  {
    name: "Multiple short segments resulting in one combined segment",
    input: [
      { start_time: 0.0, end_time: 1.0, text: "A" },
      { start_time: 1.0, end_time: 2.0, text: "B" },
      { start_time: 2.0, end_time: 2.8, text: "C" }
    ],
    expectedLength: 1,
    verify: (res) => {
      if (res[0].start_time !== 0.0 || res[0].end_time !== 2.8) return false;
      if (res[0].text !== "A B C") return false;
      return true;
    }
  }
];

let failed = false;
for (const tc of testCases) {
  console.log(`\n--- Running Test: ${tc.name} ---`);
  const output = enforceMinimumSegmentDuration(tc.input);
  console.log("Output:", output);
  if (output.length !== tc.expectedLength || !tc.verify(output)) {
    console.error(`❌ Test failed!`);
    failed = true;
  } else {
    console.log(`✅ Test passed!`);
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log("\n🎉 All merge duration tests passed successfully!");
}
