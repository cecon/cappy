import type { ComponentProps, ReactNode } from "react";
import { CopyButton } from "./CopyButton";
import styles from "./MessageList.module.css";

/** Extrai texto puro recursivamente dos children do React */
function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node !== null && typeof node === "object" && "props" in node) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return extractText((node as any).props.children as ReactNode);
  }
  return "";
}

export function CodeBlock({ children, ...props }: ComponentProps<"pre">): JSX.Element {
  const text = extractText(children as ReactNode);

  return (
    <pre {...props} className={styles.codeBlock}>
      <CopyButton value={text} {...(styles.copyButtonCode !== undefined ? { className: styles.copyButtonCode } : {})} />
      {children}
    </pre>
  );
}
