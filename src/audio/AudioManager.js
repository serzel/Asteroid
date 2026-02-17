/**
 * Manifest d'exemple prêt à l'emploi.
 * Ajoutez simplement de nouvelles entrées sans changer l'architecture.
 */
export const DEFAULT_AUDIO_MANIFEST = {
  shoot: { url: "assets/audio/shoot.wav", bus: "sfx" },
  hit: { url: "assets/audio/hit.wav", bus: "sfx" },
  explosion: { url: "assets/audio/explosion.wav", bus: "sfx" },
  player_hit: { url: "assets/audio/player_hit.wav", bus: "sfx" },
  ui_click: { url: "assets/audio/ui_click.wav", bus: "sfx" },
  combo_up: { url: "assets/audio/combo_up.wav", bus: "sfx" },
  combo_break: { url: "assets/audio/combo_break.wav", bus: "sfx" },
  music_loop: { url: "assets/audio/music_loop.ogg", bus: "music", loop: true }
};

/**
 * Gestionnaire audio Web Audio API.
 *
 * - Un seul AudioContext pour toute la durée de vie de l'instance.
 * - Cache des AudioBuffer décodés.
 * - Bus de volume: master / sfx / music / ui.
 */
export class AudioManager {
  /**
   * Initialise les structures internes (sans I/O réseau).
   */
  constructor() {
    this.ctx = null;
    this._initialized = false;

    this._buffers = new Map();
    this._manifest = new Map();

    this._buses = {
      master: null,
      sfx: null,
      music: null,
      ui: null
    };

    this._volumes = {
      master: 1,
      sfx: 1,
      music: 1,
      ui: 1
    };

    this._muted = false;

    this._activeOneShots = new Set();
    this._activeLoops = new Map();
  }

  /**
   * Crée l'AudioContext et le graphe de bus.
   * @returns {Promise<void>}
   */
  async init() {
    if (this._initialized && this.ctx) return;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) {
      throw new Error("Web Audio API non supportée: AudioContext indisponible.");
    }

    this.ctx = new AudioContextCtor();

    this._buses.master = this.ctx.createGain();
    this._buses.sfx = this.ctx.createGain();
    this._buses.music = this.ctx.createGain();
    this._buses.ui = this.ctx.createGain();

    this._buses.sfx.connect(this._buses.master);
    this._buses.music.connect(this._buses.master);
    this._buses.ui.connect(this._buses.master);
    this._buses.master.connect(this.ctx.destination);

    for (const busName of Object.keys(this._buses)) {
      this._applyBusVolume(busName);
    }

    this._initialized = true;
  }

  /**
   * Reprend le contexte audio après interaction utilisateur (policy navigateur).
   * @returns {Promise<void>}
   */
  async unlock() {
    if (!this.ctx) {
      throw new Error("AudioManager.unlock() appelé avant init().");
    }

    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  /**
   * Précharge et décode les sons déclarés dans un manifest.
   * @param {Record<string, {url: string, bus?: string, loop?: boolean}>} manifest
   * @returns {Promise<void>}
   */
  async load(manifest) {
    if (!this.ctx) {
      throw new Error("AudioManager.load() appelé avant init().");
    }

    const entries = Object.entries(manifest || {});

    await Promise.all(entries.map(async ([name, definition]) => {
      if (!definition || typeof definition.url !== "string") {
        throw new Error(`Manifest audio invalide pour '${name}': 'url' manquante.`);
      }

      const bus = definition.bus || "sfx";
      this._assertBus(bus);

      const response = await fetch(definition.url);
      if (!response.ok) {
        throw new Error(`Échec du chargement audio '${name}' (${definition.url}): HTTP ${response.status}.`);
      }

      const arrayBuffer = await response.arrayBuffer();

      let audioBuffer;
      try {
        audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Échec decodeAudioData pour '${name}' (${definition.url}): ${message}`);
      }

      this._buffers.set(name, audioBuffer);
      this._manifest.set(name, {
        url: definition.url,
        bus,
        loop: Boolean(definition.loop)
      });
    }));
  }

  /**
   * Joue un son one-shot (polyphonique par nature).
   * @param {string} name
   * @param {{volume?: number, playbackRate?: number, detune?: number, when?: number, bus?: string}} [options]
   * @returns {{name: string, source: AudioBufferSourceNode, gain: GainNode, stop: (whenSec?: number) => void}}
   */
  play(name, options = {}) {
    const { source, gain, busNode } = this._createPlayableNodes(name, options.bus);

    source.loop = false;
    source.playbackRate.value = this._clamp(options.playbackRate ?? 1, 0.5, 2);

    if (typeof options.detune === "number") {
      source.detune.value = options.detune;
    }

    gain.gain.value = this._clamp(options.volume ?? 1, 0, 1);
    gain.connect(busNode);
    source.connect(gain);

    const startTime = this._resolveWhen(options.when);

    this._activeOneShots.add(source);

    source.onended = () => {
      this._activeOneShots.delete(source);
      source.disconnect();
      gain.disconnect();
    };

    source.start(startTime);

    return {
      name,
      source,
      gain,
      stop: (whenSec = 0) => {
        try {
          source.stop(this._resolveWhen(whenSec));
        } catch {
          // no-op: stop() peut throw si déjà stoppé.
        }
      }
    };
  }

  /**
   * Joue une boucle (musique/ambiance) et retourne un handle pour la piloter.
   * @param {string} name
   * @param {{volume?: number, playbackRate?: number, detune?: number, when?: number, bus?: string, crossfadeSec?: number}} [options]
   * @returns {{id: string, name: string, source: AudioBufferSourceNode, gain: GainNode, bus: string}}
   */
  playLoop(name, options = {}) {
    const { source, gain, busNode, busName } = this._createPlayableNodes(name, options.bus);

    source.loop = true;
    source.playbackRate.value = this._clamp(options.playbackRate ?? 1, 0.5, 2);

    if (typeof options.detune === "number") {
      source.detune.value = options.detune;
    }

    const startTime = this._resolveWhen(options.when);
    const targetVolume = this._clamp(options.volume ?? 1, 0, 1);

    gain.connect(busNode);
    source.connect(gain);

    const crossfadeSec = Math.max(0, options.crossfadeSec ?? 0);
    if (crossfadeSec > 0) {
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(targetVolume, startTime + crossfadeSec);
    } else {
      gain.gain.setValueAtTime(targetVolume, startTime);
    }

    const id = `${name}#${Math.random().toString(36).slice(2, 10)}`;
    const handle = { id, name, source, gain, bus: busName };

    source.onended = () => {
      this._cleanupLoopHandle(handle);
    };

    source.start(startTime);
    this._activeLoops.set(id, handle);

    return handle;
  }

  /**
   * Stoppe une boucle via son nom ou son handle retourné par playLoop().
   * @param {string | {id?: string, name?: string}} nameOrHandle
   */
  stopLoop(nameOrHandle) {
    if (typeof nameOrHandle === "string") {
      for (const handle of this._activeLoops.values()) {
        if (handle.name === nameOrHandle || handle.id === nameOrHandle) {
          this._stopLoopHandle(handle);
        }
      }
      return;
    }

    if (nameOrHandle && typeof nameOrHandle === "object") {
      const byId = nameOrHandle.id ? this._activeLoops.get(nameOrHandle.id) : null;
      if (byId) {
        this._stopLoopHandle(byId);
        return;
      }

      if (nameOrHandle.name) {
        this.stopLoop(nameOrHandle.name);
      }
    }
  }

  /**
   * Stoppe tous les sons (one-shots + loops).
   */
  stopAll() {
    for (const source of this._activeOneShots) {
      try {
        source.stop();
      } catch {
        // no-op
      }
    }

    for (const handle of [...this._activeLoops.values()]) {
      this._stopLoopHandle(handle);
    }
  }

  /**
   * Définit le volume d'un bus (0..1): master, sfx, music, ui.
   * @param {"master" | "sfx" | "music" | "ui"} busName
   * @param {number} value01
   */
  setVolume(busName, value01) {
    this._assertBus(busName);
    this._volumes[busName] = this._clamp(value01, 0, 1);
    this._applyBusVolume(busName);
  }

  /**
   * Active/désactive le mute global.
   * @param {boolean} value
   */
  setMuted(value) {
    this._muted = Boolean(value);
    this._applyBusVolume("master");
  }

  /**
   * Libère toutes les ressources audio.
   * @returns {Promise<void>}
   */
  async dispose() {
    this.stopAll();

    for (const busName of ["sfx", "music", "ui", "master"]) {
      if (this._buses[busName]) {
        this._buses[busName].disconnect();
        this._buses[busName] = null;
      }
    }

    this._buffers.clear();
    this._manifest.clear();
    this._activeOneShots.clear();
    this._activeLoops.clear();

    if (this.ctx && this.ctx.state !== "closed") {
      await this.ctx.close();
    }

    this.ctx = null;
    this._initialized = false;
  }

  _createPlayableNodes(name, busOverride) {
    if (!this.ctx) {
      throw new Error("AudioManager non initialisé: appelez init() avant play().");
    }

    const buffer = this._buffers.get(name);
    if (!buffer) {
      throw new Error(`Son '${name}' non chargé. Appelez load(manifest) d'abord.`);
    }

    const meta = this._manifest.get(name) || { bus: "sfx", loop: false };
    const busName = busOverride || meta.bus || "sfx";
    this._assertBus(busName);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();

    return { source, gain, busName, busNode: this._buses[busName] };
  }

  _stopLoopHandle(handle) {
    if (!handle) return;
    try {
      handle.source.stop();
    } catch {
      // no-op
    }
    this._cleanupLoopHandle(handle);
  }

  _cleanupLoopHandle(handle) {
    if (!handle) return;
    this._activeLoops.delete(handle.id);
    try {
      handle.source.disconnect();
    } catch {
      // no-op
    }
    try {
      handle.gain.disconnect();
    } catch {
      // no-op
    }
  }

  _resolveWhen(when = 0) {
    const offset = Number.isFinite(when) ? Math.max(0, when) : 0;
    return this.ctx.currentTime + offset;
  }

  _applyBusVolume(busName) {
    const node = this._buses[busName];
    if (!node) return;

    if (busName === "master") {
      node.gain.value = this._muted ? 0 : this._volumes.master;
      return;
    }

    node.gain.value = this._volumes[busName];
  }

  _assertBus(busName) {
    if (!Object.prototype.hasOwnProperty.call(this._buses, busName)) {
      throw new Error(`Bus audio inconnu '${busName}'. Bus supportés: master, sfx, music, ui.`);
    }
  }

  _clamp(value, min, max) {
    const n = Number.isFinite(value) ? value : min;
    return Math.min(max, Math.max(min, n));
  }
}

export default AudioManager;
