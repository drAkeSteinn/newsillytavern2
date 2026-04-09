// ============================================
// Structured Logging System
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

// Log levels priority
const LOG_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Configuration
interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStoredLogs: number;
}

const defaultConfig: LoggerConfig = {
  minLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  enableConsole: true,
  enableStorage: false,
  maxStoredLogs: 100
};

let config = { ...defaultConfig };
const storedLogs: LogEntry[] = [];

// ============================================
// Logger Class
// ============================================

class Logger {
  private category: string;

  constructor(category: string) {
    this.category = category;
  }

  /**
   * Log a debug message (development only)
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, data?: Record<string, unknown>): void {
    this.log('error', message, data);
  }

  /**
   * Log with error object
   */
  errorWithStack(message: string, error: Error, data?: Record<string, unknown>): void {
    this.log('error', message, {
      ...data,
      errorMessage: error.message,
      stack: error.stack
    });
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    // Check if this log level should be processed
    if (LOG_PRIORITY[level] < LOG_PRIORITY[config.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category: this.category,
      message,
      data
    };

    // Store if enabled
    if (config.enableStorage) {
      storedLogs.push(entry);
      if (storedLogs.length > config.maxStoredLogs) {
        storedLogs.shift();
      }
    }

    // Console output if enabled
    if (config.enableConsole) {
      const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${this.category}]`;
      
      switch (level) {
        case 'debug':
          // Only show debug in development
          if (process.env.NODE_ENV !== 'production') {
            console.debug(prefix, message, data || '');
          }
          break;
        case 'info':
          console.info(prefix, message, data || '');
          break;
        case 'warn':
          console.warn(prefix, message, data || '');
          break;
        case 'error':
          // Enhanced error logging for better debugging
          if (data?.error instanceof Error) {
            const err = data.error as Error;
            console.error(prefix, message, {
              errorMessage: err.message,
              errorName: err.name,
              stack: err.stack,
              ...data,
            });
          } else if (data?.message && data?.stack) {
            // Already formatted error
            console.error(prefix, message, data);
          } else {
            console.error(prefix, message, data || '');
          }
          break;
      }
    }
  }
}

// ============================================
// Logger Registry
// ============================================

const loggers = new Map<string, Logger>();

/**
 * Get or create a logger for a category
 */
export function getLogger(category: string): Logger {
  if (!loggers.has(category)) {
    loggers.set(category, new Logger(category));
  }
  return loggers.get(category)!;
}

// ============================================
// Configuration Functions
// ============================================

/**
 * Update logger configuration
 */
export function configureLogger(newConfig: Partial<LoggerConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current configuration
 */
export function getLoggerConfig(): Readonly<LoggerConfig> {
  return { ...config };
}

/**
 * Get all stored logs
 */
export function getStoredLogs(): ReadonlyArray<LogEntry> {
  return [...storedLogs];
}

/**
 * Clear stored logs
 */
export function clearStoredLogs(): void {
  storedLogs.length = 0;
}

/**
 * Export logs as JSON string
 */
export function exportLogs(): string {
  return JSON.stringify(storedLogs, null, 2);
}

// ============================================
// Pre-configured Loggers
// ============================================

// Commonly used loggers
export const chatLogger = getLogger('chat');
export const llmLogger = getLogger('llm');
export const storeLogger = getLogger('store');
export const apiLogger = getLogger('api');
export const uiLogger = getLogger('ui');
export const persistenceLogger = getLogger('persistence');

// ============================================
// Utility Functions
// ============================================

/**
 * Create a timer for performance logging
 */
export function createTimer(label: string): {
  elapsed: () => number;
  log: (message?: string) => void;
} {
  const start = performance.now();
  
  return {
    elapsed: () => performance.now() - start,
    log: (message) => {
      const elapsed = performance.now() - start;
      uiLogger.debug(`[${label}] ${message || 'completed'} in ${elapsed.toFixed(2)}ms`);
    }
  };
}

/**
 * Wrap an async function with error logging
 */
export function withErrorLogging<T>(
  category: string,
  fn: () => Promise<T>,
  errorMessage: string
): Promise<T> {
  const logger = getLogger(category);
  return fn().catch((error) => {
    logger.errorWithStack(errorMessage, error);
    throw error;
  });
}
