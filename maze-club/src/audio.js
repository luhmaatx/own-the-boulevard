const SCORES = {
  ruby: { root: 110, notes: [1, 1.5, 1.78, 2, 1.78, 1.5], step: 1900, wave: 'sine' },
  vault: { root: 73.42, notes: [1, 1.26, 1.5, 1.89, 1.5, 1.26], step: 1450, wave: 'triangle' },
  penthouse: { root: 130.81, notes: [1, 1.25, 1.5, 1.78, 2, 1.5], step: 2300, wave: 'sine' }
};

export class MazeMusic {
  constructor() {
    this.context = null;
    this.master = null;
    this.nodes = [];
    this.timer = null;
    this.game = null;
    this.noteIndex = 0;
    try { this.muted = localStorage.getItem('killamani-maze-muted') === 'true'; } catch { this.muted = false; }
  }

  start(gameId) {
    const score = SCORES[gameId];
    if (!score) return;
    if (this.game === gameId && this.master) {
      this.context?.resume().catch(() => {});
      return;
    }
    this.stop();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.context ||= new AudioContextClass();
    this.context.resume().catch(() => {});
    this.game = gameId;
    this.noteIndex = 0;
    const now = this.context.currentTime;
    this.master = this.context.createGain();
    this.master.gain.setValueAtTime(0, now);
    if (!this.muted) this.master.gain.linearRampToValueAtTime(0.024, now + 1.8);
    this.master.connect(this.context.destination);

    const lowpass = this.context.createBiquadFilter();
    lowpass.type = 'lowpass'; lowpass.frequency.value = 680; lowpass.Q.value = 0.5; lowpass.connect(this.master);
    [score.root, score.root * 1.5, score.root * 2].forEach((frequency, index) => {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = index === 1 ? 'triangle' : score.wave;
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index === 2 ? 4 : -3;
      gain.gain.value = index === 0 ? 0.34 : 0.12;
      oscillator.connect(gain); gain.connect(lowpass); oscillator.start();
      this.nodes.push(oscillator);
    });
    this.playNote(score, lowpass);
    this.timer = window.setInterval(() => this.playNote(score, lowpass), score.step);
  }

  playNote(score, destination) {
    if (!this.context || !destination) return;
    const frequency = score.root * score.notes[this.noteIndex++ % score.notes.length];
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = score.wave; oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.35);
    oscillator.connect(gain); gain.connect(destination);
    oscillator.start(now); oscillator.stop(now + 1.4);
  }

  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem('killamani-maze-muted', String(this.muted)); } catch {}
    if (!this.muted && this.game && !this.master) this.start(this.game);
    this.context?.resume?.().catch(() => {});
    if (this.master && this.context) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.024, now, 0.18);
    }
    return this.muted;
  }

  stop() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    if (this.context && this.master) {
      const now = this.context.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(0, now, 0.12);
      this.nodes.forEach(node => { try { node.stop(now + 0.55); } catch {} });
    }
    this.nodes = []; this.master = null; this.game = null;
  }
}
