import Filters from "./Filters";
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSortUp, faSortDown, faSearch, faEdit } from '@fortawesome/free-solid-svg-icons';
import EditCard from './EditCard';
import './ListView.css';

const ListView = ({ board, onBoardUpdate }) => {
  // Edit popup state
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: 'priority',
    direction: 'desc' // Default to descending for priority (Critical first)
  });
  const [searchText, setSearchText] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [uniqueAssignees, setUniqueAssignees] = useState([]);

  // Track filter states for re-rendering
  const [filterKey, setFilterKey] = useState(0);

  // Handlers for edit popup
  const handleCloseEdit = () => {
    setShowEditPopup(false);
    setSelectedTask(null);
  };

  const handleEditTask = (task) => {
    setSelectedTask(task);
    setShowEditPopup(true);
  };

  const handleSaveTask = (updatedTask) => {
    // Create a deep copy of the board to properly update nested state
    const updatedBoard = JSON.parse(JSON.stringify(board));
    
    // Find the column and task index
    const column = updatedBoard.columns.find(col => 
      col.tasks.some(t => t.id === updatedTask.id)
    );
    
    if (column) {
      const taskIndex = column.tasks.findIndex(t => t.id === updatedTask.id);
      if (taskIndex !== -1) {
        // Update the task in the correct column with proper column order
        const updatedTaskWithOrder = {
          ...updatedTask,
          columnOrderIndex: getColumnIndex(updatedTask.columnName || column.title)
        };
        column.tasks[taskIndex] = updatedTaskWithOrder;
        
        // Update the column name if it changed
        if (updatedTask.columnName) {
          const newColumn = updatedBoard.columns.find(col => col.title === updatedTask.columnName);
          if (newColumn && newColumn.title !== column.title) {
            // Remove task from current column
            column.tasks.splice(taskIndex, 1);
            // Add to new column with proper order
            const taskWithNewOrder = {
              ...updatedTask,
              columnOrderIndex: getColumnIndex(updatedTask.columnName)
            };
            newColumn.tasks.push(taskWithNewOrder);
          }
        }
        
        // Update the board state
        onBoardUpdate(updatedBoard);
      }
    }

    handleCloseEdit();
  };

  // Use the same column order as KanbanBoard
  const columnOrder = ['todo', 'in-progress', 'review', 'done'];

  // Helper function to get priority index for sorting (lower number = higher priority)
  const getPriorityIndex = (priority) => {
    const priorityOrder = { 
      critical: 0, 
      high: 1, 
      medium: 2, 
      low: 3 
    };
    return priorityOrder[priority?.toLowerCase()] ?? 4; // Default to lowest priority if not found
  };

  // Helper function to get column index
  const getColumnIndex = (columnId) => {
    const index = columnOrder.findIndex(col => col.toLowerCase() === columnId?.toLowerCase().replace(/\s+/g, '-'));
    return index !== -1 ? index : columnOrder.length;
  };

  useEffect(() => {
    if (board?.columns) {
      const assignees = new Set();
      board.columns.forEach(column => {
        column.tasks.forEach(task => {
          if (task.assignee) {
            assignees.add(JSON.stringify({
              id: task.assignee.id,
              name: task.assignee.name,
              avatar: task.assignee.avatar
            }));
          }
        });
      });
      setUniqueAssignees(Array.from(assignees).map(a => JSON.parse(a)));
    }
  }, [board]);

  // Get all tasks with their column info
  const allTasks = useMemo(() => {
    if (!board) {
      console.log('No board data');
      return [];
    }
    
    if (!board.columns || !Array.isArray(board.columns)) {
      console.log('No columns in board or columns is not an array:', board);
      return [];
    }
    
    const tasks = [];
    
    board.columns.forEach(column => {
      if (column && column.tasks && Array.isArray(column.tasks)) {
        column.tasks.forEach(task => {
          if (task && task.id) { // Only include valid tasks with an ID
            tasks.push({
              ...task,
              columnName: column.title || 'No Status',
              columnOrderIndex: getColumnIndex(column.title)
            });
          }
        });
      }
    });
    
    console.log('Processed tasks:', tasks);
    return tasks;
  }, [board]);

  console.log('All tasks:', allTasks);
  console.log('Current filters:', { searchText, selectedAssignee, selectedPriority });

  // Apply filters and sorting
  const filteredTasks = useMemo(() => {
    if (!allTasks || allTasks.length === 0) {
      console.log('No tasks to filter');
      return [];
    }

    console.log('Filtering tasks with:', { 
      searchText, 
      selectedAssignee, 
      selectedPriority,
      totalTasks: allTasks.length 
    });

    const filtered = allTasks.filter(task => {
      if (!task) return false;
      
      // Filter by search text
      const matchesSearch = !searchText || 
        (task.title && task.title.toLowerCase().includes(searchText.toLowerCase())) ||
        (task.description && task.description.toLowerCase().includes(searchText.toLowerCase()));
      
      // Filter by assignee
      const matchesAssignee = !selectedAssignee || 
        selectedAssignee === 'all' ||
        (task.assignee && (
          task.assignee.id === selectedAssignee || 
          task.assignee.name === selectedAssignee
        ));
      
      // Filter by priority
      const matchesPriority = !selectedPriority || 
        selectedPriority === 'all' ||
        (task.priority && task.priority.toLowerCase() === selectedPriority.toLowerCase());
      
      const matches = matchesSearch && matchesAssignee && matchesPriority;
      
      if (!matches) {
        console.log('Task filtered out:', { 
          title: task.title, 
          matches: { 
            search: matchesSearch, 
            assignee: matchesAssignee, 
            priority: matchesPriority,
            searchText,
            selectedAssignee,
            selectedPriority
          },
          taskAssignee: task.assignee,
          taskPriority: task.priority
        });
      }
      
      return matches;
    });
    
    console.log('Filtered tasks:', filtered);
    return filtered;
  }, [allTasks, searchText, selectedAssignee, selectedPriority]);

  // Apply sorting
  const sortedTasks = useMemo(() => {
    if (!sortConfig.key) return filteredTasks;
    
    return [...filteredTasks].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      // Handle priority sorting (lower index = higher priority)
      if (sortConfig.key === 'priority') {
        aValue = getPriorityIndex(a.priority);
        bValue = getPriorityIndex(b.priority);
        
        // For descending order (Critical first), we want lower numbers first
        if (sortConfig.direction === 'desc') {
          return aValue - bValue;
        }
        // For ascending order, higher numbers first (Low first)
        return bValue - aValue;
      }
      
      // Handle column name sorting
      if (sortConfig.key === 'columnName') {
        aValue = getColumnIndex(a.columnName);
        bValue = getColumnIndex(b.columnName);
      }
      
      // Handle assignee sorting
      if (sortConfig.key === 'assignee') {
        aValue = a.assignee?.name || '';
        bValue = b.assignee?.name || '';
      }
      
      // Handle comparison
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredTasks, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FontAwesomeIcon icon={faSort} className="sort-icon" />;
    return sortConfig.direction === 'asc' 
      ? <FontAwesomeIcon icon={faSortUp} className="sort-icon active" /> 
      : <FontAwesomeIcon icon={faSortDown} className="sort-icon active" />;
  };

  return (
    <div className="list-view" key={`list-view-${filterKey}`}>
      <div className="list-filters">
        <Filters
          searchText={searchText}
          setSearchText={setSearchText}
          selectedAssignee={selectedAssignee}
          setSelectedAssignee={setSelectedAssignee}
          selectedPriority={selectedPriority}
          setSelectedPriority={setSelectedPriority}
          uniqueAssignees={uniqueAssignees}
          className="list-filters-container"
        />
      </div>
      
      <div className="list-header">
        <div className="list-col ticket-number">
          Ticket #
        </div>
        <div className="list-col title sortable" onClick={() => requestSort('title')}>
          Title
          {getSortIcon('title')}
        </div>
        <div className="list-col epic" onClick={() => requestSort('epicLabel')}>
          Epic
          {getSortIcon('epicLabel')}
        </div>
        <div className="list-col priority sortable" onClick={() => requestSort('priority')}>
          Priority
          {getSortIcon('priority')}
        </div>
        <div className="list-col assignee sortable" onClick={() => requestSort('assignee')}>
          Assignee
          {getSortIcon('assignee')}
        </div>
        <div className="list-col status sortable" onClick={() => requestSort('columnName')}>
          Status
          {getSortIcon('columnName')}
        </div>
      </div>

      {sortedTasks.length > 0 ? (
        <div className="list-rows">
          {sortedTasks.map((task) => (
            <div 
              key={task.id} 
              className="list-row" 
              data-priority={task.priority || 'medium'}
              onClick={() => handleEditTask(task)}
            >
            <div className="list-col ticket-number">
              {task.ticketNumber?.startsWith('PT-') 
                ? task.ticketNumber 
                : `PT-${String(task.id || '').substring(18, 21).toUpperCase()}`}
            </div>
            <div className="list-col title">
              <h4>{task.title}</h4>
            </div>
            <div className="list-col epic">
              {task.epicLabel && (
                <span className="epic-label">
                  {task.epicLabel}
                </span>
              )}
            </div>
            <div className="list-col priority">
              {task.priority && (
                <span className="priority-badge" data-priority={task.priority.toLowerCase()}>
                  {task.priority}
                </span>
              )}
            </div>
            <div className="list-col assignee">
              {task.assignee ? (
                <div className="assignee-avatar" title={task.assignee.name}>
                  {task.assignee.avatar || task.assignee.name.split(' ').map(n => n[0]).join('')}
                </div>
              ) : (
                <span className="assignee-avatar unassigned" title="Unassigned">
                  UA
                </span>
              )}
            </div>
            <div className="list-col status">
              <span className="status-badge" data-status-index={task.columnOrderIndex}>
                {task.columnName}
              </span>
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="empty-state">No tasks found</div>
    )}

    {showEditPopup && selectedTask && (
      <div className="modal-overlay">
        <div className="modal-content">
          <button 
            className="modal-close" 
            onClick={handleCloseEdit}
            aria-label="Close modal"
          >
            ×
          </button>
          <EditCard
            boardId={board?._id}
            card={selectedTask}
            onSave={(updatedCard) => {
              handleSaveTask(updatedCard);
              handleCloseEdit();
            }}
            onCancel={handleCloseEdit}
            onDelete={() => {
              // You can implement delete functionality if needed
              handleCloseEdit();
            }}
          />
        </div>
      </div>
    )}
  </div>
  );
};

export default ListView;
