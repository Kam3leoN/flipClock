import './styles.scss';

/** Time format: 0 = 12h AM/PM, 1 = 00–23, 2 = 0–23 */
type TimeFormat = 0 | 1 | 2;

interface SettingsPatch {
  tf?: TimeFormat | string;
  sb?: boolean;
  anm?: boolean;
  br?: number | string;
  sc?: number | string;
}

interface FlipDetail {
  h: boolean;
  m: boolean;
}

const SCALE_MAX = 100;
const SCALE_MIN = 50;
const BRIGHTNESS_MAX = 100;
const BRIGHTNESS_MIN = 50;
const TICK_MS = 250;
const HOVER_HIDE_MS = 3000;
const IS_FLIP_TEST = false;

const TF_LABELS = ['12', '00', '0'] as const;

let displayedHour: number | undefined;
let displayedMinute: string | undefined;
let timeFormat: TimeFormat = 0;
let displayedTimeFormat: TimeFormat = 0;
let showFlaps = true;
let scale = SCALE_MAX;
let orientationScale = 1;
let brightness = BRIGHTNESS_MAX;
let hoverTimer: ReturnType<typeof setTimeout> | null = null;

function setStorage(key: string, value: string | number | boolean): void {
  localStorage.setItem(key, String(value));
}

function getStorage(key: string): string | null {
  return localStorage.getItem(key);
}

function parseTimeFormat(raw: string | number): TimeFormat {
  const n = Number(raw);
  if (n === 1 || n === 2) return n;
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Digit “1” needs a slight indent in 12h / sparse 24h modes. */
function isOneDigit(format: TimeFormat, hour: number): boolean {
  return (
    (format === 0 && hour === 1) ||
    (format === 0 && hour === 13) ||
    (format === 2 && hour === 1)
  );
}

/** Digit ending in 1 (11, 21, …) — wider glyph kerning. */
function isElevenFamily(format: TimeFormat, hour: number): boolean {
  return (
    hour === 11 ||
    (format === 0 && hour === 23) ||
    (format === 1 && hour === 1) ||
    (format >= 1 && hour !== 1 && hour % 10 === 1)
  );
}

function isJustElevenHour(format: TimeFormat, hour: number): boolean {
  return hour === 11 || (format === 0 && hour === 23);
}

function minuteEndsWithOne(minute: string | number): boolean {
  return Number(minute) % 10 === 1;
}

function isMinuteEleven(minute: string | number): boolean {
  return Number(minute) === 11;
}

function formatHour(format: TimeFormat, hour: number): string | number {
  if (format === 0 && (hour === 0 || hour >= 13)) {
    return Math.abs(hour - 12);
  }
  if (format === 1 && hour < 10) {
    return `0${hour}`;
  }
  return hour;
}

function formatMinute(minute: number): string {
  return minute < 10 ? `0${minute}` : String(minute);
}

function requireEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

function dispatchBody(name: string, detail?: unknown): void {
  document.body.dispatchEvent(
    new CustomEvent(name, detail === undefined ? undefined : { detail }),
  );
}

function applyHourClasses(
  el: Element,
  format: TimeFormat,
  hour: number,
): void {
  el.classList.toggle('tf0', format === 0);
  el.classList.toggle('pm', format === 0 && hour >= 12);
  el.classList.toggle('one', isOneDigit(format, hour));
  el.classList.toggle('eleven', isElevenFamily(format, hour));
  el.classList.toggle('justeleven', isJustElevenHour(format, hour));
}

function applyMinuteClasses(el: Element, minute: string): void {
  el.classList.toggle('eleven', minuteEndsWithOne(minute));
  el.classList.toggle('justeleven', isMinuteEleven(minute));
}

function setFlipText(el: Element, text: string | number): void {
  const span = el.querySelector('span');
  if (span) span.textContent = String(text);
}

function updateSettings(patch: SettingsPatch): void {
  if (Object.prototype.hasOwnProperty.call(patch, 'tf') && patch.tf !== undefined) {
    const next = parseTimeFormat(patch.tf);
    if (timeFormat !== next) {
      // Match original: skip immediate dsptf sync when switching 24h↔24h at hour ≥ 10.
      const syncDisplayedFormat = !(
        next > 0 &&
        timeFormat > 0 &&
        (displayedHour ?? 0) >= 10
      );
      timeFormat = next;
      setStorage('tf', timeFormat);

      if (
        syncDisplayedFormat &&
        timeFormat !== displayedTimeFormat &&
        document.body.classList.contains('hlock')
      ) {
        dispatchBody('_updateFlips', { h: true, m: false } satisfies FlipDetail);
      } else if (!syncDisplayedFormat) {
        displayedTimeFormat = timeFormat;
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'sb') && patch.sb !== undefined) {
    if (showFlaps !== patch.sb) {
      showFlaps = patch.sb;
      setStorage('bg', showFlaps);
      requireEl('main-content-area').classList.toggle('dark', !showFlaps);
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'anm') && patch.anm !== undefined) {
    requireEl('main-content-area').classList.toggle('fade', patch.anm);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'br') && patch.br !== undefined) {
    const next = Number(patch.br);
    if (brightness !== next) {
      brightness = next;
      setStorage('br', brightness);
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'sc') && patch.sc !== undefined) {
    const next = Number(patch.sc);
    if (scale !== next) {
      scale = next;
      setStorage('sc', scale);
    }
  }
}

async function initView(): Promise<void> {
  const storedTf = getStorage('tf');
  if (storedTf === null || Number.isNaN(Number(storedTf))) {
    setStorage('tf', timeFormat);
  } else {
    timeFormat = parseTimeFormat(storedTf);
  }

  const tfSelect = document.getElementById('tf') as HTMLSelectElement | null;
  if (tfSelect) {
    tfSelect.value = String(timeFormat);
    document
      .getElementById('tf-container')
      ?.dispatchEvent(new CustomEvent('_change'));
  }

  const storedBg = getStorage('bg');
  if (storedBg === null) {
    setStorage('bg', showFlaps);
  } else {
    showFlaps = String(storedBg).toLowerCase() === 'true';
  }

  const bgCheckbox = document.getElementById('bg') as HTMLInputElement | null;
  if (bgCheckbox && showFlaps) bgCheckbox.checked = true;
  requireEl('main-content-area').classList.toggle('dark', !showFlaps);

  const storedBr = getStorage('br');
  if (storedBr === null || Number.isNaN(Number(storedBr))) {
    setStorage('br', brightness);
  } else {
    const parsed = Number(storedBr);
    const clamped = clamp(parsed, BRIGHTNESS_MIN, BRIGHTNESS_MAX);
    brightness = clamped;
    if (clamped !== parsed) setStorage('br', brightness);
  }
  dispatchBody('_updateBrightness', { value: brightness });

  const storedSc = getStorage('sc');
  if (storedSc === null || Number.isNaN(Number(storedSc))) {
    setStorage('sc', scale);
  } else {
    const parsed = Number(storedSc);
    const clamped = clamp(parsed, SCALE_MIN, SCALE_MAX);
    scale = clamped;
    if (clamped !== parsed) setStorage('sc', scale);
  }
  dispatchBody('_updateScale', { value: scale });

  window.focus();
  document.body.classList.add('willchange');
  dispatchBody('_updateTime');
  setInterval(() => dispatchBody('_updateTime'), TICK_MS);
  document.getElementById('loader')?.classList.add('remove');
}

function setHoverTimer(): void {
  if (hoverTimer) clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    if (!document.body.classList.contains('pause')) {
      document.body.classList.remove('hover');
    }
  }, HOVER_HIDE_MS);
}

function clearHoverTimer(): void {
  if (hoverTimer) clearTimeout(hoverTimer);
  if (!document.body.classList.contains('pause')) {
    document.body.classList.remove('hover');
  }
}

function mountSettingsUi(): void {
  const main = requireEl('main');
  main.insertAdjacentHTML(
    'beforebegin',
    `<div id="settings"><dl>
      <dt>Hour Format</dt>
      <dd title="Hour Format"><label id="tf-container">
        <select id="tf" tabindex="-1">
          <option value="0"${timeFormat === 0 ? ' selected' : ''}>&nbsp;1-12 AM/PM&nbsp;</option>
          <option value="1"${timeFormat === 1 ? ' selected' : ''}>&nbsp;00-23&nbsp;</option>
          <option value="2"${timeFormat === 2 ? ' selected' : ''}>&nbsp;0-23&nbsp;</option>
        </select>
      </label></dd>
      <dt>Show</dt>
      <dd title="Show Flaps" id="bg-container">
        <input id="bg" type="checkbox" tabindex="-1" />
        <label for="bg">Show Flaps</label>
      </dd>
      <dt>Scale</dt>
      <dd title="Scale"><label id="scale-container">
        <input id="scale" type="range" min="${SCALE_MIN}" max="${SCALE_MAX}" value="${scale}" step="0.1" tabindex="-1" />
      </label></dd>
      <dt>Brightness</dt>
      <dd title="Brightness"><label id="brightness-container">
        <input id="brightness" type="range" min="${BRIGHTNESS_MIN}" max="${BRIGHTNESS_MAX}" value="${brightness}" step="0.1" tabindex="-1" />
      </label></dd>
    </dl></div>`,
  );

  const settings = requireEl('settings');
  for (const type of ['mouseenter', 'mousemove', 'click'] as const) {
    settings.addEventListener(type, (event) => {
      event.stopPropagation();
      document.body.classList.add('pause');
    });
  }
  settings.addEventListener('mouseleave', (event) => {
    event.stopPropagation();
    document.body.classList.remove('pause');
  });

  const tfSelect = requireEl<HTMLSelectElement>('tf');
  const tfContainer = requireEl('tf-container');

  tfSelect.addEventListener('change', (event) => {
    const target = event.target as HTMLSelectElement;
    updateSettings({ tf: target.value });
    tfContainer.dispatchEvent(new CustomEvent('_change'));
    target.blur();
  });
  tfSelect.addEventListener('keyup', (event) => {
    if (event.key === 'Escape' || event.key === 'Enter') {
      (event.target as HTMLSelectElement).blur();
    }
  });

  tfContainer.dataset.disp = JSON.stringify([...TF_LABELS]);
  tfContainer.addEventListener('_change', function onTfChange(this: HTMLElement) {
    const labels = JSON.parse(this.dataset.disp ?? '[]') as string[];
    this.setAttribute('data-tf', labels[timeFormat] ?? '12');
  });

  requireEl<HTMLInputElement>('bg').addEventListener('change', (event) => {
    updateSettings({
      sb: (event.target as HTMLInputElement).checked,
      anm: true,
    });
  });

  requireEl<HTMLInputElement>('scale').addEventListener('input', (event) => {
    dispatchBody('_updateScale', {
      value: (event.target as HTMLInputElement).value,
    });
  });
  requireEl<HTMLInputElement>('scale').addEventListener('change', (event) => {
    updateSettings({ sc: (event.target as HTMLInputElement).value });
  });

  requireEl<HTMLInputElement>('brightness').addEventListener('input', (event) => {
    dispatchBody('_updateBrightness', {
      value: (event.target as HTMLInputElement).value,
    });
  });
  requireEl<HTMLInputElement>('brightness').addEventListener('change', (event) => {
    updateSettings({ br: (event.target as HTMLInputElement).value });
  });
}

function prepareFlipNodes(): void {
  document.querySelectorAll('.flip').forEach((node) => {
    const clone = node.cloneNode(true) as HTMLElement;
    clone.classList.add('clone');
    node.closest('.flips')?.appendChild(clone);
  });

  document.querySelectorAll('.flip').forEach((node) => {
    const el = node as HTMLElement;
    const hm = el.classList.contains('hur') ? 'hur' : 'min';
    const half = el.classList.contains('top') ? 'top' : 'bottom';
    const kind = el.classList.contains('clone') ? 'clone' : 'org';
    el.dataset.hm = hm;
    el.id = `${hm}-${half}-${kind}`;
    el.appendChild(document.createElement('span'));
  });
}

function bindScaleAndBrightness(): void {
  document.body.addEventListener('_updateScale', ((event: CustomEvent<{ value?: number | string }>) => {
    const raw = event.detail?.value;
    const value =
      raw == null || Number.isNaN(Number(raw))
        ? scale
        : clamp(Number(raw), SCALE_MIN, SCALE_MAX);
    const slider = document.getElementById('scale') as HTMLInputElement | null;
    if (slider && slider.value !== String(value)) slider.value = String(value);
    requireEl('main').style.transform = `scale(${(value / 100) * orientationScale})`;
  }) as EventListener);

  document.body.addEventListener('_updateBrightness', ((event: CustomEvent<{ value?: number | string }>) => {
    const raw = event.detail?.value;
    const value =
      raw == null || Number.isNaN(Number(raw))
        ? brightness
        : clamp(Number(raw), BRIGHTNESS_MIN, BRIGHTNESS_MAX);
    const slider = document.getElementById('brightness') as HTMLInputElement | null;
    if (slider && slider.value !== String(value)) slider.value = String(value);
    requireEl('main-content-area').style.filter = `brightness(${value}%)`;
  }) as EventListener);
}

function bindResize(): void {
  window.addEventListener('_resize', () => {
    const width = document.body.clientWidth;
    const height = document.body.clientHeight;
    const portrait = width < height;
    const longest = Math.max(width, height);
    const shortest = Math.min(width, height);
    const content = requireEl('main-content');
    const contentW = content.clientWidth;
    const contentH = content.clientHeight;
    const next =
      Math.min(shortest / Math.min(contentW, contentH), longest / Math.max(contentW, contentH));

    document.body.classList.toggle('portrait', portrait);
    if (orientationScale !== next) {
      orientationScale = next;
      dispatchBody('_updateScale', { value: scale });
    }
  });

  window.addEventListener('resize', () => {
    window.dispatchEvent(new CustomEvent('_resize'));
  });
  window.dispatchEvent(new CustomEvent('_resize'));
}

function bindClock(): void {
  document.body.addEventListener('_updateTime', () => {
    const now = new Date();
    const hour = now.getHours();
    let minute = IS_FLIP_TEST ? now.getSeconds() : now.getMinutes();
    const seconds = now.getSeconds();
    const minuteText = formatMinute(minute);

    if (displayedHour == null || displayedMinute == null) {
      requireEl('main-content-area').classList.add('stop');
      document.querySelectorAll('.flip').forEach((el) => {
        el.classList.remove('transform', 'fadein', 'fadeout1', 'fadeout2');
      });

      document.querySelectorAll('.flip.hur').forEach((el) => {
        applyHourClasses(el, timeFormat, hour);
        setFlipText(el, formatHour(timeFormat, hour));
      });
      document.querySelectorAll('.flip.min').forEach((el) => {
        applyMinuteClasses(el, minuteText);
        setFlipText(el, minuteText);
      });

      displayedHour = hour;
      displayedMinute = minuteText;
      displayedTimeFormat = timeFormat;
      document.body.classList.remove('hlock', 'mlock');
      return;
    }

    if (hour !== displayedHour || minuteText !== displayedMinute || timeFormat !== displayedTimeFormat) {
      if (seconds === 59 && document.body.classList.contains('willchange')) {
        document.body.classList.add('willchange');
      }

      const minuteChanged =
        minuteText !== displayedMinute && !document.body.classList.contains('mlock');
      if (minuteChanged) displayedMinute = minuteText;

      const hourChanged =
        hour !== displayedHour && !document.body.classList.contains('hlock');
      if (hourChanged) displayedHour = hour;

      const formatChanged =
        timeFormat !== displayedTimeFormat && !document.body.classList.contains('hlock');

      if (minuteChanged || hourChanged || formatChanged) {
        dispatchBody('_updateFlips', {
          h: Boolean(hourChanged || formatChanged),
          m: minuteChanged,
        } satisfies FlipDetail);
      }
      return;
    }

    if (
      !document.body.classList.contains('hlock') &&
      !document.body.classList.contains('mlock') &&
      document.body.classList.contains('willchange') &&
      seconds !== 59
    ) {
      document.body.classList.remove('willchange');
    }
  });

  document.body.addEventListener('_updateFlips', ((event: CustomEvent<FlipDetail>) => {
    requireEl('main-content-area').classList.remove('stop');
    const { h, m } = event.detail;

    if (h) {
      displayedTimeFormat = timeFormat;
      requireEl('hur-top-clone').classList.add('act', 'transform');

      const topOrg = requireEl('hur-top-org');
      applyHourClasses(topOrg, displayedTimeFormat, displayedHour!);
      setFlipText(topOrg, formatHour(displayedTimeFormat, displayedHour!));
      topOrg.classList.add('fadein');

      const bottomClone = requireEl('hur-bottom-clone');
      applyHourClasses(bottomClone, displayedTimeFormat, displayedHour!);
      setFlipText(bottomClone, formatHour(displayedTimeFormat, displayedHour!));
      requireEl('hur-bottom-org').classList.add('fadeout1');
    }

    if (m) {
      requireEl('min-top-clone').classList.add('act', 'transform');

      const topOrg = requireEl('min-top-org');
      applyMinuteClasses(topOrg, displayedMinute!);
      setFlipText(topOrg, displayedMinute!);
      topOrg.classList.add('fadein');

      const bottomClone = requireEl('min-bottom-clone');
      applyMinuteClasses(bottomClone, displayedMinute!);
      setFlipText(bottomClone, displayedMinute!);
      requireEl('min-bottom-org').classList.add('fadeout1');
    }
  }) as EventListener);

  document.querySelectorAll('#hur-top-clone, #min-top-clone').forEach((node) => {
    node.addEventListener('animationstart', function onTopStart(this: HTMLElement) {
      const hm = this.dataset.hm;
      if (hm === 'hur') document.body.classList.add('hlock');
      else if (hm === 'min') document.body.classList.add('mlock');
    });

    node.addEventListener('animationend', function onTopEnd(this: HTMLElement) {
      const hm = this.dataset.hm!;
      this.classList.remove('act', 'transform');

      if (hm === 'hur') {
        setFlipText(this, formatHour(displayedTimeFormat, displayedHour!));
        applyHourClasses(this, displayedTimeFormat, displayedHour!);
      } else {
        setFlipText(this, displayedMinute!);
        applyMinuteClasses(this, displayedMinute!);
      }

      requireEl(`${hm}-bottom-clone`).classList.add('act', 'transform');
    });
  });

  document.querySelectorAll('#hur-top-org, #min-top-org').forEach((node) => {
    node.addEventListener('animationend', function onTopOrgEnd(this: HTMLElement) {
      this.classList.add('fadein');
    });
  });

  document.querySelectorAll('#hur-bottom-clone, #min-bottom-clone').forEach((node) => {
    node.addEventListener('animationend', function onBottomCloneEnd(this: HTMLElement) {
      const hm = this.dataset.hm!;
      this.classList.remove('act', 'transform');

      const bottomOrg = requireEl(`${hm}-bottom-org`);
      if (hm === 'hur') {
        applyHourClasses(bottomOrg, displayedTimeFormat, displayedHour!);
        setFlipText(bottomOrg, formatHour(displayedTimeFormat, displayedHour!));
        document.body.classList.remove('hlock');
      } else {
        applyMinuteClasses(bottomOrg, displayedMinute!);
        setFlipText(bottomOrg, displayedMinute!);
        document.body.classList.remove('mlock');
        if (document.body.classList.contains('willchange')) {
          document.body.classList.remove('willchange');
        }
      }
    });
  });

  document.querySelectorAll('#hur-bottom-org, #min-bottom-org').forEach((node) => {
    node.addEventListener('animationend', function onBottomOrgEnd(this: HTMLElement) {
      if (this.classList.contains('fadeout1')) {
        this.classList.remove('fadeout1');
        this.classList.add('fadeout2');
      } else {
        this.classList.remove('fadeout2');
      }
    });
  });
}

function bindHoverChrome(): void {
  document.body.addEventListener('mousemove', () => {
    document.body.classList.remove('pause');
    document.body.classList.add('hover');
    setHoverTimer();
  });
  document.body.addEventListener('mouseleave', () => {
    document.body.classList.remove('pause');
    clearHoverTimer();
  });
  window.addEventListener('blur', () => {
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.classList.remove('pause');
    setHoverTimer();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  mountSettingsUi();
  void initView();
  bindHoverChrome();
  bindScaleAndBrightness();

  requireEl('loader').addEventListener(
    'transitionend',
    function onLoaderGone(this: HTMLElement) {
      this.remove();
    },
    { once: true },
  );

  prepareFlipNodes();
  bindResize();
  bindClock();
});
