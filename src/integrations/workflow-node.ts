// src/integrations/workflow-node.ts
import { ConnectorOperation } from '../types/operation';
import { ConnectorConnection } from '../types/connector';
import { EventEmitter } from '../events/event-emitter';

/**
 * Workflow node status
 */
export enum WorkflowNodeStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

/**
 * Workflow node configuration
 */
export interface WorkflowNodeConfig {
  /**
   * Unique identifier for the node
   */
  id: string;

  /**
   * Name of the workflow node
   */
  name?: string;

  /**
   * Connector ID
   */
  connectorId: string;

  /**
   * Operation ID to execute
   */
  operationId: string;

  /**
   * Connection ID to use
   */
  connectionId: string;

  /**
   * Input mapping configuration
   */
  inputMapping?: Record<string, string>;

  /**
   * Output mapping configuration
   */
  outputMapping?: Record<string, string>;

  /**
   * Conditional execution configuration
   */
  condition?: WorkflowNodeCondition;

  /**
   * Error handling strategy
   */
  errorHandling?: WorkflowNodeErrorHandling;

  /**
   * Retry configuration
   */
  retry?: WorkflowNodeRetryConfig;
}

/**
 * Condition for workflow node execution
 */
export type WorkflowNodeCondition = (context: WorkflowContext) => boolean;

/**
 * Error handling configuration
 */
export interface WorkflowNodeErrorHandling {
  /**
   * Strategy for handling errors
   */
  strategy: 'continue' | 'stop' | 'retry';

  /**
   * Custom error handler
   */
  handler?: (error: Error, context: WorkflowContext) => any;
}

/**
 * Retry configuration
 */
export interface WorkflowNodeRetryConfig {
  /**
   * Maximum number of retry attempts
   */
  maxAttempts?: number;

  /**
   * Delay between retry attempts (in milliseconds)
   */
  delay?: number;

  /**
   * Backoff strategy
   */
  backoffStrategy?: 'linear' | 'exponential';
}

/**
 * Workflow context
 */
export interface WorkflowContext {
  /**
   * Global workflow variables
   */
  variables: Record<string, any>;

  /**
   * Workflow-level metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Workflow node execution result
 */
export interface WorkflowNodeResult {
  /**
   * Status of the node execution
   */
  status: WorkflowNodeStatus;

  /**
   * Output data from the node
   */
  output?: any;

  /**
   * Any error that occurred
   */
  error?: Error;

  /**
   * Execution metadata
   */
  metadata?: {
    /**
     * Start time of execution
     */
    startTime: number;

    /**
     * End time of execution
     */
    endTime: number;

    /**
     * Execution duration
     */
    duration: number;

    /**
     * Number of retry attempts
     */
    retryAttempts?: number;
  };
}

/**
 * Workflow Node for executing connector operations in a workflow
 */
export class WorkflowNode {
  /**
   * Event emitter for workflow node events
   */
  private eventEmitter: EventEmitter;

  constructor(private config: WorkflowNodeConfig) {
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Execute the workflow node
   * @param context Workflow context
   * @param connectorFramework Connector framework instance
   * @returns Workflow node execution result
   */
  async execute(
    context: WorkflowContext, 
    connectorFramework: any
  ): Promise<WorkflowNodeResult> {
    const startTime = Date.now();
    let retryAttempts = 0;

    // Check conditional execution
    if (this.config.condition && !this.config.condition(context)) {
      return this.createResult(WorkflowNodeStatus.SKIPPED, startTime);
    }

    while (true) {
      try {
        // Prepare inputs
        const inputs = this.mapInputs(context);

        // Emit pre-execution event
        this.eventEmitter.emit('node:before-execution', {
          nodeId: this.config.id,
          inputs,
          context
        });

        // Execute the operation
        const result = await connectorFramework.executeOperation(
          this.config.connectorId,
          this.config.operationId,
          inputs,
          this.config.connectionId
        );

        // Map and store output
        const output = this.mapOutputs(result.data, context);

        // Emit successful execution event
        this.eventEmitter.emit('node:executed', {
          nodeId: this.config.id,
          output,
          context
        });

        // Return successful result
        return {
          status: WorkflowNodeStatus.COMPLETED,
          output,
          metadata: {
            startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime,
            retryAttempts
          }
        };
      } catch (error) {
        // Emit execution failure event
        this.eventEmitter.emit('node:execution-failed', {
          nodeId: this.config.id,
          error,
          context
        });

        // Handle error based on configuration
        const shouldRetry = this.shouldRetry(error, retryAttempts);

        if (shouldRetry) {
          // Apply retry delay
          await this.applyRetryDelay(retryAttempts);
          retryAttempts++;
          continue;
        }

        // Handle error based on error handling strategy
        return this.handleError(error, context, startTime, retryAttempts);
      }
    }
  }

  /**
   * Map inputs based on input mapping configuration
   * @param context Workflow context
   * @returns Mapped inputs
   */
  private mapInputs(context: WorkflowContext): Record<string, any> {
    if (!this.config.inputMapping) return {};

    return Object.entries(this.config.inputMapping).reduce(
      (mappedInputs, [inputKey, contextPath]) => {
        // Extract value from context using the specified path
        const value = this.extractValueFromContext(context, contextPath);
        mappedInputs[inputKey] = value;
        return mappedInputs;
      },
      {} as Record<string, any>
    );
  }

  /**
   * Map outputs based on output mapping configuration
   * @param output Operation output
   * @param context Workflow context
   * @returns Mapped outputs
   */
  private mapOutputs(output: any, context: WorkflowContext): any {
    if (!this.config.outputMapping) return output;

    // If output is an object, map specific fields
    if (typeof output === 'object' && output !== null) {
      return Object.entries(this.config.outputMapping).reduce(
        (mappedOutput, [contextPath, outputKey]) => {
          // Store output value in context
          this.setValueInContext(context, contextPath, output[outputKey]);
          return mappedOutput;
        },
        {} as Record<string, any>
      );
    }

    return output;
  }

  /**
   * Extract value from context using dot notation
   * @param context Workflow context
   * @param path Dot-notated path
   * @returns Extracted value
   */
  private extractValueFromContext(context: WorkflowContext, path: string): any {
    return path.split('.').reduce(
      (current, key) => current && current[key] !== undefined ? current[key] : undefined,
      context.variables
    );
  }

  /**
   * Set value in context using dot notation
   * @param context Workflow context
   * @param path Dot-notated path
   * @param value Value to set
   */
  private setValueInContext(context: WorkflowContext, path: string, value: any): void {
    const segments = path.split('.');
    const lastKey = segments.pop()!;
    
    const target = segments.reduce((current, key) => {
      if (!(key in current)) {
        current[key] = {};
      }
      return current[key];
    }, context.variables);

    target[lastKey] = value;
  }

  /**
   * Determine if the operation should be retried
   * @param error Error that occurred
   * @param retryAttempts Current number of retry attempts
   * @returns Boolean indicating if retry should occur
   */
  private shouldRetry(error: Error, retryAttempts: number): boolean {
    const retryConfig = this.config.retry;

    // No retry configuration
    if (!retryConfig) return false;

    // Check maximum retry attempts
    if (retryConfig.maxAttempts !== undefined && 
        retryAttempts >= retryConfig.maxAttempts) {
      return false;
    }

    // TODO: Add more sophisticated retry logic 
    // (e.g., check for specific error types)
    return true;
  }

  /**
   * Apply retry delay based on configuration
   * @param retryAttempts Current number of retry attempts
   */
  private async applyRetryDelay(retryAttempts: number): Promise<void> {
    const retryConfig = this.config.retry;
    if (!retryConfig || !retryConfig.delay) return;

    // Calculate delay based on backoff strategy
    let delay = retryConfig.delay;
    if (retryConfig.backoffStrategy === 'exponential') {
      delay *= Math.pow(2, retryAttempts);
    }

    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Handle error based on error handling configuration
   * @param error Error that occurred
   * @param context Workflow context
   * @param startTime Execution start time
   * @param retryAttempts Number of retry attempts
   * @returns Workflow node result
   */
  private handleError(
    error: Error, 
    context: WorkflowContext, 
    startTime: number,
    retryAttempts: number
  ): WorkflowNodeResult {
    const errorHandling = this.config.errorHandling;

    // Custom error handler
    if (errorHandling?.handler) {
      try {
        const customHandlerResult = errorHandling.handler(error, context);
        return {
          status: WorkflowNodeStatus.COMPLETED,
          output: customHandlerResult,
          metadata: {
            startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime,
            retryAttempts
          }
        };
      } catch (handlerError) {
        error = handlerError;
      }
    }

    // Handle based on strategy
    switch (errorHandling?.strategy) {
      case 'continue':
        return {
          status: WorkflowNodeStatus.COMPLETED,
          error,
          metadata: {
            startTime,
            endTime: Date.now(),
            duration: Date.now() - startTime,
            retryAttempts
          }
        };
      
      case 'stop':
      default:
        return this.createResult(
          WorkflowNodeStatus.FAILED, 
          startTime, 
          error, 
          retryAttempts
        );
    }
  }

  /**
   * Create a workflow node result
   * @param status Node status
   * @param startTime Execution start time
   * @param error Optional error
   * @param retryAttempts Number of retry attempts
   * @returns Workflow node result
   */
  private createResult(
    status: WorkflowNodeStatus, 
    startTime: number, 
    error?: Error,
    retryAttempts: number = 0
  ): WorkflowNodeResult {
    return {
      status,
      error,
      metadata: {
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        retryAttempts
      }
    };
  }

  /**
   * Subscribe to workflow node events
   * @param eventName Event name
   * @param callback Event handler
   */
  on(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.on(eventName, callback);
  }

  /**
   * Unsubscribe from workflow node events
   * @param eventName Event name
   * @param callback Event handler
   */
  off(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.off(eventName, callback);
  }
}