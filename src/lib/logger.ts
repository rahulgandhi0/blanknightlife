/**
 * Production-Grade Structured Logger
 * 
 * Features:
 * - Log levels: DEBUG, INFO, WARN, ERROR
 * - Development: Pretty-printed colorful logs
 * - Production: Structured JSON with timestamps and correlation IDs
 * - Context support for passing metadata with every log
 * - Singleton pattern for consistent logging across the app
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  correlationId?: string;
  userId?: string;
  postId?: string;
  profileId?: string;
  accountId?: string | number;
  url?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

class Logger {
  private static instance: Logger;
  private minLogLevel: LogLevel;
  private isDevelopment: boolean;

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    
    // Parse LOG_LEVEL environment variable, default to DEBUG in dev, INFO in prod
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
    if (envLogLevel && envLogLevel in LogLevel) {
      this.minLogLevel = LogLevel[envLogLevel as keyof typeof LogLevel];
    } else {
      this.minLogLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Set minimum log level dynamically
   */
  public setLogLevel(level: LogLevel): void {
    this.minLogLevel = level;
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLogLevel;
  }

  /**
   * Format timestamp for display
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Pretty-print log for development
   */
  private prettyPrint(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    
    // Color-code by log level
    let levelColor = colors.white;
    let levelLabel = 'INFO';
    let emoji = 'ℹ️';
    
    switch (level) {
      case LogLevel.DEBUG:
        levelColor = colors.gray;
        levelLabel = 'DEBUG';
        emoji = '🔍';
        break;
      case LogLevel.INFO:
        levelColor = colors.blue;
        levelLabel = 'INFO';
        emoji = 'ℹ️';
        break;
      case LogLevel.WARN:
        levelColor = colors.yellow;
        levelLabel = 'WARN';
        emoji = '⚠️';
        break;
      case LogLevel.ERROR:
        levelColor = colors.red;
        levelLabel = 'ERROR';
        emoji = '❌';
        break;
    }

    // Build log line
    const timestampStr = `${colors.gray}${timestamp}${colors.reset}`;
    const levelStr = `${levelColor}${colors.bright}${levelLabel.padEnd(5)}${colors.reset}`;
    const messageStr = `${levelColor}${message}${colors.reset}`;
    
    console.log(`${emoji} ${timestampStr} ${levelStr} ${messageStr}`);

    // Print context if present
    if (context && Object.keys(context).length > 0) {
      console.log(`${colors.gray}  Context:${colors.reset}`, this.formatContextForDisplay(context));
    }

    // Print error details if present
    if (error) {
      console.error(`${colors.red}  Error: ${error.message}${colors.reset}`);
      if (error.stack) {
        console.error(`${colors.dim}${error.stack}${colors.reset}`);
      }
    }
  }

  /**
   * Format context object for readable display
   */
  private formatContextForDisplay(context: LogContext): string {
    const formatted: string[] = [];
    
    // Prioritize important fields
    const priorityFields = ['correlationId', 'method', 'url', 'statusCode', 'durationMs'];
    
    priorityFields.forEach(field => {
      if (context[field] !== undefined) {
        const value = context[field];
        let coloredValue = value;
        
        // Color-code specific fields
        if (field === 'statusCode') {
          const code = value as number;
          if (code >= 500) {
            coloredValue = `${colors.red}${code}${colors.reset}`;
          } else if (code >= 400) {
            coloredValue = `${colors.yellow}${code}${colors.reset}`;
          } else if (code >= 200 && code < 300) {
            coloredValue = `${colors.green}${code}${colors.reset}`;
          }
        } else if (field === 'durationMs') {
          const duration = value as number;
          if (duration > 1000) {
            coloredValue = `${colors.red}${duration}ms${colors.reset}`;
          } else if (duration > 500) {
            coloredValue = `${colors.yellow}${duration}ms${colors.reset}`;
          } else {
            coloredValue = `${colors.green}${duration}ms${colors.reset}`;
          }
        } else if (field === 'correlationId') {
          coloredValue = `${colors.cyan}${value}${colors.reset}`;
        }
        
        formatted.push(`${colors.dim}${field}:${colors.reset} ${coloredValue}`);
      }
    });

    // Add remaining fields
    Object.entries(context).forEach(([key, value]) => {
      if (!priorityFields.includes(key)) {
        formatted.push(`${colors.dim}${key}:${colors.reset} ${value}`);
      }
    });

    return formatted.join(', ');
  }

  /**
   * Output structured JSON for production
   */
  private structuredLog(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    const entry: LogEntry = {
      timestamp: this.getTimestamp(),
      level: LogLevel[level],
      message,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        message: error.message,
        name: error.name,
        stack: error.stack,
      };
    }

    // Output as single-line JSON for log aggregation tools
    console.log(JSON.stringify(entry));
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    if (this.isDevelopment) {
      this.prettyPrint(level, message, context, error);
    } else {
      this.structuredLog(level, message, context, error);
    }
  }

  /**
   * Public logging methods
   */
  public debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  public error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Convenience method for timing operations
   */
  public time(label: string, context?: LogContext): () => void {
    const startTime = Date.now();
    this.debug(`[TIMER START] ${label}`, context);

    return () => {
      const durationMs = Date.now() - startTime;
      this.debug(`[TIMER END] ${label}`, { ...context, durationMs });
    };
  }

  /**
   * Create a child logger with persistent context
   */
  public child(persistentContext: LogContext): ChildLogger {
    return new ChildLogger(this, persistentContext);
  }
}

/**
 * Child logger that inherits parent logger but includes persistent context
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private persistentContext: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.persistentContext, ...context };
  }

  public debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  public info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  public warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  public error(message: string, context?: LogContext, error?: Error): void {
    this.parent.error(message, this.mergeContext(context), error);
  }

  public time(label: string, context?: LogContext): () => void {
    return this.parent.time(label, this.mergeContext(context));
  }
}

/**
 * Export singleton instance
 */
export const logger = Logger.getInstance();

/**
 * Export type for child logger
 */
export type { ChildLogger };
