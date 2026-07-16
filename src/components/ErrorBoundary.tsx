import { Component, type ErrorInfo, type ReactNode } from 'react';
import { translate, useLangStore } from '@/i18n';

/**
 * App-wide safety net. If any page throws while rendering, we show a calm,
 * bilingual recovery card instead of a blank white screen — the user always has
 * a way forward (retry the page, or go to the Dashboard). Resets automatically
 * when the route changes (via `resetKey`).
 *
 * The fallback reads the current language directly (not via a hook) so the whole
 * file stays a single class component — no separate function component to trip
 * fast-refresh — and an error screen never needs to re-render on a live change.
 */

interface Props {
  children: ReactNode;
  /** When this value changes (e.g. the route path), the boundary resets. */
  resetKey?: string;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface for the developer console; never crashes the shell.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  private reset = () => this.setState({ hasError: false });

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const t = (key: string) => translate(useLangStore.getState().lang, key);
    return (
      <div className="mx-auto max-w-lg pt-10">
        <div className="card text-center">
          <div className="text-3xl">🛠️</div>
          <h2 className="mt-2 text-base font-semibold text-content">{t('error.title')}</h2>
          <p className="mt-1 text-sm text-content-muted">{t('error.body')}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button className="btn-primary" onClick={this.reset}>
              {t('error.retry')}
            </button>
            <a className="btn-ghost" href="#/" onClick={this.reset}>
              {t('error.home')}
            </a>
          </div>
        </div>
      </div>
    );
  }
}
