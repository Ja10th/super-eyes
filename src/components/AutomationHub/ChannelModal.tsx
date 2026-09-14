import React, { useState } from 'react';
import { ChannelProfile, BackgroundThemeId, BallStyleId } from '../../types';
import { BACKGROUND_THEMES, BALL_STYLES } from '../../data/defaultChannels';
import { MUSIC_TRACKS } from '../../data/musicTracks';
import { X, Tv, Save, Palette, Clock, Webhook } from 'lucide-react';
interface ChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: ChannelProfile | null;
  onSave: (channel: ChannelProfile) => void;
}
export const ChannelModal: React.FC<ChannelModalProps> = ({
  isOpen,
  onClose,
  channel,
  onSave,
}) => {
  const [name, setName] = useState(channel?.name || 'New Eye Channel');
  const [handle, setHandle] = useState(channel?.channelHandle || '@MyVisionHQ');
  const [platform, setPlatform] = useState<ChannelProfile['platform']>(
    channel?.platform || 'youtube'
  );
  const [bgTheme, setBgTheme] = useState<BackgroundThemeId>(
    channel?.backgroundTheme || 'deep_space'
  );
  const [ballStyle, setBallStyle] = useState<BallStyleId>(
    channel?.ballStyle || 'neon_orb'
  );
  const [ballColor, setBallColor] = useState(channel?.ballColor || '#38bdf8');
  const [ballGlowColor, setBallGlowColor] = useState(
    channel?.ballGlowColor || '#0284c7'
  );
  const [ballSize, setBallSize] = useState(channel?.ballSize || 26);
  const [trailLength, setTrailLength] = useState(channel?.trailLength || 16);
  const [introText, setIntroText] = useState(
    channel?.introText || 'Hi. Relax and follow the ball.'
  );
  const [postsPerDay, setPostsPerDay] = useState(channel?.postsPerDay || 2);
  const [postingHoursStr, setPostingHoursStr] = useState(
    channel?.postingHours.join(', ') || '08:00, 18:00'
  );
  const [musicTrackId, setMusicTrackId] = useState(
    channel?.musicTrackId || 'zen_432hz'
  );
  const [webhookUrl, setWebhookUrl] = useState(channel?.webhookUrl || '');
  if (!isOpen) return null;
const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hours = postingHoursStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\d{2}:\d{2}$/.test(s));
    const introCaption = introText.trim() || 'Hi. Relax and follow the ball.';
    const updated: ChannelProfile = {
      id: channel?.id || `channel_${Date.now()}`,
      name,
      platform,
      channelHandle: handle,
      backgroundTheme: bgTheme,
      ballStyle,
      ballColor,
      ballGlowColor,
      ballSize,
      trailLength,
      introText,
      introCaption,
      postsPerDay,
      postingHours: hours.length > 0 ? hours : ['08:00', '18:00'],
      musicTrackId,
      voiceVolume: 0.95,
      musicVolume: 0.9,
      webhookUrl,
      createdAt: channel?.createdAt || new Date().toISOString(),
    };
    onSave(updated);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-400">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {channel ? 'Edit Channel Profile' : 'Connect New Channel'}
            </h2>
            <p className="text-xs text-slate-400">
              Configure channel video background, ball styling, and automated posting frequency
            </p>
          </div>
        </div>
         <form onSubmit={handleSubmit} className="space-y-5">
          {/* General Information */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-slate-300 font-medium">Channel Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as ChannelProfile['platform'])}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-400 cursor-pointer"
              >
                <option value="youtube" className="bg-slate-900">YouTube Long-Form</option>
                <option value="shorts" className="bg-slate-900">YouTube Shorts</option>
                <option value="tiktok" className="bg-slate-900">TikTok</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium">Handle / Channel Tag</label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@MyChannel"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300 font-medium">Default Music Track</label>
              <select
                value={musicTrackId}
                onChange={(e) => setMusicTrackId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-400 cursor-pointer"
              >
                {MUSIC_TRACKS.map((t) => (
                       <option key={t.id} value={t.id} className="bg-slate-900">
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* Visual Style & Ball Styling */}
          <div className="space-y-3 pt-2 border-t border-white/5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-indigo-400" />
              Video Aesthetic & Ball Archetype
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Background Theme</label>
                <select
                  value={bgTheme}
                  onChange={(e) => setBgTheme(e.target.value as BackgroundThemeId)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-400 cursor-pointer"
                >
                  {Object.values(BACKGROUND_THEMES).map((t) => (
                    <option key={t.id} value={t.id} className="bg-slate-900">
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Ball Style</label>
                <select
                  value={ballStyle}
                  onChange={(e) => setBallStyle(e.target.value as BallStyleId)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-400 cursor-pointer"
                >
                  {Object.values(BALL_STYLES).map((s) => (
                    <option key={s.id} value={s.id} className="bg-slate-900">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                 <label className="text-[11px] text-slate-400 font-medium">Ball Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={ballColor}
                    onChange={(e) => setBallColor(e.target.value)}
                    className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-300">{ballColor}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-medium">Glow Aura</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={ballGlowColor}
                    onChange={(e) => setBallGlowColor(e.target.value)}
                    className="w-7 h-7 rounded border-0 bg-transparent cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-300">{ballGlowColor}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-medium">Ball Size ({ballSize}px)</label>
                <input
                  type="range"
                  min="16"
                  max="42"
                  value={ballSize}
                  onChange={(e) => setBallSize(parseInt(e.target.value))}
                  className="w-full accent-sky-400 cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400 font-medium">Trail ({trailLength} pts)</label>
                <input
                  type="range"
                  min="0"
                  max="28"
                  value={trailLength}
                  onChange={(e) => setTrailLength(parseInt(e.target.value))}
                  className="w-full accent-indigo-400 cursor-pointer"
                />
              </div>
            </div>
          </div>
            {/* Automated Posting Frequency */}
          <div className="space-y-3 pt-2 border-t border-white/5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              Automated Posting Frequency & Times
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">Posts Per Day</label>
                <select
                  value={postsPerDay}
                  onChange={(e) => {
                    const count = parseInt(e.target.value);
                    setPostsPerDay(count);
                    const defaultSlots: Record<number, string> = {
                      1: '09:00',
                      2: '08:00, 18:00',
                      3: '08:00, 13:00, 19:00',
                      4: '08:00, 12:00, 16:00, 20:00',
                      6: '06:00, 09:00, 12:00, 15:00, 18:00, 21:00',
                    };
                    setPostingHoursStr(defaultSlots[count] || '08:00, 18:00');
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-400 cursor-pointer"
                >
                  <option value={1} className="bg-slate-900">1 Video / Day</option>
                  <option value={2} className="bg-slate-900">2 Videos / Day</option>
                  <option value={3} className="bg-slate-900">3 Videos / Day</option>
                  <option value={4} className="bg-slate-900">4 Videos / Day</option>
                  <option value={6} className="bg-slate-900">6 Videos / Day</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-300 font-medium">
                  Posting Hours (comma-separated HH:MM)
                </label>
                <input
                  type="text"
                  value={postingHoursStr}
                  onChange={(e) => setPostingHoursStr(e.target.value)}
                  placeholder="08:00, 18:00"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>
          </div>
            {/* Webhook Endpoint */}
          <div className="space-y-1 pt-2 border-t border-white/5">
            <label className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
              <Webhook className="w-3.5 h-3.5 text-indigo-400" />
              Webhook / Auto-Publish Endpoint (Optional)
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://api.myautomation.com/youtube/publish-webhook"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-sky-400"
            />
            <p className="text-[11px] text-slate-500">
              When video is ready, payload is dispatched automatically to your webhook or Zapier/n8n workflow.
            </p>
          </div>
          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-sky-500/25 transition-all active:scale-95 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Channel Profile</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
