import React, { useState, useEffect } from 'react';
import {
  YouTubeChannelProfile,
  PlatformView,
  ScheduledPost,
  VideoSessionConfig,
  VideoResolution,
} from './types';
import { Header } from './components/Header';
import { VideoCanvas } from './components/VideoStudio/VideoCanvas';
import { StudioControls } from './components/VideoStudio/StudioControls';
import { ExerciseMixer } from './components/VideoStudio/ExerciseMixer';
import { StyleSelector } from './components/VideoStudio/StyleSelector';
import { ExportModal } from './components/VideoStudio/ExportModal';
import { ThumbnailGenerator } from './components/ThumbnailStudio/ThumbnailGenerator';
import { YouTubeManager } from './components/YouTubeHub/YouTubeManager';
import { ChannelManager } from './components/AutomationHub/ChannelManager';
import { AutomationOverview } from './components/AutomationHub/AutomationOverview';
import { LibraryView } from './components/Library/LibraryView';
import { automationService } from './services/automationService';
import { audioEngine } from './services/audioService';
import { SESSION_PRESETS, buildSessionItemsFromPreset, generateSmartRandomSession } from './data/presets';
import { MUSIC_TRACKS } from './data/musicTracks';
import { EXERCISE_DEFINITIONS } from './data/exercises';
import { BACKGROUND_THEMES } from './data/defaultChannels';

export default function App() {
  const [currentView, setCurrentView] = useState<PlatformView>('studio');
  const [channels, setChannels] = useState<YouTubeChannelProfile[]>(() =>
    automationService.getChannels()
  );
  const [schedules, setSchedules] = useState<ScheduledPost[]>(() =>
    automationService.getSchedules()
  );
  const [selectedChannelId, setSelectedChannelId] = useState<string>(
    channels[0]?.id || ''
  );

  useEffect(() => {
    const syncSchedules = () => setSchedules(automationService.getSchedules());
    syncSchedules();

    const pollRemoteQueue = async () => {
      try {
        await automationService.syncRemoteQueueStatus();
      } catch {
        // ignore remote queue polling errors; the app will continue to render locally while the backend is unavailable
      } finally {
        syncSchedules();
      }
    };

    const handleScheduleUpdate = () => syncSchedules();
    window.addEventListener('eyetraining:schedules-changed', handleScheduleUpdate);

    const intervalId = window.setInterval(() => {
      pollRemoteQueue();
    }, 1500);

    return () => {
      window.removeEventListener('eyetraining:schedules-changed', handleScheduleUpdate);
      window.clearInterval(intervalId);
    };
  }, []);

  const FALLBACK_CHANNEL = {
    id: '', name: 'zenvision', channelHandle: '@zenvision',
    youtubeChannelId: '', apiKey: '', backgroundTheme: 'slate_zen' as const,
    ballColor: '#ffffff', ballSize: 38,
    introCaption: 'welcome to your daily eye training session. get comfortable and keep your head still.',
    postsPerDay: 2, postingHours: ['08:00', '18:00'],
    musicTrackId: 'zen_432hz', voiceVolume: 0.95, musicVolume: 0.9,
    isConnected: false, createdAt: new Date().toISOString(),
  };
  const activeChannel =
    channels.find((c) => c.id === selectedChannelId) || channels[0] || FALLBACK_CHANNEL;
    const defaultPreset = SESSION_PRESETS[0];
  const [selectedPresetId, setSelectedPresetId] = useState<string>(defaultPreset.id);
  const [sessionConfig, setSessionConfig] = useState<VideoSessionConfig>(() => ({
    channelId: activeChannel?.id || 'channel_1',
    title: `${activeChannel?.name || 'zenvision'} • ${defaultPreset.name.toLowerCase()}`,
    introCaption: activeChannel?.introCaption || 'welcome to your daily eye training session. get comfortable and keep your head still.',
    introDurationSeconds: 4.5,
    items: buildSessionItemsFromPreset(defaultPreset),
    backgroundTheme: activeChannel?.backgroundTheme || 'slate_zen',
    ballColor: activeChannel?.ballColor || '#ffffff',
    ballSize: activeChannel?.ballSize || 22,
    musicTrackId: activeChannel?.musicTrackId || 'zen_432hz',
    voiceVolume: activeChannel?.voiceVolume ?? 0.95,
    musicVolume: activeChannel?.musicVolume ?? 0.9,
    resolution: '4k',
  }));
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const introGreetingDuration = sessionConfig.introDurationSeconds || 4.5;
  const totalDuration =
    introGreetingDuration +
    sessionConfig.items.reduce(
      (sum, item) => sum + item.instructionSeconds + item.motionSeconds,
      0
    );

  const liveThumbnailPath = EXERCISE_DEFINITIONS.horizontal.getTrajectoryPath(420, 240);
  const liveThumbnailProgress = totalDuration > 0 ? Math.min(1, currentTime / totalDuration) : 0;
  const liveThumbnailT = liveThumbnailProgress * 10;
  const liveThumbnailPos =
    EXERCISE_DEFINITIONS.horizontal.calculatePosition(liveThumbnailT, 0, 420, 240) ?? {
      x: 210,
      y: 120,
    };
  const liveThumbnailBackground =
    BACKGROUND_THEMES[sessionConfig.backgroundTheme as keyof typeof BACKGROUND_THEMES]?.bgGradient ||
    BACKGROUND_THEMES.slate_zen.bgGradient;

  const getCurrentItemIndex = (time: number) => {
    if (time < introGreetingDuration) return -1;
    let acc = introGreetingDuration;
    for (let i = 0; i < sessionConfig.items.length; i++) {
      const item = sessionConfig.items[i];
      const dur = item.instructionSeconds + item.motionSeconds;
      if (time < acc + dur) return i;
      acc += dur;
    }
    return sessionConfig.items.length - 1;
  };
   useEffect(() => {
    if (isPlaying) {
      const track = MUSIC_TRACKS.find((t) => t.id === sessionConfig.musicTrackId) || MUSIC_TRACKS[0];
      audioEngine.setVolumes(sessionConfig.musicVolume, sessionConfig.voiceVolume);
      audioEngine.playMusic(track.audioPath);
    } else {
      audioEngine.stopAll();
    }
  }, [isPlaying, sessionConfig.musicTrackId, sessionConfig.musicVolume, sessionConfig.voiceVolume]);
  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };
  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    audioEngine.stopAll();
  };
  const handleSeek = (newTime: number) => {
    setCurrentTime(Math.max(0, Math.min(newTime, totalDuration)));
  };
  const handleSessionEnded = () => {
    setIsPlaying(false);
    setCurrentTime(totalDuration);
    audioEngine.stopAll();
  };
  const handleSelectPreset = (presetId: string) => {
    const preset = SESSION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(presetId);
    setSessionConfig((prev) => ({
      ...prev,
      title: `${activeChannel.name} • ${preset.name.toLowerCase()}`,
      items: buildSessionItemsFromPreset(preset),
    }));
    handleReset();
  };
  const handleRandomizeFlow = () => {
    const currentPreset = SESSION_PRESETS.find((p) => p.id === selectedPresetId);
    const targetMins = currentPreset ? currentPreset.targetDurationMinutes : 8;
    const newItems = generateSmartRandomSession(targetMins);
    setSelectedPresetId('custom');
    setSessionConfig((prev) => ({
      ...prev,
      title: `${activeChannel.name} • unique ${targetMins}m routine`,
      items: newItems,
    }));
    handleReset();
  };
  const handleSelectChannel = (channelId: string) => {
    const ch = channels.find((c) => c.id === channelId);
    if (!ch) return;
    setSelectedChannelId(channelId);
    setSessionConfig((prev) => ({
      ...prev,
      channelId: ch.id,
      title: `${ch.name} • ${SESSION_PRESETS.find((p) => p.id === selectedPresetId)?.name.toLowerCase() || 'custom routine'}`,
      introCaption: ch.introCaption || ch.introText || 'welcome to your daily eye training session. get comfortable and keep your head still.',
      backgroundTheme: ch.backgroundTheme,
      ballColor: ch.ballColor,
      ballSize: ch.ballSize,
      musicTrackId: ch.musicTrackId,
    }));
  };
  const handleSaveChannel = (channel: YouTubeChannelProfile) => {
    automationService.updateChannel(channel);
    const updatedChannels = automationService.getChannels();
    setChannels(updatedChannels);
    if (selectedChannelId === channel.id) {
      handleSelectChannel(channel.id);
    }
  };
  const handleDeleteChannel = (channelId: string) => {
    automationService.deleteChannel(channelId);
    const updatedChannels = automationService.getChannels();
    setChannels(updatedChannels);
    if (selectedChannelId === channelId && updatedChannels.length > 0) {
      handleSelectChannel(updatedChannels[0].id);
    }
  };
  const handleLoadSessionInStudio = (post: ScheduledPost) => {
    setSessionConfig(post.sessionConfig);
    setCurrentView('studio');
    handleReset();
  };
  const handlePostNow = async (post: ScheduledPost) => {
    await automationService.triggerPublishWebhook(post, true);
    setSchedules(automationService.getSchedules());
  };
  const handleResolutionChange = (res: VideoResolution) => {
    setSessionConfig((prev) => ({ ...prev, resolution: res }));
  };

    return (
       <div className="aiv2-shell min-h-screen flex flex-col antialiased">
      {/* Header */}
      <Header currentView={currentView} onSelectView={setCurrentView} />
      {/* Main Views */}
      <main className="aiv2-main flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className="aiv2-edge-label">zenvision · eye training factory · {new Date().toLocaleDateString()}</div>
        <div className="aiv2-ghost-number">01</div>
        {currentView === 'studio' && (
          <div className="space-y-5">
            <div className="aiv2-page-heading">
              <div>
                <div className="aiv2-kicker">02 · studio / live composition</div>
                <h1 className="aiv2-display">STU<span>DIO</span></h1>
              </div>
              <p className="aiv2-deck">Build a calm visual routine, watch the real composition move, then send the exact session to the render queue.</p>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.5fr)_360px] gap-5 items-start">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center px-1 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                    <span>viewport ({sessionConfig.resolution.toUpperCase()})</span>
                  </span>
                  <span className="font-mono text-slate-500">
                    channel: {activeChannel.channelHandle}
                  </span>
                </div>
                <VideoCanvas
                  sessionConfig={sessionConfig}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  onTimeUpdate={setCurrentTime}
                  onSessionEnded={handleSessionEnded}
                  onTogglePlay={handleTogglePlay}
                  onSeek={handleSeek}
                />
              </div>

              <div className="rounded-2xl border border-white/5 bg-[#0d1117] p-4 shadow-xl">
                <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-slate-500">live thumbnail</div>
                <div
                  className="relative h-52 overflow-hidden rounded-2xl border border-white/5"
                  style={{ background: liveThumbnailBackground }}
                >
                  <svg viewBox="0 0 420 240" className="h-full w-full">
                    <path
                      d={liveThumbnailPath
                        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
                        .join(' ')}
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="2"
                      fill="none"
                    />
                    <circle
                      cx={liveThumbnailPos.x}
                      cy={liveThumbnailPos.y}
                      r="20"
                      fill={sessionConfig.ballColor}
                      opacity="0.98"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Playback & Audio Controls */}
            <StudioControls
              isPlaying={isPlaying}
              onTogglePlay={handleTogglePlay}
              onReset={handleReset}
              currentTime={currentTime}
              totalDuration={totalDuration}
              onSeek={handleSeek}
              selectedPresetId={selectedPresetId}
              onSelectPreset={handleSelectPreset}
              onRandomizeFlow={handleRandomizeFlow}
              voiceVolume={sessionConfig.voiceVolume}
              musicVolume={sessionConfig.musicVolume}
              onVoiceVolumeChange={(vol) =>
                setSessionConfig((prev) => ({ ...prev, voiceVolume: vol }))
              }
              onMusicVolumeChange={(vol) =>
                setSessionConfig((prev) => ({ ...prev, musicVolume: vol }))
              }
              musicTrackId={sessionConfig.musicTrackId}
              onMusicTrackChange={(trackId) =>
                setSessionConfig((prev) => ({ ...prev, musicTrackId: trackId }))
              }
              resolution={sessionConfig.resolution}
              onResolutionChange={handleResolutionChange}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              ballColor={sessionConfig.ballColor}
              backgroundTheme={sessionConfig.backgroundTheme}
            />
            {/* Bottom Grid: Exercise Mixer & Channel Styling */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ExerciseMixer
                items={sessionConfig.items}
                onUpdateItems={(items) => {
                  setSelectedPresetId('custom');
                  setSessionConfig((prev) => ({ ...prev, items }));
                }}
                currentItemIndex={getCurrentItemIndex(currentTime)}
                totalDurationSeconds={totalDuration}
                onRandomize={handleRandomizeFlow}
              />
                 <StyleSelector
                channels={channels}
                selectedChannelId={selectedChannelId}
                onSelectChannel={handleSelectChannel}
                backgroundTheme={sessionConfig.backgroundTheme}
                onChangeBackgroundTheme={(theme) =>
                  setSessionConfig((prev) => ({ ...prev, backgroundTheme: theme }))
                }
                ballColor={sessionConfig.ballColor}
                onChangeBallColor={(color) =>
                  setSessionConfig((prev) => ({ ...prev, ballColor: color }))
                }
                ballSize={sessionConfig.ballSize}
                onChangeBallSize={(size) =>
                  setSessionConfig((prev) => ({ ...prev, ballSize: size }))
                }
                introCaption={sessionConfig.introCaption}
                onChangeIntroCaption={(caption) =>
                  setSessionConfig((prev) => ({ ...prev, introCaption: caption }))
                }
              />
            </div>
          </div>
        )}
        {currentView === 'automation' && (
          <div className="space-y-6">
            <div className="aiv2-section-heading"><span>03 · publishing system</span><h1>AUTOMATIONS</h1><p>Schedule repeatable sessions and let the render worker take over.</p></div>
            <ChannelManager
              channels={channels as any}
              onSaveChannel={handleSaveChannel as any}
              onDeleteChannel={handleDeleteChannel}
              onSelectForStudio={(chId) => {
                handleSelectChannel(chId);
                setCurrentView('studio');
              }}
            />
            <AutomationOverview
              schedules={schedules}
              channels={channels}
              onRefreshSchedules={() => setSchedules(automationService.getSchedules())}
            />
          </div>
        )}

        {currentView === 'youtube' && (
          <div className="space-y-6"><div className="aiv2-section-heading"><span>04 · distribution</span><h1>CHANNELS</h1><p>Connect the destinations that receive your finished eye-training sessions.</p></div><YouTubeManager channels={channels} onSaveChannel={handleSaveChannel} onDeleteChannel={handleDeleteChannel} onSelectForStudio={(chId) => { handleSelectChannel(chId); setCurrentView('studio'); }} /></div>
        )}

        {currentView === 'thumbnails' && (
          <div className="space-y-6"><div className="aiv2-section-heading"><span>05 · visual packaging</span><h1>THUMBNAILS</h1><p>Keep every upload recognizable before it reaches the channel.</p></div><ThumbnailGenerator channels={channels} currentChannel={activeChannel} /></div>
        )}
        {currentView === 'queue' && (
          <div className="space-y-6"><div className="aiv2-section-heading"><span>01 · rendered media</span><h1>LIBRARY</h1><p>Watch scheduled sessions, inspect the finished MP4, or override the calendar and post one immediately.</p></div><LibraryView schedules={schedules} onLoadSessionInStudio={handleLoadSessionInStudio} onPostNow={handlePostNow} /></div>
        )}
      </main>
      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        sessionConfig={sessionConfig}
        totalDurationSeconds={totalDuration}
        onResolutionChange={handleResolutionChange}
      />
    </div>
  );
}
