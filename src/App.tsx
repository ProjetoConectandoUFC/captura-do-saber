import { useState, useRef, useEffect, useCallback } from 'react';
import { GameStatus, Bubble, PopEffect, getBubbleCoords } from './types';
import { KnowledgeBar } from './components/KnowledgeBar';
import { BubbleField } from './components/BubbleField';
import { GameScreens } from './components/GameScreens';
import { Maximize, Minimize, Home, Camera } from 'lucide-react';
import { initAudio, playHitSound, playMissSound, startHeartbeat, updateHeartbeat, stopHeartbeat } from './audio';
import { motion, AnimatePresence } from 'motion/react';

const START_KNOWLEDGE = 50;
const KNOWLEDGE_WIN = 5;
const KNOWLEDGE_LOSS = 20;
const SUBJECTS = ["LC", "CH", "R", "M", "CN"];
const COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

function getActiveParameters(
  baseSize: 'normal' | 'small' | 'tiny',
  basePattern: 'straight' | 'swirl' | 'wave',
  baseSpeed: 'normal' | 'fast' | 'extreme',
  round: number
) {
  let size = baseSize;
  let pattern = basePattern;
  let speed = baseSpeed;
  let speedMultiplier = 1;

  if (round === 2) {
    if (baseSize === 'normal') size = 'small';
    if (baseSize === 'small') size = 'tiny';
    if (basePattern === 'straight') pattern = 'swirl';
    speedMultiplier = 1.25;
  } else if (round === 3) {
    if (baseSize === 'normal') size = 'tiny';
    if (baseSize === 'small') size = 'tiny';
    if (basePattern === 'straight') pattern = 'wave';
    if (basePattern === 'swirl') pattern = 'wave';
    speedMultiplier = 1.5;
  }

  return { size, pattern, speed, speedMultiplier };
}

function getRoundChangesDescription(
  baseSize: 'normal' | 'small' | 'tiny',
  basePattern: 'straight' | 'swirl' | 'wave',
  baseSpeed: 'normal' | 'fast' | 'extreme',
  nextRound: number
) {
  const current = getActiveParameters(baseSize, basePattern, baseSpeed, nextRound - 1);
  const next = getActiveParameters(baseSize, basePattern, baseSpeed, nextRound);
  
  const changes: string[] = [];
  if (current.size !== next.size) {
    const sizeName = next.size === 'small' ? 'Menos espaçoso (Pequeno)' : 'Super preciso (Minúsculo)';
    changes.push(`🎈 Tamanho reduzido para: ${sizeName}`);
  }
  if (current.pattern !== next.pattern) {
    const patternName = next.pattern === 'swirl' ? 'Trajetória Espiral 🌀' : 'Trajetória Sinuosa 🌊';
    changes.push(`🌀 Movimento alterado para: ${patternName}`);
  }
  if (current.speedMultiplier !== next.speedMultiplier) {
    changes.push(`🚀 Aceleração de velocidade extra: +${Math.round((next.speedMultiplier - 1) * 100)}%`);
  }
  
  if (changes.length === 0) {
    changes.push(`🚀 Velocidade de spawn reduzida e fluxo contínuo acelerado!`);
  }
  
  return changes;
}

export default function App() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [status, setStatus] = useState<GameStatus>('START');
  const [knowledge, setKnowledge] = useState(START_KNOWLEDGE);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [pops, setPops] = useState<PopEffect[]>([]);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Difficulty configurations
  const [gameSize, setGameSize] = useState<'normal' | 'small' | 'tiny'>('normal');
  const [gamePattern, setGamePattern] = useState<'straight' | 'swirl' | 'wave'>('straight');
  const [gameSpeed, setGameSpeed] = useState<'normal' | 'fast' | 'extreme'>('normal');

  // Round progression configurations
  const [currentRound, setCurrentRound] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionCountdown, setTransitionCountdown] = useState(3);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const requestRef = useRef<number>(0);
  const transitionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const loopRef = useRef<(time: number) => void>(() => {});

  // Use a mutable ref to hold state securely in the requestAnimationFrame loop
  const gameState = useRef({
    bubbles: [] as Bubble[],
    knowledge: START_KNOWLEDGE,
    status: 'START' as GameStatus,
    lastSpawnTime: 0,
    startTime: 0,
    size: 'normal' as 'normal' | 'small' | 'tiny',
    pattern: 'straight' as 'straight' | 'swirl' | 'wave',
    speed: 'normal' as 'normal' | 'fast' | 'extreme',
    round: 1,
    isTransitioning: false,
  });

  useEffect(() => {
    let active = true;
    let localStream: MediaStream | null = null;

    const constraints: MediaStreamConstraints = {
      video: selectedDeviceId 
        ? { deviceId: { exact: selectedDeviceId } } 
        : { facingMode: "user" }
    };

    navigator.mediaDevices.getUserMedia(constraints)
      .then(s => {
        if (!active) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        localStream = s;
        setStream(s);

        // Enumerate high-quality cameras with labels now that user granted permission
        navigator.mediaDevices.enumerateDevices()
          .then(deviceInfos => {
            const videoInputs = deviceInfos.filter(device => device.kind === 'videoinput');
            setDevices(videoInputs);
          })
          .catch(console.error);
      })
      .catch(console.error);

    return () => {
      active = false;
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedDeviceId]);

  // Listen to camera devices plugging/unplugging dynamically
  useEffect(() => {
    const handleDeviceChange = () => {
      navigator.mediaDevices.enumerateDevices()
        .then(deviceInfos => {
          const videoInputs = deviceInfos.filter(device => device.kind === 'videoinput');
          setDevices(videoInputs);
          
          if (selectedDeviceId) {
            const stillConnected = videoInputs.some(device => device.deviceId === selectedDeviceId);
            if (!stillConnected) {
              setSelectedDeviceId('');
            }
          }
        })
        .catch(console.error);
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [selectedDeviceId]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const captureSnapshot = useCallback(() => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
        setSnapshot(canvas.toDataURL('image/png'));
      }
    }
  }, []);

  const endGame = useCallback((newStatus: GameStatus) => {
    gameState.current.status = newStatus;
    setStatus(newStatus);
    stopHeartbeat();
    if (transitionIntervalRef.current) {
      clearInterval(transitionIntervalRef.current);
    }
    if (newStatus !== 'START') {
      captureSnapshot();
    }
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
  }, [captureSnapshot]);

  const goHome = useCallback(() => {
    endGame('START');
    if (transitionIntervalRef.current) {
      clearInterval(transitionIntervalRef.current);
    }
    setBubbles([]);
    setPops([]);
    setKnowledge(START_KNOWLEDGE);
    setCurrentRound(1);
    setIsTransitioning(false);
    setSnapshot(null);
  }, [endGame]);

  const triggerPop = useCallback((x: number, y: number, color: string, letter: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setPops(prev => [...prev, { id, x, y, color, letter }]);
    
    // Auto-remove pop animation after 1000ms
    setTimeout(() => {
      setPops(prev => prev.filter(p => p.id !== id));
    }, 1000);
  }, []);

  const startNextRound = useCallback(() => {
    if (transitionIntervalRef.current) {
      clearInterval(transitionIntervalRef.current);
    }
    
    const nextRound = gameState.current.round + 1;
    gameState.current.isTransitioning = true;
    setIsTransitioning(true);
    setTransitionCountdown(3);

    // Clear bubbles during transition
    gameState.current.bubbles = [];
    setBubbles([]);

    let countdownVal = 3;
    transitionIntervalRef.current = setInterval(() => {
      countdownVal -= 1;
      setTransitionCountdown(countdownVal);
      
      if (countdownVal <= 0) {
        if (transitionIntervalRef.current) {
          clearInterval(transitionIntervalRef.current);
        }
        
        setCurrentRound(nextRound);
        
        const activeParams = getActiveParameters(gameSize, gamePattern, gameSpeed, nextRound);
        
        gameState.current.round = nextRound;
        gameState.current.size = activeParams.size;
        gameState.current.pattern = activeParams.pattern;
        gameState.current.speed = activeParams.speed;
        gameState.current.knowledge = START_KNOWLEDGE;
        gameState.current.isTransitioning = false;
        gameState.current.lastSpawnTime = performance.now();
        gameState.current.startTime = performance.now();
        
        setIsTransitioning(false);
        setKnowledge(START_KNOWLEDGE);
        updateHeartbeat(START_KNOWLEDGE);
        
        requestRef.current = requestAnimationFrame(loopRef.current);
      }
    }, 1000);
  }, [gameSize, gamePattern, gameSpeed]);

  const startGame = () => {
    initAudio();
    setSnapshot(null);
    setCurrentRound(1);
    setIsTransitioning(false);
    if (transitionIntervalRef.current) {
      clearInterval(transitionIntervalRef.current);
    }

    const activeParams = getActiveParameters(gameSize, gamePattern, gameSpeed, 1);

    gameState.current = {
      bubbles: [],
      knowledge: START_KNOWLEDGE,
      status: 'PLAYING',
      lastSpawnTime: performance.now(),
      startTime: performance.now(),
      size: activeParams.size,
      pattern: activeParams.pattern,
      speed: activeParams.speed,
      round: 1,
      isTransitioning: false,
    };
    setBubbles([]);
    setPops([]);
    setKnowledge(START_KNOWLEDGE);
    setStatus('PLAYING');
    startHeartbeat(START_KNOWLEDGE);
    prevFrameRef.current = null;
    requestRef.current = requestAnimationFrame(loop);
  };

  const handleBubbleClick = useCallback((id: string) => {
    if (gameState.current.status !== 'PLAYING') return;
    
    const remaining = gameState.current.bubbles.filter(b => b.id !== id);
    const poppedBubble = gameState.current.bubbles.find(b => b.id === id);
    
    if (poppedBubble) {
      playHitSound();
      
      const { x: currentX, y: currentY } = getBubbleCoords(poppedBubble);
      triggerPop(currentX, currentY, poppedBubble.color, poppedBubble.letter);

      gameState.current.bubbles = remaining;
      gameState.current.knowledge = Math.min(100, gameState.current.knowledge + KNOWLEDGE_WIN);
      
      setBubbles([...gameState.current.bubbles]);
      setKnowledge(gameState.current.knowledge);
      updateHeartbeat(gameState.current.knowledge);
      
      if (gameState.current.knowledge >= 100) {
        if (gameState.current.round < 3) {
          startNextRound();
        } else {
          endGame('WON');
        }
      }
    }
  }, [endGame, triggerPop, startNextRound]);

  const loop = useCallback((time: number) => {
    if (gameState.current.status !== 'PLAYING') return;
    if (gameState.current.isTransitioning) {
      requestRef.current = requestAnimationFrame(loop);
      return;
    }

    const timeElapsed = time - gameState.current.startTime;
    const spawnInterval = Math.max(300, 1000 - (timeElapsed / 15)); // Spawns faster over time
    const activeParams = getActiveParameters(gameSize, gamePattern, gameSpeed, gameState.current.round);
    const speedMultiplier = (1 + (timeElapsed / 10000)) * activeParams.speedMultiplier;

    // Spawning logic
    if (time - gameState.current.lastSpawnTime > spawnInterval) {
      gameState.current.lastSpawnTime = time;
      const angle = Math.random() * Math.PI * 2;
      const originX = 0.5 + Math.cos(angle) * 0.7; // Start slightly outside the view
      const originY = 0.5 + Math.sin(angle) * 0.7;
      
      let baseSpeed = 0.008 + Math.random() * 0.003;
      if (gameState.current.speed === 'fast') {
        baseSpeed = 0.013 + Math.random() * 0.004;
      } else if (gameState.current.speed === 'extreme') {
        baseSpeed = 0.019 + Math.random() * 0.006;
      }

      gameState.current.bubbles.push({
        id: Math.random().toString(36).substring(2, 9),
        originX,
        originY,
        progress: 0,
        letter: SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)],
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        speed: baseSpeed * speedMultiplier,
        size: gameState.current.size,
        pattern: gameState.current.pattern,
        angleOffset: Math.random() * Math.PI * 2
      });
    }

    // Motion Detection Logic using low-res canvas
    let caughtIds: string[] = [];
    if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
      const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        ctx.save();
        ctx.scale(-1, 1); // Match the mirrored video feed
        ctx.drawImage(videoRef.current, -width, 0, width, height);
        ctx.restore();
        
        const currentData = ctx.getImageData(0, 0, width, height).data;
        const prevData = prevFrameRef.current;
        
        if (prevData) {
          for (const b of gameState.current.bubbles) {
            if (b.progress < 0.1) continue; // Bubble is still off-screen
            
            const { x: currentX, y: currentY } = getBubbleCoords(b);
            
            const cx = Math.floor(currentX * width);
            const cy = Math.floor(currentY * height);
            
            let radius = 15; // Detection radius in downscaled pixels
            let motionThreshold = 8;
            if (b.size === 'small') {
              radius = 11;
              motionThreshold = 5;
            } else if (b.size === 'tiny') {
              radius = 8;
              motionThreshold = 3;
            }
            
            let motionCount = 0;
            // Iterate over bounding box with a step to save CPU
            for (let y = Math.max(0, cy - radius); y < Math.min(height, cy + radius); y += 2) {
              for (let x = Math.max(0, cx - radius); x < Math.min(width, cx + radius); x += 2) {
                const i = (y * width + x) * 4;
                const rDiff = Math.abs(currentData[i] - prevData[i]);
                const gDiff = Math.abs(currentData[i+1] - prevData[i+1]);
                const bDiff = Math.abs(currentData[i+2] - prevData[i+2]);
                // Very basic threshold for movement
                if (rDiff + gDiff + bDiff > 120) {
                   motionCount++;
                }
              }
            }

            const hit = motionCount > motionThreshold;

            if (hit) {
                caughtIds.push(b.id);
            }
            
            // If movement is detected in the region
            if (hit) {
              drawCollisionDebug(ctx, cx, cy, radius, hit);
            }
          }
        }
        prevFrameRef.current = new Uint8ClampedArray(currentData);
      }
    }

//COLISION DEBUG
    function drawCollisionDebug(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    hit: boolean
  ) {
    ctx.save();

    // transparent fill
    ctx.fillStyle = hit
      ? "rgba(0,255,0,0.25)"
      : "rgba(255,0,0,0.25)";

    // border
    ctx.strokeStyle = hit
      ? "#00ff00"
      : "#ff0000";

    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

    // Update state based on captures and misses
    let knowledgeDelta = 0;
    let caughtCount = 0;
    let missedCount = 0;
    const nextBubbles: Bubble[] = [];
    
    for (const b of gameState.current.bubbles) {
      if (caughtIds.includes(b.id)) {
         knowledgeDelta += KNOWLEDGE_WIN;
         caughtCount++;
         const { x: currentX, y: currentY } = getBubbleCoords(b);
         triggerPop(currentX, currentY, b.color, b.letter);
      } else {
         b.progress += b.speed;
         if (b.progress >= 1) { // Hit center (missed)
           knowledgeDelta -= KNOWLEDGE_LOSS;
           missedCount++;
         } else {
           nextBubbles.push(b);
         }
      }
    }
    
    gameState.current.bubbles = nextBubbles;

    if (caughtCount > 0) {
      playHitSound();
    }
    if (missedCount > 0) {
      playMissSound();
    }
    
    if (knowledgeDelta !== 0) {
       gameState.current.knowledge = Math.max(0, Math.min(100, gameState.current.knowledge + knowledgeDelta));
    }

    // Sync only when necessary for React Render
    if (JSON.stringify(bubbles) !== JSON.stringify(gameState.current.bubbles)) {
       setBubbles([...gameState.current.bubbles]);
    }
    
    if (knowledgeDelta !== 0) {
      setKnowledge(gameState.current.knowledge);
      updateHeartbeat(gameState.current.knowledge);
    }

    // Win / Loss condition
    if (gameState.current.knowledge >= 100) {
       if (gameState.current.round < 3) {
         startNextRound();
       } else {
         endGame('WON');
       }
    } else if (gameState.current.knowledge <= 0) {
       endGame('LOST');
    } else {
       requestRef.current = requestAnimationFrame(loop);
    }
  }, [bubbles, endGame, triggerPop, startNextRound, gameSize, gamePattern, gameSpeed]);

  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  return (
    <div className="relative overflow-hidden w-full h-screen bg-slate-50 font-sans text-slate-900 select-none">
      {/* Video element rendering camera stream with mirror effect */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={"absolute inset-0 w-full h-full object-cover scale-x-[-1]"}
      />

      {/* Hidden canvas for off-screen motion processing */}
      <canvas ref={canvasRef} width={320} height={240} className="hidden" />

      {/* Top Right Controls */}
      <div className="absolute top-6 right-6 md:top-10 md:right-20 z-[60] flex flex-wrap items-center justify-end gap-2 md:gap-3">
        {devices.length > 0 && (
          <div className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:py-2.5 bg-white/80 border border-slate-200 rounded-full shadow-lg backdrop-blur-sm text-slate-800 transition-all focus-within:ring-2 focus-within:ring-sky-500 hover:bg-white">
            <Camera className="w-4 h-4 md:w-5 md:h-5 text-slate-600" />
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="bg-transparent text-xs font-semibold focus:outline-none pr-1 cursor-pointer max-w-[125px] md:max-w-[200px] truncate text-slate-800"
              title="Selecionar Câmera"
            >
              <option value="">Câmera Padrão</option>
              {devices.map((device, i) => (
                <option key={device.deviceId || i} value={device.deviceId}>
                  {device.label || `Câmera ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}
        {status !== 'START' && (
          <button 
            onClick={goHome}
            className="p-2 md:p-3 bg-white/80 hover:bg-white text-slate-900 rounded-full shadow-lg backdrop-blur-sm transition-all border border-slate-200 active:scale-95"
            title="Voltar à Tela Inicial"
          >
            <Home className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        )}
        <button 
          onClick={toggleFullscreen}
          className="p-2 md:p-3 bg-white/80 hover:bg-white text-slate-900 rounded-full shadow-lg backdrop-blur-sm transition-all border border-slate-200 active:scale-95"
          title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
        >
          {isFullscreen ? <Minimize className="w-5 h-5 md:w-6 md:h-6" /> : <Maximize className="w-5 h-5 md:w-6 md:h-6" />}
        </button>
      </div>

      {/* UI Overlays */}
      {/* Camera Interface Accents */}
      <div className="absolute top-10 left-10 w-8 h-8 border-t-2 border-l-2 border-slate-400 pointer-events-none z-10 hidden md:block"></div>
      <div className="absolute top-10 right-10 w-8 h-8 border-t-2 border-r-2 border-slate-400 pointer-events-none z-10 hidden md:block"></div>
      <div className="absolute bottom-10 left-10 w-8 h-8 border-b-2 border-l-2 border-slate-400 pointer-events-none z-10 hidden md:block"></div>
      <div className="absolute bottom-10 right-10 w-8 h-8 border-b-2 border-r-2 border-slate-400 pointer-events-none z-10 hidden md:block"></div>
      <div className="absolute top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none z-10">
        <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
        <span className="text-xs font-mono tracking-widest text-slate-600 drop-shadow-sm shadow-white bg-white/50 px-2 py-0.5 rounded backdrop-blur-sm">
          LIVE FEED // {devices.find(d => d.deviceId === selectedDeviceId)?.label ? devices.find(d => d.deviceId === selectedDeviceId)!.label.substring(0, 15).toUpperCase() : 'CAM_01'}
        </span>
      </div>

      {/* Top Left Game Stats */}
      {status === 'PLAYING' && (
        <div className="absolute top-6 left-6 md:top-10 md:left-20 z-40 flex flex-col gap-1.5 pointer-events-none bg-white/75 backdrop-blur-sm border border-slate-200/50 px-4 py-3 rounded-2xl shadow-lg">
          <div className="text-[10px] font-black tracking-widest text-slate-400 uppercase">PARTIDA EM CURSO</div>
          <div className="text-sm font-black text-slate-800 flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Rodada {currentRound} de 3
          </div>
          <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <span>Dificuldade:</span>
            <span className="text-slate-900 font-extrabold uppercase">
              {gameSize === 'normal' && gamePattern === 'straight' && gameSpeed === 'normal' ? 'Iniciante' :
               gameSize === 'small' && gamePattern === 'swirl' && gameSpeed === 'fast' ? 'Intermediário' :
               gameSize === 'tiny' && gamePattern === 'wave' && gameSpeed === 'extreme' ? 'Avançado' : 'Personalizada'}
            </span>
          </div>
        </div>
      )}

      {/* Round Transition Screen */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.9, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 15 }}
              className="bg-white border border-slate-200 rounded-3xl p-6 md:p-10 shadow-2xl max-w-lg w-full text-slate-900"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-4 text-3xl font-black">
                ✓
              </div>
              
              <span className="px-3.5 py-1 rounded-full text-[10px] font-extrabold tracking-widest bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase">
                Rodada {currentRound} Concluída!
              </span>
              
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-3 mb-1 uppercase">
                Prepare-se para a Rodada {currentRound + 1}
              </h2>
              <p className="text-xs text-slate-400 font-bold mb-6 tracking-tight uppercase">
                A Dificuldade Está Prestes a Aumentar!
              </p>

              {/* Dynamic changes bullet box */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-left mb-6 space-y-2">
                <span className="block text-[10px] font-black text-slate-450 uppercase tracking-widest mb-1.5">
                  ⚡ O que muda agora:
                </span>
                {getRoundChangesDescription(gameSize, gamePattern, gameSpeed, currentRound + 1).map((change, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 font-semibold tracking-tight">
                    <span className="text-emerald-500 font-black">▶</span>
                    <span>{change}</span>
                  </div>
                ))}
              </div>

              {/* Countdown circle/number */}
              <div className="flex flex-col items-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Início em
                </div>
                <div className="w-12 h-12 rounded-full border-4 border-slate-900 flex items-center justify-center text-xl font-black text-slate-900 animate-pulse">
                  {transitionCountdown}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <KnowledgeBar knowledge={knowledge} />
      
      <BubbleField bubbles={bubbles} pops={pops} onBubbleClick={handleBubbleClick} />
      
      <GameScreens 
        status={status} 
        startGame={startGame} 
        goHome={goHome} 
        snapshot={snapshot}
        gameSize={gameSize}
        setGameSize={setGameSize}
        gamePattern={gamePattern}
        setGamePattern={setGamePattern}
        gameSpeed={gameSpeed}
        setGameSpeed={setGameSpeed}
      />
    </div>
  );
}
