/** Birthdays — CRUD against /api/birthdays (MongoDB) + clock banner. */
import { getLocale, LOCALE_BCP47, t } from './i18n';
import { msIcon, sealLigatures } from './icons';

export interface Birthday {
  id: string;
  name: string;
  day: number;
  month: number;
  year: number | null;
  note?: string;
}

export interface UpcomingBirthday extends Birthday {
  next: Date;
  daysUntil: number;
  turning: number | null;
}

type SheetEl = HTMLElement & {
  show: () => Promise<boolean>;
  hide: () => Promise<boolean>;
  placement: 'bottom' | 'side';
  side: 'start' | 'end';
  width: 'standard' | 'full';
};

const API = '/api/birthdays';
const KEY_STORAGE = 'bdkey';
const DAY_MS = 86_400_000;

let items: Birthday[] = [];
let loaded = false;
let editingId: string | null = null;
const listeners = new Set<() => void>();

/* ——— helpers ——— */

function fmt(key: string, vars: Record<string, string | number>): string {
  return t(key).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Date of the birthday in a given year (29 Feb → 28 Feb on non-leap years). */
function occurrence(b: Birthday, year: number): Date {
  const day = b.month === 2 && b.day === 29 && !isLeap(year) ? 28 : b.day;
  return new Date(year, b.month - 1, day);
}

export function upcoming(now = new Date()): UpcomingBirthday[] {
  const today = startOfDay(now);
  return items
    .map((b) => {
      let next = occurrence(b, today.getFullYear());
      if (next < today) next = occurrence(b, today.getFullYear() + 1);
      const daysUntil = Math.round((next.getTime() - today.getTime()) / DAY_MS);
      const turning = b.year ? next.getFullYear() - b.year : null;
      return { ...b, next, daysUntil, turning };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));
}

export function birthdaysToday(now = new Date()): UpcomingBirthday[] {
  return upcoming(now).filter((b) => b.daysUntil === 0);
}

export function onBirthdaysChange(fn: () => void): void {
  listeners.add(fn);
}

function emit(): void {
  listeners.forEach((fn) => fn());
}

/* ——— API ——— */

async function request(method: string, url: string, body?: unknown, retry = true): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let key: string | null = null;
  try {
    key = localStorage.getItem(KEY_STORAGE);
  } catch {
    /* storage blocked */
  }
  if (key) headers['x-birthday-key'] = key;
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && retry) {
    const entered = window.prompt(t('bd.keyPrompt'));
    if (entered) {
      try {
        localStorage.setItem(KEY_STORAGE, entered);
      } catch {
        /* storage blocked */
      }
      return request(method, url, body, false);
    }
  }
  return res;
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function loadBirthdays(): Promise<void> {
  const res = await request('GET', API);
  if (!res.ok) throw new Error(await errorMessage(res));
  items = (await res.json()) as Birthday[];
  loaded = true;
  emit();
}

async function saveBirthday(data: Omit<Birthday, 'id'>, id: string | null): Promise<void> {
  const res = id
    ? await request('PUT', `${API}?id=${encodeURIComponent(id)}`, data)
    : await request('POST', API, data);
  if (!res.ok) throw new Error(await errorMessage(res));
  const saved = (await res.json()) as Birthday;
  items = id ? items.map((b) => (b.id === id ? saved : b)) : [...items, saved];
  emit();
}

async function deleteBirthday(id: string): Promise<void> {
  const res = await request('DELETE', `${API}?id=${encodeURIComponent(id)}`);
  if (!res.ok && res.status !== 404) throw new Error(await errorMessage(res));
  items = items.filter((b) => b.id !== id);
  emit();
}

/* ——— rendering ——— */

function monthNames(): string[] {
  const f = new Intl.DateTimeFormat(LOCALE_BCP47[getLocale()], { month: 'long' });
  return Array.from({ length: 12 }, (_, i) => f.format(new Date(2024, i, 1)));
}

function relativeLabel(days: number): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALE_BCP47[getLocale()], { numeric: 'auto' });
  if (days < 7) return rtf.format(days, 'day');
  if (days < 30) return rtf.format(Math.round(days / 7), 'week');
  return rtf.format(Math.round(days / 30.44), 'month');
}

function renderStats(list: UpcomingBirthday[]): string {
  const stat = (n: number, key: string, mod = '') =>
    `<div class="bd-stat${mod}"><span class="bd-stat-n">${n}</span><span class="bd-stat-l">${t(key)}</span></div>`;
  const today = list.filter((b) => b.daysUntil === 0).length;
  return (
    stat(list.length, 'bd.total') +
    stat(list.filter((b) => b.daysUntil <= 30).length, 'bd.next30') +
    stat(list.filter((b) => b.daysUntil <= 7).length, 'bd.week') +
    stat(today, 'bd.today', today ? ' is-today' : '')
  );
}

function renderList(list: UpcomingBirthday[]): string {
  if (!list.length) return `<p class="bd-empty">${t('bd.empty')}</p>`;
  const dateFmt = new Intl.DateTimeFormat(LOCALE_BCP47[getLocale()], { day: 'numeric', month: 'long' });
  return list
    .map((b) => {
      const days = b.daysUntil === 1 ? t('bd.day1') : fmt('bd.days', { n: b.daysUntil });
      const meta = [dateFmt.format(b.next), b.turning ? fmt('bd.turns', { n: b.turning }) : '']
        .filter(Boolean)
        .join(' · ');
      return `<li class="bd-item${b.daysUntil === 0 ? ' is-today' : ''}" data-id="${esc(b.id)}">
        <div class="bd-item-main">
          <span class="bd-name">${b.daysUntil === 0 ? '🎂 ' : ''}${esc(b.name)}</span>
          <span class="bd-meta">${esc(meta)}</span>
          ${b.note ? `<span class="bd-note">${esc(b.note)}</span>` : ''}
        </div>
        <div class="bd-item-when">
          <span class="bd-rel">${esc(relativeLabel(b.daysUntil))}</span>
          <span class="bd-days">${b.daysUntil === 0 ? '' : esc(days)}</span>
        </div>
        <div class="bd-item-actions">
          <k3-icon-button data-action="edit" size="sm" variant="standard" label="${t('bd.edit')}" aria-label="${t('bd.edit')}">${msIcon('edit')}</k3-icon-button>
          <k3-icon-button data-action="delete" size="sm" variant="standard" label="${t('bd.delete')}" aria-label="${t('bd.delete')}">${msIcon('delete')}</k3-icon-button>
        </div>
      </li>`;
    })
    .join('');
}

type FieldEl = HTMLElement & { value: string };

function formMarkup(): string {
  const months = monthNames()
    .map((m, i) => `<k3-menu-item value="${i + 1}">${esc(m)}</k3-menu-item>`)
    .join('');
  const days = Array.from(
    { length: 31 },
    (_, i) => `<k3-menu-item value="${i + 1}">${i + 1}</k3-menu-item>`,
  ).join('');
  return `<form id="bd-form" class="bd-form" hidden novalidate>
      <h3 id="bd-form-title" class="bd-form-title"></h3>
      <k3-text-field id="bd-name" class="bd-field bd-field--full" variant="outlined" label="${t('bd.name')}" maxlength="80" required autocomplete="off"></k3-text-field>
      <k3-select id="bd-day" class="bd-field" variant="outlined" label="${t('bd.day')}" required>${days}</k3-select>
      <k3-select id="bd-month" class="bd-field" variant="outlined" label="${t('bd.month')}" required>${months}</k3-select>
      <k3-text-field id="bd-year" class="bd-field" variant="outlined" label="${t('bd.year')}" type="number" min="1900" max="${new Date().getFullYear()}" inputmode="numeric"></k3-text-field>
      <k3-text-field id="bd-note" class="bd-field bd-field--full" variant="outlined" label="${t('bd.note')}" maxlength="200" autocomplete="off"></k3-text-field>
      <p id="bd-error" class="bd-error" role="alert" hidden></p>
      <div class="bd-form-actions">
        <k3-button id="bd-cancel" variant="text" size="sm">${t('bd.cancel')}</k3-button>
        <k3-button id="bd-save" variant="filled" size="sm">${t('bd.save')}</k3-button>
      </div>
    </form>`;
}

/** Mount the birthdays sheet; returns an opener. */
export function mountBirthdaysUi(opts: { onOpen?: () => void; onClose?: () => void }): () => void {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<k3-sheet id="birthday-sheet" class="settings-sheet birthday-sheet" placement="side" side="end" modal aria-label="${t('bd.title')}">
      <span slot="headline">${t('bd.title')}</span>
      <div class="bd-body">
        <p class="bd-tagline">${t('bd.tagline')}</p>
        <div id="bd-stats" class="bd-stats"></div>
        <div class="bd-toolbar">
          <h3 class="bd-section">${t('bd.upcoming')}</h3>
          <k3-button id="bd-add" variant="tonal" size="sm">${t('bd.add')}</k3-button>
        </div>
        ${formMarkup()}
        <p id="bd-status" class="bd-status" hidden></p>
        <ul id="bd-list" class="bd-list"></ul>
      </div>
      <k3-button slot="actions" id="bd-close" variant="filled" size="sm">${t('bd.close')}</k3-button>
    </k3-sheet>`,
  );

  const sheet = document.getElementById('birthday-sheet') as SheetEl;
  const form = document.getElementById('bd-form') as HTMLFormElement;
  const nameIn = document.getElementById('bd-name') as FieldEl;
  const dayIn = document.getElementById('bd-day') as FieldEl;
  const monthIn = document.getElementById('bd-month') as FieldEl;
  const yearIn = document.getElementById('bd-year') as FieldEl;
  const noteIn = document.getElementById('bd-note') as FieldEl;
  const errorEl = document.getElementById('bd-error') as HTMLElement;
  const statusEl = document.getElementById('bd-status') as HTMLElement;
  let saving = false;

  const render = (): void => {
    const list = upcoming();
    (document.getElementById('bd-stats') as HTMLElement).innerHTML = renderStats(list);
    const ul = document.getElementById('bd-list') as HTMLElement;
    ul.innerHTML = loaded ? renderList(list) : '';
    sealLigatures(ul);
  };
  onBirthdaysChange(render);

  const showError = (msg: string): void => {
    errorEl.textContent = msg;
    errorEl.hidden = !msg;
  };

  const openForm = (b?: Birthday): void => {
    editingId = b?.id ?? null;
    (document.getElementById('bd-form-title') as HTMLElement).textContent = t(b ? 'bd.editTitle' : 'bd.addTitle');
    const today = new Date();
    nameIn.value = b?.name ?? '';
    dayIn.value = String(b?.day ?? today.getDate());
    monthIn.value = String(b?.month ?? today.getMonth() + 1);
    yearIn.value = b?.year ? String(b.year) : '';
    noteIn.value = b?.note ?? '';
    showError('');
    form.hidden = false;
    (nameIn as HTMLElement & { focus?: () => void }).focus?.();
  };
  const closeForm = (): void => {
    form.hidden = true;
    editingId = null;
    showError('');
  };

  const submit = async (): Promise<void> => {
    if (saving) return;
    const name = String(nameIn.value ?? '').trim();
    if (!name) {
      showError(`${t('bd.name')} ?`);
      (nameIn as HTMLElement & { focus?: () => void }).focus?.();
      return;
    }
    saving = true;
    try {
      const yearRaw = String(yearIn.value ?? '').trim();
      await saveBirthday(
        {
          name,
          day: Number(dayIn.value),
          month: Number(monthIn.value),
          year: yearRaw ? Number(yearRaw) : null,
          note: String(noteIn.value ?? '').trim(),
        },
        editingId,
      );
      closeForm();
    } catch (err) {
      showError(fmt('bd.saveError', { msg: (err as Error).message }));
    } finally {
      saving = false;
    }
  };

  document.getElementById('bd-add')?.addEventListener('k3-click', () => openForm());
  document.getElementById('bd-cancel')?.addEventListener('k3-click', closeForm);
  document.getElementById('bd-save')?.addEventListener('k3-click', () => void submit());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    void submit();
  });
  document.getElementById('bd-close')?.addEventListener('k3-click', () => void sheet.hide());
  sheet.addEventListener('k3-close-end', () => {
    closeForm();
    opts.onClose?.();
  });

  const onItemAction = (event: Event): void => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    const id = btn?.closest<HTMLElement>('.bd-item')?.dataset.id;
    const b = items.find((x) => x.id === id);
    if (!btn || !b) return;
    if (btn.dataset.action === 'edit') openForm(b);
    else if (btn.dataset.action === 'delete' && window.confirm(fmt('bd.confirmDelete', { name: b.name }))) {
      deleteBirthday(b.id).catch((err: Error) => {
        statusEl.hidden = false;
        statusEl.textContent = fmt('bd.saveError', { msg: err.message });
      });
    }
  };
  document.getElementById('bd-list')?.addEventListener('k3-click', onItemAction);
  document.getElementById('bd-list')?.addEventListener('click', onItemAction);

  render();

  return () => {
    const phone = window.matchMedia('(max-width: 600px)').matches;
    sheet.placement = phone ? 'bottom' : 'side';
    if (phone) sheet.width = 'full';
    else sheet.side = 'end';
    opts.onOpen?.();
    void sheet.show();
    statusEl.hidden = true;
    loadBirthdays().catch(() => {
      statusEl.hidden = false;
      statusEl.textContent = t('bd.loadError');
    });
  };
}

/** Text for the clock banner — empty when nobody celebrates today. */
export function todayBannerText(now = new Date()): string {
  const list = birthdaysToday(now);
  if (!list.length) return '';
  const names = new Intl.ListFormat(LOCALE_BCP47[getLocale()], { style: 'long', type: 'conjunction' }).format(
    list.map((b) => (b.turning ? `${b.name} (${b.turning})` : b.name)),
  );
  return `🎂 ${fmt('bd.happy', { names })}`;
}
