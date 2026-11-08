/**
 * Airport-style split-flap board — 8 × 32 cells with charset rotation.
 */
import { t } from './i18n';
import { msIcon, sealLigatures } from './icons';

export const SPLIT_ROWS = 8;
export const SPLIT_COLS = 32;
/** Characters the flaps can land on (space first = blank). */
export const SPLIT_CHARSET =
  " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.:'!?@#&+/";

const STORAGE_KEY = 'flipflap-split-lines';
const STEP_MS = 42;

type DialogEl = HTMLElement & {
  show: () => Promise<boolean>;
  hide: (reason?: string) => Promise<boolean>;
  open: boolean;
};

interface Cell {
  el: HTMLElement;
  face: HTMLElement;
  current: string;
  target: string;
  busy: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

let root: HTMLElement | null = null;
let cells: Cell[][] = [];
let lines: string[] = Array.from({ length: SPLIT_ROWS }, () => '');
let dialog: DialogEl | null = null;

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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

function loadLines(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLines();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultLines();
    return Array.from({ length: SPLIT_ROWS }, (_, i) =>
      padLine(typeof parsed[i] === 'string' ? parsed[i] : ''),
    );
  } catch {
    return defaultLines();
  }
}

function defaultLines(): string[] {
  const blank = ' '.repeat(SPLIT_COLS);
  const out = Array.from({ length: SPLIT_ROWS }, () => blank);
  out[1] = padLine('FLIPFLAP  SPLIT BOARD');
  out[3] = padLine('EDIT TO DISPLAY TEXT');
  out[5] = padLine('AIRPORT STYLE FLAPS');
  return out;
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
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

function flipOnce(cell: Cell, next: string): Promise<void> {
  return new Promise((resolve) => {
    cell.el.classList.remove('is-flipping');
    // force reflow so animation restarts
    void cell.el.offsetWidth;
    cell.el.classList.add('is-flipping');
    const done = (): void => {
      cell.el.removeEventListener('animationend', done);
      paintCell(cell, next);
      cell.el.classList.remove('is-flipping');
      resolve();
    };
    cell.el.addEventListener('animationend', done);
    window.setTimeout(done, 220);
  });
}

async function rotateCellTo(cell: Cell, targetRaw: string): Promise<void> {
  const target = normalizeChar(targetRaw);
  cell.target = target;
  if (cell.busy) return;
  if (cell.current === target) return;
  cell.busy = true;
  let guard = SPLIT_CHARSET.length + 2;
  while (cell.current !== cell.target && guard-- > 0) {
    const next = nextChar(cell.current);
    await flipOnce(cell, next);
    await new Promise((r) => {
      cell.timer = setTimeout(r, STEP_MS);
    });
  }
  paintCell(cell, cell.target);
  cell.busy = false;
}

function setBoardLines(next: string[], animate: boolean): void {
  lines = Array.from({ length: SPLIT_ROWS }, (_, i) => padLine(next[i] ?? ''));
  persist();
  for (let r = 0; r < SPLIT_ROWS; r++) {
    const line = lines[r] ?? '';
    for (let c = 0; c < SPLIT_COLS; c++) {
      const cell = cells[r]?.[c];
      if (!cell) continue;
      const ch = line[c] ?? ' ';
      if (!animate) {
        if (cell.timer) clearTimeout(cell.timer);
        cell.busy = false;
        paintCell(cell, ch);
        cell.target = ch;
      } else {
        const delay = (c + r * 2) * 12 + stepsBetween(cell.current, ch) * 2;
        window.setTimeout(() => {
          void rotateCellTo(cell, ch);
        }, delay);
      }
    }
  }
}

function buildGrid(host: HTMLElement): void {
  const frag = document.createDocumentFragment();
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
        timer: null,
      });
    }
    cells.push(rowCells);
    frag.appendChild(row);
  }
  host.appendChild(frag);
}

function openEditor(): void {
  if (!dialog || !root) return;
  for (let i = 0; i < SPLIT_ROWS; i++) {
    const field = document.getElementById(`split-line-${i}`) as
      | (HTMLElement & { value: string })
      | null;
    if (field) field.value = (lines[i] ?? '').trimEnd();
  }
  void dialog.show();
}

function applyEditor(): void {
  const next = Array.from({ length: SPLIT_ROWS }, (_, i) => {
    const field = document.getElementById(`split-line-${i}`) as
      | (HTMLElement & { value: string })
      | null;
    return String(field?.value ?? '');
  });
  setBoardLines(next, true);
  void dialog?.hide('user');
}

/** Mount the Split board page + editor dialog. */
export function mountSplitPage(page: HTMLElement): {
  show: () => void;
  hide: () => void;
} {
  lines = loadLines();
  page.innerHTML = `<div class="page-panel split-page">
      <header class="page-header split-header">
        <div class="split-header-text">
          <h1 class="page-title">${t('split.title')}</h1>
          <p class="page-tagline">${t('split.tagline')}</p>
        </div>
        <k3-button id="split-edit" variant="tonal" size="sm">
          ${msIcon('edit')}<span>${t('split.edit')}</span>
        </k3-button>
      </header>
      <div class="split-stage">
        <div id="split-grid" class="split-grid" role="grid" aria-label="${t('split.title')}"></div>
      </div>
    </div>
    <k3-dialog id="split-editor" class="split-editor" close-action>
      <span slot="headline">${t('split.editorTitle')}</span>
      <div class="split-editor-body">
        <p class="split-editor-hint">${t('split.editorHint')}</p>
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
      <k3-button slot="actions" id="split-cancel" variant="text" size="sm">${t('split.cancel')}</k3-button>
      <k3-button slot="actions" id="split-apply" variant="filled" size="sm">${t('split.apply')}</k3-button>
    </k3-dialog>`;

  root = page;
  dialog = document.getElementById('split-editor') as DialogEl;
  const grid = document.getElementById('split-grid');
  if (grid) buildGrid(grid);
  setBoardLines(lines, false);
  sealLigatures(page);

  document.getElementById('split-edit')?.addEventListener('k3-click', () => openEditor());
  document.getElementById('split-cancel')?.addEventListener('k3-click', () => {
    void dialog?.hide('user');
  });
  document.getElementById('split-apply')?.addEventListener('k3-click', () => applyEditor());

  return {
    show: () => {
      page.hidden = false;
      // re-run a gentle refresh so flaps animate when entering the page
      setBoardLines(lines, true);
    },
    hide: () => {
      page.hidden = true;
      void dialog?.hide('user');
    },
  };
}

/** Escape helper exported for tests / debug. */
export function previewLine(raw: string): string {
  return esc(padLine(raw));
}
