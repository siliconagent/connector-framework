// src/performance/connection-pool.ts
import { EventEmitter } from '../events/event-emitter';

/**
 * Connection interface for pooling
 */
export interface PoolableConnection {
  /**
   * Unique identifier for the connection
   */
  id: string;

  /**
   * Check if the connection is still valid
   */
  isValid(): Promise<boolean>;

  /**
   * Close the connection
   */
  close(): Promise<void>;
}

/**
 * Connection factory function type
 */
export type ConnectionFactory<T extends PoolableConnection> = () => Promise<T>;

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  /**
   * Minimum number of connections to maintain
   */
  minConnections?: number;

  /**
   * Maximum number of connections in the pool
   */
  maxConnections?: number;

  /**
   * Connection idle timeout (in milliseconds)
   */
  idleTimeout?: number;

  /**
   * Connection acquisition timeout (in milliseconds)
   */
  acquireTimeout?: number;
}

/**
 * Connection Pool for managing and reusing connections
 */
export class ConnectionPool<T extends PoolableConnection> {
  /**
   * Event emitter for pool-related events
   */
  private eventEmitter: EventEmitter;

  /**
   * Available (idle) connections
   */
  private availableConnections: T[] = [];

  /**
   * Currently active connections
   */
  private activeConnections: T[] = [];

  /**
   * Pending connection requests
   */
  private pendingRequests: Array<(connection: T) => void> = [];

  /**
   * Connection factory function
   */
  private connectionFactory: ConnectionFactory<T>;

  /**
   * Pool configuration
   */
  private config: Required<ConnectionPoolConfig> = {
    minConnections: 5,
    maxConnections: 20,
    idleTimeout: 30000, // 30 seconds
    acquireTimeout: 5000 // 5 seconds
  };

  /**
   * Interval for cleaning up idle connections
   */
  private cleanupInterval?: NodeJS.Timeout;

  /**
   * Constructor
   * @param connectionFactory Function to create new connections
   * @param config Optional pool configuration
   */
  constructor(
    connectionFactory: ConnectionFactory<T>, 
    config: ConnectionPoolConfig = {}
  ) {
    this.connectionFactory = connectionFactory;
    this.config = { ...this.config, ...config };
    this.eventEmitter = new EventEmitter();

    // Initialize minimum connections
    this.initializeMinConnections();

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Acquire a connection from the pool
   * @returns Promise resolving to a connection
   */
  async acquire(): Promise<T> {
    // Check if a connection is immediately available
    const availableConnection = this.getAvailableConnection();
    if (availableConnection) {
      return availableConnection;
    }

    // Check if we can create a new connection
    if (this.canCreateNewConnection()) {
      return this.createNewConnection();
    }

    // Wait for a connection to become available
    return this.waitForConnection();
  }

  /**
   * Release a connection back to the pool
   * @param connection Connection to release
   */
  async release(connection: T): Promise<void> {
    // Remove from active connections
    const activeIndex = this.activeConnections.indexOf(connection);
    if (activeIndex !== -1) {
      this.activeConnections.splice(activeIndex, 1);
    }

    // Check connection validity before returning to available pool
    try {
      const isValid = await connection.isValid();
      if (isValid) {
        this.availableConnections.push(connection);
        
        // Resolve any pending requests
        this.resolvePendingRequest(connection);
      } else {
        // Invalid connection, close it
        await connection.close();
      }
    } catch (error) {
      // Close connection if validation fails
      await connection.close();
    }

    // Emit release event
    this.eventEmitter.emit('connection:released', {
      connectionId: connection.id,
      timestamp: Date.now()
    });
  }

  /**
   * Close all connections and stop the pool
   */
  async close(): Promise<void> {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Close all connections
    const allConnections = [
      ...this.availableConnections, 
      ...this.activeConnections
    ];

    await Promise.all(
      allConnections.map(conn => conn.close())
    );

    // Clear connection lists
    this.availableConnections = [];
    this.activeConnections = [];
  }

  /**
   * Get pool statistics
   * @returns Pool statistics
   */
  getStats() {
    return {
      availableConnections: this.availableConnections.length,
      activeConnections: this.activeConnections.length,
      totalConnections: this.availableConnections.length + this.activeConnections.length
    };
  }

  /**
   * Get an available connection
   * @returns Available connection or undefined
   */
  private getAvailableConnection(): T | undefined {
    // Get and remove the first available connection
    const connection = this.availableConnections.shift();
    
    if (connection) {
      this.activeConnections.push(connection);
    }

    return connection;
  }

  /**
   * Check if a new connection can be created
   * @returns Boolean indicating if a new connection can be created
   */
  private canCreateNewConnection(): boolean {
    return this.activeConnections.length + this.availableConnections.length < 
      this.config.maxConnections;
  }

  /**
   * Create a new connection
   * @returns Created connection
   */
  private async createNewConnection(): Promise<T> {
    const connection = await this.connectionFactory();
    this.activeConnections.push(connection);

    // Emit connection created event
    this.eventEmitter.emit('connection:created', {
      connectionId: connection.id,
      timestamp: Date.now()
    });

    return connection;
  }

  /**
   * Wait for a connection to become available
   * @returns Promise resolving to a connection
   */
  private waitForConnection(): Promise<T> {
    return new Promise((resolve, reject) => {
      // Add to pending requests
      this.pendingRequests.push(resolve);

      // Set timeout for connection acquisition
      const timeout = setTimeout(() => {
        // Remove from pending requests
        const index = this.pendingRequests.indexOf(resolve);
        if (index !== -1) {
          this.pendingRequests.splice(index, 1);
        }

        // Reject with timeout error
        reject(new Error('Connection acquisition timeout'));
      }, this.config.acquireTimeout);
    });
  }

  /**
   * Resolve a pending connection request
   * @param connection Connection to provide
   */
  private resolvePendingRequest(connection: T): void {
    const pendingRequest = this.pendingRequests.shift();
    if (pendingRequest) {
      pendingRequest(connection);
    }
  }

  /**
   * Initialize minimum connections
   */
  private async initializeMinConnections(): Promise<void> {
    const connectionPromises = Array.from(
      { length: this.config.minConnections }, 
      () => this.createNewConnection()
    );

    await Promise.all(connectionPromises);
  }

  /**
   * Start periodic cleanup of idle connections
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, this.config.idleTimeout);
  }

  /**
   * Clean up idle connections
   */
  private async cleanupIdleConnections(): Promise<void> {
    // Close connections beyond minimum pool size
    while (
      this.availableConnections.length > this.config.minConnections
    ) {
      const connection = this.availableConnections.pop();
      if (connection) {
        await connection.close();
      }
    }
  }

  /**
   * Subscribe to pool events
   * @param eventName Event name
   * @param callback Event handler
   */
  on(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.on(eventName, callback);
  }

  /**
   * Unsubscribe from pool events
   * @param eventName Event name
   * @param callback Event handler
   */
  off(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.off(eventName, callback);
  }
}