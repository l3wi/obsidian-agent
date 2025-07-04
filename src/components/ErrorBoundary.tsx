import * as React from 'react';
import { Component, ErrorInfo, ReactNode } from 'react';
import { ChatAssistantError } from '../errors/types';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Log error details for debugging
    console.error('Component stack:', errorInfo.componentStack);
    
    // Additional logging for ChatAssistantError
    if (error instanceof ChatAssistantError) {
      console.error('ChatAssistantError details:', {
        code: error.code,
        context: error.context,
        recoverable: error.recoverable,
        retryable: error.retryable,
      });
    }
  }
  
  reset = () => {
    this.setState({ hasError: false, error: null });
  };
  
  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      
      // Default error UI
      const error = this.state.error;
      const userMessage = error instanceof ChatAssistantError 
        ? error.userMessage 
        : 'An unexpected error occurred';
      
      return (
        <div className="error-boundary-fallback">
          <div className="error-container">
            <h3 className="error-title">Something went wrong</h3>
            <p className="error-message">{userMessage}</p>
            {error instanceof ChatAssistantError && error.retryable && (
              <button 
                className="mod-cta"
                onClick={this.reset}
              >
                Try Again
              </button>
            )}
            <details className="error-details">
              <summary>Technical details</summary>
              <pre className="error-stack">{error.stack}</pre>
            </details>
          </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}