import React, { useState, useEffect } from 'react';
import KanbanBoard from './components/KanbanBoard';
import ListView from './components/ListView';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTh, faList, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { getBoard } from './services/api';
import { ThemeProvider } from './contexts/ThemeContext';
import { BoardProvider } from './contexts/BoardContext';
import ThemeToggle from './components/ThemeToggle';
import ChatButton from './components/ChatButton';
import './components/KanbanBoard.css';

function App() {
  // Always use 'default-board' as the board ID
  const boardId = 'default-board';
  const [viewMode, setViewMode] = useState('kanban');
  const [boardData, setBoardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  console.log('[App] Using board ID:', boardId); // Debug log

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
        setError('Failed to load board. Please try again later. (Restart Backend)');
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
      <BoardProvider initialBoard={boardData}>
        <div className="app">
          <header className="app-header">
            <div className="header-left">
              <h1 className="app-title">Kanban Board</h1>
              <p className="board-id">Board ID: {boardId}</p>
            </div>
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
                boardId={boardId} 
                onBoardUpdate={handleBoardUpdate} 
                initialBoard={boardData}
                board={boardData}
              />
            )}
          </main>
          <ChatButton />
        </div>
      </BoardProvider>
    </ThemeProvider>
  );
}

export default App;
