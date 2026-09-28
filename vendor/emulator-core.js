/**
 * Horizon Game Boy & Game Boy Color Engine Core
 * Cycle-accurate WebAssembly emulation powered by binjgb + WebAudio + WebRTC Wireless Conduit
 */

(function(global) {
  'use strict';

  const SCREEN_WIDTH = 160;
  const SCREEN_HEIGHT = 144;
  const AUDIO_FRAMES = 4096;
  const AUDIO_LATENCY_SEC = 0.08;
  const CPU_TICKS_PER_SECOND = 4194304;
  const CPU_TICKS_PER_60HZ = Math.floor(CPU_TICKS_PER_SECOND / 60);
  const MAX_UPDATE_SEC = 5 / 60;
  const EVENT_NEW_FRAME = 1;
  const EVENT_AUDIO_BUFFER_FULL = 2;
  const EVENT_UNTIL_TICKS = 4;

  const BUILTIN_PALETTES = [
    { id: 0, name: 'DMG Classic Olive', theme: 'classic' },
    { id: 1, name: 'Game Boy Pocket (B&W)', theme: 'pocket' },
    { id: 2, name: 'Game Boy Light (Teal)', theme: 'light' },
    { id: 3, name: 'Super Game Boy 1', theme: 'sgb' },
    { id: 14, name: 'Sunset Amber CRT', theme: 'amber' },
    { id: 22, name: 'Cyberpunk Neon', theme: 'neon' },
    { id: 50, name: 'Emerald Forest', theme: 'forest' }
  ];

  const BUILTIN_ROMS = [
    {
      id: 'tobu',
      title: 'Tobu Tobu Girl',
      file: 'roms/TobuTobuGirl.gb',
      developer: 'Tangram Games',
      year: '2016',
      genre: 'Action / Arcade',
      description: 'Acclaimed action arcade masterpiece! Bounce on enemies and flap wings to rescue your cat from the stratosphere before time runs out.',
      color: '#d946ef',
      icon: '🐱'
    },
    {
      id: 'traumatarium',
      title: 'Traumatarium',
      file: 'roms/Traumatarium.gb',
      developer: 'Horror Rogue',
      year: '2022',
      genre: '1st-Person Dungeon RPG',
      description: 'Atmospheric dark fantasy dungeon delve. Navigate cursed crypts, manage stamina, battle macabre horrors, and discover ancient artifacts.',
      color: '#ef4444',
      icon: '⚔️'
    },
    {
      id: 'jetpak',
      title: 'Super JetPak DX',
      file: 'roms/SuperJetPakDX.gbc',
      developer: 'RetroGB',
      year: '2020',
      genre: 'Arcade Platformer (GBC)',
      description: 'Vibrant Game Boy Color space action! Blast alien waves, recover lost rocket ship parts, and refuel your ship to escape hostile worlds.',
      color: '#06b6d4',
      icon: '🚀'
    },
    {
      id: 'wingwarriors',
      title: 'Wing Warriors',
      file: 'roms/WingWarriors.gb',
      developer: 'Retro Shmup',
      year: '2020',
      genre: 'Vertical Scrolling Shmup',
      description: 'High-octane vertical scrolling arcade shooter with blistering dogfights, weapon upgrades, giant bosses, and a stellar chiptune OST.',
      color: '#3b82f6',
      icon: '✈️'
    },
    {
      id: 'dangan',
      title: 'Dangan GB',
      file: 'roms/DanganGB.gb',
      developer: 'Snorpung',
      year: '2019',
      genre: 'Bullet Hell Action',
      description: 'Precision arcade shmup engineered for lightning reflexes. Weave between dense projectile patterns and chain combos for high scores.',
      color: '#f59e0b',
      icon: '💥'
    },
    {
      id: 'porklike',
      title: 'Porklike',
      file: 'roms/Porklike.gb',
      developer: 'Krystian Majewski',
      year: '2021',
      genre: 'Turn-based Roguelike',
      description: 'Tactical dungeon crawl through procedural caverns. Manage inventory, avoid deadly traps, fight goblins, and descend deep into the abyss.',
      color: '#10b981',
      icon: '🗡️'
    },
    {
      id: 'dino',
      title: "Dino's Offline Adventure",
      file: 'roms/DinosOfflineAdventure.gb',
      developer: 'Retro Port',
      year: '2021',
      genre: 'Endless Runner',
      description: 'The beloved Chrome browser dinosaur runner faithfully rebuilt for Game Boy hardware with buttery smooth 60 FPS scrolling and obstacles.',
      color: '#64748b',
      icon: '🦖'
    },
    {
      id: 'flappy',
      title: 'Flappy Boy',
      file: 'roms/FlappyBoy.gb',
      developer: 'Bitnenfer',
      year: '2019',
      genre: 'Arcade Tap Flyer',
      description: 'The addictive one-button flying challenge adapted with authentic DMG physics, fluid animations, and crisp audio cues.',
      color: '#84cc16',
      icon: '🪶'
    },
    {
      id: 'snake',
      title: 'Snake GB',
      file: 'roms/Snake.gb',
      developer: 'Homebrew Labs',
      year: '2020',
      genre: 'Retro Classic',
      description: 'The timeless arcade serpent. Guide the snake through mazes, eat glowing apples, grow longer without crashing, and set high-score records.',
      color: '#22c55e',
      icon: '🐍'
    },
    {
      id: 'wordle',
      title: 'Wordle GB',
      file: 'roms/Wordle.gb',
      developer: 'Homebrew Assembly',
      year: '2022',
      genre: 'Word Puzzle',
      description: 'The global 5-letter word mystery engineered into authentic Game Boy assembly. Six attempts to deduce the hidden word with instant hints.',
      color: '#eab308',
      icon: '🔤'
    }
  ];

  class HorizonGameBoy {
    constructor(options = {}) {
      this.canvas = options.canvas || document.getElementById('gb-canvas');
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.wasmPath = options.wasmPath || 'vendor/binjgb.wasm';
      this.onStatusChange = options.onStatusChange || (() => {});
      this.onFrame = options.onFrame || (() => {});
      this.onButtonEvent = options.onButtonEvent || (() => {});

      this.module = null;
      this.e = null; // Emulator instance pointer
      this.romDataPtr = null;
      this.romSize = 0;
      this.currentRomInfo = null;

      this.isRunning = false;
      this.isPaused = false;
      this.rafId = null;
      this.lastRafSec = 0;
      this.leftoverTicks = 0;
      this.fps = 60;
      this.fpsCounter = 60;
      this.fpsInterval = null;

      // Video
      this.imageData = this.ctx ? this.ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT) : null;
      this.frameBufferPtr = 0;
      this.frameBufferSize = 0;

      // Audio
      this.audioCtx = null;
      this.audioGainNode = null;
      this.audioBufferPtr = 0;
      this.audioBufferCap = 0;
      this.audioStartSec = 0;
      this.volume = 0.7;
      this.isMuted = false;

      // Palettes
      this.currentPalette = 0;

      // Input State
      this.buttonStates = {
        UP: false,
        DOWN: false,
        LEFT: false,
        RIGHT: false,
        A: false,
        B: false,
        START: false,
        SELECT: false
      };

      // Key Bindings
      this.keyMap = {
        'ArrowUp': 'UP',
        'KeyW': 'UP',
        'ArrowDown': 'DOWN',
        'KeyS': 'DOWN',
        'ArrowLeft': 'LEFT',
        'KeyA': 'LEFT',
        'ArrowRight': 'RIGHT',
        'KeyD': 'RIGHT',
        'KeyX': 'A',
        'KeyK': 'A',
        'KeyZ': 'B',
        'KeyJ': 'B',
        'Enter': 'START',
        'Tab': 'SELECT',
        'ShiftRight': 'SELECT',
        'ShiftLeft': 'SELECT'
      };

      this.boundKeyDown = this.handleKeyDown.bind(this);
      this.boundKeyUp = this.handleKeyUp.bind(this);
      this.initKeyboard();
    }

    async init() {
      if (this.module) return this.module;

      try {
        this.onStatusChange('Loading WebAssembly core...');
        let wasmBinary = null;

        // Fetch wasm binary directly for highest reliability
        const resp = await fetch(this.wasmPath);
        if (!resp.ok) {
          throw new Error(`Failed to load ${this.wasmPath}: ${resp.statusText}`);
        }
        wasmBinary = await resp.arrayBuffer();

        if (typeof Binjgb === 'undefined') {
          throw new Error('Binjgb loader is not defined. Ensure binjgb.js is loaded.');
        }

        this.module = await Binjgb({ wasmBinary });
        this.onStatusChange('WebAssembly core ready');
        console.log('[Horizon GB] Binjgb WebAssembly core loaded successfully');
        return this.module;
      } catch (err) {
        console.error('[Horizon GB] Init error:', err);
        this.onStatusChange('Failed to load emulator core: ' + err.message);
        throw err;
      }
    }

    initAudio() {
      if (this.audioCtx) return;
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;

        this.audioCtx = new AudioContextClass();
        this.audioGainNode = this.audioCtx.createGain();
        this.audioGainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.audioCtx.currentTime);

        // Highpass filter at 25Hz to eliminate any DC clicks
        const highpass = this.audioCtx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.setValueAtTime(25, this.audioCtx.currentTime);

        this.audioGainNode.connect(highpass);
        highpass.connect(this.audioCtx.destination);

        console.log('[Horizon GB] WebAudio initialized at', this.audioCtx.sampleRate, 'Hz');
      } catch (e) {
        console.warn('[Horizon GB] AudioContext init warning:', e);
      }
    }

    resumeAudio() {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    }

    setVolume(val) {
      this.volume = Math.max(0, Math.min(1, val));
      if (this.audioGainNode && this.audioCtx && !this.isMuted) {
        this.audioGainNode.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      }
    }

    setMuted(muted) {
      this.isMuted = !!muted;
      if (this.audioGainNode && this.audioCtx) {
        this.audioGainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.audioCtx.currentTime);
      }
    }

    setPalette(palIndex) {
      this.currentPalette = palIndex;
      if (this.module && this.e) {
        this.module._emulator_set_builtin_palette(this.e, palIndex);
      }
    }

    initKeyboard() {
      window.addEventListener('keydown', this.boundKeyDown);
      window.addEventListener('keyup', this.boundKeyUp);
    }

    handleKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'KeyP') {
        this.togglePause();
        e.preventDefault();
        return;
      }
      if (e.code === 'KeyM') {
        this.setMuted(!this.isMuted);
        e.preventDefault();
        return;
      }
      if (e.code === 'F6') {
        this.saveQuickState();
        e.preventDefault();
        return;
      }
      if (e.code === 'F9') {
        this.loadQuickState();
        e.preventDefault();
        return;
      }

      const btn = this.keyMap[e.code];
      if (btn) {
        this.setButton(btn, true);
        e.preventDefault();
      }
    }

    handleKeyUp(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const btn = this.keyMap[e.code];
      if (btn) {
        this.setButton(btn, false);
        e.preventDefault();
      }
    }

    setButton(btnName, isDown) {
      if (!this.module || !this.e) return;
      const name = btnName.toUpperCase();
      this.buttonStates[name] = !!isDown;

      const flag = isDown ? 1 : 0;
      switch (name) {
        case 'UP':
          this.module._set_joyp_up(this.e, flag);
          break;
        case 'DOWN':
          this.module._set_joyp_down(this.e, flag);
          break;
        case 'LEFT':
          this.module._set_joyp_left(this.e, flag);
          break;
        case 'RIGHT':
          this.module._set_joyp_right(this.e, flag);
          break;
        case 'A':
          this.module._set_joyp_A(this.e, flag);
          break;
        case 'B':
          this.module._set_joyp_B(this.e, flag);
          break;
        case 'START':
          this.module._set_joyp_start(this.e, flag);
          break;
        case 'SELECT':
          this.module._set_joyp_select(this.e, flag);
          break;
      }

      this.onButtonEvent(name, isDown);
    }

    async loadRom(arrayBuffer, romInfo = {}) {
      await this.init();
      this.stop();
      this.initAudio();
      this.resumeAudio();

      this.currentRomInfo = romInfo;
      const romBytes = new Uint8Array(arrayBuffer);
      this.romSize = (romBytes.byteLength + 0x7fff) & ~0x7fff;

      // Allocate memory in Wasm heap
      this.romDataPtr = this.module._malloc(this.romSize);
      new Uint8Array(this.module.HEAP8.buffer, this.romDataPtr, this.romSize)
        .fill(0)
        .set(romBytes);

      const sampleRate = this.audioCtx ? this.audioCtx.sampleRate : 48000;
      // cgbColorCurve: 2 (Gambatte color curve)
      this.e = this.module._emulator_new_simple(
        this.romDataPtr,
        this.romSize,
        sampleRate,
        AUDIO_FRAMES,
        2
      );

      if (this.e === 0) {
        this.module._free(this.romDataPtr);
        this.romDataPtr = null;
        throw new Error('Invalid or corrupted Game Boy ROM image.');
      }

      this.frameBufferPtr = this.module._get_frame_buffer_ptr(this.e);
      this.frameBufferSize = this.module._get_frame_buffer_size(this.e);
      this.audioBufferPtr = this.module._get_audio_buffer_ptr(this.e);
      this.audioBufferCap = this.module._get_audio_buffer_capacity(this.e);

      this.setPalette(this.currentPalette);

      // Restore saved battery SRAM if available
      this.restoreBatterySram();

      this.isRunning = true;
      this.isPaused = false;
      this.lastRafSec = 0;
      this.leftoverTicks = 0;
      this.audioStartSec = 0;

      this.startLoop();
      this.startFpsMonitor();

      this.onStatusChange(`Playing: ${romInfo.title || 'Game Boy ROM'}`);
      console.log('[Horizon GB] ROM loaded successfully:', romInfo.title || 'Custom ROM');
    }

    async loadRomFromUrl(url, romInfo = {}) {
      this.onStatusChange(`Fetching ${romInfo.title || url}...`);
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`Failed to load ROM from ${url}: ${resp.statusText}`);
      }
      const buffer = await resp.arrayBuffer();
      await this.loadRom(buffer, romInfo);
    }

    startLoop() {
      if (this.rafId) cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame(this.loop.bind(this));
    }

    loop(startMs) {
      if (!this.isRunning) return;

      this.rafId = requestAnimationFrame(this.loop.bind(this));

      if (this.isPaused) return;

      const startSec = startMs / 1000;
      const deltaSec = Math.max(startSec - (this.lastRafSec || startSec), 0);
      const startTicks = this.module._emulator_get_ticks_f64(this.e);
      const deltaTicks = Math.min(deltaSec, MAX_UPDATE_SEC) * CPU_TICKS_PER_SECOND;
      const runUntilTicks = startTicks + deltaTicks - this.leftoverTicks;

      this.runUntil(runUntilTicks);
      this.leftoverTicks = (this.module._emulator_get_ticks_f64(this.e) - runUntilTicks) | 0;
      this.lastRafSec = startSec;

      if (deltaSec > 0) {
        const instantFps = 1 / deltaSec;
        this.fps = (this.fps * 0.9) + (instantFps * 0.1);
      }

      this.renderFrame();
    }

    runUntil(untilTicks) {
      const currentTicks = this.module._emulator_get_ticks_f64(this.e);
      const mod1Sec = currentTicks - Math.floor(currentTicks / CPU_TICKS_PER_SECOND) * CPU_TICKS_PER_SECOND;
      const next1Sec = Math.ceil(Math.ceil((mod1Sec + 1) / CPU_TICKS_PER_60HZ) * CPU_TICKS_PER_60HZ);
      let next60hzTicks = currentTicks + (next1Sec - mod1Sec);

      while (true) {
        const event = this.module._emulator_run_until_f64(
          this.e,
          Math.min(untilTicks, next60hzTicks)
        );

        if (event & EVENT_AUDIO_BUFFER_FULL) {
          this.pushAudioBuffer();
        }

        if (event & EVENT_UNTIL_TICKS) {
          const curTicks = this.module._emulator_get_ticks_f64(this.e);
          if (curTicks >= next60hzTicks) {
            const m1 = curTicks - Math.floor(curTicks / CPU_TICKS_PER_SECOND) * CPU_TICKS_PER_SECOND;
            const n1 = Math.ceil(Math.ceil((m1 + 1) / CPU_TICKS_PER_60HZ) * CPU_TICKS_PER_60HZ);
            next60hzTicks = curTicks + (n1 - m1);
          } else {
            break;
          }
        }
      }

      // Check if battery RAM was updated and persist
      if (this.module._emulator_was_ext_ram_updated(this.e)) {
        this.saveBatterySram();
      }
    }

    renderFrame() {
      if (!this.ctx || !this.imageData || !this.e || !this.module) return;
      const fbData = new Uint8Array(this.module.HEAP8.buffer, this.frameBufferPtr, this.frameBufferSize);
      this.imageData.data.set(fbData);
      this.ctx.putImageData(this.imageData, 0, 0);
    }

    pushAudioBuffer() {
      if (!this.audioCtx || this.isMuted) return;

      const nowSec = this.audioCtx.currentTime;
      const nowPlusLatency = nowSec + AUDIO_LATENCY_SEC;
      this.audioStartSec = this.audioStartSec || nowPlusLatency;

      if (this.audioStartSec >= nowSec) {
        const sampleRate = this.audioCtx.sampleRate;
        const audioBuf = this.audioCtx.createBuffer(2, AUDIO_FRAMES, sampleRate);
        const chan0 = audioBuf.getChannelData(0);
        const chan1 = audioBuf.getChannelData(1);

        const wasmAudio = new Uint8Array(this.module.HEAP8.buffer, this.audioBufferPtr, this.audioBufferCap);

        for (let i = 0; i < AUDIO_FRAMES; i++) {
          // Convert unsigned 8-bit [0..255] to signed float [-1.0..+1.0]
          chan0[i] = (wasmAudio[2 * i] - 128) / 128;
          chan1[i] = (wasmAudio[2 * i + 1] - 128) / 128;
        }

        const source = this.audioCtx.createBufferSource();
        source.buffer = audioBuf;
        source.connect(this.audioGainNode);
        source.start(this.audioStartSec);

        this.audioStartSec += AUDIO_FRAMES / sampleRate;
      } else {
        this.audioStartSec = nowPlusLatency;
      }
    }

    startFpsMonitor() {
      if (this.fpsInterval) clearInterval(this.fpsInterval);
      this.fpsInterval = setInterval(() => {
        if (this.isRunning && !this.isPaused) {
          this.fpsCounter = Math.round(this.fps);
          this.onFrame({ fps: this.fpsCounter });
        }
      }, 500);
    }

    togglePause() {
      if (!this.isRunning) return;
      this.isPaused = !this.isPaused;
      if (this.isPaused) {
        if (this.audioCtx) this.audioCtx.suspend().catch(() => {});
        this.onStatusChange('Paused');
      } else {
        if (this.audioCtx) this.audioCtx.resume().catch(() => {});
        this.lastRafSec = 0;
        this.leftoverTicks = 0;
        this.audioStartSec = 0;
        this.onStatusChange(`Playing: ${this.currentRomInfo?.title || 'Game Boy'}`);
      }
      return this.isPaused;
    }

    stop() {
      this.isRunning = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      if (this.fpsInterval) {
        clearInterval(this.fpsInterval);
        this.fpsInterval = null;
      }

      if (this.module && this.e) {
        this.saveBatterySram();
        this.module._emulator_delete(this.e);
        this.e = null;
      }

      if (this.module && this.romDataPtr) {
        this.module._free(this.romDataPtr);
        this.romDataPtr = null;
      }
    }

    // Save States
    saveQuickState() {
      if (!this.module || !this.e || !this.currentRomInfo) return false;
      try {
        const fileData = this.module._state_file_data_new(this.e);
        this.module._emulator_write_state(this.e, fileData);
        const ptr = this.module._get_file_data_ptr(fileData);
        const size = this.module._get_file_data_size(fileData);
        const stateBytes = new Uint8Array(new Uint8Array(this.module.HEAP8.buffer, ptr, size));
        this.module._file_data_delete(fileData);

        const b64 = this.uint8ToBase64(stateBytes);
        localStorage.setItem(`gb_state_${this.currentRomInfo.id || 'current'}`, b64);
        this.onStatusChange('Quick State Saved (F6)');
        console.log('[Horizon GB] Saved state size:', size);
        return true;
      } catch (err) {
        console.error('[Horizon GB] Save state error:', err);
        return false;
      }
    }

    loadQuickState() {
      if (!this.module || !this.e || !this.currentRomInfo) return false;
      try {
        const b64 = localStorage.getItem(`gb_state_${this.currentRomInfo.id || 'current'}`);
        if (!b64) {
          this.onStatusChange('No saved state found');
          return false;
        }

        const stateBytes = this.base64ToUint8(b64);
        const fileData = this.module._state_file_data_new(this.e);
        const ptr = this.module._get_file_data_ptr(fileData);
        const size = this.module._get_file_data_size(fileData);

        if (size === stateBytes.byteLength) {
          new Uint8Array(this.module.HEAP8.buffer, ptr, size).set(stateBytes);
          this.module._emulator_read_state(this.e, fileData);
          this.onStatusChange('Quick State Loaded (F9)');
          console.log('[Horizon GB] Loaded state successfully');
        } else {
          console.warn('[Horizon GB] Save state size mismatch');
        }
        this.module._file_data_delete(fileData);
        return true;
      } catch (err) {
        console.error('[Horizon GB] Load state error:', err);
        return false;
      }
    }

    // Battery SRAM auto-persistence
    saveBatterySram() {
      if (!this.module || !this.e || !this.currentRomInfo) return;
      try {
        const fileData = this.module._ext_ram_file_data_new(this.e);
        this.module._emulator_write_ext_ram(this.e, fileData);
        const ptr = this.module._get_file_data_ptr(fileData);
        const size = this.module._get_file_data_size(fileData);
        if (size > 0) {
          const ramBytes = new Uint8Array(new Uint8Array(this.module.HEAP8.buffer, ptr, size));
          localStorage.setItem(`gb_sram_${this.currentRomInfo.id || 'rom'}`, this.uint8ToBase64(ramBytes));
        }
        this.module._file_data_delete(fileData);
      } catch (e) {}
    }

    restoreBatterySram() {
      if (!this.module || !this.e || !this.currentRomInfo) return;
      try {
        const b64 = localStorage.getItem(`gb_sram_${this.currentRomInfo.id || 'rom'}`);
        if (!b64) return;
        const ramBytes = this.base64ToUint8(b64);
        const fileData = this.module._ext_ram_file_data_new(this.e);
        const ptr = this.module._get_file_data_ptr(fileData);
        const size = this.module._get_file_data_size(fileData);
        if (size === ramBytes.byteLength) {
          new Uint8Array(this.module.HEAP8.buffer, ptr, size).set(ramBytes);
          this.module._emulator_read_ext_ram(this.e, fileData);
          console.log('[Horizon GB] Restored battery SRAM save for:', this.currentRomInfo.title);
        }
        this.module._file_data_delete(fileData);
      } catch (e) {}
    }

    uint8ToBase64(bytes) {
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }

    base64ToUint8(base64) {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    }
  }

  // Export to window
  global.HorizonGameBoy = HorizonGameBoy;
  global.BUILTIN_ROMS = BUILTIN_ROMS;
  global.BUILTIN_PALETTES = BUILTIN_PALETTES;

})(typeof window !== 'undefined' ? window : this);
