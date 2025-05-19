const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kanban';

async function updateBoard() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    const Board = require('./models/Board');
    
    // Find the default board
    const board = await Board.findOne({ name: 'Default Board' });
    
    if (!board) {
      console.log('No default board found. A new one will be created with the Review column.');
      return;
    }

    // Check if review column already exists
    const hasReviewColumn = board.columns.some(col => col.id === 'review');
    
    if (hasReviewColumn) {
      console.log('✅ Review column already exists in the board');
      return;
    }

    // Add the review column before 'done'
    const doneIndex = board.columns.findIndex(col => col.id === 'done');
    if (doneIndex !== -1) {
      board.columns.splice(doneIndex, 0, {
        id: 'review',
        title: 'Review',
        tasks: []
      });
      
      await board.save();
      console.log('✅ Successfully added Review column to the board');
    } else {
      // If 'done' column is not found, just add review at the end
      board.columns.push({
        id: 'review',
        title: 'Review',
        tasks: []
      });
      
      await board.save();
      console.log('✅ Added Review column to the end of the board');
    }
  } catch (error) {
    console.error('❌ Error updating board:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

updateBoard();
