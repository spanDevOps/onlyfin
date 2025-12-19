import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  error?: any;
}

class Logger {
  private logsDir: string;
  private logFileName: string;
  private isServerless: boolean;

  constructor() {
    // Detect serverless environment (Vercel, AWS Lambda, etc.)
    this.isServerless = !!(
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.NETLIFY
    );

    this.logsDir = join(process.cwd(), 'logs');
    // Create log file name once when logger is initialized (per server session)
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const time = now.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-MM-SS
    this.logFileName = `app-${date}_${time}.log`;
    
    // Only create logs directory if not in serverless environment
    if (!this.isServerless) {
      this.ensureLogsDir();
    }
  }

  private ensureLogsDir() {
    try {
      if (!existsSync(this.logsDir)) {
        mkdirSync(this.logsDir, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, category, message, data, error } = entry;
    let logLine = `[${timestamp}] [${level}] [${category}] ${message}`;
    
    if (data) {
      logLine += ` | Data: ${JSON.stringify(data)}`;
    }
    
    if (error) {
      logLine += ` | Error: ${error.stack || error.message || JSON.stringify(error)}`;
    }
    
    return logLine;
  }

  private log(level: LogLevel, category: string, message: string, data?: any, error?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      error,
    };

    // Console log
    const formattedLog = this.formatLogEntry(entry);
    
    if (level === 'ERROR') {
      console.error(formattedLog);
    } else if (level === 'WARN') {
      console.warn(formattedLog);
    } else {
      console.log(formattedLog);
    }

    // Write to file (synchronous for reliability) - skip in serverless environments
    if (!this.isServerless) {
      try {
        const logFile = join(this.logsDir, this.logFileName);
        const logLine = formattedLog + '\n';
        appendFileSync(logFile, logLine, 'utf-8');
      } catch (error) {
        // Don't log errors about logging to avoid infinite loops
        console.error('Failed to write to log file:', error);
      }
    }
  }

  debug(category: string, message: string, data?: any) {
    this.log('DEBUG', category, message, data);
  }

  info(category: string, message: string, data?: any) {
    this.log('INFO', category, message, data);
  }

  warn(category: string, message: string, data?: any) {
    this.log('WARN', category, message, data);
  }

  error(category: string, message: string, error?: any, data?: any) {
    this.log('ERROR', category, message, data, error);
  }

  // Specialized logging methods
  apiRequest(endpoint: string, data?: any) {
    this.info('API_REQUEST', `Incoming request to ${endpoint}`, data);
  }

  apiResponse(endpoint: string, status: number, data?: any) {
    this.info('API_RESPONSE', `Response from ${endpoint} - Status: ${status}`, data);
  }

  llmRequest(provider: string, model: string, data?: any) {
    this.info('LLM_REQUEST', `LLM request to ${provider}/${model}`, data);
  }

  llmResponse(provider: string, model: string, data?: any) {
    this.info('LLM_RESPONSE', `LLM response from ${provider}/${model}`, data);
  }

  toolCall(toolName: string, params: any) {
    this.debug('TOOL_CALL', `Tool invoked: ${toolName}`, params);
  }

  toolResult(toolName: string, result: any) {
    this.debug('TOOL_RESULT', `Tool result: ${toolName}`, result);
  }

  userMessage(messageId: string, content: string) {
    this.info('USER_MESSAGE', `User message [${messageId}]`, { content });
  }

  assistantMessage(messageId: string, content: string) {
    this.info('ASSISTANT_MESSAGE', `Assistant message [${messageId}]`, { content });
  }

  modelSwitch(from: string, to: string, reason?: string) {
    this.info('MODEL_SWITCH', `Model switched from ${from} to ${to}`, { reason });
  }

  performanceMetric(operation: string, durationMs: number, data?: any) {
    this.debug('PERFORMANCE', `${operation} took ${durationMs}ms`, data);
  }
}

// Singleton instance
export const logger = new Logger();
