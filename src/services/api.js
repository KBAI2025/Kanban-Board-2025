import axios from 'axios';

// Use the environment variable or fallback to localhost
const DEFAULT_API_URL = 'http://localhost:5002';
let API_BASE_URL = process.env.REACT_APP_API_URL || DEFAULT_API_URL;

// Ensure the base URL is properly formatted
API_BASE_URL = API_BASE_URL.trim();

// Remove trailing slashes
API_BASE_URL = API_BASE_URL.replace(/\/+$/, '');

// Add /api to the base URL for all requests
const API_URL = `${API_BASE_URL}/api`;

console.log('API Configuration:', {
  'REACT_APP_API_URL from env': process.env.REACT_APP_API_URL,
  'API Base URL': API_BASE_URL,
  'Using API_URL': API_URL,
  'Process env': process.env.NODE_ENV
});

// Set a global variable for debugging
window.API_CONFIG = {
  API_URL,
  API_BASE_URL,
  NODE_ENV: process.env.NODE_ENV
};

// Create an axios instance with default config
const api = axios.create({
  baseURL: API_URL, // This now includes /api
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

// Board operations
const createBoard = async (boardData) => {
  try {
    const response = await api.post('/boards', boardData);
    return response.data;
  } catch (error) {
    console.error('Error creating board:', error);
    throw error;
  }
};

// Default column configuration if none exist
const DEFAULT_COLUMNS = [
  { id: 'todo', title: 'To Do', tasks: [] },
  { id: 'in-progress', title: 'In Progress', tasks: [] },
  { id: 'review', title: 'Review', tasks: [] },
  { id: 'done', title: 'Done', tasks: [] }
];

const getBoard = async (boardId) => {
  if (!boardId) {
    throw new Error('Board ID is required');
  }

  try {
    console.log(`Fetching board with ID: ${boardId}`);
    console.log(`Making GET request to: ${API_URL}/boards/${boardId}`);
    
    const response = await api.get(`/boards/${boardId}`);
    
    console.log('Response received:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data ? 'data received' : 'no data'
    });
    
    if (!response.data) {
      throw new Error('No board data received from server');
    }
    
    const boardData = JSON.parse(JSON.stringify(response.data));
    
    // Ensure columns exist and have proper IDs
    if (!Array.isArray(boardData.columns) || boardData.columns.length === 0) {
      console.warn('No columns found in board data, initializing with default columns');
      boardData.columns = JSON.parse(JSON.stringify(DEFAULT_COLUMNS));
    } else {
      // Ensure each column has a valid ID and tasks array
      boardData.columns = boardData.columns.map((column, index) => {
        // If column has no ID, use default ID based on position or title
        let columnId = column.id;
        
        if (!columnId) {
          // Try to generate ID from title
          columnId = column.title 
            ? column.title.toLowerCase().replace(/\s+/g, '-')
            : `column-${index}`;
            
          console.warn(`Column at index ${index} has no ID, generated ID: ${columnId}`);
        }
        
        const columnCopy = {
          ...column,
          id: columnId,
          tasks: Array.isArray(column.tasks) ? column.tasks : []
        };
        
        // Filter out deleted cards
        columnCopy.tasks = columnCopy.tasks.filter(task => 
          !(task.status === 'deleted' || task.deletedAt)
        );
        
        return columnCopy;
      });
    }
    
    return boardData;
  } catch (error) {
    console.error('Error fetching board:', {
      message: error.message,
      config: error.config ? {
        url: error.config.url,
        method: error.config.method,
        data: error.config.data
      } : 'No config',
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : 'No response',
      stack: error.stack
    });
    throw error;
  }
};

const updateBoard = async (boardId, boardData) => {
  try {
    if (!boardId) {
      throw new Error('Board ID is required for update');
    }

    // Ensure boardId is a string and trim any whitespace
    const cleanBoardId = String(boardId).trim();
    
    console.log('Updating board with ID:', cleanBoardId);
    console.log('Board data being sent:', {
      ...boardData,
      columns: boardData.columns ? `Array(${boardData.columns.length})` : 'No columns',
      _id: cleanBoardId
    });
    
    // Make sure we're using the correct endpoint
    const endpoint = `/boards/${cleanBoardId}`;
    const fullUrl = `${API_URL}${endpoint}`;
    console.log('Making PATCH request to:', fullUrl);
    
    const response = await api.patch(endpoint, {
      ...boardData,
      _id: cleanBoardId  // Ensure _id is set correctly
    });
    
    console.log('Board updated successfully:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data ? 'data received' : 'no data'
    });
    
    return response.data;
  } catch (error) {
    const errorDetails = {
      message: error.message,
      boardId: boardId,
      request: error.config ? {
        url: error.config.url,
        method: error.config.method,
        data: error.config.data
      } : 'No request config',
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : 'No response',
      stack: error.stack
    };
    
    console.error('Error updating board:', errorDetails);
    
    // Provide more user-friendly error message
    if (error.response) {
      if (error.response.status === 404) {
        throw new Error(`Board with ID ${boardId} not found. Please refresh the page and try again.`);
      } else if (error.response.status === 400) {
        throw new Error(`Invalid board data (${error.response.data?.message || 'no details'}). Please check your input and try again.`);
      } else {
        throw new Error(`Failed to update board: ${error.response.status} ${error.response.statusText}`);
      }
    } else if (error.request) {
      throw new Error('No response from server. Please check your connection and try again.');
    } else {
      throw new Error(`Error setting up request: ${error.message}`);
    }
  }
};

const deleteBoard = async (boardId) => {
  try {
    const response = await api.delete(`/boards/${boardId}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting board:', error);
    throw error;
  }
};

// Card operations
const updateCardPosition = async (boardId, columnId, cardId, updates) => {
  try {
    console.log(`Updating card position:`, { boardId, columnId, cardId, updates });
    
    // First, get the current board state
    const board = await getBoard(boardId);
    
    // Find the card in any column
    let card = null;
    let sourceColumn = null;
    
    for (const column of board.columns) {
      if (column.tasks) {
        const foundCard = column.tasks.find(task => task.id === cardId);
        if (foundCard) {
          card = foundCard;
          sourceColumn = column;
          break;
        }
      }
    }
    
    if (!card) {
      throw new Error(`Card with ID ${cardId} not found`);
    }
    
    // Update card fields
    Object.assign(card, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    
    // If moving to a different column
    if (updates.columnId && updates.columnId !== columnId) {
      const targetColumn = board.columns.find(col => col.id === updates.columnId);
      
      if (!targetColumn) {
        throw new Error(`Target column ${updates.columnId} not found`);
      }
      
      // Remove from source column
      sourceColumn.tasks = sourceColumn.tasks.filter(task => task.id !== cardId);
      
      // Add to target column
      targetColumn.tasks = targetColumn.tasks || [];
      targetColumn.tasks.unshift(card);
    }
    
    // Save the updated board
    const updatedBoard = await updateBoard(boardId, board);
    
    // Find and return the updated card
    for (const column of updatedBoard.columns) {
      const foundCard = column.tasks?.find(task => task.id === cardId);
      if (foundCard) {
        return foundCard;
      }
    }
    
    throw new Error('Failed to find updated card after save');
  } catch (error) {
    console.error('Error updating card position:', {
      message: error.message,
      boardId,
      columnId,
      cardId,
      updates,
      stack: error.stack
    });
    throw error;
  }
};

const addCardToColumn = async (boardId, columnId, cardData) => {
  try {
    // 1. Get current board state
    const board = await getBoard(boardId);
    
    if (!board) {
      throw new Error('Board not found');
    }
    
    // Log the received column ID and available columns for debugging
    console.log('Adding card to column ID:', columnId);
    console.log('Available columns:', board.columns.map(c => ({ id: c.id, title: c.title })));
    
    // 2. Find the target column - handle both string and numeric IDs
    let column = board.columns.find(col => col.id === columnId);
    
    // If column not found by exact ID, try to find by index (for backward compatibility)
    if (!column && !isNaN(columnId)) {
      const columnIndex = parseInt(columnId.replace('column-', ''));
      column = board.columns[columnIndex];
      
      if (column) {
        console.warn(`Using column at index ${columnIndex} (${column.id}) as fallback`);
      }
    }
    
    if (!column) {
      const availableColumns = board.columns.map(c => ({ id: c.id, title: c.title }));
      console.error('Column not found. Available columns:', availableColumns);
      throw new Error(`Column with ID "${columnId}" not found. Available columns: ${availableColumns.map(c => `"${c.title}" (${c.id})`).join(', ')}`);
    }
    
    // 3. Create new card with required fields
    const newCard = {
      ...cardData,
      id: `card-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active'
    };
    
    // 4. Initialize tasks array if it doesn't exist
    column.tasks = column.tasks || [];
    
    // 5. Add card to the beginning of the column
    column.tasks.unshift(newCard);
    
    // 6. Save the updated board
    await updateBoard(boardId, board);
    
    console.log('Card added successfully:', newCard);
    return newCard;
  } catch (error) {
    console.error('Error in addCardToColumn:', {
      error: error.message,
      boardId,
      columnId,
      cardData
    });
    throw error;
  }
};

const updateCard = async (boardId, columnId, cardId, updates) => {
  try {
    const board = await getBoard(boardId);
    
    // Find the card in any column
    let card = null;
    let sourceColumn = null;
    
    for (const column of board.columns) {
      if (column.tasks) {
        const foundCard = column.tasks.find(task => task.id === cardId);
        if (foundCard) {
          card = foundCard;
          sourceColumn = column;
          break;
        }
      }
    }
    
    if (!card) {
      throw new Error(`Card with ID ${cardId} not found`);
    }
    
    // Update card fields
    Object.assign(card, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
    
    // If moving to a different column
    if (updates.columnId && updates.columnId !== columnId) {
      const targetColumn = board.columns.find(col => col.id === updates.columnId);
      
      if (!targetColumn) {
        throw new Error(`Target column ${updates.columnId} not found`);
      }
      
      // Remove from source column
      sourceColumn.tasks = sourceColumn.tasks.filter(task => task.id !== cardId);
      
      // Add to target column
      targetColumn.tasks = targetColumn.tasks || [];
      targetColumn.tasks.unshift(card);
    }
    
    // Save the updated board
    await updateBoard(boardId, board);
    
    return card;
  } catch (error) {
    console.error('Error updating card:', error);
    throw error;
  }
};

const deleteCard = async (boardId, columnId, cardId) => {
  try {
    const board = await getBoard(boardId);
    const column = board.columns.find(col => col.id === columnId);
    
    if (!column) {
      throw new Error(`Column with ID ${columnId} not found`);
    }
    
    // Soft delete by setting status
    const card = column.tasks.find(task => task.id === cardId);
    
    if (!card) {
      throw new Error(`Card with ID ${cardId} not found in column ${columnId}`);
    }
    
    // Either remove the card or mark as deleted
    column.tasks = column.tasks.filter(task => task.id !== cardId);
    
    // Save the updated board
    await updateBoard(boardId, board);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting card:', error);
    throw error;
  }
};

// Export all functions as named exports
export {
  createBoard,
  getBoard,
  updateBoard,
  deleteBoard,
  addCardToColumn,
  updateCard,
  updateCardPosition,
  deleteCard
};

// Also export as default for backward compatibility
export default {
  createBoard,
  getBoard,
  updateBoard,
  deleteBoard,
  addCardToColumn,
  updateCard,
  updateCardPosition,
  deleteCard
};
