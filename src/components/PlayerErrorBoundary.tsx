import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  componentName: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PlayerErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary] Caught error in ${this.props.componentName}:`, error, errorInfo);
    
    const targetPort = 8000;
    const backendUrl = window.location.port 
      ? `${window.location.protocol}//${window.location.hostname}:${targetPort}`
      : window.location.origin;
      
    fetch(`${backendUrl}/api/log-client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error.toString(),
        message: error.message || error.toString(),
        stack: error.stack || errorInfo.componentStack,
        component: this.props.componentName
      })
    }).catch(err => console.error("Failed to report error boundary crash to backend:", err));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#090a0f',
          color: '#ffffff',
          padding: '20px',
          textAlign: 'center',
          fontFamily: 'sans-serif'
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#ff4757', marginBottom: '8px' }}>
            Preview Player Stalled or Crashed
          </div>
          <div style={{ fontSize: '12px', color: '#a4b0be', maxWidth: '80%', lineHeight: '1.4', marginBottom: '16px' }}>
            {this.state.error?.message || 'The player timed out loading media assets. This happens when range requests fail or connections stall.'}
          </div>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 16px',
              background: '#3742fa',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            Retry Playback
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
