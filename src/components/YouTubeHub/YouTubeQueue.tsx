import React, { useState } from 'react';
import { ScheduledPost, YouTubeChannelProfile } from '../../types';
import { automationService } from '../../services/automationService';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Send,
  Film,
  Trash2,
  RefreshCw,
  Zap,
  AlertCircle,
  Plus,
  Filter,
} from 'lucide-react';
import { YouTubeIcon } from '../YouTubeIcon';
import { SESSION_PRESETS } from '../../data/presets';
import { VideoThumbnail } from './VideoThumbnail';

interface YouTubeQueueProps {
  schedules: ScheduledPost[];
  channels: YouTubeChannelProfile[];
  onRefreshSchedules: () => void;
  onLoadSessionInStudio: (post: ScheduledPost) => void;
}

export const YouTubeQueue: React.FC<YouTubeQueueProps> = ({
  schedules,
  channels,
  onRefreshSchedules,
  onLoadSessionInStudio,
}) => {
  const [filterChannelId, setFilterChannelId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{ msg: string; ok: boolean } | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const filtered = schedules.filter((p) => {
    if (filterChannelId !== 'all' && p.channelId !== filterChannelId) return false;
    if (filterStatus !== 'all' && p.status !== filterStatus) return false;
    return true;
  });

  const upcomingCount = schedules.filter((p) => p.status === 'scheduled' || p.status === 'rendering' || p.status === 'ready').length;

  const handlePublishNow = async (post: ScheduledPost) => {
    setPublishingId(post.id);
    setStatusFeedback(null);
    onRefreshSchedules();
    try {
      const res = await automationService.triggerPublishWebhook(post);
      setStatusFeedback({ msg: res.message, ok: res.success });
      onRefreshSchedules();
      setTimeout(() => setStatusFeedback(null), 5000);
    } catch (err) {
      setStatusFeedback({ msg: `error: ${String(err)}`, ok: false });
    } finally {
      setPublishingId(null);
    }
  };

  const handleDelete = (id: string) => {
    automationService.deleteSchedule(id);
    onRefreshSchedules();
  };

  const handleClearAll = (channelId?: string) => {
    if (!confirm(channelId ? 'Clear all queue slots for this channel?' : 'Clear the entire upload queue?')) return;
    automationService.clearSchedules(channelId);
    onRefreshSchedules();
  };

  const handleGenerateForChannel = (channel: YouTubeChannelProfile) => {
    setGenerating(channel.id);
    const added = automationService.generateAutoSchedule(channel, 7);
    onRefreshSchedules();
    setGenerating(null);
    setStatusFeedback({
      msg: `generated ${added.length} upload slots for ${channel.name} (next 7 days).`,
      ok: true,
    });
    setTimeout(() => setStatusFeedback(null), 5000);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0e1017] border border-white/5 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500">
            <YouTubeIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">
              youtube upload queue
            </h2>
            <p className="text-xs text-slate-400">
              {upcomingCount > 0
                ? `${upcomingCount} slot${upcomingCount > 1 ? 's' : ''} scheduled across ${channels.length} channel${channels.length > 1 ? 's' : ''}`
                : 'no slots scheduled yet — generate a schedule below'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {schedules.length > 0 && (
            <button
              onClick={() => handleClearAll()}
              className="h-8 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs flex items-center gap-1.5 border border-rose-500/20 transition-all cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              clear all
            </button>
          )}
          <button
            onClick={onRefreshSchedules}
            className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 flex items-center justify-center transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Notification banner */}
      {statusFeedback && (
        <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
          statusFeedback.ok
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
        }`}>
          {statusFeedback.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{statusFeedback.msg}</span>
        </div>
      )}

      {/* Generate buttons per channel */}
      {channels.length > 0 && (
        <div className="bg-[#0e1017] border border-white/5 rounded-2xl p-4 space-y-3">
          <p className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-sky-400" />
            generate schedule (7-day forward-looking unique sessions)
          </p>
          <div className="flex flex-wrap gap-2">
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => handleGenerateForChannel(ch)}
                disabled={generating === ch.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs border border-sky-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {generating === ch.id ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                generate for {ch.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {schedules.length === 0 && (
        <div className="bg-[#0e1017] border border-white/5 rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center">
          <div className="p-3 rounded-2xl bg-white/5">
            <Calendar className="w-8 h-8 text-slate-500" />
          </div>
          <p className="text-slate-300 font-semibold">no upload slots scheduled</p>
          <p className="text-xs text-slate-500 max-w-sm">
            connect at least one YouTube channel, then click "generate for [channel]" above to create a real 7-day upload queue using unique randomized eye training sessions.
          </p>
          {channels.length === 0 && (
            <p className="text-xs text-rose-400 mt-1">
              ⚠ no channels connected yet. go to "youtube channels" tab first.
            </p>
          )}
        </div>
      )}

      {/* Filters */}
      {schedules.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>filter:</span>
          </div>
          <select
            value={filterChannelId}
            onChange={(e) => setFilterChannelId(e.target.value)}
            className="bg-white/5 text-xs text-slate-200 px-2.5 py-1.5 rounded-lg border border-white/10 focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-[#0e1017]">all channels</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#0e1017]">
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white/5 text-xs text-slate-200 px-2.5 py-1.5 rounded-lg border border-white/10 focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-[#0e1017]">all status</option>
            <option value="scheduled" className="bg-[#0e1017]">scheduled</option>
            <option value="rendering" className="bg-[#0e1017]">rendering</option>
            <option value="ready" className="bg-[#0e1017]">ready</option>
            <option value="published" className="bg-[#0e1017]">published</option>
          </select>
          <span className="text-slate-500 ml-auto">{filtered.length} items</span>
        </div>
      )}

      {/* Schedule Items List */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((post) => {
            const isPublished = post.status === 'published';
            const isReady = post.status === 'ready';
            const isRendering = post.status === 'rendering';
            const isPublishing = publishingId === post.id || isRendering || isReady;
            const channelTheme = post.sessionConfig.backgroundTheme || channels.find((c) => c.id === post.channelId)?.backgroundTheme || 'slate_zen';

            return (
              <div
                key={post.id}
                className={`p-3.5 rounded-2xl border transition-all flex flex-wrap items-center justify-between gap-3 text-xs ${
                  isPublished
                    ? 'bg-transparent border-white/5 opacity-50'
                    : 'bg-[#0e1017] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="w-32 sm:w-40 aspect-video rounded-xl overflow-hidden border border-white/10 bg-black shrink-0">
                  <VideoThumbnail
                    exerciseId={post.sessionConfig.items[0]?.exerciseId || 'horizontal'}
                    ballColor={post.sessionConfig.ballColor}
                    backgroundTheme={channelTheme}
                  />
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-white/5 border border-white/5 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-sky-400 mb-0.5" />
                    <span className="font-mono font-semibold text-white text-[11px]">{post.scheduledTime}</span>
                    <span className="text-[10px] text-slate-500">{post.scheduledDate.slice(5)}</span>
                  </div>

                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-400 font-medium">{post.channelName}</span>
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-500">{post.durationMinutes} min</span>
                      <span
                        className={`px-1.5 rounded text-[10px] uppercase font-semibold ${
                          isPublished ? 'text-emerald-400' : isReady ? 'text-amber-400' : isRendering ? 'text-violet-400' : 'text-sky-400'
                        }`}
                      >
                        {post.status}
                      </span>
                    </div>

                    <h3 className="font-medium text-white truncate max-w-sm">{post.title}</h3>

                    {(isRendering || isReady || isPublished) && (
                      <div className="w-full max-w-xs">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <span>render progress</span>
                          <span>{Math.max(0, Math.min(100, post.renderProgress ?? (isPublished ? 100 : isReady ? 100 : 0)))}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isPublished ? 'bg-emerald-400' : isReady ? 'bg-amber-400' : 'bg-violet-400'
                            }`}
                            style={{ width: `${Math.max(0, Math.min(100, post.renderProgress ?? (isPublished ? 100 : isReady ? 100 : 0)))}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500">
                      {post.sessionConfig.items.length} exercises •{' '}
                      {post.sessionConfig.resolution?.toUpperCase() || '4K'} 60fps •{' '}
                      {post.youtubeChannelId || 'no channel id'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onLoadSessionInStudio(post)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Film className="w-3 h-3 text-sky-400" />
                    studio
                  </button>

                  {!isPublished && post.status === 'scheduled' && (
                    <button
                      onClick={() => handlePublishNow(post)}
                      disabled={isPublishing}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer bg-white hover:bg-slate-100 text-slate-950 disabled:opacity-50"
                    >
                      {isPublishing ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3" />
                      )}
                      {isPublishing ? 'uploading...' : 'upload now'}
                    </button>
                  )}

                  {isPublished && (
                    <span className="flex items-center gap-1 text-emerald-400 text-xs px-2">
                      <CheckCircle2 className="w-3 h-3" />
                      published
                    </span>
                  )}

                  <button
                    onClick={() => handleDelete(post.id)}
                    className="w-7 h-7 rounded-lg hover:bg-rose-500/20 text-slate-600 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
