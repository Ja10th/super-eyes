import React from 'react';
import { getExerciseById } from '../../data/exercises';
import { BACKGROUND_THEMES } from '../../data/defaultChannels';

export const VideoThumbnail: React.FC<{ exerciseId: string; ballColor?: string; backgroundTheme?: string }> = ({
  exerciseId,
  ballColor = '#ffffff',
  backgroundTheme = 'slate_zen',
}) => {
  const actual = getExerciseById(exerciseId as any) ?? getExerciseById('horizontal');
  const path = actual?.getTrajectoryPath(480, 270) ?? [
    { x: 80, y: 135 },
    { x: 400, y: 135 },
  ];

  const themeBackground = BACKGROUND_THEMES[backgroundTheme as keyof typeof BACKGROUND_THEMES]?.bgGradient || BACKGROUND_THEMES.slate_zen.bgGradient;
  const motionPoint = path[Math.min(path.length - 1, Math.max(0, Math.floor(path.length * 0.7)))] ?? { x: 240, y: 135 };

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: themeBackground }}
    >
      <svg viewBox="0 0 480 270" className="h-full w-full">
        <rect width="480" height="270" fill="transparent" />
        <path
          d={path.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx={motionPoint.x} cy={motionPoint.y} r="26" fill={ballColor} opacity="0.98" />
      </svg>
    </div>
  );
};
