import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getBoard as apiGetBoard, createBoard as apiCreateBoard } from '../services/api';

// Create the context
const BoardContext = createContext();

// Create a provider component
export const BoardProvider = ({ children, initialBoard }) => {
  const [board, setBoard] = useState(initialBoard || null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Function to update the board
  const updateBoard = useCallback((newBoardData) => {
    setBoard(prevBoard => ({
      ...prevBoard,
      ...newBoardData
    }));
  }, []);

  // Function to refresh the board data
  const refreshBoard = useCallback(async (boardId) => {
    // Always use 'default-board' as the board ID
    const boardIdToUse = 'default-board';
    
    setIsLoading(true);
    setError(null);
    
    console.log(`[BoardContext] Refreshing board with ID: ${boardIdToUse}`);
    
    try {
      // First, try to fetch the board by ID
      let data;
      
      try {
        data = await apiGetBoard(boardIdToUse);
      } catch (error) {
        // If board not found, create a new default board
        if (error.response?.status === 404) {
          console.log('[BoardContext] Default board not found, creating a new one...');
          data = await apiCreateBoard({
            name: 'Default Board',
            columns: [
              { id: 'todo', title: 'To Do', tasks: [] },
              { id: 'in-progress', title: 'In Progress', tasks: [] },
              { id: 'done', title: 'Done', tasks: [] }
            ]
          });
        } else {
          // Re-throw other errors
          throw error;
        }
      }
      
      console.log('[BoardContext] Received board data:', data);
      setBoard(data);
      return data;
    } catch (err) {
      console.error('Error in refreshBoard:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data loading
  useEffect(() => {
    if (initialBoard?._id) {
      console.log('Initial board has ID, refreshing:', initialBoard._id);
      refreshBoard(initialBoard._id).catch(console.error);
    } else if (initialBoard) {
      console.log('Setting initial board without refresh:', initialBoard);
      setBoard(initialBoard);
      setIsLoading(false);
    } else {
      console.log('No initial board provided, setting loading to false');
      setIsLoading(false);
    }
  }, [initialBoard, refreshBoard]);

  // Value to be provided by the context
  const value = {
    board,
    isLoading,
    error,
    updateBoard,
    refreshBoard,
    setBoard
  };

  return (
    <BoardContext.Provider value={value}>
      {children}
    </BoardContext.Provider>
  );
};

// Custom hook to use the board context
export const useBoard = () => {
  const context = useContext(BoardContext);
  if (!context) {
    throw new Error('useBoard must be used within a BoardProvider');
  }
  return context;
};

export default BoardContext;
