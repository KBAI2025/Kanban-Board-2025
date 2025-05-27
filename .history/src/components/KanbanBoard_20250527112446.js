import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch } from '@fortawesome/free-solid-svg-icons';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import './KanbanBoard.css';
import { getBoard, updateBoard, addCardToColumn, updateCardPosition, updateCard, deleteCard } from '../services/api';
import AddCard from './AddCard';
import EditCard from './EditCard';
import Filters from './Filters';

// Check if the device supports touch events
const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

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
            <span className="ticket-number">
              {card.ticketNumber?.startsWith('PT-') 
                ? card.ticketNumber 
                : `PT-${String(card.id || '').substring(18, 21).toUpperCase()}`}
            </span>
            <div className="assignee">
              {card.assignee ? (
                <>
                  <span className="assignee-avatar" title={card.assignee.name}>
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

// DropArea component for above/below cards and empty columns
const DropArea = ({ onDrop, position, children }) => {
  const [{ isOver }, drop] = useDrop({
    accept: 'CARD',
    drop: (item) => onDrop && onDrop(item, position),
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  });

  // If children are provided, render them with drop functionality
  if (children) {
    return (
      <div
        ref={drop}
        className={`drop-area-container ${isOver ? 'is-over' : ''}`}
      >
        {children}
      </div>
    );
  }

  // Default drop indicator
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

  const isEmpty = !column.tasks || column.tasks.length === 0;

  const taskCount = column.tasks?.length || 0;

  return (
    <div className="kanban-column">
      <div className="column-header">
        <h3>{column?.title?.toUpperCase?.() || 'UNKNOWN COLUMN'}</h3>
        <span className="task-counter">{taskCount} {taskCount === 1 ? 'ticket' : 'tickets'}</span>
      </div>
      <div className="kanban-tasks">
        {isEmpty ? (
          /* Drop zone for empty column */
          <div 
            className="empty-column-drop-zone"
            onClick={() => {
              // Trigger add card when clicking the empty zone
              const addButton = document.querySelector(`#add-card-${column.id}`);
              if (addButton) addButton.click();
            }}
          >
            <DropArea 
              onDrop={(item) => handleDrop(item, { index: 0 })}
              position={{ index: 0 }}
            >
              <div className="empty-column-message">
                <span>+</span> Add a card
              </div>
            </DropArea>
          </div>
        ) : (
          /* Regular task list with drop zones */
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
        )}
      </div>
      <AddCard 
        key={`add-card-${column.id}`}
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
    { id: 'todo', title: 'Todo', tasks: [] },
    { id: 'in-progress', title: 'In Progress', tasks: [] },
    { id: 'review', title: 'Review', tasks: [] },
    { id: 'done', title: 'Done', tasks: [] }
  ]
};

const KanbanBoard = ({ boardId = 'default-board', onBoardUpdate, initialBoard, board: propBoard }) => {
  const [internalBoard, setInternalBoard] = useState(initialBoard || defaultBoard);
  const board = propBoard || internalBoard;

  const [isLoading, setIsLoading] = useState(!initialBoard);
  const [error, setError] = useState(null);
  const [editingCard, setEditingCard] = useState(null);
  const [editingColumnId, setEditingColumnId] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  
  // State for filters
  const [searchText, setSearchText] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [uniqueAssignees, setUniqueAssignees] = useState([]);
  const [columnOrder, setColumnOrder] = useState(['todo', 'in-progress', 'review', 'done']);

  // Update column order when board changes
  useEffect(() => {
    if (board?.columns) {
      // Set the columns in the desired order
      setColumnOrder(['todo', 'in-progress', 'review', 'done']);
    }
  }, [board]);

  // Extract unique assignees when board data changes
  useEffect(() => {
    console.log('Board data changed, extracting assignees...', {
      hasBoard: !!board,
      hasColumns: board?.columns?.length > 0
    });

    if (board?.columns) {
      const assignees = new Set();
      board.columns.forEach((column, colIndex) => {
        console.log(`Column ${colIndex} (${column.id}):`, {
          name: column.name,
          taskCount: column.tasks?.length || 0,
          tasks: column.tasks?.map(t => ({
            id: t.id,
            title: t.title,
            assignee: t.assignee?.name || 'none'
          }))
        });

        if (column.tasks && Array.isArray(column.tasks)) {
          column.tasks.forEach(task => {
            if (task.assignee?.name) {
              assignees.add(task.assignee.name);
            }
          });
        }
      });
      
      const sortedAssignees = Array.from(assignees).sort();
      console.log('Updating unique assignees:', sortedAssignees);
      setUniqueAssignees(sortedAssignees);
    } else {
      console.log('No columns found in board or board is undefined');
      setUniqueAssignees([]);
    }
  }, [board]);

  // Filter tasks based on search and filters
  const filteredColumns = useMemo(() => {
    if (!board?.columns) return [];

    return board.columns.map(column => ({
      ...column,
      tasks: column.tasks.filter(task => {
        // Filter by search text
        const matchesSearch = searchText === '' || 
          task.title.toLowerCase().includes(searchText.toLowerCase()) ||
          (task.description && task.description.toLowerCase().includes(searchText.toLowerCase()));
        
        // Filter by assignee
        const matchesAssignee = selectedAssignee === 'all' || 
          (task.assignee?.name === selectedAssignee);
          
        // Filter by priority
        const matchesPriority = selectedPriority === 'all' || 
          task.priority?.toLowerCase() === selectedPriority.toLowerCase();
          
        return matchesSearch && matchesAssignee && matchesPriority;
      })
    }));
  }, [board?.columns, searchText, selectedAssignee, selectedPriority]);

  // Use filtered columns if filters are active, otherwise use original columns
  const displayColumns = useMemo(() => {
    const cols = searchText || selectedAssignee !== 'all' || selectedPriority !== 'all' 
      ? filteredColumns 
      : board?.columns || [];
    
    // Ensure we have valid columns
    return cols.filter(col => col && (col.id || col.title));
  }, [searchText, selectedAssignee, selectedPriority, filteredColumns, board?.columns]);

  useEffect(() => {
    let isMounted = true;
    
    const fetchOrUseInitialBoard = async () => {
      setIsLoading(true);
      
      try {
        // Update local state when propBoard changes
        if (propBoard) {
          setInternalBoard(propBoard);
        }
        
        // If we have initialBoard, use it
        if (initialBoard) {
          console.log('Using initialBoard:', initialBoard);
          // Ensure all required columns are present and have valid IDs
          const updatedBoard = ensureAllColumns(initialBoard);
          setInternalBoard(updatedBoard);
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
          
          // Ensure all required columns are present and have valid IDs
          const updatedData = ensureAllColumns(data);
          
          const boardWithSortedTasks = {
            ...updatedData,
            columns: updatedData.columns.map(column => ({
              ...column,
              tasks: column.tasks ? column.tasks.sort((a, b) => (a.position || 0) - (b.position || 0)) : []
            }))
          };
          
          console.log('Board with sorted tasks and ensured columns:', boardWithSortedTasks);
          setInternalBoard(boardWithSortedTasks);
          
          if (onBoardUpdate) {
            onBoardUpdate(boardWithSortedTasks);
          }
        } else {
          console.warn('No columns found in board data, using default board');
          setInternalBoard(defaultBoard);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching board:', err);
        if (isMounted) {
          setError('Failed to load board. Using default board.');
          setInternalBoard(defaultBoard);
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
  }, [boardId, onBoardUpdate, initialBoard, propBoard]);

  // Function to ensure all required columns are present and have valid IDs
  const ensureAllColumns = (boardData) => {
    try {
      // Validate input
      if (!boardData || typeof boardData !== 'object') {
        console.warn('Invalid board data provided, using default board');
        return { ...defaultBoard };
      }

      // Ensure columns is an array
      if (!Array.isArray(boardData.columns)) {
        console.warn('No columns array found in board data, using default columns');
        return {
          ...boardData,
          columns: [...defaultBoard.columns]
        };
      }
      
      // Define required columns with consistent IDs
      const requiredColumns = {
        'todo': { id: 'todo', title: 'To Do', tasks: [] },
        'in-progress': { id: 'in-progress', title: 'In Progress', tasks: [] },
        'review': { id: 'review', title: 'Review', tasks: [] },
        'done': { id: 'done', title: 'Done', tasks: [] }
      };

      // Create maps for existing columns
      const columnsById = new Map();
      const columnsByTitle = new Map();
      const validColumns = [];
      
      // First pass: process all columns and ensure they have valid IDs
      boardData.columns.forEach((column, index) => {
        if (!column || typeof column !== 'object') {
          console.warn(`Skipping invalid column at index ${index}:`, column);
          return;
        }
        
        // Generate a stable ID if none exists
        let columnId = column.id || column._id || `column-${index}`;
        columnId = String(columnId).trim();
        
        // Create a safe column object with guaranteed fields
        const safeColumn = {
          ...column,
          id: columnId,
          title: column.title || `Column ${index + 1}`,
          tasks: Array.isArray(column.tasks) ? column.tasks : []
        };
        
        // Map by ID and title for easy lookup
        columnsById.set(columnId, safeColumn);
        if (safeColumn.title) {
          columnsByTitle.set(safeColumn.title.toLowerCase(), safeColumn);
        }
        
        validColumns.push(safeColumn);
      });
      
      // Second pass: merge with required columns
      const mergedColumns = [];
      const usedIds = new Set();
      
      // Add all required columns in order, preserving any existing data
      Object.entries(requiredColumns).forEach(([key, requiredColumn]) => {
        // Try to find by ID first
        let existingColumn = columnsById.get(key);
        
        // If not found by ID, try to find by title
        if (!existingColumn) {
          const titleMatch = requiredColumn.title.toLowerCase();
          existingColumn = columnsByTitle.get(titleMatch);
        }
        
        if (existingColumn) {
          // Merge with required column to ensure all fields are present
          mergedColumns.push({
            ...requiredColumn,
            ...existingColumn,
            id: requiredColumn.id, // Use the standard ID
            title: existingColumn.title || requiredColumn.title,
            tasks: Array.isArray(existingColumn.tasks) ? existingColumn.tasks : []
          });
          usedIds.add(existingColumn.id.toLowerCase());
        } else {
          // Add the required column if it doesn't exist
          mergedColumns.push(requiredColumn);
        }
      });
      
      // Add any additional columns that aren't in the required list
      validColumns.forEach(column => {
        const columnId = column.id.toLowerCase();
        if (!usedIds.has(columnId)) {
          mergedColumns.push({
            ...column,
            tasks: Array.isArray(column.tasks) ? column.tasks : []
          });
          usedIds.add(columnId);
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
    } catch (error) {
      console.error('Error in ensureAllColumns:', error);
      // Return a safe default if something goes wrong
      return { ...defaultBoard };
    }
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
        setInternalBoard(updatedBoard);
        
        // Notify parent component of the change
        if (onBoardUpdate) {
          onBoardUpdate(updatedBoard);
        }
        
        try {
          // Update in the backend
          await updateCardPosition(
            board._id,
            fromColumnId,  // Source column ID
            cardId,
            {
              position: targetIndex,
              columnId: targetColumn.id
            }
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
          
          setInternalBoard(freshBoard);
          
          // Notify parent component of the updated board
          if (onBoardUpdate) {
            onBoardUpdate(freshBoard);
          }
          
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
          
          setInternalBoard(boardData);
          throw error; // Re-throw to be caught by the outer catch
        }
      } catch (error) {
        console.error('Error in handleCardDrop:', error);
        setError('Failed to move card. Please try again.');
      } finally {
        setIsDragging(false);
      }
    },
    [board, getBoard, setInternalBoard, setError, setIsDragging, updateCardPosition, onBoardUpdate]
  );

  const handleCardAdded = useCallback(async (updatedBoard) => {
    console.log('handleCardAdded called with updated board:', updatedBoard);
    
    if (!updatedBoard || !updatedBoard.columns) {
      console.error('Invalid board data received in handleCardAdded:', updatedBoard);
      return;
    }
    
    try {
      // Update the board state with the new board from the server
      setInternalBoard(updatedBoard);
      
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
  }, [board, editingCard, editingColumnId, getBoard, setInternalBoard, setError, onBoardUpdate]);

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

    console.log('Current column order:', columnOrder);
    
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
    setInternalBoard(updatedBoard);
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
        freshBoard.columns = columnOrder
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
      setInternalBoard(freshBoard);
      setError(null);
      
      // Notify parent component
      if (onBoardUpdate) {
        onBoardUpdate(freshBoard);
      }
      
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
        boardData.columns = columnOrder
          .map(columnId => columnMap.get(columnId.toLowerCase()))
          .filter(Boolean);
        
        setInternalBoard(boardData);
        
        // Notify parent component
        if (onBoardUpdate) {
          onBoardUpdate(boardData);
        }
      }
      
      setInternalBoard(boardData);
    }
  }, [board, editingColumnId, getBoard, setInternalBoard, setError, onBoardUpdate, columnOrder]);

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
      
      // Update the board state based on whether it's controlled by props or local state
      if (propBoard) {
        // If board is controlled by props, call onBoardUpdate
        if (onBoardUpdate) {
          onBoardUpdate(updatedBoard);
        }
      } else {
        // Otherwise update local state
        setInternalBoard(updatedBoard);
      }
      
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
          freshBoard.columns = columnOrder
            .map(columnId => columnMap.get(columnId))
            .filter(Boolean); // Remove any undefined columns
        }
        
        setInternalBoard(freshBoard);
        
        // Notify parent component
        if (onBoardUpdate) {
          onBoardUpdate(freshBoard);
        }
        
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
          boardData.columns = columnOrder
            .map(columnId => columnMap.get(columnId))
            .filter(Boolean); // Remove any undefined columns
        }
        
        setInternalBoard(boardData);
        
        // Notify parent component
        if (onBoardUpdate) {
          onBoardUpdate(boardData);
        }
        
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
  }, [board, editingColumnId, getBoard, setInternalBoard, setError, updateCard, columnOrder, onBoardUpdate]);

  // Sort columns by their order before rendering
  const sortedColumns = useMemo(() => {
    if (!board?.columns) return [];
    
    return board.columns.sort((a, b) => {
      const aIndex = columnOrder.indexOf(a.id);
      const bIndex = columnOrder.indexOf(b.id);
      
      if (aIndex === -1) return 1; // Columns not in order go to end
      if (bIndex === -1) return -1;
      
      return aIndex - bIndex;
    });
  }, [board?.columns, columnOrder]);

  const renderColumn = (column, index) => {
    // Early return if column is invalid
    if (!column) {
      console.warn('Column is undefined at index:', index);
      return null;
    }

    // Generate a stable column ID
    const columnId = column.id || `column-${index}`;
    
    // Ensure we have valid tasks array
    const tasks = Array.isArray(column.tasks) ? column.tasks : [];
    
    // Filter out deleted tasks
    const visibleTasks = tasks.filter(task => {
      if (!task) return false;
      const isDeleted = task.status === 'deleted' || task.deletedAt;
      if (isDeleted) {
        console.log('Filtering out deleted task:', task.id, task.title);
      }
      return !isDeleted;
    });
    
    console.log(`Column ${columnId} visible tasks:`, visibleTasks);
    
    // Create column data with fallbacks
    const columnData = {
      id: columnId,
      title: column.title || `Column ${index + 1}`,
      tasks: visibleTasks,
      ...column // Spread any other column properties
    };
    
    return (
      <Column
        key={columnId}
        column={columnData}
        onDrop={handleCardDrop}
        onEdit={handleCardEdit}
        onCardAdded={handleCardAdded}
        boardId={board?._id || 'default-board'}
      />
    );
  };
  
  // Memoize the render function to prevent unnecessary re-renders
  const renderColumns = useMemo(() => {
    if (!displayColumns || !Array.isArray(displayColumns)) {
      return <div className="no-columns">No columns to display</div>;
    }
    
    return displayColumns
      .filter(column => column) // Filter out any null/undefined columns
      .map((column, index) => renderColumn(column, index));
  }, [displayColumns, handleCardDrop, handleCardEdit, handleCardAdded, board?._id]);

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
      <div><strong>Board ID:</strong> {internalBoard._id}</div>
    </div>
  );

  // Debug logs before rendering Filters
  console.log('Rendering KanbanBoard with filters:', {
    searchText,
    selectedAssignee,
    selectedPriority,
    uniqueAssignees,
    hasColumns: !!internalBoard?.columns,
  });

  return (
    <div className="kanban-container">
<div className="kanban-filters">
        <Filters
          searchText={searchText}
          setSearchText={setSearchText}
          selectedAssignee={selectedAssignee}
          setSelectedAssignee={setSelectedAssignee}
          selectedPriority={selectedPriority}
          setSelectedPriority={setSelectedPriority}
          uniqueAssignees={uniqueAssignees}
          className="kanban-filters-container"
        />
      </div>
      <DndProvider backend={isTouchDevice ? TouchBackend : HTML5Backend} options={{ enableMouseEvents: true }}>
        <div 
          className={`kanban-board ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => e.preventDefault()}
        >
          {displayColumns && displayColumns.length > 0 ? (
            renderColumns
          ) : (
            <div className="no-columns">No matching tasks found. Try adjusting your filters.</div>
          )}
        </div>
      </DndProvider>
      <DebugInfo />
      
      {editingCard && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button 
              className="modal-close" 
              onClick={() => {
                setEditingCard(null);
                setEditingColumnId('');
              }}
              aria-label="Close modal"
            />
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
    </div>
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
