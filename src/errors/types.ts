export enum ErrorCode {
  // Network errors
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
  
  // API errors
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_KEY_INVALID = 'API_KEY_INVALID',
  API_QUOTA_EXCEEDED = 'API_QUOTA_EXCEEDED',
  
  // Tool errors
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_VALIDATION_FAILED = 'TOOL_VALIDATION_FAILED',
  TOOL_APPROVAL_TIMEOUT = 'TOOL_APPROVAL_TIMEOUT',
  
  // Stream errors
  STREAM_STATE_INVALID = 'STREAM_STATE_INVALID',
  STREAM_INTERRUPTED = 'STREAM_INTERRUPTED',
  STREAM_RESUME_FAILED = 'STREAM_RESUME_FAILED',
  
  // Vault errors
  VAULT_FILE_EXISTS = 'VAULT_FILE_EXISTS',
  VAULT_PERMISSION_DENIED = 'VAULT_PERMISSION_DENIED',
  VAULT_PATH_INVALID = 'VAULT_PATH_INVALID',
}

export interface AppError extends Error {
  code: ErrorCode;
  context?: Record<string, any>;
  recoverable: boolean;
  userMessage: string;
  developerMessage: string;
  timestamp: number;
  retryable: boolean;
  retryAfter?: number; // milliseconds
}

export class ChatAssistantError extends Error implements AppError {
  code: ErrorCode;
  context: Record<string, any>;
  recoverable: boolean;
  userMessage: string;
  developerMessage: string;
  timestamp: number;
  retryable: boolean;
  retryAfter?: number;
  cause?: Error;
  
  constructor(config: {
    code: ErrorCode;
    message: string;
    userMessage: string;
    context?: Record<string, any>;
    recoverable?: boolean;
    retryable?: boolean;
    retryAfter?: number;
    cause?: Error;
  }) {
    super(config.message);
    this.name = 'ChatAssistantError';
    this.code = config.code;
    this.userMessage = config.userMessage;
    this.developerMessage = config.message;
    this.context = config.context || {};
    this.recoverable = config.recoverable ?? false;
    this.retryable = config.retryable ?? false;
    this.retryAfter = config.retryAfter;
    this.timestamp = Date.now();
    this.cause = config.cause;
  }
  
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      userMessage: this.userMessage,
      developerMessage: this.developerMessage,
      context: this.context,
      recoverable: this.recoverable,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}