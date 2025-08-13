import { pool } from './database';
import * as crypto from 'crypto';
import { RowDataPacket } from 'mysql2';

// --- Reusable Interfaces ---
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

interface TagRow extends RowDataPacket {
  tag: string;
}

// --- Reusable Functions ---

// Get Tasks with filtering, sorting, and pagination
export async function getTasks(options: { searchQuery: string, filterTag: string, page: number }) {
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
}

// Get all unique tags
export async function getTags() {
  const query = `
    SELECT DISTINCT tag
    FROM tasks, JSON_TABLE(
        tags,
        '$[*]' COLUMNS (tag VARCHAR(255) PATH '$')
    ) AS jt
    ORDER BY tag ASC;
  `;
  const [rows] = await pool.query<TagRow[]>(query);
  return rows.map(row => row.tag);
}

// Create a new task
export async function createTask(taskData: { title: string; tags: string[] }) {
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
}

// Update a task
export async function updateTask(taskId: number, updates: Partial<Task>) {
  const fieldsToUpdate: { [key: string]: any } = {};

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
}

// Delete a task
export async function deleteTask(taskId: number) {
  await pool.query('DELETE FROM tasks WHERE id = ?', [taskId]);
  return { success: true };
}

// New handler for updating task order
export async function updateTaskOrder({ movedTaskId, prevId, nextId }: { movedTaskId: number, prevId: number | null, nextId: number | null }) {
  let newPriority: number;

  const [prevRows] = await pool.query<RowDataPacket[]>('SELECT priority FROM tasks WHERE id = ?', [prevId]);
  const prevPriority = prevRows[0]?.priority;

  const [nextRows] = await pool.query<RowDataPacket[]>('SELECT priority FROM tasks WHERE id = ?', [nextId]);
  const nextPriority = nextRows[0]?.priority;

  if (prevId !== null && nextId !== null) {
    newPriority = (prevPriority + nextPriority) / 2;
  } else if (prevId !== null) {
    newPriority = prevPriority - 1000;
  } else if (nextId !== null) {
    newPriority = nextPriority + 1000;
  } else {
    return; // Should not happen in a list with more than one item
  }

  await pool.query('UPDATE tasks SET priority = ? WHERE id = ?', [newPriority, movedTaskId]);
  return { success: true };
}


// --- Meeting Notes Functions ---

export async function getAllMeetingsData() {
  const [folders] = await pool.query('SELECT * FROM folders');
  const [notes] = await pool.query('SELECT * FROM meeting_notes');
  return {
    folders,
    notes,
  };
}

export async function createFolder({ name, parentId }: { name: string, parentId: string | null }) {
  const newFolder: Folder = {
    id: crypto.randomUUID(),
    name,
    parentId,
  };
  await pool.query('INSERT INTO folders SET ?', newFolder);
  return newFolder;
}

export async function updateFolder({ folderId, name }: { folderId: string, name: string }) {
  await pool.query('UPDATE folders SET name = ? WHERE id = ?', [name, folderId]);
  const [updatedRows] = await pool.query<RowDataPacket[]>('SELECT * FROM folders WHERE id = ?', [folderId]);
  return updatedRows[0] as Folder;
}

export async function createNote({ title, content, folderId }: { title: string, content: string, folderId: string }) {
  const now = new Date();
  const newNote: MeetingNote = {
    id: crypto.randomUUID(),
    title,
    content,
    folderId,
    created_date: now.toISOString(),
    modified_date: now.toISOString(),
  };

  const dbNote = {
      ...newNote,
      created_date: now,
      modified_date: now
  }

  await pool.query('INSERT INTO meeting_notes SET ?', dbNote);
  return newNote;
}

export async function updateNote(noteId: string, updates: Partial<Omit<MeetingNote, 'id'>>) {
  const modified_date = new Date();
  const finalUpdates = { ...updates, modified_date };

  await pool.query('UPDATE meeting_notes SET ? WHERE id = ?', [finalUpdates, noteId]);

  const [updatedRows] = await pool.query<RowDataPacket[]>('SELECT * FROM meeting_notes WHERE id = ?', [noteId]);
  return updatedRows[0] as MeetingNote;
}

export async function deleteNote(noteId: string) {
  await pool.query('DELETE FROM meeting_notes WHERE id = ?', [noteId]);
  return { success: true };
}

export async function deleteFolder(folderId: string) {
  await pool.query('DELETE FROM folders WHERE id = ?', [folderId]);
  return { success: true };
}
