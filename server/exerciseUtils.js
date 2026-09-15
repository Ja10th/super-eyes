// Shared exercise position calculations for use across server and client
// This eliminates code duplication between server renderer, thumbnail generator, and client

export function calculateExercisePosition(exerciseId, t, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.38;
  const ry = height * 0.34;
  
  const segment = (points, period) => {
    const progress = ((t % period) / period) * (points.length - 1);
    const index = Math.floor(progress);
    const fraction = progress - index;
    const from = points[index];
    const to = points[index + 1];
    return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
  };
  
  switch (exerciseId) {
    case 'horizontal': return { x: cx + Math.sin(t * Math.PI * 0.5) * rx, y: cy };
    case 'vertical': return { x: cx, y: cy + Math.sin(t * Math.PI * 0.5) * ry };
    case 'diagonal': {
      const wave = Math.sin(t * Math.PI * 0.5);
      const phase = Math.floor(t / 8) % 2;
      return { x: cx + wave * width * 0.36, y: phase === 0 ? cy + wave * height * 0.33 : cy - wave * height * 0.33 };
    }
    case 'circular': {
      const direction = Math.floor(t / 16) % 2 === 0 ? 1 : -1;
      const angle = t * Math.PI * 0.3 * direction;
      return { x: cx + Math.cos(angle) * width * 0.34, y: cy + Math.sin(angle) * height * 0.34 };
    }
    case 'infinity': {
      const omega = t * Math.PI * 0.3;
      return { x: cx + width * 0.36 * Math.sin(omega), y: cy + height * 0.28 * Math.sin(omega) * Math.cos(omega) * 1.5 };
    }
    case 'near_far': {
      const depth = (Math.sin(t * Math.PI * 0.5) + 1) / 2;
      return { x: cx + Math.sin(t * 0.8) * width * 0.08, y: cy + Math.cos(t * 0.8) * height * 0.06, scale: 0.75 + depth * 0.75 };
    }
    case 'saccades': {
      const dx = width * 0.33;
      const dy = height * 0.3;
      const targets = [[cx - dx, cy - dy], [cx + dx, cy + dy], [cx + dx, cy - dy], [cx - dx, cy + dy], [cx, cy - dy], [cx, cy + dy]];
      const target = targets[Math.floor(t / 1.25) % targets.length];
      return { x: target[0], y: target[1] };
    }
    case 'rest_blink': return { x: cx, y: cy, scale: 0.9 + ((Math.sin(t * Math.PI / 3) + 1) / 2) * 0.4 };
    case 'spiral': {
      const maxR = Math.min(width * 0.36, height * 0.36);
      const cycle = (t % 16) / 16;
      const fraction = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2;
      const radius = maxR * (0.15 + 0.85 * fraction);
      const angle = t * Math.PI * 0.8;
      return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    }
    case 'peripheral': {
      const angle = t * Math.PI * 0.4;
      return { x: cx, y: cy, auxiliaryPoints: [{ x: cx + Math.cos(angle) * width * 0.4, y: cy + Math.sin(angle) * height * 0.38, opacity: 0.9 }, { x: cx + Math.cos(angle + Math.PI) * width * 0.4, y: cy + Math.sin(angle + Math.PI) * height * 0.38, opacity: 0.9 }] };
    }
    case 'box': {
      const w = width * 0.7;
      const h = height * 0.62;
      const left = cx - w / 2;
      const right = cx + w / 2;
      const top = cy - h / 2;
      const bottom = cy + h / 2;
      const perimeter = 2 * (w + h);
      const distance = (t * perimeter / 8) % perimeter;
      if (distance < w) return { x: left + distance, y: top };
      if (distance < w + h) return { x: right, y: top + distance - w };
      if (distance < 2 * w + h) return { x: right - distance + w + h, y: bottom };
      return { x: left, y: bottom - distance + 2 * w + h };
    }
    case 'zigzag': return { x: cx + Math.sin(t * Math.PI * 0.25) * width * 0.36, y: cy + Math.sin(t * Math.PI * 2) * height * 0.32 };
    case 'diamond': return segment([{ x: cx, y: cy - height * 0.34 }, { x: cx + width * 0.36, y: cy }, { x: cx, y: cy + height * 0.34 }, { x: cx - width * 0.36, y: cy }, { x: cx, y: cy - height * 0.34 }], 8);
    case 'star': {
      const radius = Math.min(width * 0.36, height * 0.34);
      const points = [0, 2, 4, 1, 3, 0].map((index) => { const angle = index * 2 * Math.PI / 5 - Math.PI / 2; return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }; });
      return segment(points, 10);
    }
    case 'hourglass': return segment([{ x: cx - width * 0.36, y: cy - height * 0.34 }, { x: cx + width * 0.36, y: cy - height * 0.34 }, { x: cx - width * 0.36, y: cy + height * 0.34 }, { x: cx + width * 0.36, y: cy + height * 0.34 }, { x: cx - width * 0.36, y: cy - height * 0.34 }], 8);
    case 'butterfly': {
      const angle = t * Math.PI * 0.25;
      const radius = Math.sin(2 * angle) * 0.8 + 0.4;
      return { x: cx + Math.cos(angle) * width * 0.36 * radius, y: cy + Math.sin(angle) * height * 0.32 * (0.8 + 0.3 * Math.cos(3 * angle)) };
    }
    case 'pendulum': {
      const theta = Math.sin(t * (2 * Math.PI / 3.6)) * (42 * Math.PI / 180);
      const length = height * 0.78;
      return { x: cx + Math.sin(theta) * length, y: height * 0.05 + Math.cos(theta) * length };
    }
    case 'ellipse': {
      const angle = t * Math.PI * 0.28;
      return { x: cx + Math.cos(angle) * width * 0.42, y: cy + Math.sin(angle) * height * 0.22 };
    }
    case 'triangle': {
      const radius = Math.min(width * 0.35, height * 0.36);
      const points = [0, 1, 2, 0].map((index) => { const angle = index * 2 * Math.PI / 3 - Math.PI / 2; return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }; });
      return segment(points, 9);
    }
    case 'figure_s': return { x: cx + Math.sin(t * Math.PI * 0.18) * width * 0.4, y: cy + Math.sin(t * Math.PI * 0.36 + Math.PI / 2) * height * 0.3 };
    case 'cross_jump': {
      const dx = width * 0.36;
      const dy = height * 0.34;
      const points = [{ x: cx, y: cy }, { x: cx + dx, y: cy }, { x: cx, y: cy }, { x: cx, y: cy + dy }, { x: cx, y: cy }, { x: cx - dx, y: cy }, { x: cx, y: cy }, { x: cx, y: cy - dy }];
      return { ...points[Math.floor(t / 1.1) % points.length], auxiliaryPoints: points.filter((_, index) => index % 2 !== 0).map((point) => ({ ...point, opacity: 0.3 })) };
    }
    case 'slow_orbit': {
      const angle = t * Math.PI * 0.1;
      return { x: cx + Math.cos(angle) * width * 0.38, y: cy + Math.sin(angle) * height * 0.36 };
    }
    case 'random_drift': return { x: cx + Math.sin(t * Math.PI * 0.37 + 1.1) * width * 0.36 * Math.cos(t * 0.07), y: cy + Math.sin(t * Math.PI * 0.51 + 2.4) * height * 0.32 * Math.cos(t * 0.11) };
    case 'figure_8_vertical': {
      const omega = t * Math.PI * 0.28;
      return { x: cx + width * 0.22 * Math.sin(omega) * Math.cos(omega) * 1.5, y: cy + height * 0.38 * Math.sin(omega) };
    }
    case 'hexagon': {
      const radius = Math.min(width * 0.37, height * 0.36);
      const points = [...Array(7)].map((_, index) => { const angle = (index % 6) * 2 * Math.PI / 6 - Math.PI / 2; return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }; });
      return segment(points, 12);
    }
    case 'wave_horizontal': return { x: cx + Math.sin(t * Math.PI * 0.22) * width * 0.4, y: cy + Math.sin(t * Math.PI * 0.66) * height * 0.2 };
    default: return { x: cx + Math.sin(t * Math.PI * 0.5) * rx, y: cy };
  }
}