/**
 * Port: structured logger abstraction.
 * Implementations can write to VS Code Output Channel, console, or test buffers.
 */

export interface ILogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string, cause?: unknown): void;
  debug(message: string): void;
}
