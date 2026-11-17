import { Platform, Vibration } from 'react-native';

let audioCtx: any = null;

/**
 * Synthesizes Google AI Studio / Gemini signature crystalline glass marimba chime.
 * Staggered ascending harmonic triad: G5 (784Hz) -> C6 (1046Hz) -> E6 (1318Hz)
 * with silky low-pass filtering, zero clicks, and warm sub-octaves.
 */
const playGoogleChime = (ctx: any, loopCount: number = 3) => {
  const now = ctx.currentTime;

  // Master warm filter to round off harsh frequencies
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2600, now);
  filter.connect(ctx.destination);

  const strikeNote = (freq: number, startTime: number, volume: number, duration: number) => {
    // 1. Primary pure sine tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(filter);
    osc.start(startTime);
    osc.stop(startTime + duration);

    // 2. Sub-octave resonance for warmth & body
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(freq / 2, startTime);

    subGain.gain.setValueAtTime(0.0001, startTime);
    subGain.gain.exponentialRampToValueAtTime(volume * 0.25, startTime + 0.015);
    subGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.85);

    subOsc.connect(subGain);
    subGain.connect(filter);
    subOsc.start(startTime);
    subOsc.stop(startTime + duration * 0.85);

    // 3. Delicate glass sparkle harmonic
    const sparkleOsc = ctx.createOscillator();
    const sparkleGain = ctx.createGain();
    sparkleOsc.type = 'sine';
    sparkleOsc.frequency.setValueAtTime(freq * 2, startTime);

    sparkleGain.gain.setValueAtTime(0.0001, startTime);
    sparkleGain.gain.exponentialRampToValueAtTime(volume * 0.08, startTime + 0.01);
    sparkleGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.5);

    sparkleOsc.connect(sparkleGain);
    sparkleGain.connect(filter);
    sparkleOsc.start(startTime);
    sparkleOsc.stop(startTime + duration * 0.5);
  };

  // Google AI Studio Signature Three-Tone Sparkle Chime: G5 -> C6 -> E6
  const loopInterval = 0.42;

  for (let i = 0; i < loopCount; i++) {
    const loopOffset = now + i * loopInterval;
    strikeNote(783.99, loopOffset, 0.42, 0.38);
    strikeNote(1046.50, loopOffset + 0.08, 0.55, 0.48);
    strikeNote(1318.51, loopOffset + 0.16, 0.32, 0.42);
  }
};

export const playNotificationSound = (
  type: 'info' | 'warning' | 'success' | 'alert' = 'warning',
  loops: number = 3
) => {
  try {
    // 1. Native Mobile Devices: Tactical Haptic Vibration (repeats according to loops)
    if (Platform.OS !== 'web') {
      if (type === 'warning' || type === 'alert') {
        const pattern: number[] = [0];
        for (let i = 0; i < loops; i++) {
          pattern.push(120, 60);
        }
        Vibration.vibrate(pattern);
      } else {
        Vibration.vibrate(80);
      }
      return;
    }

    // 2. Web Platform: Instant Web Audio API Google AI Studio Chime (Loops specified times)
    if (typeof window !== 'undefined') {
      const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        if (!audioCtx || audioCtx.state === 'closed') {
          audioCtx = new AudioCtxClass();
        }
        if (audioCtx.state === 'suspended') {
          audioCtx.resume();
        }

        playGoogleChime(audioCtx, loops);
        return;
      }

      // Fallback: HTML5 Audio with pre-generated asset
      try {
        const audio = new Audio('/assets/alert_notification.wav');
        audio.volume = 0.6;
        audio.play().catch(() => {});
      } catch (audioErr) {
        // Handled silently
      }
    }
  } catch (err) {
    console.log('Audio playback ignored or prevented by browser gesture policy:', err);
  }
};
