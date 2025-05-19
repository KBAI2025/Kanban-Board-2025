const mongoose = require('mongoose');
require('dotenv').config();

async function clearBoards() {
  try {
    // Connect to MongoDB using the same connection string as your app
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kanban', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Delete all boards
    const Board = require('./backend/models/Board');
    const result = await Board.deleteMany({});
    console.log(`Deleted ${result.deletedCount} boards`);

    console.log('Successfully cleared all boards. The default board will be recreated on next server start.');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing boards:', error);
    process.exit(1);
  }
}

clearBoards();