
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { analytics } from '../services/analytics';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    analytics.track('app_crash', { 
        message: error.message, 
        stack: error.stack,
        componentStack: errorInfo.componentStack 
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white p-4 text-center">
          <div className="bg-zinc-900 border border-red-900/50 p-8 rounded-xl max-w-md shadow-2xl">
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                <AlertTriangle size={32} />
            </div>
            <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
            <p className="text-zinc-400 text-sm mb-6">
              The application encountered an unexpected error.
            </p>
            <div className="bg-black/30 p-3 rounded text-left mb-6 overflow-auto max-h-32">
                <code className="text-[10px] text-red-400 font-mono">
                    {this.state.error?.message}
                </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-studio-accent hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg flex items-center justify-center gap-2 mx-auto transition-colors"
            >
              <RefreshCw size={16} /> Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
