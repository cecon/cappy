import type { KeyboardEvent } from "react";
import { getBridge } from "../lib/vscode-bridge";
import type { FileDiffPayload } from "../lib/types";
import styles from "./FileDiffMini.module.css";

const bridge = getBridge();

interface FileDiffMiniProps {
  diff: FileDiffPayload;
}

/**
 * Compact diff card (Cursor-style) for one file change.
 */
export function FileDiffMini({ diff }: FileDiffMiniProps): JSX.Element {
  const label = diff.path.split("/").pop() ?? diff.path;
  const ext = label.includes(".") ? label.split(".").pop()?.toLowerCase() ?? "" : "";
  const iconLabel =
    ext === "ts" || ext === "tsx"
      ? "TS"
      : ext === "js" || ext === "jsx"
        ? "JS"
        : ext.length > 0
          ? ext.slice(0, 2).toUpperCase()
          : "∙";

  function handleOpen(): void {
    bridge.send({ type: "file:open", path: diff.path });
  }

  function handleOpenKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpen();
    }
  }

  return (
    <div
      className={styles.card}
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={handleOpenKeyDown}
      title="Clique para abrir no editor"
    >
      <header className={styles.header}>
        <span className={styles.fileIcon} aria-hidden="true">
          {iconLabel}
        </span>
        <span className={styles.fileName} title={diff.path}>
          {label}
        </span>
        <span className={styles.stats}>
          {diff.additions > 0 ? <span className={styles.add}>+{diff.additions}</span> : null}
          {diff.deletions > 0 ? <span className={styles.del}>-{diff.deletions}</span> : null}
          {diff.additions === 0 && diff.deletions === 0 ? <span className={styles.neutral}>0</span> : null}
        </span>
      </header>
      {diff.hunks.length > 0 ? (
        <div className={styles.hunks}>
          {diff.hunks.map((hunk, hi) => (
            <pre key={hi} className={styles.hunk}>
              {hunk.lines.map((line, li) => (
                <div
                  key={li}
                  className={
                    line.type === "add" ? styles.lineAdd : line.type === "del" ? styles.lineDel : styles.lineCtx
                  }
                >
                  <span className={styles.lineInner}>{line.text || " "}</span>
                </div>
              ))}
            </pre>
          ))}
        </div>
      ) : null}
    </div>
  );
}
