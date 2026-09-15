
export type ExerciseId =
  | 'horizontal'
  | 'vertical'
  | 'diagonal'
  | 'circular'
  | 'infinity'
  | 'near_far'
  | 'saccades'
  | 'rest_blink'
  | 'spiral'
  | 'peripheral'
  | 'box'
  | 'zigzag'
  | 'diamond'
  | 'star'
  | 'hourglass'
  | 'butterfly'
  | 'pendulum'
  | 'ellipse'
  | 'triangle'
  | 'figure_s'
  | 'cross_jump'
  | 'slow_orbit'
  | 'random_drift'
  | 'figure_8_vertical'
  | 'hexagon'
  | 'wave_horizontal'
  | 'clover_loop'
  | 'orbit_cross'
  | 'sawtooth_rise'
  | 'pulse_square'
  | 'double_helix'
  | 'corner_sweep';
export interface ExerciseDefinition {
  id: ExerciseId;
  name: string;
  shortTitle: string;
  description: string;
  captionText: string;
  voiceAudioPath: string;
  instructionDurationSeconds: number;
  recommendedMotionSeconds: number;
  supportsSecondaryBall?: boolean;
  calculatePosition: (
    t: number,
    progress: number,
    width: number,
    height: number
  ) => {
    x: number;
    y: number;
    scale?: number;
    opacity?: number;
    auxiliaryPoints?: { x: number; y: number; opacity?: number }[];
    ringRadii?: number[];
  };
  getTrajectoryPath: (width: number, height: number) => { x: number; y: number }[];
}
export type BallColorTheme =
  | 'crisp_white'
  | 'slate_stone'
  | 'pure_cyan'
  | 'soft_amber'
  | 'sage_green'
  | 'deep_coral';
export type BackgroundThemeId =
  | 'slate_zen'
  | 'deep_space'
  | 'clean_studio'
  | 'warm_sunrise'
  | 'forest_mist'
  | 'cyber_amber';
export interface BackgroundThemeDefinition {
  id: BackgroundThemeId;
  name: string;
  description: string;
  bgGradient: string;
  accentColor: string;
}

export type BallStyleId =
  | 'neon_orb'
  | 'sunset_glow'
  | 'coral_ring'
  | 'studio_white'
  | 'mint_pulse'
  | 'violet_spark';

export interface BallStyleDefinition {
  id: BallStyleId;
  name: string;
  description: string;
  glowColor?: string;
}

export interface YouTubeChannelProfile {
  id: string;
  name: string;
  channelHandle: string;
  youtubeChannelId: string;
  apiKey?: string;
  accessToken?: string;
  avatarUrl?: string;
  isVerified?: boolean;
  backgroundTheme: BackgroundThemeId;
  ballColor: string;
  ballRotationEnabled?: boolean;
  ballRotation?: string[];
  ballSize: number;
  introCaption: string;
  postsPerDay: number;
  postingHours: string[];
  musicTrackId: string;
  voiceVolume: number;
  musicVolume: number;
  autoUploadWebhook?: string;
  isConnected: boolean;
  subscriberCount?: string;
  createdAt: string;
}

export type ChannelProfile = YouTubeChannelProfile & {
  platform?: 'youtube' | 'shorts' | 'tiktok';
  ballStyle?: BallStyleId;
  ballGlowColor?: string;
  trailLength?: number;
  introText?: string;
  webhookUrl?: string;
};
export interface ExerciseSessionItem {
  id: string;
  exerciseId: ExerciseId;
  instructionSeconds: number;
  motionSeconds: number;
  customName?: string;
  customCaption?: string;
}
export type VideoResolution = '4k' | '1080p';
export interface VideoSessionConfig {
  channelId: string;
  channelName?: string;
  title: string;
  introCaption: string;
  introCaptionAudioPath?: string;
  introDurationSeconds: number;
  items: ExerciseSessionItem[];
  backgroundTheme: BackgroundThemeId;
  ballColor: string;
  ballSize: number;
  musicTrackId: string;
  voiceVolume: number;
  musicVolume: number;
  resolution: VideoResolution;
}
export interface ScheduledPost {
  id: string;
  channelId: string;
  channelName: string;
  youtubeChannelId: string;
  title: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  status: 'scheduled' | 'rendering' | 'ready' | 'uploading' | 'published' | 'failed';
  renderProgress?: number;
  backendJobId?: string;
  backendStatus?: string;
  backendStage?: string;
  backendError?: string;
  previewUrl?: string;
  sessionConfig: VideoSessionConfig;
  thumbnailUrl?: string;
  publishedTimestamp?: number;
}
export interface AutomationConfig {
  channelId: string;
  isEnabled: boolean;
  postsPerDay: number;
  postingHours: string[];
  preferredDuration: 7 | 8 | 10 | 'random';
  resolution: VideoResolution;
  useRandomizer: boolean;
}
export type PlatformView = 'studio' | 'youtube' | 'automation' | 'thumbnails' | 'queue';
