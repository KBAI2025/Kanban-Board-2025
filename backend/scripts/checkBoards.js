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

// Board schema to match the frontend
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

async function listAllBoards() {
  try {
    console.log('\n📋 All Boards:');
    const boards = await Board.find({});
    
    if (boards.length === 0) {
      console.log('No boards found in the database.');
      return [];
    }

    boards.forEach((board, boardIndex) => {
      console.log(`\n🏁 Board ${boardIndex + 1}: ${board.name || 'Untitled'}`);
      
      if (board.columns && board.columns.length > 0) {
        console.log(`\n   Columns:`);
        board.columns.forEach((column, colIndex) => {
          console.log(`   ${colIndex + 1}. ${column.name || 'Untitled'} (${column.tasks?.length || 0} tasks)`);
          
          if (column.tasks && column.tasks.length > 0) {
            console.log('      Tasks:');
            column.tasks.forEach((task, taskIndex) => {
              console.log(`      - ${task.title || 'Untitled Task'} (ID: ${task._id || task.id})`);
              if (task.assignee) console.log(`        Assignee: ${task.assignee}`);
              if (task.dueDate) console.log(`        Due: ${new Date(task.dueDate).toLocaleDateString()}`);
              if (task.labels?.length) console.log(`        Labels: ${task.labels.join(', ')}`);
            });
          }
        });
      }
    });

    return boards;
  } catch (error) {
    console.error('Error fetching boards:', error);
    return [];
  }
}

async function main() {
  await connectDB();
  
  try {
    // List all boards with their columns and tasks
    await listAllBoards();
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
