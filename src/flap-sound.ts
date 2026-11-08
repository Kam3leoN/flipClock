/**
 * Solari flap click — flap_single.mp3 only.
 * Hard cap on concurrent voices: ~10 already sounds like a full board;
 * excess requests are dropped (no rain of 100 overlapping clicks).
 */

const CLICK_SRC = '/audio/flap_single.mp3';
/** Soft ceiling — beyond this, more clicks add noise not presence. */
const MAX_VOICES = 3;
const POOL_SIZE = MAX_VOICES;
/** Approximate click length — frees a voice slot after this. */
const CLICK_MS = 140;

let ready = false;
const clickPool: HTMLAudioElement[] = [];
let nextClick = 0;
let voicesPlaying = 0;
/** Pending clicks waiting for a free voice (capped). */
const queue: number[] = [];
const QUEUE_CAP = 3;
let drainTimer: ReturnType<typeof setTimeout> | null = null;

async function tryPlay(el: HTMLAudioElement): Promise<void> {
  try {
    await el.play();
  } catch {
    /* blocked until gesture — ignore */
  }
}

function releaseVoice(): void {
  voicesPlaying = Math.max(0, voicesPlaying - 1);
  scheduleDrain();
}

function scheduleDrain(): void {
  if (drainTimer != null) return;
  drainTimer = setTimeout(() => {
    drainTimer = null;
    drainQueue();
  }, 8);
}

function drainQueue(): void {
  while (queue.length > 0 && voicesPlaying < MAX_VOICES) {
    queue.shift();
    dispatchClick();
  }
}

function dispatchClick(): void {
  if (!ready || clickPool.length === 0) return;
  if (voicesPlaying >= MAX_VOICES) return;

  const player = clickPool[nextClick]!;
  nextClick = (nextClick + 1) % POOL_SIZE;
  voicesPlaying += 1;
  try {
    player.pause();
    player.currentTime = 0;
    player.volume = 0.65;
    void tryPlay(player);
  } catch {
    releaseVoice();
    return;
  }
  window.setTimeout(releaseVoice, CLICK_MS);
}

/** Preload click pool (idempotent). Does not play. */
export async function initFlapSound(): Promise<void> {
  if (ready) return;
  try {
    for (let i = 0; i < POOL_SIZE; i++) {
      const a = new Audio(CLICK_SRC);
      a.preload = 'auto';
      a.volume = 0.65;
      clickPool.push(a);
    }
    ready = true;
  } catch {
    /* audio non-critical */
  }
}

/** Call from a user gesture so subsequent plays succeed. */
export function unlockFlapSound(): void {
  void initFlapSound().then(() => {
    const sample = clickPool[0];
    if (!sample) return;
    sample.volume = 0.001;
    void tryPlay(sample).then(() => {
      sample.pause();
      sample.currentTime = 0;
      sample.volume = 0.65;
    });
  });
}

/**
 * Request one flap_single play.
 * If &lt; MAX_VOICES free → play now; else enqueue (cap QUEUE_CAP) or drop.
 */
export function playFlapClick(): void {
  if (!ready) {
    void initFlapSound().then(() => playFlapClick());
    return;
  }
  if (voicesPlaying < MAX_VOICES) {
    dispatchClick();
    return;
  }
  if (queue.length < QUEUE_CAP) {
    queue.push(1);
    scheduleDrain();
  }
  /* else drop — 10 voices already saturate perception */
}

/** Kept for call-site compatibility (activity no longer drives ambient). */
export function setFlapActivity(_active: number): void {
  /* no-op */
}

export function stopFlapSound(): void {
  queue.length = 0;
  voicesPlaying = 0;
  if (drainTimer != null) {
    clearTimeout(drainTimer);
    drainTimer = null;
  }
  for (const a of clickPool) {
    try {
      a.pause();
      a.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
}
