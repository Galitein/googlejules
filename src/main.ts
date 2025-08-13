import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as crypto from 'crypto';
import { pool, initDatabase } from './database.js';
import { RowDataPacket } from 'mysql2';

// Define the Task type
export interface Task {
  id: number;
  title: string;
  status: 'pending' | 'completed';
  created_date: string;
  finished_date: string | null;
  tags: string[];
  priority: number;
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
  created_date: string;
  modified_date: string;
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
  const { searchQuery, filterTag, page = 1 } = options;
  const limit = 50;
  const offset = (page - 1) * limit;

  let whereClauses: string[] = [];
  let params: (string | number)[] = [];

  if (searchQuery) {
    whereClauses.push(`(title LIKE ? OR JSON_CONTAINS(tags, ?))`);
    params.push(`%${searchQuery}%`, `"${searchQuery}"`);
  }

  if (filterTag) {
    whereClauses.push(`JSON_CONTAINS(tags, ?)`);
    params.push(`"${filterTag}"`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM tasks ${whereSql}`;
  const [countRows] = await pool.query<RowDataPacket[]>(countSql, params);
  const total = countRows[0].total;

  const dataSql = `SELECT * FROM tasks ${whereSql} ORDER BY priority DESC LIMIT ? OFFSET ?`;
  const [tasks] = await pool.query<RowDataPacket[]>(dataSql, [...params, limit, offset]);

  return {
    tasks: tasks as Task[],
    total,
    page,
    limit,
  };
});

// Get all unique tags
ipcMain.handle('get-tags', async (_: IpcMainInvokeEvent) => {
  const query = `
    SELECT DISTINCT tag
    FROM tasks, JSON_TABLE(
        tags,
        '$[*]' COLUMNS (tag VARCHAR(255) PATH '$')
    ) AS jt
    ORDER BY tag ASC;
  `;
  const [rows] = await pool.query<RowDataPacket[]>(query);
  return rows.map((row: { tag: string }) => row.tag);
});

// Create a new task
ipcMain.handle('create-task', async (_: IpcMainInvokeEvent, taskData: { title: string; tags: string[] }) => {
  const { title, tags } = taskData;
  const newTask = {
    title,
    tags: JSON.stringify(tags),
    created_date: new Date(),
    status: 'pending',
    priority: Date.now(), // New tasks get the highest priority
  };
  const [result] = await pool.query<any>(
    'INSERT INTO tasks (title, tags, created_date, status, priority) VALUES (?, ?, ?, ?, ?)',
    [newTask.title, newTask.tags, newTask.created_date, newTask.status, newTask.priority]
  );

  const [newRow] = await pool.query<RowDataPacket[]>('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
  return newRow[0] as Task;
});

// Update a task
ipcMain.handle('update-task', async (_: IpcMainInvokeEvent, taskId: number, updates: Partial<Task>) => {
  // Create a clean object for the query to avoid side-effects and mutations
  const fieldsToUpdate: { [key: string]: any } = {};

  // Explicitly handle each possible field from the frontend
  if (updates.title !== undefined) {
    fieldsToUpdate.title = updates.title;
  }
  if (updates.tags !== undefined) {
    fieldsToUpdate.tags = JSON.stringify(updates.tags);
  }
  if (updates.status !== undefined) {
    fieldsToUpdate.status = updates.status;
    fieldsToUpdate.finished_date = updates.status === 'completed' ? new Date() : null;
  }
  if (updates.priority !== undefined) {
    fieldsToUpdate.priority = updates.priority;
  }

  // If for some reason we have no fields to update, we can return early.
  if (Object.keys(fieldsToUpdate).length === 0) {
      const [rows] = await pool.query<RowDataPacket[]>('SELECT * FROM tasks WHERE id = ?', [taskId]);
      return rows[0] as Task;
  }

  const [result] = await pool.query('UPDATE tasks SET ? WHERE id = ?', [fieldsToUpdate, taskId]);

  if ((result as any).affectedRows === 0) {
    throw new Error('Task not found');
  }

  const [updatedRows] = await pool.query<RowDataPacket[]>('SELECT * FROM tasks WHERE id = ?', [taskId]);
  return updatedRows[0] as Task;
});

// Delete a task
ipcMain.handle('delete-task', async (_: IpcMainInvokeEvent, taskId: number) => {
  await pool.query('DELETE FROM tasks WHERE id = ?', [taskId]);
  return { success: true };
});

// New handler for updating task order
ipcMain.handle('update-task-order', async (_: IpcMainInvokeEvent, { movedTaskId, prevId, nextId }: { movedTaskId: number, prevId: number | null, nextId: number | null }) => {
  let newPriority: number;

  const [prevRows] = await pool.query<RowDataPacket[]>('SELECT priority FROM tasks WHERE id = ?', [prevId]);
  const prevPriority = prevRows[0]?.priority;

  const [nextRows] = await pool.query<RowDataPacket[]>('SELECT priority FROM tasks WHERE id = ?', [nextId]);
  const nextPriority = nextRows[0]?.priority;

  if (prevId !== null && nextId !== null) {
    // Moved between two tasks
    newPriority = (prevPriority + nextPriority) / 2;
  } else if (prevId !== null) {
    // Moved to the end of the list (no next item)
    newPriority = prevPriority - 1000; // Subtract a buffer from the previous item's priority
  } else if (nextId !== null) {
    // Moved to the beginning of the list (no previous item)
    newPriority = nextPriority + 1000; // Add a buffer to the next item's priority
  } else {
    // List has only one item, or something went wrong. Don't change priority.
    return;
  }

  await pool.query('UPDATE tasks SET priority = ? WHERE id = ?', [newPriority, movedTaskId]);

  return { success: true };
});


// --- Meeting Notes IPC Handlers ---

ipcMain.handle('get-all-meetings-data', async (_: IpcMainInvokeEvent) => {
  const [folders] = await pool.query('SELECT * FROM folders');
  const [notes] = await pool.query('SELECT * FROM meeting_notes');
  return {
    folders,
    notes,
  };
});

ipcMain.handle('create-folder', async (_: IpcMainInvokeEvent, { name, parentId }: { name: string, parentId: string | null }) => {
  const newFolder: Folder = {
    id: crypto.randomUUID(),
    name,
    parentId,
  };
  await pool.query('INSERT INTO folders SET ?', newFolder);
  return newFolder;
});

ipcMain.handle('update-folder', async (_: IpcMainInvokeEvent, { folderId, name }: { folderId: string, name: string }) => {
  await pool.query('UPDATE folders SET name = ? WHERE id = ?', [name, folderId]);
  const [updatedRows] = await pool.query<RowDataPacket[]>('SELECT * FROM folders WHERE id = ?', [folderId]);
  return updatedRows[0] as Folder;
});

ipcMain.handle('create-note', async (_: IpcMainInvokeEvent, { title, content, folderId }: { title: string, content: string, folderId: string }) => {
  const now = new Date();
  const newNote: MeetingNote = {
    id: crypto.randomUUID(),
    title,
    content,
    folderId,
    created_date: now.toISOString(),
    modified_date: now.toISOString(),
  };

  // Convert date strings to Date objects for MySQL
  const dbNote = {
      ...newNote,
      created_date: now,
      modified_date: now
  }

  await pool.query('INSERT INTO meeting_notes SET ?', dbNote);
  return newNote;
});

ipcMain.handle('update-note', async (_: IpcMainInvokeEvent, noteId: string, updates: Partial<Omit<MeetingNote, 'id'>>) => {
  const modified_date = new Date();
  const finalUpdates = { ...updates, modified_date };

  await pool.query('UPDATE meeting_notes SET ? WHERE id = ?', [finalUpdates, noteId]);

  const [updatedRows] = await pool.query<RowDataPacket[]>('SELECT * FROM meeting_notes WHERE id = ?', [noteId]);
  return updatedRows[0] as MeetingNote;
});

ipcMain.handle('delete-note', async (_: IpcMainInvokeEvent, noteId: string) => {
  await pool.query('DELETE FROM meeting_notes WHERE id = ?', [noteId]);
  return { success: true };
});

ipcMain.handle('delete-folder', async (_: IpcMainInvokeEvent, folderId: string) => {
  // The ON DELETE CASCADE in the database schema will handle deleting child folders and notes.
  await pool.query('DELETE FROM folders WHERE id = ?', [folderId]);
  return { success: true };
});
