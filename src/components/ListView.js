import Filters from "./Filters";
import React, { useState, useMemo, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSort, faSortUp, faSortDown, faSearch } from '@fortawesome/free-solid-svg-icons';

const ListView = ({ board, onBoardUpdate }) => {
  // Set default sort to priority in descending order (Critical > High > Medium > Low)
  const [sortConfig, setSortConfig] = useState({ 
    key: 'priority', 
    direction: 'desc' 
  });
  
  // State for filters
  const [searchText, setSearchText] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [uniqueAssignees, setUniqueAssignees] = useState([]);
  
  // Extract unique assignees when board data changes
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

  // Update local state when board prop changes
  useEffect(() => {
    // Update local state if needed when board prop changes
  }, [board]);

  if (!board || !board.columns) return null;

  // Apply filters and search to tasks
  const filteredTasks = useMemo(() => {
    if (!board?.columns) return [];
    
    // Convert search text to lowercase once for case-insensitive comparison
    const searchLower = searchText.trim().toLowerCase();
    
    // Normalize priority filter value
    const priorityFilter = selectedPriority.toLowerCase();
    
    const filtered = board.columns.flatMap(column => {
      const tasks = column.tasks || [];
      return tasks
        .filter(task => {
          if (!task) return false;
          
          // Filter by search text (title or description)
          const title = task.title || '';
          const description = task.description || '';
          const matchesSearch = searchText === '' || 
            title.toLowerCase().includes(searchLower) ||
            description.toLowerCase().includes(searchLower);
          
          // Filter by assignee (handle both object and string assignee formats)
          const assigneeName = typeof task.assignee === 'string' 
            ? task.assignee 
            : task.assignee?.name || 'Unassigned';
            
          const matchesAssignee = selectedAssignee === 'all' || 
            assigneeName === selectedAssignee;
            
          // Filter by priority (handle case sensitivity and missing values)
          const taskPriority = task.priority ? task.priority.toLowerCase() : 'medium';
          const matchesPriority = priorityFilter === 'all' || 
            taskPriority === priorityFilter;
            
          return matchesSearch && matchesAssignee && matchesPriority;
        })
        .map(task => {
          // Handle both object and string assignee formats
          const assignee = typeof task.assignee === 'string' 
            ? { name: task.assignee || 'Unassigned' } 
            : task.assignee || { name: 'Unassigned' };
            
          return {
            ...task,
            columnName: column.title || 'Unknown Column',
            priority: task.priority || 'medium',
            assignee: {
              ...assignee,
              // Ensure avatar is set or generate initials
              avatar: assignee.avatar || (assignee.name 
                ? assignee.name.split(' ').map(n => n[0]).join('').toUpperCase()
                : '?')
            },
            // Ensure epicLabel exists
            epicLabel: task.epicLabel || ''
          };
        });
    });
    
    return filtered || [];
  }, [board?.columns, searchText, selectedAssignee, selectedPriority]);

  // Process filtered tasks for display
  const allTasks = useMemo(() => {
    if (!filteredTasks || !filteredTasks.length) return [];
    
    const tasks = filteredTasks.map(task => {
        // Map priority to a sortable value (higher number = higher priority)
        const priorityMap = {
          'critical': 4,
          'high': 3,
          'medium': 2,
          'low': 1
        };
        
        const priority = task.priority?.toLowerCase() || '';
        
        return {
          ...task,
          // columnName is already set in filteredTasks
          // Store the original priority for display
          originalPriority: task.priority,
          // Convert priority to numeric value for sorting
          priorityValue: priorityMap[priority] || 0,
          // For consistent display, capitalize the first letter of priority
          priority: task.priority ? 
            task.priority.charAt(0).toUpperCase() + task.priority.slice(1).toLowerCase() :
            'None'
        };
    });

    // Always sort by priorityValue (descending) first, then by the selected sort key
    return [...tasks].sort((a, b) => {
      // First sort by priority (descending)
      if (a.priorityValue > b.priorityValue) return -1;
      if (a.priorityValue < b.priorityValue) return 1;
      
      // If priorities are equal, apply the selected sort
      if (sortConfig.key && sortConfig.key !== 'priority') {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle priority sorting if this is the priority column
        if (sortConfig.key === 'priority') {
          aValue = a.priorityValue;
          bValue = b.priorityValue;
        }

        // Handle undefined or null values
        if (aValue === undefined || aValue === null) return sortConfig.direction === 'asc' ? -1 : 1;
        if (bValue === undefined || bValue === null) return sortConfig.direction === 'asc' ? 1 : -1;

        // Compare values
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
      }
      
      return 0;
    });
  }, [board.columns, sortConfig]);

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

  // Handle filter changes
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  const handleAssigneeChange = (e) => {
    setSelectedAssignee(e.target.value);
  };

  const handlePriorityChange = (e) => {
    setSelectedPriority(e.target.value);
  };

  return (
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
        <div 
          className="list-col title sortable" 
          onClick={() => requestSort('title')}
        >
          Title
          {getSortIcon('title')}
        </div>
        <div 
          className="list-col epic"
          onClick={() => requestSort('epicLabel')}
        >
          Epic
          {getSortIcon('epicLabel')}
        </div>
        <div 
          className="list-col priority sortable" 
          onClick={() => requestSort('priority')}
        >
          Priority
          {getSortIcon('priority')}
        </div>
        <div 
          className="list-col assignee sortable" 
          onClick={() => requestSort('assignee')}
        >
          Assignee
          {getSortIcon('assignee')}
        </div>
        <div 
          className="list-col status sortable" 
          onClick={() => requestSort('columnName')}
        >
          Status
          {getSortIcon('columnName')}
        </div>
      </div>
      {allTasks.length > 0 ? (
        <div className="list-rows">
          {allTasks.map((task) => (
            <div key={task.id} className="list-row" data-priority={task.priority || 'medium'}>
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
                {task.columnName}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">No tasks found</div>
      )}
    </div>
  );
};

export default ListView;
