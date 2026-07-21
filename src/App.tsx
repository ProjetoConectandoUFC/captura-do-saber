// ==========================================
// IMPORTAÇÕES DE BIBLIOTECAS E COMPONENTES
// ==========================================
import { useState, useRef, useEffect, useCallback } from 'react';
import { GameStatus, Bubble, PopEffect, getBubbleCoords } from './types';
import { KnowledgeBar } from './components/KnowledgeBar';
import { BubbleField } from './components/BubbleField';
import { GameScreens } from './components/GameScreens';
import { Maximize, Minimize, Home, Camera } from 'lucide-react';
import { initAudio, playHitSound, playMissSound, startHeartbeat, updateHeartbeat, stopHeartbeat } from './audio';
import { motion, AnimatePresence } from 'motion/react';

// ==========================================
// CONSTANTES E CONFIGURAÇÕES DO JOGO
// ==========================================
const START_KNOWLEDGE = 50;  // Pontuação inicial de conhecimento
const KNOWLEDGE_WIN = 5;     // Quanto ganha ao estourar uma bolha correta
const KNOWLEDGE_LOSS = 20;   // Quanto perde (se aplicável na lógica)
const SUBJECTS = ["LC", "CH", "R", "M", "CN"]; // Disciplinas escolares (Ex: Linguagens, Humanas, etc.)
const COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"]; // Cores das bolhas

/**
 * Função para calcular os parâmetros ativos (tamanho, padrão de movimento e velocidade)
 * com base na dificuldade escolhida e na rodada (round) atual.
 */
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

  // Na rodada 2, o jogo fica mais desafiador
  if (round === 2) {
    if (baseSize === 'normal') size = 'small';
    if (baseSize === 'small') size = 'tiny';
    if (basePattern === 'straight') pattern = 'swirl';
    speedMultiplier = 1.25; // Aumenta a velocidade em 25%
  } 
  // Na rodada 3, o desafio atinge o nível máximo
  else if (round === 3) {
    if (baseSize === 'normal') size = 'tiny';
    if (baseSize === 'small') size = 'tiny';
    if (basePattern === 'straight') pattern = 'wave';
    if (basePattern === 'swirl') pattern = 'wave';
    speedMultiplier = 1.5; // Aumenta a velocidade em 50%
  }

  return { size, pattern, speed, speedMultiplier };
}

/**
 * Função que gera descrições em texto sobre o que vai mudar de uma rodada para a outra.
 */
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

// ==========================================
// COMPONENTE PRINCIPAL DO APLICATIVO (App)
// ==========================================
export default function App() {
  // --- ESTADOS DO REACT (Controlam a interface visual) ---
  const [stream, setStream] = useState<MediaStream | null>(null); // Fluxo da webcam
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]); // Lista de câmeras disponíveis
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(''); // Câmera escolhida
  const [status, setStatus] = useState<GameStatus>('START'); // Estado atual do jogo (START, PLAYING, WON, etc.)
  const [knowledge, setKnowledge] = useState(START_KNOWLEDGE); // Barra de progresso/conhecimento do jogador
  const [bubbles, setBubbles] = useState<Bubble[]>([]); // Lista de bolhas ativas na tela
  const [pops, setPops] = useState<PopEffect[]>([]); // Efeitos visuais de quando uma bolha estoura
  const [snapshot, setSnapshot] = useState<string | null>(null); // Foto tirada ao fim do jogo
  const [isFullscreen, setIsFullscreen] = useState(false); // Controle de tela cheia

  // Configurações de Dificuldade
  const [gameSize, setGameSize] = useState<'normal' | 'small' | 'tiny'>('normal');
  const [gamePattern, setGamePattern] = useState<'straight' | 'swirl' | 'wave'>('straight');
  const [gameSpeed, setGameSpeed] = useState<'normal' | 'fast' | 'extreme'>('normal');

  // Controle de Rodadas (Rounds)
  const [currentRound, setCurrentRound] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionCountdown, setTransitionCountdown] = useState(3);

  // --- REFERÊNCIAS (Refs - Guardam valores sem re-renderizar a tela inteira) ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const requestRef = useRef<number>(0);
  const transitionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const loopRef = useRef<(time: number) => void>(() => {});

  // Ref que guarda o estado interno usado dentro do loop de animação do jogo (para evitar lentidão)
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

  // ==========================================
  // EFEITOS (useEffect) - GERENCIAMENTO DE HARDWARE E EVENTOS
  // ==========================================

  // 1. Solicita acesso à webcam do usuário quando o app carrega ou a câmera muda
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

        // Lista as câmeras disponíveis no dispositivo
        navigator.mediaDevices.enumerateDevices()
          .then(deviceInfos => {
            const videoInputs = deviceInfos.filter(device => device.kind === 'videoinput');
            setDevices(videoInputs);
          })
          .catch(console.error);
      })
      .catch(console.error);

    // Função de limpeza caso o componente seja fechado
    return () => {
      active = false;
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedDeviceId]);

  // 2. Monitora se câmeras foram conectadas ou desconectadas do computador/celular
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

  // 3. Associa o fluxo de vídeo da webcam ao elemento <video> HTML
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // 4. Monitora alterações no modo de Tela Cheia (Fullscreen)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ==========================================
  // FUNÇÕES DE CONTROLE DO JOGO
  // ==========================================

  // Alterna o modo de tela cheia do navegador
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Captura uma foto da webcam ao finalizar a partida
  const captureSnapshot = useCallback(() => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        ctx.scale(-1, 1); // Espelha a imagem horizontalmente
        ctx.drawImage(videoRef.current, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
        setSnapshot(canvas.toDataURL('image/png'));
      }
    }
  }, []);

  // Encerra o jogo atual definindo um novo status (Vitória ou Derrota)
  const endGame = useCallback((newStatus: GameStatus) => {
    gameState.current.status = newStatus;
    setStatus(newStatus);
    stopHeartbeat(); // Para o som de batimento cardíaco
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

  // Retorna para a tela inicial, resetando todas as variáveis do jogo
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

  // Cria o efeito visual de explosão/estouro quando o usuário acerta uma bolha
  const triggerPop = useCallback((x: number, y: number, color: string, letter: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setPops(prev => [...prev, { id, x, y, color, letter }]);
    
    // Remove o efeito da tela após 1 segundo (1000ms)
    setTimeout(() => {
      setPops(prev => prev.filter(p => p.id !== id));
    }, 1000);
  }, []);

  // Prepara e inicia a próxima rodada (Round) com contagem regressiva
  const startNextRound = useCallback(() => {
    if (transitionIntervalRef.current) {
      clearInterval(transitionIntervalRef.current);
    }
    
    const nextRound = gameState.current.round + 1;
    gameState.current.isTransitioning = true;
    setIsTransitioning(true);
    setTransitionCountdown(3);

    // Limpa as bolhas atuais da tela durante a transição
    gameState.current.bubbles = [];
    setBubbles([]);

    let countdownVal = 3;
    transitionIntervalRef.current = setInterval(() => {
      countdownVal -= 1;
      setTransitionCountdown(countdownVal);
      
      // Quando a contagem chega a zero, o próximo round começa de fato
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

  // Função para iniciar uma nova partida do zero (Rodada 1)
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
    requestRef.current = requestAnimationFrame(loopRef);
  };

  // Função acionada quando o usuário clica em uma bolha
  const handleBubbleClick = useCallback((id: string) => {
    if (gameState.current.status !== 'PLAYING') return;
    
    const remaining = gameState.current.bubbles.filter(b => b.id !== id);
    const poppedBubble = gameState.current.bubbles.find(b => b.id === id);
    
    if (poppedBubble) {
      playHitSound(); // Toca o som de acerto
      
      const { x: currentX, y: currentY } = getBubbleCoords(poppedBubble);
      triggerPop(currentX, currentY, poppedBubble.color, poppedBubble.letter);

      gameState.current.bubbles = remaining;
      gameState.current.knowledge = Math.min(100, gameState.current.knowledge + KNOWLEDGE_WIN);
      
      setBubbles([...gameState.current.bubbles]);
      setKnowledge(gameState.current.knowledge);
      updateHeartbeat(gameState.current.knowledge);
      
      // Verifica se o jogador completou a barra de conhecimento (chegou a 100)
      if (gameState.current.knowledge >= 100) {
        if (gameState.current.round < 3) {
          startNextRound(); // Vai para o próximo round se for menor que 3
        } else {
          endGame('WON'); // Vence o jogo se completou o round 3
        }
      }
    }
  }, [endGame, triggerPop, startNextRound]);

// ==========================================
// LOOP PRINCIPAL DO JOGO (requestAnimationFrame)
// ==========================================
const loop = useCallback((time: number) => {
    // Se o jogo não estiver rodando (ex: pausado ou na tela inicial), interrompe o loop
    if (gameState.current.status !== 'PLAYING') return;
    
    // Se estiver em transição de rodada, aguarda e chama o loop novamente
    if (gameState.current.isTransitioning) {
      requestRef.current = requestAnimationFrame(loop);
      return;
    }

    // Calcula quanto tempo passou desde o início da rodada
    const timeElapsed = time - gameState.current.startTime;
    
    // Define a frequência com que novas bolhas aparecem (quanto mais tempo passa, mais rápido aparecem)
    const spawnInterval = Math.max(300, 1000 - (timeElapsed / 15)); 
    
    // Pega os parâmetros da rodada atual
    const activeParams = getActiveParameters(gameSize, gamePattern, gameSpeed, gameState.current.round);
    
    // Calcula a velocidade multiplicada pelo tempo decorrido e pela dificuldade
    const speedMultiplier = (1 + (timeElapsed / 10000)) * activeParams.speedMultiplier;

    // --- LÓGICA DE CRIAÇÃO (SPAWN) DE BOLHAS ---
    if (time - gameState.current.lastSpawnTime > spawnInterval) {
      gameState.current.lastSpawnTime = time;
      
      // Sorteia uma posição ao redor da tela (fora do campo de visão) para a bolha nascer
      const angle = Math.random() * Math.PI * 2;
      const originX = 0.5 + Math.cos(angle) * 0.7; 
      const originY = 0.5 + Math.sin(angle) * 0.7;
      
      // Define a velocidade base dependendo da configuração escolhida
      let baseSpeed = 0.008 + Math.random() * 0.003;
      if (gameState.current.speed === 'fast') {
        baseSpeed = 0.013 + Math.random() * 0.004;
      } else if (gameState.current.speed === 'extreme') {
        baseSpeed = 0.019 + Math.random() * 0.006;
      }

      // Adiciona uma nova bolha na lista interna do jogo
      gameState.current.bubbles.push({
        id: Math.random().toString(36).substring(2, 9), // ID único
        originX,
        originY,
        progress: 0,
        letter: SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)], // Letra/matéria aleatória
        color: COLORS[Math.floor(Math.random() * COLORS.length)],     // Cor aleatória
        speed: baseSpeed * speedMultiplier,
        size: gameState.current.size,
        pattern: gameState.current.pattern,
        angleOffset: Math.random() * Math.PI * 2
      });
    }

    // --- LÓGICA DE DETECÇÃO DE MOVIMENTO PELA WEBCAM ---
    let caughtIds: string[] = []; // IDs das bolhas que o usuário tocou/estourou
    
    if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
      const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        ctx.save();
        ctx.scale(-1, 1); // Espelha o vídeo para acompanhar os movimentos reais do usuário
        ctx.drawImage(videoRef.current, -width, 0, width, height);
        ctx.restore();
        
        // Pega os pixels do quadro atual da webcam
        const currentData = ctx.getImageData(0, 0, width, height).data;
        const prevData = prevFrameRef.current; // Pega o quadro anterior para comparar
        
        if (prevData) {
          for (const b of gameState.current.bubbles) {
            if (b.progress < 0.1) continue; // Ignora bolhas que acabaram de nascer
            
            const { x: currentX, y: currentY } = getBubbleCoords(b);
            
            const cx = Math.floor(currentX * width);
            const cy = Math.floor(currentY * height);
            
            // Define o raio de detecção e limite de movimento conforme o tamanho da bolha
            let radius = 15; 
            let motionThreshold = 8;
            if (b.size === 'small') {
              radius = 11;
              motionThreshold = 5;
            } else if (b.size === 'tiny') {
              radius = 8;
              motionThreshold = 3;
            }
            
            let motionCount = 0;
            // Varre os pixels ao redor da bolha pulando de 2 em 2 para poupar processamento (CPU)
            for (let y = Math.max(0, cy - radius); y < Math.min(height, cy + radius); y += 2) {
              for (let x = Math.max(0, cx - radius); x < Math.min(width, cx + radius); x += 2) {
                const i = (y * width + x) * 4;
                const rDiff = Math.abs(currentData[i] - prevData[i]);
                const gDiff = Math.abs(currentData[i+1] - prevData[i+1]);
                const bDiff = Math.abs(currentData[i+2] - prevData[i+2]);
                
                // Se a diferença de cor entre o quadro anterior e atual for alta, houve movimento!
                if (rDiff + gDiff + bDiff > 120) {
                   motionCount++;
                }
              }
            }

            const hit = motionCount > motionThreshold;

            if (hit) {
               caughtIds.push(b.id);
            }
            
            // Se houve movimento na região da bolha, desenha o indicador visual de colisão (debug)
            if (hit) {
              drawCollisionDebug(ctx, cx, cy, radius, hit);
            }
          }
        }
        // Atualiza o quadro anterior com os dados atuais para a próxima verificação
        prevFrameRef.current = new Uint8ClampedArray(currentData);
      }
    }

  // Função auxiliar para desenhar o círculo de depuração da colisão na câmera
  function drawCollisionDebug(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    hit: boolean
  ) {
    ctx.save();
    ctx.fillStyle = hit ? "rgba(0,255,0,0.25)" : "rgba(255,0,0,0.25)"; // Verde se acertou, vermelho se errou
    ctx.strokeStyle = hit ? "#00ff00" : "#ff0000";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

    // --- ATUALIZAÇÃO DE PONTUAÇÃO (ACERTOS E ERROS) ---
    let knowledgeDelta = 0;
    let caughtCount = 0;
    let missedCount = 0;
    const nextBubbles: Bubble[] = [];
    
    for (const b of gameState.current.bubbles) {
      if (caughtIds.includes(b.id)) {
         knowledgeDelta += KNOWLEDGE_WIN; // Ganha pontos se estourou a bolha
         caughtCount++;
         const { x: currentX, y: currentY } = getBubbleCoords(b);
         triggerPop(currentX, currentY, b.color, b.letter);
      } else {
         b.progress += b.speed;
         if (b.progress >= 1) { // A bolha chegou ao centro sem ser estourada (perdeu)
           knowledgeDelta -= KNOWLEDGE_LOSS;
           missedCount++;
         } else {
           nextBubbles.push(b); // Mantém a bolha viva se ainda não chegou ao centro
         }
      }
    }
    
    gameState.current.bubbles = nextBubbles;

    // Toca efeitos sonoros correspondentes
    if (caughtCount > 0) playHitSound();
    if (missedCount > 0) playMissSound();
    
    if (knowledgeDelta !== 0) {
       gameState.current.knowledge = Math.max(0, Math.min(100, gameState.current.knowledge + knowledgeDelta));
    }

    // Sincroniza o estado interno com o React apenas quando necessário para atualizar a tela
    if (JSON.stringify(bubbles) !== JSON.stringify(gameState.current.bubbles)) {
       setBubbles([...gameState.current.bubbles]);
    }
    
    if (knowledgeDelta !== 0) {
      setKnowledge(gameState.current.knowledge);
      updateHeartbeat(gameState.current.knowledge);
    }

    // --- CONDIÇÕES DE VITÓRIA OU DERROTA ---
    if (gameState.current.knowledge >= 100) {
       if (gameState.current.round < 3) {
         startNextRound(); // Vai para o próximo round
       } else {
         endGame('WON');   // Venceu o jogo completo
       }
    } else if (gameState.current.knowledge <= 0) {
       endGame('LOST');    // Perdeu todas as vidas/conhecimento
    } else {
       requestRef.current = requestAnimationFrame(loop); // Continua o loop do jogo
    }
  }, [bubbles, endGame, triggerPop, startNextRound, gameSize, gamePattern, gameSpeed]);

  // Atualiza a referência do loop sempre que ele mudar
  useEffect(() => {
    loopRef.current = loop;
  }, [loop]);

  // ==========================================
  // RENDERIZAÇÃO DA INTERFACE (JSX)
  // ==========================================
  return (
    <div className="relative overflow-hidden w-full h-screen bg-slate-50 font-sans text-slate-900 select-none">
      
      {/* Elemento de vídeo exibindo a imagem da webcam com efeito espelhado */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={"absolute inset-0 w-full h-full object-cover scale-x-[-1]"}
      />

      {/* Canvas oculto utilizado internamente para processar a detecção de movimento */}
      <canvas ref={canvasRef} width={320} height={240} className="hidden" />

      {/* Controles no Canto Superior Direito (Câmera, Home, Tela Cheia) */}
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

      {/* Detalhes visuais e indicador de "Ao Vivo" na tela */}
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

      {/* Estatísticas da Partida no Canto Superior Esquerdo */}
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

      {/* Tela de Transição entre Rodadas (Com animação) */}
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

              {/* Caixa informando o que vai mudar na próxima rodada */}
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

              {/* Contagem Regressiva */}
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

      {/* Componentes visuais do jogo (Barra de Conhecimento, Bolhas e Telas de Menu/Fim de Jogo) */}
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
