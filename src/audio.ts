let audioCtx: AudioContext | null = null;

export const initAudio = () => {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(err => console.warn("Failed to resume audio context:", err));
  }
};

// Global click/touchstart listener to unlock audio on modern browsers / iframes
if (typeof window !== "undefined") {
  const resumeAudioOnGesture = () => {
    initAudio();
    if (audioCtx && audioCtx.state === 'running') {
      window.removeEventListener('click', resumeAudioOnGesture);
      window.removeEventListener('touchstart', resumeAudioOnGesture);
    }
  };
  window.addEventListener('click', resumeAudioOnGesture);
  window.addEventListener('touchstart', resumeAudioOnGesture);
}

export const playHitSound = () => {
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

    osc.type = 'sine';
    
    const now = audioCtx.currentTime;
    
    // Sweep frequency up quickly to simulate a "happy pop/ding"
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.linearRampToValueAtTime(800, now + 0.1);
    
    // Decay volume quickly
    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.linearRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  } catch (e) {
    console.error("Audio error", e);
  }
};

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

    osc.type = 'sawtooth';
    
    const now = audioCtx.currentTime;
    
    // Sweep frequency down to simulate an "error/miss"
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.25);
    
    // Decay volume
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

let heartbeatTimer: any = null;
let currentKnowledge: number = 100;

const playHeartbeatSound = () => {
  if (!audioCtx) {
    initAudio();
  }
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  try {
    const playBeat = (timeOffset: number) => {
      const osc = audioCtx!.createOscillator();
      const gainNode = audioCtx!.createGain();

      osc.type = 'sine';
      
      const now = audioCtx!.currentTime + timeOffset;
      
      // Simulate low frequency heartbeat
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.15);
      
      // Envelope for a heartbeat thud
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.6, now + 0.05);
      gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);

      osc.connect(gainNode);
      gainNode.connect(audioCtx!.destination);

      osc.start(now);
      osc.stop(now + 0.32);
    };

    // Double beat "lub-dub"
    playBeat(0);
    // Only play second beat if not beating too fast
    if (Math.max(0.3, currentKnowledge / 50) > 0.4) {
      playBeat(0.15);
    }

  } catch(e) {
    console.error("Audio error", e);
  }
};

const scheduleNextHeartbeat = () => {
  if (currentKnowledge >= 50) {
    heartbeatTimer = null;
    return;
  }
  
  playHeartbeatSound();
  
  const beatInterval = Math.max(0.3, currentKnowledge / 50) * 1000; 
  
  heartbeatTimer = setTimeout(() => {
      scheduleNextHeartbeat();
  }, beatInterval);
};

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

export const updateHeartbeat = (knowledge: number) => {
  currentKnowledge = knowledge;
  
  if (currentKnowledge >= 50) {
    stopHeartbeat();
  } else if (!heartbeatTimer && currentKnowledge < 50) {
    scheduleNextHeartbeat();
  }
};

export const stopHeartbeat = () => {
  if (heartbeatTimer) {
     clearTimeout(heartbeatTimer);
     heartbeatTimer = null;
  }
};
