import saintsData from './data/saints.json';

type SaintEntry = [name: string, title: string];

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

type MonthKey = (typeof MONTHS)[number];

const TABLE = saintsData as Record<MonthKey, SaintEntry[]>;

/** French saint / feast label for a local calendar day (1-indexed month via Date). */
export function saintOfDay(date: Date): string {
  const month = MONTHS[date.getMonth()];
  const day = date.getDate();
  const entry = TABLE[month]?.[day - 1];
  if (!entry) return '';
  const [name, title] = entry;
  if (!name) return '';
  if (!title) return name;
  return `${title} ${name}`;
}
