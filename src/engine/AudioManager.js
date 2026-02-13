export class AudioManager {
  constructor() {
    this.sounds = {};
    this.enabled = true;
  }

  loadSound(name, path) {
    const audio = new Audio(path);
    audio.preload = 'auto';
    this.sounds[name] = audio;
    return audio;
  }

  play(name) {
    if (!this.enabled || !this.sounds[name]) return;
    
    const sound = this.sounds[name];
    // Clone the audio for overlapping sounds
    const clone = sound.cloneNode();
    clone.volume = 0.3; // Adjust volume to not be too loud
    clone.play().catch(err => {
      // Ignore errors (e.g., user hasn't interacted with page yet)
      console.debug('Audio play failed:', err);
    });
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }
}
