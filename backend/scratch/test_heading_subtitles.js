import { createAssFileContent } from '../services/video.js';

console.log('--- Starting Custom Hook Heading Subtitle Test ---');

const dummyScene1 = {
  text: "Welcome to this amazing tutorial about agentic workflows.",
  start_time: 0.0,
  end_time: 4.0,
  words: [
    { word: "Welcome", start_time: 0.1, end_time: 0.5 },
    { word: "to", start_time: 0.5, end_time: 0.7 },
    { word: "this", start_time: 0.7, end_time: 0.9 },
    { word: "amazing", start_time: 0.9, end_time: 1.4 },
    { word: "tutorial", start_time: 1.4, end_time: 2.0 },
    { word: "about", start_time: 2.0, end_time: 2.4 },
    { word: "agentic", start_time: 2.4, end_time: 3.0 },
    { word: "workflows.", start_time: 3.0, end_time: 3.8 }
  ]
};

const dummyScene2 = {
  text: "We will build a video generator from scratch.",
  start_time: 2.5,
  end_time: 5.0,
  words: [
    { word: "We", start_time: 2.6, end_time: 2.9 },
    { word: "will", start_time: 2.9, end_time: 3.2 },
    { word: "build", start_time: 3.2, end_time: 3.6 },
    { word: "a", start_time: 3.6, end_time: 3.8 },
    { word: "video", start_time: 3.8, end_time: 4.2 },
    { word: "generator", start_time: 4.2, end_time: 4.7 },
    { word: "from", start_time: 4.7, end_time: 4.9 },
    { word: "scratch.", start_time: 4.9, end_time: 5.0 }
  ]
};

const subtitleStyle = {
  subtitleMode: 'smart-highlight',
  fontName: 'Arial',
  fontSize: 24,
  fontColor: '#FFFFFF',
  outlineColor: '#000000',
  bold: true,
  headingTitle: "AGENTIC WORKFLOWS 🚀",
  headingFontName: "Montserrat",
  headingFontSize: 20,
  headingFontColor: "#FFFF00",
  headingBoxColor: "#111111",
  headingPadding: 8,
  showTimer: true,
  headingTopOffset: 10,
  headingLeftOffset: 15
};

// 1. Test Scene 1 (starts at 0.0s, ends at 4.0s - overlaps [0.0, 3.0] entirely, starts at 0.0s)
console.log('\n--- Test 1: Scene 1 (starts at 0.0s) ---');
const ass1 = createAssFileContent(dummyScene1, 4.0, subtitleStyle, 1280, 720, 5.0);
console.log('Resulting ASS Content:');
console.log(ass1);

// Verifications for Test 1 (Heading)
if (!ass1.includes('Style: Heading,Montserrat,')) {
  throw new Error('FAIL: Heading style definition not found in ASS header');
}
// Width = 1280, LeftOffset = 15% -> marginL = 1280 * 0.15 = 192
// Height = 720, TopOffset = 10% -> marginV = 720 * 0.1 = 72
if (!ass1.includes(',192,640,72,1')) {
  throw new Error('FAIL: Custom margins for Heading style not applied correctly in header');
}
if (!ass1.includes('Dialogue: 10,0:00:00.00,0:00:00.40,Heading')) {
  throw new Error('FAIL: Heading entry event (slide-in) not found');
}
if (!ass1.includes('Dialogue: 10,0:00:00.40,0:00:02.70,Heading')) {
  throw new Error('FAIL: Heading middle event (static) not found');
}
if (!ass1.includes('Dialogue: 10,0:00:02.70,0:00:03.00,Heading')) {
  throw new Error('FAIL: Heading exit event (slide-out) not found');
}

// Verifications for Test 1 (Timer)
if (!ass1.includes('Style: Timer,Montserrat,')) {
  throw new Error('FAIL: Timer style definition not found in ASS header');
}
// Timer alignment 9, marginR = 1280 * 0.15 = 192, marginV = 72
if (!ass1.includes('Style: Timer,Montserrat,20,&H0000FFFF,&H000000FF,&H00000000,&HB0111111,-1,0,0,0,100,100,0,0,3,9,0,9,640,192,72,1')) {
  throw new Error('FAIL: Timer style declaration is incorrect');
}

// Second-by-second countdown events
// Total duration is 5.0. Total countdown seconds: 5s, 4s, 3s, 2s, 1s
// Scene 1 duration is 4.0. We should see countdown segments overlapping this scene:
// sec 0: 0.0 to 1.0 (text: 5s) -> entry animation (since sec === 0 && start === 0.0)
if (!ass1.includes('Dialogue: 10,0:00:00.00,0:00:01.00,Timer,,0,0,0,,{\\an9\\move(1380,72,1088,72,0,400)\\fad(400,0)}5s')) {
  throw new Error('FAIL: Timer entry segment (5s) not found or incorrect');
}
// sec 1: 1.0 to 2.0 (text: 4s) -> static pos
if (!ass1.includes('Dialogue: 10,0:00:01.00,0:00:02.00,Timer,,0,0,0,,{\\an9\\pos(1088,72)}4s')) {
  throw new Error('FAIL: Timer segment (4s) not found');
}
// sec 2: 2.0 to 3.0 (text: 3s)
if (!ass1.includes('Dialogue: 10,0:00:02.00,0:00:03.00,Timer,,0,0,0,,{\\an9\\pos(1088,72)}3s')) {
  throw new Error('FAIL: Timer segment (3s) not found');
}
// sec 3: 3.0 to 4.0 (text: 2s)
if (!ass1.includes('Dialogue: 10,0:00:03.00,0:00:04.00,Timer,,0,0,0,,{\\an9\\pos(1088,72)}2s')) {
  throw new Error('FAIL: Timer segment (2s) not found');
}
console.log('SUCCESS: Scene 1 ASS verification passed!');

// 2. Test Scene 2 (starts at 2.5s, ends at 5.0s - overlaps [2.5, 3.0] only for heading)
console.log('\n--- Test 2: Scene 2 (starts at 2.5s) ---');
const ass2 = createAssFileContent(dummyScene2, 2.5, subtitleStyle, 1280, 720, 5.0);
console.log('Resulting ASS Content:');
console.log(ass2);

// Verifications for Test 2 (Heading)
if (!ass2.includes('Style: Heading,Montserrat,')) {
  throw new Error('FAIL: Heading style definition not found in ASS header for Scene 2');
}
if (!ass2.includes('Dialogue: 10,0:00:00.00,0:00:00.20,Heading,,0,0,0,,{\\an7\\pos(192,72)}')) {
  throw new Error('FAIL: Scene 2 static part not found');
}
if (!ass2.includes('Dialogue: 10,0:00:00.20,0:00:00.50,Heading,,0,0,0,,{\\an7\\move(192,72,-300,72,0,300)\\fad(0,300)}')) {
  throw new Error('FAIL: Scene 2 exit part (slide-out) not found');
}

// Verifications for Test 2 (Timer)
// Timer segments overlapping Scene 2 (2.5s to 5.0s, local 0.0s to 2.5s):
// sec 2: global 2.5 to 3.0 (local 0.0 to 0.5) -> 3s
if (!ass2.includes('Dialogue: 10,0:00:00.00,0:00:00.50,Timer,,0,0,0,,{\\an9\\pos(1088,72)}3s')) {
  throw new Error('FAIL: Scene 2 timer segment (3s) not found');
}
// sec 3: global 3.0 to 4.0 (local 0.5 to 1.5) -> 2s
if (!ass2.includes('Dialogue: 10,0:00:00.50,0:00:01.50,Timer,,0,0,0,,{\\an9\\pos(1088,72)}2s')) {
  throw new Error('FAIL: Scene 2 timer segment (2s) not found');
}
// sec 4: global 4.0 to 5.0 (local 1.5 to 2.5) -> 1s. This is the last second, so exit animation should be present!
if (!ass2.includes('Dialogue: 10,0:00:01.50,0:00:02.50,Timer,,0,0,0,,{\\an9\\move(1088,72,1380,72,700,1000)\\fad(0,300)}1s')) {
  throw new Error('FAIL: Scene 2 timer exit segment (1s) not found or incorrect');
}

console.log('SUCCESS: Scene 2 ASS verification passed!');

console.log('\n--- All Automated Subtitle Tests Passed Successfully! ---');

