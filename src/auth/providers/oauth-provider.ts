// src/auth/providers/oauth-provider.ts
import crypto from 'crypto';
import axios from 'axios';
import OAuth from 'oauth-1.0a';
import { 
  AuthProvider, 
  OAuth1Credentials,
  OAuth2Credentials,
  AuthenticationMethod,
  AuthenticationError,
  AuthenticationErrorType
} from '../../types/authentication';

/**
 * Configuration for OAuth Provider
 */
export interface OAuthProviderConfig {
  /**
   * OAuth version (1.0 or 2.0)
   */
  version: '1.0' | '2.0';

  /**
   * OAuth 1.0 specific configuration
   */
  oauth1?: {
    /**
     * Consumer key
     */
    consumerKey: string;

    /**
     * Consumer secret
     */
    consumerSecret: string;

    /**
     * Request token URL
     */
    requestTokenUrl: string;

    /**
     * Authorization URL
     */
    authorizeUrl: string;

    /**
     * Access token URL
     */
    accessTokenUrl: string;
  };

  /**
   * OAuth 2.0 specific configuration
   */
  oauth2?: {
    /**
     * Client ID
     */
    clientId: string;

    /**
     * Client secret
     */
    clientSecret: string;

    /**
     * Authorization URL
     */
    authorizationUrl: string;

    /**
     * Token URL
     */
    tokenUrl: string;

    /**
     * Redirect URI
     */
    redirectUri: string;

    /**
     * Scopes to request
     */
    scopes?: string[];
  };

  /**
   * Custom validation function
   */
  customValidator?: (credentials: OAuth1Credentials | OAuth2Credentials) => Promise<boolean>;
}

/**
 * OAuth Authentication Provider
 */
export class OAuthProvider implements AuthProvider {
  /**
   * Provider configuration
   */
  private config: OAuthProviderConfig;

  /**
   * Cached validated credentials
   */
  private validationCache: Map<string, {
    isValid: boolean;
    lastValidated: number;
  }> = new Map();

  /**
   * OAuth 1.0 client
   */
  private oauth1Client?: OAuth;

  /**
   * Constructor
   * @param config OAuth provider configuration
   */
  constructor(config: OAuthProviderConfig) {
    this.config = config;

    // Initialize OAuth 1.0 client if version is 1.0
    if (config.version === '1.0' && config.oauth1) {
      this.oauth1Client = new OAuth({
        consumer: {
          key: config.oauth1.consumerKey,
          secret: config.oauth1.consumerSecret
        },
        signature_method: 'HMAC-SHA1'
      });
    }
  }

  /**
   * Validate OAuth credentials
   * @param credentials Credentials to validate
   * @returns Promise resolving to boolean indicating validity
   */
  async validate(
    credentials: OAuth1Credentials | OAuth2Credentials
  ): Promise<boolean> {
    // Ensure credentials match the provider's version
    this.validateCredentialsMethod(credentials);

    // Check cached validation
    const cachedValidation = this.getCachedValidation(credentials.id);
    if (cachedValidation !== null) {
      return cachedValidation;
    }

    try {
      // Validate based on OAuth version
      const isValid = this.config.version === '1.0'
        ? await this.validateOAuth1Credentials(credentials as OAuth1Credentials)
        : await this.validateOAuth2Credentials(credentials as OAuth2Credentials);

      // Run custom validator
      const customValidationResult = await this.config.customValidator?.(credentials) ?? true;

      // Combine validation results
      const finalValidation = isValid && customValidationResult;

      // Cache validation result
      this.cacheValidation(credentials.id, finalValidation);

      return finalValidation;
    } catch (error) {
      // Create authentication error
      const authError: AuthenticationError = {
        name: 'AuthenticationError',
        message: error.message,
        type: this.mapErrorToAuthenticationErrorType(error),
        stack: error.stack
      };

      throw authError;
    }
  }

  /**
   * Refresh OAuth credentials
   * @param credentials Credentials to refresh
   * @returns Promise resolving to refreshed credentials
   */
  async refresh(
    credentials: OAuth1Credentials | OAuth2Credentials
  ): Promise<OAuth1Credentials | OAuth2Credentials> {
    // Validate existing credentials
    await this.validate(credentials);

    // Refresh based on OAuth version
    return this.config.version === '1.0'
      ? this.refreshOAuth1Credentials(credentials as OAuth1Credentials)
      : this.refreshOAuth2Credentials(credentials as OAuth2Credentials);
  }

  /**
   * Revoke OAuth credentials
   * @param credentials Credentials to revoke
   */
  async revoke(
    credentials: OAuth1Credentials | OAuth2Credentials
  ): Promise<void> {
    // Remove from validation cache
    this.validationCache.delete(credentials.id);

    // TODO: Implement actual revocation logic 
    // (e.g., revoke token with authorization server)
    if (this.config.version === '1.0') {
      // OAuth 1.0 revocation logic
    } else {
      // OAuth 2.0 revocation logic
      await this.revokeOAuth2Token(credentials as OAuth2Credentials);
    }
  }

  /**
   * Validate OAuth 1.0 credentials
   * @param credentials OAuth 1.0 credentials
   * @returns Promise resolving to boolean
   */
  private async validateOAuth1Credentials(
    credentials: OAuth1Credentials
  ): Promise<boolean> {
    if (!this.config.oauth1) {
      throw new Error('OAuth 1.0 configuration not provided');
    }

    if (!this.oauth1Client) {
      throw new Error('OAuth 1.0 client not initialized');
    }

    try {
      // Verify token by making a test request
      // This is a placeholder - replace with actual service-specific validation
      const requestData = {
        url: this.config.oauth1.requestTokenUrl,
        method: 'GET'
      };

      const authHeader = this.oauth1Client.toHeader(
        this.oauth1Client.authorize(requestData, {
          key: credentials.token,
          secret: credentials.tokenSecret
        })
      );

      const response = await axios.get(requestData.url, {
        headers: {
          ...authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate OAuth 2.0 credentials
   * @param credentials OAuth 2.0 credentials
   * @returns Promise resolving to boolean
   */
  private async validateOAuth2Credentials(
    credentials: OAuth2Credentials
  ): Promise<boolean> {
    if (!this.config.oauth2) {
      throw new Error('OAuth 2.0 configuration not provided');
    }

    try {
      // Validate access token
      const response = await axios.get(
        `${this.config.oauth2.tokenUrl}/introspect`, 
        {
          params: {
            token: credentials.accessToken
          },
          auth: {
            username: this.config.oauth2.clientId,
            password: this.config.oauth2.clientSecret
          }
        }
      );

      // Check token validity based on introspection response
      return response.data.active === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh OAuth 1.0 credentials
   * @param credentials OAuth 1.0 credentials
   * @returns Refreshed credentials
   */
  private async refreshOAuth1Credentials(
    credentials: OAuth1Credentials
  ): Promise<OAuth1Credentials> {
    if (!this.config.oauth1) {
      throw new Error('OAuth 1.0 configuration not provided');
    }

    // Generate new token and token secret
    // This is a placeholder - replace with actual OAuth 1.0 token refresh logic
    return {
      ...credentials,
      token: crypto.randomBytes(16).toString('hex'),
      tokenSecret: crypto.randomBytes(16).toString('hex'),
      createdAt: Date.now()
    };
  }

  /**
   * Refresh OAuth 2.0 credentials
   * @param credentials OAuth 2.0 credentials
   * @returns Refreshed credentials
   */
  private async refreshOAuth2Credentials(
    credentials: OAuth2Credentials
  ): Promise<OAuth2Credentials> {
    if (!this.config.oauth2) {
      throw new Error('OAuth 2.0 configuration not provided');
    }

    try {
      // Request new access token using refresh token
      const response = await axios.post(
        this.config.oauth2.tokenUrl, 
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: credentials.refreshToken ?? '',
          client_id: this.config.oauth2.clientId,
          client_secret: this.config.oauth2.clientSecret
        })
      );

      return {
        ...credentials,
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token ?? credentials.refreshToken,
        expiresAt: Date.now() + (response.data.expires_in * 1000),
        createdAt: Date.now()
      };
    } catch (error) {
      throw new Error('Failed to refresh OAuth 2.0 token');
    }
  }

  /**
   * Revoke OAuth 2.0 token
   * @param credentials OAuth 2.0 credentials
   */
  private async revokeOAuth2Token(credentials: OAuth2Credentials): Promise<void> {
    if (!this.config.oauth2) {
      throw new Error('OAuth 2.0 configuration not provided');
    }

    try {
      // Revoke access token
      await axios.post(
        `${this.config.oauth2.tokenUrl}/revoke`, 
        new URLSearchParams({
          token: credentials.accessToken,
          client_id: this.config.oauth2.clientId,
          client_secret: this.config.oauth2.clientSecret
        })
      );
    } catch (error) {
      // Log or handle revocation failure
      console.warn('Failed to revoke OAuth 2.0 token', error);
    }
  }

  /**
   * Validate credentials method matches provider version
   * @param credentials Credentials to validate
   */
  private validateCredentialsMethod(
    credentials: OAuth1Credentials | OAuth2Credentials
  ): void {
    const expectedMethod = this.config.version === '1.0' 
      ? AuthenticationMethod.OAUTH_1 
      : AuthenticationMethod.OAUTH_2;

    if (credentials.method !== expectedMethod) {
      throw new Error(`Invalid authentication method for OAuth ${this.config.version}`);
    }
  }

  /**
   * Get cached validation result
   * @param credentialsId Credentials identifier
   * @returns Cached validation result or null
   */
  private getCachedValidation(credentialsId: string): boolean | null {
    const cachedEntry = this.validationCache.get(credentialsId);

    if (!cachedEntry) return null;

    // Check if cache is still valid (1 hour)
    const isRecent = 
      Date.now() - cachedEntry.lastValidated < 3600000;

    return isRecent ? cachedEntry.isValid : null;
  }

  /**
   * Cache validation result
   * @param credentialsId Credentials identifier
   * @param isValid Validation result
   */
  private cacheValidation(credentialsId: string, isValid: boolean): void {
    this.validationCache.set(credentialsId, {
      isValid,
      lastValidated: Date.now()
    });
  }

  /**
   * Map errors to authentication error types
   * @param error Original error
   * @returns Authentication error type
   */
  private mapErrorToAuthenticationErrorType(error: Error): AuthenticationErrorType {
    if (error.message.includes('expired')) {
      return AuthenticationErrorType.EXPIRED_TOKEN;
    }
    if (error.message.includes('invalid')) {
      return AuthenticationErrorType.INVALID_CREDENTIALS;
    }
    return AuthenticationErrorType.UNKNOWN_ERROR;
  }

  /**
   * Get metadata about the credentials
   * @param credentials Credentials to inspect
   * @returns Metadata about the credentials
   */
  async getMetadata(
    credentials: OAuth1Credentials | OAuth2Credentials
  ): Promise<Record<string, any>> {
    // Return basic metadata
    return {
      id: credentials.id,
      method: credentials.method,
      createdAt: credentials.createdAt,
      ...(this.config.version === '1.0' 
        ? { token: (credentials as OAuth1Credentials).token }
        : { 
            expiresAt: (credentials as OAuth2Credentials).expiresAt,
            scope: (credentials as OAuth2Credentials).scope 
          }
      )
    };
  }
}

/**
 * Factory function for creating OAuth providers
 * @param config OAuth provider configuration
 * @returns OAuth provider instance
 */
export function createOAuthProvider(config: OAuthProviderConfig): OAuthProvider {
  return new OAuthProvider(config);
}