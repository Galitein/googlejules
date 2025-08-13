"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTasks = getTasks;
exports.getTags = getTags;
exports.createTask = createTask;
exports.updateTask = updateTask;
exports.deleteTask = deleteTask;
exports.updateTaskOrder = updateTaskOrder;
exports.getAllMeetingsData = getAllMeetingsData;
exports.createFolder = createFolder;
exports.updateFolder = updateFolder;
exports.createNote = createNote;
exports.updateNote = updateNote;
exports.deleteNote = deleteNote;
exports.deleteFolder = deleteFolder;
const database_1 = require("./database");
const crypto = __importStar(require("crypto"));
// --- Reusable Functions ---
// Get Tasks with filtering, sorting, and pagination
async function getTasks(options) {
    const { searchQuery, filterTag, page = 1 } = options;
    const limit = 50;
    const offset = (page - 1) * limit;
    let whereClauses = [];
    let params = [];
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
    const [countRows] = await database_1.pool.query(countSql, params);
    const total = countRows[0].total;
    const dataSql = `SELECT * FROM tasks ${whereSql} ORDER BY priority DESC LIMIT ? OFFSET ?`;
    const [tasks] = await database_1.pool.query(dataSql, [...params, limit, offset]);
    return {
        tasks: tasks,
        total,
        page,
        limit,
    };
}
// Get all unique tags
async function getTags() {
    const query = `
    SELECT DISTINCT tag
    FROM tasks, JSON_TABLE(
        tags,
        '$[*]' COLUMNS (tag VARCHAR(255) PATH '$')
    ) AS jt
    ORDER BY tag ASC;
  `;
    const [rows] = await database_1.pool.query(query);
    return rows.map(row => row.tag);
}
// Create a new task
async function createTask(taskData) {
    const { title, tags } = taskData;
    const newTask = {
        title,
        tags: JSON.stringify(tags),
        created_date: new Date(),
        status: 'pending',
        priority: Date.now(), // New tasks get the highest priority
    };
    const [result] = await database_1.pool.query('INSERT INTO tasks (title, tags, created_date, status, priority) VALUES (?, ?, ?, ?, ?)', [newTask.title, newTask.tags, newTask.created_date, newTask.status, newTask.priority]);
    const [newRow] = await database_1.pool.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
    return newRow[0];
}
// Update a task
async function updateTask(taskId, updates) {
    const fieldsToUpdate = {};
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
        const [rows] = await database_1.pool.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
        return rows[0];
    }
    const [result] = await database_1.pool.query('UPDATE tasks SET ? WHERE id = ?', [fieldsToUpdate, taskId]);
    if (result.affectedRows === 0) {
        throw new Error('Task not found');
    }
    const [updatedRows] = await database_1.pool.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
    return updatedRows[0];
}
// Delete a task
async function deleteTask(taskId) {
    await database_1.pool.query('DELETE FROM tasks WHERE id = ?', [taskId]);
    return { success: true };
}
// New handler for updating task order
async function updateTaskOrder({ movedTaskId, prevId, nextId }) {
    let newPriority;
    const [prevRows] = await database_1.pool.query('SELECT priority FROM tasks WHERE id = ?', [prevId]);
    const prevPriority = prevRows[0]?.priority;
    const [nextRows] = await database_1.pool.query('SELECT priority FROM tasks WHERE id = ?', [nextId]);
    const nextPriority = nextRows[0]?.priority;
    if (prevId !== null && nextId !== null) {
        newPriority = (prevPriority + nextPriority) / 2;
    }
    else if (prevId !== null) {
        newPriority = prevPriority - 1000;
    }
    else if (nextId !== null) {
        newPriority = nextPriority + 1000;
    }
    else {
        return; // Should not happen in a list with more than one item
    }
    await database_1.pool.query('UPDATE tasks SET priority = ? WHERE id = ?', [newPriority, movedTaskId]);
    return { success: true };
}
// --- Meeting Notes Functions ---
async function getAllMeetingsData() {
    const [folders] = await database_1.pool.query('SELECT * FROM folders');
    const [notes] = await database_1.pool.query('SELECT * FROM meeting_notes');
    return {
        folders,
        notes,
    };
}
async function createFolder({ name, parentId }) {
    const newFolder = {
        id: crypto.randomUUID(),
        name,
        parentId,
    };
    await database_1.pool.query('INSERT INTO folders SET ?', newFolder);
    return newFolder;
}
async function updateFolder({ folderId, name }) {
    await database_1.pool.query('UPDATE folders SET name = ? WHERE id = ?', [name, folderId]);
    const [updatedRows] = await database_1.pool.query('SELECT * FROM folders WHERE id = ?', [folderId]);
    return updatedRows[0];
}
async function createNote({ title, content, folderId }) {
    const now = new Date();
    const newNote = {
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
    };
    await database_1.pool.query('INSERT INTO meeting_notes SET ?', dbNote);
    return newNote;
}
async function updateNote(noteId, updates) {
    const modified_date = new Date();
    const finalUpdates = { ...updates, modified_date };
    await database_1.pool.query('UPDATE meeting_notes SET ? WHERE id = ?', [finalUpdates, noteId]);
    const [updatedRows] = await database_1.pool.query('SELECT * FROM meeting_notes WHERE id = ?', [noteId]);
    return updatedRows[0];
}
async function deleteNote(noteId) {
    await database_1.pool.query('DELETE FROM meeting_notes WHERE id = ?', [noteId]);
    return { success: true };
}
async function deleteFolder(folderId) {
    await database_1.pool.query('DELETE FROM folders WHERE id = ?', [folderId]);
    return { success: true };
}
