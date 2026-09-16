import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetAndGoHome = () => {
    // Clear any transient keys if needed
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: 'var(--bg-primary, #090d16)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1.5rem',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          <div style={{
            maxWidth: '540px',
            width: '100%',
            background: 'rgba(17, 24, 39, 0.95)',
            border: '1.5px solid rgba(244, 63, 94, 0.4)',
            borderRadius: '16px',
            padding: '2.5rem 2rem',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)'
          }}>
            <div style={{
              display: 'inline-flex',
              background: 'rgba(244, 63, 94, 0.15)',
              padding: '1rem',
              borderRadius: '50%',
              marginBottom: '1.25rem'
            }}>
              <AlertTriangle size={48} color="#f43f5e" />
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.6rem', color: '#ffffff' }}>
              Exam Session Recovery
            </h2>

            <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              The exam portal encountered an unexpected display issue. Your saved responses are safe on the server.
            </p>

            {this.state.error?.message && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                color: '#fda4af',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                textAlign: 'left',
                marginBottom: '1.75rem',
                overflowX: 'auto'
              }}>
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.4rem',
                  borderRadius: '10px',
                  background: 'var(--primary, #6366f1)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}>
                <RefreshCw size={16} /> Reload Exam Portal
              </button>

              <button
                onClick={this.handleResetAndGoHome}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.4rem',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}>
                <ArrowLeft size={16} /> Return to Portal Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
