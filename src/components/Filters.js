import React, { useCallback, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faUser, faFilter } from '@fortawesome/free-solid-svg-icons';
import './Filters.css';

const Filters = ({
  searchText,
  setSearchText,
  selectedAssignee = 'all',
  setSelectedAssignee = () => {},
  selectedPriority = 'all',
  setSelectedPriority = () => {},
  uniqueAssignees = [],
  className = ''
}) => {
  console.log('Filters props:', { 
    selectedAssignee, 
    selectedPriority, 
    uniqueAssignees 
  });
  // Sort assignees alphabetically by name
  const sortedAssignees = React.useMemo(() => {
    return [...uniqueAssignees].sort((a, b) => {
      const nameA = a?.name || '';
      const nameB = b?.name || '';
      return nameA.localeCompare(nameB);
    });
  }, [uniqueAssignees]);

  // Handle search input change with debounce
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  // Clear all filters
  const clearFilters = useCallback((e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('Clearing all filters');
    
    // Reset parent state if callbacks are provided
    // This will trigger the parent's state update which will flow back down
    if (typeof setSearchText === 'function') {
      setSearchText('');
    }
    if (typeof setSelectedAssignee === 'function') {
      setSelectedAssignee('all');
    }
    if (typeof setSelectedPriority === 'function') {
      setSelectedPriority('all');
    }
  }, [setSearchText, setSelectedAssignee, setSelectedPriority]);

  // Check if any filter is active
  const isFilterActive = useMemo(() => {
    return (
      (searchText && searchText.trim() !== '') || 
      (selectedAssignee && selectedAssignee !== 'all') || 
      (selectedPriority && selectedPriority !== 'all')
    );
  }, [searchText, selectedAssignee, selectedPriority]);
  
  // Debug log for filter state
  useEffect(() => {
    console.log('Filter state:', {
      searchText,
      selectedAssignee,
      selectedPriority,
      isFilterActive
    });
  }, [searchText, selectedAssignee, selectedPriority, isFilterActive]);

  return (
    <div className={`filters-container ${className}`}>
      <div className="search-filter-group">
        <div className="search-box">
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search tasks..."
            value={searchText}
            onChange={handleSearchChange}
            aria-label="Search tasks"
          />
          {searchText && (
            <button 
              className="clear-search" 
              onClick={() => setSearchText('')}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>
      </div>

      <div className="filter-group">
        <div className="filter-select-wrapper">
          <select
            className="filter-select with-icon"
            value={selectedAssignee || 'all'}
            onChange={(e) => {
              console.log('Setting assignee to:', e.target.value);
              setSelectedAssignee(e.target.value);
            }}
            aria-label="Filter by assignee"
          >
            <option value="all">All Assignees</option>
            {Array.isArray(sortedAssignees) && sortedAssignees.length > 0 ? (
              sortedAssignees.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>
                  {assignee.name}
                </option>
              ))
            ) : (
              <option value="no-assignees" disabled>No assignees available</option>
            )}
          </select>
        </div>

        <div className="filter-select-wrapper">
          <select
            className="filter-select with-icon"
            value={selectedPriority || 'all'}
            onChange={(e) => {
              console.log('Setting priority to:', e.target.value);
              setSelectedPriority(e.target.value);
            }}
            aria-label="Filter by priority"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {isFilterActive && (
          <button 
            className="clear-filters"
            onClick={clearFilters}
            aria-label="Clear all filters"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(Filters);
