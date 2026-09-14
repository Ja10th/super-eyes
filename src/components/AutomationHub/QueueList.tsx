import React, { useState } from 'react';
import { ScheduledPost, ChannelProfile } from '../../types';
import { automationService } from '../../services/automationService';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Send,
  Sparkles,
  Zap,
  Play,
  Film,
} from 'lucide-react';
interface QueueListProps {
  schedules: ScheduledPost[];
  channels: ChannelProfile[];
  onRefreshSchedules: () => void;
  onLoadSessionInStudio: (post: ScheduledPost) => void;
}
export const QueueList: React.FC<QueueListProps> = ({
  schedules,
  channels,
  onRefreshSchedules,
  onLoadSessionInStudio,
}) => {
  const [filterChannelId, setFilterChannelId] = useState<string>('all');
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const filtered = schedules.filter((p) => {
    if (filterChannelId !== 'all' && p.channelId !== filterChannelId) return false;
    return true;
  });
  const handlePublishNow = async (post: ScheduledPost) => {
    setPublishingId(post.id);
    setStatusFeedback(null);
    onRefreshSchedules();
    try {
      const res = await automationService.triggerPublishWebhook(post);
      setStatusFeedback(res.message);
      onRefreshSchedules();
      setTimeout(() => setStatusFeedback(null), 4000);
    } catch (err) {
      setStatusFeedback(`Publish error: ${String(err)}`);
    } finally {
      setPublishingId(null);
    }
  };
  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Automated Publishing Queue</h2>
            <p className="text-xs text-slate-400">
              Auto-scheduled videos matching your channels' daily posting frequency
            </p>
          </div>
        </div>
        {/* Filter by Channel */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Filter:</span>
          <select
            value={filterChannelId}
            onChange={(e) => setFilterChannelId(e.target.value)}
            className="bg-white/5 text-xs text-slate-200 px-3 py-2 rounded-xl border border-white/10 focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-slate-900">All Channels</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id} className="bg-slate-900">
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
        {/* Notification banner */}
      {statusFeedback && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusFeedback}</span>
        </div>
      )}
      {/* Posts List */}
      <div className="space-y-3">
        {filtered.map((post) => {
          const isPublished = post.status === 'published';
          const isReady = post.status === 'ready';
          const isRendering = post.status === 'rendering';
          const isUploading = post.status === 'uploading';
          const isFailed = post.status === 'failed';
          const isPublishing = publishingId === post.id || isRendering || isUploading || isReady;
          return (
            <div
              key={post.id}
              className={`p-4 rounded-2xl border transition-all flex flex-wrap items-center justify-between gap-4 ${
                isPublished
                  ? 'bg-white/2 border-white/5 opacity-75'
                  : 'bg-slate-900/90 border-white/10 hover:border-white/20'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* Time badge */}
                <div className="flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-white/5 border border-white/5 shrink-0">
                  <Clock className="w-4 h-4 text-sky-400 mb-1" />
                  <span className="text-xs font-mono font-bold text-white">{post.scheduledTime}</span>
                  <span className="text-[10px] text-slate-400">{post.scheduledDate.slice(5)}</span>
                     </div>
                {/* Details */}
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400">
                      {post.channelName}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-300 bg-white/5">
                      {post.durationMinutes} Min Full Routine
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isPublished
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : isReady
                            ? 'bg-amber-500/10 text-amber-400'
                            : isRendering
                              ? 'bg-violet-500/10 text-violet-400'
                              : isUploading
                                ? 'bg-sky-500/10 text-sky-400'
                                : isFailed
                                  ? 'bg-rose-500/10 text-rose-400'
                              : 'bg-indigo-500/10 text-indigo-400'
                      }`}
                    >
                      {post.status}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white truncate max-w-lg">
                    {post.title}
                  </h3>
                  {(isRendering || isUploading || isReady || isPublished || isFailed) && (
                    <div className="w-full max-w-md">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span>{post.backendStage || (isUploading ? 'uploading' : isFailed ? 'failed' : 'render progress')}</span>
                        <span>{Math.max(0, Math.min(100, post.renderProgress ?? (isPublished ? 100 : isReady ? 100 : 0)))}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            isPublished ? 'bg-emerald-400' : isFailed ? 'bg-rose-400' : isReady ? 'bg-amber-400' : isUploading ? 'bg-sky-400' : 'bg-violet-400'
                          }`}
                          style={{ width: `${Math.max(0, Math.min(100, post.renderProgress ?? (isPublished ? 100 : isReady ? 100 : 0)))}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {isFailed && post.backendError && <p className="text-xs text-rose-300">{post.backendError}</p>}
                  {post.previewUrl && (
                    <div className="w-full max-w-md mt-2">
                      <video
                        src={post.previewUrl}
                        controls
                        playsInline
                        className="w-full h-40 rounded-xl border border-white/10 bg-black object-cover"
                      />
                    </div>
                  )}
                  <p className="text-xs text-slate-400">
                    {post.sessionConfig.items.length} Standard & Unique Exercises • Voice Instructions + 432Hz Calm Pad
                  </p>
                </div>
              </div>
                {/* Actions */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => onLoadSessionInStudio(post)}
                  className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Film className="w-3.5 h-3.5 text-sky-400" />
                  <span>Open in Studio</span>
                </button>
                {post.status === 'scheduled' && (
                  <button
                    onClick={() => handlePublishNow(post)}
                    disabled={isPublished || isPublishing}
                    title="Queue the actual backend render and upload pipeline"
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isPublished
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isPublished ? 'Published' : isPublishing ? 'Queued...' : 'Queue Render'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
