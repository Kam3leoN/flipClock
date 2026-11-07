import { K3UI, type InitOptions } from 'k3ui';

export type ColorMode = 'dark' | 'light' | 'system';

/** Seed — Material expressive violet. */
export const SEED = '#6750A4';

export const SEED_PRESETS = [
  '#6750A4',
  '#006A6A',
  '#8B5000',
  '#B3261E',
  '#1B6EF3',
  '#386A20',
] as const;

const SETTINGS_COMPONENTS = [
  'k3-sheet',
  'k3-fab',
  'k3-button',
  'k3-slider',
  'k3-switch',
  'k3-icon-button',
  'k3-button-segmented',
] as const;

function flipDigitVar(isDark: boolean): void {
  const root = document.documentElement;
  if (isDark) {
    root.style.setProperty(
      '--flip-digit',
      'color-mix(in srgb, var(--md-sys-color-on-surface) 71.1%, transparent)',
    );
    root.style.setProperty(
      '--flip-face-top',
      'var(--md-sys-color-surface-container-high)',
    );
    root.style.setProperty(
      '--flip-face-bottom',
      'var(--md-sys-color-surface-container)',
    );
    root.style.setProperty(
      '--flip-face-inner-top',
      'var(--md-sys-color-surface-container-highest)',
    );
    root.style.setProperty(
      '--flip-face-inner-bottom',
      'var(--md-sys-color-surface-container-high)',
    );
    root.style.setProperty('--flip-gap', 'var(--md-sys-color-background)');
    root.style.setProperty(
      '--flip-seam-top',
      'color-mix(in srgb, var(--md-sys-color-outline) 35%, transparent)',
    );
    root.style.setProperty(
      '--flip-seam-bottom',
      'color-mix(in srgb, var(--md-sys-color-outline-variant) 55%, transparent)',
    );
    root.style.setProperty(
      '--flip-shadow',
      'color-mix(in srgb, var(--md-sys-color-shadow) 50%, transparent)',
    );
  } else {
    root.style.setProperty('--flip-digit', 'var(--md-sys-color-on-surface)');
    root.style.setProperty(
      '--flip-face-top',
      'var(--md-sys-color-surface-container-lowest)',
    );
    root.style.setProperty(
      '--flip-face-bottom',
      'var(--md-sys-color-surface-container-low)',
    );
    root.style.setProperty(
      '--flip-face-inner-top',
      'var(--md-sys-color-surface)',
    );
    root.style.setProperty(
      '--flip-face-inner-bottom',
      'var(--md-sys-color-surface-container-lowest)',
    );
    root.style.setProperty('--flip-gap', 'var(--md-sys-color-surface)');
    root.style.setProperty(
      '--flip-seam-top',
      'color-mix(in srgb, var(--md-sys-color-outline) 45%, transparent)',
    );
    root.style.setProperty(
      '--flip-seam-bottom',
      'color-mix(in srgb, var(--md-sys-color-outline-variant) 70%, transparent)',
    );
    root.style.setProperty(
      '--flip-shadow',
      'color-mix(in srgb, var(--md-sys-color-shadow) 18%, transparent)',
    );
  }
}

export function resolveIsDark(mode: ColorMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function normalizeHex(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let h = raw.trim();
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(h)) return null;
  return h.toUpperCase();
}

/**
 * Apply K3ui Material You Expressive theme (seed + mode).
 * K3ui writes both `--k3-sys-color-*` and `--md-sys-color-*`.
 */
export async function applyExpressiveTheme(
  mode: ColorMode,
  seed = SEED,
): Promise<void> {
  const hex = normalizeHex(seed) ?? SEED;
  const options: InitOptions = {
    theme: {
      seed: hex,
      mode,
      variant: 'expressive',
      specVersion: '2025',
      motion: 'expressive',
      contrast: 'default',
    },
    motion: { reduce: 'system' },
    interaction: { ripple: true },
    haptic: false,
    debug: false,
    components: [...SETTINGS_COMPONENTS],
  };

  await K3UI.init(options);
  flipDigitVar(resolveIsDark(mode));

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue('--md-sys-color-background')
      .trim();
    if (bg) themeMeta.setAttribute('content', bg);
  }
}
