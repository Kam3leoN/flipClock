import 'k3ui/k3ui.css';
import 'k3ui/fonts-ui.css';
import './styles.scss';
import {
  applyI18n,
  detectLocale,
  getLocale,
  isAppLocale,
  LOCALES,
  LOCALE_BCP47,
  LOCALE_NATIVE,
  setLocale,
  t,
  type AppLocale,
} from './i18n';
import { HEART_SVG, msIcon, sealLigatures } from './icons';
import { mountLocaleFlags } from './locale-flags';
import { feastsToHtml, fetchFeastsOfDay } from './saints';
import { loadBirthdays, mountBirthdaysPage, onBirthdaysChange, todayBannerText } from './birthdays';
import { mountTodosPage } from './todos';
import { mountSplitPage } from './split-board';
import {
  buildClock,
  setClockShowFlaps,
  setClockTimeFormat,
  type TimeFormat as ClockTimeFormat,
} from './clock';
import { unlockFlapSound } from './flap-sound';
import {
  applyExpressiveTheme,
  COLOR_VARIANTS,
  findM2Palette,
  m2Label,
  m2SeedHex,
  M2_PALETTE_NAMES,
  msUntilNextAutoSwitch,
  normalizeHex,
  parseColorMode,
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
type TimeFormat = ClockTimeFormat;

interface SettingsPatch {
  tf?: TimeFormat | string;
  sb?: boolean;
  anm?: boolean;
  br?: number | string;
  sc?: number | string;
  theme?: ColorMode;
  date?: boolean;
  bandeau?: boolean;
  saints?: boolean;
  bdays?: boolean;
  credit?: boolean;
  seed?: string;
  variant?: ColorVariant;
  spec?: ColorSpecVersion;
  motion?: MotionScheme;
  locale?: AppLocale;
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
const SCALE_DEFAULT = 64;
const BRIGHTNESS_MAX = 100;
const BRIGHTNESS_MIN = 50;
const DATE_TICK_MS = 1000;
const BIRTHDAYS_REFRESH_MS = 60 * 60 * 1000;
const HOVER_HIDE_MS = 3000;
const PHONE_MQ = '(max-width: 600px)';
const THEME_CYCLE: ColorMode[] = ['dark', 'light', 'auto', 'system'];
const URL_FLIPFLAP = 'https://github.com/Kam3leoN/flipflap';
const URL_K3UI = 'https://github.com/Kam3leoN/k3ui-expressive';
const URL_K3UI_DOC = 'https://k3ui-expressive.vercel.app';

let displayedDateKey: string | undefined;
let displayedSaintsKey: string | undefined;
let saintsRequestId = 0;
let timeFormat: TimeFormat = 0;
let showFlaps = true;
let showDate = true;
let showBandeau = true;
let showSaints = true;
let showBirthdays = true;
let birthdayBannerText = '';
let showCredit = true;
let scale = SCALE_DEFAULT;
let orientationScale = 1;
let brightness = BRIGHTNESS_MAX;
let colorMode: ColorMode = 'dark';
let seedColor = SEED;
let colorVariant: ColorVariant = 'expressive';
let colorSpec: ColorSpecVersion = '2025';
let motionScheme: MotionScheme = 'expressive';
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let autoThemeTimer: ReturnType<typeof setTimeout> | null = null;
let settingsOpen = false;

function setStorage(key: string, value: string | number | boolean): void {
  localStorage.setItem(key, String(value));
}

function getStorage(key: string): string | null {
  return localStorage.getItem(key);
}

/** Persist every preference currently in memory. */
function saveAllPreferences(): void {
  setStorage('tf', timeFormat);
  setStorage('bg', showFlaps);
  setStorage('date', showDate);
  setStorage('bandeau', showBandeau);
  setStorage('saints', showSaints);
  setStorage('bdays', showBirthdays);
  setStorage('credit', showCredit);
  setStorage('br', brightness);
  setStorage('sc', scale);
  setStorage('theme', colorMode);
  setStorage('seed', seedColor);
  setStorage('variant', colorVariant);
  setStorage('spec', colorSpec);
  setStorage('motion', motionScheme);
  setStorage('locale', getLocale());
}

/** Sync copyright footer visibility with the preference. */
function syncCreditVisibility(): void {
  const el = document.getElementById('site-credit');
  if (!el) return;
  el.hidden = !showCredit;
  el.setAttribute('aria-hidden', showCredit ? 'false' : 'true');
}

/** Sync France tricolor banner visibility. */
function syncBandeauVisibility(): void {
  const el = document.getElementById('bandeau-fr');
  if (!el) return;
  el.hidden = !showBandeau;
  el.setAttribute('aria-hidden', showBandeau ? 'false' : 'true');
}

/** Sync saint-of-the-day line under the date. */
function syncSaintsVisibility(): void {
  const el = document.getElementById('clock-saints');
  if (!el) return;
  const visible = showDate && showSaints;
  el.hidden = !visible;
  el.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function parseTimeFormat(raw: string | number): TimeFormat {
  const n = Number(raw);
  if (n === 1 || n === 2) return n;
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatFullDate(now: Date): { text: string; iso: string } {
  const text = new Intl.DateTimeFormat(LOCALE_BCP47[getLocale()], {
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

/** Birthday banner under the date (visible even when the date is hidden). */
function updateBirthdayBanner(): void {
  const el = document.getElementById('clock-birthdays');
  if (!el) return;
  birthdayBannerText = showBirthdays ? todayBannerText() : '';
  el.textContent = birthdayBannerText;
  el.hidden = !birthdayBannerText;
  syncDateVisibility();
}

function syncDateVisibility(): void {
  const meta = document.getElementById('clock-meta');
  const el = document.getElementById('clock-date');
  if (meta) {
    const metaVisible = showDate || Boolean(birthdayBannerText);
    meta.hidden = !metaVisible;
    meta.setAttribute('aria-hidden', metaVisible ? 'false' : 'true');
  }
  if (el) {
    el.hidden = !showDate;
    el.setAttribute('aria-hidden', showDate ? 'false' : 'true');
  }
  syncSaintsVisibility();
}

function updateDateDisplay(now = new Date()): void {
  const el = document.getElementById('clock-date');
  if (!el) return;
  const key = `${getLocale()}-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  if (key !== displayedDateKey || !el.textContent) {
    const { text, iso } = formatFullDate(now);
    el.textContent = text;
    el.setAttribute('datetime', iso);
    displayedDateKey = key;
    updateBirthdayBanner();
  }
  void updateSaintsDisplay(now);
}

/** Load Nominis feasts and paint gendered colors under the date. */
async function updateSaintsDisplay(now = new Date()): Promise<void> {
  const saintsEl = document.getElementById('clock-saints');
  if (!saintsEl || !showDate || !showSaints) return;

  const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  if (key === displayedSaintsKey && saintsEl.childNodes.length > 0) return;

  const req = ++saintsRequestId;
  try {
    const items = await fetchFeastsOfDay(now);
    if (req !== saintsRequestId) return;
    saintsEl.innerHTML = feastsToHtml(items);
    saintsEl.title = items.map((i) => i.name).join(', ');
    displayedSaintsKey = key;
  } catch {
    if (req !== saintsRequestId) return;
    saintsEl.textContent = '';
    saintsEl.removeAttribute('title');
  }
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
  document.querySelectorAll<HTMLButtonElement>('.m2-swatch').forEach((btn) => {
    const on = Boolean(m2 && btn.dataset.m2 === m2);
    btn.classList.toggle('is-selected', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });

  const picker = document.getElementById('seed-picker') as HTMLInputElement | null;
  if (picker && picker.value.toUpperCase() !== seedColor) {
    picker.value = seedColor;
  }
  const pickerWrap = document.querySelector('.seed-picker-wrap') as HTMLElement | null;
  if (pickerWrap) pickerWrap.style.setProperty('--seed-swatch', seedColor);

  const hexInput = document.getElementById('seed-hex') as HTMLInputElement | null;
  if (hexInput && document.activeElement !== hexInput) {
    hexInput.value = seedColor;
  }
}

function scheduleAutoTheme(): void {
  if (autoThemeTimer) clearTimeout(autoThemeTimer);
  if (colorMode !== 'auto') return;
  autoThemeTimer = setTimeout(() => {
    void applyThemeFromMode().then(scheduleAutoTheme);
  }, msUntilNextAutoSwitch());
}

async function applyThemeFromMode(): Promise<void> {
  await applyExpressiveTheme(themeConfig());
  const dark = resolveIsDark(colorMode);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.motion = motionScheme;
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  syncThemeControls();
  scheduleAutoTheme();
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

/** Whether the document is currently fullscreen. */
function isFullscreen(): boolean {
  return Boolean(document.fullscreenElement);
}

/** Sync fullscreen icon-button selected state + a11y label. */
function syncFullscreenButton(): void {
  const btn = document.getElementById('fullscreen-btn') as
    | (HTMLElement & { selected?: boolean; label?: string })
    | null;
  if (!btn) return;
  const on = isFullscreen();
  if (btn.selected !== on) btn.selected = on;
  const label = t(on ? 'a11y.fullscreenExit' : 'a11y.fullscreen');
  btn.label = label;
  btn.setAttribute('label', label);
  btn.setAttribute('aria-label', label);
}

/** Enter or exit browser fullscreen for the FlipFlap window. */
async function toggleFullscreen(): Promise<void> {
  try {
    if (isFullscreen()) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    /* User gesture / browser policy — ignore */
  }
  syncFullscreenButton();
}

function refreshUiCopy(): void {
  applyI18n(document);
  const headline = document.querySelector('#settings-sheet [slot="headline"]');
  if (headline) headline.textContent = t('settings.title');
  const done = document.getElementById('settings-done');
  if (done) done.textContent = t('settings.done');

  const fabFlip = document.getElementById('fab-flipclock');
  if (fabFlip) fabFlip.textContent = t('menu.flipclock');
  const fabK3 = document.getElementById('fab-k3ui');
  if (fabK3) fabK3.textContent = t('menu.k3ui');
  const fabDocs = document.getElementById('fab-docs');
  if (fabDocs) fabDocs.textContent = t('menu.docs');

  const rail = document.getElementById('app-nav-rail');
  rail?.setAttribute('aria-label', t('nav.label'));
  const railFab = document.getElementById('rail-fab');
  railFab?.setAttribute('aria-label', t('menu.settings'));
  const railEFab = document.getElementById('rail-efab');
  const railEFabLabel = railEFab?.querySelector('[data-i18n="menu.settings"]');
  if (railEFabLabel) railEFabLabel.textContent = t('menu.settings');
  const navHome = document.getElementById('nav-home');
  if (navHome) navHome.setAttribute('label', t('nav.home'));
  const navSplit = document.getElementById('nav-split');
  if (navSplit) navSplit.setAttribute('label', t('nav.split'));
  const navBd = document.getElementById('nav-birthdays');
  if (navBd) navBd.setAttribute('label', t('nav.birthdays'));
  const navTodo = document.getElementById('nav-todos');
  if (navTodo) navTodo.setAttribute('label', t('nav.todos'));

  const localeBtn = document.getElementById('locale-menu');
  localeBtn?.setAttribute('label', t('lang.label'));
  localeBtn?.setAttribute('aria-label', t('a11y.language'));
  syncLocaleMenuSelected(getLocale());
  syncFullscreenButton();

  const themeSeg = document.getElementById('theme-seg');
  if (themeSeg) {
    themeSeg.setAttribute(
      'segments',
      JSON.stringify([
        { label: t('theme.dark'), value: 'dark' },
        { label: t('theme.light'), value: 'light' },
        { label: t('theme.auto'), value: 'auto' },
        { label: t('theme.system'), value: 'system' },
      ]),
    );
    (themeSeg as HTMLElement & { setSelectedIndices?: (i: number[]) => void })
      .setSelectedIndices?.([Math.max(0, THEME_CYCLE.indexOf(colorMode))]);
  }

  const motionSeg = document.getElementById('motion-seg');
  if (motionSeg) {
    motionSeg.setAttribute(
      'segments',
      JSON.stringify([
        { label: t('motion.standard'), value: 'standard' },
        { label: t('motion.expressive'), value: 'expressive' },
      ]),
    );
    (motionSeg as HTMLElement & { setSelectedIndices?: (i: number[]) => void })
      .setSelectedIndices?.(motionScheme === 'standard' ? [0] : [1]);
  }

  displayedDateKey = undefined;
  updateDateDisplay();
  sealLigatures(document);
  document.title = t('app.title');
}

/** Highlight the active language in the split-button menu. */
function localeMenuItems(): HTMLElement[] {
  const menu = document.getElementById('locale-menu')?.shadowRoot?.querySelector('k3-menu');
  return menu ? [...menu.querySelectorAll<HTMLElement>('[data-locale]')] : [];
}

function syncLocaleMenuSelected(locale: AppLocale = getLocale()): void {
  for (const item of localeMenuItems()) {
    const on = item.getAttribute('data-locale') === locale;
    item.toggleAttribute('selected', on);
    (item as HTMLElement & { selected?: boolean }).selected = on;
  }
}

function changeLocale(locale: AppLocale): void {
  setLocale(locale);
  setStorage('locale', locale);
  mountLocaleFlags(locale);
  syncLocaleMenuSelected(locale);
  refreshUiCopy();
}

function updateSettings(patch: SettingsPatch): void {
  if (Object.prototype.hasOwnProperty.call(patch, 'tf') && patch.tf !== undefined) {
    const next = parseTimeFormat(patch.tf);
    if (timeFormat !== next) {
      timeFormat = next;
      setStorage('tf', timeFormat);
      setClockTimeFormat(timeFormat);
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'sb') && patch.sb !== undefined) {
    if (showFlaps !== patch.sb) {
      showFlaps = patch.sb;
      setStorage('bg', showFlaps);
      setClockShowFlaps(showFlaps);
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

  if (Object.prototype.hasOwnProperty.call(patch, 'bandeau') && patch.bandeau !== undefined) {
    if (showBandeau !== patch.bandeau) {
      showBandeau = patch.bandeau;
      setStorage('bandeau', showBandeau);
      syncBandeauVisibility();
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'saints') && patch.saints !== undefined) {
    if (showSaints !== patch.saints) {
      showSaints = patch.saints;
      setStorage('saints', showSaints);
      syncSaintsVisibility();
      if (showSaints) {
        displayedSaintsKey = undefined;
        void updateSaintsDisplay();
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'bdays') && patch.bdays !== undefined) {
    if (showBirthdays !== patch.bdays) {
      showBirthdays = patch.bdays;
      setStorage('bdays', showBirthdays);
      updateBirthdayBanner();
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'credit') && patch.credit !== undefined) {
    if (showCredit !== patch.credit) {
      showCredit = patch.credit;
      setStorage('credit', showCredit);
      syncCreditVisibility();
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

  if (Object.prototype.hasOwnProperty.call(patch, 'locale') && patch.locale) {
    changeLocale(patch.locale);
  }
}

function loadPersistedSettings(): void {
  const storedLocale = getStorage('locale');
  setLocale(
    storedLocale && isAppLocale(storedLocale) ? storedLocale : detectLocale(),
  );

  const storedTf = getStorage('tf');
  if (storedTf === null || Number.isNaN(Number(storedTf))) {
    setStorage('tf', timeFormat);
  } else {
    timeFormat = parseTimeFormat(storedTf);
  }

  const storedBg = getStorage('bg');
  if (storedBg === null) setStorage('bg', showFlaps);
  else showFlaps = String(storedBg).toLowerCase() === 'true';

  const storedDate = getStorage('date');
  if (storedDate === null) setStorage('date', showDate);
  else showDate = String(storedDate).toLowerCase() === 'true';

  const storedBandeau = getStorage('bandeau');
  if (storedBandeau === null) setStorage('bandeau', showBandeau);
  else showBandeau = String(storedBandeau).toLowerCase() === 'true';

  const storedSaints = getStorage('saints');
  if (storedSaints === null) setStorage('saints', showSaints);
  else showSaints = String(storedSaints).toLowerCase() === 'true';

  const storedBdays = getStorage('bdays');
  if (storedBdays === null) setStorage('bdays', showBirthdays);
  else showBirthdays = String(storedBdays).toLowerCase() === 'true';

  const storedCredit = getStorage('credit');
  if (storedCredit === null) setStorage('credit', showCredit);
  else showCredit = String(storedCredit).toLowerCase() === 'true';

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
    scale = SCALE_DEFAULT;
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
  saveAllPreferences();
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
  setClockShowFlaps(showFlaps);

  const dateSw = document.getElementById('show-date') as
    | (HTMLElement & { selected?: boolean })
    | null;
  if (dateSw) dateSw.selected = showDate;
  syncDateVisibility();
  updateDateDisplay();

  const bandeauSw = document.getElementById('show-bandeau') as
    | (HTMLElement & { selected?: boolean })
    | null;
  if (bandeauSw) bandeauSw.selected = showBandeau;
  syncBandeauVisibility();

  const saintsSw = document.getElementById('show-saints') as
    | (HTMLElement & { selected?: boolean })
    | null;
  if (saintsSw) saintsSw.selected = showSaints;
  syncSaintsVisibility();

  const bdaysSw = document.getElementById('show-bdays') as
    | (HTMLElement & { selected?: boolean })
    | null;
  if (bdaysSw) bdaysSw.selected = showBirthdays;

  const creditSw = document.getElementById('show-credit') as
    | (HTMLElement & { selected?: boolean })
    | null;
  if (creditSw) creditSw.selected = showCredit;
  syncCreditVisibility();

  syncThemeControls();
  refreshUiCopy();
  dispatchBody('_updateBrightness', { value: brightness });
  dispatchBody('_updateScale', { value: scale });
  window.focus();
  buildClock({ timeFormat, showFlaps });
  setInterval(() => updateDateDisplay(new Date()), DATE_TICK_MS);
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
    { label: t('theme.dark'), value: 'dark' },
    { label: t('theme.light'), value: 'light' },
    { label: t('theme.auto'), value: 'auto' },
    { label: t('theme.system'), value: 'system' },
  ]);
  const specSegments = JSON.stringify([
    { label: '2021', value: '2021' },
    { label: '2025', value: '2025' },
  ]);
  const motionSegments = JSON.stringify([
    { label: t('motion.standard'), value: 'standard' },
    { label: t('motion.expressive'), value: 'expressive' },
  ]);
  const themeIdx = Math.max(0, THEME_CYCLE.indexOf(colorMode));
  const m2Current = findM2Palette(seedColor);
  const m2Swatches = M2_PALETTE_NAMES.map((name) => {
    const hex = m2SeedHex(name) ?? '#000000';
    const on = m2Current === name;
    return `<button type="button" class="m2-swatch${on ? ' is-selected' : ''}" data-m2="${name}" style="--m2-swatch:${hex}" title="${m2Label(name)}" aria-label="${m2Label(name)}" aria-pressed="${on ? 'true' : 'false'}"></button>`;
  }).join('');
  const variantOptions = COLOR_VARIANTS.map(
    (v) => `<k3-menu-item value="${v}">${VARIANT_LABELS[v]}</k3-menu-item>`,
  ).join('');
  const activeLocale = getLocale();
  const localeItems = LOCALES.map((code) => {
    const selected = code === activeLocale ? ' selected' : '';
    return `<k3-menu-item slot="menu" data-locale="${code}" value="${code}"${selected}>
        <span class="flag-icon flag-icon--1x1" slot="icon" data-locale-flag="${code}" aria-hidden="true"></span>
        ${LOCALE_NATIVE[code]}
      </k3-menu-item>`;
  }).join('');

  const chromeHost = document.getElementById('shell-content') ?? document.body;
  chromeHost.insertAdjacentHTML(
    'beforeend',
    `<div class="chrome-top" id="chrome-top">
      <k3-split-button
        id="locale-menu"
        class="locale-split"
        size="sm"
        variant="tonal"
        label="${t('lang.label')}"
        aria-label="${t('a11y.language')}"
        data-i18n-label="lang.label"
        data-i18n-aria="a11y.language"
      >
        <span id="locale-menu-flag" class="flag-icon flag-icon--1x1" slot="icon" aria-hidden="true"></span>
        ${localeItems}
      </k3-split-button>
      <k3-icon-button
        id="fullscreen-btn"
        class="fullscreen-btn"
        size="sm"
        variant="tonal"
        toggle
        label="${t('a11y.fullscreen')}"
        aria-label="${t('a11y.fullscreen')}"
        data-i18n-aria="a11y.fullscreen"
      >
        ${msIcon('fullscreen')}
        <span slot="selected-icon" class="ms notranslate" translate="no" lang="zxx" data-k3-icon="fullscreen_exit" aria-hidden="true"></span>
      </k3-icon-button>
    </div>
    <footer id="site-credit" role="contentinfo" aria-label="Copyright"${showCredit ? '' : ' hidden'}>
      <span data-i18n="credit.before">${t('credit.before')}</span>
      <span class="heart" aria-hidden="true">${HEART_SVG}</span>
      <span data-i18n="credit.after">${t('credit.after')}</span>
    </footer>
    <div id="prefs-toast" class="prefs-toast" role="status" aria-live="polite" hidden></div>`,
  );

  /* Overlays elevate to body (above the rail) — same pattern as k3ui playground. */
  document.body.insertAdjacentHTML(
    'beforeend',
    `<k3-fab-menu id="app-fab-menu" class="settings-trigger" fixed size="default" variant="primary" placement="bottom-end" aria-label="${t('menu.open')}" data-i18n-aria="menu.open">
      <span slot="icon" class="ms notranslate" translate="no" lang="zxx" data-k3-icon="menu" aria-hidden="true"></span>
      <k3-fab-menu-item id="fab-flipclock" icon="code">${t('menu.flipclock')}</k3-fab-menu-item>
      <k3-fab-menu-item id="fab-k3ui" icon="widgets">${t('menu.k3ui')}</k3-fab-menu-item>
      <k3-fab-menu-item id="fab-docs" icon="menu_book">${t('menu.docs')}</k3-fab-menu-item>
    </k3-fab-menu>

    <k3-sheet id="settings-sheet" class="settings-sheet" placement="side" side="end" modal aria-label="${t('settings.title')}">
      <span slot="headline" data-i18n="settings.title">${t('settings.title')}</span>
      <div class="settings-body">
        <div class="opt-row">
          <span class="opt-label" data-i18n="opt.hourFormat">${t('opt.hourFormat')}</span>
          <k3-button-segmented
            id="tf"
            shape="rounded"
            aria-label="${t('opt.hourFormat')}"
            segments='${hourSegments}'
            selected-indices="[${timeFormat}]"
          ></k3-button-segmented>
        </div>
          <div class="opt-row">
            <span class="opt-label" data-i18n="opt.showDate">${t('opt.showDate')}</span>
            <k3-switch id="show-date" aria-label="${t('opt.showDate')}" ${showDate ? 'selected' : ''}></k3-switch>
          </div>
          <div class="opt-row">
            <span class="opt-label" data-i18n="opt.showSaints">${t('opt.showSaints')}</span>
            <k3-switch id="show-saints" aria-label="${t('opt.showSaints')}" ${showSaints ? 'selected' : ''}></k3-switch>
          </div>
          <div class="opt-row">
            <span class="opt-label" data-i18n="opt.showBirthdays">${t('opt.showBirthdays')}</span>
            <k3-switch id="show-bdays" aria-label="${t('opt.showBirthdays')}" ${showBirthdays ? 'selected' : ''}></k3-switch>
          </div>
          <div class="opt-row">
            <span class="opt-label" data-i18n="opt.showFlaps">${t('opt.showFlaps')}</span>
            <k3-switch id="bg" aria-label="${t('opt.showFlaps')}" ${showFlaps ? 'selected' : ''}></k3-switch>
          </div>
          <div class="opt-row">
            <span class="opt-label" data-i18n="opt.showBandeau">${t('opt.showBandeau')}</span>
            <k3-switch id="show-bandeau" aria-label="${t('opt.showBandeau')}" ${showBandeau ? 'selected' : ''}></k3-switch>
          </div>
          <div class="opt-row">
            <span class="opt-label" data-i18n="opt.showCredit">${t('opt.showCredit')}</span>
            <k3-switch id="show-credit" aria-label="${t('opt.showCredit')}" ${showCredit ? 'selected' : ''}></k3-switch>
          </div>

        <div class="opt-block">
          <span class="opt-label" data-i18n="opt.theme">${t('opt.theme')}</span>
          <k3-button-segmented
            id="theme-seg"
            class="theme-seg"
            shape="rounded"
            aria-label="${t('opt.theme')}"
            segments='${themeSegments}'
            selected-indices="[${themeIdx}]"
          ></k3-button-segmented>
        </div>

        <div class="opt-block">
          <span class="opt-label" data-i18n="opt.spec">${t('opt.spec')}</span>
          <k3-button-segmented
            id="spec-seg"
            shape="rounded"
            aria-label="${t('opt.spec')}"
            segments='${specSegments}'
            selected-indices="[${colorSpec === '2021' ? 0 : 1}]"
          ></k3-button-segmented>
        </div>

        <div class="opt-block">
          <span class="opt-label" data-i18n="opt.variant">${t('opt.variant')}</span>
          <k3-select id="variant-select" label="${t('opt.variant')}" variant="outlined" value="${colorVariant}">
            ${variantOptions}
          </k3-select>
        </div>

        <div class="opt-block">
          <span class="opt-label" data-i18n="opt.m2color">${t('opt.m2color')}</span>
          <div id="m2-swatches" class="m2-swatches" role="listbox" aria-label="${t('opt.m2color')}">
            ${m2Swatches}
          </div>
          <div id="custom-color-row" class="seed-row">
            <label class="seed-picker-wrap" style="--seed-swatch:${seedColor}" title="${t('opt.customColor')}">
              <input id="seed-picker" type="color" value="${seedColor}" aria-label="${t('opt.customColor')}" />
              ${msIcon('palette')}
            </label>
            <input
              id="seed-hex"
              class="seed-hex-input"
              type="text"
              value="${seedColor}"
              maxlength="7"
              spellcheck="false"
              autocomplete="off"
              autocapitalize="characters"
              aria-label="${t('opt.customColor')}"
              inputmode="text"
            />
          </div>
        </div>

        <div class="opt-block">
          <span class="opt-label" data-i18n="opt.motion">${t('opt.motion')}</span>
          <k3-button-segmented
            id="motion-seg"
            shape="rounded"
            aria-label="${t('opt.motion')}"
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
            label="${t('opt.scale')}"
            aria-label="${t('opt.scale')}"
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
            label="${t('opt.brightness')}"
            aria-label="${t('opt.brightness')}"
            value-indicator
          ></k3-slider>
        </div>
      </div>
      <k3-button slot="actions" id="settings-done" variant="filled" size="sm" data-i18n="settings.done">${t('settings.done')}</k3-button>
    </k3-sheet>`,
  );

  const sheet = requireEl('settings-sheet') as SheetEl;
  syncSheetPlacement(sheet);
  window.matchMedia(PHONE_MQ).addEventListener('change', () => {
    if (!settingsOpen) syncSheetPlacement(sheet);
  });

  requestAnimationFrame(() => {
    mountLocaleFlags(getLocale());
    syncLocaleMenuSelected(getLocale());
    sealLigatures(document);
  });
  /* Items finish adopting into the split menu after upgrade */
  queueMicrotask(() => syncLocaleMenuSelected(getLocale()));

  const openSheet = (): void => {
    syncSheetPlacement(sheet);
    settingsOpen = true;
    document.body.classList.add('hover', 'pause', 'settings-open');
    void sheet.show();
  };
  const closeSheet = (persist = false): void => {
    if (persist) {
      saveAllPreferences();
      const toast = document.getElementById('prefs-toast');
      if (toast) {
        toast.hidden = false;
        toast.textContent = t('settings.saved');
        window.setTimeout(() => {
          toast.hidden = true;
        }, 1800);
      }
    }
    void sheet.hide().then(() => {
      settingsOpen = false;
      document.body.classList.remove('pause', 'settings-open');
      setHoverTimer();
    });
  };

  requireEl('locale-menu').addEventListener('k3-select', ((event: CustomEvent<{ value?: string }>) => {
    const v = event.detail?.value;
    if (v && isAppLocale(v)) changeLocale(v);
  }) as EventListener);

  /* Unlock flap audio on first gesture (clock + Split share the same pool). */
  document.addEventListener(
    'pointerdown',
    () => {
      unlockFlapSound();
    },
    { once: true, capture: true },
  );

  requireEl('fullscreen-btn').addEventListener('k3-click', () => {
    void toggleFullscreen();
  });
  document.addEventListener('fullscreenchange', () => syncFullscreenButton());
  syncFullscreenButton();

  const openSettings = (): void => openSheet();
  requireEl('rail-fab').addEventListener('k3-click', openSettings);
  requireEl('rail-efab').addEventListener('k3-click', openSettings);

  const pageHome = requireEl('page-home');
  const pageSplit = requireEl('page-split');
  const pageBirthdays = requireEl('page-birthdays');
  const pageTodos = requireEl('page-todos');
  const splitPage = mountSplitPage(pageSplit);
  const birthdaysPage = mountBirthdaysPage(pageBirthdays);
  const todosPage = mountTodosPage(pageTodos);

  const PAGE_IDS = ['home', 'split', 'birthdays', 'todos'] as const;

  const setNavPage = (index: number): void => {
    const rail = document.getElementById('app-nav-rail') as (HTMLElement & { active?: number }) | null;
    if (rail) rail.active = index;
    const app = document.querySelector('.app');
    const page = PAGE_IDS[index] ?? 'home';
    app?.setAttribute('data-page', page);
    pageHome.hidden = index !== 0;
    pageHome.classList.toggle('is-active', index === 0);
    pageSplit.classList.toggle('is-active', index === 1);
    pageBirthdays.classList.toggle('is-active', index === 2);
    pageTodos.classList.toggle('is-active', index === 3);
    splitPage.hide();
    birthdaysPage.hide();
    todosPage.hide();
    if (index === 1) splitPage.show();
    else if (index === 2) birthdaysPage.show();
    else if (index === 3) todosPage.show();
  };

  const goHome = (): void => {
    setNavPage(0);
    void sheet.hide();
    settingsOpen = false;
    document.body.classList.remove('pause', 'settings-open');
    setHoverTimer();
  };

  const onNavIndex = (index: number): void => {
    if (index === 0) goHome();
    else setNavPage(index);
  };

  requireEl('app-nav-rail').addEventListener('k3-change', ((event: CustomEvent<{ index?: number }>) => {
    const index = typeof event.detail?.index === 'number' ? event.detail.index : 0;
    onNavIndex(index);
  }) as EventListener);

  /* Direct item clicks — reliable even when composed click path skips rail @click */
  (
    [
      ['nav-home', 0],
      ['nav-split', 1],
      ['nav-birthdays', 2],
      ['nav-todos', 3],
    ] as const
  ).forEach(([id, index]) => {
    requireEl(id).addEventListener('click', () => onNavIndex(index));
  });

  requireEl('fab-flipclock').addEventListener('k3-click', () => {
    window.open(URL_FLIPFLAP, '_blank', 'noopener,noreferrer');
  });
  requireEl('fab-k3ui').addEventListener('k3-click', () => {
    window.open(URL_K3UI, '_blank', 'noopener,noreferrer');
  });
  requireEl('fab-docs').addEventListener('k3-click', () => {
    window.open(URL_K3UI_DOC, '_blank', 'noopener,noreferrer');
  });

  requireEl('settings-done').addEventListener('k3-click', () => closeSheet(true));
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

  requireEl('show-saints').addEventListener('k3-change', ((event: CustomEvent<SwitchChangeDetail>) => {
    updateSettings({ saints: Boolean(event.detail?.selected) });
  }) as EventListener);

  requireEl('show-bdays').addEventListener('k3-change', ((event: CustomEvent<SwitchChangeDetail>) => {
    updateSettings({ bdays: Boolean(event.detail?.selected) });
  }) as EventListener);

  requireEl('show-bandeau').addEventListener('k3-change', ((event: CustomEvent<SwitchChangeDetail>) => {
    updateSettings({ bandeau: Boolean(event.detail?.selected) });
  }) as EventListener);

  requireEl('show-credit').addEventListener('k3-change', ((event: CustomEvent<SwitchChangeDetail>) => {
    updateSettings({ credit: Boolean(event.detail?.selected) });
  }) as EventListener);

  requireEl('bg').addEventListener('k3-change', ((event: CustomEvent<SwitchChangeDetail>) => {
    updateSettings({
      sb: Boolean(event.detail?.selected),
      anm: true,
    });
  }) as EventListener);

  requireEl('theme-seg').addEventListener('k3-change', ((event: CustomEvent<SegmentChangeDetail>) => {
    const value = event.detail?.values?.[0];
    if (value === 'dark' || value === 'light' || value === 'auto' || value === 'system') {
      updateSettings({ theme: value });
    }
  }) as EventListener);

  requireEl('spec-seg').addEventListener('k3-change', ((event: CustomEvent<SegmentChangeDetail>) => {
    const value = event.detail?.values?.[0];
    if (value === '2021' || value === '2025') updateSettings({ spec: value });
  }) as EventListener);

  requireEl('motion-seg').addEventListener('k3-change', ((event: CustomEvent<SegmentChangeDetail>) => {
    const value = event.detail?.values?.[0];
    if (value === 'standard' || value === 'expressive') {
      updateSettings({ motion: value });
    }
  }) as EventListener);

  requireEl('variant-select').addEventListener('k3-change', ((event: CustomEvent<SelectChangeDetail>) => {
    updateSettings({ variant: parseColorVariant(event.detail?.value) });
  }) as EventListener);

  requireEl('m2-swatches').addEventListener('click', (event) => {
    const btn = (event.target as HTMLElement | null)?.closest?.('.m2-swatch') as
      | HTMLButtonElement
      | null;
    if (!btn?.dataset.m2) return;
    const hex = m2SeedHex(btn.dataset.m2 as M2PaletteName);
    if (hex) void setSeed(hex);
  });

  requireEl<HTMLInputElement>('seed-picker').addEventListener('input', (event) => {
    void setSeed((event.target as HTMLInputElement).value);
  });

  const seedHexInput = requireEl<HTMLInputElement>('seed-hex');
  const commitHexInput = (): void => {
    const raw = seedHexInput.value.trim();
    const hex = normalizeHex(raw.startsWith('#') ? raw : `#${raw}`);
    if (hex) void setSeed(hex);
    else seedHexInput.value = seedColor;
  };
  seedHexInput.addEventListener('change', commitHexInput);
  seedHexInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitHexInput();
      seedHexInput.blur();
    }
  });
  seedHexInput.addEventListener('input', () => {
    const raw = seedHexInput.value.trim();
    const hex = normalizeHex(raw.startsWith('#') ? raw : `#${raw}`);
    if (hex) void setSeed(hex);
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
  sealLigatures(document);
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
    /* filter:brightness(100%) still creates a layer that flashes 3D flips */
    const area = requireEl('main-content-area');
    const dateEl = document.getElementById('clock-date');
    if (value >= BRIGHTNESS_MAX) {
      area.style.removeProperty('filter');
      dateEl?.style.removeProperty('filter');
    } else {
      area.style.filter = `brightness(${value}%)`;
      if (dateEl) dateEl.style.filter = `brightness(${value}%)`;
    }
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
    bindScaleAndBrightness();
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

    onBirthdaysChange(updateBirthdayBanner);
    const refreshBirthdays = (): void => {
      loadBirthdays().catch(() => {
        /* API offline — banner simply stays empty */
      });
    };
    refreshBirthdays();
    setInterval(refreshBirthdays, BIRTHDAYS_REFRESH_MS);

    window
      .matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        if (colorMode === 'system') void applyThemeFromMode();
      });
  })();
});
