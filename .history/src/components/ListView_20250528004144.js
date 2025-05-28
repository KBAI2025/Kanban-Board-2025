import Filters from "./Filters";
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSortUp, faSortDown, faSearch, faEdit } from '@fortawesome/free-solid-svg-icons';
import './ListView.css';

const EditTaskPopup = ({ task, onClose, onSave, board }) => {
  const [formData, setFormData] = useState({
    title: task.title || '',
    description: task.description || '',
    priority: task.priority || 'medium',
    epicLabel: task.epicLabel || '',
    assignee: task.assignee?.id || ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    // Find the assignee object by id if possible
    let selectedAssignee = null;
    if (board && board.columns) {
      for (const col of board.columns) {
        for (const t of col.tasks) {
          if (t.assignee && t.assignee.id === formData.assignee) {
            selectedAssignee = t.assignee;
            break;
          }
        }
      }
    }
    const updatedTask = {
      ...task,
      title: formData.title.trim(),
      description: formData.description.trim(),
      priority: formData.priority,
      epicLabel: formData.epicLabel.trim(),
      assignee: selectedAssignee || task.assignee || null
    };
    onSave(updatedTask);
    onClose();
  };

// Begin of EditCard component
/*
  return (
    <div className="edit-card-overlay" onClick={onClose}>
      <div className="edit-card" onClick={e => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        <div className="edit-card-header">
          <div>
            <h3>Edit Card</h3>
            {task.createdAt && (
              <div className="creation-timestamp">
                Created: {}
                {task.createdAt}
              </div>
            )}
          </div>
        </div>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label>Priority</label>
            <select
              name="priority"
              value={formData.priority}
              onChange={handleChange}
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className="form-group">
            <label>Epic Label</label>
            <select
              name="epicLabel"
              value={formData.epicLabel || 'None'}
              onChange={handleChange}
              className="epic-label-select"
            >
              <option value="None">None</option>
              <option value="Backend">Backend</option>
              <option value="Frontend">Frontend</option>
              <option value="UI/UX">UI/UX</option>
              <option value="Accounting">Accounting</option>
            </select>
          </div>
          <div className="form-group">
            <label>Assignee</label>
            <input
              name="assignee"
              type="text"
              value={formData.assignee}
              onChange={handleChange}
              placeholder="Enter assignee ID or name"
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="save-btn">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};
*/
  // End of EditCard component

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
      // Determine sort order based on sortConfig
      const { key, direction } = sortConfig;
      let comparison = 0;

      // Handle different sort keys
      if (key === 'priority') {
        const aPriority = getPriorityIndex(a.originalPriority || '');
        const bPriority = getPriorityIndex(b.originalPriority || '');
        comparison = aPriority - bPriority;
      } else if (key === 'title') {
        const aTitle = a.title?.toLowerCase() || '';
        const bTitle = b.title?.toLowerCase() || '';
        comparison = aTitle.localeCompare(bTitle);
      } else if (key === 'epicLabel') {
        const aEpic = a.epicLabel?.toLowerCase() || '';
        const bEpic = b.epicLabel?.toLowerCase() || '';
        comparison = aEpic.localeCompare(bEpic);
      } else if (key === 'assignee') {
        const aAssignee = a.assigneeName?.toLowerCase() || '';
        const bAssignee = b.assigneeName?.toLowerCase() || '';
        comparison = aAssignee.localeCompare(bAssignee);
      } else if (key === 'columnName') {
        const aStatus = a.columnName?.toLowerCase() || '';
        const bStatus = b.columnName?.toLowerCase() || '';
        comparison = aStatus.localeCompare(bStatus);
      }

      // Apply sort direction
      return direction === 'asc' ? comparison : -comparison;
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
        

        {allTasks.length > 0 ? (
          <div className="list-rows">
            {allTasks.map((task) => (
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
