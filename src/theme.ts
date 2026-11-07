import {
  K3UI,
  M2_PALETTE_NAMES,
  M2_PALETTES,
  type InitOptions,
  type M2PaletteName,
} from 'k3ui';

export type ColorMode = 'dark' | 'light' | 'system';
export type ColorSpecVersion = '2021' | '2025';
export type MotionScheme = 'standard' | 'expressive';
export type ColorVariant =
  | 'tonalspot'
  | 'vibrant'
  | 'fidelity'
  | 'expressive'
  | 'monochrome'
  | 'neutral'
  | 'rainbow'
  | 'fruitsalad';

export type { M2PaletteName };
export { M2_PALETTE_NAMES, M2_PALETTES };

/** Seed — Material expressive violet (Deep Purple 500). */
export const SEED = '#673AB7';

export const COLOR_VARIANTS: readonly ColorVariant[] = [
  'tonalspot',
  'vibrant',
  'fidelity',
  'expressive',
  'monochrome',
  'neutral',
  'rainbow',
  'fruitsalad',
] as const;

export const VARIANT_LABELS: Record<ColorVariant, string> = {
  tonalspot: 'Tonal spot',
  vibrant: 'Vibrant',
  fidelity: 'Fidelity',
  expressive: 'Expressive',
  monochrome: 'Monochrome',
  neutral: 'Neutral',
  rainbow: 'Rainbow',
  fruitsalad: 'Fruit salad',
};

const SETTINGS_COMPONENTS = [
  'k3-sheet',
  'k3-fab-menu',
  'k3-fab-menu-item',
  'k3-button',
  'k3-slider',
  'k3-switch',
  'k3-button-segmented',
  'k3-select',
] as const;

export interface ThemeConfig {
  mode: ColorMode;
  seed: string;
  variant: ColorVariant;
  specVersion: ColorSpecVersion;
  motion: MotionScheme;
}

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

export function parseColorVariant(raw: string | null | undefined): ColorVariant {
  return COLOR_VARIANTS.includes(raw as ColorVariant)
    ? (raw as ColorVariant)
    : 'expressive';
}

export function parseSpecVersion(raw: string | null | undefined): ColorSpecVersion {
  return raw === '2021' ? '2021' : '2025';
}

export function parseMotionScheme(raw: string | null | undefined): MotionScheme {
  return raw === 'standard' ? 'standard' : 'expressive';
}

export function m2Label(name: M2PaletteName): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function m2SeedHex(name: M2PaletteName): string | null {
  return normalizeHex(M2_PALETTES[name]['500']);
}

/** Match seed to an M2 500 swatch, else `null` (custom). */
export function findM2Palette(seed: string): M2PaletteName | null {
  const hex = normalizeHex(seed);
  if (!hex) return null;
  for (const name of M2_PALETTE_NAMES) {
    if (normalizeHex(M2_PALETTES[name]['500']) === hex) return name;
  }
  return null;
}

/**
 * Apply K3ui Material You theme (seed · mode · variant · spec · motion).
 * Writes both `--k3-sys-color-*` and `--md-sys-color-*`.
 */
export async function applyExpressiveTheme(config: ThemeConfig): Promise<void> {
  const hex = normalizeHex(config.seed) ?? SEED;
  const options: InitOptions = {
    theme: {
      seed: hex,
      mode: config.mode,
      variant: config.variant,
      specVersion: config.specVersion,
      motion: config.motion,
      contrast: 'default',
    },
    motion: { reduce: 'system' },
    interaction: { ripple: true },
    haptic: false,
    debug: false,
    components: [...SETTINGS_COMPONENTS],
  };

  await K3UI.init(options);
  flipDigitVar(resolveIsDark(config.mode));

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue('--md-sys-color-background')
      .trim();
    if (bg) themeMeta.setAttribute('content', bg);
  }
}
