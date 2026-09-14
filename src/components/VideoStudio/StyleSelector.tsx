import React from 'react';
import {
  BackgroundThemeId,
  YouTubeChannelProfile,
} from '../../types';
import { BACKGROUND_THEMES, SOLID_BALL_COLORS } from '../../data/defaultChannels';
import { Palette, Tv } from 'lucide-react';

interface StyleSelectorProps {
  channels: YouTubeChannelProfile[];
  selectedChannelId: string;
  onSelectChannel: (channelId: string) => void;
  backgroundTheme: BackgroundThemeId;
  onChangeBackgroundTheme: (theme: BackgroundThemeId) => void;
  ballColor: string;
  onChangeBallColor: (color: string) => void;
  ballSize: number;
  onChangeBallSize: (size: number) => void;
  introCaption: string;
  onChangeIntroCaption: (caption: string) => void;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  channels,
  selectedChannelId,
  onSelectChannel,
  backgroundTheme,
  onChangeBackgroundTheme,
  ballColor,
  onChangeBallColor,
  ballSize,
  onChangeBallSize,
  introCaption,
  onChangeIntroCaption,
}) => {
  return (
    <div className="bg-[#0e1017] border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-semibold text-white">channel style</h3>
    </div>

        {/* Channel Switcher */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Tv className="w-3.5 h-3.5" />
          <select
            value={selectedChannelId}
            onChange={(e) => onSelectChannel(e.target.value)}
            className="bg-white/5 text-xs text-slate-200 px-2 py-1 rounded-lg border border-white/10 focus:outline-none cursor-pointer"
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#0e1017] text-white">
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Video Background Picker */}
      <div className="space-y-1.5">
        <label className="text-xs text-slate-400 block">video background</label>
        <div className="grid grid-cols-3 gap-1.5">
          {Object.values(BACKGROUND_THEMES).map((theme) => {
            const isSelected = backgroundTheme === theme.id;
            return (
            <button
                key={theme.id}
                onClick={() => onChangeBackgroundTheme(theme.id as BackgroundThemeId)}
                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-white bg-white/10'
                    : 'border-white/5 bg-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: theme.accentColor }}
                  />
                  <span className="text-xs text-slate-200 truncate">{theme.name}</span>
                </div>
            </button>
            );
          })}
        </div>
      </div>

      {/* Solid Ball Colors (NO GLOW) */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <span>ball color (solid matte, no glow)</span>
          <span className="font-mono text-white text-[11px]">{ballSize}px</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1">
            {SOLID_BALL_COLORS.map((c) => {
              const isSelected = ballColor.toLowerCase() === c.color.toLowerCase();
              return (
                <button
                  key={c.id}
                  onClick={() => onChangeBallColor(c.color)}
                  className={`w-7 h-7 rounded-full transition-transform cursor-pointer border ${
                    isSelected
                      ? 'scale-110 border-white ring-2 ring-white/20'
                      : 'border-transparent opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.color }}
                  title={c.name}
                />
              );
            })}
          </div>

          {/* Size slider */}
          <input
            type="range"
            min="28"
            max="84"
            value={ballSize}
            onChange={(e) => onChangeBallSize(parseInt(e.target.value))}
            className="w-24 accent-white cursor-pointer"
            title="ball size"
          />
        </div>
      </div>

      {/* Intro Subtitle Caption (lowercase) */}
      <div className="space-y-1">
        <label className="text-xs text-slate-400 block">intro caption (lowercase helvetica)</label>
        <input
          type="text"
          value={introCaption}
          onChange={(e) => onChangeIntroCaption(e.target.value)}
          placeholder="settle your gaze. let the movement come to you."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-white/30"
        />
    </div>
  </div>
);
};
