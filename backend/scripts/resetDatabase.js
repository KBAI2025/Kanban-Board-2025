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

// Board schema
const boardSchema = new mongoose.Schema({
  name: String,
  columns: [{
    id: String,
    name: String,
    tasks: [{
      id: String,
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
    }]
  }]
});

const Board = mongoose.models.Board || mongoose.model('Board', boardSchema);

// Task schema
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

async function resetDatabase() {
  try {
    // Drop all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    for (const collection of collections) {
      await mongoose.connection.db.dropCollection(collection.name);
      console.log(`✅ Dropped collection: ${collection.name}`);
    }
    
    // Create a new default board with standard columns
    const defaultBoard = new Board({
      name: 'My Kanban Board',
      columns: [
        { 
          id: 'todo',
          name: 'To Do',
          tasks: []
        },
        { 
          id: 'in-progress',
          name: 'In Progress',
          tasks: []
        },
        { 
          id: 'done',
          name: 'Done',
          tasks: []
        }
      ]
    });
    
    await defaultBoard.save();
    console.log('✅ Created default board with columns');
    
    return { success: true, message: 'Database reset successfully' };
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    return { success: false, message: error.message };
  }
}

async function main() {
  console.log('🚀 Starting database reset...');
  console.log('⚠️ WARNING: This will delete ALL data in the database!');
  
  // Ask for confirmation
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('Are you sure you want to continue? (yes/no) ', async (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      await connectDB();
      const result = await resetDatabase();
      console.log(result.message);
    } else {
      console.log('Database reset cancelled.');
    }
    
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
    readline.close();
  });
}

// Run the script
main().catch(console.error);
