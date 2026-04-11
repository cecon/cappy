/**
 * Domain service: shell log text formatting.
 * Extracted from Chat.tsx formatAgentShell* functions. Pure string transforms.
 */

/**
 * Formats the start line of a shell command echo (cwd + $ prompt).
 */
export function formatShellStart(command: string, cwd?: string): string {
  const cwdLine = cwd ? `# cwd: ${cwd}\n` : "";
  return `${cwdLine}$ ${command}\n`;
}

/**
 * Formats stdout/stderr returned by the tool exec.
 * If errorText is provided it takes precedence over stdout/stderr.
 */
export function formatShellComplete(opts: {
  stdout: string;
  stderr: string;
  errorText?: string;
}): string {
  if (opts.errorText !== undefined && opts.errorText.length > 0) {
    return `${opts.errorText}\n`;
  }
  let block = "";
  if (opts.stdout.length > 0) {
    block += opts.stdout.endsWith("\n") ? opts.stdout : `${opts.stdout}\n`;
  }
  if (opts.stderr.length > 0) {
    block += "\n# stderr\n";
    block += opts.stderr.endsWith("\n") ? opts.stderr : `${opts.stderr}\n`;
  }
  return block;
}
