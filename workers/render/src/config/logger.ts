/**
 * Structured logger for the render worker.
 *
 * Outputs JSON-structured log lines to stdout. Supports level filtering
 * and correlation IDs for tracing render jobs across log lines.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

interface LogEntry {
    level: LogLevel;
    timestamp: string;
    message: string;
    jobId?: string;
    stage?: string;
    durationMs?: number;
    error?: string;
    [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Level ordering
// ---------------------------------------------------------------------------

const LEVEL_VALUES: Record<LogLevel | 'silent', number> = {
    fatal: 60,
    error: 50,
    warn: 40,
    info: 30,
    debug: 20,
    trace: 10,
    silent: Infinity,
};

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

let _minLevel: number = LEVEL_VALUES.info;

/**
 * Set the minimum log level. Messages below this level are suppressed.
 */
export function setLogLevel(level: LogLevel | 'silent'): void {
    _minLevel = LEVEL_VALUES[level];
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_VALUES[level] < _minLevel) return;

    const entry: LogEntry = {
        level,
        timestamp: new Date().toISOString(),
        message,
        ...meta,
    };

    const line = JSON.stringify(entry);

    if (level === 'error' || level === 'fatal') {
        process.stderr.write(line + '\n');
    } else {
        process.stdout.write(line + '\n');
    }
}

export const logger = {
    fatal: (msg: string, meta?: Record<string, unknown>) => emit('fatal', msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => emit('warn', msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => emit('info', msg, meta),
    debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, meta),
    trace: (msg: string, meta?: Record<string, unknown>) => emit('trace', msg, meta),

    /**
     * Create a child logger with pre-set metadata fields.
     * Useful for adding `jobId` to all log lines for a request.
     */
    child(defaults: Record<string, unknown>) {
        return {
            fatal: (msg: string, meta?: Record<string, unknown>) =>
                emit('fatal', msg, { ...defaults, ...meta }),
            error: (msg: string, meta?: Record<string, unknown>) =>
                emit('error', msg, { ...defaults, ...meta }),
            warn: (msg: string, meta?: Record<string, unknown>) =>
                emit('warn', msg, { ...defaults, ...meta }),
            info: (msg: string, meta?: Record<string, unknown>) =>
                emit('info', msg, { ...defaults, ...meta }),
            debug: (msg: string, meta?: Record<string, unknown>) =>
                emit('debug', msg, { ...defaults, ...meta }),
            trace: (msg: string, meta?: Record<string, unknown>) =>
                emit('trace', msg, { ...defaults, ...meta }),
        };
    },
};

export type Logger = typeof logger;
export type ChildLogger = ReturnType<typeof logger.child>;
