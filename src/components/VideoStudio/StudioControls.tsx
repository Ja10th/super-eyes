import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Download,
  Clock,
  Shuffle,
} from 'lucide-react';
import { SESSION_PRESETS } from '../../data/presets';
import { MUSIC_TRACKS } from '../../data/musicTracks';
import { EXERCISE_DEFINITIONS } from '../../data/exercises';
import { BACKGROUND_THEMES } from '../../data/defaultChannels';
import { VideoResolution } from '../../types';
interface StudioControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  currentTime: number;
  totalDuration: number;
  onSeek: (time: number) => void;
  selectedPresetId: string;
  onSelectPreset: (presetId: string) => void;
  onRandomizeFlow?: () => void;
  voiceVolume: number;
  musicVolume: number;
  onVoiceVolumeChange: (vol: number) => void;
  onMusicVolumeChange: (vol: number) => void;
  musicTrackId: string;
  onMusicTrackChange: (trackId: string) => void;
  resolution: VideoResolution;
  onResolutionChange: (res: VideoResolution) => void;
  onOpenExportModal: () => void;
  ballColor?: string;
  backgroundTheme?: string;
}
export const StudioControls: React.FC<StudioControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onReset,
  currentTime,
  totalDuration,
  onSeek,
  selectedPresetId,
  onSelectPreset,
  onRandomizeFlow,
  voiceVolume,
  musicVolume,
  onVoiceVolumeChange,
  onMusicVolumeChange,
  musicTrackId,
  onMusicTrackChange,
  resolution,
  onResolutionChange,
  onOpenExportModal,
  ballColor = '#ffffff',
  backgroundTheme = 'slate_zen',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const scrubberRef = useRef<HTMLDivElement | null>(null);
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };
  const displayTime = isDragging ? dragTime : currentTime;
  const progressPercent =
    totalDuration > 0 ? (displayTime / totalDuration) * 100 : 0;
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubberRef.current) return;
    setIsDragging(true);
    const rect = scrubberRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const targetTime = pos * totalDuration;
    setDragTime(targetTime);
    onSeek(targetTime);
  };
  useEffect(() => {
    if (!isDragging) return;
    const handlePointerMove = (e: PointerEvent) => {
      if (!scrubberRef.current) return;
      const rect = scrubberRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetTime = pos * totalDuration;
      setDragTime(targetTime);
      onSeek(targetTime);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, totalDuration, onSeek]);
  const previewPath = EXERCISE_DEFINITIONS.horizontal.getTrajectoryPath(420, 240) ?? [
    { x: 60, y: 120 },
    { x: 360, y: 120 },
  ];
  const previewProgress = totalDuration > 0 ? Math.min(1, currentTime / totalDuration) : 0;
  const previewT = previewProgress * 10;
  const previewPos = EXERCISE_DEFINITIONS.horizontal.calculatePosition(previewT, 0, 420, 240) ?? { x: 210, y: 120 };
  const previewBackground = BACKGROUND_THEMES[backgroundTheme as keyof typeof BACKGROUND_THEMES]?.bgGradient || BACKGROUND_THEMES.slate_zen.bgGradient;

  return (
    <div className="bg-[#0e1017] border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl">
      {/* Session Presets Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-white/5 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="w-3.5 h-3.5 text-sky-400" />
          <span>session duration</span>
        </div>
        <div className="flex items-center gap-1.5">
          {SESSION_PRESETS.map((preset) => {
            const isSelected = selectedPresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset(preset.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white text-slate-950 font-semibold shadow-sm'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {preset.targetDurationMinutes} min
              </button>
            );
          })}
              {onRandomizeFlow && (
            <button
              onClick={onRandomizeFlow}
              title="generate a unique randomized exercise mix"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition-all cursor-pointer ml-1"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>randomize flow</span>
            </button>
          )}
        </div>
      </div>
      {/* Interactive Smooth Drag Scrubber */}
      <div className="space-y-1.5 select-none">
        <div className="flex justify-between items-center text-xs font-mono text-slate-400">
          <span className="text-white font-medium">{formatTime(displayTime)}</span>
          <span className="text-slate-500">{formatTime(totalDuration)}</span>
        </div>
        <div
          ref={scrubberRef}
          onPointerDown={handlePointerDown}
          className="relative h-4 flex items-center cursor-pointer group"
        >
          {/* Background Track */}
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            {/* Filled Progress */}
            <div
              className="h-full bg-white rounded-full transition-none"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
             {/* Draggable Scrubber Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md transition-transform transform -translate-x-1/2 group-hover:scale-125 cursor-grab active:cursor-grabbing"
            style={{ left: `${progressPercent}%` }}
          />
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">audio mix</div>
        <div className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-3">
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span>voice</span>
            <span>{Math.round(voiceVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={voiceVolume}
            onChange={(e) => onVoiceVolumeChange(Number(e.target.value))}
            className="w-full accent-sky-400 cursor-pointer"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-300">
            <span>music</span>
            <span>{Math.round(musicVolume * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={musicVolume}
            onChange={(e) => onMusicVolumeChange(Number(e.target.value))}
            className="w-full accent-sky-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Main Playback Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={onTogglePlay}
            className="h-10 px-5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>play</span>
              </>
            )}
          </button>
          <button
            onClick={onReset}
            title="reset to start"
            className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 flex items-center justify-center transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
    {/* Audio Mixing & Resolution Controls */}
        <div className="flex items-center gap-3">
          {/* Calm Ambient Music */}
          <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl border border-white/5 text-xs">
            <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={musicTrackId}
              onChange={(e) => onMusicTrackChange(e.target.value)}
              className="bg-transparent text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              {MUSIC_TRACKS.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#0e1017] text-white">
                  {t.name.toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          {/* 4K vs 1080p Toggle */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 text-xs">
            <button
              onClick={() => onResolutionChange('4k')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                resolution === '4k'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              4k
            </button>
            <button
              onClick={() => onResolutionChange('1080p')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                resolution === '1080p'
                  ? 'bg-sky-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              1080p
            </button>
          </div>

          {/* Export Video Button */}
          <button
            onClick={onOpenExportModal}
            className="h-10 px-4 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>export {resolution}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
