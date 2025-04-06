// src/types/operation.ts
import { Credentials } from './authentication';

/**
 * Categorization of operation types
 */
export enum OperationType {
  READ = 'read',
  WRITE = 'write',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  SEARCH = 'search',
  CUSTOM = 'custom'
}

/**
 * Defines the complexity and expected behavior of an operation
 */
export enum OperationComplexity {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex'
}

/**
 * Represents the current status of an operation
 */
export enum OperationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Schema definition for input and output parameters
 */
export interface OperationSchema {
  /**
   * JSON Schema defining the structure of inputs or outputs
   */
  jsonSchema: Record<string, any>;

  /**
   * Example input or output data
   */
  example?: any;
}

/**
 * Rate limiting configuration for an operation
 */
export interface RateLimitConfig {
  /**
   * Maximum number of calls allowed in the specified interval
   */
  maxCalls: number;

  /**
   * Time interval for rate limiting (in milliseconds)
   */
  interval: number;

  /**
   * Optional strategy for handling rate limit exceeded
   */
  strategy?: 'wait' | 'throw' | 'queue';
}

/**
 * Pagination configuration for list or search operations
 */
export interface PaginationConfig {
  /**
   * Type of pagination supported
   */
  type: 'offset' | 'cursor' | 'page';

  /**
   * Default page size
   */
  defaultPageSize?: number;

  /**
   * Maximum allowed page size
   */
  maxPageSize?: number;
}

/**
 * Configuration for batching multiple operations
 */
export interface BatchConfig {
  /**
   * Maximum number of items in a batch
   */
  maxBatchSize: number;

  /**
   * Supports parallel batch processing
   */
  supportsParallel: boolean;

  /**
   * Timeout for batch operation
   */
  batchTimeout?: number;
}

/**
 * Detailed error information for an operation
 */
export interface OperationError {
  /**
   * Error code specific to the service
   */
  code: string;

  /**
   * Human-readable error message
   */
  message: string;

  /**
   * Detailed error context
   */
  details?: Record<string, any>;

  /**
   * Suggests potential resolution for the error
   */
  suggestedResolution?: string;
}

/**
 * Options for executing an operation
 */
export interface OperationExecutionOptions {
  /**
   * Timeout for the operation (in milliseconds)
   */
  timeout?: number;

  /**
   * Number of retry attempts
   */
  retries?: number;

  /**
   * Backoff strategy for retries
   */
  retryStrategy?: 'linear' | 'exponential' | 'custom';

  /**
   * Additional context for the operation
   */
  context?: Record<string, any>;
}

/**
 * Represents a webhook configuration for event-based operations
 */
export interface WebhookConfig {
  /**
   * Unique identifier for the webhook
   */
  id: string;

  /**
   * URL to receive webhook events
   */
  url: string;

  /**
   * Secret for webhook authentication
   */
  secret?: string;

  /**
   * Types of events to subscribe to
   */
  eventTypes: string[];
}

/**
 * Definition of an operation within a connector
 */
export interface ConnectorOperation {
  /**
   * Unique identifier for the operation
   */
  id: string;

  /**
   * Human-readable name of the operation
   */
  name: string;

  /**
   * Detailed description of the operation
   */
  description?: string;

  /**
   * Type of operation
   */
  type: OperationType;

  /**
   * Input schema for the operation
   */
  inputSchema: OperationSchema;

  /**
   * Output schema for the operation
   */
  outputSchema: OperationSchema;

  /**
   * Complexity of the operation
   */
  complexity?: OperationComplexity;

  /**
   * Rate limiting configuration
   */
  rateLimiting?: RateLimitConfig;

  /**
   * Pagination configuration (for list/search operations)
   */
  pagination?: PaginationConfig;

  /**
   * Batch operation configuration
   */
  batchConfig?: BatchConfig;

  /**
   * Supported webhook configurations
   */
  webhooks?: WebhookConfig[];

  /**
   * Actual execution function for the operation
   */
  execute: (
    inputs: any, 
    credentials: Credentials, 
    options?: OperationExecutionOptions
  ) => Promise<any>;
}

/**
 * Result of an operation execution
 */
export interface OperationResult<T = any> {
  /**
   * Status of the operation
   */
  status: OperationStatus;

  /**
   * Actual data returned by the operation
   */
  data?: T;

  /**
   * Error information if the operation failed
   */
  error?: OperationError;

  /**
   * Metadata about the operation execution
   */
  metadata?: {
    /**
     * Timestamp of operation start
     */
    startTime: number;

    /**
     * Timestamp of operation completion
     */
    endTime: number;

    /**
     * Duration of operation execution
     */
    duration: number;
  };
}

/**
 * Options for registering a new connector operation
 */
export interface RegisterOperationOptions {
  /**
   * Override existing operation if one exists
   */
  overwrite?: boolean;

  /**
   * Validate the operation definition
   */
  validate?: boolean;
}