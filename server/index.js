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
  const width = 1280;
  const height = 720;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const theme = payload?.sessionConfig?.backgroundTheme || 'slate_zen';
  const gradients = {
    slate_zen: ['#0f172a', '#1d4ed8'], deep_space: ['#020617', '#1e293b'],
    clean_studio: ['#111827', '#334155'], warm_sunrise: ['#7c2d12', '#f59e0b'],
    forest_mist: ['#052e16', '#22c55e'], cyber_amber: ['#111827', '#f59e0b'],
  };
  const [start, end] = gradients[theme] || gradients.slate_zen;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, start); gradient.addColorStop(1, end);
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.42)'; ctx.fillRect(width * 0.52, 0, width * 0.48, height);

  const title = String(payload?.title || payload?.video?.title || 'Daily Visual Training');
  const duration = Number(payload?.durationSeconds || (payload?.video?.durationMinutes || 7) * 60);
  const minutes = Math.max(1, Math.round(duration / 60));
  const firstExercise = payload?.sessionConfig?.items?.[0]?.exerciseId || 'infinity';
  const ballColor = payload?.sessionConfig?.ballColor || '#ffffff';
  const channelName = payload?.channel?.name || 'daily visual training';

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 48px Arial';
  const words = title.split(/\s+/);
  let line = ''; let y = 390;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > 550 && line) { ctx.fillText(line, 60, y); line = word; y += 58; }
    else line = next;
  }
  if (line) ctx.fillText(line, 60, y);
  ctx.font = '500 22px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('guided visual training', 60, y + 52);
  ctx.font = '700 28px Arial'; ctx.fillStyle = '#ffffff'; ctx.fillText(`${minutes} min`, 60, y + 105);
  ctx.font = '600 20px Arial'; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(channelName, 60, y + 145);

  const cx = width * 0.73; const cy = height * 0.46;
  ctx.beginPath(); ctx.arc(cx, cy, 112, 0, Math.PI * 2); ctx.fillStyle = ballColor; ctx.shadowColor = ballColor; ctx.shadowBlur = 50; ctx.fill(); ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 170, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.62)'; ctx.font = '600 18px Arial'; ctx.fillText(String(firstExercise).replace(/_/g, ' '), width * 0.62, height * 0.82);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, height - 48, width, 48);
  ctx.fillStyle = '#f8fafc'; ctx.font = '600 16px Arial'; ctx.fillText('ZEN VISION', 34, height - 18);

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
      const thumbnailUrl = await uploadFileToObjectStorage(thumbnailPath, `thumbnails/${videoId}.png`, 'image/png');
      try {
        await youtube.thumbnails.set({
          videoId,
          media: { body: createReadStream(thumbnailPath), mimeType: 'image/png' },
        });
        thumbnailUploaded = true;
      } catch (thumbnailError) {
        console.warn(`[youtube] video uploaded but thumbnail failed: ${thumbnailError instanceof Error ? thumbnailError.message : thumbnailError}`);
      } finally {
        await unlink(thumbnailPath).catch(() => {});
      }
      if (thumbnailUrl) console.log(`[storage] thumbnail stored at ${thumbnailUrl}`);
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
    console.warn(`[queue] render complete; YouTube upload pending for ${job.id}: ${uploadError}`);
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

if (process.env.WORKER_ONLY === 'true') {
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
