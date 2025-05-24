import { searchTasks, getTaskById, getTasksByColumn } from '../../../services/mongodbService';

/**
 * API endpoint for LLM to query MongoDB
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, context = {} } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    let results = [];
    
    // Search for tasks based on the query
    const tasks = await searchTasks(query);
    
    // If we found tasks, add them to results
    if (tasks && tasks.length > 0) {
      results = results.concat(tasks.map(task => ({
        type: 'task',
        data: task,
        relevance: 1.0, // This could be calculated based on search relevance
        source: 'mongodb_search'
      })));
    }

    // If we have a specific task ID in the context, get that task
    if (context.taskId) {
      const task = await getTaskById(context.taskId);
      if (task) {
        results.push({
          type: 'specific_task',
          data: task,
          relevance: 1.0,
          source: 'mongodb_task_id'
        });
      }
    }

    // If we have a column ID in the context, get all tasks in that column
    if (context.columnId) {
      const columnTasks = await getTasksByColumn(context.columnId);
      if (columnTasks && columnTasks.length > 0) {
        results = results.concat(columnTasks.map(task => ({
          type: 'column_task',
          data: task,
          relevance: 0.8, // Slightly lower relevance than direct search
          source: 'mongodb_column_tasks'
        })));
      }
    }

    // Sort results by relevance (highest first)
    results.sort((a, b) => b.relevance - a.relevance);

    return res.status(200).json({
      success: true,
      results,
      query,
      context
    });
    
  } catch (error) {
    console.error('Error in LLM query endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
