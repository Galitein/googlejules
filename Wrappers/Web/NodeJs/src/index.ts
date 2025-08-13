import express from 'express';
import cors from 'cors';
import {
  initDatabase,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  // ... import other functions as needed
} from 'CoreLogic';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Database
initDatabase().then(() => {
  console.log('Database initialized for web server.');
}).catch(err => {
  console.error('Failed to initialize database for web server:', err);
  process.exit(1);
});

// --- API Routes ---

// Example: Get Tasks
app.get('/tasks', async (req, res) => {
  try {
    const { searchQuery = '', filterTag = '', page = '1' } = req.query;
    const options = {
      searchQuery: String(searchQuery),
      filterTag: String(filterTag),
      page: Number(page),
    };
    const result = await getTasks(options);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

// Example: Create Task
app.post('/tasks', async (req, res) => {
  try {
    const { title, tags } = req.body;
    if (!title || !Array.isArray(tags)) {
      return res.status(400).json({ error: 'Invalid task data' });
    }
    const result = await createTask({ title, tags });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Example: Update Task
app.put('/tasks/:id', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id, 10);
        if (isNaN(taskId)) {
            return res.status(400).json({ error: 'Invalid task ID' });
        }
        const result = await updateTask(taskId, req.body);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Example: Delete Task
app.delete('/tasks/:id', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id, 10);
        if (isNaN(taskId)) {
            return res.status(400).json({ error: 'Invalid task ID' });
        }
        const result = await deleteTask(taskId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: (error as Error).message });
    }
});


app.listen(port, () => {
  console.log(`Web server listening on http://localhost:${port}`);
});
