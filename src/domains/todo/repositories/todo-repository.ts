import type { Todo, CreateTodoInput, UpdateTodoInput, TodoList } from '../types';

/**
 * Simple in-memory todo repository
 */
export class TodoRepository {
  private todos: Map<string, Todo> = new Map();

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `todo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Create a new todo
   */
  create(input: CreateTodoInput): Todo {
    const todo: Todo = {
      id: this.generateId(),
      title: input.title,
      description: input.description,
      completed: false,
      createdAt: new Date().toISOString()
    };

    this.todos.set(todo.id, todo);
    return todo;
  }

  /**
   * Get all todos
   */
  getAll(): TodoList {
    const todos = Array.from(this.todos.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const completed = todos.filter(t => t.completed).length;
    const pending = todos.length - completed;

    return {
      todos,
      total: todos.length,
      completed,
      pending
    };
  }

  /**
   * Get todo by ID
   */
  getById(id: string): Todo | null {
    return this.todos.get(id) || null;
  }

  /**
   * Update a todo
   */
  update(input: UpdateTodoInput): Todo | null {
    const todo = this.todos.get(input.id);
    if (!todo) {
      return null;
    }

    const updated: Todo = {
      ...todo,
      title: input.title ?? todo.title,
      description: input.description ?? todo.description,
      completed: input.completed ?? todo.completed,
      completedAt: input.completed && !todo.completed ? new Date().toISOString() : todo.completedAt
    };

    this.todos.set(updated.id, updated);
    return updated;
  }

  /**
   * Delete a todo
   */
  delete(id: string): boolean {
    return this.todos.delete(id);
  }

  /**
   * Clear all todos
   */
  clear(): void {
    this.todos.clear();
  }
}
