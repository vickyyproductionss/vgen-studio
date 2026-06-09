import { alignWordSequences, assignTimestampsToWords, mapTimestamps } from '../services/speech.js';

function runTests() {
  console.log("--- Running Cross-Script Alignment Tests ---");

  // Sample Hinglish reference script words
  const allHinglishWords = [
    "Agar", "tum", "gym", "bhi", "ja", "rahe", "ho", "aur", "fat", "loss", "phir", "bhi", "nahin", "ho", "raha"
  ];
  
  // Sample Hindi Devanagari reference script words
  const allHindiWords = [
    "अगर", "तुम", "जिम", "भी", "जा", "रहे", "हो", "और", "फैट", "लॉस", "फिर", "भी", "नहीं", "हो", "रहा"
  ];

  // Simulated GCP STT results (Devanagari)
  const gcpWords = [
    { word: "अगर", start_time: 0.0, end_time: 0.5 },
    { word: "तुम", start_time: 0.5, end_time: 0.8 },
    { word: "जिम", start_time: 0.8, end_time: 1.2 },
    { word: "भी", start_time: 1.2, end_time: 1.3 },
    { word: "जा", start_time: 1.3, end_time: 1.5 },
    { word: "रहे", start_time: 1.5, end_time: 1.6 },
    { word: "हो", start_time: 1.6, end_time: 1.6 },
    { word: "और", start_time: 1.6, end_time: 1.8 },
    { word: "फैट", start_time: 1.8, end_time: 2.0 },
    { word: "लॉस", start_time: 2.0, end_time: 2.2 },
    { word: "फिर", start_time: 2.2, end_time: 2.5 },
    { word: "भी", start_time: 2.5, end_time: 2.7 },
    { word: "नहीं", start_time: 2.7, end_time: 2.8 },
    { word: "हो", start_time: 2.8, end_time: 3.0 },
    { word: "रहा", start_time: 3.0, end_time: 3.1 }
  ];

  // 1. Detect if gcpWords is Devanagari
  const isDevanagari = gcpWords.some(w => /[\u0900-\u097F]/.test(w.word));
  console.log("Is Devanagari detected?", isDevanagari);

  let alignedHinglish = [];
  let alignedHindi = [];

  if (isDevanagari) {
    console.log("Aligning Hindi with GCP...");
    alignedHindi = assignTimestampsToWords(allHindiWords, gcpWords);
    console.log("Mapping aligned Hindi to Hinglish...");
    alignedHinglish = mapTimestamps(alignedHindi, allHinglishWords);
  } else {
    console.log("Aligning Hinglish with GCP...");
    alignedHinglish = assignTimestampsToWords(allHinglishWords, gcpWords);
    console.log("Mapping aligned Hinglish to Hindi...");
    alignedHindi = mapTimestamps(alignedHinglish, allHindiWords);
  }

  console.log("\nAligned Hindi timestamps:");
  for (let i = 0; i < alignedHindi.length; i++) {
    console.log(`  - ${alignedHindi[i].word}: ${alignedHindi[i].start_time}s to ${alignedHindi[i].end_time}s`);
  }

  console.log("\nAligned Hinglish timestamps:");
  for (let i = 0; i < alignedHinglish.length; i++) {
    console.log(`  - ${alignedHinglish[i].word}: ${alignedHinglish[i].start_time}s to ${alignedHinglish[i].end_time}s`);
  }

  // Verification assertions
  if (alignedHindi[0].start_time !== 0.0 || alignedHindi[14].end_time !== 3.1) {
    throw new Error("Alignment failed: Start or end times did not align correctly");
  }
  if (alignedHinglish[0].start_time !== 0.0 || alignedHinglish[14].end_time !== 3.1) {
    throw new Error("Mapping failed: Hinglish start or end times are incorrect");
  }

  console.log("\n✅ Cross-script alignment test passed successfully!");
}

runTests();
