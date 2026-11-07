/// <reference types="vite/client" />

import at1x1 from 'flag-icons/flags/1x1/at.svg?raw';
import be1x1 from 'flag-icons/flags/1x1/be.svg?raw';
import ch1x1 from 'flag-icons/flags/1x1/ch.svg?raw';
import cn1x1 from 'flag-icons/flags/1x1/cn.svg?raw';
import cz1x1 from 'flag-icons/flags/1x1/cz.svg?raw';
import de1x1 from 'flag-icons/flags/1x1/de.svg?raw';
import es1x1 from 'flag-icons/flags/1x1/es.svg?raw';
import fi1x1 from 'flag-icons/flags/1x1/fi.svg?raw';
import fr1x1 from 'flag-icons/flags/1x1/fr.svg?raw';
import gb1x1 from 'flag-icons/flags/1x1/gb.svg?raw';
import gr1x1 from 'flag-icons/flags/1x1/gr.svg?raw';
import hu1x1 from 'flag-icons/flags/1x1/hu.svg?raw';
import il1x1 from 'flag-icons/flags/1x1/il.svg?raw';
import it1x1 from 'flag-icons/flags/1x1/it.svg?raw';
import jp1x1 from 'flag-icons/flags/1x1/jp.svg?raw';
import nl1x1 from 'flag-icons/flags/1x1/nl.svg?raw';
import pl1x1 from 'flag-icons/flags/1x1/pl.svg?raw';
import pt1x1 from 'flag-icons/flags/1x1/pt.svg?raw';
import ro1x1 from 'flag-icons/flags/1x1/ro.svg?raw';
import ru1x1 from 'flag-icons/flags/1x1/ru.svg?raw';
import se1x1 from 'flag-icons/flags/1x1/se.svg?raw';
import tr1x1 from 'flag-icons/flags/1x1/tr.svg?raw';
import ua1x1 from 'flag-icons/flags/1x1/ua.svg?raw';
import { LOCALE_FLAG, type AppLocale, isAppLocale } from './i18n';

const FLAG_SVG: Record<string, string> = {
  fr: fr1x1,
  gb: gb1x1,
  es: es1x1,
  pt: pt1x1,
  de: de1x1,
  at: at1x1,
  ch: ch1x1,
  ru: ru1x1,
  nl: nl1x1,
  be: be1x1,
  se: se1x1,
  it: it1x1,
  fi: fi1x1,
  pl: pl1x1,
  cz: cz1x1,
  ro: ro1x1,
  hu: hu1x1,
  gr: gr1x1,
  ua: ua1x1,
  tr: tr1x1,
  il: il1x1,
  cn: cn1x1,
  jp: jp1x1,
};

export function localeFlagSvg(locale: AppLocale): string {
  return FLAG_SVG[LOCALE_FLAG[locale]] ?? FLAG_SVG.gb ?? '';
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
  /* Items are adopted into k3-split-button → k3-menu shadow */
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
    const item = el.closest('k3-menu-item') as { syncSlots?: () => void } | null;
    item?.syncSlots?.();
  }
  setLocaleFlagEl(document.getElementById('locale-menu-flag'), active);
}
