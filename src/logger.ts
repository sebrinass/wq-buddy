/**
 * Alpha Workbench 日志模块
 * 支持多级别日志，参考 agent-search 的 logging.ts
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

let currentLogLevel: LogLevel = 'info';

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',
  info: '\x1b[32m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  silent: ''
};

const LOG_PREFIXES: Record<LogLevel, string> = {
  debug: '🔍 DEBUG',
  info: 'ℹ️ INFO',
  warn: '⚠️ WARN',
  error: '❌ ERROR',
  silent: ''
};

function shouldLog(level: LogLevel): boolean {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  return levels.indexOf(level) >= levels.indexOf(currentLogLevel);
}

function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

export function log(level: LogLevel, message: string, data?: unknown): void {
  if (level === 'silent' || !shouldLog(level)) return;

  const color = LOG_COLORS[level];
  const prefix = LOG_PREFIXES[level];
  const reset = '\x1b[0m';

  let output = `${color}[${prefix}]${reset} ${formatTimestamp()} - ${message}`;

  if (data !== undefined) {
    const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
    output += `\n${dataStr}`;
  }

  if (level === 'error') {
    console.error(output);
  } else {
    console.log(output);
  }
}

export function debug(message: string, data?: unknown): void {
  log('debug', message, data);
}

export function info(message: string, data?: unknown): void {
  log('info', message, data);
}

export function warn(message: string, data?: unknown): void {
  log('warn', message, data);
}

export function error(message: string, data?: unknown): void {
  log('error', message, data);
}

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
  log('info', `日志级别已设置为: ${level}`);
}

export function getCurrentLogLevel(): LogLevel {
  return currentLogLevel;
}

export default {
  log,
  debug,
  info,
  warn,
  error,
  setLogLevel,
  getCurrentLogLevel
};
