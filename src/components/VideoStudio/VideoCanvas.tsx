import React, { useEffect, useRef, useState } from 'react';
import { VideoSessionConfig } from '../../types';
import { EXERCISE_DEFINITIONS } from '../../data/exercises';
import { audioEngine } from '../../services/audioService';
import { Maximize2, Minimize2 } from 'lucide-react';

interface VideoCanvasProps {
  sessionConfig: VideoSessionConfig;
  channelName?: string;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onSessionEnded: () => void;
  onTogglePlay?: () => void;
  onSeek?: (time: number) => void;
}

export const VideoCanvas: React.FC<VideoCanvasProps> = ({
  sessionConfig,
  channelName,
  currentTime,
  isPlaying,
  onTimeUpdate,
  onSessionEnded,
  onTogglePlay,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const localTimeRef = useRef<number>(currentTime);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const lastReportedTimeRef = useRef<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasPlayedIntroVoice = useRef<boolean>(false);
  const hasPlayedItemVoice = useRef<Record<number, boolean>>({});
  const lastMovementCueRef = useRef<number>(-Infinity);

  const is4K = sessionConfig.resolution === '4k';
  const canvasWidth = is4K ? 3840 : 1920;
  const canvasHeight = is4K ? 2160 : 1080;
  const scaleRatio = is4K ? 2 : 1;

  const introGreetingDuration = 4.5;
  const firstItem = sessionConfig.items[0];

  const totalDuration =
    introGreetingDuration +
    sessionConfig.items.reduce(
      (sum, item) => sum + item.instructionSeconds + item.motionSeconds,
      0
    );

  // Sync refs when props change
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    lastTimeRef.current = performance.now();
  }, [isPlaying]);

  useEffect(() => {
    if (Math.abs(currentTime - localTimeRef.current) > 0.2) {
      localTimeRef.current = currentTime;
      if (currentTime < 1.0) {
        hasPlayedIntroVoice.current = false;
        hasPlayedItemVoice.current = {};
      }
    }
  }, [currentTime]);

  // Keyboard shortcut listener (Space = play/pause, Left/Right = scrub 5s)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (onTogglePlay) onTogglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (onSeek) onSeek(Math.max(0, localTimeRef.current - 5));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (onSeek) onSeek(Math.min(totalDuration, localTimeRef.current + 5));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay, onSeek, totalDuration]);

  // Compute state at time t
  const getCurrentState = (time: number) => {
    if (time < introGreetingDuration) {
      const progress = time / introGreetingDuration;
      let captionOpacity = 1.0;
      if (progress < 0.12) {
        captionOpacity = progress / 0.12;
      } else if (progress > 0.88) {
        captionOpacity = Math.max(0, 1 - (progress - 0.88) / 0.2);
      }

      return {
        phase: 'greeting' as const,
        progress,
        caption: sessionConfig.introCaption || 'settle your gaze. let the movement come to you.',
        captionOpacity,
        isInstruction: true,
        currentItem: firstItem,
        itemIndex: 0,
      };
    }

    let acc = introGreetingDuration;
    for (let i = 0; i < sessionConfig.items.length; i++) {
      const item = sessionConfig.items[i];
      const itemTotal = item.instructionSeconds + item.motionSeconds;
      if (time < acc + itemTotal) {
        const itemElapsed = time - acc;
        const isInstruction = itemElapsed < item.instructionSeconds;
        const exDef = EXERCISE_DEFINITIONS[item.exerciseId];

        let captionOpacity = 0.0;
        if (isInstruction) {
          const fadeStart = Math.max(0, item.instructionSeconds - 0.8);
          if (itemElapsed <= fadeStart) {
            captionOpacity = 1.0;
          } else {
            captionOpacity = Math.max(0, 1 - (itemElapsed - fadeStart) / 0.8);
          }
        } else {
          // After instruction is said and ball starts moving, caption fades away completely
          captionOpacity = 0.0;
        }

        return {
          phase: 'exercise' as const,
          itemIndex: i,
          currentItem: item,
          isInstruction,
          motionElapsed: isInstruction ? 0 : itemElapsed - item.instructionSeconds,
          caption: exDef?.captionText || item.exerciseId,
          captionOpacity,
        };
      }
      acc += itemTotal;
    }

    const outroElapsed = time - acc;
    return {
      phase: 'outro' as const,
      caption: 'session complete. your eyes are relaxed and refreshed.',
      captionOpacity: Math.min(1, outroElapsed / 1.0),
      isInstruction: false,
      currentItem: null,
      itemIndex: sessionConfig.items.length,
    };
  };

  // Main Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = (now: number) => {
      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      if (isPlayingRef.current) {
        const smoothDelta = Math.min(delta, 1 / 30);
        localTimeRef.current += smoothDelta;

        if (localTimeRef.current >= totalDuration) {
          localTimeRef.current = totalDuration;
          isPlayingRef.current = false;
          onSessionEnded();
        }

        if (now - lastReportedTimeRef.current > 180) {
          lastReportedTimeRef.current = now;
          onTimeUpdate(localTimeRef.current);
        }

        // Voice triggers
        const t = localTimeRef.current;
        if (t < 1.0 && !hasPlayedIntroVoice.current) {
          hasPlayedIntroVoice.current = true;
          audioEngine.playIntro(sessionConfig.introCaption);
        }

        const state = getCurrentState(t);
        if (state.phase === 'exercise' && !state.isInstruction && t - lastMovementCueRef.current > 2.4) {
          lastMovementCueRef.current = t;
          audioEngine.playMovementCue();
        }
        if (state.phase === 'exercise' && state.isInstruction && state.currentItem) {
          const idx = state.itemIndex;
          if (!hasPlayedItemVoice.current[idx] && !audioEngine.isIntroSequencePlaying()) {
            hasPlayedItemVoice.current[idx] = true;
            const exDef = EXERCISE_DEFINITIONS[state.currentItem.exerciseId];
            if (exDef) {
              audioEngine.playVoice(exDef.voiceAudioPath, undefined, exDef.captionText);
            }
          }
        }
      }

      const w = canvas.width;
      const h = canvas.height;
      const state = getCurrentState(localTimeRef.current);

      // 1. Draw Background
      drawBackground(ctx, w, h, sessionConfig.backgroundTheme);

      // 2. Render State
      if (state.phase === 'greeting') {
        renderGreeting(ctx, w, h, state.progress, scaleRatio);
      } else if (state.phase === 'exercise' && state.currentItem) {
        renderExercise(
          ctx,
          w,
          h,
          state,
          sessionConfig,
          scaleRatio
        );
      } else {
        renderOutro(ctx, w, h, scaleRatio);
      }

      renderWatermark(ctx, w, h, channelName || sessionConfig.channelId, scaleRatio);

      animFrameRef.current = requestAnimationFrame(render);
    };

    lastTimeRef.current = performance.now();
    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [sessionConfig, totalDuration, is4K, channelName]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 select-none group"
    >
      <canvas
        ref={canvasRef}
        data-video-canvas="studio"
        width={canvasWidth}
        height={canvasHeight}
        className="w-full h-full object-contain block"
            />

      {/* Fullscreen Toggle Overlay Button */}
        <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 p-2.5 rounded-xl bg-black/60 hover:bg-black/80 text-white/70 hover:text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
  );
};

// Render Functions

function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  theme: string
) {
  const cx = w / 2;
  const cy = h / 2;

  switch (theme) {
    case 'slate_zen': {
      const grad = ctx.createRadialGradient(cx, cy, 50, cx, cy, w * 0.7);
      grad.addColorStop(0, '#161922');
      grad.addColorStop(0.7, '#0d0f16');
      grad.addColorStop(1, '#050608');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    case 'deep_space': {
      const grad = ctx.createRadialGradient(cx, cy, 100, cx, cy, w * 0.75);
      grad.addColorStop(0, '#110f1c');
      grad.addColorStop(0.7, '#07060d');
      grad.addColorStop(1, '#020104');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    case 'warm_sunrise': {
      const grad = ctx.createRadialGradient(cx, cy * 0.75, 80, cx, cy, w * 0.75);
      grad.addColorStop(0, '#22112a');
      grad.addColorStop(0.6, '#130a1c');
      grad.addColorStop(1, '#06030a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    case 'forest_mist': {
      const grad = ctx.createRadialGradient(cx, cy, 100, cx, cy, w * 0.75);
      grad.addColorStop(0, '#06382a');
      grad.addColorStop(0.7, '#031c15');
      grad.addColorStop(1, '#010a08');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    case 'cyber_amber': {
      const grad = ctx.createRadialGradient(cx, cy, 80, cx, cy, w * 0.7);
      grad.addColorStop(0, '#1c1505');
      grad.addColorStop(0.7, '#0d0a02');
      grad.addColorStop(1, '#040301');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      break;
    }

    case 'clean_studio':
    default: {
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, w, h);
      break;
    }
  }
}

// 1. Initial "hi" greeting: prominent, 100% white opacity, crystal clear
function renderGreeting(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  progress: number,
  scaleRatio: number
) {
  const cx = w / 2;
  const cy = h / 2;

  let alpha = 1.0;
  if (progress < 0.12) {
    alpha = progress / 0.12;
  } else if (progress > 0.82) {
    alpha = 1 - (progress - 0.82) / 0.18;
  }

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `300 ${160 * scaleRatio}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(1, alpha))})`;
  ctx.fillText('hi', cx, cy - 25 * scaleRatio);
  ctx.restore();
}

// 2. Exercise phase: prominent, high-contrast, razor-sharp ball with zero glow
function renderExercise(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any,
  sessionConfig: VideoSessionConfig,
  scaleRatio: number
) {
  const cx = w / 2;
  const cy = h / 2;
  const currentItem = state.currentItem;
const exDef = EXERCISE_DEFINITIONS[currentItem.exerciseId as keyof typeof EXERCISE_DEFINITIONS];
  if (!exDef) return;

  // Prominent, easily visible target ball (minimum 52px base radius in 1080p, 104px in 4K)
  const baseSize = Math.max(50, sessionConfig.ballSize) * scaleRatio;
  let ballX = cx;
  let ballY = cy;
  let ballScale = 1;
  let auxiliaryPoints: { x: number; y: number; opacity?: number }[] | undefined;

  if (state.isInstruction) {
    // THE BALL PAUSES COMPLETELY MOTIONLESS AT CENTER UNTIL INSTRUCTION ENDS
    ballX = cx;
    ballY = cy;
  } else {
    // Movement phase: follows smooth mathematical trajectory
    const pos = exDef.calculatePosition(state.motionElapsed, 0, w, h);
    ballX = pos.x;
    ballY = pos.y;
    if (pos.scale !== undefined) ballScale = pos.scale;
    auxiliaryPoints = pos.auxiliaryPoints;
  }

  // Draw auxiliary points if exercise requires them (e.g. saccades)
  if (exDef.supportsSecondaryBall && auxiliaryPoints) {
    auxiliaryPoints.forEach((pt) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, baseSize * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = sessionConfig.ballColor;
      ctx.globalAlpha = pt.opacity !== undefined ? pt.opacity : 0.35;
      ctx.fill();
      ctx.restore();
    });
  }

  // DRAW BALL: Prominent, 100% solid, crisp edge contrast ring, ZERO GLOW
  drawCrispSolidBall(
    ctx,
    ballX,
    ballY,
    baseSize * ballScale,
    sessionConfig.ballColor,
    scaleRatio
  );

  // Minimalist top HUD in lowercase Helvetica
  ctx.save();
  ctx.font = `500 ${18 * scaleRatio}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.textAlign = 'left';
  ctx.fillText(
    `exercise ${state.itemIndex + 1} of ${sessionConfig.items.length}: ${exDef.shortTitle}`,
    56 * scaleRatio,
    58 * scaleRatio
  );
  ctx.restore();
}

// 3. Outro phase
function renderOutro(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scaleRatio: number
) {
  const cx = w / 2;
  const cy = h / 2;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `300 ${85 * scaleRatio}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('session complete', cx, cy - 10 * scaleRatio);
  ctx.restore();
}

// Crisp Solid Ball: 100% full solid opacity, sharp dark contrast rim, zero blur
function drawCrispSolidBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  scaleRatio: number
) {
  ctx.save();

  // 1. Crisp dark rim for maximum edge separation on any background
  ctx.beginPath();
  ctx.arc(x, y, radius + 1.5 * scaleRatio, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fill();

  // 2. Solid vibrant ball body (100% opacity, pure solid color)
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowBlur = 0; // ZERO GLOW
  ctx.fill();

  // 3. Subtle crisp highlight dot on top-left for physical presence
  ctx.beginPath();
  ctx.arc(x - radius * 0.28, y - radius * 0.28, radius * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fill();

  ctx.restore();
}

function renderWatermark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
  scaleRatio: number
) {
  ctx.save();
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.font = `500 ${14 * scaleRatio}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
  const watermark = text.startsWith('@') ? text.toLowerCase() : `@${text.toLowerCase()}`;
  ctx.fillText(watermark, w - 32 * scaleRatio, h - 24 * scaleRatio);
  ctx.restore();
}
