/**
 * FlipFlap clock — animation powered by vendored PQINA Flip / Tick
 * (https://github.com/pqina/flip · https://pqina.nl/flip/).
 * Always 1 digit per flap (4 flaps: H H · M M) — avoids split→array comma bug.
 */
import '../vendor/pqina-flip/flip.css';
import '../vendor/pqina-flip/flip.min.js';
import { initFlapSound, playFlapClick } from './flap-sound';

export type TimeFormat = 0 | 1 | 2;

type TickHandle = TickInstance;
type ClockPayload = { h0: string; h1: string; m0: string; m1: string };

let tick: TickHandle | null = null;
let host: HTMLElement | null = null;
let timer: TickTimer | null = null;
let timeFormat: TimeFormat = 0;
let showFlaps = true;
let painted = false;
let lastPayload: ClockPayload | null = null;

function formatHour(format: TimeFormat, hour: number): string {
  if (format === 0) {
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return String(h12).padStart(2, '0');
  }
  if (format === 1) return hour < 10 ? `0${hour}` : String(hour);
  return String(hour).padStart(2, '0');
}

function formatMinute(minute: number): string {
  return minute < 10 ? `0${minute}` : String(minute);
}

/** Four single-character keys — never pass multi-digit strings to one flip view. */
function clockPayload(now = new Date()): ClockPayload {
  const hh = formatHour(timeFormat, now.getHours());
  const mm = formatMinute(now.getMinutes());
  return {
    h0: hh[0] ?? '0',
    h1: hh[1] ?? '0',
    m0: mm[0] ?? '0',
    m1: mm[1] ?? '0',
  };
}

function playClockFlips(prev: ClockPayload | null, next: ClockPayload): void {
  if (!prev) return;
  const keys: (keyof ClockPayload)[] = ['h0', 'h1', 'm0', 'm1'];
  for (const key of keys) {
    if (prev[key] !== next[key]) playFlapClick();
  }
}

function markup(): string {
  return `<div class="tick flipflap-clock" data-credits="false" aria-hidden="true">
  <div data-layout="horizontal fit" class="flipflap-clock-row">
    <span class="flipflap-unit">
      <span data-key="h0" data-view="flip" data-style="rounded:panels"></span>
      <span data-key="h1" data-view="flip" data-style="rounded:panels"></span>
    </span>
    <span class="flipflap-unit">
      <span data-key="m0" data-view="flip" data-style="rounded:panels"></span>
      <span data-key="m1" data-view="flip" data-style="rounded:panels"></span>
    </span>
  </div>
</div>`;
}

function syncFlapsClass(): void {
  host?.classList.toggle('flipflap-clock--plain', !showFlaps);
}

function destroyTick(): void {
  timer?.stop?.();
  timer = null;
  if (tick?.root) {
    try {
      window.Tick.DOM.destroy(tick.root);
    } catch {
      /* already gone */
    }
  }
  tick = null;
  painted = false;
}

function mountTick(): void {
  if (!host) return;
  destroyTick();
  host.innerHTML = markup();
  syncFlapsClass();
  const root = host.querySelector<HTMLElement>('.tick');
  if (!root || !window.Tick?.DOM) return;
  const initial = clockPayload();
  lastPayload = initial;
  tick = window.Tick.DOM.create(root, {
    credits: false,
    value: initial,
  });
  painted = true;
  void initFlapSound();
  timer = window.Tick.helper.interval(() => {
    if (!tick) return;
    const next = clockPayload();
    playClockFlips(lastPayload, next);
    lastPayload = next;
    tick.value = next;
  }, 1000);
}

/** Build / rebuild the PQINA flip clock into `#main-content-area`. */
export function buildClock(opts: { timeFormat: TimeFormat; showFlaps: boolean }): void {
  timeFormat = opts.timeFormat;
  showFlaps = opts.showFlaps;
  host = document.getElementById('main-content-area');
  if (!host) return;
  mountTick();
}

export function setClockTimeFormat(next: TimeFormat): void {
  if (timeFormat === next) return;
  timeFormat = next;
  mountTick();
}

export function setClockShowFlaps(next: boolean): void {
  showFlaps = next;
  syncFlapsClass();
}

/** Force a paint (e.g. after theme) without full rebuild. */
export function refreshClock(): void {
  if (!tick) {
    mountTick();
    return;
  }
  const next = clockPayload();
  lastPayload = next;
  tick.value = next;
}

export function isClockReady(): boolean {
  return painted && Boolean(tick);
}
