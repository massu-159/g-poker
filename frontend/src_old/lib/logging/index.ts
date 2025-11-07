/**
 * Enterprise Logging System with Correlation IDs and Audit Trails
 * Comprehensive logging solution for security, performance, and audit compliance
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateCorrelationId, generateUUID } from '../security';
import environment, { sanitizeForLogging } from '../../config/environment';

// Log levels with enterprise security focus
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
  AUDIT = 6, // Special level for audit events
}

// Log categories for enterprise organization
export enum LogCategory {
  SYSTEM = 'SYSTEM',
  SECURITY = 'SECURITY',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  GAME_ACTION = 'GAME_ACTION',
  API_CALL = 'API_CALL',
  PERFORMANCE = 'PERFORMANCE',
  ERROR = 'ERROR',
  AUDIT = 'AUDIT',
  USER_ACTION = 'USER_ACTION',
}

// Enterprise log entry interface
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  category: LogCategory;
  message: string;
  correlationId: string;
  sessionId?: string;
  userId?: string;
  gamePlayerId?: string;
  gameId?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  source?: {
    file: string;
    function: string;
    line?: number;
  };
  performance?: {
    duration: number;
    operation: string;
  };
}

// Audit-specific log entry
export interface AuditLogEntry extends LogEntry {
  auditType: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACCESS' | 'SECURITY_EVENT';
  resourceType?: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
}

// Enterprise Logger class
export class EnterpriseLogger {
  private static instance: EnterpriseLogger;
  private sessionId: string;
  private userId?: string;
  private logBuffer: LogEntry[] = [];
  private readonly maxBufferSize = 1000;
  private readonly flushInterval = 5000; // 5 seconds
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    this.sessionId = `session_${generateUUID()}`;
    this.initializeLogging();
    this.startPeriodicFlush();
  }

  public static getInstance(): EnterpriseLogger {
    if (!EnterpriseLogger.instance) {
      EnterpriseLogger.instance = new EnterpriseLogger();
    }
    return EnterpriseLogger.instance;
  }

  private async initializeLogging() {
    try {
      // Load persisted session info if available
      const persistedSessionId = await AsyncStorage.getItem('logging-session-id');
      if (persistedSessionId) {
        this.sessionId = persistedSessionId;
      } else {
        await AsyncStorage.setItem('logging-session-id', this.sessionId);
      }

      this.info(LogCategory.SYSTEM, 'Logging system initialized', {
        sessionId: this.sessionId,
        environment: environment.nodeEnv,
      });
    } catch (error) {
      console.error('Failed to initialize logging system:', error);
    }
  }

  public setUserId(userId: string) {
    this.userId = userId;
    this.info(LogCategory.AUTHENTICATION, 'User context set for logging', {
      userId: this.userId,
    });
  }

  public clearUserId() {
    const previousUserId = this.userId;
    this.userId = undefined;
    this.info(LogCategory.AUTHENTICATION, 'User context cleared from logging', {
      previousUserId,
    });
  }

  private createLogEntry(
    level: LogLevel,
    category: LogCategory,
    message: string,
    metadata?: Record<string, any>,
    error?: Error,
    correlationId?: string
  ): LogEntry {
    const entry: LogEntry = {
      id: generateUUID(),
      timestamp: new Date(),
      level,
      category,
      message,
      correlationId: correlationId || generateCorrelationId(),
      sessionId: this.sessionId,
      userId: this.userId,
      metadata: metadata ? sanitizeForLogging(metadata) : undefined,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: environment.isDevelopment ? error.stack : undefined,
      };
    }

    // Add source information if available (for development)
    if (environment.isDevelopment) {
      const stack = new Error().stack;
      const stackLines = stack?.split('\n') || [];
      const callerLine = stackLines[3]; // Skip createLogEntry, log method, and Error creation

      if (callerLine) {
        const match = callerLine.match(/at\s+(.+?)\s+\((.+?):(\d+):\d+\)/);
        if (match) {
          entry.source = {
            function: match[1],
            file: match[2].split('/').pop() || match[2],
            line: parseInt(match[3]),
          };
        }
      }
    }

    return entry;
  }

  private addToBuffer(entry: LogEntry) {
    this.logBuffer.push(entry);

    // Output to console in development
    if (environment.isDevelopment || environment.enableLogging) {
      this.outputToConsole(entry);
    }

    // Manage buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }

    // Force flush for critical logs
    if (entry.level >= LogLevel.ERROR || entry.category === LogCategory.AUDIT) {
      this.flush();
    }
  }

  private outputToConsole(entry: LogEntry) {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level];
    const category = entry.category;
    const correlationId = entry.correlationId.substring(0, 8);

    const prefix = `[${timestamp}] [${level}] [${category}] [${correlationId}]`;
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(message, entry.metadata);
        break;
      case LogLevel.INFO:
        console.info(message, entry.metadata);
        break;
      case LogLevel.WARN:
        console.warn(message, entry.metadata);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(message, entry.metadata, entry.error);
        break;
      case LogLevel.AUDIT:
        console.log(`🔍 AUDIT: ${message}`, entry.metadata);
        break;
    }
  }

  private async flush() {
    if (this.logBuffer.length === 0) {
      return;
    }

    try {
      // In a real implementation, you would send these to a logging service
      // For now, we'll persist critical logs locally
      const criticalLogs = this.logBuffer.filter(
        entry => entry.level >= LogLevel.ERROR || entry.category === LogCategory.AUDIT
      );

      if (criticalLogs.length > 0) {
        const existingLogs = await AsyncStorage.getItem('critical-logs') || '[]';
        const parsedLogs = JSON.parse(existingLogs);
        const updatedLogs = [...parsedLogs, ...criticalLogs];

        // Keep only last 100 critical logs
        const trimmedLogs = updatedLogs.slice(-100);
        await AsyncStorage.setItem('critical-logs', JSON.stringify(trimmedLogs));
      }

      // Clear buffer after successful flush
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to flush logs:', error);
    }
  }

  private startPeriodicFlush() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  public async shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }

  // Public logging methods
  public trace(category: LogCategory, message: string, metadata?: Record<string, any>, correlationId?: string) {
    if (!environment.isDevelopment) return; // Trace only in development
    const entry = this.createLogEntry(LogLevel.TRACE, category, message, metadata, undefined, correlationId);
    this.addToBuffer(entry);
  }

  public debug(category: LogCategory, message: string, metadata?: Record<string, any>, correlationId?: string) {
    if (!environment.isDevelopment) return; // Debug only in development
    const entry = this.createLogEntry(LogLevel.DEBUG, category, message, metadata, undefined, correlationId);
    this.addToBuffer(entry);
  }

  public info(category: LogCategory, message: string, metadata?: Record<string, any>, correlationId?: string) {
    const entry = this.createLogEntry(LogLevel.INFO, category, message, metadata, undefined, correlationId);
    this.addToBuffer(entry);
  }

  public warn(category: LogCategory, message: string, metadata?: Record<string, any>, correlationId?: string) {
    const entry = this.createLogEntry(LogLevel.WARN, category, message, metadata, undefined, correlationId);
    this.addToBuffer(entry);
  }

  public error(category: LogCategory, message: string, error?: Error, metadata?: Record<string, any>, correlationId?: string) {
    const entry = this.createLogEntry(LogLevel.ERROR, category, message, metadata, error, correlationId);
    this.addToBuffer(entry);
  }

  public fatal(category: LogCategory, message: string, error?: Error, metadata?: Record<string, any>, correlationId?: string) {
    const entry = this.createLogEntry(LogLevel.FATAL, category, message, metadata, error, correlationId);
    this.addToBuffer(entry);
  }

  // Audit logging
  public audit(auditData: Omit<AuditLogEntry, keyof LogEntry> & { message: string, correlationId?: string }): void {
    const entry: AuditLogEntry = {
      ...this.createLogEntry(LogLevel.AUDIT, LogCategory.AUDIT, auditData.message, undefined, undefined, auditData.correlationId),
      auditType: auditData.auditType,
      resourceType: auditData.resourceType,
      resourceId: auditData.resourceId,
      oldValue: auditData.oldValue ? sanitizeForLogging(auditData.oldValue) : undefined,
      newValue: auditData.newValue ? sanitizeForLogging(auditData.newValue) : undefined,
      ipAddress: auditData.ipAddress,
      userAgent: auditData.userAgent,
      success: auditData.success,
    };

    this.addToBuffer(entry);
  }

  // Performance logging
  public performance(operation: string, duration: number, metadata?: Record<string, any>, correlationId?: string) {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      LogCategory.PERFORMANCE,
      `Performance: ${operation}`,
      metadata,
      undefined,
      correlationId
    );

    entry.performance = {
      duration,
      operation,
    };

    this.addToBuffer(entry);
  }

  // Utility methods
  public async getCriticalLogs(): Promise<LogEntry[]> {
    try {
      const logs = await AsyncStorage.getItem('critical-logs');
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.error('Failed to retrieve critical logs:', error);
      return [];
    }
  }

  public async clearCriticalLogs(): Promise<void> {
    try {
      await AsyncStorage.removeItem('critical-logs');
      this.info(LogCategory.SYSTEM, 'Critical logs cleared');
    } catch (error) {
      console.error('Failed to clear critical logs:', error);
    }
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getCurrentUserId(): string | undefined {
    return this.userId;
  }
}

// Export singleton instance and utilities
export const logger = EnterpriseLogger.getInstance();

// Performance measurement utilities
export class PerformanceMeasurement {
  private startTime: number;
  private operation: string;
  private correlationId: string;
  private metadata?: Record<string, any>;

  constructor(operation: string, correlationId?: string, metadata?: Record<string, any>) {
    this.operation = operation;
    this.correlationId = correlationId || generateCorrelationId();
    this.metadata = metadata;
    this.startTime = Date.now();

    logger.debug(LogCategory.PERFORMANCE, `Starting: ${operation}`, {
      ...metadata,
      correlationId: this.correlationId,
    });
  }

  public finish(additionalMetadata?: Record<string, any>): number {
    const duration = Date.now() - this.startTime;

    logger.performance(this.operation, duration, {
      ...this.metadata,
      ...additionalMetadata,
    }, this.correlationId);

    return duration;
  }
}

// Convenience function for measuring performance
export const measurePerformance = (operation: string, correlationId?: string, metadata?: Record<string, any>) => {
  return new PerformanceMeasurement(operation, correlationId, metadata);
};

// Export types for external use
export type { LogEntry, AuditLogEntry };
export { LogLevel, LogCategory };

export default logger;