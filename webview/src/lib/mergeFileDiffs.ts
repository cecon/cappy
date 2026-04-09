import type { FileDiffPayload } from "./types";

/** Limite de linhas de diff mostradas após fundir várias edições no mesmo ficheiro. */
const MAX_MERGED_DIFF_LINES = 96;

/**
 * Agrupa diffs pelo mesmo `path` e funde estatísticas e hunks num único cartão por ficheiro.
 */
export function mergeFileDiffsForDisplay(diffs: FileDiffPayload[]): FileDiffPayload[] {
  const byPath = new Map<string, FileDiffPayload[]>();
  for (const d of diffs) {
    const key = d.path;
    const list = byPath.get(key) ?? [];
    list.push(d);
    byPath.set(key, list);
  }
  const out: FileDiffPayload[] = [];
  for (const [, group] of byPath) {
    out.push(mergeOneFileGroup(group));
  }
  return out;
}

function mergeOneFileGroup(group: FileDiffPayload[]): FileDiffPayload {
  const path = group[0]!.path;
  let additions = 0;
  let deletions = 0;
  const hunks: FileDiffPayload["hunks"] = [];
  let budget = MAX_MERGED_DIFF_LINES;

  for (const g of group) {
    additions += g.additions;
    deletions += g.deletions;
    for (const h of g.hunks) {
      if (budget <= 0) {
        break;
      }
      const take = h.lines.slice(0, budget);
      if (take.length > 0) {
        hunks.push({ lines: take });
        budget -= take.length;
      }
    }
  }

  return { path, additions, deletions, hunks };
}
