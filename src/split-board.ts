/**
 * Airport-style split-flap board — 8 × 24 cells, multi-page rotation, live mode.
 */
import { t } from './i18n';
import { msIcon, sealLigatures } from './icons';

export const SPLIT_ROWS = 8;
export const SPLIT_COLS = 24;
/** Characters the flaps can land on (space first = blank). */
export const SPLIT_CHARSET =
  " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.:'!?@#&+/";

const STORAGE_KEY = 'flipflap-split-board';
const LEGACY_KEY = 'flipflap-split-lines';
const DEFAULT_INTERVAL_SEC = 8;
const MIN_INTERVAL_SEC = 3;
const MAX_INTERVAL_SEC = 120;

type FieldEl = HTMLElement & { value: string };

interface Cell {
  el: HTMLElement;
  face: HTMLElement;
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
let rotateTimer: ReturnType<typeof setInterval> | null = null;
let visible = false;
let live = false;
let pageRoot: HTMLElement | null = null;

function blankPage(): string[] {
  return Array.from({ length: SPLIT_ROWS }, () => ' '.repeat(SPLIT_COLS));
}

function normalizeChar(raw: string): string {
  const c = (raw || ' ').toUpperCase();
  return SPLIT_CHARSET.includes(c) ? c : ' ';
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

function paintCell(cell: Cell, ch: string): void {
  cell.current = ch;
  cell.face.textContent = ch === ' ' ? '' : ch;
  cell.el.classList.toggle('is-blank', ch === ' ');
}

function delay(ms: number, cell: Cell, gen: number): Promise<boolean> {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(cell.gen === gen), ms);
  });
}

function flipOnce(cell: Cell, next: string): Promise<void> {
  return new Promise((resolve) => {
    cell.el.classList.remove('is-flipping');
    void cell.el.offsetWidth;
    cell.el.classList.add('is-flipping');
    const done = (): void => {
      cell.el.removeEventListener('animationend', done);
      paintCell(cell, next);
      cell.el.classList.remove('is-flipping');
      resolve();
    };
    cell.el.addEventListener('animationend', done);
    window.setTimeout(done, 160);
  });
}

async function rotateCellAirport(cell: Cell, targetRaw: string): Promise<void> {
  const target = normalizeChar(targetRaw);
  cell.target = target;
  const gen = ++cell.gen;
  cell.busy = true;

  const base = stepsBetween(cell.current, target);
  let remaining =
    base === 0
      ? Math.random() < 0.12
        ? SPLIT_CHARSET.length
        : 0
      : base + Math.floor(Math.random() * 3) * SPLIT_CHARSET.length + Math.floor(Math.random() * 8);

  const stepMs = 28 + Math.floor(Math.random() * 36);

  while (remaining > 0) {
    if (cell.gen !== gen) return;
    remaining -= 1;
    const next = remaining === 0 ? target : nextChar(cell.current);
    await flipOnce(cell, next);
    if (!(await delay(stepMs, cell, gen))) return;
  }

  if (cell.gen === gen) {
    paintCell(cell, target);
    cell.busy = false;
  }
}

function showPage(index: number, animate: boolean): void {
  if (!state.pages.length) return;
  pageIndex = ((index % state.pages.length) + state.pages.length) % state.pages.length;
  const page = state.pages[pageIndex] ?? blankPage();
  syncPageIndicator();

  for (let r = 0; r < SPLIT_ROWS; r++) {
    const line = page[r] ?? ' '.repeat(SPLIT_COLS);
    for (let c = 0; c < SPLIT_COLS; c++) {
      const cell = cells[r]?.[c];
      if (!cell) continue;
      const ch = line[c] ?? ' ';
      if (!animate) {
        cell.gen += 1;
        cell.busy = false;
        paintCell(cell, ch);
        cell.target = ch;
      } else {
        const startDelay = Math.floor(Math.random() * 520) + c * 18 + r * 28;
        window.setTimeout(() => {
          void rotateCellAirport(cell, ch);
        }, startDelay);
      }
    }
  }
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
    clearInterval(rotateTimer);
    rotateTimer = null;
  }
}

function startRotation(): void {
  stopRotation();
  if (!visible || state.pages.length < 2 || state.intervalSec < MIN_INTERVAL_SEC) return;
  rotateTimer = setInterval(() => {
    showPage(pageIndex + 1, true);
  }, state.intervalSec * 1000);
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
      const el = document.createElement('div');
      el.className = 'split-cell is-blank';
      el.setAttribute('role', 'gridcell');
      el.innerHTML = `<span class="split-cell-face" aria-hidden="true"></span>
        <span class="split-cell-seam" aria-hidden="true"></span>`;
      const face = el.querySelector('.split-cell-face') as HTMLElement;
      row.appendChild(el);
      rowCells.push({
        el,
        face,
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

function saveSettingsFromUi(animate: boolean): void {
  const interval = document.getElementById('split-interval') as FieldEl | null;
  state.intervalSec = clampInterval(Number(interval?.value ?? DEFAULT_INTERVAL_SEC));
  state.pages[editPageIndex] = readEditorPageLines();
  persist();
  pageIndex = Math.min(pageIndex, state.pages.length - 1);
  showPage(pageIndex, animate);
  startRotation();
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
  showPage(pageIndex, true);
  startRotation();
}

function selectEditPage(next: number): void {
  if (next === editPageIndex || next < 0 || next >= state.pages.length) return;
  state.pages[editPageIndex] = readEditorPageLines();
  editPageIndex = next;
  fillEditorFields();
  persist();
}

function setLive(on: boolean): void {
  live = on;
  document.body.classList.toggle('split-live', on);
  document.documentElement.classList.toggle('split-live', on);
  pageRoot?.classList.toggle('is-live', on);
  const liveBtn = document.getElementById('split-live');
  const exitBtn = document.getElementById('split-live-exit');
  if (liveBtn) {
    liveBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const label = liveBtn.querySelector('[data-live-label]');
    if (label) label.textContent = t(on ? 'split.exitLive' : 'split.live');
  }
  if (exitBtn) exitBtn.hidden = !on;
  if (on) {
    void document.documentElement.requestFullscreen?.().catch(() => {
      /* optional */
    });
  } else if (document.fullscreenElement) {
    void document.exitFullscreen?.().catch(() => {
      /* optional */
    });
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (!live) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    setLive(false);
  }
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

  page.innerHTML = `<div class="page-panel split-page">
      <header class="page-header split-header split-chrome">
        <div class="split-header-text">
          <h1 class="page-title">${t('split.title')}</h1>
          <p class="page-tagline">${t('split.tagline')}</p>
        </div>
        <div class="split-header-actions">
          <span id="split-page-indicator" class="split-page-indicator"></span>
          <k3-button id="split-live" class="split-live-btn" variant="filled" size="sm" aria-pressed="false">
            ${msIcon('live_tv')}<span data-live-label>${t('split.live')}</span>
          </k3-button>
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
  showPage(0, false);
  sealLigatures(page);

  document.getElementById('split-apply')?.addEventListener('k3-click', () => saveSettingsFromUi(true));
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
    startRotation();
  });
  document.getElementById('split-live')?.addEventListener('k3-click', () => setLive(!live));
  document.getElementById('split-live-exit')?.addEventListener('k3-click', () => setLive(false));
  window.addEventListener('keydown', onKeydown);
  document.addEventListener('fullscreenchange', () => {
    if (live && !document.fullscreenElement) {
      /* user exited OS fullscreen — keep live CSS unless they pressed Escape */
    }
  });

  return {
    show: () => {
      visible = true;
      page.hidden = false;
      fillEditorFields();
      showPage(pageIndex, true);
      startRotation();
    },
    hide: () => {
      visible = false;
      setLive(false);
      page.hidden = true;
      stopRotation();
    },
  };
}
