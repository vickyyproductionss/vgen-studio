import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_DIR = path.resolve(__dirname, '..');
const SADTALKER_DIR = path.join(BACKEND_DIR, 'sadtalker');
const GENERATED_DIR = path.join(BACKEND_DIR, 'uploads', 'generated');

// Check if the conda environment python binary exists directly to avoid conda run output buffering
const CONDA_DIR = [
  '/opt/homebrew/Caskroom/miniforge/base',
  '/opt/anaconda3',
  '/usr/local/anaconda3',
  `${process.env.HOME}/miniconda3`,
  `${process.env.HOME}/anaconda3`
].find(p => existsSync(path.join(p, 'envs', 'sadtalker', 'bin', 'python')));

const PYTHON_BIN = CONDA_DIR 
  ? path.join(CONDA_DIR, 'envs', 'sadtalker', 'bin', 'python')
  : null;

const CONDA_BIN = process.env.CONDA_EXE ||
  ['/opt/homebrew/Caskroom/miniforge/base/bin/conda',
   '/opt/anaconda3/bin/conda',
   '/usr/local/anaconda3/bin/conda',
   `${process.env.HOME}/miniconda3/bin/conda`,
   `${process.env.HOME}/anaconda3/bin/conda`]
    .find(p => existsSync(p)) || 'conda';

/**
 * In-memory job store for tracking lipsync generation progress.
 * { jobId: { status, stage, percent, message, result, error, startedAt } }
 */
export const lipsyncJobs = new Map();

/**
 * SadTalker processing stages with estimated % ranges.
 * We parse stdout/stderr for known keywords to advance the stage.
 */
const STAGES = [
  { key: 'init',       label: 'Initialising SadTalker…',              pct: 2  },
  { key: 'audio',      label: 'Analysing audio & extracting speech…',  pct: 10 },
  { key: 'landmarks',  label: 'Detecting facial landmarks…',           pct: 22 },
  { key: 'coeff',      label: 'Predicting 3D face coefficients…',      pct: 38 },
  { key: 'animate',    label: 'Animating face frames…',                pct: 55 },
  { key: 'render',     label: 'Rendering video frames…',               pct: 72 },
  { key: 'enhance',    label: 'Enhancing faces with GFPGAN…',          pct: 88 },
  { key: 'saving',     label: 'Saving final video…',                   pct: 96 },
  { key: 'done',       label: 'Complete!',                             pct: 100 },
];

/** Match stdout/stderr text to a stage */
function detectStage(text) {
  const t = text.toLowerCase();
  if (t.includes('gfpgan') || t.includes('enhance') || t.includes('restoration'))   return 'enhance';
  if (t.includes('rendering') || t.includes('writing') || t.includes('ffmpeg'))     return 'render';
  if (t.includes('animate') || t.includes('animation') || t.includes('face_vid'))   return 'animate';
  if (t.includes('coeff') || t.includes('prediction') || t.includes('3dmm'))        return 'coeff';
  if (t.includes('landmark') || t.includes('alignment') || t.includes('detect'))    return 'landmarks';
  if (t.includes('audio') || t.includes('wav') || t.includes('mel'))                return 'audio';
  if (t.includes('saving') || t.includes('saved') || t.includes('output'))          return 'saving';
  return null;
}

/** Parse a tqdm-style percentage like "45%|████" from a line */
function parseTqdmPct(text) {
  const match = text.match(/(\d{1,3})%\|/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Find the first .mp4 file in a directory recursively.
 */
async function findMp4File(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findMp4File(fullPath);
      if (found) return found;
    } else if (entry.isFile() && entry.name.endsWith('.mp4')) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Start an async lipsync job. Returns jobId immediately.
 * Progress can be polled via lipsyncJobs.get(jobId).
 */
export function startLipsyncJob(sourceImagePath, drivenAudioPath, options = {}) {
  const jobId = uuidv4();

  const job = {
    jobId,
    status: 'running',   // 'running' | 'done' | 'error'
    stage: 'init',
    stageLabel: STAGES[0].label,
    percent: 2,
    log: [],
    result: null,        // { originalVideoPath, originalVideoUrl } when done
    error: null,
    startedAt: Date.now(),
  };
  lipsyncJobs.set(jobId, job);

  // Run async — don't await
  _runLipsync(jobId, sourceImagePath, drivenAudioPath, options);

  return jobId;
}

/** Internal: actually runs SadTalker, updating the job record */
async function _runLipsync(jobId, sourceImagePath, drivenAudioPath, options) {
  const job = lipsyncJobs.get(jobId);

  const runId = uuidv4();
  const tempResultDir = path.join(BACKEND_DIR, 'temp', 'sadtalker', runId);
  await fs.mkdir(tempResultDir, { recursive: true });

  const enhancer   = options.enhancer !== false ? 'gfpgan' : '';
  const preprocess = options.preprocess || 'crop';
  const still      = options.still !== false;
  const size       = options.size || 256;   // 256 = ~5GB RAM, 512 = ~20GB RAM

  let execBin = CONDA_BIN;
  let pythonArgs = [];

  if (PYTHON_BIN) {
    execBin = PYTHON_BIN;
    pythonArgs = [
      path.join(SADTALKER_DIR, 'inference.py'),
      '--driven_audio', drivenAudioPath,
      '--source_image', sourceImagePath,
      '--result_dir',   tempResultDir,
      '--preprocess',   preprocess,
      '--size',         String(size),
    ];
  } else {
    execBin = CONDA_BIN;
    pythonArgs = [
      'run', '-n', 'sadtalker', 'python',
      path.join(SADTALKER_DIR, 'inference.py'),
      '--driven_audio', drivenAudioPath,
      '--source_image', sourceImagePath,
      '--result_dir',   tempResultDir,
      '--preprocess',   preprocess,
      '--size',         String(size),
    ];
  }
  if (still)    pythonArgs.push('--still');
  if (enhancer) pythonArgs.push('--enhancer', enhancer);

  console.log(`[SadTalker job ${jobId}] Starting… (exec: ${execBin})`);
  console.log(`[SadTalker job ${jobId}] Options → size:${size} preprocess:${preprocess} enhancer:${enhancer||'none'} still:${still}`);

  const processEnv = { 
    ...process.env, 
    PYTORCH_ENABLE_MPS_FALLBACK: '1',
    PYTHONUNBUFFERED: '1'
  };
  const proc = spawn(execBin, pythonArgs, { cwd: SADTALKER_DIR, env: processEnv });

  /** Update stage and percent, never go backwards */
  function advanceStage(newKey, tqdmPct = null) {
    const newStageIdx = STAGES.findIndex(s => s.key === newKey);
    const curStageIdx = STAGES.findIndex(s => s.key === job.stage);
    if (newStageIdx > curStageIdx) {
      job.stage      = STAGES[newStageIdx].key;
      job.stageLabel = STAGES[newStageIdx].label;
      job.percent    = STAGES[newStageIdx].pct;
    }
    // If we have a tqdm percentage and we're in the animate/render/enhance stage,
    // interpolate within that stage's range
    if (tqdmPct !== null && newStageIdx >= 0) {
      const base  = STAGES[newStageIdx].pct;
      const next  = STAGES[Math.min(newStageIdx + 1, STAGES.length - 1)].pct;
      const interp = Math.round(base + (tqdmPct / 100) * (next - base));
      if (interp > job.percent) job.percent = interp;
    }
  }

  function handleOutput(text) {
    const lines = text.split(/\r|\n/).filter(Boolean);
    for (const line of lines) {
      job.log.push(line.slice(0, 200)); // keep last logs, capped length
      if (job.log.length > 120) job.log.shift();

      const detectedStage = detectStage(line);
      const tqdmPct = parseTqdmPct(line);

      if (detectedStage) advanceStage(detectedStage, tqdmPct);
      else if (tqdmPct !== null) {
        // Generic tqdm — nudge percent forward within current stage
        const curIdx = STAGES.findIndex(s => s.key === job.stage);
        const base   = STAGES[curIdx].pct;
        const next   = STAGES[Math.min(curIdx + 1, STAGES.length - 1)].pct;
        const interp = Math.round(base + (tqdmPct / 100) * (next - base));
        if (interp > job.percent) job.percent = interp;
      }
    }
  }

  proc.stdout.on('data', d => handleOutput(d.toString()));
  proc.stderr.on('data', d => handleOutput(d.toString()));

  proc.on('close', async (code) => {
    console.log(`[SadTalker job ${jobId}] Process closed with code ${code}`);

    if (code !== 0) {
      await fs.rm(tempResultDir, { recursive: true, force: true }).catch(() => {});
      job.status = 'error';
      job.error  = `SadTalker process exited with code ${code}. Check server logs.`;
      return;
    }

    try {
      const generatedMp4Path = await findMp4File(tempResultDir);
      if (!generatedMp4Path) {
        await fs.rm(tempResultDir, { recursive: true, force: true }).catch(() => {});
        job.status = 'error';
        job.error  = 'SadTalker finished but no .mp4 was generated.';
        return;
      }

      const outputFilename = `talkinghead_${uuidv4()}.mp4`;
      const outputPath = path.join(GENERATED_DIR, outputFilename);
      await fs.mkdir(GENERATED_DIR, { recursive: true });
      await fs.copyFile(generatedMp4Path, outputPath);
      await fs.rm(tempResultDir, { recursive: true, force: true }).catch(() => {});

      advanceStage('done');
      job.status = 'done';
      job.result = {
        outputFilename,
        originalVideoPath: outputPath,
        originalVideoUrl:  `/uploads/generated/${outputFilename}`,
      };
      console.log(`[SadTalker job ${jobId}] Done → ${outputPath}`);
    } catch (err) {
      await fs.rm(tempResultDir, { recursive: true, force: true }).catch(() => {});
      job.status = 'error';
      job.error  = err.message;
    }
  });
}
