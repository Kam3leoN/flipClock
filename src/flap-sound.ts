/**
 * Flap click via Howler.js — one flap_single.mp3 play per flap step.
 * Concurrent voices capped at 1 so each click stays clean (no pile-up).
 */
import { Howl } from 'howler';

const CLICK_SRC = '/audio/flap_single.mp3';
/** One audible click at a time — 1 flap → 1 son. */
const MAX_VOICES = 1;

let flap: Howl | null = null;
let ready = false;
let voicesPlaying = 0;

function ensureHowl(): Howl | null {
  if (flap) return flap;
  try {
    flap = new Howl({
      src: [CLICK_SRC],
      volume: 0.7,
      preload: true,
      html5: false,
      pool: 4,
    });
    ready = true;
    return flap;
  } catch {
    ready = false;
    return null;
  }
}

/** Preload Howl (idempotent). */
export async function initFlapSound(): Promise<void> {
  ensureHowl();
}

/** Unlock / warm AudioContext after a user gesture. */
export function unlockFlapSound(): void {
  const sound = ensureHowl();
  if (!sound) return;
  try {
    const id = sound.play();
    sound.mute(true, id);
    window.setTimeout(() => {
      sound.stop(id);
      sound.mute(false);
    }, 30);
  } catch {
    /* ignore */
  }
}

/** Play one flap_single for one flap rotation. Extra requests while busy are dropped. */
export function playFlapClick(): void {
  const sound = ensureHowl();
  if (!sound || !ready) return;
  if (voicesPlaying >= MAX_VOICES) return;

  voicesPlaying += 1;
  const id = sound.play();
  let released = false;
  const done = (): void => {
    if (released) return;
    released = true;
    voicesPlaying = Math.max(0, voicesPlaying - 1);
  };
  sound.once('end', done, id);
  sound.once('stop', done, id);
}

/** Call-site compatibility. */
export function setFlapActivity(_active: number): void {
  /* no-op */
}

export function stopFlapSound(): void {
  voicesPlaying = 0;
  flap?.stop();
}
