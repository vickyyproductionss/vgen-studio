import 'dotenv/config';
import { dbService } from './services/firestore.js';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.resolve(__dirname, 'uploads');
const THUMBNAILS_DIR = path.resolve(UPLOADS_DIR, 'thumbnails');

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

async function removeDuplicates() {
  console.log('=== Starting Duplicate Clips Cleanup ===');
  
  // 1. Fetch all clips
  const clips = await dbService.getClips('local-user');
  console.log(`Found ${clips.length} total clips registered in database.`);
  
  // 2. Group clips by original filename name
  const nameGroups = {};
  for (const clip of clips) {
    const name = clip.name;
    if (!nameGroups[name]) {
      nameGroups[name] = [];
    }
    nameGroups[name].push(clip);
  }
  
  let deletedCount = 0;
  let freedBytes = 0;
  
  // 3. For each group, if there are duplicates, keep the first and delete the rest
  for (const name in nameGroups) {
    const group = nameGroups[name];
    if (group.length > 1) {
      console.log(`\n[!] Duplicate found for: "${name}" (${group.length} occurrences)`);
      
      // Keep the first clip
      const keepClip = group[0];
      console.log(`[+] Keeping clip ID: ${keepClip.id} (Path: ${keepClip.path})`);
      
      // Delete the rest
      for (let i = 1; i < group.length; i++) {
        const deleteClip = group[i];
        console.log(`[-] Deleting duplicate clip ID: ${deleteClip.id}`);
        
        // A. Delete DB record
        await dbService.deleteClip(deleteClip.id);
        
        // B. Delete video file
        const resolvedVideoPath = resolvePath(deleteClip.path);
        if (resolvedVideoPath && existsSync(resolvedVideoPath)) {
          try {
            unlinkSync(resolvedVideoPath);
            console.log(`    Successfully deleted video file: ${resolvedVideoPath}`);
          } catch (err) {
            console.error(`    Error deleting video file: ${err.message}`);
          }
        }
        
        // C. Delete thumbnail file
        const thumbnailPath = path.join(THUMBNAILS_DIR, `${deleteClip.id}.jpg`);
        if (existsSync(thumbnailPath)) {
          try {
            unlinkSync(thumbnailPath);
            console.log(`    Successfully deleted thumbnail file: ${thumbnailPath}`);
          } catch (err) {
            console.error(`    Error deleting thumbnail: ${err.message}`);
          }
        }
        
        deletedCount++;
      }
    }
  }
  
  console.log('\n======================================');
  console.log(`Cleanup completed! Removed ${deletedCount} duplicate clips.`);
}

removeDuplicates().catch(console.error);
