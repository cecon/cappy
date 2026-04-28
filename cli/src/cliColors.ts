const ESC = "\x1b[";
const RESET = `${ESC}0m`;

export const BOLD = `${ESC}1m`;
export const CYAN = `${ESC}36m`;
export const GRAY = `${ESC}90m`;
export const GREEN = `${ESC}32m`;
export const RED = `${ESC}31m`;
export const YELLOW = `${ESC}33m`;

export function c(color: string, text: string): string {
  return `${color}${text}${RESET}`;
}
