import { contextBridge, ipcRenderer } from 'electron';
import type { Task, Folder, MeetingNote } from './main';

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

  updateTaskOrder: (data: { movedTaskId: number, prevId: number | null, nextId: number | null }) =>
    ipcRenderer.invoke('update-task-order', data),

  // Meeting Notes
  getAllMeetingsData: () => ipcRenderer.invoke('get-all-meetings-data'),
  createFolder: (folderData: { name: string; parentId: string | null }) =>
    ipcRenderer.invoke('create-folder', folderData),
  updateFolder: (folderId: string, name: string) =>
    ipcRenderer.invoke('update-folder', { folderId, name }),
  createNote: (noteData: { title: string; content: string; folderId: string }) =>
    ipcRenderer.invoke('create-note', noteData),
  updateNote: (noteId: string, updates: Partial<Omit<MeetingNote, 'id'>>) =>
    ipcRenderer.invoke('update-note', noteId, updates),
  deleteNote: (noteId: string) => ipcRenderer.invoke('delete-note', noteId),
  deleteFolder: (folderId: string) => ipcRenderer.invoke('delete-folder', folderId),
});

// We also need to declare the 'api' on the window object
// in a way that TypeScript understands in the renderer process.
// We'll create a `renderer.d.ts` file for this.
