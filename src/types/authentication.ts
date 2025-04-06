// src/types/authentication.ts
/**
 * Represents the different authentication methods supported by the Connector Framework
 */
export enum AuthenticationMethod {
  API_KEY = 'api_key',
  OAUTH_1 = 'oauth_1',
  OAUTH_2 = 'oauth_2',
  BASIC = 'basic',
  JWT = 'jwt',
  CUSTOM = 'custom'
}

/**
 * Base interface for all authentication credentials
 */
export interface BaseCredentials {
  /**
   * Unique identifier for the credentials
   */
  id: string;

  /**
   * Type of authentication method
   */
  method: AuthenticationMethod;

  /**
   * Timestamp of credential creation
   */
  createdAt: number;

  /**
   * Metadata about the credentials
   */
  metadata?: Record<string, any>;
}

/**
 * API Key Authentication Credentials
 */
export interface ApiKeyCredentials extends BaseCredentials {
  method: AuthenticationMethod.API_KEY;
  
  /**
   * The actual API key
   */
  apiKey: string;

  /**
   * Optional key location (header, query param, etc.)
   */
  keyLocation?: 'header' | 'query' | 'body';

  /**
   * Optional key prefix
   */
  keyPrefix?: string;
}

/**
 * Basic Authentication Credentials
 */
export interface BasicAuthCredentials extends BaseCredentials {
  method: AuthenticationMethod.BASIC;
  
  /**
   * Username for basic authentication
   */
  username: string;

  /**
   * Password for basic authentication
   */
  password: string;
}

/**
 * JWT Authentication Credentials
 */
export interface JwtCredentials extends BaseCredentials {
  method: AuthenticationMethod.JWT;
  
  /**
   * The JWT token
   */
  token: string;

  /**
   * Token expiration timestamp
   */
  expiresAt?: number;

  /**
   * Refresh token for obtaining new access tokens
   */
  refreshToken?: string;
}

/**
 * OAuth 1.0 Authentication Credentials
 */
export interface OAuth1Credentials extends BaseCredentials {
  method: AuthenticationMethod.OAUTH_1;
  
  /**
   * Consumer key
   */
  consumerKey: string;

  /**
   * Consumer secret
   */
  consumerSecret: string;

  /**
   * OAuth token
   */
  token: string;

  /**
   * OAuth token secret
   */
  tokenSecret: string;
}

/**
 * OAuth 2.0 Authentication Credentials
 */
export interface OAuth2Credentials extends BaseCredentials {
  method: AuthenticationMethod.OAUTH_2;
  
  /**
   * Access token
   */
  accessToken: string;

  /**
   * Token type (e.g., 'Bearer')
   */
  tokenType?: string;

  /**
   * Access token expiration timestamp
   */
  expiresAt?: number;

  /**
   * Refresh token
   */
  refreshToken?: string;

  /**
   * Scope of the access token
   */
  scope?: string[];
}

/**
 * Custom Authentication Credentials
 */
export interface CustomCredentials extends BaseCredentials {
  method: AuthenticationMethod.CUSTOM;
  
  /**
   * Arbitrary authentication data
   */
  data: Record<string, any>;
}

/**
 * Union type of all possible credential types
 */
export type Credentials = 
  | ApiKeyCredentials
  | BasicAuthCredentials
  | JwtCredentials
  | OAuth1Credentials
  | OAuth2Credentials
  | CustomCredentials;

/**
 * Configuration for authentication provider
 */
export interface AuthProviderConfig {
  /**
   * Unique identifier for the authentication provider
   */
  id: string;

  /**
   * Name of the authentication provider
   */
  name: string;

  /**
   * Supported authentication methods
   */
  supportedMethods: AuthenticationMethod[];

  /**
   * Optional configuration for the provider
   */
  config?: Record<string, any>;
}

/**
 * Interface for authentication provider
 */
export interface AuthProvider {
  /**
   * Validate the provided credentials
   * @param credentials Credentials to validate
   * @returns Promise resolving to boolean indicating validity
   */
  validate(credentials: Credentials): Promise<boolean>;

  /**
   * Refresh credentials if possible
   * @param credentials Credentials to refresh
   * @returns Promise resolving to refreshed credentials
   */
  refresh?(credentials: Credentials): Promise<Credentials>;

  /**
   * Revoke the given credentials
   * @param credentials Credentials to revoke
   * @returns Promise resolving when revocation is complete
   */
  revoke?(credentials: Credentials): Promise<void>;

  /**
   * Get additional metadata about the credentials
   * @param credentials Credentials to inspect
   * @returns Promise resolving to metadata
   */
  getMetadata?(credentials: Credentials): Promise<Record<string, any>>;
}

/**
 * Authentication error types
 */
export enum AuthenticationErrorType {
  INVALID_CREDENTIALS = 'invalid_credentials',
  EXPIRED_TOKEN = 'expired_token',
  RATE_LIMITED = 'rate_limited',
  INSUFFICIENT_SCOPE = 'insufficient_scope',
  NETWORK_ERROR = 'network_error',
  UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Authentication error details
 */
export interface AuthenticationError extends Error {
  /**
   * Specific type of authentication error
   */
  type: AuthenticationErrorType;

  /**
   * Additional context about the error
   */
  context?: Record<string, any>;
}

/**
 * Options for credential encryption
 */
export interface CredentialEncryptionOptions {
  /**
   * Algorithm to use for encryption
   */
  algorithm?: string;

  /**
   * Key rotation interval (in milliseconds)
   */
  keyRotationInterval?: number;

  /**
   * Additional encryption configuration
   */
  config?: Record<string, any>;
}