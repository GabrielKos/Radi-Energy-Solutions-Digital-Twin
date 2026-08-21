import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Shown in the fallback so the user knows which screen failed. */
  label?: string;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Without this, one bad render anywhere in the tab body unmounts the entire
 * app and leaves a blank white page — which is exactly what happened when the
 * warehouses table came back empty and `activeWh.name` threw. A tab that
 * cannot render should cost you that tab, not the whole session.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  // Declared explicitly because this project has no `@types/react` installed,
  // so `React.Component`'s generic base resolves to `any` and TypeScript cannot
  // see the inherited `props` / `state` / `setState` members. (Installing
  // @types/react + @types/react-dom is the real fix — see the review notes;
  // `npm run lint` is currently a no-op for every React file because of it.)
  declare props: Props;
  declare setState: (s: State) => void;
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? '', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    // A tab switch should clear a previous tab's failure.
    if (prev.label !== this.props.label && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center gap-4 p-10 min-h-[60vh] text-center">
        <div className="p-3 rounded-xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            This view hit an error{this.props.label ? ` (${this.props.label})` : ''}
          </h2>
          <p className="text-xs mt-1 max-w-md text-slate-500 dark:text-gray-400">
            The rest of the app is still running — switch tabs to keep working. Details are in
            the browser console.
          </p>
          <pre className="text-[10px] mt-3 max-w-md overflow-x-auto text-left p-2 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-gray-400">
            {this.state.error.message}
          </pre>
        </div>
        <button
          onClick={() => {
            this.setState({ error: null });
            this.props.onReset?.();
          }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Try again
        </button>
      </div>
    );
  }
}
