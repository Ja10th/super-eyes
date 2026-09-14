import React, { useState } from 'react';
import { ChannelProfile } from '../../types';
import { BACKGROUND_THEMES, BALL_STYLES } from '../../data/defaultChannels';
import { ChannelModal } from './ChannelModal';
import {
  Tv,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Sparkles,
  ExternalLink,
  Zap,
} from 'lucide-react';
interface ChannelManagerProps {
  channels: ChannelProfile[];
  onSaveChannel: (channel: ChannelProfile) => void;
  onDeleteChannel: (channelId: string) => void;
  onSelectForStudio: (channelId: string) => void;
}
export const ChannelManager: React.FC<ChannelManagerProps> = ({
  channels,
  onSaveChannel,
  onDeleteChannel,
  onSelectForStudio,
}) => {
  const [editingChannel, setEditingChannel] = useState<ChannelProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const handleOpenAdd = () => {
    setEditingChannel(null);
    setIsModalOpen(true);
  };
   const handleOpenEdit = (channel: ChannelProfile) => {
    setEditingChannel(channel);
    setIsModalOpen(true);
  };
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400">
            <Tv className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Multi-Channel Network Hub</h2>
            <p className="text-xs text-slate-400">
              Manage distinct channel brand styles, ball visuals, and automated posting schedules
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenAdd}
          className="h-11 px-5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-sky-500/25 transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Connect New Channel</span>
        </button>
      </div>
        {/* Channel Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {channels.map((channel) => {
          const bgTheme = BACKGROUND_THEMES[channel.backgroundTheme] || BACKGROUND_THEMES.deep_space;
          const ballStyle = BALL_STYLES[channel.ballStyle] || BALL_STYLES.neon_orb;
          return (
            <div
              key={channel.id}
              className="bg-slate-900/90 border border-white/10 rounded-2xl p-5 space-y-5 shadow-none hover:border-white/20 transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Header info */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-base">{channel.name}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-sky-400 uppercase tracking-wider">
                        {channel.platform}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{channel.channelHandle}</p>
                  </div>
                  <div className="flex items-center gap-1">
                     <button
                      onClick={() => handleOpenEdit(channel)}
                      className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Edit Channel Settings"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {channels.length > 1 && (
                      <button
                        onClick={() => onDeleteChannel(channel.id)}
                        className="p-2 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete Channel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {/* Visual Style Preview Tile */}
                <div
                  className="h-28 rounded-xl relative overflow-hidden flex items-center justify-center border border-white/10 shadow-inner"
                  style={{
                    background: bgTheme.bgGradient,
                  }}
                >
                  {/* Styled Ball Preview */}
                  <div
                    className="rounded-full flex items-center justify-center transition-transform hover:scale-110"
                    style={{
                      width: `${channel.ballSize * 1.5}px`,
                      height: `${channel.ballSize * 1.5}px`,
                      backgroundColor: channel.ballColor,
                      boxShadow: 'none',
                    }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-white/90" />
                  </div>
                  {/* Badges on preview */}
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/50 backdrop-blur-md text-[10px] font-mono text-slate-300">
                    {bgTheme.name}
                  </div>
                  <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/50 backdrop-blur-md text-[10px] font-mono text-slate-300">
                    {ballStyle.name}
                  </div>
                </div>
                 {/* Auto Posting Schedule Info */}
                <div className="bg-white/5 rounded-xl p-3.5 border border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-emerald-400" />
                      Auto-Publish Frequency
                    </span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {channel.postsPerDay}x / day
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {channel.postingHours.map((hour) => (
                      <span
                        key={hour}
                        className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 font-mono text-[11px] font-medium"
                      >
                        {hour}
                      </span>
                    ))}
                  </div>
                    {channel.webhookUrl && (
                    <div className="text-[10px] text-slate-500 truncate pt-1">
                      Webhook: {channel.webhookUrl}
                    </div>
                  )}
                </div>
              </div>
              {/* Action */}
              <button
                onClick={() => onSelectForStudio(channel.id)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-sky-500/15 text-slate-300 hover:text-sky-400 border border-white/10 hover:border-sky-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                <span>Open in Video Studio</span>
              </button>
            </div>
          );
        })}
      </div>
      {/* Channel Edit / Add Modal */}
      <ChannelModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        channel={editingChannel}
        onSave={onSaveChannel}
      />
    </div>
  );
};
