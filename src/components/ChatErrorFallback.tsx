import React from 'react';
import { ChatAssistantError, ErrorCode } from '../errors/types';

interface ChatErrorFallbackProps {
  error: Error;
  onReset: () => void;
}

export const ChatErrorFallback: React.FC<ChatErrorFallbackProps> = ({ error, onReset }) => {
  // Determine error type and provide specific UI
  const getErrorContent = () => {
    if (error instanceof ChatAssistantError) {
      switch (error.code) {
        case ErrorCode.API_KEY_INVALID:
          return {
            icon: '🔑',
            title: 'Invalid API Key',
            message: error.userMessage,
            action: 'Update Settings',
            actionHandler: () => {
              // Open settings modal
              (window as any).app?.setting?.open();
              (window as any).app?.setting?.openTabById('obsidian-agent');
            }
          };
          
        case ErrorCode.API_RATE_LIMIT:
          const waitTime = error.retryAfter ? Math.ceil(error.retryAfter / 1000) : 60;
          return {
            icon: '⏱️',
            title: 'Rate Limit Exceeded',
            message: `Please wait ${waitTime} seconds before trying again.`,
            action: 'Retry',
            actionHandler: onReset,
            disabled: true,
            countdown: waitTime
          };
          
        case ErrorCode.NETWORK_TIMEOUT:
        case ErrorCode.NETWORK_UNAVAILABLE:
          return {
            icon: '🌐',
            title: 'Connection Issue',
            message: error.userMessage,
            action: 'Retry',
            actionHandler: onReset
          };
          
        case ErrorCode.VAULT_FILE_EXISTS:
          return {
            icon: '📁',
            title: 'File Already Exists',
            message: error.userMessage,
            action: 'OK',
            actionHandler: onReset
          };
          
        case ErrorCode.TOOL_APPROVAL_TIMEOUT:
          return {
            icon: '⏰',
            title: 'Approval Timeout',
            message: error.userMessage,
            action: 'Try Again',
            actionHandler: onReset
          };
          
        default:
          return {
            icon: '⚠️',
            title: 'Error',
            message: error.userMessage,
            action: error.retryable ? 'Retry' : 'Close',
            actionHandler: onReset
          };
      }
    }
    
    // Generic error
    return {
      icon: '❌',
      title: 'Unexpected Error',
      message: 'Something went wrong. Please try again.',
      action: 'Retry',
      actionHandler: onReset
    };
  };
  
  const errorContent = getErrorContent();
  const [countdown, setCountdown] = React.useState(errorContent.countdown || 0);
  
  // Handle countdown for rate limit errors
  React.useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);
  
  return (
    <div className="chat-error-fallback">
      <div className="error-icon">{errorContent.icon}</div>
      <h3 className="error-title">{errorContent.title}</h3>
      <p className="error-message">{errorContent.message}</p>
      
      <div className="error-actions">
        <button
          className="mod-cta"
          onClick={errorContent.actionHandler}
          disabled={errorContent.disabled && countdown > 0}
        >
          {countdown > 0 ? `Wait ${countdown}s` : errorContent.action}
        </button>
      </div>
      
      {error instanceof ChatAssistantError && error.context && (
        <details className="error-context">
          <summary>More details</summary>
          <pre>{JSON.stringify(error.context, null, 2)}</pre>
        </details>
      )}
    </div>
  );
};