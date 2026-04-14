/**
 * Registers all known tool renderers into toolRegistry.
 * Import this file once at app startup (e.g. in main.tsx or App.tsx).
 */

import { Box, Code, Text } from "@mantine/core";
import {
  IconFile,
  IconFolderOpen,
  IconPencil,
  IconSearch,
  IconTerminal2,
  IconTool,
  IconWriting,
} from "@tabler/icons-react";

import { BasicTool } from "../components/BasicTool";
import { FileDiffMini } from "../components/FileDiffMini";
import { cappyPalette } from "../theme";
import { toolRegistry, type ToolRendererProps } from "./toolRegistry";

// ── Helpers ─────────────────────────────────────────────────────────────────

function strArg(args: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = args[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

/** Returns {subtitle} only when the value is defined — avoids exactOptionalPropertyTypes violations. */
function sub(value: string | undefined): { subtitle: string } | Record<string, never> {
  return value !== undefined ? { subtitle: value } : {};
}

// ── Generic fallback ─────────────────────────────────────────────────────────

export function GenericToolRenderer({ name, input, output, status }: ToolRendererProps): JSX.Element {
  const subtitle = strArg(input, ["command", "path", "filePath", "query", "pattern", "url"]);
  return (
    <BasicTool icon={<IconTool size={12} />} title={name} {...sub(subtitle)} status={status}>
      {output ? (
        <Box p="xs">
          <Text component="pre" size="xs" c="dimmed" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>
            {output.length > 2000 ? `${output.slice(0, 2000)}\n…` : output}
          </Text>
        </Box>
      ) : null}
    </BasicTool>
  );
}

// ── Shell / Terminal ──────────────────────────────────────────────────────────

function ShellRenderer({ input, output, status }: ToolRendererProps): JSX.Element {
  const command = strArg(input, ["command", "cmd"]);
  return (
    <BasicTool icon={<IconTerminal2 size={12} />} title="Shell" {...sub(command)} status={status}>
      {output ? (
        <Box p="xs">
          <Code
            block
            style={{
              background: "transparent",
              fontSize: "var(--mantine-font-size-xs)",
              padding: 0,
              color: cappyPalette.textSecondary,
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            {output.length > 4000 ? `${output.slice(0, 4000)}\n…` : output}
          </Code>
        </Box>
      ) : null}
    </BasicTool>
  );
}

// ── Read file ─────────────────────────────────────────────────────────────────

function ReadFileRenderer({ input, output, status }: ToolRendererProps): JSX.Element {
  const path = strArg(input, ["path", "filePath", "target_file"]);
  const subtitle = path ? basename(path) : undefined;
  return (
    <BasicTool icon={<IconFile size={12} />} title="Lendo arquivo" {...sub(subtitle)} status={status}>
      {output ? (
        <Box p="xs">
          <Text
            component="pre"
            size="xs"
            c="dimmed"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, maxHeight: 240, overflowY: "auto" }}
          >
            {output.length > 3000 ? `${output.slice(0, 3000)}\n…` : output}
          </Text>
        </Box>
      ) : null}
    </BasicTool>
  );
}

// ── Write file ────────────────────────────────────────────────────────────────

function WriteFileRenderer({ input, fileDiff, status }: ToolRendererProps): JSX.Element {
  const path = strArg(input, ["path", "filePath", "target_file"]);
  const subtitle = path ? basename(path) : undefined;
  return (
    <BasicTool icon={<IconWriting size={12} />} title="Escrevendo arquivo" {...sub(subtitle)} status={status} defaultOpen>
      {fileDiff ? (
        <Box px="xs" pb="xs" pt={4}>
          <FileDiffMini diff={fileDiff} />
        </Box>
      ) : null}
    </BasicTool>
  );
}

// ── Edit / str_replace ────────────────────────────────────────────────────────

function EditFileRenderer({ input, fileDiff, status }: ToolRendererProps): JSX.Element {
  const path = strArg(input, ["path", "filePath", "target_file"]);
  const subtitle = path ? basename(path) : undefined;
  const oldStr = typeof input.oldString === "string" ? input.oldString
    : typeof input.old_string === "string" ? input.old_string : null;
  const newStr = typeof input.newString === "string" ? input.newString
    : typeof input.new_string === "string" ? input.new_string : null;

  return (
    <BasicTool icon={<IconPencil size={12} />} title="Editando arquivo" {...sub(subtitle)} status={status} defaultOpen>
      {fileDiff ? (
        <Box px="xs" pb="xs" pt={4}>
          <FileDiffMini diff={fileDiff} />
        </Box>
      ) : !fileDiff && oldStr && newStr ? (
        <Box p="xs">
          {oldStr.split("\n").slice(0, 5).map((line, i) => (
            <Text key={`del-${i}`} size="xs" c="red.4" ff="monospace" style={{ lineHeight: 1.7 }}>
              - {line}
            </Text>
          ))}
          {newStr.split("\n").slice(0, 5).map((line, i) => (
            <Text key={`add-${i}`} size="xs" c="green.4" ff="monospace" style={{ lineHeight: 1.7 }}>
              + {line}
            </Text>
          ))}
        </Box>
      ) : null}
    </BasicTool>
  );
}

// ── List dir ──────────────────────────────────────────────────────────────────

function ListDirRenderer({ input, output, status }: ToolRendererProps): JSX.Element {
  const path = strArg(input, ["path", "directory", "dir", "relative_workspace_path"]);
  const subtitle = path ? basename(path) : undefined;
  return (
    <BasicTool icon={<IconFolderOpen size={12} />} title="Listando diretório" {...sub(subtitle)} status={status}>
      {output ? (
        <Box p="xs">
          <Text
            component="pre"
            size="xs"
            c="dimmed"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, maxHeight: 200, overflowY: "auto" }}
          >
            {output.length > 2000 ? `${output.slice(0, 2000)}\n…` : output}
          </Text>
        </Box>
      ) : null}
    </BasicTool>
  );
}

// ── Search ────────────────────────────────────────────────────────────────────

function SearchRenderer({ input, output, status }: ToolRendererProps): JSX.Element {
  const query = strArg(input, ["query", "pattern", "regex", "search_query"]);
  const path = strArg(input, ["path", "directory"]);
  const subtitle = query ?? path;
  return (
    <BasicTool icon={<IconSearch size={12} />} title="Pesquisando" {...sub(subtitle)} status={status}>
      {output ? (
        <Box p="xs">
          <Text
            component="pre"
            size="xs"
            c="dimmed"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0, maxHeight: 240, overflowY: "auto" }}
          >
            {output.length > 3000 ? `${output.slice(0, 3000)}\n…` : output}
          </Text>
        </Box>
      ) : null}
    </BasicTool>
  );
}

// ── Registration ──────────────────────────────────────────────────────────────

export function registerAllToolRenderers(): void {
  // Shell / terminal
  toolRegistry.register("bash", ShellRenderer);
  toolRegistry.register("run_terminal_cmd", ShellRenderer);
  toolRegistry.register("runterminal", ShellRenderer);
  toolRegistry.register("execute_command", ShellRenderer);

  // Read
  toolRegistry.register("read_file", ReadFileRenderer);
  toolRegistry.register("readfile", ReadFileRenderer);
  toolRegistry.register("read", ReadFileRenderer);

  // Write
  toolRegistry.register("write_to_file", WriteFileRenderer);
  toolRegistry.register("writefile", WriteFileRenderer);
  toolRegistry.register("write", WriteFileRenderer);
  toolRegistry.register("create_file", WriteFileRenderer);

  // Edit / str_replace
  toolRegistry.register("str_replace_based_edit", EditFileRenderer);
  toolRegistry.register("edit_file", EditFileRenderer);
  toolRegistry.register("edit", EditFileRenderer);
  toolRegistry.register("apply_diff", EditFileRenderer);

  // List dir
  toolRegistry.register("list_dir", ListDirRenderer);
  toolRegistry.register("list_directory", ListDirRenderer);
  toolRegistry.register("ls", ListDirRenderer);

  // Search
  toolRegistry.register("search_files", SearchRenderer);
  toolRegistry.register("grep_search", SearchRenderer);
  toolRegistry.register("file_search", SearchRenderer);
  toolRegistry.register("codebase_search", SearchRenderer);
  toolRegistry.register("ripgrep_search", SearchRenderer);
}
