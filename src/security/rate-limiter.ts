// src/security/rate-limiter.ts
import { EventEmitter } from '../events/event-emitter';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed
   */
  maxRequests: number;

  /**
   * Time window for rate limiting (in milliseconds)
   */
  windowMs: number;

  /**
   * Blocking duration after rate limit is exceeded
   */
  blockDuration?: number;

  /**
   * Custom error message when rate limit is exceeded
   */
  errorMessage?: string;
}

/**
 * Rate limit entry tracking
 */
interface RateLimitEntry {
  /**
   * Timestamps of recent requests
   */
  timestamps: number[];

  /**
   * Timestamp when the entry was blocked
   */
  blockedUntil?: number;
}

/**
 * Rate limiting strategies
 */
export enum RateLimitStrategy {
  /**
   * Block further requests when limit is exceeded
   */
  BLOCK = 'block',

  /**
   * Queue requests when limit is exceeded
   */
  QUEUE = 'queue',

  /**
   * Silently drop requests when limit is exceeded
   */
  DROP = 'drop'
}

/**
 * Rate Limiter for managing request frequency
 */
export class RateLimiter {
  /**
   * Event emitter for rate limit events
   */
  private eventEmitter: EventEmitter;

  /**
   * Storage for rate limit entries
   */
  private limitEntries: Map<string, RateLimitEntry> = new Map();

  /**
   * Default configuration
   */
  private defaultConfig: Required<RateLimitConfig> = {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    blockDuration: 300000, // 5 minutes
    errorMessage: 'Too many requests, please try again later.'
  };

  /**
   * Constructor
   * @param config Rate limit configuration
   */
  constructor(private config: RateLimitConfig = {}) {
    // Merge config with defaults
    this.config = { ...this.defaultConfig, ...config };

    // Initialize event emitter
    this.eventEmitter = new EventEmitter();

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Check if a request is allowed
   * @param identifier Unique identifier for the request source
   * @param strategy Rate limiting strategy
   * @returns Boolean or Promise indicating if the request is allowed
   */
  isAllowed(
    identifier: string, 
    strategy: RateLimitStrategy = RateLimitStrategy.BLOCK
  ): boolean {
    const entry = this.getOrCreateEntry(identifier);

    // Check if entry is currently blocked
    if (entry.blockedUntil && entry.blockedUntil > Date.now()) {
      this.emitRateLimitEvent(identifier, 'blocked');
      return false;
    }

    // Clean up old timestamps
    this.pruneOldTimestamps(entry);

    // Check if max requests is exceeded
    const isExceeded = entry.timestamps.length >= this.config.maxRequests;

    if (isExceeded) {
      // Apply rate limit strategy
      switch (strategy) {
        case RateLimitStrategy.BLOCK:
          this.blockEntry(entry);
          this.emitRateLimitEvent(identifier, 'exceeded');
          return false;

        case RateLimitStrategy.DROP:
          this.emitRateLimitEvent(identifier, 'dropped');
          return false;

        case RateLimitStrategy.QUEUE:
          // In a real-world scenario, this would involve a more complex 
          // queuing mechanism
          this.emitRateLimitEvent(identifier, 'queued');
          return false;
      }
    }

    // Record the request timestamp
    entry.timestamps.push(Date.now());

    return true;
  }

  /**
   * Reset rate limit for a specific identifier
   * @param identifier Unique identifier
   */
  reset(identifier: string): void {
    this.limitEntries.delete(identifier);
    this.emitRateLimitEvent(identifier, 'reset');
  }

  /**
   * Get current rate limit status for an identifier
   * @param identifier Unique identifier
   * @returns Rate limit status
   */
  getStatus(identifier: string): {
    currentRequests: number;
    isBlocked: boolean;
    blockRemaining?: number;
  } {
    const entry = this.limitEntries.get(identifier);

    if (!entry) {
      return {
        currentRequests: 0,
        isBlocked: false
      };
    }

    // Prune old timestamps
    this.pruneOldTimestamps(entry);

    return {
      currentRequests: entry.timestamps.length,
      isBlocked: !!(entry.blockedUntil && entry.blockedUntil > Date.now()),
      blockRemaining: entry.blockedUntil 
        ? Math.max(0, entry.blockedUntil - Date.now()) 
        : undefined
    };
  }

  /**
   * Get or create a rate limit entry
   * @param identifier Unique identifier
   * @returns Rate limit entry
   */
  private getOrCreateEntry(identifier: string): RateLimitEntry {
    if (!this.limitEntries.has(identifier)) {
      this.limitEntries.set(identifier, { 
        timestamps: [] 
      });
    }

    return this.limitEntries.get(identifier)!;
  }

  /**
   * Prune old timestamps from an entry
   * @param entry Rate limit entry
   */
  private pruneOldTimestamps(entry: RateLimitEntry): void {
    const cutoffTime = Date.now() - this.config.windowMs;
    entry.timestamps = entry.timestamps.filter(
      timestamp => timestamp > cutoffTime
    );
  }

  /**
   * Block an entry
   * @param entry Rate limit entry
   */
  private blockEntry(entry: RateLimitEntry): void {
    entry.blockedUntil = Date.now() + this.config.blockDuration;
    entry.timestamps = []; // Clear timestamps when blocked
  }

  /**
   * Emit rate limit event
   * @param identifier Unique identifier
   * @param type Event type
   */
  private emitRateLimitEvent(
    identifier: string, 
    type: 'blocked' | 'exceeded' | 'dropped' | 'queued' | 'reset'
  ): void {
    this.eventEmitter.emit('ratelimit:event', {
      identifier,
      type,
      timestamp: Date.now()
    });
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.windowMs);
  }

  /**
   * Remove expired rate limit entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    
    for (const [identifier, entry] of this.limitEntries.entries()) {
      // Remove entries that are no longer blocked and have no recent timestamps
      if (
        (!entry.blockedUntil || entry.blockedUntil < now) && 
        entry.timestamps.length === 0
      ) {
        this.limitEntries.delete(identifier);
      }
    }
  }

  /**
   * Subscribe to rate limit events
   * @param eventName Event name
   * @param callback Event handler
   */
  on(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.on(eventName, callback);
  }

  /**
   * Unsubscribe from rate limit events
   * @param eventName Event name
   * @param callback Event handler
   */
  off(eventName: string, callback: (eventData: any) => void): void {
    this.eventEmitter.off(eventName, callback);
  }
}

// Export a singleton instance for convenient use
export const rateLimiter = new RateLimiter();