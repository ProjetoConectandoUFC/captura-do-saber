interface KnowledgeBarProps {
  knowledge: number;
}

export function KnowledgeBar({ knowledge }: KnowledgeBarProps) {
  const hue = Math.floor((knowledge / 100) * 120);
  
  const isCritical = knowledge < 50;
  // Blinks faster as it approaches 0 (from 1s at 50% down to 0.3s at 0%)
  const blinkDuration = isCritical ? Math.max(0.3, (knowledge / 50)) : 0;
  const animationStyle = isCritical ? { animation: `pulse ${blinkDuration}s cubic-bezier(0.4, 0, 0.6, 1) infinite` } : {};

  return (
    <div className="absolute left-6 md:left-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3 z-40">
      <div 
        className="h-[40vh] md:h-[500px] w-6 md:w-8 bg-white/80 border border-slate-200 rounded-full flex flex-col justify-end p-1 backdrop-blur-md shadow-lg"
        style={animationStyle}
      >
        <div 
          className="w-full rounded-full transition-all duration-300"
          style={{ 
            height: `${knowledge}%`,
            backgroundColor: `hsl(${hue}, 85%, 50%)`,
            boxShadow: `0 0 15px hsla(${hue}, 85%, 50%, 0.5)`
          }}
        ></div>
      </div>
      <div className="text-[10px] md:text-xs font-black tracking-[0.2em] text-slate-500 mb-2" style={{ writingMode: 'vertical-lr' }}>CONHECIMENTO</div>
      <div className="text-lg md:text-xl font-black transition-colors duration-300" style={{ color: `hsl(${hue}, 85%, 40%)` }}>{Math.floor(knowledge)}%</div>
    </div>
  );
}
