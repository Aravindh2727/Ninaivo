import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', padding: '20px' }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '32px 20px', borderColor: 'var(--accent-rose)' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              color: 'var(--accent-rose)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-main)' }}>
              Something Unexpected Happened
            </h2>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '22px' }}>
              Your diary data is safely preserved in local storage. An unexpected view rendering issue occurred.
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="filter-chip"
                style={{ padding: '8px 14px', fontSize: '0.78rem' }}
                onClick={this.handleGoHome}
              >
                <Home size={14} style={{ marginRight: '4px' }} />
                Return to Home
              </button>

              <button
                type="button"
                className="btn-primary"
                style={{ padding: '8px 16px', fontSize: '0.78rem' }}
                onClick={this.handleReload}
              >
                <RotateCcw size={14} style={{ marginRight: '4px' }} />
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

