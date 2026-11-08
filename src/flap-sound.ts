/**
 * Solari flap click — only flap_single.mp3, one play per individual flap rotation.
 * Round-robin pool so concurrent flaps can overlap. Silent until AudioContext unlock.
 */

const CLICK_SRC = '/audio/flap_single.mp3';
/** Enough voices for staggered board cascades without cutting off mid-click. */
const POOL_SIZE = 32;

let ready = false;
const clickPool: HTMLAudioElement[] = [];
let nextClick = 0;

async function tryPlay(el: HTMLAudioElement): Promise<void> {
  try {
    await el.play();
  } catch {
    /* blocked until gesture — ignore */
  }
}

/** Preload click pool (idempotent). Does not play. */
export async function initFlapSound(): Promise<void> {
  if (ready) return;
  try {
    for (let i = 0; i < POOL_SIZE; i++) {
      const a = new Audio(CLICK_SRC);
      a.preload = 'auto';
      a.volume = 0.7;
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
      sample.volume = 0.7;
    });
  });
}

/** Play flap_single once for this flap's rotation step. */
export function playFlapClick(): void {
  if (!ready) {
    void initFlapSound().then(() => playFlapClick());
    return;
  }
  if (clickPool.length === 0) return;
  const player = clickPool[nextClick]!;
  nextClick = (nextClick + 1) % POOL_SIZE;
  try {
    player.pause();
    player.currentTime = 0;
    player.volume = 0.7;
    void tryPlay(player);
  } catch {
    /* ignore */
  }
}

/** No ambient loop — kept for call-site compatibility. */
export function setFlapActivity(_active: number): void {
  /* no-op: single clicks only */
}

export function stopFlapSound(): void {
  for (const a of clickPool) {
    try {
      a.pause();
      a.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
}
