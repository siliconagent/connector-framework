// src/core/connector-registry.ts


import { 
  ConnectorDefinition, 
  ConnectorType, 
  ConnectorStatus, 
  RegisterConnectorOptions,
  CreateConnectorConnectionOptions,
  ConnectorConnection
} from '../types/connector';
import { AuthenticationMethod } from '../types/authentication';
import { EventEmitter } from '../events/event-emitter';

/**
 * ConnectorRegistry manages the collection, registration, and lifecycle of connectors
 */
export class ConnectorRegistry {
  /**
   * Internal storage for registered connectors
   */
  private connectors: Map<string, ConnectorDefinition> = new Map();

  /**
   * Active connections for registered connectors
   */
  private connections: Map<string, ConnectorConnection> = new Map();

  /**
   * Event emitter for connector-related events
   */
  private eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();
  }

  /**
   * Register a new connector
   * @param connector Connector definition to register
   * @param options Registration options
   * @returns Registered connector definition
   */
  registerConnector(
    connector: ConnectorDefinition, 
    options: RegisterConnectorOptions = {}
  ): ConnectorDefinition {
    // Validate connector definition
    this.validateConnectorDefinition(connector);

    // Check for existing connector and handle overwrite
    if (this.connectors.has(connector.id) && !options.overwrite) {
      throw new Error(`Connector with ID ${connector.id} already exists. Use overwrite option to replace.`);
    }

    // Perform additional validation if requested
    if (options.validate) {
      this.performAdditionalValidation(connector);
    }

    // Store the connector
    this.connectors.set(connector.id, connector);

    // Emit registration event
    this.eventEmitter.emit('connector:registered', {
      connectorId: connector.id,
      type: connector.type,
      timestamp: Date.now()
    });

    return connector;
  }

  /**
   * Get a registered connector by ID
   * @param connectorId Unique identifier of the connector
   * @returns Connector definition or undefined
   */
  getConnector(connectorId: string): ConnectorDefinition | undefined {
    return this.connectors.get(connectorId);
  }

  /**
   * List all registered connectors
   * @param filters Optional filters to apply
   * @returns Array of connector definitions
   */
  listConnectors(filters: {
    type?: ConnectorType,
    status?: ConnectorStatus,
    authMethod?: AuthenticationMethod
  } = {}): ConnectorDefinition[] {
    return Array.from(this.connectors.values()).filter(connector => {
      if (filters.type && connector.type !== filters.type) return false;
      if (filters.status && connector.status !== filters.status) return false;
      if (filters.authMethod && !connector.authMethods.includes(filters.authMethod)) return false;
      return true;
    });
  }

  /**
   * Create a new connection for a registered connector
   * @param connectorId ID of the connector
   * @param connectionOptions Connection creation options
   * @returns Created connector connection
   */
  createConnection(
    connectorId: string, 
    connectionOptions: CreateConnectorConnectionOptions
  ): ConnectorConnection {
    // Verify connector exists
    const connector = this.getConnector(connectorId);
    if (!connector) {
      throw new Error(`Connector with ID ${connectorId} not found`);
    }

    // Generate unique connection ID
    const connectionId = this.generateConnectionId(connectorId);

    // Create connection object
    const connection: ConnectorConnection = {
      id: connectionId,
      connectorId,
      credentials: connectionOptions.credentials,
      config: connectionOptions.config,
      status: ConnectorStatus.ACTIVE,
      lastConnectionAttempt: Date.now()
    };

    // Store the connection
    this.connections.set(connectionId, connection);

    // Emit connection creation event
    this.eventEmitter.emit('connection:created', {
      connectionId,
      connectorId,
      timestamp: Date.now()
    });

    return connection;
  }

  /**
   * Get a specific connection
   * @param connectionId Unique identifier of the connection
   * @returns Connector connection or undefined
   */
  getConnection(connectionId: string): ConnectorConnection | undefined {
    return this.connections.get(connectionId);
  }

  /**
   * List connections for a specific connector
   * @param connectorId Connector ID to filter connections
   * @returns Array of connector connections
   */
  listConnections(connectorId?: string): ConnectorConnection[] {
    return connectorId
      ? Array.from(this.connections.values()).filter(conn => conn.connectorId === connectorId)
      : Array.from(this.connections.values());
  }

  /**
   * Remove a registered connector
   * @param connectorId ID of the connector to remove
   */
  removeConnector(connectorId: string): void {
    const connector = this.getConnector(connectorId);
    if (!connector) {
      throw new Error(`Connector with ID ${connectorId} not found`);
    }

    // Remove associated connections
    this.connections.forEach((conn, connectionId) => {
      if (conn.connectorId === connectorId) {
        this.connections.delete(connectionId);
      }
    });

    // Remove the connector
    this.connectors.delete(connectorId);

    // Emit removal event
    this.eventEmitter.emit('connector:removed', {
      connectorId,
      timestamp: Date.now()
    });
  }

  /**
   * Remove a specific connection
   * @param connectionId ID of the connection to remove
   */
  removeConnection(connectionId: string): void {
    const connection = this.getConnection(connectionId);
    if (!connection) {
      throw new Error(`Connection with ID ${connectionId} not found`);
    }

    this.connections.delete(connectionId);

    // Emit connection removal event
    this.eventEmitter.emit('connection:removed', {
      connectionId,
      connectorId: connection.connectorId,
      timestamp: Date.now()
    });
  }

  /**
   * Validate basic connector definition
   * @param connector Connector to validate
   */
  private validateConnectorDefinition(connector: ConnectorDefinition): void {
    if (!connector.id) {
      throw new Error('Connector must have a unique ID');
    }

    if (!connector.name) {
      throw new Error('Connector must have a name');
    }

    if (!connector.version) {
      throw new Error('Connector must have a version');
    }

    if (!connector.type) {
      throw new Error('Connector must have a type');
    }

    if (!connector.authMethods || connector.authMethods.length === 0) {
      throw new Error('Connector must support at least one authentication method');
    }
  }

  /**
   * Perform additional in-depth validation
   * @param connector Connector to validate
   */
  private performAdditionalValidation(connector: ConnectorDefinition): void {
    // Check operation definitions
    Object.entries(connector.operations).forEach(([operationId, operation]) => {
      if (!operation.id) {
        throw new Error(`Operation ${operationId} must have an ID`);
      }
    });

    // Additional validation checks can be added here
  }

  /**
   * Generate a unique connection ID
   * @param connectorId Base connector ID
   * @returns Unique connection identifier
   */
  private generateConnectionId(connectorId: string): string {
    return `${connectorId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Subscribe to connector-related events
   * @param eventName Name of the event to subscribe to
   * @param callback Event handler function
   */
  on(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.on(eventName, callback);
  }

  /**
   * Unsubscribe from connector-related events
   * @param eventName Name of the event to unsubscribe from
   * @param callback Event handler function to remove
   */
  off(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.off(eventName, callback);
  }
}

// Export a singleton instance for convenient use
export const connectorRegistry = new ConnectorRegistry();