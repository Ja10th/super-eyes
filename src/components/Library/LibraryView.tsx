import React, { useMemo, useState } from 'react';
import { Calendar, Film, Play, RotateCcw, Send, Trash2 } from 'lucide-react';
import { ScheduledPost } from '../../types';

interface LibraryViewProps {
  schedules: ScheduledPost[];
  onLoadSessionInStudio: (post: ScheduledPost) => void;
  onPostNow: (post: ScheduledPost) => Promise<void>;
  onClearQueue: () => Promise<void>;
}

type LibraryFilter = 'all' | 'ready' | 'scheduled' | 'published' | 'rendering' | 'failed';

export const LibraryView: React.FC<LibraryViewProps> = ({ schedules, onLoadSessionInStudio, onPostNow, onClearQueue }) => {
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [postingId, setPostingId] = useState<string | null>(null);
  const rendered = useMemo(() => schedules.filter((post) => {
    if (filter === 'all') return true;
    return post.status === filter;
  }), [filter, schedules]);

  const watchedCount = schedules.filter((post) => post.previewUrl).length;
  const readyCount = schedules.filter((post) => post.status === 'ready' || post.status === 'scheduled' || post.status === 'published').length;

  return (
    <div className="aiv2-library space-y-8">
      <div className="aiv2-library-stats">
        <div><span>rendered files</span><strong>{watchedCount}</strong></div>
        <div><span>ready to watch</span><strong>{readyCount}</strong></div>
        <div><span>total sessions</span><strong>{schedules.length}</strong></div>
      </div>

      <div className="aiv2-library-toolbar">
        <div className="flex items-center gap-2"><Film className="w-4 h-4" /><span>your rendered sessions</span></div>
        <div className="flex flex-wrap gap-2 items-center">
          {(['all', 'ready', 'scheduled', 'published', 'rendering', 'failed'] as LibraryFilter[]).map((item) => (
            <button key={item} onClick={() => setFilter(item)} className={`aiv2-filter ${filter === item ? 'is-active' : ''}`}>{item}</button>
          ))}
          <button
            onClick={onClearQueue}
            className="aiv2-small-button text-red-300 border-red-400/40"
            title="Remove all jobs from the Neon queue and clear this list"
          >
            <Trash2 className="w-3 h-3" /> clear queue
          </button>
        </div>
      </div>

      {rendered.length === 0 ? (
        <div className="aiv2-empty">
          <Calendar className="w-8 h-8" />
          <h2>Nothing rendered yet.</h2>
          <p>Queue a session from Automations. Once the worker finishes, the actual MP4 will appear here with playback controls.</p>
        </div>
      ) : (
        <div className="aiv2-library-grid">
          {rendered.map((post) => (
            <article key={post.id} className="aiv2-video-card">
              <div className="aiv2-video-frame">
                {post.previewUrl ? (
                  <video src={post.previewUrl} controls playsInline preload="metadata" />
                ) : (
                  <div className="aiv2-video-placeholder"><RotateCcw className="w-6 h-6 animate-spin" /><span>{post.backendStage || post.status}</span></div>
                )}
                <span className={`aiv2-video-status status-${post.status}`}>{post.status}</span>
              </div>
              <div className="aiv2-video-copy">
                <div className="aiv2-video-meta">{post.channelName} · {post.durationMinutes} min · scheduled {post.scheduledDate} at {post.scheduledTime}</div>
                <h2>{post.title}</h2>
                <p>{post.sessionConfig.items.length} exercises · {post.sessionConfig.musicTrackId} · voice instructions</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button onClick={() => onLoadSessionInStudio(post)} className="aiv2-small-button"><Play className="w-3 h-3" /> open studio</button>
                  {post.previewUrl && <a href={post.previewUrl} target="_blank" rel="noreferrer" className="aiv2-small-button">open MP4 ↗</a>}
                  {post.previewUrl && post.status !== 'published' && (
                    <button
                      onClick={async () => { setPostingId(post.id); await onPostNow(post); setPostingId(null); }}
                      disabled={postingId === post.id}
                      className="aiv2-small-button"
                    >
                      <Send className="w-3 h-3" /> {postingId === post.id ? 'posting…' : 'post now'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
