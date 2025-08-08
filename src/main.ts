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

// --- Data Persistence ---
const userDataPath = app.getPath('userData');
const tasksFilePath = path.join(userDataPath, 'tasks.json');

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
