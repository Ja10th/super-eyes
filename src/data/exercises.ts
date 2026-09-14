import { ExerciseDefinition, ExerciseId } from '../types';
export const EXERCISE_DEFINITIONS: Record<ExerciseId, ExerciseDefinition> = {
  horizontal: {
    id: 'horizontal',
    name: 'horizontal smooth pursuit',
    shortTitle: 'horizontal tracking',
    description: 'smooth continuous lateral tracking across the horizontal axis.',
    captionText: 'horizontal tracking. follow the ball smoothly with your eyes only.',
    voiceAudioPath: '/audio/voice/horizontal.mp3',
    instructionDurationSeconds: 5,
    recommendedMotionSeconds: 45,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.38;
      const x = cx + Math.sin(t * Math.PI * 0.5) * rx;
      return { x, y: cy };
    },
    getTrajectoryPath: (width, height) => {
      const cy = height / 2;
      const cx = width / 2;
      const rx = width * 0.38;
      return [{ x: cx - rx, y: cy }, { x: cx + rx, y: cy }];
    },
  },
  vertical: {
    id: 'vertical',
    name: 'vertical smooth pursuit',
    shortTitle: 'vertical tracking',
    description: 'smooth vertical tracking from top to bottom.',
    captionText: 'vertical tracking. follow the ball up and down without moving your head.',
    voiceAudioPath: '/audio/voice/vertical.mp3',
    instructionDurationSeconds: 4.5,
    recommendedMotionSeconds: 45,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const ry = height * 0.36;
      return { x: cx, y: cy + Math.sin(t * Math.PI * 0.5) * ry };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const ry = height * 0.36;
      return [{ x: cx, y: cy - ry }, { x: cx, y: cy + ry }];
    },
  },
 diagonal: {
    id: 'diagonal',
    name: 'diagonal cross tracking',
    shortTitle: 'diagonal cross',
    description: 'tracking across opposite corners in an x-pattern.',
    captionText: 'diagonal cross. track the ball smoothly across opposite corners.',
    voiceAudioPath: '/audio/voice/diagonal.mp3',
    instructionDurationSeconds: 4,
    recommendedMotionSeconds: 45,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.36;
      const ry = height * 0.33;
      const phase = Math.floor(t / 8) % 2;
      const wave = Math.sin(t * Math.PI * 0.5);
      return { x: cx + wave * rx, y: phase === 0 ? cy + wave * ry : cy - wave * ry };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.36;
      const ry = height * 0.33;
      return [
        { x: cx - rx, y: cy - ry },
        { x: cx + rx, y: cy + ry },
        { x: cx + rx, y: cy - ry },
        { x: cx - rx, y: cy + ry },
      ];
    },
  },
  circular: {
    id: 'circular',
    name: 'circular flow',
    shortTitle: 'circular flow',
    description: 'smooth continuous 360-degree rotational orbit.',
    captionText: 'circular flow. follow the ball in a smooth circular orbit. keep breathing deeply.',
    voiceAudioPath: '/audio/voice/circular.mp3',
    instructionDurationSeconds: 5,
    recommendedMotionSeconds: 50,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.34;
      const ry = height * 0.34;
      const dir = Math.floor(t / 16) % 2 === 0 ? 1 : -1;
      const angle = t * Math.PI * 0.3 * dir;
      return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
    },
     getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.34;
      const ry = height * 0.34;
      const points = [];
      for (let i = 0; i <= 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        points.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
      }
      return points;
    },
  },
  infinity: {
    id: 'infinity',
    name: 'infinity loop',
    shortTitle: 'infinity loop',
    description: 'lemniscate figure-eight bilateral ocular coordination.',
    captionText: 'infinity loop. follow the figure-eight pattern. relax your eye muscles.',
    voiceAudioPath: '/audio/voice/infinity.mp3',
    instructionDurationSeconds: 4.5,
    recommendedMotionSeconds: 55,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const a = width * 0.36;
      const b = height * 0.28;
      const omega = t * Math.PI * 0.3;
      return { x: cx + a * Math.sin(omega), y: cy + b * Math.sin(omega) * Math.cos(omega) * 1.5 };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const a = width * 0.36;
      const b = height * 0.28;
      const points = [];
      for (let i = 0; i <= 60; i++) {
        const omega = (i / 60) * Math.PI * 2;
        points.push({ x: cx + a * Math.sin(omega), y: cy + b * Math.sin(omega) * Math.cos(omega) * 1.5 });
      }
      return points;
    },
  },
  near_far: {
    id: 'near_far',
    name: 'depth focus',
    shortTitle: 'depth focus',
    description: 'ciliary accommodation shifting between near and far focal planes.',
     captionText: 'depth focus. shift your focus as the target moves between near and far.',
    voiceAudioPath: '/audio/voice/near_far.mp3',
    instructionDurationSeconds: 4,
    recommendedMotionSeconds: 45,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const depthCycle = (Math.sin(t * Math.PI * 0.5) + 1) / 2;
      const scale = 0.75 + depthCycle * 0.75;
      return { x: cx + Math.sin(t * 0.8) * (width * 0.08), y: cy + Math.cos(t * 0.8) * (height * 0.06), scale };
    },
    getTrajectoryPath: (width, height) => [{ x: width / 2, y: height / 2 }],
  },
  saccades: {
    id: 'saccades',
    name: 'rapid saccades',
    shortTitle: 'rapid saccades',
    description: 'instantaneous eye jumps between fixation points.',
    captionText: 'fast saccades. jump your eyes briskly to each new target position.',
    voiceAudioPath: '/audio/voice/saccades.mp3',
    instructionDurationSeconds: 4,
    recommendedMotionSeconds: 45,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const dx = width * 0.33;
      const dy = height * 0.30;
      const targets = [
        { x: cx - dx, y: cy - dy }, { x: cx + dx, y: cy + dy },
        { x: cx + dx, y: cy - dy }, { x: cx - dx, y: cy + dy },
        { x: cx, y: cy - dy }, { x: cx, y: cy + dy },
        { x: cx - dx, y: cy }, { x: cx + dx, y: cy },
      ];
      const index = Math.floor(t / 1.25) % targets.length;
      return {
        x: targets[index].x,
        y: targets[index].y,
        auxiliaryPoints: targets.map((pt, i) => ({ x: pt.x, y: pt.y, opacity: i === index ? 0 : 0.35 })),
      };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const dx = width * 0.33;
      const dy = height * 0.30;
      return [
        { x: cx - dx, y: cy - dy }, { x: cx + dx, y: cy - dy },
        { x: cx + dx, y: cy + dy }, { x: cx - dx, y: cy + dy },
      ];
    },
  },
 rest_blink: {
    id: 'rest_blink',
    name: 'rest & blink',
    shortTitle: 'rest & blink',
    description: 'gentle deliberate blinking and deep relaxation break.',
    captionText: 'rest and blink. close your eyes gently, take a slow deep breath, and let your eyes relax.',
    voiceAudioPath: '/audio/voice/rest_blink.mp3',
    instructionDurationSeconds: 5.5,
    recommendedMotionSeconds: 40,
    calculatePosition: (t, _progress, width, height) => {
      const breath = (Math.sin(t * Math.PI / 3) + 1) / 2;
      return { x: width / 2, y: height / 2, scale: 0.9 + breath * 0.4 };
    },
    getTrajectoryPath: (width, height) => [{ x: width / 2, y: height / 2 }],
  },
  spiral: {
    id: 'spiral',
    name: 'spiral expansion',
    shortTitle: 'spiral movement',
    description: 'concentric spiral tracking expanding outward and inward.',
    captionText: 'spiral movement. follow the expanding and contracting spiral path.',
    voiceAudioPath: '/audio/voice/spiral.mp3',
    instructionDurationSeconds: 4,
    recommendedMotionSeconds: 50,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.min(width * 0.36, height * 0.36);
      const cycleTime = 16;
      const cycleProg = (t % cycleTime) / cycleTime;
      const rFraction = cycleProg < 0.5 ? cycleProg * 2 : (1 - cycleProg) * 2;
      const currentR = maxR * (0.15 + 0.85 * rFraction);
      const angle = t * Math.PI * 0.8;
      return { x: cx + Math.cos(angle) * currentR, y: cy + Math.sin(angle) * currentR };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const maxR = Math.min(width * 0.36, height * 0.36);
      const points = [];
      for (let i = 0; i <= 80; i++) {
        const prog = i / 80;
        const r = maxR * prog;
        const a = prog * Math.PI * 8;
        points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      return points;
    },
  },
peripheral: {
    id: 'peripheral',
    name: 'peripheral awareness',
    shortTitle: 'peripheral awareness',
    description: 'maintains central gaze while tracking peripheral outer ring pulses.',
    captionText: 'peripheral awareness. keep your gaze centered while tracking the outer pulse.',
    voiceAudioPath: '/audio/voice/peripheral.mp3',
    instructionDurationSeconds: 4,
    recommendedMotionSeconds: 45,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.40;
      const ry = height * 0.38;
      const angle = t * Math.PI * 0.4;
      return {
        x: cx, y: cy,
        auxiliaryPoints: [
          { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry, opacity: 0.9 },
          { x: cx + Math.cos(angle + Math.PI) * rx, y: cy + Math.sin(angle + Math.PI) * ry, opacity: 0.9 },
        ],
      };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.40;
      const ry = height * 0.38;
      return [{ x: cx - rx, y: cy }, { x: cx + rx, y: cy }, { x: cx, y: cy - ry }, { x: cx, y: cy + ry }];
    },
  },
  box: {
    id: 'box',
    name: 'box perimeter tracking',
    shortTitle: 'box tracking',
    description: 'rectangular perimeter tracking with crisp corner fixations.',
    captionText: 'box tracking. follow the ball along each corner of the perimeter.',
    voiceAudioPath: '/audio/voice/box.mp3',
    instructionDurationSeconds: 4,
    recommendedMotionSeconds: 45,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const w = width * 0.70;
      const h = height * 0.62;
      const left = cx - w / 2;
      const right = cx + w / 2;
      const top = cy - h / 2;
      const bottom = cy + h / 2;
      const totalPerimeter = 2 * (w + h);
       const speed = totalPerimeter / 8;
      const distance = (t * speed) % totalPerimeter;
      let x = left;
      let y = top;
      if (distance < w) { x = left + distance; y = top; }
      else if (distance < w + h) { x = right; y = top + (distance - w); }
      else if (distance < 2 * w + h) { x = right - (distance - (w + h)); y = bottom; }
      else { x = left; y = bottom - (distance - (2 * w + h)); }
      return { x, y };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const w = width * 0.70;
      const h = height * 0.62;
      return [
        { x: cx - w / 2, y: cy - h / 2 }, { x: cx + w / 2, y: cy - h / 2 },
        { x: cx + w / 2, y: cy + h / 2 }, { x: cx - w / 2, y: cy + h / 2 },
      ];
    },
  },
   zigzag: {
    id: 'zigzag',
    name: 'zig-zag stepping waves',
    shortTitle: 'zig-zag stepping',
    description: 'sinusoidal stepping cascade across horizontal and vertical sweeps.',
    captionText: 'zig-zag stepping. follow the stepping wave pattern smoothly with your eyes only.',
    voiceAudioPath: '/audio/voice/zigzag.mp3',
    instructionDurationSeconds: 4.5,
    recommendedMotionSeconds: 45,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.36;
      const ry = height * 0.32;
      return { x: cx + Math.sin(t * Math.PI * 0.25) * rx, y: cy + Math.sin(t * Math.PI * 2.0) * ry };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.36;
      const ry = height * 0.32;
      const points = [];
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * 4;
        points.push({ x: cx + Math.sin(t * Math.PI * 0.25) * rx, y: cy + Math.sin(t * Math.PI * 2.0) * ry });
      }
      return points;
    },
  },
   diamond: {
    id: 'diamond',
    name: 'diamond quadrant tracking',
    shortTitle: 'diamond tracking',
    description: '45-degree rotated rhomboid perimeter tracking.',
    captionText: 'diamond quadrant tracking. follow the ball along the diamond perimeter.',
    voiceAudioPath: '/audio/voice/diamond.mp3',
    instructionDurationSeconds: 4.5,
    recommendedMotionSeconds: 45,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.36;
      const ry = height * 0.34;
      const period = 8;
      const prog = ((t % period) / period) * 4;
      const corner = Math.floor(prog);
      const frac = prog - corner;
      const pts = [
        { x: cx, y: cy - ry }, { x: cx + rx, y: cy },
        { x: cx, y: cy + ry }, { x: cx - rx, y: cy },
        { x: cx, y: cy - ry },
      ];
      return { x: pts[corner].x + (pts[corner + 1].x - pts[corner].x) * frac, y: pts[corner].y + (pts[corner + 1].y - pts[corner].y) * frac };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.36;
      const ry = height * 0.34;
      return [
        { x: cx, y: cy - ry }, { x: cx + rx, y: cy },
        { x: cx, y: cy + ry }, { x: cx - rx, y: cy },
        { x: cx, y: cy - ry },
      ];
    },
  },
   star: {
    id: 'star',
    name: 'five-point star trajectory',
    shortTitle: 'star trajectory',
    description: 'pentagram multi-angle ocular stretching.',
    captionText: 'star trajectory. trace the five points of the star without moving your head.',
    voiceAudioPath: '/audio/voice/star.mp3',
    instructionDurationSeconds: 4.5,
    recommendedMotionSeconds: 50,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width * 0.36, height * 0.34);
      const starOrder = [0, 2, 4, 1, 3, 0];
      const starPts = starOrder.map((idx) => {
        const a = (idx * 2 * Math.PI / 5) - Math.PI / 2;
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
      });
      const period = 10;
      const prog = ((t % period) / period) * 5;
      const seg = Math.floor(prog);
      const frac = prog - seg;
      return { x: starPts[seg].x + (starPts[seg + 1].x - starPts[seg].x) * frac, y: starPts[seg].y + (starPts[seg + 1].y - starPts[seg].y) * frac };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width * 0.36, height * 0.34);
      const starOrder = [0, 2, 4, 1, 3, 0];
      return starOrder.map((idx) => {
        const a = (idx * 2 * Math.PI / 5) - Math.PI / 2;
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
      });
    },
  },
   hourglass: {
    id: 'hourglass',
    name: 'hourglass vertical sweep',
    shortTitle: 'hourglass sweep',
    description: 'vertical hourglass bowtie cross pursuit.',
    captionText: 'hourglass sweep. follow the ball along the vertical hourglass contours.',
    voiceAudioPath: '/audio/voice/hourglass.mp3',
    instructionDurationSeconds: 4.5,
    recommendedMotionSeconds: 45,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.36;
      const ry = height * 0.34;
      const pts = [
        { x: cx - rx, y: cy - ry }, { x: cx + rx, y: cy - ry },
        { x: cx - rx, y: cy + ry }, { x: cx + rx, y: cy + ry },
        { x: cx - rx, y: cy - ry },
      ];
      const period = 8;
      const prog = ((t % period) / period) * 4;
      const seg = Math.floor(prog);
      const frac = prog - seg;
      return { x: pts[seg].x + (pts[seg + 1].x - pts[seg].x) * frac, y: pts[seg].y + (pts[seg + 1].y - pts[seg].y) * frac };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.36;
      const ry = height * 0.34;
      return [
        { x: cx - rx, y: cy - ry }, { x: cx + rx, y: cy - ry },
        { x: cx - rx, y: cy + ry }, { x: cx + rx, y: cy + ry },
        { x: cx - rx, y: cy - ry },
      ];
    },
  },
 butterfly: {
    id: 'butterfly',
    name: 'butterfly wing oscillations',
    shortTitle: 'butterfly flow',
    description: 'curvilinear dual-wing chaotic ocular stimulation.',
    captionText: 'butterfly oscillations. follow the fluid wing contours smoothly.',
    voiceAudioPath: '/audio/voice/butterfly.mp3',
    instructionDurationSeconds: 4.5,
    recommendedMotionSeconds: 50,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.36;
      const ry = height * 0.32;
      const a = t * Math.PI * 0.25;
      const r = Math.sin(2 * a) * 0.8 + 0.4;
      return { x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * (0.8 + 0.3 * Math.cos(3 * a)) };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.36;
      const ry = height * 0.32;
      const points = [];
      for (let i = 0; i <= 80; i++) {
        const a = (i / 80) * Math.PI * 4;
        const r = Math.sin(2 * a) * 0.8 + 0.4;
        points.push({ x: cx + Math.cos(a) * rx * r, y: cy + Math.sin(a) * ry * (0.8 + 0.3 * Math.cos(3 * a)) });
      }
      return points;
    },
  },
pendulum: {
    id: 'pendulum',
    name: 'pendulum gravitational arc',
    shortTitle: 'pendulum arc',
    description: 'gravity-simulated smooth arc with natural acceleration and deceleration.',
    captionText: 'pendulum arc. track the rhythmic swinging arc without moving your head.',
    voiceAudioPath: '/audio/voice/pendulum.mp3',
    instructionDurationSeconds: 4.5,
    recommendedMotionSeconds: 45,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const originY = height * 0.05;
      const length = height * 0.78;
      const maxAngle = (42 * Math.PI) / 180;
      const theta = Math.sin(t * (2 * Math.PI / 3.6)) * maxAngle;
      return { x: cx + Math.sin(theta) * length, y: originY + Math.cos(theta) * length };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const originY = height * 0.05;
      const length = height * 0.78;
      const maxAngle = (42 * Math.PI) / 180;
      const points = [];
      for (let i = 0; i <= 40; i++) {
        const prog = (i / 40) * 2 - 1;
        const theta = prog * maxAngle;
        points.push({ x: cx + Math.sin(theta) * length, y: originY + Math.cos(theta) * length });
      }
      return points;
    },
  },
  // ── NEW EXERCISES ──────────────────────────────────────────────────────────
  ellipse: {
    id: 'ellipse',
    name: 'wide elliptical orbit',
    shortTitle: 'ellipse orbit',
    description: 'a wide, tall elliptical orbit — different aspect ratio from circular to stress different ocular muscles.',
    captionText: 'elliptical orbit. follow the elongated oval path smoothly. let your eyes do all the work.',
    voiceAudioPath: '/audio/voice/ellipse.mp3',
    instructionDurationSeconds: 4.5,
    recommendedMotionSeconds: 50,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.42; // much wider than tall
      const ry = height * 0.22;
      const angle = t * Math.PI * 0.28;
      return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.42;
      const ry = height * 0.22;
      const points = [];
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        points.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
      }
      return points;
    },
  },
  triangle: {
    id: 'triangle',
    name: 'equilateral triangle path',
    shortTitle: 'triangle path',
    description: '3-point angular tracking — requires fast crisp directional shifts at each vertex.',
    captionText: 'triangle tracking. sharp corners — let your eyes snap cleanly to each vertex.',
    voiceAudioPath: '/audio/voice/triangle.mp3',
    instructionDurationSeconds: 4,
    recommendedMotionSeconds: 45,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width * 0.35, height * 0.36);
      // 3 vertices, top + bottom-left + bottom-right
      const pts = [0, 1, 2, 0].map((idx) => {
        const a = (idx * 2 * Math.PI / 3) - Math.PI / 2;
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
      });
      const period = 9;
      const prog = ((t % period) / period) * 3;
      const seg = Math.floor(prog);
      const frac = prog - seg;
      return { x: pts[seg].x + (pts[seg + 1].x - pts[seg].x) * frac, y: pts[seg].y + (pts[seg + 1].y - pts[seg].y) * frac };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width * 0.35, height * 0.36);
      return [0, 1, 2, 0].map((idx) => {
        const a = (idx * 2 * Math.PI / 3) - Math.PI / 2;
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
      });
    },
  },
  figure_s: {
    id: 'figure_s',
    name: 'figure-S wave drift',
    shortTitle: 'S-wave drift',
    description: 'slow sinusoidal S-shaped drift combining horizontal sweep with delayed vertical undulation.',
    captionText: 'S-wave drift. follow the slow, flowing S-curve. keep your breathing slow and deep.',
    voiceAudioPath: '/audio/voice/figure_s.mp3',
    instructionDurationSeconds: 4.5,
    recommendedMotionSeconds: 50,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.40;
      const ry = height * 0.30;
      // Slow horizontal sweep + out-of-phase vertical
      const x = cx + Math.sin(t * Math.PI * 0.18) * rx;
      const y = cy + Math.sin(t * Math.PI * 0.36 + Math.PI / 2) * ry;
      return { x, y };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.40;
      const ry = height * 0.30;
      const points = [];
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * 11;
        points.push({ x: cx + Math.sin(t * Math.PI * 0.18) * rx, y: cy + Math.sin(t * Math.PI * 0.36 + Math.PI / 2) * ry });
      }
      return points;
    },
  },
  cross_jump: {
    id: 'cross_jump',
    name: 'cardinal cross jumps',
    shortTitle: 'cross jumps',
    description: 'fast saccades across 4 cardinal directions — N, S, E, W — with centre return each time.',
    captionText: 'cross jumps. snap to each compass point, then back to center. stay sharp.',
    voiceAudioPath: '/audio/voice/cross_jump.mp3',
    instructionDurationSeconds: 4,
    recommendedMotionSeconds: 45,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const dx = width * 0.36;
      const dy = height * 0.34;
      // Sequence: center, right, center, down, center, left, center, up
      const seq = [
        { x: cx, y: cy },
        { x: cx + dx, y: cy },
        { x: cx, y: cy },
        { x: cx, y: cy + dy },
        { x: cx, y: cy },
        { x: cx - dx, y: cy },
        { x: cx, y: cy },
        { x: cx, y: cy - dy },
      ];
      const index = Math.floor(t / 1.1) % seq.length;
      return { ...seq[index], auxiliaryPoints: seq.filter((_, i) => i % 2 !== 0).map(p => ({ ...p, opacity: 0.3 })) };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const dx = width * 0.36;
      const dy = height * 0.34;
      return [
        { x: cx - dx, y: cy }, { x: cx + dx, y: cy },
        { x: cx, y: cy - dy }, { x: cx, y: cy + dy },
      ];
    },
  },
   slow_orbit: {
    id: 'slow_orbit',
    name: 'ultra-slow orbit',
    shortTitle: 'slow orbit',
    description: 'very slow circular orbit to train sustained smooth pursuit — tests patience of the ciliary system.',
    captionText: 'ultra-slow orbit. this is very slow and deliberate. follow every millimeter of the arc.',
    voiceAudioPath: '/audio/voice/slow_orbit.mp3',
    instructionDurationSeconds: 4.5,
    recommendedMotionSeconds: 55,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.38;
      const ry = height * 0.36;
      const angle = t * Math.PI * 0.1; // very slow — full circle every ~20s
      return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.38;
      const ry = height * 0.36;
      const points = [];
      for (let i = 0; i <= 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        points.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
      }
      return points;
    },
  },
  random_drift: {
    id: 'random_drift',
    name: 'organic random drift',
    shortTitle: 'organic drift',
    description: 'pseudo-random Lissajous drift — unpredictable path trains reactive tracking.',
    captionText: 'organic drift. the ball moves freely. react and follow — do not anticipate.',
    voiceAudioPath: '/audio/voice/random_drift.mp3',
    instructionDurationSeconds: 5,
    recommendedMotionSeconds: 50,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.36;
      const ry = height * 0.32;
      // Lissajous with irrational ratio creates never-repeating apparent path
      const x = cx + Math.sin(t * Math.PI * 0.37 + 1.1) * rx * Math.cos(t * 0.07);
      const y = cy + Math.sin(t * Math.PI * 0.51 + 2.4) * ry * Math.cos(t * 0.11);
      return { x, y };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.36;
      const ry = height * 0.32;
      const points = [];
      for (let i = 0; i <= 80; i++) {
        const t = (i / 80) * 16;
        points.push({
          x: cx + Math.sin(t * Math.PI * 0.37 + 1.1) * rx * Math.cos(t * 0.07),
          y: cy + Math.sin(t * Math.PI * 0.51 + 2.4) * ry * Math.cos(t * 0.11),
        });
      }
      return points;
    },
  },
   figure_8_vertical: {
    id: 'figure_8_vertical',
    name: 'vertical figure-8',
    shortTitle: 'vertical ∞',
    description: 'vertical lemniscate — figure-8 tilted 90°, targeting the superior/inferior rectus muscles differently from the horizontal version.',
    captionText: 'vertical figure-8. follow the tall looping path up and over. breathe naturally.',
    voiceAudioPath: '/audio/voice/figure_8_vertical.mp3',
    instructionDurationSeconds: 4.5,
    recommendedMotionSeconds: 50,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const a = height * 0.38;
      const b = width * 0.22;
      const omega = t * Math.PI * 0.28;
      // Rotate the lemniscate 90°: swap x and y roles
      return { x: cx + b * Math.sin(omega) * Math.cos(omega) * 1.5, y: cy + a * Math.sin(omega) };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const a = height * 0.38;
      const b = width * 0.22;
      const points = [];
      for (let i = 0; i <= 60; i++) {
        const omega = (i / 60) * Math.PI * 2;
        points.push({ x: cx + b * Math.sin(omega) * Math.cos(omega) * 1.5, y: cy + a * Math.sin(omega) });
      }
      return points;
    },
  },
  hexagon: {
    id: 'hexagon',
    name: 'hexagon perimeter',
    shortTitle: 'hexagon',
    description: '6-point equilateral tracking — evenly distributes work across all 6 extraocular muscles.',
    captionText: 'hexagon tracking. six corners, equal distance between each. stay steady.',
    voiceAudioPath: '/audio/voice/hexagon.mp3',
    instructionDurationSeconds: 4,
    recommendedMotionSeconds: 48,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width * 0.37, height * 0.36);
      const numPts = 6;
      const pts = [...Array(numPts + 1)].map((_, idx) => {
        const a = ((idx % numPts) * 2 * Math.PI / numPts) - Math.PI / 2;
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
      });
      const period = 12;
      const prog = ((t % period) / period) * numPts;
      const seg = Math.floor(prog);
      const frac = prog - seg;
      return { x: pts[seg].x + (pts[seg + 1].x - pts[seg].x) * frac, y: pts[seg].y + (pts[seg + 1].y - pts[seg].y) * frac };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const r = Math.min(width * 0.37, height * 0.36);
      return [...Array(7)].map((_, idx) => {
        const a = ((idx % 6) * 2 * Math.PI / 6) - Math.PI / 2;
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
      });
    },
  },
   wave_horizontal: {
    id: 'wave_horizontal',
    name: 'horizontal wave oscillation',
    shortTitle: 'H-wave oscillation',
    description: 'ball sweeps left-right while oscillating vertically in a tight wave — trains combined pursuit.',
    captionText: 'horizontal wave. the ball sweeps across in a wave. follow the full arc side to side.',
    voiceAudioPath: '/audio/voice/wave_horizontal.mp3',
    instructionDurationSeconds: 4.5,
    recommendedMotionSeconds: 45,
    calculatePosition: (t, _progress, width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.40;
      const ry = height * 0.20;
      return {
        x: cx + Math.sin(t * Math.PI * 0.22) * rx,
        y: cy + Math.sin(t * Math.PI * 0.66) * ry,
      };
    },
    getTrajectoryPath: (width, height) => {
      const cx = width / 2;
      const cy = height / 2;
      const rx = width * 0.40;
      const ry = height * 0.20;
      const points = [];
      for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * 9;
        points.push({ x: cx + Math.sin(t * Math.PI * 0.22) * rx, y: cy + Math.sin(t * Math.PI * 0.66) * ry });
      }
      return points;
    },
  },
};

export const ALL_EXERCISES = Object.values(EXERCISE_DEFINITIONS);

export function getExerciseById(exerciseId: string): ExerciseDefinition | undefined {
  return EXERCISE_DEFINITIONS[exerciseId as ExerciseId] ?? undefined;
}

export function getRandomExercise(): ExerciseDefinition {
  const exerciseList = ALL_EXERCISES;
  return exerciseList[Math.floor(Math.random() * exerciseList.length)];
}
