"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.initDatabase = initDatabase;
const promise_1 = __importDefault(require("mysql2/promise"));
// Check for required environment variables
if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    console.error('FATAL ERROR: Database environment variables are not set.');
    console.error('Please define DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME in your environment.');
    process.exit(1);
}
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
};
exports.pool = promise_1.default.createPool(dbConfig);
async function initDatabase() {
    try {
        const connection = await exports.pool.getConnection();
        console.log('Successfully connected to the database.');
        await connection.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        parentId VARCHAR(36),
        FOREIGN KEY (parentId) REFERENCES folders(id) ON DELETE CASCADE
      )
    `);
        console.log('Table `folders` is ready.');
        await connection.query(`
      CREATE TABLE IF NOT EXISTS meeting_notes (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        folderId VARCHAR(36) NOT NULL,
        created_date DATETIME NOT NULL,
        modified_date DATETIME NOT NULL,
        FOREIGN KEY (folderId) REFERENCES folders(id) ON DELETE CASCADE
      )
    `);
        console.log('Table `meeting_notes` is ready.');
        await connection.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        status ENUM('pending', 'completed') NOT NULL DEFAULT 'pending',
        created_date DATETIME NOT NULL,
        finished_date DATETIME,
        tags JSON,
        priority DOUBLE NOT NULL DEFAULT 0
      )
    `);
        console.log('Table `tasks` is ready.');
        // Add priority column if it doesn't exist, for backwards compatibility
        try {
            await connection.query(`ALTER TABLE tasks ADD COLUMN priority DOUBLE NOT NULL DEFAULT 0`);
            console.log('Column `priority` added to `tasks` table.');
        }
        catch (error) {
            // Ignore "Duplicate column name" error (code ER_DUP_FIELDNAME)
            if (error.code !== 'ER_DUP_FIELDNAME') {
                throw error;
            }
        }
        connection.release();
    }
    catch (error) {
        console.error('Failed to initialize database:', error);
        // Exit the application if DB connection fails, as it's critical.
        process.exit(1);
    }
}
