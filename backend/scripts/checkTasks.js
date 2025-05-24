const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'kanban';

console.log(`🔌 Connecting to MongoDB: ${MONGODB_URI}/${MONGODB_DB}`);

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Task schema to match the frontend
const taskSchema = new mongoose.Schema({
  title: String,
  description: String,
  status: String,
  columnId: String,
  boardId: String,
  assignee: String,
  priority: String,
  dueDate: Date,
  labels: [String],
  position: Number,
  ticketNumber: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);

async function listAllTasks() {
  try {
    console.log('\n📋 All Tasks:');
    const tasks = await Task.find({}).sort({ createdAt: -1 });
    
    if (tasks.length === 0) {
      console.log('No tasks found in the database.');
      return;
    }

    tasks.forEach((task, index) => {
      console.log(`\n📌 Task ${index + 1}:`);
      console.log(`   Title: ${task.title}`);
      console.log(`   ID: ${task._id}`);
      console.log(`   Status: ${task.status || 'Not specified'}`);
      console.log(`   Column ID: ${task.columnId || 'Not specified'}`);
      console.log(`   Created: ${task.createdAt}`);
      console.log(`   Updated: ${task.updatedAt}`);
      if (task.assignee) console.log(`   Assignee: ${task.assignee}`);
      if (task.dueDate) console.log(`   Due: ${task.dueDate}`);
      if (task.labels?.length) console.log(`   Labels: ${task.labels.join(', ')}`);
    });

    return tasks;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
}

async function removeTask(taskId) {
  try {
    const result = await Task.findByIdAndDelete(taskId);
    if (result) {
      console.log(`✅ Successfully deleted task: ${result.title} (${taskId})`);
      return true;
    } else {
      console.log(`❌ No task found with ID: ${taskId}`);
      return false;
    }
  } catch (error) {
    console.error('Error deleting task:', error);
    return false;
  }
}

async function listAllCollections() {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📚 Collections in database:');
    collections.forEach((collection, index) => {
      console.log(`${index + 1}. ${collection.name}`);
    });
    return collections.map(c => c.name);
  } catch (error) {
    console.error('Error listing collections:', error);
    return [];
  }
}

async function checkTasksInCollections(collections) {
  for (const collectionName of collections) {
    if (collectionName === 'tasks' || collectionName.includes('task') || collectionName.includes('Task')) {
      try {
        console.log(`\n🔍 Checking collection: ${collectionName}`);
        const collection = mongoose.connection.db.collection(collectionName);
        const count = await collection.countDocuments();
        console.log(`   Found ${count} documents`);
        
        if (count > 0) {
          const sample = await collection.findOne();
          console.log('   Sample document structure:', JSON.stringify(sample, null, 2).split('\n').slice(0, 10).join('\n') + '\n   ...');
        }
      } catch (error) {
        console.error(`Error checking collection ${collectionName}:`, error.message);
      }
    }
  }
}

async function main() {
  await connectDB();
  
  try {
    // List all collections first
    const collections = await listAllCollections();
    
    // Check for tasks in all collections
    await checkTasksInCollections(collections);
    
    // List all tasks from the Task model
    console.log('\n🔍 Checking tasks in the Task model:');
    const tasks = await listAllTasks();
    
    // If you want to remove specific tasks, uncomment and modify the following:
    /*
    if (tasks.length > 0) {
      // Example: Remove a specific task by ID
      // await removeTask('YOUR_TASK_ID_HERE');
      
      // Or remove all tasks (be careful!)
      // for (const task of tasks) {
      //   await removeTask(task._id);
      // }
    }
    */
  } catch (error) {
    console.error('Error in main:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the script
main().catch(console.error);
