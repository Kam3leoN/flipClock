export type AppLocale = 'fr' | 'en' | 'es' | 'pt' | 'de' | 'ru';

export const LOCALES: readonly AppLocale[] = [
  'fr',
  'en',
  'es',
  'pt',
  'de',
  'ru',
] as const;

/** ISO 3166-1 for flag-icons (EN → GB). */
export const LOCALE_FLAG: Record<AppLocale, string> = {
  fr: 'fr',
  en: 'gb',
  es: 'es',
  pt: 'pt',
  de: 'de',
  ru: 'ru',
};

export const LOCALE_NATIVE: Record<AppLocale, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
  ru: 'Русский',
};

export const LOCALE_BCP47: Record<AppLocale, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  es: 'es-ES',
  pt: 'pt-PT',
  de: 'de-DE',
  ru: 'ru-RU',
};

type Dict = Record<string, string>;

const fr: Dict = {
  'app.title': 'FlipClock',
  'lang.label': 'Langue',
  'menu.open': 'Menu',
  'menu.settings': 'Réglages',
  'menu.flipclock': 'Dépôt FlipClock',
  'menu.k3ui': 'K3ui Expressive',
  'menu.docs': 'Doc K3ui',
  'settings.title': 'Réglages',
  'settings.done': 'Terminé',
  'settings.saved': 'Préférences enregistrées',
  'opt.hourFormat': 'Format horaire',
  'opt.showDate': 'Afficher la date',
  'opt.showFlaps': 'Afficher les volets',
  'opt.theme': 'Thème',
  'opt.spec': 'Spécification couleur',
  'opt.variant': 'Variante',
  'opt.m2color': 'Couleur M2',
  'opt.customColor': 'Couleur personnalisée',
  'opt.motion': 'Mouvement',
  'opt.scale': 'Échelle',
  'opt.brightness': 'Luminosité',
  'theme.dark': 'Sombre',
  'theme.light': 'Clair',
  'theme.auto': 'Auto',
  'theme.system': 'Système',
  'motion.standard': 'Standard',
  'motion.expressive': 'Expressif',
  'color.custom': 'Personnalisée…',
  'credit.before': '2026 © Code & Design with',
  'credit.after': 'par Kam3leoN',
  'a11y.language': 'Choisir la langue',
  'a11y.settings': 'Ouvrir les réglages',
  'a11y.closeSheet': 'Fermer les réglages',
};

const en: Dict = {
  'app.title': 'FlipClock',
  'lang.label': 'Language',
  'menu.open': 'Menu',
  'menu.settings': 'Settings',
  'menu.flipclock': 'FlipClock repo',
  'menu.k3ui': 'K3ui Expressive',
  'menu.docs': 'K3ui docs',
  'settings.title': 'Settings',
  'settings.done': 'Done',
  'settings.saved': 'Preferences saved',
  'opt.hourFormat': 'Hour format',
  'opt.showDate': 'Show date',
  'opt.showFlaps': 'Show flaps',
  'opt.theme': 'Theme',
  'opt.spec': 'Color spec',
  'opt.variant': 'Variant',
  'opt.m2color': 'M2 color',
  'opt.customColor': 'Custom color',
  'opt.motion': 'Motion',
  'opt.scale': 'Scale',
  'opt.brightness': 'Brightness',
  'theme.dark': 'Dark',
  'theme.light': 'Light',
  'theme.auto': 'Auto',
  'theme.system': 'System',
  'motion.standard': 'Standard',
  'motion.expressive': 'Expressive',
  'color.custom': 'Custom…',
  'credit.before': '2026 © Code & Design with',
  'credit.after': 'by Kam3leoN',
  'a11y.language': 'Choose language',
  'a11y.settings': 'Open settings',
  'a11y.closeSheet': 'Close settings',
};

const es: Dict = {
  'app.title': 'FlipClock',
  'lang.label': 'Idioma',
  'menu.open': 'Menú',
  'menu.settings': 'Ajustes',
  'menu.flipclock': 'Repo FlipClock',
  'menu.k3ui': 'K3ui Expressive',
  'menu.docs': 'Docs K3ui',
  'settings.title': 'Ajustes',
  'settings.done': 'Listo',
  'settings.saved': 'Preferencias guardadas',
  'opt.hourFormat': 'Formato de hora',
  'opt.showDate': 'Mostrar fecha',
  'opt.showFlaps': 'Mostrar solapas',
  'opt.theme': 'Tema',
  'opt.spec': 'Espec. de color',
  'opt.variant': 'Variante',
  'opt.m2color': 'Color M2',
  'opt.customColor': 'Color personalizado',
  'opt.motion': 'Movimiento',
  'opt.scale': 'Escala',
  'opt.brightness': 'Brillo',
  'theme.dark': 'Oscuro',
  'theme.light': 'Claro',
  'theme.auto': 'Auto',
  'theme.system': 'Sistema',
  'motion.standard': 'Estándar',
  'motion.expressive': 'Expresivo',
  'color.custom': 'Personalizado…',
  'credit.before': '2026 © Code & Design with',
  'credit.after': 'por Kam3leoN',
  'a11y.language': 'Elegir idioma',
  'a11y.settings': 'Abrir ajustes',
  'a11y.closeSheet': 'Cerrar ajustes',
};

const pt: Dict = {
  'app.title': 'FlipClock',
  'lang.label': 'Idioma',
  'menu.open': 'Menu',
  'menu.settings': 'Definições',
  'menu.flipclock': 'Repo FlipClock',
  'menu.k3ui': 'K3ui Expressive',
  'menu.docs': 'Docs K3ui',
  'settings.title': 'Definições',
  'settings.done': 'Concluído',
  'settings.saved': 'Preferências guardadas',
  'opt.hourFormat': 'Formato da hora',
  'opt.showDate': 'Mostrar data',
  'opt.showFlaps': 'Mostrar abas',
  'opt.theme': 'Tema',
  'opt.spec': 'Espec. de cor',
  'opt.variant': 'Variante',
  'opt.m2color': 'Cor M2',
  'opt.customColor': 'Cor personalizada',
  'opt.motion': 'Movimento',
  'opt.scale': 'Escala',
  'opt.brightness': 'Brilho',
  'theme.dark': 'Escuro',
  'theme.light': 'Claro',
  'theme.auto': 'Auto',
  'theme.system': 'Sistema',
  'motion.standard': 'Padrão',
  'motion.expressive': 'Expressivo',
  'color.custom': 'Personalizada…',
  'credit.before': '2026 © Code & Design with',
  'credit.after': 'por Kam3leoN',
  'a11y.language': 'Escolher idioma',
  'a11y.settings': 'Abrir definições',
  'a11y.closeSheet': 'Fechar definições',
};

const de: Dict = {
  'app.title': 'FlipClock',
  'lang.label': 'Sprache',
  'menu.open': 'Menü',
  'menu.settings': 'Einstellungen',
  'menu.flipclock': 'FlipClock-Repo',
  'menu.k3ui': 'K3ui Expressive',
  'menu.docs': 'K3ui-Doku',
  'settings.title': 'Einstellungen',
  'settings.done': 'Fertig',
  'settings.saved': 'Einstellungen gespeichert',
  'opt.hourFormat': 'Stundenformat',
  'opt.showDate': 'Datum anzeigen',
  'opt.showFlaps': 'Klappen anzeigen',
  'opt.theme': 'Design',
  'opt.spec': 'Farbspezifikation',
  'opt.variant': 'Variante',
  'opt.m2color': 'M2-Farbe',
  'opt.customColor': 'Benutzerdefinierte Farbe',
  'opt.motion': 'Bewegung',
  'opt.scale': 'Skalierung',
  'opt.brightness': 'Helligkeit',
  'theme.dark': 'Dunkel',
  'theme.light': 'Hell',
  'theme.auto': 'Auto',
  'theme.system': 'System',
  'motion.standard': 'Standard',
  'motion.expressive': 'Expressiv',
  'color.custom': 'Benutzerdefiniert…',
  'credit.before': '2026 © Code & Design with',
  'credit.after': 'von Kam3leoN',
  'a11y.language': 'Sprache wählen',
  'a11y.settings': 'Einstellungen öffnen',
  'a11y.closeSheet': 'Einstellungen schließen',
};

const ru: Dict = {
  'app.title': 'FlipClock',
  'lang.label': 'Язык',
  'menu.open': 'Меню',
  'menu.settings': 'Настройки',
  'menu.flipclock': 'Репозиторий FlipClock',
  'menu.k3ui': 'K3ui Expressive',
  'menu.docs': 'Документация K3ui',
  'settings.title': 'Настройки',
  'settings.done': 'Готово',
  'settings.saved': 'Настройки сохранены',
  'opt.hourFormat': 'Формат времени',
  'opt.showDate': 'Показывать дату',
  'opt.showFlaps': 'Показывать створки',
  'opt.theme': 'Тема',
  'opt.spec': 'Спецификация цвета',
  'opt.variant': 'Вариант',
  'opt.m2color': 'Цвет M2',
  'opt.customColor': 'Свой цвет',
  'opt.motion': 'Движение',
  'opt.scale': 'Масштаб',
  'opt.brightness': 'Яркость',
  'theme.dark': 'Тёмная',
  'theme.light': 'Светлая',
  'theme.auto': 'Авто',
  'theme.system': 'Система',
  'motion.standard': 'Стандарт',
  'motion.expressive': 'Экспрессив',
  'color.custom': 'Свой…',
  'credit.before': '2026 © Code & Design with',
  'credit.after': '— Kam3leoN',
  'a11y.language': 'Выбрать язык',
  'a11y.settings': 'Открыть настройки',
  'a11y.closeSheet': 'Закрыть настройки',
};

const TABLES: Record<AppLocale, Dict> = { fr, en, es, pt, de, ru };

let current: AppLocale = 'en';

export function isAppLocale(value: string): value is AppLocale {
  return (LOCALES as readonly string[]).includes(value);
}

export function detectLocale(): AppLocale {
  const nav = (navigator.language || 'en').toLowerCase();
  const short = nav.slice(0, 2);
  if (isAppLocale(short)) return short;
  return 'en';
}

export function getLocale(): AppLocale {
  return current;
}

export function setLocale(locale: AppLocale): void {
  current = locale;
  document.documentElement.lang = locale;
}

export function t(key: string): string {
  return TABLES[current][key] ?? TABLES.en[key] ?? key;
}

/** Apply `data-i18n` / `data-i18n-aria` / `data-i18n-label` under root. */
export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    const text = t(key);
    if (el.hasAttribute('data-i18n-html')) el.innerHTML = text;
    else el.textContent = text;
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    if (key) el.setAttribute('aria-label', t(key));
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-label]').forEach((el) => {
    const key = el.getAttribute('data-i18n-label');
    if (key) el.setAttribute('label', t(key));
  });
}
