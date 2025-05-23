import React, { useState, useEffect } from 'react';
import KanbanBoard from './components/KanbanBoard';
import ListView from './components/ListView';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTh, faList, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { getBoard } from './services/api';
import { ThemeProvider } from './context/ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import ChatButton from './components/ChatButton';
import './components/KanbanBoard.css';

function App() {
  // In a real app, you might get this from URL params or user selection
  const [boardId] = useState('default-board');
  const [viewMode, setViewMode] = useState('kanban');
  const [boardData, setBoardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch board data when component mounts
  useEffect(() => {
    const fetchBoardData = async () => {
      try {
        setIsLoading(true);
        const data = await getBoard(boardId);
        setBoardData(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching board:', err);
        setError('Failed to load board. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBoardData();
  }, [boardId]);

  const handleBoardUpdate = (updatedBoard) => {
    setBoardData(updatedBoard);
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <FontAwesomeIcon icon={faSpinner} spin size="2x" />
        <p>Loading board...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <div className="app">
        <header className="app-header">
          <div className="header-left">
            <h1 className="app-title">Kanban Board</h1>
            <p className="board-id">Board ID: {boardId}</p>
          </div>
          <div className="header-controls">
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`}
                onClick={() => setViewMode('kanban')}
                title="Kanban View"
                disabled={isLoading}
              >
                <FontAwesomeIcon icon={faTh} />
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
                disabled={isLoading}
              >
                <FontAwesomeIcon icon={faList} />
              </button>
            </div>
            <ThemeToggle />
          </div>
        </header>
        <main>
          {error ? (
            <div className="error-container">
              <p className="error-message">{error}</p>
              <button onClick={() => window.location.reload()}>Retry</button>
            </div>
          ) : viewMode === 'kanban' ? (
            <KanbanBoard 
              boardId={boardId} 
              onBoardUpdate={handleBoardUpdate} 
              initialBoard={boardData} 
              board={boardData}
            />
          ) : (
            <ListView 
              board={boardData || { columns: [] }} 
              onBoardUpdate={handleBoardUpdate}
            />
          )}
        </main>
        <ChatButton />
      </div>
    </ThemeProvider>
  );
}

export default App;
