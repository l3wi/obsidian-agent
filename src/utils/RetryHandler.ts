import { ErrorCode, ChatAssistantError } from '../errors/types';

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: ErrorCode[];
  onRetry?: (attempt: number, error: Error) => void;
}

export class RetryHandler {
  private static defaultConfig: RetryConfig = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      ErrorCode.NETWORK_TIMEOUT,
      ErrorCode.NETWORK_UNAVAILABLE,
      ErrorCode.API_RATE_LIMIT,
      ErrorCode.TOOL_EXECUTION_FAILED,
    ],
  };
  
  static async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...this.defaultConfig, ...config };
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (!this.isRetryable(error, finalConfig)) {
          throw error;
        }
        
        // Check if we've exhausted attempts
        if (attempt === finalConfig.maxAttempts) {
          throw new ChatAssistantError({
            code: ErrorCode.NETWORK_UNAVAILABLE,
            message: `Operation failed after ${finalConfig.maxAttempts} attempts`,
            userMessage: 'The operation failed multiple times. Please try again later.',
            context: { attempts: attempt, lastError: lastError.message },
            recoverable: false,
            retryable: false,
            cause: lastError,
          });
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, error, finalConfig);
        
        // Notify retry callback
        if (finalConfig.onRetry) {
          finalConfig.onRetry(attempt, error as Error);
        }
        
        // Wait before retrying
        await this.delay(delay);
      }
    }
    
    throw lastError!;
  }
  
  private static isRetryable(error: any, config: RetryConfig): boolean {
    // Check if it's a ChatAssistantError with retryable flag
    if (error instanceof ChatAssistantError) {
      return error.retryable && (config.retryableErrors?.includes(error.code) ?? false);
    }
    
    // Check common retryable conditions
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // Check OpenAI specific errors
    if (error.status === 429 || error.status === 503) {
      return true;
    }
    
    return false;
  }
  
  private static calculateDelay(attempt: number, error: any, config: RetryConfig): number {
    // Use retry-after header if available
    if (error instanceof ChatAssistantError && error.retryAfter) {
      return error.retryAfter;
    }
    
    // Calculate exponential backoff
    const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * exponentialDelay;
    
    // Ensure we don't exceed max delay
    return Math.min(exponentialDelay + jitter, config.maxDelay);
  }
  
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}