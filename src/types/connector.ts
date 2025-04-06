// src/types/connector.ts
import { AuthenticationMethod, Credentials } from './authentication';
import { ConnectorOperation } from './operation';
import { TransformationConfig } from './transformation';

/**
 * Categorization of connector types
 */
export enum ConnectorType {
  API = 'api',
  DATABASE = 'database',
  MESSAGING = 'messaging',
  FILE_STORAGE = 'file_storage',
  CRM = 'crm',
  CUSTOM = 'custom'
}

/**
 * Represents the current status of a connector
 */
export enum ConnectorStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  CONFIGURATION_REQUIRED = 'configuration_required'
}

/**
 * Compatibility information for the connector
 */
export interface ConnectorCompatibility {
  /**
   * Minimum version of the service supported
   */
  minVersion?: string;

  /**
   * Maximum version of the service supported
   */
  maxVersion?: string;

  /**
   * List of known incompatible versions
   */
  incompatibleVersions?: string[];
}

/**
 * Metadata about the connector's author or maintainer
 */
export interface ConnectorAuthor {
  /**
   * Name of the author or organization
   */
  name: string;

  /**
   * Contact email
   */
  email?: string;

  /**
   * Website or documentation URL
   */
  url?: string;
}

/**
 * Configuration options for a connector
 */
export interface ConnectorConfig {
  /**
   * Unique identifier for the connector configuration
   */
  id: string;

  /**
   * Connection-specific configuration parameters
   */
  parameters: Record<string, any>;

  /**
   * Metadata about the configuration
   */
  metadata?: Record<string, any>;
}

/**
 * Detailed information about a connector
 */
export interface ConnectorDefinition {
  /**
   * Unique identifier for the connector
   */
  id: string;

  /**
   * Human-readable name of the connector
   */
  name: string;

  /**
   * Detailed description of the connector
   */
  description?: string;

  /**
   * Type of connector
   */
  type: ConnectorType;

  /**
   * Current status of the connector
   */
  status: ConnectorStatus;

  /**
   * Version of the connector
   */
  version: string;

  /**
   * Supported authentication methods
   */
  authMethods: AuthenticationMethod[];

  /**
   * Operations supported by this connector
   */
  operations: Record<string, ConnectorOperation>;

  /**
   * Compatibility information
   */
  compatibility?: ConnectorCompatibility;

  /**
   * Author or maintainer details
   */
  author?: ConnectorAuthor;

  /**
   * Categories or tags for the connector
   */
  categories?: string[];

  /**
   * Documentation URL
   */
  documentationUrl?: string;

  /**
   * Icon or logo URL
   */
  iconUrl?: string;
}

/**
 * Connection details for a specific connector instance
 */
export interface ConnectorConnection {
  /**
   * Unique identifier for this connection
   */
  id: string;

  /**
   * Reference to the connector definition
   */
  connectorId: string;

  /**
   * Authentication credentials used for this connection
   */
  credentials: Credentials;

  /**
   * Configuration for this specific connection
   */
  config?: ConnectorConfig;

  /**
   * Current connection status
   */
  status: ConnectorStatus;

  /**
   * Timestamp of last successful connection
   */
  lastSuccessfulConnection?: number;

  /**
   * Timestamp of last connection attempt
   */
  lastConnectionAttempt?: number;
}

/**
 * Options for registering a new connector
 */
export interface RegisterConnectorOptions {
  /**
   * Overwrite existing connector if one exists
   */
  overwrite?: boolean;

  /**
   * Validate the connector definition
   */
  validate?: boolean;

  /**
   * Additional registration metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Connection health check result
 */
export interface ConnectorHealthCheck {
  /**
   * Overall health status
   */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /**
   * Detailed health metrics
   */
  metrics?: {
    /**
     * Latency of connection
     */
    latency?: number;

    /**
     * Error rate
     */
    errorRate?: number;

    /**
     * Available operations
     */
    availableOperations?: string[];
  };

  /**
   * Any error details if not healthy
   */
  errors?: Array<{
    code: string;
    message: string;
    severity: 'warning' | 'error' | 'critical';
  }>;
}

/**
 * Transformation configuration for a connector
 */
export interface ConnectorTransformationConfig {
  /**
   * Input transformation configuration
   */
  inputTransformation?: TransformationConfig;

  /**
   * Output transformation configuration
   */
  outputTransformation?: TransformationConfig;
}

/**
 * Event subscription configuration for a connector
 */
export interface ConnectorEventSubscription {
  /**
   * Unique identifier for the subscription
   */
  id: string;

  /**
   * Types of events to subscribe to
   */
  eventTypes: string[];

  /**
   * Endpoint or callback for event notifications
   */
  callbackUrl: string;

  /**
   * Authentication for webhook
   */
  webhookSecret?: string;

  /**
   * Additional subscription metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Options for creating a new connector connection
 */
export interface CreateConnectorConnectionOptions {
  /**
   * Credentials for the connection
   */
  credentials: Credentials;

  /**
   * Optional configuration parameters
   */
  config?: ConnectorConfig;

  /**
   * Optional transformation configurations
   */
  transformations?: ConnectorTransformationConfig;

  /**
   * Optional event subscriptions
   */
  eventSubscriptions?: ConnectorEventSubscription[];
}