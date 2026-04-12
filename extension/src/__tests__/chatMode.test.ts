import { describe, it, expect } from "vitest";
import {
  parseChatUiMode,
  selectToolsForChatMode,
  mcpToolsForChatMode,
  type ChatUiMode,
} from "../bridge/chatMode";
import type { AgentTool } from "../agent/types";
import type { McpTool } from "../mcp/client";

const makeAgentTool = (name: string): AgentTool => ({
  name,
  description: `Tool ${name}`,
  parameters: { type: "object", properties: {} },
  execute: async () => "ok",
});

const makeMcpTool = (name: string): McpTool => ({
  serverName: "test-server",
  name,
  description: `MCP tool ${name}`,
  inputSchema: {},
});

describe("parseChatUiMode", () => {
  it("aceita 'plain'", () => {
    expect(parseChatUiMode("plain")).toBe("plain");
  });

  it("aceita 'agent'", () => {
    expect(parseChatUiMode("agent")).toBe("agent");
  });

  it("aceita 'ask'", () => {
    expect(parseChatUiMode("ask")).toBe("ask");
  });

  it("retorna 'agent' para valor desconhecido", () => {
    expect(parseChatUiMode("unknown")).toBe("agent");
    expect(parseChatUiMode(null)).toBe("agent");
    expect(parseChatUiMode(undefined)).toBe("agent");
    expect(parseChatUiMode(123)).toBe("agent");
  });
});

describe("selectToolsForChatMode", () => {
  const allTools = [
    makeAgentTool("Read"),
    makeAgentTool("Grep"),
    makeAgentTool("runTerminal"),
    makeAgentTool("writeFile"),
    makeAgentTool("ExploreAgent"),
    makeAgentTool("TodoWrite"),
  ];

  it("retorna lista vazia para modo 'plain'", () => {
    expect(selectToolsForChatMode("plain", allTools)).toHaveLength(0);
  });

  it("retorna todas as tools para modo 'agent'", () => {
    expect(selectToolsForChatMode("agent", allTools)).toHaveLength(allTools.length);
  });

  it("filtra apenas tools permitidas para modo 'ask'", () => {
    const result = selectToolsForChatMode("ask", allTools);
    const names = result.map((t) => t.name);
    expect(names).toContain("Read");
    expect(names).toContain("Grep");
    expect(names).toContain("ExploreAgent");
    expect(names).toContain("TodoWrite");
    expect(names).not.toContain("runTerminal");
    expect(names).not.toContain("writeFile");
  });

  it("'ask' inclui globFiles e listDir", () => {
    const tools = [
      makeAgentTool("globFiles"),
      makeAgentTool("listDir"),
      makeAgentTool("searchCode"),
      makeAgentTool("webFetch"),
      makeAgentTool("WebSearch"),
    ];
    const result = selectToolsForChatMode("ask", tools);
    expect(result).toHaveLength(tools.length);
  });

  it("'ask' com lista vazia retorna lista vazia", () => {
    expect(selectToolsForChatMode("ask", [])).toHaveLength(0);
  });
});

describe("mcpToolsForChatMode", () => {
  const mcpTools = [makeMcpTool("search"), makeMcpTool("fetch")];

  it("retorna todas as MCP tools para modo 'agent'", () => {
    expect(mcpToolsForChatMode("agent", mcpTools)).toHaveLength(mcpTools.length);
  });

  it("retorna lista vazia para modo 'plain'", () => {
    expect(mcpToolsForChatMode("plain", mcpTools)).toHaveLength(0);
  });

  it("retorna lista vazia para modo 'ask'", () => {
    expect(mcpToolsForChatMode("ask", mcpTools)).toHaveLength(0);
  });

  it("retorna lista vazia mesmo com ferramentas quando não for agent", () => {
    const modes: ChatUiMode[] = ["plain", "ask"];
    for (const mode of modes) {
      expect(mcpToolsForChatMode(mode, mcpTools)).toEqual([]);
    }
  });
});
