import { describe, it, expect, beforeEach } from "vitest";
import { toolRegistry } from "../lib/toolRegistry";
import type { ToolRendererProps } from "../lib/toolRegistry";

// Dummy renderer for testing
function dummyRenderer(_props: ToolRendererProps) {
  return null as unknown as JSX.Element;
}

describe("toolRegistry", () => {
  // Each test gets a fresh state through isolation (module state persists in same suite)
  // We just verify register + render contract.

  it("render retorna null para tool desconhecida", () => {
    const result = toolRegistry.render("__tool_que_nao_existe__");
    expect(result).toBeNull();
  });

  it("register + render devolve o renderer registado", () => {
    toolRegistry.register("__test_tool__", dummyRenderer);
    const result = toolRegistry.render("__test_tool__");
    expect(result).toBe(dummyRenderer);
  });

  it("lookup é case-insensitive", () => {
    toolRegistry.register("MyTool", dummyRenderer);
    expect(toolRegistry.render("mytool")).toBe(dummyRenderer);
    expect(toolRegistry.render("MYTOOL")).toBe(dummyRenderer);
    expect(toolRegistry.render("MyTool")).toBe(dummyRenderer);
  });

  it("registro sobrescreve renderer anterior para o mesmo nome", () => {
    function rendererA(_p: ToolRendererProps) { return null as unknown as JSX.Element; }
    function rendererB(_p: ToolRendererProps) { return null as unknown as JSX.Element; }
    toolRegistry.register("__overwrite_tool__", rendererA);
    toolRegistry.register("__overwrite_tool__", rendererB);
    expect(toolRegistry.render("__overwrite_tool__")).toBe(rendererB);
  });
});
