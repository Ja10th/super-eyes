import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { createCanvas } from '@napi-rs/canvas';
import { calculateExercisePosition } from './exerciseUtils.js';
import config from './config.js';

// Ensure environment variables are loaded
import 'dotenv/config';

const renderable = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function background(ctx, width, height, theme) {
  const cx = width / 2;
  const cy = height / 2;
  const gradients = {
    slate_zen: ['#161922', '#0d0f16', '#050608'],
    deep_space: ['#110f1c', '#07060d', '#020104'],
    warm_sunrise: ['#22112a', '#130a1c', '#06030a'],
    forest_mist: ['#06382a', '#031c15', '#010a08'],
    cyber_amber: ['#1c1505', '#0d0a02', '#040301'],
  };
  const colors = gradients[theme] || gradients.slate_zen;
  const gradient = ctx.createRadialGradient(cx, cy, 50, cx, cy, width * 0.7);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.7, colors[1]);
  gradient.addColorStop(1, colors[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

function position(exerciseId, elapsed, width, height) {
  return calculateExercisePosition(exerciseId, elapsed, width, height);
}

function text(ctx, value, x, y, size, color, align = 'left') {
  ctx.save();
  ctx.font = `500 ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value || ''), x, y);
  ctx.restore();
}

function drawBall(ctx, x, y, radius, color, scale) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius + 1.5 * scale, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color || '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - radius * 0.28, y - radius * 0.28, radius * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.restore();
}

const cleanIntroCaption = (value) => String(value || '')
  .replace(/^\s*hi\b\s*[:.\-]?\s*/i, '')
  .replace(/^\s*hello\b\s*[:.\-]?\s*/i, '')
  .replace(/^\s*welcome\s*to\s*your\s*daily\s*eye\s*training\s*session\b\s*[:.\-]?\s*/i, '')
  .replace(/\s+/g, ' ')
  .trim();

function generateSpeech(text, outputPath) {
  return new Promise((resolve) => {
    const scriptPath = path.resolve(process.cwd(), 'scripts/tts_generator.py');
    const child = spawn('python3', [scriptPath, text, outputPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0 && fs.existsSync(outputPath)));
  });
}

async function ensureIntroCaptionVoice(root, caption) {
  const text = cleanIntroCaption(caption);
  if (!text) return null;

  const hash = crypto.createHash('md5').update(text.toLowerCase()).digest('hex');
  const outputPath = path.join(root, 'public', 'audio', 'cache', `${hash}.mp3`);
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000) {
    const generated = await generateSpeech(text, outputPath);
    if (!generated) return null;
  }
  return outputPath;
}

function runFfmpeg(args, input, onProgress, duration) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let buffer = '';
    child.stderr.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const match = line.match(/^out_time_ms=(\d+)/);
        // FFmpeg names this field out_time_ms, but reports microseconds.
        // Convert to a bounded 0..1 fraction before calculating progress.
        if (match && onProgress) onProgress(Math.max(0, Math.min(1, Number(match[1]) / 1_000_000 / duration)));
      }
    });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`)));
    input.pipe(child.stdin);
  });
}

export async function renderStudioSession(job, onProgress = () => {}) {
  const config = job?.payload?.sessionConfig || job?.payload?.video?.sessionConfig || {};
  const is4K = config.resolution === '4k';
  const outputWidth = is4K ? 3840 : 1920;
  const outputHeight = is4K ? 2160 : 1080;
  // Render the simple eye-training scene at 1080p, then upscale the final
  // encode to true 4K. This keeps the output dimensions 3840x2160 while
  // avoiding a 4x canvas and memory cost for every frame.
  const freeProfile = config?.rendering?.freeProfile ?? process.env.RENDER_PROFILE === 'free';
  const renderWidth = freeProfile ? 1280 : 1920;
  const renderHeight = freeProfile ? 720 : 1080;
  const width = renderWidth;
  const height = renderHeight;
  const fps = 30;
  const intro = renderable(config.introDurationSeconds, 4.5);
  const items = Array.isArray(config.items) ? config.items : [];
  const duration = Math.max(8, Math.round(renderable(job?.payload?.durationSeconds, intro + items.reduce((sum, item) => sum + renderable(item.instructionSeconds, 0) + renderable(item.motionSeconds, 0), 0))));
  const root = path.resolve(process.cwd());
  const tempDir = path.join(root, 'server', 'tmp', String(job.id));
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(path.join(root, 'server', 'rendered'), { recursive: true });
  const title = String(job.title || config.title || 'Eye Training Routine').replace(/[^a-zA-Z0-9-_ ]/g, ' ').trim() || 'eye-training-routine';
  const outputPath = path.join(root, 'server', 'rendered', `${Date.now()}-${title.slice(0, 40).replace(/\s+/g, '-')}.mp4`);
  const silentPath = path.join(tempDir, 'video.mp4');
  const canvas = createCanvas(renderWidth, renderHeight);
  const ctx = canvas.getContext('2d');
  const scale = renderWidth / 1920;
  const baseRadius = Math.max(50, renderable(config.ballSize, 38)) * scale;
  const totalFrames = duration * fps;
  let cursor = intro;

  // Respect ffmpeg backpressure. Ignoring push()'s return value makes the
  // entire 4K render accumulate in Node memory and can trigger an OS kill.
  const frameStream = new PassThrough({ highWaterMark: 1024 * 1024 });
  const encodePromise = runFfmpeg([
    '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${renderWidth}x${renderHeight}`, '-r', String(fps), '-i', 'pipe:0',
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-progress', 'pipe:2', '-nostats', silentPath,
  ], frameStream, (p) => onProgress(Math.round(15 + p * 70)), duration);

  for (let frame = 0; frame < totalFrames; frame += 1) {
    const time = frame / fps;
    background(ctx, width, height, config.backgroundTheme);
    if (time < intro) {
      const progress = time / intro;
      const alpha = progress < 0.12 ? progress / 0.12 : progress > 0.82 ? 1 - (progress - 0.82) / 0.18 : 1;
      text(ctx, 'hi', width / 2, height / 2 - 25 * scale, 160 * scale, `rgba(255,255,255,${Math.max(0, Math.min(1, alpha))})`, 'center');
    } else {
      let at = intro;
      let active = null;
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        const instruction = renderable(item.instructionSeconds, 0);
        const motion = renderable(item.motionSeconds, 0);
        if (time < at + instruction + motion) { active = { item, index: i, at, instruction, motion }; break; }
        at += instruction + motion;
      }
      if (active) {
        const isInstruction = time < active.at + active.instruction;
        const elapsed = Math.max(0, time - active.at - active.instruction);
        const pos = isInstruction ? { x: width / 2, y: height / 2 } : position(active.item.exerciseId, elapsed, width, height);
        if (!isInstruction && pos.auxiliaryPoints) {
          for (const point of pos.auxiliaryPoints) {
            ctx.save();
            ctx.globalAlpha = point.opacity ?? 0.35;
            ctx.beginPath();
            ctx.arc(point.x, point.y, baseRadius * 0.45, 0, Math.PI * 2);
            ctx.fillStyle = config.ballColor || '#ffffff';
            ctx.fill();
            ctx.restore();
          }
        }
        drawBall(ctx, pos.x, pos.y, baseRadius * (pos.scale || 1), config.ballColor || '#ffffff', scale);
        text(ctx, `exercise ${active.index + 1} of ${items.length}: ${String(active.item.exerciseId || 'exercise').replace(/_/g, ' ')}`, 56 * scale, 58 * scale, 18 * scale, 'rgba(255,255,255,0.5)');
      } else {
        text(ctx, 'session complete', width / 2, height / 2 - 10 * scale, 85 * scale, '#ffffff', 'center');
      }
    }
    text(ctx, config.channelId ? `@${String(config.channelId).toLowerCase()}` : '@eye-training', width - 32 * scale, height - 24 * scale, 14 * scale, 'rgba(255,255,255,0.32)', 'right');
    const pixels = canvas.data();
    const accepted = frameStream.write(Buffer.from(pixels.buffer, pixels.byteOffset, pixels.byteLength));
    if (!accepted) await once(frameStream, 'drain');
    if (frame % 6 === 0) await new Promise((resolve) => setImmediate(resolve));
  }
  frameStream.end();
  await encodePromise;
  onProgress(86);

  const musicDir = path.join(root, 'public', 'audio', 'music');
  const musicFiles = fs.readdirSync(musicDir).filter(file => file.endsWith('.mp3') || file.endsWith('.wav'));
  const randomMusicFile = musicFiles[Math.floor(Math.random() * musicFiles.length)];
  const musicPath = path.join(musicDir, randomMusicFile);
  const voices = [{ path: path.join(root, 'public', 'audio', 'voice', 'intro_hi.mp3'), start: 0 }];
  const introCaptionVoice = await ensureIntroCaptionVoice(root, config.introCaption);
  if (introCaptionVoice) {
    // Studio plays the caption after the initial "hi" cue.
    voices.push({ path: introCaptionVoice, start: 900 });
  }
  cursor = intro;
  for (const item of items) {
    const voicePath = path.join(root, 'public', 'audio', 'voice', `${item.exerciseId}.mp3`);
    if (fs.existsSync(voicePath)) voices.push({ path: voicePath, start: cursor * 1000 });
    cursor += renderable(item.instructionSeconds, 0) + renderable(item.motionSeconds, 0);
  }
  const inputs = ['-i', silentPath, '-stream_loop', '-1', '-i', musicPath];
  voices.forEach((voice) => inputs.push('-i', voice.path));
  const musicVolume = Math.max(0, Math.min(1.5, renderable(config.musicVolume, 0.9))) * 0.7;
  const voiceVolume = Math.max(0, Math.min(1.5, renderable(config.voiceVolume, 0.95))) * 1.35;
  const filters = [`[1:a]volume=${musicVolume},atrim=duration=${duration},asetpts=PTS-STARTPTS[m]`];
  voices.forEach((voice, index) => filters.push(`[${index + 2}:a]adelay=${Math.round(voice.start)}|${Math.round(voice.start)},volume=${voiceVolume},atrim=duration=${duration},asetpts=PTS-STARTPTS[v${index}]`));
  filters.push(`[m]${voices.map((_, index) => `[v${index}]`).join('')}amix=inputs=${voices.length + 1}:duration=first:dropout_transition=0:normalize=0,acompressor=threshold=0.12:ratio=3:attack=20:release=250:makeup=2,loudnorm=I=-14:TP=-1.5:LRA=11[a]`);
  onProgress(88);
  await new Promise((resolve, reject) => {
    const videoArgs = is4K
      ? ['-vf', 'scale=3840:2160:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p']
      : ['-c:v', 'copy'];
    const child = spawn('ffmpeg', ['-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '0:v', '-map', '[a]', ...videoArgs, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', outputPath], { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg audio mux exited with code ${code}`)));
  });
  fs.rmSync(tempDir, { recursive: true, force: true });
  onProgress(100);
  return outputPath;
}
