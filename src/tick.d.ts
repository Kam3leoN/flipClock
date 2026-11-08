/** Ambient types for vendored @pqina/flip (window.Tick). */
interface TickInstance {
  value: unknown;
  root: HTMLElement;
  destroy(): void;
}

interface TickTimer {
  stop?: () => void;
  pause?: () => void;
  resume?: () => void;
}

interface TickStatic {
  DOM: {
    create(el: HTMLElement | null, options?: Record<string, unknown>): TickInstance;
    destroy(el: HTMLElement): boolean;
    parse(root?: ParentNode): void;
  };
  helper: {
    interval(fn: () => void, ms?: number): TickTimer;
    date(): Date;
  };
  supported: boolean;
}

interface Window {
  Tick: TickStatic;
}

declare const Tick: TickStatic;
