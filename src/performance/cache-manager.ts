// src/performance/cache-manager.ts
/**
 * Cache entry structure
 */
interface CacheEntry<T> {
  /**
   * Cached value
   */
  value: T;

  /**
   * Timestamp of entry creation
   */
  createdAt: number;

  /**
   * Expiration timestamp
   */
  expiresAt?: number;
}

/**
 * Cache manager configuration
 */
export interface CacheManagerConfig {
  /**
   * Default time-to-live for cache entries (in milliseconds)
   */
  defaultTTL?: number;

  /**
   * Maximum number of entries in the cache
   */
  maxEntries?: number;
}

/**
 * Cache Manager for efficient data caching
 */
export class CacheManager<T = any> {
  /**
   * Internal cache storage
   */
  private cache: Map<string, CacheEntry<T>> = new Map();

  /**
   * Configuration with defaults
   */
  private config: Required<CacheManagerConfig> = {
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    maxEntries: 1000
  };

  /**
   * Constructor
   * @param config Optional configuration
   */
  constructor(config?: CacheManagerConfig) {
    this.config = {
      ...this.config,
      ...config
    };
  }

  /**
   * Set a value in the cache
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Optional time-to-live
   */
  set(key: string, value: T, ttl?: number): void {
    // Enforce max entries limit
    this.enforceMaxEntries();

    // Calculate expiration
    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      createdAt: now,
      expiresAt: ttl ? now + ttl : now + this.config.defaultTTL
    };

    // Store in cache
    this.cache.set(key, entry);
  }

  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns Cached value or undefined
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    // Check if entry exists and is not expired
    if (entry && this.isValidEntry(entry)) {
      return entry.value;
    }

    // Remove expired entry
    if (entry) {
      this.cache.delete(key);
    }

    return undefined;
  }

  /**
   * Check if a key exists in the cache
   * @param key Cache key
   * @returns Boolean indicating cache hit
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return !!entry && this.isValidEntry(entry);
  }

  /**
   * Delete a value from the cache
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the current size of the cache
   * @returns Number of entries in the cache
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if a cache entry is valid
   * @param entry Cache entry
   * @returns Boolean indicating entry validity
   */
  private isValidEntry(entry: CacheEntry<T>): boolean {
    // Check if entry has not expired
    return !entry.expiresAt || entry.expiresAt > Date.now();
  }

  /**
   * Enforce maximum entries limit
   */
  private enforceMaxEntries(): void {
    // Remove oldest entries if max entries exceeded
    while (this.cache.size >= this.config.maxEntries) {
      // Find and remove the oldest entry
      const oldestKey = this.findOldestEntryKey();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Find the key of the oldest cache entry
   * @returns Key of the oldest entry or undefined
   */
  private findOldestEntryKey(): string | undefined {
    let oldestKey: string | undefined;
    let oldestTimestamp = Infinity;

    // Iterate through entries to find the oldest
    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTimestamp) {
        oldestKey = key;
        oldestTimestamp = entry.createdAt;
      }
    }

    return oldestKey;
  }

  /**
   * Periodic cache cleanup
   * Removes all expired entries
   */
  cleanup(): void {
    const now = Date.now();

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Create a memoized version of a function
   * @param fn Function to memoize
   * @param resolver Optional key resolver
   * @returns Memoized function
   */
  memoize<F extends (...args: any[]) => any>(
    fn: F, 
    resolver?: (...args: Parameters<F>) => string
  ): F {
    return ((...args: Parameters<F>): ReturnType<F> => {
      // Generate cache key
      const key = resolver 
        ? resolver(...args) 
        : JSON.stringify(args);

      // Check cache first
      const cachedResult = this.get(key);
      if (cachedResult !== undefined) {
        return cachedResult;
      }

      // Execute function and cache result
      const result = fn(...args);
      this.set(key, result);

      return result;
    }) as F;
  }
}

// Export a singleton instance for convenient use
export const cacheManager = new CacheManager();