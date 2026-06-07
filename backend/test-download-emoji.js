import fs from 'fs/promises';
import path from 'path';

async function testDownload() {
  const codePoint = '1F3CB'; // Weightlifter (capitalized)
  const openMojiUrl = `https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@latest/color/png/618x618/${codePoint}.png`;
  const notoUrl = `https://cdn.jsdelivr.net/npm/asturur-noto-emoji@latest/png/128/emoji_u${codePoint.toLowerCase()}.png`;

  console.log('Testing OpenMoji download from:', openMojiUrl);
  try {
    const res = await fetch(openMojiUrl);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      await fs.writeFile(path.resolve('openmoji_test.png'), Buffer.from(buffer));
      console.log('✓ OpenMoji downloaded successfully to openmoji_test.png!');
    } else {
      console.log('✗ OpenMoji download failed:', res.status, res.statusText);
    }
  } catch (err) {
    console.error('✗ OpenMoji download error:', err.message);
  }

  console.log('Testing Noto Color Emoji download from:', notoUrl);
  try {
    const res = await fetch(notoUrl);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      await fs.writeFile(path.resolve('noto_test.png'), Buffer.from(buffer));
      console.log('✓ Noto Color Emoji downloaded successfully to noto_test.png!');
    } else {
      console.log('✗ Noto Color Emoji download failed:', res.status, res.statusText);
    }
  } catch (err) {
    console.error('✗ Noto Color Emoji download error:', err.message);
  }
}

testDownload();
