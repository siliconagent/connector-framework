// src/security/audit-logger.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Audit log entry types
 */
export enum AuditLogType {
  AUTHENTICATION = 'authentication',
  CONNECTION = 'connection',
  OPERATION = 'operation',
  SECURITY = 'security',
  SYSTEM = 'system'
}

/**
 * Audit log entry severity levels
 */
export enum AuditLogSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  /**
   * Unique identifier for the log entry
   */
  id: string;

  /**
   * Timestamp of the log entry
   */
  timestamp: number;

  /**
   * Type of log entry
   */
  type: AuditLogType;

  /**
   * Severity of the log entry
   */
  severity: AuditLogSeverity;

  /**
   * Description of the event
   */
  description: string;

  /**
   * Additional context for the log entry
   */
  context?: Record<string, any>;

  /**
   * User or system agent responsible for the action
   */
  actor?: string;

  /**
   * IP address or source of the action
   */
  source?: string;
}

/**
 * Audit Logger configuration
 */
export interface AuditLoggerConfig {
  /**
   * Directory to store log files
   */
  logDirectory?: string;

  /**
   * Maximum log file size (in bytes)
   */
  maxLogFileSize?: number;

  /**
   * Number of backup log files to keep
   */
  maxLogFiles?: number;

  /**
   * Enable console logging
   */
  consoleLogging?: boolean;
}

/**
 * Audit Logger for tracking and recording system events
 */
export class AuditLogger {
  /**
   * Logger configuration
   */
  private config: Required<AuditLoggerConfig> = {
    logDirectory: path.join(process.cwd(), 'logs', 'audit'),
    maxLogFileSize: 10 * 1024 * 1024, // 10 MB
    maxLogFiles: 5,
    consoleLogging: false
  };

  /**
   * Constructor
   * @param config Optional configuration
   */
  constructor(config: AuditLoggerConfig = {}) {
    // Merge config with defaults
    this.config = {
      ...this.config,
    };

    // Ensure log directory exists
    this.ensureLogDirectory();
  }

  /**
   * Log an audit entry
   * @param entry Audit log entry
   */
  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    // Generate unique log entry
    const logEntry: AuditLogEntry = {
      id: this.generateLogEntryId(),
      timestamp: Date.now(),
      ...entry
    };

    // Write to file
    this.writeToLogFile(logEntry);

    // Optional console logging
    if (this.config.consoleLogging) {
      this.logToConsole(logEntry);
    }
  }

  /**
   * Log an authentication event
   * @param description Event description
   * @param context Additional context
   * @param severity Severity level
   */
  logAuthentication(
    description: string, 
    context?: Record<string, any>, 
    severity: AuditLogSeverity = AuditLogSeverity.INFO
  ): void {
    this.log({
      type: AuditLogType.AUTHENTICATION,
      description,
      context,
      severity
    });
  }

  /**
   * Log a connection event
   * @param description Event description
   * @param context Additional context
   * @param severity Severity level
   */
  logConnection(
    description: string, 
    context?: Record<string, any>, 
    severity: AuditLogSeverity = AuditLogSeverity.INFO
  ): void {
    this.log({
      type: AuditLogType.CONNECTION,
      description,
      context,
      severity
    });
  }

  /**
   * Log an operation event
   * @param description Event description
   * @param context Additional context
   * @param severity Severity level
   */
  logOperation(
    description: string, 
    context?: Record<string, any>, 
    severity: AuditLogSeverity = AuditLogSeverity.INFO
  ): void {
    this.log({
      type: AuditLogType.OPERATION,
      description,
      context,
      severity
    });
  }

  /**
   * Log a security event
   * @param description Event description
   * @param context Additional context
   * @param severity Severity level
   */
  logSecurity(
    description: string, 
    context?: Record<string, any>, 
    severity: AuditLogSeverity = AuditLogSeverity.WARNING
  ): void {
    this.log({
      type: AuditLogType.SECURITY,
      description,
      context,
      severity
    });
  }

  /**
   * Log a system event
   * @param description Event description
   * @param context Additional context
   * @param severity Severity level
   */
  logSystem(
    description: string, 
    context?: Record<string, any>, 
    severity: AuditLogSeverity = AuditLogSeverity.INFO
  ): void {
    this.log({
      type: AuditLogType.SYSTEM,
      description,
      context,
      severity
    });
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    try {
      fs.mkdirSync(this.config.logDirectory, { 
        recursive: true,
        mode: 0o700 // Restrict permissions
      });
    } catch (error) {
      console.error('Failed to create audit log directory:', error);
    }
  }

  /**
   * Write log entry to file
   * @param entry Log entry to write
   */
  private writeToLogFile(entry: AuditLogEntry): void {
    try {
      // Rotate logs if needed
      this.rotateLogsIfNeeded();

      // Generate log filename
      const filename = this.getCurrentLogFilename();
      const logLine = JSON.stringify(entry) + '\n';

      // Append to log file
      fs.appendFileSync(filename, logLine, { 
        mode: 0o600 // Restrict file permissions
      });
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Log to console
   * @param entry Log entry to log
   */
  private logToConsole(entry: AuditLogEntry): void {
    const consoleMethod = this.getConsoleMethodForSeverity(entry.severity);
    consoleMethod(
      `[${entry.type.toUpperCase()}] ${entry.description}`,
      entry
    );
  }

  /**
   * Get appropriate console logging method based on severity
   * @param severity Log entry severity
   * @returns Console logging method
   */
  private getConsoleMethodForSeverity(severity: AuditLogSeverity) {
    switch (severity) {
      case AuditLogSeverity.CRITICAL:
      case AuditLogSeverity.ERROR:
        return console.error;
      case AuditLogSeverity.WARNING:
        return console.warn;
      default:
        return console.log;
    }
  }

  /**
   * Generate unique log entry ID
   * @returns Unique log entry identifier
   */
  private generateLogEntryId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Get current log filename
   * @returns Full path to current log file
   */
  private getCurrentLogFilename(): string {
    const date = new Date();
    const filename = `audit-${date.toISOString().split('T')[0]}.log`;
    return path.join(this.config.logDirectory, filename);
  }

  /**
   * Rotate logs if file size exceeds limit
   */
  private rotateLogsIfNeeded(): void {
    const currentLogFile = this.getCurrentLogFilename();

    try {
      // Check file size
      const stats = fs.statSync(currentLogFile);
      if (stats.size >= this.config.maxLogFileSize) {
        this.performLogRotation();
      }
    } catch (error) {
      // File doesn't exist, no rotation needed
      if (error.code !== 'ENOENT') {
        console.error('Error checking log file size:', error);
      }
    }
  }

  /**
   * Perform log file rotation
   */
  private performLogRotation(): void {
    const logDirectory = this.config.logDirectory;
    
    // Get existing log files
    const logFiles = fs.readdirSync(logDirectory)
      .filter(file => file.startsWith('audit-') && file.endsWith('.log'))
      .sort()
      .reverse();

    // Remove excess log files
    while (logFiles.length >= this.config.maxLogFiles) {
      const oldestLogFile = logFiles.pop();
      if (oldestLogFile) {
        fs.unlinkSync(path.join(logDirectory, oldestLogFile));
      }
    }
  }
}

// Export a singleton instance for convenient use
export const auditLogger = new AuditLogger();