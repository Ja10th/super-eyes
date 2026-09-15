import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { createCanvas } from '@napi-rs/canvas';

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
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.38;
  const ry = height * 0.34;
  const t = elapsed;
  const segment = (points, period) => {
    const progress = ((t % period) / period) * (points.length - 1);
    const index = Math.floor(progress);
    const fraction = progress - index;
    const from = points[index];
    const to = points[index + 1];
    return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
  };
  switch (exerciseId) {
    case 'horizontal': return { x: cx + Math.sin(t * Math.PI * 0.5) * rx, y: cy };
    case 'vertical': return { x: cx, y: cy + Math.sin(t * Math.PI * 0.5) * ry };
    case 'diagonal': {
      const wave = Math.sin(t * Math.PI * 0.5);
      const phase = Math.floor(t / 8) % 2;
      return { x: cx + wave * width * 0.36, y: phase === 0 ? cy + wave * height * 0.33 : cy - wave * height * 0.33 };
    }
    case 'circular': {
      const direction = Math.floor(t / 16) % 2 === 0 ? 1 : -1;
      const angle = t * Math.PI * 0.3 * direction;
      return { x: cx + Math.cos(angle) * width * 0.34, y: cy + Math.sin(angle) * height * 0.34 };
    }
    case 'infinity': {
      const omega = t * Math.PI * 0.3;
      return { x: cx + width * 0.36 * Math.sin(omega), y: cy + height * 0.28 * Math.sin(omega) * Math.cos(omega) * 1.5 };
    }
    case 'near_far': {
      const depth = (Math.sin(t * Math.PI * 0.5) + 1) / 2;
      return { x: cx + Math.sin(t * 0.8) * width * 0.08, y: cy + Math.cos(t * 0.8) * height * 0.06, scale: 0.75 + depth * 0.75 };
    }
    case 'saccades': {
      const dx = width * 0.33;
      const dy = height * 0.3;
      const targets = [[cx - dx, cy - dy], [cx + dx, cy + dy], [cx + dx, cy - dy], [cx - dx, cy + dy], [cx, cy - dy], [cx, cy + dy]];
      const target = targets[Math.floor(t / 1.25) % targets.length];
      return { x: target[0], y: target[1] };
    }
    case 'rest_blink': return { x: cx, y: cy, scale: 0.9 + ((Math.sin(t * Math.PI / 3) + 1) / 2) * 0.4 };
    case 'spiral': {
      const maxR = Math.min(width * 0.36, height * 0.36);
      const cycle = (t % 16) / 16;
      const fraction = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2;
      const radius = maxR * (0.15 + 0.85 * fraction);
      const angle = t * Math.PI * 0.8;
      return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    }
    case 'peripheral': {
      const angle = t * Math.PI * 0.4;
      return { x: cx, y: cy, auxiliaryPoints: [{ x: cx + Math.cos(angle) * width * 0.4, y: cy + Math.sin(angle) * height * 0.38, opacity: 0.9 }, { x: cx + Math.cos(angle + Math.PI) * width * 0.4, y: cy + Math.sin(angle + Math.PI) * height * 0.38, opacity: 0.9 }] };
    }
    case 'box': {
      const w = width * 0.7;
      const h = height * 0.62;
      const left = cx - w / 2;
      const right = cx + w / 2;
      const top = cy - h / 2;
      const bottom = cy + h / 2;
      const perimeter = 2 * (w + h);
      const distance = (t * perimeter / 8) % perimeter;
      if (distance < w) return { x: left + distance, y: top };
      if (distance < w + h) return { x: right, y: top + distance - w };
      if (distance < 2 * w + h) return { x: right - distance + w + h, y: bottom };
      return { x: left, y: bottom - distance + 2 * w + h };
    }
    case 'zigzag': return { x: cx + Math.sin(t * Math.PI * 0.25) * width * 0.36, y: cy + Math.sin(t * Math.PI * 2) * height * 0.32 };
    case 'diamond': return segment([{ x: cx, y: cy - height * 0.34 }, { x: cx + width * 0.36, y: cy }, { x: cx, y: cy + height * 0.34 }, { x: cx - width * 0.36, y: cy }, { x: cx, y: cy - height * 0.34 }], 8);
    case 'star': {
      const radius = Math.min(width * 0.36, height * 0.34);
      const points = [0, 2, 4, 1, 3, 0].map((index) => { const angle = index * 2 * Math.PI / 5 - Math.PI / 2; return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }; });
      return segment(points, 10);
    }
    case 'hourglass': return segment([{ x: cx - width * 0.36, y: cy - height * 0.34 }, { x: cx + width * 0.36, y: cy - height * 0.34 }, { x: cx - width * 0.36, y: cy + height * 0.34 }, { x: cx + width * 0.36, y: cy + height * 0.34 }, { x: cx - width * 0.36, y: cy - height * 0.34 }], 8);
    case 'butterfly': {
      const angle = t * Math.PI * 0.25;
      const radius = Math.sin(2 * angle) * 0.8 + 0.4;
      return { x: cx + Math.cos(angle) * width * 0.36 * radius, y: cy + Math.sin(angle) * height * 0.32 * (0.8 + 0.3 * Math.cos(3 * angle)) };
    }
    case 'pendulum': {
      const theta = Math.sin(t * (2 * Math.PI / 3.6)) * (42 * Math.PI / 180);
      const length = height * 0.78;
      return { x: cx + Math.sin(theta) * length, y: height * 0.05 + Math.cos(theta) * length };
    }
    case 'ellipse': {
      const angle = t * Math.PI * 0.28;
      return { x: cx + Math.cos(angle) * width * 0.42, y: cy + Math.sin(angle) * height * 0.22 };
    }
    case 'triangle': {
      const radius = Math.min(width * 0.35, height * 0.36);
      const points = [0, 1, 2, 0].map((index) => { const angle = index * 2 * Math.PI / 3 - Math.PI / 2; return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }; });
      return segment(points, 9);
    }
    case 'figure_s': return { x: cx + Math.sin(t * Math.PI * 0.18) * width * 0.4, y: cy + Math.sin(t * Math.PI * 0.36 + Math.PI / 2) * height * 0.3 };
    case 'cross_jump': {
      const dx = width * 0.36;
      const dy = height * 0.34;
      const points = [{ x: cx, y: cy }, { x: cx + dx, y: cy }, { x: cx, y: cy }, { x: cx, y: cy + dy }, { x: cx, y: cy }, { x: cx - dx, y: cy }, { x: cx, y: cy }, { x: cx, y: cy - dy }];
      return { ...points[Math.floor(t / 1.1) % points.length], auxiliaryPoints: points.filter((_, index) => index % 2 !== 0).map((point) => ({ ...point, opacity: 0.3 })) };
    }
    case 'slow_orbit': {
      const angle = t * Math.PI * 0.1;
      return { x: cx + Math.cos(angle) * width * 0.38, y: cy + Math.sin(angle) * height * 0.36 };
    }
    case 'random_drift': return { x: cx + Math.sin(t * Math.PI * 0.37 + 1.1) * width * 0.36 * Math.cos(t * 0.07), y: cy + Math.sin(t * Math.PI * 0.51 + 2.4) * height * 0.32 * Math.cos(t * 0.11) };
    case 'figure_8_vertical': {
      const omega = t * Math.PI * 0.28;
      return { x: cx + width * 0.22 * Math.sin(omega) * Math.cos(omega) * 1.5, y: cy + height * 0.38 * Math.sin(omega) };
    }
    case 'hexagon': {
      const radius = Math.min(width * 0.37, height * 0.36);
      const points = [...Array(7)].map((_, index) => { const angle = (index % 6) * 2 * Math.PI / 6 - Math.PI / 2; return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }; });
      return segment(points, 12);
    }
    case 'wave_horizontal': return { x: cx + Math.sin(t * Math.PI * 0.22) * width * 0.4, y: cy + Math.sin(t * Math.PI * 0.66) * height * 0.2 };
    case 'clover_loop': {
      const angle = t * Math.PI * 0.28;
      return { x: cx + Math.sin(angle) * width * 0.34, y: cy + Math.sin(angle * 2) * height * 0.24 };
    }
    case 'orbit_cross': {
      const angle = t * Math.PI * 0.25;
      const pinch = 0.72 + 0.28 * Math.abs(Math.sin(angle * 2));
      return { x: cx + Math.cos(angle) * width * 0.37 * pinch, y: cy + Math.sin(angle) * height * 0.33 * pinch };
    }
    case 'sawtooth_rise': {
      const phase = (t % 6) / 6;
      return { x: width * 0.14 + phase * width * 0.72, y: height * 0.82 - phase * height * 0.64 };
    }
    case 'pulse_square': {
      const points = [{ x: width * 0.18, y: height * 0.18 }, { x: width * 0.82, y: height * 0.18 }, { x: width * 0.82, y: height * 0.82 }, { x: width * 0.18, y: height * 0.82 }, { x: width * 0.18, y: height * 0.18 }];
      const progress = (t % 8) / 2;
      const index = Math.floor(progress);
      const fraction = progress - index;
      return { x: points[index].x + (points[index + 1].x - points[index].x) * fraction, y: points[index].y + (points[index + 1].y - points[index].y) * fraction };
    }
    case 'double_helix': {
      const angle = t * Math.PI * 0.24;
      return { x: cx + Math.sin(angle) * width * 0.38, y: cy + Math.sin(angle * 2 + Math.PI / 2) * height * 0.28 };
    }
    case 'corner_sweep': {
      const angle = t * Math.PI * 0.22;
      return { x: cx + Math.sin(angle) * width * 0.38, y: cy + Math.sin(angle * 0.5) * height * 0.34 };
    }
    default: return { x: cx + Math.sin(t * Math.PI * 0.5) * rx, y: cy };
  }
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
  const freeProfile = process.env.RENDER_PROFILE === 'free';
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
        text(ctx, `exercise ${active.index + 1} of ${items.length}: ${String(active.item.customName || active.item.exerciseId || 'exercise').replace(/_/g, ' ')}`, 56 * scale, 58 * scale, 18 * scale, 'rgba(255,255,255,0.5)');
      } else {
        text(ctx, 'session complete', width / 2, height / 2 - 10 * scale, 85 * scale, '#ffffff', 'center');
      }
    }
    const watermark = config.channelName || config.channelId || 'eye-training';
    text(ctx, String(watermark), width - 32 * scale, height - 24 * scale, 14 * scale, 'rgba(255,255,255,0.32)', 'right');
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
  const configuredIntroVoice = String(config.introCaptionAudioPath || '').replace(/^\/+/, '');
  const configuredIntroVoicePath = configuredIntroVoice
    ? path.join(root, 'public', configuredIntroVoice)
    : null;
  const introCaptionVoice = configuredIntroVoicePath && fs.existsSync(configuredIntroVoicePath)
    ? configuredIntroVoicePath
    : await ensureIntroCaptionVoice(root, config.introCaption);
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
  const musicVolume = Math.max(0, Math.min(1.5, renderable(config.musicVolume, 0.9))) * 0.12;
  const voiceVolume = Math.max(0, Math.min(1.5, renderable(config.voiceVolume, 0.95))) * 1.35;
  const filters = [`[1:a]volume=${musicVolume},atrim=duration=${duration},asetpts=PTS-STARTPTS[m]`];
  voices.forEach((voice, index) => filters.push(`[${index + 2}:a]adelay=${Math.round(voice.start)}|${Math.round(voice.start)},volume=${voiceVolume},atrim=duration=${duration},asetpts=PTS-STARTPTS[v${index}]`));
  filters.push(`[m]${voices.map((_, index) => `[v${index}]`).join('')}amix=inputs=${voices.length + 1}:duration=first:dropout_transition=0:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]`);
  onProgress(88);
  await new Promise((resolve, reject) => {
    const videoArgs = is4K
      ? ['-vf', 'scale=3840:2160:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p']
      : ['-c:v', 'copy'];
    const child = spawn('ffmpeg', ['-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '0:v', '-map', '[a]', ...videoArgs, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', outputPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    let audioMuxError = '';
    child.stderr.on('data', (chunk) => {
      audioMuxError = `${audioMuxError}${chunk.toString()}`.slice(-4000);
    });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg audio mux exited with code ${code}: ${audioMuxError.trim()}`)));
  });
  fs.rmSync(tempDir, { recursive: true, force: true });
  onProgress(100);
  return outputPath;
}
