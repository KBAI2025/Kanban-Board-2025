const express = require('express');
const router = express.Router();
const { connectToDatabase } = require('../services/mongodbService');

/**
 * Handle LLM queries with MongoDB context
 * POST /api/llm/query
 * Body: { query: string, context: object }
 */
router.post('/query', async (req, res) => {
  try {
    const { query, context = {} } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query is required' 
      });
    }

    const { db } = await connectToDatabase();
    let results = [];

    // Search for relevant tasks based on the query
    if (query) {
      const tasks = await db.collection('tasks')
        .find({ 
          $text: { $search: query },
          ...(context.boardId && { boardId: context.boardId }),
          ...(context.columnId && { 'column.id': context.columnId }),
          ...(context.taskId && { _id: context.taskId })
        })
        .limit(5)
        .toArray();
      
      results = results.concat(tasks.map(task => ({
        type: 'task',
        data: task,
        source: 'tasks',
        score: 1.0 // Simple relevance score
      })));
    }

    // If no results found, try a more general search
    if (results.length === 0) {
      const allTasks = await db.collection('tasks')
        .find({ 
          ...(context.boardId && { boardId: context.boardId })
        })
        .limit(3)
        .toArray();
      
      results = allTasks.map(task => ({
        type: 'task',
        data: task,
        source: 'tasks',
        score: 0.5 // Lower score for less relevant results
      }));
    }

    res.json({
      success: true,
      query,
      results
    });

  } catch (error) {
    console.error('Error processing LLM query:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
