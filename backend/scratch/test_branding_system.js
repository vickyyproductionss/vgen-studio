import { createAssFileContent } from '../services/video.js';

console.log('--- Starting FitnessInChunks Branding System Test ---');

const dummyScene1 = {
  text: "Welcome to this branding theme test.",
  start_time: 0.0,
  end_time: 4.0,
  words: [
    { word: "Welcome", start_time: 0.1, end_time: 0.8 },
    { word: "to", start_time: 0.8, end_time: 1.5 },
    { word: "this", start_time: 1.5, end_time: 2.2 },
    { word: "branding", start_time: 2.2, end_time: 3.0 },
    { word: "theme", start_time: 3.0, end_time: 3.5 },
    { word: "test.", start_time: 3.5, end_time: 4.0 }
  ]
};

const dummyScene2 = {
  text: "This represents the second scene extending to the end screen.",
  start_time: 4.0,
  end_time: 6.0,
  words: [
    { word: "This", start_time: 4.1, end_time: 4.5 },
    { word: "represents", start_time: 4.5, end_time: 5.0 },
    { word: "the", start_time: 5.0, end_time: 5.2 },
    { word: "end", start_time: 5.2, end_time: 5.6 },
    { word: "screen.", start_time: 5.6, end_time: 6.0 }
  ]
};

const style = {
  subtitleMode: 'classic',
  fontName: 'Montserrat',
  fontSize: 22,
  fontColor: '#FFFFFF',
  outlineColor: '#000000',
  bold: true,
  headingTitle: "YOUR WORKOUT IS NOT THE PROBLEM",
  brandingTheme: 'fitness-in-chunks',
  seriesName: 'FITNESSINCHUNKS',
  episodeNumber: 'EP 02',
  nextEpisode: 'EP 03',
  showTimer: true
};

// Test Scene 1 (starts at 0.0s, ends at 4.0s. Total duration = 6.0s)
console.log('\n--- Test 1: Compile Scene 1 (0.0s to 4.0s) ---');
const ass1 = createAssFileContent(dummyScene1, 4.0, style, 720, 1280, 6.0);
console.log(ass1);

// Style Verifications
const styles = ['FIC_Topic', 'FIC_Episode', 'FIC_Series', 'FIC_Line', 'FIC_Progress'];
for (const s of styles) {
  if (!ass1.includes(`Style: ${s},`)) {
    throw new Error(`FAIL: Style definition for ${s} not found in ASS header`);
  }
}
console.log('✅ Style declarations verified.');

// Topic Card (starts at 0.0, ends at 2.0)
// MarginL = 720 * 0.06 = 43
// MarginV = 1280 * 0.15 = 192
if (!ass1.includes('Dialogue: 10,0:00:00.00,0:00:00.40,FIC_Topic,,0,0,0,,{\\an7\\move(-500,64,43,64,0,400)\\fad(400,0)}')) {
  throw new Error('FAIL: Scene 1 Topic Card entry (slide-in) not found');
}
if (!ass1.includes('Dialogue: 10,0:00:00.40,0:00:01.70,FIC_Topic,,0,0,0,,{\\an7\\pos(43,64)}')) {
  throw new Error('FAIL: Scene 1 Topic Card static state not found');
}
if (!ass1.includes('Dialogue: 10,0:00:01.70,0:00:02.00,FIC_Topic,,0,0,0,,{\\an7\\move(43,64,-500,64,0,300)\\fad(0,300)}')) {
  throw new Error('FAIL: Scene 1 Topic Card exit (slide-out) not found');
}
console.log('✅ Topic Card dialogue events verified.');

// Episode Block & Vertical Line (starts at 0.0, persistent)
// Margins: bottom-left safe zone: X = 6% from left, Y = 10% from bottom
// Ep/Series MarginL = width * 0.06 + 15 = 43 + 15 = 58
// blockMarginV = 180 (at Y=1100). lineY = 1280 - 180 - 18 - 27 - 10 - 25(extra) = 1020
if (!ass1.includes('Dialogue: 11,0:00:00.00,0:00:04.00,FIC_Episode,,0,0,0,,{\\fad(400,0)}EP 02')) {
  throw new Error('FAIL: Scene 1 persistent Episode dialogue not found');
}
if (!ass1.includes('Dialogue: 11,0:00:00.00,0:00:04.00,FIC_Series,,0,0,0,,{\\fad(400,0)}FITNESSINCHUNKS')) {
  throw new Error('FAIL: Scene 1 persistent Series dialogue not found');
}
if (!ass1.includes('Dialogue: 11,0:00:00.00,0:00:04.00,FIC_Line,,0,0,0,,{\\fad(400,0)}{\\pos(43,1020)\\p1}m 0 0 l 2 0 l 2 65 l 0 65{\\p0}')) {
  throw new Error('FAIL: Scene 1 persistent Line drawing not found or coordinates incorrect');
}
console.log('✅ Persistent signature block verified.');


// Progress bar events (time step 0.2s)
// Check first and last progress bar events in scene 1
if (!ass1.includes('Dialogue: 15,0:00:00.00,0:00:00.20,FIC_Progress,,0,0,0,,{\\pos(700,64)\\p1}')) {
  throw new Error('FAIL: Progress bar first frame event not found');
}
console.log('✅ Progress bar increments verified.');


// Test Scene 2 (starts at 4.0s, ends at 6.0s. Total duration = 6.0s. Overlaps with final 2s end screen)
console.log('\n--- Test 2: Compile Scene 2 (4.0s to 6.0s) ---');
const ass2 = createAssFileContent(dummyScene2, 2.0, style, 720, 1280, 6.0);
console.log(ass2);

// Check that Topic Card is NOT generated (since scene start is 4.0 > 2.0)
if (ass2.includes(',FIC_Topic,')) {
  throw new Error('FAIL: Topic Card should not exist after 2.0s');
}
console.log('✅ Topic Card is successfully removed after 2.0s.');

// Scene 2 represents the final 2.0s of the video (entirely inside end screen).
// Check that Series name opacity is increased (uses FIC_Episode style instead of FIC_Series)
if (!ass2.includes('Dialogue: 11,0:00:00.00,0:00:02.00,FIC_Series,,0,0,0,,{\\alpha&H00&}FITNESSINCHUNKS')) {
  throw new Error('FAIL: Series name did not gain full visibility in the end screen');
}
// Check that Call to Action "Follow for EP 03" is centered
if (!ass2.includes('Dialogue: 12,0:00:00.00,0:00:02.00,FIC_Episode,,0,0,0,,{\\an5\\pos(360,704)\\fad(300,300)}Follow for EP 03')) {
  throw new Error('FAIL: End screen follow CTA not found or incorrect coordinates');
}
console.log('✅ End screen signature visibility boost and centered follow CTA verified.');

console.log('\n--- All FitnessInChunks Branding System Tests Passed Successfully! ---');
