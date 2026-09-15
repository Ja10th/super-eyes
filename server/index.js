import http from 'http';
import { readFile, mkdir, writeFile, unlink } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import formidable from 'formidable';
import { spawn, execFile } from 'child_process';
import pg from 'pg';
import { renderStudioSession } from './studioRenderer.js';
import { createCanvas } from '@napi-rs/canvas';
import { uploadFileToObjectStorage } from './objectStorage.js';

const { Pool } = pg;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
const JOBS_PATH = path.join(__dirname, 'jobs.json');
const RENDERED_PATH = path.join(__dirname, 'rendered');
const DATABASE_URL = process.env.DATABASE_URL || '';
const dbPool = DATABASE_URL ? new Pool({
  connectionString: DATABASE_URL,
  max: 5,
  ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
}) : null;
const TOKEN_ENCRYPTION_KEY = process.env.OAUTH_TOKEN_ENCRYPTION_KEY || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || 'Ja10th/super-eyes';
const GITHUB_WORKFLOW_FILE = process.env.GITHUB_WORKFLOW_FILE || 'render-worker.yml';
const GITHUB_WORKFLOW_REF = process.env.GITHUB_WORKFLOW_REF || 'main';

const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const describeError = (error) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') {
    try { return JSON.stringify(error); } catch { return 'Unknown object error'; }
  }
  return String(error);
};

const ensureJobsStore = async () => {
  if (dbPool) {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'queued',
        stage TEXT NOT NULL DEFAULT 'queued',
        progress INTEGER NOT NULL DEFAULT 0,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        file_path TEXT,
        video_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        error TEXT
      );
    `);
    await dbPool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS stage TEXT NOT NULL DEFAULT 'queued'`);
    await dbPool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS error TEXT`);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS youtube_connections (
        id TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        channel_name TEXT,
        channel_handle TEXT,
        client_id TEXT NOT NULL,
        client_secret TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await dbPool.query(`ALTER TABLE youtube_connections ADD COLUMN IF NOT EXISTS client_id TEXT`);
    await dbPool.query(`ALTER TABLE youtube_connections ADD COLUMN IF NOT EXISTS client_secret TEXT`);
    return;
  }

  await mkdir(path.dirname(JOBS_PATH), { recursive: true });
  if (!existsSync(JOBS_PATH)) {
    await writeFile(JOBS_PATH, '[]', 'utf8');
  }
};

const loadJobs = async () => {
  await ensureJobsStore();

  if (dbPool) {
    const { rows } = await dbPool.query('SELECT * FROM jobs ORDER BY created_at ASC');
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      stage: row.stage || row.status,
      progress: Number(row.progress || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      filePath: row.file_path,
      videoId: row.video_id,
      payload: row.payload || {},
      error: row.error || null,
    }));
  }

  const raw = await readFile(JOBS_PATH, 'utf8').catch(() => '[]');
  try {
    return JSON.parse(raw || '[]');
  } catch {
    return [];
  }
};

const saveJobs = async (jobs) => {
  if (dbPool) {
    for (const job of jobs) {
      await dbPool.query(
        `
          INSERT INTO jobs (id, title, description, status, stage, progress, payload, file_path, video_id, created_at, updated_at, completed_at, error)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            status = EXCLUDED.status,
            stage = EXCLUDED.stage,
            progress = EXCLUDED.progress,
            payload = EXCLUDED.payload,
            file_path = EXCLUDED.file_path,
            video_id = EXCLUDED.video_id,
            updated_at = NOW(),
            completed_at = EXCLUDED.completed_at,
            error = EXCLUDED.error
        `,
        [
          job.id,
          job.title,
          job.description || null,
          job.status,
          job.stage || job.status,
          Number(job.progress || 0),
          JSON.stringify(job.payload || {}),
          job.filePath || null,
          job.videoId || null,
          job.createdAt || new Date().toISOString(),
          job.updatedAt || new Date().toISOString(),
          job.completedAt || null,
          job.error || null,
        ]
      );
    }
    return;
  }

  await writeFile(JOBS_PATH, JSON.stringify(jobs, null, 2), 'utf8');
};

const recoverStaleJobs = async () => {
  const jobs = await loadJobs();
  let changed = false;
  for (const job of jobs) {
    const active = job.status === 'rendering' || job.status === 'uploading';
    // A render/upload is owned by this Node process. If the process restarts,
    // no child worker survives, so any active job must be safely re-queued.
    if (active) {
      job.status = 'queued';
      job.stage = 'recovered';
      job.progress = 0;
      job.error = null;
      changed = true;
    }
  }
  if (changed) await saveJobs(jobs);
};

const getYouTubeClientForCredentials = ({ clientId, clientSecret, redirectUri, refreshToken }) => {
  if (!clientId || !clientSecret || !redirectUri || !refreshToken) return null;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.youtube({ version: 'v3', auth: oauth2Client });
};

const getYouTubeClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  return getYouTubeClientForCredentials({ clientId, clientSecret, redirectUri, refreshToken });
};

const encryptToken = (value) => {
  if (!TOKEN_ENCRYPTION_KEY) throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY is not configured.');
  const key = crypto.createHash('sha256').update(TOKEN_ENCRYPTION_KEY).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
};

const decryptToken = (value) => {
  if (!TOKEN_ENCRYPTION_KEY) throw new Error('OAUTH_TOKEN_ENCRYPTION_KEY is not configured.');
  const [ivText, tagText, encryptedText] = String(value).split('.');
  const key = crypto.createHash('sha256').update(TOKEN_ENCRYPTION_KEY).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8');
};

const saveYouTubeConnection = async ({ channelId, channelName, channelHandle, clientId, clientSecret, refreshToken }) => {
  if (!dbPool) throw new Error('A Neon database is required to save the YouTube connection.');
  await dbPool.query(
    `INSERT INTO youtube_connections (id, channel_id, channel_name, channel_handle, client_id, client_secret, refresh_token)
     VALUES ('primary', $1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET channel_id = EXCLUDED.channel_id, channel_name = EXCLUDED.channel_name,
       channel_handle = EXCLUDED.channel_handle, client_id = EXCLUDED.client_id, client_secret = EXCLUDED.client_secret,
       refresh_token = EXCLUDED.refresh_token, updated_at = NOW()`,
    [channelId, channelName || null, channelHandle || null, encryptToken(clientId), encryptToken(clientSecret), encryptToken(refreshToken)]
  );
};

const getYouTubeClientAsync = async () => {
  if (dbPool && TOKEN_ENCRYPTION_KEY) {
    const { rows } = await dbPool.query('SELECT client_id, client_secret, refresh_token FROM youtube_connections WHERE id = $1', ['primary']);
    const row = rows[0];
    if (row?.client_id && row?.client_secret && row?.refresh_token) {
      return getYouTubeClientForCredentials({
        clientId: decryptToken(row.client_id),
        clientSecret: decryptToken(row.client_secret),
        redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://super-eyes.vercel.app/oauth/callback',
        refreshToken: decryptToken(row.refresh_token),
      });
    }
  }
  return getYouTubeClient();
};

const parseJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
};

const ensureTtsFile = async (text) => {
  const normalized = String(text || '').trim();
  if (!normalized) return null;
  const hash = crypto.createHash('md5').update(normalized.toLowerCase()).digest('hex');
  const cacheDir = path.join(process.cwd(), 'public', 'audio', 'cache');
  const cachePath = path.join(cacheDir, `${hash}.mp3`);
  await mkdir(cacheDir, { recursive: true });
  if (existsSync(cachePath)) return cachePath;

  return await new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'tts_generator.py');
    const child = spawn('python3', [scriptPath, normalized, cachePath], { stdio: ['ignore', 'ignore', 'pipe'] });
    child.on('error', () => resolve(null));
    child.on('close', (code) => resolve(code === 0 && existsSync(cachePath) ? cachePath : null));
  });
};

const handleMultipartUpload = async (req) => {
  const uploadDir = path.join(process.cwd(), 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 500 * 1024 * 1024,
    multiples: false,
  });

  const [fields, files] = await new Promise((resolve, reject) => {
    form.parse(req, (err, parsedFields, parsedFiles) => {
      if (err) reject(err);
      else resolve([parsedFields, parsedFiles]);
    });
  });

  const file = files.file || files.video || files.upload;

  let payload = {};
  if (fields.payload && typeof fields.payload === 'string') {
    try {
      payload = JSON.parse(fields.payload);
    } catch {
      payload = {};
    }
  }

  if (fields.tags && typeof fields.tags === 'string') {
    try {
      payload.tags = JSON.parse(fields.tags);
    } catch {
      payload.tags = fields.tags;
    }
  }

  if (typeof fields.durationSeconds === 'string') {
    payload.durationSeconds = Number(fields.durationSeconds);
  }

  if (typeof fields.title === 'string') payload.title = fields.title;
  if (typeof fields.description === 'string') payload.description = fields.description;
  if (typeof fields.channelId === 'string') payload.channelId = fields.channelId;

  return {
    ...payload,
    ...fields,
    videoFilePath: file && !Array.isArray(file) ? file.filepath : null,
    originalFilename: file && !Array.isArray(file) ? (file.originalFilename || file.newFilename) : null,
  };
};

const renderFallbackVideo = async ({ title, description, durationSeconds = 18 }) => {
  await mkdir(RENDERED_PATH, { recursive: true });
  const safeTitle = String(title || 'eye-training-video').replace(/[^a-zA-Z0-9-_ ]/g, ' ').trim() || 'eye-training-video';
  const outputPath = path.join(RENDERED_PATH, `${Date.now()}-${safeTitle.slice(0, 40).replace(/\s+/g, '-')}.mp4`);
  const safeText = safeTitle.replace(/'/g, "\\'");

  await new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-f', 'lavfi',
      '-t', String(durationSeconds),
      '-i', 'testsrc2=size=1280x720:rate=30',
      '-vf', `drawbox=x=(iw-420)/2+sin(t*0.9)*220:y=(ih-420)/2+cos(t*1.1)*140:w=420:h=420:color=white@0.8:t=fill,drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='${safeText}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=(h-text_h)/2+170,drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='${safeText}':fontcolor=white@0.25:fontsize=18:x=(w-text_w)/2:y=80,format=yuv420p`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outputPath,
    ];

    const child = spawn('ffmpeg', args, { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
    child.on('error', reject);
  });

  return outputPath;
};

const buildDefaultSessionConfig = (job) => {
  const title = String(job?.title || 'Eye Training Routine');
  return {
    channelId: 'default_queue_channel',
    title,
    introCaption: 'welcome to your daily eye training session',
    introDurationSeconds: 4.5,
    items: [
      { id: 'item_1', exerciseId: 'horizontal', instructionSeconds: 2.5, motionSeconds: 8 },
      { id: 'item_2', exerciseId: 'vertical', instructionSeconds: 2.5, motionSeconds: 8 },
      { id: 'item_3', exerciseId: 'circular', instructionSeconds: 2.5, motionSeconds: 8 },
    ],
    backgroundTheme: 'slate_zen',
    ballColor: '#ffffff',
    ballSize: 22,
    musicTrackId: 'zen_432hz',
    voiceVolume: 0.95,
    musicVolume: 0.9,
    resolution: '1080p',
  };
};

const renderSessionVideo = async (job, onProgress) => {
  const sessionConfig = job?.payload?.sessionConfig || job?.payload?.video?.sessionConfig || buildDefaultSessionConfig(job);

  await mkdir(RENDERED_PATH, { recursive: true });
  const introSeconds = Number(sessionConfig.introDurationSeconds || 4.5);
  const exerciseSeconds = Array.isArray(sessionConfig.items)
    ? sessionConfig.items.reduce((sum, item) => sum + Number(item.instructionSeconds || 0) + Number(item.motionSeconds || 0), 0)
    : 0;
  const requestedDuration = Number(job?.payload?.durationSeconds || job?.payload?.video?.durationSeconds || (introSeconds + exerciseSeconds) || 18);
  const durationSeconds = Math.max(8, Math.round(requestedDuration));
  const titleText = String(job?.title || sessionConfig.title || 'Eye Training Routine');
  const safeTitle = titleText.replace(/[^a-zA-Z0-9-_ ]/g, ' ').trim() || 'eye-training-routine';
  const safeText = safeTitle.replace(/'/g, "\\'").replace(/:/g, "\\:");
  const outputPath = path.join(RENDERED_PATH, `${Date.now()}-${safeTitle.slice(0, 40).replace(/\s+/g, '-')}.mp4`);
  const width = sessionConfig.resolution === '4k' ? 3840 : 1920;
  const height = sessionConfig.resolution === '4k' ? 2160 : 1080;
  const audioRoot = path.resolve(process.cwd(), 'public/audio');
  const musicNames = { zen_432hz: 'zen_432hz.wav', calm_piano: 'calm_piano.wav', calm_acoustic: 'calm_acoustic.wav', calm_strings: 'calm_strings.wav' };
  const musicPath = path.join(audioRoot, 'music', musicNames[sessionConfig.musicTrackId] || musicNames.zen_432hz);
  const voices = [{ path: path.join(audioRoot, 'voice', 'intro_hi.mp3'), start: 0 }];
  const visual = [`drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='${safeText}':fontcolor=white@0.35:fontsize=${Math.round(height * 0.025)}:x=(w-text_w)/2:y=${Math.round(height * 0.08)}`];
  let cursor = introSeconds;
  const cx = `(w-${Math.round(width * 0.04)})/2`;
  const cy = `(h-${Math.round(height * 0.08)})/2`;
  const rx = Math.round(width * 0.36);
  const ry = Math.round(height * 0.32);
  for (const item of (sessionConfig.items || [])) {
    const instruction = Number(item.instructionSeconds || 0);
    const motion = Number(item.motionSeconds || 0);
    const voicePath = path.join(audioRoot, 'voice', `${item.exerciseId}.mp3`);
    if (existsSync(voicePath)) voices.push({ path: voicePath, start: cursor * 1000 });
    const start = cursor + instruction;
    const t = `(t-${start})`;
    let x = `${cx}+sin(${t}*PI/8)*${rx}`;
    let y = cy;
    if (item.exerciseId === 'vertical') { x = cx; y = `${cy}+sin(${t}*PI/8)*${ry}`; }
    if (item.exerciseId === 'circular') { x = `${cx}+cos(${t}*PI/8)*${rx}`; y = `${cy}+sin(${t}*PI/8)*${ry}`; }
    if (item.exerciseId === 'infinity') { y = `${cy}+sin(${t}*PI/8)*cos(${t}*PI/8)*${ry}`; }
    if (item.exerciseId === 'near_far') { x = `${cx}+sin(${t}*PI/5)*${Math.round(width * 0.06)}`; y = `${cy}+cos(${t}*PI/5)*${Math.round(height * 0.05)}`; }
    visual.push(`drawtext=fontfile=/System/Library/Fonts/Supplemental/Arial.ttf:text='●':fontcolor=${sessionConfig.ballColor || 'white'}:fontsize=${Math.max(48, Number(sessionConfig.ballSize || 42) * 3)}:x='${x}':y='${y}':enable='between(t,${start},${start + motion})'`);
    cursor += instruction + motion;
  }
  visual.push('format=yuv420p');

  await new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-f', 'lavfi',
      '-t', String(durationSeconds),
      '-i', `color=c=0x0d1017:s=${width}x${height}:r=30`,
      '-stream_loop', '-1', '-i', musicPath,
      ...voices.flatMap((voice) => ['-i', voice.path]),
      '-filter_complex', [
        `[0:v]${visual.join(',')}[v]`,
        `[1:a]volume=${Number(sessionConfig.musicVolume ?? 0.9) * 0.28},atrim=duration=${durationSeconds},asetpts=PTS-STARTPTS[m]`,
        ...voices.map((voice, index) => `[${index + 2}:a]adelay=${Math.round(voice.start)}|${Math.round(voice.start)},volume=${Number(sessionConfig.voiceVolume ?? 0.95)},atrim=duration=${durationSeconds},asetpts=PTS-STARTPTS[v${index}]`),
        `[m]${voices.map((_, index) => `[v${index}]`).join('')}amix=inputs=${voices.length + 1}:duration=first:dropout_transition=0[a]`,
      ].join(';'),
      '-map', '[v]', '-map', '[a]',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k',
      '-movflags', '+faststart',
      '-progress', 'pipe:2',
      '-nostats',
      outputPath,
    ];

    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let progressBuffer = '';
    let lastProgress = 5;
    child.stderr.on('data', (chunk) => {
      progressBuffer += chunk.toString();
      const lines = progressBuffer.split(/\r?\n/);
      progressBuffer = lines.pop() || '';
      for (const line of lines) {
        const match = line.match(/^out_time_ms=(\d+)/);
        if (!match || !onProgress) continue;
        const renderPercent = Math.max(0, Math.min(100, Number(match[1]) / 1000 / durationSeconds));
        const nextProgress = Math.min(44, Math.max(5, Math.round(5 + renderPercent * 39)));
        if (nextProgress > lastProgress) {
          lastProgress = nextProgress;
          onProgress(nextProgress);
        }
      }
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
    child.on('error', reject);
  });

  return outputPath;
};

const ensureVideoSource = async (payload) => {
  const candidateSources = [
    payload.videoFilePath,
    payload.videoUrl,
    payload.fileUrl,
    payload.video?.videoUrl,
    payload.video?.fileUrl,
    payload.video?.sourceUrl,
  ];

  for (const value of candidateSources) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const trimmed = value.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }

    try {
      const url = new URL(trimmed);
      const isSearchLikeYoutubeUrl =
        url.hostname.includes('youtube.com') && (
          url.pathname === '/results' ||
          url.pathname === '/search' ||
          url.pathname === '/watch' ||
          url.pathname.startsWith('/shorts') ||
          url.pathname.startsWith('/live')
        );
      const isYoutubeShareUrl = url.hostname.includes('youtu.be');
      if (!isSearchLikeYoutubeUrl && !isYoutubeShareUrl) {
        return trimmed;
      }
    } catch {
      return trimmed;
    }
  }

  const allowFallback = Boolean(payload.allowFallbackRender || payload.forceFallbackRender || payload.syntheticFallback);
  if (!allowFallback) {
    return null;
  }

  const fallbackPath = await renderFallbackVideo({
    title: payload.title || payload.video?.title || 'Eye Training Routine',
    description: payload.description || payload.video?.description || 'Daily eye training routine',
    durationSeconds: Number((payload.durationSeconds || (payload.video?.durationMinutes ? payload.video.durationMinutes * 60 : 18)) || 18),
  });

  return fallbackPath;
};

const resolveVideoInput = async (input) => {
  if (!input) {
    throw new Error('No video file supplied. Provide a real video file URL or file path via videoUrl/videoFilePath.');
  }

  const trimmed = String(input).trim();

  if (/^https?:\/\//i.test(trimmed)) {
    const response = await fetch(trimmed);
    if (!response.ok) {
      throw new Error(`Failed to download video URL: ${response.status} ${response.statusText}`);
    }
    const body = Buffer.from(await response.arrayBuffer());
    return {
      buffer: body,
      fileName: new URL(trimmed).pathname.split('/').pop() || 'youtube-upload.mp4',
    };
  }

  const resolvedPath = path.resolve(process.cwd(), trimmed);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Video file not found at: ${resolvedPath}`);
  }

  const fileBuffer = await readFile(resolvedPath);
  return {
    buffer: fileBuffer,
    fileName: path.basename(resolvedPath),
  };
};

const generateStudioThumbnail = async (payload) => {
  const thumbnailPath = path.join(process.cwd(), 'uploads', `thumbnail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
  await mkdir(path.dirname(thumbnailPath), { recursive: true });
  const width = 3840;
  const height = 2160;
  const scale = width / 1920;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const theme = payload?.sessionConfig?.backgroundTheme || 'slate_zen';
  const gradients = {
    slate_zen: ['#161922', '#0d0f16', '#050608'], deep_space: ['#110f1c', '#07060d', '#020104'],
    clean_studio: ['#0a0a0c', '#0a0a0c', '#0a0a0c'], warm_sunrise: ['#22112a', '#130a1c', '#06030a'],
    forest_mist: ['#06382a', '#031c15', '#010a08'], cyber_amber: ['#1c1505', '#0d0a02', '#040301'],
  };
  const [start, middle, end] = gradients[theme] || gradients.slate_zen;
  const gradient = ctx.createRadialGradient(width / 2, height / 2, 30, width / 2, height / 2, width * 0.7);
  gradient.addColorStop(0, start); gradient.addColorStop(0.7, middle); gradient.addColorStop(1, end);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);

  const firstExercise = payload?.sessionConfig?.items?.[0]?.exerciseId || 'infinity';
  const ballColor = payload?.sessionConfig?.ballColor || '#ffffff';

  // Draw exercise pattern based on first exercise
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.36;
  const ry = height * 0.34;
  
  // Draw the exercise movement pattern
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 3 * scale;
  ctx.setLineDash([8 * scale, 8 * scale]);
  
  const drawExercisePattern = (exerciseId) => {
    ctx.beginPath();
    const points = [];
    const steps = 60;
    
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 8; // Show 8 seconds of movement
      let x, y;
      
      switch (exerciseId) {
        case 'horizontal':
          x = cx + Math.sin(t * Math.PI * 0.5) * rx;
          y = cy;
          break;
        case 'vertical':
          x = cx;
          y = cy + Math.sin(t * Math.PI * 0.5) * ry;
          break;
        case 'diagonal':
          const wave = Math.sin(t * Math.PI * 0.5);
          const phase = Math.floor(t / 8) % 2;
          x = cx + wave * width * 0.30;
          y = phase === 0 ? cy + wave * height * 0.28 : cy - wave * height * 0.28;
          break;
        case 'circular':
          const angle = t * Math.PI * 0.3;
          x = cx + Math.cos(angle) * width * 0.30;
          y = cy + Math.sin(angle) * height * 0.30;
          break;
        case 'infinity':
          const omega = t * Math.PI * 0.3;
          x = cx + width * 0.32 * Math.sin(omega);
          y = cy + height * 0.25 * Math.sin(omega) * Math.cos(omega) * 1.5;
          break;
        case 'near_far':
          const depth = (Math.sin(t * Math.PI * 0.5) + 1) / 2;
          x = cx + Math.sin(t * 0.8) * width * 0.06;
          y = cy + Math.cos(t * 0.8) * height * 0.05;
          break;
        case 'saccades':
          const dx = width * 0.28;
          const dy = height * 0.25;
          const targets = [[cx - dx, cy - dy], [cx + dx, cy + dy], [cx + dx, cy - dy], [cx - dx, cy + dy], [cx, cy - dy], [cx, cy + dy]];
          const target = targets[Math.floor(t / 1.25) % targets.length];
          x = target[0];
          y = target[1];
          break;
        case 'spiral':
          const maxR = Math.min(width * 0.32, height * 0.32);
          const cycle = (t % 16) / 16;
          const fraction = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2;
          const radius = maxR * (0.15 + 0.85 * fraction);
          const spiralAngle = t * Math.PI * 0.8;
          x = cx + Math.cos(spiralAngle) * radius;
          y = cy + Math.sin(spiralAngle) * radius;
          break;
        case 'box':
          const bw = width * 0.60;
          const bh = height * 0.52;
          const left = cx - bw / 2;
          const right = cx + bw / 2;
          const top = cy - bh / 2;
          const bottom = cy + bh / 2;
          const perimeter = 2 * (bw + bh);
          const distance = (t * perimeter / 8) % perimeter;
          if (distance < bw) { x = left + distance; y = top; }
          else if (distance < bw + bh) { x = right; y = top + distance - bw; }
          else if (distance < 2 * bw + bh) { x = right - distance + bw + bh; y = bottom; }
          else { x = left; y = bottom - distance + 2 * bw + bh; }
          break;
        case 'figure_8':
          x = cx + Math.sin(t * Math.PI * 0.18) * width * 0.35;
          y = cy + Math.sin(t * Math.PI * 0.36 + Math.PI / 2) * height * 0.28;
          break;
        default:
          x = cx + Math.sin(t * Math.PI * 0.5) * rx;
          y = cy;
      }
      points.push({ x, y });
    }
    
    // Draw the path
    if (points.length > 0) {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
    }
    ctx.stroke();
  };
  
  drawExercisePattern(firstExercise);
  ctx.setLineDash([]);
  
  // Draw current position ball
  const currentPos = (() => {
    const t = 2; // Show position at 2 seconds
    const rx_scaled = width * 0.32;
    const ry_scaled = height * 0.28;
    
    switch (firstExercise) {
      case 'horizontal': return { x: cx + Math.sin(t * Math.PI * 0.5) * rx_scaled, y: cy };
      case 'vertical': return { x: cx, y: cy + Math.sin(t * Math.PI * 0.5) * ry_scaled };
      case 'diagonal':
        const wave = Math.sin(t * Math.PI * 0.5);
        const phase = Math.floor(t / 8) % 2;
        return { x: cx + wave * width * 0.30, y: phase === 0 ? cy + wave * height * 0.28 : cy - wave * height * 0.28 };
      case 'circular':
        const angle = t * Math.PI * 0.3;
        return { x: cx + Math.cos(angle) * width * 0.30, y: cy + Math.sin(angle) * height * 0.30 };
      case 'infinity':
        const omega = t * Math.PI * 0.3;
        return { x: cx + width * 0.32 * Math.sin(omega), y: cy + height * 0.25 * Math.sin(omega) * Math.cos(omega) * 1.5 };
      case 'near_far':
        const depth = (Math.sin(t * Math.PI * 0.5) + 1) / 2;
        return { x: cx + Math.sin(t * 0.8) * width * 0.06, y: cy + Math.cos(t * 0.8) * height * 0.05, scale: 0.75 + depth * 0.75 };
      case 'saccades':
        const dx = width * 0.28;
        const dy = height * 0.25;
        const targets = [[cx - dx, cy - dy], [cx + dx, cy + dy], [cx + dx, cy - dy], [cx - dx, cy + dy], [cx, cy - dy], [cx, cy + dy]];
        const target = targets[Math.floor(t / 1.25) % targets.length];
        return { x: target[0], y: target[1] };
      case 'spiral':
        const maxR = Math.min(width * 0.32, height * 0.32);
        const cycle = (t % 16) / 16;
        const fraction = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2;
        const radius = maxR * (0.15 + 0.85 * fraction);
        const spiralAngle = t * Math.PI * 0.8;
        return { x: cx + Math.cos(spiralAngle) * radius, y: cy + Math.sin(spiralAngle) * radius };
      case 'box':
        const bw = width * 0.60;
        const bh = height * 0.52;
        const left = cx - bw / 2;
        const right = cx + bw / 2;
        const top = cy - bh / 2;
        const bottom = cy + bh / 2;
        const perimeter = 2 * (bw + bh);
        const distance = (t * perimeter / 8) % perimeter;
        if (distance < bw) return { x: left + distance, y: top };
        if (distance < bw + bh) return { x: right, y: top + distance - bw };
        if (distance < 2 * bw + bh) return { x: right - distance + bw + bh, y: bottom };
        return { x: left, y: bottom - distance + 2 * bw + bh };
      case 'figure_8':
        return { x: cx + Math.sin(t * Math.PI * 0.18) * width * 0.35, y: cy + Math.sin(t * Math.PI * 0.36 + Math.PI / 2) * height * 0.28 };
      default:
        return { x: cx + Math.sin(t * Math.PI * 0.5) * rx_scaled, y: cy };
    }
  })();
  
  const ballRadius = Math.max(34, Number(payload?.sessionConfig?.ballSize || 50) * (height / 1080)) * (currentPos.scale || 1);
  ctx.beginPath(); 
  ctx.arc(currentPos.x, currentPos.y, ballRadius + 1.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fill(); 
  ctx.beginPath();
  ctx.arc(currentPos.x, currentPos.y, ballRadius, 0, Math.PI * 2);
  ctx.fillStyle = ballColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(currentPos.x - ballRadius * 0.28, currentPos.y - ballRadius * 0.28, ballRadius * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fill();

  // Keep the studio's subtle center guide without adding thumbnail copy.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath(); 
  ctx.arc(cx, cy, 100 * scale, 0, Math.PI * 2);
  ctx.stroke();

  await writeFile(thumbnailPath, canvas.toBuffer('image/png'));
  return thumbnailPath;
};

const uploadToYouTube = async (payload) => {
  const youtube = await getYouTubeClientAsync();
  if (!youtube) {
    throw new Error('YouTube OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, and GOOGLE_REFRESH_TOKEN in a .env file.');
  }

  const sourcePath = await ensureVideoSource(payload);
  const videoInput = sourcePath;
  if (!videoInput || typeof videoInput !== 'string') {
    throw new Error('Missing real upload source. Production uploads require a valid video file or URL; placeholder fallback generation is disabled.');
  }

  const { buffer, fileName } = await resolveVideoInput(videoInput);
  const metadata = payload.video || payload;
  const title = metadata.title || payload.title || 'Eye Training Upload';
  const description = metadata.description || payload.description || 'Uploaded by eye-training-video-platform';
  const tags = Array.from(new Set(
    (Array.isArray(metadata.tags) ? metadata.tags : Array.isArray(payload.tags) ? payload.tags : [])
      .map((tag) => String(tag).trim().toLowerCase().replace(/[^a-z0-9 _-]/g, ''))
      .filter(Boolean)
  )).slice(0, 30);

  const tempUploadPath = path.join(process.cwd(), 'uploads', `youtube-upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileName.toLowerCase().endsWith('.mp4') ? 'mp4' : 'mp4'}`);
  await mkdir(path.dirname(tempUploadPath), { recursive: true });
  await writeFile(tempUploadPath, buffer);

  try {
    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title,
          description,
          tags,
          categoryId: '28',
        },
        status: {
          privacyStatus: 'private',
        },
      },
      media: {
        body: createReadStream(tempUploadPath),
        mimeType: fileName.toLowerCase().endsWith('.mp4') ? 'video/mp4' : 'video/webm',
      },
    });

    const videoId = response.data.id;
    let thumbnailUploaded = false;
    const thumbnailPath = videoId ? await generateStudioThumbnail(payload) : null;
    if (videoId && thumbnailPath) {
      try {
        await youtube.thumbnails.set({
          videoId,
          media: { body: createReadStream(thumbnailPath), mimeType: 'image/png' },
        });
        thumbnailUploaded = true;
        console.log(`[youtube] video ${videoId} uploaded successfully with thumbnail`);
      } catch (thumbnailError) {
        console.warn(`[youtube] video ${videoId} uploaded successfully but thumbnail upload failed: ${thumbnailError instanceof Error ? thumbnailError.message : thumbnailError}`);
      }
      try {
        const thumbnailUrl = await uploadFileToObjectStorage(thumbnailPath, `thumbnails/${videoId}.png`, 'image/png');
        if (thumbnailUrl) console.log(`[storage] thumbnail stored at ${thumbnailUrl}`);
      } catch (storageError) {
        console.warn(`[storage] thumbnail archive failed for video ${videoId}: ${describeError(storageError)}`);
      } finally {
        await unlink(thumbnailPath).catch(() => {});
      }
    } else {
      console.log(`[youtube] video ${videoId} uploaded successfully (no thumbnail)`);
    }

    return {
      ok: true,
      uploaded: true,
      videoId,
      title,
      fileName,
      thumbnailUploaded,
      youtubeResponse: response.data,
    };
  } finally {
    await unlink(tempUploadPath).catch(() => {});
  }
};

const enqueueJob = async (payload) => {
  const jobs = await loadJobs();
  const payloadWithKey = {
    ...payload,
    queueKey: payload?.video?.id || payload?.id || payload?.postId || payload?.scheduleId || payload?.jobKey || `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  const job = {
    id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: payloadWithKey.title || payloadWithKey.video?.title || 'Eye Training Routine',
    description: payloadWithKey.description || payloadWithKey.video?.description || 'Daily eye training routine',
    status: 'queued',
    stage: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    payload: payloadWithKey,
    progress: 0,
  };
  jobs.push(job);
  await saveJobs(jobs);
  return job;
};

const buildDailySession = (durationMinutes, dateKey, slotIndex) => {
  const exerciseSets = [
    ['horizontal', 'diamond', 'vertical', 'rest_blink', 'circular', 'zigzag', 'infinity'],
    ['butterfly', 'diagonal', 'hexagon', 'rest_blink', 'triangle', 'figure_s', 'near_far'],
    ['box', 'pendulum', 'cross_jump', 'rest_blink', 'hourglass', 'spiral', 'peripheral'],
  ];
  const exerciseIds = exerciseSets[(Number(dateKey.slice(-2)) + slotIndex) % exerciseSets.length];
  const motionSeconds = Math.max(8, Math.floor(((durationMinutes * 60) - 4.5 - exerciseIds.length * 5) / exerciseIds.length));
  const items = exerciseIds.map((exerciseId, index) => ({
    id: `daily_${dateKey}_${slotIndex}_${index}`,
    exerciseId,
    instructionSeconds: 5,
    motionSeconds,
  }));
  return {
    channelId: 'daily',
    title: `Daily Visual Training — ${exerciseIds.filter((id) => id !== 'rest_blink').slice(0, 2).map((id) => id.replace(/_/g, ' ')).join(' & ')} | ${durationMinutes}-Minute Session`,
    introCaption: 'welcome to your daily eye training session. get comfortable and keep your head still.',
    introDurationSeconds: 4.5,
    items,
    backgroundTheme: 'slate_zen',
    ballColor: '#ffffff',
    ballSize: 38,
    musicTrackId: 'zen_432hz',
    voiceVolume: 0.95,
    musicVolume: 0.9,
    resolution: '4k',
  };
};

const scheduleNextDailyBatch = async () => {
  await ensureJobsStore();
  if (!dbPool) throw new Error('Daily scheduler requires DATABASE_URL.');

  const { rows: connections } = await dbPool.query(
    'SELECT channel_id, channel_name, channel_handle FROM youtube_connections ORDER BY updated_at DESC'
  );
  if (connections.length === 0) return { created: 0, skipped: 0, channels: 0 };

  const parsedHours = String(process.env.DAILY_POSTING_HOURS || '08:00,18:00')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^\d{2}:\d{2}$/.test(value));
  const postingHours = parsedHours.length > 0 ? parsedHours : ['08:00', '18:00'];
  const daysAhead = Math.max(0, Number(process.env.DAILY_SCHEDULE_DAYS_AHEAD || 1));
  const target = new Date();
  target.setUTCDate(target.getUTCDate() + daysAhead);
  const dateKey = target.toISOString().slice(0, 10);
  const existing = await loadJobs();
  const existingKeys = new Set(existing.map((job) => job.payload?.queueKey).filter(Boolean));
  let created = 0;
  let skipped = 0;

  for (const connection of connections) {
    for (let slotIndex = 0; slotIndex < postingHours.length; slotIndex += 1) {
      const scheduledTime = postingHours[slotIndex];
      const queueKey = `daily_${connection.channel_id}_${dateKey}_${scheduledTime.replace(':', '')}`;
      if (existingKeys.has(queueKey)) {
        skipped += 1;
        continue;
      }

      const durationMinutes = [7, 8, 10][(slotIndex + Number(dateKey.slice(-2))) % 3];
      const sessionConfig = buildDailySession(durationMinutes, dateKey, slotIndex);
      sessionConfig.channelId = connection.channel_id;
      sessionConfig.title = `${connection.channel_name || 'Daily Visual Training'} — ${sessionConfig.title.replace('Daily Visual Training — ', '')}`;
      await enqueueJob({
        event: 'youtube.video.upload',
        queueKey,
        title: sessionConfig.title,
        description: `A guided ${durationMinutes}-minute visual training session from ${connection.channel_name || 'Super Eyes'}. Follow the moving target smoothly and keep your head still through a calm sequence of tracking, fixation, and coordination exercises. For general practice only; stop if you experience discomfort.`,
        tags: ['eye training', 'visual training', 'smooth pursuit', 'eye exercises', 'daily eye workout', 'super eyes'],
        channel: { id: connection.channel_id, name: connection.channel_name, handle: connection.channel_handle, youtubeChannelId: connection.channel_id },
        video: { id: queueKey, title: sessionConfig.title, scheduledDate: dateKey, scheduledTime, durationMinutes, durationSeconds: durationMinutes * 60, resolution: '4k', sessionConfig },
        sessionConfig,
        durationSeconds: durationMinutes * 60,
      });
      existingKeys.add(queueKey);
      created += 1;
    }
  }
  return { created, skipped, channels: connections.length, date: dateKey };
};

const updateJobStatus = async (jobId, status, extra = {}) => {
  const jobs = await loadJobs();
  const idx = jobs.findIndex((job) => job.id === jobId);
  if (idx === -1) return null;
  jobs[idx] = {
    ...jobs[idx],
    status,
    progress: extra.progress ?? jobs[idx].progress ?? 0,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
  await saveJobs(jobs);
  return jobs[idx];
};

const getScheduledAt = (job) => {
  const video = job.payload?.video || {};
  if (!video.scheduledDate || !video.scheduledTime) return null;
  const value = new Date(`${video.scheduledDate}T${video.scheduledTime}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
};

const publishScheduledJobs = async () => {
  if (!(await getYouTubeClientAsync())) return;
  const jobs = await loadJobs();
  const due = jobs.filter((job) => job.status === 'scheduled' && job.filePath && (getScheduledAt(job)?.getTime() ?? 0) <= Date.now());

  for (const job of due) {
    try {
      await updateJobStatus(job.id, 'uploading', { progress: 90, stage: 'posting to YouTube' });
      const result = await uploadToYouTube({
        ...job.payload,
        title: job.title,
        description: job.description,
        videoFilePath: job.filePath,
      });
      await updateJobStatus(job.id, 'published', {
        progress: 100,
        stage: 'posted',
        videoId: result.videoId,
        completedAt: new Date().toISOString(),
        result,
      });
      console.log(`[queue] scheduled post published ${job.id}`);
    } catch (error) {
      await updateJobStatus(job.id, 'ready', {
        progress: 100,
        stage: 'ready · upload pending',
        error: describeError(error),
      });
      console.error(`[queue] scheduled post failed ${job.id}:`, error instanceof Error ? error.message : error);
    }
  }
};

const processJob = async (renderFutureJobs = true) => {
  const jobs = await loadJobs();
  const job = jobs.find((item) => {
    if (item.status !== 'queued') return false;
    if (renderFutureJobs) return true;
    const scheduledAt = getScheduledAt(item);
    return !scheduledAt || scheduledAt.getTime() <= Date.now();
  });
  if (!job) return null;

  console.log(`[queue] starting ${job.id}: ${job.title}`);

  await updateJobStatus(job.id, 'rendering', { progress: 5, stage: 'starting', error: null });

  const sessionConfig = job.payload?.sessionConfig || job.payload?.video?.sessionConfig || buildDefaultSessionConfig(job);
  // A scheduled post's `video.videoUrl` is metadata/search text, not a renderable file.
  // Only bypass the studio renderer when the caller supplied an actual file/source URL.
  const explicitSource = job.payload?.videoFilePath || job.payload?.fileUrl || job.payload?.video?.fileUrl || job.payload?.video?.sourceUrl;
  const renderSource = explicitSource || renderStudioSession(job, (progress) => {
    const stage = progress < 15 ? 'preparing' : progress < 86 ? 'rendering frames' : progress < 100 ? 'mixing audio' : 'ready';
    updateJobStatus(job.id, 'rendering', { progress, stage }).catch(() => {});
  });

  if (!renderSource) {
    await updateJobStatus(job.id, 'failed', {
      progress: 0,
      error: 'No render source available for this queued session.',
    });
    throw new Error('No render source available for queued session.');
  }

  let resolvedRenderSource;
  try {
    resolvedRenderSource = typeof renderSource === 'string' ? renderSource : await renderSource;
    console.log(`[queue] render complete ${job.id}: ${resolvedRenderSource}`);
  } catch (error) {
    await updateJobStatus(job.id, 'failed', {
      progress: 0,
      stage: 'failed',
      error: describeError(error),
    });
    console.error(`[queue] render failed ${job.id}:`, error instanceof Error ? error.message : error);
    throw error;
  }

  const storedRenderSource = await uploadFileToObjectStorage(
    resolvedRenderSource,
    `videos/${job.id}.mp4`,
    'video/mp4',
  );
  const persistedRenderSource = storedRenderSource || resolvedRenderSource;
  if (storedRenderSource) console.log(`[storage] video stored at ${storedRenderSource}`);

  await updateJobStatus(job.id, 'ready', { progress: 86, stage: 'ready', filePath: persistedRenderSource });

  const scheduledAt = getScheduledAt(job);
  if (scheduledAt && scheduledAt.getTime() > Date.now() && !job.payload?.forcePostNow && !job.payload?.video?.forcePostNow) {
    await updateJobStatus(job.id, 'scheduled', {
      progress: 100,
      stage: `scheduled for ${scheduledAt.toLocaleString()}`,
      filePath: persistedRenderSource,
    });
    console.log(`[queue] render complete; holding ${job.id} for ${scheduledAt.toISOString()}`);
    return { renderedOnly: true, scheduled: true, filePath: resolvedRenderSource };
  }

  // Rendering and publishing are separate lifecycle stages. A missing YouTube
  // OAuth configuration must not discard an otherwise valid rendered video.
  if (!(await getYouTubeClientAsync())) {
    await updateJobStatus(job.id, 'ready', {
      progress: 100,
      stage: 'ready · YouTube upload not configured',
      filePath: persistedRenderSource,
      error: 'Video rendered successfully. Configure YouTube OAuth to publish it automatically.',
    });
    return { renderedOnly: true, filePath: resolvedRenderSource };
  }

  try {
    await updateJobStatus(job.id, 'uploading', { progress: 90, stage: 'uploading' });
    const result = await uploadToYouTube({
      ...job.payload,
      title: job.title,
      description: job.description,
      videoFilePath: resolvedRenderSource,
    });

    await updateJobStatus(job.id, 'published', {
      progress: 100,
      stage: 'published',
      videoId: result.videoId,
      filePath: persistedRenderSource,
      result,
      completedAt: new Date().toISOString(),
    });
    return result;
  } catch (error) {
    const uploadError = describeError(error);
    await updateJobStatus(job.id, 'ready', {
      progress: 100,
      stage: 'ready · upload pending',
      filePath: persistedRenderSource,
      error: uploadError,
    });
    console.warn(`[queue] YouTube upload failed for ${job.id}: ${uploadError}`);
    return { renderedOnly: true, filePath: resolvedRenderSource, uploadError };
  }
};

let queueTimer = null;
let queueWorkerBusy = false;
const runQueueWorker = async () => {
  if (queueWorkerBusy) return;
  queueWorkerBusy = true;
  try {
    await processJob();
    await publishScheduledJobs();
  } catch (error) {
    console.error('Queue worker error:', error);
  } finally {
    queueWorkerBusy = false;
  }
};

const startQueueWorker = () => {
  if (queueTimer) return;
  queueTimer = setInterval(() => {
    runQueueWorker();
  }, 2500);
};

const runWorkerOnce = async () => {
  await ensureJobsStore();
  await recoverStaleJobs();
  await processJob(false);
  await publishScheduledJobs();
  if (dbPool) await dbPool.end();
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/tts') {
    const text = url.searchParams.get('text')?.trim() || '';
    const filePath = await ensureTtsFile(text);
    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('TTS audio unavailable');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' });
    createReadStream(filePath).pipe(res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/google/exchange') {
    try {
      const payload = await parseJsonBody(req);
      const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret || !payload.code || !payload.codeVerifier || !payload.redirectUri) {
        throw new Error('Google OAuth environment or PKCE values are missing.');
      }
      const params = new URLSearchParams({
        code: payload.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: payload.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: payload.codeVerifier,
      });
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokens.error_description || tokens.error || 'Google token exchange failed.');
      if (!tokens.refresh_token) throw new Error('Google did not return a refresh token. Reconnect with consent to grant YouTube upload access.');
      const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
        headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
      });
      const channelData = await channelResponse.json();
      const item = channelData.items?.[0];
      if (!channelResponse.ok || !item) throw new Error(channelData.error?.message || 'No YouTube channel found for this Google account.');
      const channelName = item.snippet?.title || 'Connected YouTube channel';
      const channelHandle = item.snippet?.customUrl ? `@${String(item.snippet.customUrl).replace(/^@/, '')}` : '@channel';
      await saveYouTubeConnection({ channelId: item.id, channelName, channelHandle, clientId, clientSecret, refreshToken: tokens.refresh_token });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        channel: {
          title: channelName,
          handle: channelHandle,
          channelId: item.id,
          avatarUrl: item.snippet?.thumbnails?.default?.url || '',
          subscriberCount: item.statistics?.subscriberCount ? `${Number(item.statistics.subscriberCount).toLocaleString()} subscribers` : 'connected',
        },
        tokens: { access_token: tokens.access_token, expires_in: tokens.expires_in, scope: tokens.scope },
      }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/youtube/verify') {
    const query = url.searchParams.get('query')?.trim() || '';
    const apiKey = url.searchParams.get('apiKey')?.trim() || '';
    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Query parameter required.' }));
      return;
    }
    execFile('python3', [path.join(__dirname, '..', 'scripts', 'verify_youtube.py'), query, apiKey], (error, stdout) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (error) {
        res.end(JSON.stringify({ success: false, error: error.message }));
        return;
      }
      res.end(stdout.trim() || JSON.stringify({ success: false, error: 'Channel verification returned no result.' }));
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/webhook/test') {
    try {
      const payload = await parseJsonBody(req);
      if (!payload.webhookUrl || !String(payload.webhookUrl).startsWith('http')) throw new Error('Valid HTTP(S) webhook URL required.');
      const response = await fetch(payload.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'youtube.test.ping', channel: payload.channelName || 'Test Channel', timestamp: new Date().toISOString(), status: 'active' }),
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: response.ok, status: response.status, message: `Webhook responded with HTTP ${response.status}${response.ok ? ' OK' : ''}.` }));
    } catch (error) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/workflows/render-worker/dispatch') {
    try {
      if (!GITHUB_TOKEN) throw new Error('GitHub workflow dispatch is not configured. Set GITHUB_TOKEN on the server.');
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/${GITHUB_WORKFLOW_FILE}/dispatches`, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: GITHUB_WORKFLOW_REF }),
      });
      if (!response.ok) {
        const details = await response.text().catch(() => '');
        throw new Error(`GitHub returned HTTP ${response.status}${details ? `: ${details}` : ''}`);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Render worker workflow started.' }));
    } catch (error) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message: describeError(error) }));
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'eye-training-youtube-webhook', configured: Boolean(await getYouTubeClientAsync()), database: DATABASE_URL ? 'postgres' : 'json-fallback' }));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/jobs') {
    const jobs = await loadJobs();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, jobs }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/jobs/clear') {
    try {
      const payload = await parseJsonBody(req);
      if (payload?.confirm !== 'CLEAR_QUEUE') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, message: 'Queue clear confirmation required.' }));
        return;
      }

      let cleared = 0;
      if (dbPool) {
        const result = await dbPool.query('DELETE FROM jobs');
        cleared = result.rowCount || 0;
      } else {
        const existing = await loadJobs();
        cleared = existing.length;
        await writeFile(JOBS_PATH, '[]');
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, cleared, message: `Cleared ${cleared} queued job${cleared === 1 ? '' : 's'}.` }));
      return;
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message: describeError(error) }));
      return;
    }
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/rendered/')) {
    const fileName = decodeURIComponent(url.pathname.replace('/api/rendered/', ''));
    const safeFileName = fileName.split('/').filter(Boolean).join('/');
    const fullPath = path.join(RENDERED_PATH, safeFileName);

    if (!existsSync(fullPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message: 'Rendered clip not found.' }));
      return;
    }

    const contentType = fullPath.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    createReadStream(fullPath).pipe(res);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/jobs') {
    try {
      const contentType = req.headers['content-type'] || '';
      const payload = contentType.includes('multipart/form-data')
        ? await handleMultipartUpload(req)
        : await parseJsonBody(req);
      const job = await enqueueJob(payload);
      if (process.env.DISABLE_QUEUE_WORKER !== 'true') startQueueWorker();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, job }));
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create upload job.';
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message }));
      return;
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/webhook/youtube') {
    try {
      const contentType = req.headers['content-type'] || '';
      const payload = contentType.includes('multipart/form-data') ? await handleMultipartUpload(req) : await parseJsonBody(req);
      const job = await enqueueJob(payload);
      if (process.env.DISABLE_QUEUE_WORKER !== 'true') startQueueWorker();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, job }));
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to process upload.';
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message }));
      return;
    }
  }

  if (req.method === 'GET' && url.pathname === '/') {
    try {
      const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
      const html = await readFile(indexPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    } catch {
      // fall through to 404
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, message: `Route not found: ${url.pathname}` }));
});

server.on('error', (error) => {
  console.error(`Unable to start the server on ${HOST}:${PORT}:`, error.message);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Set PORT to another value or stop the existing process.`);
  }
  process.exitCode = 1;
});

if (process.env.SCHEDULER_ONLY === 'true') {
  scheduleNextDailyBatch().then((result) => {
    console.log(`[scheduler] daily batch complete: ${JSON.stringify(result)}`);
  }).catch((error) => {
    console.error('[scheduler] failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }).finally(() => {
    if (dbPool) dbPool.end();
  });
} else if (process.env.WORKER_ONLY === 'true') {
  runWorkerOnce().then(() => {
    console.log('[worker] completed one due-job pass');
  }).catch((error) => {
    console.error('[worker] failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
} else server.listen(PORT, HOST, async () => {
  try {
    await ensureJobsStore();
    await recoverStaleJobs();
    if (process.env.DISABLE_QUEUE_WORKER !== 'true') startQueueWorker();
    console.log(`Local upload webhook server running at http://${HOST}:${PORT}`);
    console.log(`POST to http://${HOST}:${PORT}/api/jobs to enqueue a production upload job`);
    if (DATABASE_URL) {
      console.log('Postgres queue enabled via DATABASE_URL');
    } else {
      console.log('No DATABASE_URL set; using file-based fallback queue');
    }
  } catch (error) {
    console.error('Server startup failed while initializing the queue:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
});
