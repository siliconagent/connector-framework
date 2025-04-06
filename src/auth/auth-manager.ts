// src/auth/auth-manager.ts
import { 
  AuthProvider, 
  Credentials, 
  AuthenticationMethod,
  AuthenticationError,
  AuthenticationErrorType
} from '../types/authentication';
import { EventEmitter } from '../events/event-emitter';
import { createApiKeyProvider } from './providers/api-key-provider';
import { createBasicAuthProvider } from './providers/basic-auth-provider';
import { createJwtProvider } from './providers/jwt-provider';
import { createOAuthProvider } from './providers/oauth-provider';

/**
 * Configuration for authentication providers
 */
export interface AuthProviderConfig {
  /**
   * Unique identifier for the provider configuration
   */
  id: string;

  /**
   * Authentication method
   */
  method: AuthenticationMethod;

  /**
   * Provider-specific configuration
   */
  config: any;
}

/**
 * Authentication Manager for managing multiple authentication providers
 */
export class AuthManager {
  /**
   * Event emitter for authentication-related events
   */
  private eventEmitter: EventEmitter;

  /**
   * Registered authentication providers
   */
  private providers: Map<AuthenticationMethod, AuthProvider> = new Map();

  /**
   * Stored credentials
   */
  private credentials: Map<string, Credentials> = new Map();

  constructor() {
    this.eventEmitter = new EventEmitter();

    // Register default providers
    this.registerDefaultProviders();
  }

  /**
   * Register default authentication providers
   */
  private registerDefaultProviders(): void {
    this.providers.set(
      AuthenticationMethod.API_KEY, 
      createApiKeyProvider()
    );

    this.providers.set(
      AuthenticationMethod.BASIC, 
      createBasicAuthProvider()
    );

    this.providers.set(
      AuthenticationMethod.JWT, 
      createJwtProvider()
    );

    this.providers.set(
      AuthenticationMethod.OAUTH_1, 
      createOAuthProvider({ version: '1.0', oauth1: {} })
    );

    this.providers.set(
      AuthenticationMethod.OAUTH_2, 
      createOAuthProvider({ version: '2.0', oauth2: {} })
    );
  }

  /**
   * Register a new authentication provider
   * @param method Authentication method
   * @param provider Authentication provider
   */
  registerProvider(
    method: AuthenticationMethod, 
    provider: AuthProvider
  ): void {
    // Check for existing provider
    if (this.providers.has(method)) {
      this.eventEmitter.emit('provider:replaced', {
        method,
        timestamp: Date.now()
      });
    }

    // Register the provider
    this.providers.set(method, provider);

    // Emit registration event
    this.eventEmitter.emit('provider:registered', {
      method,
      timestamp: Date.now()
    });
  }

  /**
   * Store credentials
   * @param credentials Credentials to store
   * @returns Stored credentials identifier
   */
  storeCredentials(credentials: Credentials): string {
    // Generate unique identifier if not provided
    const credentialsId = credentials.id || this.generateCredentialsId();

    // Validate credentials before storing
    this.validateCredentialsMethod(credentials);

    // Store credentials
    this.credentials.set(credentialsId, credentials);

    // Emit credentials stored event
    this.eventEmitter.emit('credentials:stored', {
      id: credentialsId,
      method: credentials.method,
      timestamp: Date.now()
    });

    return credentialsId;
  }

  /**
   * Retrieve stored credentials
   * @param credentialsId Credentials identifier
   * @returns Retrieved credentials
   */
  getCredentials(credentialsId: string): Credentials {
    const credentials = this.credentials.get(credentialsId);

    if (!credentials) {
      throw new Error(`Credentials with ID ${credentialsId} not found`);
    }

    return credentials;
  }

  /**
   * Validate credentials
   * @param credentialsId Credentials identifier
   * @returns Promise resolving to boolean indicating validity
   */
  async validateCredentials(credentialsId: string): Promise<boolean> {
    // Retrieve credentials
    const credentials = this.getCredentials(credentialsId);

    // Get appropriate provider
    const provider = this.getProviderForMethod(credentials.method);

    try {
      // Validate credentials
      const isValid = await provider.validate(credentials);

      // Emit validation event
      this.eventEmitter.emit('credentials:validated', {
        id: credentialsId,
        method: credentials.method,
        isValid,
        timestamp: Date.now()
      });

      return isValid;
    } catch (error) {
      // Handle authentication errors
      const authError: AuthenticationError = {
        name: 'AuthenticationError',
        message: error.message,
        type: this.mapErrorToAuthenticationErrorType(error),
        stack: error.stack
      };

      // Emit validation failure event
      this.eventEmitter.emit('credentials:validation-failed', {
        id: credentialsId,
        method: credentials.method,
        error: authError,
        timestamp: Date.now()
      });

      throw authError;
    }
  }

  /**
   * Refresh credentials
   * @param credentialsId Credentials identifier
   * @returns Refreshed credentials
   */
  async refreshCredentials(credentialsId: string): Promise<Credentials> {
    // Retrieve credentials
    const credentials = this.getCredentials(credentialsId);

    // Get appropriate provider
    const provider = this.getProviderForMethod(credentials.method);

    try {
      // Refresh credentials
      const refreshedCredentials = await provider.refresh(credentials);

      // Update stored credentials
      this.credentials.set(credentialsId, refreshedCredentials);

      // Emit refresh event
      this.eventEmitter.emit('credentials:refreshed', {
        id: credentialsId,
        method: credentials.method,
        timestamp: Date.now()
      });

      return refreshedCredentials;
    } catch (error) {
      // Handle refresh errors
      const authError: AuthenticationError = {
        name: 'AuthenticationError',
        message: error.message,
        type: this.mapErrorToAuthenticationErrorType(error),
        stack: error.stack
      };

      // Emit refresh failure event
      this.eventEmitter.emit('credentials:refresh-failed', {
        id: credentialsId,
        method: credentials.method,
        error: authError,
        timestamp: Date.now()
      });

      throw authError;
    }
  }

  /**
   * Revoke credentials
   * @param credentialsId Credentials identifier
   */
  async revokeCredentials(credentialsId: string): Promise<void> {
    // Retrieve credentials
    const credentials = this.getCredentials(credentialsId);

    // Get appropriate provider
    const provider = this.getProviderForMethod(credentials.method);

    try {
      // Revoke credentials
      await provider.revoke(credentials);

      // Remove from stored credentials
      this.credentials.delete(credentialsId);

      // Emit revocation event
      this.eventEmitter.emit('credentials:revoked', {
        id: credentialsId,
        method: credentials.method,
        timestamp: Date.now()
      });
    } catch (error) {
      // Handle revocation errors
      const authError: AuthenticationError = {
        name: 'AuthenticationError',
        message: error.message,
        type: this.mapErrorToAuthenticationErrorType(error),
        stack: error.stack
      };

      // Emit revocation failure event
      this.eventEmitter.emit('credentials:revoke-failed', {
        id: credentialsId,
        method: credentials.method,
        error: authError,
        timestamp: Date.now()
      });

      throw authError;
    }
  }

  /**
   * Get provider for a specific authentication method
   * @param method Authentication method
   * @returns Authentication provider
   */
  private getProviderForMethod(method: AuthenticationMethod): AuthProvider {
    const provider = this.providers.get(method);

    if (!provider) {
      throw new Error(`No provider registered for method: ${method}`);
    }

    return provider;
  }

  /**
   * Validate credentials method
   * @param credentials Credentials to validate
   */
  private validateCredentialsMethod(credentials: Credentials): void {
    // Ensure a provider exists for the credentials method
    this.getProviderForMethod(credentials.method);
  }

  /**
   * Generate a unique credentials identifier
   * @returns Generated credentials ID
   */
  private generateCredentialsId(): string {
    return `cred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Map errors to authentication error types
   * @param error Original error
   * @returns Authentication error type
   */
  private mapErrorToAuthenticationErrorType(error: Error): AuthenticationErrorType {
    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('expired')) {
      return AuthenticationErrorType.EXPIRED_TOKEN;
    }
    if (errorMessage.includes('invalid') || errorMessage.includes('unauthorized')) {
      return AuthenticationErrorType.INVALID_CREDENTIALS;
    }
    if (errorMessage.includes('rate') || errorMessage.includes('limit')) {
      return AuthenticationErrorType.RATE_LIMITED;
    }

    return AuthenticationErrorType.UNKNOWN_ERROR;
  }

  /**
   * Subscribe to authentication-related events
   * @param eventName Event name
   * @param callback Event handler
   */
  on(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.on(eventName, callback);
  }

  /**
   * Unsubscribe from authentication-related events
   * @param eventName Event name
   * @param callback Event handler
   */
  off(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.off(eventName, callback);
  }
}

// Export a singleton instance for convenient use
export const authManager = new AuthManager();