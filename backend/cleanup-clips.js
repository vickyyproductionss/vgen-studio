import 'dotenv/config';
import { dbService } from './services/firestore.js';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePath(filePath) {
  if (!filePath) return filePath;
  
  if (path.isAbsolute(filePath) && existsSync(filePath)) {
    return filePath;
  }
  
  const resolvedDir = path.resolve(__dirname, filePath);
  if (existsSync(resolvedDir)) {
    return resolvedDir;
  }
  
  const resolvedRoot = path.resolve(__dirname, '..', filePath);
  if (existsSync(resolvedRoot)) {
    return resolvedRoot;
  }
  
  if (filePath.includes('uploads/')) {
    const relativePart = filePath.substring(filePath.indexOf('uploads/'));
    return path.join(__dirname, relativePart);
  }
  
  return filePath;
}

async function cleanup() {
  console.log('=== Starting Clip Library Cleanup ===');
  
  // Fetch clips for local-user
  const clips = await dbService.getClips('local-user');
  console.log(`Found ${clips.length} total clips registered in database.`);
  
  let removedCount = 0;
  for (const clip of clips) {
    const resolved = resolvePath(clip.path);
    const exists = resolved && existsSync(resolved);
    
    if (!exists) {
      console.log(`[-] Removing missing clip: "${clip.name}" -> Path: ${clip.path}`);
      await dbService.deleteClip(clip.id);
      removedCount++;
    } else {
      console.log(`[+] Clip exists: "${clip.name}"`);
    }
  }
  
  console.log('======================================');
  console.log(`Cleanup completed! Removed ${removedCount} missing clips.`);
}

cleanup().catch(console.error);
