import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import {
  initDatabase,
  getTasks,
  getTags,
  createTask,
  updateTask,
  deleteTask,
  updateTaskOrder,
  getAllMeetingsData,
  createFolder,
  updateFolder,
  createNote,
  updateNote,
  deleteNote,
  deleteFolder,
  Task, // We still might need the types for casting or function signatures
  Folder,
  MeetingNote
} from 'core-logic';

// --- Main Window ---
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../assets/icon.svg')
  });

  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));
  // mainWindow.webContents.openDevTools(); // Uncomment for debugging
}

app.whenReady().then(async () => {
  await initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC Handlers ---

// Get Tasks with filtering, sorting, and pagination
ipcMain.handle('get-tasks', async (_: IpcMainInvokeEvent, options: { searchQuery: string, filterTag: string, page: number }) => {
  return await getTasks(options);
});

// Get all unique tags
ipcMain.handle('get-tags', async (_: IpcMainInvokeEvent) => {
  return await getTags();
});

// Create a new task
ipcMain.handle('create-task', async (_: IpcMainInvokeEvent, taskData: { title: string; tags: string[] }) => {
  return await createTask(taskData);
});

// Update a task
ipcMain.handle('update-task', async (_: IpcMainInvokeEvent, taskId: number, updates: Partial<Task>) => {
  return await updateTask(taskId, updates);
});

// Delete a task
ipcMain.handle('delete-task', async (_: IpcMainInvokeEvent, taskId: number) => {
  return await deleteTask(taskId);
});

// New handler for updating task order
ipcMain.handle('update-task-order', async (_: IpcMainInvokeEvent, { movedTaskId, prevId, nextId }: { movedTaskId: number, prevId: number | null, nextId: number | null }) => {
  return await updateTaskOrder({ movedTaskId, prevId, nextId });
});


// --- Meeting Notes IPC Handlers ---

ipcMain.handle('get-all-meetings-data', async (_: IpcMainInvokeEvent) => {
  return await getAllMeetingsData();
});

ipcMain.handle('create-folder', async (_: IpcMainInvokeEvent, { name, parentId }: { name: string, parentId: string | null }) => {
  return await createFolder({ name, parentId });
});

ipcMain.handle('update-folder', async (_: IpcMainInvokeEvent, { folderId, name }: { folderId: string, name: string }) => {
  return await updateFolder({ folderId, name });
});

ipcMain.handle('create-note', async (_: IpcMainInvokeEvent, { title, content, folderId }: { title: string, content: string, folderId: string }) => {
  return await createNote({ title, content, folderId });
});

ipcMain.handle('update-note', async (_: IpcMainInvokeEvent, noteId: string, updates: Partial<Omit<MeetingNote, 'id'>>) => {
  return await updateNote(noteId, updates);
});

ipcMain.handle('delete-note', async (_: IpcMainInvokeEvent, noteId: string) => {
  return await deleteNote(noteId);
});

ipcMain.handle('delete-folder', async (_: IpcMainInvokeEvent, folderId: string) => {
  return await deleteFolder(folderId);
});
