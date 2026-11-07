/** Translate-safe Material Symbols ligature host. */
export function msIcon(name: string, filled = false): string {
  const fill = filled ? ' style="font-variation-settings:\'FILL\' 1,\'wght\' 400,\'GRAD\' 0,\'opsz\' 24"' : '';
  return `<span class="ms notranslate" translate="no" lang="zxx" data-k3-icon="${name}" aria-hidden="true"${fill}></span>`;
}

/** Red heart SVG — never clipped by font metrics / overflow. */
export const HEART_SVG = `<svg class="heart-svg" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;

/** Seal light-DOM ligature hosts (empty text + data-k3-icon). */
export function sealLigatures(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('.ms, [data-k3-icon]').forEach((el) => {
    el.classList.add('ms', 'notranslate');
    el.setAttribute('translate', 'no');
    el.setAttribute('lang', 'zxx');
    const name =
      el.getAttribute('data-k3-icon')?.trim() ||
      (el.textContent ?? '').trim();
    if (!name) return;
    el.setAttribute('data-k3-icon', name);
    el.textContent = '';
  });
}
