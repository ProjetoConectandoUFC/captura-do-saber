export type GameStatus = "START" | "PLAYING" | "WON" | "LOST";

export interface Bubble {
  id: string;
  originX: number; // 0 to 1
  originY: number; // 0 to 1
  progress: number; // 0 to 1
  letter: string;
  color: string;
  speed: number;
  size: 'normal' | 'small' | 'tiny';
  pattern: 'straight' | 'swirl' | 'wave';
  angleOffset: number;
}

export interface PopEffect {
  id: string;
  x: number; // 0 to 1
  y: number; // 0 to 1
  color: string;
  letter: string;
}

export function getBubbleCoords(b: Bubble) {
  const dx = 0.5 - b.originX;
  const dy = 0.5 - b.originY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  let x = b.originX + dx * b.progress;
  let y = b.originY + dy * b.progress;

  if (dist > 0) {
    const px = -dy / dist;
    const py = dx / dist;

    if (b.pattern === 'swirl') {
      const frequency = 2 * Math.PI * 1.8; 
      const amp = 0.16 * (1 - b.progress);
      const offset = Math.sin(b.progress * frequency + b.angleOffset) * amp;
      x += px * offset;
      y += py * offset;
    } else if (b.pattern === 'wave') {
      const frequency = 2 * Math.PI * 3.5;
      const amp = 0.10 * (1 - b.progress);
      const offset = Math.sin(b.progress * frequency + b.angleOffset) * amp;
      x += px * offset;
      y += py * offset;
    }
  }

  return { x, y };
}
