const express = require('express');
const router = express.Router();
const Card = require('../models/Card');

// Create a new card
router.post('/', async (req, res) => {
  try {
    const { title, description, columnId, boardId } = req.body;
    
    if (!title || !columnId || !boardId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title, columnId, and boardId are required' 
      });
    }

    // Create a new card
    const card = new Card({
      title,
      description: description || '',
      columnId,
      boardId
    });

    await card.save();
    
    res.status(201).json({
      success: true,
      data: card
    });
    
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Get all cards for a board
router.get('/board/:boardId', async (req, res) => {
  try {
    const { boardId } = req.params;
    const cards = await Card.find({ boardId }).sort({ position: 1 });
    
    res.json({
      success: true,
      count: cards.length,
      data: cards
    });
    
  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Update a card
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const card = await Card.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }
    
    res.json({
      success: true,
      data: card
    });
    
  } catch (error) {
    console.error('Error updating card:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// Delete a card
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const card = await Card.findByIdAndDelete(id);
    
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }
    
    res.json({
      success: true,
      data: {}
    });
    
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
