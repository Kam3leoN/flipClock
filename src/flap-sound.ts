/**
 * Density-aware Solari flap audio (same assets/mix idea as flip-flap-display).
 * Clicks = flap_single pool · ambient = looping flap_rain_loop.
 * Plays fail silently until the browser unlocks AudioContext on a user gesture.
 */

const CLICK_SRC = '/audio/flap_single.mp3';
const RAIN_SRC = '/audio/flap_rain_loop.mp3';
const POOL_SIZE = 4;
/** 8×24 board — density = activeFlips / capacity. */
const MAX_BOARD_CAPACITY = 192;

let ready = false;
let unlocked = false;
const clickPool: HTMLAudioElement[] = [];
let nextClick = 0;
let rain: HTMLAudioElement | null = null;
let activeUnits = 0;
let clickRequested = false;
let pulseTimer: ReturnType<typeof setInterval> | null = null;
let lastDensity = -1;
let lastVolume = -1;
let lastRate = -1;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

async function tryPlay(el: HTMLAudioElement): Promise<void> {
  try {
    await el.play();
    unlocked = true;
  } catch {
    /* blocked until gesture — ignore */
  }
}

/** Preload assets (idempotent). Does not play. */
export async function initFlapSound(): Promise<void> {
  if (ready) return;
  try {
    for (let i = 0; i < POOL_SIZE; i++) {
      const a = new Audio(CLICK_SRC);
      a.preload = 'auto';
      a.volume = 0.65;
      clickPool.push(a);
    }
    rain = new Audio(RAIN_SRC);
    rain.preload = 'auto';
    rain.loop = true;
    rain.volume = 0;
    ready = true;
    if (!pulseTimer) {
      pulseTimer = setInterval(() => {
        if (!clickRequested || !ready) return;
        clickRequested = false;
        dispatchClick();
      }, 50);
    }
  } catch {
    /* audio non-critical */
  }
}

/** Call from a user gesture so subsequent plays succeed. */
export function unlockFlapSound(): void {
  void initFlapSound().then(() => {
    if (!rain) return;
    const prev = rain.volume;
    rain.volume = 0;
    void tryPlay(rain).then(() => {
      if (!rain) return;
      rain.pause();
      rain.currentTime = 0;
      rain.volume = prev;
    });
    const sample = clickPool[0];
    if (sample) {
      sample.volume = 0.001;
      void tryPlay(sample).then(() => {
        sample.pause();
        sample.currentTime = 0;
        sample.volume = 0.65;
      });
    }
  });
}

function dispatchClick(): void {
  if (!ready || clickPool.length === 0) return;
  const density = clamp(activeUnits / MAX_BOARD_CAPACITY, 0, 1);
  const vol = 0.65 * Math.pow(1 - density * 0.4, 1.5);
  const player = clickPool[nextClick]!;
  nextClick = (nextClick + 1) % POOL_SIZE;
  try {
    player.pause();
    player.currentTime = 0;
    player.volume = clamp(vol, 0.01, 1);
    void tryPlay(player);
  } catch {
    /* ignore */
  }
}

/** Request a throttled click (20 Hz pulse). */
export function playFlapClick(): void {
  if (!ready) void initFlapSound();
  clickRequested = true;
}

/**
 * Report how many flaps are still flipping on the board.
 * When 0 → rain mutes/stops immediately.
 */
export function setFlapActivity(active: number): void {
  if (!ready) void initFlapSound();
  activeUnits = Math.max(0, Math.floor(active));
  updateAmbientMix();
}

function updateAmbientMix(): void {
  if (!ready || !rain) return;
  const density = clamp(activeUnits / MAX_BOARD_CAPACITY, 0, 1);

  if (activeUnits === 0) {
    lastDensity = 0;
    lastVolume = 0;
    rain.volume = 0;
    try {
      rain.pause();
      rain.currentTime = 0;
    } catch {
      /* ignore */
    }
    return;
  }

  const significant = Math.abs(density - lastDensity) > 0.05;
  lastDensity = density;

  const loopVol = clamp(Math.pow(density, 0.45) * 0.7 + 0.05, 0, 1);
  const speed = clamp(1 + density * 0.3, 0.5, 2);

  if (rain.paused && unlocked) {
    void tryPlay(rain);
  } else if (rain.paused) {
    void tryPlay(rain);
  }

  if (Math.abs(loopVol - lastVolume) > 0.02 || significant) {
    lastVolume = loopVol;
    rain.volume = loopVol;
  }
  if (Math.abs(speed - lastRate) > 0.05) {
    lastRate = speed;
    try {
      rain.playbackRate = speed;
    } catch {
      /* ignore */
    }
  }
}

export function stopFlapSound(): void {
  activeUnits = 0;
  clickRequested = false;
  updateAmbientMix();
}
