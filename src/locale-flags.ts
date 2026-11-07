/// <reference types="vite/client" />

import de1x1 from 'flag-icons/flags/1x1/de.svg?raw';
import es1x1 from 'flag-icons/flags/1x1/es.svg?raw';
import fr1x1 from 'flag-icons/flags/1x1/fr.svg?raw';
import gb1x1 from 'flag-icons/flags/1x1/gb.svg?raw';
import pt1x1 from 'flag-icons/flags/1x1/pt.svg?raw';
import ru1x1 from 'flag-icons/flags/1x1/ru.svg?raw';
import {
  LOCALE_FLAG,
  type AppLocale,
  isAppLocale,
} from './i18n';

const FLAG_SVG: Record<string, string> = {
  fr: fr1x1,
  gb: gb1x1,
  es: es1x1,
  pt: pt1x1,
  de: de1x1,
  ru: ru1x1,
};

export function localeFlagSvg(locale: AppLocale): string {
  return FLAG_SVG[LOCALE_FLAG[locale]] ?? '';
}

export function setLocaleFlagEl(el: HTMLElement | null, locale: AppLocale): void {
  if (!el) return;
  el.classList.add('flag-icon', 'flag-icon--1x1');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('translate', 'no');
  el.innerHTML = localeFlagSvg(locale);
}

function localeFlagHosts(): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const add = (el: HTMLElement): void => {
    if (!seen.has(el)) seen.add(el);
  };
  document.querySelectorAll<HTMLElement>('[data-locale-flag]').forEach(add);
  document.querySelectorAll('k3-split-button').forEach((split) => {
    const menu = split.shadowRoot?.querySelector('k3-menu');
    menu?.querySelectorAll<HTMLElement>('[data-locale-flag]').forEach(add);
  });
  return [...seen];
}

export function mountLocaleFlags(active: AppLocale): void {
  for (const el of localeFlagHosts()) {
    const code = el.getAttribute('data-locale-flag');
    if (!code || !isAppLocale(code)) continue;
    setLocaleFlagEl(el, code);
  }
  const lead = document.getElementById('locale-menu-flag');
  setLocaleFlagEl(lead, active);
}
