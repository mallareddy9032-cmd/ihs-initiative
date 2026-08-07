import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  message: string;
  stack?: string;
}

/**
 * Catches render-time React failures so the Doctor Studio never white-screens.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Unknown render error',
      stack: error?.stack,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[DoctorStudio ErrorBoundary]', error, info.componentStack);
  }

  private retry = () => {
    this.setState({ hasError: false, message: '', stack: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="error-boundary-shell">
        <div className="error-boundary-card squircle">
          <p className="login-brand">IHS CLINICAL</p>
          <h1 className="serif">{this.props.fallbackTitle || 'Doctor Studio interrupted'}</h1>
          <p>
            A component failed to render. Your session data is intact — retry to reload the
            Granola clinical workspace.
          </p>
          <div className="error-banner" role="alert">
            {this.state.message}
          </div>
          {this.state.stack && (
            <pre className="error-stack">{this.state.stack.split('\n').slice(0, 6).join('\n')}</pre>
          )}
          <button type="button" className="btn btn-primary ios-press" onClick={this.retry}>
            Retry Doctor Studio
          </button>
          <button
            type="button"
            className="btn btn-ghost ios-press"
            style={{ marginTop: 8 }}
            onClick={() => window.location.reload()}
          >
            Hard refresh
          </button>
        </div>
      </div>
    );
  }
}
