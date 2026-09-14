import { ExerciseId, ExerciseSessionItem } from '../types';
import { ALL_EXERCISES } from './exercises';
export interface SessionPreset {
  id: string;
  name: string;
  targetDurationMinutes: number;
  description: string;
  badge: string;
  exerciseIds: ExerciseId[];
  defaultMotionSeconds: number;
}
export const SESSION_PRESETS: SessionPreset[] = [
  {
    id: 'preset_7min',
    name: '7-minute daily eye reset',
    targetDurationMinutes: 7,
    description: 'fast high-impact routine for screen fatigue.',
    badge: '7 min reset',
    exerciseIds: [
      'horizontal',
      'vertical',
      'diagonal',
      'zigzag',
      'rest_blink',
      'circular',
      'near_far',
      'infinity',
    ],
    defaultMotionSeconds: 47,
  },
  {
    id: 'preset_8min',
    name: '8-minute balanced vision flow',
    targetDurationMinutes: 8,
    description: 'comprehensive ocular rebalancing combining tracking, diamond, star, and saccades.',
    badge: '8 min flow',
    exerciseIds: [
      'horizontal',
      'vertical',
      'diagonal',
      'circular',
      'diamond',
      'rest_blink',
      'near_far',
      'star',
      'infinity',
    ],
    defaultMotionSeconds: 48,
  },
   {
    id: 'preset_10min',
    name: '10-minute deep vision therapy',
    targetDurationMinutes: 10,
    description: 'complete ocular therapy covering tracking, pendulum, butterfly, and dual rest breaks.',
    badge: '10 min deep therapy',
    exerciseIds: [
      'horizontal',
      'vertical',
      'diagonal',
      'circular',
      'zigzag',
      'rest_blink',
      'hourglass',
      'infinity',
      'near_far',
      'butterfly',
      'pendulum',
      'saccades',
      'rest_blink',
    ],
    defaultMotionSeconds: 44,
  },
];
export function buildSessionItemsFromPreset(preset: SessionPreset): ExerciseSessionItem[] {
  return preset.exerciseIds.map((exId, index) => ({
    id: `${exId}_${index}_${Date.now()}`,
    exerciseId: exId,
    instructionSeconds: 5,
    motionSeconds: preset.defaultMotionSeconds,
  }));
}
/**
 * Generates an intelligently shuffled, completely unique exercise session.
 * Every call produces a different exercise order, different motion timings,
 * and different rest placement — no two sessions are the same.
 */
export function generateSmartRandomSession(targetMinutes: number): ExerciseSessionItem[] {
  const targetTotalSeconds = targetMinutes * 60;
  const introSeconds = 4.5;
  const availableSeconds = targetTotalSeconds - introSeconds;
  // Full exercise pool excluding rest_blink (we place those manually)
  const motionPool = ALL_EXERCISES.filter((e) => e.id !== 'rest_blink');
  // --- Truly random Fisher-Yates shuffle ---
  const shuffled = [...motionPool];
  for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Target ~50-55s per item slot; pick how many items fit
  const itemSlotSeconds = 52;
  const targetItemCount = Math.max(6, Math.min(13, Math.round(availableSeconds / itemSlotSeconds)));
  // Pick unique exercises from shuffled pool (cycle if needed for long sessions)
  const selectedExercises: ExerciseId[] = [];
  for (let i = 0; i < targetItemCount; i++) {
    selectedExercises.push(shuffled[i % shuffled.length].id);
  }
  // Insert rest_blink breaks:
  // - One after ~40% through
  // - Another after ~75% through if 9+ min session
  const first_break = Math.floor(selectedExercises.length * 0.4);
  selectedExercises.splice(first_break, 0, 'rest_blink');
  if (targetMinutes >= 9 && selectedExercises.length > 8) {
    const second_break = Math.floor(selectedExercises.length * 0.75);
    selectedExercises.splice(second_break, 0, 'rest_blink');
  }
  const totalItems = selectedExercises.length;
  // --- Per-item randomized timing ---
  // Each exercise gets a slightly different instruction + motion duration
  // so the rhythm of the video never feels like the same pattern repeating.
  const totalInstructionBudget = totalItems * 5; // avg 5s instruction
  const totalMotionBudget = Math.max(
    totalItems * 30,
    availableSeconds - totalInstructionBudget
  );
  const avgMotion = totalMotionBudget / totalItems;
  // Randomize each item's motion by ±15% from the average
  const rawMotions: number[] = selectedExercises.map((id) => {
    if (id === 'rest_blink') return Math.round(avgMotion * (0.88 + Math.random() * 0.10)); // rest a bit shorter
    const variance = 0.85 + Math.random() * 0.32; // 85% to 117%
    return Math.round(avgMotion * variance);
  });
  // Normalise so total motions stay close to budget
  const rawTotal = rawMotions.reduce((a, b) => a + b, 0);
  const scale = totalMotionBudget / rawTotal;
  const finalMotions = rawMotions.map((m) => Math.max(28, Math.round(m * scale)));
    // Build items
  return selectedExercises.map((exId, index) => ({
    id: `${exId}_${index}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    exerciseId: exId,
    instructionSeconds: exId === 'rest_blink' ? 5.5 : Math.round(4 + Math.random() * 2), // 4–6s random instruction
    motionSeconds: finalMotions[index],
  }));
}
