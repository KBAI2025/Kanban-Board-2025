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

    // Check for status query pattern (e.g., "tasks in progress", "show me done tasks")
    const statusMatch = query.match(/tasks?\s+(?:in\s+)?(todo|in[-\s]?progress|in progress|done|completed?|review|blocked|backlog)/i);
    
    // Check for assignee query pattern
    const assigneeMatch = query.match(/tasks?\s+(?:assigned to|for)\s+(.+?)(?:\?|$)/i);
    
    if (statusMatch) {
      // Map status aliases to standard status values
      const statusMap = {
        'todo': 'todo',
        'inprogress': 'in-progress',
        'in-progress': 'in-progress',
        'in progress': 'in-progress',
        'done': 'done',
        'complete': 'done',
        'completed': 'done',
        'review': 'review',
        'blocked': 'blocked',
        'backlog': 'backlog'
      };
      
      const statusKey = statusMatch[1].toLowerCase().replace(/\s+/g, '-');
      const status = statusMap[statusKey] || statusMatch[1];
      
      // Map status to possible column names
      const columnNameMap = {
        'todo': 'To Do',
        'in-progress': 'In Progress',
        'done': 'Done',
        'review': 'Review',
        'blocked': 'Blocked',
        'backlog': 'Backlog'
      };
      
      const columnName = columnNameMap[status] || status;
      
      // Search for tasks in the specified column
      const tasks = await db.collection('tasks')
        .find({ 
          'column.name': { $regex: new RegExp(`^${columnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          ...(context.boardId && { boardId: context.boardId })
        })
        .project({
          _id: 1,
          title: 1,
          description: 1,
          assignee: 1,
          dueDate: 1,
          priority: 1,
          'column.name': 1,
          'column.id': 1,
          boardId: 1
        })
        .limit(20)
        .toArray();
      
      results = tasks.map(task => ({
        type: 'task',
        data: task,
        source: 'tasks',
        score: 1.0
      }));
    } 
    // Handle assignee queries
    else if (assigneeMatch) {
      const assigneeName = assigneeMatch[1].trim();
      // Search for tasks assigned to the specified person
      const tasks = await db.collection('tasks')
        .find({ 
          assignee: { $regex: new RegExp(assigneeName, 'i') },
          ...(context.boardId && { boardId: context.boardId })
        })
        .limit(20)
        .toArray();
      
      results = tasks.map(task => ({
        type: 'task',
        data: task,
        source: 'tasks',
        score: 1.0
      }));
    } 
    // Handle other queries with text search
    else if (query) {
      // General text search for other queries
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
        score: 0.9 // Slightly lower score for general search
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
