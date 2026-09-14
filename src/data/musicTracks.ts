import { MusicTrackDefinition } from '../types';

export const MUSIC_TRACKS: MusicTrackDefinition[] = [
  {
    id: 'zen_432hz',
    name: 'zen 432hz',
    frequencyNote: 'deep calm base tone',
    description: 'A quiet ambient tone tuned for relaxed eye tracking sessions.',
    audioPath: '/audio/music/zen_432hz.wav',
    durationSeconds: 120,
  },
  {
    id: 'calm_piano',
    name: 'quiet piano',
    frequencyNote: 'soft melodic instrumental',
    description: 'A gentle piano-led progression with an unhurried pulse.',
    audioPath: '/audio/music/calm_piano.wav',
    durationSeconds: 120,
  },
  {
    id: 'calm_acoustic',
    name: 'soft acoustic',
    frequencyNote: 'warm melodic instrumental',
    description: 'A light acoustic pattern for calm, focused sessions.',
    audioPath: '/audio/music/calm_acoustic.wav',
    durationSeconds: 120,
  },
  {
    id: 'calm_strings',
    name: 'slow strings',
    frequencyNote: 'gentle melodic instrumental',
    description: 'A smooth sustained arrangement that stays behind the spoken guidance.',
    audioPath: '/audio/music/calm_strings.wav',
    durationSeconds: 120,
  },
];
