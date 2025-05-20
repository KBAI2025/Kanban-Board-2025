import React from 'react';
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
  // Sort assignees alphabetically
  const sortedAssignees = React.useMemo(() => {
    return [...uniqueAssignees].sort((a, b) => a.localeCompare(b));
  }, [uniqueAssignees]);

  // Handle search input change with debounce
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchText('');
    setSelectedAssignee('all');
    setSelectedPriority('all');
  };

  // Check if any filter is active
  const isFilterActive = searchText || selectedAssignee !== 'all' || selectedPriority !== 'all';

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
                <option key={assignee} value={assignee}>
                  {assignee}
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
