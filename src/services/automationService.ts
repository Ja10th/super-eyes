import { YouTubeChannelProfile, ScheduledPost, VideoSessionConfig, AutomationConfig } from '../types';
import { DEFAULT_YOUTUBE_CHANNELS, getRotatingBallColor } from '../data/defaultChannels';
import { SESSION_PRESETS, buildSessionItemsFromPreset, generateSmartRandomSession } from '../data/presets';
import { EXERCISE_DEFINITIONS } from '../data/exercises';
import { audioEngine } from './audioService';
import { getIntroCaption, getIntroCaptionVoicePath } from '../data/introCaptions';

const CHANNELS_KEY = 'eye_platform_yt_channels_v3';
const SCHEDULES_KEY = 'eye_platform_yt_schedules_v5';
const AUTOMATION_KEY = 'eye_platform_yt_automation_v3';
const AUTO_ACTIVE_KEY = 'eye_platform_yt_auto_active_v3';
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

const normalizeScheduledDate = (value: unknown): string => {
  if (typeof value !== 'string') return '';

  // Older queue data can contain an HTML entity in the first year digit
  // ("&#x32;026-..."). Dates are rendered as text in React, so that entity
  // shows up literally instead of becoming a 2.
  return value.replace(/^&#x32;(?=\d{3}-\d{2}-\d{2}$)/i, '2');
};

const normalizeScheduledTitle = (value: unknown): string => {
  if (typeof value !== 'string') return '';

  // Keep scheduling metadata in the schedule row instead of duplicating it
  // in the public video title.
  return value.replace(/\s•\s(?:&#x32;)?\d{3,4}-\d{2}-\d{2}\s\d{2}:\d{2}(?=\s\[)/i, '');
};

const buildUniqueSessionTitle = (
  durationMinutes: number,
  items: ReturnType<typeof generateSmartRandomSession>,
  uniqueSuffix = '',
): string => {
  const focus = items
    .filter((item) => item.exerciseId !== 'rest_blink')
    .map((item) => EXERCISE_DEFINITIONS[item.exerciseId]?.shortTitle)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name!.replace(/\b\w/g, (letter) => letter.toUpperCase()))
    .join(' & ');

  const prefix = `Guided Eye Exercises for Focus & Tracking | ${focus || 'Foundational Eye Movement'} | ${durationMinutes}-Minute Workout`;
  const suffix = uniqueSuffix.slice(0, 24);
  return `${prefix.slice(0, Math.max(1, 100 - suffix.length)).trimEnd()}${suffix}`;
};

// One-time migration: purge all stale v1 and v2 keys so no dummy data leaks through
const LEGACY_KEYS = [
  'eye_platform_yt_channels',
  'eye_platform_yt_schedules',
  'eye_platform_yt_channels_v2',
  'eye_platform_yt_schedules_v2',
  'eye_platform_yt_schedules_v3',
  'eye_platform_yt_schedules_v4',
  'eye_platform_yt_automation_v2',
  'eye_platform_yt_auto_active_v2',
];
try {
  LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
} catch { /* ignore */ }

const notifySchedulesChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eyetraining:schedules-changed'));
  }
};

export class AutomationService {
  private latestStudioRenderBlob: Blob | null = null;

  public setLatestStudioRenderBlob(blob: Blob | null) {
    this.latestStudioRenderBlob = blob;
  }

  public getLatestStudioRenderBlob(): Blob | null {
    return this.latestStudioRenderBlob;
  }

  public clearLatestStudioRenderBlob() {
    this.latestStudioRenderBlob = null;
  }

  // --- Channels ---

  public getChannels(): YouTubeChannelProfile[] {
    try {
      const data = localStorage.getItem(CHANNELS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    this.saveChannels(DEFAULT_YOUTUBE_CHANNELS);
    return DEFAULT_YOUTUBE_CHANNELS;
  }

  public saveChannels(channels: YouTubeChannelProfile[]) {
    localStorage.setItem(CHANNELS_KEY, JSON.stringify(channels));
  }

  public updateChannel(channel: YouTubeChannelProfile) {
    const channels = this.getChannels();
    const idx = channels.findIndex((c) => c.id === channel.id);
    if (idx >= 0) {
      channels[idx] = channel;
    } else {
      channels.push(channel);
    }
    this.saveChannels(channels);
  }

  public deleteChannel(channelId: string) {
    const channels = this.getChannels().filter((c) => c.id !== channelId);
    this.saveChannels(channels);
  }

  public clearAllDummyChannels() {
    this.saveChannels([]);
  }

  // --- Upload Queue (Real User Schedules, NO Dummy Data by Default) ---

  public getSchedules(): ScheduledPost[] {
    try {
      const data = localStorage.getItem(SCHEDULES_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((schedule) => ({
            ...schedule,
            scheduledDate: normalizeScheduledDate(schedule?.scheduledDate),
            title: Array.isArray(schedule?.sessionConfig?.items)
              ? buildUniqueSessionTitle(
                  schedule.durationMinutes || 7,
                  schedule.sessionConfig.items,
                )
              : normalizeScheduledTitle(schedule?.title),
          }));

          // Persist the repair so the malformed value does not return after
          // the next refresh or browser restart.
          if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
            localStorage.setItem(SCHEDULES_KEY, JSON.stringify(normalized));
          }
          return normalized;
        }
      }
    } catch {
      // ignore
    }
    // Clean slate: return empty array by default so user is never spammed with fake dummy schedules
    return [];
  }

  public saveSchedules(schedules: ScheduledPost[]) {
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedules));
    notifySchedulesChanged();
  }

  public addSchedule(post: ScheduledPost) {
    const schedules = this.getSchedules();
    schedules.push(post);
    // Sort chronologically
    schedules.sort((a, b) => {
      const timeA = `${a.scheduledDate}T${a.scheduledTime}`;
      const timeB = `${b.scheduledDate}T${b.scheduledTime}`;
      return timeA.localeCompare(timeB);
    });
    this.saveSchedules(schedules);
  }

  public deleteSchedule(id: string) {
    const schedules = this.getSchedules().filter((s) => s.id !== id);
    this.saveSchedules(schedules);
  }

  public clearSchedules(channelId?: string) {
    if (channelId && channelId !== 'all') {
      const schedules = this.getSchedules().filter((s) => s.channelId !== channelId);
      this.saveSchedules(schedules);
    } else {
      this.saveSchedules([]);
    }
  }

  public async clearRemoteQueue(): Promise<{ cleared: number }> {
    const response = await fetch(`${API_BASE_URL}/api/jobs/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'CLEAR_QUEUE' }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body?.ok) {
      throw new Error(body?.message || `Queue clear failed with HTTP ${response.status}`);
    }
    return { cleared: Number(body.cleared || 0) };
  }

  public updateScheduleStatus(id: string, status: ScheduledPost['status'], renderProgress?: number) {
    const schedules = this.getSchedules();
    const idx = schedules.findIndex((s) => s.id === id);
    if (idx >= 0) {
      schedules[idx] = {
        ...schedules[idx],
        status,
        renderProgress: typeof renderProgress === 'number' ? renderProgress : schedules[idx].renderProgress,
      };
      if (status === 'rendering') {
        schedules[idx].renderProgress = typeof renderProgress === 'number' ? renderProgress : 15;
      }
      if (status === 'ready') {
        schedules[idx].renderProgress = 100;
      }
      if (status === 'published') {
        schedules[idx].publishedTimestamp = Date.now();
        schedules[idx].renderProgress = 100;
      }
      this.saveSchedules(schedules);
    }
  }

  // --- Automation Engine & Cadence Scheduler ---

  public isAutomationActive(): boolean {
    try {
      const val = localStorage.getItem(AUTO_ACTIVE_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  }

  public setAutomationActive(active: boolean) {
    localStorage.setItem(AUTO_ACTIVE_KEY, active ? 'true' : 'false');
  }

  public getAutomationConfig(channelId: string): AutomationConfig {
    try {
      const raw = localStorage.getItem(`${AUTOMATION_KEY}_${channelId}`);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback
    }

    const channel = this.getChannels().find((c) => c.id === channelId);
    return {
      channelId,
      isEnabled: true,
      postsPerDay: channel?.postsPerDay || 2,
      postingHours: channel?.postingHours || ['08:00', '18:00'],
      preferredDuration: 'random',
      resolution: '4k',
      useRandomizer: true,
    };
  }

  public saveAutomationConfig(config: AutomationConfig) {
    localStorage.setItem(`${AUTOMATION_KEY}_${config.channelId}`, JSON.stringify(config));
  }

  private buildVideoMeta(
    channel: YouTubeChannelProfile,
    title: string,
    durationMinutes: number,
    items: ReturnType<typeof generateSmartRandomSession>
  ) {
    const formatTimestamp = (seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
      return `${minutes.toString().padStart(2, '0')}:${remaining}`;
    };
    const exerciseIds = items.map((item) => item.exerciseId).filter(Boolean);
    const exerciseNames = exerciseIds
      .slice(0, 8)
      .map((id) => EXERCISE_DEFINITIONS[id]?.shortTitle || id)
      .join(', ');
    let chapterTime = 4.5;
    const chapters = ['00:00 Welcome and breathing reset'];
    items.forEach((item, index) => {
      chapters.push(`${formatTimestamp(chapterTime)} ${index + 1}. ${EXERCISE_DEFINITIONS[item.exerciseId]?.shortTitle || item.exerciseId}`);
      chapterTime += item.instructionSeconds + item.motionSeconds;
    });

    const channelName = channel.name.trim();
    const channelHandle = channel.channelHandle?.trim() || `@${channelName.replace(/\s+/g, '')}`;
    const keywordLine = 'eye exercises, eye tracking, visual focus, smooth pursuit, screen-time eye relief, and daily eye training';
    const description = [
      `${durationMinutes}-minute guided eye exercise workout for focus, visual tracking, and screen-time breaks.`,
      `Follow the moving target with your eyes while keeping your head still in this calm visual training session from ${channelName}. It is designed for people searching for eye exercises, focus training, and smooth pursuit practice.`,
      `Today’s routine includes ${exerciseNames || 'smooth eye movements and visual focus practice'} with spoken cues and low-distraction background music. Keywords: ${keywordLine}.`,
      `Use this as general visual practice, not medical treatment. Stop if you feel pain, dizziness, blurred vision, or other discomfort, and consult a qualified eye-care professional for medical concerns.`,
      `Chapters:\n${chapters.join('\n')}`,
      `Subscribe to ${channelName} for more guided eye exercises, focus training, and visual coordination sessions. ${channelHandle}`,
      '#EyeExercises #EyeTraining #VisualTraining #FocusTraining',
    ].join('\n\n');

    const tags = Array.from(new Set([
      'eye training',
      'eye exercises',
      'guided eye exercises',
      'visual training',
      'eye workout for focus',
      'focus training',
      'visual focus exercises',
      'eye tracking exercise',
      'smooth eye movements',
      'smooth pursuit exercise',
      'screen time eye exercises',
      'eye strain relief exercises',
      'daily eye routine',
      'visual coordination',
      channelName.toLowerCase(),
      ...exerciseIds.map((id) => EXERCISE_DEFINITIONS[id]?.shortTitle || id)
        .map((name) => name.trim().toLowerCase())
        .filter(Boolean),
    ].map((tag) => tag.replace(/[^a-z0-9 _-]+/gi, '').trim()).filter(Boolean))).slice(0, 30);

    const limitedTags: string[] = [];
    let tagLength = 0;
    for (const tag of tags) {
      const nextLength = tagLength + tag.length + (limitedTags.length > 0 ? 1 : 0);
      if (nextLength > 500) break;
      limitedTags.push(tag);
      tagLength = nextLength;
    }

    return {
      description,
      tags: limitedTags,
      videoUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(title)}`,
    };
  }

  /**
   * Generates a real, forward-looking schedule for a channel for the next N days
   * based on the exact posting hours, unique randomized exercises, and brand styling.
   */
  public generateAutoSchedule(
    channel: YouTubeChannelProfile,
    daysAhead: number = 7,
    options?: { durationMinutes?: 7 | 8 | 10 | 'random'; resolution?: '4k' | '1080p' }
  ): ScheduledPost[] {
    const newPosts: ScheduledPost[] = [];
    const today = new Date();
    const config = this.getAutomationConfig(channel.id);
    const postingHours = channel.postingHours && channel.postingHours.length > 0 ? channel.postingHours : config.postingHours;
    const res = options?.resolution || config.resolution || '4k';

    for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
      const dateObj = new Date(today);
      dateObj.setDate(today.getDate() + dayOffset);
      const dateStr = dateObj.toISOString().split('T')[0];

      postingHours.forEach((timeStr, slotIdx) => {
        let durationMins = 8;
        if (options?.durationMinutes && options.durationMinutes !== 'random') {
          durationMins = options.durationMinutes;
        } else if (config.preferredDuration && config.preferredDuration !== 'random') {
          durationMins = config.preferredDuration;
        } else {
          // Cycle through 7, 8, 10
          const durations = [7, 8, 10];
          durationMins = durations[(dayOffset * postingHours.length + slotIdx) % durations.length];
        }

        // Generate a completely unique, randomized session for this slot
        const items = generateSmartRandomSession(durationMins);
        const postTitle = buildUniqueSessionTitle(durationMins, items, ` | ${dateStr.slice(5).replace('-', '/')}-${timeStr.replace(':', '')}`);

        const sessionConfig: VideoSessionConfig = {
          channelId: channel.id,
          channelName: channel.name,
          title: postTitle,
          introCaption: getIntroCaption(dayOffset * postingHours.length + slotIdx),
          introCaptionAudioPath: getIntroCaptionVoicePath(dayOffset * postingHours.length + slotIdx),
          introDurationSeconds: 4.5,
          items,
          backgroundTheme: channel.backgroundTheme,
          ballColor: getRotatingBallColor(channel, dayOffset * postingHours.length + slotIdx),
          ballSize: channel.ballSize,
          musicTrackId: channel.musicTrackId,
          voiceVolume: channel.voiceVolume,
          musicVolume: channel.musicVolume,
          resolution: res,
        };

        const postId = `auto_${channel.id}_${dateStr}_${timeStr.replace(':', '')}_${Math.random().toString(36).slice(2, 6)}`;
        const videoMeta = this.buildVideoMeta(channel, postTitle, durationMins, items);

        newPosts.push({
          id: postId,
          channelId: channel.id,
          channelName: channel.name,
          youtubeChannelId: channel.youtubeChannelId,
          title: postTitle,
          description: videoMeta.description,
          tags: videoMeta.tags,
          videoUrl: videoMeta.videoUrl,
          scheduledDate: dateStr,
          scheduledTime: timeStr,
          durationMinutes: durationMins,
          status: 'scheduled',
          sessionConfig,
        });
      });
    }

    // Merge with existing schedules, avoiding duplicates for same slot
    const existing = this.getSchedules();
    const existingIds = new Set(existing.map((e) => `${e.channelId}_${e.scheduledDate}_${e.scheduledTime}`));

    const filteredNew = newPosts.filter(
      (p) => !existingIds.has(`${p.channelId}_${p.scheduledDate}_${p.scheduledTime}`)
    );

    const merged = [...existing, ...filteredNew];
    merged.sort((a, b) => `${a.scheduledDate}T${a.scheduledTime}`.localeCompare(`${b.scheduledDate}T${b.scheduledTime}`));
    this.saveSchedules(merged);

    return filteredNew;
  }

  // --- Real Webhook / API Dispatcher ---

  private renderSessionFrame(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    sessionConfig: VideoSessionConfig,
    elapsedSeconds: number
  ) {
    const cx = width / 2;
    const cy = height / 2;

    const gradient = ctx.createRadialGradient(cx, cy, 40, cx, cy, Math.max(width, height) * 0.8);
    gradient.addColorStop(0, '#1b2430');
    gradient.addColorStop(0.5, '#0d1117');
    gradient.addColorStop(1, '#06070b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const safeTitle = sessionConfig.title || 'Daily eye training';
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = '600 52px Inter, sans-serif';
    ctx.fillText(safeTitle.slice(0, 38), 80, 110);

    const introDuration = sessionConfig.introDurationSeconds || 4.5;
    let timeCursor = introDuration;

    const getState = () => {
      if (elapsedSeconds < introDuration) {
        return {
          caption: sessionConfig.introCaption || 'welcome to your daily eye training session',
          progress: elapsedSeconds / introDuration,
          item: null,
          instruction: true,
          itemElapsed: 0,
        };
      }

      for (let i = 0; i < sessionConfig.items.length; i += 1) {
        const item = sessionConfig.items[i];
        const itemTotal = item.instructionSeconds + item.motionSeconds;
        if (elapsedSeconds < timeCursor + itemTotal) {
          const itemElapsed = elapsedSeconds - timeCursor;
          return {
            caption: EXERCISE_DEFINITIONS[item.exerciseId]?.captionText || item.exerciseId,
            progress: itemElapsed / itemTotal,
            item,
            instruction: itemElapsed < item.instructionSeconds,
            itemElapsed,
          };
        }
        timeCursor += itemTotal;
      }

      return {
        caption: 'session complete. your eyes are relaxed and refreshed.',
        progress: 1,
        item: null,
        instruction: false,
        itemElapsed: 0,
      };
    };

    const state = getState();

    let ballX = width / 2;
    let ballY = height / 2;
    let radius = sessionConfig.ballSize || 24;
    if (state.item) {
      const exDef = EXERCISE_DEFINITIONS[state.item.exerciseId];
      const movementProgress = state.instruction ? 0 : Math.max(0, (state.itemElapsed - state.item.instructionSeconds) / Math.max(0.25, state.item.motionSeconds));
      const pos = exDef.calculatePosition(
        state.itemElapsed,
        movementProgress,
        width,
        height
      );
      ballX = pos.x;
      ballY = pos.y;
      radius = (pos.scale ?? 1) * (sessionConfig.ballSize || 24);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.arc(width * 0.5, height * 0.5, Math.min(width, height) * 0.38, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = sessionConfig.ballColor || '#ffffff';
    ctx.beginPath();
    ctx.arc(ballX, ballY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '500 48px Inter, sans-serif';
    ctx.fillText(state.caption, 80, height - 100);
  }

  private async captureStudioRender(post: ScheduledPost): Promise<Blob | null> {
    const persistedBlob = this.getLatestStudioRenderBlob();
    if (persistedBlob && persistedBlob.size > 0) {
      return persistedBlob;
    }

    const visibleCanvas =
      document.querySelector('[data-video-canvas="studio"]') as HTMLCanvasElement | null ||
      document.querySelector('canvas') as HTMLCanvasElement | null;

    const canvas = visibleCanvas || document.createElement('canvas');
    const width = canvas.width || (post.sessionConfig.resolution === '4k' ? 3840 : 1920);
    const height = canvas.height || (post.sessionConfig.resolution === '4k' ? 2160 : 1080);
    const targetCanvas = canvas instanceof HTMLCanvasElement ? canvas : (() => {
      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      return offscreen;
    })();

    if (!('captureStream' in targetCanvas) || typeof MediaRecorder === 'undefined') {
      return null;
    }

    const stream = targetCanvas.captureStream(30);
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return null;

    const combined = new MediaStream();
    combined.addTrack(videoTrack);
    const audioTrack = audioEngine.getAudioStreamDestination().stream.getAudioTracks()[0];
    if (audioTrack) combined.addTrack(audioTrack);

    const mimeType = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find((type) => MediaRecorder.isTypeSupported(type)) || '';

    return await new Promise<Blob>((resolve, reject) => {
      try {
        const recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);
        const chunks: Blob[] = [];
        const ctx = targetCanvas.getContext('2d');
        if (!ctx) {
          reject(new Error('studio canvas context unavailable'));
          return;
        }

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };

        recorder.onerror = () => reject(new Error('studio recorder failed while capturing the live canvas render'));
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
          if (blob.size > 0) {
            this.setLatestStudioRenderBlob(blob);
            resolve(blob);
          } else {
            resolve(null as unknown as Blob);
          }
        };

        const renderDurationSeconds = Math.max(8, Math.min(30, (post.durationMinutes || 7) * 60));
        const start = performance.now();
        const tick = () => {
          const elapsed = (performance.now() - start) / 1000;
          if (elapsed <= renderDurationSeconds) {
            this.renderSessionFrame(ctx, width, height, post.sessionConfig, elapsed);
            requestAnimationFrame(tick);
            return;
          }
          recorder.stop();
        };

        recorder.start(250);
        requestAnimationFrame(tick);
      } catch {
        reject(new Error('studio recorder unavailable'));
      }
    }).catch(() => null) as Promise<Blob | null>;
  }

  public async syncRemoteQueueStatus(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs`);
      if (!response.ok) return;

      const data = await response.json();
      const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
      if (jobs.length === 0) return;

      const schedules = this.getSchedules();
      let changed = false;

      for (const schedule of schedules) {
        const matchingJob = jobs.find((job: any) => {
          const payload = job?.payload || {};
          const queueKey =
            payload?.video?.id ||
            payload?.jobKey ||
            payload?.jobId ||
            payload?.queueKey ||
            payload?.id ||
            payload?.scheduleId ||
            payload?.postId;

          if (typeof queueKey === 'string' && queueKey === schedule.id) {
            return true;
          }

          return false;
        });

        if (!matchingJob) continue;

        const backendStatus = String(matchingJob.status || 'queued');
        const nextStatus: ScheduledPost['status'] =
          backendStatus === 'published' ? 'published' :
          backendStatus === 'failed' ? 'failed' :
          backendStatus === 'uploading' ? 'uploading' :
          backendStatus === 'rendering' || backendStatus === 'queued' ? 'rendering' :
          backendStatus === 'ready' ? 'ready' :
          'scheduled';

        const nextProgress = typeof matchingJob.progress === 'number' ? matchingJob.progress : schedule.renderProgress ?? 0;
        const filePath = typeof matchingJob?.filePath === 'string' ? matchingJob.filePath : typeof matchingJob?.file_path === 'string' ? matchingJob.file_path : null;
        const previewUrl = filePath
          ? (/^https?:\/\//i.test(filePath)
            ? filePath
            : `${API_BASE_URL}/api/rendered/${encodeURIComponent(filePath.split('/').pop() || 'render.mp4')}`)
          : undefined;

        if (
          schedule.status !== nextStatus ||
          (schedule.renderProgress ?? 0) !== nextProgress ||
          (schedule.previewUrl || '') !== (previewUrl || '') ||
          (schedule.backendJobId || '') !== (matchingJob.id || '')
        ) {
          schedule.status = nextStatus;
          schedule.renderProgress = nextProgress;
          schedule.backendJobId = matchingJob.id;
          schedule.backendStatus = backendStatus;
          schedule.backendStage = matchingJob.stage || backendStatus;
          schedule.backendError = matchingJob.error || undefined;
          schedule.previewUrl = previewUrl;
          changed = true;
        }
      }

      if (changed) {
        this.saveSchedules(schedules);
      }
    } catch {
      // Ignore remote polling failures; the UI should keep local state until the backend is reachable.
    }
  }

  public async triggerPublishWebhook(post: ScheduledPost, forcePostNow = false): Promise<{ success: boolean; message: string }> {
    const channels = this.getChannels();
    const channel = channels.find((c) => c.id === post.channelId);
    const metadataChannel = channel || ({
      ...DEFAULT_YOUTUBE_CHANNELS[0],
      name: post.channelName || 'Daily Visual Training',
      channelHandle: post.youtubeChannelId || post.channelName || 'eye-training',
    } as YouTubeChannelProfile);
    const generatedMeta = this.buildVideoMeta(metadataChannel, post.title, post.durationMinutes, post.sessionConfig.items);
    const description = generatedMeta.description;
    const tags = generatedMeta.tags;
    const introIndex = Array.from(post.id || '').reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const sessionConfig = {
      ...post.sessionConfig,
      channelName: metadataChannel.name,
      introCaption: getIntroCaption(introIndex),
      introCaptionAudioPath: getIntroCaptionVoicePath(introIndex),
    };

    const payload: Record<string, any> = {
      event: 'youtube.video.upload',
      channel: {
        id: channel?.id,
        name: channel?.name,
        handle: channel?.channelHandle,
        youtubeChannelId: channel?.youtubeChannelId,
      },
      video: {
        id: post.id,
        title: post.title,
        description,
        tags,
        durationMinutes: post.durationMinutes,
        scheduledDate: post.scheduledDate,
        scheduledTime: post.scheduledTime,
        resolution: post.sessionConfig.resolution || '4k',
        exercisesCount: post.sessionConfig.items.length,
        sourceUrl: post.previewUrl || undefined,
        forcePostNow,
      },
      sessionConfig,
      timestamp: new Date().toISOString(),
    };

    const configuredWebhook = channel?.autoUploadWebhook?.trim() || '';
    const isLocalWebhook = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?\b/i.test(configuredWebhook);
    const webhookUrl = configuredWebhook.startsWith('http') && !isLocalWebhook
      ? configuredWebhook
      : `${API_BASE_URL}/api/jobs`;

    try {
      const requestBody = {
        ...payload,
        title: post.title,
        description: payload.video.description,
        channelId: channel?.id || post.channelId,
        durationSeconds: Math.max(30, (post.durationMinutes || 7) * 60),
        tags,
      };

      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const bodyText = await resp.text().catch(() => '');
      const body = bodyText ? JSON.parse(bodyText) : {};

      if (resp.ok) {
        const schedule = this.getSchedules().find((s) => s.id === post.id);
        if (schedule) {
          schedule.status = 'rendering';
          schedule.renderProgress = 5;
          schedule.backendJobId = body?.job?.id || schedule.backendJobId;
          this.saveSchedules(this.getSchedules());
        }
        await this.syncRemoteQueueStatus();
        return {
          success: true,
          message: body?.job ? `upload job accepted; the real render/upload is running in the backend queue (${body.job.id})` : `upload job accepted; the real render/upload is running in the backend queue`,
        };
      }

      return {
        success: false,
        message: `webhook responded with HTTP ${resp.status}${body?.message ? `: ${body.message}` : bodyText ? `: ${bodyText}` : ''}`,
      };
    } catch (err) {
      return {
        success: false,
        message: `webhook connection error: ${String(err)}`,
      };
    }
  }
}

export const automationService = new AutomationService();
