// src/auth/credential-vault.ts
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Configuration for Credential Vault
 */
export interface CredentialVaultConfig {
  /**
   * Master encryption key
   */
  masterKey?: string;

  /**
   * Storage location for encrypted credentials
   */
  storagePath?: string;

  /**
   * Encryption algorithm
   */
  algorithm?: string;

  /**
   * Key derivation iterations
   */
  keyDerivationIterations?: number;
}

/**
 * Metadata for stored credentials
 */
export interface CredentialMetadata {
  /**
   * Unique identifier for the credential
   */
  id: string;

  /**
   * Type or category of the credential
   */
  type: string;

  /**
   * Timestamp of credential creation
   */
  createdAt: number;

  /**
   * Timestamp of last access
   */
  lastAccessed?: number;

  /**
   * Additional custom metadata
   */
  customMetadata?: Record<string, any>;
}

/**
 * Stored credential entry
 */
interface CredentialEntry {
  /**
   * Encrypted credential data
   */
  encryptedData: string;

  /**
   * Initialization vector used for encryption
   */
  iv: string;

  /**
   * Credential metadata
   */
  metadata: CredentialMetadata;
}

/**
 * Credential Vault for secure storage and management of sensitive credentials
 */
export class CredentialVault {
  /**
   * Vault configuration
   */
  private config: Required<CredentialVaultConfig>;

  /**
   * Default configuration
   */
  private defaultConfig: Required<CredentialVaultConfig> = {
    masterKey: crypto.randomBytes(32).toString('hex'),
    storagePath: path.join(process.cwd(), '.credentials'),
    algorithm: 'aes-256-gcm',
    keyDerivationIterations: 10000
  };

  /**
   * Constructor
   * @param config Optional vault configuration
   */
  constructor(config: CredentialVaultConfig = {}) {
    // Merge config with defaults
    this.config = {
      ...this.defaultConfig,
      ...config
    };

    // Ensure storage directory exists
    this.ensureStorageDirectory();
  }

  /**
   * Store a credential securely
   * @param id Unique identifier for the credential
   * @param data Credential data to store
   * @param metadata Optional metadata
   * @returns Stored credential ID
   */
  storeCredential(
    id: string, 
    data: any, 
    metadata: Partial<CredentialMetadata> = {}
  ): string {
    // Validate input
    this.validateCredentialData(data);

    // Generate full metadata
    const fullMetadata: CredentialMetadata = {
      id,
      type: metadata.type || 'default',
      createdAt: Date.now(),
      customMetadata: metadata.customMetadata
    };

    // Encrypt the credential data
    const { encryptedData, iv } = this.encryptData(JSON.stringify(data));

    // Create credential entry
    const entry: CredentialEntry = {
      encryptedData,
      iv,
      metadata: fullMetadata
    };

    // Write to file
    const filePath = this.getCredentialFilePath(id);
    fs.writeFileSync(filePath, JSON.stringify(entry), { mode: 0o600 });

    return id;
  }

  /**
   * Retrieve a stored credential
   * @param id Credential identifier
   * @returns Decrypted credential data
   */
  retrieveCredential(id: string): any {
    // Get file path
    const filePath = this.getCredentialFilePath(id);

    // Read credential file
    let entry: CredentialEntry;
    try {
      entry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw new Error(`Credential with ID ${id} not found`);
    }

    // Update last accessed timestamp
    this.updateLastAccessed(id, entry);

    // Decrypt and return data
    return JSON.parse(this.decryptData(entry.encryptedData, entry.iv));
  }

  /**
   * Update metadata for a credential
   * @param id Credential identifier
   * @param metadata Metadata to update
   */
  updateCredentialMetadata(
    id: string, 
    metadata: Partial<CredentialMetadata>
  ): void {
    // Get file path
    const filePath = this.getCredentialFilePath(id);

    // Read current entry
    let entry: CredentialEntry;
    try {
      entry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw new Error(`Credential with ID ${id} not found`);
    }

    // Update metadata
    entry.metadata = {
      ...entry.metadata,
      ...metadata
    };

    // Write updated entry
    fs.writeFileSync(filePath, JSON.stringify(entry), { mode: 0o600 });
  }

  /**
   * Delete a credential
   * @param id Credential identifier
   */
  deleteCredential(id: string): void {
    // Get file path
    const filePath = this.getCredentialFilePath(id);

    try {
      // Remove the credential file
      fs.unlinkSync(filePath);
    } catch (error) {
      throw new Error(`Failed to delete credential with ID ${id}`);
    }
  }

  /**
   * List all stored credential metadata
   * @returns Array of credential metadata
   */
  listCredentials(): CredentialMetadata[] {
    // Read all files in storage directory
    try {
      return fs.readdirSync(this.config.storagePath)
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(this.config.storagePath, file);
          const entry: CredentialEntry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          return entry.metadata;
        });
    } catch (error) {
      return [];
    }
  }

  /**
   * Encrypt data using configured encryption method
   * @param data Data to encrypt
   * @returns Encrypted data and initialization vector
   */
  private encryptData(data: string): { encryptedData: string; iv: string } {
    // Generate initialization vector
    const iv = crypto.randomBytes(16);

    // Derive encryption key
    const key = this.deriveKey();

    // Create cipher
    const cipher = crypto.createCipheriv(
      this.config.algorithm, 
      key, 
      iv
    );

    // Encrypt data
    let encryptedData = cipher.update(data, 'utf8', 'hex');
    encryptedData += cipher.final('hex');

    return {
      encryptedData,
      iv: iv.toString('hex')
    };
  }

  /**
   * Decrypt data using configured encryption method
   * @param encryptedData Encrypted data
   * @param iv Initialization vector
   * @returns Decrypted data
   */
  private decryptData(encryptedData: string, iv: string): string {
    // Derive encryption key
    const key = this.deriveKey();

    // Create decipher
    const decipher = crypto.createDecipheriv(
      this.config.algorithm, 
      key, 
      Buffer.from(iv, 'hex')
    );

    // Decrypt data
    let decryptedData = decipher.update(encryptedData, 'hex', 'utf8');
    decryptedData += decipher.final('utf8');

    return decryptedData;
  }

  /**
   * Derive encryption key from master key
   * @returns Derived encryption key
   */
  private deriveKey(): Buffer {
    return crypto.pbkdf2Sync(
      this.config.masterKey,
      'credential-vault-salt',
      this.config.keyDerivationIterations,
      32,
      'sha256'
    );
  }

  /**
   * Ensure storage directory exists
   */
  private ensureStorageDirectory(): void {
    try {
      // Create directory if it doesn't exist
      fs.mkdirSync(this.config.storagePath, { 
        recursive: true,
        mode: 0o700 // Restrict permissions
      });
    } catch (error) {
      // Throw if directory creation fails
      throw new Error(`Failed to create credential storage directory: ${error.message}`);
    }
  }

  /**
   * Get file path for a credential
   * @param id Credential identifier
   * @returns Full file path
   */
  private getCredentialFilePath(id: string): string {
    // Sanitize ID to prevent directory traversal
    const sanitizedId = id.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return path.join(this.config.storagePath, `${sanitizedId}.json`);
  }

  /**
   * Update last accessed timestamp
   * @param id Credential identifier
   * @param entry Credential entry
   */
  private updateLastAccessed(id: string, entry: CredentialEntry): void {
    // Update last accessed timestamp
    entry.metadata.lastAccessed = Date.now();

    // Write updated entry
    const filePath = this.getCredentialFilePath(id);
    fs.writeFileSync(filePath, JSON.stringify(entry), { mode: 0o600 });
  }

  /**
   * Validate credential data before storage
   * @param data Credential data to validate
   */
  private validateCredentialData(data: any): void {
    if (data === null || data === undefined) {
      throw new Error('Credential data cannot be null or undefined');
    }

    if (typeof data !== 'object') {
      throw new Error('Credential data must be an object');
    }
  }
}

// Export a singleton instance for convenient use
export const credentialVault = new CredentialVault();