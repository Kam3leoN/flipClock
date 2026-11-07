import {
  Hct,
  SchemeExpressive,
  hexFromArgb,
} from '@material/material-color-utilities';

/** Seed — Material expressive violet (detached primary, Spec 2025). */
export const SEED_ARGB = 0xff6750a4;

export type ColorMode = 'dark' | 'light' | 'system';

const COLOR_ROLES = [
  'primary',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'secondary',
  'onSecondary',
  'secondaryContainer',
  'onSecondaryContainer',
  'tertiary',
  'onTertiary',
  'tertiaryContainer',
  'onTertiaryContainer',
  'error',
  'onError',
  'errorContainer',
  'onErrorContainer',
  'background',
  'onBackground',
  'surface',
  'onSurface',
  'surfaceVariant',
  'onSurfaceVariant',
  'surfaceContainerLowest',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'surfaceContainerHighest',
  'outline',
  'outlineVariant',
  'inverseSurface',
  'inverseOnSurface',
  'inversePrimary',
  'surfaceTint',
  'shadow',
  'scrim',
] as const;

type ColorRole = (typeof COLOR_ROLES)[number];

function toKebab(role: string): string {
  return role.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function schemeColor(scheme: SchemeExpressive, role: ColorRole): number {
  return scheme[role] as number;
}

/** Resolve effective dark/light from preference + OS. */
export function resolveIsDark(mode: ColorMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Apply Material You Expressive (Spec 2025) CSS custom properties on `:root`.
 * Also sets shape / motion tokens used by the chrome UI.
 */
export function applyExpressiveTheme(isDark: boolean, seedArgb = SEED_ARGB): void {
  const scheme = new SchemeExpressive(
    Hct.fromInt(seedArgb),
    isDark,
    0.0,
    '2025',
    'phone',
  );

  const root = document.documentElement;
  root.dataset.theme = isDark ? 'dark' : 'light';
  root.style.colorScheme = isDark ? 'dark' : 'light';

  for (const role of COLOR_ROLES) {
    root.style.setProperty(
      `--md-sys-color-${toKebab(role)}`,
      hexFromArgb(schemeColor(scheme, role)),
    );
  }

  // Material You Expressive shape scale (dp → px @ 1x)
  root.style.setProperty('--md-sys-shape-corner-none', '0px');
  root.style.setProperty('--md-sys-shape-corner-extra-small', '4px');
  root.style.setProperty('--md-sys-shape-corner-small', '8px');
  root.style.setProperty('--md-sys-shape-corner-medium', '12px');
  root.style.setProperty('--md-sys-shape-corner-large', '16px');
  root.style.setProperty('--md-sys-shape-corner-extra-large', '28px');
  root.style.setProperty('--md-sys-shape-corner-extra-large-increased', '32px');
  root.style.setProperty('--md-sys-shape-corner-full', '9999px');

  // Emphasized motion (M3 Expressive)
  root.style.setProperty(
    '--md-sys-motion-easing-emphasized',
    'cubic-bezier(0.2, 0, 0, 1)',
  );
  root.style.setProperty(
    '--md-sys-motion-easing-emphasized-decelerate',
    'cubic-bezier(0.05, 0.7, 0.1, 1)',
  );
  root.style.setProperty(
    '--md-sys-motion-easing-emphasized-accelerate',
    'cubic-bezier(0.3, 0, 0.8, 0.15)',
  );
  root.style.setProperty('--md-sys-motion-duration-short1', '50ms');
  root.style.setProperty('--md-sys-motion-duration-short2', '100ms');
  root.style.setProperty('--md-sys-motion-duration-short3', '150ms');
  root.style.setProperty('--md-sys-motion-duration-short4', '200ms');
  root.style.setProperty('--md-sys-motion-duration-medium1', '250ms');
  root.style.setProperty('--md-sys-motion-duration-medium2', '300ms');
  root.style.setProperty('--md-sys-motion-duration-medium3', '350ms');
  root.style.setProperty('--md-sys-motion-duration-medium4', '400ms');
  root.style.setProperty('--md-sys-motion-duration-long1', '450ms');
  root.style.setProperty('--md-sys-motion-duration-long2', '500ms');

  // Spacing (8dp grid)
  root.style.setProperty('--md-sys-spacing-space100', '8px');
  root.style.setProperty('--md-sys-spacing-space150', '12px');
  root.style.setProperty('--md-sys-spacing-space200', '16px');
  root.style.setProperty('--md-sys-spacing-space300', '24px');

  // Flip surfaces: dark keeps classic charcoal flaps; light uses stronger containers.
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

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute(
      'content',
      hexFromArgb(scheme.surface),
    );
  }
}
