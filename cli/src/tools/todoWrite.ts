import type { ToolDefinition } from "./toolTypes";
import { replaceTodos, type TodoItem, type TodoStatus } from "../agent/sessionContext";

interface TodoWriteParams {
  todos: Array<{
    content: string;
    status: TodoStatus;
    activeForm: string;
  }>;
}

/**
 * Updates the session task checklist (OpenClaude-compatible TodoWrite).
 */
export const todoWriteTool: ToolDefinition<TodoWriteParams, { summary: string }> = {
  name: "TodoWrite",
  description:
    "Updates the session task checklist. Use to track multi-step work: pending, in_progress, completed. " +
    "Each item needs content, status, and activeForm (short present-progress label).",
  parameters: {
    type: "object",
    properties: {
      todos: {
        type: "array",
        description: "The full updated todo list (replaces the previous list).",
        items: {
          type: "object",
          properties: {
            content: { type: "string", description: "Task description." },
            status: {
              type: "string",
              enum: ["pending", "in_progress", "completed"],
              description: "Task state.",
            },
            activeForm: { type: "string", description: "Present-progress wording for this task." },
          },
          required: ["content", "status", "activeForm"],
          additionalProperties: false,
        },
      },
    },
    required: ["todos"],
    additionalProperties: false,
  },
  async execute(params) {
    const normalized: TodoItem[] = params.todos.map((row) => ({
      content: row.content,
      status: row.status,
      activeForm: row.activeForm,
    }));
    const { oldTodos, newTodos } = replaceTodos(normalized);
    const summary = JSON.stringify(
      {
        oldCount: oldTodos.length,
        newCount: newTodos.length,
        todos: newTodos,
      },
      null,
      2,
    );
    return {
      summary:
        "Todos updated successfully. Continue using the checklist to track progress.\n\n" + summary,
    };
  },
};
