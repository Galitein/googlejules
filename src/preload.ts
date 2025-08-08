import { contextBridge, ipcRenderer } from 'electron';
import type { Task } from './main';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // From main to renderer
  // No direct pushes from main in this app, but this is where they would go.

  // From renderer to main
  getTasks: (options: { searchQuery: string, filterTag: string, page: number }) =>
    ipcRenderer.invoke('get-tasks', options),

  getTags: () => ipcRenderer.invoke('get-tags'),

  createTask: (taskData: { title: string; tags: string[] }) =>
    ipcRenderer.invoke('create-task', taskData),

  updateTask: (taskId: number, updates: Partial<Task>) =>
    ipcRenderer.invoke('update-task', taskId, updates),

  deleteTask: (taskId: number) => ipcRenderer.invoke('delete-task', taskId),
});

// We also need to declare the 'api' on the window object
// in a way that TypeScript understands in the renderer process.
// We'll create a `renderer.d.ts` file for this.
