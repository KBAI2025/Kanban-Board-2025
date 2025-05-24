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
  _id: String, // We'll set this manually to match the frontend's expected ID
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

async function createBoardForFrontend() {
  try {
    // The ID that matches what the frontend is expecting
    const boardId = '683115f36c30944819c7427a';
    
    // First, check if a board with this ID already exists
    const existingBoard = await Board.findById(boardId);
    
    if (existingBoard) {
      console.log(`ℹ️  Board with ID ${boardId} already exists.`);
      return { success: false, message: 'Board already exists', board: existingBoard };
    }
    
    // Create a new board with the specific ID
    const newBoard = new Board({
      _id: boardId,
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
    
    await newBoard.save();
    console.log(`✅ Created board with ID: ${boardId}`);
    
    return { success: true, message: 'Board created successfully', board: newBoard };
  } catch (error) {
    console.error('❌ Error creating board:', error);
    return { success: false, message: error.message };
  }
}

async function main() {
  console.log('🚀 Creating board for frontend...');
  await connectDB();
  
  try {
    const result = await createBoardForFrontend();
    console.log(result.message);
    
    if (result.board) {
      console.log('\n📋 Board details:');
      console.log(`ID: ${result.board._id}`);
      console.log(`Name: ${result.board.name}`);
      console.log(`Columns: ${result.board.columns.map(c => c.name).join(', ')}`);
    }
  } catch (error) {
    console.error('Error in main:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run the script
main().catch(console.error);
