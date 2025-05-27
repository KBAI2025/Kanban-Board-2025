import axios from 'axios';

// Use the environment variable or fallback to localhost
let API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

// Ensure the base URL doesn't end with a slash
API_BASE_URL = API_BASE_URL.endsWith('/') 
  ? API_BASE_URL.slice(0, -1) 
  : API_BASE_URL;

// Ensure the base URL includes the /api prefix if not already present
const API_URL = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL
  : `${API_BASE_URL}/api`;

console.log('API Base URL:', API_URL);

// Create an axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // This is important for sending cookies if you're using sessions
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
    
    // Ensure columnId is defined and is a string
    if (!columnId) {
      throw new Error('No columnId provided');
    }
    
    // Convert to string and normalize
    const columnIdStr = String(columnId).trim().toLowerCase();
    
    // First, try to get the board to see the actual column IDs
    let board;
    try {
      board = await getBoard(boardId);
      console.log('Board data:', board);
    } catch (boardErr) {
      console.error('Error fetching board:', boardErr);
      throw new Error('Failed to fetch board information');
    }

    // Create a map of all possible column identifiers to their full IDs
    const columnMap = {};
    const columnIndexMap = {};
    const columnIdMap = {};
    
    if (board && board.columns) {
      board.columns.forEach((column, index) => {
        if (!column.id) return;
        
        const columnId = column.id;
        const prefix = columnId.split('-')[0];
        const normalizedId = columnId.toLowerCase();
        
        // Map all possible variations to the full column ID
        columnMap[prefix] = columnId;
        columnMap[normalizedId] = columnId;
        columnMap[columnId] = columnId;
        
        // Map indices to column IDs (0, 1, 2, etc. and '0', '1', '2', etc.)
        columnIndexMap[index] = columnId;
        columnIndexMap[`${index}`] = columnId;
        
        // Map column-N format (column-0, column-1, etc.)
        columnIndexMap[`column-${index}`] = columnId;
        
        // Map column titles (case-insensitive)
        if (column.title) {
          const normalizedTitle = column.title.toLowerCase();
          columnMap[normalizedTitle] = columnId;
          columnMap[`${normalizedTitle}-${boardId}`] = columnId;
        }
        
        // Map common column names to their full IDs
        columnIdMap[prefix] = columnId;
        columnIdMap[normalizedId] = columnId;
        
        console.log(`Mapped column ${index} (${column.title || 'untitled'}):`, {
          prefix,
          id: columnId,
          normalizedId,
          aliases: [
            index, 
            `column-${index}`, 
            column.title?.toLowerCase(),
            `column-${index}-${boardId}`,
            `${prefix}-${boardId}`
          ].filter(Boolean)
        });
      });
    }
    
    // Store the column ID map in the module for debugging
    window.columnMaps = { columnMap, columnIndexMap, columnIdMap };
    console.log('Column mapping:', columnMap);
    console.log('Column index mapping:', columnIndexMap);
    console.log('Column ID mapping:', columnIdMap);
    
    // Map common column names to their expected IDs
    const columnNameMap = {
      'todo': 'todo',
      'to-do': 'todo',
      'inprogress': 'inprogress',
      'in progress': 'inprogress',
      'in-progress': 'inprogress',
      'review': 'review',
      'done': 'done',
      'completed': 'done'
    };
    
    // Convert input to string and normalize
    const inputStr = String(columnIdStr || '').trim();
    const normalizedInput = inputStr.toLowerCase();
    
    // Debug: Log all possible column IDs
    console.log('All column IDs:', Object.values(columnMap));
    console.log('Input column ID:', {
      original: columnIdStr,
      string: inputStr,
      normalized: normalizedInput
    });
    
    // Try different resolution strategies in order of specificity
    let finalColumnId;
    
    // 1. Try exact match in columnMap (handles full IDs, prefixes, and normalized names)
    if (columnMap[normalizedInput]) {
      finalColumnId = columnMap[normalizedInput];
      console.log(`Found exact match in columnMap: ${normalizedInput} -> ${finalColumnId}`);
    } 
    // 2. Try column index (0, 1, 2, etc.)
    else if (/^\d+$/.test(inputStr)) {
      const index = parseInt(inputStr, 10);
      if (columnIndexMap[index] !== undefined) {
        finalColumnId = columnIndexMap[index];
        console.log(`Found by numeric index: ${index} -> ${finalColumnId}`);
      }
    }
    // 3. Try column-N format (column-0, column-1, etc.)
    else if (/^column-\d+$/i.test(inputStr)) {
      if (columnIndexMap[inputStr] !== undefined) {
        finalColumnId = columnIndexMap[inputStr];
        console.log(`Found by column-N format: ${inputStr} -> ${finalColumnId}`);
      }
    }
    // 4. Try common column names (todo, in-progress, etc.)
    else if (columnNameMap[normalizedInput]) {
      const mappedName = columnNameMap[normalizedInput];
      finalColumnId = columnMap[mappedName] || mappedName;
      console.log(`Found by common name: ${normalizedInput} -> ${mappedName} -> ${finalColumnId}`);
    }
    
    // 5. If we still don't have an ID, try to find a partial match in known column IDs
    if (!finalColumnId) {
      for (const [key, value] of Object.entries(columnMap)) {
        if (value.toLowerCase().includes(normalizedInput) || 
            key.toLowerCase().includes(normalizedInput)) {
          finalColumnId = value;
          console.log(`Found partial match: ${key} -> ${value}`);
          break;
        }
      }
    }
    
    // 6. If all else fails, try to construct a column ID using the board ID
    if (!finalColumnId) {
      // If the input is a number, try to use it as an index
      if (/^\d+$/.test(inputStr)) {
        const index = parseInt(inputStr, 10);
        if (board.columns && board.columns[index]) {
          finalColumnId = board.columns[index].id;
          console.log(`Found by direct index access: ${index} -> ${finalColumnId}`);
        }
      }
      // Try to find a column with a matching prefix
      else if (board.columns) {
        const matchingColumn = board.columns.find(col => 
          col.id && col.id.toLowerCase().startsWith(normalizedInput)
        );
        if (matchingColumn) {
          finalColumnId = matchingColumn.id;
          console.log(`Found by prefix match: ${normalizedInput} -> ${finalColumnId}`);
        }
      }
    }
    
    // Last resort: use the input as-is
    if (!finalColumnId) {
      finalColumnId = inputStr;
      console.warn(`Could not resolve column ID: ${inputStr}, using as-is`);
    }
    
    // Ensure we're using the full column ID if we have it in our maps
    finalColumnId = columnMap[finalColumnId] || finalColumnId;
    
    // Log the resolution result
    const isFullId = finalColumnId && finalColumnId.includes(boardId);
    console.log('Final column ID resolved:', { 
      input: columnIdStr, 
      normalizedInput,
      resolved: finalColumnId,
      isFullId: isFullId ? 'Yes' : 'No',
      knownColumns: board.columns?.map(c => ({
        id: c.id,
        title: c.title,
        index: board.columns.indexOf(c)
      })) || 'No columns found in board',
      resolutionPath: isFullId ? 'success' : 'warning'
    });
    
    if (!isFullId) {
      console.warn('Column ID does not appear to be a full ID (missing board ID). This may cause 404 errors.');
    }
    
    // Ensure the card has required fields
    const cardWithTimestamp = {
      ...cardData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: finalColumnId, // Store the column ID in the status field
      position: 0 // New cards go to the top
    };
    
    console.log('Starting column ID resolution:', { finalColumnId, boardId, boardColumns: board?.columns });
    
    // Extract the column ID based on the input format
    let columnIdForUrl = finalColumnId || '';
    let resolutionPath = [];
    
    // Debug info about the board's columns
    const columnInfo = board?.columns?.map((col, idx) => ({
      index: idx,
      id: col.id,
      title: col.title,
      isColumnN: col.id.startsWith('column-'),
      isTodo: col.id.includes('todo')
    })) || [];
    
    console.log('Available columns:', columnInfo);
    
    // If we have a valid finalColumnId
    if (finalColumnId) {
      // Handle column-0, column-1, etc. format
      if (typeof finalColumnId === 'string' && finalColumnId.startsWith('column-')) {
        const columnIndex = parseInt(finalColumnId.replace('column-', ''), 10);
        resolutionPath.push(`Processing column-${columnIndex} format`);
        
        // Try to find the column by index
        if (board?.columns?.[columnIndex]?.id) {
          columnIdForUrl = board.columns[columnIndex].id;
          resolutionPath.push(`Found column ID at index ${columnIndex}: ${columnIdForUrl}`);
        } else {
          resolutionPath.push(`No column found at index ${columnIndex}`);
        }
      }
      // Handle numeric index (0, 1, 2, etc.)
      else if (/^\d+$/.test(finalColumnId)) {
        const columnIndex = parseInt(finalColumnId, 10);
        resolutionPath.push(`Processing numeric index: ${columnIndex}`);
        
        if (board?.columns?.[columnIndex]?.id) {
          columnIdForUrl = board.columns[columnIndex].id;
          resolutionPath.push(`Found column ID at index ${columnIndex}: ${columnIdForUrl}`);
        } else {
          resolutionPath.push(`No column found at numeric index ${columnIndex}`);
        }
      }
      // Handle column names (todo, in-progress, etc.)
      else if (typeof finalColumnId === 'string') {
        // Try to find a column whose ID includes the input string (case-insensitive)
        const normalizedInput = finalColumnId.toLowerCase();
        const matchingColumn = board?.columns?.find(col => 
          col.id && col.id.toLowerCase().includes(normalizedInput)
        );
        
        if (matchingColumn) {
          columnIdForUrl = matchingColumn.id;
          resolutionPath.push(`Found matching column by name: ${finalColumnId} -> ${columnIdForUrl}`);
        } else {
          resolutionPath.push(`No column found matching: ${finalColumnId}`);
        }
      }
    } else {
      resolutionPath.push('No column ID provided');
    }
    
    // If we still don't have a valid column ID, try to use the first column
    if (!columnIdForUrl && board?.columns?.[0]?.id) {
      columnIdForUrl = board.columns[0].id;
      resolutionPath.push(`Using first column as fallback: ${columnIdForUrl}`);
    }
    
    // If we still don't have a column ID, throw an error with all available info
    if (!columnIdForUrl) {
      const error = new Error('Could not determine column ID');
      error.details = { 
        finalColumnId, 
        boardId, 
        boardColumns: board?.columns || [],
        resolutionPath,
        availableColumns: columnInfo
      };
      console.error('Column resolution failed:', error.details);
      throw error;
    }
    
    // Clean up the column ID (remove any board ID suffix if present)
    if (boardId && columnIdForUrl && typeof columnIdForUrl === 'string' && columnIdForUrl.endsWith(`-${boardId}`)) {
      columnIdForUrl = columnIdForUrl.replace(`-${boardId}`, '');
      resolutionPath.push(`Removed board ID suffix: ${columnIdForUrl}`);
    }
    
    // If we still don't have a valid column ID, try to use the first column
    if (!columnIdForUrl && board?.columns?.[0]?.id) {
      columnIdForUrl = board.columns[0].id;
      resolutionPath.push(`Using first column as fallback: ${columnIdForUrl}`);
    }
    
    const url = `/boards/${boardId}/columns/${columnIdForUrl}/cards`;
    
    console.log('Column ID resolution complete:', {
      originalId: finalColumnId,
      resolvedId: columnIdForUrl,
      url,
      resolutionPath,
      boardColumns: board?.columns?.map((col, idx) => ({ 
        index: idx, 
        id: col.id, 
        title: col.title 
      }))
    });
    
    console.log('Sending card data:', {
      url,
      columnId: columnIdForUrl,
      originalColumnId: finalColumnId,
      boardId,
      data: cardWithTimestamp,
      baseURL: api.defaults.baseURL
    });
    
    try {
      console.group('📤 Sending Card Add Request');
      console.log('URL:', url);
      console.log('Method: POST');
      console.log('Board ID:', boardId);
      console.log('Column ID:', columnIdForUrl);
      console.log('Original Column ID:', finalColumnId);
      console.log('Request Data:', {
        ...cardWithTimestamp,
        description: cardWithTimestamp.description ? '[REDACTED]' : undefined,
        assignee: cardWithTimestamp.assignee ? '[REDACTED]' : undefined
      });
      console.log('Resolution Path:', resolutionPath);
      console.groupEnd();
      
      const response = await api.post(url, cardWithTimestamp);
      
      console.group('✅ Card Added Successfully');
      console.log('Response Status:', response.status);
      console.log('Response Data:', response.data);
      console.groupEnd();
      
      return response.data;
    } catch (error) {
      // Prepare detailed error information
      const errorDetails = {
        timestamp: new Date().toISOString(),
        message: error.message,
        request: {
          url,
          method: 'POST',
          originalUrl: `/boards/${boardId}/columns/${finalColumnId}/cards`,
          baseURL: api.defaults.baseURL,
          data: {
            ...cardWithTimestamp,
            description: cardWithTimestamp.description ? '[REDACTED]' : undefined,
            assignee: cardWithTimestamp.assignee ? '[REDACTED]' : undefined
          },
          headers: error.config?.headers
        },
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        } : null,
        resolutionPath,
        columnResolution: {
          originalId: finalColumnId,
          resolvedId: columnIdForUrl,
          boardId,
          availableColumns: board?.columns?.map((col, idx) => ({
            index: idx,
            id: col.id,
            title: col.title,
            isSelected: col.id === columnIdForUrl || col.id === finalColumnId
          }))
        },
        errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      };
      
      // Log the error with all details
      console.group('❌ API Call Failed');
      console.error('Error:', error);
      console.error('Error Details:', JSON.stringify(errorDetails, null, 2));
      
      // Log available columns for debugging
      if (board?.columns?.length) {
        console.log('Available Columns:', board.columns.map((col, idx) => ({
          index: idx,
          id: col.id,
          title: col.title || 'No Title',
          cardCount: col.cards?.length || 0
        })));
      } else {
        console.warn('No columns available in board data');
      }
      
      console.groupEnd();
      
      // Create a user-friendly error message
      let userMessage = 'Failed to add card';
      
      if (error.response) {
        if (error.response.status === 404) {
          userMessage = 'The requested column was not found. Please try refreshing the board.';
        } else if (error.response.status === 400) {
          userMessage = 'Invalid request. Please check your input and try again.';
        } else if (error.response.status >= 500) {
          userMessage = 'Server error. Please try again later.';
        }
        userMessage += ` (Status: ${error.response.status})`;
      } else if (error.request) {
        userMessage = 'No response from server. Please check your connection.';
      } else {
        userMessage = `Error: ${error.message}`;
      }
      
      const userError = new Error(userMessage);
      userError.details = errorDetails;
      userError.status = error.response?.status || 500;
      userError.originalError = error;
      
      throw userError;
    }
  } catch (error) {
    // If this is already a user-friendly error with details, just rethrow it
    if (error.details) {
      console.error('❌ Error details:', error.details);
      throw error;
    }
    
    const errorDetails = {
      message: error.message,
      request: {
        boardId,
        columnId,
        normalizedColumnId: columnId ? String(columnId).trim().toLowerCase() : 'undefined',
        cardData: cardData ? {
          title: cardData.title,
          description: cardData.description ? '[REDACTED]' : undefined,
          priority: cardData.priority,
          epicLabel: cardData.epicLabel,
          assignee: cardData.assignee ? '[REDACTED]' : null,
          status: cardData.status
        } : null,
        boardColumns: board?.columns?.map(col => ({
          id: col.id,
          title: col.title,
          taskCount: col.tasks?.length || 0
        }))
      },
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    
    // Handle specific error cases
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      errorDetails.response = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers,
        config: {
          method: error.response.config?.method,
          url: error.response.config?.url,
          baseURL: error.response.config?.baseURL,
          timeout: error.response.config?.timeout
        }
      };
      
      if (error.response.status === 404) {
        errorDetails.message = `The requested resource was not found. Please check the board and column IDs. (Status: ${error.response.status})`;
        errorDetails.suggestedAction = 'Verify that the board and column IDs are correct and that the server is running.';
      } else if (error.response.status === 400) {
        errorDetails.message = `Invalid request: ${error.response.data?.message || 'Please check your input data.'}`;
        errorDetails.suggestedAction = 'Check the request data and try again.';
      } else if (error.response.status === 401 || error.response.status === 403) {
        errorDetails.message = `Authentication error: ${error.response.data?.message || 'Please log in again.'}`;
        errorDetails.suggestedAction = 'Check your authentication and try logging in again.';
      } else if (error.response.status >= 500) {
        errorDetails.message = `Server error: ${error.response.data?.message || 'Please try again later.'}`;
        errorDetails.suggestedAction = 'The server encountered an error. Please try again later or contact support.';
      }
    } else if (error.request) {
      // The request was made but no response was received
      errorDetails.message = 'No response received from server. The request was made but no response was received.';
      errorDetails.suggestedAction = 'Check your network connection and verify that the server is running.';
      errorDetails.requestDetails = {
        url: error.request.responseURL,
        status: error.request.status,
        statusText: error.request.statusText
      };
    } else {
      // Something happened in setting up the request that triggered an Error
      errorDetails.message = `Error setting up request: ${error.message}`;
      errorDetails.suggestedAction = 'Check your network connection and try again.';
    }
    
    // Log detailed error information for debugging
    console.group('❌ Error adding card to column');
    console.error('Error:', error);
    console.error('Error details:', errorDetails);
    console.groupEnd();
    
    // Create a user-friendly error with all the details
    const errorToThrow = new Error(errorDetails.message);
    errorToThrow.details = errorDetails;
    errorToThrow.status = error.response?.status || error.status || 500;
    
    // Add a user-friendly message if not already set
    if (!errorToThrow.details.userMessage) {
      errorToThrow.details.userMessage = 'Failed to add card. Please try again or contact support if the problem persists.';
    }
    
    throw errorToThrow;
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

// Get all tickets
export const getAllTickets = async () => {
  try {
    const response = await api.get('/tickets');
    return response.data;
  } catch (error) {
    console.error('Error getting tickets:', error);
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
