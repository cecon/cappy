/**
 * @fileoverview Environment scrubber for subprocess safety.
 * @module infrastructure/sandbox/EnvScrubber
 */

/**
 * Builds a scrubbed copy of process env for command execution.
 */
export class EnvScrubber {
  private readonly sensitiveKeys = [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GITHUB_TOKEN',
    'AWS_SECRET_ACCESS_KEY',
    'AZURE_CLIENT_SECRET',
    'GOOGLE_APPLICATION_CREDENTIALS',
  ];

  /**
   * Returns sanitized environment map.
   */
  sanitize(input: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const env = { ...input };
    for (const key of this.sensitiveKeys) {
      delete env[key];
    }
    return env;
  }
}

