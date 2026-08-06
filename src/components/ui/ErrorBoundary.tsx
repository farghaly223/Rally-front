import React from 'react';

/**
 * Catches a render-time crash and shows it instead of losing the page.
 *
 * React unmounts the entire tree when a render throws and nothing catches it.
 * With no boundary anywhere in this app that meant the whole root came down and
 * the browser was left showing the bare `#09090b` background — the "black
 * screen" reported when opening Admin Management. The screen was not blank
 * because nothing rendered; it was blank because everything had been torn down.
 *
 * `Suspense` does not help here. It handles a pending promise, not a rejected
 * one and not a throw during render, so a `lazy()` chunk that fails to load
 * falls straight past the fallback and takes the root with it.
 *
 * This is deliberately a class. `componentDidCatch` and
 * `getDerivedStateFromError` have no hook equivalent — there is no way to write
 * an error boundary as a function component.
 */

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Names the failed area in the message, e.g. "Admin Management". */
  label: string;
  /**
   * Changing this remounts the boundary and clears the error.
   *
   * Without it a single crash would poison the slot for the rest of the
   * session: switching to another section and back would re-render the same
   * boundary instance, still holding the old error, and show the failure again
   * for a section that never failed.
   */
  resetKey?: string | number;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override componentDidUpdate(prev: ErrorBoundaryProps): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // The console is the only place the component stack survives; the message
    // below carries just the error, because a stack trace on screen tells an
    // admin nothing they can act on.
    console.error(`[${this.props.label}] render failed`, error, info.componentStack);
  }

  private readonly handleRetry = (): void => {
    this.setState({ error: null });
  };

  override render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className="bento-card rounded-[32px] border border-red-500/30 bg-red-500/5 p-6 md:p-8"
      >
        <div className="mb-3 flex items-center gap-2.5">
          <span className="material-symbols-outlined text-xl text-red-400">error</span>
          <h2 className="font-headline-md text-lg text-white">
            {this.props.label} could not be displayed
          </h2>
        </div>

        <p className="font-body-md text-sm text-zinc-400">
          Something in this section failed to render. Nothing was changed, and the rest
          of the dashboard still works — switch to another section or try again.
        </p>

        <p className="font-body-md mt-3 break-words rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-red-300">
          {error.message}
        </p>

        <button
          type="button"
          onClick={this.handleRetry}
          className="font-label-caps mt-5 cursor-pointer rounded-full border border-zinc-700 bg-zinc-900/80 px-5 py-2.5 text-xs font-bold text-zinc-300 transition-all hover:border-zinc-600 hover:text-white"
        >
          Try Again
        </button>
      </div>
    );
  }
}
