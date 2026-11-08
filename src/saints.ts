/** Nominis — https://nominis.cef.fr/ (calendrier des fêtes / prénoms). */

export type FeastGender = 'm' | 'f' | 'other';

export interface FeastItem {
  name: string;
  gender: FeastGender;
}

interface NominisPrenom {
  id?: string;
  sexe?: string;
  pays?: string;
  lien?: string;
}

interface NominisPayload {
  response?: {
    prenoms?: {
      majeurs?: Record<string, NominisPrenom>;
      derives?: Record<string, NominisPrenom>;
    };
  };
}

const CACHE_PREFIX = 'nominis-feasts-';

function genderFromSexe(sexe: string | undefined): FeastGender {
  const s = (sexe ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (s.startsWith('masculin') || s === 'm' || s === 'homme') return 'm';
  if (s.startsWith('feminin') || s === 'f' || s === 'femme') return 'f';
  return 'other';
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function readCache(key: string): FeastItem[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeastItem[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, items: FeastItem[]): void {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(items));
  } catch {
    /* quota */
  }
}

function collectPrenoms(
  map: Record<string, NominisPrenom> | undefined,
  out: FeastItem[],
  seen: Set<string>,
): void {
  if (!map) return;
  for (const [name, meta] of Object.entries(map)) {
    const label = name.trim();
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push({ name: label, gender: genderFromSexe(meta?.sexe) });
  }
}

function parseNominis(data: NominisPayload): FeastItem[] {
  const prenoms = data.response?.prenoms;
  const out: FeastItem[] = [];
  const seen = new Set<string>();
  collectPrenoms(prenoms?.majeurs, out, seen);
  collectPrenoms(prenoms?.derives, out, seen);
  return out;
}

/** Fetch today's (or given day) feasts from Nominis — majeurs then dérivés. */
export async function fetchFeastsOfDay(date: Date): Promise<FeastItem[]> {
  const key = dayKey(date);
  const cached = readCache(key);
  if (cached) return cached;

  const jour = date.getDate();
  const mois = date.getMonth() + 1;
  const annee = date.getFullYear();
  const url =
    `https://nominis.cef.fr/json/nominis.php?jour=${jour}&mois=${mois}&annee=${annee}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Nominis HTTP ${res.status}`);
  const data = (await res.json()) as NominisPayload;
  const items = parseNominis(data);
  writeCache(key, items);
  return items;
}

/** Build light-DOM spans for colored feast names. */
export function feastsToHtml(items: FeastItem[]): string {
  if (!items.length) return '';
  return items
    .map((item, i) => {
      /* Virgule entre chaque saint·e, aucune après le/la dernier·ère. */
      const sep = i === 0 ? '' : '<span class="feast-sep">, </span>';
      const cls =
        item.gender === 'm'
          ? 'feast feast--m'
          : item.gender === 'f'
            ? 'feast feast--f'
            : 'feast feast--other';
      const safe = item.name
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      return `${sep}<span class="${cls}">${safe}</span>`;
    })
    .join('');
}
