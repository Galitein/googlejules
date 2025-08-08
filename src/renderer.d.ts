import type { Task } from './main';

declare global {
  interface Window {
    api: {
      getTasks: (options: {
        searchQuery?: string;
        filterTag?: string;
        page?: number;
      }) => Promise<{
        tasks: Task[];
        total: number;
        page: number;
        limit: number;
      }>;
      getTags: () => Promise<string[]>;
      createTask: (taskData: {
        title: string;
        tags: string[];
      }) => Promise<Task>;
      updateTask: (
        taskId: number,
        updates: Partial<Omit<Task, 'id'>>
      ) => Promise<Task>;
      deleteTask: (taskId: number) => Promise<{ success: true }>;
    };
  }
}

// By using `export {}`, we treat this file as a module,
// which is necessary for the `declare global` to work correctly.
export {};
