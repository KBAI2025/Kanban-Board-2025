const express = require('express');
const router = express.Router();
const Board = require('../models/Board');
const mongoose = require('mongoose');

// Middleware to validate MongoDB ID
const validateId = (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid board ID' });
  }
  next();
};

// Middleware function to get a board by ID
const getBoard = async (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid board ID' });
  }
  
  try {
    const board = await Board.findById(req.params.id);
    if (!board) {
      return res.status(404).json({ message: 'Cannot find board' });
    }
    res.board = board;
    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Get all boards
router.get('/', async (req, res) => {
  try {
    const boards = await Board.find().sort({ createdAt: -1 });
    res.json(boards);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get default board - must come before /:id to avoid conflict
router.get('/default-board', async (req, res) => {
  try {
    const board = await Board.findOne({ name: 'Default Board' });
    if (!board) {
      const defaultBoard = new Board({
        name: 'Default Board',
        columns: [
          { 
            id: 'todo', 
            title: 'To Do', 
            tasks: [] 
          },
          { 
            id: 'in-progress', 
            title: 'In Progress', 
            tasks: [] 
          },
          { 
            id: 'review', 
            title: 'Review', 
            tasks: [] 
          },
          { 
            id: 'done', 
            title: 'Done', 
            tasks: [] 
          }
        ]
      });
      const savedBoard = await defaultBoard.save();
      // Sort tasks by position
      savedBoard.columns.forEach(column => {
        column.tasks.sort((a, b) => a.position - b.position);
      });
      res.json(savedBoard);
    } else {
      // Sort tasks by position
      board.columns.forEach(column => {
        column.tasks.sort((a, b) => a.position - b.position);
      });
      res.json(board);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a board
router.post('/', async (req, res) => {
  const board = new Board({
    name: req.body.name || 'My Kanban Board',
    columns: req.body.columns || [
      { id: 'todo', title: 'To Do', tasks: [] },
      { id: 'in-progress', title: 'In Progress', tasks: [] },
      { id: 'done', title: 'Done', tasks: [] }
    ]
  });

  try {
    const newBoard = await board.save();
    res.status(201).json(newBoard);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update a board
router.patch('/:id', getBoard, async (req, res) => {
  if (req.body.name != null) {
    res.board.name = req.body.name;
  }
  
  if (req.body.columns != null) {
    res.board.columns = req.body.columns;
  }

  try {
    const updatedBoard = await res.board.save();
    res.json(updatedBoard);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a board
router.delete('/:id', getBoard, async (req, res) => {
  try {
    await res.board.remove();
    res.json({ message: 'Board deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update a card
router.patch('/:boardId/columns/:columnId/cards/:cardId', async (req, res) => {
  try {
    const { boardId, columnId, cardId } = req.params;
    const { title, description, priority, epicLabel, assignee } = req.body;

    console.log('Updating card:', { boardId, columnId, cardId, updates: req.body });

    // Find the board
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    // Normalize the column ID for case-insensitive comparison
    const normalizedColumnId = columnId.toLowerCase();
    
    // Find the column with case-insensitive comparison
    const column = board.columns.find(col => col.id.toLowerCase() === normalizedColumnId);
    if (!column) {
      return res.status(404).json({ 
        message: `Column not found: ${columnId} (normalized: ${normalizedColumnId})`,
        availableColumns: board.columns.map(c => ({
          id: c.id,
          title: c.title,
          normalizedId: c.id.toLowerCase(),
          taskCount: c.tasks ? c.tasks.length : 0
        }))
      });
    }

    // Find the card
    const card = column.tasks.find(task => task.id === cardId);
    if (!card) {
      return res.status(404).json({ 
        message: 'Card not found',
        requestedCardId: cardId,
        availableCards: column.tasks.map(t => t.id)
      });
    }

    // Handle card deletion
    if (req.body.status === 'deleted') {
      // Remove the card from the column
      const cardIndex = column.tasks.findIndex(task => task.id === cardId);
      if (cardIndex > -1) {
        column.tasks.splice(cardIndex, 1);
        await board.save();
        return res.json({ success: true, message: 'Card deleted successfully' });
      }
      return res.status(404).json({ message: 'Card not found in column' });
    }

    // Update card fields if they are provided in the request
    if (title !== undefined) card.title = title.trim();
    if (description !== undefined) card.description = description.trim();
    if (priority !== undefined) card.priority = priority;
    if (epicLabel !== undefined) card.epicLabel = epicLabel.trim();
    if (assignee !== undefined) card.assignee = assignee;
    card.updatedAt = new Date();

    // Save the board
    await board.save();

    // Return the updated card
    res.json(card);
  } catch (err) {
    console.error('Error updating card:', err);
    res.status(500).json({ message: 'Failed to update card', error: err.message });
  }
});

// Add a new card to a column
router.post('/:boardId/columns/:columnId/cards', async (req, res) => {
  try {
    const { boardId, columnId } = req.params;
    const { title, description, priority = 'medium', epicLabel = '', assignee = null } = req.body;

    // Find the board
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    // Normalize the column ID for case-insensitive comparison
    const normalizedColumnId = columnId.toLowerCase();
    
    // Find the column with case-insensitive comparison
    const column = board.columns.find(col => col.id.toLowerCase() === normalizedColumnId);
    if (!column) {
      return res.status(404).json({ 
        message: `Column not found: ${columnId} (normalized: ${normalizedColumnId})`,
        availableColumns: board.columns.map(c => ({
          id: c.id,
          title: c.title,
          normalizedId: c.id.toLowerCase(),
          taskCount: c.tasks ? c.tasks.length : 0
        }))
      });
    }

    // Create a new card
    const cardId = new mongoose.Types.ObjectId().toString();
    const newCard = {
      id: cardId,
      ticketNumber: `PT-${cardId.substring(18, 21).toUpperCase()}`,
      title,
      description,
      priority,
      epicLabel,
      assignee,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add the card to the beginning of the column
    column.tasks.unshift(newCard);

    // Save the board
    await board.save();

    // Return the entire updated board
    res.status(201).json(board);
  } catch (err) {
    console.error('Error adding card:', err);
    res.status(500).json({ message: 'Failed to add card', error: err.message });
  }
});

// Update card properties
router.patch('/:boardId/columns/:columnId/cards/:cardId', async (req, res) => {
  try {
    const { boardId, columnId, cardId } = req.params;
    const updates = req.body;

    // Find the board
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    // Normalize the column ID for case-insensitive comparison
    const normalizedColumnId = columnId.toLowerCase();
    
    // Find the column with case-insensitive comparison
    const column = board.columns.find(col => col.id.toLowerCase() === normalizedColumnId);
    if (!column) {
      return res.status(404).json({ message: 'Column not found' });
    }

    // Find the card
    const card = column.tasks.find(task => task.id === cardId);
    if (!card) {
      return res.status(404).json({ message: 'Card not found' });
    }

    // Update card properties
    Object.assign(card, updates);
    card.updatedAt = new Date();

    await board.save();
    
    res.json(card);
  } catch (err) {
    console.error('Error updating card:', err);
    res.status(500).json({ message: 'Failed to update card', error: err.message });
  }
});

// Update card positions
router.patch('/:boardId/columns/:columnId/cards/:cardId/position', async (req, res) => {
  try {
    const { boardId, columnId, cardId } = req.params;
    const { newPosition, newColumnId } = req.body;

    if (typeof newPosition !== 'number' || newPosition < 0) {
      return res.status(400).json({ message: 'Invalid position' });
    }

    // Find the board
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    // Normalize the source column ID for case-insensitive comparison
    const normalizedSourceColumnId = columnId.toLowerCase();
    
    // Find source column with case-insensitive comparison
    const sourceColumn = board.columns.find(col => col.id.toLowerCase() === normalizedSourceColumnId);
    if (!sourceColumn) {
      return res.status(404).json({ 
        message: `Source column not found: ${columnId} (normalized: ${normalizedSourceColumnId})`,
        availableColumns: board.columns.map(c => ({
          id: c.id,
          title: c.title,
          normalizedId: c.id.toLowerCase(),
          taskCount: c.tasks ? c.tasks.length : 0
        }))
      });
    }

    // Find the card in the source column
    const cardIndex = sourceColumn.tasks.findIndex(task => task.id === cardId);
    if (cardIndex === -1) {
      return res.status(404).json({ message: 'Card not found in source column' });
    }

    const [movedCard] = sourceColumn.tasks.splice(cardIndex, 1);

    let targetColumn = sourceColumn;
    
    // If moving to a different column
    if (newColumnId) {
      // Normalize the target column ID for case-insensitive comparison
      const normalizedTargetColumnId = newColumnId.toLowerCase();
      
      // Find target column with case-insensitive comparison
      targetColumn = board.columns.find(col => col.id.toLowerCase() === normalizedTargetColumnId);
      if (!targetColumn) {
        // If target column not found, revert the source column changes
        sourceColumn.tasks.splice(cardIndex, 0, movedCard);
        return res.status(404).json({ 
          message: `Target column not found: ${newColumnId} (normalized: ${normalizedTargetColumnId})`,
          availableColumns: board.columns.map(c => ({
            id: c.id,
            title: c.title,
            normalizedId: c.id.toLowerCase(),
            taskCount: c.tasks ? c.tasks.length : 0
          }))
        });
      }
    }

    // Update the card's updatedAt timestamp
    movedCard.updatedAt = new Date();

    // Make sure the position is within bounds
    const safePosition = Math.max(0, Math.min(newPosition, targetColumn.tasks.length));

    // Insert the card at the new position
    targetColumn.tasks.splice(safePosition, 0, movedCard);
    
    // Update positions for all cards in the target column
    targetColumn.tasks.forEach((task, index) => {
      task.position = index;
    });

    // If we moved columns, update positions in the source column too
    if (targetColumn !== sourceColumn) {
      sourceColumn.tasks.forEach((task, index) => {
        task.position = index;
      });
    }

    await board.save();
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating card position:', err);
    res.status(500).json({ message: 'Failed to update card position', error: err.message });
  }
});

// Temporary route to add Review column - can be removed after use
router.get('/add-review-column', async (req, res) => {
  try {
    const board = await Board.findOne({ name: 'Default Board' });
    if (!board) {
      return res.status(404).json({ message: 'Default board not found' });
    }

    // Check if review column already exists
    const hasReviewColumn = board.columns.some(col => col.id === 'review');
    
    if (hasReviewColumn) {
      return res.status(400).json({ message: 'Review column already exists' });
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
      return res.json({ message: 'Successfully added Review column', board });
    }

    // If 'done' column is not found, just add review at the end
    board.columns.push({
      id: 'review',
      title: 'Review',
      tasks: []
    });
    
    await board.save();
    res.json({ message: 'Added Review column to the end', board });
  } catch (error) {
    console.error('Error adding Review column:', error);
    res.status(500).json({ message: 'Error adding Review column', error: error.message });
  }
});

// Get board with tasks sorted by position
router.get('/:id', async (req, res) => {
  try {
    const board = await Board.findById(req.params.id);
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }
    
    // Sort tasks by position in each column
    board.columns.forEach(column => {
      column.tasks.sort((a, b) => a.position - b.position);
    });
    
    res.json(board);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
