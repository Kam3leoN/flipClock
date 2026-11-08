/**
 * Airport Solari split-flap board (style: flip-flap-display / mechanical flaps).
 * 8 × 24 cells, multi-page rotation, live mode. Not PQINA — true hinge flip + charset cascade.
 */
import {
  initFlapSound,
  playFlapClick,
  setFlapActivity,
  stopFlapSound,
  unlockFlapSound,
} from './flap-sound';
import { t } from './i18n';
import { msIcon, sealLigatures } from './icons';

export const SPLIT_ROWS = 8;
export const SPLIT_COLS = 24;
/** Same family as https://flip-flap-display.vercel.app (space first = blank). */
export const SPLIT_CHARSET = ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.:-';

const STORAGE_KEY = 'flipflap-split-board';
const LEGACY_KEY = 'flipflap-split-lines';
const DEFAULT_INTERVAL_SEC = 8;
const MIN_INTERVAL_SEC = 3;
const MAX_INTERVAL_SEC = 120;
/** One mechanical flap step — matches reference ~75ms cascade. */
const FLIP_STEP_MS = 75;
const LIVE_PRESETS = [
  { w: 1920, h: 1080 },
  { w: 2560, h: 1440 },
] as const;

type FieldEl = HTMLElement & { value: string };

interface Cell {
  root: HTMLElement;
  topChar: HTMLElement;
  botChar: HTMLElement;
  swing: HTMLElement;
  swingFront: HTMLElement;
  swingBack: HTMLElement;
  current: string;
  target: string;
  busy: boolean;
  gen: number;
}

interface SplitState {
  intervalSec: number;
  pages: string[][];
}

let cells: Cell[][] = [];
let state: SplitState = { intervalSec: DEFAULT_INTERVAL_SEC, pages: [] };
let pageIndex = 0;
let editPageIndex = 0;
let rotateTimer: ReturnType<typeof setTimeout> | null = null;
let visible = false;
let live = false;
let flipping = false;
let pageRoot: HTMLElement | null = null;
let pageGen = 0;
let liveChromeBtn: HTMLElement | null = null;
let activeFlips = 0;

function bumpActivity(delta: number): void {
  activeFlips = Math.max(0, activeFlips + delta);
  setFlapActivity(activeFlips);
}

function blankPage(): string[] {
  return Array.from({ length: SPLIT_ROWS }, () => ' '.repeat(SPLIT_COLS));
}

function normalizeChar(raw: string): string {
  const c = (raw || ' ').toUpperCase();
  return SPLIT_CHARSET.includes(c) ? c : ' ';
}

function displayGlyph(ch: string): string {
  return ch === ' ' ? '' : ch;
}

function padLine(raw: string): string {
  const up = Array.from(raw.toUpperCase())
    .map((ch) => (SPLIT_CHARSET.includes(ch) ? ch : ' '))
    .join('')
    .slice(0, SPLIT_COLS);
  return up.padEnd(SPLIT_COLS, ' ');
}

function normalizePage(raw: unknown): string[] {
  if (!Array.isArray(raw)) return blankPage();
  return Array.from({ length: SPLIT_ROWS }, (_, i) =>
    padLine(typeof raw[i] === 'string' ? (raw[i] as string) : ''),
  );
}

function defaultPages(): string[][] {
  return [
    [
      padLine(''),
      padLine('FLIPFLAP SPLIT BOARD'),
      padLine(''),
      padLine('EDIT TO DISPLAY TEXT'),
      padLine(''),
      padLine('AIRPORT STYLE FLAPS'),
      padLine(''),
      padLine(''),
    ],
    [
      padLine('WELCOME ABOARD'),
      padLine(''),
      padLine('GATE  A12   ON TIME'),
      padLine('GATE  B04   DELAYED'),
      padLine('GATE  C21   BOARDING'),
      padLine(''),
      padLine('NEXT PAGE IN A FEW SEC'),
      padLine(''),
    ],
  ];
}

function clampInterval(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_INTERVAL_SEC;
  return Math.min(MAX_INTERVAL_SEC, Math.max(MIN_INTERVAL_SEC, Math.round(n)));
}

function loadState(): SplitState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SplitState>;
      const pages = Array.isArray(parsed.pages)
        ? parsed.pages.map(normalizePage).filter((p) => p.length === SPLIT_ROWS)
        : [];
      return {
        intervalSec: clampInterval(Number(parsed.intervalSec)),
        pages: pages.length ? pages : defaultPages(),
      };
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as unknown;
      return {
        intervalSec: DEFAULT_INTERVAL_SEC,
        pages: [normalizePage(parsed)],
      };
    }
  } catch {
    /* ignore */
  }
  return { intervalSec: DEFAULT_INTERVAL_SEC, pages: defaultPages() };
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

function charsetIndex(ch: string): number {
  const i = SPLIT_CHARSET.indexOf(normalizeChar(ch));
  return i < 0 ? 0 : i;
}

function nextChar(ch: string): string {
  const i = charsetIndex(ch);
  return SPLIT_CHARSET[(i + 1) % SPLIT_CHARSET.length] ?? ' ';
}

function stepsBetween(from: string, to: string): number {
  const a = charsetIndex(from);
  const b = charsetIndex(to);
  if (a === b) return 0;
  return (b - a + SPLIT_CHARSET.length) % SPLIT_CHARSET.length;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function paintStatic(cell: Cell, ch: string): void {
  const glyph = displayGlyph(ch);
  cell.topChar.textContent = glyph;
  cell.botChar.textContent = glyph;
  cell.root.classList.toggle('is-blank', ch === ' ');
  cell.current = ch;
}

function flipOnce(cell: Cell, from: string, to: string): Promise<void> {
  return new Promise((resolve) => {
    const fromG = displayGlyph(from);
    const toG = displayGlyph(to);

    /* Behind the swing: next top + current bottom (Solari reveal). */
    cell.topChar.textContent = toG;
    cell.botChar.textContent = fromG;
    cell.swingFront.textContent = fromG;
    cell.swingBack.textContent = toG;

    cell.swing.classList.remove('is-flipping');
    void cell.swing.offsetWidth;
    cell.swing.hidden = false;
    cell.swing.classList.add('is-flipping');
    cell.root.classList.add('is-flipping');
    playFlapClick();

    const done = (): void => {
      cell.swing.removeEventListener('animationend', done);
      paintStatic(cell, to);
      cell.swing.classList.remove('is-flipping');
      cell.swing.hidden = true;
      cell.root.classList.remove('is-flipping');
      resolve();
    };
    cell.swing.addEventListener('animationend', done);
    window.setTimeout(done, FLIP_STEP_MS + 20);
  });
}

async function rotateCellAirport(cell: Cell, targetRaw: string): Promise<void> {
  const target = normalizeChar(targetRaw);
  cell.target = target;
  const gen = ++cell.gen;
  cell.busy = true;

  if (cell.current === target) {
    cell.busy = false;
    return;
  }

  let remaining = stepsBetween(cell.current, target);
  /* Full forward-only cascade like a real board (cap very long wraps). */
  if (remaining === 0) remaining = SPLIT_CHARSET.length;
  remaining = Math.min(remaining, SPLIT_CHARSET.length);

  bumpActivity(1);
  try {
    while (remaining > 0) {
      if (cell.gen !== gen) return;
      remaining -= 1;
      const from = cell.current;
      const next = remaining === 0 ? target : nextChar(from);
      await flipOnce(cell, from, next);
      if (cell.gen !== gen) return;
    }

    if (cell.gen === gen) {
      paintStatic(cell, target);
      cell.busy = false;
    }
  } finally {
    bumpActivity(-1);
  }
}

function anyCellBusy(): boolean {
  for (const row of cells) {
    for (const cell of row) {
      if (cell.busy) return true;
    }
  }
  return false;
}

function buildGrid(host: HTMLElement): void {
  host.replaceChildren();
  cells = [];

  for (let r = 0; r < SPLIT_ROWS; r++) {
    const row = document.createElement('div');
    row.className = 'split-row';
    row.setAttribute('role', 'row');
    const rowCells: Cell[] = [];
    for (let c = 0; c < SPLIT_COLS; c++) {
      const root = document.createElement('div');
      root.className = 'sf-unit is-blank';
      root.setAttribute('role', 'gridcell');
      root.innerHTML = `
        <div class="sf-half sf-half--top" aria-hidden="true"><span class="sf-char"></span></div>
        <div class="sf-half sf-half--bot" aria-hidden="true"><span class="sf-char"></span></div>
        <div class="sf-hinge" aria-hidden="true"></div>
        <div class="sf-swing" hidden aria-hidden="true">
          <div class="sf-swing-face sf-swing-face--front"><span class="sf-char"></span></div>
          <div class="sf-swing-face sf-swing-face--back"><span class="sf-char"></span></div>
        </div>`;
      const topChar = root.querySelector('.sf-half--top .sf-char') as HTMLElement;
      const botChar = root.querySelector('.sf-half--bot .sf-char') as HTMLElement;
      const swing = root.querySelector('.sf-swing') as HTMLElement;
      const swingFront = root.querySelector('.sf-swing-face--front .sf-char') as HTMLElement;
      const swingBack = root.querySelector('.sf-swing-face--back .sf-char') as HTMLElement;
      row.appendChild(root);
      rowCells.push({
        root,
        topChar,
        botChar,
        swing,
        swingFront,
        swingBack,
        current: ' ',
        target: ' ',
        busy: false,
        gen: 0,
      });
    }
    cells.push(rowCells);
    host.appendChild(row);
  }
}

async function showPage(index: number, animate: boolean): Promise<void> {
  if (!state.pages.length || !cells.length) return;
  const gen = ++pageGen;
  pageIndex = ((index % state.pages.length) + state.pages.length) % state.pages.length;
  const page = state.pages[pageIndex] ?? blankPage();
  syncPageIndicator();

  if (!animate) {
    for (let r = 0; r < SPLIT_ROWS; r++) {
      const line = page[r] ?? ' '.repeat(SPLIT_COLS);
      for (let c = 0; c < SPLIT_COLS; c++) {
        const cell = cells[r]?.[c];
        if (!cell) continue;
        cell.gen += 1;
        cell.busy = false;
        const ch = normalizeChar(line[c] ?? ' ');
        cell.target = ch;
        paintStatic(cell, ch);
      }
    }
    flipping = false;
    return;
  }

  flipping = true;
  activeFlips = 0;
  setFlapActivity(0);
  const jobs: Promise<void>[] = [];
  for (let r = 0; r < SPLIT_ROWS; r++) {
    const line = page[r] ?? ' '.repeat(SPLIT_COLS);
    for (let c = 0; c < SPLIT_COLS; c++) {
      const cell = cells[r]?.[c];
      if (!cell) continue;
      const ch = normalizeChar(line[c] ?? ' ');
      if (cell.current === ch) {
        cell.target = ch;
        continue;
      }
      const startDelay = Math.floor(Math.random() * 280) + c * 12 + r * 18;
      jobs.push(
        (async () => {
          await delay(startDelay);
          if (gen !== pageGen) return;
          await rotateCellAirport(cell, ch);
        })(),
      );
    }
  }

  await Promise.all(jobs);
  if (gen !== pageGen) return;
  for (let r = 0; r < SPLIT_ROWS; r++) {
    const line = page[r] ?? ' '.repeat(SPLIT_COLS);
    for (let c = 0; c < SPLIT_COLS; c++) {
      const cell = cells[r]?.[c];
      if (!cell) continue;
      const ch = normalizeChar(line[c] ?? ' ');
      cell.target = ch;
      paintStatic(cell, ch);
      cell.busy = false;
    }
  }
  activeFlips = 0;
  setFlapActivity(0);
  flipping = false;
}

function syncPageIndicator(): void {
  const el = document.getElementById('split-page-indicator');
  if (!el) return;
  el.textContent = t('split.pageOf')
    .replace('{n}', String(pageIndex + 1))
    .replace('{total}', String(Math.max(1, state.pages.length)));
}

function stopRotation(): void {
  if (rotateTimer) {
    clearTimeout(rotateTimer);
    rotateTimer = null;
  }
}

function scheduleNextPage(): void {
  stopRotation();
  if (!visible || !live || state.pages.length < 2 || state.intervalSec < MIN_INTERVAL_SEC) return;
  if (flipping || anyCellBusy()) return;
  rotateTimer = setTimeout(() => {
    void advancePage();
  }, state.intervalSec * 1000);
}

async function advancePage(): Promise<void> {
  stopRotation();
  if (!visible || !live || state.pages.length < 2) return;
  await showPage(pageIndex + 1, true);
  if (!visible || !live) return;
  scheduleNextPage();
}

function startRotation(): void {
  scheduleNextPage();
}

function liveBoardSize(): { w: number; h: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let best: { w: number; h: number } = LIVE_PRESETS[0];
  for (const preset of LIVE_PRESETS) {
    if (preset.w <= vw && preset.h <= vh) best = preset;
  }
  const scale = Math.min(1, vw / best.w, vh / best.h);
  return {
    w: Math.max(1, Math.floor(best.w * scale)),
    h: Math.max(1, Math.floor(best.h * scale)),
  };
}

function applyLiveBoardSize(): void {
  const stage = pageRoot?.querySelector<HTMLElement>('.split-stage');
  if (!stage) return;
  if (!live) {
    stage.style.removeProperty('--split-live-w');
    stage.style.removeProperty('--split-live-h');
    stage.style.removeProperty('width');
    stage.style.removeProperty('height');
    return;
  }
  const { w, h } = liveBoardSize();
  stage.style.setProperty('--split-live-w', `${w}px`);
  stage.style.setProperty('--split-live-h', `${h}px`);
  stage.style.width = `${w}px`;
  stage.style.height = `${h}px`;
}

function fillEditorFields(): void {
  const interval = document.getElementById('split-interval') as FieldEl | null;
  if (interval) interval.value = String(state.intervalSec);

  const pageSelect = document.getElementById('split-page-select') as FieldEl | null;
  if (pageSelect) {
    pageSelect.innerHTML = state.pages
      .map((_, i) => `<k3-menu-item value="${i}">${t('split.page')} ${i + 1}</k3-menu-item>`)
      .join('');
    pageSelect.value = String(editPageIndex);
  }

  const page = state.pages[editPageIndex] ?? blankPage();
  for (let i = 0; i < SPLIT_ROWS; i++) {
    const field = document.getElementById(`split-line-${i}`) as FieldEl | null;
    if (field) field.value = (page[i] ?? '').trimEnd();
  }

  const delBtn = document.getElementById('split-page-delete');
  if (delBtn) delBtn.toggleAttribute('disabled', state.pages.length <= 1);
}

function readEditorPageLines(): string[] {
  return Array.from({ length: SPLIT_ROWS }, (_, i) => {
    const field = document.getElementById(`split-line-${i}`) as FieldEl | null;
    return padLine(String(field?.value ?? ''));
  });
}

function saveSettingsFromUi(_animate: boolean): void {
  const interval = document.getElementById('split-interval') as FieldEl | null;
  state.intervalSec = clampInterval(Number(interval?.value ?? DEFAULT_INTERVAL_SEC));
  state.pages[editPageIndex] = readEditorPageLines();
  persist();
  pageIndex = Math.min(pageIndex, state.pages.length - 1);
  /* Board only runs in Live — sync silently for next Live entry. */
  void showPage(pageIndex, false);
}

function addPage(): void {
  state.pages[editPageIndex] = readEditorPageLines();
  state.pages.push(blankPage());
  editPageIndex = state.pages.length - 1;
  fillEditorFields();
  persist();
}

function deletePage(): void {
  if (state.pages.length <= 1) return;
  state.pages.splice(editPageIndex, 1);
  editPageIndex = Math.min(editPageIndex, state.pages.length - 1);
  pageIndex = Math.min(pageIndex, state.pages.length - 1);
  fillEditorFields();
  persist();
  void showPage(pageIndex, false);
}

function selectEditPage(next: number): void {
  if (next === editPageIndex || next < 0 || next >= state.pages.length) return;
  state.pages[editPageIndex] = readEditorPageLines();
  editPageIndex = next;
  fillEditorFields();
  persist();
}

function syncLiveChromeLabel(): void {
  if (!liveChromeBtn) return;
  liveChromeBtn.setAttribute('aria-pressed', live ? 'true' : 'false');
  liveChromeBtn.setAttribute('aria-label', t(live ? 'split.exitLive' : 'split.live'));
  liveChromeBtn.setAttribute('label', t(live ? 'split.exitLive' : 'split.live'));
  const label = liveChromeBtn.querySelector('[data-live-label]');
  if (label) label.textContent = t(live ? 'split.exitLive' : 'split.live');
}

function setLiveChromeVisible(on: boolean): void {
  if (!liveChromeBtn) return;
  liveChromeBtn.hidden = !on;
  liveChromeBtn.toggleAttribute('hidden', !on);
}

function setLive(on: boolean): void {
  live = on;
  document.body.classList.toggle('split-live', on);
  document.documentElement.classList.toggle('split-live', on);
  pageRoot?.classList.toggle('is-live', on);
  const exitBtn = document.getElementById('split-live-exit');
  if (exitBtn) exitBtn.hidden = !on;
  syncLiveChromeLabel();
  applyLiveBoardSize();
  if (on) {
    unlockFlapSound();
    void document.documentElement.requestFullscreen?.().catch(() => {
      /* optional */
    });
    stopRotation();
    void (async () => {
      await showPage(pageIndex, true);
      if (live && visible) startRotation();
    })();
  } else {
    stopRotation();
    pageGen += 1;
    flipping = false;
    activeFlips = 0;
    stopFlapSound();
    void showPage(pageIndex, false);
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {
        /* optional */
      });
    }
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (!live) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    setLive(false);
  }
}

function onResize(): void {
  applyLiveBoardSize();
}

function ensureLiveChromeButton(): void {
  const chrome = document.getElementById('chrome-top');
  if (!chrome) return;

  let btn = document.getElementById('split-live');
  if (!btn) {
    btn = document.createElement('k3-button');
    btn.id = 'split-live';
    btn.className = 'split-live-btn';
    btn.setAttribute('variant', 'filled');
    btn.setAttribute('size', 'sm');
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `${msIcon('live_tv')}<span data-live-label>${t('split.live')}</span>`;
    const locale = document.getElementById('locale-menu');
    if (locale?.parentElement === chrome) {
      chrome.insertBefore(btn, locale);
    } else {
      chrome.insertBefore(btn, chrome.firstChild);
    }
    btn.addEventListener('k3-click', () => {
      unlockFlapSound();
      setLive(!live);
    });
    sealLigatures(btn);
  }
  liveChromeBtn = btn;
  syncLiveChromeLabel();
  setLiveChromeVisible(false);
}

/** Mount the Split board page with on-page settings + live mode. */
export function mountSplitPage(page: HTMLElement): {
  show: () => void;
  hide: () => void;
} {
  state = loadState();
  pageIndex = 0;
  editPageIndex = 0;
  pageRoot = page;
  pageGen = 0;
  flipping = false;

  page.innerHTML = `<div class="page-panel split-page">
      <header class="page-header split-header split-chrome">
        <div class="split-header-text">
          <h1 class="page-title">${t('split.title')}</h1>
          <p class="page-tagline">${t('split.tagline')}</p>
        </div>
        <div class="split-header-actions">
          <span id="split-page-indicator" class="split-page-indicator"></span>
        </div>
      </header>

      <div class="split-body">
        <aside class="split-settings split-chrome k3-scroll" aria-label="${t('split.editorTitle')}">
          <p class="split-editor-hint">${t('split.editorHint')}</p>
          <k3-text-field
            id="split-interval"
            class="split-interval-field"
            variant="outlined"
            type="number"
            min="${MIN_INTERVAL_SEC}"
            max="${MAX_INTERVAL_SEC}"
            label="${t('split.interval')}"
            inputmode="numeric"
          ></k3-text-field>
          <div class="split-page-toolbar">
            <k3-select id="split-page-select" class="split-page-select" variant="outlined" label="${t('split.page')}"></k3-select>
            <k3-button id="split-page-add" variant="tonal" size="sm">${t('split.addPage')}</k3-button>
            <k3-button id="split-page-delete" variant="text" size="sm">${t('split.deletePage')}</k3-button>
          </div>
          <div class="split-lines">
            ${Array.from(
              { length: SPLIT_ROWS },
              (_, i) => `<k3-text-field
                id="split-line-${i}"
                class="split-line-field"
                variant="outlined"
                label="${t('split.line')} ${i + 1}"
                maxlength="${SPLIT_COLS}"
                autocomplete="off"
              ></k3-text-field>`,
            ).join('')}
          </div>
          <div class="split-settings-actions">
            <k3-button id="split-apply" variant="filled" size="sm">${t('split.apply')}</k3-button>
          </div>
        </aside>

        <div class="split-stage">
          <div id="split-grid" class="split-grid" role="grid" aria-label="${t('split.title')}"></div>
        </div>
      </div>

      <k3-button id="split-live-exit" class="split-live-exit" variant="tonal" size="sm" hidden>
        ${msIcon('close')}<span>${t('split.exitLive')}</span>
      </k3-button>
    </div>`;

  const grid = document.getElementById('split-grid');
  if (grid) buildGrid(grid);
  fillEditorFields();
  ensureLiveChromeButton();
  void initFlapSound();
  void showPage(0, false);
  sealLigatures(page);

  const unlockOnGesture = (): void => unlockFlapSound();
  page.addEventListener('pointerdown', unlockOnGesture, { once: true });
  document.getElementById('split-apply')?.addEventListener('k3-click', () => {
    unlockFlapSound();
    saveSettingsFromUi(true);
  });
  document.getElementById('split-page-add')?.addEventListener('k3-click', () => addPage());
  document.getElementById('split-page-delete')?.addEventListener('k3-click', () => deletePage());
  document.getElementById('split-page-select')?.addEventListener(
    'k3-change',
    ((event: CustomEvent<{ value?: string }>) => {
      const v = Number(event.detail?.value);
      if (Number.isFinite(v)) selectEditPage(v);
    }) as EventListener,
  );
  document.getElementById('split-interval')?.addEventListener('change', () => {
    state.intervalSec = clampInterval(
      Number((document.getElementById('split-interval') as FieldEl | null)?.value),
    );
    persist();
  });
  document.getElementById('split-live-exit')?.addEventListener('k3-click', () => setLive(false));
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', onResize);

  return {
    show: () => {
      visible = true;
      page.hidden = false;
      ensureLiveChromeButton();
      setLiveChromeVisible(true);
      syncLiveChromeLabel();
      fillEditorFields();
      stopRotation();
      /* Settings only — board preview starts when Live is pressed. */
      void showPage(pageIndex, false);
    },
    hide: () => {
      visible = false;
      setLive(false);
      setLiveChromeVisible(false);
      page.hidden = true;
      stopRotation();
      pageGen += 1;
      flipping = false;
      activeFlips = 0;
      stopFlapSound();
    },
  };
}
