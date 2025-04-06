// src/auth/providers/jwt-provider.ts
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { 
  AuthProvider, 
  JwtCredentials, 
  AuthenticationMethod,
  AuthenticationError,
  AuthenticationErrorType
} from '../../types/authentication';

/**
 * Configuration for JWT Authentication Provider
 */
export interface JwtProviderConfig {
  /**
   * Secret key for signing and verifying tokens
   */
  secretKey?: string;

  /**
   * Default token expiration time
   */
  defaultExpiration?: number;

  /**
   * Issuer of the tokens
   */
  issuer?: string;

  /**
   * Audience of the tokens
   */
  audience?: string;

  /**
   * Custom validation function
   */
  customValidator?: (credentials: JwtCredentials) => Promise<boolean>;

  /**
   * Token signing options
   */
  signingOptions?: jwt.SignOptions;

  /**
   * Token verification options
   */
  verificationOptions?: jwt.VerifyOptions;
}

/**
 * Payload structure for JWT tokens
 */
export interface JwtPayload {
  /**
   * Subject of the token (typically user ID)
   */
  sub?: string;

  /**
   * Issuer of the token
   */
  iss?: string;

  /**
   * Audience of the token
   */
  aud?: string | string[];

  /**
   * Expiration time
   */
  exp?: number;

  /**
   * Issued at time
   */
  iat?: number;

  /**
   * Additional custom claims
   */
  [key: string]: any;
}

/**
 * JWT Authentication Provider
 */
export class JwtProvider implements AuthProvider {
  /**
   * Provider configuration
   */
  private config: Required<JwtProviderConfig>;

  /**
   * Cached validated tokens
   */
  private validationCache: Map<string, {
    isValid: boolean;
    lastValidated: number;
  }> = new Map();

  /**
   * Default configuration
   */
  private defaultConfig: Required<JwtProviderConfig> = {
    secretKey: crypto.randomBytes(64).toString('hex'),
    defaultExpiration: 3600, // 1 hour
    issuer: 'connector-framework',
    audience: 'connector-clients',
    customValidator: async () => true,
    signingOptions: {},
    verificationOptions: {}
  };

  /**
   * Constructor
   * @param config Optional provider configuration
   */
  constructor(config: JwtProviderConfig = {}) {
    this.config = {
      ...this.defaultConfig,
      ...config,
      signingOptions: {
        ...this.defaultConfig.signingOptions,
        ...config.signingOptions
      },
      verificationOptions: {
        ...this.defaultConfig.verificationOptions,
        ...config.verificationOptions
      }
    };
  }

  /**
   * Validate JWT credentials
   * @param credentials Credentials to validate
   * @returns Promise resolving to boolean indicating validity
   */
  async validate(credentials: JwtCredentials): Promise<boolean> {
    // Ensure credentials are for JWT authentication method
    if (credentials.method !== AuthenticationMethod.JWT) {
      throw new Error('Invalid authentication method for JWT provider');
    }

    // Check cached validation
    const cachedValidation = this.getCachedValidation(credentials.id);
    if (cachedValidation !== null) {
      return cachedValidation;
    }

    try {
      // Verify the token
      const payload = this.verifyToken(credentials.token);

      // Run custom validator
      const isValid = await this.config.customValidator(credentials);

      // Cache validation result
      this.cacheValidation(credentials.id, isValid);

      return isValid;
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
   * Refresh JWT credentials
   * @param credentials Credentials to refresh
   * @returns Promise resolving to refreshed credentials
   */
  async refresh(credentials: JwtCredentials): Promise<JwtCredentials> {
    // Validate existing credentials
    await this.validate(credentials);

    // Decode existing token to extract payload
    const existingPayload = jwt.decode(credentials.token) as JwtPayload;

    // Generate new token with updated expiration
    const newToken = this.generateToken(existingPayload);

    // Return refreshed credentials
    return {
      ...credentials,
      token: newToken,
      expiresAt: this.getTokenExpirationTime(newToken)
    };
  }

  /**
   * Revoke JWT credentials
   * @param credentials Credentials to revoke
   */
  async revoke(credentials: JwtCredentials): Promise<void> {
    // Remove from validation cache
    this.validationCache.delete(credentials.id);

    // TODO: Implement actual revocation logic 
    // (e.g., add to token blacklist, invalidate in external system)
  }

  /**
   * Generate a new JWT token
   * @param payload Token payload
   * @returns Generated JWT token
   */
  generateToken(payload: JwtPayload = {}): string {
    // Set default claims
    const defaultPayload: JwtPayload = {
      iss: this.config.issuer,
      aud: this.config.audience,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.config.defaultExpiration
    };

    // Merge payload with default claims
    const finalPayload = { ...defaultPayload, ...payload };

    // Sign the token
    return jwt.sign(
      finalPayload, 
      this.config.secretKey, 
      this.config.signingOptions
    );
  }

  /**
   * Verify a JWT token
   * @param token Token to verify
   * @returns Decoded payload
   */
  private verifyToken(token: string): JwtPayload {
    try {
      // Verify and decode the token
      return jwt.verify(
        token, 
        this.config.secretKey, 
        {
          ...this.config.verificationOptions,
          issuer: this.config.issuer,
          audience: this.config.audience
        }
      ) as JwtPayload;
    } catch (error) {
      // Rethrow with more specific error
      throw this.createTokenVerificationError(error);
    }
  }

  /**
   * Get token expiration time
   * @param token JWT token
   * @returns Expiration timestamp
   */
  private getTokenExpirationTime(token: string): number {
    const payload = jwt.decode(token) as JwtPayload;
    return payload?.exp ? payload.exp * 1000 : 0;
  }

  /**
   * Create a specific token verification error
   * @param error Original error
   * @returns Processed error
   */
  private createTokenVerificationError(error: Error): Error {
    if (error.name === 'TokenExpiredError') {
      return new Error('Token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      return new Error('Invalid token');
    }
    return error;
  }

  /**
   * Map JWT verification errors to authentication error types
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
   * Get metadata about the credentials
   * @param credentials Credentials to inspect
   * @returns Metadata about the credentials
   */
  async getMetadata(credentials: JwtCredentials): Promise<Record<string, any>> {
    try {
      const payload = this.verifyToken(credentials.token);
      return {
        id: credentials.id,
        method: credentials.method,
        createdAt: credentials.createdAt,
        expiresAt: credentials.expiresAt,
        subject: payload.sub,
        issuer: payload.iss,
        audience: payload.aud
      };
    } catch {
      // Return basic metadata if token verification fails
      return {
        id: credentials.id,
        method: credentials.method,
        createdAt: credentials.createdAt,
        expiresAt: credentials.expiresAt
      };
    }
  }
}

// Export a factory function for creating JWT providers
export function createJwtProvider(
  config?: JwtProviderConfig
): JwtProvider {
  return new JwtProvider(config);
}