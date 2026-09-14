import React, { useState } from 'react';
import { CalendarClock, Check, Clock3, Layers3, Zap } from 'lucide-react';
import { ScheduledPost, YouTubeChannelProfile } from '../../types';
import { automationService } from '../../services/automationService';

interface AutomationOverviewProps {
  channels: YouTubeChannelProfile[];
  schedules: ScheduledPost[];
  onRefreshSchedules: () => void;
}

export const AutomationOverview: React.FC<AutomationOverviewProps> = ({ channels, schedules, onRefreshSchedules }) => {
  const [generating, setGenerating] = useState<string | null>(null);
  const [queueing, setQueueing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const active = schedules.filter((post) => post.status === 'rendering' || post.status === 'uploading').length;
  const ready = schedules.filter((post) => post.status === 'ready' || post.status === 'published').length;

  const generate = async (channel: YouTubeChannelProfile) => {
    setGenerating(channel.id);
    setFeedback(null);
    const added = automationService.generateAutoSchedule(channel, 7);
    const existingUnqueued = automationService.getSchedules().filter((post) =>
      post.channelId === channel.id && post.status === 'scheduled' && !post.backendJobId
    );
    const toQueue = Array.from(new Map([...added, ...existingUnqueued].map((post) => [post.id, post])).values());
    let queued = 0;
    for (const post of toQueue) {
      const result = await automationService.triggerPublishWebhook(post);
      if (result.success) queued += 1;
    }
    onRefreshSchedules();
    setFeedback(`generated ${added.length} sessions and queued ${queued} for automatic publishing.`);
    setGenerating(null);
  };

  const queueNow = async (post: ScheduledPost, forcePostNow = false) => {
    setQueueing(post.id);
    setFeedback(null);
    const result = await automationService.triggerPublishWebhook(post, forcePostNow);
    setFeedback(result.message);
    onRefreshSchedules();
    setQueueing(null);
  };

  return (
    <div className="space-y-8">
      <div className="aiv2-automation-grid">
        <div className="aiv2-automation-stat"><span><Layers3 className="w-4 h-4" /> planned sessions</span><strong>{schedules.length}</strong></div>
        <div className="aiv2-automation-stat"><span><Zap className="w-4 h-4" /> worker activity</span><strong>{active}</strong></div>
        <div className="aiv2-automation-stat"><span><Check className="w-4 h-4" /> ready / published</span><strong>{ready}</strong></div>
      </div>

      <section className="aiv2-planner-panel">
        <div className="flex items-start justify-between gap-4">
          <div><div className="aiv2-kicker">planner / seven day horizon</div><h2>What should run next?</h2><p>Automation creates unique sessions from each channel’s visual style, exercise mix, music, and posting hours. Rendering happens in the worker; watching happens in Library.</p></div>
          <CalendarClock className="w-7 h-7 shrink-0 text-[#ff2d95]" />
        </div>
        <div className="aiv2-channel-list">
          {channels.length === 0 ? <div className="aiv2-empty-inline">Connect a channel first to generate an automated schedule.</div> : channels.map((channel) => (
            <div key={channel.id} className="aiv2-channel-row">
              <div><strong>{channel.name}</strong><span><Clock3 className="w-3 h-3" /> {channel.postingHours.join(' · ')} · {channel.postsPerDay} posts/day</span></div>
              <button onClick={() => generate(channel)} disabled={generating === channel.id} className="aiv2-small-button">{generating === channel.id ? 'generating…' : 'generate 7 days →'}</button>
            </div>
          ))}
        </div>
      </section>

      {feedback && <div className="aiv2-inline-feedback">{feedback}</div>}
      {schedules.length > 0 && (
        <section className="aiv2-upcoming-panel">
          <div className="aiv2-kicker">next sessions / render control</div>
          <div className="aiv2-upcoming-list">
            {schedules.slice(0, 10).map((post) => (
              <div key={post.id} className="aiv2-upcoming-row">
                <div className="min-w-0 flex-1">
                  <strong>{post.title}</strong>
                  <span>{post.scheduledDate} · {post.scheduledTime} · {post.channelName}</span>
                  {(post.status === 'rendering' || post.status === 'uploading' || post.status === 'ready') && (
                    <div className="mt-2 max-w-md">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span>{post.backendStage || (post.status === 'uploading' ? 'uploading' : post.status === 'ready' ? 'ready' : 'rendering')}</span>
                        <span>{Math.max(0, Math.min(100, post.renderProgress ?? (post.status === 'ready' ? 100 : 0)))}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-emerald-300 transition-all" style={{ width: `${Math.max(0, Math.min(100, post.renderProgress ?? 0))}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2"><span className={`status-${post.status}`}>{post.status}</span>{post.status === 'scheduled' && <button onClick={() => queueNow(post, Boolean(post.previewUrl))} disabled={queueing === post.id} className="aiv2-small-button">{queueing === post.id ? 'queueing…' : post.previewUrl ? 'post now →' : 'render for schedule →'}</button>}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
