import React, { useRef, useEffect, useState } from 'react';
import { Download, Check, Layout, Palette } from 'lucide-react';
import { YouTubeChannelProfile, ExerciseId, BackgroundThemeId } from '../../types';
import { EXERCISE_DEFINITIONS, ALL_EXERCISES } from '../../data/exercises';
import { BACKGROUND_THEMES, SOLID_BALL_COLORS } from '../../data/defaultChannels';

interface ThumbnailGeneratorProps {
  channels: YouTubeChannelProfile[];
  currentChannel: YouTubeChannelProfile;
}

type ThumbnailLayout = 'split_focus' | 'minimal_swiss' | 'centered_zen' | 'bold_type' | 'dark_editorial';

const FALLBACK_CHANNEL: Partial<YouTubeChannelProfile> = {
  id: '',
  name: 'zenvision',
  channelHandle: '@zenvision',
  backgroundTheme: 'slate_zen',
  ballColor: '#ffffff',
  ballSize: 38,
};

const layoutOptions: { id: ThumbnailLayout; label: string }[] = [
  { id: 'split_focus', label: 'split focus' },
  { id: 'minimal_swiss', label: 'minimal swiss' },
  { id: 'centered_zen', label: 'centered zen' },
  { id: 'bold_type', label: 'bold type' },
  { id: 'dark_editorial', label: 'dark editorial' },
];

export const ThumbnailGenerator: React.FC<ThumbnailGeneratorProps> = ({
  channels,
  currentChannel: propChannel,
}) => {
  const currentChannel = propChannel || (channels[0] as YouTubeChannelProfile | undefined) || (FALLBACK_CHANNEL as YouTubeChannelProfile);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [selectedChannelId, setSelectedChannelId] = useState<string>(currentChannel.id || channels[0]?.id || '');
  const [layout, setLayout] = useState<ThumbnailLayout>('split_focus');
  const [selectedExerciseId, setSelectedExerciseId] = useState<ExerciseId>('infinity');
  const [headline, setHeadline] = useState<string>('7 min eye reset');
  const [subheadline, setSubheadline] = useState<string>('follow the ball • screen fatigue cure');
  const [durationTag, setDurationTag] = useState<string>('7 min');
  const [bgTheme, setBgTheme] = useState<BackgroundThemeId>(currentChannel.backgroundTheme || 'slate_zen');
  const [ballColor, setBallColor] = useState<string>(currentChannel.ballColor || '#ffffff');
  const [ballSize, setBallSize] = useState<number>(currentChannel.ballSize || 45);
  const [exportRes, setExportRes] = useState<'720p' | '1080p' | '4k'>('720p');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    if (selectedChannelId && channels.length > 0) {
      const next = channels.find((channel) => channel.id === selectedChannelId) || channels[0];
      if (next) {
        setBgTheme(next.backgroundTheme || 'slate_zen');
        setBallColor(next.ballColor || '#ffffff');
        setBallSize(next.ballSize || 45);
      }
    }
  }, [selectedChannelId, channels]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = exportRes === '4k' ? 3840 : exportRes === '1080p' ? 1920 : 1280;
    const height = exportRes === '4k' ? 2160 : exportRes === '1080p' ? 1080 : 720;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(ratio, ratio);

    const exercise = EXERCISE_DEFINITIONS[selectedExerciseId] || EXERCISE_DEFINITIONS.infinity;
    const themeGradients: Record<BackgroundThemeId, { start: string; end: string }> = {
      slate_zen: { start: '#0f172a', end: '#1d4ed8' },
      deep_space: { start: '#020617', end: '#1e293b' },
      clean_studio: { start: '#f8fafc', end: '#cbd5e1' },
      warm_sunrise: { start: '#7c2d12', end: '#f59e0b' },
      forest_mist: { start: '#052e16', end: '#22c55e' },
      cyber_amber: { start: '#111827', end: '#f59e0b' },
    };

    const { start, end } = themeGradients[bgTheme] || themeGradients.slate_zen;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, start);
    gradient.addColorStop(1, end);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    if (layout === 'split_focus') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.38)';
      ctx.fillRect(width * 0.52, 0, width * 0.48, height);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(width * 0.55, height * 0.18, width * 0.28, height * 0.2);
      ctx.font = `700 ${Math.floor(width * 0.05)}px Inter, sans-serif`;
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(headline, 60, height * 0.6);
      ctx.font = `500 ${Math.floor(width * 0.018)}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(subheadline, 60, height * 0.68);

      const cx = width * 0.73;
      const cy = height * 0.46;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(30, ballSize * 3), 0, Math.PI * 2);
      ctx.fillStyle = ballColor;
      ctx.shadowColor = ballColor;
      ctx.shadowBlur = 60;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `700 ${Math.floor(width * 0.022)}px Inter, sans-serif`;
      ctx.fillText(durationTag, 60, height * 0.8);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = `600 ${Math.floor(width * 0.012)}px Inter, sans-serif`;
      ctx.fillText(currentChannel.name || 'zenvision', 60, height * 0.86);
    } else if (layout === 'minimal_swiss') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 4;
      ctx.strokeRect(width * 0.12, height * 0.12, width * 0.76, height * 0.76);
      ctx.fillStyle = '#f8fafc';
      ctx.font = `700 ${Math.floor(width * 0.05)}px Inter, sans-serif`;
      ctx.fillText(headline, width * 0.17, height * 0.44);
      ctx.font = `500 ${Math.floor(width * 0.018)}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.fillText(subheadline, width * 0.17, height * 0.52);
      ctx.fillStyle = ballColor;
      ctx.beginPath();
      ctx.arc(width * 0.75, height * 0.64, Math.max(40, ballSize * 2.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.font = `700 ${Math.floor(width * 0.02)}px Inter, sans-serif`;
      ctx.fillText(durationTag, width * 0.17, height * 0.67);
    } else if (layout === 'centered_zen') {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, 0, width, height);
      const orb = { x: width * 0.5, y: height * 0.52, r: Math.max(70, ballSize * 3.2) };
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
      ctx.fillStyle = ballColor;
      ctx.shadowColor = ballColor;
      ctx.shadowBlur = 80;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#f8fafc';
      ctx.font = `800 ${Math.floor(width * 0.045)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(headline, width * 0.5, height * 0.32);
      ctx.font = `500 ${Math.floor(width * 0.02)}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText(subheadline, width * 0.5, height * 0.38);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `700 ${Math.floor(width * 0.022)}px Inter, sans-serif`;
      ctx.fillText(durationTag, width * 0.5, height * 0.76);
      ctx.textAlign = 'left';
    } else if (layout === 'bold_type') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = ballColor;
      ctx.beginPath();
      ctx.arc(width * 0.72, height * 0.42, Math.max(60, ballSize * 2.8), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.font = `900 ${Math.floor(width * 0.075)}px Inter, sans-serif`;
      ctx.fillText(headline.toUpperCase(), 60, height * 0.42);
      ctx.font = `700 ${Math.floor(width * 0.026)}px Inter, sans-serif`;
      ctx.fillText(subheadline.toUpperCase(), 60, height * 0.58);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = `700 ${Math.floor(width * 0.024)}px Inter, sans-serif`;
      ctx.fillText(durationTag, 60, height * 0.7);
    } else {
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.fillRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);
      ctx.fillStyle = '#f8fafc';
      ctx.font = `800 ${Math.floor(width * 0.05)}px Inter, sans-serif`;
      ctx.fillText(headline, width * 0.15, height * 0.46);
      ctx.font = `600 ${Math.floor(width * 0.02)}px Inter, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.fillText(subheadline, width * 0.15, height * 0.57);
      ctx.fillStyle = ballColor;
      ctx.beginPath();
      ctx.arc(width * 0.76, height * 0.56, Math.max(60, ballSize * 2.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `700 ${Math.floor(width * 0.02)}px Inter, sans-serif`;
      ctx.fillText(durationTag, width * 0.15, height * 0.7);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, height - 70, width, 70);
    ctx.fillStyle = '#f8fafc';
    ctx.font = `600 ${Math.floor(width * 0.019)}px Inter, sans-serif`;
    ctx.fillText(currentChannel.channelHandle || '@zenvision', 52, height - 28);
    ctx.fillText(exercise.name, width - 220, height - 28);

    ctx.restore();
  }, [bgTheme, ballColor, ballSize, exportRes, headline, layout, selectedExerciseId, subheadline, durationTag, currentChannel, channels]);

  const handleExport = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    const mime = exportRes === '4k' ? 'image/png' : 'image/png';
    link.download = `${(currentChannel.name || 'zenvision').toLowerCase()}-${layout}.png`;
    link.href = canvas.toDataURL(mime);
    link.click();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1200);
  };

  return (
    <div className="space-y-5 rounded-2xl border border-white/5 bg-[#0e1017] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">thumbnail studio</p>
          <p className="text-xs text-slate-400">design YouTube cover variants for the current eye training flow.</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-3 py-2 text-[11px] font-semibold text-slate-950"
        >
          {isCopied ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
          {isCopied ? 'saved' : 'export'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-2xl border border-white/5 bg-[#111827] p-3">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <Layout className="h-3 w-3 text-sky-400" />
              layout
            </div>
            <div className="flex flex-wrap gap-2">
              {layoutOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setLayout(option.id)}
                  className={`rounded-lg px-2 py-1 text-[10px] ${layout === option.id ? 'bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/40' : 'bg-white/5 text-slate-300'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">channel</div>
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs text-white"
            >
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id} className="bg-[#0e1017]">
                  {channel.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">exercise</div>
            <select
              value={selectedExerciseId}
              onChange={(e) => setSelectedExerciseId(e.target.value as ExerciseId)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs text-white"
            >
              {ALL_EXERCISES.map((exercise) => (
                <option key={exercise.id} value={exercise.id} className="bg-[#0e1017]">
                  {exercise.shortTitle}
                </option>
              ))}
            </select>
          </div>

          <label className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
            headline
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs text-white"
            />
          </label>

          <label className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
            subheadline
            <input
              value={subheadline}
              onChange={(e) => setSubheadline(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs text-white"
            />
          </label>

          <label className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
            duration tag
            <input
              value={durationTag}
              onChange={(e) => setDurationTag(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs text-white"
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
              <Palette className="h-3 w-3 text-sky-400" />
              style
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={bgTheme}
                onChange={(e) => setBgTheme(e.target.value as BackgroundThemeId)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs text-white"
              >
                {BACKGROUND_THEMES.map((theme) => (
                  <option key={theme.id} value={theme.id} className="bg-[#0e1017]">
                    {theme.name}
                  </option>
                ))}
              </select>
              <select
                value={ballColor}
                onChange={(e) => setBallColor(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs text-white"
              >
                {SOLID_BALL_COLORS.map((color) => (
                  <option key={color.color} value={color.color} className="bg-[#0e1017]">
                    {color.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="block text-[10px] uppercase tracking-[0.16em] text-slate-500">
              ball size
              <input
                type="range"
                min={24}
                max={90}
                value={ballSize}
                onChange={(e) => setBallSize(Number(e.target.value))}
                className="mt-1 w-full accent-sky-400"
              />
            </label>
            <select
              value={exportRes}
              onChange={(e) => setExportRes(e.target.value as '720p' | '1080p' | '4k')}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs text-white"
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4k">4k</option>
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#0b1020] p-3">
          <canvas ref={canvasRef} className="mx-auto max-h-[70vh] w-full rounded-xl border border-white/10 bg-black shadow-2xl shadow-slate-950/40" />
        </div>
      </div>
    </div>
  );
};
