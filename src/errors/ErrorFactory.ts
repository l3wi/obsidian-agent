import { ErrorCode, ChatAssistantError } from './types';

export class ErrorFactory {
  static networkTimeout(context?: Record<string, any>): ChatAssistantError {
    return new ChatAssistantError({
      code: ErrorCode.NETWORK_TIMEOUT,
      message: 'Network request timed out',
      userMessage: 'The request took too long to complete. Please check your internet connection and try again.',
      context,
      recoverable: true,
      retryable: true,
    });
  }
  
  static apiRateLimit(retryAfter: number, context?: Record<string, any>): ChatAssistantError {
    return new ChatAssistantError({
      code: ErrorCode.API_RATE_LIMIT,
      message: `API rate limit exceeded. Retry after ${retryAfter}ms`,
      userMessage: `You've made too many requests. Please wait ${Math.ceil(retryAfter / 1000)} seconds before trying again.`,
      context,
      recoverable: true,
      retryable: true,
      retryAfter,
    });
  }
  
  static invalidApiKey(context?: Record<string, any>): ChatAssistantError {
    return new ChatAssistantError({
      code: ErrorCode.API_KEY_INVALID,
      message: 'Invalid API key provided',
      userMessage: 'Your OpenAI API key appears to be invalid. Please check your settings and update your API key.',
      context,
      recoverable: false,
      retryable: false,
    });
  }
  
  static toolExecutionFailed(toolName: string, error: Error, context?: Record<string, any>): ChatAssistantError {
    return new ChatAssistantError({
      code: ErrorCode.TOOL_EXECUTION_FAILED,
      message: `Tool ${toolName} failed: ${error.message}`,
      userMessage: `The ${toolName} operation failed. ${error.message}`,
      context: { toolName, originalError: error.message, ...context },
      recoverable: true,
      retryable: true,
      cause: error,
    });
  }
  
  static streamStateInvalid(context?: Record<string, any>): ChatAssistantError {
    return new ChatAssistantError({
      code: ErrorCode.STREAM_STATE_INVALID,
      message: 'Stream state is invalid or missing',
      userMessage: 'Unable to continue the conversation. Please try your request again.',
      context,
      recoverable: false,
      retryable: false,
    });
  }
  
  static vaultFileExists(path: string, context?: Record<string, any>): ChatAssistantError {
    return new ChatAssistantError({
      code: ErrorCode.VAULT_FILE_EXISTS,
      message: `File already exists at path: ${path}`,
      userMessage: `A file already exists at "${path}". Please choose a different name or location.`,
      context: { path, ...context },
      recoverable: true,
      retryable: false,
    });
  }
  
  static networkUnavailable(context?: Record<string, any>): ChatAssistantError {
    return new ChatAssistantError({
      code: ErrorCode.NETWORK_UNAVAILABLE,
      message: 'Network is unavailable',
      userMessage: 'Unable to connect to the service. Please check your internet connection.',
      context,
      recoverable: true,
      retryable: true,
    });
  }
  
  static streamResumeFailure(error: Error, context?: Record<string, any>): ChatAssistantError {
    return new ChatAssistantError({
      code: ErrorCode.STREAM_RESUME_FAILED,
      message: `Failed to resume stream: ${error.message}`,
      userMessage: 'Unable to continue after approval. Please try your request again.',
      context,
      recoverable: false,
      retryable: false,
      cause: error,
    });
  }
  
  static toolNotFound(toolName: string, context?: Record<string, any>): ChatAssistantError {
    return new ChatAssistantError({
      code: ErrorCode.TOOL_NOT_FOUND,
      message: `Tool ${toolName} not found`,
      userMessage: `The requested tool "${toolName}" is not available.`,
      context: { toolName, ...context },
      recoverable: false,
      retryable: false,
    });
  }
  
  static toolValidationFailed(toolName: string, validationError: string, context?: Record<string, any>): ChatAssistantError {
    return new ChatAssistantError({
      code: ErrorCode.TOOL_VALIDATION_FAILED,
      message: `Tool ${toolName} validation failed: ${validationError}`,
      userMessage: `Invalid parameters for ${toolName}: ${validationError}`,
      context: { toolName, validationError, ...context },
      recoverable: false,
      retryable: false,
    });
  }
  
  static toolApprovalTimeout(toolName: string, context?: Record<string, any>): ChatAssistantError {
    return new ChatAssistantError({
      code: ErrorCode.TOOL_APPROVAL_TIMEOUT,
      message: `Tool approval for ${toolName} timed out`,
      userMessage: `The approval request for ${toolName} timed out. Please try again.`,
      context: { toolName, ...context },
      recoverable: true,
      retryable: true,
    });
  }
}