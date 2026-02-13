export class AudioManager {
  constructor() {
    this.sounds = {};
    this.music = null;
    this.enabled = true;
  }

  loadSound(name, path) {
    const audio = new Audio(path);
    audio.preload = 'auto';
    this.sounds[name] = audio;
    return audio;
  }

  loadMusic(path) {
    this.music = new Audio(path);
    this.music.preload = 'auto';
    this.music.loop = true;
    this.music.volume = 0.2; // Lower volume for background music
    return this.music;
  }

  playMusic() {
    if (!this.enabled || !this.music) {
      console.log('Music not playing - enabled:', this.enabled, 'music loaded:', !!this.music);
      return;
    }
    
    console.log('Attempting to play music...');
    this.music.play().then(() => {
      console.log('Music started successfully!');
    }).catch(err => {
      console.error('Music play failed:', err);
    });
  }

  stopMusic() {
    if (this.music) {
      this.music.pause();
      this.music.currentTime = 0;
    }
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
