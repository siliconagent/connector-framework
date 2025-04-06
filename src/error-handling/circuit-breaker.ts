// src/error-handling/circuit-breaker.ts
/**
 * Circuit Breaker configuration options
 */
export interface CircuitBreakerConfig {
  /**
   * Number of failures before opening the circuit
   */
  failureThreshold?: number;

  /**
   * Time to stay in open state before attempting to half-open (in milliseconds)
   */
  recoveryTimeout?: number;

  /**
   * Number of successful calls needed to close the circuit
   */
  successThreshold?: number;
}

/**
 * Circuit states
 */
export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

/**
 * Circuit Breaker for managing service resilience
 */
export class CircuitBreaker {
  /**
   * Current circuit state
   */
  private state: CircuitState = CircuitState.CLOSED;

  /**
   * Number of consecutive failures
   */
  private failures: number = 0;

  /**
   * Number of consecutive successes
   */
  private successes: number = 0;

  /**
   * Timestamp of last state change
   */
  private lastStateChange: number = Date.now();

  /**
   * Configuration with defaults
   */
  private config: Required<CircuitBreakerConfig> = {
    failureThreshold: 5,
    recoveryTimeout: 30000, // 30 seconds
    successThreshold: 3
  };

  /**
   * Constructor
   * @param config Optional configuration
   */
  constructor(config?: CircuitBreakerConfig) {
    this.config = {
      ...this.config,
      ...config
    };
  }

  /**
   * Execute a function with circuit breaker protection
   * @param fn Function to execute
   * @returns Promise resolving to function result
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    this.checkCircuitState();

    try {
      // Execute the function
      const result = await fn();

      // Record success
      this.recordSuccess();

      return result;
    } catch (error) {
      // Record failure
      this.recordFailure(error);

      // Rethrow the error
      throw error;
    }
  }

  /**
   * Check and update circuit state
   */
  private checkCircuitState(): void {
    switch (this.state) {
      case CircuitState.CLOSED:
        // No additional checks needed in closed state
        return;

      case CircuitState.OPEN:
        // Check if recovery timeout has passed
        if (Date.now() - this.lastStateChange >= this.config.recoveryTimeout) {
          // Move to half-open state
          this.state = CircuitState.HALF_OPEN;
          this.successes = 0;
          this.failures = 0;
        } else {
          // Still in open state
          throw new Error('Circuit is OPEN');
        }
        break;

      case CircuitState.HALF_OPEN:
        // Half-open state allows limited calls to test recovery
        break;
    }
  }

  /**
   * Record a successful call
   */
  private recordSuccess(): void {
    switch (this.state) {
      case CircuitState.CLOSED:
        // Reset failure count on success
        this.failures = 0;
        break;

      case CircuitState.HALF_OPEN:
        this.successes++;

        // Close the circuit if success threshold is met
        if (this.successes >= this.config.successThreshold) {
          this.state = CircuitState.CLOSED;
          this.successes = 0;
          this.failures = 0;
          this.lastStateChange = Date.now();
        }
        break;
    }
  }

  /**
   * Record a failed call
   * @param error Error that occurred
   */
  private recordFailure(error?: any): void {
    switch (this.state) {
      case CircuitState.CLOSED:
        this.failures++;

        // Open the circuit if failure threshold is reached
        if (this.failures >= this.config.failureThreshold) {
          this.state = CircuitState.OPEN;
          this.lastStateChange = Date.now();
        }
        break;

      case CircuitState.HALF_OPEN:
        // Immediately return to open state on failure
        this.state = CircuitState.OPEN;
        this.failures = 1;
        this.successes = 0;
        this.lastStateChange = Date.now();
        break;
    }
  }

  /**
   * Get current circuit state
   * @returns Current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastStateChange = Date.now();
  }
}