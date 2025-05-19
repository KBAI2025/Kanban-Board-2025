import React, { useState, useEffect, useCallback } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import './KanbanBoard.css';
import { getBoard, updateBoard, addCardToColumn, updateCardPosition, updateCard, deleteCard } from '../services/api';
import AddCard from './AddCard';
import EditCard from './EditCard';

// Check if the device supports touch events
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Draggable Card Component
const Card = ({ card, index, columnId, onEdit }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'CARD',
    item: { id: card.id, index, columnId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const opacity = isDragging ? 0.5 : 1;

  return (
      <div
        ref={drag}
        className="kanban-task"
        data-priority={card.priority || 'medium'}
        style={{ opacity, cursor: 'move' }}
        onDoubleClick={() => onEdit(card, columnId)}
      >
        <div className="task-header">
          <h4>{card.title}</h4>
          {card.epicLabel && <span className="epic-label">{card.epicLabel}</span>}
        </div>
        <div className="task-footer">
          <div className="footer-left">
            {card.priority && (
              <span className={`priority-badge ${card.priority}`} data-priority={card.priority}>
                {card.priority.charAt(0).toUpperCase() + card.priority.slice(1)}
              </span>
            )}
          </div>
          <div className="footer-right">
            <span className="ticket-number">{card.ticketNumber}</span>
            <div className="assignee">
              {card.assignee ? (
                <>
                  <span className="assignee-avatar">
                    {card.assignee.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </span>
                  <span className="assignee-name">{card.assignee.name}</span>
                </>
              ) : (
                <span className="assignee-avatar unassigned" title="Unassigned">
                  UA
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
  );
};

// DropArea component for above/below cards
const DropArea = ({ onDrop, position }) => {
  const [{ isOver }, drop] = useDrop({
    accept: 'CARD',
    drop: (item) => onDrop(item, position),
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  });

  return (
    <div
      ref={drop}
      className={`drop-area ${isOver ? 'is-over' : ''}`}
      style={{
        height: isOver ? '60px' : '10px',
        margin: isOver ? '10px 0' : '5px 0',
      }}
    />
  );
};

// Droppable Column Component
const Column = ({ column, onDrop, onEdit, onCardAdded, boardId }) => {
  const handleDrop = useCallback((item, position) => {
    if (!onDrop || !column?.id) {
      console.error('Invalid drop handler or column ID:', { onDrop, column });
      return;
    }
    
    onDrop({
      ...item,
      targetPosition: position,
    }, column.id);
  }, [onDrop, column?.id]);

  if (!column) {
    console.error('Column component rendered with null/undefined column');
    return null;
  }

  return (
    <div className="kanban-column">
      <h3>{column.title?.toUpperCase?.() || 'UNKNOWN COLUMN'}</h3>
      <div className="kanban-tasks">
        {Array.isArray(column.tasks) ? (
          column.tasks.map((task, index) => (
            <React.Fragment key={task?.id || index}>
              <div className="kanban-task-wrapper">
                <Card
                  card={task}
                  index={index}
                  columnId={column.id}
                  onEdit={onEdit}
                />
              </div>
              <DropArea 
                onDrop={(item) => handleDrop(item, { index: index + 1 })}
                position={{ index: index + 1 }}
              />
            </React.Fragment>
          ))
        ) : (
          <div className="no-tasks">No tasks in this column</div>
        )}
      </div>
      <AddCard 
        boardId={boardId} 
        columnId={column.id} 
        onCardAdded={onCardAdded} 
      />
    </div>
  );
};

// Default board configuration with all required columns
const defaultBoard = {
  _id: 'default-board',
  name: 'Default Board',
  columns: [
    { id: 'todo', title: 'To Do', tasks: [] },
    { id: 'in-progress', title: 'In Progress', tasks: [] },
    { id: 'review', title: 'Review', tasks: [] },
    { id: 'done', title: 'Done', tasks: [] }
  ]
};

const KanbanBoard = ({ boardId = 'default-board', onBoardUpdate, initialBoard }) => {
  // State hooks must be called at the top level of the component
  const [board, setBoard] = useState(initialBoard || defaultBoard);
  const [isLoading, setIsLoading] = useState(!initialBoard);
  const [error, setError] = useState(null);
  const [editingCard, setEditingCard] = useState(null);
  const [editingColumnId, setEditingColumnId] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchOrUseInitialBoard = async () => {
      setIsLoading(true);
      
      try {
        // If we have initialBoard, use it
        if (initialBoard) {
          console.log('Using initialBoard:', initialBoard);
          // Ensure all required columns are present
          const updatedBoard = ensureAllColumns(initialBoard);
          setBoard(updatedBoard);
          setError(null);
          setIsLoading(false);
          return;
        }
        
        // Otherwise fetch the board
        console.log('Fetching board with ID:', boardId);
        const data = await getBoard(boardId);
        console.log('Fetched board data:', data);
        
        if (data && data.columns) {
          console.log('Columns in board data:', data.columns.map(c => ({
            id: c.id,
            title: c.title,
            taskCount: c.tasks ? c.tasks.length : 0
          })));
          
          // Ensure all required columns are present
          const updatedData = ensureAllColumns(data);
          
          const boardWithSortedTasks = {
            ...updatedData,
            columns: updatedData.columns.map(column => ({
              ...column,
              tasks: column.tasks ? column.tasks.sort((a, b) => (a.position || 0) - (b.position || 0)) : []
            }))
          };
          
          console.log('Board with sorted tasks and ensured columns:', boardWithSortedTasks);
          setBoard(boardWithSortedTasks);
          
          if (onBoardUpdate) {
            onBoardUpdate(boardWithSortedTasks);
          }
        } else {
          console.warn('No columns found in board data, using default board');
          setBoard(defaultBoard);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching board:', err);
        if (isMounted) {
          setError('Failed to load board. Using default board.');
          setBoard(defaultBoard);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchOrUseInitialBoard();
    
    // Cleanup function to set isMounted to false when component unmounts
    return () => {
      isMounted = false;
    };
  }, [boardId, onBoardUpdate, initialBoard]);
  
  // Function to ensure all required columns are present in the board
  const ensureAllColumns = (boardData) => {
    if (!boardData || !boardData.columns) {
      return defaultBoard;
    }
    
    // Define required columns with consistent IDs
    const requiredColumns = {
      'todo': { id: 'todo', title: 'To Do', tasks: [] },
      'in-progress': { id: 'in-progress', title: 'In Progress', tasks: [] },
      'review': { id: 'review', title: 'Review', tasks: [] },
      'done': { id: 'done', title: 'Done', tasks: [] }
    };
    
    // Create a map of existing columns (case-insensitive)
    const existingColumns = {};
    boardData.columns.forEach(column => {
      existingColumns[column.id.toLowerCase()] = column;
    });
    
    // Merge existing columns with required columns
    const mergedColumns = [];
    
    // Add all required columns in order
    Object.entries(requiredColumns).forEach(([key, requiredColumn]) => {
      const existingColumn = existingColumns[key.toLowerCase()];
      
      if (existingColumn) {
        // Preserve existing tasks if they exist
        const tasks = existingColumn.tasks || [];
        mergedColumns.push({
          ...requiredColumn, // Use the standardized column definition
          ...existingColumn, // Override with any existing column properties
          tasks,             // Make sure tasks are preserved
          id: requiredColumn.id // Ensure consistent ID casing
        });
      } else {
        mergedColumns.push(requiredColumn);
      }
    });
    
    // Add any additional columns that aren't in the required list
    boardData.columns.forEach(column => {
      const isAlreadyIncluded = Object.keys(requiredColumns).some(
        key => key.toLowerCase() === column.id.toLowerCase()
      );
      
      if (!isAlreadyIncluded) {
        mergedColumns.push({
          ...column,
          id: column.id.toLowerCase() // Normalize the ID
        });
      }
    });
    
    // Log the merged columns for debugging
    console.log('Merged columns:', mergedColumns.map(c => ({
      id: c.id,
      title: c.title,
      taskCount: c.tasks ? c.tasks.length : 0
    })));
    
    return {
      ...boardData,
      columns: mergedColumns
    };
  };

  const handleCardDrop = useCallback(
    async (item, targetColumnId) => {
      if (!item || !targetColumnId) {
        console.error('Invalid parameters in handleCardDrop:', { item, targetColumnId });
        return;
      }

      const { 
        id: cardId, 
        index: fromIndex, 
        columnId: fromColumnId,
        targetPosition 
      } = item || {};
      
      console.log('handleCardDrop called with:', { 
        cardId, 
        fromIndex, 
        fromColumnId, 
        targetColumnId,
        targetPosition 
      });
      
      // Ensure IDs are strings and normalize them for comparison
      const normalizedTargetColumnId = String(targetColumnId || '').toLowerCase();
      const normalizedFromColumnId = String(fromColumnId || '').toLowerCase();
      
      // Check if it's the same position
      const isSameColumn = normalizedFromColumnId === normalizedTargetColumnId;
      const isSamePosition = targetPosition?.index === fromIndex;
      
      if (isSameColumn && (!targetPosition || isSamePosition)) {
        console.log('No position change, skipping update');
        return; // No change in position
      }

      try {
        setIsDragging(true);
        
        // Store the current column order before making any changes
        const currentColumnOrder = board.columns.map(col => col.id);
        
        // Create a deep copy of the board to avoid direct state mutation
        const updatedBoard = JSON.parse(JSON.stringify(board));
        
        // Find source column (case-insensitive)
        const sourceColumn = updatedBoard.columns.find(col => {
          if (!col || !col.id) return false;
          return col.id.toLowerCase() === normalizedFromColumnId;
        });
        
        if (!sourceColumn) {
          console.error('Source column not found:', fromColumnId, 'Normalized:', normalizedFromColumnId);
          console.error('Available columns:', updatedBoard.columns.map(c => ({
            id: c.id,
            title: c.title,
            normalizedId: String(c.id || '').toLowerCase(),
            taskCount: Array.isArray(c.tasks) ? c.tasks.length : 0
          })));
          return;
        }
        
        // Find target column (case-insensitive)
        const targetColumn = updatedBoard.columns.find(col => {
          if (!col || !col.id) return false;
          return col.id.toLowerCase() === normalizedTargetColumnId;
        });
        
        if (!targetColumn) {
          console.error('Target column not found:', targetColumnId, 'Normalized:', normalizedTargetColumnId);
          console.error('Available columns:', updatedBoard.columns.map(c => ({
            id: c.id,
            title: c.title,
            normalizedId: String(c.id || '').toLowerCase(),
            taskCount: Array.isArray(c.tasks) ? c.tasks.length : 0
          })));
          return;
        }
        
        // Find the card in the source column
        const cardIndex = sourceColumn.tasks.findIndex(task => task.id === cardId);
        if (cardIndex === -1) {
          console.error('Card not found in source column:', cardId);
          return;
        }
        
        // Remove from source column
        const [movedCard] = sourceColumn.tasks.splice(cardIndex, 1);
        
        // Calculate the target index
        let targetIndex = targetPosition?.index !== undefined 
          ? Math.min(targetPosition.index, targetColumn.tasks.length)
          : targetColumn.tasks.length;
        
        // Insert at the target position
        targetColumn.tasks.splice(targetIndex, 0, movedCard);
        
        // Update the board state optimistically
        setBoard(updatedBoard);
        
        try {
          // Update in the backend
          await updateCardPosition(
            board._id,
            fromColumnId,  // Use original ID for API call
            cardId,
            targetIndex,
            targetColumn.id  // Use the actual column ID from the found column
          );
          console.log('Card position updated successfully');
          
          // Refresh the board to ensure consistency
          const freshBoard = await getBoard(board._id);
          
          // Preserve the original column order
          if (freshBoard && freshBoard.columns) {
            const columnMap = new Map(freshBoard.columns.map(col => [col.id, col]));
            freshBoard.columns = currentColumnOrder
              .map(columnId => columnMap.get(columnId))
              .filter(Boolean); // Remove any undefined columns
          }
          
          setBoard(freshBoard);
          
        } catch (error) {
          console.error('Failed to update card position in backend:', error);
          // Revert optimistic update on error
          const boardData = await getBoard(board._id);
          
          // Preserve the original column order
          if (boardData && boardData.columns) {
            const columnMap = new Map(boardData.columns.map(col => [col.id, col]));
            boardData.columns = currentColumnOrder
              .map(columnId => columnMap.get(columnId))
              .filter(Boolean); // Remove any undefined columns
          }
          
          setBoard(boardData);
          throw error; // Re-throw to be caught by the outer catch
        }
      } catch (error) {
        console.error('Error in handleCardDrop:', error);
        setError('Failed to move card. Please try again.');
      } finally {
        setIsDragging(false);
      }
    },
    [board, getBoard, setBoard, setError, setIsDragging, updateCardPosition]
  );

  const handleCardAdded = useCallback(async (updatedBoard) => {
    console.log('handleCardAdded called with updated board:', updatedBoard);
    
    if (!updatedBoard || !updatedBoard.columns) {
      console.error('Invalid board data received in handleCardAdded:', updatedBoard);
      return;
    }
    
    try {
      // Update the board state with the new board from the server
      setBoard(updatedBoard);
      
      // Notify parent component if needed
      if (onBoardUpdate) {
        onBoardUpdate(updatedBoard);
      }
      
      return updatedBoard;
    } catch (error) {
      console.error('Error adding card:', error);
      setError('Failed to add card. Please try again.');
      throw error;
    }
  }, [board, editingCard, editingColumnId, getBoard, setBoard, setError]);

  const handleCardEdit = useCallback((card, columnId) => {
    console.log('Editing card:', card, 'in column:', columnId);
    setEditingCard(card);
    setEditingColumnId(columnId);
  }, []);

  const handleDeleteCard = useCallback(async (cardId) => {
    console.log('handleDeleteCard called with cardId:', cardId);
    
    if (!cardId) {
      console.error('Invalid card ID:', { cardId });
      setError('Invalid card');
      return;
    }

    // Store the current column order before making any changes
    const currentColumnOrder = board.columns.map(col => col.id);
    console.log('Current column order:', currentColumnOrder);
    
    // Optimistically update the UI
    const updatedBoard = JSON.parse(JSON.stringify(board));
    console.log('Updated board before column search:', JSON.stringify(updatedBoard, null, 2));
    
    // Find the column containing the card
    let columnFound = null;
    let columnIndex = -1;
    
    for (let i = 0; i < updatedBoard.columns.length; i++) {
      const col = updatedBoard.columns[i];
      if (col.tasks && Array.isArray(col.tasks)) {
        const taskIndex = col.tasks.findIndex(task => task.id === cardId);
        if (taskIndex > -1) {
          columnFound = col;
          columnIndex = i;
          console.log(`Found card ${cardId} in column ${col.id} at index ${taskIndex}`);
          // Remove the card from the column
          col.tasks.splice(taskIndex, 1);
          console.log(`Card removed from column ${col.id}`);
          break;
        }
      }
    }
    
    if (!columnFound) {
      console.error('Card not found in any column:', cardId);
      setError('Could not find the card to delete');
      return;
    }
    
    // Update the UI immediately for better UX
    setBoard(updatedBoard);
    setEditingCard(null);
    setEditingColumnId(null);
    
    try {
      // Make the API call to delete the card
      console.log('Attempting to delete card:', { boardId: board._id, columnId: columnFound.id, cardId });
      await deleteCard(board._id, columnFound.id, cardId);
      
      console.log('Card marked as deleted, refreshing board...');
      // Refresh the board to ensure consistency
      const freshBoard = await getBoard(board._id);
      
      if (!freshBoard) {
        throw new Error('Failed to refresh board after deletion');
      }
      
      // Preserve the original column order
      if (freshBoard.columns) {
        const columnMap = new Map(freshBoard.columns.map(col => [col.id.toLowerCase(), col]));
        freshBoard.columns = currentColumnOrder
          .map(columnId => {
            const col = columnMap.get(columnId.toLowerCase());
            if (col) {
              // Filter out deleted tasks
              col.tasks = (col.tasks || []).filter(task => 
                task && task.status !== 'deleted' && !task.deletedAt
              );
            }
            return col;
          })
          .filter(Boolean);
      }
      
      console.log('Board refreshed after deletion, setting new board state');
      setBoard(freshBoard);
      setError(null);
      
    } catch (err) {
      console.error('Failed to delete card in backend:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        config: {
          url: err.config?.url,
          method: err.config?.method,
          data: err.config?.data
        },
        stack: err.stack
      });
      
      setError('An unexpected error occurred while deleting the card');
      
      // Revert the UI if backend update fails
      console.log('Reverting UI due to error...');
      const boardData = await getBoard(board._id);
      
      if (boardData?.columns) {
        const columnMap = new Map(boardData.columns.map(col => [col.id.toLowerCase(), col]));
        boardData.columns = currentColumnOrder
          .map(columnId => columnMap.get(columnId.toLowerCase()))
          .filter(Boolean);
        
        setBoard(boardData);
      }
      
      setBoard(boardData);
    }
  }, [board, editingColumnId, getBoard, setBoard, setError]);

  const handleSaveCard = useCallback(async (updatedCard) => {
    if (!updatedCard || !updatedCard.id) {
      console.error('Invalid card data:', updatedCard);
      setError('Invalid card data');
      return;
    }

    console.log('Saving card:', updatedCard);
    
    // Store the current column order before making any changes
    const currentColumnOrder = board.columns.map(col => col.id);
    
    try {
      // Create a deep copy of the board to avoid state mutation
      const updatedBoard = JSON.parse(JSON.stringify(board));
      
      if (!updatedBoard || !updatedBoard.columns) {
        console.error('Invalid board data:', updatedBoard);
        setError('Invalid board data');
        return;
      }
      
      // Normalize column ID for comparison
      const normalizedColumnId = editingColumnId.toLowerCase();
      
      // Find the column containing the card
      const columnIndex = updatedBoard.columns.findIndex(
        col => col && col.id && col.id.toLowerCase() === normalizedColumnId
      );
      
      if (columnIndex === -1) {
        const errorMsg = `Column not found: ${editingColumnId}. Available columns: ${updatedBoard.columns.map(c => c?.id).join(', ')}`;
        console.error(errorMsg);
        setError(errorMsg);
        return;
      }
      
      const column = updatedBoard.columns[columnIndex];
      if (!column.tasks) {
        console.error('Column tasks array is undefined for column:', column.id);
        column.tasks = []; // Initialize tasks array if it doesn't exist
      }
      
      // Find and update the card in the column
      const cardIndex = column.tasks.findIndex(
        task => task && task.id === updatedCard.id
      );
      
      if (cardIndex === -1) {
        console.error(`Card ${updatedCard.id} not found in column ${column.id}`);
        setError('Card not found in column');
        return;
      }
      
      // Preserve the original position if not provided
      const originalPosition = column.tasks[cardIndex].position || 0;
      
      // Prepare the card update
      const cardUpdate = {
        ...column.tasks[cardIndex],
        ...updatedCard,
        position: updatedCard.position !== undefined ? updatedCard.position : originalPosition,
        updatedAt: new Date().toISOString()
      };
      
      console.log('Updated card data:', cardUpdate);
      
      // Optimistically update the UI
      column.tasks[cardIndex] = cardUpdate;
      setBoard(updatedBoard);
      
      // Close the edit modal
      setEditingCard(null);
      setEditingColumnId('');
      
      try {
        console.log('Sending card update to backend...');
        // Use updateCard API instead of updateBoard
        const result = await updateCard(
          board._id,
          editingColumnId,
          updatedCard.id,
          cardUpdate
        );
        
        console.log('Card update successful:', result);
        
        // Refresh the board to ensure consistency
        const freshBoard = await getBoard(board._id);
        
        // Preserve the original column order
        if (freshBoard && freshBoard.columns) {
          const columnMap = new Map(freshBoard.columns.map(col => [col.id, col]));
          freshBoard.columns = currentColumnOrder
            .map(columnId => columnMap.get(columnId))
            .filter(Boolean); // Remove any undefined columns
        }
        
        setBoard(freshBoard);
        
      } catch (err) {
        console.error('Failed to save card to backend:', {
          error: err,
          response: err.response?.data,
          status: err.response?.status,
          config: {
            url: err.config?.url,
            method: err.config?.method,
            data: err.config?.data
          }
        });
        
        // Revert the UI if backend update fails
        const boardData = await getBoard(board._id);
        
        // Preserve the original column order
        if (boardData && boardData.columns) {
          const columnMap = new Map(boardData.columns.map(col => [col.id, col]));
          boardData.columns = currentColumnOrder
            .map(columnId => columnMap.get(columnId))
            .filter(Boolean); // Remove any undefined columns
        }
        
        setBoard(boardData);
        
        const errorMessage = err.response?.data?.message || 'Failed to save card. Please try again.';
        setError(errorMessage);
        
        // Re-open the edit modal to allow retry
        setEditingCard(updatedCard);
        setEditingColumnId(editingColumnId);
      }
    } catch (err) {
      console.error('Unexpected error saving card:', err);
      setError(`An unexpected error occurred: ${err.message}`);
      
      // Re-open the edit modal to allow retry
      setEditingCard(updatedCard);
      setEditingColumnId(editingColumnId);
    }
  }, [board, editingColumnId, getBoard, setBoard, setError, updateCard]);

  const renderColumn = (column) => {
    if (!column || !column.tasks) {
      console.warn('Invalid column data:', column);
      return null;
    }
    
    // Debug: Log tasks before filtering
    console.log(`Column ${column.id} tasks before filtering:`, column.tasks);
    
    // Filter out deleted tasks and handle undefined/null tasks
    const visibleTasks = column.tasks.filter(task => {
      if (!task) return false;
      const isDeleted = task.status === 'deleted' || task.deletedAt;
      if (isDeleted) {
        console.log('Filtering out deleted task:', task.id, task.title);
      }
      return !isDeleted;
    });
    
    console.log(`Column ${column.id} visible tasks:`, visibleTasks);
    
    return (
      <Column
        key={column.id}
        column={{
          ...column,
          tasks: visibleTasks
        }}
        onDrop={handleCardDrop}
        onEdit={handleCardEdit}
        onCardAdded={handleCardAdded}
        boardId={board._id}
      />
    );
  };

  if (isLoading) {
    return <div className="loading">Loading board...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  // Debug component to display current board state
  const DebugInfo = () => (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 1000,
      maxWidth: '300px',
      maxHeight: '200px',
      overflow: 'auto'
    }}>
      <div><strong>Board ID:</strong> {board._id}</div>
      <div><strong>Columns:</strong> {board.columns?.length || 0}</div>
      <div style={{marginTop: '5px'}}>
        {board.columns?.map(col => (
          <div key={col.id} style={{margin: '2px 0', padding: '2px', borderBottom: '1px solid #444'}}>
            {col.title} ({col.id}) - {col.tasks?.length || 0} tasks
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <DndProvider backend={isTouchDevice ? TouchBackend : HTML5Backend} options={{ enableMouseEvents: true }}>
        <div 
          className={`kanban-board ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => e.preventDefault()}
        >
          {board.columns && board.columns.length > 0 ? (
            board.columns.map(renderColumn)
          ) : (
            <div className="no-columns">No columns found. Please check your board configuration.</div>
          )}
        </div>
        <DebugInfo />
      </DndProvider>

      {editingCard && (
        <div className="modal-overlay">
          <div className="modal-content">
            <EditCard
              boardId={board._id}
              columnId={editingColumnId}
              card={editingCard}
              onSave={handleSaveCard}
              onCancel={() => {
                setEditingCard(null);
                setEditingColumnId('');
              }}
              onDelete={handleDeleteCard}
            />
          </div>
        </div>
      )}
    </>
  );
};

import PropTypes from 'prop-types';

KanbanBoard.propTypes = {
  boardId: PropTypes.string,
  onBoardUpdate: PropTypes.func,
  initialBoard: PropTypes.shape({
    _id: PropTypes.string,
    columns: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string,
      title: PropTypes.string,
      tasks: PropTypes.arrayOf(PropTypes.object)
    }))
  })
};

KanbanBoard.defaultProps = {
  boardId: 'default-board',
  onBoardUpdate: null,
  initialBoard: null
};

export default KanbanBoard;
