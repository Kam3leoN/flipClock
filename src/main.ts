import 'k3ui/k3ui.css';
import 'k3ui/fonts-ui.css';
import './styles.scss';
import {
  applyExpressiveTheme,
  COLOR_VARIANTS,
  findM2Palette,
  m2Label,
  m2SeedHex,
  M2_PALETTE_NAMES,
  normalizeHex,
  parseColorVariant,
  parseMotionScheme,
  parseSpecVersion,
  resolveIsDark,
  SEED,
  VARIANT_LABELS,
  type ColorMode,
  type ColorSpecVersion,
  type ColorVariant,
  type M2PaletteName,
  type MotionScheme,
} from './theme';

/** Time format: 0 = 12h AM/PM, 1 = 00–23, 2 = 0–23 */
type TimeFormat = 0 | 1 | 2;

interface SettingsPatch {
  tf?: TimeFormat | string;
  sb?: boolean;
  anm?: boolean;
  br?: number | string;
  sc?: number | string;
  theme?: ColorMode;
  date?: boolean;
  seed?: string;
  variant?: ColorVariant;
  spec?: ColorSpecVersion;
  motion?: MotionScheme;
}

interface FlipDetail {
  h: boolean;
  m: boolean;
}

interface SegmentChangeDetail {
  indices: number[];
  values: string[];
}

interface SwitchChangeDetail {
  selected: boolean;
}

interface SliderChangeDetail {
  value: number;
}

interface SelectChangeDetail {
  value: string;
}

type SheetEl = HTMLElement & {
  show: () => Promise<boolean>;
  hide: () => Promise<boolean>;
  open: boolean;
  placement: 'bottom' | 'side';
  side: 'start' | 'end';
  width: 'standard' | 'full';
};

const SCALE_MAX = 100;
const SCALE_MIN = 50;
const BRIGHTNESS_MAX = 100;
const BRIGHTNESS_MIN = 50;
const TICK_MS = 250;
const HOVER_HIDE_MS = 3000;
const IS_FLIP_TEST = false;
const PHONE_MQ = '(max-width: 600px)';
const THEME_CYCLE: ColorMode[] = ['dark', 'light', 'system'];
const URL_FLIPCLOCK = 'https://github.com/Kam3leoN/flipClock';
const URL_K3UI = 'https://github.com/Kam3leoN/k3ui-expressive';
const URL_K3UI_DOC = 'https://k3ui-expressive.vercel.app';

let displayedHour: number | undefined;
let displayedMinute: string | undefined;
let displayedDateKey: string | undefined;
let timeFormat: TimeFormat = 0;
let displayedTimeFormat: TimeFormat = 0;
let showFlaps = true;
let showDate = true;
let scale = SCALE_MAX;
let orientationScale = 1;
let brightness = BRIGHTNESS_MAX;
let colorMode: ColorMode = 'dark';
let seedColor = SEED;
let colorVariant: ColorVariant = 'expressive';
let colorSpec: ColorSpecVersion = '2025';
let motionScheme: MotionScheme = 'expressive';
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let settingsOpen = false;

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

function parseColorMode(raw: string | null): ColorMode {
  if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
  return 'dark';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isOneDigit(format: TimeFormat, hour: number): boolean {
  return (
    (format === 0 && hour === 1) ||
    (format === 0 && hour === 13) ||
    (format === 2 && hour === 1)
  );
}

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

function formatFullDate(now: Date): { text: string; iso: string } {
  const text = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now);
  const iso = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return { text, iso };
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

function msIcon(name: string): string {
  return `<span class="ms notranslate" translate="no" lang="zxx" data-k3-icon="${name}" aria-hidden="true"></span>`;
}

function syncDateVisibility(): void {
  const el = document.getElementById('clock-date');
  if (!el) return;
  el.hidden = !showDate;
  el.setAttribute('aria-hidden', showDate ? 'false' : 'true');
}

function updateDateDisplay(now = new Date()): void {
  const el = document.getElementById('clock-date');
  if (!el) return;
  const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  if (key === displayedDateKey && el.textContent) return;
  const { text, iso } = formatFullDate(now);
  el.textContent = text;
  el.setAttribute('datetime', iso);
  displayedDateKey = key;
}

function themeConfig() {
  return {
    mode: colorMode,
    seed: seedColor,
    variant: colorVariant,
    specVersion: colorSpec,
    motion: motionScheme,
  };
}

function syncThemeControls(): void {
  const themeSeg = document.getElementById('theme-seg') as
    | (HTMLElement & { setSelectedIndices?: (i: number[]) => void })
    | null;
  const idx = THEME_CYCLE.indexOf(colorMode);
  themeSeg?.setSelectedIndices?.(idx >= 0 ? [idx] : [0]);

  const specSeg = document.getElementById('spec-seg') as
    | (HTMLElement & { setSelectedIndices?: (i: number[]) => void })
    | null;
  specSeg?.setSelectedIndices?.(colorSpec === '2021' ? [0] : [1]);

  const motionSeg = document.getElementById('motion-seg') as
    | (HTMLElement & { setSelectedIndices?: (i: number[]) => void })
    | null;
  motionSeg?.setSelectedIndices?.(motionScheme === 'standard' ? [0] : [1]);

  const variantSel = document.getElementById('variant-select') as
    | (HTMLElement & { value?: string })
    | null;
  if (variantSel) variantSel.value = colorVariant;

  const m2 = findM2Palette(seedColor);
  const colorSel = document.getElementById('color-select') as
    | (HTMLElement & { value?: string })
    | null;
  if (colorSel) colorSel.value = m2 ?? 'custom';

  const picker = document.getElementById('seed-picker') as HTMLInputElement | null;
  if (picker && picker.value.toUpperCase() !== seedColor) {
    picker.value = seedColor;
  }
  const customRow = document.getElementById('custom-color-row');
  customRow?.classList.toggle('is-visible', !m2);
}

async function applyThemeFromMode(): Promise<void> {
  await applyExpressiveTheme(themeConfig());
  document.documentElement.dataset.theme = resolveIsDark(colorMode)
    ? 'dark'
    : 'light';
  document.documentElement.style.colorScheme = resolveIsDark(colorMode)
    ? 'dark'
    : 'light';
  syncThemeControls();
}

async function setSeed(next: string): Promise<void> {
  const hex = normalizeHex(next);
  if (!hex || hex === seedColor) {
    syncThemeControls();
    return;
  }
  seedColor = hex;
  setStorage('seed', seedColor);
  await applyThemeFromMode();
}

function syncSheetPlacement(sheet: SheetEl): void {
  const phone = window.matchMedia(PHONE_MQ).matches;
  if (phone) {
    sheet.placement = 'bottom';
    sheet.width = 'full';
  } else {
    sheet.placement = 'side';
    sheet.side = 'end';
  }
}

function updateSettings(patch: SettingsPatch): void {
  if (Object.prototype.hasOwnProperty.call(patch, 'tf') && patch.tf !== undefined) {
    const next = parseTimeFormat(patch.tf);
    if (timeFormat !== next) {
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

  if (Object.prototype.hasOwnProperty.call(patch, 'date') && patch.date !== undefined) {
    if (showDate !== patch.date) {
      showDate = patch.date;
      setStorage('date', showDate);
      syncDateVisibility();
      if (showDate) updateDateDisplay();
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

  if (Object.prototype.hasOwnProperty.call(patch, 'theme') && patch.theme) {
    colorMode = patch.theme;
    setStorage('theme', colorMode);
    void applyThemeFromMode();
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'seed') && patch.seed) {
    void setSeed(patch.seed);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'variant') && patch.variant) {
    colorVariant = patch.variant;
    setStorage('variant', colorVariant);
    void applyThemeFromMode();
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'spec') && patch.spec) {
    colorSpec = patch.spec;
    setStorage('spec', colorSpec);
    void applyThemeFromMode();
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'motion') && patch.motion) {
    motionScheme = patch.motion;
    setStorage('motion', motionScheme);
    void applyThemeFromMode();
  }
}

function loadPersistedSettings(): void {
  const storedTf = getStorage('tf');
  if (storedTf === null || Number.isNaN(Number(storedTf))) {
    setStorage('tf', timeFormat);
  } else {
    timeFormat = parseTimeFormat(storedTf);
  }

  const storedBg = getStorage('bg');
  if (storedBg === null) {
    setStorage('bg', showFlaps);
  } else {
    showFlaps = String(storedBg).toLowerCase() === 'true';
  }

  const storedDate = getStorage('date');
  if (storedDate === null) {
    setStorage('date', showDate);
  } else {
    showDate = String(storedDate).toLowerCase() === 'true';
  }

  const storedBr = getStorage('br');
  if (storedBr === null || Number.isNaN(Number(storedBr))) {
    setStorage('br', brightness);
  } else {
    const parsed = Number(storedBr);
    const clamped = clamp(parsed, BRIGHTNESS_MIN, BRIGHTNESS_MAX);
    brightness = clamped;
    if (clamped !== parsed) setStorage('br', brightness);
  }

  const storedSc = getStorage('sc');
  if (storedSc === null || Number.isNaN(Number(storedSc))) {
    setStorage('sc', scale);
  } else {
    const parsed = Number(storedSc);
    const clamped = clamp(parsed, SCALE_MIN, SCALE_MAX);
    scale = clamped;
    if (clamped !== parsed) setStorage('sc', scale);
  }

  colorMode = parseColorMode(getStorage('theme'));
  seedColor = normalizeHex(getStorage('seed')) ?? SEED;
  colorVariant = parseColorVariant(getStorage('variant'));
  colorSpec = parseSpecVersion(getStorage('spec'));
  motionScheme = parseMotionScheme(getStorage('motion'));
}

function applyLoadedSettingsToUi(): void {
  const tf = document.getElementById('tf') as
    | (HTMLElement & { setSelectedIndices?: (i: number[]) => void })
    | null;
  tf?.setSelectedIndices?.([timeFormat]);

  const flaps = document.getElementById('bg') as
    | (HTMLElement & { selected?: boolean })
    | null;
  if (flaps) flaps.selected = showFlaps;
  requireEl('main-content-area').classList.toggle('dark', !showFlaps);

  const dateSw = document.getElementById('show-date') as
    | (HTMLElement & { selected?: boolean })
    | null;
  if (dateSw) dateSw.selected = showDate;
  syncDateVisibility();
  updateDateDisplay();

  syncThemeControls();
  dispatchBody('_updateBrightness', { value: brightness });
  dispatchBody('_updateScale', { value: scale });
  window.focus();
  document.body.classList.add('willchange');
  dispatchBody('_updateTime');
  setInterval(() => dispatchBody('_updateTime'), TICK_MS);
  document.getElementById('loader')?.classList.add('remove');
}

function setHoverTimer(): void {
  if (settingsOpen) return;
  if (hoverTimer) clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    if (!document.body.classList.contains('pause') && !settingsOpen) {
      document.body.classList.remove('hover');
    }
  }, HOVER_HIDE_MS);
}

function clearHoverTimer(): void {
  if (hoverTimer) clearTimeout(hoverTimer);
  if (!document.body.classList.contains('pause') && !settingsOpen) {
    document.body.classList.remove('hover');
  }
}

function mountChromeUi(): void {
  const hourSegments = JSON.stringify([
    { label: '12', value: '0' },
    { label: '00', value: '1' },
    { label: '0', value: '2' },
  ]);
  const themeSegments = JSON.stringify([
    { label: 'Dark', value: 'dark' },
    { label: 'Light', value: 'light' },
    { label: 'System', value: 'system' },
  ]);
  const specSegments = JSON.stringify([
    { label: '2021', value: '2021' },
    { label: '2025', value: '2025' },
  ]);
  const motionSegments = JSON.stringify([
    { label: 'Standard', value: 'standard' },
    { label: 'Expressive', value: 'expressive' },
  ]);
  const themeIdx = Math.max(0, THEME_CYCLE.indexOf(colorMode));
  const m2Options = M2_PALETTE_NAMES.map(
    (name) => `<k3-menu-item value="${name}">${m2Label(name)}</k3-menu-item>`,
  ).join('');
  const variantOptions = COLOR_VARIANTS.map(
    (v) => `<k3-menu-item value="${v}">${VARIANT_LABELS[v]}</k3-menu-item>`,
  ).join('');
  const m2Current = findM2Palette(seedColor) ?? 'custom';

  document.body.insertAdjacentHTML(
    'beforeend',
    `<k3-fab-menu id="app-fab-menu" class="settings-trigger" size="default" variant="primary" placement="bottom-end" aria-label="Menu">
      <span slot="icon" class="ms notranslate" translate="no" lang="zxx" data-k3-icon="menu" aria-hidden="true"></span>
      <k3-fab-menu-item id="fab-settings" icon="settings">Settings</k3-fab-menu-item>
      <k3-fab-menu-item id="fab-flipclock" icon="code">FlipClock repo</k3-fab-menu-item>
      <k3-fab-menu-item id="fab-k3ui" icon="widgets">K3ui Expressive</k3-fab-menu-item>
      <k3-fab-menu-item id="fab-docs" icon="menu_book">K3ui docs</k3-fab-menu-item>
    </k3-fab-menu>

    <k3-sheet id="settings-sheet" placement="side" side="end" modal>
      <span slot="headline">Settings</span>
      <div class="settings-body">
        <div class="opt-row">
          <span class="opt-label">Hour format</span>
          <k3-button-segmented
            id="tf"
            shape="rounded"
            aria-label="Hour format"
            segments='${hourSegments}'
            selected-indices="[${timeFormat}]"
          ></k3-button-segmented>
        </div>
        <div class="opt-row">
          <span class="opt-label">Show date</span>
          <k3-switch id="show-date" aria-label="Show date" ${showDate ? 'selected' : ''}></k3-switch>
        </div>
        <div class="opt-row">
          <span class="opt-label">Show flaps</span>
          <k3-switch id="bg" aria-label="Show flaps" ${showFlaps ? 'selected' : ''}></k3-switch>
        </div>

        <div class="opt-block">
          <span class="opt-label">Theme</span>
          <k3-button-segmented
            id="theme-seg"
            shape="rounded"
            aria-label="Color scheme"
            segments='${themeSegments}'
            selected-indices="[${themeIdx}]"
          ></k3-button-segmented>
        </div>

        <div class="opt-block">
          <span class="opt-label">Color spec</span>
          <k3-button-segmented
            id="spec-seg"
            shape="rounded"
            aria-label="Color spec"
            segments='${specSegments}'
            selected-indices="[${colorSpec === '2021' ? 0 : 1}]"
          ></k3-button-segmented>
        </div>

        <div class="opt-block">
          <span class="opt-label">Variant</span>
          <k3-select id="variant-select" label="Variant" variant="outlined" value="${colorVariant}">
            ${variantOptions}
          </k3-select>
        </div>

        <div class="opt-block">
          <span class="opt-label">M2 color</span>
          <k3-select id="color-select" label="Material color" variant="outlined" value="${m2Current}">
            ${m2Options}
            <k3-menu-item value="custom">Custom…</k3-menu-item>
          </k3-select>
          <div id="custom-color-row" class="seed-row ${m2Current === 'custom' ? 'is-visible' : ''}">
            <label class="seed-picker-wrap" title="Pick color">
              <input id="seed-picker" type="color" value="${seedColor}" aria-label="Custom primitive color" />
              ${msIcon('palette')}
            </label>
            <span class="seed-hex">${seedColor}</span>
          </div>
        </div>

        <div class="opt-block">
          <span class="opt-label">Motion</span>
          <k3-button-segmented
            id="motion-seg"
            shape="rounded"
            aria-label="Motion scheme"
            segments='${motionSegments}'
            selected-indices="[${motionScheme === 'standard' ? 0 : 1}]"
          ></k3-button-segmented>
        </div>

        <div class="opt-block">
          <k3-slider
            id="scale"
            size="xs"
            min="${SCALE_MIN}"
            max="${SCALE_MAX}"
            step="1"
            value="${scale}"
            label="Scale"
            aria-label="Scale"
            value-indicator
          ></k3-slider>
        </div>
        <div class="opt-block">
          <k3-slider
            id="brightness"
            size="xs"
            min="${BRIGHTNESS_MIN}"
            max="${BRIGHTNESS_MAX}"
            step="1"
            value="${brightness}"
            label="Brightness"
            aria-label="Brightness"
            value-indicator
          ></k3-slider>
        </div>
      </div>
      <k3-button slot="actions" id="settings-done" variant="filled" size="sm">Done</k3-button>
    </k3-sheet>

    <footer id="site-credit" aria-label="Copyright">
      <span>2026 &copy; Code &amp; Design with</span>
      <span class="heart" aria-hidden="true">❤</span>
      <span>par Kam3leoN</span>
    </footer>`,
  );

  const sheet = requireEl('settings-sheet') as SheetEl;
  syncSheetPlacement(sheet);
  window.matchMedia(PHONE_MQ).addEventListener('change', () => {
    if (!settingsOpen) syncSheetPlacement(sheet);
  });

  const openSheet = (): void => {
    syncSheetPlacement(sheet);
    settingsOpen = true;
    document.body.classList.add('hover', 'pause', 'settings-open');
    void sheet.show();
  };
  const closeSheet = (): void => {
    void sheet.hide().then(() => {
      settingsOpen = false;
      document.body.classList.remove('pause', 'settings-open');
      setHoverTimer();
    });
  };

  requireEl('fab-settings').addEventListener('k3-click', () => openSheet());
  requireEl('fab-flipclock').addEventListener('k3-click', () => {
    window.open(URL_FLIPCLOCK, '_blank', 'noopener,noreferrer');
  });
  requireEl('fab-k3ui').addEventListener('k3-click', () => {
    window.open(URL_K3UI, '_blank', 'noopener,noreferrer');
  });
  requireEl('fab-docs').addEventListener('k3-click', () => {
    window.open(URL_K3UI_DOC, '_blank', 'noopener,noreferrer');
  });

  requireEl('settings-done').addEventListener('k3-click', () => closeSheet());
  sheet.addEventListener('k3-close-end', () => {
    settingsOpen = false;
    document.body.classList.remove('pause', 'settings-open');
    setHoverTimer();
  });

  requireEl('tf').addEventListener('k3-change', ((event: CustomEvent<SegmentChangeDetail>) => {
    const raw = event.detail?.values?.[0] ?? event.detail?.indices?.[0];
    if (raw === undefined) return;
    updateSettings({ tf: raw });
  }) as EventListener);

  requireEl('show-date').addEventListener('k3-change', ((event: CustomEvent<SwitchChangeDetail>) => {
    updateSettings({ date: Boolean(event.detail?.selected) });
  }) as EventListener);

  requireEl('bg').addEventListener('k3-change', ((event: CustomEvent<SwitchChangeDetail>) => {
    updateSettings({
      sb: Boolean(event.detail?.selected),
      anm: true,
    });
  }) as EventListener);

  requireEl('theme-seg').addEventListener('k3-change', ((event: CustomEvent<SegmentChangeDetail>) => {
    const value = event.detail?.values?.[0];
    if (value === 'dark' || value === 'light' || value === 'system') {
      updateSettings({ theme: value });
    }
  }) as EventListener);

  requireEl('spec-seg').addEventListener('k3-change', ((event: CustomEvent<SegmentChangeDetail>) => {
    const value = event.detail?.values?.[0];
    if (value === '2021' || value === '2025') {
      updateSettings({ spec: value });
    }
  }) as EventListener);

  requireEl('motion-seg').addEventListener('k3-change', ((event: CustomEvent<SegmentChangeDetail>) => {
    const value = event.detail?.values?.[0];
    if (value === 'standard' || value === 'expressive') {
      updateSettings({ motion: value });
    }
  }) as EventListener);

  requireEl('variant-select').addEventListener('k3-change', ((event: CustomEvent<SelectChangeDetail>) => {
    const value = parseColorVariant(event.detail?.value);
    updateSettings({ variant: value });
  }) as EventListener);

  requireEl('color-select').addEventListener('k3-change', ((event: CustomEvent<SelectChangeDetail>) => {
    const value = event.detail?.value;
    if (!value || value === 'custom') {
      syncThemeControls();
      requireEl('seed-picker').click();
      return;
    }
    const hex = m2SeedHex(value as M2PaletteName);
    if (hex) void setSeed(hex);
  }) as EventListener);

  requireEl<HTMLInputElement>('seed-picker').addEventListener('input', (event) => {
    const hex = (event.target as HTMLInputElement).value;
    const label = document.querySelector('.seed-hex');
    if (label) label.textContent = normalizeHex(hex) ?? hex;
    void setSeed(hex);
  });

  const scaleEl = requireEl('scale');
  scaleEl.addEventListener('k3-input', ((event: CustomEvent<SliderChangeDetail>) => {
    scale = clamp(Number(event.detail?.value), SCALE_MIN, SCALE_MAX);
    dispatchBody('_updateScale', { value: scale });
  }) as EventListener);
  scaleEl.addEventListener('k3-change', ((event: CustomEvent<SliderChangeDetail>) => {
    updateSettings({ sc: event.detail?.value });
  }) as EventListener);

  const brightnessEl = requireEl('brightness');
  brightnessEl.addEventListener('k3-input', ((event: CustomEvent<SliderChangeDetail>) => {
    brightness = clamp(Number(event.detail?.value), BRIGHTNESS_MIN, BRIGHTNESS_MAX);
    dispatchBody('_updateBrightness', { value: brightness });
  }) as EventListener);
  brightnessEl.addEventListener('k3-change', ((event: CustomEvent<SliderChangeDetail>) => {
    updateSettings({ br: event.detail?.value });
  }) as EventListener);

  syncThemeControls();
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
    scale = value;
    const slider = document.getElementById('scale') as
      | (HTMLElement & { value?: number })
      | null;
    if (slider && slider.value !== value) slider.value = value;
    requireEl('main').style.transform = `scale(${(value / 100) * orientationScale})`;
  }) as EventListener);

  document.body.addEventListener('_updateBrightness', ((event: CustomEvent<{ value?: number | string }>) => {
    const raw = event.detail?.value;
    const value =
      raw == null || Number.isNaN(Number(raw))
        ? brightness
        : clamp(Number(raw), BRIGHTNESS_MIN, BRIGHTNESS_MAX);
    brightness = value;
    const slider = document.getElementById('brightness') as
      | (HTMLElement & { value?: number })
      | null;
    if (slider && slider.value !== value) slider.value = value;
    requireEl('main-content-area').style.filter = `brightness(${value}%)`;
    const dateEl = document.getElementById('clock-date');
    if (dateEl) dateEl.style.filter = `brightness(${value}%)`;
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
    const next = Math.min(
      shortest / Math.min(contentW, contentH),
      longest / Math.max(contentW, contentH),
    );

    document.body.classList.toggle('portrait', portrait);
    orientationScale = next;
    dispatchBody('_updateScale', { value: scale });
  });

  window.addEventListener('resize', () => {
    window.dispatchEvent(new CustomEvent('_resize'));
  });
}

function bindClock(): void {
  document.body.addEventListener('_updateTime', () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = IS_FLIP_TEST ? now.getSeconds() : now.getMinutes();
    const seconds = now.getSeconds();
    const minuteText = formatMinute(minute);
    updateDateDisplay(now);

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

    if (
      hour !== displayedHour ||
      minuteText !== displayedMinute ||
      timeFormat !== displayedTimeFormat
    ) {
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
    if (settingsOpen) return;
    document.body.classList.remove('pause');
    document.body.classList.add('hover');
    setHoverTimer();
  });
  document.body.addEventListener('mouseleave', () => {
    if (settingsOpen) return;
    document.body.classList.remove('pause');
    clearHoverTimer();
  });
  window.addEventListener('blur', () => {
    if (settingsOpen) return;
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.classList.remove('pause');
    setHoverTimer();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  void (async () => {
    loadPersistedSettings();
    await applyThemeFromMode();

    mountChromeUi();
    prepareFlipNodes();
    bindScaleAndBrightness();
    bindClock();
    bindHoverChrome();
    bindResize();
    window.dispatchEvent(new CustomEvent('_resize'));

    requireEl('loader').addEventListener(
      'transitionend',
      function onLoaderGone(this: HTMLElement) {
        this.remove();
      },
      { once: true },
    );

    applyLoadedSettingsToUi();

    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (colorMode === 'system') void applyThemeFromMode();
      });
  })();
});
