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
      id: 'tetris',
      title: 'Tetris (1989)',
      file: 'roms/Tetris.gb',
      developer: 'Nintendo',
      year: '1989',
      genre: 'Puzzle / All-Time Classic',
      description: 'The defining pack-in masterpiece that conquered the world. Stack falling tetrominoes, clear lines, and groove to the iconic Korobeiniki Type-A chiptune.',
      color: '#38bdf8',
      icon: '🧱'
    },
    {
      id: 'supermarioland',
      title: 'Super Mario Land',
      file: 'roms/SuperMarioLand.gb',
      developer: 'Nintendo (Gunpei Yokoi)',
      year: '1989',
      genre: 'Action Platformer',
      description: 'The legendary launch platformer. Guide Mario across Sarasaland to rescue Princess Daisy from Tatanga, piloting submarines and airplanes.',
      color: '#ef4444',
      icon: '🍄'
    },
    {
      id: 'supermarioland2',
      title: 'Super Mario Land 2: 6 Golden Coins',
      file: 'roms/SuperMarioLand2.gb',
      developer: 'Nintendo',
      year: '1992',
      genre: 'Platformer',
      description: 'The massive Mario sequel introducing Wario! Explore 6 expansive themed worlds, obtain the Carrot power-up to glide with bunny ears, and reclaim Mario’s castle.',
      color: '#f59e0b',
      icon: '⭐'
    },
    {
      id: 'zelda',
      title: "The Legend of Zelda: Link's Awakening",
      file: 'roms/ZeldaLinksAwakening.gb',
      developer: 'Nintendo',
      year: '1993',
      genre: 'Action Adventure RPG',
      description: 'One of the greatest Zelda adventures of all time. Shipwrecked on enigmatic Koholint Island, Link must gather the eight Siren Instruments to awaken the Wind Fish.',
      color: '#10b981',
      icon: '🗡️'
    },
    {
      id: 'pokemonred',
      title: 'Pokémon Red Version',
      file: 'roms/PokemonRed.gb',
      developer: 'Game Freak / Nintendo',
      year: '1998',
      genre: 'RPG / Monster Battler',
      description: 'The global phenomenon. Begin your journey in Pallet Town, choose Charmander, Squirtle, or Bulbasaur, conquer the 8 Gym Leaders, and catch all 151 Pokémon.',
      color: '#dc2626',
      icon: '🔴'
    },
    {
      id: 'pokemonyellow',
      title: 'Pokémon Yellow: Pikachu Edition',
      file: 'roms/PokemonYellow.gb',
      developer: 'Game Freak / Nintendo',
      year: '1998',
      genre: 'RPG / Special Edition',
      description: 'Anime-faithful edition featuring Pikachu following your footsteps, Jessie & James encounters, and all three Kanto starters obtainable.',
      color: '#eab308',
      icon: '⚡'
    },
    {
      id: 'kirby',
      title: "Kirby's Dream Land",
      file: 'roms/KirbysDreamLand.gb',
      developer: 'HAL Laboratory / Sakurai',
      year: '1992',
      genre: 'Action Platformer',
      description: 'The iconic debut of Kirby! Inhale enemies, puff up to float through Dream Land, defeat Whispy Woods, and recover the stolen food from King Dedede.',
      color: '#ec4899',
      icon: '🌟'
    },
    {
      id: 'donkeykong94',
      title: "Donkey Kong '94",
      file: 'roms/DonkeyKong94.gb',
      developer: 'Nintendo',
      year: '1994',
      genre: 'Puzzle Platformer',
      description: 'Universal critical acclaim! Starts like the classic arcade game before expanding into 101 puzzle-platforming stages with backflips and handstands.',
      color: '#d97706',
      icon: '🦍'
    },
    {
      id: 'metroid2',
      title: 'Metroid II: Return of Samus',
      file: 'roms/Metroid2.gb',
      developer: 'Nintendo',
      year: '1991',
      genre: 'Sci-Fi Action Adventure',
      description: 'Samus Aran descends into the subterranean depths of planet SR388 to eradicate the Metroid species before Space Pirates weaponize them.',
      color: '#06b6d4',
      icon: '🛸'
    },
    {
      id: 'warioland',
      title: 'Wario Land: Super Mario Land 3',
      file: 'roms/WarioLand.gb',
      developer: 'Nintendo',
      year: '1994',
      genre: 'Platformer',
      description: 'Wario’s debut as a protagonist! Body-slam enemies, don the Bull, Jet, and Dragon pots, and loot Kitchen Island for pirate treasure.',
      color: '#84cc16',
      icon: '💰'
    },
    {
      id: 'megaman',
      title: 'Mega Man: Dr. Wily’s Revenge',
      file: 'roms/MegaMan.gb',
      developer: 'Capcom',
      year: '1991',
      genre: 'Action Run & Gun',
      description: 'The Blue Bomber’s portable debut. Blast through Cut Man, Elec Man, Ice Man, and Fire Man, steal their powers, and defeat Enker.',
      color: '#2563eb',
      icon: '🤖'
    },
    {
      id: 'castlevania2',
      title: 'Castlevania II: Belmont’s Revenge',
      file: 'roms/Castlevania2.gb',
      developer: 'Konami',
      year: '1991',
      genre: 'Gothic Action Platformer',
      description: 'Acclaimed action sequel with legendary chiptunes. Christopher Belmont brandishes the holy whip across 4 castle towers to rescue his son Soleil from Dracula.',
      color: '#7c3aed',
      icon: '🏰'
    },
    {
      id: 'pacman',
      title: 'Pac-Man',
      file: 'roms/PacMan.gb',
      developer: 'Namco',
      year: '1990',
      genre: 'Arcade Classic',
      description: 'The authentic portable port of the arcade legend. Chomp power pellets, outwit Inky, Blinky, Pinky, and Clyde, and clear mazes.',
      color: '#fbbf24',
      icon: '🟡'
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
      this.joypadBufferPtr = null;
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

      // Hook joypad input buffer
      this.joypadBufferPtr = this.module._joypad_new();
      this.module._emulator_set_default_joypad_callback(this.e, this.joypadBufferPtr);

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
      while (true) {
        const event = this.module._emulator_run_until_f64(this.e, untilTicks);

        if (event & EVENT_AUDIO_BUFFER_FULL) {
          this.pushAudioBuffer();
        }

        if (event & EVENT_UNTIL_TICKS) {
          break;
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

      if (this.module && this.joypadBufferPtr) {
        this.module._joypad_delete(this.joypadBufferPtr);
        this.joypadBufferPtr = null;
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
