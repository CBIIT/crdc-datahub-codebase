import env from "../env";

/**
 * Represents the different log levels that can be used.
 */
export type LogLevel = "error" | "info";

/**
 * A simple wrapper for the `console.log` function.
 *
 * @note Do not use this function directly. Use the `Logger` object instead.
 * @param level The log level to use.
 * @param message The message to log to the console.
 * @param optionalParams Any additional parameters to log with the message.
 * @returns void
 */
const LoggingWrapper = (level: LogLevel, message: string, ...optionalParams: unknown[]): void => {
  // Skip logging in a testing context.
  if (env?.NODE_ENV === "test") {
    return;
  }

  // Skip logging on stage or production environments.
  if (env?.VITE_DEV_TIER === "prod" || env?.VITE_DEV_TIER === "stage") {
    return;
  }

  const timestamp = new Date().toISOString();
  switch (level) {
    case "error":
      // eslint-disable-next-line no-console
      console.error(`[ERROR] [${timestamp}] ${message}`, ...optionalParams);
      break;
    case "info":
      // eslint-disable-next-line no-console
      console.info(`%c[INFO] [${timestamp}] ${message}`, "color: #90D5FF;", ...optionalParams);
      break;
  }
};

/**
 * Represents the definition of a logger function.
 */
export type LoggerFunction = (message: string, ...optionalParams: unknown[]) => void;

/**
 * Provides a simple logging interface for the application.
 */
export const Logger: Readonly<Record<LogLevel, LoggerFunction>> = {
  /**
   * A simple error logging function.
   *
   * @see {@link LoggingWrapper} for more information.
   */
  error: (message: string, ...optionalParams: unknown[]) =>
    LoggingWrapper("error", message, ...optionalParams),
  /**
   * A simple info logging function.
   *
   * @see {@link LoggingWrapper} for more information.
   */
  info: (message: string, ...optionalParams: unknown[]) =>
    LoggingWrapper("info", message, ...optionalParams),
};
