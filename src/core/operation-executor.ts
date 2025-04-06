// src/core/operation-executor.ts
import { 
  ConnectorOperation, 
  OperationExecutionOptions, 
  OperationResult, 
  OperationStatus,
  OperationError
} from '../types/operation';
import { Credentials } from '../types/authentication';
import { EventEmitter } from '../events/event-emitter';

/**
 * Circuit breaker states
 */
enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  /**
   * Maximum number of failures before opening the circuit
   */
  failureThreshold: number;

  /**
   * Time to wait before attempting to close the circuit
   */
  recoveryTimeout: number;
}

/**
 * Operation execution tracking
 */
interface OperationExecutionTracker {
  /**
   * Total number of executions
   */
  totalExecutions: number;

  /**
   * Number of successful executions
   */
  successfulExecutions: number;

  /**
   * Number of failed executions
   */
  failedExecutions: number;

  /**
   * Average execution time
   */
  averageExecutionTime: number;
}

/**
 * OperationExecutor handles the execution of connector operations
 * with advanced features like retry, circuit breaking, and monitoring
 */
export class OperationExecutor {
  /**
   * Event emitter for operation-related events
   */
  private eventEmitter: EventEmitter;

  /**
   * Tracking of operation executions
   */
  private executionTrackers: Map<string, OperationExecutionTracker> = new Map();

  /**
   * Circuit breaker state for each operation
   */
  private circuitBreakers: Map<string, {
    state: CircuitBreakerState;
    failureCount: number;
    lastFailureTime: number;
  }> = new Map();

  /**
   * Default circuit breaker configuration
   */
  private defaultCircuitBreakerConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeout: 30000 // 30 seconds
  };

  constructor() {
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Execute a connector operation
   * @param operation The operation to execute
   * @param inputs Input parameters for the operation
   * @param credentials Authentication credentials
   * @param options Execution options
   * @returns Promise resolving to operation result
   */
  async executeOperation(
    operation: ConnectorOperation,
    inputs: any,
    credentials: Credentials,
    options: OperationExecutionOptions = {}
  ): Promise<OperationResult> {
    // Merge default and provided options
    const mergedOptions = this.mergeExecutionOptions(options);

    // Create execution context
    const executionContext = {
      operationId: operation.id,
      startTime: Date.now()
    };

    // Check circuit breaker status
    if (!this.canExecuteOperation(operation.id)) {
      return this.createErrorResult(
        operation,
        'CIRCUIT_OPEN',
        'Circuit is currently open. Operation cannot be executed.',
        executionContext
      );
    }

    // Validate inputs against input schema
    try {
      this.validateInputs(operation, inputs);
    } catch (validationError) {
      return this.createErrorResult(
        operation,
        'INVALID_INPUT',
        validationError.message,
        executionContext
      );
    }

    // Execute with retry mechanism
    let result: OperationResult;
    try {
      result = await this.executeWithRetry(
        operation,
        inputs,
        credentials,
        mergedOptions,
        executionContext
      );
      
      // Update execution tracker
      this.updateExecutionTracker(operation.id, true, executionContext.startTime);
      
      // Reset circuit breaker on success
      this.resetCircuitBreaker(operation.id);
      
      return result;
    } catch (error) {
      // Update execution tracker
      this.updateExecutionTracker(operation.id, false, executionContext.startTime);
      
      // Update circuit breaker on failure
      this.recordCircuitBreakerFailure(operation.id);
      
      // Create and return error result
      return this.createErrorResult(
        operation,
        'EXECUTION_FAILED',
        error.message,
        executionContext
      );
    }
  }

  /**
   * Execute operation with retry mechanism
   * @param operation Operation to execute
   * @param inputs Input parameters
   * @param credentials Authentication credentials
   * @param options Execution options
   * @param context Execution context
   * @returns Promise resolving to operation result
   */
  private async executeWithRetry(
    operation: ConnectorOperation,
    inputs: any,
    credentials: Credentials,
    options: Required<OperationExecutionOptions>,
    context: { operationId: string; startTime: number }
  ): Promise<OperationResult> {
    const maxRetries = options.retries ?? 0;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Emit pre-execution event
        this.eventEmitter.emit('operation:before-execution', {
          operationId: context.operationId,
          attempt,
          inputs
        });

        // Execute the operation
        const result = await operation.execute(inputs, credentials, {
          timeout: options.timeout,
          context: options.context
        });

        // Validate output against output schema
        this.validateOutput(operation, result);

        // Emit successful execution event
        this.eventEmitter.emit('operation:executed', {
          operationId: context.operationId,
          attempt,
          result
        });

        // Construct and return successful result
        return {
          status: OperationStatus.COMPLETED,
          data: result,
          metadata: {
            startTime: context.startTime,
            endTime: Date.now(),
            duration: Date.now() - context.startTime
          }
        };
      } catch (error) {
        lastError = error;

        // Emit execution failure event
        this.eventEmitter.emit('operation:execution-failed', {
          operationId: context.operationId,
          attempt,
          error
        });

        // Apply retry strategy if more attempts are possible
        if (attempt < maxRetries) {
          await this.applyRetryBackoff(options, attempt);
        }
      }
    }

    // If all retries fail, throw the last error
    throw lastError ?? new Error('Unknown execution failure');
  }

  /**
   * Apply retry backoff strategy
   * @param options Execution options
   * @param attempt Current retry attempt
   */
  private async applyRetryBackoff(
    options: Required<OperationExecutionOptions>, 
    attempt: number
  ): Promise<void> {
    let waitTime: number;

    switch (options.retryStrategy) {
      case 'linear':
        waitTime = (attempt + 1) * 1000; // Linear backoff
        break;
      case 'exponential':
        waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
        break;
      default:
        waitTime = 1000; // Default to 1 second
    }

    return new Promise(resolve => setTimeout(resolve, waitTime));
  }

  /**
   * Merge default and provided execution options
   * @param options Provided execution options
   * @returns Merged options with defaults
   */
  private mergeExecutionOptions(
    options: OperationExecutionOptions
  ): Required<OperationExecutionOptions> {
    return {
      timeout: options.timeout ?? 30000, // 30 seconds default
      retries: options.retries ?? 0,
      retryStrategy: options.retryStrategy ?? 'linear',
      context: options.context ?? {}
    };
  }

  /**
   * Check if an operation can be executed based on circuit breaker
   * @param operationId ID of the operation
   * @returns Boolean indicating if operation can be executed
   */
  private canExecuteOperation(operationId: string): boolean {
    const circuitBreaker = this.circuitBreakers.get(operationId);
    
    if (!circuitBreaker) {
      return true;
    }

    switch (circuitBreaker.state) {
      case CircuitBreakerState.CLOSED:
        return true;
      case CircuitBreakerState.OPEN:
        // Check if recovery timeout has passed
        return (Date.now() - circuitBreaker.lastFailureTime) > 
          this.defaultCircuitBreakerConfig.recoveryTimeout;
      case CircuitBreakerState.HALF_OPEN:
        return true;
      default:
        return true;
    }
  }

  /**
   * Record a failure in the circuit breaker
   * @param operationId ID of the operation
   */
  private recordCircuitBreakerFailure(operationId: string): void {
    const circuitBreaker = this.circuitBreakers.get(operationId) ?? {
      state: CircuitBreakerState.CLOSED,
      failureCount: 0,
      lastFailureTime: 0
    };

    circuitBreaker.failureCount++;
    circuitBreaker.lastFailureTime = Date.now();

    // Check if failure threshold is reached
    if (circuitBreaker.failureCount >= this.defaultCircuitBreakerConfig.failureThreshold) {
      circuitBreaker.state = CircuitBreakerState.OPEN;
    }

    this.circuitBreakers.set(operationId, circuitBreaker);
  }

  /**
   * Reset circuit breaker for an operation
   * @param operationId ID of the operation
   */
  private resetCircuitBreaker(operationId: string): void {
    const circuitBreaker = this.circuitBreakers.get(operationId);
    
    if (circuitBreaker) {
      circuitBreaker.state = CircuitBreakerState.CLOSED;
      circuitBreaker.failureCount = 0;
    }
  }

  /**
   * Validate inputs against operation's input schema
   * @param operation Operation to validate
   * @param inputs Input parameters
   */
  private validateInputs(operation: ConnectorOperation, inputs: any): void {
    // TODO: Implement JSON Schema validation
    // This is a placeholder for comprehensive input validation
    if (!inputs) {
      throw new Error('Inputs are required');
    }
  }

  /**
   * Validate output against operation's output schema
   * @param operation Operation to validate
   * @param output Operation output
   */
  private validateOutput(operation: ConnectorOperation, output: any): void {
    // TODO: Implement JSON Schema validation
    // This is a placeholder for comprehensive output validation
    if (output === undefined || output === null) {
      throw new Error('Operation must return a valid output');
    }
  }

  /**
   * Create an error result for failed operations
   * @param operation Operation that failed
   * @param code Error code
   * @param message Error message
   * @param context Execution context
   * @returns Operation result with error
   */
  private createErrorResult(
    operation: ConnectorOperation,
    code: string,
    message: string,
    context: { operationId: string; startTime: number }
  ): OperationResult {
    const error: OperationError = {
      code,
      message,
      details: {
        operationId: operation.id
      }
    };

    return {
      status: OperationStatus.FAILED,
      error,
      metadata: {
        startTime: context.startTime,
        endTime: Date.now(),
        duration: Date.now() - context.startTime
      }
    };
  }

  /**
   * Update execution tracker for an operation
   * @param operationId ID of the operation
   * @param success Whether the execution was successful
   * @param startTime Execution start time
   */
  private updateExecutionTracker(
    operationId: string, 
    success: boolean, 
    startTime: number
  ): void {
    const tracker = this.executionTrackers.get(operationId) ?? {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0
    };

    const executionTime = Date.now() - startTime;
    tracker.totalExecutions++;
    
    if (success) {
      tracker.successfulExecutions++;
    } else {
      tracker.failedExecutions++;
    }

    // Update average execution time
    tracker.averageExecutionTime = 
      (tracker.averageExecutionTime * (tracker.totalExecutions - 1) + executionTime) / 
      tracker.totalExecutions;

    this.executionTrackers.set(operationId, tracker);
  }

  /**
   * Subscribe to operation-related events
   * @param eventName Name of the event
   * @param callback Event handler
   */
  on(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.on(eventName, callback);
  }

  /**
   * Unsubscribe from operation-related events
   * @param eventName Name of the event
   * @param callback Event handler to remove
   */
  off(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.off(eventName, callback);
  }

  /**
   * Get execution metrics for an operation
   * @param operationId ID of the operation
   * @returns Execution tracker for the operation
   */
  getExecutionMetrics(operationId: string): OperationExecutionTracker | undefined {
    return this.executionTrackers.get(operationId);
  }
}

// Export a singleton instance for convenient use
export const operationExecutor = new OperationExecutor();