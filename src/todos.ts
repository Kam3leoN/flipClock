/** To-do list — localStorage + k3ui sheet. */
import { t } from './i18n';
import { msIcon, sealLigatures } from './icons';

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

type SheetEl = HTMLElement & {
  show: () => Promise<boolean>;
  hide: () => Promise<boolean>;
  placement: 'bottom' | 'side';
  side: 'start' | 'end';
  width: 'standard' | 'full';
};

type FieldEl = HTMLElement & { value: string };

const STORAGE_KEY = 'flipflap-todos';

let items: TodoItem[] = [];
const listeners = new Set<() => void>();

function load(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      items = [];
      return;
    }
    const parsed = JSON.parse(raw) as TodoItem[];
    items = Array.isArray(parsed) ? parsed : [];
  } catch {
    items = [];
  }
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* quota */
  }
  listeners.forEach((fn) => fn());
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function renderList(): string {
  if (!items.length) return `<p class="todo-empty">${t('todo.empty')}</p>`;
  return items
    .map((item) => {
      const icon = item.done ? 'check_circle' : 'radio_button_unchecked';
      return `<li class="todo-item${item.done ? ' is-done' : ''}" data-id="${esc(item.id)}">
        <k3-icon-button
          class="todo-toggle"
          data-action="toggle"
          size="sm"
          variant="standard"
          label="${t(item.done ? 'todo.undone' : 'todo.done')}"
          aria-label="${t(item.done ? 'todo.undone' : 'todo.done')}"
        >${msIcon(icon)}</k3-icon-button>
        <span class="todo-text">${esc(item.text)}</span>
        <k3-icon-button
          class="todo-delete"
          data-action="delete"
          size="sm"
          variant="standard"
          label="${t('todo.delete')}"
          aria-label="${t('todo.delete')}"
        >${msIcon('delete')}</k3-icon-button>
      </li>`;
    })
    .join('');
}

/** Mount the to-do sheet; returns an opener. */
export function mountTodosUi(opts: { onOpen?: () => void; onClose?: () => void }): () => void {
  load();
  document.body.insertAdjacentHTML(
    'beforeend',
    `<k3-sheet id="todo-sheet" class="settings-sheet todo-sheet" placement="side" side="end" modal aria-label="${t('todo.title')}">
      <span slot="headline">${t('todo.title')}</span>
      <div class="todo-body">
        <p class="todo-tagline">${t('todo.tagline')}</p>
        <form id="todo-form" class="todo-form" novalidate>
          <k3-text-field
            id="todo-input"
            class="todo-field"
            variant="outlined"
            label="${t('todo.placeholder')}"
            maxlength="120"
            autocomplete="off"
          ></k3-text-field>
          <k3-button id="todo-add" variant="filled" size="sm" type="submit">${t('todo.add')}</k3-button>
        </form>
        <ul id="todo-list" class="todo-list"></ul>
      </div>
      <k3-button slot="actions" id="todo-close" variant="filled" size="sm">${t('todo.close')}</k3-button>
    </k3-sheet>`,
  );

  const sheet = document.getElementById('todo-sheet') as SheetEl;
  const form = document.getElementById('todo-form') as HTMLFormElement;
  const input = document.getElementById('todo-input') as FieldEl;
  const listEl = document.getElementById('todo-list') as HTMLElement;

  const render = (): void => {
    listEl.innerHTML = renderList();
    sealLigatures(listEl);
  };
  listeners.add(render);
  render();

  const add = (): void => {
    const text = String(input.value ?? '').trim();
    if (!text) {
      input.focus?.();
      return;
    }
    items = [{ id: uid(), text, done: false, createdAt: Date.now() }, ...items];
    input.value = '';
    persist();
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    add();
  });
  document.getElementById('todo-add')?.addEventListener('k3-click', (e) => {
    e.preventDefault();
    add();
  });
  document.getElementById('todo-close')?.addEventListener('k3-click', () => void sheet.hide());
  sheet.addEventListener('k3-close-end', () => opts.onClose?.());

  listEl.addEventListener('k3-click', (event) => {
    const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    const id = btn?.closest<HTMLElement>('.todo-item')?.dataset.id;
    if (!btn || !id) return;
    if (btn.dataset.action === 'toggle') {
      items = items.map((it) => (it.id === id ? { ...it, done: !it.done } : it));
      persist();
    } else if (btn.dataset.action === 'delete') {
      items = items.filter((it) => it.id !== id);
      persist();
    }
  });

  return () => {
    const phone = window.matchMedia('(max-width: 600px)').matches;
    sheet.placement = phone ? 'bottom' : 'side';
    if (phone) sheet.width = 'full';
    else sheet.side = 'end';
    opts.onOpen?.();
    void sheet.show();
  };
}
