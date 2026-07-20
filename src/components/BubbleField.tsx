import { Bubble, PopEffect, getBubbleCoords } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface BubbleFieldProps {
  bubbles: Bubble[];
  pops: PopEffect[];
  onBubbleClick: (id: string) => void;
}

const sizeClasses = {
  normal: "w-16 h-16 md:w-20 md:h-20 text-2xl md:text-3xl border-4",
  small: "w-12 h-12 md:w-14 md:h-14 text-lg md:text-xl border-[3px]",
  tiny: "w-8 h-8 md:w-10 md:h-10 text-xs md:text-sm border-2"
};

function PopExplosion({ pop }: { pop: PopEffect; key?: string }) {
  const particleCount = 10;
  
  return (
    <div 
      className="absolute pointer-events-none select-none z-50"
      style={{
        left: `${pop.x * 100}%`,
        top: `${pop.y * 100}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* 1. Outer Shockwave Expanding Ring */}
      <motion.div
        initial={{ scale: 0.2, opacity: 1 }}
        animate={{ scale: 2.2, opacity: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="absolute w-16 h-16 md:w-20 md:h-20 rounded-full border-4"
        style={{ borderColor: pop.color, transform: 'translate(-50%, -50%)' }}
      />
      
      {/* 2. Concentric Core Expansion Flash */}
      <motion.div
        initial={{ scale: 0.1, opacity: 1 }}
        animate={{ scale: 1.4, opacity: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="absolute w-12 h-12 md:w-16 md:h-16 rounded-full"
        style={{ backgroundColor: pop.color, transform: 'translate(-50%, -50%)' }}
      />

      {/* 3. Floating Splash Text */}
      <motion.div
        initial={{ y: 0, opacity: 1, scale: 0.7 }}
        animate={{ y: -75, opacity: 0, scale: 1.2 }}
        transition={{ duration: 0.75, ease: "easeOut" }}
        className="absolute text-center select-none text-white font-black text-xl md:text-2xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] whitespace-nowrap"
        style={{ transform: 'translateX(-50%)' }}
      >
        +{pop.letter}
      </motion.div>

      {/* 4. Radial Flying Sparks */}
      {Array.from({ length: particleCount }).map((_, i) => {
        const angle = (i * 2 * Math.PI) / particleCount + (Math.random() * 0.4 - 0.2);
        const dist = 45 + Math.random() * 65; // Fly distance
        const targetX = Math.cos(angle) * dist;
        const targetY = Math.sin(angle) * dist;
        const pSize = 6 + Math.random() * 7; // Particle diameter
        const delay = Math.random() * 0.04;
        
        return (
          <motion.div
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ 
              x: targetX, 
              y: targetY, 
              opacity: 0, 
              scale: 0.1 
            }}
            transition={{ 
              duration: 0.45 + Math.random() * 0.25, 
              ease: "easeOut",
              delay 
            }}
            className="absolute rounded-full shadow-md"
            style={{
              width: pSize,
              height: pSize,
              backgroundColor: pop.color,
              transform: 'translate(-50%, -50%)',
              border: '1px solid rgba(255, 255, 255, 0.5)'
            }}
          />
        );
      })}
    </div>
  );
}

export function BubbleField({ bubbles, pops, onBubbleClick }: BubbleFieldProps) {
  return (
    <div className="absolute inset-0 z-30 pointer-events-auto">
      {/* Active gameplay bubbles */}
      <AnimatePresence>
        {bubbles.map((b) => {
          const { x: currentX, y: currentY } = getBubbleCoords(b);
          const sizeClass = sizeClasses[b.size || 'normal'];
          
          return (
            <motion.div
              key={b.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => onBubbleClick(b.id)}
              className={`absolute rounded-full flex items-center justify-center text-white font-black shadow-lg border-white cursor-pointer hover:scale-110 active:scale-95 transition-transform tracking-tight ${sizeClass}`}
              style={{
                left: `${currentX * 100}%`,
                top: `${currentY * 100}%`,
                backgroundColor: b.color,
                transform: 'translate(-50%, -50%)',
                touchAction: 'none'
              }}
            >
              {b.letter}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Pop explosion particle animations */}
      {pops.map((p) => (
        <PopExplosion key={p.id} pop={p} />
      ))}
    </div>
  );
}
