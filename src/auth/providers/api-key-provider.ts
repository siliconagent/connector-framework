// src/auth/providers/api-key-provider.ts
import crypto from 'crypto';
import { 
  AuthProvider, 
  ApiKeyCredentials, 
  AuthenticationMethod,
  AuthenticationError,
  AuthenticationErrorType
} from '../../types/authentication';

/**
 * Configuration for API key provider
 */
export interface ApiKeyProviderConfig {
  /**
   * Encryption key for sensitive data
   */
  encryptionKey?: string;

  /**
   * Maximum age of the API key before requiring rotation
   */
  maxKeyAge?: number;

  /**
   * Custom validation function
   */
  customValidator?: (credentials: ApiKeyCredentials) => Promise<boolean>;
}

/**
 * API Key Authentication Provider
 */
export class ApiKeyProvider implements AuthProvider {
  /**
   * Provider configuration
   */
  private config: Required<ApiKeyProviderConfig>;

  /**
   * Cached validated keys to improve performance
   */
  private validationCache: Map<string, {
    isValid: boolean;
    lastValidated: number;
  }> = new Map();

  /**
   * Default configuration
   */
  private defaultConfig: Required<ApiKeyProviderConfig> = {
    encryptionKey: crypto.randomBytes(32).toString('hex'),
    maxKeyAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    customValidator: async () => true
  };

  /**
   * Constructor
   * @param config Optional provider configuration
   */
  constructor(config: ApiKeyProviderConfig = {}) {
    this.config = {
      ...this.defaultConfig,
      ...config
    };
  }

  /**
   * Validate API key credentials
   * @param credentials Credentials to validate
   * @returns Promise resolving to boolean indicating validity
   */
  async validate(credentials: ApiKeyCredentials): Promise<boolean> {
    // Ensure credentials are for API key method
    if (credentials.method !== AuthenticationMethod.API_KEY) {
      throw new Error('Invalid authentication method for API Key provider');
    }

    // Check cached validation
    const cachedValidation = this.getCachedValidation(credentials.id);
    if (cachedValidation !== null) {
      return cachedValidation;
    }

    try {
      // Decrypt API key if encrypted
      const decryptedKey = this.decryptApiKey(credentials.apiKey);

      // Perform basic validation
      this.validateApiKeyFormat(decryptedKey);

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
        type: AuthenticationErrorType.INVALID_CREDENTIALS,
        stack: error.stack
      };

      throw authError;
    }
  }

  /**
   * Refresh API key credentials
   * @param credentials Credentials to refresh
   * @returns Promise resolving to refreshed credentials
   */
  async refresh(credentials: ApiKeyCredentials): Promise<ApiKeyCredentials> {
    // Validate existing credentials
    await this.validate(credentials);

    // Generate new API key
    const newApiKey = this.generateApiKey();

    // Return refreshed credentials
    return {
      ...credentials,
      apiKey: this.encryptApiKey(newApiKey),
      createdAt: Date.now()
    };
  }

  /**
   * Revoke API key credentials
   * @param credentials Credentials to revoke
   */
  async revoke(credentials: ApiKeyCredentials): Promise<void> {
    // Remove from validation cache
    this.validationCache.delete(credentials.id);

    // TODO: Implement actual revocation logic 
    // (e.g., add to revocation list, invalidate in external system)
  }

  /**
   * Generate a new API key
   * @returns Generated API key
   */
  generateApiKey(): string {
    // Generate a cryptographically secure random key
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Encrypt API key
   * @param apiKey API key to encrypt
   * @returns Encrypted API key
   */
  private encryptApiKey(apiKey: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.config.encryptionKey);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt API key
   * @param encryptedKey Encrypted API key
   * @returns Decrypted API key
   */
  private decryptApiKey(encryptedKey: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', this.config.encryptionKey);
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Validate API key format
   * @param apiKey API key to validate
   */
  private validateApiKeyFormat(apiKey: string): void {
    // Basic validation checks
    if (!apiKey) {
      throw new Error('API key is required');
    }

    if (apiKey.length < 32) {
      throw new Error('API key is too short');
    }

    // Optional: Add more sophisticated validation
    // For example, check for specific prefix, character set, etc.
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
      Date.now() - cachedEntry.lastValidated < this.config.maxKeyAge;

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
  async getMetadata(credentials: ApiKeyCredentials): Promise<Record<string, any>> {
    return {
      id: credentials.id,
      method: credentials.method,
      createdAt: credentials.createdAt,
      keyLocation: credentials.keyLocation,
      keyPrefix: credentials.keyPrefix
    };
  }
}

// Export a factory function for creating API key providers
export function createApiKeyProvider(
  config?: ApiKeyProviderConfig
): ApiKeyProvider {
  return new ApiKeyProvider(config);
}