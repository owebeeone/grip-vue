/**
 * Simple browser-compatible logger that replaces consola for browser environments.
 * 
 * Provides a consola-like API but uses console directly, avoiding Node.js dependencies.
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface Logger {
  log(...args: any[]): void;
  info(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  debug(...args: any[]): void;
  withTag(tag: string): Logger;
}

class SimpleLogger implements Logger {
  private tag: string;

  constructor(tag: string = '') {
    this.tag = tag;
  }

  private formatMessage(...args: any[]): any[] {
    if (this.tag) {
      return [`[${this.tag}]`, ...args];
    }
    return args;
  }

  private isProduction(): boolean {
    // Check for production mode in a browser-safe way
    if (typeof process !== 'undefined' && process.env) {
      return process.env.NODE_ENV === 'production';
    }
    // In browser, assume development unless explicitly set
    return false;
  }

  log(...args: any[]): void {
    if (!this.isProduction()) {
      console.log(...this.formatMessage(...args));
    }
  }

  info(...args: any[]): void {
    if (!this.isProduction()) {
      console.info(...this.formatMessage(...args));
    }
  }

  warn(...args: any[]): void {
    console.warn(...this.formatMessage(...args));
  }

  error(...args: any[]): void {
    console.error(...this.formatMessage(...args));
  }

  debug(...args: any[]): void {
    if (!this.isProduction()) {
      console.debug(...this.formatMessage(...args));
    }
  }

  withTag(tag: string): Logger {
    return new SimpleLogger(tag);
  }
}

// Export a consola-like API
export const logger = new SimpleLogger();
export const consola = {
  withTag: (tag: string) => new SimpleLogger(tag),
  log: (...args: any[]) => logger.log(...args),
  info: (...args: any[]) => logger.info(...args),
  warn: (...args: any[]) => logger.warn(...args),
  error: (...args: any[]) => logger.error(...args),
  debug: (...args: any[]) => logger.debug(...args),
  setReporters: (_reporters: any[]) => {
    // No-op: we just use console directly
  },
};

