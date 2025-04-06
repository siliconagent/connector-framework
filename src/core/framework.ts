// src/core/framework.ts
import { ConnectorRegistry, connectorRegistry } from './connector-registry';
import { OperationExecutor, operationExecutor } from './operation-executor';
import { 
  ConnectorDefinition, 
  CreateConnectorConnectionOptions, 
  RegisterConnectorOptions 
} from '../types/connector';
import { 
  ConnectorOperation, 
  OperationExecutionOptions, 
  OperationResult 
} from '../types/operation';
import { Credentials } from '../types/authentication';
import { EventEmitter } from '../events/event-emitter';

/**
 * Configuration options for the Connector Framework
 */
export interface ConnectorFrameworkConfig {
  /**
   * Custom authentication providers
   */
  authProviders?: any[];

  /**
   * Custom transformers
   */
  transformers?: any[];

  /**
   * Default operation timeout
   */
  defaultTimeout?: number;

  /**
   * Logging configuration
   */
  logging?: {
    /**
     * Enable framework-level logging
     */
    enabled?: boolean;
    
    /**
     * Logging level
     */
    level?: 'debug' | 'info' | 'warn' | 'error';
  };
}

/**
 * Core Connector Framework class
 */
export class ConnectorFramework {
  /**
   * Connector registry instance
   */
  private registry: ConnectorRegistry;

  /**
   * Operation executor instance
   */
  private executor: OperationExecutor;

  /**
   * Event emitter for framework-wide events
   */
  private eventEmitter: EventEmitter;

  /**
   * Framework configuration
   */
  private config: Required<ConnectorFrameworkConfig>;

  /**
   * Default configuration
   */
  private defaultConfig: Required<ConnectorFrameworkConfig> = {
    authProviders: [],
    transformers: [],
    defaultTimeout: 30000, // 30 seconds
    logging: {
      enabled: false,
      level: 'info'
    }
  };

  /**
   * Create a new Connector Framework instance
   * @param config Framework configuration options
   */
  constructor(config: ConnectorFrameworkConfig = {}) {
    // Merge provided config with default config
    this.config = {
      ...this.defaultConfig,
      ...config,
      logging: {
        ...this.defaultConfig.logging,
        ...config.logging
      }
    };

    // Use injected or default instances
    this.registry = connectorRegistry;
    this.executor = operationExecutor;
    this.eventEmitter = new EventEmitter();

    // Initialize framework
    this.initialize();
  }

  /**
   * Initialize the framework
   */
  private initialize(): void {
    // Setup logging
    if (this.config.logging.enabled) {
      this.setupLogging();
    }

    // Register any custom providers
    this.registerCustomProviders();

    // Log framework initialization
    this.log('info', 'Connector Framework initialized');
  }

  /**
   * Register a new connector
   * @param connector Connector definition
   * @param options Registration options
   * @returns Registered connector
   */
  registerConnector(
    connector: ConnectorDefinition, 
    options: RegisterConnectorOptions = {}
  ): ConnectorDefinition {
    try {
      // Log connector registration attempt
      this.log('info', `Registering connector: ${connector.id}`);

      // Register the connector
      const registeredConnector = this.registry.registerConnector(connector, options);

      // Emit registration event
      this.eventEmitter.emit('connector:registered', registeredConnector);

      return registeredConnector;
    } catch (error) {
      // Log registration error
      this.log('error', `Connector registration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a connection for a registered connector
   * @param connectorId Connector identifier
   * @param connectionOptions Connection creation options
   * @returns Created connection
   */
  createConnection(
    connectorId: string, 
    connectionOptions: CreateConnectorConnectionOptions
  ) {
    try {
      // Log connection creation attempt
      this.log('info', `Creating connection for connector: ${connectorId}`);

      // Create the connection
      const connection = this.registry.createConnection(connectorId, connectionOptions);

      // Emit connection creation event
      this.eventEmitter.emit('connection:created', connection);

      return connection;
    } catch (error) {
      // Log connection creation error
      this.log('error', `Connection creation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute an operation for a specific connector
   * @param connectorId Connector identifier
   * @param operationId Operation identifier
   * @param inputs Operation inputs
   * @param connectionId Connection identifier
   * @param options Execution options
   * @returns Operation result
   */
  async executeOperation(
    connectorId: string, 
    operationId: string, 
    inputs: any, 
    connectionId: string, 
    options: OperationExecutionOptions = {}
  ): Promise<OperationResult> {
    try {
      // Log operation execution attempt
      this.log('info', `Executing operation: ${operationId} for connector: ${connectorId}`);

      // Retrieve connector and connection
      const connector = this.registry.getConnector(connectorId);
      const connection = this.registry.getConnection(connectionId);

      if (!connector) {
        throw new Error(`Connector ${connectorId} not found`);
      }

      if (!connection) {
        throw new Error(`Connection ${connectionId} not found`);
      }

      // Retrieve the specific operation
      const operation = connector.operations[operationId];

      if (!operation) {
        throw new Error(`Operation ${operationId} not found in connector ${connectorId}`);
      }

      // Execute the operation
      const result = await this.executor.executeOperation(
        operation, 
        inputs, 
        connection.credentials, 
        {
          ...options,
          timeout: options.timeout ?? this.config.defaultTimeout
        }
      );

      // Emit operation execution event
      this.eventEmitter.emit('operation:executed', {
        connectorId,
        operationId,
        result
      });

      return result;
    } catch (error) {
      // Log operation execution error
      this.log('error', `Operation execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * List registered connectors
   * @param filters Optional filters
   * @returns List of registered connectors
   */
  listConnectors(filters: any = {}) {
    return this.registry.listConnectors(filters);
  }

  /**
   * List connections for a connector
   * @param connectorId Optional connector ID to filter connections
   * @returns List of connections
   */
  listConnections(connectorId?: string) {
    return this.registry.listConnections(connectorId);
  }

  /**
   * Subscribe to framework events
   * @param eventName Event name
   * @param callback Event handler
   */
  on(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.on(eventName, callback);
  }

  /**
   * Unsubscribe from framework events
   * @param eventName Event name
   * @param callback Event handler
   */
  off(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.off(eventName, callback);
  }

  /**
   * Register custom providers
   */
  private registerCustomProviders(): void {
    // Register authentication providers
    this.config.authProviders.forEach(provider => {
      // TODO: Implement provider registration logic
      this.log('debug', `Registering custom auth provider: ${provider}`);
    });

    // Register transformers
    this.config.transformers.forEach(transformer => {
      // TODO: Implement transformer registration logic
      this.log('debug', `Registering custom transformer: ${transformer}`);
    });
  }

  /**
   * Setup logging
   */
  private setupLogging(): void {
    // Basic logging setup
    // In a real-world scenario, this would integrate with a logging framework
    this.log = (level, message) => {
      if (this.shouldLog(level)) {
        console.log(`[${level.toUpperCase()}] ${message}`);
      }
    };
  }

  /**
   * Determine if a log message should be output
   * @param level Log level
   * @returns Boolean indicating if the message should be logged
   */
  private shouldLog(level: string): boolean {
    const logLevels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = logLevels.indexOf(this.config.logging.level);
    const messageLevelIndex = logLevels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Logging method (will be replaced in setupLogging)
   */
  private log: (level: string, message: string) => void = () => {};
}

/**
 * Factory function to create a Connector Framework instance
 * @param config Framework configuration
 * @returns Connector Framework instance
 */
export function createConnectorFramework(
  config: ConnectorFrameworkConfig = {}
): ConnectorFramework {
  return new ConnectorFramework(config);
}