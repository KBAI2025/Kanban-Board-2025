import { MongoClient } from 'mongodb';

// Connection URI
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'kanban';

let client;
let db;

/**
 * Connect to MongoDB
 */
export async function connectToDatabase() {
  if (!client) {
    client = new MongoClient(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    await client.connect();
    db = client.db(dbName);
  }
  return { db, client };
}

/**
 * Search for tasks based on a query
 * @param {string} query - The search query
 * @returns {Promise<Array>} - Array of matching tasks
 */
export async function searchTasks(query) {
  try {
    const { db } = await connectToDatabase();
    
    // Simple text search (ensure you have a text index on the fields you want to search)
    const tasks = await db.collection('tasks').find({
      $text: { $search: query }
    }).toArray();
    
    return tasks;
  } catch (error) {
    console.error('Error searching tasks:', error);
    return [];
  }
}

/**
 * Get task by ID
 * @param {string} taskId - The task ID
 * @returns {Promise<Object|null>} - The task or null if not found
 */
export async function getTaskById(taskId) {
  try {
    const { db } = await connectToDatabase();
    return await db.collection('tasks').findOne({ _id: taskId });
  } catch (error) {
    console.error('Error getting task by ID:', error);
    return null;
  }
}

/**
 * Get all tasks in a column
 * @param {string} columnId - The column ID
 * @returns {Promise<Array>} - Array of tasks in the column
 */
export async function getTasksByColumn(columnId) {
  try {
    const { db } = await connectToDatabase();
    return await db.collection('tasks')
      .find({ columnId })
      .sort({ order: 1 })
      .toArray();
  } catch (error) {
    console.error('Error getting tasks by column:', error);
    return [];
  }
}
