import React from 'react';
import './AddColumn.css';

const AddColumn = ({ onAddColumn }) => {
  return (
    <div className="kanban-column add-column">
      <button 
        onClick={onAddColumn}
        className="add-column-button"
        title="Add new column"
      >
        + Add Column
      </button>
    </div>
  );
};

export default AddColumn;
