import React, { createContext, useContext, useState, useEffect } from 'react';

// Create the context
const BoardContext = createContext();

// Create a provider component
export const BoardProvider = ({ children, initialBoard }) => {
  const [board, setBoard] = useState(initialBoard || null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Function to update the board
  const updateBoard = (newBoardData) => {
    setBoard(prevBoard => ({
      ...prevBoard,
      ...newBoardData
    }));
  };

  // Function to refresh the board data
  const refreshBoard = async (boardId) => {
    if (!boardId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/boards/${boardId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch board data');
      }
      const data = await response.json();
      setBoard(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching board data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data loading
  useEffect(() => {
    if (initialBoard?._id) {
      refreshBoard(initialBoard._id);
    } else if (initialBoard) {
      setBoard(initialBoard);
      setIsLoading(false);
    }
  }, [initialBoard?._id]);

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
