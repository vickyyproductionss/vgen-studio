import fs from 'fs/promises';
import path from 'path';

async function run() {
  try {
    const destFile = path.resolve('test_apple_emoji.png');
    const fh = await fs.open(destFile, 'r');
    const buf = Buffer.alloc(24);
    await fh.read(buf, 0, 24, 0);
    await fh.close();

    // Check PNG signature
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      console.log(`✓ Valid PNG. Resolution: ${width}x${height} pixels`);
    } else {
      console.log('✗ Not a valid PNG file');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
