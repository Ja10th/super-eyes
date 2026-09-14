import React, { useState } from 'react';
import { YouTubeChannelProfile } from '../../types';
import { BACKGROUND_THEMES } from '../../data/defaultChannels';
import { YouTubeModal } from './YouTubeModal';
import {
  Plus,
  Edit2,
  Trash2,
  Clock,
  Zap,
  CheckCircle2,
  AlertCircle,
  UserCircle2,
} from 'lucide-react';
import { YouTubeIcon } from '../YouTubeIcon';
interface YouTubeManagerProps {
  channels: YouTubeChannelProfile[];
  onSaveChannel: (channel: YouTubeChannelProfile) => void;
  onDeleteChannel: (channelId: string) => void;
  onSelectForStudio: (channelId: string) => void;
}
export const YouTubeManager: React.FC<YouTubeManagerProps> = ({
  channels,
  onSaveChannel,
  onDeleteChannel,
  onSelectForStudio,
}) => {
  const [editingChannel, setEditingChannel] = useState<YouTubeChannelProfile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const handleOpenAdd = () => {
    setEditingChannel(null);
    setIsModalOpen(true);
  };
  const handleOpenEdit = (channel: 
    YouTubeChannelProfile) => {
    setEditingChannel(channel);
    setIsModalOpen(true);
  };
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0e1017] border border-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500">
            <YouTubeIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">
              youtube channels
            </h2>
            <p className="text-xs text-slate-400">
              {channels.length === 0
                ? 'no channels connected — click "connect youtube channel" to add one'
                : `${channels.length} channel${channels.length > 1 ? 's' : ''} connected`}
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenAdd}
          className="h-10 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>connect youtube channel</span>
        </button>
           </div>
      {/* Empty State */}
      {channels.length === 0 && (
        <div className="bg-[#0e1017] border border-white/5 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 text-center">
          <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
            <YouTubeIcon className="w-10 h-10 text-red-500/60" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">no youtube channels connected</h3>
            <p className="text-xs text-slate-400 max-w-xs">
              click "connect youtube channel" above to verify a real YouTube channel. it will auto-fill your channel name, ID, avatar and subscriber count.
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="mt-2 h-10 px-5 rounded-xl bg-white hover:bg-slate-100 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            connect first channel
          </button>
        </div>
      )}
      {/* Channels Grid */}
      {channels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {channels.map((channel) => {
            const bgTheme = BACKGROUND_THEMES[channel.backgroundTheme] || BACKGROUND_THEMES.slate_zen;
                   const isVerified = channel.isVerified || channel.isConnected;
            return (
              <div
                key={channel.id}
                className="bg-[#0e1017] border border-white/5 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Channel Header with Avatar */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {channel.avatarUrl ? (
                        <img
                          src={channel.avatarUrl}
                          alt={channel.name}
                          className="w-10 h-10 rounded-full object-cover border border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          <UserCircle2 className="w-5 h-5 text-slate-500" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-white text-sm truncate">{channel.name}</h3>
                          {isVerified ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                          )}
                                           </div>
                        <p className="text-xs text-slate-400 truncate">{channel.channelHandle}</p>
                        {channel.subscriberCount && (
                          <p className="text-[11px] text-slate-500">{channel.subscriberCount}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(channel)}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${channel.name}?`)) onDeleteChannel(channel.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Verification / Channel ID */}
                  <div className={`px-2.5 py-1.5 rounded-xl text-[11px] flex items-center gap-1.5 ${isVerified
                      ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/15'
                      : 'bg-amber-950/30 text-amber-400 border border-amber-500/15'
                  }`}>
                    {isVerified ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                    <span>{isVerified ? 'channel verified' : 'unverified — click edit to verify'}</span>
                  </div>
                  {/* Visual Preview (no glow) */}
                  <div
                    className="h-20 rounded-xl relative overflow-hidden flex items-center justify-center border border-white/5"
                    style={{ background: bgTheme.bgGradient }}
                  >
                    <div
                      className="rounded-full"
                      style={{
                        width: `${channel.ballSize * 1.4}px`,
                        height: `${channel.ballSize * 1.4}px`,
                        backgroundColor: channel.ballColor,
                        boxShadow: 'none',
                      }}
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/50 text-[10px] text-slate-400">
                      {bgTheme.name}
                    </div>
                  </div>
                  {/* Auto-Upload Schedule */}
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Clock className="w-3 h-3 text-sky-400" />
                        auto-upload
                      </span>
                      <span className="font-semibold text-white">
                        {channel.postsPerDay}× / day
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                        {channel.postingHours.map((hour) => (
                        <span
                          key={hour}
                          className="px-2 py-0.5 rounded bg-white/5 text-slate-300 font-mono text-[11px]"
                        >
                          {hour}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Open in studio */}
                <button
                  onClick={() => onSelectForStudio(channel.id)}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Zap className="w-3 h-3 text-sky-400" />
                  <span>load in video studio</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
      {/* YouTube Channel Modal */}
      <YouTubeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        channel={editingChannel}
        onSave={onSaveChannel}
      />
    </div>
  );
};
