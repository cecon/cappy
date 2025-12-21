/**
 * Todo List Domain Types
 */

export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
}

export interface UpdateTodoInput {
  id: string;
  title?: string;
  description?: string;
  completed?: boolean;
}

export interface TodoList {
  todos: Todo[];
  total: number;
  completed: number;
  pending: number;
}
