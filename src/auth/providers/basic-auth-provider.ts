// src/auth/providers/basic-auth-provider.ts
import crypto from 'crypto';
import { 
  AuthProvider, 
  BasicAuthCredentials, 
  AuthenticationMethod,
  AuthenticationError,
  AuthenticationErrorType
} from '../../types/authentication';

/**
 * Configuration for Basic Authentication Provider
 */
export interface BasicAuthProviderConfig {
  /**
   * Encryption key for sensitive data
   */
  encryptionKey?: string;

  /**
   * Maximum age of credentials before requiring rotation
   */
  maxCredentialAge?: number;

  /**
   * Custom validation function
   */
  customValidator?: (credentials: BasicAuthCredentials) => Promise<boolean>;

  /**
   * Password hashing configuration
   */
  passwordHashing?: {
    /**
     * Hashing algorithm
     */
    algorithm?: string;

    /**
     * Number of iterations for hashing
     */
    iterations?: number;

    /**
     * Key length for hashing
     */
    keylen?: number;

    /**
     * Digest method
     */
    digest?: string;
  };
}

/**
 * Basic Authentication Provider
 */
export class BasicAuthProvider implements AuthProvider {
  /**
   * Provider configuration
   */
  private config: Required<BasicAuthProviderConfig>;

  /**
   * Cached validated credentials
   */
  private validationCache: Map<string, {
    isValid: boolean;
    lastValidated: number;
  }> = new Map();

  /**
   * Default configuration
   */
  private defaultConfig: Required<BasicAuthProviderConfig> = {
    encryptionKey: crypto.randomBytes(32).toString('hex'),
    maxCredentialAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    customValidator: async () => true,
    passwordHashing: {
      algorithm: 'sha512',
      iterations: 10000,
      keylen: 64,
      digest: 'sha512'
    }
  };

  /**
   * Constructor
   * @param config Optional provider configuration
   */
  constructor(config: BasicAuthProviderConfig = {}) {
    this.config = {
      ...this.defaultConfig,
      ...config,
      passwordHashing: {
        ...this.defaultConfig.passwordHashing,
        ...config.passwordHashing
      }
    };
  }

  /**
   * Validate basic authentication credentials
   * @param credentials Credentials to validate
   * @returns Promise resolving to boolean indicating validity
   */
  async validate(credentials: BasicAuthCredentials): Promise<boolean> {
    // Ensure credentials are for basic authentication method
    if (credentials.method !== AuthenticationMethod.BASIC) {
      throw new Error('Invalid authentication method for Basic Auth provider');
    }

    // Check cached validation
    const cachedValidation = this.getCachedValidation(credentials.id);
    if (cachedValidation !== null) {
      return cachedValidation;
    }

    try {
      // Decrypt username and password
      const decryptedUsername = this.decryptCredential(credentials.username);
      const decryptedPassword = this.decryptCredential(credentials.password);

      // Validate credentials format
      this.validateCredentialsFormat(decryptedUsername, decryptedPassword);

      // Hash the password for comparison
      const hashedPassword = this.hashPassword(decryptedPassword);

      // Run custom validator
      const isValid = await this.config.customValidator({
        ...credentials,
        username: decryptedUsername,
        password: hashedPassword
      });

      // Cache validation result
      this.cacheValidation(credentials.id, isValid);

      return isValid;
    } catch (error) {
      // Create authentication error
      const authError: AuthenticationError = {
        name: 'AuthenticationError',
        message: error.message,
        type: AuthenticationErrorType.INVALID_CREDENTIALS,
        stack: error.stack
      };

      throw authError;
    }
  }

  /**
   * Refresh basic authentication credentials
   * @param credentials Credentials to refresh
   * @returns Promise resolving to refreshed credentials
   */
  async refresh(credentials: BasicAuthCredentials): Promise<BasicAuthCredentials> {
    // Validate existing credentials
    await this.validate(credentials);

    // Generate new password
    const newPassword = this.generatePassword();

    // Return refreshed credentials
    return {
      ...credentials,
      password: this.encryptCredential(newPassword),
      createdAt: Date.now()
    };
  }

  /**
   * Revoke basic authentication credentials
   * @param credentials Credentials to revoke
   */
  async revoke(credentials: BasicAuthCredentials): Promise<void> {
    // Remove from validation cache
    this.validationCache.delete(credentials.id);

    // TODO: Implement actual revocation logic 
    // (e.g., invalidate in external system)
  }

  /**
   * Generate a secure random password
   * @returns Generated password
   */
  generatePassword(): string {
    return crypto.randomBytes(16).toString('base64');
  }

  /**
   * Encrypt a credential
   * @param credential Credential to encrypt
   * @returns Encrypted credential
   */
  private encryptCredential(credential: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.config.encryptionKey);
    let encrypted = cipher.update(credential, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt a credential
   * @param encryptedCredential Encrypted credential
   * @returns Decrypted credential
   */
  private decryptCredential(encryptedCredential: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', this.config.encryptionKey);
    let decrypted = decipher.update(encryptedCredential, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Hash a password using configured hashing method
   * @param password Password to hash
   * @returns Hashed password
   */
  private hashPassword(password: string): string {
    const { algorithm, iterations, keylen, digest } = this.config.passwordHashing;
    
    return crypto.pbkdf2Sync(
      password, 
      this.config.encryptionKey, 
      iterations, 
      keylen, 
      digest
    ).toString('hex');
  }

  /**
   * Validate credentials format
   * @param username Username to validate
   * @param password Password to validate
   */
  private validateCredentialsFormat(username: string, password: string): void {
    if (!username) {
      throw new Error('Username is required');
    }

    if (!password) {
      throw new Error('Password is required');
    }

    // Optional: Add more sophisticated validation
    if (username.length < 3) {
      throw new Error('Username is too short');
    }

    if (password.length < 8) {
      throw new Error('Password is too short');
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

    // Check if cache is still valid
    const isRecent = 
      Date.now() - cachedEntry.lastValidated < this.config.maxCredentialAge;

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
  async getMetadata(credentials: BasicAuthCredentials): Promise<Record<string, any>> {
    return {
      id: credentials.id,
      method: credentials.method,
      createdAt: credentials.createdAt,
      username: this.decryptCredential(credentials.username)
    };
  }
}

// Export a factory function for creating Basic Auth providers
export function createBasicAuthProvider(
  config?: BasicAuthProviderConfig
): BasicAuthProvider {
  return new BasicAuthProvider(config);
}