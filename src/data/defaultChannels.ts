import {
  BackgroundThemeDefinition,
  BallStyleDefinition,
  YouTubeChannelProfile,
} from '../types';

export const BALL_STYLES: Record<string, BallStyleDefinition> = {
  neon_orb: {
    id: 'neon_orb',
    name: 'neon orb',
    description: 'bright crisp orb with subtle glow.',
    glowColor: '#38bdf8',
  },
  sunset_glow: {
    id: 'sunset_glow',
    name: 'sunset glow',
    description: 'warm ambient orb with gentle aura.',
    glowColor: '#fb923c',
  },
  coral_ring: {
    id: 'coral_ring',
    name: 'coral ring',
    description: 'soft coral ring with clean edges.',
    glowColor: '#fb7185',
  },
  studio_white: {
    id: 'studio_white',
    name: 'studio white',
    description: 'clean white focus orb for minimalist mode.',
    glowColor: '#e2e8f0',
  },
  mint_pulse: {
    id: 'mint_pulse',
    name: 'mint pulse',
    description: 'cool mint pulse with relaxed luminous edge.',
    glowColor: '#34d399',
  },
  violet_spark: {
    id: 'violet_spark',
    name: 'violet spark',
    description: 'violet signal orb with crisp depth.',
    glowColor: '#a78bfa',
  },
};

export const BACKGROUND_THEMES: Record<string, BackgroundThemeDefinition> = {
  slate_zen: {
    id: 'slate_zen',
    name: 'slate minimalist',
    description: 'matte charcoal slate with deep optical contrast.',
    bgGradient: 'radial-gradient(circle at 50% 50%, #171b26 0%, #0d1017 70%, #06070a 100%)',
    accentColor: '#38bdf8',
  },
  deep_space: {
    id: 'deep_space',
    name: 'deep space',
    description: 'pure obsidian void with subtle ambient depth.',
    bgGradient: 'radial-gradient(ellipse at center, #110f1c 0%, #07060d 70%, #020104 100%)',
    accentColor: '#818cf8',
  },
  clean_studio: {
    id: 'clean_studio',
    name: 'studio black',
    description: 'pure minimalist black background for zero optical distraction.',
    bgGradient: 'radial-gradient(circle at 50% 50%, #121214 0%, #070708 70%, #000000 100%)',
    accentColor: '#ffffff',
  },
  warm_sunrise: {
    id: 'warm_sunrise',
    name: 'warm twilight',
    description: 'subdued deep indigo and dark terracotta.',
    bgGradient: 'radial-gradient(circle at 50% 40%, #22112a 0%, #130a1c 50%, #06030a 100%)',
    accentColor: '#fb923c',
  },
  forest_mist: {
    id: 'forest_mist',
    name: 'forest sage',
    description: 'dark natural pine and muted sage for calming the ciliary muscles.',
    bgGradient: 'radial-gradient(circle at 50% 50%, #06382a 0%, #031c15 70%, #010a08 100%)',
    accentColor: '#34d399',
  },
  cyber_amber: {
    id: 'cyber_amber',
    name: 'champagne onyx',
    description: 'deep onyx with warm golden focal point.',
    bgGradient: 'radial-gradient(circle at 50% 50%, #1c1505 0%, #0d0a02 70%, #040301 100%)',
    accentColor: '#f59e0b',
  },
};
export const SOLID_BALL_COLORS = [
  { id: 'pure_white', name: 'pure white', color: '#ffffff' },
  { id: 'pure_cyan', name: 'electric cyan', color: '#38bdf8' },
  { id: 'vibrant_amber', name: 'warm amber', color: '#fbbf24' },
  { id: 'soft_coral', name: 'soft coral', color: '#fb7185' },
  { id: 'emerald_green', name: 'emerald sage', color: '#34d399' },
  { id: 'slate_pearl', name: 'slate pearl', color: '#e2e8f0' },
];

export const BALL_ROTATION_COLORS = SOLID_BALL_COLORS.map((color) => color.color);

export function getRotatingBallColor(channel: Pick<YouTubeChannelProfile, 'ballColor' | 'ballRotationEnabled' | 'ballRotation'>, index = 0): string {
  if (channel.ballRotationEnabled === false) return channel.ballColor || BALL_ROTATION_COLORS[0];
  const palette = channel.ballRotation?.filter(Boolean).slice(0, 6) || BALL_ROTATION_COLORS;
  return palette[index % palette.length] || channel.ballColor || BALL_ROTATION_COLORS[0];
}
// Empty by default — user must connect real YouTube channels via the modal with live verification
export const DEFAULT_YOUTUBE_CHANNELS: YouTubeChannelProfile[] = [];
