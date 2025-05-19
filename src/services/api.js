import axios from 'axios';

// Use the environment variable or fallback to localhost
const API_URL = window.REACT_APP_API_URL 
  ? `${window.REACT_APP_API_URL}/api` 
  : 'http://localhost:5002/api';

console.log('API URL:', API_URL); // For debugging

// Create an axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // This is important for sending cookies if you're using sessions
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a board
export const createBoard = async (boardData) => {
  try {
    const response = await api.post('/boards', boardData);
    return response.data;
  } catch (error) {
    console.error('Error creating board:', error);
    throw error;
  }
};

// Get a board by ID
export const getBoard = async (boardId) => {
  if (!boardId) {
    const error = new Error('Board ID is required');
    error.details = { boardId };
    throw error;
  }

  try {
    console.log(`Fetching board with ID: ${boardId}`);
    const response = await api.get(`/boards/${boardId}`);
    
    if (!response.data) {
      throw new Error('No board data received from server');
    }
    
    console.log('Raw board data received, processing columns...');
    
    // Create a deep copy of the board data to avoid mutating the original
    const boardData = JSON.parse(JSON.stringify(response.data));
    
    // Process each column to filter out deleted cards and add metadata
    if (Array.isArray(boardData.columns)) {
      boardData.columns = boardData.columns.map(column => {
        const columnCopy = { ...column };
        
        // Ensure tasks is an array
        if (!Array.isArray(columnCopy.tasks)) {
          console.warn(`Column ${columnCopy.id} has no tasks array, initializing empty array`);
          columnCopy.tasks = [];
          return columnCopy;
        }
        
        // Log all tasks before filtering
        console.log(`Processing column ${columnCopy.id} (${columnCopy.title}) - Tasks before filtering:`, columnCopy.tasks);
        
        // Filter out deleted cards (check both status and deletedAt)
        const originalCount = columnCopy.tasks.length;
        columnCopy.tasks = columnCopy.tasks.filter(task => {
          const isDeleted = task.status === 'deleted' || task.deletedAt;
          if (isDeleted) {
            console.log(`Filtering out deleted task: ${task.id} (${task.title || 'No title'})`, {
              status: task.status,
              deletedAt: task.deletedAt,
              fullTask: JSON.stringify(task, null, 2)
            });
          } else {
            console.log(`Keeping task: ${task.id} (${task.title || 'No title'})`, {
              status: task.status,
              deletedAt: task.deletedAt
            });
          }
          return !isDeleted;
        });
        
        const filteredCount = columnCopy.tasks.length;
        const removedCount = originalCount - filteredCount;
        
        console.log(`Column ${columnCopy.id} (${columnCopy.title}) - ` +
                   `Original: ${originalCount}, ` +
                   `After filtering: ${filteredCount}, ` +
                   `Removed: ${removedCount}`);
        
        // Log all tasks after filtering
        console.log(`Tasks after filtering in column ${columnCopy.id}:`, columnCopy.tasks);
        
        return columnCopy;
      });
      
      // Log summary of processed board
      console.log('Processed board data with filtered tasks:', {
        _id: boardData._id,
        name: boardData.name,
        totalColumns: boardData.columns.length,
        totalTasks: boardData.columns.reduce((sum, col) => sum + (col.tasks?.length || 0), 0),
        columns: boardData.columns.map(col => ({
          id: col.id,
          title: col.title,
          taskCount: col.tasks?.length || 0
        }))
      });
    } else {
      console.warn('Board data does not contain columns array');
      boardData.columns = [];
    }
    
    return boardData;
  } catch (error) {
    console.error('Error fetching board:', error);
    if (error.response) {
      console.error('Error response data:', error.response.data);
      console.error('Error status:', error.response.status);
      console.error('Error headers:', error.response.headers);
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error message:', error.message);
    }
    throw error;
  }
};

// Update a board
export const updateBoard = async (boardId, boardData) => {
  try {
    const response = await api.put(`/boards/${boardId}`, boardData);
    return response.data;
  } catch (error) {
    console.error('Error updating board:', error);
    throw error;
  }
};

// Delete a board
export const deleteBoard = async (boardId) => {
  try {
    const response = await api.delete(`/boards/${boardId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting board:', error);
    throw error;
  }
};

// Add a new card to a column
export const addCardToColumn = async (boardId, columnId, cardData) => {
  try {
    console.log('addCardToColumn called with:', { boardId, columnId, cardData });
    
    // Normalize the column ID to match server expectations
    let normalizedColumnId = columnId.toLowerCase();
    
    // Map common column names to their expected IDs
    const columnIdMap = {
      'todo': 'todo',
      'to-do': 'todo',
      'inprogress': 'in-progress',
      'in progress': 'in-progress',
      'in-progress': 'in-progress',
      'review': 'review',
      'done': 'done',
      'completed': 'done'
    };
    
    // Use the mapped ID if available, otherwise use the normalized ID
    const finalColumnId = columnIdMap[normalizedColumnId] || normalizedColumnId;
    
    console.log('Final column ID:', finalColumnId);
    
    // Ensure the card has a creation date
    const cardWithTimestamp = {
      ...cardData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('Sending card data:', cardWithTimestamp);
    
    const response = await api.post(
      `/boards/${boardId}/columns/${finalColumnId}/cards`,
      cardWithTimestamp
    );
    
    console.log('Card added successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error adding card to column:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      }
    });
    throw error;
  }
};

// Update a card
export const updateCard = async (boardId, columnId, cardId, cardData) => {
  console.log('updateCard called with:', { 
    boardId, 
    columnId, 
    cardId, 
    cardData: {
      ...cardData,
      // Don't log the entire content if it's too large
      description: cardData.description ? `${cardData.description.substring(0, 50)}...` : ''
    } 
  });
  
  if (!boardId || !columnId || !cardId) {
    const error = new Error('Missing required parameters for updateCard');
    error.details = { boardId, columnId, cardId };
    throw error;
  }

  try {
    // Normalize the column ID to match server expectations
    let normalizedColumnId = columnId.toLowerCase().trim();
    
    // Map common column names to their expected IDs
    const columnIdMap = {
      'todo': 'todo',
      'to-do': 'todo',
      'inprogress': 'in-progress',
      'in progress': 'in-progress',
      'in-progress': 'in-progress',
      'review': 'review',
      'done': 'done',
      'completed': 'done'
    };
    
    // Use the mapped ID if available, otherwise use the normalized ID
    const finalColumnId = columnIdMap[normalizedColumnId] || normalizedColumnId;
    
    console.log('Final column ID for update:', finalColumnId);
    
    // Prepare the update data
    const updateData = {
      ...cardData,
      // Ensure updatedAt is always set to current time
      updatedAt: new Date().toISOString()
    };
    
    console.log('Sending update request with data:', {
      ...updateData,
      // Don't log the entire content if it's too large
      description: updateData.description ? `${updateData.description.substring(0, 50)}...` : ''
    });
    
    const response = await api.patch(
      `/boards/${boardId}/columns/${finalColumnId}/cards/${cardId}`,
      updateData
    );
    
    if (!response.data) {
      console.warn('Update successful but no data returned in response');
      return { id: cardId, ...updateData };
    }
    
    console.log('Card updated successfully:', {
      id: response.data.id,
      title: response.data.title,
      status: response.data.status,
      updatedAt: response.data.updatedAt
    });
    
    return response.data;
  } catch (error) {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data ? 
          (typeof error.config.data === 'string' ? 
            error.config.data : 
            JSON.stringify(error.config.data, null, 2)
          ) : null
      }
    };
    
    console.error('Error updating card:', errorDetails);
    
    // Create a more descriptive error
    const enhancedError = new Error(
      error.response?.data?.message || 
      `Failed to update card ${cardId}: ${error.message}`
    );
    enhancedError.originalError = error;
    enhancedError.details = errorDetails;
    
    throw enhancedError;
  }
};

// Update card position
export const updateCardPosition = async (boardId, columnId, cardId, newPosition, newColumnId = null) => {
  console.log('updateCardPosition called with:', { boardId, columnId, cardId, newPosition, newColumnId });
  
  try {
    // Normalize the column IDs to match server expectations
    const normalizeColumnId = (id) => {
      if (!id) return null;
      
      const normalizedId = id.toLowerCase();
      
      // Map common column names to their expected IDs
      const columnIdMap = {
        'todo': 'todo',
        'to-do': 'todo',
        'inprogress': 'in-progress',
        'in progress': 'in-progress',
        'in-progress': 'in-progress',
        'review': 'review',
        'done': 'done',
        'completed': 'done'
      };
      
      return columnIdMap[normalizedId] || normalizedId;
    };
    
    const finalColumnId = normalizeColumnId(columnId);
    const finalNewColumnId = newColumnId ? normalizeColumnId(newColumnId) : null;
    
    console.log('Final column IDs:', { finalColumnId, finalNewColumnId });
    
    const response = await api.patch(
      `/boards/${boardId}/columns/${finalColumnId}/cards/${cardId}/position`,
      { 
        newPosition, 
        newColumnId: finalNewColumnId 
      }
    );
    
    console.log('Card position updated successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error updating card position:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      }
    });
    throw error;
  }
};

// Delete a card (soft delete)
export const deleteCard = async (boardId, columnId, cardId) => {
  console.log('deleteCard called with:', { boardId, columnId, cardId });
  
  if (!boardId || !columnId || !cardId) {
    const error = new Error('Missing required parameters for deleteCard');
    error.details = { boardId, columnId, cardId };
    throw error;
  }

  try {
    // Normalize the column ID to match server expectations
    let normalizedColumnId = columnId.toLowerCase().trim();
    
    // Map common column names to their expected IDs
    const columnIdMap = {
      'todo': 'todo',
      'to-do': 'todo',
      'inprogress': 'in-progress',
      'in progress': 'in-progress',
      'in-progress': 'in-progress',
      'review': 'review',
      'done': 'done',
      'completed': 'done'
    };
    
    // Use the mapped ID if available, otherwise use the normalized ID
    const finalColumnId = columnIdMap[normalizedColumnId] || normalizedColumnId;
    
    console.log('Final column ID for delete:', finalColumnId);
    
    // Make a direct PATCH request to update the card status to 'deleted'
    try {
      const response = await api.patch(
        `/boards/${boardId}/columns/${finalColumnId}/cards/${cardId}`,
        {
          status: 'deleted',
          deletedAt: new Date().toISOString()
        }
      );
      
      if (!response) {
        throw new Error('No response received from server');
      }
      
      console.log('Card marked as deleted successfully:', {
        cardId,
        status: response.status,
        statusText: response.statusText,
        data: response.data
      });
      
      // Return the updated card data if available, otherwise return a success object
      return response.data || { success: true, id: cardId };
    } catch (apiError) {
      console.error('API Error in deleteCard:', {
        message: apiError.message,
        response: apiError.response?.data,
        status: apiError.response?.status
      });
      
      // If we have a response with data, use that as the error
      if (apiError.response?.data) {
        throw apiError.response.data;
      }
      
      // Otherwise, rethrow the original error
      throw apiError;
    }
  } catch (error) {
    console.error('Error in deleteCard:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        data: error.config?.data
      }
    });
    
    // Re-throw with a more descriptive error
    // Create a more descriptive error message
    const errorMessage = error.response?.data?.message || 
                       error.message || 
                       'Failed to delete card. Please try again.';
    
    // Create a new error with the combined message
    const newError = new Error(errorMessage);
    newError.status = error.response?.status || 500;
    throw newError;
  }
};
