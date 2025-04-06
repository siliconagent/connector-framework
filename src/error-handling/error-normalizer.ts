// src/error-handling/error-normalizer.ts
/**
 * Represents a normalized error structure
 */
export interface NormalizedError {
  /**
   * Unique error code
   */
  code: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Error severity level
   */
  severity: 'low' | 'medium' | 'high' | 'critical';

  /**
   * Additional error context
   */
  context?: Record<string, any>;

  /**
   * Original error object
   */
  originalError?: Error;
}

/**
 * Error Normalizer for standardizing error handling
 */
export class ErrorNormalizer {
  /**
   * Normalize an error
   * @param error Error to normalize
   * @param defaultContext Optional default context
   * @returns Normalized error
   */
  static normalize(
    error: Error | string, 
    defaultContext: Record<string, any> = {}
  ): NormalizedError {
    // Handle string errors
    if (typeof error === 'string') {
      return {
        code: 'UNKNOWN_ERROR',
        message: error,
        severity: 'medium',
        context: defaultContext
      };
    }

    // Handle Error objects
    return {
      code: this.extractErrorCode(error),
      message: error.message,
      severity: this.determineErrorSeverity(error),
      context: {
        ...defaultContext,
        ...this.extractErrorContext(error)
      },
      originalError: error
    };
  }

  /**
   * Extract error code
   * @param error Error object
   * @returns Error code
   */
  private static extractErrorCode(error: Error): string {
    // Check for known error types
    if (error.name === 'ValidationError') return 'VALIDATION_ERROR';
    if (error.name === 'NetworkError') return 'NETWORK_ERROR';
    if (error.name === 'AuthenticationError') return 'AUTH_ERROR';
    
    // Generate a generic code based on error name or message
    return (error.name || 'UNKNOWN_ERROR').toUpperCase().replace(/\s+/g, '_');
  }

  /**
   * Determine error severity
   * @param error Error object
   * @returns Error severity
   */
  private static determineErrorSeverity(error: Error): NormalizedError['severity'] {
    const message = error.message.toLowerCase();

    // Severity heuristics
    if (message.includes('critical') || message.includes('fatal')) return 'critical';
    if (message.includes('unauthorized') || message.includes('forbidden')) return 'high';
    if (message.includes('invalid') || message.includes('error')) return 'medium';
    
    return 'low';
  }

  /**
   * Extract additional error context
   * @param error Error object
   * @returns Error context
   */
  private static extractErrorContext(error: Error): Record<string, any> {
    // TypeScript-specific error context extraction
    const anyError = error as any;

    return {
      name: error.name,
      stack: error.stack,
      ...(anyError.code && { code: anyError.code }),
      ...(anyError.errno && { errno: anyError.errno }),
      ...(anyError.syscall && { syscall: anyError.syscall })
    };
  }

  /**
   * Create a new error with normalized structure
   * @param code Error code
   * @param message Error message
   * @param severity Error severity
   * @param context Additional context
   * @returns Normalized error
   */
  static create(
    code: string, 
    message: string, 
    severity: NormalizedError['severity'] = 'medium',
    context: Record<string, any> = {}
  ): NormalizedError {
    return {
      code,
      message,
      severity,
      context
    };
  }
}