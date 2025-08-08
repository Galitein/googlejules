import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

// Define the Task type
export interface Task {
  id: number;
  title: string;
  status: 'pending' | 'completed';
  created_date: string;
  finished_date: string | null;
  tags: string[];
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
}

export interface MeetingNote {
  id: string;
  title: string;
  content: string; // Will be HTML
  folderId: string;
  meeting_date_time: string;
}

// --- Data Persistence ---
const userDataPath = app.getPath('userData');
const tasksFilePath = path.join(userDataPath, 'tasks.json');
const meetingsFilePath = path.join(userDataPath, 'meetings.json');

interface MeetingsData {
  folders: Folder[];
  notes: MeetingNote[];
}

function readMeetingsData(): MeetingsData {
  try {
    if (!fs.existsSync(meetingsFilePath)) {
      const defaultData = { folders: [], notes: [] };
      fs.writeFileSync(meetingsFilePath, JSON.stringify(defaultData));
      return defaultData;
    }
    const data = fs.readFileSync(meetingsFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading meetings data:', error);
    return { folders: [], notes: [] };
  }
}

function writeMeetingsData(data: MeetingsData): void {
  try {
    fs.writeFileSync(meetingsFilePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing meetings data:', error);
  }
}

function readTasks(): Task[] {
  try {
    if (!fs.existsSync(tasksFilePath)) {
      fs.writeFileSync(tasksFilePath, JSON.stringify([]));
      return [];
    }
    const data = fs.readFileSync(tasksFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading tasks:', error);
    return [];
  }
}

function writeTasks(tasks: Task[]): void {
  try {
    fs.writeFileSync(tasksFilePath, JSON.stringify(tasks, null, 2));
  } catch (error) {
    console.error('Error writing tasks:', error);
  }
}

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
  mainWindow.webContents.openDevTools(); // Uncomment for debugging
}

app.whenReady().then(() => {
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
ipcMain.handle('get-tasks', (_, options: { searchQuery: string, filterTag: string, page: number }) => {
  let tasks = readTasks();

  // 1. Filter by search query (title or tags)
  if (options.searchQuery) {
    const query = options.searchQuery.toLowerCase();
    tasks = tasks.filter(task =>
      task.title.toLowerCase().includes(query) ||
      task.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }

  // 2. Filter by tag
  if (options.filterTag) {
    tasks = tasks.filter(task => task.tags.includes(options.filterTag));
  }

  // 3. Sort: pending first, then completed
  tasks.sort((a, b) => {
    if (a.status === b.status) return 0;
    return a.status === 'pending' ? -1 : 1;
  });

  // 4. Paginate
  const page = options.page || 1;
  const limit = 50;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;

  const paginatedTasks = tasks.slice(startIndex, endIndex);

  return {
    tasks: paginatedTasks,
    total: tasks.length,
    page,
    limit,
  };
});

// Get all unique tags
ipcMain.handle('get-tags', () => {
  const tasks = readTasks();
  const allTags = tasks.flatMap(task => task.tags);
  return [...new Set(allTags)].sort();
});

// Create a new task
ipcMain.handle('create-task', (_, taskData: { title: string; tags: string[] }) => {
  const tasks = readTasks();
  const newTask: Task = {
    id: Date.now(),
    title: taskData.title,
    status: 'pending',
    created_date: new Date().toISOString(),
    finished_date: null,
    tags: taskData.tags,
  };
  const updatedTasks = [...tasks, newTask];
  writeTasks(updatedTasks);
  return newTask;
});

// Update a task
ipcMain.handle('update-task', (_, taskId: number, updates: Partial<Task>) => {
  let tasks = readTasks();
  const taskIndex = tasks.findIndex(t => t.id === taskId);

  if (taskIndex === -1) {
    throw new Error('Task not found');
  }

  const originalTask = tasks[taskIndex];
  const updatedTask = { ...originalTask, ...updates };

  // Handle auto-updating finished_date
  if (updates.status) {
    updatedTask.finished_date = updates.status === 'completed' ? new Date().toISOString() : null;
  }

  tasks[taskIndex] = updatedTask;
  writeTasks(tasks);
  return updatedTask;
});

// Delete a task
ipcMain.handle('delete-task', (_, taskId: number) => {
  let tasks = readTasks();
  const updatedTasks = tasks.filter(t => t.id !== taskId);
  writeTasks(updatedTasks);
  return { success: true };
});

// --- Meeting Notes IPC Handlers ---
import * as crypto from 'crypto';

ipcMain.handle('get-all-meetings-data', () => {
  return readMeetingsData();
});

ipcMain.handle('create-folder', (_, { name, parentId }: { name: string, parentId: string | null }) => {
  const data = readMeetingsData();
  const newFolder: Folder = {
    id: crypto.randomUUID(),
    name,
    parentId,
  };
  data.folders.push(newFolder);
  writeMeetingsData(data);
  return newFolder;
});

ipcMain.handle('create-note', (_, { title, content, folderId }: { title: string, content: string, folderId: string }) => {
  const data = readMeetingsData();
  const newNote: MeetingNote = {
    id: crypto.randomUUID(),
    title,
    content,
    folderId,
    meeting_date_time: new Date().toISOString(),
  };
  data.notes.push(newNote);
  writeMeetingsData(data);
  return newNote;
});

ipcMain.handle('update-note', (_, { noteId, updates }: { noteId: string, updates: Partial<Omit<MeetingNote, 'id'>> }) => {
  const data = readMeetingsData();
  const noteIndex = data.notes.findIndex(n => n.id === noteId);
  if (noteIndex === -1) throw new Error('Note not found');

  data.notes[noteIndex] = { ...data.notes[noteIndex], ...updates };
  writeMeetingsData(data);
  return data.notes[noteIndex];
});

ipcMain.handle('delete-note', (_, noteId: string) => {
  const data = readMeetingsData();
  data.notes = data.notes.filter(n => n.id !== noteId);
  writeMeetingsData(data);
  return { success: true };
});

ipcMain.handle('delete-folder', (_, folderId: string) => {
  const data = readMeetingsData();
  let foldersToDelete = [folderId];
  let i = 0;
  while (i < foldersToDelete.length) {
    const currentFolderId = foldersToDelete[i];
    const children = data.folders.filter(f => f.parentId === currentFolderId);
    foldersToDelete.push(...children.map(c => c.id));
    i++;
  }

  // Delete all notes in the identified folders
  data.notes = data.notes.filter(note => !foldersToDelete.includes(note.folderId));
  // Delete all the identified folders
  data.folders = data.folders.filter(folder => !foldersToDelete.includes(folder.id));

  writeMeetingsData(data);
  return { success: true };
});
