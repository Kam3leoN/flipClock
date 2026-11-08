/**
 * FlipFlap clock — animation powered by vendored PQINA Flip / Tick
 * (https://github.com/pqina/flip · https://pqina.nl/flip/).
 */
import '../vendor/pqina-flip/flip.css';
import '../vendor/pqina-flip/flip.min.js';

export type TimeFormat = 0 | 1 | 2;
export type DigitMode = 1 | 2;

type TickHandle = TickInstance;

let tick: TickHandle | null = null;
let host: HTMLElement | null = null;
let timer: TickTimer | null = null;
let timeFormat: TimeFormat = 0;
let digitMode: DigitMode = 2;
let showFlaps = true;
let painted = false;

function formatHour(format: TimeFormat, hour: number): string {
  if (format === 0) {
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return String(h12);
  }
  if (format === 1) return hour < 10 ? `0${hour}` : String(hour);
  return String(hour);
}

function formatMinute(minute: number): string {
  return minute < 10 ? `0${minute}` : String(minute);
}

function clockPayload(now = new Date()): { hours: string; minutes: string } {
  return {
    hours: formatHour(timeFormat, now.getHours()),
    minutes: formatMinute(now.getMinutes()),
  };
}

function hoursTransform(): string {
  /* pad only for 00–23 mode; 12h / 0–23 keep natural width then optional split */
  if (digitMode === 1) {
    return timeFormat === 1 ? 'pad(00) -> split' : 'split';
  }
  return timeFormat === 1 ? 'pad(00)' : '';
}

function minutesTransform(): string {
  return digitMode === 1 ? 'pad(00) -> split' : 'pad(00)';
}

function markup(): string {
  const hTx = hoursTransform();
  const mTx = minutesTransform();
  const hAttr = hTx ? ` data-transform="${hTx}"` : '';
  const mAttr = mTx ? ` data-transform="${mTx}"` : '';
  return `<div class="tick flipflap-clock" data-credits="false" aria-hidden="true">
  <div data-layout="horizontal fit" class="flipflap-clock-row">
    <span data-key="hours" class="flipflap-unit"${hAttr} data-view="flip" data-style="rounded:panels"></span>
    <span data-key="minutes" class="flipflap-unit"${mAttr} data-view="flip" data-style="rounded:panels"></span>
  </div>
</div>`;
}

function syncFlapsClass(): void {
  host?.classList.toggle('flipflap-clock--plain', !showFlaps);
  /* `.single` = 2 volets (HH + MM) ; sinon 1 chiffre / volet */
  host?.classList.toggle('single', digitMode === 2);
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
  tick = window.Tick.DOM.create(root, {
    credits: false,
    value: clockPayload(),
  });
  painted = true;
  timer = window.Tick.helper.interval(() => {
    if (!tick) return;
    tick.value = clockPayload();
  }, 1000);
}

/** Build / rebuild the PQINA flip clock into `#main-content-area`. */
export function buildClock(opts: {
  timeFormat: TimeFormat;
  digitMode: DigitMode;
  showFlaps: boolean;
}): void {
  timeFormat = opts.timeFormat;
  digitMode = opts.digitMode;
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

export function setClockDigitMode(next: DigitMode): void {
  if (digitMode === next) return;
  digitMode = next;
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
  tick.value = clockPayload();
}

export function isClockReady(): boolean {
  return painted && Boolean(tick);
}
