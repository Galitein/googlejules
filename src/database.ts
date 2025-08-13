import mysql from 'mysql2/promise';

const dbConfig = {
  host: '13.202.47.163',
  user: 'root',
  password: 'jp4PXuzUFo15vF30aHS6sReZuxHQHBKZ',
  database: 'jules_playground',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

export const pool = mysql.createPool(dbConfig);

export async function initDatabase() {
  try {
    const connection = await pool.getConnection();
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
        tags JSON
      )
    `);
    console.log('Table `tasks` is ready.');

    connection.release();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    // Exit the application if DB connection fails, as it's critical.
    process.exit(1);
  }
}
