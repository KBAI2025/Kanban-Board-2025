import Filters from "./Filters";
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSortUp, faSortDown, faSearch, faEdit } from '@fortawesome/free-solid-svg-icons';
import './ListView.css';

const EditTaskPopup = ({ task, onClose, onSave, board }) => {
  const [editedTask, setEditedTask] = useState({ ...task });

  const handleSave = () => {
    onSave(editedTask);
    onClose();
  };

  return (
    <div className="edit-popup-overlay">
      <div className="edit-popup">
        <div className="edit-popup-header">
          <h3>Edit Task</h3>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        <div className="edit-popup-content">
          <div className="edit-field">
            <label>Title:</label>
            <input
              type="text"
              value={editedTask.title || ''}
              onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
            />
          </div>
          <div className="edit-field">
            <label>Description:</label>
            <textarea
              value={editedTask.description || ''}
              onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
            />
          </div>
          <div className="edit-field">
            <label>Priority:</label>
            <div className="priority-badge" data-priority={editedTask.priority || 'medium'}>
              {editedTask.priority ? editedTask.priority.charAt(0).toUpperCase() + editedTask.priority.slice(1) : 'Medium'}
            </div>
            <select
              value={editedTask.priority || 'medium'}
              onChange={(e) => setEditedTask({ ...editedTask, priority: e.target.value })}
              className="priority-select"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="edit-field">
            <label>Assignee:</label>
            <div className="assignee-avatar" title={editedTask.assignee?.name || 'Unassigned'}>
              {editedTask.assignee?.name ? 
                editedTask.assignee.name.split(' ').map(n => n[0]).join('') : 
                'UA'}
            </div>
            <input
              type="text"
              value={editedTask.assignee?.name || ''}
              onChange={(e) => setEditedTask({ ...editedTask, assignee: { name: e.target.value } })}
              placeholder="Enter assignee name"
            />
          </div>
          <div className="edit-field">
            <label>Status:</label>
            <select
              value={editedTask.columnName || ''}
              onChange={(e) => setEditedTask({ ...editedTask, columnName: e.target.value })}
            >
              {board?.columns?.map(column => (
                <option key={column.id} value={column.title}>
                  {column.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="edit-popup-footer">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave} className="save-btn">Save</button>
        </div>
      </div>
    </div>
  );
};

const ListView = ({ board, onBoardUpdate }) => {
  // Edit popup state
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Handlers for edit popup
  const handleCloseEdit = () => {
    setShowEditPopup(false);
    setSelectedTask(null);
  };

  const handleEditTask = (task) => {
    // Find the original task from the board data by ID
    let originalTask = null;
    if (task && task.id && board && board.columns) {
      for (const column of board.columns) {
        const found = column.tasks.find(t => t.id === task.id);
        if (found) {
          originalTask = { ...found, columnName: column.title };
          break;
        }
      }
    }
    setSelectedTask(originalTask || task);
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

  // Default sort by priority ascending (Critical at top)
  const [sortConfig, setSortConfig] = useState({ 
    key: 'priority', 
    direction: 'asc' 
  });
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedAssignee, setSelectedAssignee] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [uniqueAssignees, setUniqueAssignees] = useState([]);

  // Priority order: Critical > High > Medium > Low
  const priorityOrder = ['critical', 'high', 'medium', 'low'];
  
  // Get priority index for sorting
  const getPriorityIndex = (priority) => {
    if (!priority) return priorityOrder.length;
    return priorityOrder.indexOf(priority.toLowerCase());
  };

  // Helper function to get column index
  const getColumnIndex = (columnId) => {
    // Convert column title to ID format
    const id = columnId.toLowerCase().replace(/\s+/g, '-');
    return columnOrder.indexOf(id);
  };


  useEffect(() => {
    if (board?.columns) {
      const assignees = new Set();
      board.columns.forEach(column => {
        column.tasks.forEach(task => {
          if (task.assignee?.name) {
            assignees.add(task.assignee.name);
          }
        });
      });
      setUniqueAssignees(Array.from(assignees).sort());
    }
  }, [board]);

  useEffect(() => {
    // Update local state if needed when board prop changes
  }, [board]);


  if (!board || !board.columns) return null;

  const filteredTasks = useMemo(() => {
    if (!board?.columns) return [];
    
    const searchLower = searchText.trim().toLowerCase();
    const priorityFilter = selectedPriority.toLowerCase();
    
    const filtered = board.columns.flatMap(column => {
      const tasks = column.tasks || [];
      return tasks
        .filter(task => {
          if (!task) return false;
          
          const title = task.title || '';
          const description = task.description || '';
          const matchesSearch = searchText === '' || 
            title.toLowerCase().includes(searchLower) ||
            description.toLowerCase().includes(searchLower);
          
          const assigneeName = typeof task.assignee === 'string' 
            ? task.assignee 
            : task.assignee?.name || 'Unassigned';
            
          const matchesAssignee = selectedAssignee === 'all' || 
            assigneeName === selectedAssignee;
            
          const taskPriority = task.priority ? task.priority.toLowerCase() : 'medium';
          const matchesPriority = priorityFilter === 'all' || 
            taskPriority === priorityFilter;
            
          return matchesSearch && matchesAssignee && matchesPriority;
        })
        .map(task => {
          const assignee = typeof task.assignee === 'string' 
            ? { name: task.assignee || 'Unassigned' } 
            : task.assignee || { name: 'Unassigned' };
            
          return {
            ...task,
            columnName: column.title || 'Unknown Column',
            priority: typeof task.priority === 'string' && task.priority ? task.priority : 'medium',
            assignee: {
              ...assignee,
              avatar: assignee.avatar || (assignee.name 
                ? assignee.name.split(' ').map(n => n[0]).join('').toUpperCase()
                : '?')
            },
            epicLabel: task.epicLabel || '',
            columnOrderIndex: getColumnIndex(column.id)
          };
        });
    });
    
    return filtered || [];
  }, [board?.columns, searchText, selectedAssignee, selectedPriority]);

  const allTasks = useMemo(() => {
    if (!filteredTasks || !filteredTasks.length) return [];
    
    const processedTasks = filteredTasks.map(task => {
      const priorityMap = {
        'critical': 4,
        'high': 3,
        'medium': 2,
        'low': 1
      };
      
      const priority = task.priority?.toLowerCase() || '';
      
      return {
        ...task,
        originalPriority: task.priority,
        priorityValue: priorityMap[priority] || 0,
        priority: task.priority ? 
          task.priority.charAt(0).toUpperCase() + task.priority.slice(1).toLowerCase() :
          'None',
        assigneeName: task.assignee?.name || 'Unassigned',
        columnName: task.columnName,
        columnOrderIndex: task.columnOrderIndex
      };
    });

    return [...processedTasks].sort((a, b) => {
      // Sort only by priority (ascending), independent of column/status
      const aPriority = getPriorityIndex(a.priority);
      const bPriority = getPriorityIndex(b.priority);
      if (aPriority < bPriority) return -1;
      if (aPriority > bPriority) return 1;
      // If priorities are equal, sort by title
      const aTitle = a.title?.toLowerCase() || '';
      const bTitle = b.title?.toLowerCase() || '';
      if (aTitle < bTitle) return -1;
      if (aTitle > bTitle) return 1;
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
    <>
      <div className="list-view">
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
        

        {allTasks.length > 0 ? (
          <div className="list-rows">
            {allTasks.map((task) => (
              <div 
                key={task.id} 
                className="list-row" 
                data-priority={task.priority || 'medium'}
                onClick={() => handleEditTask(task)}
              >
                <div className="list-col title">
                  <span className="ticket-number">{task.ticketNumber || `TKT-${task.id.substring(0, 6).toUpperCase()}`}</span>
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
                    <span className="assignee-unassigned" title="Unassigned">
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
      </div>
      {showEditPopup && selectedTask && (
        <EditTaskPopup
          task={selectedTask}
          onClose={handleCloseEdit}
          onSave={handleSaveTask}
          board={board}
        />
      )}
    </>
  );
};

export default ListView;
