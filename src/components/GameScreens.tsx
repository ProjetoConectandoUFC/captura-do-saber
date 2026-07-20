import { useState } from "react";
import { GameStatus } from "../types";
import { Play, RefreshCw, Settings, X, SlidersHorizontal, Sparkles, ChevronRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface GameScreensProps {
  status: GameStatus;
  startGame: () => void;
  goHome: () => void;
  snapshot?: string | null;
  gameSize: 'normal' | 'small' | 'tiny';
  setGameSize: (s: 'normal' | 'small' | 'tiny') => void;
  gamePattern: 'straight' | 'swirl' | 'wave';
  setGamePattern: (p: 'straight' | 'swirl' | 'wave') => void;
  gameSpeed: 'normal' | 'fast' | 'extreme';
  setGameSpeed: (s: 'normal' | 'fast' | 'extreme') => void;
}

export function GameScreens({ 
  status, 
  startGame, 
  snapshot, 
  gameSize, 
  setGameSize, 
  gamePattern, 
  setGamePattern, 
  gameSpeed, 
  setGameSpeed 
}: GameScreensProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Difficulty Level Helpers
  const applyDifficultyLevel = (level: 1 | 2 | 3) => {
    if (level === 1) {
      setGameSize('normal');
      setGamePattern('straight');
      setGameSpeed('normal');
    } else if (level === 2) {
      setGameSize('small');
      setGamePattern('swirl');
      setGameSpeed('fast');
    } else if (level === 3) {
      setGameSize('tiny');
      setGamePattern('wave');
      setGameSpeed('extreme');
    }
  };

  const checkLevelActive = (level: 1 | 2 | 3) => {
    if (level === 1) {
      return gameSize === 'normal' && gamePattern === 'straight' && gameSpeed === 'normal';
    }
    if (level === 2) {
      return gameSize === 'small' && gamePattern === 'swirl' && gameSpeed === 'fast';
    }
    if (level === 3) {
      return gameSize === 'tiny' && gamePattern === 'wave' && gameSpeed === 'extreme';
    }
    return false;
  };

  const getActiveLevelLabel = () => {
    if (checkLevelActive(1)) return "Nível 1 (Iniciante)";
    if (checkLevelActive(2)) return "Nível 2 (Intermediário)";
    if (checkLevelActive(3)) return "Nível 3 (Avançado)";
    return "Personalizado";
  };

  if (status === "START") {
    return (
      <div className="absolute inset-0 bg-white/75 backdrop-blur-md flex flex-col items-center justify-center overflow-y-auto p-4 md:p-12 text-center z-50">
        <motion.div 
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center w-full max-w-3xl"
        >
          <img src="/logo.png" alt="Logo" className="w-[600px] max-w-[85vw] h-auto mb-6 md:mb-12 object-contain" />

          {/* Active Preset Banner */}
          <div className="mb-8 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-600 font-bold tracking-tight inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
            Vibe Atual: <span className="text-slate-900 font-black">{getActiveLevelLabel()}</span>
          </div>

          {/* Large Action Buttons Row */}
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mx-auto">
            <button 
              onClick={startGame} 
              className="group relative flex-1 cursor-pointer"
            >
              <div className="absolute inset-0 bg-slate-900 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
              <div className="relative bg-slate-900 text-white px-6 py-4.5 sm:py-5 rounded-2xl font-black text-lg sm:text-xl tracking-tighter uppercase flex items-center justify-center gap-3.5 border-b-4 border-slate-700 hover:bg-slate-800 transition-colors w-full">
                Jogar Agora
                <Play className="w-5.5 h-5.5 sm:w-6 sm:h-6" strokeWidth={3} />
              </div>
            </button>

            <button 
              onClick={() => setIsSettingsOpen(true)} 
              className="group relative flex-1 cursor-pointer"
            >
              <div className="absolute inset-0 bg-slate-200 rounded-2xl blur-xl opacity-5 group-hover:opacity-10 transition-opacity"></div>
              <div className="relative bg-slate-100 text-slate-800 border border-slate-200 px-6 py-4.5 sm:py-5 rounded-2xl font-bold text-lg sm:text-xl tracking-tighter uppercase flex items-center justify-center gap-3.5 border-b-4 border-slate-300 hover:bg-slate-200/80 transition-colors w-full">
                Ajustar Jogo
                <Settings className="w-5.5 h-5.5 sm:w-6 sm:h-6 text-slate-600" strokeWidth={2.5} />
              </div>
            </button>
          </div>
        </motion.div>

        {/* Challenge/Difficulty Settings Dialog/Modal with AnimatePresence */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              {/* Dark transparent background overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSettingsOpen(false)}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-md cursor-pointer"
              />

              {/* Settings Card */}
              <motion.div
                initial={{ scale: 0.95, y: 15, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 15, opacity: 0 }}
                transition={{ type: "spring", duration: 0.4 }}
                className="relative bg-white border border-slate-200/90 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col text-left max-h-[90vh]"
              >
                {/* Header panel */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-2.5">
                    <SlidersHorizontal className="w-5 h-5 text-slate-800" />
                    <div>
                      <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight uppercase">
                        Painel de Ajustes
                      </h3>
                      <p className="text-[11px] md:text-xs text-slate-400 font-bold tracking-tight">
                        Selecione um nível de dificuldade ou personalize os parâmetros!
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1.5 rounded-full hover:bg-slate-200/75 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    <X className="w-5.5 h-5.5" />
                  </button>
                </div>

                {/* Content body */}
                <div className="overflow-y-auto px-6 py-6 space-y-7">
                  
                  {/* --- Section 1: Presets 1 to 3 --- */}
                  <div>
                    <h4 className="text-[10px] md:text-xs font-black uppercase text-slate-400 tracking-widest mb-3">
                      🏆 Escolha por Nível de Dificuldade (1 a 3)
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { 
                          level: 1, 
                          title: 'Nível 1', 
                          badge: 'Fácil (Estudo)', 
                          bgBadge: 'bg-emerald-500/10 text-emerald-700',
                          rules: '🎈 Balões Grandes • ➡️ Trajetória Reta • ⏱️ Velocidade 1x' 
                        },
                        { 
                          level: 2, 
                          title: 'Nível 2', 
                          badge: 'Médio (Reflexos)', 
                          bgBadge: 'bg-sky-500/10 text-sky-700',
                          rules: '🎈 Balões Médios • 🌀 Padrão Espiral • ⚡ Velocidade 1.5x' 
                        },
                        { 
                          level: 3, 
                          title: 'Nível 3', 
                          badge: 'Difícil (Foco Total)', 
                          bgBadge: 'bg-red-500/10 text-red-700',
                          rules: '🎈 Balões Minúsculos • 🌊 Padrão Sinuoso • 🔥 Velocidade 2x' 
                        }
                      ].map((preset) => {
                        const isActive = checkLevelActive(preset.level as any);
                        return (
                          <button
                            key={preset.level}
                            onClick={() => applyDifficultyLevel(preset.level as any)}
                            className={`p-4 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                              isActive
                                ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-[1.02]'
                                : 'bg-white text-slate-800 border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-extrabold text-sm uppercase tracking-tight">{preset.title}</span>
                                {isActive && (
                                  <span className="p-0.5 rounded-full bg-emerald-500 text-white">
                                    <Check className="w-3 h-3" strokeWidth={3} />
                                  </span>
                                )}
                              </div>
                              <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                                isActive ? 'bg-white/20 text-white' : preset.bgBadge
                              }`}>
                                {preset.badge}
                              </span>
                            </div>
                            
                            <p className={`text-[10px] leading-relaxed mt-4 leading-normal font-medium ${
                              isActive ? 'text-slate-300' : 'text-slate-400'
                            }`}>
                              {preset.rules}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Divider line */}
                  <div className="border-t border-slate-100" />

                  {/* --- Section 2: Custom Parameter Fine-Tuning --- */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[10px] md:text-xs font-black uppercase text-slate-400 tracking-widest">
                        ⚙️ Ajuste Detalhado de Parâmetros
                      </h4>
                      {getActiveLevelLabel() === "Personalizado" && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 font-extrabold">
                          Configuração Customizada
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Option A: Sizing */}
                      <div>
                        <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wide mb-2">
                          🎈 Diâmetro dos Balões
                        </label>
                        <div className="flex flex-col gap-2">
                          {[
                            { value: 'normal', label: 'Normal', desc: 'Tamanho padrão' },
                            { value: 'small', label: 'Pequeno', desc: 'Requer precisão' },
                            { value: 'tiny', label: 'Minúsculo ⚡', desc: 'Foco extremo!' }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setGameSize(opt.value as any)}
                              className={`px-3 py-2 text-left rounded-xl border transition-all cursor-pointer ${
                                gameSize === opt.value
                                  ? 'bg-slate-100 font-extrabold border-slate-350 text-slate-900 shadow-sm'
                                  : 'bg-white text-slate-600 border-slate-150 hover:bg-slate-50'
                              }`}
                            >
                              <div className="text-xs">{opt.label}</div>
                              <div className="text-[9px] text-slate-400 mt-0.5">{opt.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Option B: Pattern */}
                      <div>
                        <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wide mb-2">
                          🌀 Trajetória
                        </label>
                        <div className="flex flex-col gap-2">
                          {[
                            { value: 'straight', label: 'Direto', desc: 'Caminho reto' },
                            { value: 'swirl', label: 'Em Espiral 🌀', desc: 'Curva rotativa' },
                            { value: 'wave', label: 'Sinuoso 🌊', desc: 'Frequência rápida' }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setGamePattern(opt.value as any)}
                              className={`px-3 py-2 text-left rounded-xl border transition-all cursor-pointer ${
                                gamePattern === opt.value
                                  ? 'bg-slate-100 font-extrabold border-slate-350 text-slate-900 shadow-sm'
                                  : 'bg-white text-slate-600 border-slate-150 hover:bg-slate-50'
                              }`}
                            >
                              <div className="text-xs">{opt.label}</div>
                              <div className="text-[9px] text-slate-400 mt-0.5">{opt.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Option C: Speed */}
                      <div>
                        <label className="block text-[11px] font-black uppercase text-slate-500 tracking-wide mb-2">
                          🚀 Velocidade
                        </label>
                        <div className="flex flex-col gap-2">
                          {[
                            { value: 'normal', label: 'Padrão (1x)', desc: 'Velocidade normal' },
                            { value: 'fast', label: 'Rápido (1.5x)', desc: 'Aceleração rápida' },
                            { value: 'extreme', label: 'Extremo (2x) 🔥', desc: 'Rápido demais!' }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setGameSpeed(opt.value as any)}
                              className={`px-3 py-2 text-left rounded-xl border transition-all cursor-pointer ${
                                gameSpeed === opt.value
                                  ? 'bg-slate-100 font-extrabold border-slate-350 text-slate-900 shadow-sm'
                                  : 'bg-white text-slate-600 border-slate-150 hover:bg-slate-50'
                              }`}
                            >
                              <div className="text-xs">{opt.label}</div>
                              <div className="text-[9px] text-slate-400 mt-0.5">{opt.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Footer confirmation action */}
                <div className="px-6 py-4.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="px-5 py-2.5 rounded-xl text-slate-600 hover:text-slate-800 hover:bg-slate-100 text-xs font-bold uppercase transition-all tracking-wider cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={() => {
                      setIsSettingsOpen(false);
                      startGame();
                    }}
                    className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase transition-all tracking-wider flex items-center gap-1.5 shadow-md cursor-pointer"
                  >
                    Salvar e Jogar <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (status === "WON" || status === "LOST") {
    const isWon = status === "WON";
    return (
      <div className="absolute inset-0 bg-white/70 backdrop-blur-md flex flex-col items-center justify-center p-6 md:p-20 text-center z-50">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="flex flex-col items-center w-full max-w-2xl"
        >
          <div className="mb-4">
            <span className={`px-4 py-1 rounded-full text-xs font-black tracking-widest border uppercase ${isWon ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'bg-red-500/10 text-red-600 border-red-500/30'}`}>
              {isWon ? 'Desempenho Máximo' : 'Desempenho Insuficiente'}
            </span>
          </div>
          
          <h1 className="text-5xl md:text-8xl font-black leading-none mb-6 tracking-tighter uppercase whitespace-normal break-words text-slate-900">
            {isWon ? 'Parabéns!' : 'Fim de Jogo'}<br/>
            <span className={isWon ? "text-emerald-600" : "text-red-500"}>
              {isWon ? 'Você está pronto.' : 'Tente Novamente.'}
            </span>
          </h1>

          {/* Central Snapshot Frame */}
          {snapshot && (
            <div className="mb-8 p-3 bg-white rounded-2xl shadow-xl border border-slate-200 rotate-2 hover:rotate-0 transition-transform duration-300">
              <img src={snapshot} alt="Sua reação final" className="w-64 h-48 md:w-[400px] md:h-[300px] object-cover rounded-xl" />
            </div>
          )}
          
          <p className="text-lg md:text-xl text-slate-600 font-medium mb-12 tracking-tight">
            {isWon 
              ? <>Seu nível de conhecimento atingiu 100%. Você tem tudo o que precisa para dominar o <span className="text-slate-900 font-bold">ENEM</span> e garantir sua vaga no <span className="text-slate-900 font-bold">Vestibular</span>.</>
              : <>Seu nível de conhecimento chegou a 0%. Você precisa focar e estudar um pouco mais para os próximos desafios.</>}
          </p>

          <button onClick={startGame} className="group relative w-full max-w-sm mx-auto cursor-pointer">
            <div className="absolute inset-0 bg-slate-900 rounded-2xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
            <div className="relative bg-slate-900 text-white px-8 py-5 md:px-16 md:py-6 rounded-2xl font-black text-xl md:text-2xl tracking-tighter uppercase flex items-center justify-center gap-4 border-b-4 border-slate-700 hover:bg-slate-800 transition-colors">
              Reiniciar Partida
              <RefreshCw className="w-6 h-6 md:w-8 md:h-8" strokeWidth={3} />
            </div>
          </button>
        </motion.div>
      </div>
    );
  }

  return null;
}
