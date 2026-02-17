/**
 * Manifest d'exemple prêt à l'emploi pour le contexte actuel.
 */
export const DEFAULT_AUDIO_MANIFEST = {
  shoot_lvl1: {
    url: "assets/audio/shoot_lvl1.wav",
    bus: "sfx",
    defaultVolume: 0.6,
    maxInstances: 6,
    priority: 1
  },
  shoot_lvl2: {
    url: "assets/audio/shoot_lvl2.wav",
    bus: "sfx",
    defaultVolume: 0.65,
    maxInstances: 6,
    priority: 2
  },
  shoot_lvl3: {
    url: "assets/audio/shoot_lvl3.wav",
    bus: "sfx",
    defaultVolume: 0.7,
    maxInstances: 6,
    priority: 3
  },
  shoot_lvl4: {
    url: "assets/audio/shoot_lvl4.wav",
    bus: "sfx",
    defaultVolume: 0.75,
    maxInstances: 6,
    priority: 4
  },
  asteroid_explosion_small: {
    url: "assets/audio/asteroid_explosion_small.wav",
    bus: "sfx",
    defaultVolume: 0.8,
    maxInstances: 4,
    priority: 2
  },
  asteroid_explosion_medium: {
    url: "assets/audio/asteroid_explosion_medium.wav",
    bus: "sfx",
    defaultVolume: 0.9,
    maxInstances: 4,
    priority: 3
  },
  asteroid_explosion_large: {
    url: "assets/audio/asteroid_explosion_large.wav",
    bus: "sfx",
    defaultVolume: 1,
    maxInstances: 3,
    priority: 5
  },
  weapon_upgrade: {
    url: "assets/audio/weapon_upgrade.wav",
    bus: "sfx",
    defaultVolume: 0.8,
    maxInstances: 2,
    priority: 4
  },
  weapon_downgrade: {
    url: "assets/audio/weapon_downgrade.wav",
    bus: "sfx",
    defaultVolume: 0.8,
    maxInstances: 2,
    priority: 4
  },
  weapon_electric: {
    url: "assets/audio/weapon_electric.wav",
    bus: "sfx",
    defaultVolume: 0.75,
    maxInstances: 3,
    priority: 3
  },
  bullet_hit: {
    url: "assets/audio/bullet_hit.wav",
    bus: "sfx",
    defaultVolume: 0.6,
    maxInstances: 8,
    priority: 1
  },
  ui_hover: {
    url: "assets/audio/ui_hover.wav",
    bus: "sfx",
    defaultVolume: 0.5,
    maxInstances: 2,
    priority: 2
  },
  ui_click: {
    url: "assets/audio/ui_click.wav",
    bus: "sfx",
    defaultVolume: 0.6,
    maxInstances: 2,
    priority: 2
  },
  engine_loop: {
    url: "assets/audio/engine_loop.wav",
    bus: "sfx",
    loop: true,
    defaultVolume: 0.55,
    maxInstances: 1,
    priority: 2
  },
  music_theme: {
    url: "assets/audio/Asteroid_theme.mp3",
    bus: "music",
    loop: true,
    loopStart: 24.5,
    loopEnd: 147.5,
    defaultVolume: 0.8,
    priority: 0
  }
};

/**
 * Limiteur global de polyphonie SFX.
 * Quand le total des SFX actifs atteint cette valeur, un son de priorité
 * plus faible est ignoré (ou remplacé par un son plus prioritaire).
 */
const GLOBAL_SFX_LIMITER = 20;

/**
 * Gestionnaire audio Web Audio API.
 *
 * - Un seul AudioContext pour toute la durée de vie de l'instance.
 * - Cache des AudioBuffer décodés.
 * - Bus de volume: master / sfx / music.
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
      music: null
    };

    this._volumes = {
      master: 1,
      sfx: 1,
      music: 1
    };

    this._muted = false;

    this._activeOneShots = new Set();
    this._activeLoops = new Map();

    // Tracking des sources actives par son pour maxInstances.
    this._activeSourcesByName = new Map();
    // Tracking des one-shots SFX pour le limiteur global + priorité.
    this._activeSfxOneshots = new Set();
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

    this._buses.sfx.connect(this._buses.master);
    this._buses.music.connect(this._buses.master);
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
   * @param {Record<string, {url: string, bus?: string, loop?: boolean, loopStart?: number, loopEnd?: number, defaultVolume?: number, maxInstances?: number, priority?: number}>} manifest
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

      const loopStart = Number.isFinite(definition.loopStart)
        ? Math.max(0, definition.loopStart)
        : undefined;
      const loopEnd = Number.isFinite(definition.loopEnd)
        ? Math.max(0, definition.loopEnd)
        : undefined;

      this._manifest.set(name, {
        url: definition.url,
        bus,
        loop: Boolean(definition.loop),
        loopStart,
        loopEnd: typeof loopStart === "number" && typeof loopEnd === "number" && loopEnd > loopStart
          ? loopEnd
          : undefined,
        defaultVolume: this._clamp(definition.defaultVolume ?? 1, 0, 1),
        maxInstances: Math.max(1, Math.floor(definition.maxInstances ?? Number.POSITIVE_INFINITY)),
        priority: Math.max(0, Math.floor(definition.priority ?? 0))
      });
    }));
  }

  /**
   * Joue un son one-shot (polyphonique par nature).
   * @param {string} name
   * @param {{volume?: number, playbackRate?: number, detune?: number, when?: number, bus?: string}} [options]
   * @returns {{name: string, source: AudioBufferSourceNode, gain: GainNode, stop: (whenSec?: number) => void} | null}
   */
  play(name, options = {}) {
    const { source, gain, busNode, busName, meta } = this._createPlayableNodes(name, options.bus);

    if (!this._canPlayOneShot(name, meta, busName)) {
      return null;
    }

    source.loop = false;
    source.playbackRate.value = this._clamp(options.playbackRate ?? 1, 0.5, 2);

    if (typeof options.detune === "number") {
      source.detune.value = options.detune;
    }

    const resolvedVolume = options.volume ?? meta.defaultVolume ?? 1;
    gain.gain.value = this._clamp(resolvedVolume, 0, 1);
    gain.connect(busNode);
    source.connect(gain);

    const startTime = this._resolveWhen(options.when);

    const sfxEntry = { source, name, priority: meta.priority ?? 0 };
    this._trackOneShot(name, source, busName, sfxEntry);

    source.onended = () => {
      this._cleanupOneShot(name, source, gain, sfxEntry, busName);
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
   * Joue une boucle et retourne un handle pour la piloter.
   * @param {string} name
   * @param {{volume?: number, playbackRate?: number, detune?: number, when?: number, bus?: string, crossfadeSec?: number}} [options]
   * @returns {{id: string, name: string, source: AudioBufferSourceNode, gain: GainNode, bus: string}}
   */
  playLoop(name, options = {}) {
    const { source, gain, busNode, busName, meta } = this._createPlayableNodes(name, options.bus);

    source.loop = meta.loop !== false;
    if (typeof meta.loopStart === "number") {
      source.loopStart = meta.loopStart;
    }
    if (typeof meta.loopEnd === "number") {
      source.loopEnd = meta.loopEnd;
    }
    source.playbackRate.value = this._clamp(options.playbackRate ?? 1, 0.5, 2);

    if (typeof options.detune === "number") {
      source.detune.value = options.detune;
    }

    const startTime = this._resolveWhen(options.when);
    const targetVolume = this._clamp(options.volume ?? meta.defaultVolume ?? 1, 0, 1);

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
   * Définit le volume d'un bus (0..1): master, sfx, music.
   * @param {"master" | "sfx" | "music"} busName
   * @param {number} value01
   */
  setVolume(busName, value01) {
    this._assertBus(busName);
    this._volumes[busName] = this._clamp(value01, 0, 1);
    this._applyBusVolume(busName);
  }

  /**
   * Raccourci pour configurer les catégories disponibles.
   * @param {{master?: number, sfx?: number, music?: number}} categories
   */
  setCategoryVolume({ master, sfx, music } = {}) {
    if (typeof master === "number") {
      this.setVolume("master", master);
    }
    if (typeof sfx === "number") {
      this.setVolume("sfx", sfx);
    }
    if (typeof music === "number") {
      this.setVolume("music", music);
    }
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

    for (const busName of ["music", "sfx", "master"]) {
      if (this._buses[busName]) {
        this._buses[busName].disconnect();
        this._buses[busName] = null;
      }
    }

    this._buffers.clear();
    this._manifest.clear();
    this._activeOneShots.clear();
    this._activeLoops.clear();
    this._activeSourcesByName.clear();
    this._activeSfxOneshots.clear();

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

    const meta = this._manifest.get(name) || {
      bus: "sfx",
      loop: false,
      loopStart: undefined,
      loopEnd: undefined,
      defaultVolume: 1,
      maxInstances: Number.POSITIVE_INFINITY,
      priority: 0
    };

    const busName = busOverride || meta.bus || "sfx";
    this._assertBus(busName);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gain = this.ctx.createGain();

    return { source, gain, busName, busNode: this._buses[busName], meta };
  }

  _canPlayOneShot(name, meta, busName) {
    const maxInstances = Number.isFinite(meta.maxInstances) ? meta.maxInstances : Number.POSITIVE_INFINITY;
    const byName = this._activeSourcesByName.get(name);
    const activeForName = byName ? byName.size : 0;

    // Limite de polyphonie par son.
    if (activeForName >= maxInstances) {
      return false;
    }

    // Limiteur global SFX piloté par la priorité.
    if (busName === "sfx" && this._activeSfxOneshots.size >= GLOBAL_SFX_LIMITER) {
      const newPriority = meta.priority ?? 0;
      const lowest = this._findLowestPrioritySfx();

      // Son non prioritaire: ignoré.
      if (!lowest || newPriority <= lowest.priority) {
        return false;
      }

      // Son plus prioritaire: on remplace le one-shot le moins prioritaire.
      try {
        lowest.source.stop();
      } catch {
        // no-op
      }
    }

    return true;
  }

  _findLowestPrioritySfx() {
    let lowest = null;
    for (const entry of this._activeSfxOneshots) {
      if (!lowest || entry.priority < lowest.priority) {
        lowest = entry;
      }
    }
    return lowest;
  }

  _trackOneShot(name, source, busName, sfxEntry) {
    this._activeOneShots.add(source);

    if (!this._activeSourcesByName.has(name)) {
      this._activeSourcesByName.set(name, new Set());
    }
    this._activeSourcesByName.get(name).add(source);

    if (busName === "sfx") {
      this._activeSfxOneshots.add(sfxEntry);
    }
  }

  _cleanupOneShot(name, source, gain, sfxEntry, busName) {
    this._activeOneShots.delete(source);

    const byName = this._activeSourcesByName.get(name);
    if (byName) {
      byName.delete(source);
      if (byName.size === 0) {
        this._activeSourcesByName.delete(name);
      }
    }

    if (busName === "sfx") {
      this._activeSfxOneshots.delete(sfxEntry);
    }

    try {
      source.disconnect();
    } catch {
      // no-op
    }
    try {
      gain.disconnect();
    } catch {
      // no-op
    }
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
      throw new Error(`Bus audio inconnu '${busName}'. Bus supportés: master, sfx, music.`);
    }
  }

  _clamp(value, min, max) {
    const n = Number.isFinite(value) ? value : min;
    return Math.min(max, Math.max(min, n));
  }
}

export default AudioManager;
