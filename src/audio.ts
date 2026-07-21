// ==========================================
// CONFIGURAÇÃO DO CONTEXTO DE ÁUDIO (Web Audio API)
// ==========================================

// Variável para armazenar o contexto de áudio principal do navegador
let audioCtx: AudioContext | null = null;

/**
 * Função para inicializar o sistema de áudio.
 * Os navegadores modernos bloqueiam sons automáticos até que o usuário interaja com a página.
 */
export const initAudio = () => {
  if (!audioCtx) {
    // Compatibilidade com diferentes navegadores (incluindo versões antigas do Safari/Chrome)
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  // Se o áudio estiver pausado (suspended), tenta ativá-lo
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(err => console.warn("Failed to resume audio context:", err));
  }
};

// --- DESBLOQUEIO GLOBAL DE ÁUDIO ---
// Adiciona ouvintes globais para que o primeiro clique ou toque do usuário na tela destrave o som.
if (typeof window !== "undefined") {
  const resumeAudioOnGesture = () => {
    initAudio();
    // Se o áudio estiver rodando com sucesso, remove os ouvintes para economizar memória
    if (audioCtx && audioCtx.state === 'running') {
      window.removeEventListener('click', resumeAudioOnGesture);
      window.removeEventListener('touchstart', resumeAudioOnGesture);
    }
  };
  window.addEventListener('click', resumeAudioOnGesture);
  window.addEventListener('touchstart', resumeAudioOnGesture);
}

// ==========================================
// SOM DE ACERTO (Pop / Ding feliz)
// ==========================================
export const playHitSound = () => {
  if (!audioCtx) {
    initAudio();
  }
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  
  try {
    // Cria um oscilador (gera ondas sonoras) e um ganho (controla o volume)
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine'; // Onda senoidal (som suave, tipo apito/campainha)
    
    const now = audioCtx.currentTime;
    
    // Sobe a frequência rapidamente para simular um som alegre de "ding/pop"
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.1);
    
    // Abaixa o volume rapidamente para criar um efeito de eco curto
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.linearRampToValueAtTime(0.01, now + 0.1);

    // Conecta o som aos controles de volume e depois à saída de áudio do computador
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Inicia e para o som automaticamente após 0.12 segundos
    osc.start(now);
    osc.stop(now + 0.12);
  } catch (e) {
    console.error("Audio error", e);
  }
};

// ==========================================
// SOM DE ERRO (Miss / Perdeu bolha)
// ==========================================
export const playMissSound = () => {
  if (!audioCtx) {
    initAudio();
  }
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  
  try {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sawtooth'; // Onda dente de serra (som mais áspero, ideal para alertas/erros)
    
    const now = audioCtx.currentTime;
    
    // Desce a frequência para simular um som de "lamento" ou erro
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.25);
    
    // Reduz o volume gradualmente
    gainNode.gain.setValueAtTime(0.2, now);
    gainNode.gain.linearRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  } catch (e) {
    console.error("Audio error", e);
  }
};

// ==========================================
// SISTEMA DE BATIMENTO CARDÍACO (Alerta de Vida Baixa)
// ==========================================
let heartbeatTimer: any = null; // Armazena o temporizador do loop do coração
let currentKnowledge: number = 100; // Guarda o nível de conhecimento/vida atual

// Toca o som real do batimento cardíaco
const playHeartbeatSound = () => {
  if (!audioCtx) {
    initAudio();
  }
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  try {
    // Função auxiliar para tocar cada batida (thud)
    const playBeat = (timeOffset: number) => {
      const osc = audioCtx!.createOscillator();
      const gainNode = audioCtx!.createGain();

      osc.type = 'sine'; // Onda suave e grave
      
      const now = audioCtx!.currentTime + timeOffset;
      
      // Simula uma frequência bem baixa (som de tambor/coração)
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.15);
      
      // Controla o volume da batida (aumenta rápido e diminui devagar)
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.6, now + 0.05);
      gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);

      osc.connect(gainNode);
      gainNode.connect(audioCtx!.destination);

      osc.start(now);
      osc.stop(now + 0.32);
    };

    // Toca a primeira batida
    playBeat(0);
    // Toca a segunda batida ("lub-dub") apenas se o ritmo não estiver excessivamente acelerado
    if (Math.max(0.3, currentKnowledge / 50) > 0.4) {
      playBeat(0.15);
    }

  } catch(e) {
    console.error("Audio error", e);
  }
};

// Agenda o próximo batimento cardíaco com base na vida restante (quanto menor a vida, mais rápido bate)
const scheduleNextHeartbeat = () => {
  if (currentKnowledge >= 50) {
    heartbeatTimer = null;
    return;
  }
  
  playHeartbeatSound();
  
  // Calcula o intervalo entre as batidas com base na pontuação baixa
  const beatInterval = Math.max(0.3, currentKnowledge / 50) * 1000; 
  
  heartbeatTimer = setTimeout(() => {
      scheduleNextHeartbeat();
  }, beatInterval);
};

// Inicia o som de coração se a vida estiver abaixo de 50
export const startHeartbeat = (knowledge: number) => {
  currentKnowledge = knowledge;
  if (!audioCtx) {
    initAudio();
  }
  stopHeartbeat();
  if (currentKnowledge < 50) {
    scheduleNextHeartbeat();
  }
};

// Atualiza o estado do coração caso a pontuação suba ou desça durante o jogo
export const updateHeartbeat = (knowledge: number) => {
  currentKnowledge = knowledge;
  
  if (currentKnowledge >= 50) {
    stopHeartbeat(); // Para o som se a vida se recuperar acima de 50
  } else if (!heartbeatTimer && currentKnowledge < 50) {
    scheduleNextHeartbeat(); // Começa a bater se a vida cair abaixo de 50
  }
};

// Para completamente o som de batimento cardíaco
export const stopHeartbeat = () => {
  if (heartbeatTimer) {
     clearTimeout(heartbeatTimer);
     heartbeatTimer = null;
  }
};
