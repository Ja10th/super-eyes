import React from 'react';
import {
  ExerciseSessionItem,
  ExerciseId,
} from '../../types';
import { EXERCISE_DEFINITIONS, ALL_EXERCISES } from '../../data/exercises';
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  Layers,
  Shuffle,
} from 'lucide-react';
interface ExerciseMixerProps {
  items: ExerciseSessionItem[];
  onUpdateItems: (items: ExerciseSessionItem[]) => void;
  currentItemIndex: number;
  totalDurationSeconds: number;
  onRandomize?: () => void;
}
export const ExerciseMixer: React.FC<ExerciseMixerProps> = ({
  items,
  onUpdateItems,
  currentItemIndex,
  totalDurationSeconds,
  onRandomize,
}) => {
  const handleRemove = (index: number) => {
    if (items.length <= 1) return;
    const next = [...items];
    next.splice(index, 1);
    onUpdateItems(next);
  };
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const next = [...items];
    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;
    onUpdateItems(next);
  };
  const handleDurationChange = (index: number, motionSeconds: number) => {
    const next = [...items];
    next[index] = { ...next[index], motionSeconds };
    onUpdateItems(next);
  };
  const handleAddExercise = (exerciseId: ExerciseId) => {
    const exDef = EXERCISE_DEFINITIONS[exerciseId];
    if (!exDef) return;
    const newItem: ExerciseSessionItem = {
      id: `${exerciseId}_${Date.now()}`,
      exerciseId,
      instructionSeconds: 5,
      motionSeconds: exDef.recommendedMotionSeconds || 45,
    };
    onUpdateItems([...items, newItem]);
  };
  const minutes = Math.floor(totalDurationSeconds / 60);
  const seconds = Math.floor(totalDurationSeconds % 60);
  return (
    <div className="bg-[#0e1017] border border-white/5 rounded-2xl p-5 space-y-3 shadow-xl">
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-semibold text-white">exercise sequence</h3>
          <span className="text-xs text-slate-500">
            ({items.length} items • {minutes}m {seconds}s)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {onRandomize && (
            <button
              onClick={onRandomize}
              title="generate a completely unique randomized exercise mix"
              className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 cursor-pointer transition-colors"
            >
              <Shuffle className="w-3 h-3 text-sky-400" />
              <span>randomize</span>
            </button>
          )}
             <select
            onChange={(e) => {
              if (e.target.value) {
                handleAddExercise(e.target.value as ExerciseId);
                e.target.value = '';
              }
            }}
            defaultValue=""
            className="bg-white/5 hover:bg-white/10 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-white/10 focus:outline-none cursor-pointer"
          >
            <option value="" disabled>
              + add exercise
            </option>
            {ALL_EXERCISES.map((ex) => (
              <option key={ex.id} value={ex.id} className="bg-[#0e1017] text-white">
                {ex.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* Exercise Items List */}
      <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
        {items.map((item, index) => {
          const exDef = EXERCISE_DEFINITIONS[item.exerciseId];
          const isActive = index === currentItemIndex;
          return (
            <div
              key={item.id}
              className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 text-xs ${
                isActive
                  ? 'bg-white/5 border-sky-500/40 text-white'
                  : 'bg-transparent border-white/5 hover:border-white/10 text-slate-400'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="font-mono text-slate-600 text-[11px] w-4">
                  {index + 1}
                </span>
                  <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200 truncate">
                      {exDef?.name || item.exerciseId}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Motion Duration */}
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <input
                    type="range"
                    min="25"
                    max="90"
                    step="5"
                    value={item.motionSeconds}
                    onChange={(e) => handleDurationChange(index, parseInt(e.target.value))}
                    className="w-14 accent-sky-400 cursor-pointer"
                  />
                  <span className="w-6 font-mono text-slate-400">{item.motionSeconds}s</span>
                </div>
                {/* Move Up/Down */}
                <div className="flex">
                  <button
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                    className="p-1 hover:text-white disabled:opacity-20 text-slate-500"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === items.length - 1}
                    className="p-1 hover:text-white disabled:opacity-20 text-slate-500"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleRemove(index)}
                  disabled={items.length <= 1}
                  className="p-1 text-slate-500 hover:text-rose-400 disabled:opacity-20"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};